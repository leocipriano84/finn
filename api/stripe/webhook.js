// api/stripe/webhook.js
// Recebe eventos do Stripe e atualiza o banco automaticamente
// IMPORTANTE: esta rota precisa receber o body RAW (não parsed)

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Desabilita o body parser padrão do Next/Vercel para esta rota
export const config = {
  api: { bodyParser: false }
}

// Lê o body como buffer raw (necessário para verificar assinatura do Stripe)
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const rawBody = await getRawBody(req)
  const signature = req.headers['stripe-signature']

  let event

  // Verifica que o evento veio realmente do Stripe (segurança crítica)
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('[webhook] Assinatura inválida:', err.message)
    return res.status(400).json({ error: 'Assinatura inválida' })
  }

  console.log('[webhook] Evento recebido:', event.type)

  try {
    switch (event.type) {

      // Pagamento bem-sucedido — ativa o plano Pro
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.subscription_data?.metadata?.supabase_user_id
          || session.metadata?.supabase_user_id

        if (userId) {
          await supabase
            .from('profiles')
            .update({
              plan: 'pro',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)

          console.log(`[webhook] Plano Pro ativado para user ${userId}`)
        }
        break
      }

      // Renovação mensal — mantém o Pro ativo
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        if (invoice.billing_reason === 'subscription_cycle') {
          const customer = await stripe.customers.retrieve(invoice.customer)
          const userId = customer.metadata?.supabase_user_id

          if (userId) {
            await supabase
              .from('profiles')
              .update({
                plan: 'pro',
                updated_at: new Date().toISOString()
              })
              .eq('id', userId)

            console.log(`[webhook] Renovação confirmada para user ${userId}`)
          }
        }
        break
      }

      // Pagamento falhou — mantém acesso por 3 dias (grace period)
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const customer = await stripe.customers.retrieve(invoice.customer)
        const userId = customer.metadata?.supabase_user_id

        if (userId) {
          console.warn(`[webhook] Pagamento falhou para user ${userId} — aguardando retry`)
          // Stripe tentará novamente automaticamente nos próximos dias
          // Só rebaixa para free após cancelamento definitivo
        }
        break
      }

      // Assinatura cancelada — rebaixa para free
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customer = await stripe.customers.retrieve(subscription.customer)
        const userId = customer.metadata?.supabase_user_id

        if (userId) {
          await supabase
            .from('profiles')
            .update({
              plan: 'free',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)

          console.log(`[webhook] Plano rebaixado para free, user ${userId}`)
        }
        break
      }

      // Assinatura pausada (cliente pediu pausa)
      case 'customer.subscription.paused': {
        const subscription = event.data.object
        const customer = await stripe.customers.retrieve(subscription.customer)
        const userId = customer.metadata?.supabase_user_id

        if (userId) {
          await supabase
            .from('profiles')
            .update({
              plan: 'free',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)
        }
        break
      }

      default:
        console.log(`[webhook] Evento ignorado: ${event.type}`)
    }

    return res.status(200).json({ received: true })

  } catch (err) {
    console.error('[webhook] Erro ao processar evento:', err)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
