/* ══════════════════════════════════════
   Users — SoCake  (admin only)
══════════════════════════════════════ */

// ── LIST ──────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:var(--space-10)"><div class="spinner" style="margin:auto"></div></td></tr>`;

  try {
    const users      = await API.getUsers();
    const currentUid = getCurrentUser()?.id;

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="5">${emptyState('👤', 'Aucun utilisateur', '')}</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div class="user-row">
            <div class="user-avatar-sm">${getInitials(u.name)}</div>
            <div>
              <div class="td-primary">${u.name}${u.id === currentUid ? ' <span class="badge badge-info">Vous</span>' : ''}</div>
            </div>
          </div>
        </td>
        <td class="text-small">${u.email}</td>
        <td>
          <select class="form-select form-select-sm" onchange="changeUserRole(${u.id}, this.value)" ${u.id === currentUid ? 'disabled' : ''}>
            <option value="employee" ${u.role === 'employee' ? 'selected' : ''}>Employé</option>
            <option value="admin"    ${u.role === 'admin'    ? 'selected' : ''}>Administrateur</option>
          </select>
        </td>
        <td class="td-secondary">${formatDate(u.created_at)}</td>
        <td>
          ${u.id !== currentUid ? `
          <button class="btn btn-ghost btn-icon btn-sm btn-danger-ghost" onclick="deleteUser(${u.id})" title="Supprimer">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>` : '<span class="text-muted text-small">—</span>'}
        </td>
      </tr>`).join('');
  } catch (err) {
    showToast('Erreur chargement utilisateurs', 'error');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:var(--space-8)">Erreur de chargement</td></tr>`;
  }
}

// ── CHANGE ROLE ───────────────────────
async function changeUserRole(id, role) {
  try {
    await API.updateUserRole(id, role);
    showToast('Rôle mis à jour', 'success');
  } catch (err) {
    showToast(err.message, 'error');
    loadUsers(); // Revert display
  }
}

// ── CREATE USER MODAL ─────────────────
function openRegisterModal() {
  const body = `
    <div class="form-group">
      <label class="form-label">Nom complet *</label>
      <input type="text" id="nu-name" class="form-input" placeholder="Prénom Nom" required />
    </div>
    <div class="form-group">
      <label class="form-label">Adresse email *</label>
      <input type="email" id="nu-email" class="form-input" placeholder="employe@socake.com" required />
    </div>
    <div class="form-group">
      <label class="form-label">Mot de passe *</label>
      <div class="input-password-wrap">
        <input type="password" id="nu-password" class="form-input" placeholder="8 caractères minimum" required />
        <button type="button" class="btn-toggle-pass" onclick="togglePassword('nu-password', this)">
          <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Rôle</label>
      <select id="nu-role" class="form-select">
        <option value="employee">Employé</option>
        <option value="admin">Administrateur</option>
      </select>
    </div>
    <div id="nu-error" class="form-error hidden"></div>`;

  openModal({
    title:  'Nouvel utilisateur',
    body,
    size:   'modal-sm',
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" id="nu-save-btn">Créer le compte</button>`,
  });

  document.getElementById('nu-save-btn').addEventListener('click', async () => {
    const btn   = document.getElementById('nu-save-btn');
    const errEl = document.getElementById('nu-error');
    errEl.classList.add('hidden');

    const name     = document.getElementById('nu-name').value.trim();
    const email    = document.getElementById('nu-email').value.trim();
    const password = document.getElementById('nu-password').value;
    const role     = document.getElementById('nu-role').value;

    if (!name || !email || !password) {
      errEl.textContent = 'Tous les champs marqués * sont requis.';
      errEl.classList.remove('hidden');
      return;
    }
    if (password.length < 6) {
      errEl.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true);
    try {
      await API.register({ name, email, password, role });
      showToast(`Compte créé pour ${name}`, 'success');
      closeModal();
      loadUsers();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });
}

// ── DELETE ────────────────────────────
async function deleteUser(id) {
  confirmDialog('Supprimer l\'utilisateur', 'Le compte sera définitivement supprimé. Cette action est irréversible.', async () => {
    try {
      await API.deleteUser(id);
      showToast('Utilisateur supprimé', 'success');
      loadUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
