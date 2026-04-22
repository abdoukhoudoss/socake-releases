const express    = require('express');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const path       = require('path');
const fs         = require('fs');
const nodemailer = require('nodemailer');
const multer     = require('multer');
const PDFDocument = require('pdfkit');
const { initializeDatabase, getDb } = require('./database');

const app  = express();
const PORT = process.env.PORT || process.env.SOCAKE_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'socake_secret_2024_jwt_key';

// ── MULTER (logo upload) ─────────────────────────────────
const storage = multer.diskStorage({
  destination: process.env.SOCAKE_UPLOADS || path.join(__dirname, 'public', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.svg', '.webp', '.gif'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// ── MIDDLEWARE ───────────────────────────────────────────
app.use(cors());
app.use(express.json());
// En mode Electron, les uploads vont dans userData (hors asar) → route dédiée
if (process.env.SOCAKE_UPLOADS) {
  app.use('/uploads', express.static(process.env.SOCAKE_UPLOADS));
}
app.use(express.static(path.join(__dirname, 'public')));

// ── INIT DB ──────────────────────────────────────────────
initializeDatabase();

// ── SSE — Real-time broadcast ────────────────────────────
const sseClients = new Map();

// SSE accepts token from query param (EventSource can't set headers)
function sseAuthMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const tokenFromQuery = req.query.token;
  const token = auth?.startsWith('Bearer ') ? auth.split(' ')[1] : tokenFromQuery;
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

app.get('/api/sse', sseAuthMiddleware, (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const clientId = `${req.user.id}-${Date.now()}`;
  sseClients.set(clientId, { res, user: req.user });

  // Initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', user: req.user.name })}\n\n`);

  // Heartbeat every 25s to keep alive
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(clientId);
  });
});

function broadcast(type, data) {
  if (sseClients.size === 0) return;
  const payload = JSON.stringify({ type, data, ts: new Date().toISOString() });
  sseClients.forEach(client => {
    try { client.res.write(`data: ${payload}\n\n`); } catch (_) {}
  });
}

// ── AUTH MIDDLEWARE ──────────────────────────────────────
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  try {
    req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
}

// ── HELPERS ──────────────────────────────────────────────
function generateOrderNumber() {
  const now  = new Date();
  const y    = now.getFullYear().toString().slice(-2);
  const m    = String(now.getMonth() + 1).padStart(2, '0');
  const d    = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SC-${y}${m}${d}-${rand}`;
}

function getCompanySettings() {
  const db = getDb();
  return db.prepare('SELECT * FROM company_settings LIMIT 1').get() || {};
}

// ── EMAIL NOTIFICATION ───────────────────────────────────
async function sendOrderNotification(order, statusKey) {
  const settings = getCompanySettings();
  if (!settings.email_notifications || !settings.email_smtp_host || !order.client_email) return;

  const STATUS_MESSAGES = {
    confirme:       { label: 'Confirmée',       emoji: '✅' },
    en_preparation: { label: 'En préparation',  emoji: '👩‍🍳' },
    pret:           { label: 'Prête',           emoji: '🎉' },
    livre:          { label: 'Livrée',          emoji: '🚚' },
  };
  const info = STATUS_MESSAGES[statusKey];
  if (!info) return;

  const notifyMap = {
    confirme: settings.notify_confirm,
    pret:     settings.notify_ready,
    livre:    settings.notify_shipped,
  };
  if (notifyMap[statusKey] === 0) return;

  try {
    const transporter = nodemailer.createTransporter({
      host: settings.email_smtp_host,
      port: settings.email_smtp_port || 587,
      secure: false,
      auth: { user: settings.email_smtp_user, pass: settings.email_smtp_pass },
    });

    const html = `
      <!DOCTYPE html><html><body style="font-family:sans-serif;max-width:560px;margin:auto;color:#3D2020">
      <div style="background:#E8748E;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0">${settings.company_name}</h1>
        <p style="color:rgba(255,255,255,.8);margin:4px 0 0">${settings.slogan || ''}</p>
      </div>
      <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #eee;border-top:none">
        <p style="font-size:2rem;margin:0 0 16px">${info.emoji}</p>
        <h2 style="margin:0 0 8px">Votre commande est <strong>${info.label}</strong></h2>
        <p style="color:#757575">Commande n° <strong>${order.order_number}</strong></p>
        <hr style="border:1px solid #eee;margin:24px 0">
        <p><strong>Date de livraison :</strong> ${new Date(order.delivery_date).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })}</p>
        ${order.delivery_address ? `<p><strong>Adresse :</strong> ${order.delivery_address}</p>` : ''}
        <p><strong>Montant total :</strong> ${order.total_amount?.toLocaleString('fr-FR', { style:'currency', currency:'EUR' })}</p>
        <hr style="border:1px solid #eee;margin:24px 0">
        <p style="color:#9E9E9E;font-size:.85rem">Pour toute question, contactez-nous.</p>
      </div></body></html>`;

    await transporter.sendMail({
      from: `"${settings.company_name}" <${settings.email_from}>`,
      to:   order.client_email,
      subject: `${info.emoji} Commande ${order.order_number} — ${info.label}`,
      html,
    });
  } catch (err) {
    console.error('[Email]', err.message);
  }
}

// ════════════════════════════════════════════════════════
//  AUTH ROUTES
// ════════════════════════════════════════════════════════
app.post('/api/auth/register', (req, res) => {
  const db = getDb();
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nom, email et mot de passe requis' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(400).json({ error: 'Cet email est déjà utilisé' });
  }
  const hashed  = bcrypt.hashSync(password, 10);
  const userRole = ['admin', 'employee', 'delivery'].includes(role) ? role : 'employee';
  const result  = db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run(name, email, hashed, userRole);

  const user  = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ user, token });
});

app.post('/api/auth/login', (req, res) => {
  const db = getDb();
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, ...safe } = user;
  res.json({ user: safe, token });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const db   = getDb();
  const user = db.prepare('SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(user);
});

app.put('/api/auth/profile', authMiddleware, (req, res) => {
  const db   = getDb();
  const { name, email, phone, currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  if (newPassword) {
    if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    }
    const hashed = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET name=?, email=?, phone=?, password=? WHERE id=?')
      .run(name || user.name, email || user.email, phone || user.phone, hashed, user.id);
  } else {
    db.prepare('UPDATE users SET name=?, email=?, phone=? WHERE id=?')
      .run(name || user.name, email || user.email, phone || user.phone, user.id);
  }
  const updated = db.prepare('SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?').get(user.id);
  res.json(updated);
});

// ════════════════════════════════════════════════════════
//  USERS ROUTES
// ════════════════════════════════════════════════════════
app.get('/api/users', authMiddleware, adminMiddleware, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT id, name, email, role, phone, created_at FROM users ORDER BY name').all());
});

app.delete('/api/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const db = getDb();
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'Utilisateur supprimé' });
});

app.put('/api/users/:id/role', authMiddleware, adminMiddleware, (req, res) => {
  const db   = getDb();
  const { role } = req.body;
  if (!['admin', 'employee', 'delivery'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json(db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.params.id));
});

// ════════════════════════════════════════════════════════
//  COMPANY SETTINGS
// ════════════════════════════════════════════════════════
app.get('/api/company', (req, res) => {
  const db       = getDb();
  const settings = db.prepare('SELECT * FROM company_settings LIMIT 1').get();
  if (!settings) return res.json({});
  // Never expose SMTP password to client
  const { email_smtp_pass, ...safe } = settings;
  res.json(safe);
});

app.put('/api/company', authMiddleware, adminMiddleware, (req, res) => {
  const db = getDb();
  const {
    company_name, slogan, activities, primary_color, currency, currency_symbol,
    email_notifications, email_from, email_smtp_host, email_smtp_port,
    email_smtp_user, email_smtp_pass,
    notify_confirm, notify_ready, notify_shipped,
    address, city, phone, website,
  } = req.body;

  const existing = db.prepare('SELECT id FROM company_settings LIMIT 1').get();
  if (existing) {
    db.prepare(`
      UPDATE company_settings SET
        company_name=?, slogan=?, activities=?, primary_color=?,
        currency=?, currency_symbol=?,
        email_notifications=?, email_from=?, email_smtp_host=?,
        email_smtp_port=?, email_smtp_user=?,
        ${email_smtp_pass ? 'email_smtp_pass=?,' : ''}
        notify_confirm=?, notify_ready=?, notify_shipped=?,
        address=?, city=?, phone=?, website=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `.replace(/,\s*WHERE/, ' WHERE'))
    .run(
      ...[
        company_name, slogan, activities, primary_color,
        currency, currency_symbol,
        email_notifications ? 1 : 0, email_from, email_smtp_host,
        email_smtp_port || 587, email_smtp_user,
        ...(email_smtp_pass ? [email_smtp_pass] : []),
        notify_confirm ? 1 : 0, notify_ready ? 1 : 0, notify_shipped ? 1 : 0,
        address, city, phone, website,
        existing.id,
      ]
    );
  } else {
    db.prepare(`
      INSERT INTO company_settings
        (company_name, slogan, activities, primary_color, currency, currency_symbol,
         email_notifications, email_from, email_smtp_host, email_smtp_port, email_smtp_user,
         email_smtp_pass, notify_confirm, notify_ready, notify_shipped, address, city, phone, website)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      company_name, slogan, activities, primary_color, currency, currency_symbol,
      email_notifications ? 1 : 0, email_from, email_smtp_host, email_smtp_port || 587, email_smtp_user,
      email_smtp_pass || '', notify_confirm ? 1 : 0, notify_ready ? 1 : 0, notify_shipped ? 1 : 0,
      address, city, phone, website
    );
  }

  const updated = db.prepare('SELECT * FROM company_settings LIMIT 1').get();
  const { email_smtp_pass: _, ...safe } = updated;
  broadcast('company:updated', safe);
  res.json(safe);
});

