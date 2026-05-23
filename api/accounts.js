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

  // GET /api/accounts — listar ou saldo
  if (req.method === 'GET') {
    if (action === 'balance') {
      const { month } = req.query
      const monthStart = month ? `${month}-01` : new Date().toISOString().slice(0,7) + '-01'
      const [y, m] = (month || new Date().toISOString().slice(0,7)).split('-')
      const monthEnd = new Date(Number(y), Number(m), 0).toISOString().slice(0,10)

      const [accRes, txRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', userId).eq('archived', false).order('sort_order'),
        supabase.from('transactions').select('account_id, transfer_account_id, type, amount, status, due_date')
          .eq('user_id', userId).gte('due_date', monthStart).lte('due_date', monthEnd)
      ])

      if (accRes.error) return res.status(500).json({ error: accRes.error.message })

      const txs = txRes.data || []
      const accounts = (accRes.data || []).map(acc => {
        const accTxs = txs.filter(t => t.account_id === acc.id)
        const confirmed = accTxs.filter(t => t.status === 'confirmed')
        const all = accTxs

        const income_confirmed = confirmed.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)
        const expense_confirmed = confirmed.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)
        const transfer_in = confirmed.filter(t => t.transfer_account_id === acc.id).reduce((s,t) => s + Number(t.amount), 0)
        const transfer_out = confirmed.filter(t => t.type === 'transfer').reduce((s,t) => s + Number(t.amount), 0)

        const income_pending = all.filter(t => t.type === 'income' && t.status === 'pending').reduce((s,t) => s + Number(t.amount), 0)
        const expense_pending = all.filter(t => t.type === 'expense' && t.status === 'pending').reduce((s,t) => s + Number(t.amount), 0)

        const balance = Number(acc.initial_balance) + income_confirmed - expense_confirmed + transfer_in - transfer_out
        const forecast = balance + income_pending - expense_pending

        return { ...acc, income_confirmed, expense_confirmed, transfer_in, transfer_out, income_pending, expense_pending, balance, forecast }
      })

      return res.status(200).json(accounts)
    }

    // Lista simples
    const { data, error } = await supabase
      .from('accounts').select('*').eq('user_id', userId).eq('archived', false).order('sort_order')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // POST — criar
  if (req.method === 'POST') {
    const { name, bank_name, bank_code, type, initial_balance, color, icon, show_in_summary, ignore_in_totals, ignore_in_balance, is_default, overdraft_limit, sort_order } = req.body || {}
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' })

    if (is_default) {
      await supabase.from('accounts').update({ is_default: false }).eq('user_id', userId)
    }

    const { data, error } = await supabase.from('accounts').insert({
      user_id: userId,
      name: String(name).substring(0, 100),
      bank_name: bank_name || null,
      bank_code: bank_code || null,
      type: type || 'checking',
      initial_balance: Number(initial_balance) || 0,
      current_balance: Number(initial_balance) || 0,
      overdraft_limit: Number(overdraft_limit) || 0,
      color: color || '#00F5A0',
      icon: icon || null,
      show_in_summary: show_in_summary !== false,
      ignore_in_totals: ignore_in_totals || false,
      ignore_in_balance: ignore_in_balance || false,
      is_default: is_default || false,
      sort_order: sort_order || 0,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // PUT — editar
  if (req.method === 'PUT' && id) {
    const updates = {}
    const fields = ['name','bank_name','bank_code','type','initial_balance','overdraft_limit','color','icon','show_in_summary','ignore_in_totals','ignore_in_balance','is_default','archived','sort_order']
    for (const f of fields) {
      if (req.body?.[f] !== undefined) updates[f] = req.body[f]
    }
    updates.updated_at = new Date().toISOString()

    if (updates.is_default) {
      await supabase.from('accounts').update({ is_default: false }).eq('user_id', userId)
    }

    const { data, error } = await supabase.from('accounts').update(updates)
      .eq('id', id).eq('user_id', userId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // DELETE — arquivar/excluir
  if (req.method === 'DELETE' && id) {
    const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true })
      .eq('account_id', id).eq('user_id', userId)
    if (count > 0) {
      const { error } = await supabase.from('accounts').update({ archived: true })
        .eq('id', id).eq('user_id', userId)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ archived: true })
    }
    const { error } = await supabase.from('accounts').delete().eq('id', id).eq('user_id', userId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Método não permitido' })
}
