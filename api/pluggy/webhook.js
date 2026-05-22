// api/pluggy/webhook.js
// Recebe notificações do Pluggy quando novos dados bancários chegam
// Salva transações automaticamente no Supabase

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Mapa de categorias Pluggy → categorias Finn
const CATEGORY_MAP = {
  'Food and Drink': 'alimentacao',
  'Restaurants': 'alimentacao',
  'Groceries': 'mercado',
  'Transportation': 'transporte',
  'Ride Share': 'transporte',
  'Gas Stations': 'transporte',
  'Travel': 'viagem',
  'Entertainment': 'lazer',
  'Health': 'saude',
  'Pharmacy': 'saude',
  'Education': 'educacao',
  'Shopping': 'compras',
  'Bills and Utilities': 'contas',
  'Transfer': 'transferencia',
  'Salary': 'salario',
  'Investment': 'investimento',
  'Other': 'outros'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const event = req.body

  console.log('[pluggy/webhook] Evento:', event.event)

  try {
    switch (event.event) {

      // Novas transações disponíveis
      case 'item/updated': {
        const itemId = event.itemId
        const clientUserId = event.clientUserId // = supabase user id

        if (!clientUserId) break

        // Busca transações dos últimos 90 dias no Pluggy
        const txRes = await fetch(
          `https://api.pluggy.ai/transactions?itemId=${itemId}&from=${getNDaysAgo(90)}`,
          { headers: { 'X-API-KEY': await getPluggyApiKey() } }
        )

        const { results: transactions } = await txRes.json()

        if (!transactions?.length) break

        // Formata para o padrão Finn
        const formatted = transactions.map(tx => ({
          user_id: clientUserId,
          external_id: tx.id, // evita duplicatas
          amount: Math.abs(tx.amount),
          type: tx.amount < 0 ? 'expense' : 'income',
          category: CATEGORY_MAP[tx.category] || 'outros',
          description: tx.description || tx.merchant?.name || 'Transação',
          date: tx.date.split('T')[0],
          source: 'open_finance',
          bank_name: tx.accountId,
          created_at: new Date().toISOString()
        }))

        // Upsert — insere novas, ignora duplicatas pelo external_id
        const { error } = await supabase
          .from('transactions')
          .upsert(formatted, {
            onConflict: 'external_id',
            ignoreDuplicates: true
          })

        if (error) console.error('[pluggy/webhook] Upsert error:', error)
        else console.log(`[pluggy/webhook] ${formatted.length} transações salvas para user ${clientUserId}`)

        // Recalcula o score financeiro do usuário
        await recalcScore(clientUserId)

        break
      }

      // Conexão com banco expirou — avisar usuário
      case 'item/error': {
        const clientUserId = event.clientUserId
        if (clientUserId) {
          await supabase
            .from('bank_connections')
            .update({ status: 'error', updated_at: new Date().toISOString() })
            .eq('user_id', clientUserId)
            .eq('item_id', event.itemId)
        }
        break
      }

      // Conexão removida pelo usuário
      case 'item/deleted': {
        const clientUserId = event.clientUserId
        if (clientUserId) {
          await supabase
            .from('bank_connections')
            .update({ status: 'disconnected', updated_at: new Date().toISOString() })
            .eq('user_id', clientUserId)
            .eq('item_id', event.itemId)
        }
        break
      }
    }

    return res.status(200).json({ received: true })

  } catch (err) {
    console.error('[pluggy/webhook] Erro:', err)
    return res.status(500).end()
  }
}

// ─── Helpers ───

async function getPluggyApiKey() {
  const res = await fetch('https://api.pluggy.ai/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET
    })
  })
  const { apiKey } = await res.json()
  return apiKey
}

function getNDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// Recalcula o score financeiro baseado no comportamento
async function recalcScore(userId) {
  const { data: txs } = await supabase
    .from('transactions')
    .select('amount, type, category, date')
    .eq('user_id', userId)
    .gte('date', getNDaysAgo(30))

  if (!txs?.length) return

  const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const savingsRate = income > 0 ? (income - expense) / income : 0

  // Score de 0-100 baseado em múltiplos fatores
  let score = 50

  // Taxa de poupança (+30 pontos máx)
  score += Math.min(savingsRate * 100, 30)

  // Diversificação de categorias (+10 pontos)
  const categories = new Set(txs.map(t => t.category))
  score += Math.min(categories.size * 2, 10)

  // Consistência de renda (+10 pontos)
  const hasIncome = income > 0
  if (hasIncome) score += 10

  score = Math.max(0, Math.min(100, Math.round(score)))

  await supabase
    .from('profiles')
    .update({ score, updated_at: new Date().toISOString() })
    .eq('id', userId)
}