app.post('/api/company/logo', authMiddleware, adminMiddleware, upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });

  const db      = getDb();
  const logoUrl = `/uploads/${req.file.filename}`;

  // Remove old logo file
  const old = db.prepare('SELECT logo_url FROM company_settings LIMIT 1').get();
  if (old?.logo_url) {
    const oldPath = path.join(__dirname, 'public', old.logo_url);
    try { fs.unlinkSync(oldPath); } catch (_) {}
  }

  db.prepare("UPDATE company_settings SET logo_url=?, updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT id FROM company_settings LIMIT 1)")
    .run(logoUrl);

  broadcast('company:logo', { logo_url: logoUrl });
  res.json({ logo_url: logoUrl });
});

// ════════════════════════════════════════════════════════
//  CUSTOMERS ROUTES
// ════════════════════════════════════════════════════════
app.get('/api/customers', authMiddleware, (req, res) => {
  const db = getDb();
  const { search } = req.query;
  let query = `
    SELECT c.*,
      COUNT(DISTINCT o.id) as total_orders,
      COALESCE(SUM(o.total_amount), 0) as total_spent
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id AND o.status != 'annule'
    WHERE 1=1
  `;
  const params = [];
  if (search) {
    query += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  query += ' GROUP BY c.id ORDER BY c.name';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/customers/:id', authMiddleware, (req, res) => {
  const db       = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Client introuvable' });

  const orders = db.prepare(`
    SELECT o.*, e.name as event_name
    FROM orders o
    LEFT JOIN events e ON o.event_id = e.id
    WHERE o.customer_id = ?
    ORDER BY o.created_at DESC LIMIT 20
  `).all(req.params.id);

  res.json({ ...customer, orders });
});

app.post('/api/customers', authMiddleware, (req, res) => {
  const db = getDb();
  const { name, email, phone, address, city, postal_code, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });

  const result = db.prepare(`
    INSERT INTO customers (name, email, phone, address, city, postal_code, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, email, phone, address, city, postal_code, notes);

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  broadcast('customer:created', customer);
  res.status(201).json(customer);
});

app.put('/api/customers/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { name, email, phone, address, city, postal_code, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });

  db.prepare(`
    UPDATE customers SET name=?, email=?, phone=?, address=?, city=?, postal_code=?, notes=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(name, email, phone, address, city, postal_code, notes, req.params.id);

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  broadcast('customer:updated', customer);
  res.json(customer);
});

app.delete('/api/customers/:id', authMiddleware, adminMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  broadcast('customer:deleted', { id: parseInt(req.params.id) });
  res.json({ message: 'Client supprimé' });
});

