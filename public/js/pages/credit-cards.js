import { endpoints } from '../core/api.js'
import { store, cache } from '../core/store.js'
import { fmt, BANKS, COLORS, date } from '../core/utils.js'
import { Toast, Confirm, Loading } from '../core/notifications.js'

const FLAG_META = [
  { id: 'visa',       emoji: '🔵', name: 'Visa'      },
  { id: 'mastercard', emoji: '🔴', name: 'Mastercard' },
  { id: 'elo',        emoji: '🟡', name: 'Elo'        },
  { id: 'amex',       emoji: '💠', name: 'Amex'       },
  { id: 'hipercard',  emoji: '❤️', name: 'Hipercard'  },
  { id: 'diners',     emoji: '🔷', name: 'Diners'     },
  { id: 'other',      emoji: '💳', name: 'Outro'      },
]

const FLAG_SVG = {
  visa:       `<svg width="36" height="22" viewBox="0 0 36 22" style="vertical-align:middle;border-radius:3px"><rect width="36" height="22" rx="3" fill="#1A1F71"/><text x="18" y="15" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="9" font-weight="bold" font-style="italic">VISA</text></svg>`,
  mastercard: `<svg width="36" height="22" viewBox="0 0 36 22" style="vertical-align:middle;border-radius:3px"><rect width="36" height="22" rx="3" fill="#1a1a1a"/><circle cx="14" cy="11" r="7" fill="#EB001B"/><circle cx="22" cy="11" r="7" fill="#F79E1B" opacity="0.85"/></svg>`,
  elo:        `<svg width="36" height="22" viewBox="0 0 36 22" style="vertical-align:middle;border-radius:3px"><rect width="36" height="22" rx="3" fill="#FFD700"/><text x="18" y="15" text-anchor="middle" fill="#003087" font-family="Arial,sans-serif" font-size="9" font-weight="bold">elo</text></svg>`,
  amex:       `<svg width="36" height="22" viewBox="0 0 36 22" style="vertical-align:middle;border-radius:3px"><rect width="36" height="22" rx="3" fill="#007BC1"/><text x="18" y="15" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="8" font-weight="bold">AMEX</text></svg>`,
  hipercard:  `<svg width="36" height="22" viewBox="0 0 36 22" style="vertical-align:middle;border-radius:3px"><rect width="36" height="22" rx="3" fill="#B31B1B"/><text x="18" y="15" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="7" font-weight="bold">Hipercard</text></svg>`,
  diners:     `<svg width="36" height="22" viewBox="0 0 36 22" style="vertical-align:middle;border-radius:3px"><rect width="36" height="22" rx="3" fill="#00416A"/><text x="18" y="15" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="8" font-weight="bold">Diners</text></svg>`,
  other:      `<svg width="36" height="22" viewBox="0 0 36 22" style="vertical-align:middle;border-radius:3px"><rect width="36" height="22" rx="3" fill="#555"/><text x="18" y="15" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="8">card</text></svg>`,
}

function cardBankLogoHTML(b, size = 24) {
  if (!b || b.code === 'other' || b.code === '000') {
    return `<span style="font-size:${Math.round(size * 0.7)}px;line-height:${size}px">${b?.emoji || '🏦'}</span>`
  }
  const color = b.color || '#6B7280'
  const letter = (b.name || '?').charAt(0).toUpperCase()
  const lightBg = ['#F8D000','#FFD93D','#FDC300','#F5C400','#F9CC1B'].includes(color)
  const textColor = lightBg ? '#000' : '#fff'
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${color};color:${textColor};font-weight:700;font-size:${Math.round(size * 0.42)}px;font-family:sans-serif;flex-shrink:0;letter-spacing:-0.5px">${letter}</span>`
}

