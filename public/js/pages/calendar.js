import { endpoints } from '../core/api.js'
import { store } from '../core/store.js'
import { fmt } from '../core/utils.js'

let unsubMonth = null
let currentCalType = ''

export async function render(el) {
  if (!document.getElementById('cal-style')) {
    const s = document.createElement('style')
    s.id = 'cal-style'
    s.textContent = `
      .cal-header{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:6px}
      .cal-header-day{text-align:center;font-size:11px;font-weight:600;color:var(--color-text-muted);padding:4px 0}
      .cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
      .cal-cell{min-height:70px;border-radius:8px;padding:6px 5px;background:var(--color-card);cursor:pointer;transition:background 150ms;overflow:hidden}
      .cal-cell:hover{background:var(--color-card-hover)}
      .cal-cell.cal-empty{background:transparent;cursor:default;pointer-events:none}
      .cal-cell.cal-today{box-shadow:inset 0 0 0 2px var(--color-green)}
      .cal-day-num{font-size:12px;font-weight:600;margin-bottom:3px;line-height:1}
      .cal-today .cal-day-num{color:var(--color-green)}
      .cal-dots{display:flex;gap:2px;flex-wrap:wrap;margin-bottom:2px}
      .cal-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
      .cal-more{font-size:8px;color:var(--color-text-muted);line-height:1}
      .cal-amt{font-size:9px;font-family:var(--font-mono);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cal-chip{padding:5px 12px;border-radius:20px;border:1px solid var(--color-border);background:var(--color-card);color:var(--color-text-soft);font-size:13px;cursor:pointer;transition:all 150ms}
      .cal-chip.active{background:var(--color-green);color:#050508;border-color:var(--color-green)}
      @media(max-width:480px){.cal-cell{min-height:52px;padding:4px 3px}.cal-amt{display:none}.cal-day-num{font-size:11px}}
    `
    document.head.appendChild(s)
  }

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <div style="padding:var(--space-3) var(--space-5);border-bottom:1px solid var(--color-border);flex-shrink:0;display:flex;gap:6px">
        <button class="cal-chip active" data-cal-type="">Todos</button>
        <button class="cal-chip" data-cal-type="income">Receitas</button>
        <button class="cal-chip" data-cal-type="expense">Despesas</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:var(--space-4)" id="calBody"></div>
    </div>
  `

  el.querySelectorAll('[data-cal-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-cal-type]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      currentCalType = btn.dataset.calType
      loadCalendar()
    })
  })

  unsubMonth = store.subscribe('currentMonth', loadCalendar)
  await loadCalendar()
  el.addEventListener('__cleanup', () => unsubMonth?.(), { once: true })
}

async function loadCalendar() {
  const body = document.getElementById('calBody')
  if (!body) return

  const month = store.getMonth()
  const [y, m] = month.split('-').map(Number)

  body.innerHTML = '<div class="skeleton" style="height:400px;border-radius:12px"></div>'

  try {
    const result = await endpoints.transactions({
      month,
      type: currentCalType || undefined,
      limit: 500,
    })
    const txs = result.data || []
    renderCalendar(body, y, m, txs)
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${e.message}</p></div>`
  }
}

function renderCalendar(el, year, month, txs) {
  const byDay = {}
  txs.forEach(t => {
    const ds = t.due_date || t.date || ''
    const day = parseInt(ds.slice(8, 10))
    if (!day) return
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(t)
  })

  const firstDow = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date()
  const todayDay = today.getFullYear() === year && today.getMonth() + 1 === month ? today.getDate() : null

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  let cells = ''
  for (let i = 0; i < firstDow; i++) cells += `<div class="cal-cell cal-empty"></div>`

  for (let d = 1; d <= daysInMonth; d++) {
    const dayTxs = byDay[d] || []
    const income = dayTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    const isToday = d === todayDay

    const dots = dayTxs.slice(0, 4).map(t =>
      `<span class="cal-dot" style="background:${t.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)'}"></span>`
    ).join('')

    cells += `
      <div class="cal-cell ${isToday ? 'cal-today' : ''}" data-cal-day="${d}">
        <div class="cal-day-num">${d}</div>
        ${dayTxs.length ? `
          <div class="cal-dots">${dots}${dayTxs.length > 4 ? `<span class="cal-more">+${dayTxs.length - 4}</span>` : ''}</div>
          ${income > 0 ? `<div class="cal-amt" style="color:var(--color-income)">+${fmt.currency(income, true)}</div>` : ''}
          ${expense > 0 ? `<div class="cal-amt" style="color:var(--color-expense)">-${fmt.currency(expense, true)}</div>` : ''}
        ` : ''}
      </div>
    `
  }

  el.innerHTML = `
    <div class="cal-header">${weekDays.map(d => `<div class="cal-header-day">${d}</div>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    <div id="calDayDetail" style="margin-top:16px"></div>
  `

  el.querySelectorAll('[data-cal-day]').forEach(cell => {
    cell.addEventListener('click', () => {
      el.querySelectorAll('[data-cal-day]').forEach(c => c.style.outline = '')
      cell.style.outline = '2px solid var(--color-green)'
      const day = parseInt(cell.dataset.calDay)
      showDayDetail(day, year, month, byDay[day] || [])
    })
  })

  if (todayDay && byDay[todayDay]) {
    showDayDetail(todayDay, year, month, byDay[todayDay])
    const todayCell = el.querySelector(`[data-cal-day="${todayDay}"]`)
    if (todayCell) todayCell.style.outline = '2px solid var(--color-green)'
  }
}

function showDayDetail(day, year, month, txs) {
  const detail = document.getElementById('calDayDetail')
  if (!detail) return

  if (!txs.length) {
    detail.innerHTML = `<div style="text-align:center;color:var(--color-text-soft);font-size:14px;padding:16px">Sem lançamentos em ${day}/${String(month).padStart(2,'0')}</div>`
    return
  }

  const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  const totalIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  detail.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">${fmt.date(dateStr, 'medium')}</span>
        <div style="display:flex;gap:12px;font-size:var(--text-xs)">
          ${totalIncome > 0 ? `<span style="color:var(--color-income)">+${fmt.currency(totalIncome)}</span>` : ''}
          ${totalExpense > 0 ? `<span style="color:var(--color-expense)">-${fmt.currency(totalExpense)}</span>` : ''}
        </div>
      </div>
      <div class="transaction-list">
        ${txs.map(t => `
          <div class="transaction-item">
            <div class="transaction-icon" style="background:${t.categories?.color ? t.categories.color + '22' : 'var(--color-card-hover)'}">
              ${t.categories?.icon || (t.type === 'income' ? '💰' : '💸')}
            </div>
            <div class="transaction-info">
              <div class="transaction-desc">${t.description}</div>
              <div class="transaction-sub">${t.categories?.name || 'Sem categoria'}</div>
            </div>
            <div class="transaction-meta">
              <div class="transaction-amount ${t.type === 'income' ? 'value-positive' : 'value-negative'}">${t.type === 'income' ? '+' : '-'}${fmt.currency(t.amount)}</div>
              <div class="badge ${t.status === 'confirmed' ? 'badge-green' : 'badge-yellow'}" style="margin-top:2px;font-size:10px">${t.status === 'confirmed' ? 'Efetivado' : 'Pendente'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}
