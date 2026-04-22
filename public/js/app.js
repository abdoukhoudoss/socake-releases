/* ══════════════════════════════════════
   App — SoCake v2  (main controller)
══════════════════════════════════════ */

let _currentPage = 'dashboard';

// ── PAGE TITLES ───────────────────────
const PAGE_TITLES = {
  dashboard:       'Tableau de bord',
  orders:          'Commandes',
  'order-detail':  'Détail commande',
  customers:       'Clients',
  'customer-detail': 'Fiche client',
  deliveries:      'Livraisons',
  events:          'Événements',
  'event-detail':  'Détail événement',
  products:        'Catalogue produits',
  stock:           'Gestion du stock',
  reports:         'Rapports & Statistiques',
  users:           'Utilisateurs',
  settings:        'Paramètres',
  profile:         'Mon profil',
};

// ── NAVIGATION ────────────────────────
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('active');
  });

  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }

  document.querySelectorAll('.nav-item').forEach(el => {
    const pg = el.dataset.page || '';
    el.classList.toggle('active', pg === page || page.startsWith(pg + '-'));
  });

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[page] || page;

  updateTopbarActions(page);

  _currentPage = page;

  if (window.innerWidth < 900) closeSidebar();

  // Load data
  switch (page) {
    case 'dashboard':        loadDashboard();  break;
    case 'orders':           loadOrders();     break;
    case 'customers':        loadCustomers();  break;
    case 'deliveries':       initDeliveries(); break;
    case 'events':           loadEvents();     break;
    case 'products':         loadProducts();   break;
    case 'stock':            loadStock();      break;
    case 'reports':          loadReports();    break;
    case 'users':            loadUsers();      break;
    case 'settings':         loadSettings();   break;
    case 'profile':          loadProfile();    break;
  }
}

function initDeliveries() {
  const dateEl = document.getElementById('delivery-filter-date');
  if (dateEl && !dateEl.value) {
    dateEl.value = new Date().toISOString().split('T')[0];
  }
  loadDeliveries();
}