// ════════════════════════════════════════════════════════
//  PRODUCTS ROUTES
// ════════════════════════════════════════════════════════
app.get('/api/products', authMiddleware, (req, res) => {
  const db = getDb();
  const { category, active } = req.query;
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (active !== undefined) { query += ' AND active = ?'; params.push(active === 'true' ? 1 : 0); }
  query += ' ORDER BY category, name';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/products', authMiddleware, (req, res) => {
  const db = getDb();
  const { name, category, description, price, cost_price, unit } = req.body;
  if (!name || !category || price === undefined) {
    return res.status(400).json({ error: 'Nom, catégorie et prix requis' });
  }
  const result = db.prepare(
    'INSERT INTO products (name, category, description, price, cost_price, unit) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, category, description || '', price, cost_price || 0, unit || 'pièce');
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
  broadcast('product:created', product);
  res.status(201).json(product);
});

app.put('/api/products/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { name, category, description, price, cost_price, unit, active } = req.body;
  db.prepare(
    'UPDATE products SET name=?, category=?, description=?, price=?, cost_price=?, unit=?, active=? WHERE id=?'
  ).run(name, category, description, price, cost_price || 0, unit, active !== undefined ? (active ? 1 : 0) : 1, req.params.id);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  broadcast('product:updated', product);
  res.json(product);
});

app.delete('/api/products/:id', authMiddleware, adminMiddleware, (req, res) => {
  const db   = getDb();
  const hard = req.query.hard === 'true';

  if (hard) {
    // Check if product is used in any order
    const used = db.prepare('SELECT COUNT(*) as c FROM order_items WHERE product_id = ?').get(req.params.id);
    if (used.c > 0) {
      // Can't hard-delete — soft-delete instead and tell the client
      db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
      broadcast('product:updated', { id: parseInt(req.params.id), active: 0 });
      return res.json({ message: 'Produit désactivé (utilisé dans des commandes existantes)', soft: true });
    }
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    broadcast('product:deleted', { id: parseInt(req.params.id) });
    return res.json({ message: 'Produit supprimé définitivement', hard: true });
  }

  // Default: soft delete
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  broadcast('product:updated', { id: parseInt(req.params.id), active: 0 });
  res.json({ message: 'Produit désactivé' });
});

// ════════════════════════════════════════════════════════
//  EVENTS ROUTES
// ════════════════════════════════════════════════════════
app.get('/api/events', authMiddleware, (req, res) => {
  const db = getDb();
  const { status } = req.query;
  let query = `
    SELECT e.*, u.name as creator_name,
      (SELECT COUNT(*) FROM orders o WHERE o.event_id = e.id) as order_count,
      (SELECT COALESCE(SUM(o.total_amount),0) FROM orders o WHERE o.event_id = e.id) as total_revenue
    FROM events e LEFT JOIN users u ON e.created_by = u.id WHERE 1=1
  `;
  const params = [];
  if (status) { query += ' AND e.status = ?'; params.push(status); }
  query += ' ORDER BY e.event_date DESC';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/events/:id', authMiddleware, (req, res) => {
  const db    = getDb();
  const event = db.prepare(`
    SELECT e.*, u.name as creator_name,
      (SELECT COUNT(*) FROM orders o WHERE o.event_id = e.id) as order_count,
      (SELECT COALESCE(SUM(o.total_amount),0) FROM orders o WHERE o.event_id = e.id) as total_revenue
    FROM events e LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ?
  `).get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Événement introuvable' });

  const orders = db.prepare(`
    SELECT o.*, u.name as creator_name FROM orders o
    LEFT JOIN users u ON o.created_by = u.id
    WHERE o.event_id = ? ORDER BY o.delivery_date
  `).all(req.params.id);
  res.json({ ...event, orders });
});

app.post('/api/events', authMiddleware, (req, res) => {
  const db = getDb();
  const { name, description, event_date, location, client_name, client_phone, client_email, customer_id, budget, notes } = req.body;
  if (!name || !event_date) return res.status(400).json({ error: 'Nom et date requis' });

  const result = db.prepare(`
    INSERT INTO events (name, description, event_date, location, client_name, client_phone, client_email, customer_id, budget, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, description, event_date, location, client_name, client_phone, client_email, customer_id || null, budget || 0, notes, req.user.id);

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
  broadcast('event:created', event);
  res.status(201).json(event);
});

app.put('/api/events/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { name, description, event_date, location, client_name, client_phone, client_email, status, budget, notes } = req.body;
  db.prepare(`
    UPDATE events SET name=?, description=?, event_date=?, location=?, client_name=?, client_phone=?,
    client_email=?, status=?, budget=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(name, description, event_date, location, client_name, client_phone, client_email, status, budget, notes, req.params.id);
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  broadcast('event:updated', event);
  res.json(event);
});

app.delete('/api/events/:id', authMiddleware, adminMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  broadcast('event:deleted', { id: parseInt(req.params.id) });
  res.json({ message: 'Événement supprimé' });
});

