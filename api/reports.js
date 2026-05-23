import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function getUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.id ?? null
}

function monthRange(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2,'0')}-01`
  const end = new Date(y, m, 0).toISOString().slice(0,10)
  return { start, end }
}

export default async function handler(req, res) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Não autenticado' })

  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' })

  const { action, month, type } = req.query
  const currentMonth = month || new Date().toISOString().slice(0,7)
  const { start, end } = monthRange(currentMonth)

  // DASHBOARD — formato compatível com dashboard.html antigo
  if (action === 'dashboard') {
    const { month: qMonth, year: qYear } = req.query
    let mKey = currentMonth
    if (qYear && qMonth) {
      mKey = `${qYear}-${String(qMonth).padStart(2,'0')}`
    }
    const { start: mStart, end: mEnd } = monthRange(mKey)
    const [y, m] = mKey.split('-').map(Number)

    const [txRes, goalsRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', userId).gte('date', mStart).lte('date', mEnd),
      supabase.from('goals').select('*').eq('user_id', userId).eq('completed', false).limit(3),
    ])

    const txs = txRes.data || []
    const goals = goalsRes.data || []

    const income   = txs.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)
    const expenses = txs.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)

    // Semanas
    const weekly = []
    for (let w = 1; w <= 4; w++) {
      const wTxs = txs.filter(t => {
        const d = new Date(t.date + 'T12:00:00').getDate()
        return d >= (w-1)*7+1 && d <= w*7
      })
      weekly.push({
        week: `S${w}`,
        income:   wTxs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0),
        expenses: wTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0),
      })
    }

    // Categorias
    const categories = {}
    txs.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.category || 'outros'
      categories[cat] = (categories[cat] || 0) + Number(t.amount)
    })

    // Transações recentes
    const recentTransactions = txs
      .sort((a,b) => b.date.localeCompare(a.date))
      .slice(0, 8)
      .map(t => ({ id: t.id, type: t.type, amount: t.amount, description: t.description, category: t.category, date: t.date }))

    // Calendar
    const calDays = {}
    txs.forEach(t => {
      const day = new Date(t.date + 'T12:00:00').getDate()
      if (!calDays[day]) calDays[day] = { income: 0, expense: 0 }
      if (t.type === 'income') calDays[day].income += Number(t.amount)
      else calDays[day].expense += Number(t.amount)
    })

    return res.status(200).json({
      totals: { income, expenses, balance: income - expenses, incomeChange: 0, expenseChange: 0 },
      score: 0,
      weekly,
      categories,
      recentTransactions,
      goals: goals.map(g => ({
        ...g,
        progress_pct: g.target_amount > 0 ? Math.min(100, Math.round(Number(g.current_amount)/Number(g.target_amount)*100)) : 0
      })),
      insight: income > expenses
        ? `Você economizou ${((income-expenses)/income*100).toFixed(0)}% da renda este mês. Ótimo trabalho!`
        : expenses > 0
          ? `Suas despesas superaram as receitas em ${((expenses-income)).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} este mês.`
          : 'Sem transações este mês. Que tal registrar seus lançamentos?',
      month: { year: y, month: m },
      calDays,
    })
  }

  // SUMMARY — dados do mês para SPA
  if (action === 'summary') {
    const [txRes, budgetRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', userId).gte('date', start).lte('date', end),
      supabase.from('budgets').select('*').eq('user_id', userId).eq('month_year', currentMonth).catch(() => ({ data: [] })),
    ])

    const txs = txRes.data || []
    const budgets = (budgetRes.data || budgetRes?.data) || []

    const income_confirmed  = txs.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)
    const expense_confirmed = txs.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)

    const catMap = {}
    txs.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.category || 'outros'
      if (!catMap[cat]) catMap[cat] = { name: cat, icon: '📦', color: '#6b7280', total: 0, count: 0 }
      catMap[cat].total += Number(t.amount)
      catMap[cat].count++
    })
    const expensesByCat = Object.values(catMap).sort((a,b) => b.total - a.total)

    return res.status(200).json({
      overview: {
        income:  { confirmed: income_confirmed,  pending: 0 },
        expense: { confirmed: expense_confirmed, pending: 0 },
        balance: income_confirmed - expense_confirmed,
        forecast: income_confirmed - expense_confirmed,
        card_total: 0, overdue_count: 0, overdue_amount: 0,
      },
      expense_by_category: expensesByCat,
      expense_recurrence: { fixed: 0, installment: 0, variable: expense_confirmed },
      expense_status: { confirmed: expense_confirmed, overdue: 0, upcoming: 0 },
      budgets,
      month: currentMonth,
    })
  }

  // CHARTS
  if (action === 'charts') {
    const txType = type || 'expense'
    const days = []
    const { end: mEnd } = monthRange(currentMonth)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(mEnd + 'T12:00:00')
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().slice(0,10))
    }

    const { data: dailyTxs } = await supabase.from('transactions')
      .select('amount, date, type').eq('user_id', userId).in('date', days)
      .in('type', txType === 'income' ? ['income'] : ['expense'])

    const daily = days.map(day => ({
      day,
      total: (dailyTxs || []).filter(t => t.date === day).reduce((s,t) => s + Number(t.amount), 0)
    }))

    const months6 = []
    for (let i = 5; i >= 0; i--) {
      const [y, m] = currentMonth.split('-').map(Number)
      const d = new Date(y, m - 1 - i, 1)
      months6.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
    }

    const monthlyData = await Promise.all(months6.map(async mk => {
      const { start: s, end: e } = monthRange(mk)
      const { data } = await supabase.from('transactions').select('amount, type')
        .eq('user_id', userId).gte('date', s).lte('date', e)
        .in('type', txType === 'income' ? ['income'] : ['expense'])
      return { month: mk, total: (data || []).reduce((s,t) => s + Number(t.amount), 0) }
    }))

    const { data: catData } = await supabase.from('transactions')
      .select('amount, category').eq('user_id', userId).gte('date', start).lte('date', end)
      .in('type', txType === 'income' ? ['income'] : ['expense'])

    const catMap = {}
    ;(catData || []).forEach(t => {
      const cat = t.category || 'outros'
      if (!catMap[cat]) catMap[cat] = { name: cat, icon: '📦', color: '#6b7280', total: 0, count: 0 }
      catMap[cat].total += Number(t.amount)
      catMap[cat].count++
    })
    const catTotal = Object.values(catMap).reduce((s,c) => s + c.total, 0)
    const categories = Object.values(catMap).sort((a,b) => b.total - a.total)
      .map(c => ({ ...c, pct: catTotal > 0 ? (c.total/catTotal*100) : 0 }))

    return res.status(200).json({ daily, monthly: monthlyData, categories })
  }

  // EVOLUTION
  if (action === 'evolution') {
    const year = currentMonth.split('-')[0]
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i+1).padStart(2,'0')}`)
    const data = await Promise.all(months.map(async mk => {
      const { start: s, end: e } = monthRange(mk)
      const { data: txs } = await supabase.from('transactions').select('amount, type')
        .eq('user_id', userId).gte('date', s).lte('date', e)
      const income  = (txs||[]).filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0)
      const expense = (txs||[]).filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0)
      return { month: mk, income, expense, balance: income - expense }
    }))
    return res.status(200).json(data)
  }

  // CASHFLOW
  if (action === 'cashflow') {
    const { data: txs } = await supabase.from('transactions')
      .select('amount, type, date').eq('user_id', userId).gte('date', start).lte('date', end)
    const byWeek = {}
    ;(txs||[]).forEach(t => {
      const week = `S${Math.ceil(new Date(t.date + 'T12:00:00').getDate() / 7)}`
      if (!byWeek[week]) byWeek[week] = { label: week, income: 0, expense: 0 }
      if (t.type === 'income') byWeek[week].income += Number(t.amount)
      else byWeek[week].expense += Number(t.amount)
    })
    return res.status(200).json(Object.values(byWeek))
  }

  // CATEGORIES detail
  if (action === 'categories') {
    const txType = type || 'expense'
    const { data: txs } = await supabase.from('transactions')
      .select('amount, category').eq('user_id', userId).gte('date', start).lte('date', end)
      .in('type', txType === 'income' ? ['income'] : ['expense'])

    const catMap = {}
    ;(txs||[]).forEach(t => {
      const key = t.category || 'outros'
      if (!catMap[key]) catMap[key] = { id: key, name: key, icon: '📦', color: '#6b7280', total: 0, count: 0 }
      catMap[key].total += Number(t.amount)
      catMap[key].count++
    })
    const total = Object.values(catMap).reduce((s,c) => s + c.total, 0)
    const result = Object.values(catMap).sort((a,b) => b.total - a.total)
      .map(c => ({ ...c, pct: total > 0 ? (c.total/total*100) : 0 }))
    return res.status(200).json({ categories: result, total })
  }

  // ANNUAL
  if (action === 'annual') {
    const year = (req.query.year || new Date().getFullYear()).toString()
    const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i+1).padStart(2,'0')}`)

    const [monthlyRows, catRes] = await Promise.all([
      Promise.all(months.map(async mk => {
        const { start: s, end: e } = monthRange(mk)
        const { data: txs } = await supabase.from('transactions').select('amount, type')
          .eq('user_id', userId).gte('date', s).lte('date', e)
        const income  = (txs||[]).filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0)
        const expense = (txs||[]).filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0)
        return { month: mk, income, expense, balance: income-expense, savings_pct: income>0?((income-expense)/income*100):0 }
      })),
      supabase.from('transactions').select('amount, category, type').eq('user_id', userId)
        .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`).eq('type', 'expense'),
    ])

    const totalIncome  = monthlyRows.reduce((s,m) => s + m.income, 0)
    const totalExpense = monthlyRows.reduce((s,m) => s + m.expense, 0)
    const filled = monthlyRows.filter(m => m.income > 0 || m.expense > 0)
    const bestMonth  = filled.length ? filled.reduce((a,b) => b.balance > a.balance ? b : a, filled[0]) : null
    const worstMonth = filled.length ? filled.reduce((a,b) => b.expense > a.expense ? b : a, filled[0]) : null

    const catMap = {}
    ;(catRes.data||[]).forEach(t => {
      const key = t.category || 'outros'
      if (!catMap[key]) catMap[key] = { name: key, icon: '📦', color: '#6b7280', total: 0 }
      catMap[key].total += Number(t.amount)
    })
    const topCategories = Object.values(catMap).sort((a,b) => b.total - a.total).slice(0,10)

    return res.status(200).json({
      year, months: monthlyRows,
      summary: { total_income: totalIncome, total_expense: totalExpense, total_balance: totalIncome-totalExpense,
        savings_pct: totalIncome>0 ? ((totalIncome-totalExpense)/totalIncome*100) : 0 },
      best_month: bestMonth, worst_month: worstMonth, top_categories: topCategories,
    })
  }

  // DATA — formato compatível com reports.html antigo
  if (action === 'data') {
    const { period, from: qFrom, to: qTo } = req.query
    let dateFrom, dateTo

    if (qFrom && qTo) {
      dateFrom = qFrom; dateTo = qTo
    } else {
      const today = new Date()
      if (period === 'month') {
        dateFrom = start; dateTo = end
      } else if (period === '3months') {
        const d3 = new Date(today); d3.setMonth(d3.getMonth() - 3)
        dateFrom = d3.toISOString().slice(0,10); dateTo = today.toISOString().slice(0,10)
      } else if (period === 'year') {
        dateFrom = `${today.getFullYear()}-01-01`; dateTo = `${today.getFullYear()}-12-31`
      } else {
        dateFrom = start; dateTo = end
      }
    }

    const { data: txs } = await supabase.from('transactions').select('*')
      .eq('user_id', userId).gte('date', dateFrom).lte('date', dateTo)

    const rows = txs || []
    const income   = rows.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)
    const expenses = rows.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0)

    // Categorias
    const catMap = {}
    rows.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.category || 'outros'
      if (!catMap[cat]) catMap[cat] = { name: cat, total: 0, count: 0 }
      catMap[cat].total += Number(t.amount)
      catMap[cat].count++
    })
    const categories = catMap

    // Tendência mensal
    const monthMap = {}
    rows.forEach(t => {
      const mk = t.date.slice(0,7)
      if (!monthMap[mk]) monthMap[mk] = { month: mk, income: 0, expense: 0 }
      if (t.type === 'income') monthMap[mk].income += Number(t.amount)
      else monthMap[mk].expense += Number(t.amount)
    })
    const monthlyTrend = Object.values(monthMap).sort((a,b) => a.month.localeCompare(b.month))

    // Por dia da semana
    const dowNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
    const dowMap = {}
    dowNames.forEach((n,i) => { dowMap[i] = { label: n, total: 0, count: 0 } })
    rows.filter(t => t.type === 'expense').forEach(t => {
      const dow = new Date(t.date + 'T12:00:00').getDay()
      dowMap[dow].total += Number(t.amount)
      dowMap[dow].count++
    })
    const byDow = Object.values(dowMap)

    // Heatmap
    const heatmap = {}
    rows.filter(t => t.type === 'expense').forEach(t => {
      heatmap[t.date] = (heatmap[t.date] || 0) + Number(t.amount)
    })

    // Top 10
    const top10 = Object.entries(catMap).sort(([,a],[,b]) => b.total - a.total).slice(0,10)
      .map(([k,v]) => ({ category: k, ...v }))

    return res.status(200).json({
      summary: { income, expenses, balance: income - expenses, count: rows.length },
      comparison: { income: 0, expenses: 0, balance: 0 },
      categories,
      prevCategories: {},
      monthlyTrend,
      byDow,
      heatmap,
      top10,
      period: { startDate: dateFrom, endDate: dateTo },
    })
  }

  return res.status(400).json({ error: 'action inválido' })
}
