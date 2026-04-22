/* ══════════════════════════════════════
   Stock — SoCake
══════════════════════════════════════ */

// ── LIST ──────────────────────────────
async function loadStock() {
  const lowOnly = document.getElementById('stock-low-filter')?.checked;
  const tbody   = document.getElementById('stock-tbody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:var(--space-10)"><div class="spinner" style="margin:auto"></div></td></tr>`;

  try {
    const items = await API.getStock({ low: lowOnly ? true : undefined });

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="7">${emptyState('📦', 'Aucun article en stock', 'Ajoutez vos ingrédients et emballages.')}</td></tr>`;
      return;
    }

    const user = getCurrentUser();
    tbody.innerHTML = items.map(item => {
      const isLow = item.quantity <= item.min_quantity;
      const pct   = item.min_quantity > 0 ? Math.min(100, Math.round((item.quantity / (item.min_quantity * 3)) * 100)) : 100;
      return `
        <tr class="${isLow ? 'row-warning' : ''}">
          <td>
            <div class="td-primary">${item.name}</div>
            ${item.supplier ? `<div class="td-secondary">Fourn: ${item.supplier}</div>` : ''}
          </td>
          <td><span class="badge badge-gray">${item.category || 'ingredient'}</span></td>
          <td>
            <div class="stock-qty-wrap">
              <strong style="color:${isLow ? 'var(--danger)' : 'var(--gray-900)'}">${item.quantity}</strong>
              <div class="stock-bar-wrap">
                <div class="stock-bar" style="width:${pct}%;background:${isLow ? 'var(--danger)' : pct < 50 ? 'var(--warning)' : 'var(--success)'}"></div>
              </div>
            </div>
          </td>
          <td>${item.unit}</td>
          <td>${item.min_quantity}</td>
          <td>
            ${isLow
              ? `<span class="badge badge-danger">⚠ Stock faible</span>`
              : `<span class="badge badge-success">OK</span>`}
          </td>
          <td>
            <div class="table-actions">
              <button class="btn btn-ghost btn-icon btn-sm" onclick="openMovementModal(${item.id}, '${item.name.replace(/'/g,"\\'")}', ${item.quantity})" title="Mouvement">
                <svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              </button>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="openStockModal(${item.id})" title="Modifier">
                <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn-ghost btn-icon btn-sm" onclick="viewMovements(${item.id}, '${item.name.replace(/'/g,"\\'")}')">
                <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </button>
              ${user?.role === 'admin' ? `
              <button class="btn btn-ghost btn-icon btn-sm btn-danger-ghost" onclick="deleteStockItem(${item.id})" title="Supprimer">
                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              </button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch (err) {
    showToast('Erreur chargement stock', 'error');
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding:var(--space-8)">Erreur de chargement</td></tr>`;
  }
}

