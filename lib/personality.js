// lib/personality.js
// Sistema de Identidade Financeira do Finn
// Calcula o perfil comportamental e gamificação do usuário

// ─── Perfis financeiros ───
export const PROFILES = {
  impulsive: {
    id: 'impulsive',
    name: 'O Impulsivo',
    emoji: '🦁',
    color: '#FF6B6B',
    description: 'Você vive o presente ao máximo — mas o futuro pede atenção.',
    traits: ['Gasta por emoção', 'Compras por impulso', 'Dificuldade em poupar'],
    nextProfile: 'aware',
    tips: [
      'Espere 48h antes de compras acima de R$100',
      'Crie um envelope de "gastos livres" com limite semanal',
      'Identifique seus gatilhos emocionais de compra'
    ]
  },
  aware: {
    id: 'aware',
    name: 'O Consciente',
    emoji: '🦊',
    color: '#FFA500',
    description: 'Você já percebe seus padrões. Agora é hora de agir.',
    traits: ['Sabe onde erra', 'Começa metas mas não termina', 'Oscila no controle'],
    nextProfile: 'planner',
    tips: [
      'Automatize a poupança (débito automático no dia do salário)',
      'Defina 1 meta pequena e celebre quando atingir',
      'Use a regra 50/30/20: necessidades/desejos/poupança'
    ]
  },
  planner: {
    id: 'planner',
    name: 'O Planejador',
    emoji: '🐝',
    color: '#00C9FF',
    description: 'Você tem disciplina. Falta otimizar para crescer.',
    traits: ['Controla gastos', 'Tem metas definidas', 'Ainda conservador em investimentos'],
    nextProfile: 'optimizer',
    tips: [
      'Comece a investir mesmo que R$50/mês',
      'Revise suas metas a cada 3 meses',
      'Estude sobre renda variável de forma gradual'
    ]
  },
  optimizer: {
    id: 'optimizer',
    name: 'O Otimizador',
    emoji: '🦅',
    color: '#00F5A0',
    description: 'Você domina o jogo financeiro. Inspire outros.',
    traits: ['Investe regularmente', 'Reserva de emergência completa', 'Metas de longo prazo'],
    nextProfile: null,
    tips: [
      'Diversifique entre renda fixa e variável',
      'Considere previdência privada',
      'Planeje sua independência financeira'
    ]
  }
}

// ─── Conquistas (Achievements) ───
export const ACHIEVEMENTS = [
  {
    id: 'first_transaction',
    name: 'Primeiro Passo',
    emoji: '👣',
    description: 'Registrou sua primeira transação',
    condition: (stats) => stats.totalTransactions >= 1,
    xp: 50
  },
  {
    id: 'week_streak',
    name: 'Semana Consistente',
    emoji: '🔥',
    description: '7 dias seguidos usando o Finn',
    condition: (stats) => stats.streak >= 7,
    xp: 100
  },
  {
    id: 'first_goal',
    name: 'Sonhador Real',
    emoji: '🎯',
    description: 'Criou sua primeira meta',
    condition: (stats) => stats.totalGoals >= 1,
    xp: 75
  },
  {
    id: 'saved_500',
    name: 'Poupador Iniciante',
    emoji: '🐖',
    description: 'Economizou R$500 em um mês',
    condition: (stats) => stats.monthlySavings >= 500,
    xp: 150
  },
  {
    id: 'saved_2000',
    name: 'Poupador Avançado',
    emoji: '💰',
    description: 'Economizou R$2.000 em um mês',
    condition: (stats) => stats.monthlySavings >= 2000,
    xp: 300
  },
  {
    id: 'bank_connected',
    name: 'Open Finance',
    emoji: '🏦',
    description: 'Conectou sua conta bancária',
    condition: (stats) => stats.bankConnected,
    xp: 200
  },
  {
    id: 'score_80',
    name: 'Saúde Financeira',
    emoji: '💚',
    description: 'Atingiu score 80 ou mais',
    condition: (stats) => stats.score >= 80,
    xp: 250
  },
  {
    id: 'goal_completed',
    name: 'Meta Alcançada',
    emoji: '🏆',
    description: 'Completou uma meta financeira',
    condition: (stats) => stats.completedGoals >= 1,
    xp: 200
  },
  {
    id: 'month_streak',
    name: 'Mês Perfeito',
    emoji: '🌟',
    description: '30 dias seguidos usando o Finn',
    condition: (stats) => stats.streak >= 30,
    xp: 500
  },
  {
    id: 'profile_evolved',
    name: 'Evolução Real',
    emoji: '🦋',
    description: 'Avançou para um novo perfil financeiro',
    condition: (stats) => stats.profileEvolutions >= 1,
    xp: 300
  }
]

