import { endpoints } from '../core/api.js'
import { fmt, COLORS } from '../core/utils.js'
import { Toast, Confirm, Loading } from '../core/notifications.js'

let goalsData = []

export async function render(el) {
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <div style="padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <span class="text-soft text-sm" id="goalsCount"></span>
        <button class="btn btn-primary btn-sm" id="newGoalBtn">+ Nova meta</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:var(--space-5)" id="goalsBody"></div>
    </div>
  `
  el.querySelector('#newGoalBtn')?.addEventListener('click', () => openGoalModal())
  await loadGoals()
}

async function loadGoals() {
  const body = document.getElementById('goalsBody')
  const countEl = document.getElementById('goalsCount')
  if (!body) return
  body.innerHTML = Array(3).fill('<div class="skeleton" style="height:140px;border-radius:16px;margin-bottom:12px"></div>').join('')
  try {
    const goals = await endpoints.goals()
    goalsData = goals
    if (countEl) countEl.textContent = `${goals.length} meta${goals.length !== 1 ? 's' : ''}`
    renderGoals(body, goals)
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${e.message}</p></div>`
  }
}

function renderGoals(el, goals) {
  if (!goals.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎯</div><div class="empty-state-title">Nenhuma meta</div><p class="empty-state-msg">Defina objetivos financeiros para se manter motivado</p></div>`
    return
  }

  const active = goals.filter(g => !g.completed)
  const done   = goals.filter(g => g.completed)

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:var(--space-4)">
      ${[...active, ...done].map(g => goalCard(g)).join('')}
    </div>
  `

  el.querySelectorAll('[data-goal-id]').forEach(card => {
    card.querySelector('[data-goal-deposit]')?.addEventListener('click', () => openDepositModal(card.dataset.goalId))
    card.querySelector('[data-goal-edit]')?.addEventListener('click', () => openGoalModal(card.dataset.goalId))
    card.querySelector('[data-goal-del]')?.addEventListener('click', async () => {
      const ok = await Confirm.delete('esta meta')
      if (!ok) return
      try { await endpoints.deleteGoal(card.dataset.goalId); Toast.success('Meta excluída'); loadGoals() }
      catch (e) { Toast.error(e.message) }
    })
  })
}

function goalCard(g) {
  const color = g.color || '#00F5A0'
  const daysLeft = g.deadline ? Math.max(0, Math.ceil((new Date(g.deadline) - new Date()) / 86400000)) : null

  return `
    <div class="card ${g.completed ? '' : 'card-interactive'}" data-goal-id="${g.id}" style="${g.completed ? 'opacity:0.7' : ''}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:44px;height:44px;border-radius:12px;background:${color}22;border:2px solid ${color}44;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">
            ${g.icon || '🎯'}
          </div>
          <div>
            <div style="font-size:var(--text-base);font-weight:600">${g.title}</div>
            ${g.deadline ? `<div style="font-size:var(--text-xs);color:var(--color-text-soft)">${daysLeft === 0 ? 'Prazo hoje!' : daysLeft > 0 ? `${daysLeft} dias restantes` : 'Prazo vencido'}</div>` : ''}
          </div>
        </div>
        ${g.completed ? '<div class="badge badge-green">✅ Concluída</div>' : ''}
      </div>

      <!-- Progresso -->
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:var(--text-sm);font-family:var(--font-mono);font-weight:700;color:${color}">${fmt.currency(g.current_amount)}</span>
          <span style="font-size:var(--text-sm);font-family:var(--font-mono);color:var(--color-text-soft)">${fmt.currency(g.target_amount)}</span>
        </div>
        <div class="progress-bar" style="height:8px">
          <div class="progress-bar-fill" style="width:${g.progress_pct}%;background:${color};transition:width 0.8s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span style="font-size:var(--text-xs);color:var(--color-text-soft)">${fmt.percent(g.progress_pct)} concluído</span>
          <span style="font-size:var(--text-xs);color:var(--color-text-soft)">Falta ${fmt.currency(g.remaining)}</span>
        </div>
      </div>

      ${g.monthly_suggestion ? `<div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:10px">Sugestão: poupar ${fmt.currency(g.monthly_suggestion)}/mês</div>` : ''}

      ${!g.completed ? `
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm flex-1" data-goal-deposit>+ Depositar</button>
          <button class="btn btn-icon btn-sm" data-goal-edit>✏️</button>
          <button class="btn btn-icon btn-sm" data-goal-del>🗑️</button>
        </div>
      ` : ''}
    </div>
  `
}

function openGoalModal(id) {
  const goal = id ? goalsData.find(g => g.id === id) : null
  const currentColor = goal?.color || COLORS[0]

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-header"><h3 class="modal-title">${id ? 'Editar meta' : 'Nova meta'}</h3><button class="btn btn-icon" id="gModalClose">✕</button></div>
      <div class="modal-body">
        <div style="text-align:center;margin-bottom:12px">
          <div id="gIconPreview" style="font-size:40px;cursor:pointer" title="Clique para mudar">${goal?.icon || '🎯'}</div>
          <input type="hidden" id="gIcon" value="${goal?.icon || '🎯'}">
        </div>
        <div class="form-group"><label class="form-label required">Nome da meta</label><input id="gTitle" class="form-control" placeholder="Ex: Viagem para Europa" value="${goal?.title || ''}"></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label required">Valor alvo</label><input id="gTarget" class="form-control" type="number" step="0.01" placeholder="0,00" value="${goal?.target_amount || ''}"></div>
          <div class="form-group"><label class="form-label">Já tenho</label><input id="gCurrent" class="form-control" type="number" step="0.01" value="${goal?.current_amount || 0}"></div>
        </div>
        <div class="form-group"><label class="form-label">Prazo</label><input id="gDeadline" class="form-control" type="date" value="${goal?.deadline || ''}"></div>
        <div class="form-group"><label class="form-label">Cor</label>
          <div class="color-picker">${COLORS.map(c => `<div class="color-swatch ${c === currentColor ? 'selected' : ''}" style="background:${c}" data-color="${c}"></div>`).join('')}</div>
          <input type="hidden" id="gColor" value="${currentColor}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="gModalCancel">Cancelar</button>
        <button class="btn btn-primary" id="gModalSave">${id ? 'Salvar' : 'Criar meta'}</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))

  const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300) }
  overlay.querySelector('#gModalClose')?.addEventListener('click', close)
  overlay.querySelector('#gModalCancel')?.addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  overlay.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      overlay.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'))
      sw.classList.add('selected')
      overlay.querySelector('#gColor').value = sw.dataset.color
    })
  })

  overlay.querySelector('#gModalSave')?.addEventListener('click', async (e) => {
    const title = overlay.querySelector('#gTitle')?.value?.trim()
    const target = Number(overlay.querySelector('#gTarget')?.value)
    if (!title) { Toast.error('Informe o nome'); return }
    if (!target || target <= 0) { Toast.error('Informe o valor alvo'); return }

    Loading.btn(e.target, true)
    try {
      const payload = { title, target_amount: target, current_amount: Number(overlay.querySelector('#gCurrent')?.value) || 0, deadline: overlay.querySelector('#gDeadline')?.value || null, icon: overlay.querySelector('#gIcon')?.value || '🎯', color: overlay.querySelector('#gColor')?.value || '#00F5A0' }
      if (id) await endpoints.updateGoal(id, payload)
      else await endpoints.createGoal(payload)
      Toast.success(id ? 'Meta atualizada' : 'Meta criada')
      close(); loadGoals()
    } catch (err) { Toast.error(err.message); Loading.btn(e.target, false) }
  })
}

function openDepositModal(goalId) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width:360px">
      <div class="modal-header"><h3 class="modal-title">Depositar na meta</h3><button class="btn btn-icon" id="dClose">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label required">Valor a depositar</label>
          <div class="form-control-value"><span class="currency-prefix">R$</span><input id="dAmount" type="number" step="0.01" min="0.01" placeholder="0,00" required></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="dCancel">Cancelar</button>
        <button class="btn btn-primary" id="dSave">Depositar</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))
  const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300) }
  overlay.querySelector('#dClose')?.addEventListener('click', close)
  overlay.querySelector('#dCancel')?.addEventListener('click', close)
  overlay.querySelector('#dSave')?.addEventListener('click', async (e) => {
    const amount = Number(overlay.querySelector('#dAmount')?.value)
    if (!amount || amount <= 0) { Toast.error('Informe o valor'); return }
    Loading.btn(e.target, true)
    try { await endpoints.depositGoal({ goal_id: goalId, amount }); Toast.success('Depósito registrado'); close(); loadGoals() }
    catch (err) { Toast.error(err.message); Loading.btn(e.target, false) }
  })
}