// ── ADD / EDIT MODAL ──────────────────
async function openStockModal(id = null) {
  const isEdit = !!id;
  let item = null;

  if (isEdit) {
    try {
      const all = await API.getStock();
      item = all.find(i => i.id === id);
    } catch { /* continue */ }
  }

  const body = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nom de l'article *</label>
        <input type="text" id="stk-name" class="form-input" placeholder="Ex: Farine T55" required value="${item?.name || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Catégorie</label>
        <select id="stk-category" class="form-select">
          <option value="ingredient" ${!item || item.category === 'ingredient' ? 'selected' : ''}>Ingrédient</option>
          <option value="emballage" ${item?.category === 'emballage' ? 'selected' : ''}>Emballage</option>
          <option value="materiel"  ${item?.category === 'materiel'  ? 'selected' : ''}>Matériel</option>
          <option value="autre"     ${item?.category === 'autre'     ? 'selected' : ''}>Autre</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Quantité *</label>
        <input type="number" id="stk-quantity" class="form-input" placeholder="0" min="0" step="0.01" value="${item?.quantity ?? ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Unité *</label>
        <select id="stk-unit" class="form-select">
          ${['kg','g','L','cl','ml','unité','boîte','sachet','pièce'].map(u =>
            `<option value="${u}" ${item?.unit === u ? 'selected' : ''}>${u}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Seuil d'alerte</label>
        <input type="number" id="stk-min" class="form-input" placeholder="0" min="0" step="0.01" value="${item?.min_quantity ?? ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Coût unitaire (€)</label>
        <input type="number" id="stk-cost" class="form-input" placeholder="0.00" min="0" step="0.01" value="${item?.cost_per_unit ?? ''}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Fournisseur</label>
      <input type="text" id="stk-supplier" class="form-input" placeholder="Nom du fournisseur" value="${item?.supplier || ''}" />
    </div>
    <div id="stk-error" class="form-error hidden"></div>`;

  openModal({
    title:  isEdit ? 'Modifier l\'article' : 'Ajouter un article',
    body,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" id="stk-save-btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>`,
  });

  document.getElementById('stk-save-btn').addEventListener('click', async () => {
    const btn   = document.getElementById('stk-save-btn');
    const errEl = document.getElementById('stk-error');
    errEl.classList.add('hidden');

    const payload = {
      name:         document.getElementById('stk-name').value.trim(),
      category:     document.getElementById('stk-category').value,
      quantity:     parseFloat(document.getElementById('stk-quantity').value),
      unit:         document.getElementById('stk-unit').value,
      min_quantity: parseFloat(document.getElementById('stk-min').value) || 0,
      cost_per_unit:parseFloat(document.getElementById('stk-cost').value) || 0,
      supplier:     document.getElementById('stk-supplier').value.trim(),
    };

    if (!payload.name || isNaN(payload.quantity)) {
      errEl.textContent = 'Nom et quantité sont requis.';
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true);
    try {
      if (isEdit) {
        await API.updateStock(id, payload);
        showToast('Article mis à jour', 'success');
      } else {
        await API.createStock(payload);
        showToast('Article ajouté', 'success');
      }
      closeModal();
      loadStock();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });
}

// ── MOVEMENT MODAL ────────────────────
function openMovementModal(stockId, stockName, currentQty) {
  const body = `
    <div class="movement-current">
      <span class="movement-stock-name">${stockName}</span>
      <span class="movement-stock-qty">Stock actuel : <strong>${currentQty}</strong></span>
    </div>
    <div class="form-group">
      <label class="form-label">Type de mouvement *</label>
      <div class="btn-group-radio" id="movement-type-group">
        <label class="radio-btn active">
          <input type="radio" name="mv-type" value="entree" checked> Entrée
        </label>
        <label class="radio-btn">
          <input type="radio" name="mv-type" value="sortie"> Sortie
        </label>
        <label class="radio-btn">
          <input type="radio" name="mv-type" value="ajustement"> Ajustement
        </label>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Quantité *</label>
      <input type="number" id="mv-qty" class="form-input" placeholder="0" min="0.01" step="0.01" required />
    </div>
    <div class="form-group">
      <label class="form-label">Motif</label>
      <input type="text" id="mv-reason" class="form-input" placeholder="Livraison fournisseur, utilisation recette..." />
    </div>
    <div id="mv-error" class="form-error hidden"></div>`;

  openModal({
    title:  `Mouvement de stock`,
    body,
    size:   'modal-sm',
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" id="mv-save-btn">Enregistrer</button>`,
  });

  // Radio button active style
  document.querySelectorAll('#movement-type-group .radio-btn').forEach(lbl => {
    lbl.addEventListener('click', () => {
      document.querySelectorAll('#movement-type-group .radio-btn').forEach(l => l.classList.remove('active'));
      lbl.classList.add('active');
    });
  });

  document.getElementById('mv-save-btn').addEventListener('click', async () => {
    const btn   = document.getElementById('mv-save-btn');
    const errEl = document.getElementById('mv-error');
    errEl.classList.add('hidden');

    const type     = document.querySelector('input[name="mv-type"]:checked')?.value;
    const quantity = parseFloat(document.getElementById('mv-qty').value);
    const reason   = document.getElementById('mv-reason').value.trim();

    if (!type || !quantity || quantity <= 0) {
      errEl.textContent = 'Type et quantité sont requis.';
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true);
    try {
      await API.stockMovement(stockId, { type, quantity, reason });
      showToast('Mouvement enregistré', 'success');
      closeModal();
      loadStock();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });
}

// ── MOVEMENTS HISTORY ─────────────────
async function viewMovements(stockId, stockName) {
  openModal({
    title: `Historique — ${stockName}`,
    body:  `<div class="loading-center" style="padding:var(--space-8)"><div class="spinner"></div></div>`,
    size:  'modal-lg',
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Fermer</button>`,
  });

  try {
    const movements = await API.getMovements(stockId);
    const body = document.getElementById('modal-body');
    if (!movements.length) {
      body.innerHTML = emptyState('📊', 'Aucun mouvement', 'Les mouvements apparaîtront ici.');
      return;
    }

    const typeLabels = { entree: '↑ Entrée', sortie: '↓ Sortie', ajustement: '⟳ Ajust.' };
    const typeColors = { entree: 'var(--success)', sortie: 'var(--danger)', ajustement: 'var(--info)' };

    body.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Date</th><th>Type</th><th>Quantité</th><th>Motif</th><th>Par</th></tr></thead>
        <tbody>
          ${movements.map(m => `
          <tr>
            <td class="td-secondary">${formatDate(m.created_at)}</td>
            <td><strong style="color:${typeColors[m.type] || 'var(--gray-700)'}">${typeLabels[m.type] || m.type}</strong></td>
            <td><strong>${m.quantity}</strong></td>
            <td class="text-small text-muted">${m.reason || '—'}</td>
            <td class="text-small">${m.user_name || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    showToast('Erreur historique', 'error');
  }
}

// ── DELETE ────────────────────────────
async function deleteStockItem(id) {
  confirmDialog('Supprimer l\'article', 'Cette action est irréversible. Tout l\'historique sera perdu.', async () => {
    try {
      await API.deleteStock(id);
      showToast('Article supprimé', 'success');
      loadStock();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
