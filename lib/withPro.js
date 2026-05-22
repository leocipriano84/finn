// lib/withPro.js
// Middleware reutilizável — protege rotas que exigem plano Pro
// Use assim: export default withPro(handler)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export function withAuth(handler) {
  return async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      return res.status(401).json({ error: 'Não autenticado. Faça login.' })
    }

    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' })
    }

    // Injeta user no request para usar no handler
    req.user = user
    return handler(req, res)
  }
}

export function withPro(handler) {
  return withAuth(async (req, res) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', req.user.id)
      .single()

    if (profile?.plan !== 'pro') {
      return res.status(403).json({
        error: 'Feature exclusiva do plano Pro.',
        upgrade_url: '/dashboard?upgrade=true'
      })
    }

    return handler(req, res)
  })
}

// Exemplo de uso em uma rota Pro:
//
// import { withPro } from '../lib/withPro'
//
// async function handler(req, res) {
//   // req.user já está disponível aqui
//   return res.json({ message: 'Bem-vindo, usuário Pro!' })
// }
//
// export default withPro(handler)
