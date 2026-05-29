import { endpoints } from '../core/api.js'
import { store } from '../core/store.js'
import { fmt } from '../core/utils.js'
import { Toast, Loading } from '../core/notifications.js'

const SUGGESTIONS = [
  'Como estão meus gastos esse mês?',
  'Onde posso economizar?',
  'Estou no caminho certo?',
  'Como montar uma reserva?',
  'Dicas para quitar dívidas',
]

let history = []

export async function render(el) {
  el.innerHTML = `
    <div style="display:flex;height:100%">
      <!-- Chat -->
      <div style="flex:1;display:flex;flex-direction:column;min-width:0">
        <!-- Header do coach -->
        <div style="padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--color-border);display:flex;align-items:center;gap:12px;flex-shrink:0">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--color-green-dim);border:2px solid var(--color-green);display:flex;align-items:center;justify-content:center;font-size:20px;">🤖</div>
          <div>
            <div style="font-weight:600">Coach Finn</div>
            <div style="font-size:var(--text-xs);display:flex;align-items:center;gap:4px"><div class="pulse-dot" style="width:6px;height:6px"></div><span style="color:var(--color-text-soft)">Online</span></div>
          </div>
          <button class="btn btn-secondary btn-sm" style="margin-left:auto" id="coachReportBtn">📊 Relatório</button>
        </div>

        <!-- Mensagens -->
        <div style="flex:1;overflow-y:auto;padding:var(--space-4)" id="chatMessages"></div>

        <!-- Sugestões rápidas -->
        <div style="padding:0 var(--space-4) var(--space-2);display:flex;gap:6px;flex-wrap:wrap" id="chatSuggestions">
          ${SUGGESTIONS.map(s => `<div class="chip suggestion-chip">${s}</div>`).join('')}
        </div>

        <!-- Input -->
        <div style="padding:var(--space-3) var(--space-4);border-top:1px solid var(--color-border);display:flex;gap:8px;flex-shrink:0">
          <input id="chatInput" class="form-control" placeholder="Pergunte ao Coach Finn..." style="flex:1">
          <button class="btn btn-primary" id="chatSend" style="padding:10px 16px">Enviar</button>
        </div>
      </div>

      <!-- Painel lateral (desktop) -->
      <div style="width:280px;border-left:1px solid var(--color-border);padding:var(--space-4);overflow-y:auto;display:none" id="coachSidePanel" class="coach-side-panel">
        <div id="coachProfileCard"></div>
        <div id="coachMonthReport" style="margin-top:16px"></div>
      </div>
    </div>
  `

  // Show side panel on desktop
  if (window.innerWidth >= 1024) {
    document.getElementById('coachSidePanel').style.display = 'block'
  }

  attachChatEvents(el)
  await Promise.all([loadChatHistory(), loadCoachProfile(), loadMonthReport()])
  el.addEventListener('__cleanup', () => { history = [] }, { once: true })
}

function attachChatEvents(el) {
  const input = el.querySelector('#chatInput')
  const sendBtn = el.querySelector('#chatSend')

  sendBtn?.addEventListener('click', sendMessage)
  input?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } })

  el.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (input) input.value = chip.textContent
      sendMessage()
    })
  })

  el.querySelector('#coachReportBtn')?.addEventListener('click', () => {
    el.querySelector('#coachSidePanel').style.display =
      el.querySelector('#coachSidePanel').style.display === 'none' ? 'block' : 'none'
  })
}

async function sendMessage() {
  const input = document.getElementById('chatInput')
  const msg = input?.value?.trim()
  if (!msg) return

  input.value = ''
  input.disabled = true
  document.getElementById('chatSend').disabled = true

  addMessage('user', msg)
  const typingId = addTypingIndicator()

  try {
    const res = await endpoints.coachChat(msg)
    removeTypingIndicator(typingId)
    addMessage('assistant', res.reply)
    history.push({ role: 'user', content: msg }, { role: 'assistant', content: res.reply })
    if (history.length > 20) history = history.slice(-20)

    // Esconde sugestões após primeira mensagem
    const sugs = document.getElementById('chatSuggestions')
    if (sugs && history.length > 2) sugs.style.display = 'none'
  } catch (e) {
    removeTypingIndicator(typingId)
    addMessage('assistant', `Desculpe, não consegui processar sua mensagem. ${e.message}`, true)
  } finally {
    input.disabled = false
    document.getElementById('chatSend').disabled = false
    input.focus()
  }
}

