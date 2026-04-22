/* ══════════════════════════════════════
   Orders — SoCake
══════════════════════════════════════ */

// ── LIST ──────────────────────────────
async function loadOrders() {
  const search   = document.getElementById('order-search')?.value.trim();
  const status   = document.getElementById('order-filter-status')?.value;
  const tbody    = document.getElementById('orders-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:var(--space-10)"><div class="spinner" style="margin:auto"></div></td></tr>`;

  try {
    const orders = await API.getOrders({ search: search || undefined, status: status || undefined });

    if (!orders.length) {
      tbody.innerHTML = `<tr><td colspan="9">${emptyState('📋', 'Aucune commande', 'Créez votre première commande.')}</td></tr>`;
      return;
    }

    const user = getCurrentUser();
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td><strong class="order-num">${o.order_number}</strong></td>
        <td>
          <div class="td-primary">${escHtml(o.client_name)}</div>
          ${o.client_phone ? `<div class="td-secondary">${escHtml(o.client_phone)}</div>` : ''}
        </td>
        <td>${o.event_name ? `<span class="badge badge-info">${escHtml(o.event_name)}</span>` : '<span class="text-muted">—</span>'}</td>
        <td>${orderTypeBadge(o.order_type)}</td>
        <td>
          <div class="td-primary">${formatDate(o.delivery_date)}</div>
          <div class="td-secondary" style="color:${isUrgent(o.delivery_date) ? 'var(--danger)' : 'var(--gray-500)'}">${formatRelativeDate(o.delivery_date)}</div>
        </td>
        <td>
          <div class="td-primary fw-600" style="color:var(--rose)">${formatMoney(o.total_amount)}</div>
          ${o.advance_paid > 0 ? `<div class="td-secondary">Acompte: ${formatMoney(o.advance_paid)}</div>` : ''}
        </td>
        <td>${paymentStatusBadge(o.payment_status)}</td>
        <td>${orderBadge(o.status)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-ghost btn-icon btn-sm" onclick="viewOrderDetail(${o.id})" title="Voir détail">
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" onclick="openOrderModal(null, ${o.id})" title="Modifier">
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            ${user?.role === 'admin' ? `
            <button class="btn btn-ghost btn-icon btn-sm btn-danger-ghost" onclick="deleteOrder(${o.id})" title="Supprimer">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  } catch (err) {
    showToast('Erreur chargement commandes', 'error');
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:var(--space-8)">Erreur de chargement</td></tr>`;
  }
}

function isUrgent(dateStr) {
  if (!dateStr) return false;
  const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 2;
}

function orderTypeBadge(type) {
  if (type === 'emporter') return `<span class="badge badge-takeaway">🛍️ À emporter</span>`;
  return `<span class="badge badge-delivery">🚚 Livraison</span>`;
}

function toggleDeliveryAddress() {
  const type    = document.getElementById('ord-type')?.value;
  const addrGrp = document.getElementById('ord-address-group');
  if (addrGrp) addrGrp.style.display = type === 'emporter' ? 'none' : '';
}

// ── DETAIL ────────────────────────────
async function viewOrderDetail(id) {
  navigateTo('order-detail');
  const headerEl  = document.getElementById('order-detail-header');
  const contentEl = document.getElementById('order-detail-content');
  headerEl.innerHTML  = `<div class="loading-center" style="padding:var(--space-8)"><div class="spinner"></div></div>`;
  contentEl.innerHTML = '';

  try {
    const o    = await API.getOrder(id);
    const user = getCurrentUser();
    const remaining = (o.total_amount || 0) - (o.advance_paid || 0);

    headerEl.innerHTML = `
      <div class="detail-banner">
        <div class="detail-banner-title">📋 ${o.order_number}</div>
        <div class="detail-banner-subtitle">Commande de ${o.client_name}</div>
      </div>
      <div class="detail-meta-bar">
        <div class="detail-meta-item">
          <span class="detail-meta-label">Client</span>
          <span class="detail-meta-value">${o.client_name}</span>
        </div>
        ${o.client_phone ? `<div class="detail-meta-item">
          <span class="detail-meta-label">Téléphone</span>
          <span class="detail-meta-value">${o.client_phone}</span>
        </div>` : ''}
        ${o.client_email ? `<div class="detail-meta-item">
          <span class="detail-meta-label">Email</span>
          <span class="detail-meta-value">${o.client_email}</span>
        </div>` : ''}
        <div class="detail-meta-item">
          <span class="detail-meta-label">Type</span>
          <span class="detail-meta-value">${orderTypeBadge(o.order_type)}</span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-label">Livraison</span>
          <span class="detail-meta-value">${formatDate(o.delivery_date)}</span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-label">Statut</span>
          <span class="detail-meta-value">${orderBadge(o.status)}</span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-label">Total</span>
          <span class="detail-meta-value fw-600" style="color:var(--rose)">${formatMoney(o.total_amount)}</span>
        </div>
        ${o.advance_paid > 0 ? `<div class="detail-meta-item">
          <span class="detail-meta-label">Acompte</span>
          <span class="detail-meta-value" style="color:var(--success)">${formatMoney(o.advance_paid)}</span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-label">Reste à payer</span>
          <span class="detail-meta-value fw-600" style="color:${remaining > 0 ? 'var(--warning)' : 'var(--success)'}">${formatMoney(remaining)}</span>
        </div>` : ''}
      </div>
      <div class="detail-actions">
        <button class="btn btn-secondary btn-sm" onclick="navigateTo('orders')">
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg> Retour
        </button>
        <button class="btn btn-primary btn-sm" onclick="openOrderModal(null, ${o.id})">Modifier</button>
        <a class="btn btn-secondary btn-sm" href="/api/orders/${o.id}/pdf?type=devis&token=${encodeURIComponent(getToken())}" target="_blank" title="Télécharger devis PDF">
          <svg viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Devis
        </a>
        <a class="btn btn-secondary btn-sm" href="/api/orders/${o.id}/pdf?type=facture&token=${encodeURIComponent(getToken())}" target="_blank" title="Télécharger facture PDF">
          <svg viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Facture
        </a>
        <div class="status-quick-btns" id="status-quick-btns">
          ${buildStatusButtons(o.status, o.id)}
        </div>
        ${user?.role === 'admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteOrder(${o.id}, true)">Supprimer</button>` : ''}
      </div>`;

    // Items table
    const items = o.items || [];
    contentEl.innerHTML = `
      <div class="order-detail-grid">
        <div class="card">
          <div class="card-header"><h3 class="card-title">Articles commandés</h3></div>
          <div class="table-wrapper" style="border:none;box-shadow:none;border-radius:0">
            ${items.length ? `
            <table class="data-table">
              <thead><tr><th>Produit</th><th>Catégorie</th><th>Qté</th><th>Prix unit.</th><th>Sous-total</th><th>Personnalisation</th></tr></thead>
              <tbody>
                ${items.map(it => `
                <tr>
                  <td><strong>${it.product_name}</strong></td>
                  <td>${catBadge(it.product_category)}</td>
                  <td><span class="qty-badge">${it.quantity}</span></td>
                  <td>${formatMoney(it.unit_price)}</td>
                  <td style="color:var(--rose);font-weight:600">${formatMoney(it.subtotal)}</td>
                  <td class="text-muted text-small">${it.customization || '—'}</td>
                </tr>`).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="text-align:right;font-weight:700;padding:var(--space-3) var(--space-4)">Total</td>
                  <td style="color:var(--rose);font-weight:700;font-size:1.05rem">${formatMoney(o.total_amount)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>` : emptyState('📦', 'Aucun article', '')}
          </div>
        </div>

        ${o.delivery_address || o.notes ? `
        <div class="card">
          <div class="card-header"><h3 class="card-title">Informations complémentaires</h3></div>
          <div style="padding:var(--space-4) var(--space-6)">
            ${o.delivery_address ? `
            <div class="info-block">
              <div class="info-block-label">Adresse de livraison</div>
              <div class="info-block-value">${o.delivery_address}</div>
            </div>` : ''}
            ${o.notes ? `
            <div class="info-block">
              <div class="info-block-label">Notes internes</div>
              <div class="info-block-value">${o.notes}</div>
            </div>` : ''}
          </div>
        </div>` : ''}
      </div>`;

  } catch (err) {
    showToast('Erreur chargement commande', 'error');
  }
}

function buildStatusButtons(current, orderId) {
  const flow = [
    { from: 'en_attente',     to: 'confirme',       label: 'Confirmer',      cls: 'btn-info' },
    { from: 'confirme',       to: 'en_preparation', label: 'Démarrer prépa', cls: 'btn-warning' },
    { from: 'en_preparation', to: 'pret',            label: 'Marquer prêt',  cls: 'btn-success' },
    { from: 'pret',           to: 'livre',           label: 'Marquer livré', cls: 'btn-teal' },
  ];
  const next = flow.find(f => f.from === current);
  if (!next) return '';
  return `<button class="btn ${next.cls} btn-sm" onclick="quickUpdateStatus(${orderId}, '${next.to}')">${next.label}</button>`;
}

async function quickUpdateStatus(orderId, status) {
  try {
    await API.updateStatus(orderId, status);
    showToast('Statut mis à jour', 'success');
    // Refresh current view
    if (_currentPage === 'order-detail') viewOrderDetail(orderId);
    else loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── CREATE / EDIT MODAL ───────────────
let _orderProducts = [];

async function openOrderModal(eventId = null, orderId = null, prefill = null) {
  const isEdit = !!orderId;

  // Preload products + customers
  try {
    _orderProducts = await API.getProducts({ active: true });
  } catch {
    _orderProducts = [];
  }
  let _customers = [];
  try {
    _customers = await API.getCustomers();
  } catch { _customers = []; }

  const productOptions = _orderProducts.map(p =>
    `<option value="${p.id}" data-price="${p.price}">${p.name} — ${formatMoney(p.price)}</option>`
  ).join('');

  const modalBody = `
    <div class="form-group" style="margin-bottom:var(--space-3)">
      <label class="form-label">🔍 Rechercher un client enregistré</label>
      <input type="text" id="ord-client-search" class="form-input"
             placeholder="Tapez un nom, téléphone ou email…"
             autocomplete="off"
             oninput="filterOrderClients(this.value)"
             onfocus="filterOrderClients(this.value)"
             onblur="setTimeout(closeOrdDropdown, 200)" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nom du client *</label>
        <input type="text" id="ord-client" class="form-input" placeholder="Prénom Nom" required />
      </div>
      <div class="form-group">
        <label class="form-label">Téléphone</label>
        <input type="tel" id="ord-phone" class="form-input" placeholder="06 XX XX XX XX" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Email client</label>
        <input type="email" id="ord-email" class="form-input" placeholder="client@email.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Date de livraison *</label>
        <input type="date" id="ord-date" class="form-input" required />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Type de commande</label>
        <select id="ord-type" class="form-select" onchange="toggleDeliveryAddress()">
          <option value="livraison">🚚 Livraison</option>
          <option value="emporter">🛍️ À emporter</option>
        </select>
      </div>
      <div class="form-group" id="ord-address-group">
        <label class="form-label">Adresse de livraison</label>
        <input type="text" id="ord-address" class="form-input" placeholder="12 rue de la Pâtisserie, Paris" />
      </div>
    </div>

    <div class="section-title">Articles commandés</div>
    <div id="order-items-list" class="order-items-builder"></div>
    <button type="button" class="btn btn-secondary btn-sm" onclick="addOrderItem('${productOptions.replace(/'/g,"\\'")}')">
      <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Ajouter un article
    </button>

    <div class="order-total-row" id="order-total-display">Total : <strong>0,00 €</strong></div>

    <div class="form-row" style="margin-top:var(--space-4)">
      <div class="form-group">
        <label class="form-label">Acompte reçu (€)</label>
        <input type="number" id="ord-advance" class="form-input" placeholder="0" min="0" step="0.01" />
      </div>
      <div class="form-group">
        <label class="form-label">Mode de paiement</label>
        <select id="ord-payment-method" class="form-select">
          <option value="especes">Espèces</option>
          <option value="carte">Carte bancaire</option>
          <option value="virement">Virement</option>
          <option value="cheque">Chèque</option>
          <option value="en_ligne">En ligne</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Statut commande</label>
        <select id="ord-status" class="form-select">
          <option value="en_attente">En attente</option>
          <option value="confirme">Confirmé</option>
          <option value="en_preparation">En préparation</option>
          <option value="pret">Prêt</option>
          <option value="livre">Livré</option>
          <option value="annule">Annulé</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Heure de livraison</label>
        <input type="time" id="ord-delivery-time" class="form-input" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes internes</label>
      <textarea id="ord-notes" class="form-textarea" placeholder="Notes, personnalisations spéciales..."></textarea>
    </div>
    <div id="ord-error" class="form-error hidden"></div>`;

  openModal({
    title: isEdit ? 'Modifier la commande' : 'Nouvelle commande',
    body:  modalBody,
    size:  'modal-lg',
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" id="ord-save-btn">${isEdit ? 'Enregistrer' : 'Créer la commande'}</button>`,
  });

  // Clients disponibles pour l'autocomplétion
  window._ordCustomers = _customers;

  if (!isEdit) {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    document.getElementById('ord-date').value = d.toISOString().split('T')[0];
    // Pre-fill from customer if provided
    if (prefill) {
      if (prefill.client_name)  document.getElementById('ord-client').value  = prefill.client_name;
      if (prefill.client_email) document.getElementById('ord-email').value   = prefill.client_email;
      if (prefill.client_phone) document.getElementById('ord-phone').value   = prefill.client_phone;
    }
    // Add one empty item row
    addOrderItem(productOptions);
  }

  if (isEdit) {
    try {
      const o = await API.getOrder(orderId);
      document.getElementById('ord-client').value  = o.client_name || '';
      document.getElementById('ord-phone').value   = o.client_phone || '';
      document.getElementById('ord-email').value   = o.client_email || '';
      document.getElementById('ord-date').value    = o.delivery_date || '';
      document.getElementById('ord-address').value = o.delivery_address || '';
      document.getElementById('ord-advance').value = o.advance_paid || '';
      document.getElementById('ord-status').value  = o.status || 'en_attente';
      document.getElementById('ord-notes').value   = o.notes || '';
      const typeEl = document.getElementById('ord-type');
      if (typeEl) { typeEl.value = o.order_type || 'livraison'; toggleDeliveryAddress(); }

      // Load existing items
      (o.items || []).forEach(item => {
        addOrderItem(productOptions, item);
      });
      recalcOrderTotal();
    } catch (err) {
      showToast('Erreur chargement commande', 'error');
    }
  }

  document.getElementById('ord-save-btn').addEventListener('click', async () => {
    const btn   = document.getElementById('ord-save-btn');
    const errEl = document.getElementById('ord-error');
    errEl.classList.add('hidden');

    const items = collectOrderItems();
    if (!items.length) {
      errEl.textContent = 'Ajoutez au moins un article.';
      errEl.classList.remove('hidden');
      return;
    }

    const body = {
      event_id:         eventId || null,
      customer_id:      prefill?.customer_id || null,
      client_name:      document.getElementById('ord-client').value.trim(),
      client_phone:     document.getElementById('ord-phone').value.trim(),
      client_email:     document.getElementById('ord-email').value.trim(),
      delivery_date:    document.getElementById('ord-date').value,
      delivery_address: document.getElementById('ord-address').value.trim(),
      order_type:       document.getElementById('ord-type')?.value || 'livraison',
      advance_paid:     parseFloat(document.getElementById('ord-advance').value) || 0,
      payment_method:   document.getElementById('ord-payment-method')?.value || 'especes',
      status:           document.getElementById('ord-status').value,
      notes:            document.getElementById('ord-notes').value.trim(),
      items,
    };

    if (!body.client_name || !body.delivery_date) {
      errEl.textContent = 'Client et date de livraison sont requis.';
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true);
    try {
      if (isEdit) {
        await API.updateOrder(orderId, body);
        showToast('Commande mise à jour', 'success');
      } else {
        await API.createOrder(body);
        showToast('Commande créée', 'success');
      }
      closeModal();
      if (_currentPage === 'order-detail') viewOrderDetail(orderId);
      else loadOrders();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });
}

// ── ITEMS BUILDER ─────────────────────
let _itemIdx = 0;

function addOrderItem(productOptions, existing = null) {
  const idx  = _itemIdx++;
  const list = document.getElementById('order-items-list');
  if (!list) return;

  const row = document.createElement('div');
  row.className = 'order-item-row';
  row.dataset.idx = idx;
  row.innerHTML = `
    <div class="order-item-product">
      <select class="form-select order-item-select" id="item-product-${idx}" onchange="onItemProductChange(${idx})">
        <option value="">— Choisir produit —</option>
        ${productOptions}
      </select>
    </div>
    <div class="order-item-qty">
      <input type="number" class="form-input" id="item-qty-${idx}" value="${existing?.quantity || 1}" min="1" oninput="recalcOrderTotal()" placeholder="Qté" />
    </div>
    <div class="order-item-price">
      <input type="number" class="form-input" id="item-price-${idx}" value="${existing?.unit_price || ''}" min="0" step="0.01" oninput="recalcOrderTotal()" placeholder="Prix" />
    </div>
    <div class="order-item-custom">
      <input type="text" class="form-input" id="item-custom-${idx}" value="${existing?.customization || ''}" placeholder="Personnalisation..." />
    </div>
    <button type="button" class="btn btn-ghost btn-icon btn-sm btn-danger-ghost" onclick="removeOrderItem(${idx})">
      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;

  list.appendChild(row);

  if (existing) {
    const sel = document.getElementById(`item-product-${idx}`);
    if (sel) sel.value = existing.product_id;
  }

  recalcOrderTotal();
}

function onItemProductChange(idx) {
  const sel   = document.getElementById(`item-product-${idx}`);
  const opt   = sel?.options[sel.selectedIndex];
  const price = parseFloat(opt?.dataset.price || 0);
  const priceInput = document.getElementById(`item-price-${idx}`);
  if (priceInput && price) priceInput.value = price;
  recalcOrderTotal();
}

function removeOrderItem(idx) {
  document.querySelector(`.order-item-row[data-idx="${idx}"]`)?.remove();
  recalcOrderTotal();
}

function recalcOrderTotal() {
  const rows = document.querySelectorAll('.order-item-row');
  let total  = 0;
  rows.forEach(row => {
    const idx   = row.dataset.idx;
    const qty   = parseFloat(document.getElementById(`item-qty-${idx}`)?.value || 0);
    const price = parseFloat(document.getElementById(`item-price-${idx}`)?.value || 0);
    total += qty * price;
  });
  const el = document.getElementById('order-total-display');
  if (el) el.innerHTML = `Total : <strong>${formatMoney(total)}</strong>`;
}

function collectOrderItems() {
  const rows = document.querySelectorAll('.order-item-row');
  const items = [];
  rows.forEach(row => {
    const idx        = row.dataset.idx;
    const product_id = parseInt(document.getElementById(`item-product-${idx}`)?.value || 0);
    const quantity   = parseInt(document.getElementById(`item-qty-${idx}`)?.value || 0);
    const unit_price = parseFloat(document.getElementById(`item-price-${idx}`)?.value || 0);
    const customization = document.getElementById(`item-custom-${idx}`)?.value.trim() || '';
    if (product_id && quantity > 0) {
      items.push({ product_id, quantity, unit_price, customization });
    }
  });
  return items;
}

// ── DELETE ────────────────────────────
async function deleteOrder(id, goBack = false) {
  confirmDialog('Supprimer la commande', 'Cette action est irréversible.', async () => {
    try {
      await API.deleteOrder(id);
      showToast('Commande supprimée', 'success');
      if (goBack) navigateTo('orders');
      else loadOrders();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ── RECHERCHE CLIENT (autocomplétion dans la modale commande) ──
// Le dropdown est attaché au <body> (position:fixed) pour contourner
// l'overflow:auto du .modal-body qui coupe les éléments absolus.

function getOrdDropdown() {
  let drop = document.getElementById('ord-client-dropdown');
  if (!drop) {
    drop = document.createElement('div');
    drop.id = 'ord-client-dropdown';
    drop.className = 'ord-client-dropdown';
    document.body.appendChild(drop);
  }
  return drop;
}

function closeOrdDropdown() {
  const drop = document.getElementById('ord-client-dropdown');
  if (drop) drop.remove();
}

function filterOrderClients(query) {
  const input = document.getElementById('ord-client-search');
  if (!input) return;

  const list = window._ordCustomers || [];
  const q = (query || '').trim().toLowerCase();

  const matches = q.length === 0
    ? list.slice(0, 8)
    : list.filter(c =>
        (c.name  || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      ).slice(0, 8);

  if (matches.length === 0) { closeOrdDropdown(); return; }

  // Positionne le dropdown juste sous l'input (fixed, donc hors overflow)
  const rect = input.getBoundingClientRect();
  const drop = getOrdDropdown();
  drop.style.position = 'fixed';
  drop.style.top      = (rect.bottom + 4) + 'px';
  drop.style.left     = rect.left + 'px';
  drop.style.width    = rect.width + 'px';
  drop.style.zIndex   = '99999';

  drop.innerHTML = matches.map(c => `
    <div class="ord-client-option" onmousedown="selectOrderClient(${c.id})">
      <span class="ord-client-option-name">${escHtml(c.name || '')}</span>
      <span class="ord-client-option-sub">${[c.phone, c.email].filter(Boolean).join('  ·  ')}</span>
    </div>
  `).join('');
}

function selectOrderClient(id) {
  const c = (window._ordCustomers || []).find(x => x.id === id);
  if (!c) return;

  const setVal = (elId, val) => {
    const el = document.getElementById(elId);
    if (el && val != null) el.value = val;
  };
  setVal('ord-client', c.name);
  setVal('ord-phone',  c.phone);
  setVal('ord-email',  c.email);
  if (c.address) setVal('ord-address', c.address);

  const search = document.getElementById('ord-client-search');
  if (search) search.value = c.name || '';
  closeOrdDropdown();
}
