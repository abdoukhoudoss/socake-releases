/* ══════════════════════════════════════
   Reports — SoCake
══════════════════════════════════════ */

// Registered Chart.js instances
const _charts = {};

function destroyChart(id) {
  if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

// ── TAB SWITCHING ─────────────────────
function switchReportTab(el, tab) {
  document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.report-tab-content').forEach(c => c.classList.add('hidden'));
  el.classList.add('active');
  document.getElementById(`report-tab-${tab}`)?.classList.remove('hidden');
}

// ── LOAD REPORTS ──────────────────────
async function loadReports() {
  try {
    const [data, margins] = await Promise.all([
      API.getReports({ months: 12 }),
      API.getMargins(),
    ]);

    renderSummary(data.summary);
    renderRevenueChart(data.monthly);
    renderStatusChart(data.byStatus);
    renderCategoryChart(data.byCategory);
    renderTopProducts(data.topProducts);
    renderTopCustomers(data.topCustomers);
    renderMargins(margins);
  } catch (err) {
    showToast('Erreur chargement rapports', 'error');
  }
}

// ── SUMMARY CARDS ─────────────────────
function renderSummary(s) {
  const el = document.getElementById('report-summary-grid');
  if (!el || !s) return;

  el.innerHTML = [
    { label: "Chiffre d'affaires total",  value: formatMoney(s.total_revenue),   sub: `${s.total_orders} commandes` },
    { label: "Montant moyen / commande",  value: formatMoney(s.avg_order),       sub: 'panier moyen' },
    { label: "Encaissé",                  value: formatMoney(s.total_collected), sub: 'paiements reçus' },
    { label: "Restant dû",                value: formatMoney(s.total_outstanding), sub: 'à encaisser' },
    { label: "Clients uniques",           value: s.unique_customers,             sub: 'acheteurs' },
  ].map(c => `
    <div class="report-summary-card">
      <div class="report-summary-label">${c.label}</div>
      <div class="report-summary-value">${c.value}</div>
      <div class="report-summary-sub">${c.sub}</div>
    </div>`).join('');
}

// ── REVENUE BAR CHART ─────────────────
function renderRevenueChart(monthly) {
  const ctx = document.getElementById('chart-revenue');
  if (!ctx || !monthly?.length) return;
  destroyChart('revenue');

  const labels  = monthly.map(m => formatMonthLabel(m.month));
  const revenue = monthly.map(m => m.revenue);
  const orders  = monthly.map(m => m.orders);

  _charts.revenue = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: "Chiffre d'affaires (€)",
          data: revenue,
          backgroundColor: 'rgba(232, 116, 142, 0.8)',
          borderColor: '#E8748E',
          borderWidth: 0,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Nb commandes',
          data: orders,
          type: 'line',
          yAxisID: 'y2',
          borderColor: '#C9A84C',
          backgroundColor: 'rgba(201,168,76,.15)',
          borderWidth: 2,
          tension: .4,
          pointRadius: 4,
          pointBackgroundColor: '#C9A84C',
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index' },
      plugins: {
        legend: { position: 'top', labels: { font: { family: 'Inter', size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => ctx.datasetIndex === 0
              ? ` ${formatMoney(ctx.raw)}`
              : ` ${ctx.raw} commandes`,
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y:  { beginAtZero: true, ticks: { callback: v => `${v} €` } },
        y2: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } },
      },
    },
  });
}

// ── STATUS DONUT ──────────────────────
function renderStatusChart(byStatus) {
  const ctx = document.getElementById('chart-status');
  if (!ctx || !byStatus?.length) return;
  destroyChart('status');

  const STATUS_COLORS = {
    en_attente:     '#9E9E9E',
    confirme:       '#5B8DEF',
    en_preparation: '#F5A623',
    pret:           '#4CAF82',
    livre:          '#20B2AA',
    annule:         '#E05A5A',
  };

  const filtered = byStatus.filter(s => s.status !== 'annule' || s.count > 0);

  _charts.status = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: filtered.map(s => ORDER_STATUS[s.status]?.label || s.status),
      datasets: [{
        data: filtered.map(s => s.count),
        backgroundColor: filtered.map(s => STATUS_COLORS[s.status] || '#ccc'),
        borderWidth: 3,
        borderColor: '#fff',
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, padding: 16 } },
      },
    },
  });
}

