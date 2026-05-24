import { endpoints } from '../core/api.js'
import { store, cache } from '../core/store.js'
import { fmt, BANKS, COLORS } from '../core/utils.js'
import { Toast, Confirm, Loading } from '../core/notifications.js'

let unsubMonth = null

export async function render(el) {
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <div style="padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <span class="text-soft text-sm" id="accCount">Carregando...</span>
        <button class="btn btn-primary btn-sm" id="newAccBtn">+ Nova conta</button>
      </div>
      <div style="flex:1;overflow-y:auto;" id="accBody"></div>
      <div class="summary-bar" id="accSummaryBar"></div>
    </div>
  `

  el.querySelector('#newAccBtn')?.addEventListener('click', () => openAccountModal())
  unsubMonth = store.subscribe('currentMonth', loadAccounts)
  await loadAccounts()
  el.addEventListener('__cleanup', () => unsubMonth?.(), { once: true })
}

async function loadAccounts() {
  const body = document.getElementById('accBody')
  const bar = document.getElementById('accSummaryBar')
  const count = document.getElementById('accCount')
  if (!body) return

  body.innerHTML = skeletons(3)
  try {
    const accounts = await endpoints.accountBalance({ month: store.getMonth() })
    store.set('accounts', accounts)
    count.textContent = `${accounts.length} conta${accounts.length !== 1 ? 's' : ''}`
    renderTable(body, accounts)
    renderBar(bar, accounts)
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Erro</div><p class="empty-state-msg">${e.message}</p></div>`
  }
}

