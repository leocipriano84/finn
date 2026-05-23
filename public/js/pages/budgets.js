import { endpoints } from '../core/api.js'
import { store } from '../core/store.js'
import { fmt } from '../core/utils.js'
import { Toast, Confirm, Loading } from '../core/notifications.js'

let unsubMonth = null

export async function render(el) {
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <div style="padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <span class="text-soft text-sm" id="budgetCount"></span>
        <button class="btn btn-primary btn-sm" id="newBudgetBtn">+ Novo orçamento</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:var(--space-5)" id="budgetBody"></div>
    </div>
  `
  el.querySelector('#newBudgetBtn')?.addEventListener('click', () => openBudgetModal())
  unsubMonth = store.subscribe('currentMonth', loadBudgets)
  await loadBudgets()
  el.addEventListener('__cleanup', () => unsubMonth?.(), { once: true })
}

async function loadBudgets() {
  const body = document.getElementById('budgetBody')
  const countEl = document.getElementById('budgetCount')
  if (!body) return
  body.innerHTML = Array(3).fill('<div class="skeleton" style="height:100px;border-radius:16px;margin-bottom:12px"></div>').join('')
  try {
    const budgets = await endpoints.budgetProgress({ month: store.getMonth() })
    if (countEl) countEl.textContent = `${budgets.length} orçamento${budgets.length !== 1 ? 's' : ''} em ${fmt.monthYear(...store.getMonth().split('-').map(Number))}`
    renderBudgets(body, budgets)
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${e.message}</p></div>`
  }
}

function renderBudgets(el, budgets) {
  if (!budgets.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">Nenhum orçamento</div><p class="empty-state-msg">Crie orçamentos por categoria para controlar seus gastos</p></div>`
    return
  }

  el.innerHTML = budgets.map(b => {
    const barClass = b.pct >= 100 ? 'danger' : b.pct >= b.alert_at_percent ? 'warning' : ''
    const statusColor = b.pct >= 100 ? 'var(--color-red)' : b.pct >= b.alert_at_percent ? 'var(--color-yellow)' : 'var(--color-green)'
    const statusIcon = b.pct >= 100 ? '🔴' : b.pct >= b.alert_at_percent ? '⚠️' : '✅'
    return `
      <div class="card" style="margin-bottom:12px" data-budget-id="${b.id}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:10px;background:${b.categories?.color ? b.categories.color + '22' : 'var(--color-card-hover)'};display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">
              ${b.categories?.icon || '📦'}
            </div>
            <div>
              <div style="font-size:var(--text-base);font-weight:500">${b.name}</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-soft)">${b.categories?.name || 'Todas categorias'}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span>${statusIcon}</span>
            <button class="btn btn-icon btn-sm" data-budget-edit title="Editar">✏️</button>
            <button class="btn btn-icon btn-sm" data-budget-del title="Excluir">🗑️</button>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <div><span style="font-size:var(--text-sm);font-weight:600;color:${statusColor};font-family:var(--font-mono)">${fmt.currency(b.spent)}</span><span style="font-size:var(--text-xs);color:var(--color-text-soft)"> de ${fmt.currency(b.amount)}</span></div>
          <div style="font-size:var(--text-sm);font-weight:600;font-family:var(--font-mono)">${fmt.percent(b.pct)}</div>
        </div>

        <div class="progress-bar" style="height:8px;margin-bottom:8px">
          <div class="progress-bar-fill ${barClass}" style="width:${b.pct}%;transition:width 0.8s ease"></div>
        </div>

        <div style="font-size:var(--text-xs);color:var(--color-text-soft)">
          Restam <strong style="color:${statusColor};font-family:var(--font-mono)">${fmt.currency(b.remaining)}</strong>
          ${b.pct >= b.alert_at_percent ? ` · Alerta em ${b.alert_at_percent}%` : ''}
        </div>
      </div>
    `
  }).join('')

  el.querySelectorAll('[data-budget-id]').forEach(card => {
    card.querySelector('[data-budget-edit]')?.addEventListener('click', () => openBudgetModal(card.dataset.budgetId))
    card.querySelector('[data-budget-del]')?.addEventListener('click', async () => {
      const ok = await Confirm.delete('este orçamento')
      if (!ok) return
      try { await endpoints.deleteBudget(card.dataset.budgetId); Toast.success('Orçamento excluído'); loadBudgets() }
      catch (e) { Toast.error(e.message) }
    })
  })
}

function openBudgetModal(id) {
  const budgets = []
  const categories = store.get('categories') || []
  const expCats = categories.filter(c => c.type === 'expense' || c.type === 'both')

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <div class="modal-header"><h3 class="modal-title">${id ? 'Editar orçamento' : 'Novo orçamento'}</h3><button class="btn btn-icon" id="bModalClose">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label required">Nome</label><input id="bName" class="form-control" placeholder="Ex: Alimentação"></div>
        <div class="form-group"><label class="form-label required">Valor limite</label><input id="bAmount" class="form-control" type="number" step="0.01" placeholder="0,00"></div>
        <div class="form-group"><label class="form-label">Categoria</label>
          <select id="bCategory" class="form-control">
            <option value="">Todas as categorias</option>
            ${expCats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Mês de referência</label><input id="bMonth" class="form-control" type="month" value="${store.getMonth()}"></div>
        <div class="form-group">
          <label class="form-label">Alertar ao atingir</label>
          <div style="display:flex;align-items:center;gap:8px">
            <input id="bAlert" class="form-control" type="range" min="10" max="100" step="5" value="80" style="flex:1;padding:6px 0">
            <span id="bAlertLabel" style="font-size:var(--text-sm);font-family:var(--font-mono);min-width:36px">80%</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="bModalCancel">Cancelar</button>
        <button class="btn btn-primary" id="bModalSave">${id ? 'Salvar' : 'Criar'}</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))

  const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300) }
  overlay.querySelector('#bModalClose')?.addEventListener('click', close)
  overlay.querySelector('#bModalCancel')?.addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  overlay.querySelector('#bAlert')?.addEventListener('input', e => {
    overlay.querySelector('#bAlertLabel').textContent = e.target.value + '%'
  })

  overlay.querySelector('#bModalSave')?.addEventListener('click', async (e) => {
    const name = overlay.querySelector('#bName')?.value?.trim()
    const amount = Number(overlay.querySelector('#bAmount')?.value)
    if (!name) { Toast.error('Informe o nome'); return }
    if (!amount || amount <= 0) { Toast.error('Informe o valor'); return }

    Loading.btn(e.target, true)
    try {
      const payload = {
        name, amount,
        category_id: overlay.querySelector('#bCategory')?.value || null,
        month: overlay.querySelector('#bMonth')?.value || store.getMonth(),
        alert_at_percent: Number(overlay.querySelector('#bAlert')?.value) || 80,
      }
      if (id) await endpoints.updateBudget(id, payload)
      else await endpoints.createBudget(payload)
      Toast.success(id ? 'Orçamento atualizado' : 'Orçamento criado')
      close()
      loadBudgets()
    } catch (err) { Toast.error(err.message); Loading.btn(e.target, false) }
  })
}
