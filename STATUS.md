# Finn — Status do Projeto

**Última atualização:** 2026-05-22
**Sessão:** 1 de N

---

## URLs de Produção

| | URL |
|---|---|
| App (alias permanente) | https://finn-teal.vercel.app |
| GitHub | https://github.com/leocipriano84/finn |
| Supabase | https://supabase.com/dashboard/project/ybllxqhhbwxvapektypx |
| Vercel | https://vercel.com/leandro-cipriano/finn |

---

## O que foi feito (Sessão 1)

- [x] Instalação de dependências (npm, Vercel CLI, dotenv, web-push)
- [x] `.env.local` configurado com todas as credenciais
- [x] Chaves VAPID geradas para PWA
- [x] Stripe: produto + preços mensal/anual criados
- [x] Supabase: 9 tabelas criadas e verificadas
- [x] 11 testes de integração passando
- [x] GitHub: repositório `leocipriano84/finn` com 23 arquivos
- [x] Vercel: 11 variáveis de ambiente em produção
- [x] Deploy em produção funcionando
- [x] Webhook do Stripe configurado

---

## IDs Importantes

| Serviço | ID |
|---|---|
| Supabase project | `ybllxqhhbwxvapektypx` (dois L's!) |
| Stripe produto | `prod_UYyuRe8kpcB5gN` |
| Stripe preço mensal | `price_1TZqwXIW8GST0cWVYJ78UjmJ` |
| Stripe preço anual | `price_1TZqwXIW8GST0cWVvvUkbfVY` |
| Stripe webhook | `we_1TZrXMIW8GST0cWVLlSJUmeJ` |
| Vercel project | `prj_X8wLErl1ZSDM5DfxFClVCZqmxtBl` |

---

## Pendente

- [ ] `ANTHROPIC_API_KEY` — depositar créditos em console.anthropic.com e atualizar na Vercel
- [ ] `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` — criar conta em pluggy.ai
- [ ] Domínio `getfinn.com.br` — pronto ~01/06/2026

---

## Fase 2 — Quando o domínio estiver pronto (~01/06/2026)

```bash
vercel domains add getfinn.com.br
# Configurar DNS no Registro.br conforme instruções da Vercel

vercel env rm APP_URL production
# Digitar: https://getfinn.com.br
vercel env add APP_URL production
vercel --prod
```

Depois atualizar o webhook do Stripe para `https://getfinn.com.br/api/stripe/webhook`
no dashboard: https://dashboard.stripe.com/webhooks

---

## Problemas conhecidos

1. **`vercel dev` não funciona localmente** — loop recursivo. Usar `node scripts/test-local.mjs` para testes.
2. **Git não está no PATH** — usar `& "C:\Program Files\Git\bin\git.exe"` ou abrir Git Bash.
3. **Supabase URL tinha typo no PROMPT original** — já corrigido no `.env.local` e Vercel.

---

## Scripts disponíveis

| Script | Função |
|---|---|
| `node scripts/test-local.mjs` | Testa APIs e banco localmente |
| `node scripts/setup-stripe.js` | Cria produto/preços no Stripe |
| `node scripts/setup-stripe-webhook.js` | Cria/recria webhook no Stripe |
| `node scripts/setup-database.js` | Tenta rodar SQLs no Supabase (usar painel manual) |
| `vercel --prod` | Deploy em produção |
| `& "C:\Program Files\Git\bin\git.exe" push` | Push para GitHub |
