import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function getUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.id ?? null
}

const ACHIEVEMENTS = [
  { id: 'first_transaction',  name: 'Primeiro passo',       emoji: '🚀', xp: 50,  desc: 'Registrou o primeiro lançamento' },
  { id: 'week_streak',        name: 'Uma semana',            emoji: '🔥', xp: 100, desc: '7 dias consecutivos usando o app' },
  { id: 'budget_created',     name: 'Planejador',            emoji: '📊', xp: 75,  desc: 'Criou o primeiro orçamento' },
  { id: 'goal_created',       name: 'Sonhador',              emoji: '🎯', xp: 75,  desc: 'Criou o primeiro objetivo' },
  { id: 'goal_completed',     name: 'Realizador',            emoji: '🏆', xp: 200, desc: 'Concluiu um objetivo financeiro' },
  { id: 'accounts_connected', name: 'Banco conectado',       emoji: '🏦', xp: 100, desc: 'Cadastrou uma conta bancária' },
  { id: 'card_added',         name: 'Carteirinha',           emoji: '💳', xp: 75,  desc: 'Cadastrou um cartão de crédito' },
  { id: 'positive_balance',   name: 'No azul',               emoji: '💚', xp: 150, desc: 'Fechou um mês com saldo positivo' },
  { id: 'savings_10pct',      name: 'Economizador',          emoji: '🐷', xp: 200, desc: 'Economizou 10% da renda em um mês' },
  { id: '100_transactions',   name: 'Centenário',            emoji: '💯', xp: 300, desc: '100 lançamentos registrados' },
  { id: 'referred_friend',    name: 'Influenciador',         emoji: '👥', xp: 250, desc: 'Indicou um amigo para o Finn' },
  { id: 'profile_complete',   name: 'Perfil completo',       emoji: '✅', xp: 50,  desc: 'Completou todos os dados do perfil' },
]

