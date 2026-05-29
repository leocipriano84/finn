import { endpoints } from '../core/api.js'
import { store } from '../core/store.js'
import { fmt } from '../core/utils.js'

let unsubMonth = null
let currentType = 'expense'
let currentStatus = ''
let currentGroupBy = 'none'
let currentDateFrom = ''
let currentDateTo = ''

export async function render(el) {
  if (!document.getElementById('report-chip-style')) {
    const s = document.createElement('style')
    s.id = 'report-chip-style'
    s.textContent = `
      .r-chip{padding:6px 14px;border-radius:20px;border:1px solid var(--color-border);background:var(--color-card);color:var(--color-text-soft);font-size:13px;cursor:pointer;transition:all 150ms;white-space:nowrap}
      .r-chip.active{background:var(--color-green);color:#050508;border-color:var(--color-green)}
      .r-chip:hover:not(.active){border-color:var(--color-text-muted);color:var(--color-text)}
      .r-filter-section{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      .r-filter-label{font-size:11px;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap;min-width:90px}
      .r-date-input{padding:5px 10px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-card);color:var(--color-text);font-size:13px;outline:none}
      .r-date-input:focus{border-color:var(--color-green)}
    `
    document.head.appendChild(s)
  }

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <div style="padding:var(--space-3) var(--space-5);border-bottom:1px solid var(--color-border);flex-shrink:0;display:flex;flex-direction:column;gap:10px">
        <!-- Tipo -->
        <div class="r-filter-section">
          <span class="r-filter-label">Tipo</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="r-chip active" data-report-type="expense">🔴 Despesas</button>
            <button class="r-chip" data-report-type="income">🟢 Receitas</button>
            <button class="r-chip" data-report-type="all">🔵 Todas</button>
          </div>
        </div>
        <!-- Status -->
        <div class="r-filter-section">
          <span class="r-filter-label">Situação</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="r-chip active" data-report-status="">Todas</button>
            <button class="r-chip" data-report-status="confirmed">✅ Efetivadas</button>
            <button class="r-chip" data-report-status="pending">⏳ Pendentes</button>
          </div>
        </div>
        <!-- Agrupar por -->
        <div class="r-filter-section">
          <span class="r-filter-label">Agrupar por</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="r-chip active" data-report-groupby="none">Nenhum</button>
            <button class="r-chip" data-report-groupby="category">Categoria</button>
            <button class="r-chip" data-report-groupby="account">Conta</button>
          </div>
        </div>
        <!-- Período customizado -->
        <div class="r-filter-section">
          <span class="r-filter-label">Período</span>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <input type="date" id="reportDateFrom" class="r-date-input" placeholder="De">
            <span style="color:var(--color-text-muted);font-size:13px">até</span>
            <input type="date" id="reportDateTo" class="r-date-input" placeholder="Até">
            <button class="r-chip" id="reportDateClear" style="display:none">✕ Limpar</button>
          </div>
        </div>
      </div>
      <div style="flex:1;overflow-y:auto;" id="reportBody"></div>
    </div>
  `

  el.querySelectorAll('[data-report-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-report-type]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      currentType = btn.dataset.reportType
      loadReport()
    })
  })

  el.querySelectorAll('[data-report-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-report-status]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      currentStatus = btn.dataset.reportStatus
      loadReport()
    })
  })

  el.querySelectorAll('[data-report-groupby]').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('[data-report-groupby]').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      currentGroupBy = btn.dataset.reportGroupby
      loadReport()
    })
  })

  const dateFrom = el.querySelector('#reportDateFrom')
  const dateTo   = el.querySelector('#reportDateTo')
  const dateClear = el.querySelector('#reportDateClear')

  const onDateChange = () => {
    currentDateFrom = dateFrom.value
    currentDateTo = dateTo.value
    const hasRange = currentDateFrom || currentDateTo
    if (dateClear) dateClear.style.display = hasRange ? '' : 'none'
    loadReport()
  }
  dateFrom?.addEventListener('change', onDateChange)
  dateTo?.addEventListener('change', onDateChange)
  dateClear?.addEventListener('click', () => {
    dateFrom.value = ''
    dateTo.value = ''
    currentDateFrom = ''
    currentDateTo = ''
    dateClear.style.display = 'none'
    loadReport()
  })

  unsubMonth = store.subscribe('currentMonth', loadReport)
  await loadReport()
  el.addEventListener('__cleanup', () => unsubMonth?.(), { once: true })
}

async function loadReport() {
  const body = document.getElementById('reportBody')
  if (!body) return
  body.innerHTML = Array(3).fill('<div class="skeleton" style="height:80px;border-radius:12px;margin:16px;"></div>').join('')

  try {
    const month = store.getMonth()
    const params = {
      month,
      type: currentType === 'all' ? undefined : currentType,
      limit: 300,
    }
    if (currentDateFrom) params.date_from = currentDateFrom
    if (currentDateTo)   params.date_to   = currentDateTo

    const [cats, txResult] = await Promise.all([
      endpoints.categoryReport({ month, type: currentType }),
      endpoints.transactions(params)
    ])

    let allTxs = txResult.data || []
    if (currentStatus) allTxs = allTxs.filter(t => t.status === currentStatus)
    if (currentDateFrom) allTxs = allTxs.filter(t => (t.due_date || t.date || '') >= currentDateFrom)
    if (currentDateTo)   allTxs = allTxs.filter(t => (t.due_date || t.date || '') <= currentDateTo)

    renderReport(body, cats, allTxs, currentType, currentGroupBy)
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${e.message}</p></div>`
  }
}