// ════════════════════════════════════════════════════════
//  ORDERS ROUTES
// ════════════════════════════════════════════════════════
app.get('/api/orders', authMiddleware, (req, res) => {
  const db = getDb();
  const { event_id, status, search, customer_id, date_from, date_to } = req.query;
  let query = `
    SELECT o.*, e.name as event_name, u.name as creator_name, c.name as customer_full_name
    FROM orders o
    LEFT JOIN events e ON o.event_id = e.id
    LEFT JOIN users u ON o.created_by = u.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];
  if (event_id)    { query += ' AND o.event_id = ?';    params.push(event_id); }
  if (customer_id) { query += ' AND o.customer_id = ?'; params.push(customer_id); }
  if (status)      { query += ' AND o.status = ?';      params.push(status); }
  if (date_from)   { query += ' AND o.delivery_date >= ?'; params.push(date_from); }
  if (date_to)     { query += ' AND o.delivery_date <= ?'; params.push(date_to); }
  if (search) {
    query += ' AND (o.client_name LIKE ? OR o.order_number LIKE ? OR o.client_phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY o.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

app.get('/api/orders/:id', authMiddleware, (req, res) => {
  const db    = getDb();
  const order = db.prepare(`
    SELECT o.*, e.name as event_name, u.name as creator_name, c.name as customer_full_name
    FROM orders o
    LEFT JOIN events e ON o.event_id = e.id
    LEFT JOIN users u ON o.created_by = u.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.id = ?
  `).get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const items = db.prepare(`
    SELECT oi.*, p.name as product_name, p.category as product_category
    FROM order_items oi JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(req.params.id);

  const delivery = db.prepare('SELECT * FROM deliveries WHERE order_id = ?').get(req.params.id);
  res.json({ ...order, items, delivery: delivery || null });
});

app.post('/api/orders', authMiddleware, (req, res) => {
  const db = getDb();
  const {
    event_id, customer_id, client_name, client_phone, client_email,
    delivery_date, delivery_address, delivery_time, order_type, notes,
    advance_paid, payment_method, payment_status, items,
  } = req.body;

  if (!client_name || !delivery_date || !items?.length) {
    return res.status(400).json({ error: 'Client, date de livraison et articles requis' });
  }

  let orderNumber, attempts = 0;
  do {
    orderNumber = generateOrderNumber();
    attempts++;
  } while (db.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNumber) && attempts < 10);

  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const paid  = advance_paid || 0;
  const pStatus = paid >= total ? 'complet' : paid > 0 ? 'partiel' : (payment_status || 'en_attente');

  const result = db.prepare(`
    INSERT INTO orders (order_number, event_id, customer_id, client_name, client_phone, client_email,
      delivery_date, delivery_address, delivery_time, order_type, notes, total_amount, advance_paid,
      payment_method, payment_status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderNumber, event_id || null, customer_id || null, client_name, client_phone, client_email,
    delivery_date, delivery_address, delivery_time, order_type || 'livraison', notes, total, paid,
    payment_method || 'especes', pStatus, req.user.id
  );

  const orderId = result.lastInsertRowid;
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, quantity, unit_price, customization) VALUES (?, ?, ?, ?, ?)'
  );
  items.forEach(item => insertItem.run(orderId, item.product_id, item.quantity, item.unit_price, item.customization || ''));

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const orderItems = db.prepare(`
    SELECT oi.*, p.name as product_name, p.category as product_category
    FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
  `).all(orderId);

  broadcast('order:created', { ...order, items: orderItems });
  res.status(201).json({ ...order, items: orderItems });
});

app.put('/api/orders/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const {
    event_id, customer_id, client_name, client_phone, client_email,
    delivery_date, delivery_address, delivery_time, order_type, status, notes,
    advance_paid, payment_method, payment_status, items,
  } = req.body;

  const total = items ? items.reduce((s, i) => s + i.quantity * i.unit_price, 0) : undefined;

  if (items) {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(req.params.id);
    const insertItem = db.prepare(
      'INSERT INTO order_items (order_id, product_id, quantity, unit_price, customization) VALUES (?, ?, ?, ?, ?)'
    );
    items.forEach(item => insertItem.run(req.params.id, item.product_id, item.quantity, item.unit_price, item.customization || ''));
  }

  db.prepare(`
    UPDATE orders SET event_id=?, customer_id=?, client_name=?, client_phone=?, client_email=?,
    delivery_date=?, delivery_address=?, delivery_time=?, order_type=?, status=?, notes=?, advance_paid=?,
    payment_method=?, payment_status=?,
    total_amount=COALESCE(?,total_amount), updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(
    event_id || null, customer_id || null, client_name, client_phone, client_email,
    delivery_date, delivery_address, delivery_time, order_type || 'livraison', status, notes, advance_paid,
    payment_method || 'especes', payment_status || 'en_attente',
    total, req.params.id
  );

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  const orderItems = db.prepare(`
    SELECT oi.*, p.name as product_name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
  `).all(req.params.id);

  broadcast('order:updated', { ...order, items: orderItems });
  res.json({ ...order, items: orderItems });
});

