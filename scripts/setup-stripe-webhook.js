require('dotenv').config({ path: '.env.local' })
const Stripe = require('stripe')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

async function setup() {
  const appUrl = process.env.APP_URL

  const webhook = await stripe.webhookEndpoints.create({
    url: appUrl + '/api/stripe/webhook',
    enabled_events: [
      'checkout.session.completed',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'customer.subscription.deleted',
      'customer.subscription.paused'
    ],
    description: 'Finn webhook principal'
  })

  console.log('Webhook criado:', webhook.id)
  console.log('STRIPE_WEBHOOK_SECRET=' + webhook.secret)
  console.log('\nAtualize o .env.local e a Vercel com esse valor!')
}

setup().catch(console.error)