function renderReport(el, catsData, txs, type, groupBy) {
  const { categories, total } = catsData

  const grouped = groupBy !== 'none' ? groupTransactions(txs, groupBy) : null

  el.innerHTML = `
    <div style="padding:var(--space-5);display:flex;flex-direction:column;gap:var(--space-5)">
      <!-- Resumo -->
      <div class="card">
        <div class="card-header"><span class="card-title">Resumo do período</span></div>
        <div style="display:flex;gap:var(--space-5);flex-wrap:wrap">
          <div><div class="text-xs text-soft">Registros</div><div class="text-2xl font-bold text-mono">${txs.length}</div></div>
          <div><div class="text-xs text-soft">Total</div><div class="text-2xl font-bold text-mono ${type==='income'?'value-positive':'value-negative'}">${fmt.currency(total)}</div></div>
          ${txs.length ? `<div><div class="text-xs text-soft">Média</div><div class="text-2xl font-bold text-mono">${fmt.currency(total / txs.length)}</div></div>` : ''}
        </div>
      </div>

      <!-- Agrupamento customizado (se ativo) -->
      ${grouped ? `
        <div class="card">
          <div class="card-header"><span class="card-title">Agrupado por ${groupBy === 'category' ? 'categoria' : 'conta'}</span></div>
          ${grouped.map(g => `
            <div class="rank-item">
              <div class="rank-icon" style="background:${g.color}22;color:${g.color}">${g.icon || '📦'}</div>
              <div class="rank-info">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                  <span class="rank-name">${g.name}</span>
                  <span style="font-size:var(--text-xs);color:var(--color-text-soft)">${g.count} lançamento${g.count !== 1 ? 's' : ''}</span>
                </div>
                <div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:${g.pct}%;background:${g.color}"></div></div>
              </div>
              <div style="text-align:right;min-width:80px">
                <div class="rank-value ${type==='income'?'value-positive':'value-negative'}">${fmt.currency(g.total)}</div>
                <div class="rank-pct text-soft">${fmt.percent(g.pct)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Por categoria (sempre) -->
      ${categories.length ? `
        <div class="card">
          <div class="card-header"><span class="card-title">Por categoria</span></div>
          ${categories.map(c => `
            <div class="rank-item">
              <div class="rank-icon" style="background:${c.color}22;color:${c.color}">${c.icon || '📦'}</div>
              <div class="rank-info">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                  <span class="rank-name">${c.name}</span>
                  <span style="font-size:var(--text-xs);color:var(--color-text-soft)">${c.count} lançamento${c.count !== 1 ? 's' : ''}</span>
                </div>
                <div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:${c.pct}%;background:${c.color}"></div></div>
              </div>
              <div style="text-align:right;min-width:80px">
                <div class="rank-value ${type==='income'?'value-positive':'value-negative'}">${fmt.currency(c.total)}</div>
                <div class="rank-pct text-soft">${fmt.percent(c.pct)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Lista de lançamentos -->
      <div class="card">
        <div class="card-header"><span class="card-title">Lançamentos (${txs.length})</span></div>
        ${txs.length ? `
          <div class="transaction-list">
            ${txs.slice(0, 100).map(t => `
              <div class="transaction-item">
                <div class="transaction-icon" style="background:${t.categories?.color ? t.categories.color + '22' : 'var(--color-card-hover)'}">
                  ${t.categories?.icon || (t.type === 'income' ? '💰' : '💸')}
                </div>
                <div class="transaction-info">
                  <div class="transaction-desc">${t.description}</div>
                  <div class="transaction-sub">${t.categories?.name || 'Sem categoria'} • ${fmt.date(t.due_date, 'short')}</div>
                </div>
                <div class="transaction-meta">
                  <div class="transaction-amount ${t.type === 'income' ? 'value-positive' : 'value-negative'}">${t.type === 'income' ? '+' : '-'}${fmt.currency(t.amount)}</div>
                  <div class="badge ${t.status === 'confirmed' ? 'badge-green' : 'badge-yellow'}" style="margin-top:4px">${t.status === 'confirmed' ? 'Efetivado' : 'Pendente'}</div>
                </div>
              </div>
            `).join('')}
            ${txs.length > 100 ? `<div style="text-align:center;padding:12px;color:var(--color-text-soft);font-size:13px">Exibindo 100 de ${txs.length} lançamentos</div>` : ''}
          </div>
        ` : '<div class="empty-state" style="padding:20px"><div class="empty-state-icon" style="font-size:28px">📭</div><p class="empty-state-msg">Nenhum lançamento neste período</p></div>'}
      </div>
    </div>
  `
}

function groupTransactions(txs, by) {
  const groups = {}
  const totalAll = txs.reduce((s, t) => s + Number(t.amount), 0) || 1

  txs.forEach(t => {
    let key, name, color, icon
    if (by === 'category') {
      key  = t.categories?.id || 'none'
      name = t.categories?.name || 'Sem categoria'
      color = t.categories?.color || '#888'
      icon  = t.categories?.icon  || '📦'
    } else {
      key  = t.accounts?.id || t.account_id || 'none'
      name = t.accounts?.name || 'Conta não identificada'
      color = '#4D96FF'
      icon  = '🏦'
    }
    if (!groups[key]) groups[key] = { name, color, icon, total: 0, count: 0 }
    groups[key].total += Number(t.amount)
    groups[key].count++
  })

  return Object.values(groups)
    .sort((a, b) => b.total - a.total)
    .map(g => ({ ...g, pct: Math.round((g.total / totalAll) * 100) }))
}
