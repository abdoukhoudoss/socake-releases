const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// En mode Electron packagé, stocker la DB dans userData (répertoire inscriptible)
// En mode développement (node server.js), stocker à côté du code comme avant
const DB_PATH = process.env.SOCAKE_USER_DATA
  ? path.join(process.env.SOCAKE_USER_DATA, 'socake.db')
  : path.join(__dirname, 'socake.db');

// En mode Electron packagé, le binaire natif est dans app.asar.unpacked
// bindings() cherche dans app.asar (archive virtuelle) et ne le trouve pas —
// on lui indique explicitement le chemin unpacked.
const NATIVE_BINDING = process.resourcesPath
  ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules',
      'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')
  : undefined;

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH, NATIVE_BINDING ? { nativeBinding: NATIVE_BINDING } : {});
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initializeDatabase() {
  const db = getDb();

  // ── USERS ────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('admin', 'employee', 'delivery')),
      avatar TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── CUSTOMERS ────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      postal_code TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── COMPANY SETTINGS ─────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL DEFAULT 'SoCake',
      slogan TEXT DEFAULT 'Cake & Dessert · Gestion de commandes',
      activities TEXT DEFAULT '',
      logo_url TEXT DEFAULT '',
      primary_color TEXT DEFAULT '#E8748E',
      currency TEXT DEFAULT 'EUR',
      currency_symbol TEXT DEFAULT '€',
      email_notifications INTEGER DEFAULT 0,
      email_from TEXT DEFAULT '',
      email_smtp_host TEXT DEFAULT '',
      email_smtp_port INTEGER DEFAULT 587,
      email_smtp_user TEXT DEFAULT '',
      email_smtp_pass TEXT DEFAULT '',
      notify_confirm INTEGER DEFAULT 1,
      notify_ready INTEGER DEFAULT 1,
      notify_shipped INTEGER DEFAULT 1,
      address TEXT DEFAULT '',
      city TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      website TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── PRODUCTS ─────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('verrine', 'cupcake', 'solo_delice', 'mignardise', 'gateau', 'autre')),
      description TEXT,
      price REAL NOT NULL DEFAULT 0,
      cost_price REAL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'pièce',
      active INTEGER NOT NULL DEFAULT 1,
      image_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── EVENTS ───────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      event_date DATE NOT NULL,
      location TEXT,
      client_name TEXT,
      client_phone TEXT,
      client_email TEXT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'planifie' CHECK(status IN ('planifie', 'en_cours', 'termine', 'annule')),
      budget REAL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── ORDERS ───────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      client_name TEXT NOT NULL,
      client_phone TEXT,
      client_email TEXT,
      delivery_date DATE NOT NULL,
      delivery_address TEXT,
      delivery_time TEXT,
      status TEXT NOT NULL DEFAULT 'en_attente' CHECK(status IN ('en_attente', 'confirme', 'en_preparation', 'pret', 'livre', 'annule')),
      payment_method TEXT DEFAULT 'especes' CHECK(payment_method IN ('especes', 'carte', 'virement', 'cheque', 'en_ligne')),
      payment_status TEXT DEFAULT 'en_attente' CHECK(payment_status IN ('en_attente', 'partiel', 'complet')),
      total_amount REAL DEFAULT 0,
      advance_paid REAL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── ORDER ITEMS ──────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      customization TEXT,
      subtotal REAL GENERATED ALWAYS AS (quantity * unit_price) STORED
    )
  `);

  // ── DELIVERIES ───────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      driver_name TEXT,
      vehicle TEXT,
      scheduled_time TEXT,
      delivery_notes TEXT,
      delivered_at DATETIME,
      recipient_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── STOCK ────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'ingredient',
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'kg',
      min_quantity REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0,
      supplier TEXT,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── STOCK MOVEMENTS ──────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_id INTEGER NOT NULL REFERENCES stock(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('entree', 'sortie', 'ajustement')),
      quantity REAL NOT NULL,
      reason TEXT,
      user_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── SAFE MIGRATIONS (existing DB compat) ─────────────
  const migrations = [
    "ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id)",
    "ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'especes'",
    "ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'en_attente'",
    "ALTER TABLE orders ADD COLUMN delivery_time TEXT",
    "ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'livraison'",
    "ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0",
    "ALTER TABLE products ADD COLUMN image_url TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN phone TEXT",
    "ALTER TABLE events ADD COLUMN customer_id INTEGER REFERENCES customers(id)",
  ];

  migrations.forEach(sql => {
    try { db.exec(sql); } catch (_) { /* column already exists */ }
  });

  // ── SEED DATA ────────────────────────────────────────
  seedData(db);

  // ── ENSURE COMPANY SETTINGS EXIST ────────────────────
  const hasSettings = db.prepare('SELECT COUNT(*) as c FROM company_settings').get();
  if (hasSettings.c === 0) {
    db.prepare(`
      INSERT INTO company_settings (company_name, slogan, activities, primary_color, currency_symbol)
      VALUES (?, ?, ?, ?, ?)
    `).run('SoCake', 'Cake & Dessert · Gestion de commandes', 'Pâtisserie artisanale, Gâteaux sur commande, Desserts de fête', '#E8748E', '€');
  }

  // ── ENSURE SAMPLE CUSTOMERS EXIST ────────────────────
  const hasCustomers = db.prepare('SELECT COUNT(*) as c FROM customers').get();
  if (hasCustomers.c === 0) {
    const insertCustomer = db.prepare(`
      INSERT INTO customers (name, email, phone, city, address) VALUES (?, ?, ?, ?, ?)
    `);
    insertCustomer.run('Marie Dupont',   'marie@email.com',  '06 12 34 56 78', 'Paris',    '12 rue de la Paix');
    insertCustomer.run('Jean Martin',    'jean@email.com',   '06 98 76 54 32', 'Lyon',     '5 avenue des Fleurs');
    insertCustomer.run('Sophie Bernard', 'sophie@email.com', '07 11 22 33 44', 'Bordeaux', '8 allée du Moulin');
  }

  return db;
}

function seedData(db) {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count > 0) return;

  // Admin user
  const hashedPassword = bcrypt.hashSync('Admin@2024', 10);
  db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run('Administrateur SoCake', 'admin@socake.com', hashedPassword, 'admin');

  // Company settings
  db.prepare(`
    INSERT INTO company_settings (company_name, slogan, activities, primary_color, currency_symbol)
    VALUES (?, ?, ?, ?, ?)
  `).run('SoCake', 'Cake & Dessert · Gestion de commandes', 'Pâtisserie artisanale, Gâteaux sur commande, Desserts de fête', '#E8748E', '€');

  // Products
  const products = [
    { name: 'Verrine Chocolat',        category: 'verrine',     price: 3.50,   cost_price: 1.20, description: 'Verrine au chocolat fondant et crème chantilly', unit: 'pièce' },
    { name: 'Verrine Fraise',          category: 'verrine',     price: 3.50,   cost_price: 1.10, description: 'Verrine fraise fraîche et mousse vanille',        unit: 'pièce' },
    { name: 'Verrine Citron',          category: 'verrine',     price: 3.50,   cost_price: 1.00, description: 'Verrine lemon curd et meringue italienne',        unit: 'pièce' },
    { name: 'Cupcake Vanille',         category: 'cupcake',     price: 2.50,   cost_price: 0.80, description: 'Cupcake vanille avec glaçage beurre',             unit: 'pièce' },
    { name: 'Cupcake Chocolat',        category: 'cupcake',     price: 2.50,   cost_price: 0.90, description: 'Cupcake chocolat noir intense',                   unit: 'pièce' },
    { name: 'Cupcake Red Velvet',      category: 'cupcake',     price: 3.00,   cost_price: 1.00, description: 'Cupcake red velvet avec cream cheese',            unit: 'pièce' },
    { name: 'Solo Délice Framboise',   category: 'solo_delice', price: 5.50,   cost_price: 2.00, description: 'Entremet individuel framboise',                   unit: 'pièce' },
    { name: 'Solo Délice Mangue',      category: 'solo_delice', price: 5.50,   cost_price: 1.80, description: 'Entremet individuel mangue passion',              unit: 'pièce' },
    { name: 'Mignardises Assorties',   category: 'mignardise',  price: 1.20,   cost_price: 0.40, description: 'Assortiment de petits fours',                    unit: 'pièce' },
    { name: 'Macarons (x6)',           category: 'mignardise',  price: 8.00,   cost_price: 2.50, description: 'Macarons assortis',                               unit: 'boîte' },
    { name: 'Gâteau Anniversaire 6p',  category: 'gateau',      price: 35.00,  cost_price: 12.00, description: 'Gâteau personnalisé 6 personnes',               unit: 'pièce' },
    { name: 'Gâteau Mariage 3 étages', category: 'gateau',      price: 150.00, cost_price: 50.00, description: 'Wedding cake 3 étages décoré',                  unit: 'pièce' },
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (name, category, description, price, cost_price, unit)
    VALUES (@name, @category, @description, @price, @cost_price, @unit)
  `);
  products.forEach(p => insertProduct.run(p));

  // Sample customers
  const customers = [
    { name: 'Marie Dupont',    email: 'marie@email.com',   phone: '06 12 34 56 78', city: 'Paris',     address: '12 rue de la Paix' },
    { name: 'Jean Martin',     email: 'jean@email.com',    phone: '06 98 76 54 32', city: 'Lyon',      address: '5 avenue des Fleurs' },
    { name: 'Sophie Bernard',  email: 'sophie@email.com',  phone: '07 11 22 33 44', city: 'Bordeaux',  address: '8 allée du Moulin' },
  ];
  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, email, phone, city, address) VALUES (@name, @email, @phone, @city, @address)
  `);
  customers.forEach(c => insertCustomer.run(c));

  // Stock items
  const stockItems = [
    { name: 'Farine T55',        quantity: 25,  unit: 'kg',    min_quantity: 5,   category: 'ingredient' },
    { name: 'Sucre en poudre',   quantity: 15,  unit: 'kg',    min_quantity: 3,   category: 'ingredient' },
    { name: 'Beurre',            quantity: 8,   unit: 'kg',    min_quantity: 2,   category: 'ingredient' },
    { name: 'Oeufs',             quantity: 120, unit: 'unité', min_quantity: 30,  category: 'ingredient' },
    { name: 'Chocolat noir 70%', quantity: 5,   unit: 'kg',    min_quantity: 1,   category: 'ingredient' },
    { name: 'Crème liquide 35%', quantity: 10,  unit: 'L',     min_quantity: 3,   category: 'ingredient' },
    { name: 'Vanille en poudre', quantity: 0.5, unit: 'kg',    min_quantity: 0.1, category: 'ingredient' },
    { name: 'Levure chimique',   quantity: 1,   unit: 'kg',    min_quantity: 0.2, category: 'ingredient' },
    { name: 'Fraises fraîches',  quantity: 3,   unit: 'kg',    min_quantity: 1,   category: 'ingredient' },
    { name: 'Framboises',        quantity: 2,   unit: 'kg',    min_quantity: 0.5, category: 'ingredient' },
    { name: 'Boîtes à gâteau',   quantity: 50,  unit: 'unité', min_quantity: 10,  category: 'emballage' },
    { name: 'Verrines 20cl',     quantity: 200, unit: 'unité', min_quantity: 50,  category: 'emballage' },
  ];

  const insertStock = db.prepare(`
    INSERT INTO stock (name, quantity, unit, min_quantity, category)
    VALUES (@name, @quantity, @unit, @min_quantity, @category)
  `);
  stockItems.forEach(s => insertStock.run(s));
}

module.exports = { getDb, initializeDatabase };
