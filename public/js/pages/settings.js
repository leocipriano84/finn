import { endpoints } from '../core/api.js'
import { store } from '../core/store.js'
import { Toast, Loading } from '../core/notifications.js'
import { auth } from '../core/auth.js'
import { Theme } from '../core/theme.js'

export async function render(el) {
  el.innerHTML = `
    <div style="flex:1;overflow-y:auto;padding:var(--space-5) var(--space-6);max-width:640px;margin:0 auto;width:100%">
      <div id="settingsBody"></div>
    </div>
  `
  await loadSettings()
}

async function loadSettings() {
  const body = document.getElementById('settingsBody')
  if (!body) return

  let prefs = {}
  let profile = {}
  try {
    [prefs, profile] = await Promise.all([endpoints.preferences(), endpoints.profile()])
  } catch {}

  const user = store.getUser()
  const scale = prefs.layout_scale || 100

  const DASHBOARD_CARDS = [
    { key: 'overview',           label: '📊 Visão geral' },
    { key: 'expense_chart',      label: '📈 Evolução das despesas' },
    { key: 'accounts',           label: '🏦 Contas' },
    { key: 'last_expenses',      label: '💸 Últimas despesas' },
    { key: 'last_incomes',       label: '💰 Últimas receitas' },
    { key: 'expense_by_category',label: '🏷️ Despesas por categoria' },
    { key: 'income_by_category', label: '🏷️ Receitas por categoria' },
    { key: 'recurrence',         label: '🔁 Despesas por recorrência' },
    { key: 'credit_cards',       label: '💳 Cartões de crédito' },
    { key: 'budgets',            label: '🎯 Orçamentos' },
    { key: 'goals',              label: '🏆 Objetivos' },
    { key: 'cashflow',           label: '💹 Fluxo de caixa' },
    { key: 'evolution',          label: '📅 Receitas x Despesas (anual)' },
  ]

  const activeWidgets = (prefs.summary_widgets || ['overview','expense_chart','accounts','last_expenses','expense_by_category'])

  body.innerHTML = `
    <!-- Conta -->
    <section style="margin-bottom:32px">
      <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Conta</h2>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--color-green-dim);border:2px solid var(--color-green);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;flex-shrink:0">
          ${profile.avatar_emoji || profile.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div>
          <div style="font-weight:600;font-size:var(--text-md)">${profile.name || 'Usuário'}</div>
          <div style="font-size:var(--text-sm);color:var(--color-text-soft)">${user?.email || ''}</div>
          <div class="badge ${profile.plan === 'pro' ? 'badge-yellow' : 'badge-gray'}" style="margin-top:4px">${profile.plan === 'pro' ? '⭐ Pro' : 'Grátis'}</div>
        </div>
        <button class="btn btn-secondary btn-sm" style="margin-left:auto" onclick="location.hash='upgrade'">Upgrade Pro</button>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Nome</label>
        <div style="display:flex;gap:8px">
          <input id="settingName" class="form-control" value="${profile.name || ''}" placeholder="Seu nome">
          <button class="btn btn-primary btn-sm" id="saveNameBtn">Salvar</button>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Alterar senha</label>
        <div id="pwdSection" style="display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-secondary btn-sm" id="showPwdBtn" style="align-self:flex-start">🔑 Alterar senha</button>
          <div id="pwdForm" style="display:none">
            <input id="newPwd" class="form-control" type="password" placeholder="Nova senha (mín. 6 caracteres)" style="margin-bottom:8px">
            <input id="newPwdConfirm" class="form-control" type="password" placeholder="Confirmar nova senha" style="margin-bottom:8px">
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm" id="savePwdBtn">Salvar nova senha</button>
              <button class="btn btn-secondary btn-sm" id="cancelPwdBtn">Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Aparência -->
    <section style="margin-bottom:32px">
      <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Aparência</h2>

      <div class="form-group" style="margin-bottom:20px">
        <label class="form-label">Tema</label>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button class="btn btn-secondary btn-sm theme-opt" data-theme-opt="dark" style="gap:6px">🌙 Escuro</button>
          <button class="btn btn-secondary btn-sm theme-opt" data-theme-opt="light" style="gap:6px">☀️ Claro</button>
          <button class="btn btn-secondary btn-sm theme-opt" data-theme-opt="system" style="gap:6px">⚙️ Sistema</button>
        </div>
        <div class="form-hint">Sistema segue automaticamente a preferência do dispositivo</div>
      </div>

      <div class="form-group" style="margin-bottom:0">
        <label class="form-label">Escala do layout</label>
        <div style="display:flex;align-items:center;gap:12px">
          <input id="scaleSlider" type="range" min="80" max="120" step="5" value="${scale}" style="flex:1">
          <span id="scaleLabel" style="font-family:var(--font-mono);font-size:var(--text-sm);min-width:40px">${scale}%</span>
        </div>
        <div class="form-hint">Ajusta o tamanho geral da interface (80% – 120%)</div>
      </div>
    </section>

    <!-- Resumo (Dashboard) -->
    <section style="margin-bottom:32px">
      <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Resumo</h2>
      <p style="font-size:var(--text-sm);color:var(--color-text-soft);margin-bottom:12px">Escolha quais cards aparecem no dashboard.</p>
      <div id="dashboardCards" style="display:flex;flex-direction:column;gap:6px">
        ${DASHBOARD_CARDS.map(c => `
          <label class="toggle-group" style="cursor:pointer">
            <div class="toggle-label">${c.label}</div>
            <label class="toggle">
              <input type="checkbox" data-widget="${c.key}" ${activeWidgets.includes(c.key) ? 'checked' : ''}>
              <span class="toggle-track"></span>
            </label>
          </label>
        `).join('')}
      </div>
    </section>

    <!-- Lançamentos — Despesas -->
    <section style="margin-bottom:32px">
      <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Lançamentos — Despesas</h2>
      ${renderToggle('prefOverdueFirst',  prefs.always_show_overdue_first !== false, 'Listar vencidas primeiro', 'Exibe despesas vencidas no topo da lista')}
      ${renderToggle('prefPendingFirst',  prefs.show_pending_first === true,         'Exibir pendentes primeiro')}
      ${renderToggle('prefFutureByDate',  prefs.order_future_by_due_date !== false,  'Ordenar futuras por vencimento')}
      ${renderToggle('prefBudgetAlert',   prefs.alert_budget_on_expense !== false,   'Alertar orçamentos ao cadastrar')}
      ${renderToggle('prefBalanceAlert',  prefs.alert_insufficient_balance !== false,'Alertar saldo insuficiente')}
      ${renderToggle('prefBalanceOnSave', prefs.show_balance_on_save !== false,      'Informar saldo ao salvar')}
      ${renderToggle('prefZebra',         prefs.zebra_list === true,                 'Zebrar listagens')}
      ${renderToggle('prefHighlight',     prefs.highlight_description === true,      'Destacar descrição e valor')}
      ${renderToggle('prefUppercase',     prefs.uppercase_description === true,      'Descrição em maiúsculo')}
    </section>

    <!-- Lançamentos — Receitas -->
    <section style="margin-bottom:32px">
      <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Lançamentos — Receitas</h2>
      ${renderToggle('prefIncomeOverdueFirst',  prefs.income_overdue_first !== false, 'Listar vencidas primeiro')}
      ${renderToggle('prefIncomePendingFirst',  prefs.income_pending_first === true,  'Exibir pendentes primeiro')}
      ${renderToggle('prefIncomeFutureByDate',  prefs.income_future_by_date !== false,'Ordenar futuras por vencimento')}
      ${renderToggle('prefIncomeBalanceOnSave', prefs.income_balance_on_save !== false,'Informar saldo ao salvar')}
    </section>

    <!-- Privacidade -->
    <section style="margin-bottom:32px">
      <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Privacidade e Segurança</h2>
      ${renderToggle('prefPin',       prefs.pin_enabled === true,       'PIN de 4 dígitos', 'Solicita PIN ao abrir o app')}
      <div id="pinConfig" style="display:${prefs.pin_enabled ? 'block' : 'none'};margin-left:0;margin-bottom:12px">
        <div style="background:var(--color-card-hover);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">PIN de 4 dígitos</label>
            <input id="pinInput" class="form-control" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="••••" style="letter-spacing:0.3em;max-width:120px">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Solicitar PIN após</label>
            <select id="pinTimeout" class="form-control" style="max-width:200px">
              <option value="5"  ${prefs.pin_timeout_minutes === 5  ? 'selected':''}>5 minutos</option>
              <option value="10" ${prefs.pin_timeout_minutes === 10 ? 'selected':''}>10 minutos</option>
              <option value="15" ${(prefs.pin_timeout_minutes === 15 || !prefs.pin_timeout_minutes) ? 'selected':''}>15 minutos</option>
              <option value="30" ${prefs.pin_timeout_minutes === 30 ? 'selected':''}>30 minutos</option>
              <option value="60" ${prefs.pin_timeout_minutes === 60 ? 'selected':''}>60 minutos</option>
            </select>
          </div>
          <button class="btn btn-primary btn-sm" id="savePinBtn" style="align-self:flex-start">Salvar PIN</button>
        </div>
      </div>
      ${renderToggle('prefBiometric', prefs.biometric_enabled === true,   'Biometria', 'Usa impressão digital ou Face ID')}
      ${renderToggle('prefBlur',      prefs.blur_on_switch !== false,     'Desfoque ao alternar apps', 'Protege seus dados ao sair temporariamente')}
    </section>

    <!-- Dados -->
    <section style="margin-bottom:32px">
      <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Dados</h2>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-secondary btn-sm" style="justify-content:flex-start" id="exportCsvBtn">📥 Exportar CSV</button>
        <button class="btn btn-secondary btn-sm" style="justify-content:flex-start" id="exportOfxBtn">📥 Exportar OFX</button>
        <button class="btn btn-secondary btn-sm" style="justify-content:flex-start" onclick="location.hash='tools'">📤 Importar dados</button>
      </div>
    </section>

    <!-- Sobre -->
    <section>
      <h2 style="font-family:var(--font-display);font-size:var(--text-lg);font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--color-border)">Sobre</h2>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:var(--text-sm);color:var(--color-text-soft)">
        <div style="display:flex;justify-content:space-between"><span>Versão</span><span style="font-family:var(--font-mono)">2.0.0</span></div>
        <div style="display:flex;justify-content:space-between"><span>Plataforma</span><span>PWA</span></div>
        <div><a href="#" style="color:var(--color-blue)">Termos de uso</a></div>
        <div><a href="#" style="color:var(--color-blue)">Política de privacidade</a></div>
        <div style="margin-top:16px;display:flex;gap:8px">
          <button class="btn btn-danger btn-sm" id="logoutBtn">Sair da conta</button>
        </div>
      </div>
    </section>
  `

  attachEvents(body, prefs)
}

