import { endpoints } from '../core/api.js'
import { store } from '../core/store.js'
import { Toast, Loading } from '../core/notifications.js'

export async function render(el) {
  const profile = store.get('profile') || {}
  const isPro = profile.plan === 'pro'

  el.innerHTML = `
    <div style="flex:1;overflow-y:auto;padding:var(--space-6);max-width:640px;margin:0 auto;width:100%">

      <div style="text-align:center;margin-bottom:32px">
        <div style="font-size:40px;margin-bottom:8px">⚡</div>
        <h1 style="font-family:var(--font-display);font-size:var(--text-3xl);font-weight:800;margin-bottom:8px">Finn Pro</h1>
        <p style="color:var(--color-text-soft);font-size:var(--text-base)">Desbloqueie todo o potencial do Finn</p>
        ${isPro ? `<div class="badge badge-green" style="font-size:13px;padding:6px 16px;margin-top:8px">✅ Você já é Pro</div>` : ''}
      </div>

      <!-- Features -->
      <div class="card" style="margin-bottom:24px;padding:var(--space-5)">
        <div style="font-size:var(--text-sm);font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">O que está incluído</div>
        ${[
          ['🤖', 'Coach IA personalizado', 'Análises e dicas financeiras com IA'],
          ['📄', 'Importação de faturas PDF', 'Importe faturas de cartão automaticamente'],
          ['📊', 'Relatórios avançados', 'Gráficos e filtros detalhados por período'],
          ['🔄', 'Recorrência avançada', 'Lançamentos recorrentes com projeção futura'],
          ['💾', 'Exportação de dados', 'Exporte seus dados em CSV ou PDF'],
          ['🔔', 'Alertas inteligentes', 'Notificações sobre gastos e vencimentos'],
        ].map(([icon, title, desc]) => `
          <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--color-border)">
            <span style="font-size:20px;width:28px;text-align:center">${icon}</span>
            <div>
              <div style="font-size:var(--text-sm);font-weight:500">${title}</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-soft)">${desc}</div>
            </div>
            <span style="margin-left:auto;color:var(--color-green);font-size:16px">✓</span>
          </div>
        `).join('')}
      </div>

      <!-- Planos -->
      <div style="display:grid;gap:16px">

        <!-- Mensal -->
        <div class="card" style="padding:var(--space-6);border:2px solid var(--color-green)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div style="font-size:var(--text-lg);font-weight:700;color:var(--color-green)">Pro Mensal</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-soft)">Cancele quando quiser</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:var(--text-3xl);font-weight:800;font-family:var(--font-mono)">R$ 14<span style="font-size:var(--text-lg)">,90</span></div>
              <div style="font-size:var(--text-xs);color:var(--color-text-soft)">/mês</div>
            </div>
          </div>
          <button class="btn btn-primary" style="width:100%" id="btnMonthly" ${isPro ? 'disabled' : ''}>
            ${isPro ? 'Plano atual' : 'Assinar mensalmente'}
          </button>
        </div>

        <!-- Anual -->
        <div class="card" style="padding:var(--space-6);position:relative;overflow:hidden">
          <div style="position:absolute;top:12px;right:12px;background:var(--color-yellow);color:#000;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px">2 MESES GRÁTIS</div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div style="font-size:var(--text-lg);font-weight:700">Pro Anual</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-soft)">R$ 118,80/ano — economize R$ 60</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:var(--text-3xl);font-weight:800;font-family:var(--font-mono)">R$ 9<span style="font-size:var(--text-lg)">,90</span></div>
              <div style="font-size:var(--text-xs);color:var(--color-text-soft)">/mês</div>
            </div>
          </div>
          <button class="btn btn-secondary" style="width:100%" id="btnAnnual" ${isPro ? 'disabled' : ''}>
            ${isPro ? 'Plano atual' : 'Assinar anualmente'}
          </button>
        </div>

        <!-- Lifetime -->
        <div class="card" style="padding:var(--space-6)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div style="font-size:var(--text-lg);font-weight:700">Lifetime</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-soft)">Acesso vitalício, pague uma vez</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:var(--text-3xl);font-weight:800;font-family:var(--font-mono)">R$ 297</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-soft)">pagamento único</div>
            </div>
          </div>
          <button class="btn btn-secondary" style="width:100%" id="btnLifetime" ${isPro ? 'disabled' : ''}>
            ${isPro ? 'Obrigado!' : 'Comprar acesso vitalício'}
          </button>
        </div>

      </div>

      ${isPro ? `
        <div style="margin-top:24px;text-align:center">
          <button class="btn btn-ghost btn-sm" id="btnPortal">Gerenciar assinatura →</button>
        </div>
      ` : ''}

      <div style="margin-top:24px;text-align:center;font-size:var(--text-xs);color:var(--color-text-muted)">
        Pagamento seguro via Stripe · Cancele a qualquer momento
      </div>
    </div>
  `

  const checkout = async (e, plan) => {
    Loading.btn(e.target, true)
    try {
      const { url } = await endpoints.stripeCheckout({ plan })
      if (url) window.location.href = url
    } catch (err) {
      Toast.error(err.message || 'Erro ao iniciar checkout')
      Loading.btn(e.target, false)
    }
  }

  el.querySelector('#btnMonthly')?.addEventListener('click', e => checkout(e, 'monthly'))
  el.querySelector('#btnAnnual')?.addEventListener('click', e => checkout(e, 'annual'))
  el.querySelector('#btnLifetime')?.addEventListener('click', e => checkout(e, 'lifetime'))
  el.querySelector('#btnPortal')?.addEventListener('click', async e => {
    Loading.btn(e.target, true)
    try {
      const { url } = await endpoints.stripePortal()
      if (url) window.location.href = url
    } catch (err) {
      Toast.error(err.message || 'Erro')
      Loading.btn(e.target, false)
    }
  })
}
