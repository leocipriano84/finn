// SPA Router simples — hash-based
import { store } from './store.js'

const routes = {}
let currentPage = null
let contentEl = null

export const router = {
  init(containerEl) {
    contentEl = containerEl
    window.addEventListener('hashchange', handleRoute)
    handleRoute()
  },

  register(page, loader) {
    routes[page] = loader
  },

  navigate(page, params = {}) {
    const hash = params && Object.keys(params).length
      ? `#${page}?${new URLSearchParams(params)}`
      : `#${page}`
    window.location.hash = hash
  },

  current() {
    return currentPage
  },

  getParams() {
    const hash = window.location.hash.slice(1)
    const [, qs] = hash.split('?')
    if (!qs) return {}
    return Object.fromEntries(new URLSearchParams(qs))
  }
}

async function handleRoute() {
  const hash = window.location.hash.slice(1) || 'dashboard'
  const [page] = hash.split('?')

  if (page === currentPage) return
  currentPage = page
  store.setPage(page)

  // Atualiza sidebar ativa
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page)
  })
  document.querySelectorAll('.bottom-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page)
  })

  if (!contentEl) return

  const loader = routes[page]
  if (!loader) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🗺️</div>
        <div class="empty-state-title">Página não encontrada</div>
        <p class="empty-state-msg">${page}</p>
      </div>
    `
    return
  }

  // Skeleton enquanto carrega
  contentEl.innerHTML = '<div style="padding:24px"><div class="skeleton skeleton-title mb-4" style="height:28px;width:40%"></div>' +
    Array(4).fill('<div class="skeleton" style="height:120px;border-radius:12px;margin-bottom:16px"></div>').join('') + '</div>'

  try {
    const mod = await loader()
    contentEl.innerHTML = ''
    const el = document.createElement('div')
    el.className = 'page-enter'
    el.style.cssText = 'height:100%;display:flex;flex-direction:column;'
    contentEl.appendChild(el)
    if (mod?.render) await mod.render(el)
    else if (typeof mod === 'function') await mod(el)
  } catch (e) {
    console.error(`Route error [${page}]:`, e)
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Erro ao carregar página</div>
        <p class="empty-state-msg">${e.message}</p>
      </div>
    `
  }
}
