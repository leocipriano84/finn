// api/stripe/portal.js
// Abre o portal do cliente Stripe para gerenciar assinatura
// O cliente pode cancelar, trocar cartão, ver faturas — sem você programar nada

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Valida JWT
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Não autenticado' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Token inválido' })

  // Busca customer_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return res.status(400).json({ error: 'Nenhuma assinatura encontrada' })
  }

  try {
    // Cria sessão do portal de gerenciamento
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.APP_URL}/dashboard`
    })

    return res.status(200).json({ url: session.url })

  } catch (err) {
    console.error('[stripe/portal] error:', err)
    return res.status(500).json({ error: 'Erro ao abrir portal' })
  }
}
