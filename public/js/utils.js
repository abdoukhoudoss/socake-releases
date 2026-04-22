/* ══════════════════════════════════════
   Utils — SoCake
══════════════════════════════════════ */

// ── LOGO SVG (cohérent avec charte) ──
const BRAND_LOGO_SVG = `
<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
  <path d="M24 52 L28 72 L52 72 L56 52 Z" fill="#C490C0" stroke="#3D2020" stroke-width="2.5" stroke-linejoin="round"/>
  <line x1="36" y1="52" x2="33" y2="72" stroke="#3D2020" stroke-width="2"/>
  <line x1="44" y1="52" x2="47" y2="72" stroke="#3D2020" stroke-width="2"/>
  <ellipse cx="40" cy="50" rx="18" ry="7" fill="#F2A8B8" stroke="#3D2020" stroke-width="2"/>
  <path d="M22 48 Q28 30 40 28 Q52 26 56 42 Q58 50 56 52 Q48 38 40 36 Q30 34 26 48 Z" fill="#E8748E" stroke="#3D2020" stroke-width="2" stroke-linejoin="round"/>
  <path d="M34 30 Q36 20 40 18 Q44 16 44 28 Q42 24 40 24 Q37 24 34 30 Z" fill="#F2A8B8" stroke="#3D2020" stroke-width="1.8"/>
  <circle cx="40" cy="14" r="5" fill="#E0506A" stroke="#3D2020" stroke-width="2"/>
  <path d="M40 9 Q43 4 47 6" fill="none" stroke="#3D2020" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

// ── TOAST ────────────────────────────
function showToast(message, type = 'info') {
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 300ms ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── MODAL ────────────────────────────
function openModal({ title, body, footer, size = '' }) {
  const overlay = document.getElementById('modal-overlay');
  const container = document.getElementById('modal-container');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-footer').innerHTML = footer || '';
  container.className = `modal ${size}`;
  overlay.classList.remove('hidden');
  // Focus first input
  setTimeout(() => {
    const first = overlay.querySelector('input:not([type=hidden]), select, textarea');
    if (first) first.focus();
  }, 50);
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.add('hidden');
  // Ferme les dropdowns attachés au body (ex : recherche client)
  if (typeof closeOrdDropdown === 'function') closeOrdDropdown();
}

// ── FORMAT ───────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// Currency is set globally when company settings load (see app.js)
window._currencySymbol = '€';
window._currencyCode   = 'EUR';

function formatMoney(amount) {
  if (amount === null || amount === undefined) return '—';
  const sym  = window._currencySymbol || '€';
  const code = window._currencyCode   || 'EUR';

  // Use Intl when it's a known ISO currency, otherwise format manually
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).format(amount);
  } catch (_) {
    // Fallback for non-ISO codes like XOF with custom symbol
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount) + '\u202F' + sym;
  }
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.round((d - now) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  if (diff > 0) return `Dans ${diff} j`;
  return `Il y a ${Math.abs(diff)} j`;
}

// ── STATUS HELPERS ───────────────────
const ORDER_STATUS = {
  en_attente:     { label: 'En attente',     cls: 'badge-gray',    icon: '⏳' },
  confirme:       { label: 'Confirmé',       cls: 'badge-info',    icon: '✓' },
  en_preparation: { label: 'En préparation', cls: 'badge-warning', icon: '👩‍🍳' },
  pret:           { label: 'Prêt',           cls: 'badge-success', icon: '🎉' },
  livre:          { label: 'Livré',          cls: 'badge-teal',    icon: '🚚' },
  annule:         { label: 'Annulé',         cls: 'badge-danger',  icon: '✕' },
};

const EVENT_STATUS = {
  planifie:  { label: 'Planifié',  cls: 'badge-info' },
  en_cours:  { label: 'En cours',  cls: 'badge-warning' },
  termine:   { label: 'Terminé',   cls: 'badge-success' },
  annule:    { label: 'Annulé',    cls: 'badge-danger' },
};

const CATEGORY_LABELS = {
  verrine:     { label: 'Verrine',     emoji: '🍮' },
  cupcake:     { label: 'Cupcake',     emoji: '🧁' },
  solo_delice: { label: 'Solo Délice', emoji: '🍰' },
  mignardise:  { label: 'Mignardise',  emoji: '🍬' },
  gateau:      { label: 'Gâteau',      emoji: '🎂' },
};

function orderBadge(status) {
  const s = ORDER_STATUS[status] || { label: status, cls: 'badge-gray', icon: '' };
  return `<span class="badge ${s.cls}">${s.icon} ${s.label}</span>`;
}

function eventBadge(status) {
  const s = EVENT_STATUS[status] || { label: status, cls: 'badge-gray' };
  return `<span class="badge ${s.cls}">${s.label}</span>`;
}

function catBadge(cat) {
  const c = CATEGORY_LABELS[cat] || { label: cat, emoji: '🍰' };
  return `<span class="cat-label cat-${cat}">${c.emoji} ${c.label}</span>`;
}

const PAYMENT_LABELS = {
  especes:  '💵 Espèces',
  carte:    '💳 Carte',
  virement: '🏦 Virement',
  cheque:   '📝 Chèque',
  en_ligne: '🌐 En ligne',
};

function paymentStatusBadge(status) {
  if (status === 'complet')  return `<span class="badge badge-payment-ok">Payé</span>`;
  if (status === 'partiel')  return `<span class="badge badge-payment-partial">Partiel</span>`;
  return `<span class="badge badge-payment-pending">Impayé</span>`;
}

// ── AVATAR ───────────────────────────
function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── CONFIRM ──────────────────────────
function confirmDialog(title, message, onConfirm) {
  openModal({
    title,
    size: 'modal-sm',
    body: `
      <div class="confirm-content">
        <div class="confirm-icon">⚠️</div>
        <p class="confirm-text">${message}</p>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-danger" id="confirm-ok-btn">Confirmer</button>`,
  });
  setTimeout(() => {
    document.getElementById('confirm-ok-btn')?.addEventListener('click', () => {
      closeModal();
      onConfirm();
    });
  }, 50);
}

// ── HTML ESCAPING ────────────────────
function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── LOADING STATES ───────────────────
function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.origText || btn.innerHTML;
    btn.disabled = false;
  }
}

// ── EMPTY STATE ──────────────────────
function emptyState(icon, text, sub = '') {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><p class="empty-text">${text}</p>${sub ? `<p class="empty-sub text-muted">${sub}</p>` : ''}</div>`;
}

// ── PASSWORD TOGGLE ──────────────────
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.style.color = input.type === 'text' ? 'var(--rose)' : '';
}

// Add toastOut animation
const style = document.createElement('style');
style.textContent = `@keyframes toastOut { to { opacity:0; transform:translateX(110%); } }`;
document.head.appendChild(style);
