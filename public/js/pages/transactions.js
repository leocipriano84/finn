import { endpoints } from '../core/api.js'
import { store, cache } from '../core/store.js'
import { fmt, date, debounce, groupBy } from '../core/utils.js'
import { Toast, Confirm, Loading } from '../core/notifications.js'

let container = null
let currentType = 'expense'
let currentFilters = {}
let unsubMonth = null
let cachedTransactions = []

export async function render(el) {
  container = el
  const params = getRouteParams()
  if (params.type) currentType = params.type

  container.innerHTML = buildPage()
  attachPageEvents()
  await loadTransactions()

  unsubMonth = store.subscribe('currentMonth', () => loadTransactions())
  el.addEventListener('__cleanup', () => unsubMonth?.(), { once: true })
}

function getRouteParams() {
  const hash = window.location.hash.slice(1)
  const [, qs] = hash.split('?')
  return qs ? Object.fromEntries(new URLSearchParams(qs)) : {}
}

function buildPage() {
  if (!document.getElementById('tx-tabs-fix')) {
    const s = document.createElement('style')
    s.id = 'tx-tabs-fix'
    s.textContent = `[data-filter-type="expense"].active,.tab-expense.active{color:#D50000!important;border-bottom-color:#D50000!important}[data-filter-type="income"].active,.tab-income.active{color:#00C853!important;border-bottom-color:#00C853!important}[data-filter-type="all"].active{color:#00C9FF!important;border-bottom-color:#00C9FF!important}`
    document.head.appendChild(s)
  }
  return `
    <div style="display:flex;flex-direction:column;height:100%">
      <!-- Header da página -->
      <div style="padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--color-border);display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;flex-shrink:0;">
        <div class="tabs" style="border:none;gap:4px">
          <div class="tab ${currentType==='expense'?'active':''}" data-filter-type="expense">Despesas</div>
          <div class="tab ${currentType==='income'?'active':''}" data-filter-type="income">Receitas</div>
          <div class="tab ${currentType==='all'?'active':''}" data-filter-type="all">Todas</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
          <button class="btn btn-secondary btn-sm" id="filterBtn">🔍 Filtrar</button>
          <button class="btn btn-primary btn-sm" id="newTxBtn">+ Novo</button>
        </div>
      </div>

      <!-- Busca rápida -->
      <div style="padding:8px var(--space-5);border-bottom:1px solid var(--color-border);flex-shrink:0;">
        <input id="txSearch" class="form-control" placeholder="Buscar por descrição..." style="padding:8px 12px;font-size:var(--text-sm)">
      </div>

      <!-- Lista -->
      <div style="flex:1;overflow-y:auto;" id="txListWrap">
        <div id="txList" class="transaction-list"></div>
      </div>

      <!-- Barra inferior de totais -->
      <div class="summary-bar" id="txSummaryBar"></div>
    </div>
  `
}

function attachPageEvents() {
  // Tabs de tipo
  container.querySelectorAll('[data-filter-type]').forEach(tab => {
    tab.addEventListener('click', () => {
      currentType = tab.dataset.filterType
      container.querySelectorAll('[data-filter-type]').forEach(t => t.classList.toggle('active', t.dataset.filterType === currentType))
      loadTransactions()
    })
  })

  // Botão novo
  container.querySelector('#newTxBtn')?.addEventListener('click', () => openTransactionModal({ type: currentType === 'all' ? 'expense' : currentType }))

  // Filtro
  container.querySelector('#filterBtn')?.addEventListener('click', openFilterDrawer)

  // Busca com debounce
  const searchInput = container.querySelector('#txSearch')
  if (searchInput) {
    const doSearch = debounce(() => {
      currentFilters.search = searchInput.value
      loadTransactions()
    }, 300)
    searchInput.addEventListener('input', doSearch)
  }
}

