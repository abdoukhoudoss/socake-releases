/* ══════════════════════════════════════
   Settings — SoCake
══════════════════════════════════════ */

let _companySettings = null;

// ── LOAD ──────────────────────────────
async function loadSettings() {
  try {
    const s = await API.getCompany();
    _companySettings = s;
    fillSettingsForm(s);
  } catch (err) {
    showToast('Erreur chargement paramètres', 'error');
  }
}

function fillSettingsForm(s) {
  if (!s) return;

  setValue('set-company-name',    s.company_name);
  setValue('set-slogan',          s.slogan);
  setValue('set-activities',      s.activities);
  setValue('set-primary-color',   s.primary_color || '#E8748E');
  setValue('set-primary-color-text', s.primary_color || '#E8748E');
  setValue('set-currency',        s.currency || 'EUR');
  setValue('set-currency-symbol', s.currency_symbol || '€');
  setValue('set-address',         s.address);
  setValue('set-city',            s.city);
  setValue('set-phone',           s.phone);
  setValue('set-website',         s.website);
  setValue('set-email-from',      s.email_from);
  setValue('set-smtp-host',       s.email_smtp_host);
  setValue('set-smtp-port',       s.email_smtp_port || 587);
  setValue('set-smtp-user',       s.email_smtp_user);

  const notifCb = document.getElementById('set-email-notifications');
  if (notifCb) {
    notifCb.checked = !!s.email_notifications;
    toggleEmailSettings(notifCb.checked);
  }
  setChecked('set-notify-confirm',  s.notify_confirm);
  setChecked('set-notify-ready',    s.notify_ready);
  setChecked('set-notify-shipped',  s.notify_shipped);

  // Logo preview
  if (s.logo_url) {
    const preview = document.getElementById('logo-preview');
    if (preview) {
      preview.innerHTML = `<img src="${s.logo_url}" alt="Logo" style="width:100%;height:100%;object-fit:contain" />`;
    }
  }
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}

function setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}

// ── SAVE ──────────────────────────────
async function saveSettings() {
  const btn = document.querySelector('.settings-actions .btn-primary');
  setLoading(btn, true);

  const fb = document.getElementById('settings-feedback');
  if (fb) fb.classList.add('hidden');

  try {
    const body = {
      company_name:        document.getElementById('set-company-name')?.value.trim(),
      slogan:              document.getElementById('set-slogan')?.value.trim(),
      activities:          document.getElementById('set-activities')?.value.trim(),
      primary_color:       document.getElementById('set-primary-color-text')?.value.trim() || document.getElementById('set-primary-color')?.value,
      currency:            document.getElementById('set-currency')?.value.trim(),
      currency_symbol:     document.getElementById('set-currency-symbol')?.value.trim(),
      address:             document.getElementById('set-address')?.value.trim(),
      city:                document.getElementById('set-city')?.value.trim(),
      phone:               document.getElementById('set-phone')?.value.trim(),
      website:             document.getElementById('set-website')?.value.trim(),
      email_notifications: document.getElementById('set-email-notifications')?.checked ? 1 : 0,
      email_from:          document.getElementById('set-email-from')?.value.trim(),
      email_smtp_host:     document.getElementById('set-smtp-host')?.value.trim(),
      email_smtp_port:     parseInt(document.getElementById('set-smtp-port')?.value) || 587,
      email_smtp_user:     document.getElementById('set-smtp-user')?.value.trim(),
      email_smtp_pass:     document.getElementById('set-smtp-pass')?.value || undefined,
      notify_confirm:      document.getElementById('set-notify-confirm')?.checked ? 1 : 0,
      notify_ready:        document.getElementById('set-notify-ready')?.checked ? 1 : 0,
      notify_shipped:      document.getElementById('set-notify-shipped')?.checked ? 1 : 0,
    };

    const updated = await API.updateCompany(body);
    _companySettings = updated;
    applyCompanyTheme(updated);
    applyCompanyCurrency(updated);

    showToast('Paramètres enregistrés', 'success');
    if (fb) {
      fb.className = 'form-success';
      fb.textContent = 'Paramètres enregistrés avec succès.';
    }
  } catch (err) {
    showToast(err.message, 'error');
    if (fb) {
      fb.className = 'form-error';
      fb.textContent = err.message;
    }
  } finally {
    setLoading(btn, false);
  }
}