function updateTopbarActions(page) {
  const el = document.getElementById('topbar-actions');
  if (!el) return;

  const SVG_PLUS = `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  const actMap = {
    orders:     `<button class="btn btn-primary btn-sm" onclick="openOrderModal()">${SVG_PLUS} Nouvelle commande</button>`,
    customers:  `<button class="btn btn-primary btn-sm" onclick="openCustomerModal()">${SVG_PLUS} Nouveau client</button>`,
    events:     `<button class="btn btn-primary btn-sm" onclick="openEventModal()">${SVG_PLUS} Nouvel événement</button>`,
    stock:      `<button class="btn btn-primary btn-sm" onclick="openStockModal()">${SVG_PLUS} Ajouter article</button>`,
    products:   `<button class="btn btn-primary btn-sm" onclick="openProductModal()">${SVG_PLUS} Ajouter produit</button>`,
    deliveries: `<button class="btn btn-secondary btn-sm" onclick="resetDeliveryFilters()">
                   <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.36"/></svg>
                   Aujourd'hui
                 </button>`,
  };
  el.innerHTML = actMap[page] || '';
}

// ── SIDEBAR ───────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
}

// ── PROFILE PAGE ─────────────────────
function loadProfile() {
  const user = getCurrentUser();
  if (!user) return;

  document.getElementById('profile-avatar-big').textContent  = getInitials(user.name);
  document.getElementById('profile-name').textContent        = user.name;
  document.getElementById('profile-role-badge').textContent  = roleLabel(user.role);
  document.getElementById('profile-name-input').value        = user.name;
  document.getElementById('profile-email-input').value       = user.email;
  if (user.phone) document.getElementById('profile-phone-input').value = user.phone;

  document.getElementById('profile-error')?.classList.add('hidden');
  document.getElementById('profile-success')?.classList.add('hidden');
}

// ── SIDEBAR USER ─────────────────────
function updateSidebarUser(user) {
  document.getElementById('sidebar-avatar').textContent   = getInitials(user.name);
  document.getElementById('sidebar-username').textContent = user.name;
  document.getElementById('sidebar-role').textContent     = roleLabel(user.role);
}

function roleLabel(role) {
  return role === 'admin' ? 'Administrateur' : role === 'delivery' ? 'Livreur' : 'Employé';
}

// ── DASHBOARD BADGE REFRESH ───────────
function refreshNavBadges(stats) {
  const pendingBadge = document.getElementById('nav-pending-badge');
  if (pendingBadge) {
    if (stats.pendingOrders > 0) {
      pendingBadge.textContent = stats.pendingOrders;
      pendingBadge.style.display = '';
    } else {
      pendingBadge.style.display = 'none';
    }
  }
  const stockBadge = document.getElementById('nav-stock-badge');
  if (stockBadge) {
    if (stats.lowStock > 0) {
      stockBadge.textContent = stats.lowStock;
      stockBadge.style.display = '';
    } else {
      stockBadge.style.display = 'none';
    }
  }
}

// ── SSE — Real-time ───────────────────
let _sseSource = null;
let _sseRetryTimer = null;

function connectSSE() {
  const token = getToken();
  if (!token) return;

  if (_sseSource) _sseSource.close();

  const indicator = document.getElementById('sse-indicator');

  _sseSource = new EventSource('/api/sse', {
    headers: { Authorization: `Bearer ${token}` }
  });

  // EventSource doesn't support custom headers — use URL param workaround
  _sseSource.close();
  _sseSource = null;

  // Use fetch-based SSE with token in header via a simple polling fallback
  // For SSE with auth we use a cookie approach via URL token param
  startSSEWithToken(token, indicator);
}

function startSSEWithToken(token, indicator) {
  // Pass token as query param (only for SSE — safer than no auth)
  // Server needs to accept this — we'll re-open a fetch-stream approach
  const url = `/api/sse?token=${encodeURIComponent(token)}`;

  // Patch server to also accept token from query for SSE
  let es;
  try {
    es = new EventSource(url);
    _sseSource = es;
  } catch (_) { return; }

  es.addEventListener('message', (e) => {
    try {
      const msg = JSON.parse(e.data);
      handleSSEMessage(msg);
    } catch (_) {}
  });

  es.addEventListener('open', () => {
    if (indicator) { indicator.className = 'sse-indicator connected'; indicator.title = 'Synchronisation active'; }
    clearTimeout(_sseRetryTimer);
  });

  es.addEventListener('error', () => {
    if (indicator) { indicator.className = 'sse-indicator disconnected'; indicator.title = 'Synchronisation interrompue'; }
    es.close();
    _sseRetryTimer = setTimeout(() => connectSSE(), 5000);
  });
}

function handleSSEMessage(msg) {
  const { type, data } = msg;

  // Auto-refresh current page when related data changes
  const refreshMap = {
    'order:created':    () => { if (_currentPage === 'orders' || _currentPage === 'dashboard') { loadOrders(); loadDashboard(); } showSSEToast('Nouvelle commande reçue', type); },
    'order:updated':    () => { if (_currentPage === 'orders') loadOrders(); },
    'order:status':     () => { if (_currentPage === 'orders' || _currentPage === 'dashboard') { loadOrders(); loadDashboard(); } showSSEToast(`Commande ${data?.order_number} : statut mis à jour`, type); },
    'order:deleted':    () => { if (_currentPage === 'orders') loadOrders(); },
    'customer:created': () => { if (_currentPage === 'customers') loadCustomers(); showSSEToast('Nouveau client ajouté', type); },
    'customer:updated': () => { if (_currentPage === 'customers') loadCustomers(); },
    'customer:deleted': () => { if (_currentPage === 'customers') loadCustomers(); },
    'product:created':  () => { if (_currentPage === 'products') loadProducts(); },
    'product:updated':  () => { if (_currentPage === 'products') loadProducts(); },
    'stock:updated':    () => { if (_currentPage === 'stock' || _currentPage === 'dashboard') { loadStock(); loadDashboard(); } },
    'event:created':    () => { if (_currentPage === 'events') loadEvents(); showSSEToast('Nouvel événement créé', type); },
    'event:updated':    () => { if (_currentPage === 'events') loadEvents(); },
    'delivery:updated': () => { if (_currentPage === 'deliveries') loadDeliveries(); },
    'company:updated':  () => { applyCompanyTheme(data); applyCompanyCurrency(data); },
    'company:logo':     () => { if (data?.logo_url) applySidebarLogo(data.logo_url); },
  };

  const handler = refreshMap[type];
  if (handler) handler();
}

function showSSEToast(message, type) {
  // Only show toast if the event was triggered by someone else (not current user)
  // We show it as info since it came from SSE (another session)
  showToast(`🔄 ${message}`, 'info');
}

// ── BOOT ─────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Load company settings first (for branding on login page)
  try {
    const company = await fetch('/api/company').then(r => r.json());
    applyCompanyTheme(company);
    applyCompanyCurrency(company);
  } catch (_) {}

  const token = localStorage.getItem('socake_token');
  const user  = getCurrentUser();

  if (token && user) {
    API.me().then(freshUser => {
      const merged = { ...freshUser };
      localStorage.setItem('socake_user', JSON.stringify(merged));
      startApp(merged);
    }).catch(() => {
      localStorage.removeItem('socake_token');
      localStorage.removeItem('socake_user');
      showAuthScreen();
    });
  } else {
    showAuthScreen();
  }
});

function showAuthScreen() {
  document.getElementById('auth-container')?.classList.remove('hidden');
  document.getElementById('app-container')?.classList.add('hidden');
  initAuth();
}

// ── START APP ─────────────────────────
function startApp(user) {
  document.getElementById('auth-container')?.classList.add('hidden');
  const appEl = document.getElementById('app-container');
  appEl?.classList.remove('hidden');

  // Admin-only items
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', user.role !== 'admin');
  });

  updateSidebarUser(user);
  navigateTo('dashboard');
  connectSSE();

  // Profile form
  document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn   = e.submitter;
    const errEl = document.getElementById('profile-error');
    const sucEl = document.getElementById('profile-success');
    errEl.classList.add('hidden');
    sucEl.classList.add('hidden');

    const body = {
      name:            document.getElementById('profile-name-input').value.trim(),
      email:           document.getElementById('profile-email-input').value.trim(),
      phone:           document.getElementById('profile-phone-input').value.trim(),
      currentPassword: document.getElementById('profile-current-pass').value,
      newPassword:     document.getElementById('profile-new-pass').value,
    };

    if (!body.name || !body.email) {
      errEl.textContent = 'Nom et email sont requis.';
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true);
    try {
      const updated = await API.updateProfile(body);
      localStorage.setItem('socake_user', JSON.stringify({ ...updated }));
      updateSidebarUser(updated);
      document.getElementById('profile-name').textContent      = updated.name;
      document.getElementById('profile-avatar-big').textContent = getInitials(updated.name);
      document.getElementById('profile-current-pass').value = '';
      document.getElementById('profile-new-pass').value     = '';
      sucEl.textContent = 'Profil mis à jour avec succès.';
      sucEl.classList.remove('hidden');
      showToast('Profil mis à jour', 'success');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });
}

// ── SSE token via query param fix ─────
// Override authMiddleware on server also checks ?token= param
// Patch done by monkey-patching EventSource URL

// ── CURRENCY ─────────────────────────
function applyCompanyCurrency(s) {
  if (!s) return;
  if (s.currency)        window._currencyCode   = s.currency;
  if (s.currency_symbol) window._currencySymbol = s.currency_symbol;
}

// ── MISC ─────────────────────────────
function viewOrder(id) {
  if (id) viewOrderDetail(id);
  else navigateTo('orders');
}
