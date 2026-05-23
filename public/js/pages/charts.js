import { endpoints } from '../core/api.js'
import { store } from '../core/store.js'
import { fmt } from '../core/utils.js'

let unsubMonth = null

export async function render(el) {
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <div style="padding:var(--space-3) var(--space-5);border-bottom:1px solid var(--color-border);flex-shrink:0">
        <div class="tabs" style="border:none">
          <div class="tab active" data-charts-tab="expense">Despesas</div>
          <div class="tab" data-charts-tab="income">Receitas</div>
          <div class="tab" data-charts-tab="other">Outros</div>
        </div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:var(--space-5)" id="chartsBody"></div>
    </div>
  `

  let currentTab = 'expense'

  el.querySelectorAll('[data-charts-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      el.querySelectorAll('[data-charts-tab]').forEach(t => t.classList.toggle('active', t === tab))
      currentTab = tab.dataset.chartsTab
      loadCharts(currentTab)
    })
  })

  unsubMonth = store.subscribe('currentMonth', () => loadCharts(currentTab))
  await loadCharts('expense')
  el.addEventListener('__cleanup', () => unsubMonth?.(), { once: true })
}

async function loadCharts(type) {
  const body = document.getElementById('chartsBody')
  if (!body) return
  body.innerHTML = Array(4).fill('<div class="skeleton" style="height:200px;border-radius:16px;margin-bottom:16px"></div>').join('')

  try {
    const [chartsData, evolution] = await Promise.all([
      endpoints.charts({ month: store.getMonth(), type }),
      endpoints.evolution({ month: store.getMonth() }),
    ])
    renderCharts(body, chartsData, evolution, type)
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${e.message}</p></div>`
  }
}

function renderCharts(el, data, evolution, type) {
  const { daily, monthly, categories } = data
  const total = categories.reduce((s,c) => s + c.total, 0)

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:var(--space-5)">
      <!-- Ranking categorias -->
      <div class="card" style="grid-column:1/-1">
        <div class="card-header"><span class="card-title">Ranking categorias — ${type === 'income' ? 'Receitas' : 'Despesas'}</span></div>
        ${categories.length ? `
          <div style="margin-bottom:12px;font-size:var(--text-xs);color:var(--color-text-soft)">Total: ${fmt.currency(total)}</div>
          ${categories.map(c => `
            <div class="rank-item">
              <div class="rank-icon" style="background:${c.color}22;color:${c.color}">${c.icon || '📦'}</div>
              <div class="rank-info">
                <div class="rank-name">${c.name}</div>
                <div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:${c.pct}%;background:${c.color}"></div></div>
              </div>
              <div class="rank-pct text-soft">${fmt.percent(c.pct)}</div>
              <div class="rank-value ${type === 'income' ? 'value-positive' : 'value-negative'}">${fmt.currency(c.total)}</div>
            </div>
          `).join('')}
        ` : '<div class="empty-state" style="padding:20px"><div class="empty-state-icon" style="font-size:28px">📊</div><p class="empty-state-msg">Nenhum dado neste mês</p></div>'}
      </div>

      <!-- Evolução diária -->
      <div class="card">
        <div class="card-header"><span class="card-title">Evolução diária</span><span class="text-xs text-soft">últimos 7 dias</span></div>
        <div style="height:120px;position:relative">
          <canvas id="dailyChart" width="300" height="120" style="width:100%;height:100%"></canvas>
        </div>
      </div>

      <!-- Donut por categoria (top 5) -->
      <div class="card">
        <div class="card-header"><span class="card-title">Por categoria</span></div>
        <div style="display:flex;align-items:center;gap:20px">
          <div style="position:relative;width:120px;height:120px;flex-shrink:0">
            <canvas id="catDonut" width="120" height="120"></canvas>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;pointer-events:none">
              <div style="font-size:var(--text-xs);color:var(--color-text-soft)">Total</div>
              <div style="font-size:var(--text-sm);font-weight:700;font-family:var(--font-mono)">${fmt.currency(total, true)}</div>
            </div>
          </div>
          <div style="flex:1">
            ${categories.slice(0,5).map(c => `
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <div style="width:8px;height:8px;border-radius:2px;background:${c.color};flex-shrink:0"></div>
                <div style="flex:1;font-size:var(--text-xs);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</div>
                <div style="font-size:var(--text-xs);font-family:var(--font-mono);color:var(--color-text-soft)">${fmt.percent(c.pct)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Últimos 6 meses -->
      <div class="card" style="grid-column:1/-1">
        <div class="card-header"><span class="card-title">Últimos 6 meses</span></div>
        <div style="height:140px">
          <canvas id="monthlyChart" width="600" height="140" style="width:100%;height:100%"></canvas>
        </div>
      </div>

      ${type === 'other' || type === 'expense' ? `
      <!-- Receitas x Despesas (anual) -->
      <div class="card" style="grid-column:1/-1">
        <div class="card-header"><span class="card-title">Receitas × Despesas ${new Date().getFullYear()}</span></div>
        <div style="height:160px">
          <canvas id="evolutionChart" width="600" height="160" style="width:100%;height:100%"></canvas>
        </div>
      </div>
      ` : ''}
    </div>
  `

  // Render charts after DOM
  setTimeout(() => {
    renderLineChart('dailyChart', daily, type === 'income' ? '#00F5A0' : '#FF6B6B')
    renderDonut('catDonut', categories.slice(0,5))
    renderBarChart('monthlyChart', monthly, type === 'income' ? '#00F5A0' : '#FF6B6B')
    if (evolution) renderDualLineChart('evolutionChart', evolution)
  }, 50)
}

function renderDonut(canvasId, data) {
  const canvas = document.getElementById(canvasId)
  if (!canvas || !data?.length) return
  const ctx = canvas.getContext('2d')
  const cx = 60, cy = 60, r = 50
  const total = data.reduce((s,d) => s + d.total, 0)
  let angle = -Math.PI / 2
  ctx.clearRect(0, 0, 120, 120)
  data.forEach(d => {
    const slice = total > 0 ? (d.total / total) * Math.PI * 2 : 0
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, angle, angle + slice); ctx.closePath()
    ctx.fillStyle = d.color || '#6b7280'; ctx.fill(); angle += slice
  })
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2)
  ctx.fillStyle = '#0d0d14'; ctx.fill()
}