function attachEvents(body, prefs) {
  // Salvar nome
  body.querySelector('#saveNameBtn')?.addEventListener('click', async (e) => {
    const name = body.querySelector('#settingName')?.value?.trim()
    if (!name) return
    Loading.btn(e.target, true)
    try { await endpoints.updateProfile({ name }); Toast.success('Nome atualizado') }
    catch (err) { Toast.error(err.message) }
    finally { Loading.btn(e.target, false) }
  })

  // Alterar senha
  body.querySelector('#showPwdBtn')?.addEventListener('click', () => {
    body.querySelector('#pwdForm').style.display = 'flex'
    body.querySelector('#pwdForm').style.flexDirection = 'column'
    body.querySelector('#showPwdBtn').style.display = 'none'
  })
  body.querySelector('#cancelPwdBtn')?.addEventListener('click', () => {
    body.querySelector('#pwdForm').style.display = 'none'
    body.querySelector('#showPwdBtn').style.display = ''
  })
  body.querySelector('#savePwdBtn')?.addEventListener('click', async (e) => {
    const pwd = body.querySelector('#newPwd')?.value
    const pwd2 = body.querySelector('#newPwdConfirm')?.value
    if (!pwd || pwd.length < 6) { Toast.error('Senha deve ter pelo menos 6 caracteres'); return }
    if (pwd !== pwd2) { Toast.error('As senhas não conferem'); return }
    Loading.btn(e.target, true)
    try {
      await auth.updatePassword(pwd)
      Toast.success('Senha alterada com sucesso')
      body.querySelector('#pwdForm').style.display = 'none'
      body.querySelector('#showPwdBtn').style.display = ''
    } catch (err) { Toast.error(err.message) }
    finally { Loading.btn(e.target, false) }
  })

  // Tema — botões de seleção
  function syncThemeButtons() {
    body.querySelectorAll('.theme-opt').forEach(btn => {
      btn.classList.toggle('btn-primary', btn.dataset.themeOpt === Theme.current)
      btn.classList.toggle('btn-secondary', btn.dataset.themeOpt !== Theme.current)
    })
  }
  syncThemeButtons()
  body.querySelectorAll('.theme-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      Theme.apply(btn.dataset.themeOpt)
      syncThemeButtons()
    })
  })

  // Slider de escala
  const slider = body.querySelector('#scaleSlider')
  const sliderLabel = body.querySelector('#scaleLabel')
  slider?.addEventListener('input', () => {
    const v = slider.value
    sliderLabel.textContent = v + '%'
    document.documentElement.style.fontSize = (16 * v / 100) + 'px'
    debounceSavePref({ layout_scale: Number(v) })
  })

  // Dashboard cards (widgets)
  body.querySelectorAll('[data-widget]').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const widgets = [...body.querySelectorAll('[data-widget]:checked')].map(t => t.dataset.widget)
      debounceSavePref({ summary_widgets: widgets })
    })
  })

  // Toggles de preferência
  body.querySelectorAll('[data-pref]').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const key = toggle.dataset.pref
      debounceSavePref({ [key]: toggle.checked })
      // Mostrar/ocultar config de PIN
      if (key === 'pin_enabled') {
        body.querySelector('#pinConfig').style.display = toggle.checked ? 'block' : 'none'
      }
    })
  })

  // Salvar PIN
  body.querySelector('#savePinBtn')?.addEventListener('click', async (e) => {
    const pin = body.querySelector('#pinInput')?.value
    const timeout = Number(body.querySelector('#pinTimeout')?.value) || 15
    if (!pin || !/^\d{4}$/.test(pin)) { Toast.error('PIN deve ter exatamente 4 dígitos'); return }
    Loading.btn(e.target, true)
    try {
      await endpoints.updatePrefs({ pin_code: pin, pin_timeout_minutes: timeout })
      Toast.success('PIN configurado')
    } catch (err) { Toast.error(err.message) }
    finally { Loading.btn(e.target, false) }
  })

  // Exportar CSV (em breve)
  body.querySelector('#exportCsvBtn')?.addEventListener('click', () => Toast.info('Exportação CSV em breve'))
  body.querySelector('#exportOfxBtn')?.addEventListener('click', () => Toast.info('Exportação OFX em breve'))

  // Logout
  body.querySelector('#logoutBtn')?.addEventListener('click', async () => {
    await auth.signOut()
    window.location.href = '/login.html'
  })
}

