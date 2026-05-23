import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function getUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.id ?? null
}

const PLANS = [
  {
    id: 'monthly',
    name: 'Finn Pro Mensal',
    price: 19.00,
    price_id: process.env.STRIPE_PRICE_ID_MONTHLY,
    period: 'mês',
    features: ['Lançamentos ilimitados', 'Coach IA', 'Open Finance', 'Gráficos avançados', 'Exportação CSV/OFX'],
  },
  {
    id: 'yearly',
    name: 'Finn Pro Anual',
    price: 152.00,
    price_id: process.env.STRIPE_PRICE_ID_YEARLY,
    period: 'ano',
    monthly_price: 12.67,
    discount: '33%',
    features: ['Tudo do mensal', 'Economize 33%', 'Prioridade no suporte'],
  },
]

export default async function handler(req, res) {
  const { action } = req.query

  if (req.method === 'GET' && action === 'plans') {
    return res.status(200).json(PLANS)
  }

  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Não autenticado' })

  if (req.method === 'POST') {
    if (action === 'checkout') {
      const { plan_id, success_url, cancel_url } = req.body || {}
      const plan = PLANS.find(p => p.id === plan_id)
      if (!plan) return res.status(400).json({ error: 'Plano inválido' })

      const { data: profile } = await supabase.from('profiles').select('stripe_customer_id, name').eq('id', userId).single()
      const { data: authUser } = await supabase.auth.admin.getUserById(userId)

      let customerId = profile?.stripe_customer_id
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: authUser?.user?.email,
          name: profile?.name,
          metadata: { supabase_uid: userId }
        })
        customerId = customer.id
        await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', userId)
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: plan.price_id, quantity: 1 }],
        mode: 'subscription',
        success_url: success_url || `${process.env.APP_URL}/app.html#settings?upgraded=1`,
        cancel_url: cancel_url || `${process.env.APP_URL}/app.html#upgrade`,
        locale: 'pt-BR',
        metadata: { user_id: userId }
      })

      return res.status(200).json({ url: session.url, session_id: session.id })
    }

    if (action === 'portal') {
      const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', userId).single()
      if (!profile?.stripe_customer_id) return res.status(400).json({ error: 'Sem assinatura ativa' })

      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${process.env.APP_URL}/app.html#settings`,
      })
      return res.status(200).json({ url: session.url })
    }
  }

  return res.status(405).json({ error: 'Método não permitido' })
}