function addMessage(role, content, isError = false) {
  const el = document.getElementById('chatMessages')
  if (!el) return

  const isUser = role === 'user'
  const msgEl = document.createElement('div')
  msgEl.style.cssText = `display:flex;justify-content:${isUser ? 'flex-end' : 'flex-start'};margin-bottom:12px;animation:fadeInUp 200ms ease`
  msgEl.innerHTML = `
    <div style="max-width:80%;padding:10px 14px;border-radius:${isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px'};background:${isUser ? 'var(--color-green)' : isError ? 'var(--color-red-dim)' : 'var(--color-card-hover)'};color:${isUser ? '#050508' : 'var(--color-text)'};font-size:var(--text-sm);line-height:1.5;white-space:pre-wrap">
      ${escapeHtml(content)}
    </div>
  `
  el.appendChild(msgEl)
  el.scrollTop = el.scrollHeight
  return msgEl
}

function addTypingIndicator() {
  const el = document.getElementById('chatMessages')
  if (!el) return null
  const id = 'typing_' + Date.now()
  const div = document.createElement('div')
  div.id = id
  div.style.cssText = 'display:flex;justify-content:flex-start;margin-bottom:12px'
  div.innerHTML = `<div style="padding:10px 16px;background:var(--color-card-hover);border-radius:4px 16px 16px 16px;display:flex;gap:4px;align-items:center"><span class="animate-pulse" style="width:6px;height:6px;border-radius:50%;background:var(--color-text-soft);display:inline-block"></span><span class="animate-pulse" style="width:6px;height:6px;border-radius:50%;background:var(--color-text-soft);display:inline-block;animation-delay:0.15s"></span><span class="animate-pulse" style="width:6px;height:6px;border-radius:50%;background:var(--color-text-soft);display:inline-block;animation-delay:0.3s"></span></div>`
  el.appendChild(div)
  el.scrollTop = el.scrollHeight
  return id
}

function removeTypingIndicator(id) {
  if (id) document.getElementById(id)?.remove()
}

async function loadChatHistory() {
  const el = document.getElementById('chatMessages')
  if (!el) return

  try {
    const msgs = await endpoints.coachHistory()
    if (!msgs.length) {
      // Mensagem de boas-vindas
      addMessage('assistant', `Olá! Sou o Coach Finn 🤖 Estou aqui para te ajudar com suas finanças.\n\nPosso analisar seus gastos, identificar onde você pode economizar e dar dicas personalizadas. O que você gostaria de saber?`)
    } else {
      msgs.slice(-20).forEach(m => addMessage(m.role, m.content))
    }
  } catch {
    addMessage('assistant', 'Olá! Sou o Coach Finn. Como posso ajudar com suas finanças hoje? 💰')
  }
}

async function loadCoachProfile() {
  const el = document.getElementById('coachProfileCard')
  if (!el) return
  try {
    const profile = await endpoints.coachProfile()
    el.innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title">Seu perfil</span></div>
        <div style="text-align:center;padding:8px 0">
          <div style="font-size:36px;margin-bottom:4px">${profile.emoji}</div>
          <div style="font-weight:700;font-size:var(--text-lg)">${profile.name}</div>
          <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:12px">${profile.desc}</div>
          <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:4px">Score de saúde financeira</div>
          <div style="font-size:var(--text-3xl);font-weight:800;font-family:var(--font-mono);color:${profile.score >= 70 ? 'var(--color-green)' : profile.score >= 40 ? 'var(--color-yellow)' : 'var(--color-red)'}">${profile.score}</div>
          <div class="progress-bar" style="margin-top:8px"><div class="progress-bar-fill" style="width:${profile.score}%;background:${profile.score >= 70 ? 'var(--color-green)' : profile.score >= 40 ? 'var(--color-yellow)' : 'var(--color-red)'}"></div></div>
        </div>
      </div>
    `
  } catch {}
}

async function loadMonthReport() {
  const el = document.getElementById('coachMonthReport')
  if (!el) return
  try {
    const report = await endpoints.coachReport()
    const fmtV = v => fmt.currency(v)
    el.innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-title">Este mês</span></div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between"><span class="text-xs text-soft">Receitas</span><span class="text-mono text-sm value-positive">${fmtV(report.income)}</span></div>
          <div style="display:flex;justify-content:space-between"><span class="text-xs text-soft">Despesas</span><span class="text-mono text-sm value-negative">${fmtV(report.expense)}</span></div>
          <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--color-border)"><span class="text-sm font-bold">Saldo</span><span class="text-mono text-sm font-bold ${report.balance >= 0 ? 'value-positive' : 'value-negative'}">${fmtV(report.balance)}</span></div>
        </div>
        ${report.insights.map(i => `
          <div style="padding:8px;border-radius:8px;background:${i.type === 'success' ? 'var(--color-green-dim)' : i.type === 'warning' ? 'var(--color-yellow-dim)' : 'var(--color-red-dim)'};font-size:var(--text-xs);margin-bottom:6px">
            ${i.text}
          </div>
        `).join('')}
      </div>
    `
  } catch {}
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
