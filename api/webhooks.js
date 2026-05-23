import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export const config = { api: { bodyParser: false } }

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const rawBody = await getRawBody(req)
  let event

  try {
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)
  } catch (e) {
    return res.status(400).json({ error: 'Assinatura inválida' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.user_id
        if (userId) {
          await supabase.from('profiles').update({ plan: 'pro', updated_at: new Date().toISOString() }).eq('id', userId)
        }
        break
      }
      case 'invoice.payment_succeeded': {
        if (event.data.object.billing_reason === 'subscription_cycle') {
          const customer = await stripe.customers.retrieve(event.data.object.customer)
          const userId = customer.metadata?.supabase_uid
          if (userId) await supabase.from('profiles').update({ plan: 'pro' }).eq('id', userId)
        }
        break
      }
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        const customer = await stripe.customers.retrieve(event.data.object.customer)
        const userId = customer.metadata?.supabase_uid
        if (userId) await supabase.from('profiles').update({ plan: 'free' }).eq('id', userId)
        break
      }
    }
    return res.status(200).json({ received: true })
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao processar evento' })
  }
}
