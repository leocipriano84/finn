/* global FinnAuth, FinnUI */
(function () {
  'use strict';

  let _client = null;
  let _configPromise = null;

  async function loadConfig() {
    if (!_configPromise) {
      _configPromise = fetch('/api/auth?action=config').then(r => r.json());
    }
    return _configPromise;
  }

  async function getClient() {
    if (_client) return _client;
    const config = await loadConfig();
    if (!config.supabaseUrl) {
      console.error('Finn: supabaseUrl não configurado');
      return null;
    }
    const { createClient } = window.supabase;
    _client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'finn_session'
      }
    });
    return _client;
  }

  async function getSession() {
    const client = await getClient();
    if (!client) return null;
    const { data: { session } } = await client.auth.getSession();
    return session;
  }

  async function getToken() {
    const session = await getSession();
    return session?.access_token || null;
  }

  async function getUser() {
    const session = await getSession();
    return session?.user || null;
  }

  async function checkAuth(redirectIfNot = '/login.html') {
    try {
      const session = await getSession();
      if (!session) {
        if (redirectIfNot) window.location.href = redirectIfNot;
        return null;
      }
      return session;
    } catch {
      if (redirectIfNot) window.location.href = redirectIfNot;
      return null;
    }
  }

  async function logout() {
    try {
      const client = await getClient();
      if (client) await client.auth.signOut();
    } catch { /* ignore */ }
    window.location.href = '/login.html';
  }

  async function apiCall(url, options = {}) {
    const token = await getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    let body = options.body;
    if (body && typeof body !== 'string' && !(body instanceof FormData)) {
      body = JSON.stringify(body);
      if (body instanceof FormData) delete headers['Content-Type'];
    }

    return fetch(url, { ...options, headers, body });
  }

  window.FinnAuth = { getClient, getSession, getToken, getUser, checkAuth, logout, apiCall };

  // ─── UI utilities ───
  function toast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  function formatMonthYear(date = new Date()) {
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  function relativeTime(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min atrás`;
    if (hours < 24) return `${hours}h atrás`;
    if (days === 1) return 'ontem';
    if (days < 7) return `${days} dias atrás`;
    return formatDate(dateStr.split('T')[0]);
  }

  function confirm(opts) {
    return new Promise(resolve => {
      let overlay = document.getElementById('finn-confirm');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'finn-confirm';
        overlay.className = 'confirm-overlay hidden';
        overlay.innerHTML = `
          <div class="confirm-box">
            <div class="confirm-icon" id="cIcon">⚠️</div>
            <div class="confirm-title" id="cTitle">Confirmar</div>
            <div class="confirm-text" id="cText"></div>
            <div class="confirm-actions">
              <button class="btn btn-secondary" id="cCancel">Cancelar</button>
              <button class="btn btn-danger" id="cConfirm">Confirmar</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
      }
      document.getElementById('cIcon').textContent = opts.icon || '⚠️';
      document.getElementById('cTitle').textContent = opts.title || 'Confirmar';
      document.getElementById('cText').textContent = opts.text || '';
      const confirmBtn = document.getElementById('cConfirm');
      confirmBtn.textContent = opts.confirmText || 'Confirmar';
      confirmBtn.className = `btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`;
      overlay.classList.remove('hidden');
      const close = (val) => {
        overlay.classList.add('hidden');
        resolve(val);
      };
      document.getElementById('cCancel').onclick = () => close(false);
      confirmBtn.onclick = () => close(true);
      overlay.onclick = (e) => { if (e.target === overlay) close(false); };
    });
  }

  function setNavUser(name, plan) {
    const avatar = document.getElementById('sidebarAvatar');
    const nameEl = document.getElementById('sidebarName');
    const planEl = document.getElementById('sidebarPlan');
    if (avatar) avatar.textContent = (name || '?').charAt(0).toUpperCase();
    if (nameEl) nameEl.textContent = name || 'Usuário';
    if (planEl) planEl.textContent = plan === 'pro' ? '✦ Coach Pro' : 'Plano Grátis';
  }

  window.FinnUI = { toast, formatCurrency, formatDate, formatDateShort, formatMonthYear, relativeTime, confirm, setNavUser };
})();
