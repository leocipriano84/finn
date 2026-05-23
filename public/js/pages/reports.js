import { endpoints } from '../core/api.js'
import { store } from '../core/store.js'
import { fmt } from '../core/utils.js'

let unsubMonth = null

export async function render(el) {
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <div style="padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--color-border);display:flex;align-items:center;gap:var(--space-3);flex-shrink:0">
        <select id="reportType" class="form-control" style="width:160px;padding:8px 12px">
          <option value="expense">🔴 Despesas</option>
          <option value="income">🟢 Receitas</option>
          <option value="all">🔵 Todas</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="reportFilter">🔍 Filtrar</button>
      </div>
      <div style="flex:1;overflow-y:auto;" id="reportBody"></div>
    </div>
  `

  const typeSelect = el.querySelector('#reportType')
  typeSelect?.addEventListener('change', () => loadReport(typeSelect.value))
  unsubMonth = store.subscribe('currentMonth', () => loadReport(typeSelect?.value || 'expense'))
  await loadReport('expense')
  el.addEventListener('__cleanup', () => unsubMonth?.(), { once: true })
}

async function loadReport(type) {
  const body = document.getElementById('reportBody')
  if (!body) return
  body.innerHTML = Array(3).fill('<div class="skeleton" style="height:80px;border-radius:12px;margin:16px;"></div>').join('')

  try {
    const [cats, txResult] = await Promise.all([
      endpoints.categoryReport({ month: store.getMonth(), type }),
      endpoints.transactions({ month: store.getMonth(), type: type === 'all' ? undefined : type, limit: 100 })
    ])

    renderReport(body, cats, txResult, type)
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${e.message}</p></div>`
  }
}

function renderReport(el, catsData, txResult, type) {
  const { categories, total } = catsData
  const txs = txResult.data || []

  el.innerHTML = `
    <div style="padding:var(--space-5);display:flex;flex-direction:column;gap:var(--space-5)">
      <!-- Resumo -->
      <div class="card">
        <div class="card-header"><span class="card-title">Resumo do período</span></div>
        <div style="display:flex;gap:var(--space-5);flex-wrap:wrap">
          <div><div class="text-xs text-soft">Registros</div><div class="text-2xl font-bold text-mono">${txs.length}</div></div>
          <div><div class="text-xs text-soft">Total</div><div class="text-2xl font-bold text-mono ${type==='income'?'value-positive':'value-negative'}">${fmt.currency(total)}</div></div>
          ${txs.length ? `<div><div class="text-xs text-soft">Média por lançamento</div><div class="text-2xl font-bold text-mono">${fmt.currency(total / txs.length)}</div></div>` : ''}
        </div>
      </div>

      <!-- Por categoria -->
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
            ${txs.slice(0, 50).map(t => `
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
          </div>
        ` : '<div class="empty-state" style="padding:20px"><div class="empty-state-icon" style="font-size:28px">📭</div><p class="empty-state-msg">Nenhum lançamento neste período</p></div>'}
      </div>
    </div>
  `
}
