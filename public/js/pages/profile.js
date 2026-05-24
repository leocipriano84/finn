import { endpoints } from '../core/api.js'
import { fmt } from '../core/utils.js'
import { Toast, Loading } from '../core/notifications.js'
import { store } from '../core/store.js'

export async function render(el) {
  el.innerHTML = `
    <div style="flex:1;overflow-y:auto;padding:var(--space-5) var(--space-6);max-width:680px;margin:0 auto;width:100%">
      <div id="profileBody">
        ${skelItems(4)}
      </div>
    </div>
  `
  await loadProfile()
}

function skelItems(n) {
  return Array(n).fill('<div class="skeleton" style="height:120px;border-radius:16px;margin-bottom:16px"></div>').join('')
}

async function loadProfile() {
  const body = document.getElementById('profileBody')
  if (!body) return
  try {
    const [profile, coachProfile, achievements] = await Promise.all([
      endpoints.profile(),
      endpoints.coachProfile(),
      endpoints.achievements(),
    ])
    renderProfile(body, profile, coachProfile, achievements)
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${e.message}</p></div>`
  }
}

function renderProfile(el, profile, coachProfile, achievements) {
  const user = store.getUser()
  const scoreColor = coachProfile.score >= 70 ? 'var(--color-green)' : coachProfile.score >= 40 ? 'var(--color-yellow)' : 'var(--color-red)'
  const level = calcLevel(coachProfile.score)
  const xpCurrent = (coachProfile.score % 10) * 10
  const earned = achievements.filter(a => a.earned)
  const pending = achievements.filter(a => !a.earned)

  el.innerHTML = `

    <!-- Avatar + identidade -->
    <section style="margin-bottom:24px">
      <div class="card">
        <div style="display:flex;align-items:center;gap:20px;padding:4px 0">
          <div id="avatarEl" style="width:72px;height:72px;border-radius:50%;background:var(--color-green-dim);border:3px solid var(--color-green);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;cursor:pointer;flex-shrink:0;position:relative">
            ${profile.avatar_emoji || profile.name?.charAt(0)?.toUpperCase() || '?'}
            <div style="position:absolute;bottom:0;right:0;width:20px;height:20px;border-radius:50%;background:var(--color-bg);border:2px solid var(--color-border);display:flex;align-items:center;justify-content:center;font-size:10px">✏️</div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:var(--text-xl);font-weight:700;font-family:var(--font-display)">${profile.name || 'Usuário'}</div>
            <div style="font-size:var(--text-sm);color:var(--color-text-soft)">${user?.email || ''}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
              <div class="badge ${profile.plan === 'pro' ? 'badge-yellow' : 'badge-gray'}">${profile.plan === 'pro' ? '⭐ Pro' : 'Grátis'}</div>
              <div class="badge badge-gray">Nível ${level.num} · ${level.name}</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="location.hash='settings'">Editar</button>
        </div>

        <!-- XP Bar -->
        <div style="margin-top:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:var(--text-xs);color:var(--color-text-soft)">XP para o próximo nível</span>
            <span style="font-size:var(--text-xs);font-family:var(--font-mono)">${xpCurrent}/100</span>
          </div>
          <div class="progress-bar" style="height:6px">
            <div class="progress-bar-fill" style="width:${xpCurrent}%;background:var(--color-green);transition:width 0.8s ease"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Perfil comportamental -->
    <section style="margin-bottom:24px">
      <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Perfil Financeiro</h2>
      <div class="card">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
          <div style="font-size:48px">${coachProfile.emoji || '🧩'}</div>
          <div>
            <div style="font-size:var(--text-lg);font-weight:700">${coachProfile.name || 'Analisando...'}</div>
            <div style="font-size:var(--text-sm);color:var(--color-text-soft);max-width:320px">${coachProfile.desc || 'Continue registrando seus lançamentos para o Coach analisar seu perfil.'}</div>
          </div>
        </div>

        <!-- Score -->
        <div style="display:flex;align-items:center;gap:16px">
          <div style="text-align:center">
            <div style="font-size:var(--text-3xl);font-weight:800;font-family:var(--font-mono);color:${scoreColor}">${coachProfile.score}</div>
            <div style="font-size:var(--text-xs);color:var(--color-text-soft)">Score de saúde</div>
          </div>
          <div style="flex:1">
            <div class="progress-bar" style="height:12px;border-radius:8px">
              <div class="progress-bar-fill" style="width:${coachProfile.score}%;background:${scoreColor};transition:width 0.8s ease;border-radius:8px"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px">
              <span style="font-size:var(--text-xs);color:var(--color-red)">0</span>
              <span style="font-size:var(--text-xs);color:var(--color-yellow)">50</span>
              <span style="font-size:var(--text-xs);color:var(--color-green)">100</span>
            </div>
          </div>
        </div>

        <!-- Dicas de melhoria -->
        ${coachProfile.tips?.length ? `
          <div style="margin-top:16px;display:flex;flex-direction:column;gap:6px">
            ${coachProfile.tips.map(tip => `
              <div style="padding:8px 12px;border-radius:8px;background:var(--color-card-hover);font-size:var(--text-xs);display:flex;align-items:flex-start;gap:8px">
                <span>💡</span><span>${tip}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </section>

    <!-- Conquistas -->
    <section style="margin-bottom:24px">
      <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">
        Conquistas <span style="font-size:var(--text-sm);font-weight:400;color:var(--color-text-soft)">${earned.length}/${achievements.length}</span>
      </h2>

      ${earned.length ? `
        <div style="margin-bottom:16px">
          <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">Conquistadas</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
            ${earned.map(a => achievementCard(a, true)).join('')}
          </div>
        </div>
      ` : ''}

      ${pending.length ? `
        <div>
          <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">Em progresso</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
            ${pending.slice(0, 6).map(a => achievementCard(a, false)).join('')}
          </div>
        </div>
      ` : ''}
    </section>

    <!-- Programa de indicação -->
    <section style="margin-bottom:24px">
      <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Indique e Ganhe</h2>
      <div class="card">
        <div style="text-align:center;padding:8px 0 12px">
          <div style="font-size:36px;margin-bottom:8px">🎁</div>
          <div style="font-size:var(--text-md);font-weight:600;margin-bottom:4px">Indique o Finn para amigos</div>
          <div style="font-size:var(--text-sm);color:var(--color-text-soft);margin-bottom:16px">Seu código único de indicação:</div>
          <div style="display:flex;align-items:center;gap:8px;max-width:380px;margin:0 auto 20px">
            <div style="flex:1;padding:10px 14px;background:var(--color-card-hover);border-radius:8px;font-family:var(--font-mono);font-size:var(--text-sm);font-weight:600;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="referralCode">
              ${generateReferralCode(user?.email)}
            </div>
            <button class="btn btn-primary btn-sm" id="copyReferralBtn">Copiar</button>
          </div>
        </div>

        <!-- Contador -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
          <div style="padding:12px;background:var(--color-card-hover);border-radius:10px;text-align:center">
            <div style="font-size:var(--text-2xl);font-weight:700;font-family:var(--font-mono);color:var(--color-green)" id="referralTotal">0</div>
            <div style="font-size:var(--text-xs);color:var(--color-text-soft)">Amigos indicados</div>
          </div>
          <div style="padding:12px;background:var(--color-card-hover);border-radius:10px;text-align:center">
            <div style="font-size:var(--text-2xl);font-weight:700;font-family:var(--font-mono);color:var(--color-blue)" id="referralActive">0</div>
            <div style="font-size:var(--text-xs);color:var(--color-text-soft)">Ativos</div>
          </div>
        </div>

        <!-- Tiers de recompensa -->
        <div style="margin-bottom:16px">
          <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">Recompensas</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:var(--color-card-hover)">
              <span style="font-size:18px">🥉</span>
              <div style="flex:1;font-size:var(--text-sm)">1 amigo ativo</div>
              <span style="font-size:var(--text-xs);font-weight:600;color:var(--color-green)">1 mês Pro grátis</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:var(--color-card-hover)">
              <span style="font-size:18px">🥈</span>
              <div style="flex:1;font-size:var(--text-sm)">3 amigos ativos</div>
              <span style="font-size:var(--text-xs);font-weight:600;color:var(--color-yellow)">20% de desconto</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:var(--color-card-hover)">
              <span style="font-size:18px">🥇</span>
              <div style="flex:1;font-size:var(--text-sm)">5 amigos ativos</div>
              <span style="font-size:var(--text-xs);font-weight:600;color:var(--color-blue)">Finn Pro vitalício</span>
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" id="shareWhatsApp">📱 WhatsApp</button>
          <button class="btn btn-secondary btn-sm" id="shareEmail">✉️ E-mail</button>
          <button class="btn btn-secondary btn-sm" id="shareCopy">🔗 Copiar link</button>
        </div>
      </div>
    </section>

    <!-- Planos -->
    ${profile.plan !== 'pro' ? `
      <section style="margin-bottom:24px">
        <div class="card" style="background:linear-gradient(135deg,var(--color-green-dim),var(--color-card));border:1px solid var(--color-green)44">
          <div style="display:flex;align-items:center;gap:16px">
            <div style="font-size:40px">⭐</div>
            <div style="flex:1">
              <div style="font-size:var(--text-md);font-weight:700;margin-bottom:4px">Upgrade para o Pro</div>
              <div style="font-size:var(--text-sm);color:var(--color-text-soft)">Coach IA ilimitado, relatórios avançados, backup automático e muito mais</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="location.hash='upgrade'">Ver planos</button>
          </div>
        </div>
      </section>
    ` : ''}

    <!-- Zona de perigo -->
    <section>
      <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Zona de Perigo</h2>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-secondary btn-sm" style="justify-content:flex-start;color:var(--color-yellow)" id="exportDataBtn">📦 Exportar meus dados</button>
        <button class="btn btn-secondary btn-sm" style="justify-content:flex-start;color:var(--color-red)" id="deleteAccountBtn">🗑️ Excluir minha conta</button>
      </div>
    </section>
  `

  attachProfileEvents(el)
}

function achievementCard(a, earned) {
  return `
    <div style="padding:12px;border-radius:12px;background:${earned ? 'var(--color-green-dim)' : 'var(--color-card-hover)'};border:1px solid ${earned ? 'var(--color-green)44' : 'transparent'};display:flex;align-items:center;gap:10px;opacity:${earned ? 1 : 0.5}">
      <div style="font-size:28px;flex-shrink:0">${a.icon || '🏅'}</div>
      <div style="min-width:0">
        <div style="font-size:var(--text-sm);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.name}</div>
        <div style="font-size:var(--text-xs);color:var(--color-text-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.description || ''}</div>
        ${earned && a.earned_at ? `<div style="font-size:var(--text-xs);color:var(--color-green);margin-top:2px">${fmt.date(a.earned_at, 'short')}</div>` : ''}
      </div>
    </div>
  `
}

function calcLevel(score) {
  if (score >= 90) return { num: 5, name: 'Mestre' }
  if (score >= 70) return { num: 4, name: 'Expert' }
  if (score >= 50) return { num: 3, name: 'Avançado' }
  if (score >= 30) return { num: 2, name: 'Intermediário' }
  return { num: 1, name: 'Iniciante' }
}

function generateReferralCode(email) {
  if (!email) return 'FINN-XXXXX'
  const hash = email.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0)
  return 'FINN-' + Math.abs(hash).toString(36).toUpperCase().slice(0, 6)
}

function attachProfileEvents(el) {
  // Avatar picker
  document.getElementById('avatarEl')?.addEventListener('click', () => openAvatarPicker())

  // Carregar contador de indicados (best-effort)
  loadReferralStats()

  // Copy referral code
  document.getElementById('copyReferralBtn')?.addEventListener('click', () => {
    const code = document.getElementById('referralCode')?.textContent?.trim()
    navigator.clipboard?.writeText(code).then(() => Toast.success('Código copiado!')).catch(() => Toast.error('Não foi possível copiar'))
  })

  // Share buttons
  const code = document.getElementById('referralCode')?.textContent?.trim()
  const shareMsg = `Use meu código ${code} para criar sua conta no Finn — o app de finanças com IA! 🚀`
  const appUrl = 'https://getfinn.com.br'

  document.getElementById('shareWhatsApp')?.addEventListener('click', () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareMsg + ' ' + appUrl)}`, '_blank')
  })
  document.getElementById('shareEmail')?.addEventListener('click', () => {
    window.location.href = `mailto:?subject=Conheça o Finn&body=${encodeURIComponent(shareMsg + '\n\n' + appUrl)}`
  })
  document.getElementById('shareCopy')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(shareMsg + ' ' + appUrl).then(() => Toast.success('Link copiado!')).catch(() => Toast.error('Não foi possível copiar'))
  })

  // Export data
  document.getElementById('exportDataBtn')?.addEventListener('click', () => Toast.info('Exportação de dados em breve'))

  // Delete account
  document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
    Toast.warning('Para excluir sua conta, entre em contato com suporte@getfinn.com.br')
  })
}

