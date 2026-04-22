/* ══════════════════════════════════════
   Customers — SoCake
══════════════════════════════════════ */

// ── LIST ──────────────────────────────
async function loadCustomers() {
  const search = document.getElementById('customer-search')?.value.trim();
  const tbody  = document.getElementById('customers-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:var(--space-10)"><div class="spinner" style="margin:auto"></div></td></tr>`;

  try {
    const customers = await API.getCustomers({ search: search || undefined });

    if (!customers.length) {
      tbody.innerHTML = `<tr><td colspan="7">${emptyState('👥', 'Aucun client', 'Créez votre première fiche client.')}</td></tr>`;
      return;
    }

    const user = getCurrentUser();
    tbody.innerHTML = customers.map(c => `
      <tr>
        <td>
          <div class="customer-row">
            <div class="customer-avatar">${getInitials(c.name)}</div>
            <div>
              <div class="td-primary">${escHtml(c.name)}</div>
              ${c.notes ? `<div class="td-secondary" style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.notes)}</div>` : ''}
            </div>
          </div>
        </td>
        <td>
          ${c.email ? `<div class="td-primary"><a href="mailto:${escHtml(c.email)}" style="color:var(--rose)">${escHtml(c.email)}</a></div>` : ''}
          ${c.phone ? `<div class="td-secondary">${escHtml(c.phone)}</div>` : ''}
        </td>
        <td>${c.city ? `<span class="td-primary">${escHtml(c.city)}</span>` : '<span class="text-muted">—</span>'}</td>
        <td><span class="qty-badge">${c.total_orders}</span></td>
        <td><strong style="color:var(--rose)">${formatMoney(c.total_spent)}</strong></td>
        <td><span class="td-secondary">${formatDate(c.created_at)}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn-ghost btn-icon btn-sm" onclick="viewCustomerDetail(${c.id})" title="Voir fiche">
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" onclick="openCustomerModal(${c.id})" title="Modifier">
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${user?.role === 'admin' ? `
            <button class="btn btn-ghost btn-icon btn-sm btn-danger-ghost" onclick="deleteCustomer(${c.id}, '${escHtml(c.name)}')" title="Supprimer">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    showToast('Erreur chargement clients', 'error');
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:var(--space-8)">Erreur de chargement</td></tr>`;
  }
}

