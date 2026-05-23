import { endpoints } from '../core/api.js'
import { fmt } from '../core/utils.js'
import { Toast } from '../core/notifications.js'

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export async function render(el) {
  const currentYear = new Date().getFullYear()

  el.innerHTML = `
    <div style="flex:1;overflow-y:auto;padding:var(--space-5) var(--space-6);max-width:900px;margin:0 auto;width:100%">

      <!-- Seletor de ano -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:var(--space-6)">
        <button class="btn btn-icon" id="yearPrev">‹</button>
        <span id="yearLabel" style="font-family:var(--font-display);font-size:var(--text-xl);font-weight:700;min-width:60px;text-align:center">${currentYear}</span>
        <button class="btn btn-icon" id="yearNext">›</button>
        <button class="btn btn-secondary btn-sm" id="yearCurrent" style="margin-left:4px">Ano atual</button>
      </div>

      <!-- Skeleton inicial -->
      <div id="annualBody">
        ${skeletonAnnual()}
      </div>
    </div>
  `

  let year = currentYear
  const load = () => loadAnnual(year)

  el.querySelector('#yearPrev').addEventListener('click', () => { year--; updateLabel(); load() })
  el.querySelector('#yearNext').addEventListener('click', () => { year++; updateLabel(); load() })
  el.querySelector('#yearCurrent').addEventListener('click', () => { year = currentYear; updateLabel(); load() })

  function updateLabel() {
    el.querySelector('#yearLabel').textContent = year
  }

  load()
}