export default async function handler(req, res) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Não autenticado' })

  const action = req.query.action || req.body?.action

  if (req.method === 'GET') {
    if (action === 'profile') {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data)
    }

    if (action === 'preferences') {
      const { data } = await supabase.from('user_preferences').select('*').eq('user_id', userId).single()
      return res.status(200).json(data || {})
    }

    if (action === 'achievements') {
      const { data: unlocked } = await supabase.from('user_achievements').select('achievement_id, unlocked_at').eq('user_id', userId)
      const unlockedIds = new Set((unlocked || []).map(u => u.achievement_id))
      const unlockedMap = Object.fromEntries((unlocked || []).map(u => [u.achievement_id, u.unlocked_at]))

      return res.status(200).json(ACHIEVEMENTS.map(a => ({
        ...a,
        unlocked: unlockedIds.has(a.id),
        unlocked_at: unlockedMap[a.id] || null,
      })))
    }

    if (action === 'audit-log') {
      const { data, error } = await supabase.from('transaction_audit_log')
        .select('*').eq('user_id', userId)
        .in('action', ['deleted'])
        .order('performed_at', { ascending: false })
        .limit(50)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data || [])
    }
  }

  if (req.method === 'POST') {
    if (action === 'gamification') {
      const [txRes, goalsRes] = await Promise.all([
        supabase.from('transactions').select('id', { count: 'exact' }).eq('user_id', userId),
        supabase.from('goals').select('id, completed').eq('user_id', userId),
      ])
      const txCount = txRes.count ?? (txRes.data || []).length
      const goals = goalsRes.data || []

      const toEarn = []
      if (txCount >= 1) toEarn.push('first_transaction')
      if (txCount >= 100) toEarn.push('100_transactions')
      if (goals.length >= 1) toEarn.push('goal_created')
      if (goals.some(g => g.completed)) toEarn.push('goal_completed')

      for (const id of toEarn) {
        await supabase.from('user_achievements')
          .upsert({ user_id: userId, achievement_id: id, unlocked_at: new Date().toISOString() }, { onConflict: 'user_id,achievement_id', ignoreDuplicates: true })
          .catch(() => {})
      }

      const { data: all } = await supabase.from('user_achievements').select('achievement_id').eq('user_id', userId)
      return res.status(200).json({ unlocked: (all || []).map(a => a.achievement_id) })
    }

    if (action === 'clear-data') {
      // Delete children before parents to avoid FK violations
      const tables = ['transactions', 'card_invoices', 'budgets', 'goals', 'coach_messages', 'categories', 'credit_cards', 'accounts']
      for (const table of tables) {
        try {
          const { error } = await supabase.from(table).delete().eq('user_id', userId)
          if (error) console.error(`[clear-data] ${table}:`, error.message)
        } catch (e) { console.error(`[clear-data] ${table} exception:`, e.message) }
      }
      return res.status(200).json({ ok: true })
    }

    if (action === 'delete-account') {
      const tables = ['transactions', 'card_invoices', 'budgets', 'goals', 'coach_messages', 'categories', 'credit_cards', 'accounts']
      for (const table of tables) {
        await supabase.from(table).delete().eq('user_id', userId).catch(() => {})
      }
      await supabase.from('profiles').delete().eq('id', userId).catch(() => {})
      await supabase.auth.admin.deleteUser(userId).catch(() => {})
      return res.status(200).json({ ok: true })
    }

    if (action === 'restore-transaction') {
      const { audit_id } = req.body || {}
      if (!audit_id) return res.status(400).json({ error: 'audit_id obrigatório' })
      const { data: log } = await supabase.from('transaction_audit_log').select('transaction_data').eq('id', audit_id).eq('user_id', userId).single()
      if (!log?.transaction_data) return res.status(404).json({ error: 'Registro não encontrado' })

      const snap = { ...log.transaction_data }
      delete snap.id
      snap.user_id = userId

      const { data, error } = await supabase.from('transactions').insert(snap).select().single()
      if (error) return res.status(500).json({ error: error.message })

      await supabase.from('transaction_audit_log').delete().eq('id', audit_id).catch(() => {})
      return res.status(201).json(data)
    }
  }

  if (req.method === 'PUT') {
    if (action === 'profile') {
      const { name, avatar_url } = req.body || {}
      const updates = { updated_at: new Date().toISOString() }
      if (name !== undefined) updates.name = String(name).substring(0,100)
      if (avatar_url !== undefined) updates.avatar_url = avatar_url

      const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data)
    }

    if (action === 'preferences') {
      const prefs = { ...req.body }
      delete prefs.action
      prefs.updated_at = new Date().toISOString()

      const { data: existing } = await supabase.from('user_preferences').select('id').eq('user_id', userId).single()

      let result
      if (existing) {
        const { data, error } = await supabase.from('user_preferences').update(prefs).eq('user_id', userId).select().single()
        if (error) return res.status(500).json({ error: error.message })
        result = data
      } else {
        const { data, error } = await supabase.from('user_preferences').insert({ user_id: userId, ...prefs }).select().single()
        if (error) return res.status(500).json({ error: error.message })
        result = data
      }

      return res.status(200).json(result)
    }
  }

  if (req.method === 'GET' && action === 'export-data') {
    const [txRes, profRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', userId).single(),
    ])
    return res.status(200).json({
      profile: profRes.data || {},
      transactions: txRes.data || [],
      exported_at: new Date().toISOString(),
    })
  }

  if (req.method === 'DELETE' && action === 'delete') {
    const { confirm } = req.body || {}
    if (confirm !== 'EXCLUIR MINHA CONTA') return res.status(400).json({ error: 'Confirmação inválida' })
    await supabase.from('transactions').delete().eq('user_id', userId).catch(() => {})
    await supabase.from('goals').delete().eq('user_id', userId).catch(() => {})
    await supabase.from('budgets').delete().eq('user_id', userId).catch(() => {})
    await supabase.auth.admin.deleteUser(userId).catch(() => {})
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Método não permitido' })
}
