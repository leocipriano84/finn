import { fmt } from './utils.js'
import { Toast, Confirm, Loading } from './notifications.js'
import { endpoints } from './api.js'

// ─── Modal ────────────────────────────────────────────────────────
export const Modal = {
  open(id, title, content, { onClose, footer, maxWidth = '480px' } = {}) {
    Modal.close(id)
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    overlay.id = `modal-${id}`
    overlay.innerHTML = `
      <div class="modal" style="max-width:${maxWidth}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="btn btn-icon" data-modal-close>✕</button>
        </div>
        <div class="modal-body">${content}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('open'))
    const close = () => Modal.close(id)
    overlay.querySelector('[data-modal-close]')?.addEventListener('click', close)
    overlay.addEventListener('click', e => { if (e.target === overlay) close() })
    overlay._onClose = onClose
    return overlay
  },
  close(id) {
    const overlay = document.getElementById(`modal-${id}`)
    if (!overlay) return
    overlay.classList.remove('open')
    overlay._onClose?.()
    setTimeout(() => overlay.remove(), 300)
  },
  get(id) { return document.getElementById(`modal-${id}`) }
}

// ─── Drawer ──────────────────────────────────────────────────────
export const Drawer = {
  open(id, content, { title = '', position = 'bottom' } = {}) {
    Drawer.close(id)
    const drawer = document.createElement('div')
    drawer.className = 'modal-overlay'
    drawer.id = `drawer-${id}`
    drawer.innerHTML = `
      <div class="modal" style="position:fixed;${position==='bottom'?'bottom:0;top:auto;border-radius:24px 24px 0 0;max-height:85vh;overflow-y:auto':'right:0;top:0;height:100%;border-radius:24px 0 0 24px;max-width:480px;width:90vw'}">
        ${title ? `<div class="modal-header"><h3 class="modal-title">${title}</h3><button class="btn btn-icon" data-drawer-close>✕</button></div>` : ''}
        <div class="modal-body">${content}</div>
      </div>
    `
    document.body.appendChild(drawer)
    requestAnimationFrame(() => drawer.classList.add('open'))
    drawer.querySelector('[data-drawer-close]')?.addEventListener('click', () => Drawer.close(id))
    drawer.addEventListener('click', e => { if (e.target === drawer) Drawer.close(id) })
    return drawer
  },
  close(id) {
    const el = document.getElementById(`drawer-${id}`)
    if (!el) return
    el.classList.remove('open')
    setTimeout(() => el.remove(), 300)
  },
  get(id) { return document.getElementById(`drawer-${id}`) }
}

// ─── DonutChart ──────────────────────────────────────────────────
// data: [{ label, value, color }]
// options: { size, thickness, centerText, centerSub }
export const DonutChart = {
  render(canvas, data, options = {}) {
    if (!canvas) return
    const { size = 160, thickness = 28, centerText = '', centerSub = '' } = options
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const cx = size / 2, cy = size / 2, r = (size - thickness) / 2
    const total = data.reduce((s, d) => s + (d.value || 0), 0)
    ctx.clearRect(0, 0, size, size)

    if (!total) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = thickness
      ctx.stroke()
    } else {
      let angle = -Math.PI / 2
      for (const d of data) {
        if (!d.value) continue
        const slice = (d.value / total) * Math.PI * 2
        ctx.beginPath()
        ctx.arc(cx, cy, r, angle, angle + slice)
        ctx.strokeStyle = d.color || '#00F5A0'
        ctx.lineWidth = thickness
        ctx.lineCap = 'butt'
        ctx.stroke()
        angle += slice
      }
    }

    if (centerText) {
      ctx.textAlign = 'center'
      ctx.fillStyle = '#f0f0f5'
      ctx.font = `bold ${size * 0.14}px 'Space Grotesk', sans-serif`
      ctx.fillText(centerText, cx, cy + (centerSub ? size * 0.04 : size * 0.05))
      if (centerSub) {
        ctx.fillStyle = '#6b7280'
        ctx.font = `${size * 0.09}px 'DM Sans', sans-serif`
        ctx.fillText(centerSub, cx, cy + size * 0.14)
      }
    }
  }
}

// ─── BarChart (horizontal) ──────────────────────────────────────
// data: [{ label, value, color, pct }]
export const BarChart = {
  render(container, data, options = {}) {
    if (!container) return
    const { maxItems = 8, showValue = true, onClickItem } = options
    const items = data.slice(0, maxItems)
    container.innerHTML = items.map((d, i) => `
      <div class="rank-item" style="cursor:${onClickItem ? 'pointer' : 'default'}" data-bar-idx="${i}">
        ${d.icon ? `<div class="rank-icon" style="background:${d.color || '#00F5A0'}22;color:${d.color || '#00F5A0'}">${d.icon}</div>` : ''}
        <div class="rank-info">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span class="rank-name">${d.label}</span>
            ${d.count != null ? `<span style="font-size:var(--text-xs);color:var(--color-text-soft)">${d.count}</span>` : ''}
          </div>
          <div class="rank-bar-wrap">
            <div class="rank-bar-fill" style="width:${d.pct || 0}%;background:${d.color || '#00F5A0'}"></div>
          </div>
        </div>
        ${showValue ? `
          <div style="text-align:right;min-width:80px">
            <div class="rank-value">${fmt.currency(d.value)}</div>
            <div class="rank-pct text-soft">${fmt.percent(d.pct || 0)}</div>
          </div>
        ` : ''}
      </div>
    `).join('')

    if (onClickItem) {
      container.querySelectorAll('[data-bar-idx]').forEach(el => {
        el.addEventListener('click', () => onClickItem(items[Number(el.dataset.barIdx)]))
      })
    }
  }
}

// ─── LineChart (canvas) ──────────────────────────────────────────
// data: [{ label, value }] or [{ label, values: [v1, v2] }] for dual lines
// options: { colors, height, showGrid, showDots, formatY, dual }
export const LineChart = {
  render(canvas, data, options = {}) {
    if (!canvas || !data.length) return
    const {
      colors = ['#00F5A0', '#00C9FF'],
      height = 120,
      showGrid = true,
      showDots = true,
      formatY = v => fmt.currency(v),
      dual = false
    } = options

    const W = canvas.offsetWidth || canvas.width || 300
    canvas.width = W
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, W, height)

    const PAD = { top: 12, right: 12, bottom: 28, left: 8 }
    const cW = W - PAD.left - PAD.right
    const cH = height - PAD.top - PAD.bottom

    const series = dual
      ? [data.map(d => d.values?.[0] ?? d.value ?? 0), data.map(d => d.values?.[1] ?? 0)]
      : [data.map(d => d.value ?? 0)]

    const allVals = series.flat()
    const minV = Math.min(0, ...allVals)
    const maxV = Math.max(...allVals, 1)
    const range = maxV - minV || 1

    const toX = i => PAD.left + (i / Math.max(data.length - 1, 1)) * cW
    const toY = v => PAD.top + cH - ((v - minV) / range) * cH

    // Grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      for (let g = 0; g <= 4; g++) {
        const y = PAD.top + (g / 4) * cH
        ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke()
      }
    }

    // Lines + fill
    series.forEach((vals, si) => {
      const color = colors[si] || '#00F5A0'
      // Fill gradient
      const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + cH)
      grad.addColorStop(0, color.replace(')', ',0.18)').replace('rgb','rgba').replace('#', 'rgba(').replace('rgba(', color.startsWith('#') ? `${color}30` : ''))
      ctx.beginPath()
      ctx.moveTo(toX(0), toY(vals[0]))
      vals.forEach((v, i) => { if (i) ctx.lineTo(toX(i), toY(v)) })
      ctx.lineTo(toX(vals.length - 1), PAD.top + cH)
      ctx.lineTo(toX(0), PAD.top + cH)
      ctx.closePath()
      ctx.fillStyle = color + '18'
      ctx.fill()

      // Line
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      vals.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)))
      ctx.stroke()

      // Dots
      if (showDots) {
        vals.forEach((v, i) => {
          ctx.beginPath()
          ctx.arc(toX(i), toY(v), 3, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
        })
      }
    })

    // X labels
    ctx.fillStyle = '#6b7280'
    ctx.font = `10px 'DM Sans', sans-serif`
    ctx.textAlign = 'center'
    const step = Math.max(1, Math.floor(data.length / 7))
    data.forEach((d, i) => {
      if (i % step !== 0 && i !== data.length - 1) return
      ctx.fillText(String(d.label).slice(0, 5), toX(i), height - 4)
    })
  }
}

// ─── MonthNavigator ───────────────────────────────────────────────
export const MonthNavigator = {
  mount(selector, { onChange, initialMonth } = {}) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector
    if (!el) return
    let current = initialMonth || new Date().toISOString().slice(0, 7)

    const render = () => {
      const [y, m] = current.split('-').map(Number)
      const d = new Date(y, m - 1, 1)
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        .replace(/^\w/, c => c.toUpperCase())
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn btn-icon btn-sm" id="mnPrev">‹</button>
          <span style="font-size:var(--text-sm);font-weight:600;min-width:120px;text-align:center">${label}</span>
          <button class="btn btn-icon btn-sm" id="mnNext">›</button>
        </div>
      `
      el.querySelector('#mnPrev')?.addEventListener('click', () => { current = addMonth(current, -1); render(); onChange?.(current) })
      el.querySelector('#mnNext')?.addEventListener('click', () => { current = addMonth(current, 1); render(); onChange?.(current) })
    }
    render()
    return { getMonth: () => current, setMonth: m => { current = m; render() } }
  }
}

function addMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─── TransactionItem ─────────────────────────────────────────────
export function transactionItem(t, { onEdit, onDelete, onConfirm } = {}) {
  const isIncome = t.type === 'income'
  const isPending = t.status !== 'confirmed'
  const sign = isIncome ? '+' : '−'
  const colorClass = isIncome ? 'value-positive' : 'value-negative'

  const el = document.createElement('div')
  el.className = 'transaction-item'
  el.dataset.txId = t.id
  el.innerHTML = `
    <div class="transaction-icon" style="background:${t.categories?.color ? t.categories.color + '22' : 'var(--color-card-hover)'}">
      ${t.categories?.icon || (isIncome ? '💰' : '💸')}
    </div>
    <div class="transaction-info">
      <div class="transaction-desc">${t.description}</div>
      <div class="transaction-sub">${t.categories?.name || 'Sem categoria'} · ${fmt.date(t.due_date, 'short')}</div>
    </div>
    <div class="transaction-meta">
      <div class="transaction-amount ${colorClass}">${sign}${fmt.currency(t.amount)}</div>
      <div class="badge ${t.status === 'confirmed' ? 'badge-green' : 'badge-yellow'}" style="margin-top:2px">${t.status === 'confirmed' ? '✅' : '⏳'}</div>
    </div>
    <div style="display:flex;gap:4px;margin-left:4px">
      ${isPending ? `<button class="btn btn-icon btn-sm" title="Efetivar" data-tx-confirm>✅</button>` : ''}
      <button class="btn btn-icon btn-sm" title="Editar" data-tx-edit>✏️</button>
      <button class="btn btn-icon btn-sm" title="Excluir" data-tx-del>🗑️</button>
    </div>
  `

  el.querySelector('[data-tx-edit]')?.addEventListener('click', e => { e.stopPropagation(); onEdit?.(t) })
  el.querySelector('[data-tx-del]')?.addEventListener('click', async e => {
    e.stopPropagation()
    const ok = await Confirm.delete('este lançamento')
    if (!ok) return
    try { await endpoints.deleteTx(t.id); Toast.success('Lançamento excluído'); onDelete?.(t) }
    catch (err) { Toast.error(err.message) }
  })
  el.querySelector('[data-tx-confirm]')?.addEventListener('click', async e => {
    e.stopPropagation()
    try { await endpoints.confirmTx(t.id); Toast.success('Lançamento efetivado'); onConfirm?.(t) }
    catch (err) { Toast.error(err.message) }
  })

  return el
}