function renderTable(el, accounts) {
  if (!accounts.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏦</div><div class="empty-state-title">Nenhuma conta</div><p class="empty-state-msg">Adicione sua primeira conta bancária</p><button class="btn btn-primary mt-4" onclick="document.getElementById('newAccBtn').click()">+ Nova conta</button></div>`
    return
  }

  el.innerHTML = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;min-width:700px">
        <thead>
          <tr style="border-bottom:1px solid var(--color-border)">
            ${['Conta','Saldo inicial','Receitas','Despesas','Saldo','Previsto',''].map(h => `<th style="padding:10px 16px;text-align:${h===''?'right':'left'};font-size:var(--text-xs);font-weight:600;color:var(--color-text-muted);text-transform:uppercase;white-space:nowrap">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${accounts.map(acc => accountRow(acc)).join('')}
        </tbody>
      </table>
    </div>
  `

  el.querySelectorAll('[data-acc-id]').forEach(row => {
    row.querySelector('[data-edit]')?.addEventListener('click', () => openAccountModal(row.dataset.accId))
    row.querySelector('[data-delete]')?.addEventListener('click', () => deleteAccount(row.dataset.accId, row.dataset.accName))
    row.querySelector('[data-txs]')?.addEventListener('click', () => location.hash = `transactions?account_id=${row.dataset.accId}`)
  })
}

function accountRow(acc) {
  const bank = BANKS.find(b => b.code === acc.bank_code)
  return `
    <tr data-acc-id="${acc.id}" data-acc-name="${acc.name}" style="border-bottom:1px solid var(--color-border);transition:background 150ms ease;cursor:pointer" onmouseover="this.style.background='var(--color-card-hover)'" onmouseout="this.style.background=''">
      <td style="padding:12px 16px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:8px;height:8px;border-radius:50%;background:${acc.color};flex-shrink:0"></div>
          <div>
            <div style="font-size:var(--text-sm);font-weight:500">${acc.name}</div>
            ${acc.bank_name ? `<div style="font-size:var(--text-xs);color:var(--color-text-soft)">${bank?.emoji || '🏦'} ${acc.bank_name}</div>` : ''}
          ${Number(acc.overdraft_limit) > 0 ? `<div style="font-size:var(--text-xs);color:var(--color-blue)">Limite disponível: ${fmt.currency(acc.available_balance)}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="padding:12px 16px;font-family:var(--font-mono);font-size:var(--text-sm)">${fmt.currency(acc.initial_balance)}</td>
      <td style="padding:12px 16px;font-family:var(--font-mono);font-size:var(--text-sm);color:var(--color-green)">${fmt.currency(acc.income_confirmed)}</td>
      <td style="padding:12px 16px;font-family:var(--font-mono);font-size:var(--text-sm);color:var(--color-red)">${fmt.currency(acc.expense_confirmed)}</td>
      <td style="padding:12px 16px;font-family:var(--font-mono);font-size:var(--text-sm);font-weight:700;color:${Number(acc.balance)>=0?'var(--color-green)':'var(--color-red)'}">${fmt.currency(acc.balance)}</td>
      <td style="padding:12px 16px;font-family:var(--font-mono);font-size:var(--text-sm);color:var(--color-text-soft)">${fmt.currency(acc.forecast)}</td>
      <td style="padding:12px 16px;text-align:right">
        <div style="display:flex;gap:4px;justify-content:flex-end">
          <button class="btn btn-icon btn-sm" data-txs title="Ver transações">📋</button>
          <button class="btn btn-icon btn-sm" data-edit title="Editar">✏️</button>
          <button class="btn btn-icon btn-sm" data-delete title="Excluir">🗑️</button>
        </div>
      </td>
    </tr>
  `
}

function renderBar(el, accounts) {
  if (!el) return
  const total = accounts.filter(a => !a.ignore_in_totals).reduce((s,a) => s + Number(a.balance), 0)
  const forecast = accounts.filter(a => !a.ignore_in_totals).reduce((s,a) => s + Number(a.forecast), 0)
  el.innerHTML = `
    <div class="summary-bar-item"><span class="summary-bar-label">Saldo total</span><span class="summary-bar-value ${total>=0?'value-positive':'value-negative'}">${fmt.currency(total)}</span></div>
    <div class="summary-bar-sep"></div>
    <div class="summary-bar-item"><span class="summary-bar-label">Previsto</span><span class="summary-bar-value ${forecast>=0?'value-positive':'value-negative'}">${fmt.currency(forecast)}</span></div>
  `
}

async function deleteAccount(id, name) {
  const ok = await Confirm.delete(name)
  if (!ok) return
  try {
    await endpoints.deleteAccount(id)
    Toast.success('Conta removida')
    cache.clear()
    loadAccounts()
  } catch (e) { Toast.error(e.message) }
}

function openAccountModal(id) {
  const accounts = store.get('accounts') || []
  const acc = id ? accounts.find(a => a.id === id) : null

  const bankOptions = BANKS.map(b => `<option value="${b.code}" ${acc?.bank_code === b.code ? 'selected' : ''}>${b.emoji} ${b.name}</option>`).join('')
  const colorSwatches = COLORS.map(c => `<div class="color-swatch ${acc?.color === c ? 'selected' : ''}" style="background:${c}" data-color="${c}"></div>`).join('')

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width:460px">
      <div class="modal-header">
        <h3 class="modal-title">${acc ? 'Editar conta' : 'Nova conta'}</h3>
        <button class="btn btn-icon" id="accModalClose">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label required">Nome da conta</label><input id="accName" class="form-control" value="${acc?.name || ''}" placeholder="Ex: Nubank, Carteira..."></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Banco</label><select id="accBank" class="form-control"><option value="">Selecione...</option>${bankOptions}</select></div>
          <div class="form-group"><label class="form-label">Tipo</label><select id="accType" class="form-control"><option value="checking" ${acc?.type==='checking'?'selected':''}>Conta Corrente</option><option value="savings" ${acc?.type==='savings'?'selected':''}>Poupança</option><option value="cash" ${acc?.type==='cash'?'selected':''}>Carteira</option><option value="investment" ${acc?.type==='investment'?'selected':''}>Investimento</option><option value="other" ${acc?.type==='other'?'selected':''}>Outro</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Saldo inicial</label><input id="accBalance" class="form-control" type="number" step="0.01" value="${acc?.initial_balance || 0}" placeholder="0,00"></div>
        <div class="form-group"><label class="form-label">Cheque especial / Limite</label><input id="accOverdraft" class="form-control" type="number" step="0.01" value="${acc?.overdraft_limit || 0}" placeholder="0,00"></div>
        <div class="form-group"><label class="form-label">Cor</label><div class="color-picker" id="accColorPicker">${colorSwatches}</div><input type="hidden" id="accColor" value="${acc?.color || '#00F5A0'}"></div>
        <label class="toggle-group"><div><div class="toggle-label">Incluir no resumo</div></div><label class="toggle"><input type="checkbox" id="accShowSummary" ${acc?.show_in_summary !== false ? 'checked' : ''}><span class="toggle-track"></span></label></label>
        <label class="toggle-group"><div><div class="toggle-label">Conta padrão</div></div><label class="toggle"><input type="checkbox" id="accIsDefault" ${acc?.is_default ? 'checked' : ''}><span class="toggle-track"></span></label></label>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="accModalCancel">Cancelar</button>
        <button class="btn btn-primary" id="accModalSave">${acc ? 'Salvar' : 'Criar conta'}</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))

  const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300) }
  overlay.querySelector('#accModalClose')?.addEventListener('click', close)
  overlay.querySelector('#accModalCancel')?.addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  // Color picker
  overlay.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      overlay.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'))
      sw.classList.add('selected')
      overlay.querySelector('#accColor').value = sw.dataset.color
    })
  })

  // Banco → atualiza nome
  overlay.querySelector('#accBank')?.addEventListener('change', e => {
    const bank = BANKS.find(b => b.code === e.target.value)
    if (bank && !overlay.querySelector('#accName').value) {
      overlay.querySelector('#accName').value = bank.name
    }
  })

  overlay.querySelector('#accModalSave')?.addEventListener('click', async (e) => {
    const name = overlay.querySelector('#accName')?.value?.trim()
    if (!name) { Toast.error('Informe o nome da conta'); return }

    const bankCode = overlay.querySelector('#accBank')?.value
    const bank = BANKS.find(b => b.code === bankCode)

    const payload = {
      name,
      bank_code: bankCode || null,
      bank_name: bank?.name || null,
      type: overlay.querySelector('#accType')?.value || 'checking',
      initial_balance: Number(overlay.querySelector('#accBalance')?.value) || 0,
      overdraft_limit: Number(overlay.querySelector('#accOverdraft')?.value) || 0,
      color: overlay.querySelector('#accColor')?.value || '#00F5A0',
      show_in_summary: overlay.querySelector('#accShowSummary')?.checked !== false,
      is_default: overlay.querySelector('#accIsDefault')?.checked || false,
    }

    Loading.btn(e.target, true)
    try {
      if (acc) await endpoints.updateAccount(acc.id, payload)
      else await endpoints.createAccount(payload)
      Toast.success(acc ? 'Conta atualizada' : 'Conta criada')
      cache.clear()
      close()
      loadAccounts()
    } catch (err) { Toast.error(err.message); Loading.btn(e.target, false) }
  })
}

function skeletons(n) {
  return Array(n).fill(`<div style="display:flex;align-items:center;gap:16px;padding:16px;border-bottom:1px solid var(--color-border)"><div class="skeleton" style="width:8px;height:8px;border-radius:50%"></div><div style="flex:1"><div class="skeleton skeleton-text mb-2" style="width:40%"></div><div class="skeleton skeleton-text" style="width:25%"></div></div><div class="skeleton skeleton-text" style="width:80px"></div></div>`).join('')
}