async function loadReferralStats() {
  try {
    const data = await endpoints.achievements()
    // Usa o campo referral_count do perfil se disponível
    const profile = await endpoints.profile()
    const total = profile.referral_count || 0
    const active = profile.referral_active || 0
    const totalEl = document.getElementById('referralTotal')
    const activeEl = document.getElementById('referralActive')
    if (totalEl) totalEl.textContent = total
    if (activeEl) activeEl.textContent = active
  } catch {}
}

function openAvatarPicker() {
  const AVATARS = ['😀','😎','🦊','🐼','🦁','🐯','🐻','🦋','🦄','🐙','🌊','⚡','🔥','🌟','💎','🚀','🎯','🏆','💡','🌈']

  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal" style="max-width:360px">
      <div class="modal-header"><h3 class="modal-title">Escolher avatar</h3><button class="btn btn-icon" id="avClose">✕</button></div>
      <div class="modal-body">
        <div style="margin-bottom:12px">
          <label class="btn btn-secondary btn-sm" style="width:100%;text-align:center;cursor:pointer">
            📷 Enviar foto
            <input type="file" id="avFileInput" accept="image/*" style="display:none">
          </label>
        </div>
        <div style="font-size:var(--text-xs);color:var(--color-text-soft);margin-bottom:10px;text-align:center">ou escolha um emoji</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
          ${AVATARS.map(a => `<div class="avatar-opt" data-emoji="${a}" style="font-size:32px;text-align:center;padding:8px;border-radius:10px;cursor:pointer;background:var(--color-card-hover);transition:background 0.15s">${a}</div>`).join('')}
        </div>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('open'))

  const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300) }
  overlay.querySelector('#avClose')?.addEventListener('click', close)
  overlay.addEventListener('click', e => { if (e.target === overlay) close() })

  overlay.querySelector('#avFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { Toast.error('Foto muito grande (máx 2MB)'); return }
    try {
      const url = await uploadAvatar(file)
      await endpoints.updateProfile({ avatar_url: url, avatar_emoji: null })
      const avatarEl = document.getElementById('avatarEl')
      if (avatarEl) avatarEl.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"><div style="position:absolute;bottom:0;right:0;width:20px;height:20px;border-radius:50%;background:var(--color-bg);border:2px solid var(--color-border);display:flex;align-items:center;justify-content:center;font-size:10px">✏️</div>`
      Toast.success('Foto atualizada')
      close()
    } catch (err) { Toast.error(err.message) }
  })

  overlay.querySelectorAll('.avatar-opt').forEach(opt => {
    opt.addEventListener('mouseenter', () => { opt.style.background = 'var(--color-green-dim)' })
    opt.addEventListener('mouseleave', () => { opt.style.background = 'var(--color-card-hover)' })
    opt.addEventListener('click', async () => {
      const emoji = opt.dataset.emoji
      try {
        await endpoints.updateProfile({ avatar_emoji: emoji, avatar_url: null })
        const avatarEl = document.getElementById('avatarEl')
        if (avatarEl) {
          avatarEl.innerHTML = `${emoji}<div style="position:absolute;bottom:0;right:0;width:20px;height:20px;border-radius:50%;background:var(--color-bg);border:2px solid var(--color-border);display:flex;align-items:center;justify-content:center;font-size:10px">✏️</div>`
        }
        Toast.success('Avatar atualizado')
        close()
      } catch (err) { Toast.error(err.message) }
    })
  })
}

async function uploadAvatar(file) {
  const user = store.getUser()
  if (!user) throw new Error('Não autenticado')
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm')
  const supabaseUrl = 'https://hycblewhxfkbcduiwbmj.supabase.co'
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5Y2JsZXdoeGZrYmNkdWl3Ym1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3NjE4NDEsImV4cCI6MjA2MzMzNzg0MX0.9_RyRLxCGZxHgIJSdEfCjVWPdHnrJLH5hKzOiBfOlAw'
  const sb = createClient(supabaseUrl, supabaseKey)
  const ext = file.name.split('.').pop()
  const path = `${user.id}/avatar.${ext}`
  const { error } = await sb.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw new Error(error.message)
  const { data } = sb.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl + '?t=' + Date.now()
}