app.patch('/api/orders/:id/status', authMiddleware, (req, res) => {
  const db = getDb();
  const { status } = req.body;
  const valid = ['en_attente', 'confirme', 'en_preparation', 'pret', 'livre', 'annule'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Statut invalide' });

  db.prepare('UPDATE orders SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  broadcast('order:status', { id: order.id, status, order_number: order.order_number });

  // Email notification (async, non-blocking)
  sendOrderNotification(order, status).catch(() => {});
  res.json({ message: 'Statut mis à jour', status });
});

app.delete('/api/orders/:id', authMiddleware, adminMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  broadcast('order:deleted', { id: parseInt(req.params.id) });
  res.json({ message: 'Commande supprimée' });
});

// ════════════════════════════════════════════════════════
//  DELIVERIES ROUTES
// ════════════════════════════════════════════════════════
app.get('/api/deliveries', authMiddleware, (req, res) => {
  const db = getDb();
  const { date, status } = req.query;
  let query = `
    SELECT o.id, o.order_number, o.client_name, o.client_phone, o.delivery_date, o.delivery_time,
      o.delivery_address, o.status, o.total_amount, o.advance_paid, o.notes,
      c.name as customer_name,
      d.id as delivery_id, d.driver_name, d.vehicle, d.scheduled_time,
      d.delivery_notes, d.delivered_at, d.recipient_name
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN deliveries d ON d.order_id = o.id
    WHERE o.status NOT IN ('annule', 'en_attente')
  `;
  const params = [];
  if (date)   { query += ' AND o.delivery_date = ?'; params.push(date); }
  if (status) { query += ' AND o.status = ?';        params.push(status); }
  query += ' ORDER BY o.delivery_date ASC, o.delivery_time ASC';
  res.json(db.prepare(query).all(...params));
});

app.put('/api/deliveries/:orderId', authMiddleware, (req, res) => {
  const db = getDb();
  const { orderId } = req.params;
  const { driver_name, vehicle, scheduled_time, delivery_notes, delivered_at, recipient_name } = req.body;

  const existing = db.prepare('SELECT id FROM deliveries WHERE order_id = ?').get(orderId);
  if (existing) {
    db.prepare(`
      UPDATE deliveries SET driver_name=?, vehicle=?, scheduled_time=?, delivery_notes=?,
      delivered_at=?, recipient_name=? WHERE order_id=?
    `).run(driver_name, vehicle, scheduled_time, delivery_notes, delivered_at, recipient_name, orderId);
  } else {
    db.prepare(`
      INSERT INTO deliveries (order_id, driver_name, vehicle, scheduled_time, delivery_notes, delivered_at, recipient_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, driver_name, vehicle, scheduled_time, delivery_notes, delivered_at, recipient_name);
  }

  const delivery = db.prepare('SELECT * FROM deliveries WHERE order_id = ?').get(orderId);
  broadcast('delivery:updated', { order_id: parseInt(orderId), delivery });
  res.json(delivery);
});

// ════════════════════════════════════════════════════════
//  STOCK ROUTES
// ════════════════════════════════════════════════════════
app.get('/api/stock', authMiddleware, (req, res) => {
  const db = getDb();
  const { low } = req.query;
  let query = 'SELECT * FROM stock WHERE 1=1';
  if (low === 'true') query += ' AND quantity <= min_quantity';
  query += ' ORDER BY category, name';
  res.json(db.prepare(query).all());
});

app.post('/api/stock', authMiddleware, (req, res) => {
  const db = getDb();
  const { name, category, quantity, unit, min_quantity, cost_per_unit, supplier } = req.body;
  if (!name || quantity === undefined || !unit) {
    return res.status(400).json({ error: 'Nom, quantité et unité requis' });
  }
  const result = db.prepare(`
    INSERT INTO stock (name, category, quantity, unit, min_quantity, cost_per_unit, supplier)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, category || 'ingredient', quantity, unit, min_quantity || 0, cost_per_unit || 0, supplier || '');
  const item = db.prepare('SELECT * FROM stock WHERE id = ?').get(result.lastInsertRowid);
  broadcast('stock:created', item);
  res.status(201).json(item);
});

app.put('/api/stock/:id', authMiddleware, (req, res) => {
  const db = getDb();
  const { name, category, quantity, unit, min_quantity, cost_per_unit, supplier } = req.body;
  const current = db.prepare('SELECT quantity FROM stock WHERE id = ?').get(req.params.id);
  if (current && quantity !== undefined && quantity !== current.quantity) {
    const diff = quantity - current.quantity;
    db.prepare(
      'INSERT INTO stock_movements (stock_id, type, quantity, reason, user_id) VALUES (?, ?, ?, ?, ?)'
    ).run(req.params.id, diff > 0 ? 'entree' : 'sortie', Math.abs(diff), 'Ajustement manuel', req.user.id);
  }
  db.prepare(`
    UPDATE stock SET name=?, category=?, quantity=?, unit=?, min_quantity=?, cost_per_unit=?,
    supplier=?, last_updated=CURRENT_TIMESTAMP WHERE id=?
  `).run(name, category, quantity, unit, min_quantity, cost_per_unit, supplier, req.params.id);
  const item = db.prepare('SELECT * FROM stock WHERE id = ?').get(req.params.id);
  broadcast('stock:updated', item);
  res.json(item);
});

app.post('/api/stock/:id/movement', authMiddleware, (req, res) => {
  const db = getDb();
  const { type, quantity, reason } = req.body;
  const valid = ['entree', 'sortie', 'ajustement'];
  if (!valid.includes(type) || !quantity) return res.status(400).json({ error: 'Type et quantité requis' });

  const item = db.prepare('SELECT * FROM stock WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Article introuvable' });

  let newQty = item.quantity;
  if (type === 'entree') newQty += quantity;
  else if (type === 'sortie') newQty = Math.max(0, newQty - quantity);
  else newQty = quantity;

  db.prepare('UPDATE stock SET quantity=?, last_updated=CURRENT_TIMESTAMP WHERE id=?').run(newQty, req.params.id);
  db.prepare('INSERT INTO stock_movements (stock_id, type, quantity, reason, user_id) VALUES (?, ?, ?, ?, ?)')
    .run(req.params.id, type, quantity, reason || '', req.user.id);

  const updated = db.prepare('SELECT * FROM stock WHERE id = ?').get(req.params.id);
  broadcast('stock:updated', updated);
  res.json(updated);
});

app.delete('/api/stock/:id', authMiddleware, adminMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM stock WHERE id = ?').run(req.params.id);
  broadcast('stock:deleted', { id: parseInt(req.params.id) });
  res.json({ message: 'Article supprimé' });
});

app.get('/api/stock/:id/movements', authMiddleware, (req, res) => {
  const db = getDb();
  res.json(db.prepare(`
    SELECT sm.*, u.name as user_name FROM stock_movements sm
    LEFT JOIN users u ON sm.user_id = u.id
    WHERE sm.stock_id = ? ORDER BY sm.created_at DESC LIMIT 50
  `).all(req.params.id));
});