async function loadTransactions() {
  const listEl = document.getElementById('txList')
  const barEl = document.getElementById('txSummaryBar')
  if (!listEl) return

  listEl.innerHTML = skeletonList(6)

  const month = store.getMonth()
  const params = { month, ...currentFilters }
  if (currentType !== 'all') params.type = currentType

  try {
    const [result, summary] = await Promise.all([
      endpoints.transactions(params),
      endpoints.txSummary({ month }),
    ])
    const txs = result.data || []
    cachedTransactions = txs

    // Projeção de recorrentes para meses futuros
    const currentMonth = date.currentMonth()
    if (month > currentMonth) {
      try {
        const baseResult = await endpoints.transactions({ month: currentMonth, limit: 200 })
        const RECURRENT = new Set(['daily','weekly','biweekly','monthly','fixed_monthly','bimonthly','quarterly','semiannual','yearly','fixed_yearly'])
        const baseTxs = (baseResult.data || []).filter(t => RECURRENT.has(t.recurrence))
        const [viewYear, viewMonthNum] = month.split('-').map(Number)

        for (const baseTx of baseTxs) {
          const descLower = (baseTx.description || '').toLowerCase()
          const alreadyExists = txs.some(t =>
            t.description?.toLowerCase() === descLower && t.type === baseTx.type
          )
          if (!alreadyExists) {
            const baseDay = (baseTx.due_date || baseTx.date || '').split('-')[2] || '01'
            const monthEnd = new Date(viewYear, viewMonthNum, 0).getDate()
            const projDay = String(Math.min(Number(baseDay), monthEnd)).padStart(2, '0')
            const projDate = `${viewYear}-${String(viewMonthNum).padStart(2,'0')}-${projDay}`
            txs.push({ ...baseTx, id: `proj_${baseTx.id}`, due_date: projDate, date: projDate, status: 'projected', _isProjected: true })
          }
        }
      } catch {}
    }

    renderList(listEl, txs)
    renderSummaryBar(barEl, summary, currentType)
  } catch (e) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Erro ao carregar</div><p class="empty-state-msg">${e.message}</p></div>`
  }
}

function renderList(el, txs) {
  if (!txs.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-title">Nenhum lançamento</div><p class="empty-state-msg">Clique em "+ Novo" para adicionar</p></div>`
    return
  }

  // Agrupa por data
  const grouped = groupBy(txs, t => t.due_date || t.date)
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const today = date.today()

  el.innerHTML = sortedDates.map(d => {
    const dayTxs = grouped[d]
    const dayTotal = dayTxs.filter(t => t.type !== 'income').reduce((s,t) => s - Number(t.amount), 0)
    const dayIncome = dayTxs.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0)

    return `
      <div class="transaction-date-group" data-date="${d}">
        <div class="transaction-group-header">
          <span>Em ${fmt.date(d, 'medium')}</span>
          <span class="text-mono" style="font-size:var(--text-xs);color:${dayIncome > 0 ? 'var(--color-green)' : 'var(--color-red)'}">
            ${dayIncome > 0 ? '+' + fmt.currency(dayIncome) : ''}
            ${dayTotal < 0 ? fmt.currency(dayTotal) : ''}
          </span>
        </div>
        ${dayTxs.map(t => transactionItem(t)).join('')}
      </div>
    `
  }).join('')

  // Scroll para o dia atual
  requestAnimationFrame(() => {
    const todayEl = el.querySelector(`[data-date="${today}"]`)
    if (todayEl) {
      todayEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })

  // Attach click events
  el.querySelectorAll('[data-tx-id]').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (e.target.closest('[data-action]')) return
      const id = item.dataset.txId
      if (id.startsWith('proj_')) {
        // Transação projetada — abrir modal de criação pré-preenchida (sem ID)
        const proj = cachedTransactions.find(t => t.id === id)
        if (proj) openTransactionModal({ type: proj.type, prefill: { amount: proj.amount, description: proj.description } })
        return
      }
      openTransactionModal({ id })
    })
    item.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation()
        handleTxAction(btn.dataset.action, item.dataset.txId, item.dataset.txRecGroup)
      })
    })
  })
}

function transactionItem(t) {
  const isExpense = t.type === 'expense' || t.type === 'expense_card'
  const isIncome  = t.type === 'income'
  const isProjected = t._isProjected === true
  const isPending = t.status === 'pending'
  const today = date.today()
  const txDate = t.due_date || t.date
  const isOverdue  = isPending && txDate < today
  const isDueSoon  = isPending && !isOverdue && txDate <= date.addDays(today, 3)

  const cat = t.categories || null
  const acc = t.accounts || t.credit_cards || null
  const statusIcon = isProjected ? '🔮' : (isPending ? (isOverdue ? '🔴' : '⏰') : '✅')

  const installText = t.installment_total > 1 ? ` ${t.installment_current}/${t.installment_total}` : ''
  const FIXED_REC = new Set(['monthly','fixed_monthly','weekly','fixed_weekly','yearly','fixed_yearly','daily','biweekly','bimonthly','quarterly','semiannual'])
  const recText = FIXED_REC.has(t.recurrence) ? ' • Recorrente' : ''

  return `
    <div class="transaction-item${isOverdue ? ' overdue' : isDueSoon ? ' due-soon' : ''}" data-tx-id="${t.id}" data-tx-rec-group="${t.recurrence_group_id || ''}" style="${isProjected ? 'opacity:0.65;' : ''}">
      <div class="transaction-icon" style="background:${cat?.color ? cat.color + '22' : (isIncome ? 'var(--color-income-dim)' : 'var(--color-expense-dim)')}">
        ${cat?.icon || (isIncome ? '💰' : '💸')}
      </div>
      <div class="transaction-info">
        <div class="transaction-desc">${t.description}${installText}</div>
        <div class="transaction-sub">
          ${statusIcon}
          ${isProjected ? `<span class="badge badge-yellow" style="font-size:10px;padding:1px 6px;margin-left:2px">Previsto</span>` : ''}
          ${acc?.name ? `<span>${acc.name}</span>` : ''}
          ${cat?.name ? `<span>${cat.name}</span>` : ''}
          ${recText ? `<span style="color:var(--color-blue)">${recText}</span>` : ''}
        </div>
      </div>
      <div class="transaction-meta">
        <div class="transaction-amount ${isIncome ? 'value-positive' : (isPending || isProjected) ? 'value-pending' : 'value-negative'}">
          ${isIncome ? '+' : '-'}${fmt.currency(t.amount)}
        </div>
        <div class="transaction-date">${fmt.date(txDate, 'short')}</div>
        ${!isProjected ? `
        <div style="display:flex;gap:4px;justify-content:flex-end;margin-top:4px">
          ${isPending ? `<button class="btn-icon btn" style="padding:2px 5px;font-size:12px" data-action="confirm" title="Efetivar">✅</button>` : ''}
          ${(isPending && t.recurrence_group_id) ? `<button class="btn-icon btn" style="padding:2px 5px;font-size:12px" data-action="confirm-batch" title="Efetivar parcelas em lote">✅✅</button>` : ''}
          <button class="btn-icon btn" style="padding:2px 5px;font-size:12px" data-action="delete" title="Excluir">🗑️</button>
        </div>` : ''}
      </div>
    </div>
  `
}

