// Toast notifications + confirmação + alerts
let toastContainer = null

function getContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container')
    if (!toastContainer) {
      toastContainer = document.createElement('div')
      toastContainer.id = 'toast-container'
      toastContainer.className = 'toast-container'
      document.body.appendChild(toastContainer)
    }
  }
  return toastContainer
}

const ICONS = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
}

export const Toast = {
  show(message, type = 'info', duration = 4000) {
    const container = getContainer()
    const el = document.createElement('div')
    el.className = `toast ${type}`
    el.innerHTML = `
      <span class="toast-icon">${ICONS[type]}</span>
      <span class="toast-msg">${message}</span>
      <span class="toast-close" onclick="this.closest('.toast').remove()">✕</span>
    `
    container.appendChild(el)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('show'))
    })

    setTimeout(() => {
      el.classList.remove('show')
      setTimeout(() => el.remove(), 300)
    }, duration)

    return el
  },
  success: (msg, dur) => Toast.show(msg, 'success', dur),
  error:   (msg, dur) => Toast.show(msg, 'error',   dur || 6000),
  warning: (msg, dur) => Toast.show(msg, 'warning', dur),
  info:    (msg, dur) => Toast.show(msg, 'info',    dur),
}

export const Confirm = {
  show(message, { title = 'Confirmar', confirmLabel = 'Confirmar', danger = false } = {}) {
    return new Promise(resolve => {
      const overlay = document.createElement('div')
      overlay.className = 'confirm-overlay'
      overlay.innerHTML = `
        <div class="confirm-box animate-scale-in">
          <div class="confirm-icon">${danger ? '⚠️' : '❓'}</div>
          <div class="confirm-title">${title}</div>
          <p class="confirm-msg">${message}</p>
          <div class="confirm-actions">
            <button class="btn btn-secondary" id="_confirmCancel">Cancelar</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="_confirmOk">${confirmLabel}</button>
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

      overlay.querySelector('#_confirmOk').addEventListener('click', () => close(true))
      overlay.querySelector('#_confirmCancel').addEventListener('click', () => close(false))
      overlay.addEventListener('click', e => { if (e.target === overlay) close(false) })
    })
  },
  delete: (what) => Confirm.show(
    `Tem certeza que deseja excluir "${what}"? Esta ação não pode ser desfeita.`,
    { title: 'Excluir', confirmLabel: 'Excluir', danger: true }
  )
}

export const Loading = {
  show(el) {
    if (!el) return
    el.setAttribute('data-loading', '1')
    el.style.position = 'relative'
    const overlay = document.createElement('div')
    overlay.className = 'loading-overlay'
    overlay.innerHTML = '<div class="spinner"></div>'
    overlay.style.cssText = 'position:absolute;inset:0;background:rgba(13,13,20,0.6);display:flex;align-items:center;justify-content:center;border-radius:inherit;z-index:10;'
    el.appendChild(overlay)
  },
  hide(el) {
    if (!el) return
    el.removeAttribute('data-loading')
    el.querySelector('.loading-overlay')?.remove()
  },
  btn(btn, loading = true) {
    if (loading) {
      btn.setAttribute('data-label', btn.textContent)
      btn.disabled = true
      btn.innerHTML = '<span class="spinner spinner-sm"></span>'
    } else {
      btn.disabled = false
      btn.textContent = btn.getAttribute('data-label') || btn.textContent
    }
  }
}