// ─── Calcula o perfil baseado nos dados do usuário ───
export function calculateProfile(stats) {
  const {
    savingsRate,       // % de renda poupada (0-1)
    impulsivePurchases, // nº de compras impulsivas (tarde da noite, fins de semana)
    goalCompletion,    // % de metas completadas (0-1)
    investmentAmount,  // valor investido no mês
    streak             // dias consecutivos de uso
  } = stats

  let score = 0

  // Taxa de poupança (0-40 pontos)
  score += Math.min(savingsRate * 80, 40)

  // Controle de impulso (0-20 pontos)
  const impulseControl = Math.max(0, 1 - impulsivePurchases / 10)
  score += impulseControl * 20

  // Cumprimento de metas (0-20 pontos)
  score += goalCompletion * 20

  // Investimento (0-20 pontos)
  score += investmentAmount > 0 ? 20 : 0

  if (score < 25) return PROFILES.impulsive
  if (score < 50) return PROFILES.aware
  if (score < 75) return PROFILES.planner
  return PROFILES.optimizer
}

// ─── Detecta compras impulsivas ───
export function detectImpulsivePurchases(transactions) {
  return transactions.filter(tx => {
    if (tx.type !== 'expense') return false
    const hour = new Date(tx.date).getHours()
    const day = new Date(tx.date).getDay()
    const isNight = hour >= 22 || hour <= 5
    const isWeekend = day === 0 || day === 6
    const isImpulsiveCategory = ['lazer', 'compras', 'alimentacao'].includes(tx.category)
    return (isNight || isWeekend) && isImpulsiveCategory && tx.amount > 50
  }).length
}

// ─── Calcula XP total do usuário ───
export function calculateXP(achievements) {
  return achievements.reduce((total, id) => {
    const achievement = ACHIEVEMENTS.find(a => a.id === id)
    return total + (achievement?.xp || 0)
  }, 0)
}

// ─── Calcula nível baseado em XP ───
export function calculateLevel(xp) {
  // Nível aumenta a cada 500 XP
  const level = Math.floor(xp / 500) + 1
  const currentLevelXP = (level - 1) * 500
  const nextLevelXP = level * 500
  const progress = (xp - currentLevelXP) / (nextLevelXP - currentLevelXP)

  return {
    level,
    xp,
    currentLevelXP,
    nextLevelXP,
    progress, // 0-1
    title: getLevelTitle(level)
  }
}

function getLevelTitle(level) {
  if (level < 3) return 'Iniciante'
  if (level < 6) return 'Aprendiz'
  if (level < 10) return 'Intermediário'
  if (level < 15) return 'Avançado'
  if (level < 20) return 'Expert'
  return 'Mestre Financeiro'
}

// ─── Verifica e retorna novas conquistas desbloqueadas ───
export function checkNewAchievements(stats, existingAchievements) {
  const newOnes = []

  for (const achievement of ACHIEVEMENTS) {
    if (existingAchievements.includes(achievement.id)) continue
    if (achievement.condition(stats)) {
      newOnes.push(achievement)
    }
  }

  return newOnes
}

// ─── Gera insights comportamentais para o Coach ───
export function generateBehavioralInsights(transactions, profile) {
  const insights = []

  // Analisa padrão por dia da semana
  const byDay = Array(7).fill(0)
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const day = new Date(t.date).getDay()
      byDay[day] += t.amount
    })

  const maxDay = byDay.indexOf(Math.max(...byDay))
  const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

  if (Math.max(...byDay) > 0) {
    insights.push({
      type: 'spending_day',
      message: `Você gasta mais nas ${days[maxDay]}s`,
      value: Math.max(...byDay),
      actionable: `Defina um limite de gastos para ${days[maxDay]}`
    })
  }

  // Analisa categoria mais cara
  const byCategory = {}
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount
    })

  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
  if (topCategory) {
    insights.push({
      type: 'top_category',
      message: `${topCategory[0]} é sua maior despesa`,
      value: topCategory[1],
      actionable: `Tente reduzir ${topCategory[0]} em 10% esse mês`
    })
  }

  return insights
}