async function handleTxAction(action, id, groupId) {
  if (action === 'confirm') {
    try {
      await endpoints.confirmTx(id)
      Toast.success('Lançamento efetivado')
      loadTransactions()
    } catch (e) { Toast.error(e.message) }
  }
  if (action === 'confirm-batch') {
    await openBatchConfirmModal(id, groupId)
  }
  if (action === 'delete') {
    let scope = 'single'
    if (groupId) {
      const scopeChoice = await showDeleteScopeModal(id, groupId)
      if (!scopeChoice) return
      scope = scopeChoice
    } else {
      const ok = await Confirm.delete('este lançamento')
      if (!ok) return
    }
    try {
      await endpoints.deleteTx(id, scope)
      Toast.success('Lançamento excluído')
      loadTransactions()
    } catch (e) { Toast.error(e.message) }
  }
}

async function showDeleteScopeModal(txId, groupId) {
  let groupTxs = []
  try {
    const res = await endpoints.transactions({ recurrence_group_id: groupId })
    groupTxs = res.data || []
  } catch {}

  const totalAmount = groupTxs.reduce((s, t) => s + Number(t.amount), 0)
  const count = groupTxs.length
  const desc = groupTxs[0]?.description || 'este lançamento'

  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.className = 'confirm-overlay'
    overlay.innerHTML = `
      <div class="confirm-box animate-scale-in" style="max-width:420px">
        <div class="confirm-icon">⚠️</div>
        <div class="confirm-title">Excluir lançamento recorrente</div>
        <p class="confirm-msg">
          <strong>${desc}</strong> — ${count} parcelas (${fmt.currency(totalAmount)} no total).<br>
          <span style="color:var(--color-red)">Esta ação não pode ser desfeita.</span>
        </p>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-secondary" data-scope="single">Excluir apenas este</button>
          <button class="btn btn-secondary" data-scope="future">Excluir este e futuros</button>
          <button class="btn btn-danger" data-scope="all" id="_deleteAllBtn" style="opacity:0.5" disabled>
            Excluir todas as ${count} parcelas
          </button>
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer;font-size:var(--text-sm);color:var(--color-text-soft)">
          <input type="checkbox" id="_deleteAllConfirm" style="width:16px;height:16px">
          Confirmo que desejo excluir todas as parcelas
        </label>
        <div class="confirm-actions" style="margin-top:16px">
          <button class="btn btn-secondary" id="_deleteScopeCancel">Cancelar</button>
        </div>
      </div>
    `
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('open'))

    const close = (result) => {
      overlay.classList.remove('open')
      setTimeout(() => overlay.remove(), 300)
      resolve(result)
    }

    overlay.querySelector('#_deleteScopeCancel').addEventListener('click', () => close(null))
    overlay.addEventListener('click', e => { if (e.target === overlay) close(null) })

    overlay.querySelector('#_deleteAllConfirm').addEventListener('change', (e) => {
      const btn = overlay.querySelector('#_deleteAllBtn')
      btn.disabled = !e.target.checked
      btn.style.opacity = e.target.checked ? '1' : '0.5'
    })

    overlay.querySelectorAll('[data-scope]').forEach(btn => {
      btn.addEventListener('click', () => close(btn.dataset.scope))
    })
  })
}

