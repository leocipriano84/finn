// Wrapper de chamadas à API — todas as requests passam por aqui
import { auth } from './auth.js'
import { Sync } from './sync.js'

const BASE = '/api'
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

async function request(path, options = {}) {
  const session = await auth.getSession()
  const token = session?.access_token
  const method = (options.method || 'GET').toUpperCase()
  const isWrite = WRITE_METHODS.has(method)

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  }

  if (isWrite) Sync.start()

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    })

    if (res.status === 204) {
      if (isWrite) Sync.done()
      return null
    }

    const data = await res.json().catch(() => ({ error: 'Resposta inválida do servidor' }))

    if (!res.ok) {
      if (isWrite) Sync.fail()
      const err = new Error(data?.error || `Erro ${res.status}`)
      err.status = res.status
      err.data = data
      throw err
    }

    if (isWrite) Sync.done()
    return data
  } catch (e) {
    if (isWrite) Sync.fail()
    throw e
  }
}

export const api = {
  get:    (path, params) => {
    const url = params ? `${path}?${new URLSearchParams(params)}` : path
    return request(url, { method: 'GET' })
  },
  post:   (path, body)   => request(path, { method: 'POST',   body }),
  put:    (path, body)   => request(path, { method: 'PUT',    body }),
  patch:  (path, body)   => request(path, { method: 'PATCH',  body }),
  delete: (path, params) => {
    const url = params ? `${path}?${new URLSearchParams(params)}` : path
    return request(url, { method: 'DELETE' })
  },
}

// Endpoints nomeados — facilita uso nas páginas
export const endpoints = {
  // Accounts
  accounts:        ()      => api.get('/accounts'),
  accountBalance:  (p)     => api.get('/accounts', { action: 'balance', ...p }),
  createAccount:   (d)     => api.post('/accounts', d),
  updateAccount:   (id, d) => api.put(`/accounts?id=${id}`, d),
  deleteAccount:   (id)    => api.delete(`/accounts?id=${id}`),

  // Transactions
  transactions:    (p)     => api.get('/transactions', p),
  getTransaction:  (id)    => api.get('/transactions', { id, single: '1' }),
  txSummary:       (p)     => api.get('/transactions', { action: 'summary', ...p }),
  createTx:        (d)     => api.post('/transactions', d),
  updateTx:        (id, d) => api.put(`/transactions?id=${id}`, d),
  deleteTx:        (id, s) => api.delete(`/transactions?id=${id}&scope=${s || 'single'}`),
  confirmTx:       (id)    => api.post('/transactions', { action: 'confirm', id }),
  bulkConfirmTx:   (d)     => api.post('/transactions', { action: 'bulk-confirm', ...d }),

  // Cards
  cards:           ()      => api.get('/cards'),
  cardInvoices:    (p)     => api.get('/cards', { action: 'invoices', ...p }),
  createCard:      (d)     => api.post('/cards', d),
  updateCard:      (id, d) => api.put(`/cards?id=${id}`, d),
  deleteCard:      (id)    => api.delete(`/cards?id=${id}`),
  payInvoice:      (d)     => api.post('/cards', { action: 'payment', ...d }),

  // Categories
  categories:      ()      => api.get('/categories'),
  createCategory:  (d)     => api.post('/categories', d),
  updateCategory:  (id, d) => api.put(`/categories?id=${id}`, d),
  deleteCategory:  (id)    => api.delete(`/categories?id=${id}`),
  seedCategories:  ()      => api.post('/categories', { action: 'defaults' }),

  // Reports
  dashboard:       (p)     => api.get('/reports', { action: 'summary', ...p }),
  charts:          (p)     => api.get('/reports', { action: 'charts', ...p }),
  categoryReport:  (p)     => api.get('/reports', { action: 'categories', ...p }),
  evolution:       (p)     => api.get('/reports', { action: 'evolution', ...p }),
  annualReport:    (p)     => api.get('/reports', { action: 'annual', ...p }),
  cashflow:        (p)     => api.get('/reports', { action: 'cashflow', ...p }),

  // Budgets
  budgets:         (p)     => api.get('/budgets', p),
  budgetProgress:  (p)     => api.get('/budgets', { action: 'progress', ...p }),
  createBudget:    (d)     => api.post('/budgets', d),
  updateBudget:    (id, d) => api.put(`/budgets?id=${id}`, d),
  deleteBudget:    (id)    => api.delete(`/budgets?id=${id}`),

  // Goals
  goals:           ()      => api.get('/goals'),
  createGoal:      (d)     => api.post('/goals', d),
  updateGoal:      (id, d) => api.put(`/goals?id=${id}`, d),
  deleteGoal:      (id)    => api.delete(`/goals?id=${id}`),
  depositGoal:     (d)     => api.post('/goals', { action: 'deposit', ...d }),

  // Coach
  coachChat:              (msg)              => api.post('/coach', { action: 'chat', message: msg }),
  coachReport:            ()                 => api.get('/coach', { action: 'report' }),
  coachProfile:           ()                 => api.get('/coach', { action: 'profile' }),
  coachHistory:           ()                 => api.get('/coach', { action: 'history' }),
  coachParseInvoice:      (pdfText)          => api.post('/coach', { action: 'parse-invoice', pdfText }),
  coachParseReceipt:      (pdfText)          => api.post('/coach', { action: 'parse-receipt', pdfText }),
  coachParseReceiptImage: (imageBase64, mediaType) => api.post('/coach', { action: 'parse-receipt-image', imageBase64, mediaType }),

  // User
  profile:         ()      => api.get('/user', { action: 'profile' }),
  updateProfile:   (d)     => api.put('/user', { action: 'profile', ...d }),
  preferences:     ()      => api.get('/user', { action: 'preferences' }),
  updatePrefs:     (d)     => api.put('/user', { action: 'preferences', ...d }),
  achievements:    ()      => api.get('/user', { action: 'achievements' }),
  auditLog:        ()      => api.get('/user', { action: 'audit-log' }),
  restoreTx:       (d)     => api.post('/user', { action: 'restore-transaction', ...d }),
  clearData:       ()      => api.post('/user', { action: 'clear-data' }),
  deleteMyAccount: ()      => api.post('/user', { action: 'delete-account' }),
}
