// api/coach.js
// Coach de IA do Finn — exclusivo para usuários Pro
// Protegido pelo middleware withPro

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { withPro } from '../lib/withPro'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Limite de mensagens por dia no plano Pro
const DAILY_LIMIT = 50

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { message, history = [] } = req.body

  if (!message || typeof message !== 'string' || message.length > 1000) {
    return res.status(400).json({ error: 'Mensagem inválida' })
  }

  const userId = req.user.id

  // Verifica limite diário
  const today = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('coach_messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', `${today}T00:00:00`)

  if (count >= DAILY_LIMIT) {
    return res.status(429).json({
      error: `Limite de ${DAILY_LIMIT} mensagens por dia atingido. Volta amanhã! 😄`
    })
  }

  // Busca resumo financeiro do usuário para dar contexto à IA
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, type, category, date')
    .eq('user_id', userId)
    .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(50)

  const totalExpenses = transactions
    ?.filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0) || 0

  const totalIncome = transactions
    ?.filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0) || 0

  const byCategory = transactions
    ?.filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount
      return acc
    }, {})

  const financialContext = `
Resumo financeiro do usuário nos últimos 30 dias:
- Receita total: R$ ${totalIncome.toFixed(2)}
- Despesas totais: R$ ${totalExpenses.toFixed(2)}
- Saldo: R$ ${(totalIncome - totalExpenses).toFixed(2)}
- Gastos por categoria: ${JSON.stringify(byCategory, null, 2)}
  `.trim()

  // Monta o histórico de mensagens para a IA
  const messages = [
    ...history.slice(-10), // últimas 10 mensagens para contexto
    { role: 'user', content: message }
  ]

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `Você é o Finn, um coach financeiro pessoal brasileiro, empático e direto.
Seu objetivo é ajudar o usuário a melhorar sua saúde financeira de forma prática.

Contexto financeiro atual do usuário:
${financialContext}

Regras de comportamento:
- Seja amigável, use linguagem simples e brasileira
- Dê conselhos práticos e específicos, não genéricos
- Quando identificar um padrão negativo, sugira uma ação concreta
- Use emojis com moderação para tornar a conversa mais leve
- Nunca invente dados — use apenas o contexto fornecido
- Respostas curtas e diretas (máx 3 parágrafos)
- Não seja condescendente — trate o usuário como adulto inteligente`,
      messages
    })

    const reply = response.content[0].text

    // Salva a mensagem no histórico
    await supabase.from('coach_messages').insert({
      user_id: userId,
      role: 'user',
      content: message
    })
    await supabase.from('coach_messages').insert({
      user_id: userId,
      role: 'assistant',
      content: reply
    })

    return res.status(200).json({ reply })

  } catch (err) {
    console.error('[coach] Anthropic error:', err)
    return res.status(500).json({ error: 'Erro ao consultar o coach. Tente novamente.' })
  }
}

export default withPro(handler)