async function openBatchConfirmModal(txId, groupId) {
  if (!groupId) return

  let groupTxs = []
  try {
    const res = await endpoints.transactions({ recurrence_group_id: groupId })
    groupTxs = (res.data || []).sort((a, b) => a.due_date.localeCompare(b.due_date))
  } catch (e) {
    Toast.error('Erro ao carregar parcelas')
    return
  }

  const pending = groupTxs.filter(t => t.status === 'pending')

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h3 class="modal-title">Efetivar parcelas em lote</h3>
        <button class="btn btn-icon" id="batchClose">✕</button>
      </div>
      <div class="modal-body">
        <p class="text-sm text-soft" style="margin-bottom:12px">
          ${groupTxs[0]?.description || ''} — ${groupTxs.length} parcelas no total
        </p>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto" id="batchList">
          ${groupTxs.map(t => {
            const isPending = t.status === 'pending'
            return `
              <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-md);background:var(--color-card-hover);cursor:${isPending?'pointer':'default'}">
                <input type="checkbox" data-batch-id="${t.id}" ${isPending ? '' : 'checked disabled'} style="width:16px;height:16px">
                <span class="text-sm" style="flex:1">${fmt.date(t.due_date, 'medium')}</span>
                <span class="text-mono text-sm ${isPending ? 'value-pending' : 'value-positive'}">${isPending ? '⏰' : '✅'} ${fmt.currency(t.amount)}</span>
              </label>
            `
          }).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-secondary btn-sm" id="batchSelectAll">Selecionar todas pendentes</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="batchCancel">Cancelar</button>
        <button class="btn btn-primary" id="batchConfirmBtn">Efetivar selecionadas</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))

  const close = () => {
    overlay.classList.remove('open')
    setTimeout(() => overlay.remove(), 300)
  }

  overlay.querySelector('#batchClose')?.addEventListener('click', close)
  overlay.querySelector('#batchCancel')?.addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  overlay.querySelector('#batchSelectAll')?.addEventListener('click', () => {
    overlay.querySelectorAll('[data-batch-id]:not([disabled])').forEach(cb => { cb.checked = true })
  })

  overlay.querySelector('#batchConfirmBtn')?.addEventListener('click', async (e) => {
    const ids = [...overlay.querySelectorAll('[data-batch-id]:not([disabled]):checked')].map(cb => cb.dataset.batchId)
    if (!ids.length) { Toast.error('Nenhuma parcela selecionada'); return }
    Loading.btn(e.target, true)
    try {
      await endpoints.bulkConfirmTx({ recurrence_group_id: groupId, transaction_ids: ids })
      Toast.success(`${ids.length} parcela(s) efetivada(s)`)
      close()
      loadTransactions()
    } catch (err) {
      Toast.error(err.message)
      Loading.btn(e.target, false)
    }
  })
}

function renderSummaryBar(el, summary, type) {
  if (!el || !summary) return
  const isIncome = type === 'income'
  const isAll = type === 'all'

  const confirmed = isIncome ? summary.income?.confirmed : summary.expense?.confirmed
  const pending   = isIncome ? summary.income?.pending   : summary.expense?.pending
  const total     = isIncome ? summary.income?.total     : summary.expense?.total

  el.innerHTML = `
    <div class="summary-bar-item">
      <span class="summary-bar-label">Efetivadas</span>
      <span class="summary-bar-value ${isIncome ? 'value-positive' : 'value-negative'}">${fmt.currency(confirmed || 0)}</span>
    </div>
    <div class="summary-bar-sep"></div>
    <div class="summary-bar-item">
      <span class="summary-bar-label">Pendentes</span>
      <span class="summary-bar-value value-pending">${fmt.currency(pending || 0)}</span>
    </div>
    <div class="summary-bar-sep"></div>
    <div class="summary-bar-item">
      <span class="summary-bar-label">Total</span>
      <span class="summary-bar-value font-bold">${fmt.currency(total || 0)}</span>
    </div>
    ${isAll ? `<div class="summary-bar-sep"></div><div class="summary-bar-item"><span class="summary-bar-label">Saldo</span><span class="summary-bar-value font-bold ${summary.balance >= 0 ? 'value-positive' : 'value-negative'}">${fmt.currency(summary.balance)}</span></div>` : ''}
  `
}

// ===== MODAL DE NOVO/EDITAR LANÇAMENTO =====
export async function openTransactionModal(opts = {}) {
  const { type = 'expense', id, prefill, credit_card_id: presetCardId, due_date: presetDate } = opts
  let existing = null

  if (id) {
    existing = cachedTransactions.find(t => t.id === id) || null
  }

  const accounts = store.get('accounts') || []
  const categories = store.get('categories') || []
  const creditCards = store.get('creditCards') || []

  // Pre-select card if launched from card widget
  if (presetCardId && !existing) {
    existing = { type: type || 'expense_card', credit_card_id: presetCardId }
  }

  const txBase = existing || { type, ...(presetDate ? { due_date: presetDate } : {}) }
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = buildTransactionModal(txBase, accounts, categories, creditCards)
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))

  // Pré-preenchimento via voz
  if (prefill) {
    if (prefill.amount) {
      const amtEl = overlay.querySelector('#txAmount')
      if (amtEl) amtEl.value = prefill.amount
    }
    if (prefill.description) {
      const descEl = overlay.querySelector('#txDesc')
      if (descEl) descEl.value = prefill.description
    }
  }

  // Load accounts, categories e credit cards se não estiverem em cache
  const needsLoad = !accounts.length || !categories.length || !creditCards.length
  if (needsLoad) {
    try {
      const toFetch = [endpoints.accounts(), endpoints.categories()]
      if (!creditCards.length) toFetch.push(endpoints.cardInvoices({ month: store.getMonth() }))
      const results = await Promise.all(toFetch)
      const [accs, cats] = results
      const cards = results[2] || creditCards
      store.set('accounts', accs)
      store.set('categories', cats)
      store.set('creditCards', cards)
      rebuildModalSelects(overlay, accs, cats, cards, existing)

      // Selecionar categoria pelo hint de voz
      if (prefill?.category_hint) {
        const catSel = overlay.querySelector('#txCategory')
        const allCats = cats.filter(c => c.type !== 'income')
        const match = allCats.find(c => c.name.toLowerCase().includes(prefill.category_hint.toLowerCase()))
        if (match && catSel) catSel.value = match.id
      }
    } catch {}
  } else if (existing?.category_id) {
    // Categorias já estavam em cache — forçar seleção após render completo
    setTimeout(() => {
      const catSel = overlay.querySelector('#txCategory')
      if (!catSel) return
      const hasOption = Array.from(catSel.options).some(o => o.value === existing.category_id)
      if (!hasOption) {
        const opt = document.createElement('option')
        opt.value = existing.category_id
        opt.textContent = existing.categories?.name || existing.category_name || 'Categoria'
        opt.selected = true
        catSel.appendChild(opt)
      } else {
        catSel.value = existing.category_id
      }
      catSel.dispatchEvent(new Event('change'))
    }, 50)
  }

  attachModalEvents(overlay, existing)
}

