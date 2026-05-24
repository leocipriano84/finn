import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function getUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.id ?? null
}

function calcInvoiceDates(card, referenceMonth) {
  const [y, m] = referenceMonth.split('-').map(Number)
  let closeDay = card.closing_day
  let dueDay = card.due_day

  // Fecha o mês anterior ao de referência
  let closeDate = new Date(y, m - 1, closeDay)
  if (closeDate.getMonth() !== m - 1) {
    closeDate = new Date(y, m, 0) // último dia do mês
  }
  let dueDate = new Date(y, m, dueDay)
  if (dueDate.getMonth() !== m) {
    dueDate = new Date(y, m + 1, 0)
  }

  return {
    closing_date: closeDate.toISOString().slice(0,10),
    due_date: dueDate.toISOString().slice(0,10),
  }
}

export default async function handler(req, res) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Não autenticado' })

  const { id, action } = req.query

  if (req.method === 'GET') {
    if (action === 'invoices') {
      const { card_id, month } = req.query
      const currentMonth = month || new Date().toISOString().slice(0,7)

      // Busca os últimos 3 meses de faturas
      const months = [-1, 0, 1].map(delta => {
        const [y, m] = currentMonth.split('-').map(Number)
        const d = new Date(y, m - 1 + delta, 1)
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      })

      let cardQuery = supabase.from('credit_cards').select('*').eq('user_id', userId).eq('archived', false)
      if (card_id) cardQuery = cardQuery.eq('id', card_id)
      const { data: cards } = await cardQuery

      const result = await Promise.all((cards || []).map(async card => {
        const invoiceData = await Promise.all(months.map(async (m) => {
          // Busca fatura existente ou calcula
          const { data: existing } = await supabase.from('card_invoices')
            .select('*').eq('credit_card_id', card.id).eq('reference_month', m).single()

          const dates = calcInvoiceDates(card, m)
          const [my, mm] = m.split('-').map(Number)
          const mStart = `${my}-${String(mm).padStart(2,'0')}-01`
          const mEnd = new Date(my, mm, 0).toISOString().slice(0,10)
          const { data: txs } = await supabase.from('transactions')
            .select('amount, status')
            .eq('user_id', userId).eq('credit_card_id', card.id)
            .gte('date', mStart).lte('date', mEnd)

          const total = (txs || []).reduce((s, t) => s + Number(t.amount), 0)
          const today = new Date().toISOString().slice(0,10)
          const isClosed = today > dates.closing_date
          const isPaid = existing?.status === 'paid'
          const status = isPaid ? 'paid' : (isClosed ? 'closed' : 'open')

          return { month: m, ...dates, total_amount: total, status, invoice: existing || null }
        }))

        const availableLimit = Number(card.limit_amount) - invoiceData.find(i => i.month === currentMonth)?.total_amount ?? 0

        return { ...card, invoices: invoiceData, available_limit: Math.max(0, availableLimit) }
      }))

      return res.status(200).json(result)
    }

    const { data, error } = await supabase.from('credit_cards')
      .select('*, accounts!account_id(name, bank_code, color)')
      .eq('user_id', userId).eq('archived', false).order('sort_order')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    if (action === 'payment' || req.body?.action === 'payment') {
      const { card_id, reference_month, payment_account_id, amount, payment_date } = req.body || {}
      if (!card_id || !reference_month) return res.status(400).json({ error: 'card_id e reference_month obrigatórios' })

      const dates = await supabase.from('credit_cards').select('closing_day, due_day').eq('id', card_id).single()
      const card = dates.data
      const { closing_date, due_date } = calcInvoiceDates(card, reference_month)

      const { data: existing } = await supabase.from('card_invoices')
        .select('*').eq('credit_card_id', card_id).eq('reference_month', reference_month).single()

      const invoiceData = {
        user_id: userId, credit_card_id: card_id, reference_month,
        closing_date, due_date,
        total_amount: existing?.total_amount || amount || 0,
        paid_amount: Number(amount) || 0,
        status: 'paid',
        payment_account_id: payment_account_id || null,
        payment_date: payment_date || new Date().toISOString().slice(0,10),
      }

      let result
      if (existing) {
        const { data, error } = await supabase.from('card_invoices').update(invoiceData)
          .eq('id', existing.id).select().single()
        if (error) return res.status(500).json({ error: error.message })
        result = data
      } else {
        const { data, error } = await supabase.from('card_invoices').insert(invoiceData).select().single()
        if (error) return res.status(500).json({ error: error.message })
        result = data
      }

      return res.status(200).json(result)
    }

    const { name, bank_name, bank_code, flag, limit_amount, closing_day, due_day, dynamic_closing, due_on_business_day, account_id, color, is_main, sort_order } = req.body || {}
    if (!name || !closing_day || !due_day) return res.status(400).json({ error: 'Nome, dia de fechamento e vencimento são obrigatórios' })

    if (is_main) {
      await supabase.from('credit_cards').update({ is_main: false }).eq('user_id', userId)
    }

    const { data, error } = await supabase.from('credit_cards').insert({
      user_id: userId, name, bank_name: bank_name || null, bank_code: bank_code || null,
      flag: flag || 'other', limit_amount: Number(limit_amount) || 0,
      closing_day: Number(closing_day), due_day: Number(due_day),
      dynamic_closing: dynamic_closing || false, due_on_business_day: due_on_business_day || false,
      account_id: account_id || null, color: color || '#00C9FF',
      is_main: is_main || false, sort_order: sort_order || 0,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PUT' && id) {
    const fields = ['name','bank_name','bank_code','flag','limit_amount','closing_day','due_day','dynamic_closing','due_on_business_day','account_id','color','is_main','archived','sort_order']
    const updates = {}
    for (const f of fields) {
      if (req.body?.[f] !== undefined) updates[f] = req.body[f]
    }

    if (updates.is_main) {
      await supabase.from('credit_cards').update({ is_main: false }).eq('user_id', userId)
    }

    const { data, error } = await supabase.from('credit_cards').update(updates)
      .eq('id', id).eq('user_id', userId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE' && id) {
    const { error } = await supabase.from('credit_cards').update({ archived: true })
      .eq('id', id).eq('user_id', userId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ archived: true })
  }

  return res.status(405).json({ error: 'Método não permitido' })
}
