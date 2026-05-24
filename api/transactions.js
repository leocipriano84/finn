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

  // GET
  if (req.method === 'GET') {
    if (action === 'summary') {
      const { month, year } = req.query
      let monthKey
      if (year && month) monthKey = `${year}-${String(Number(month)).padStart(2,'0')}`
      else if (month && month.includes('-')) monthKey = month
      else monthKey = new Date().toISOString().slice(0,7)
      const [y, m] = monthKey.split('-')
      const start = `${y}-${m}-01`
      const end = new Date(Number(y), Number(m), 0).toISOString().slice(0,10)

      const { data, error } = await supabase.from('transactions')
        .select('type, amount, date')
        .eq('user_id', userId).gte('date', start).lte('date', end)
      if (error) return res.status(500).json({ error: error.message })

      const txs = data || []
      const income   = txs.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)
      const expense  = txs.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)
      const today = new Date().toISOString().slice(0,10)
      const overdue  = txs.filter(t => t.type === 'expense' && t.date < today)

      return res.status(200).json({
        income: { confirmed: income, pending: 0, total: income },
        expense: { confirmed: expense, pending: 0, total: expense },
        card_total: 0, overdue_count: 0, overdue_amount: 0,
        balance: income - expense,
        forecast: income - expense,
      })
    }

    // Export CSV
    if (action === 'export') {
      const { from, to, type: txType, format } = req.query
      let q = supabase.from('transactions').select('date, type, amount, description, category, notes')
        .eq('user_id', userId).order('date', { ascending: false })
      if (from) q = q.gte('date', from)
      if (to)   q = q.lte('date', to)
      if (txType) q = q.eq('type', txType)
      const { data, error } = await q
      if (error) return res.status(500).json({ error: error.message })
      const rows = data || []
      const csv = ['Data,Tipo,Valor,Descrição,Categoria,Observações',
        ...rows.map(r => [r.date, r.type, r.amount, `"${(r.description||'').replace(/"/g,'""')}"`, r.category, `"${(r.notes||'').replace(/"/g,'""')}"`].join(','))
      ].join('\n')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="transacoes.csv"')
      return res.status(200).send('﻿' + csv)
    }

    // List
    const { month, year, type, status, category, search, page = 1, limit = 50, date_start, date_end } = req.query

    let query = supabase.from('transactions').select('*').eq('user_id', userId)

    if (month || year) {
      let monthKey
      if (year && month) monthKey = `${year}-${String(Number(month)).padStart(2,'0')}`
      else if (month && month.includes('-')) monthKey = month
      if (monthKey) {
        const [y, m] = monthKey.split('-')
        const mStart = `${y}-${m}-01`
        const mEnd = new Date(Number(y), Number(m), 0).toISOString().slice(0,10)
        query = query.gte('date', mStart).lte('date', mEnd)
      }
    }
    if (date_start) query = query.gte('date', date_start)
    if (date_end)   query = query.lte('date', date_end)
    if (type && type !== 'all') query = query.eq('type', type)
    if (category && category !== 'all') query = query.eq('category', category)
    if (search) query = query.ilike('description', `%${search}%`)

    query = query.order('date', { ascending: false }).order('created_at', { ascending: false })
    query = query.range((Number(page)-1) * Number(limit), Number(page) * Number(limit) - 1)

    const { data, error, count } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data: data || [], count, page: Number(page), limit: Number(limit) })
  }

  // POST
  if (req.method === 'POST') {
    if (action === 'confirm' || req.body?.action === 'confirm') {
      return res.status(200).json({ ok: true })
    }
    if (action === 'bulk-confirm' || req.body?.action === 'bulk-confirm') {
      return res.status(200).json({ updated: 0 })
    }

    const { description, amount, type, category, date, notes, frequency, recurrence, installment_total, due_date, status, account_id, credit_card_id, category_id } = req.body || {}
    if (!description || !amount || !type) {
      return res.status(400).json({ error: 'Descrição, valor e tipo são obrigatórios' })
    }

    const baseDate = due_date || date || new Date().toISOString().slice(0,10)
    const txStatus = status || 'pending'
    const nInstallments = Number(installment_total) || 1
    const freq = recurrence === 'installment' ? 'once'
      : recurrence === 'fixed_monthly' ? 'monthly'
      : recurrence === 'fixed_weekly' ? 'weekly'
      : recurrence === 'fixed_yearly' ? 'yearly'
      : frequency || 'once'

    if (recurrence === 'installment' && nInstallments > 1) {
      const perInstallment = +(Number(amount) / nInstallments).toFixed(2)
      const records = []
      for (let i = 0; i < nInstallments; i++) {
        const [y, mo, d] = baseDate.split('-').map(Number)
        const dt = new Date(y, mo - 1 + i, d)
        const isoDate = dt.toISOString().slice(0,10)
        records.push({
          user_id: userId, description: `${description} (${i+1}/${nInstallments})`,
          amount: perInstallment, type, category: category || 'outros',
          date: isoDate, due_date: isoDate, notes: notes || null, frequency: 'once',
          status: txStatus, account_id: account_id || null, credit_card_id: credit_card_id || null,
          category_id: category_id || null,
        })
      }
      const { data, error } = await supabase.from('transactions').insert(records).select()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json(data)
    }

    const record = {
      user_id: userId, description, amount: Number(amount), type,
      category: category || 'outros', date: baseDate, due_date: baseDate,
      notes: notes || null, frequency: freq, status: txStatus,
      account_id: account_id || null, credit_card_id: credit_card_id || null,
      category_id: category_id || null,
    }
    const { data, error } = await supabase.from('transactions').insert(record).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // PUT
  if (req.method === 'PUT' && id) {
    const allowed = ['description','amount','type','category','date','due_date','notes','frequency','status','account_id','credit_card_id','category_id','ignore_in_charts','ignore_in_budgets','ignore_in_totals']
    const updates = {}
    for (const f of allowed) {
      if (req.body?.[f] !== undefined) updates[f] = req.body[f]
    }
    const { data, error } = await supabase.from('transactions').update(updates)
      .eq('id', id).eq('user_id', userId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // DELETE
  if (req.method === 'DELETE' && id) {
    try {
      const { data: snap } = await supabase.from('transactions').select('*').eq('id', id).eq('user_id', userId).single()
      if (snap) {
        try {
          await supabase.from('transaction_audit_log').insert({
            user_id: userId, action: 'deleted', transaction_id: id, transaction_data: snap
          })
        } catch (_) {}
      }
      const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', userId)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ deleted: true })
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Erro ao excluir' })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}
