// lib/supabase.js
// Cliente Supabase reutilizável para as Vercel Functions

import { createClient } from '@supabase/supabase-js'

// Cliente público (frontend) — usa ANON_KEY
export const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// Cliente admin (backend) — usa SERVICE_KEY, nunca expor no frontend
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
