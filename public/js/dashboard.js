/* ══════════════════════════════════════
   Dashboard — SoCake
══════════════════════════════════════ */

async function loadDashboard() {
  try {
    const data = await API.getDashboard();

    // ── Stats ──
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-total',       data.totalOrders);
    set('stat-pending',     data.pendingOrders);
    set('stat-revenue',     formatMoney(data.monthRevenue));
    set('stat-outstanding', formatMoney(data.outstanding));
    set('stat-customers',   data.totalCustomers);
    set('stat-deliveries',  data.todayDeliveries);
    set('stat-events',      data.upcomingEvents);
    set('stat-stock',       data.lowStock);

    // Refresh nav badges
    if (typeof refreshNavBadges === 'function') refreshNavBadges(data);

    // ── Recent orders ──
    const ordersEl = document.getElementById('recent-orders-list');
    if (ordersEl) {
      if (!data.recentOrders.length) {
        ordersEl.innerHTML = emptyState('📋', 'Aucune commande', 'Les commandes apparaîtront ici.');
      } else {
        ordersEl.innerHTML = data.recentOrders.map(o => `
          <div class="order-mini-item" onclick="navigateTo('orders')" style="cursor:pointer">
            <div class="order-mini-info">
              <div class="order-mini-num">${o.order_number}</div>
              <div class="order-mini-client">${escHtml(o.client_name)}${o.event_name ? ` · <em>${escHtml(o.event_name)}</em>` : ''}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              ${orderBadge(o.status)}
              <span class="order-mini-amount">${formatMoney(o.total_amount)}</span>
            </div>
          </div>`).join('');
      }
    }

    // ── Upcoming events ──
    const eventsEl = document.getElementById('upcoming-events-list');
    if (eventsEl) {
      if (!data.upcomingEventsList.length) {
        eventsEl.innerHTML = emptyState('📅', 'Aucun événement', 'Les prochains événements apparaîtront ici.');
      } else {
        eventsEl.innerHTML = data.upcomingEventsList.map(ev => `
          <div class="event-mini-item">
            <div class="event-mini-icon">${getEventIcon(ev.name)}</div>
            <div style="flex:1">
              <div class="event-mini-name">${escHtml(ev.name)}</div>
              <div class="event-mini-date">${formatDate(ev.event_date)}${ev.location ? ` · ${escHtml(ev.location)}` : ''}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              ${eventBadge(ev.status)}
              <span style="font-size:.75rem;color:var(--gray-500)">${ev.order_count} commande${ev.order_count !== 1 ? 's' : ''}</span>
            </div>
          </div>`).join('');
      }
    }

  } catch (err) {
    console.error('Dashboard error:', err);
    showToast('Erreur lors du chargement du tableau de bord', 'error');
  }
}

function getEventIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('mariage') || n.includes('wedding')) return '💍';
  if (n.includes('anniversaire') || n.includes('anniv')) return '🎂';
  if (n.includes('noël') || n.includes('noel'))         return '🎄';
  if (n.includes('valentin'))                            return '❤️';
  if (n.includes('entreprise') || n.includes('corporate')) return '🏢';
  return '🎉';
}
