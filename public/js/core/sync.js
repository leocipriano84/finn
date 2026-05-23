let pendingCount = 0
let errorTimer = null

function getDot() { return document.getElementById('syncDot') }
function getLabel() { return document.getElementById('syncLabel') }

export const Sync = {
  start() {
    pendingCount++
    clearTimeout(errorTimer)
    const dot = getDot(); const label = getLabel()
    if (dot) dot.className = 'sync-dot syncing'
    if (label) label.textContent = 'Salvando...'
  },

  done() {
    pendingCount = Math.max(0, pendingCount - 1)
    if (pendingCount === 0) {
      const dot = getDot(); const label = getLabel()
      if (dot) dot.className = 'sync-dot synced'
      if (label) label.textContent = 'Salvo'
    }
  },

  fail() {
    pendingCount = Math.max(0, pendingCount - 1)
    const dot = getDot(); const label = getLabel()
    if (dot) dot.className = 'sync-dot error'
    if (label) label.textContent = 'Erro'
    errorTimer = setTimeout(() => {
      if (getDot()) getDot().className = 'sync-dot synced'
      if (getLabel()) getLabel().textContent = 'Salvo'
    }, 5000)
  }
}
