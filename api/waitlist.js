// api/waitlist.js
// Vercel Serverless Function — roda no servidor, nunca no browser

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Rate limiting simples em memória por IP
const rateLimit = new Map()
const LIMIT = 3
const WINDOW = 60000 // 1 minuto

function checkRate(ip) {
  const now = Date.now()
  const entry = rateLimit.get(ip) || { count: 0, start: now }
  if (now - entry.start > WINDOW) {
    rateLimit.set(ip, { count: 1, start: now })
    return true
  }
  if (entry.count >= LIMIT) return false
  rateLimit.set(ip, { count: entry.count + 1, start: entry.start })
  return true
}

const ALLOWED_ORIGINS = [
  'https://getfinn.com.br',
  'https://www.getfinn.com.br',
  'http://localhost:3000' // para desenvolvimento local
]

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Preflight
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Só POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress
  if (!checkRate(ip)) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde 1 minuto.' })
  }

  // Validação
  const { email, source } = req.body || {}
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email obrigatório' })
  }

  const cleaned = email.trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(cleaned) || cleaned.length > 254) {
    return res.status(400).json({ error: 'Email inválido' })
  }

  // Salva no Supabase
  const { error } = await supabase
    .from('waitlist')
    .insert({
      email: cleaned,
      source: source || 'landing'
    })

  if (error) {
    // Duplicado — não revela que já existe (privacidade)
    if (error.code === '23505') {
      return res.status(200).json({ ok: true, message: 'Você já está na lista!' })
    }
    console.error('[waitlist] Supabase error:', error)
    return res.status(500).json({ error: 'Erro interno. Tente novamente.' })
  }

  return res.status(200).json({ ok: true, message: 'Cadastrado com sucesso!' })
}
