/* ══════════════════════════════════════
   Deliveries — SoCake
══════════════════════════════════════ */

function resetDeliveryFilters() {
  const today = new Date().toISOString().split('T')[0];
  const dateEl = document.getElementById('delivery-filter-date');
  if (dateEl) dateEl.value = today;
  document.getElementById('delivery-filter-status').value = '';
  loadDeliveries();
}

async function loadDeliveries() {
  const date   = document.getElementById('delivery-filter-date')?.value;
  const status = document.getElementById('delivery-filter-status')?.value;
  const el     = document.getElementById('deliveries-content');
  if (!el) return;

  el.innerHTML = `<div class="loading-center"><div class="spinner"></div></div>`;

  try {
    const deliveries = await API.getDeliveries({ date: date || undefined, status: status || undefined });

    if (!deliveries.length) {
      el.innerHTML = emptyState('🚚', 'Aucune livraison', date ? 'Aucune livraison pour cette date.' : 'Aucune livraison planifiée.');
      return;
    }

    // Group by date
    const groups = {};
    deliveries.forEach(d => {
      const key = d.delivery_date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });

    const today = new Date().toISOString().split('T')[0];

    el.innerHTML = Object.entries(groups).map(([date, items]) => {
      const isToday = date === today;
      const dateLabel = isToday ? "Aujourd'hui" : formatDate(date);
      const cards = items.map(d => buildDeliveryCard(d, isToday)).join('');
      return `
        <div class="deliveries-day-group">
          <div class="deliveries-day-label">
            <span class="deliveries-day-title">${dateLabel}</span>
            <span class="deliveries-day-count">${items.length} livraison${items.length > 1 ? 's' : ''}</span>
            <div class="deliveries-day-line"></div>
          </div>
          ${cards}
        </div>`;
    }).join('');
  } catch (err) {
    showToast('Erreur chargement livraisons', 'error');
    el.innerHTML = emptyState('⚠️', 'Erreur de chargement', err.message);
  }
}

function buildDeliveryCard(d, isToday) {
  const timeStr = d.scheduled_time || d.delivery_time || '';
  const hasDriver = d.driver_name;

  return `
    <div class="delivery-card ${isToday ? 'is-today' : ''}">
      <div class="delivery-time-badge">
        ${timeStr
          ? `<span class="delivery-time-hour">${timeStr.slice(0,5)}</span><span class="delivery-time-label">heure</span>`
          : `<span class="delivery-time-label" style="font-size:.7rem">Heure<br>à définir</span>`}
      </div>
      <div class="delivery-info">
        <div class="delivery-client">${escHtml(d.customer_name || d.client_name)}</div>
        ${d.delivery_address ? `<div class="delivery-address">
          <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${escHtml(d.delivery_address)}
        </div>` : ''}
        <div style="display:flex;gap:8px;margin-top:4px;align-items:center">
          <span class="delivery-order-num">${d.order_number}</span>
          ${orderBadge(d.status)}
          ${paymentBadge(d.advance_paid, d.total_amount)}
        </div>
        ${d.delivery_notes ? `<div class="td-secondary" style="margin-top:4px">📝 ${escHtml(d.delivery_notes)}</div>` : ''}
      </div>
      <div class="delivery-driver">
        ${hasDriver
          ? `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
             <span>${escHtml(d.driver_name)}</span>
             ${d.vehicle ? `<span class="text-muted text-small">${escHtml(d.vehicle)}</span>` : ''}`
          : `<svg viewBox="0 0 24 24" style="color:var(--gray-300)"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
             <span class="text-muted text-small">Non assigné</span>`}
      </div>
      <div class="table-actions">
        <button class="btn btn-ghost btn-icon btn-sm" onclick="viewOrderDetail(${d.id})" title="Voir commande">
          <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="btn btn-ghost btn-icon btn-sm" onclick="openDeliveryModal(${d.id})" title="Infos livraison">
          <svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        </button>
        ${d.status !== 'livre' ? `
        <button class="btn btn-success btn-sm" onclick="markAsDelivered(${d.id})" title="Marquer livré">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          Livré
        </button>` : `<span class="badge badge-teal">✓ Livré</span>`}
      </div>
    </div>`;
}

function paymentBadge(advance, total) {
  if (!total) return '';
  if (advance >= total) return `<span class="badge badge-payment-ok">Payé</span>`;
  if (advance > 0)      return `<span class="badge badge-payment-partial">Partiel</span>`;
  return `<span class="badge badge-payment-pending">Impayé</span>`;
}

async function openDeliveryModal(orderId) {
  // Get current delivery info
  let delivery = {};
  try {
    const order = await API.getOrder(orderId);
    delivery = order.delivery || {};
  } catch (_) {}

  openModal({
    title: 'Informations de livraison',
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Livreur</label>
          <input type="text" id="del-driver" class="form-input" value="${escHtml(delivery.driver_name || '')}" placeholder="Nom du livreur" />
        </div>
        <div class="form-group">
          <label class="form-label">Véhicule</label>
          <input type="text" id="del-vehicle" class="form-input" value="${escHtml(delivery.vehicle || '')}" placeholder="Voiture, vélo, etc." />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Heure prévue</label>
          <input type="time" id="del-time" class="form-input" value="${escHtml(delivery.scheduled_time || '')}" />
        </div>
        <div class="form-group">
          <label class="form-label">Destinataire</label>
          <input type="text" id="del-recipient" class="form-input" value="${escHtml(delivery.recipient_name || '')}" placeholder="Nom du destinataire" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes de livraison</label>
        <textarea id="del-notes" class="form-textarea" placeholder="Digicode, étage, instructions...">${escHtml(delivery.delivery_notes || '')}</textarea>
      </div>`,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" id="del-save-btn" onclick="saveDelivery(${orderId})">Enregistrer</button>`,
  });
}

async function saveDelivery(orderId) {
  const btn = document.getElementById('del-save-btn');
  setLoading(btn, true);
  try {
    await API.updateDelivery(orderId, {
      driver_name:    document.getElementById('del-driver')?.value.trim(),
      vehicle:        document.getElementById('del-vehicle')?.value.trim(),
      scheduled_time: document.getElementById('del-time')?.value,
      recipient_name: document.getElementById('del-recipient')?.value.trim(),
      delivery_notes: document.getElementById('del-notes')?.value.trim(),
    });
    showToast('Livraison mise à jour', 'success');
    closeModal();
    loadDeliveries();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function markAsDelivered(orderId) {
  confirmDialog('Marquer comme livré', 'Confirmer que cette commande a bien été livrée ?', async () => {
    try {
      await API.updateStatus(orderId, 'livre');
      await API.updateDelivery(orderId, { delivered_at: new Date().toISOString() });
      showToast('Commande marquée comme livrée', 'success');
      loadDeliveries();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