// ── DETAIL ────────────────────────────
async function viewCustomerDetail(id) {
  navigateTo('customer-detail');
  const headerEl  = document.getElementById('customer-detail-header');
  const contentEl = document.getElementById('customer-detail-content');
  headerEl.innerHTML  = `<div class="loading-center" style="padding:var(--space-8)"><div class="spinner"></div></div>`;
  contentEl.innerHTML = '';

  try {
    const c = await API.getCustomer(id);

    headerEl.innerHTML = `
      <div class="customer-detail-header-banner">
        <div class="customer-detail-avatar">${getInitials(c.name)}</div>
        <div>
          <h1 style="font-family:var(--font-display);font-size:1.6rem;margin:0 0 4px">${escHtml(c.name)}</h1>
          <div style="opacity:.7;font-size:.9rem;display:flex;gap:16px;flex-wrap:wrap">
            ${c.email ? `<span>✉ ${escHtml(c.email)}</span>` : ''}
            ${c.phone ? `<span>📞 ${escHtml(c.phone)}</span>` : ''}
            ${c.city  ? `<span>📍 ${escHtml(c.city)}</span>`  : ''}
          </div>
        </div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="openCustomerModal(${c.id})">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Modifier
          </button>
          <button class="btn btn-primary btn-sm" onclick="openOrderModalForCustomer(${c.id}, '${escHtml(c.name)}', '${escHtml(c.email || '')}', '${escHtml(c.phone || '')}')">
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nouvelle commande
          </button>
        </div>
      </div>
      <div class="customer-stats-strip">
        <div class="detail-meta-item">
          <span class="detail-meta-label">Commandes</span>
          <span class="detail-meta-value fw-600">${c.orders?.length || 0}</span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-label">Total dépensé</span>
          <span class="detail-meta-value" style="color:var(--rose);font-weight:700">${formatMoney(c.orders?.reduce((s, o) => s + o.total_amount, 0) || 0)}</span>
        </div>
        ${c.address ? `<div class="detail-meta-item">
          <span class="detail-meta-label">Adresse</span>
          <span class="detail-meta-value">${escHtml(c.address)}</span>
        </div>` : ''}
        ${c.notes ? `<div class="detail-meta-item">
          <span class="detail-meta-label">Notes</span>
          <span class="detail-meta-value">${escHtml(c.notes)}</span>
        </div>` : ''}
        <div class="detail-meta-item" style="margin-left:auto">
          <button class="btn btn-secondary btn-sm" onclick="navigateTo('customers')">
            <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            Retour
          </button>
        </div>
      </div>`;

    const ordersHtml = c.orders?.length
      ? `<div class="table-wrapper" style="margin-top:0">
          <table class="data-table">
            <thead><tr><th>Numéro</th><th>Événement</th><th>Livraison</th><th>Montant</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              ${c.orders.map(o => `
                <tr>
                  <td><strong class="order-num">${o.order_number}</strong></td>
                  <td>${o.event_name ? `<span class="badge badge-info">${escHtml(o.event_name)}</span>` : '<span class="text-muted">—</span>'}</td>
                  <td>${formatDate(o.delivery_date)}</td>
                  <td style="color:var(--rose);font-weight:700">${formatMoney(o.total_amount)}</td>
                  <td>${orderBadge(o.status)}</td>
                  <td><button class="btn btn-ghost btn-sm btn-icon" onclick="viewOrderDetail(${o.id})">
                    <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`
      : emptyState('📋', 'Aucune commande', 'Ce client n\'a pas encore passé de commande.');

    contentEl.innerHTML = `
      <div style="margin-top:var(--space-6)">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Historique des commandes</h3>
          </div>
          ${ordersHtml}
        </div>
      </div>`;
  } catch (err) {
    showToast('Erreur chargement client', 'error');
    navigateTo('customers');
  }
}

// ── MODAL CREATE/EDIT ─────────────────
async function openCustomerModal(id = null) {
  let customer = {};
  if (id) {
    try { customer = await API.getCustomer(id); } catch (_) {}
  }

  openModal({
    title: id ? 'Modifier le client' : 'Nouveau client',
    size: 'modal-lg',
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nom complet *</label>
          <input type="text" id="cust-name" class="form-input" value="${escHtml(customer.name || '')}" placeholder="Prénom Nom" required />
        </div>
        <div class="form-group">
          <label class="form-label">Téléphone</label>
          <input type="tel" id="cust-phone" class="form-input" value="${escHtml(customer.phone || '')}" placeholder="06 12 34 56 78" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" id="cust-email" class="form-input" value="${escHtml(customer.email || '')}" placeholder="client@email.com" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Adresse</label>
          <input type="text" id="cust-address" class="form-input" value="${escHtml(customer.address || '')}" placeholder="12 rue de la Paix" />
        </div>
        <div class="form-group">
          <label class="form-label">Ville</label>
          <input type="text" id="cust-city" class="form-input" value="${escHtml(customer.city || '')}" placeholder="Paris" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Code postal</label>
        <input type="text" id="cust-postal" class="form-input" value="${escHtml(customer.postal_code || '')}" placeholder="75001" style="max-width:120px" />
      </div>
      <div class="form-group">
        <label class="form-label">Notes internes</label>
        <textarea id="cust-notes" class="form-textarea" placeholder="Préférences, allergies, remarques...">${escHtml(customer.notes || '')}</textarea>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" id="cust-save-btn" onclick="saveCustomer(${id || 'null'})">
        ${id ? 'Enregistrer' : 'Créer le client'}
      </button>`,
  });
}

async function saveCustomer(id) {
  const btn  = document.getElementById('cust-save-btn');
  const body = {
    name:        document.getElementById('cust-name')?.value.trim(),
    phone:       document.getElementById('cust-phone')?.value.trim(),
    email:       document.getElementById('cust-email')?.value.trim(),
    address:     document.getElementById('cust-address')?.value.trim(),
    city:        document.getElementById('cust-city')?.value.trim(),
    postal_code: document.getElementById('cust-postal')?.value.trim(),
    notes:       document.getElementById('cust-notes')?.value.trim(),
  };

  if (!body.name) { showToast('Le nom est requis', 'error'); return; }

  setLoading(btn, true);
  try {
    if (id) {
      await API.updateCustomer(id, body);
      showToast('Client mis à jour', 'success');
    } else {
      await API.createCustomer(body);
      showToast('Client créé', 'success');
    }
    closeModal();
    loadCustomers();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function deleteCustomer(id, name) {
  confirmDialog('Supprimer le client', `Voulez-vous supprimer <strong>${escHtml(name)}</strong> ?`, async () => {
    try {
      await API.deleteCustomer(id);
      showToast('Client supprimé', 'success');
      loadCustomers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// Pre-fill order modal with customer data
function openOrderModalForCustomer(customerId, name, email, phone) {
  openOrderModal(null, null, { customer_id: customerId, client_name: name, client_email: email, client_phone: phone });
}