// ════════════════════════════════════════════════════════
//  REPORTS ROUTES
// ════════════════════════════════════════════════════════
app.get('/api/reports/revenue', authMiddleware, (req, res) => {
  const db = getDb();
  const { months = 12 } = req.query;

  const monthly = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month,
      COALESCE(SUM(total_amount), 0) as revenue,
      COUNT(*) as orders,
      COALESCE(SUM(advance_paid), 0) as collected
    FROM orders WHERE status != 'annule'
    GROUP BY month ORDER BY month DESC LIMIT ?
  `).all(parseInt(months));

  const byCategory = db.prepare(`
    SELECT p.category, COALESCE(SUM(oi.subtotal), 0) as revenue, SUM(oi.quantity) as qty
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status != 'annule'
    GROUP BY p.category ORDER BY revenue DESC
  `).all();

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
    FROM orders GROUP BY status
  `).all();

  const topProducts = db.prepare(`
    SELECT p.name, p.category, SUM(oi.quantity) as qty_sold,
      COALESCE(SUM(oi.subtotal), 0) as revenue
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status != 'annule'
    GROUP BY p.id ORDER BY revenue DESC LIMIT 10
  `).all();

  const topCustomers = db.prepare(`
    SELECT
      COALESCE(c.name, o.client_name) as name,
      COUNT(DISTINCT o.id) as orders,
      COALESCE(SUM(o.total_amount), 0) as spent
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.status != 'annule'
    GROUP BY COALESCE(o.customer_id, o.client_name)
    ORDER BY spent DESC LIMIT 10
  `).all();

  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_orders,
      COUNT(DISTINCT COALESCE(customer_id, client_name)) as unique_customers,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COALESCE(AVG(total_amount), 0) as avg_order,
      COALESCE(SUM(advance_paid), 0) as total_collected,
      COALESCE(SUM(total_amount) - SUM(advance_paid), 0) as total_outstanding
    FROM orders WHERE status != 'annule'
  `).get();

  res.json({ monthly: monthly.reverse(), byCategory, byStatus, topProducts, topCustomers, summary });
});

app.get('/api/reports/margins', authMiddleware, (req, res) => {
  const db = getDb();
  const margins = db.prepare(`
    SELECT p.name, p.category, p.price, p.cost_price,
      (p.price - p.cost_price) as margin,
      CASE WHEN p.price > 0 THEN ROUND((p.price - p.cost_price) / p.price * 100, 1) ELSE 0 END as margin_pct,
      SUM(oi.quantity) as qty_sold,
      COALESCE(SUM((p.price - p.cost_price) * oi.quantity), 0) as total_margin
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.id
    LEFT JOIN orders o ON oi.order_id = o.id AND o.status != 'annule'
    WHERE p.active = 1
    GROUP BY p.id ORDER BY total_margin DESC
  `).all();
  res.json(margins);
});

// ════════════════════════════════════════════════════════
//  DASHBOARD STATS
// ════════════════════════════════════════════════════════
app.get('/api/dashboard/stats', authMiddleware, (req, res) => {
  const db = getDb();

  const totalOrders    = db.prepare("SELECT COUNT(*) as count FROM orders").get();
  const pendingOrders  = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status IN ('en_attente','confirme','en_preparation')").get();
  const monthRevenue   = db.prepare(`SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE status!='annule' AND strftime('%Y-%m',created_at)=strftime('%Y-%m','now')`).get();
  const upcomingEvents = db.prepare("SELECT COUNT(*) as count FROM events WHERE event_date >= date('now') AND status != 'annule'").get();
  const lowStock       = db.prepare("SELECT COUNT(*) as count FROM stock WHERE quantity <= min_quantity").get();
  const readyOrders    = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pret'").get();
  const totalCustomers = db.prepare("SELECT COUNT(*) as count FROM customers").get();
  const todayDeliveries= db.prepare("SELECT COUNT(*) as count FROM orders WHERE delivery_date = date('now') AND status NOT IN ('annule','livre')").get();
  const outstanding    = db.prepare("SELECT COALESCE(SUM(total_amount - advance_paid),0) as total FROM orders WHERE status NOT IN ('annule','livre') AND total_amount > advance_paid").get();

  const recentOrders = db.prepare(`
    SELECT o.order_number, o.client_name, o.status, o.total_amount, o.delivery_date, e.name as event_name
    FROM orders o LEFT JOIN events e ON o.event_id = e.id
    ORDER BY o.created_at DESC LIMIT 5
  `).all();

  const upcomingEventsList = db.prepare(`
    SELECT e.name, e.event_date, e.location, e.status,
    (SELECT COUNT(*) FROM orders o WHERE o.event_id = e.id) as order_count
    FROM events e WHERE e.event_date >= date('now') AND e.status != 'annule'
    ORDER BY e.event_date ASC LIMIT 5
  `).all();

  const ordersByStatus = db.prepare("SELECT status, COUNT(*) as count FROM orders GROUP BY status").all();
  const monthlyRevenue = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(total_amount),0) as total
    FROM orders WHERE status != 'annule'
    GROUP BY month ORDER BY month DESC LIMIT 6
  `).all();

  res.json({
    totalOrders: totalOrders.count,
    pendingOrders: pendingOrders.count,
    monthRevenue: monthRevenue.total,
    upcomingEvents: upcomingEvents.count,
    lowStock: lowStock.count,
    readyOrders: readyOrders.count,
    totalCustomers: totalCustomers.count,
    todayDeliveries: todayDeliveries.count,
    outstanding: outstanding.total,
    recentOrders,
    upcomingEventsList,
    ordersByStatus,
    monthlyRevenue: monthlyRevenue.reverse(),
  });
});

