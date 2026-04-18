/**
 * UDBHAV'26 Admin Panel — Shared Module
 * ─────────────────────────────────────────────────────────────────
 * AdminAuth:          Login / logout / session management
 * RegistrationStore:  CRUD on localStorage, search, filter, sort, paginate
 * AdminUI:            Toast notifications, sidebar, modals
 * ─────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════════
// AUTH
// Credentials are validated SERVER-SIDE via /api/admin/login.
// No credentials are stored in this file.
// ═══════════════════════════════════════════════════════════════════
const AUTH_KEY    = 'udbhav_admin_token';
const AUTH_TIME   = 'udbhav_admin_time';
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours

export const AdminAuth = {
  /**
   * Sends credentials to the server for validation.
   * On success, stores the returned token in localStorage.
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async login(username, password) {
    try {
      const res  = await fetch('/api/admin/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem(AUTH_KEY,  data.token);
        localStorage.setItem(AUTH_TIME, Date.now().toString());
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Invalid credentials.' };
    } catch (err) {
      return { ok: false, error: 'Network error. Please try again.' };
    }
  },

  logout() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_TIME);
  },

  isAuthenticated() {
    const token = localStorage.getItem(AUTH_KEY);
    const time  = parseInt(localStorage.getItem(AUTH_TIME) || '0', 10);
    if (!token) return false;
    if (Date.now() - time > SESSION_TTL) {
      this.logout();
      return false;
    }
    return true;
  },

  /** Returns the stored token for use in X-Admin-Secret header. */
  getToken() {
    return localStorage.getItem(AUTH_KEY) || '';
  },

  guard() {
    if (!this.isAuthenticated()) {
      window.location.href = '/admin/login.html';
      return false;
    }
    return true;
  }
};

// ═══════════════════════════════════════════════════════════════════
// REGISTRATION STORE
// ═══════════════════════════════════════════════════════════════════
const REG_KEY = 'udbhav_registrations';

function loadRegistrations() {
  try {
    return JSON.parse(localStorage.getItem(REG_KEY) || '[]');
  } catch { return []; }
}

function saveRegistrations(data) {
  localStorage.setItem(REG_KEY, JSON.stringify(data));
}