async function loadAnnual(year) {
  const body = document.getElementById('annualBody')
  if (!body) return
  body.innerHTML = skeletonAnnual()

  try {
    const data = await endpoints.annualReport({ year })
    renderAnnual(body, data)
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Erro ao carregar</div><p class="empty-state-msg">${e.message}</p></div>`
  }
}

function renderAnnual(el, data) {
  const { summary, months, best_month, worst_month, top_categories, year } = data
  const hasData = months.some(m => m.income > 0 || m.expense > 0)

  const savingsColor = summary.total_balance >= 0 ? 'var(--color-green)' : 'var(--color-red)'

  el.innerHTML = `
    <!-- Cards de resumo -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--space-4);margin-bottom:var(--space-6)">
      ${summaryCard('💰 Receitas', fmt.currency(summary.total_income), 'value-positive')}
      ${summaryCard('💸 Despesas', fmt.currency(summary.total_expense), 'value-negative')}
      ${summaryCard('📊 Economia', fmt.currency(summary.total_balance), summary.total_balance >= 0 ? 'value-positive' : 'value-negative')}
      ${summaryCard('📈 Taxa de economia', fmt.percent(Math.max(0, summary.savings_pct)), 'value-positive')}
      ${best_month  ? summaryCard('🏆 Melhor mês', monthName(best_month.month),  'value-positive') : ''}
      ${worst_month ? summaryCard('🔴 Maior gasto', monthName(worst_month.month), 'value-negative') : ''}
    </div>

    ${!hasData ? `<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-title">Sem dados em ${year}</div><p class="empty-state-msg">Nenhum lançamento registrado neste ano</p></div>` : `

    <!-- Gráfico de barras -->
    <div class="card" style="margin-bottom:var(--space-5)">
      <div class="card-header">
        <span class="card-title">Receitas × Despesas por mês</span>
      </div>
      <div style="overflow-x:auto">
        <div style="min-width:600px;padding:var(--space-4) 0">
          ${renderBarChart(months)}
        </div>
      </div>
    </div>

    <!-- Tabela mensal -->
    <div class="card" style="margin-bottom:var(--space-5)">
      <div class="card-header">
        <span class="card-title">Mês a mês</span>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:var(--text-sm)">
          <thead>
            <tr style="border-bottom:1px solid var(--color-border)">
              <th style="text-align:left;padding:8px 12px;font-size:var(--text-xs);color:var(--color-text-muted);font-weight:600;text-transform:uppercase">Mês</th>
              <th style="text-align:right;padding:8px 12px;font-size:var(--text-xs);color:var(--color-text-muted);font-weight:600;text-transform:uppercase">Receitas</th>
              <th style="text-align:right;padding:8px 12px;font-size:var(--text-xs);color:var(--color-text-muted);font-weight:600;text-transform:uppercase">Despesas</th>
              <th style="text-align:right;padding:8px 12px;font-size:var(--text-xs);color:var(--color-text-muted);font-weight:600;text-transform:uppercase">Saldo</th>
              <th style="text-align:right;padding:8px 12px;font-size:var(--text-xs);color:var(--color-text-muted);font-weight:600;text-transform:uppercase">% Economia</th>
            </tr>
          </thead>
          <tbody>
            ${months.map((m, i) => {
              const empty = m.income === 0 && m.expense === 0
              const balColor = m.balance >= 0 ? 'var(--color-green)' : 'var(--color-red)'
              return `
                <tr style="border-bottom:1px solid var(--color-border);${empty ? 'opacity:0.35' : ''}">
                  <td style="padding:10px 12px;font-weight:500">${MONTH_NAMES[i]}</td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--font-mono);color:var(--color-green)">${empty ? '—' : fmt.currency(m.income)}</td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--font-mono);color:var(--color-red)">${empty ? '—' : fmt.currency(m.expense)}</td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--font-mono);font-weight:600;color:${balColor}">${empty ? '—' : fmt.currency(m.balance)}</td>
                  <td style="padding:10px 12px;text-align:right;font-size:var(--text-xs);color:var(--color-text-soft)">${empty ? '—' : fmt.percent(Math.max(0, m.savings_pct))}</td>
                </tr>
              `
            }).join('')}
            <tr style="background:var(--color-card-hover);font-weight:700">
              <td style="padding:10px 12px">Total</td>
              <td style="padding:10px 12px;text-align:right;font-family:var(--font-mono);color:var(--color-green)">${fmt.currency(summary.total_income)}</td>
              <td style="padding:10px 12px;text-align:right;font-family:var(--font-mono);color:var(--color-red)">${fmt.currency(summary.total_expense)}</td>
              <td style="padding:10px 12px;text-align:right;font-family:var(--font-mono);font-weight:700;color:${savingsColor}">${fmt.currency(summary.total_balance)}</td>
              <td style="padding:10px 12px;text-align:right;font-size:var(--text-xs);color:var(--color-text-soft)">${fmt.percent(Math.max(0, summary.savings_pct))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Top categorias do ano -->
    ${top_categories.length ? `
    <div class="card" style="margin-bottom:var(--space-5)">
      <div class="card-header">
        <span class="card-title">Top categorias do ano</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;padding:var(--space-2) 0">
        ${top_categories.map((c, i) => {
          const pct = summary.total_expense > 0 ? (c.total / summary.total_expense * 100) : 0
          return `
            <div style="display:flex;align-items:center;gap:12px">
              <span style="font-size:var(--text-xs);color:var(--color-text-muted);width:20px;text-align:right">${i+1}</span>
              <span style="font-size:18px">${c.icon || '📦'}</span>
              <div style="flex:1;min-width:0">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                  <span style="font-size:var(--text-sm);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</span>
                  <span style="font-family:var(--font-mono);font-size:var(--text-sm);font-weight:600;color:var(--color-red);flex-shrink:0;margin-left:8px">${fmt.currency(c.total)}</span>
                </div>
                <div style="height:4px;background:var(--color-border);border-radius:2px;overflow:hidden">
                  <div style="height:100%;width:${pct.toFixed(1)}%;background:${c.color || 'var(--color-red)'};border-radius:2px"></div>
                </div>
              </div>
              <span style="font-size:var(--text-xs);color:var(--color-text-soft);width:36px;text-align:right">${fmt.percent(pct, 0)}</span>
            </div>
          `
        }).join('')}
      </div>
    </div>
    ` : ''}

    `}
  `
}

function renderBarChart(months) {
  const maxVal = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1)
  const H = 120

  return `
    <div style="display:flex;align-items:flex-end;gap:6px;padding:0 var(--space-4);height:${H + 36}px">
      ${months.map((m, i) => {
        const incH = Math.round((m.income  / maxVal) * H)
        const expH = Math.round((m.expense / maxVal) * H)
        const empty = m.income === 0 && m.expense === 0
        return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
            <div style="display:flex;align-items:flex-end;gap:2px;height:${H}px">
              <div title="Receita: ${fmt.currency(m.income)}"
                   style="width:10px;height:${incH}px;background:var(--color-green);opacity:${empty?0.2:0.85};border-radius:2px 2px 0 0;cursor:pointer;transition:opacity 0.2s"
                   onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity='${empty?0.2:0.85}'">
              </div>
              <div title="Despesa: ${fmt.currency(m.expense)}"
                   style="width:10px;height:${expH}px;background:var(--color-red);opacity:${empty?0.2:0.85};border-radius:2px 2px 0 0;cursor:pointer;transition:opacity 0.2s"
                   onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity='${empty?0.2:0.85}'">
              </div>
            </div>
            <span style="font-size:9px;color:var(--color-text-muted)">${MONTH_NAMES[i]}</span>
          </div>
        `
      }).join('')}
    </div>
    <div style="display:flex;align-items:center;gap:16px;padding:8px var(--space-4) 0;font-size:var(--text-xs);color:var(--color-text-soft)">
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--color-green);border-radius:2px;display:inline-block"></span>Receitas</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--color-red);border-radius:2px;display:inline-block"></span>Despesas</span>
    </div>
  `
}

function summaryCard(label, value, cls) {
  return `
    <div class="card" style="padding:var(--space-4)">
      <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:6px">${label}</div>
      <div class="text-mono ${cls}" style="font-size:var(--text-lg);font-weight:700">${value}</div>
    </div>
  `
}

function monthName(monthKey) {
  const [, m] = monthKey.split('-')
  return MONTH_NAMES[Number(m) - 1] || monthKey
}

function skeletonAnnual() {
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--space-4);margin-bottom:var(--space-6)">
      ${Array(4).fill('<div class="skeleton" style="height:72px;border-radius:12px"></div>').join('')}
    </div>
    <div class="skeleton" style="height:200px;border-radius:12px;margin-bottom:var(--space-5)"></div>
    <div class="skeleton" style="height:350px;border-radius:12px"></div>
  `
}
