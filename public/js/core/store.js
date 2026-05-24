// Estado global simples — sem framework
// Subscribers recebem (newState, oldState, key)

const state = {
  user: null,
  session: null,
  preferences: null,
  currentMonth: (() => {
    try { const s = localStorage.getItem('finn_month'); if (s && /^\d{4}-\d{2}$/.test(s)) return s } catch {}
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })(),
  accounts: [],
  creditCards: [],
  categories: [],
  transactions: [],
  page: 'dashboard',
}

const subscribers = {}

export const store = {
  get(key) {
    return key ? state[key] : { ...state }
  },

  set(key, value) {
    const old = state[key]
    state[key] = value
    notify(key, value, old)
    return value
  },

  update(key, updater) {
    const old = state[key]
    const next = updater(old)
    state[key] = next
    notify(key, next, old)
    return next
  },

  subscribe(key, fn) {
    if (!subscribers[key]) subscribers[key] = []
    subscribers[key].push(fn)
    return () => {
      subscribers[key] = subscribers[key].filter(f => f !== fn)
    }
  },

  // Atalhos comuns
  getUser()   { return state.user },
  getMonth()  { return state.currentMonth },
  setMonth(m) { try { localStorage.setItem('finn_month', m) } catch {}; return store.set('currentMonth', m) },
  getPage()   { return state.page },
  setPage(p)  { return store.set('page', p) },
}

function notify(key, newVal, oldVal) {
  const fns = subscribers[key] || []
  fns.forEach(fn => fn(newVal, oldVal, key))
  const allFns = subscribers['*'] || []
  allFns.forEach(fn => fn(newVal, oldVal, key))
}

// Cache simples no localStorage (5 minutos TTL)
export const cache = {
  set(key, data, ttlMs = 5 * 60 * 1000) {
    try {
      localStorage.setItem(`finn_cache_${key}`, JSON.stringify({
        data,
        exp: Date.now() + ttlMs
      }))
    } catch {}
  },
  get(key) {
    try {
      const raw = localStorage.getItem(`finn_cache_${key}`)
      if (!raw) return null
      const { data, exp } = JSON.parse(raw)
      if (Date.now() > exp) {
        localStorage.removeItem(`finn_cache_${key}`)
        return null
      }
      return data
    } catch { return null }
  },
  clear(key) {
    if (key) {
      localStorage.removeItem(`finn_cache_${key}`)
    } else {
      Object.keys(localStorage)
        .filter(k => k.startsWith('finn_cache_'))
        .forEach(k => localStorage.removeItem(k))
    }
  }
}
