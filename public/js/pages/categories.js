import { endpoints } from '../core/api.js'
import { store } from '../core/store.js'
import { COLORS } from '../core/utils.js'
import { Toast, Confirm, Loading } from '../core/notifications.js'

const EMOJIS = ['🏠','🍔','🚗','💊','🎓','👕','🎮','💰','🛒','👥','🔧','📱','✈️','🎵','🏋️','💼','💸','📈','🎁','🔖','🌟','💡','🎯','🏆','📊','🌍','🍕','☕','🛍️','🎪']

export async function render(el) {
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <div style="padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div class="tabs" style="border:none">
          <div class="tab active" data-cat-tab="expense">Despesas</div>
          <div class="tab" data-cat-tab="income">Receitas</div>
        </div>
        <button class="btn btn-primary btn-sm" id="newCatBtn">+ Nova categoria</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:var(--space-5)" id="catBody"></div>
    </div>
  `

  let currentTab = 'expense'

  el.querySelectorAll('[data-cat-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      el.querySelectorAll('[data-cat-tab]').forEach(t => t.classList.toggle('active', t === tab))
      currentTab = tab.dataset.catTab
      loadCategories(currentTab)
    })
  })

  el.querySelector('#newCatBtn')?.addEventListener('click', () => openCategoryModal(null, currentTab))

  await loadCategories('expense')
}

async function loadCategories(type) {
  const body = document.getElementById('catBody')
  if (!body) return
  body.innerHTML = '<div style="display:flex;flex-direction:column;gap:4px">' + Array(5).fill(`<div class="skeleton" style="height:52px;border-radius:12px"></div>`).join('') + '</div>'

  try {
    const all = await endpoints.categories()
    store.set('categories', all)
    const cats = all.filter(c => c.type === type || c.type === 'both')
    renderCategories(body, cats, type)
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${e.message}</p></div>`
  }
}

