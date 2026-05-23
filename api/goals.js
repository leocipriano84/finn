import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function getUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.id ?? null
}

export default async function handler(req, res) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Não autenticado' })

  const { id, action } = req.query

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    const goals = (data || []).map(g => {
      const pct = Math.min(100, g.target_amount > 0 ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100) : 0)
      const remaining = Math.max(0, Number(g.target_amount) - Number(g.current_amount))
      let monthly_suggestion = null
      if (g.deadline && remaining > 0) {
        const months = Math.max(1, Math.ceil((new Date(g.deadline) - new Date()) / (30 * 86400000)))
        monthly_suggestion = Math.ceil(remaining / months)
      }
      return { ...g, progress_pct: pct, remaining, monthly_suggestion }
    })
    return res.status(200).json(goals)
  }

  if (req.method === 'POST') {
    if (action === 'deposit' || req.body?.action === 'deposit') {
      const { goal_id, amount } = req.body || {}
      if (!goal_id || !amount) return res.status(400).json({ error: 'goal_id e amount obrigatórios' })
      const { data: existing } = await supabase.from('goals').select('current_amount, target_amount').eq('id', goal_id).eq('user_id', userId).single()
      if (!existing) return res.status(404).json({ error: 'Meta não encontrada' })
      const newAmount = Number(existing.current_amount) + Number(amount)
      const completed = newAmount >= Number(existing.target_amount)
      const { data, error } = await supabase.from('goals').update({
        current_amount: Number(newAmount.toFixed(2)),
        completed,
        updated_at: new Date().toISOString()
      }).eq('id', goal_id).eq('user_id', userId).select().single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data)
    }

    const { title, target_amount, current_amount = 0, deadline, icon, color, account_id } = req.body || {}
    if (!title || !target_amount) return res.status(400).json({ error: 'Título e valor alvo obrigatórios' })

    const { data, error } = await supabase.from('goals').insert({
      user_id: userId,
      title: String(title).substring(0,100),
      target_amount: Number(Number(target_amount).toFixed(2)),
      current_amount: Number(Number(current_amount).toFixed(2)),
      deadline: deadline || null,
      icon: icon || '🎯',
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PUT' && id) {
    const fields = ['title','target_amount','current_amount','deadline','icon','completed']
    const updates = { updated_at: new Date().toISOString() }
    for (const f of fields) {
      if (req.body?.[f] !== undefined) updates[f] = req.body[f]
    }
    const { data, error } = await supabase.from('goals').update(updates).eq('id', id).eq('user_id', userId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE' && id) {
    const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', userId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Método não permitido' })
}
