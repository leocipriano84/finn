// api/stripe/checkout.js
// Cria uma sessão de pagamento no Stripe e redireciona o cliente

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const ALLOWED_ORIGINS = [
  'https://getfinn.com.br',
  'https://www.getfinn.com.br',
  'http://localhost:3000'
]

export default async function handler(req, res) {
  const origin = req.headers.origin
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

  // Valida JWT do usuário via Supabase
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado' })
  }

  const token = authHeader.split(' ')[1]
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return res.status(401).json({ error: 'Token inválido' })
  }

  // Busca perfil do usuário
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, plan, name')
    .eq('id', user.id)
    .single()

  if (profile?.plan === 'pro') {
    return res.status(400).json({ error: 'Você já é Pro!' })
  }

  try {
    // Cria ou reutiliza customer no Stripe
    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.name || '',
        metadata: { supabase_user_id: user.id }
      })
      customerId = customer.id

      // Salva o customer_id no perfil
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Cria sessão de checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // ID do plano criado no Stripe
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `${process.env.APP_URL}/dashboard?upgrade=success`,
      cancel_url: `${process.env.APP_URL}/dashboard?upgrade=cancelled`,
      locale: 'pt-BR',
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { supabase_user_id: user.id }
      }
    })

    return res.status(200).json({ url: session.url })

  } catch (err) {
    console.error('[stripe/checkout] error:', err)
    return res.status(500).json({ error: 'Erro ao criar sessão de pagamento' })
  }
}