function renderCategories(el, cats, type) {
  if (!cats.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏷️</div>
        <div class="empty-state-title">Nenhuma categoria</div>
        <p class="empty-state-msg">Clique em "+ Nova categoria" ou <button class="btn btn-secondary btn-sm" onclick="seedCategories()">importar padrões</button></p>
      </div>
    `
    window.seedCategories = async () => {
      try { await endpoints.seedCategories(); Toast.success('Categorias padrão criadas'); loadCategories(type) }
      catch (e) { Toast.error(e.message) }
    }
    return
  }

  el.innerHTML = cats.map(cat => `
    <div class="card" style="margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:12px;cursor:pointer" data-cat-toggle="${cat.id}">
        <div style="width:36px;height:36px;border-radius:10px;background:${cat.color}22;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${cat.icon}</div>
        <div style="flex:1">
          <div style="font-size:var(--text-base);font-weight:500">${cat.name}</div>
          ${cat.children?.length ? `<div style="font-size:var(--text-xs);color:var(--color-text-soft)">${cat.children.length} subcategoria${cat.children.length !== 1 ? 's' : ''}</div>` : ''}
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-icon btn-sm" data-cat-sub="${cat.id}" title="Adicionar subcategoria">+</button>
          <button class="btn btn-icon btn-sm" data-cat-edit="${cat.id}" title="Editar">✏️</button>
          ${!cat.is_default ? `<button class="btn btn-icon btn-sm" data-cat-del="${cat.id}" title="Excluir">🗑️</button>` : ''}
        </div>
      </div>
      ${cat.children?.length ? `
        <div id="subs_${cat.id}" style="margin-top:8px;margin-left:48px;display:flex;flex-direction:column;gap:4px">
          ${cat.children.map(sub => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--color-border)">
              <span style="font-size:12px">└</span>
              <span style="font-size:var(--text-sm);flex:1">${sub.name}</span>
              <button class="btn btn-icon btn-sm" data-cat-edit="${sub.id}" style="font-size:11px;padding:3px 6px">✏️</button>
              ${!sub.is_default ? `<button class="btn btn-icon btn-sm" data-cat-del="${sub.id}" style="font-size:11px;padding:3px 6px">🗑️</button>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `).join('')

  el.querySelectorAll('[data-cat-edit]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      openCategoryModal(btn.dataset.catEdit, type)
    })
  })

  el.querySelectorAll('[data-cat-del]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation()
      const ok = await Confirm.delete('esta categoria')
      if (!ok) return
      try { await endpoints.deleteCategory(btn.dataset.catDel); Toast.success('Categoria removida'); loadCategories(type) }
      catch (err) { Toast.error(err.message) }
    })
  })

  el.querySelectorAll('[data-cat-sub]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      openCategoryModal(null, type, btn.dataset.catSub)
    })
  })
}

function openCategoryModal(id, type = 'expense', parentId = null) {
  const all = store.get('categories') || []
  const flatAll = all.flatMap(c => [c, ...(c.children || [])])
  const cat = id ? flatAll.find(c => c.id === id) : null

  const emojiPicker = EMOJIS.map(e => `<span style="cursor:pointer;font-size:20px;padding:4px;border-radius:6px" data-emoji="${e}" class="emoji-opt">${e}</span>`).join('')
  const colorSwatches = COLORS.map(c => `<div class="color-swatch ${(cat?.color || COLORS[0]) === c ? 'selected' : ''}" style="background:${c}" data-color="${c}"></div>`).join('')
  const rootCats = all.filter(c => c.type === type || c.type === 'both')
  const parentOptions = rootCats.filter(c => !c.parent_id).map(c => `<option value="${c.id}" ${(cat?.parent_id || parentId) === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-header"><h3 class="modal-title">${cat ? 'Editar categoria' : 'Nova categoria'}</h3><button class="btn btn-icon" id="catModalClose">✕</button></div>
      <div class="modal-body">
        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--color-bg);border-radius:12px;margin-bottom:4px">
          <div id="catPreviewIcon" style="width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;background:${cat?.color || COLORS[0]}22">${cat?.icon || EMOJIS[0]}</div>
          <div><input id="catIcon" type="hidden" value="${cat?.icon || EMOJIS[0]}"><div style="font-size:var(--text-sm);font-weight:600" id="catPreviewName">${cat?.name || 'Nova categoria'}</div><div style="font-size:var(--text-xs);color:var(--color-text-soft)">${type === 'expense' ? 'Despesa' : 'Receita'}</div></div>
        </div>
        <div class="form-group"><label class="form-label required">Nome</label><input id="catName" class="form-control" value="${cat?.name || ''}" placeholder="Nome da categoria"></div>
        <div class="form-group"><label class="form-label">Subcategoria de</label><select id="catParent" class="form-control"><option value="">Categoria raiz</option>${parentOptions}</select></div>
        <div class="form-group"><label class="form-label">Ícone</label><div style="display:flex;flex-wrap:wrap;gap:2px;max-height:100px;overflow-y:auto">${emojiPicker}</div></div>
        <div class="form-group"><label class="form-label">Cor</label><div class="color-picker" id="catColorPicker">${colorSwatches}</div><input type="hidden" id="catColor" value="${cat?.color || COLORS[0]}"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="catModalCancel">Cancelar</button>
        <button class="btn btn-primary" id="catModalSave">${cat ? 'Salvar' : 'Criar'}</button>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))

  const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300) }
  overlay.querySelector('#catModalClose')?.addEventListener('click', close)
  overlay.querySelector('#catModalCancel')?.addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  // Preview em tempo real
  overlay.querySelector('#catName')?.addEventListener('input', e => {
    document.getElementById('catPreviewName').textContent = e.target.value || 'Nova categoria'
  })

  // Emoji picker
  overlay.querySelectorAll('.emoji-opt').forEach(em => {
    em.addEventListener('click', () => {
      overlay.querySelector('#catIcon').value = em.dataset.emoji
      document.getElementById('catPreviewIcon').textContent = em.dataset.emoji
      overlay.querySelectorAll('.emoji-opt').forEach(e => e.style.background = '')
      em.style.background = 'var(--color-green-dim)'
    })
  })

  // Color picker
  overlay.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      overlay.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'))
      sw.classList.add('selected')
      overlay.querySelector('#catColor').value = sw.dataset.color
      document.getElementById('catPreviewIcon').style.background = sw.dataset.color + '22'
    })
  })

  overlay.querySelector('#catModalSave')?.addEventListener('click', async (e) => {
    const name = overlay.querySelector('#catName')?.value?.trim()
    if (!name) { Toast.error('Informe o nome'); return }

    const payload = {
      name, type,
      icon: overlay.querySelector('#catIcon')?.value || '📦',
      color: overlay.querySelector('#catColor')?.value || COLORS[0],
      parent_id: overlay.querySelector('#catParent')?.value || null,
    }

    Loading.btn(e.target, true)
    try {
      if (cat) await endpoints.updateCategory(cat.id, payload)
      else await endpoints.createCategory(payload)
      Toast.success(cat ? 'Categoria atualizada' : 'Categoria criada')
      close()
      loadCategories(type)
    } catch (err) { Toast.error(err.message); Loading.btn(e.target, false) }
  })
}
