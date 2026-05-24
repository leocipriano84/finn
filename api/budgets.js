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

  const { id, action, month } = req.query
  const currentMonth = month || new Date().toISOString().slice(0,7)

  if (req.method === 'GET') {
    if (action === 'progress') {
      const [y, m] = currentMonth.split('-').map(Number)
      const start = `${y}-${String(m).padStart(2,'0')}-01`
      const end = new Date(y, m, 0).toISOString().slice(0,10)

      const [budgetRes, txRes] = await Promise.all([
        supabase.from('budgets').select('*, categories!category_id(name,icon,color)').eq('user_id', userId).eq('month_year', currentMonth),
        supabase.from('transactions').select('category_id, amount, type').eq('user_id', userId)
          .gte('due_date', start).lte('due_date', end)
          .in('type', ['expense','expense_card']).not('ignore_in_budgets', 'eq', true)
      ])

      const budgets = budgetRes.data || []
      const txs = txRes.data || []

      const result = budgets.map(b => {
        const limit = Number(b.limit_amount ?? b.amount ?? 0)
        const spent = txs.filter(t => b.category_id ? t.category_id === b.category_id : true).reduce((s,t) => s + Number(t.amount), 0)
        const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
        const status = pct >= 100 ? 'over' : pct >= b.alert_at_percent ? 'warning' : 'ok'
        return { ...b, limit_amount: limit, spent, pct, status, remaining: Math.max(0, limit - spent) }
      })

      return res.status(200).json(result)
    }

    const { data, error } = await supabase.from('budgets')
      .select('*, categories!category_id(name,icon,color)')
      .eq('user_id', userId).eq('month_year', currentMonth).order('created_at')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const body = req.body || {}
    const { name, category_id, period, alert_at_percent, alert_threshold } = body
    const limitAmount = parseFloat(body.limit_amount ?? body.amount ?? body.value ?? body.limit ?? 0)
    const monthYear = body.month_year || body.month || currentMonth

    if (!name || !limitAmount) return res.status(400).json({ error: 'Nome e valor obrigatórios' })

    const insertData = {
      user_id: userId,
      name: String(name).substring(0,100),
      limit_amount: limitAmount,
      category_id: category_id || null,
      month_year: monthYear,
      alert_at_percent: Number(alert_threshold || alert_at_percent) || 80,
    }
    console.log('[budgets] insertData:', JSON.stringify(insertData))

    const { data, error } = await supabase.from('budgets').insert(insertData).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PUT' && id) {
    const fields = ['name','limit_amount','category_id','month_year','alert_at_percent']
    const updates = { updated_at: new Date().toISOString() }
    for (const f of fields) {
      if (req.body?.[f] !== undefined) updates[f] = req.body[f]
    }
    const { data, error } = await supabase.from('budgets').update(updates)
      .eq('id', id).eq('user_id', userId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE' && id) {
    const { error } = await supabase.from('budgets').delete().eq('id', id).eq('user_id', userId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Método não permitido' })
}