function getDefaultDueDate() {
  return date.today()
}

function buildAccountSelectOptions(accounts, creditCards, tx) {
  const accParts = (accounts || []).map(a => {
    const val = `account:${a.id}`
    const sel = tx?.account_id === a.id ? 'selected' : ''
    return `<option value="${val}" ${sel}>${a.name}</option>`
  }).join('')

  const cardParts = (creditCards || []).map(c => {
    const val = `card:${c.id}`
    const sel = tx?.credit_card_id === c.id ? 'selected' : ''
    return `<option value="${val}" ${sel}>${c.name} (cartão)</option>`
  }).join('')

  let html = ''
  if (accParts) html += `<optgroup label="🏦 Contas bancárias">${accParts}</optgroup>`
  if (cardParts) html += `<optgroup label="💳 Cartões de crédito">${cardParts}</optgroup>`
  return html
}

function buildTransactionModal(tx, accounts, categories, creditCards = []) {
  const isEdit = !!tx.id
  const txType = tx.type || 'expense'

  const typeLabels = {
    expense: 'Nova Despesa',
    income:  'Nova Receita',
    transfer: 'Nova Transferência',
    expense_card: 'Nova Despesa — Cartão de crédito',
  }

  const expenseCategories = (categories || []).filter(c => (c.type === 'expense' || c.type === 'both') && !c.parent_id)
  const incomeCategories  = (categories || []).filter(c => (c.type === 'income'  || c.type === 'both') && !c.parent_id)
  const cats = txType === 'income' ? incomeCategories : expenseCategories

  const accountSelectOptions = buildAccountSelectOptions(accounts, creditCards, tx)
  // Apenas categorias pai no select principal
  const catOptions = cats.map(c => `<option value="${c.id}" ${tx.category_id === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')

  return `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <div>
          <div style="display:flex;gap:4px;margin-bottom:6px">
            <div class="modal-type-tab ${txType==='expense'?'active':''}" data-type="expense">Despesa</div>
            <div class="modal-type-tab ${txType==='income'?'active':''}" data-type="income">Receita</div>
            <div class="modal-type-tab ${txType==='transfer'?'active':''}" data-type="transfer">Transf.</div>
            <div class="modal-type-tab ${txType==='expense_card'?'active':''}" data-type="card">Cartão</div>
          </div>
          <h3 class="modal-title" id="modalTxTitle">${typeLabels[txType] || typeLabels.expense}</h3>
        </div>
        <button class="btn btn-icon" id="modalTxClose">✕</button>
      </div>

      <div class="modal-body" id="modalTxBody">
        <!-- Valor -->
        <div class="form-control-value">
          <span class="currency-prefix">R$</span>
          <input id="txAmount" type="number" step="0.01" min="0" placeholder="0,00" value="${tx.amount || ''}" required>
        </div>

        <!-- Descrição -->
        <div class="form-group">
          <label class="form-label required">Descrição</label>
          <input id="txDesc" class="form-control" placeholder="Ex: Supermercado" value="${tx.description || ''}" required>
        </div>

        <!-- Data de vencimento + Hora -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label required">Vencimento</label>
            <div style="display:flex;gap:6px">
              <input id="txDate" class="form-control" type="date" value="${tx.due_date || tx.date || getDefaultDueDate()}" required style="flex:2">
              <input id="txTime" class="form-control" type="time" value="${tx.time || ''}" placeholder="Hora" style="flex:1">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Situação</label>
            <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
              <label class="toggle">
                <input type="checkbox" id="txConfirmed" ${tx.status !== 'pending' ? 'checked' : ''}>
                <span class="toggle-track"></span>
              </label>
              <span class="text-sm" id="txConfirmedLabel">${tx.status !== 'pending' ? 'Efetivado' : 'Pendente'}</span>
            </div>
          </div>
        </div>

        <!-- Parcelamento / Recorrência -->
        <div class="form-group" id="installmentGroup">
          <label class="form-label">Parcelamento / Repetição</label>
          <select id="txRecurrence" class="form-control">
            <option value="none" ${!tx.recurrence||tx.recurrence==='none'?'selected':''}>Não recorrente</option>
            <option value="installment" ${tx.recurrence==='installment'?'selected':''}>Parcelado</option>
            <option value="daily" ${tx.recurrence==='daily'?'selected':''}>Diário</option>
            <option value="weekly" ${tx.recurrence==='weekly'?'selected':''}>Semanal</option>
            <option value="biweekly" ${tx.recurrence==='biweekly'?'selected':''}>Quinzenal (a cada 2 semanas)</option>
            <option value="monthly" ${tx.recurrence==='monthly'||tx.recurrence==='fixed_monthly'?'selected':''}>Mensal</option>
            <option value="bimonthly" ${tx.recurrence==='bimonthly'?'selected':''}>Bimestral (a cada 2 meses)</option>
            <option value="quarterly" ${tx.recurrence==='quarterly'?'selected':''}>Trimestral (a cada 3 meses)</option>
            <option value="semiannual" ${tx.recurrence==='semiannual'?'selected':''}>Semestral (a cada 6 meses)</option>
            <option value="yearly" ${tx.recurrence==='yearly'||tx.recurrence==='fixed_yearly'?'selected':''}>Anual</option>
            <option value="custom" ${tx.recurrence==='custom'?'selected':''}>Personalizado</option>
          </select>

          <!-- Parcelas (só para installment) -->
          <div id="installmentFields" style="display:${tx.recurrence==='installment'?'flex':'none'};gap:8px;margin-top:8px">
            <div class="form-group" style="flex:1;margin-bottom:0">
              <label class="form-label" style="font-size:var(--text-xs)">Parcela atual</label>
              <input id="txInstStart" type="number" class="form-control" placeholder="1" min="1" value="${tx.installment_current || 1}">
            </div>
            <div class="form-group" style="flex:1;margin-bottom:0">
              <label class="form-label" style="font-size:var(--text-xs)">Total de parcelas</label>
              <input id="txInstTotal" type="number" class="form-control" placeholder="2" min="1" value="${tx.installment_total || 2}">
            </div>
          </div>

          <!-- Personalizado (só para custom) -->
          <div id="customFields" style="display:${tx.recurrence==='custom'?'flex':'none'};gap:8px;margin-top:8px;align-items:center">
            <span class="text-sm text-soft" style="white-space:nowrap">A cada</span>
            <input id="txCustomInterval" type="number" class="form-control" min="1" value="${tx.recurrence_interval || 1}" style="width:72px">
            <select id="txCustomUnit" class="form-control">
              <option value="days"   ${tx.recurrence_unit==='days'  ?'selected':''}>dias</option>
              <option value="weeks"  ${tx.recurrence_unit==='weeks' ?'selected':''}>semanas</option>
              <option value="months" ${!tx.recurrence_unit||tx.recurrence_unit==='months'?'selected':''}>meses</option>
              <option value="years"  ${tx.recurrence_unit==='years' ?'selected':''}>anos</option>
            </select>
          </div>

          <div id="installmentPreview" class="form-hint" style="margin-top:6px"></div>
        </div>

        <!-- Categoria -->
        <div class="form-row" id="categoryGroup">
          <div class="form-group">
            <label class="form-label">Categoria</label>
            <select id="txCategory" class="form-control">
              <option value="">Sem categoria</option>
              ${catOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Subcategoria <span class="text-muted text-xs">(opcional)</span></label>
            <select id="txSubcategory" class="form-control">
              <option value="">Sem subcategoria</option>
            </select>
          </div>
        </div>

        <!-- Conta / Cartão -->
        <div class="form-group">
          <label class="form-label">Conta / Cartão</label>
          <select id="txAccount" class="form-control">
            <option value="">Selecione...</option>
            ${accountSelectOptions}
          </select>
        </div>

        <!-- Observações -->
        <div class="form-group">
          <label class="form-label">Observações</label>
          <textarea id="txNotes" class="form-control" rows="2" placeholder="Notas, #hashtags...">${tx.notes || ''}</textarea>
        </div>

        <!-- Opções avançadas (toggle) -->
        <details style="margin-top:4px">
          <summary style="cursor:pointer;font-size:var(--text-sm);color:var(--color-text-soft);padding:8px 0">Opções avançadas ▾</summary>
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
            <label class="toggle-group"><div><div class="toggle-label">Ignorar nos gráficos</div></div><label class="toggle"><input type="checkbox" id="txIgnoreCharts" ${tx.ignore_in_charts?'checked':''}><span class="toggle-track"></span></label></label>
            <label class="toggle-group"><div><div class="toggle-label">Ignorar em orçamentos</div></div><label class="toggle"><input type="checkbox" id="txIgnoreBudgets" ${tx.ignore_in_budgets?'checked':''}><span class="toggle-track"></span></label></label>
            <label class="toggle-group"><div><div class="toggle-label">Ignorar nos totais</div></div><label class="toggle"><input type="checkbox" id="txIgnoreTotals" ${tx.ignore_in_totals?'checked':''}><span class="toggle-track"></span></label></label>
          </div>
        </details>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" id="modalTxCancel">Cancelar</button>
        <button class="btn btn-primary" id="modalTxSave">${isEdit ? 'Salvar alterações' : 'Salvar'}</button>
      </div>
    </div>
  `
}

function attachModalEvents(overlay, existing) {
  const close = () => {
    overlay.classList.remove('open')
    setTimeout(() => overlay.remove(), 300)
  }

  overlay.querySelector('#modalTxClose')?.addEventListener('click', close)
  overlay.querySelector('#modalTxCancel')?.addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  // Toggle tipo — atualiza categorias ao trocar
  overlay.querySelectorAll('.modal-type-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.modal-type-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      const allCats = store.get('categories') || []
      const catSel = overlay.querySelector('#txCategory')
      if (catSel && allCats.length) {
        const isIncome = tab.dataset.type === 'income'
        const cats = allCats.filter(c =>
          (isIncome ? (c.type === 'income' || c.type === 'both') : (c.type === 'expense' || c.type === 'both')) && !c.parent_id
        )
        catSel.innerHTML = '<option value="">Sem categoria</option>' +
          cats.map(c => `<option value="${c.id}">${c.icon || ''} ${c.name}</option>`).join('')
      }
    })
  })

  // Subcategoria — atualiza ao mudar categoria
  const catSelect = overlay.querySelector('#txCategory')
  const subCatSelect = overlay.querySelector('#txSubcategory')

  function updateSubcategories(categoryId) {
    if (!subCatSelect) return
    const categories = store.get('categories') || []
    const parent = categories.find(c => c.id === categoryId)
    const children = parent?.children || []
    subCatSelect.innerHTML = '<option value="">Sem subcategoria</option>' +
      children.map(sc => `<option value="${sc.id}">${sc.name}</option>`).join('')
    subCatSelect.disabled = children.length === 0
  }

  catSelect?.addEventListener('change', () => {
    updateSubcategories(catSelect.value)
  })
  if (catSelect?.value) updateSubcategories(catSelect.value)

  // Toggle confirmado
  const confirmedInput = overlay.querySelector('#txConfirmed')
  const confirmedLabel = overlay.querySelector('#txConfirmedLabel')
  confirmedInput?.addEventListener('change', () => {
    confirmedLabel.textContent = confirmedInput.checked ? 'Efetivado' : 'Pendente'
  })

  // Parcelamento / Recorrência
  const recurrenceSelect = overlay.querySelector('#txRecurrence')
  const installFields    = overlay.querySelector('#installmentFields')
  const customFields     = overlay.querySelector('#customFields')
  const installPreview   = overlay.querySelector('#installmentPreview')

  const RECURRENCE_LABELS = {
    daily:      'Diário — repetirá todo dia',
    weekly:     'Semanal — repetirá a cada semana',
    biweekly:   'Quinzenal — repetirá a cada 2 semanas',
    monthly:    'Mensal — repetirá todo mês',
    bimonthly:  'Bimestral — repetirá a cada 2 meses',
    quarterly:  'Trimestral — repetirá a cada 3 meses',
    semiannual: 'Semestral — repetirá a cada 6 meses',
    yearly:     'Anual — repetirá todo ano',
  }

  const updateInstallPreview = () => {
    const rec = recurrenceSelect?.value
    installFields.style.display = rec === 'installment' ? 'flex' : 'none'
    customFields.style.display  = rec === 'custom'      ? 'flex' : 'none'

    if (rec === 'installment') {
      const total  = Number(overlay.querySelector('#txInstTotal')?.value) || 0
      const amount = Number(overlay.querySelector('#txAmount')?.value)    || 0
      installPreview.textContent = total > 0 && amount > 0
        ? `Em ${total}x de ${fmt.currency(amount / total)}`
        : ''
    } else if (rec === 'custom') {
      const n    = overlay.querySelector('#txCustomInterval')?.value || 1
      const unit = overlay.querySelector('#txCustomUnit')?.value || 'months'
      const unitLabels = { days:'dia(s)', weeks:'semana(s)', months:'mês/meses', years:'ano(s)' }
      installPreview.textContent = `Repetirá a cada ${n} ${unitLabels[unit]}`
    } else if (RECURRENCE_LABELS[rec]) {
      installPreview.textContent = RECURRENCE_LABELS[rec]
    } else {
      installPreview.textContent = ''
    }
  }

  recurrenceSelect?.addEventListener('change', updateInstallPreview)
  overlay.querySelector('#txInstTotal')?.addEventListener('input', updateInstallPreview)
  overlay.querySelector('#txAmount')?.addEventListener('input', updateInstallPreview)
  overlay.querySelector('#txCustomInterval')?.addEventListener('input', updateInstallPreview)
  overlay.querySelector('#txCustomUnit')?.addEventListener('change', updateInstallPreview)

  // Salvar
  const saveBtn = overlay.querySelector('#modalTxSave')
  saveBtn?.addEventListener('click', async () => {
    const activeTypeTab = overlay.querySelector('.modal-type-tab.active')
    const txType = activeTypeTab?.dataset.type === 'card' ? 'expense_card' : (activeTypeTab?.dataset.type || 'expense')
    const amount = Number(overlay.querySelector('#txAmount')?.value)
    const description = overlay.querySelector('#txDesc')?.value?.trim()

    if (!amount || amount <= 0) { Toast.error('Informe um valor válido'); return }
    if (!description) { Toast.error('Informe a descrição'); return }

    const recurrence = overlay.querySelector('#txRecurrence')?.value || 'none'

    // Parsear seleção de conta/cartão com prefixo
    const rawAccountVal = overlay.querySelector('#txAccount')?.value || ''
    let account_id = null, credit_card_id = null
    if (rawAccountVal.startsWith('card:')) {
      credit_card_id = rawAccountVal.slice(5) || null
    } else if (rawAccountVal.startsWith('account:')) {
      account_id = rawAccountVal.slice(8) || null
    } else if (rawAccountVal) {
      account_id = rawAccountVal  // legado: UUID puro
    }

    const payload = {
      type: txType,
      amount,
      description,
      due_date: overlay.querySelector('#txDate')?.value,
      time: overlay.querySelector('#txTime')?.value || null,
      status: overlay.querySelector('#txConfirmed')?.checked ? 'confirmed' : 'pending',
      recurrence,
      installment_current: Number(overlay.querySelector('#txInstStart')?.value) || 1,
      installment_total:   Number(overlay.querySelector('#txInstTotal')?.value) || 1,
      recurrence_interval: recurrence === 'custom' ? Number(overlay.querySelector('#txCustomInterval')?.value) || 1 : null,
      recurrence_unit:     recurrence === 'custom' ? (overlay.querySelector('#txCustomUnit')?.value || 'months') : null,
      category_id: (overlay.querySelector('#txSubcategory')?.value || overlay.querySelector('#txCategory')?.value || null) || null,
      account_id,
      credit_card_id,
      notes:       overlay.querySelector('#txNotes')?.value    || null,
      ignore_in_charts:  overlay.querySelector('#txIgnoreCharts')?.checked  || false,
      ignore_in_budgets: overlay.querySelector('#txIgnoreBudgets')?.checked || false,
      ignore_in_totals:  overlay.querySelector('#txIgnoreTotals')?.checked  || false,
    }

    Loading.btn(saveBtn, true)
    try {
      if (existing?.id) {
        await endpoints.updateTx(existing.id, payload)
        Toast.success('Lançamento atualizado')
      } else {
        await endpoints.createTx(payload)
        Toast.success('Lançamento salvo')
      }
      cache.clear()
      close()
      loadTransactions()
      // Recarregar cartões se transação é de cartão (atualiza fatura no widget)
      if (payload.credit_card_id) window.__reloadCards?.()
      // Mostra saldo da conta se preferência ativa
      const prefs = store.get('preferences') || {}
      if (prefs.show_balance_on_save && payload.account_id) {
        try {
          const balRes = await endpoints.accountBalance({ account_id: payload.account_id })
          const acc = (store.get('accounts') || []).find(a => a.id === payload.account_id)
          if (balRes?.balance !== undefined) {
            Toast.info(`${acc?.name || 'Conta'}: ${fmt.currency(balRes.balance)}`, 4000)
          }
        } catch {}
      }
    } catch (e) {
      Toast.error(e.message)
      Loading.btn(saveBtn, false)
    }
  })
}

function rebuildModalSelects(overlay, accounts, categories, creditCards = [], tx = null) {
  const accSel = overlay.querySelector('#txAccount')
  if (accSel) {
    accSel.innerHTML = '<option value="">Selecione...</option>' + buildAccountSelectOptions(accounts, creditCards, tx)
    if (tx?.credit_card_id) accSel.value = `card:${tx.credit_card_id}`
    else if (tx?.account_id) accSel.value = `account:${tx.account_id}`
  }
  const catSel = overlay.querySelector('#txCategory')
  if (catSel) {
    const activeTab = overlay.querySelector('.modal-type-tab.active')
    const isIncome = activeTab?.dataset.type === 'income'
    const cats = categories.filter(c =>
      (isIncome ? (c.type === 'income' || c.type === 'both') : (c.type === 'expense' || c.type === 'both')) && !c.parent_id
    )
    catSel.innerHTML = '<option value="">Sem categoria</option>' +
      cats.map(c => `<option value="${c.id}">${c.icon || ''} ${c.name}</option>`).join('')
    if (tx?.category_id) {
      catSel.value = tx.category_id
      catSel.dispatchEvent(new Event('change'))
    }
  }
}

function openFilterDrawer() {
  // TODO: implementar drawer de filtros
  Toast.info('Filtros avançados em breve')
}

function skeletonList(n) {
  return Array(n).fill(`
    <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--color-border)">
      <div class="skeleton skeleton-avatar" style="width:36px;height:36px;border-radius:10px;flex-shrink:0"></div>
      <div style="flex:1"><div class="skeleton skeleton-text" style="width:60%;margin-bottom:6px"></div><div class="skeleton skeleton-text" style="width:40%"></div></div>
      <div class="skeleton skeleton-text" style="width:70px"></div>
    </div>
  `).join('')
}
