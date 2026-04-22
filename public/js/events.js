/* ══════════════════════════════════════
   Events — SoCake
══════════════════════════════════════ */

async function loadEvents() {
  const status = document.getElementById('event-filter-status')?.value;
  const grid = document.getElementById('events-grid');
  if (!grid) return;

  grid.innerHTML = `<div class="loading-center" style="grid-column:1/-1"><div class="spinner"></div></div>`;

  try {
    const events = await API.getEvents({ status: status || undefined });

    if (!events.length) {
      grid.innerHTML = `<div style="grid-column:1/-1">${emptyState('📅', 'Aucun événement', 'Créez votre premier événement.')}</div>`;
      return;
    }

    grid.innerHTML = events.map(ev => buildEventCard(ev)).join('');
  } catch (err) {
    showToast('Erreur chargement événements', 'error');
    grid.innerHTML = '';
  }
}

function buildEventCard(ev) {
  const icon = getEventIcon(ev.name);
  return `
  <div class="event-card" onclick="viewEventDetail(${ev.id})">
    <div class="event-card-header">
      <div class="event-card-name">${icon} ${ev.name}</div>
      <div class="event-card-date">
        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${formatDate(ev.event_date)} · ${formatRelativeDate(ev.event_date)}
      </div>
    </div>
    <div class="event-card-body">
      <div class="event-card-meta">
        ${ev.client_name ? `<div class="event-meta-item">
          <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${ev.client_name}
        </div>` : ''}
        ${ev.location ? `<div class="event-meta-item">
          <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${ev.location}
        </div>` : ''}
        ${ev.creator_name ? `<div class="event-meta-item">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Créé par ${ev.creator_name}
        </div>` : ''}
      </div>
      ${eventBadge(ev.status)}
    </div>
    <div class="event-card-footer">
      <div class="event-stat">
        <span class="event-stat-value">${ev.order_count || 0}</span>
        <span class="event-stat-label">Commande${ev.order_count !== 1 ? 's' : ''}</span>
      </div>
      <div class="event-stat">
        <span class="event-stat-value" style="color:var(--rose)">${formatMoney(ev.total_revenue || 0)}</span>
        <span class="event-stat-label">CA total</span>
      </div>
      ${ev.budget ? `<div class="event-stat">
        <span class="event-stat-value" style="color:var(--gold)">${formatMoney(ev.budget)}</span>
        <span class="event-stat-label">Budget</span>
      </div>` : ''}
    </div>
  </div>`;
}

async function viewEventDetail(id) {
  navigateTo('event-detail');
  const headerEl = document.getElementById('event-detail-header');
  const contentEl = document.getElementById('event-detail-content');
  headerEl.innerHTML = `<div class="loading-center" style="padding:var(--space-8)"><div class="spinner"></div></div>`;
  contentEl.innerHTML = '';

  try {
    const ev = await API.getEvent(id);
    const user = getCurrentUser();

    headerEl.innerHTML = `
      <div class="detail-banner">
        <div class="detail-banner-title">${getEventIcon(ev.name)} ${ev.name}</div>
        <div class="detail-banner-subtitle">${ev.description || ''}</div>
      </div>
      <div class="detail-meta-bar">
        <div class="detail-meta-item">
          <span class="detail-meta-label">Date</span>
          <span class="detail-meta-value">${formatDate(ev.event_date)}</span>
        </div>
        ${ev.location ? `<div class="detail-meta-item">
          <span class="detail-meta-label">Lieu</span>
          <span class="detail-meta-value">${ev.location}</span>
        </div>` : ''}
        ${ev.client_name ? `<div class="detail-meta-item">
          <span class="detail-meta-label">Client</span>
          <span class="detail-meta-value">${ev.client_name}</span>
        </div>` : ''}
        ${ev.client_phone ? `<div class="detail-meta-item">
          <span class="detail-meta-label">Téléphone</span>
          <span class="detail-meta-value">${ev.client_phone}</span>
        </div>` : ''}
        <div class="detail-meta-item">
          <span class="detail-meta-label">Statut</span>
          <span class="detail-meta-value">${eventBadge(ev.status)}</span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-label">Commandes</span>
          <span class="detail-meta-value">${ev.order_count || 0}</span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-label">CA</span>
          <span class="detail-meta-value" style="color:var(--rose);font-weight:700">${formatMoney(ev.total_revenue || 0)}</span>
        </div>
      </div>
      <div class="detail-actions">
        <button class="btn btn-secondary btn-sm" onclick="navigateTo('events')">
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg> Retour
        </button>
        <button class="btn btn-primary btn-sm" onclick="openOrderModal(${ev.id})">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter commande
        </button>
        <button class="btn btn-secondary btn-sm" onclick="openEventModal(${ev.id})">Modifier</button>
        ${user?.role === 'admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteEvent(${ev.id})">Supprimer</button>` : ''}
      </div>`;

    // Orders list
    const orders = ev.orders || [];
    contentEl.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Commandes de cet événement (${orders.length})</h3>
        </div>
        <div class="table-wrapper" style="border:none;border-radius:0;box-shadow:none">
          ${orders.length ? `
          <table class="data-table">
            <thead><tr>
              <th>Numéro</th><th>Client</th><th>Livraison</th><th>Montant</th><th>Statut</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${orders.map(o => `
              <tr>
                <td><strong>${o.order_number}</strong></td>
                <td>${o.client_name}</td>
                <td>${formatDateShort(o.delivery_date)}</td>
                <td style="color:var(--rose);font-weight:600">${formatMoney(o.total_amount)}</td>
                <td>${orderBadge(o.status)}</td>
                <td><div class="table-actions">
                  <button class="btn btn-ghost btn-icon btn-sm" onclick="viewOrderDetail(${o.id})" title="Voir">
                    <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div></td>
              </tr>`).join('')}
            </tbody>
          </table>` : emptyState('📋', 'Aucune commande', 'Ajoutez des commandes à cet événement.')}
        </div>
      </div>`;

  } catch (err) {
    showToast('Erreur chargement événement', 'error');
  }
}

