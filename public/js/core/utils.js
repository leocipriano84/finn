// Formatação de moeda
export const fmt = {
  currency(value, compact = false) {
    const n = Number(value) || 0
    if (compact && Math.abs(n) >= 1000) {
      const k = n / 1000
      return `R$ ${k.toFixed(1).replace('.', ',')} mil`
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
  },
  currencySign(value) {
    const n = Number(value) || 0
    const formatted = fmt.currency(Math.abs(n))
    return n < 0 ? `- ${formatted}` : formatted
  },
  number(value) {
    return new Intl.NumberFormat('pt-BR').format(Number(value) || 0)
  },
  percent(value, decimals = 1) {
    return `${(Number(value) || 0).toFixed(decimals).replace('.', ',')}%`
  },
  date(dateStr, format = 'short') {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    if (isNaN(d)) return ''
    if (format === 'short') return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    if (format === 'medium') return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    if (format === 'long') return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    if (format === 'monthYear') return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    if (format === 'monthShort') return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    return d.toLocaleDateString('pt-BR')
  },
  dayMonth(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
  },
  dateInput(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    if (isNaN(d)) return ''
    return d.toISOString().split('T')[0]
  },
  monthYear(year, month) {
    const d = new Date(year, month - 1, 1)
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  },
  monthShort(monthKey) {
    // '2026-05' → 'mai. 26'
    const [y, m] = monthKey.split('-')
    const d = new Date(Number(y), Number(m) - 1, 1)
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  },
  relativeDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    const today = new Date(); today.setHours(0,0,0,0)
    const diff = Math.round((d - today) / 86400000)
    if (diff === 0) return 'Hoje'
    if (diff === 1) return 'Amanhã'
    if (diff === -1) return 'Ontem'
    if (diff > 0 && diff <= 7) return `Em ${diff} dias`
    if (diff < 0 && diff >= -7) return `Há ${Math.abs(diff)} dias`
    return fmt.date(dateStr, 'short')
  }
}

// Operações de data
export const date = {
  today() { return new Date().toISOString().split('T')[0] },
  todayObj() { const d = new Date(); d.setHours(0,0,0,0); return d },
  currentMonth() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  },
  monthStart(monthKey) {
    const [y, m] = monthKey.split('-')
    return `${y}-${m}-01`
  },
  monthEnd(monthKey) {
    const [y, m] = monthKey.split('-')
    const last = new Date(Number(y), Number(m), 0).getDate()
    return `${y}-${m}-${String(last).padStart(2,'0')}`
  },
  addMonths(monthKey, n) {
    const [y, m] = monthKey.split('-').map(Number)
    const d = new Date(y, m - 1 + n, 1)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  },
  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00')
    d.setDate(d.getDate() + n)
    return d.toISOString().split('T')[0]
  },
  isOverdue(dateStr) {
    const today = new Date(); today.setHours(0,0,0,0)
    return new Date(dateStr + 'T00:00:00') < today
  },
  isPast(dateStr) {
    return new Date(dateStr + 'T00:00:00') <= new Date()
  },
  monthKey(dateStr) {
    return dateStr ? dateStr.substring(0, 7) : date.currentMonth()
  }
}

// Operações de string
export const str = {
  initials(name) {
    if (!name) return '?'
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase()
  },
  slugify(text) {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  },
  capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''
  }
}

// Debounce
export function debounce(fn, wait = 300) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}

// Deep clone
export function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

// Agrupar array por chave
export function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = typeof key === 'function' ? key(item) : item[key]
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {})
}

// Somar array de objetos
export function sumBy(arr, key) {
  return arr.reduce((acc, item) => acc + (Number(item[key]) || 0), 0)
}

// Sanitize HTML básico
export function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// Parse valor monetário de string
export function parseMoney(str) {
  return parseFloat(String(str).replace(/[^\d,.-]/g,'').replace(',','.')) || 0
}

// Gera ID único
export function uid() {
  return Math.random().toString(36).slice(2,9) + Date.now().toString(36)
}

// Cores predefinidas
export const COLORS = [
  '#00F5A0','#00C9FF','#FF6B6B','#FFD93D','#A855F7',
  '#FF9A3C','#06B6D4','#EC4899','#84CC16','#F97316',
  '#6366F1','#14B8A6'
]

// Mapa de bancos brasileiros
export const BANKS = [
  { code: '260', name: 'Nubank',       emoji: '🟣' },
  { code: '341', name: 'Itaú',         emoji: '🟠' },
  { code: '237', name: 'Bradesco',     emoji: '🔴' },
  { code: '033', name: 'Santander',    emoji: '🔴' },
  { code: '104', name: 'Caixa',        emoji: '🔵' },
  { code: '001', name: 'Banco do Brasil', emoji: '🟡' },
  { code: '077', name: 'Inter',        emoji: '🟠' },
  { code: '336', name: 'C6 Bank',      emoji: '⚫' },
  { code: '208', name: 'BTG Pactual',  emoji: '🔵' },
  { code: '655', name: 'Neon',         emoji: '🔵' },
  { code: '380', name: 'PicPay',       emoji: '🟢' },
  { code: '323', name: 'Mercado Pago', emoji: '🔵' },
  { code: '212', name: 'Original',     emoji: '🟢' },
  { code: '121', name: 'Agibank',      emoji: '🟡' },
  { code: '280', name: 'Will Bank',    emoji: '🟡' },
  { code: '756', name: 'Sicoob',       emoji: '🔵' },
  { code: '748', name: 'Sicredi',      emoji: '🟢' },
  { code: '041', name: 'Banrisul',     emoji: '🔵' },
  { code: '021', name: 'Banestes',     emoji: '🔵' },
  { code: '422', name: 'Safra',        emoji: '🔵' },
  { code: '637', name: 'Sofisa',       emoji: '🔵' },
  { code: '707', name: 'Daycoval',     emoji: '🔴' },
  { code: '623', name: 'Pan',          emoji: '🔵' },
  { code: '318', name: 'BMG',          emoji: '🔵' },
  { code: '000', name: 'Carteira',     emoji: '👛' },
  { code: 'other', name: 'Outro banco', emoji: '🏦' },
]

export const CARD_FLAGS = [
  { id: 'visa',       name: 'Visa',       emoji: '💳' },
  { id: 'mastercard', name: 'Mastercard', emoji: '💳' },
  { id: 'elo',        name: 'Elo',        emoji: '💳' },
  { id: 'amex',       name: 'Amex',       emoji: '💳' },
  { id: 'hipercard',  name: 'Hipercard',  emoji: '💳' },
  { id: 'other',      name: 'Outro',      emoji: '💳' },
]