// ── LOGO UPLOAD ───────────────────────
async function uploadLogo(input) {
  if (!input.files?.length) return;
  const file = input.files[0];

  if (file.size > 5 * 1024 * 1024) {
    showToast('Fichier trop grand (max 5 Mo)', 'error');
    return;
  }

  const fd = new FormData();
  fd.append('logo', file);

  try {
    const res = await API.uploadLogo(fd);
    const preview = document.getElementById('logo-preview');
    if (preview) {
      preview.innerHTML = `<img src="${res.logo_url}?t=${Date.now()}" alt="Logo" style="width:100%;height:100%;object-fit:contain" />`;
    }
    applySidebarLogo(res.logo_url);
    showToast('Logo mis à jour', 'success');
  } catch (err) {
    showToast('Erreur upload: ' + err.message, 'error');
  }
}

// ── UI HELPERS ────────────────────────
function toggleEmailSettings(show) {
  const el = document.getElementById('email-settings-fields');
  if (el) el.classList.toggle('hidden', !show);
}

function previewColor(value) {
  document.getElementById('set-primary-color-text').value = value;
  document.documentElement.style.setProperty('--rose', value);
}

function syncColorPicker(value) {
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
    const picker = document.getElementById('set-primary-color');
    if (picker) picker.value = value;
    document.documentElement.style.setProperty('--rose', value);
  }
}

// ── APPLY THEME (global) ──────────────
function applyCompanyTheme(s) {
  if (!s) return;

  // Primary color
  if (s.primary_color) {
    document.documentElement.style.setProperty('--rose', s.primary_color);
    // Compute dark variant (simple darken by 20%)
    const dark = darkenHex(s.primary_color, 20);
    document.documentElement.style.setProperty('--rose-dark', dark);
  }

  // Company name in sidebar + page title
  const sidebarName = document.getElementById('sidebar-company-name');
  if (sidebarName && s.company_name) sidebarName.textContent = s.company_name;

  const sidebarTagline = document.getElementById('sidebar-company-tagline');
  if (sidebarTagline) sidebarTagline.textContent = s.slogan || '';

  const pageTitle = document.getElementById('page-title');
  if (pageTitle && s.company_name) pageTitle.textContent = `${s.company_name} — Gestion`;

  // Auth page
  const authName = document.getElementById('auth-company-name');
  if (authName && s.company_name) authName.textContent = s.company_name;
  const authSlogan = document.getElementById('auth-company-slogan');
  if (authSlogan && s.slogan) authSlogan.textContent = s.slogan;

  // Logo in sidebar
  if (s.logo_url) applySidebarLogo(s.logo_url);
}

function applySidebarLogo(url) {
  const wrap = document.getElementById('sidebar-logo-wrap');
  if (!wrap) return;
  wrap.innerHTML = `<img src="${url}?t=${Date.now()}" alt="logo" style="width:32px;height:32px;border-radius:6px;object-fit:contain" />`;

  const authLogo = document.getElementById('brand-logo-auth');
  if (authLogo) {
    authLogo.innerHTML = `<img src="${url}" alt="logo" style="width:64px;height:64px;object-fit:contain" />`;
  }
}

// ── CURRENCY PRESETS ─────────────────
function setCurrencyPreset(code, symbol) {
  const currEl = document.getElementById('set-currency');
  const symEl  = document.getElementById('set-currency-symbol');
  if (currEl) currEl.value = code;
  if (symEl)  symEl.value  = symbol;
}

// ── COLOR UTILS ───────────────────────
function darkenHex(hex, pct) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
  const r = Math.max(0, parseInt(hex.slice(0,2),16) - Math.round(255*pct/100));
  const g = Math.max(0, parseInt(hex.slice(2,4),16) - Math.round(255*pct/100));
  const b = Math.max(0, parseInt(hex.slice(4,6),16) - Math.round(255*pct/100));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
