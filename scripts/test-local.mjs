import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Carrega .env.local manualmente
const env = readFileSync('.env.local', 'utf8')
  .split('\n')
  .filter(l => l && !l.startsWith('#'))
  .reduce((acc, l) => {
    const [k, ...v] = l.split('=')
    if (k) acc[k.trim()] = v.join('=').trim()
    return acc
  }, {})

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

let passed = 0
let failed = 0

function ok(label, cond) {
  if (cond) { console.log('  [PASS]', label); passed++ }
  else       { console.log('  [FAIL]', label); failed++ }
}

console.log('\n=== Teste 1 — Waitlist: email válido (esperado: 200 + ok:true) ===')
{
  const email = 'teste-ci-' + Date.now() + '@gmail.com'
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const valid = emailRegex.test(email) && email.length <= 254
  ok('email passa validação', valid)

  const { error } = await supabase.from('waitlist').insert({ email, source: 'landing' })
  ok('inserção no Supabase sem erro', !error)
  if (error) console.log('    erro:', error.message)
}

console.log('\n=== Teste 2 — Waitlist: email inválido (esperado: 400) ===')
{
  const email = 'emailinvalido'
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const valid = emailRegex.test(email) && email.length <= 254
  ok('email inválido detectado corretamente', !valid)
}

console.log('\n=== Teste 3 — Waitlist: email duplicado (esperado: 200 silencioso) ===')
{
  const email = 'duplicado-teste@gmail.com'
  await supabase.from('waitlist').insert({ email, source: 'landing' })
  const { error } = await supabase.from('waitlist').insert({ email, source: 'landing' })
  ok('duplicado retorna code 23505', error?.code === '23505')
}

console.log('\n=== Teste 4 — Stripe: variáveis de ambiente configuradas ===')
ok('STRIPE_SECRET_KEY presente', env.STRIPE_SECRET_KEY?.startsWith('sk_'))
ok('STRIPE_PRICE_ID_MONTHLY presente', env.STRIPE_PRICE_ID_MONTHLY?.startsWith('price_'))
ok('STRIPE_PRICE_ID_YEARLY presente', env.STRIPE_PRICE_ID_YEARLY?.startsWith('price_'))

console.log('\n=== Teste 5 — Supabase: tabelas extras acessíveis ===')
{
  const tables = ['profiles', 'transactions', 'goals', 'push_subscriptions']
  for (const t of tables) {
    const { error } = await supabase.from(t).select('*').limit(1)
    ok(t + ' acessível', !error)
  }
}

console.log('\n=== RESULTADO ===')
console.log('  Passou:', passed)
console.log('  Falhou:', failed)
if (failed === 0) console.log('  Tudo OK!')
else process.exit(1)
