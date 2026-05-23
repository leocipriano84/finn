import { endpoints } from '../core/api.js'
import { store, cache } from '../core/store.js'
import { fmt, date } from '../core/utils.js'
import { Toast } from '../core/notifications.js'

let container = null
let unsubscribe = null

export async function render(el) {
  container = el
  container.innerHTML = buildShell()
  await loadData()

  unsubscribe = store.subscribe('currentMonth', async () => {
    cache.clear(`dashboard_${store.getMonth()}`)
    await loadData()
  })

  // Cleanup
  el.addEventListener('__cleanup', () => unsubscribe?.(), { once: true })
}

function buildShell() {
  return `
    <div style="padding:var(--space-5) var(--space-6); overflow-y:auto; height:100%;">
      <div id="dashAlerts"></div>
      <div class="dashboard-grid" id="dashGrid"></div>
    </div>
  `
}

async function loadData() {
  const month = store.getMonth()
  const cacheKey = `dashboard_${month}`
  let data = cache.get(cacheKey)

  const grid = document.getElementById('dashGrid')
  if (!grid) return

  if (!data) {
    grid.innerHTML = skeletons(6)
    try {
      const [summary, charts, accountsBalance] = await Promise.all([
        endpoints.dashboard({ month }),
        endpoints.charts({ month, type: 'expense' }),
        endpoints.accountBalance({ month }),
      ])
      data = { summary, charts, accounts: accountsBalance }
      cache.set(cacheKey, data)
    } catch (e) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Erro ao carregar dados</div><p class="empty-state-msg">${e.message}</p></div>`
      return
    }
  }

  renderAlerts(data.summary)
  renderGrid(data)
}

function renderAlerts({ overview }) {
  const el = document.getElementById('dashAlerts')
  if (!el) return
  if (!overview?.overdue_count) { el.innerHTML = ''; return }
  el.innerHTML = `
    <div class="card" style="border-color:var(--color-red);border-left:3px solid var(--color-red);margin-bottom:var(--space-4);display:flex;align-items:center;gap:12px;">
      <span style="font-size:20px;">⚠️</span>
      <div style="flex:1">
        <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-red)">
          ${overview.overdue_count} despesa${overview.overdue_count > 1 ? 's' : ''} pendente${overview.overdue_count > 1 ? 's' : ''}
        </div>
        <div style="font-size:var(--text-xs);color:var(--color-text-soft)">
          Total de ${fmt.currency(overview.overdue_amount)} em atraso
        </div>
      </div>
      <button class="btn btn-sm btn-secondary" onclick="location.hash='transactions?status=pending'">Verificar</button>
    </div>
  `
}

function renderGrid({ summary, charts, accounts }) {
  const grid = document.getElementById('dashGrid')
  if (!grid) return

  const prefs = store.get('preferences')
  const widgets = prefs?.summary_widgets || ['overview','expense_chart','accounts','last_expenses','expense_by_category']

  const renderers = {
    overview:            () => cardOverview(summary.overview),
    expense_chart:       () => cardExpenseChart(charts),
    accounts:            () => cardAccounts(accounts),
    expense_by_category: () => cardExpenseByCategory(summary),
    expense_recurrence:  () => cardRecurrence(summary.expense_recurrence, 'Despesas por tipo'),
    budgets:             () => cardBudgets(summary.budgets),
  }

  // Renderiza os cards configurados + os defaults
  const toRender = widgets.length ? widgets : Object.keys(renderers)
  grid.innerHTML = ''
  toRender.forEach(w => {
    if (renderers[w]) {
      const el = document.createElement('div')
      el.innerHTML = renderers[w]()
      grid.appendChild(el.firstElementChild || el)
    }
  })

  // Inicializa gráficos canvas
  renderDonutChart('donutCategories', summary.expense_by_category?.slice(0,6))
  renderLineChart('lineExpenses', charts?.daily)
  renderRecurrenceDonut('donutRecurrence', summary.expense_recurrence)
}

function cardOverview(o) {
  if (!o) return ''
  return `
    <div class="card stagger-item">
      <div class="card-header">
        <span class="card-title">Visão geral</span>
        <span class="text-xs text-soft">${fmt.monthYear(...store.getMonth().split('-').map(Number))}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">
        <div>
          <div class="text-xs text-soft mb-2">Receitas</div>
          <div class="text-xl font-bold value-positive text-mono">${fmt.currency(o.income.confirmed + o.income.pending)}</div>
          ${o.income.pending ? `<div class="text-xs text-soft">+${fmt.currency(o.income.pending)} previsto</div>` : ''}
        </div>
        <div>
          <div class="text-xs text-soft mb-2">Despesas</div>
          <div class="text-xl font-bold value-negative text-mono">${fmt.currency(o.expense.confirmed + o.expense.pending)}</div>
          ${o.expense.pending ? `<div class="text-xs text-soft">+${fmt.currency(o.expense.pending)} previsto</div>` : ''}
        </div>
        <div>
          <div class="text-xs text-soft mb-2">Saldo</div>
          <div class="text-xl font-bold text-mono ${o.balance >= 0 ? 'value-positive' : 'value-negative'}">${fmt.currency(o.balance)}</div>
        </div>
        <div>
          <div class="text-xs text-soft mb-2">Previsto</div>
          <div class="text-xl font-bold text-mono ${o.forecast >= 0 ? 'value-positive' : 'value-negative'}">${fmt.currency(o.forecast)}</div>
        </div>
      </div>
      ${o.card_total ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:center;"><span class="text-xs text-soft">Total faturas cartão</span><span class="text-sm font-bold text-mono value-negative">${fmt.currency(o.card_total)}</span></div>` : ''}
    </div>
  `
}

function cardExpenseChart(charts) {
  return `
    <div class="card stagger-item">
      <div class="card-header">
        <span class="card-title">Evolução das despesas</span>
        <span class="text-xs text-soft">últimos 7 dias</span>
      </div>
      <div class="chart-container" style="height:100px;">
        <canvas id="lineExpenses" width="300" height="100"></canvas>
      </div>
    </div>
  `
}

function cardAccounts(accounts) {
  if (!accounts?.length) return `<div class="card stagger-item"><div class="card-header"><span class="card-title">Contas</span></div><div class="empty-state" style="padding:20px"><div class="empty-state-icon" style="font-size:28px">🏦</div><div class="empty-state-msg">Nenhuma conta cadastrada</div></div></div>`

  const rows = accounts.map(acc => `
    <div class="transaction-item" onclick="location.hash='accounts'" style="padding:8px 0;border:none;cursor:pointer">
      <div style="width:8px;height:8px;border-radius:50%;background:${acc.color};flex-shrink:0;margin:0 8px;"></div>
      <div style="flex:1;font-size:var(--text-sm);font-weight:500">${acc.name}</div>
      <div class="text-mono text-sm font-bold ${Number(acc.balance) >= 0 ? 'value-positive' : 'value-negative'}">${fmt.currency(acc.balance)}</div>
    </div>
  `).join('')

  const total = accounts.filter(a => !a.ignore_in_totals).reduce((s,a) => s + Number(a.balance), 0)

  return `
    <div class="card stagger-item">
      <div class="card-header">
        <span class="card-title">Contas</span>
        <button class="btn btn-icon btn-sm" onclick="location.hash='accounts'">→</button>
      </div>
      ${rows}
      <div style="padding-top:10px;border-top:1px solid var(--color-border);display:flex;justify-content:space-between">
        <span class="text-xs text-soft">Saldo total</span>
        <span class="text-sm font-bold text-mono ${total >= 0 ? 'value-positive' : 'value-negative'}">${fmt.currency(total)}</span>
      </div>
    </div>
  `
}

function cardExpenseByCategory(summary) {
  const cats = summary?.expense_by_category || []
  if (!cats.length) return ''

  const total = cats.reduce((s,c) => s + c.total, 0)
  const items = cats.slice(0,6).map(c => `
    <div class="rank-item">
      <div class="rank-icon" style="background:${c.color}22;color:${c.color}">${c.icon}</div>
      <div class="rank-info">
        <div class="rank-name">${c.name}</div>
        <div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:${total > 0 ? (c.total/total*100) : 0}%;background:${c.color}"></div></div>
      </div>
      <div class="rank-value value-negative">${fmt.currency(c.total)}</div>
    </div>
  `).join('')

  return `
    <div class="card stagger-item">
      <div class="card-header">
        <span class="card-title">Despesas por categoria</span>
        <button class="btn btn-icon btn-sm" onclick="location.hash='charts'">→</button>
      </div>
      <div style="display:flex;gap:20px;align-items:flex-start">
        <canvas id="donutCategories" width="120" height="120" style="flex-shrink:0"></canvas>
        <div style="flex:1">${items}</div>
      </div>
    </div>
  `
}

function cardRecurrence(rec, title) {
  if (!rec) return ''
  const total = (rec.fixed || 0) + (rec.installment || 0) + (rec.variable || 0)
  return `
    <div class="card stagger-item">
      <div class="card-header"><span class="card-title">${title}</span></div>
      <div style="display:flex;align-items:center;gap:var(--space-5)">
        <canvas id="donutRecurrence" width="100" height="100" style="flex-shrink:0"></canvas>
        <div style="flex:1;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:space-between"><span class="text-sm" style="color:var(--color-blue)">🔒 Fixas</span><span class="text-sm text-mono font-bold">${fmt.currency(rec.fixed)}</span></div>
          <div style="display:flex;justify-content:space-between"><span class="text-sm" style="color:var(--color-yellow)">📦 Parceladas</span><span class="text-sm text-mono font-bold">${fmt.currency(rec.installment)}</span></div>
          <div style="display:flex;justify-content:space-between"><span class="text-sm" style="color:var(--color-red)">🔀 Variáveis</span><span class="text-sm text-mono font-bold">${fmt.currency(rec.variable)}</span></div>
        </div>
      </div>
    </div>
  `
}

function cardBudgets(budgets) {
  if (!budgets?.length) return ''
  const items = budgets.slice(0,4).map(b => {
    const pct = b.amount > 0 ? Math.min(100, (b.spent || 0) / b.amount * 100) : 0
    const barClass = pct >= 100 ? 'danger' : pct >= b.alert_at_percent ? 'warning' : ''
    return `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span class="text-sm">${b.categories?.icon || '📦'} ${b.name}</span>
          <span class="text-xs text-soft">${fmt.currency(b.spent || 0)} / ${fmt.currency(b.amount)}</span>
        </div>
        <div class="progress-bar"><div class="progress-bar-fill ${barClass}" style="width:${pct}%"></div></div>
      </div>
    `
  }).join('')

  return `
    <div class="card stagger-item">
      <div class="card-header"><span class="card-title">Orçamentos</span><button class="btn btn-icon btn-sm" onclick="location.hash='budgets'">→</button></div>
      ${items}
    </div>
  `
}

// Canvas charts
function renderDonutChart(canvasId, data) {
  const canvas = document.getElementById(canvasId)
  if (!canvas || !data?.length) return
  const ctx = canvas.getContext('2d')
  const cx = canvas.width / 2, cy = canvas.height / 2
  const r = Math.min(cx, cy) - 8
  const total = data.reduce((s,d) => s + d.total, 0)
  let angle = -Math.PI / 2

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  data.forEach(d => {
    const slice = (d.total / total) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, angle, angle + slice)
    ctx.closePath()
    ctx.fillStyle = d.color || '#6b7280'
    ctx.fill()
    angle += slice
  })

  // Hole
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2)
  ctx.fillStyle = '#0d0d14'
  ctx.fill()
}

function renderLineChart(canvasId, daily) {
  const canvas = document.getElementById(canvasId)
  if (!canvas || !daily?.length) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  const max = Math.max(...daily.map(d => d.total), 1)
  const pts = daily.map((d, i) => ({
    x: (i / (daily.length - 1)) * (w - 20) + 10,
    y: h - ((d.total / max) * (h - 20)) - 10
  }))

  ctx.clearRect(0, 0, w, h)

  // Fill
  ctx.beginPath()
  ctx.moveTo(pts[0].x, h)
  pts.forEach(p => ctx.lineTo(p.x, p.y))
  ctx.lineTo(pts[pts.length-1].x, h)
  ctx.closePath()
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, 'rgba(0,245,160,0.3)')
  grad.addColorStop(1, 'rgba(0,245,160,0)')
  ctx.fillStyle = grad
  ctx.fill()

  // Line
  ctx.beginPath()
  ctx.strokeStyle = '#00F5A0'
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
  ctx.stroke()

  // Dots
  pts.forEach(p => {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#00F5A0'
    ctx.fill()
  })
}

function renderRecurrenceDonut(canvasId, rec) {
  if (!rec) return
  const data = [
    { total: rec.fixed || 0,       color: '#00C9FF' },
    { total: rec.installment || 0, color: '#FFD93D' },
    { total: rec.variable || 0,    color: '#FF6B6B' },
  ].filter(d => d.total > 0)
  renderDonutChart(canvasId, data)
}

function skeletons(n) {
  return Array(n).fill(`<div class="skeleton" style="height:160px;border-radius:16px;"></div>`).join('')
}