// ── CATEGORY BAR ──────────────────────
function renderCategoryChart(byCategory) {
  const ctx = document.getElementById('chart-category');
  if (!ctx || !byCategory?.length) return;
  destroyChart('category');

  const CAT_COLORS = {
    verrine:     '#E8748E',
    cupcake:     '#C9A84C',
    solo_delice: '#8B5CF6',
    mignardise:  '#20B2AA',
    gateau:      '#E05A5A',
    autre:       '#9E9E9E',
  };

  _charts.category = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: byCategory.map(c => CATEGORY_LABELS[c.category]?.label || c.category),
      datasets: [{
        label: 'Revenu (€)',
        data: byCategory.map(c => c.revenue),
        backgroundColor: byCategory.map(c => CAT_COLORS[c.category] || '#ccc'),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${formatMoney(ctx.raw)}` } },
      },
      scales: {
        x: { beginAtZero: true, ticks: { callback: v => `${v} €` } },
        y: { grid: { display: false } },
      },
    },
  });
}

// ── TOP PRODUCTS CHART ────────────────
function renderTopProducts(topProducts) {
  const ctx   = document.getElementById('chart-top-products');
  const tbody = document.getElementById('products-report-tbody');
  if (!ctx || !topProducts?.length) return;
  destroyChart('top-products');

  const top8 = topProducts.slice(0, 8);

  _charts['top-products'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top8.map(p => p.name),
      datasets: [{
        label: 'Revenu (€)',
        data: top8.map(p => p.revenue),
        backgroundColor: 'rgba(232, 116, 142, 0.75)',
        borderColor: '#E8748E',
        borderWidth: 0,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${formatMoney(ctx.raw)}` } },
      },
      scales: {
        x: { beginAtZero: true, ticks: { callback: v => `${v} €` } },
        y: { grid: { display: false } },
      },
    },
  });

  if (tbody) {
    tbody.innerHTML = topProducts.map(p => `
      <tr>
        <td class="td-primary">${escHtml(p.name)}</td>
        <td>${catBadge(p.category)}</td>
        <td>${p.qty_sold || 0}</td>
        <td style="color:var(--rose);font-weight:700">${formatMoney(p.revenue)}</td>
      </tr>`).join('');
  }
}

// ── TOP CUSTOMERS ─────────────────────
function renderTopCustomers(topCustomers) {
  const tbody = document.getElementById('customers-report-tbody');
  if (!tbody || !topCustomers?.length) return;

  tbody.innerHTML = topCustomers.map((c, i) => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:1.1rem;width:28px;text-align:center;color:${i<3?'var(--gold)':'var(--gray-400)'}">${['🥇','🥈','🥉'][i] || (i+1)}</span>
          <span class="td-primary">${escHtml(c.name)}</span>
        </div>
      </td>
      <td>${c.orders}</td>
      <td style="color:var(--rose);font-weight:700">${formatMoney(c.spent)}</td>
    </tr>`).join('');
}

// ── MARGINS ───────────────────────────
function renderMargins(margins) {
  const tbody = document.getElementById('margins-report-tbody');
  if (!tbody || !margins?.length) return;

  tbody.innerHTML = margins.map(p => {
    const pct   = p.margin_pct || 0;
    const cls   = pct >= 50 ? 'good' : pct >= 30 ? 'ok' : 'low';
    const color = pct >= 50 ? 'var(--success)' : pct >= 30 ? 'var(--warning)' : 'var(--danger)';
    return `
      <tr>
        <td><span class="td-primary">${escHtml(p.name)}</span></td>
        <td>${formatMoney(p.price)}</td>
        <td>${formatMoney(p.cost_price)}</td>
        <td style="color:${color};font-weight:700">${formatMoney(p.margin)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="margin-bar" style="width:60px"><div class="margin-fill ${cls}" style="width:${Math.min(100, pct)}%"></div></div>
            <span style="font-weight:600;color:${color}">${pct}%</span>
          </div>
        </td>
        <td>${p.qty_sold || 0}</td>
        <td style="color:var(--rose);font-weight:700">${formatMoney(p.total_margin)}</td>
      </tr>`;
  }).join('');
}

// ── HELPERS ───────────────────────────
function formatMonthLabel(monthStr) {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}