// ════════════════════════════════════════════════════════
//  PDF — Invoice / Quote generation
// ════════════════════════════════════════════════════════
app.get('/api/orders/:id/pdf', sseAuthMiddleware, (req, res) => {
  const db   = getDb();
  const type = req.query.type === 'devis' ? 'devis' : 'facture';

  const order = db.prepare(`
    SELECT o.*, e.name as event_name FROM orders o
    LEFT JOIN events e ON o.event_id = e.id WHERE o.id = ?
  `).get(req.params.id);

  if (!order) return res.status(404).json({ error: 'Commande introuvable' });

  const items = db.prepare(`
    SELECT oi.*, p.name as product_name
    FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?
  `).all(req.params.id);

  const company   = db.prepare('SELECT * FROM company_settings LIMIT 1').get() || {};
  const symbol    = company.currency_symbol || 'F';
  const accentHex = /^#[0-9A-Fa-f]{6}$/.test(company.primary_color) ? company.primary_color : '#E8748E';

  // Formate un montant avec espace ASCII comme separateur de milliers
  // (PDFKit ne supporte pas U+202F produit par toLocaleString fr-FR)
  function fmt(n) {
    const val  = parseFloat(n || 0);
    const neg  = val < 0;
    const abs  = Math.abs(val);
    const intS = Math.floor(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const dec  = abs % 1 !== 0 ? ',' + Math.round((abs % 1) * 100).toString().padStart(2, '0') : '';
    return (neg ? '-' : '') + intS + dec + ' ' + symbol;
  }

  const isDevis     = type === 'devis';
  const docLabel    = isDevis ? 'DEVIS' : 'FACTURE';
  const docNumber   = isDevis ? 'DEV-' + order.order_number : 'FAC-' + order.order_number;
  const dateStr     = new Date().toLocaleDateString('fr-FR');
  const deliveryStr = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('fr-FR') : '-';
  const typeLabel   = order.order_type === 'emporter' ? 'A emporter' : 'Livraison';
  const pmLabels    = { especes:'Especes', carte:'Carte bancaire', virement:'Virement', cheque:'Cheque', en_ligne:'En ligne' };

  const PAGE_W    = 595.28;
  const PAGE_H    = 841.89;
  const MARGIN    = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;   // 515.28

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', autoFirstPage: true, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="' + docNumber + '.pdf"');
  doc.pipe(res);

  // == BANDEAU HEADER =========================================
  const HEADER_H = 88;
  doc.rect(0, 0, PAGE_W, HEADER_H).fill(accentHex);

  doc.fillColor('white').font('Helvetica-Bold').fontSize(22)
     .text(company.company_name || 'SoCake', MARGIN, 20, { lineBreak: false });
  if (company.slogan) {
    doc.fillColor('white').font('Helvetica').fontSize(9)
       .text(company.slogan, MARGIN, 48, { lineBreak: false });
  }
  const contactParts = [company.address, company.city, company.phone, company.website].filter(Boolean);
  if (contactParts.length) {
    doc.fillColor('white').font('Helvetica').fontSize(8.5)
       .text(contactParts.join('  |  '), MARGIN, 65, { width: CONTENT_W, align: 'right', lineBreak: false });
  }

  // == BLOC META (ref gauche / client droite) =================
  const META_Y = HEADER_H + 18;
  const HALF   = CONTENT_W / 2 - 10;

  doc.fillColor(accentHex).font('Helvetica-Bold').fontSize(24)
     .text(docLabel, MARGIN, META_Y, { lineBreak: false });

  let metaY = META_Y + 34;
  doc.fillColor('#555').font('Helvetica').fontSize(9);
  const metaLines = [
    'Ref. : ' + docNumber,
    'Date : ' + dateStr,
    'Livraison : ' + deliveryStr,
    'Type : ' + typeLabel,
  ];
  if (order.event_name) metaLines.push('Evenement : ' + order.event_name);
  metaLines.forEach(line => { doc.text(line, MARGIN, metaY, { lineBreak: false }); metaY += 14; });

  // Encadre client (droite)
  const BOX_X = MARGIN + HALF + 20;
  const BOX_W = CONTENT_W - HALF - 20;
  const BOX_Y = META_Y;
  const BOX_H = Math.max(metaY - META_Y + 10, 90);

  doc.rect(BOX_X, BOX_Y, BOX_W, BOX_H).fill('#F5F5F5');
  doc.rect(BOX_X, BOX_Y, 3, BOX_H).fill(accentHex);

  doc.fillColor('#999').font('Helvetica-Bold').fontSize(7)
     .text('DESTINATAIRE', BOX_X + 10, BOX_Y + 8, { lineBreak: false });
  doc.fillColor('#111').font('Helvetica-Bold').fontSize(11)
     .text(order.client_name || '', BOX_X + 10, BOX_Y + 20);

  doc.fillColor('#555').font('Helvetica').fontSize(9);
  let cY = BOX_Y + 36;
  if (order.client_phone) { doc.text(order.client_phone, BOX_X + 10, cY, { width: BOX_W - 15, lineBreak: false }); cY += 14; }
  if (order.client_email) { doc.text(order.client_email, BOX_X + 10, cY, { width: BOX_W - 15, lineBreak: false }); cY += 14; }
  if (order.delivery_address && order.order_type !== 'emporter') {
    doc.text(order.delivery_address, BOX_X + 10, cY, { width: BOX_W - 15 });
  }

  // == TABLEAU ARTICLES =======================================
  const TABLE_Y = META_Y + BOX_H + 14;
  const HEAD_H  = 24;
  const ROW_H   = 26;

  // Colonnes : somme des w doit = CONTENT_W = 515.28
  // 185 + 85 + 35 + 105 + 105 = 515
  const COLS = [
    { label: 'Designation', w: 185, align: 'left'   },
    { label: 'Remarques',   w: 85,  align: 'left'   },
    { label: 'Qte',         w: 35,  align: 'center' },
    { label: 'Prix unit.',  w: 105, align: 'right'  },
    { label: 'Montant',     w: 105, align: 'right'  },
  ];
  let colX = MARGIN;
  COLS.forEach(col => { col.x = colX; colX += col.w; });

  // En-tete tableau
  doc.rect(MARGIN, TABLE_Y, CONTENT_W, HEAD_H).fill(accentHex);
  COLS.forEach(col => {
    doc.fillColor('white').font('Helvetica-Bold').fontSize(8.5)
       .text(col.label, col.x + 5, TABLE_Y + 8, { width: col.w - 10, align: col.align, lineBreak: false });
  });

  // Lignes
  let rowY = TABLE_Y + HEAD_H;
  items.forEach((item, i) => {
    doc.rect(MARGIN, rowY, CONTENT_W, ROW_H).fill(i % 2 === 0 ? '#FFFFFF' : '#F9F9F9');
    doc.moveTo(MARGIN, rowY + ROW_H).lineTo(MARGIN + CONTENT_W, rowY + ROW_H)
       .strokeColor('#ECECEC').lineWidth(0.5).stroke();
    const ty = rowY + (ROW_H - 9) / 2;
    doc.fillColor('#111').font('Helvetica-Bold').fontSize(9)
       .text(item.product_name || '', COLS[0].x + 5, ty, { width: COLS[0].w - 10, lineBreak: false });
    doc.fillColor('#777').font('Helvetica').fontSize(8.5)
       .text(item.customization || '-', COLS[1].x + 5, ty, { width: COLS[1].w - 10, lineBreak: false });
    doc.fillColor('#333').fontSize(9)
       .text(String(item.quantity), COLS[2].x + 5, ty, { width: COLS[2].w - 10, align: 'center', lineBreak: false });
    doc.fillColor('#333').font('Helvetica')
       .text(fmt(item.unit_price), COLS[3].x + 5, ty, { width: COLS[3].w - 10, align: 'right', lineBreak: false });
    doc.fillColor('#111').font('Helvetica-Bold')
       .text(fmt(item.subtotal || item.quantity * item.unit_price), COLS[4].x + 5, ty, { width: COLS[4].w - 10, align: 'right', lineBreak: false });
    rowY += ROW_H;
  });
  doc.rect(MARGIN, TABLE_Y, CONTENT_W, rowY - TABLE_Y).stroke('#CCCCCC').lineWidth(0.8);

  // == TOTAUX (moitie droite) =================================
  const TOT_START = MARGIN + CONTENT_W * 0.5;
  const TOT_W     = CONTENT_W * 0.5;
  const LBL_W     = TOT_W * 0.5;
  const VAL_W     = TOT_W * 0.5;
  let totY = rowY + 14;

  const totalAmt  = order.total_amount || 0;
  const advance   = order.advance_paid || 0;
  const remaining = totalAmt - advance;

  function totRow(label, value, highlight) {
    if (highlight) {
      doc.rect(TOT_START, totY - 4, TOT_W, 24).fill(accentHex);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
         .text(label, TOT_START + 8,     totY + 3, { width: LBL_W - 10, align: 'left',  lineBreak: false });
      doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
         .text(value, TOT_START + LBL_W, totY + 3, { width: VAL_W - 8,  align: 'right', lineBreak: false });
    } else {
      doc.fillColor('#555').font('Helvetica').fontSize(9.5)
         .text(label, TOT_START + 8,     totY, { width: LBL_W - 10, align: 'left',  lineBreak: false });
      doc.fillColor('#111').font('Helvetica-Bold').fontSize(9.5)
         .text(value, TOT_START + LBL_W, totY, { width: VAL_W - 8,  align: 'right', lineBreak: false });
    }
    totY += 26;
  }

  totRow('TOTAL TTC', fmt(totalAmt), true);
  if (advance > 0) {
    totRow('Acompte recu', fmt(advance), false);
    totRow('Reste a payer', fmt(remaining), false);
  }

  // == PAIEMENT + NOTES =======================================
  let infoY = Math.max(totY, rowY) + 16;

  if (!isDevis) {
    doc.rect(MARGIN, infoY, 200, 28).fill('#F5F5F5');
    doc.fillColor('#999').font('Helvetica').fontSize(7.5)
       .text('MODE DE PAIEMENT', MARGIN + 8, infoY + 6, { lineBreak: false });
    doc.fillColor('#333').font('Helvetica-Bold').fontSize(9.5)
       .text(pmLabels[order.payment_method] || '-', MARGIN + 8, infoY + 16, { lineBreak: false });
    infoY += 38;
  }

  // == PIED DE PAGE (position fixe en bas) ====================
  const FOOTER_Y = PAGE_H - 36;

  if (order.notes) {
    doc.moveTo(MARGIN, infoY).lineTo(MARGIN + CONTENT_W, infoY).strokeColor('#DDDDDD').lineWidth(0.8).stroke();
    infoY += 8;
    doc.fillColor('#999').font('Helvetica-Bold').fontSize(8).text('NOTES', MARGIN, infoY, { lineBreak: false });
    infoY += 13;
    // Calcule la hauteur max dispo avant le pied de page pour éviter le débordement
    const notesMaxH = Math.max(FOOTER_Y - infoY - 12, 20);
    doc.fillColor('#555').font('Helvetica').fontSize(9)
       .text(order.notes, MARGIN, infoY, { width: CONTENT_W, height: notesMaxH });
  }

  // Retourne sur la page 1 (bufferPages:true) pour dessiner le pied de page
  // sans risque que le curseur interne de PDFKit crée une 2e page vide.
  doc.switchToPage(0);
  doc.rect(0, FOOTER_Y, PAGE_W, 36).fill('#F2F2F2');
  const footerText = isDevis
    ? 'Devis valable 30 jours  -  ' + (company.company_name || 'SoCake') + (company.phone ? '  |  ' + company.phone : '')
    : 'Merci pour votre confiance  -  ' + (company.company_name || 'SoCake') + (company.phone ? '  |  ' + company.phone : '');
  doc.fillColor('#AAAAAA').font('Helvetica').fontSize(8)
     .text(footerText, MARGIN, FOOTER_Y + 13, { width: CONTENT_W, align: 'center', lineBreak: false });

  // Si PDFKit a quand même créé une 2e page (contenu trop long), on la blanchit
  const totalPages = doc.bufferedPageRange().count;
  for (let p = 1; p < totalPages; p++) {
    doc.switchToPage(p);
    doc.rect(0, 0, PAGE_W, PAGE_H).fill('white');
  }

  doc.flushPages();
  doc.end();
});


// ── Catch-all SPA ────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🎂  SoCake v2.0  →  http://localhost:${PORT}`);
  console.log(`    Admin: admin@socake.com / Admin@2024\n`);
});
