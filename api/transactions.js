import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function getUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.id ?? null
}

function parseAccountSelection(body) {
  const sel = body.account_selection || ''
  if (sel.startsWith('card:')) return { account_id: null, credit_card_id: sel.replace('card:', '') }
  if (sel.startsWith('account:')) return { account_id: sel.replace('account:', ''), credit_card_id: null }
  const account_id = body.account_id && body.account_id !== '' && body.account_id !== 'null' ? body.account_id : null
  const credit_card_id = body.credit_card_id && body.credit_card_id !== '' && body.credit_card_id !== 'null' ? body.credit_card_id : null
  return { account_id, credit_card_id }
}

function normalizeType(type) {
  if (type === 'card' || type === 'expense_card') return 'expense_card'
  if (type === 'expense') return 'expense'
  if (type === 'income') return 'income'
  if (type === 'transfer') return 'transfer'
  return type || 'expense'
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
        .select('type, amount, date, status')
        .eq('user_id', userId).gte('date', start).lte('date', end)
      if (error) return res.status(500).json({ error: error.message })

      const txs = data || []
      const income_confirmed  = txs.filter(t => t.type === 'income'  && t.status !== 'pending').reduce((s,t) => s + Number(t.amount), 0)
      const income_pending    = txs.filter(t => t.type === 'income'  && t.status === 'pending').reduce((s,t) => s + Number(t.amount), 0)
      const expense_confirmed = txs.filter(t => t.type === 'expense' && t.status !== 'pending').reduce((s,t) => s + Number(t.amount), 0)
      const expense_pending   = txs.filter(t => t.type === 'expense' && t.status === 'pending').reduce((s,t) => s + Number(t.amount), 0)
      const today = new Date().toISOString().slice(0,10)
      const overdue = txs.filter(t => t.type === 'expense' && t.status === 'pending' && t.date < today)

      return res.status(200).json({
        income:  { confirmed: income_confirmed,  pending: income_pending,  total: income_confirmed  + income_pending  },
        expense: { confirmed: expense_confirmed, pending: expense_pending, total: expense_confirmed + expense_pending },
        card_total: 0,
        overdue_count: overdue.length,
        overdue_amount: overdue.reduce((s,t) => s + Number(t.amount), 0),
        balance: income_confirmed - expense_confirmed,
        forecast: (income_confirmed + income_pending) - (expense_confirmed + expense_pending),
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

    // Single transaction fetch
    if (req.query.single === '1' && req.query.id) {
      const { data, error } = await supabase.from('transactions')
        .select('*, accounts(id,name), credit_cards(id,name)')
        .eq('id', req.query.id)
        .eq('user_id', userId)
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data)
    }

    // List
    const { month, year, type, status, category, search, page = 1, limit = 50, date_start, date_end, recurrence_group_id } = req.query

    let query = supabase.from('transactions')
      .select('*, accounts(id,name), credit_cards(id,name)')
      .eq('user_id', userId)

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
    if (status) query = query.eq('status', status)
    if (category && category !== 'all') query = query.eq('category', category)
    if (search) query = query.ilike('description', `%${search}%`)
    if (recurrence_group_id) query = query.eq('recurrence_group_id', recurrence_group_id)

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

    if (action === 'generate-recurring') {
      const today = new Date()
      const monthStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`
      const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`

      const { data: templates } = await supabase.from('transactions').select('*')
        .eq('user_id', userId)
        .neq('recurrence', 'none')
        .not('recurrence', 'is', null)
        .neq('recurrence', 'installment')
        .like('date', `${prevMonthStr}%`)
        .limit(100)

      let created = 0
      for (const tx of templates || []) {
        const { data: existing } = await supabase.from('transactions').select('id')
          .eq('user_id', userId).eq('description', tx.description)
          .eq('amount', tx.amount).eq('type', tx.type).like('date', `${monthStr}%`).limit(1)
        if (existing?.length) continue

        const day = tx.date.split('-')[2]
        const newDate = `${monthStr}-${day}`
        const { error } = await supabase.from('transactions').insert({
          user_id: userId, type: tx.type, amount: tx.amount, description: tx.description,
          date: newDate, due_date: newDate, status: 'pending',
          recurrence: tx.recurrence, frequency: tx.frequency || 'once',
          category_id: tx.category_id || null, account_id: tx.account_id || null,
          credit_card_id: tx.credit_card_id || null, notes: tx.notes || null,
        })
        if (!error) created++
      }
      return res.status(200).json({ success: true, created })
    }

    console.log('[transactions] body recebido:', JSON.stringify({
      type: req.body?.type,
      recurrence: req.body?.recurrence,
      account_id: req.body?.account_id,
      credit_card_id: req.body?.credit_card_id,
      account_selection: req.body?.account_selection,
      category_id: req.body?.category_id,
      category_id_type: typeof req.body?.category_id,
      category_id_empty: req.body?.category_id === '',
      status: req.body?.status,
    }))

    const { description, amount, category, date, notes, frequency, recurrence, installment_total, due_date, status, category_id } = req.body || {}
    const { account_id, credit_card_id } = parseAccountSelection(req.body || {})
    const type = normalizeType(req.body?.type)
    if (!description || !amount || !type) {
      return res.status(400).json({ error: 'Descrição, valor e tipo são obrigatórios' })
    }

    const baseDate = due_date || date || new Date().toISOString().slice(0,10)
    const txStatus = status || 'pending'
    const nInstallments = Number(installment_total) || 1
    const freq = recurrence === 'installment' ? 'once'
      : (recurrence === 'monthly' || recurrence === 'fixed_monthly') ? 'monthly'
      : (recurrence === 'weekly'  || recurrence === 'fixed_weekly')  ? 'weekly'
      : (recurrence === 'yearly'  || recurrence === 'fixed_yearly')  ? 'yearly'
      : recurrence === 'daily'      ? 'daily'
      : recurrence === 'biweekly'   ? 'biweekly'
      : recurrence === 'bimonthly'  ? 'bimonthly'
      : recurrence === 'quarterly'  ? 'quarterly'
      : recurrence === 'semiannual' ? 'semiannual'
      : frequency || 'once'

    if (recurrence === 'installment' && nInstallments > 1) {
      const groupId = crypto.randomUUID()
      const perInstallment = +(Number(amount) / nInstallments).toFixed(2)
      const records = []
      for (let i = 0; i < nInstallments; i++) {
        const [y, mo, d] = baseDate.split('-').map(Number)
        const dt = new Date(y, mo - 1 + i, d)
        const isoDate = dt.toISOString().slice(0,10)
        records.push({
          user_id: userId, description: `${description} (${i+1}/${nInstallments})`,
          amount: perInstallment, type: normalizeType(type), category: category || 'outros',
          date: isoDate, due_date: isoDate, notes: notes || null, frequency: 'once',
          recurrence: 'installment',
          status: txStatus, account_id, credit_card_id,
          category_id: category_id || null,
          installment_current: i + 1, installment_total: nInstallments,
          recurrence_group_id: groupId,
        })
      }
      const { data, error } = await supabase.from('transactions').insert(records).select()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json(data)
    }

    const record = {
      user_id: userId, description, amount: Number(amount), type,
      category: category || 'outros', date: baseDate, due_date: baseDate,
      notes: notes || null, frequency: freq, recurrence: recurrence || 'none',
      status: txStatus,
      account_id,
      credit_card_id,
      category_id: category_id || null,
    }

    // OFX dedup: verificar se fitid já foi importado (só se coluna existir)
    const ofxFitid = req.body?.ofx_fitid || null
    if (ofxFitid) {
      try {
        const { data: dup } = await supabase.from('transactions')
          .select('id').eq('ofx_fitid', ofxFitid).eq('user_id', userId).maybeSingle()
        if (dup) return res.status(409).json({ error: 'Transação OFX já importada', skipped: true })
        record.ofx_fitid = ofxFitid
        record.ofx_imported_at = new Date().toISOString()
      } catch { /* coluna ofx_fitid ainda não existe */ }
    }

    const { data, error } = await supabase.from('transactions').insert(record).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // PUT
  if (req.method === 'PUT' && id) {
    const allowed = ['description','amount','type','category','date','due_date','notes','frequency','recurrence','status','account_id','credit_card_id','category_id','ignore_in_charts','ignore_in_budgets','ignore_in_totals']
    const updates = {}
    for (const f of allowed) {
      if (req.body?.[f] !== undefined) {
        // Convert empty string to null for UUID fields to avoid FK constraint errors
        if ((f === 'account_id' || f === 'credit_card_id' || f === 'category_id') && req.body[f] === '') {
          updates[f] = null
        } else {
          updates[f] = req.body[f]
        }
      }
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
