export const Theme = {
  current: 'system',

  init() {
    const saved = localStorage.getItem('finn_theme') || 'system'
    this.apply(saved, false)
  },

  apply(theme, save = true) {
    this.current = theme
    if (save) localStorage.setItem('finn_theme', theme)

    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }

    this._updateIcons()
    this._updateThemeColorMeta()
  },

  toggle() {
    const order = ['dark', 'light', 'system']
    const next = order[(order.indexOf(this.current) + 1) % order.length]
    this.apply(next)
  },

  _updateIcons() {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      const icons = { dark: '🌙', light: '☀️', system: '⚙️' }
      const labels = { dark: 'Escuro', light: 'Claro', system: 'Sistema' }
      btn.textContent = icons[this.current] || '⚙️'
      btn.title = `Tema: ${labels[this.current]}`
    })
  },

  _updateThemeColorMeta() {
    const isDark = this.current === 'dark' ||
      (this.current === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.querySelector('meta[name="theme-color"][media*="dark"]')
      ?.setAttribute('content', isDark ? '#050508' : '#ffffff')
  }
}

// Aplicar imediatamente (antes de qualquer render) para evitar flash
Theme.init()
