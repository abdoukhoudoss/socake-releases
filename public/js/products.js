/* ══════════════════════════════════════
   Products — SoCake
══════════════════════════════════════ */

// ── GRID ──────────────────────────────
async function loadProducts() {
  const cat   = document.getElementById('product-filter-cat')?.value;
  const grid  = document.getElementById('products-grid');
  if (!grid) return;

  grid.innerHTML = `<div class="loading-center" style="grid-column:1/-1"><div class="spinner"></div></div>`;

  try {
    const products = await API.getProducts({ category: cat || undefined });
    const user     = getCurrentUser();

    if (!products.length) {
      grid.innerHTML = `<div style="grid-column:1/-1">${emptyState('🎂', 'Aucun produit', 'Ajoutez vos premiers produits au catalogue.')}</div>`;
      return;
    }

    grid.innerHTML = products.map(p => buildProductCard(p, user)).join('');
  } catch (err) {
    showToast('Erreur chargement produits', 'error');
    grid.innerHTML = '';
  }
}

function buildProductCard(p, user) {
  const cat = CATEGORY_LABELS[p.category] || { emoji: '🍰', label: p.category };
  return `
  <div class="product-card ${!p.active ? 'product-inactive' : ''}">
    <div class="product-card-header">
      <div class="product-emoji">${cat.emoji}</div>
      <div class="product-badge-wrap">
        ${catBadge(p.category)}
        ${!p.active ? '<span class="badge badge-danger">Inactif</span>' : ''}
      </div>
    </div>
    <div class="product-card-body">
      <h3 class="product-name">${p.name}</h3>
      ${p.description ? `<p class="product-desc">${p.description}</p>` : ''}
      <div class="product-footer">
        <div class="product-price">${formatMoney(p.price)} <span class="product-unit">/ ${p.unit}</span></div>
        <div class="product-actions">
          <button class="btn btn-ghost btn-icon btn-sm" onclick="openProductModal(${p.id})" title="Modifier">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          ${user?.role === 'admin' ? `
          <button class="btn btn-ghost btn-icon btn-sm btn-danger-ghost" onclick="deleteProduct(${p.id})" title="Désactiver">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          </button>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

// ── CREATE / EDIT MODAL ───────────────
async function openProductModal(id = null) {
  const isEdit = !!id;
  let product  = null;

  if (isEdit) {
    try {
      const all = await API.getProducts();
      product   = all.find(p => p.id === id);
    } catch { /* continue */ }
  }

  const body = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nom du produit *</label>
        <input type="text" id="prd-name" class="form-input" placeholder="Ex: Cupcake Red Velvet" value="${product?.name || ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Catégorie *</label>
        <select id="prd-cat" class="form-select">
          <option value="verrine"     ${product?.category === 'verrine'     ? 'selected' : ''}>🍮 Verrine</option>
          <option value="cupcake"     ${product?.category === 'cupcake'     ? 'selected' : ''}>🧁 Cupcake</option>
          <option value="solo_delice" ${product?.category === 'solo_delice' ? 'selected' : ''}>🍰 Solo Délice</option>
          <option value="mignardise"  ${product?.category === 'mignardise'  ? 'selected' : ''}>🍬 Mignardise</option>
          <option value="gateau"      ${product?.category === 'gateau'      ? 'selected' : ''}>🎂 Gâteau</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea id="prd-desc" class="form-textarea" placeholder="Description du produit, ingrédients principaux...">${product?.description || ''}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Prix (€) *</label>
        <input type="number" id="prd-price" class="form-input" placeholder="0.00" min="0" step="0.01" value="${product?.price ?? ''}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Unité</label>
        <select id="prd-unit" class="form-select">
          ${['pièce','boîte','lot','kg','portion'].map(u =>
            `<option value="${u}" ${product?.unit === u ? 'selected' : ''}>${u}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    ${isEdit ? `
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" id="prd-active" ${product?.active ? 'checked' : ''}/>
        <span>Produit actif (visible dans les commandes)</span>
      </label>
    </div>` : ''}
    <div id="prd-error" class="form-error hidden"></div>`;

  openModal({
    title:  isEdit ? 'Modifier le produit' : 'Ajouter un produit',
    body,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" id="prd-save-btn">${isEdit ? 'Enregistrer' : 'Ajouter'}</button>`,
  });

  document.getElementById('prd-save-btn').addEventListener('click', async () => {
    const btn   = document.getElementById('prd-save-btn');
    const errEl = document.getElementById('prd-error');
    errEl.classList.add('hidden');

    const payload = {
      name:        document.getElementById('prd-name').value.trim(),
      category:    document.getElementById('prd-cat').value,
      description: document.getElementById('prd-desc').value.trim(),
      price:       parseFloat(document.getElementById('prd-price').value),
      unit:        document.getElementById('prd-unit').value,
    };

    if (isEdit) {
      payload.active = document.getElementById('prd-active')?.checked ? 1 : 0;
    }

    if (!payload.name || !payload.category || isNaN(payload.price)) {
      errEl.textContent = 'Nom, catégorie et prix sont requis.';
      errEl.classList.remove('hidden');
      return;
    }

    setLoading(btn, true);
    try {
      if (isEdit) {
        await API.updateProduct(id, payload);
        showToast('Produit mis à jour', 'success');
      } else {
        await API.createProduct(payload);
        showToast('Produit ajouté au catalogue', 'success');
      }
      closeModal();
      loadProducts();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      setLoading(btn, false);
    }
  });
}

// ── DELETE (soft) ─────────────────────
async function deleteProduct(id) {
  confirmDialog('Désactiver le produit', 'Le produit sera masqué du catalogue mais conservé dans l\'historique des commandes.', async () => {
    try {
      await API.deleteProduct(id);
      showToast('Produit désactivé', 'success');
      loadProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}