function buildCardBankDropdownHTML(containerId, selectedCode = '') {
  const sel = BANKS.find(b => b.code === selectedCode) || { code: '', name: 'Selecione...', emoji: '🏦', color: '#888' }
  const items = BANKS.map(b => `
    <div class="bank-dd-item" data-name="${b.name.toLowerCase()}" onclick="window.__selectCardBank('${containerId}','${b.code}','${b.name.replace(/'/g,"\\'")}')">
      ${cardBankLogoHTML(b)}<span>${b.name}</span>
    </div>`).join('')
  return `
    <div class="bank-dd" id="${containerId}-wrap" style="position:relative">
      <div class="bank-dd-trigger form-control" id="${containerId}-trigger" onclick="window.__toggleCardDD('${containerId}')" style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none">
        <span id="${containerId}-icon" style="display:flex;align-items:center">${cardBankLogoHTML(sel)}</span>
        <span id="${containerId}-label" style="flex:1">${sel.name}</span>
        <span style="color:var(--color-text-muted);font-size:10px">▾</span>
      </div>
      <div id="${containerId}-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:1000;background:var(--color-card);border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:0 8px 24px rgba(0,0,0,0.2)">
        <div style="padding:8px;border-bottom:1px solid var(--color-border)">
          <input type="text" placeholder="Buscar banco..." class="form-control" style="padding:6px 10px;font-size:13px" oninput="window.__filterCardDD('${containerId}',this.value)" onclick="event.stopPropagation()">
        </div>
        <div id="${containerId}-list" style="max-height:180px;overflow-y:auto">${items}</div>
      </div>
      <input type="hidden" id="${containerId}" value="${selectedCode}">
    </div>`
}

function buildCardFlagDropdownHTML(containerId, selectedId = 'other') {
  const sel = FLAG_META.find(f => f.id === selectedId) || FLAG_META[FLAG_META.length - 1]
  const items = FLAG_META.map(f => `
    <div class="bank-dd-item" onclick="window.__selectCardFlag('${containerId}','${f.id}','${f.name.replace(/'/g,"\\'")}')">
      ${FLAG_SVG[f.id] || f.emoji}<span style="margin-left:8px">${f.name}</span>
    </div>`).join('')
  return `
    <div class="bank-dd" id="${containerId}-wrap" style="position:relative">
      <div class="bank-dd-trigger form-control" id="${containerId}-trigger" onclick="window.__toggleCardDD('${containerId}')" style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none">
        <span id="${containerId}-icon">${FLAG_SVG[sel.id] || sel.emoji}</span>
        <span id="${containerId}-label" style="flex:1">${sel.name}</span>
        <span style="color:var(--color-text-muted);font-size:10px">▾</span>
      </div>
      <div id="${containerId}-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:1000;background:var(--color-card);border:1px solid var(--color-border);border-radius:var(--radius-md);max-height:220px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,0.2)">
        ${items}
      </div>
      <input type="hidden" id="${containerId}" value="${selectedId}">
    </div>`
}

window.__toggleCardDD = function(id) {
  const dd = document.getElementById(`${id}-dropdown`)
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none'
}
window.__filterCardDD = function(id, query) {
  const list = document.getElementById(`${id}-list`)
  if (!list) return
  const q = query.toLowerCase()
  list.querySelectorAll('.bank-dd-item').forEach(item => {
    item.style.display = !q || item.dataset.name.includes(q) ? 'flex' : 'none'
  })
}
window.__selectCardBank = function(id, code, name) {
  const bank = BANKS.find(b => b.code === code)
  const hidden = document.getElementById(id)
  const iconEl = document.getElementById(`${id}-icon`)
  const labelEl = document.getElementById(`${id}-label`)
  const dd = document.getElementById(`${id}-dropdown`)
  if (hidden) hidden.value = code
  if (iconEl && bank) iconEl.innerHTML = cardBankLogoHTML(bank)
  if (labelEl) labelEl.textContent = name
  if (dd) dd.style.display = 'none'
}
window.__selectCardFlag = function(id, flagId, name) {
  const hidden = document.getElementById(id)
  const iconEl = document.getElementById(`${id}-icon`)
  const labelEl = document.getElementById(`${id}-label`)
  const dd = document.getElementById(`${id}-dropdown`)
  if (hidden) hidden.value = flagId
  if (iconEl) iconEl.innerHTML = FLAG_SVG[flagId] || FLAG_META.find(f => f.id === flagId)?.emoji || '💳'
  if (labelEl) labelEl.textContent = name
  if (dd) dd.style.display = 'none'
}

