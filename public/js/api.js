/* ══════════════════════════════════════
   API Helper — SoCake v2
══════════════════════════════════════ */

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('socake_token');
}

async function apiFetch(path, options = {}) {
  const token   = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res  = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err  = new Error(data.error || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function apiFetchForm(path, formData) {
  const token   = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res  = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

const API = {
  // Auth
  login:         (body)      => apiFetch('/auth/login',    { method: 'POST', body: JSON.stringify(body) }),
  register:      (body)      => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  me:            ()          => apiFetch('/auth/me'),
  updateProfile: (body)      => apiFetch('/auth/profile',  { method: 'PUT',  body: JSON.stringify(body) }),

  // Users
  getUsers:       ()         => apiFetch('/users'),
  deleteUser:     (id)       => apiFetch(`/users/${id}`,      { method: 'DELETE' }),
  updateUserRole: (id, role) => apiFetch(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),

  // Company
  getCompany:    ()          => apiFetch('/company'),
  updateCompany: (body)      => apiFetch('/company',         { method: 'PUT',  body: JSON.stringify(body) }),
  uploadLogo:    (fd)        => apiFetchForm('/company/logo', fd),

  // Customers
  getCustomers:    (params)  => apiFetch('/customers' + toQuery(params)),
  getCustomer:     (id)      => apiFetch(`/customers/${id}`),
  createCustomer:  (body)    => apiFetch('/customers',        { method: 'POST', body: JSON.stringify(body) }),
  updateCustomer:  (id, body)=> apiFetch(`/customers/${id}`,  { method: 'PUT',  body: JSON.stringify(body) }),
  deleteCustomer:  (id)      => apiFetch(`/customers/${id}`,  { method: 'DELETE' }),

  // Products
  getProducts:     (params)  => apiFetch('/products' + toQuery(params)),
  createProduct:   (body)    => apiFetch('/products',         { method: 'POST', body: JSON.stringify(body) }),
  updateProduct:   (id, body)=> apiFetch(`/products/${id}`,   { method: 'PUT',  body: JSON.stringify(body) }),
  deleteProduct:   (id)      => apiFetch(`/products/${id}`,   { method: 'DELETE' }),

  // Events
  getEvents:     (params)    => apiFetch('/events' + toQuery(params)),
  getEvent:      (id)        => apiFetch(`/events/${id}`),
  createEvent:   (body)      => apiFetch('/events',           { method: 'POST', body: JSON.stringify(body) }),
  updateEvent:   (id, body)  => apiFetch(`/events/${id}`,     { method: 'PUT',  body: JSON.stringify(body) }),
  deleteEvent:   (id)        => apiFetch(`/events/${id}`,     { method: 'DELETE' }),

  // Orders
  getOrders:     (params)    => apiFetch('/orders' + toQuery(params)),
  getOrder:      (id)        => apiFetch(`/orders/${id}`),
  createOrder:   (body)      => apiFetch('/orders',           { method: 'POST', body: JSON.stringify(body) }),
  updateOrder:   (id, body)  => apiFetch(`/orders/${id}`,     { method: 'PUT',  body: JSON.stringify(body) }),
  updateStatus:  (id, status)=> apiFetch(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteOrder:   (id)        => apiFetch(`/orders/${id}`,     { method: 'DELETE' }),

  // Deliveries
  getDeliveries:    (params) => apiFetch('/deliveries' + toQuery(params)),
  updateDelivery:   (orderId, body) => apiFetch(`/deliveries/${orderId}`, { method: 'PUT', body: JSON.stringify(body) }),

  // Stock
  getStock:      (params)    => apiFetch('/stock' + toQuery(params)),
  createStock:   (body)      => apiFetch('/stock',            { method: 'POST', body: JSON.stringify(body) }),
  updateStock:   (id, body)  => apiFetch(`/stock/${id}`,      { method: 'PUT',  body: JSON.stringify(body) }),
  deleteStock:   (id)        => apiFetch(`/stock/${id}`,      { method: 'DELETE' }),
  stockMovement: (id, body)  => apiFetch(`/stock/${id}/movement`, { method: 'POST', body: JSON.stringify(body) }),
  getMovements:  (id)        => apiFetch(`/stock/${id}/movements`),

  // Reports
  getReports:    (params)    => apiFetch('/reports/revenue' + toQuery(params)),
  getMargins:    ()          => apiFetch('/reports/margins'),

  // Dashboard
  getDashboard:  ()          => apiFetch('/dashboard/stats'),
};

function toQuery(params) {
  if (!params) return '';
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, v);
  });
  const s = q.toString();
  return s ? '?' + s : '';
}
