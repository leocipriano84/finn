// Supabase auth — carregado via CDN no HTML
let _supabase = null

function getClient() {
  if (_supabase) return _supabase
  if (typeof window !== 'undefined' && window.__supabase) {
    _supabase = window.__supabase
    return _supabase
  }
  throw new Error('Supabase client não inicializado')
}

export const auth = {
  async getSession() {
    const { data } = await getClient().auth.getSession()
    return data?.session ?? null
  },

  async getUser() {
    const { data } = await getClient().auth.getUser()
    return data?.user ?? null
  },

  async signIn(email, password) {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  async signUp(email, password, name) {
    const { data, error } = await getClient().auth.signUp({
      email,
      password,
      options: { data: { name } }
    })
    if (error) throw error
    return data
  },

  async signOut() {
    await getClient().auth.signOut()
  },

  async resetPassword(email) {
    const { error } = await getClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login.html?reset=1`
    })
    if (error) throw error
  },

  async updatePassword(newPassword) {
    const { error } = await getClient().auth.updateUser({ password: newPassword })
    if (error) throw error
  },

  onAuthStateChange(callback) {
    return getClient().auth.onAuthStateChange(callback)
  },

  // Guarda redirecionamento para após login
  setRedirect(url) {
    sessionStorage.setItem('finn_redirect', url)
  },

  getRedirect() {
    return sessionStorage.getItem('finn_redirect') || '/app.html'
  },

  clearRedirect() {
    sessionStorage.removeItem('finn_redirect')
  },

  async requireAuth() {
    const session = await auth.getSession()
    if (!session) {
      auth.setRedirect(window.location.href)
      window.location.href = '/login.html'
      return null
    }
    return session
  }
}
