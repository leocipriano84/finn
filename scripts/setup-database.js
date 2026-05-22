require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

async function setup() {
  const sql1 = fs.readFileSync(path.join(__dirname, '../lib/database.sql'), 'utf8')
  const sql2 = fs.readFileSync(path.join(__dirname, '../lib/database-extra.sql'), 'utf8')

  console.log('Executando database.sql...')
  const { error: e1 } = await supabase.rpc('exec_sql', { sql: sql1 })
  if (e1) console.error('Erro database.sql:', e1.message)
  else console.log('database.sql OK')

  console.log('Executando database-extra.sql...')
  const { error: e2 } = await supabase.rpc('exec_sql', { sql: sql2 })
  if (e2) console.error('Erro database-extra.sql:', e2.message)
  else console.log('database-extra.sql OK')
}

setup().catch(console.error)