export async function render(el) {
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <div style="padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div class="tabs" style="border:none">
          <div class="tab active" data-cards-tab="cards">Cartões</div>
          <div class="tab" data-cards-tab="invoices">Faturas</div>
        </div>
        <button class="btn btn-primary btn-sm" id="newCardBtn">+ Novo cartão</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:var(--space-5)" id="cardsBody"></div>
      <div class="summary-bar" id="cardsSummaryBar"></div>
    </div>
  `

  el.querySelector('#newCardBtn')?.addEventListener('click', () => openCardModal())
  el.querySelectorAll('[data-cards-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      el.querySelectorAll('[data-cards-tab]').forEach(t => t.classList.toggle('active', t === tab))
      if (tab.dataset.cardsTab === 'cards') loadCards()
      else loadInvoices()
    })
  })

  await loadCards()
  // Expõe loadCards globalmente para que o modal de transação possa recarregar os cartões após salvar
  window.__reloadCards = loadCards
  el.addEventListener('__cleanup', () => { window.__reloadCards = null }, { once: true })
}

async function loadCards() {
  const body = document.getElementById('cardsBody')
  if (!body) return
  body.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">' + skeletons(3) + '</div>'
  try {
    const cards = await endpoints.cardInvoices({ month: store.getMonth() })
    store.set('creditCards', cards)
    renderCards(body, cards)
    renderCardsSummaryBar(cards)
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Erro</div><p class="empty-state-msg">${e.message}</p></div>`
  }
}

