import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function getUserId(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.id ?? null
}

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Moradia',       icon: '🏠', color: '#A855F7', subs: ['Aluguel','Condomínio','IPTU','Água','Luz','Gás','Internet','Telefone','Fixas','Outros'] },
  { name: 'Alimentação',   icon: '🍔', color: '#FF9A3C', subs: ['Supermercado','Restaurante','Delivery','Lanche','Outros'] },
  { name: 'Transporte',    icon: '🚗', color: '#00C9FF', subs: ['Combustível','Estacionamento','Uber/99','Manutenção','IPVA','Seguro','Outros'] },
  { name: 'Saúde',         icon: '💊', color: '#00F5A0', subs: ['Plano de Saúde','Consultas','Medicamentos','Academia','Outros'] },
  { name: 'Educação',      icon: '🎓', color: '#06B6D4', subs: ['Escola','Faculdade','Cursos','Livros','Outros'] },
  { name: 'Vestuário',     icon: '👕', color: '#EC4899', subs: ['Roupas','Calçados','Acessórios','Outros'] },
  { name: 'Lazer',         icon: '🎮', color: '#FFD93D', subs: ['Streaming','Jogos','Viagens','Passeios','Outros'] },
  { name: 'Finanças',      icon: '💰', color: '#6b7280', subs: ['Juros','Tarifas','IOF','Outros'] },
  { name: 'Compras',       icon: '🛒', color: '#FF6B6B', subs: ['Eletrônicos','Casa','Presentes','Outros'] },
  { name: 'Família',       icon: '👥', color: '#C084FC', subs: ['Filhos','Pets','Outros'] },
  { name: 'Outros',        icon: '🔧', color: '#374151', subs: ['Outros'] },
]

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Fixa',          icon: '💼', color: '#00C9FF', subs: ['Salário','Pro-Labore','Aposentadoria','Outros'] },
  { name: 'Variável',      icon: '💸', color: '#00F5A0', subs: ['Freelance','Bônus','Comissão','Outros'] },
  { name: 'Investimentos', icon: '📈', color: '#FFD93D', subs: ['Dividendos','Rendimentos','CDB','Outros'] },
  { name: 'Outros',        icon: '🎁', color: '#6b7280', subs: ['Presente','Herança','Venda','Outros'] },
]

export default async function handler(req, res) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Não autenticado' })

  const { id, action } = req.query

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('categories')
      .select('*').eq('user_id', userId).eq('archived', false).order('sort_order').order('name')
    if (error) return res.status(500).json({ error: error.message })

    // Aninhar subcategorias
    const roots = (data || []).filter(c => !c.parent_id)
    const nested = roots.map(root => ({
      ...root,
      children: (data || []).filter(c => c.parent_id === root.id)
    }))
    return res.status(200).json(nested)
  }

  if (req.method === 'POST') {
    if (action === 'defaults' || req.body?.action === 'defaults') {
      // Verifica se já tem categorias
      const { count } = await supabase.from('categories').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      if (count > 0) return res.status(200).json({ skipped: true })

      const toInsert = []

      for (const [i, cat] of DEFAULT_EXPENSE_CATEGORIES.entries()) {
        const parentId = crypto.randomUUID()
        toInsert.push({ id: parentId, user_id: userId, name: cat.name, type: 'expense', icon: cat.icon, color: cat.color, is_default: true, sort_order: i })
        cat.subs.forEach((sub, j) => {
          toInsert.push({ id: crypto.randomUUID(), user_id: userId, name: sub, type: 'expense', icon: cat.icon, color: cat.color, is_default: true, parent_id: parentId, sort_order: j })
        })
      }

      for (const [i, cat] of DEFAULT_INCOME_CATEGORIES.entries()) {
        const parentId = crypto.randomUUID()
        toInsert.push({ id: parentId, user_id: userId, name: cat.name, type: 'income', icon: cat.icon, color: cat.color, is_default: true, sort_order: i })
        cat.subs.forEach((sub, j) => {
          toInsert.push({ id: crypto.randomUUID(), user_id: userId, name: sub, type: 'income', icon: cat.icon, color: cat.color, is_default: true, parent_id: parentId, sort_order: j })
        })
      }

      const { error } = await supabase.from('categories').insert(toInsert)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json({ created: toInsert.length })
    }

    const { name, type, icon, color, parent_id, sort_order } = req.body || {}
    if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios' })

    const { data, error } = await supabase.from('categories').insert({
      id: crypto.randomUUID(),
      user_id: userId, name: String(name).substring(0,80), type,
      icon: icon || '📦', color: color || '#6b7280',
      parent_id: parent_id || null, sort_order: sort_order || 0
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  if (req.method === 'PUT' && id) {
    const fields = ['name','type','icon','color','parent_id','sort_order','archived']
    const updates = {}
    for (const f of fields) {
      if (req.body?.[f] !== undefined) updates[f] = req.body[f]
    }
    const { data, error } = await supabase.from('categories').update(updates)
      .eq('id', id).eq('user_id', userId).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE' && id) {
    const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('category_id', id)
    if (count > 0) {
      const { error } = await supabase.from('categories').update({ archived: true }).eq('id', id).eq('user_id', userId)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ archived: true })
    }
    await supabase.from('categories').delete().eq('parent_id', id).eq('user_id', userId)
    const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', userId)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Método não permitido' })
}