let prefSaveTimer = null
function debounceSavePref(updates) {
  clearTimeout(prefSaveTimer)
  prefSaveTimer = setTimeout(async () => {
    try { await endpoints.updatePrefs(updates) }
    catch {}
  }, 800)
}

function renderToggle(id, checked, label, sub = '') {
  return `
    <label class="toggle-group" style="cursor:pointer">
      <div><div class="toggle-label">${label}</div>${sub ? `<div class="toggle-sub">${sub}</div>` : ''}</div>
      <label class="toggle"><input type="checkbox" id="${id}" data-pref="${prefKeyMap[id] || id}" ${checked ? 'checked' : ''}><span class="toggle-track"></span></label>
    </label>
  `
}

const prefKeyMap = {
  prefOverdueFirst:        'always_show_overdue_first',
  prefPendingFirst:        'show_pending_first',
  prefFutureByDate:        'order_future_by_due_date',
  prefBudgetAlert:         'alert_budget_on_expense',
  prefBalanceAlert:        'alert_insufficient_balance',
  prefBalanceOnSave:       'show_balance_on_save',
  prefZebra:               'zebra_list',
  prefHighlight:           'highlight_description',
  prefUppercase:           'uppercase_description',
  prefIncomeOverdueFirst:  'income_overdue_first',
  prefIncomePendingFirst:  'income_pending_first',
  prefIncomeFutureByDate:  'income_future_by_date',
  prefIncomeBalanceOnSave: 'income_balance_on_save',
  prefPin:                 'pin_enabled',
  prefBiometric:           'biometric_enabled',
  prefBlur:                'blur_on_switch',
}
