/* ══════════════════════════════════════
   Auth — SoCake
══════════════════════════════════════ */

function showAuthPage(pageId) {
  document.querySelectorAll('.auth-card').forEach(el => el.classList.add('hidden'));
  document.getElementById(pageId)?.classList.remove('hidden');
}

function initAuth() {
  // Inject logo in auth page
  const logoEl = document.getElementById('brand-logo-auth');
  if (logoEl) logoEl.innerHTML = BRAND_LOGO_SVG;

  // Login form
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    setLoading(btn, true);
    try {
      const data = await API.login({
        email: document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-password').value,
      });
      localStorage.setItem('socake_token', data.token);
      localStorage.setItem('socake_user', JSON.stringify(data.user));
      startApp(data.user);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });

  // Register form
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('register-btn');
    const errEl = document.getElementById('register-error');
    errEl.classList.add('hidden');
    const password = document.getElementById('reg-password').value;
    if (password.length < 6) {
      errEl.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
      errEl.classList.remove('hidden');
      return;
    }
    setLoading(btn, true);
    try {
      const data = await API.register({
        name: document.getElementById('reg-name').value.trim(),
        email: document.getElementById('reg-email').value.trim(),
        password,
      });
      localStorage.setItem('socake_token', data.token);
      localStorage.setItem('socake_user', JSON.stringify(data.user));
      startApp(data.user);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });
}

function logout() {
  localStorage.removeItem('socake_token');
  localStorage.removeItem('socake_user');
  window.location.reload();
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('socake_user'));
  } catch {
    return null;
  }
}
