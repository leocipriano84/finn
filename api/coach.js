import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function getUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.id ?? null
}

async function getFinancialContext(userId, month) {
  const [y, m] = (month || new Date().toISOString().slice(0,7)).split('-').map(Number)
  const start = `${y}-${String(m).padStart(2,'0')}-01`
  const end = new Date(y, m, 0).toISOString().slice(0,10)

  const [txRes, profileRes] = await Promise.all([
    supabase.from('transactions')
      .select('type, amount, status, due_date, description, categories!category_id(name)')
      .eq('user_id', userId).gte('due_date', start).lte('due_date', end),
    supabase.from('profiles').select('name, score, personality_id, xp, level').eq('id', userId).single()
  ])

  const txs = txRes.data || []
  const profile = profileRes.data || {}

  const income  = txs.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)
  const expense = txs.filter(t => t.type === 'expense' || t.type === 'expense_card').reduce((s,t) => s + Number(t.amount), 0)
  const pending = txs.filter(t => t.status === 'pending' && t.due_date < new Date().toISOString().slice(0,10))

  return {
    income, expense, balance: income - expense,
    pending_count: pending.length,
    pending_amount: pending.reduce((s,t) => s + Number(t.amount), 0),
    profile, month: month || new Date().toISOString().slice(0,7)
  }
}

export default async function handler(req, res) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Não autenticado' })

  const body = req.body || {}
  const action = req.method === 'GET' ? req.query.action : body.action

  // Chat com IA
  if (req.method === 'POST' && action === 'chat') {
    const { message, history = [] } = body
    if (!message) return res.status(400).json({ error: 'Mensagem obrigatória' })

    const ctx = await getFinancialContext(userId)
    const fmt = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v)

    // Mock se não tiver chave Anthropic
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(200).json({
        reply: `Olá! Analisando suas finanças: receitas de ${fmt(ctx.income)}, despesas de ${fmt(ctx.expense)}, saldo de ${fmt(ctx.balance)}.${ctx.pending_count > 0 ? ` Você tem ${ctx.pending_count} lançamento(s) pendente(s).` : ''} (Coach em modo demo — configure ANTHROPIC_API_KEY para IA real 🤖)`,
        mock: true
      })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const systemPrompt = `Você é o Coach Finn, assistente financeiro pessoal brasileiro, empático e direto.
Contexto financeiro (${ctx.month}): Receitas: ${fmt(ctx.income)} | Despesas: ${fmt(ctx.expense)} | Saldo: ${fmt(ctx.balance)} | Pendentes em atraso: ${ctx.pending_count} (${fmt(ctx.pending_amount)})
Responda em português, seja conciso (máx 3 parágrafos), prático e amigável. Use emojis com moderação.`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages: [...history.slice(-8).map(h => ({ role: h.role, content: h.content })), { role: 'user', content: message }]
      })

      const reply = response.content[0].text

      // Salva histórico
      await supabase.from('coach_messages').insert([
        { user_id: userId, role: 'user', content: message },
        { user_id: userId, role: 'assistant', content: reply }
      ]).catch(() => {}) // ignora erros se tabela não existir ainda

      return res.status(200).json({ reply })
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao consultar a IA', details: e.message })
    }
  }

  if (req.method === 'POST' && action === 'parse-invoice') {
    const { pdfText } = body
    if (!pdfText) return res.status(400).json({ error: 'pdfText obrigatório' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(200).json({ transactions: [], mock: true })
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: `Extraia todas as transações desta fatura de cartão de crédito.\nRetorne SOMENTE JSON válido no formato:\n{"transactions":[{"date":"YYYY-MM-DD","description":"...","amount":0.00,"category_hint":"..."}]}\n\nFatura:\n${pdfText.slice(0, 8000)}` }]
      })
      const match = response.content[0].text.match(/\{[\s\S]*\}/)
      if (!match) return res.status(200).json({ transactions: [] })
      return res.status(200).json(JSON.parse(match[0]))
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  if (req.method === 'POST' && action === 'parse-receipt') {
    const { pdfText } = body
    if (!pdfText) return res.status(400).json({ error: 'pdfText obrigatório' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(200).json({ transaction: null, mock: true })
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: `Extraia os dados principais deste comprovante/nota fiscal.\nRetorne SOMENTE JSON válido no formato:\n{"transaction":{"date":"YYYY-MM-DD","description":"...","amount":0.00,"type":"expense"}}\n\nComprovante:\n${pdfText.slice(0, 4000)}` }]
      })
      const match = response.content[0].text.match(/\{[\s\S]*\}/)
      if (!match) return res.status(200).json({ transaction: null })
      return res.status(200).json(JSON.parse(match[0]))
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  if (req.method === 'POST' && action === 'parse-receipt-image') {
    const { imageBase64, mediaType } = body
    if (!imageBase64 || !mediaType) return res.status(400).json({ error: 'imageBase64 e mediaType obrigatórios' })
    if (!process.env.ANTHROPIC_API_KEY) return res.status(200).json({ transaction: null, mock: true })
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: 'Extraia os dados principais deste comprovante/nota fiscal.\nRetorne SOMENTE JSON válido no formato:\n{"transaction":{"date":"YYYY-MM-DD","description":"...","amount":0.00,"type":"expense"}}' }
        ]}]
      })
      const match = response.content[0].text.match(/\{[\s\S]*\}/)
      if (!match) return res.status(200).json({ transaction: null })
      return res.status(200).json(JSON.parse(match[0]))
    } catch (e) { return res.status(500).json({ error: e.message }) }
  }

  if (req.method === 'GET') {
    if (action === 'profile') {
      const ctx = await getFinancialContext(userId)
      let personality = 'conscious', score = 50
      if (ctx.income > 0) {
        const rate = ctx.balance / ctx.income
        if (rate >= 0.2)      { personality = 'optimizer';  score = 85 }
        else if (rate >= 0.1) { personality = 'planner';    score = 70 }
        else if (rate >= 0)   { personality = 'conscious';  score = 55 }
        else                  { personality = 'impulsive';  score = 25 }
      }
      const map = {
        optimizer:  { name: 'Otimizador', emoji: '🦅', desc: 'Você é disciplinado e estratégico' },
        planner:    { name: 'Planejador',  emoji: '🐝', desc: 'Você planeja bem e mantém controle' },
        conscious:  { name: 'Consciente',  emoji: '🦊', desc: 'Você está no caminho certo' },
        impulsive:  { name: 'Impulsivo',   emoji: '🦁', desc: 'Oportunidade de melhorar os hábitos' },
      }
      return res.status(200).json({ personality, score, ...map[personality] })
    }

    if (action === 'report') {
      const ctx = await getFinancialContext(userId)
      const fmt = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v)
      const insights = []
      if (ctx.balance < 0)         insights.push({ type: 'warning', text: `Despesas (${fmt(ctx.expense)}) superaram receitas (${fmt(ctx.income)}) este mês.` })
      if (ctx.pending_count > 0)   insights.push({ type: 'alert',   text: `${ctx.pending_count} lançamento(s) vencido(s) no total de ${fmt(ctx.pending_amount)}.` })
      if (ctx.balance > 0)         insights.push({ type: 'success', text: `Você economizou ${fmt(ctx.balance)} este mês! 🎉` })
      return res.status(200).json({ month: ctx.month, income: ctx.income, expense: ctx.expense, balance: ctx.balance, insights })
    }

    if (action === 'history') {
      const { data } = await supabase.from('coach_messages').select('*')
        .eq('user_id', userId).order('created_at', { ascending: true }).limit(50)
      return res.status(200).json(data || [])
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}