function openEventModal(id = null) {
  const isEdit = !!id;
  const modalBody = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nom de l'événement *</label>
        <input type="text" id="ev-name" class="form-input" placeholder="Ex: Mariage Dupont" required />
      </div>
      <div class="form-group">
        <label class="form-label">Date *</label>
        <input type="date" id="ev-date" class="form-input" required />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea id="ev-desc" class="form-textarea" placeholder="Détails de l'événement..."></textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Lieu</label>
        <input type="text" id="ev-location" class="form-input" placeholder="Salle, adresse..." />
      </div>
      <div class="form-group">
        <label class="form-label">Budget (€)</label>
        <input type="number" id="ev-budget" class="form-input" placeholder="0" min="0" step="0.01" />
      </div>
    </div>
    <div class="section-title" style="margin-top:0">Contact client</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nom client</label>
        <input type="text" id="ev-client" class="form-input" placeholder="Prénom Nom" />
      </div>
      <div class="form-group">
        <label class="form-label">Téléphone</label>
        <input type="tel" id="ev-phone" class="form-input" placeholder="06 XX XX XX XX" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" id="ev-email" class="form-input" placeholder="client@email.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Statut</label>
        <select id="ev-status" class="form-select">
          <option value="planifie">Planifié</option>
          <option value="en_cours">En cours</option>
          <option value="termine">Terminé</option>
          <option value="annule">Annulé</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes internes</label>
      <textarea id="ev-notes" class="form-textarea" placeholder="Notes internes..."></textarea>
    </div>
    <div id="ev-error" class="form-error hidden"></div>`;

  openModal({
    title: isEdit ? 'Modifier l\'événement' : 'Nouvel événement',
    body: modalBody,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" id="ev-save-btn">${isEdit ? 'Enregistrer' : 'Créer l\'événement'}</button>`,
  });

  if (isEdit) {
    API.getEvent(id).then(ev => {
      document.getElementById('ev-name').value     = ev.name || '';
      document.getElementById('ev-date').value     = ev.event_date || '';
      document.getElementById('ev-desc').value     = ev.description || '';
      document.getElementById('ev-location').value = ev.location || '';
      document.getElementById('ev-budget').value   = ev.budget || '';
      document.getElementById('ev-client').value   = ev.client_name || '';
      document.getElementById('ev-phone').value    = ev.client_phone || '';
      document.getElementById('ev-email').value    = ev.client_email || '';
      document.getElementById('ev-status').value   = ev.status || 'planifie';
      document.getElementById('ev-notes').value    = ev.notes || '';
    });
  } else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    document.getElementById('ev-date').value = tomorrow.toISOString().split('T')[0];
  }

  document.getElementById('ev-save-btn').addEventListener('click', async () => {
    const btn = document.getElementById('ev-save-btn');
    const errEl = document.getElementById('ev-error');
    errEl.classList.add('hidden');

    const body = {
      name:         document.getElementById('ev-name').value.trim(),
      description:  document.getElementById('ev-desc').value.trim(),
      event_date:   document.getElementById('ev-date').value,
      location:     document.getElementById('ev-location').value.trim(),
      budget:       parseFloat(document.getElementById('ev-budget').value) || 0,
      client_name:  document.getElementById('ev-client').value.trim(),
      client_phone: document.getElementById('ev-phone').value.trim(),
      client_email: document.getElementById('ev-email').value.trim(),
      status:       document.getElementById('ev-status').value,
      notes:        document.getElementById('ev-notes').value.trim(),
    };

    if (!body.name || !body.event_date) {
      errEl.textContent = 'Nom et date sont requis.';
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true);
    try {
      if (isEdit) {
        await API.updateEvent(id, body);
        showToast('Événement mis à jour', 'success');
      } else {
        await API.createEvent(body);
        showToast('Événement créé', 'success');
      }
      closeModal();
      loadEvents();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });
}

async function deleteEvent(id) {
  confirmDialog('Supprimer l\'événement', 'Cette action est irréversible. Les commandes liées seront conservées.', async () => {
    try {
      await API.deleteEvent(id);
      showToast('Événement supprimé', 'success');
      navigateTo('events');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
