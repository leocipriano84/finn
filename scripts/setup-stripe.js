require('dotenv').config({ path: '.env.local' })
const Stripe = require('stripe')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

async function setup() {
  console.log('Criando produtos no Stripe...')

  const product = await stripe.products.create({
    name: 'Finn Coach Pro',
    description: 'Coach financeiro com IA, análise comportamental e Open Finance',
    metadata: { app: 'finn' }
  })
  console.log('Produto criado:', product.id)

  const monthly = await stripe.prices.create({
    product: product.id,
    unit_amount: 1900,
    currency: 'brl',
    recurring: { interval: 'month' },
    nickname: 'Mensal'
  })
  console.log('STRIPE_PRICE_ID_MONTHLY=' + monthly.id)

  const yearly = await stripe.prices.create({
    product: product.id,
    unit_amount: 15200,
    currency: 'brl',
    recurring: { interval: 'year' },
    nickname: 'Anual 2 meses gratis'
  })
  console.log('STRIPE_PRICE_ID_YEARLY=' + yearly.id)

  console.log('\nCopie os IDs acima e atualize o .env.local!')
}

setup().catch(console.error)