export const RegistrationStore = {
  getAll() {
    return loadRegistrations();
  },

  getById(id) {
    return loadRegistrations().find(r => r.id === id) || null;
  },

  add(registration) {
    const regs = loadRegistrations();
    const entry = {
      id: `reg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...registration,
      status: registration.status || 'pending',
      createdAt: registration.createdAt || new Date().toISOString(),
    };
    regs.unshift(entry); // newest first
    saveRegistrations(regs);
    return entry;
  },

  update(id, updates) {
    const regs = loadRegistrations();
    const idx = regs.findIndex(r => r.id === id);
    if (idx === -1) return null;
    regs[idx] = { ...regs[idx], ...updates, updatedAt: new Date().toISOString() };
    saveRegistrations(regs);
    return regs[idx];
  },

  remove(id) {
    const regs = loadRegistrations();
    const filtered = regs.filter(r => r.id !== id);
    saveRegistrations(filtered);
    return filtered.length < regs.length;
  },

  bulkUpdate(ids, updates) {
    const regs = loadRegistrations();
    const idSet = new Set(ids);
    regs.forEach(r => {
      if (idSet.has(r.id)) Object.assign(r, updates, { updatedAt: new Date().toISOString() });
    });
    saveRegistrations(regs);
  },

  search(query, statusFilter = 'all') {
    let regs = loadRegistrations();
    if (statusFilter && statusFilter !== 'all') {
      regs = regs.filter(r => r.status === statusFilter);
    }
    if (query) {
      const q = query.toLowerCase();
      regs = regs.filter(r =>
        (r.teamName || '').toLowerCase().includes(q) ||
        (r.leaderName || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.college || '').toLowerCase().includes(q)
      );
    }
    return regs;
  },

  paginate(data, page = 1, perPage = 20) {
    const total = data.length;
    const totalPages = Math.ceil(total / perPage);
    const start = (page - 1) * perPage;
    return {
      items: data.slice(start, start + perPage),
      page,
      perPage,
      total,
      totalPages,
    };
  },

  getStats() {
    const regs = loadRegistrations();
    return {
      total: regs.length,
      pending: regs.filter(r => r.status === 'pending').length,
      approved: regs.filter(r => r.status === 'approved').length,
      rejected: regs.filter(r => r.status === 'rejected').length,
      totalMembers: regs.reduce((sum, r) => sum + (r.members ? r.members.length : 0) + 1, 0),
    };
  },

  exportCSV(data) {
    const headers = ['Team Name', 'Leader Name', 'Email', 'Phone', 'College', 'Members', 'Status', 'Date'];
    const rows = data.map(r => [
      r.teamName || '',
      r.leaderName || '',
      r.email || '',
      r.phone || '',
      r.college || '',
      (r.members || []).map(m => m.name).join('; '),
      r.status || '',
      r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${(v + '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `udbhav26_registrations_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};


// ═══════════════════════════════════════════════════════════════════
// SUBMISSION STORE
// ═══════════════════════════════════════════════════════════════════
export const SubmissionStore = {
  async getAll() {
    try {
      const token = AdminAuth.getToken();
      const res = await fetch('/api/submissions/list', {
        headers: { 'X-Admin-Secret': token }
      });
      const data = await res.json();
      return data.success ? data.submissions : [];
    } catch (err) {
      console.error('[SubmissionStore] Error:', err);
      return [];
    }
  },

  getTypeBadge(type) {
    const map = {
      'ppt-submission':     { label: 'PPT Submit', cls: 'badge--ppt' },
      'project-submission': { label: 'Project Link', cls: 'badge--project' },
      'other':              { label: 'Other', cls: 'badge--other' },
    };
    const s = map[type] || map.other;
    return `<span class="status-badge ${s.cls}">${s.label}</span>`;
  }
};

// ═══════════════════════════════════════════════════════════════════
// SUBMISSION STORE
// ═══════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════
// CLEANUP — remove any seed/demo data from localStorage
// ═══════════════════════════════════════════════════════════════════

/**
 * Clears seed/demo registrations from localStorage.
 * Called once on page load to purge any previously seeded data.
 * Real data now comes from MongoDB via the API.
 */
export function seedRegistrations() {
  // No-op: seed data removed. Clear localStorage if it has old seed data.
  try {
    const existing = JSON.parse(localStorage.getItem('udbhav_registrations') || '[]');
    const hasSeedData = existing.some(r => r.id?.startsWith('reg_seed_'));
    if (hasSeedData) {
      localStorage.removeItem('udbhav_registrations');
      console.log('[Admin] Cleared legacy seed data from localStorage');
    }
  } catch (_) {}
}


// ═══════════════════════════════════════════════════════════════════
// UI UTILITIES
// ═══════════════════════════════════════════════════════════════════
export const AdminUI = {
  toast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer') || (() => {
      const c = document.createElement('div');
      c.id = 'toastContainer';
      c.style.cssText = 'position:fixed;top:1.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;';
      document.body.appendChild(c);
      return c;
    })();

    const colors = {
      success: { bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.3)', text: '#4ade80' },
      error:   { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.3)', text: '#f87171' },
      info:    { bg: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.3)', text: '#60a5fa' },
      warning: { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)', text: '#fbbf24' },
    };
    const c = colors[type] || colors.info;

    const toast = document.createElement('div');
    toast.style.cssText = `
      pointer-events:auto; padding:0.85rem 1.3rem; border-radius:12px;
      background:${c.bg}; border:1px solid ${c.border}; color:${c.text};
      font-family:'Inter',sans-serif; font-size:0.85rem; font-weight:600;
      backdrop-filter:blur(20px); box-shadow:0 8px 32px rgba(0,0,0,0.3);
      opacity:0; transform:translateX(20px); transition:all 0.3s cubic-bezier(0.16,1,0.3,1);
    `;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  },

  statusBadge(status) {
    const map = {
      pending:  { label: 'Pending Payment',  cls: 'badge--pending' },
      approved: { label: 'Payment Done', cls: 'badge--approved' },
      rejected: { label: 'Rejected', cls: 'badge--rejected' },
    };
    const s = map[status] || map.pending;
    return `<span class="status-badge ${s.cls}">${s.label}</span>`;
  },

  initSidebar() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('adminSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('is-open');
      overlay?.classList.toggle('is-visible');
    });

    overlay?.addEventListener('click', () => {
      sidebar.classList.remove('is-open');
      overlay.classList.remove('is-visible');
    });
  }
};
