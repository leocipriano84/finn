// Logos via CDN público (guibranco/BancosBrasileiros)
const LOGO_CDN = (code) =>
  `https://raw.githubusercontent.com/guibranco/BancosBrasileiros/main/src/imgs/${code}.png`

export const BANKS = [
  { code: '260', name: 'Nubank',           color: '#8A05BE' },
  { code: '341', name: 'Itaú',             color: '#EC7000' },
  { code: '237', name: 'Bradesco',         color: '#CC092F' },
  { code: '033', name: 'Santander',        color: '#EC0000' },
  { code: '104', name: 'Caixa',            color: '#005CA9' },
  { code: '001', name: 'Banco do Brasil',  color: '#F8D000' },
  { code: '077', name: 'Inter',            color: '#FF7A00' },
  { code: '336', name: 'C6 Bank',          color: '#221F1F' },
  { code: '208', name: 'BTG Pactual',      color: '#0046A8' },
  { code: '102', name: 'XP Investimentos', color: '#F5821F' },
  { code: '756', name: 'Sicoob',           color: '#004EA0' },
  { code: '748', name: 'Sicredi',          color: '#00883C' },
  { code: '655', name: 'Neon',             color: '#00D4FF' },
  { code: '380', name: 'PicPay',           color: '#21C25E' },
  { code: '323', name: 'Mercado Pago',     color: '#009EE3' },
  { code: '212', name: 'Original',         color: '#008000' },
  { code: '021', name: 'Banestes',         color: '#003087' },
  { code: '041', name: 'Banrisul',         color: '#003E82' },
  { code: '422', name: 'Safra',            color: '#1B3A6B' },
  { code: '290', name: 'PagBank',          color: '#03A64A' },
  { code: '637', name: 'Sofisa',           color: '#005096' },
  { code: '707', name: 'Daycoval',         color: '#C81F2D' },
  { code: '623', name: 'Pan',              color: '#003882' },
  { code: '318', name: 'BMG',              color: '#004A98' },
  { code: '000', name: 'Carteira',         color: '#888888' },
  { code: 'other', name: 'Outro banco',    color: '#888888' },
]

const LIGHT_BG = new Set(['#F8D000','#FFD93D','#F9CC1B'])

export function bankLogoHTML(b, size = 28) {
  if (!b || b.code === 'other' || b.code === '000') {
    const letter = b?.name?.charAt(0) || '🏦'
    const c = b?.color || '#888'
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${c};color:#fff;font-weight:700;font-size:${Math.round(size*0.42)}px;font-family:sans-serif;flex-shrink:0">${letter}</span>`
  }
  const c = b.color || '#888'
  const letter = b.name.charAt(0).toUpperCase()
  const textColor = LIGHT_BG.has(c) ? '#000' : '#fff'
  return `
    <img src="${LOGO_CDN(b.code)}"
         style="width:${size}px;height:${size}px;border-radius:50%;object-fit:contain;background:#fff;flex-shrink:0;vertical-align:middle"
         onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"
         alt="${b.name}">
    <span style="display:none;width:${size}px;height:${size}px;border-radius:50%;background:${c};color:${textColor};font-weight:700;font-size:${Math.round(size*0.42)}px;font-family:sans-serif;align-items:center;justify-content:center;flex-shrink:0;vertical-align:middle">${letter}</span>`
}

export function buildBankDropdownHTML(containerId, selectedCode = '') {
  const sel = BANKS.find(b => b.code === selectedCode) || BANKS[BANKS.length - 1]
  const uid = containerId.replace(/[^a-zA-Z0-9]/g, '_')

  const items = BANKS.map(b => `
    <div class="bk-item" data-code="${b.code}" data-name="${b.name.replace(/"/g,'&quot;')}"
         style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;${b.code === selectedCode ? 'background:var(--color-card-hover)' : ''}"
         onmouseover="this.style.background='var(--color-card-hover)'"
         onmouseout="this.style.background='${b.code === selectedCode ? 'var(--color-card-hover)' : ''}'"
         onclick="window.__bkSelect('${uid}','${containerId}','${b.code}','${b.name.replace(/'/g,"\\'")}')">
      <span style="display:inline-flex;align-items:center;gap:0">${bankLogoHTML(b, 24)}</span>
      <span style="font-size:var(--text-sm)">${b.name}</span>
    </div>`).join('')

  return `
    <div class="bk-dd" id="bk_${uid}" style="position:relative">
      <div id="bk_${uid}_trigger" class="form-control"
           style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none"
           onclick="window.__bkToggle('${uid}')">
        <span id="bk_${uid}_icon" style="display:inline-flex;align-items:center">${bankLogoHTML(sel, 24)}</span>
        <span id="bk_${uid}_label" style="flex:1">${sel.name}</span>
        <span style="color:var(--color-text-muted);font-size:10px">▾</span>
      </div>
      <div id="bk_${uid}_list" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:1000;background:var(--color-card);border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:0 8px 24px rgba(0,0,0,0.2);max-height:280px;overflow-y:auto">
        <div style="padding:8px;border-bottom:1px solid var(--color-border)">
          <input type="text" placeholder="Buscar banco..." class="form-control" style="padding:6px 10px;font-size:13px"
                 oninput="window.__bkFilter('${uid}',this.value)" onclick="event.stopPropagation()">
        </div>
        <div id="bk_${uid}_items">${items}</div>
      </div>
      <input type="hidden" id="${containerId}" value="${selectedCode}">
    </div>`
}

// Globals
window.__bkToggle = (uid) => {
  document.querySelectorAll('[id$="_list"].bk-list-open').forEach(l => { l.style.display = 'none'; l.classList.remove('bk-list-open') })
  const list = document.getElementById(`bk_${uid}_list`)
  if (!list) return
  const isOpen = list.style.display !== 'none'
  if (isOpen) { list.style.display = 'none'; list.classList.remove('bk-list-open') }
  else { list.style.display = 'block'; list.classList.add('bk-list-open') }
}

window.__bkFilter = (uid, q) => {
  const items = document.getElementById(`bk_${uid}_items`)
  if (!items) return
  items.querySelectorAll('.bk-item').forEach(item => {
    item.style.display = item.dataset.name.toLowerCase().includes(q.toLowerCase()) ? '' : 'none'
  })
}

window.__bkSelect = (uid, containerId, code, name) => {
  const bank = BANKS.find(b => b.code === code) || { code, name, color: '#888' }
  const iconEl = document.getElementById(`bk_${uid}_icon`)
  const labelEl = document.getElementById(`bk_${uid}_label`)
  const list = document.getElementById(`bk_${uid}_list`)
  const hidden = document.getElementById(containerId)
  if (iconEl) iconEl.innerHTML = bankLogoHTML(bank, 24)
  if (labelEl) labelEl.textContent = name
  if (list) { list.style.display = 'none'; list.classList.remove('bk-list-open') }
  if (hidden) hidden.value = code
  // Preencher nome da conta se vazio
  const nameInput = document.getElementById('accName')
  if (nameInput && !nameInput.value && name !== 'Outro banco' && name !== 'Carteira') nameInput.value = name
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.bk-dd')) {
    document.querySelectorAll('[id$="_list"]').forEach(l => { l.style.display = 'none'; l.classList.remove('bk-list-open') })
  }
})