function renderCards(el, cards) {
  if (!cards?.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💳</div><div class="empty-state-title">Nenhum cartão</div><p class="empty-state-msg">Adicione seu primeiro cartão de crédito</p></div>`
    return
  }

  el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">${cards.map(c => cardWidget(c)).join('')}</div>`

  el.querySelectorAll('[data-card-id]').forEach(w => {
    w.querySelector('[data-card-edit]')?.addEventListener('click', () => openCardModal(w.dataset.cardId))
    w.querySelector('[data-card-pay]')?.addEventListener('click', () => openPaymentModal(w.dataset.cardId))
    w.querySelector('[data-card-new-tx]')?.addEventListener('click', () => window.openNewTransaction?.({ type: 'expense_card', credit_card_id: w.dataset.cardId }))
    w.querySelector('[data-card-delete]')?.addEventListener('click', () => deleteCard(w.dataset.cardId, w.dataset.cardName))
  })
}

function cardWidget(card) {
  const currentInvoice = card.invoices?.find(i => i.month === store.getMonth())
  const pctUsed = card.limit_amount > 0 ? Math.min(100, (currentInvoice?.total_amount || 0) / card.limit_amount * 100) : 0
  const barClass = pctUsed >= 90 ? 'danger' : pctUsed >= 70 ? 'warning' : ''

  const statusMap = { open: { label: 'Aberta', color: 'var(--color-yellow)', icon: '🟡' }, closed: { label: 'Fechada', color: 'var(--color-red)', icon: '🔴' }, paid: { label: 'Paga', color: 'var(--color-green)', icon: '✅' } }
  const invoiceStatus = statusMap[currentInvoice?.status || 'open']

  return `
    <div class="card card-interactive" data-card-id="${card.id}" data-card-name="${card.name}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:10px;height:10px;border-radius:50%;background:${card.color}"></div>
          <div>
            <div style="font-size:var(--text-base);font-weight:600">${card.name}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:2px">
              ${FLAG_SVG[card.flag] || FLAG_META.find(f => f.id === card.flag)?.emoji || '💳'}
              ${card.last_digits ? `<span style="font-size:var(--text-xs);color:var(--color-text-soft);font-family:var(--font-mono)">•••• ${card.last_digits}</span>` : ''}
              ${card.bank_name ? `<span style="font-size:var(--text-xs);color:var(--color-text-soft)">· ${card.bank_name}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-icon btn-sm" data-card-edit title="Editar">✏️</button>
          <button class="btn btn-icon btn-sm" data-card-delete title="Excluir cartão" style="color:var(--color-red)">🗑️</button>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <div><div class="text-xs text-soft">Limite total</div><div class="text-mono text-sm font-bold">${fmt.currency(card.limit_amount)}</div></div>
        <div style="text-align:right"><div class="text-xs text-soft">Disponível</div><div class="text-mono text-sm font-bold value-positive">${fmt.currency(card.available_limit)}</div></div>
      </div>

      <div class="progress-bar" style="margin-bottom:8px"><div class="progress-bar-fill ${barClass}" style="width:${pctUsed}%"></div></div>
      <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:12px">${fmt.percent(pctUsed)} do limite usado</div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--color-bg);border-radius:var(--radius-md)">
        <div>
          <div class="text-xs text-soft">Fatura atual (${fmt.monthShort(store.getMonth())})</div>
          <div class="text-mono font-bold value-negative">${fmt.currency(currentInvoice?.total_amount || 0)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:12px">${invoiceStatus.icon}</span>
          <span style="font-size:var(--text-xs);color:${invoiceStatus.color}">${invoiceStatus.label}</span>
        </div>
      </div>

      <div style="margin-top:10px;display:flex;gap:8px">
        <div style="font-size:var(--text-xs);color:var(--color-text-soft)">Fecha dia ${card.closing_day} · Vence dia ${card.due_day}</div>
      </div>

      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm flex-1" data-card-new-tx>+ Lançamento</button>
        <button class="btn btn-sm" style="background:var(--color-green-dim);color:var(--color-green)" data-card-pay>💳 Pagar</button>
      </div>
    </div>
  `
}

async function loadInvoices() {
  const body = document.getElementById('cardsBody')
  if (!body) return
  body.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Histórico de faturas</div><p class="empty-state-msg">Selecione um cartão para ver as faturas</p></div>'
}

function renderCardsSummaryBar(cards) {
  const bar = document.getElementById('cardsSummaryBar')
  if (!bar) return
  const totalLimit = cards.reduce((s,c) => s + Number(c.limit_amount), 0)
  const currentMonth = store.getMonth()
  const totalInvoice = cards.reduce((s,c) => s + (c.invoices?.find(i => i.month === currentMonth)?.total_amount || 0), 0)
  const available = totalLimit - totalInvoice
  bar.innerHTML = `
    <div class="summary-bar-item"><span class="summary-bar-label">Limite total</span><span class="summary-bar-value text-mono">${fmt.currency(totalLimit)}</span></div>
    <div class="summary-bar-sep"></div>
    <div class="summary-bar-item"><span class="summary-bar-label">Fatura total</span><span class="summary-bar-value value-negative text-mono">${fmt.currency(totalInvoice)}</span></div>
    <div class="summary-bar-sep"></div>
    <div class="summary-bar-item"><span class="summary-bar-label">Disponível</span><span class="summary-bar-value value-positive text-mono">${fmt.currency(available)}</span></div>
  `
}

function openCardModal(id) {
  const cards = store.get('creditCards') || []
  const accounts = store.get('accounts') || []
  const card = id ? cards.find(c => c.id === id) : null

  const cardBankDropdown = buildCardBankDropdownHTML('cardBank', card?.bank_code || '')
  const cardFlagDropdown = buildCardFlagDropdownHTML('cardFlag', card?.flag || 'other')
  const accOptions = accounts.map(a => `<option value="${a.id}" ${card?.account_id === a.id ? 'selected' : ''}>${a.name}</option>`).join('')
  const days = Array.from({length:31},(_,i)=>`<option value="${i+1}" ${(card?.closing_day || 10) === i+1 ? 'selected' : ''}>${i+1}</option>`).join('')
  const dueDays = Array.from({length:31},(_,i)=>`<option value="${i+1}" ${(card?.due_day || 20) === i+1 ? 'selected' : ''}>${i+1}</option>`).join('')

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h3 class="modal-title">${card ? 'Editar cartão' : 'Novo cartão'}</h3>
        <button class="btn btn-icon" id="cardModalClose">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label required">Nome do cartão</label><input id="cardName" class="form-control" value="${card?.name || ''}" placeholder="Ex: Nubank Gold"></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Bandeira</label>${cardFlagDropdown}</div>
          <div class="form-group"><label class="form-label">Banco</label>${cardBankDropdown}</div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label required">Limite</label><input id="cardLimit" class="form-control" type="number" step="0.01" value="${card?.limit_amount || ''}" placeholder="0,00"></div>
          <div class="form-group"><label class="form-label">4 últimos dígitos</label><input id="cardLastDigits" class="form-control" maxlength="4" inputmode="numeric" value="${card?.last_digits || ''}" placeholder="0000"></div>
        </div>
        <div class="form-group"><label class="form-label">Saldo de abertura da fatura</label><input id="cardOpeningBalance" class="form-control" type="number" step="0.01" value="${card?.opening_balance || ''}" placeholder="0,00"><div class="form-hint">Valor já lançado antes de começar a usar o app</div></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label required">Fecha dia</label><select id="cardClosing" class="form-control">${days}</select></div>
          <div class="form-group"><label class="form-label required">Vence dia</label><select id="cardDue" class="form-control">${dueDays}</select></div>
        </div>
        <div class="form-group"><label class="form-label">Conta vinculada</label><select id="cardAccount" class="form-control"><option value="">Nenhuma</option>${accOptions}</select><div class="form-hint">Vincular uma conta melhora a previsão de saldo</div></div>
        <label class="toggle-group"><div><div class="toggle-label">Fechamento dinâmico</div><div class="toggle-sub">Ajusta automaticamente quando cai em fim de semana</div></div><label class="toggle"><input type="checkbox" id="cardDynamic" ${card?.dynamic_closing ? 'checked' : ''}><span class="toggle-track"></span></label></label>
        <label class="toggle-group"><div><div class="toggle-label">Vencimento em dias úteis</div></div><label class="toggle"><input type="checkbox" id="cardBizDay" ${card?.due_on_business_day ? 'checked' : ''}><span class="toggle-track"></span></label></label>
        <label class="toggle-group"><div><div class="toggle-label">Cartão principal</div></div><label class="toggle"><input type="checkbox" id="cardMain" ${card?.is_main ? 'checked' : ''}><span class="toggle-track"></span></label></label>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="cardModalCancel">Cancelar</button>
        <button class="btn btn-primary" id="cardModalSave">${card ? 'Salvar' : 'Criar cartão'}</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))

  const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300) }
  overlay.querySelector('#cardModalClose')?.addEventListener('click', close)
  overlay.querySelector('#cardModalCancel')?.addEventListener('click', close)
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { close(); return }
    if (!e.target.closest('.bank-dd')) {
      overlay.querySelectorAll('.bank-dd [id$="-dropdown"]').forEach(d => d.style.display = 'none')
    }
  })

  overlay.querySelector('#cardModalSave')?.addEventListener('click', async (e) => {
    const name = overlay.querySelector('#cardName')?.value?.trim()
    const limit = Number(overlay.querySelector('#cardLimit')?.value)
    const closing = Number(overlay.querySelector('#cardClosing')?.value)
    const due = Number(overlay.querySelector('#cardDue')?.value)

    if (!name) { Toast.error('Informe o nome do cartão'); return }
    if (!limit || limit <= 0) { Toast.error('Informe o limite'); return }
    if (!closing || !due) { Toast.error('Informe os dias de fechamento e vencimento'); return }

    const bankCode = overlay.querySelector('#cardBank')?.value
    const bank = BANKS.find(b => b.code === bankCode)

    const payload = {
      name, limit_amount: limit, closing_day: closing, due_day: due,
      flag: overlay.querySelector('#cardFlag')?.value || 'other',
      bank_code: bankCode || null, bank_name: bank?.name || null,
      account_id: overlay.querySelector('#cardAccount')?.value || null,
      dynamic_closing: overlay.querySelector('#cardDynamic')?.checked || false,
      due_on_business_day: overlay.querySelector('#cardBizDay')?.checked || false,
      is_main: overlay.querySelector('#cardMain')?.checked || false,
      last_digits: overlay.querySelector('#cardLastDigits')?.value?.trim() || null,
      opening_balance: Number(overlay.querySelector('#cardOpeningBalance')?.value) || 0,
    }

    Loading.btn(e.target, true)
    try {
      if (card) await endpoints.updateCard(card.id, payload)
      else await endpoints.createCard(payload)
      Toast.success(card ? 'Cartão atualizado' : 'Cartão criado')
      close()
      loadCards()
    } catch (err) { Toast.error(err.message); Loading.btn(e.target, false) }
  })
}

async function deleteCard(id, name) {
  const ok = await Confirm.delete(name || 'este cartão')
  if (!ok) return
  try {
    await endpoints.deleteCard(id)
    Toast.success('Cartão removido')
    loadCards()
  } catch (e) { Toast.error(e.message) }
}

function openPaymentModal(cardId) {
  const accounts = store.get('accounts') || []
  const accOptions = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width:400px">
      <div class="modal-header"><h3 class="modal-title">Registrar pagamento</h3><button class="btn btn-icon" id="payClose">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Referência</label><input id="payMonth" class="form-control" type="month" value="${store.getMonth()}"></div>
        <div class="form-group"><label class="form-label">Valor pago</label><input id="payAmount" class="form-control" type="number" step="0.01" placeholder="0,00"></div>
        <div class="form-group"><label class="form-label">Conta debitada</label><select id="payAccount" class="form-control"><option value="">Selecione...</option>${accOptions}</select></div>
        <div class="form-group"><label class="form-label">Data do pagamento</label><input id="payDate" class="form-control" type="date" value="${date.today()}"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="payCancel">Cancelar</button>
        <button class="btn btn-primary" id="paySave">Registrar pagamento</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))

  const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300) }
  overlay.querySelector('#payClose')?.addEventListener('click', close)
  overlay.querySelector('#payCancel')?.addEventListener('click', close)

  overlay.querySelector('#paySave')?.addEventListener('click', async (e) => {
    const amount = Number(overlay.querySelector('#payAmount')?.value)
    if (!amount) { Toast.error('Informe o valor'); return }
    Loading.btn(e.target, true)
    try {
      await endpoints.payInvoice({
        card_id: cardId,
        reference_month: overlay.querySelector('#payMonth')?.value,
        amount,
        payment_account_id: overlay.querySelector('#payAccount')?.value || null,
        payment_date: overlay.querySelector('#payDate')?.value,
      })
      Toast.success('Pagamento registrado')
      close()
      loadCards()
    } catch (err) { Toast.error(err.message); Loading.btn(e.target, false) }
  })
}

function skeletons(n) {
  return Array(n).fill(`<div class="skeleton" style="height:240px;border-radius:16px"></div>`).join('')
}
