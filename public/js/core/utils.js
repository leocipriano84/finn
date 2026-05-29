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
  { code: '260', name: 'Nubank',          emoji: '🟣', color: '#8A05BE' },
  { code: '341', name: 'Itaú',            emoji: '🟠', color: '#EC7000' },
  { code: '237', name: 'Bradesco',        emoji: '🔴', color: '#CC092F' },
  { code: '033', name: 'Santander',       emoji: '🔴', color: '#EC0000' },
  { code: '104', name: 'Caixa',           emoji: '🔵', color: '#005CA9' },
  { code: '001', name: 'Banco do Brasil', emoji: '🟡', color: '#F8D000' },
  { code: '077', name: 'Inter',           emoji: '🟠', color: '#FF7A00' },
  { code: '336', name: 'C6 Bank',         emoji: '⚫', color: '#221F1F' },
  { code: '208', name: 'BTG Pactual',     emoji: '🔵', color: '#0046A8' },
  { code: '102', name: 'XP Investimentos',emoji: '🟠', color: '#F5821F' },
  { code: '655', name: 'Neon',            emoji: '🔵', color: '#00D4FF' },
  { code: '380', name: 'PicPay',          emoji: '🟢', color: '#21C25E' },
  { code: '323', name: 'Mercado Pago',    emoji: '🔵', color: '#009EE3' },
  { code: '212', name: 'Original',        emoji: '🟢', color: '#008000' },
  { code: '121', name: 'Agibank',         emoji: '🟡', color: '#F5C400' },
  { code: '280', name: 'Will Bank',       emoji: '🟡', color: '#FDC300' },
  { code: '756', name: 'Sicoob',          emoji: '🔵', color: '#004EA0' },
  { code: '748', name: 'Sicredi',         emoji: '🟢', color: '#00883C' },
  { code: '041', name: 'Banrisul',        emoji: '🔵', color: '#003E82' },
  { code: '021', name: 'Banestes',        emoji: '🔵', color: '#003087' },
  { code: '422', name: 'Safra',           emoji: '🔵', color: '#1B3A6B' },
  { code: '637', name: 'Sofisa',          emoji: '🔵', color: '#005096' },
  { code: '707', name: 'Daycoval',        emoji: '🔴', color: '#C81F2D' },
  { code: '623', name: 'Pan',             emoji: '🔵', color: '#003882' },
  { code: '318', name: 'BMG',             emoji: '🔵', color: '#004A98' },
  { code: '000', name: 'Carteira',        emoji: '👛', color: '#888888' },
  { code: 'other', name: 'Outro banco',   emoji: '🏦', color: '#888888' },
]

export const CARD_FLAGS = [
  { id: 'visa',       name: 'Visa',       emoji: '💳' },
  { id: 'mastercard', name: 'Mastercard', emoji: '💳' },
  { id: 'elo',        name: 'Elo',        emoji: '💳' },
  { id: 'amex',       name: 'Amex',       emoji: '💳' },
  { id: 'hipercard',  name: 'Hipercard',  emoji: '💳' },
  { id: 'other',      name: 'Outro',      emoji: '💳' },
]
