# 🤖 FINN — Guia Master para o Claude Code
### Versão completa com Pagamentos, Coach IA e Segurança

---

## ESTRUTURA COMPLETA DO PROJETO

```
finn/
├── public/
│   └── index.html              ← Landing page com lista de espera
├── api/
│   ├── waitlist.js             ← Salva emails da lista de espera
│   ├── coach.js                ← Coach IA (exclusivo Pro)
│   └── stripe/
│       ├── checkout.js         ← Cria sessão de pagamento
│       ├── webhook.js          ← Recebe eventos do Stripe
│       └── portal.js           ← Portal de gerenciamento da assinatura
├── lib/
│   ├── supabase.js             ← Cliente Supabase reutilizável
│   ├── withPro.js              ← Middleware de autenticação e plano
│   └── database.sql            ← SQL completo do banco
├── .env.local                  ← Credenciais (NUNCA subir no Git)
├── .gitignore
├── vercel.json                 ← Config de deploy + headers de segurança
└── package.json                ← Dependências
```

---

## CREDENCIAIS NECESSÁRIAS

Crie as contas e separe antes de iniciar o Claude Code:

### 1. Supabase (supabase.com — grátis)
- New Project → nome: finn
- Settings → API → copiar:
  - Project URL → SUPABASE_URL
  - anon public → SUPABASE_ANON_KEY
  - service_role secret → SUPABASE_SERVICE_KEY

### 2. Vercel (vercel.com — grátis)
- Criar conta com GitHub
- vercel.com/account/tokens → Create Token → VERCEL_TOKEN

### 3. Anthropic (console.anthropic.com)
- API Keys → Create Key → ANTHROPIC_API_KEY

### 4. Stripe (stripe.com — grátis para criar)
- dashboard.stripe.com → Developers → API Keys:
  - Secret key → STRIPE_SECRET_KEY (use sk_test_ para testar)
- Criar produto:
  - Products → Add Product
  - Nome: "Finn Coach Pro"
  - Preço: R$ 19,00 / mês (recorrente)
  - Copiar o Price ID → STRIPE_PRICE_ID
- Criar webhook:
  - Developers → Webhooks → Add endpoint
  - URL: https://getfinn.com.br/api/stripe/webhook
  - Eventos: checkout.session.completed, invoice.payment_succeeded,
    invoice.payment_failed, customer.subscription.deleted,
    customer.subscription.paused
  - Copiar Signing secret → STRIPE_WEBHOOK_SECRET

### 5. GitHub (github.com)
- Criar repositório privado chamado finn
- Copiar URL do repositório

---

## PROMPT PARA O CLAUDE CODE

Abra o Claude Code na pasta do projeto e cole:

---

Você é o assistente de deploy do projeto Finn.

Tenho as seguintes credenciais:

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
APP_URL=https://getfinn.com.br
GITHUB_REPO=https://github.com/seu-usuario/finn

Por favor execute em ordem:

1. Instale as dependências com npm install
2. Crie o arquivo .env.local com todas as credenciais acima
3. Rode o SQL completo de lib/database.sql no Supabase
4. Teste localmente com vercel dev
5. Commit e push para o GitHub
6. Deploy na Vercel com vercel --prod
7. Configure todas as environment variables na Vercel
8. Configure o domínio getfinn.com.br na Vercel
9. Registre o webhook do Stripe apontando para a URL de produção
10. Verifique o checklist completo abaixo

Corrija qualquer erro automaticamente antes de prosseguir.

---

## FLUXO DE PAGAMENTO

1. Usuário clica "Assinar Pro" no dashboard
2. Frontend chama POST /api/stripe/checkout com JWT no header
3. Backend valida JWT e retorna URL do Stripe Checkout
4. Cliente paga no Stripe (cartão, Pix ou boleto)
5. Stripe chama POST /api/stripe/webhook
6. Backend atualiza profiles.plan = 'pro' no Supabase
7. Usuário redirecionado para /dashboard?upgrade=success com acesso Pro

---

## CHECKLIST PÓS-DEPLOY

Landing page
- [ ] https://getfinn.com.br abre corretamente
- [ ] HTTPS ativo
- [ ] Formulário salva email no Supabase

Waitlist API
- [ ] POST /api/waitlist email válido → 200
- [ ] POST /api/waitlist email inválido → 400
- [ ] POST /api/waitlist 4x seguidas → 429

Stripe
- [ ] POST /api/stripe/checkout sem auth → 401
- [ ] POST /api/stripe/checkout com auth → URL do Stripe
- [ ] Pagamento de teste aprovado (cartão 4242 4242 4242 4242)
- [ ] Após pagamento → profiles.plan = 'pro' no Supabase
- [ ] POST /api/stripe/portal → URL do portal de gerenciamento
- [ ] Cancelamento via portal → profiles.plan = 'free'

Coach IA
- [ ] POST /api/coach sem auth → 401
- [ ] POST /api/coach plano free → 403
- [ ] POST /api/coach plano pro → resposta do Claude

Segurança
- [ ] Headers de segurança ativos (securityheaders.com)
- [ ] .env.local não está no GitHub
- [ ] SERVICE_KEY nunca exposta no frontend

---

## CARTÕES DE TESTE STRIPE

| Cenário              | Número                  |
|----------------------|-------------------------|
| Aprovado             | 4242 4242 4242 4242     |
| Recusado             | 4000 0000 0000 0002     |
| 3D Secure            | 4000 0025 0000 3155     |
| Falha na renovação   | 4000 0000 0000 0341     |

CVV: qualquer 3 dígitos | Validade: qualquer data futura

---

## PRÓXIMOS SPRINTS

Sprint 2 — Autenticação
  Supabase Auth com /signup, /login e /dashboard protegido

Sprint 3 — Dashboard financeiro
  Cards de resumo, formulário de transações, gráfico por categoria

Sprint 4 — Coach no dashboard
  Chat com histórico, animação de digitando, paywall para free

Sprint 5 — Relatório semanal automático
  Vercel Cron + Anthropic + Resend, enviado todo domingo para usuários Pro

---

## CUSTO ATUAL

Vercel free:           R$ 0
Supabase free:         R$ 0
Stripe (3,99%+R$0,39): só paga quando vender
Anthropic pay-per-use: ~R$ 0,05 por conversa
Domínio anual:         ~R$ 40/ano
UptimeRobot free:      R$ 0

Total fixo: ~R$ 3,50/mês

Com 100 assinantes Pro (R$19/mês):
  Receita bruta:  R$ 1.900
  Stripe fees:    R$   -80
  Anthropic:      R$  -250
  Lucro líquido:  R$ 1.570/mês
