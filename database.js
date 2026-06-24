const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function now() { return new Date().toISOString().replace('T', ' ').split('.')[0]; }

// ─── JSON file persistence ─────────────────────────────────────────────────
function load(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

function save(name, data) {
  const file = path.join(DATA_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── In-memory store (write-through) ──────────────────────────────────────
const store = {
  stages: load('stages'),
  contacts: load('contacts'),
  deals: load('deals'),
  activities: load('activities'),
  products: load('products'),
  stock_movements: load('stock_movements'),
};

function persist(name) { save(name, store[name]); }

// ─── Seed default stages ───────────────────────────────────────────────────
if (store.stages.length === 0) {
  const defaults = [
    { name: 'Nuevo Lead', color: '#6366f1', position: 0 },
    { name: 'Contactado', color: '#3b82f6', position: 1 },
    { name: 'Propuesta Enviada', color: '#f59e0b', position: 2 },
    { name: 'Negociación', color: '#ef4444', position: 3 },
    { name: 'Vendido', color: '#10b981', position: 4 },
    { name: 'Perdido', color: '#6b7280', position: 5 },
  ];
  store.stages = defaults.map(s => ({ id: randomUUID(), ...s, created_at: now() }));
  persist('stages');
}

// ─── DB API ────────────────────────────────────────────────────────────────
const db = {
  uuid: () => randomUUID(),
  now,

  // STAGES
  getStages: () => [...store.stages].sort((a, b) => a.position - b.position),
  getStage: (id) => store.stages.find(s => s.id === id) || null,
  createStage: (data) => {
    const maxPos = store.stages.reduce((m, s) => Math.max(m, s.position), -1);
    const s = { id: randomUUID(), color: '#6366f1', position: maxPos + 1, created_at: now(), ...data };
    store.stages.push(s);
    persist('stages');
    return s;
  },
  updateStage: (id, data) => {
    const idx = store.stages.findIndex(s => s.id === id);
    if (idx === -1) return null;
    store.stages[idx] = { ...store.stages[idx], ...data };
    persist('stages');
    return store.stages[idx];
  },
  deleteStage: (id) => {
    store.stages = store.stages.filter(s => s.id !== id);
    persist('stages');
  },

  // CONTACTS
  getContacts: ({ search } = {}) => {
    let list = [...store.contacts];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => (c.name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q) || (c.company||'').toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  getContact: (id) => store.contacts.find(c => c.id === id) || null,
  createContact: (data) => {
    const colors = ['#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
    const c = { id: randomUUID(), avatar_color: colors[Math.floor(Math.random()*colors.length)], created_at: now(), updated_at: now(), ...data };
    store.contacts.push(c);
    persist('contacts');
    return c;
  },
  updateContact: (id, data) => {
    const idx = store.contacts.findIndex(c => c.id === id);
    if (idx === -1) return null;
    store.contacts[idx] = { ...store.contacts[idx], ...data, updated_at: now() };
    persist('contacts');
    return store.contacts[idx];
  },
  deleteContact: (id) => {
    store.contacts = store.contacts.filter(c => c.id !== id);
    persist('contacts');
  },

  // DEALS (with joined fields)
  _enrichDeal: (deal) => {
    const stage = store.stages.find(s => s.id === deal.stage_id);
    const contact = store.contacts.find(c => c.id === deal.contact_id);
    return {
      ...deal,
      stage_name: stage?.name,
      stage_color: stage?.color,
      contact_name: contact?.name,
      contact_email: contact?.email,
      contact_phone: contact?.phone,
      contact_company: contact?.company,
      contact_avatar_color: contact?.avatar_color,
    };
  },
  getDeals: ({ stage_id, status, search } = {}) => {
    let list = [...store.deals];
    if (stage_id) list = list.filter(d => d.stage_id === stage_id);
    if (status) list = list.filter(d => d.status === status);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d => {
        const contact = store.contacts.find(c => c.id === d.contact_id);
        return (d.title||'').toLowerCase().includes(q) || (contact?.name||'').toLowerCase().includes(q);
      });
    }
    return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(d => db._enrichDeal(d));
  },
  getDeal: (id) => {
    const deal = store.deals.find(d => d.id === id);
    if (!deal) return null;
    return db._enrichDeal(deal);
  },
  createDeal: (data) => {
    const d = { id: randomUUID(), status: 'active', value: 0, currency: 'ARS', created_at: now(), updated_at: now(), ...data };
    store.deals.push(d);
    persist('deals');
    return db._enrichDeal(d);
  },
  updateDeal: (id, data) => {
    const idx = store.deals.findIndex(d => d.id === id);
    if (idx === -1) return null;
    store.deals[idx] = { ...store.deals[idx], ...data, updated_at: now() };
    persist('deals');
    return db._enrichDeal(store.deals[idx]);
  },
  deleteDeal: (id) => {
    store.deals = store.deals.filter(d => d.id !== id);
    persist('deals');
  },
  findDealByGesdatta: (invoice_id) => store.deals.find(d => d.gesdatta_invoice_id === invoice_id) || null,

  // ACTIVITIES
  getActivities: ({ deal_id, contact_id } = {}, limit = 50) => {
    let list = [...store.activities];
    if (deal_id) list = list.filter(a => a.deal_id === deal_id);
    if (contact_id) list = list.filter(a => a.contact_id === contact_id);
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  },
  createActivity: (data) => {
    const a = { id: randomUUID(), created_at: now(), ...data };
    store.activities.push(a);
    persist('activities');
    return a;
  },

  // PRODUCTS
  getProducts: ({ search } = {}) => {
    let list = [...store.products];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => (p.name||'').toLowerCase().includes(q) || (p.sku||'').toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name)).map(p => {
      const movs = store.stock_movements.filter(m => m.product_id === p.id);
      const stock = movs.reduce((s, m) => m.type === 'entrada' ? s + m.quantity : s - m.quantity, 0);
      return { ...p, stock_actual: stock };
    });
  },
  getProduct: (id) => {
    const p = store.products.find(p => p.id === id);
    if (!p) return null;
    const movs = store.stock_movements.filter(m => m.product_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const stock = movs.reduce((s, m) => m.type === 'entrada' ? s + m.quantity : s - m.quantity, 0);
    return { ...p, stock_actual: stock, movements: movs };
  },
  createProduct: (data) => {
    const p = { id: randomUUID(), stock_minimo: 0, unit: 'unidad', created_at: now(), updated_at: now(), ...data };
    store.products.push(p);
    persist('products');
    return { ...p, stock_actual: 0 };
  },
  updateProduct: (id, data) => {
    const idx = store.products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    store.products[idx] = { ...store.products[idx], ...data, updated_at: now() };
    persist('products');
    const movs = store.stock_movements.filter(m => m.product_id === id);
    const stock = movs.reduce((s, m) => m.type === 'entrada' ? s + m.quantity : s - m.quantity, 0);
    return { ...store.products[idx], stock_actual: stock };
  },
  deleteProduct: (id) => {
    store.products = store.products.filter(p => p.id !== id);
    store.stock_movements = store.stock_movements.filter(m => m.product_id !== id);
    persist('products');
    persist('stock_movements');
  },

  // STOCK MOVEMENTS
  getMovements: ({ product_id, type } = {}, limit = 100) => {
    let list = [...store.stock_movements];
    if (product_id) list = list.filter(m => m.product_id === product_id);
    if (type) list = list.filter(m => m.type === type);
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit).map(m => {
      const p = store.products.find(p => p.id === m.product_id);
      return { ...m, product_name: p?.name, product_sku: p?.sku };
    });
  },
  createMovement: (data) => {
    const product = store.products.find(p => p.id === data.product_id);
    if (!product) return null;
    if (data.type === 'salida') {
      const movs = store.stock_movements.filter(m => m.product_id === data.product_id);
      const currentStock = movs.reduce((s, m) => m.type === 'entrada' ? s + m.quantity : s - m.quantity, 0);
      if (currentStock < data.quantity) return { error: `Stock insuficiente. Disponible: ${currentStock}` };
    }
    const m = { id: randomUUID(), created_at: now(), ...data };
    store.stock_movements.push(m);
    persist('stock_movements');
    return { ...m, product_name: product.name };
  },

  // STATS
  getStats: () => {
    const activeDeals = store.deals.filter(d => d.status === 'active');
    const soldStage = store.stages.find(s => s.name.toLowerCase().includes('vendido'));
    const soldDeals = soldStage ? activeDeals.filter(d => d.stage_id === soldStage.id) : [];

    const dealsByStage = store.stages.sort((a, b) => a.position - b.position).map(s => {
      const sDeals = activeDeals.filter(d => d.stage_id === s.id);
      return { id: s.id, name: s.name, color: s.color, deal_count: sDeals.length, total_value: sDeals.reduce((t, d) => t + (d.value || 0), 0) };
    });

    return {
      totalDeals: activeDeals.length,
      totalValue: activeDeals.reduce((t, d) => t + (d.value || 0), 0),
      soldDeals: soldDeals.length,
      soldValue: soldDeals.reduce((t, d) => t + (d.value || 0), 0),
      totalContacts: store.contacts.length,
      dealsByStage,
      recentActivities: db.getActivities({}, 10),
    };
  },
};

module.exports = db;