function renderLineChart(canvasId, daily, color = '#00F5A0') {
  const canvas = document.getElementById(canvasId)
  if (!canvas || !daily?.length) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  const max = Math.max(...daily.map(d => d.total), 1)
  const pts = daily.map((d, i) => ({
    x: 10 + (i / (daily.length - 1)) * (w - 20),
    y: h - 10 - (d.total / max) * (h - 20)
  }))
  ctx.clearRect(0, 0, w, h)
  ctx.beginPath(); ctx.moveTo(pts[0].x, h)
  pts.forEach(p => ctx.lineTo(p.x, p.y))
  ctx.lineTo(pts[pts.length-1].x, h); ctx.closePath()
  const grad = ctx.createLinearGradient(0,0,0,h)
  grad.addColorStop(0, color + '44'); grad.addColorStop(1, color + '00')
  ctx.fillStyle = grad; ctx.fill()
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2
  pts.forEach((p,i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
  ctx.stroke()
}

function renderBarChart(canvasId, monthly, color = '#00F5A0') {
  const canvas = document.getElementById(canvasId)
  if (!canvas || !monthly?.length) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  const max = Math.max(...monthly.map(m => m.total), 1)
  const barW = (w - 20) / monthly.length - 4
  ctx.clearRect(0, 0, w, h)
  monthly.forEach((m, i) => {
    const barH = (m.total / max) * (h - 30)
    const x = 10 + i * ((w - 20) / monthly.length)
    const y = h - 20 - barH
    ctx.fillStyle = color + '99'
    ctx.beginPath(); ctx.roundRect?.(x, y, barW, barH, 3) || ctx.rect(x, y, barW, barH); ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(m.month.slice(5), x + barW/2, h - 6)
  })
}

function renderDualLineChart(canvasId, data) {
  const canvas = document.getElementById(canvasId)
  if (!canvas || !data?.length) return
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height
  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1)
  const drawLine = (key, color) => {
    const pts = data.map((d, i) => ({ x: 10 + (i/(data.length-1))*(w-20), y: h-20-(d[key]/maxVal)*(h-30) }))
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2
    pts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y))
    ctx.stroke()
    pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fillStyle=color; ctx.fill() })
  }
  ctx.clearRect(0,0,w,h)
  drawLine('income', '#00F5A0')
  drawLine('expense', '#FF6B6B')
  data.forEach((d, i) => {
    const x = 10 + (i/(data.length-1))*(w-20)
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(d.month.slice(5), x, h-6)
  })
}
