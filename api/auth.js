import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  const { action } = req.query

  if (req.method === 'POST') {
    if (action === 'signup') {
      const { email, password, name } = req.body || {}
      if (!email || !password || !name) return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' })

      const { data, error } = await supabaseAnon.auth.signUp({
        email, password,
        options: { data: { name } }
      })
      if (error) return res.status(400).json({ error: error.message })
      return res.status(201).json({ user: data.user, session: data.session })
    }

    if (action === 'login') {
      const { email, password } = req.body || {}
      if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' })

      const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password })
      if (error) return res.status(401).json({ error: 'Email ou senha incorretos' })
      return res.status(200).json({ user: data.user, session: data.session })
    }

    if (action === 'logout') {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (token) await supabaseAnon.auth.signOut()
      return res.status(200).json({ ok: true })
    }

    if (action === 'forgot') {
      const { email } = req.body || {}
      if (!email) return res.status(400).json({ error: 'Email obrigatório' })
      const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.APP_URL || 'https://finn-teal.vercel.app'}/login.html?reset=1`
      })
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }
  }

  if (req.method === 'GET' && action === 'config') {
    return res.status(200).json({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    })
  }

  if (req.method === 'GET' && action === 'session') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ authenticated: false })
    const { data } = await supabase.auth.getUser(token)
    if (!data?.user) return res.status(401).json({ authenticated: false })
    return res.status(200).json({ authenticated: true, user: data.user })
  }

  return res.status(405).json({ error: 'Método não permitido' })
}
