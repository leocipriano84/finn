// api/pluggy/connect.js
// Inicia a conexão Open Finance via Pluggy
// Retorna um connect_token para abrir o widget no frontend

import { withAuth } from '../../lib/withPro'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    // Gera API key do Pluggy (válida por 2 horas)
    const authRes = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: process.env.PLUGGY_CLIENT_ID,
        clientSecret: process.env.PLUGGY_CLIENT_SECRET
      })
    })

    const { apiKey } = await authRes.json()

    // Cria connect token para o widget
    const tokenRes = await fetch('https://api.pluggy.ai/connect_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      },
      body: JSON.stringify({
        clientUserId: req.user.id, // liga a conexão ao usuário Finn
        webhookUrl: `${process.env.APP_URL}/api/pluggy/webhook`
      })
    })

    const { accessToken } = await tokenRes.json()

    return res.status(200).json({ accessToken })

  } catch (err) {
    console.error('[pluggy/connect] error:', err)
    return res.status(500).json({ error: 'Erro ao conectar com Open Finance' })
  }
}

// Autenticação obrigatória (qualquer plano pode conectar banco)
import { withAuth as auth } from '../../lib/withPro'
export default auth(handler)