// ─── EmptyState ──────────────────────────────────────────────────
export function emptyState({ icon = '📭', title = 'Nenhum resultado', msg = '', action = null } = {}) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      ${title ? `<div class="empty-state-title">${title}</div>` : ''}
      ${msg ? `<p class="empty-state-msg">${msg}</p>` : ''}
      ${action ? `<button class="btn btn-primary btn-sm" id="emptyAction">${action.label}</button>` : ''}
    </div>
  `
}

// ─── SummaryBar ─────────────────────────────────────────────────
export function summaryBar(items) {
  return `
    <div class="summary-bar">
      ${items.map(i => `
        <div class="summary-bar-item">
          <div class="summary-bar-label">${i.label}</div>
          <div class="summary-bar-value ${i.colorClass || ''}">${i.value}</div>
        </div>
      `).join('')}
    </div>
  `
}

// ─── ProgressRing ────────────────────────────────────────────────
export function progressRing(pct, { size = 48, stroke = 4, color = 'var(--color-green)' } = {}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(pct, 100) / 100)
  return `
    <svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--color-border)" stroke-width="${stroke}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"
        style="transition:stroke-dashoffset 0.8s ease"/>
    </svg>
  `
}

// ─── colorPicker ─────────────────────────────────────────────────
export function colorPicker(container, colors, { selected, onChange } = {}) {
  container.innerHTML = `<div class="color-picker">${colors.map(c => `
    <div class="color-swatch${c === selected ? ' selected' : ''}" data-color="${c}" style="background:${c}"></div>
  `).join('')}</div>`
  container.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'))
      sw.classList.add('selected')
      onChange?.(sw.dataset.color)
    })
  })
}

// ─── emojiPicker ─────────────────────────────────────────────────
export function emojiPicker(container, emojis, { selected, onChange } = {}) {
  container.innerHTML = emojis.map(e => `
    <span class="emoji-opt${e === selected ? ' selected' : ''}" data-emoji="${e}"
      style="font-size:22px;padding:6px;border-radius:8px;cursor:pointer;display:inline-block;transition:background 0.15s;background:${e === selected ? 'var(--color-green-dim)' : 'transparent'}">
      ${e}
    </span>
  `).join('')
  container.querySelectorAll('.emoji-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      container.querySelectorAll('.emoji-opt').forEach(o => { o.classList.remove('selected'); o.style.background = 'transparent' })
      opt.classList.add('selected'); opt.style.background = 'var(--color-green-dim)'
      onChange?.(opt.dataset.emoji)
    })
    opt.addEventListener('mouseenter', () => { if (!opt.classList.contains('selected')) opt.style.background = 'var(--color-card-hover)' })
    opt.addEventListener('mouseleave', () => { if (!opt.classList.contains('selected')) opt.style.background = 'transparent' })
  })
}

// ─── bankSelector ────────────────────────────────────────────────
export function bankSelector(selectEl, banks) {
  selectEl.innerHTML = `
    <option value="">Selecionar banco</option>
    ${banks.map(b => `<option value="${b.code}">${b.emoji} ${b.name}</option>`).join('')}
  `
}

// ─── infiniteScroll ──────────────────────────────────────────────
export function infiniteScroll(scrollEl, { onLoadMore, threshold = 100 } = {}) {
  let loading = false
  const handler = async () => {
    const { scrollTop, scrollHeight, clientHeight } = scrollEl
    if (loading || scrollHeight - scrollTop - clientHeight > threshold) return
    loading = true
    await onLoadMore?.()
    loading = false
  }
  scrollEl.addEventListener('scroll', handler, { passive: true })
  return () => scrollEl.removeEventListener('scroll', handler)
}

// ─── searchInput ─────────────────────────────────────────────────
export function searchInput(inputEl, { onSearch, delay = 350 } = {}) {
  let timer = null
  inputEl.addEventListener('input', () => {
    clearTimeout(timer)
    timer = setTimeout(() => onSearch?.(inputEl.value.trim()), delay)
  })
}

// ─── confirmBadge ────────────────────────────────────────────────
export function confirmBadge(status) {
  return status === 'confirmed'
    ? '<span class="badge badge-green">Efetivado</span>'
    : '<span class="badge badge-yellow">Pendente</span>'
}
