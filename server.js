const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3456;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── STAGES ───────────────────────────────────────────────────────────────────

app.get('/api/stages', (req, res) => res.json(db.getStages()));

app.post('/api/stages', (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  res.json(db.createStage({ name, color }));
});

app.put('/api/stages/:id', (req, res) => {
  const updated = db.updateStage(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Etapa no encontrada' });
  res.json(updated);
});

app.delete('/api/stages/:id', (req, res) => {
  const dealsInStage = db.getDeals({ stage_id: req.params.id });
  if (dealsInStage.length > 0) return res.status(400).json({ error: 'La etapa tiene deals. Muévalos antes de eliminarla.' });
  db.deleteStage(req.params.id);
  res.json({ ok: true });
});

// ─── CONTACTS ─────────────────────────────────────────────────────────────────

app.get('/api/contacts', (req, res) => res.json(db.getContacts({ search: req.query.search })));

app.get('/api/contacts/:id', (req, res) => {
  const contact = db.getContact(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contacto no encontrado' });
  const deals = db.getDeals({ }).filter(d => d.contact_id === req.params.id);
  const activities = db.getActivities({ contact_id: req.params.id });
  res.json({ ...contact, deals, activities });
});

app.post('/api/contacts', (req, res) => {
  const { name, email, phone, company } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
  res.json(db.createContact({ name, email: email||null, phone: phone||null, company: company||null }));
});

app.put('/api/contacts/:id', (req, res) => {
  const { name, email, phone, company } = req.body;
  const updated = db.updateContact(req.params.id, { name, email: email||null, phone: phone||null, company: company||null });
  if (!updated) return res.status(404).json({ error: 'Contacto no encontrado' });
  res.json(updated);
});

app.delete('/api/contacts/:id', (req, res) => {
  db.deleteContact(req.params.id);
  res.json({ ok: true });
});

// ─── DEALS ────────────────────────────────────────────────────────────────────

app.get('/api/deals', (req, res) => res.json(db.getDeals({ stage_id: req.query.stage_id, status: req.query.status, search: req.query.search })));

app.get('/api/deals/:id', (req, res) => {
  const deal = db.getDeal(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal no encontrado' });
  const activities = db.getActivities({ deal_id: req.params.id });
  res.json({ ...deal, activities });
});

app.post('/api/deals', (req, res) => {
  const { title, contact_id, stage_id, value, currency, notes, expected_close, gesdatta_invoice_id, gesdatta_invoice_number } = req.body;
  if (!title) return res.status(400).json({ error: 'El título es requerido' });

  const stages = db.getStages();
  const targetStage = stage_id || stages[0]?.id;
  if (!targetStage) return res.status(400).json({ error: 'No hay etapas configuradas' });

  const deal = db.createDeal({ title, contact_id: contact_id||null, stage_id: targetStage, value: value||0, currency: currency||'ARS', notes: notes||null, expected_close: expected_close||null, gesdatta_invoice_id: gesdatta_invoice_id||null, gesdatta_invoice_number: gesdatta_invoice_number||null });
  db.createActivity({ deal_id: deal.id, contact_id: contact_id||null, type: 'deal_created', description: `Deal "${title}" creado` });
  res.json(deal);
});

app.put('/api/deals/:id', (req, res) => {
  const existing = db.getDeal(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Deal no encontrado' });

  const { title, contact_id, stage_id, value, currency, notes, expected_close, status, gesdatta_invoice_id, gesdatta_invoice_number } = req.body;
  const updated = db.updateDeal(req.params.id, { title, contact_id: contact_id||null, stage_id, value, currency, notes, expected_close, status: status||existing.status, gesdatta_invoice_id: gesdatta_invoice_id||null, gesdatta_invoice_number: gesdatta_invoice_number||null });

  if (stage_id && stage_id !== existing.stage_id) {
    const newStage = db.getStage(stage_id);
    db.createActivity({ deal_id: req.params.id, contact_id: contact_id||null, type: 'stage_changed', description: `Movido a etapa: ${newStage?.name}` });
  }

  res.json(updated);
});

app.patch('/api/deals/:id/stage', (req, res) => {
  const { stage_id } = req.body;
  const existing = db.getDeal(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Deal no encontrado' });
  const newStage = db.getStage(stage_id);
  if (!newStage) return res.status(404).json({ error: 'Etapa no encontrada' });

  db.updateDeal(req.params.id, { stage_id });
  db.createActivity({ deal_id: req.params.id, contact_id: existing.contact_id||null, type: 'stage_changed', description: `Movido a: ${newStage.name}` });
  res.json({ ok: true, stage: newStage });
});

app.delete('/api/deals/:id', (req, res) => {
  db.deleteDeal(req.params.id);
  res.json({ ok: true });
});

// ─── ACTIVITIES ───────────────────────────────────────────────────────────────

app.get('/api/activities', (req, res) => res.json(db.getActivities({ deal_id: req.query.deal_id, contact_id: req.query.contact_id })));

app.post('/api/activities', (req, res) => {
  const { deal_id, contact_id, type, description } = req.body;
  res.json(db.createActivity({ deal_id: deal_id||null, contact_id: contact_id||null, type, description }));
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

app.get('/api/products', (req, res) => res.json(db.getProducts({ search: req.query.search })));

app.get('/api/products/:id', (req, res) => {
  const p = db.getProduct(req.params.id);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(p);
});

app.post('/api/products', (req, res) => {
  const { name, sku, description, stock_minimo, unit, price } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
  res.json(db.createProduct({ name, sku: sku||null, description: description||null, stock_minimo: stock_minimo||0, unit: unit||'unidad', price: price||0 }));
});

app.put('/api/products/:id', (req, res) => {
  const updated = db.updateProduct(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(updated);
});

app.delete('/api/products/:id', (req, res) => {
  db.deleteProduct(req.params.id);
  res.json({ ok: true });
});

// ─── STOCK MOVEMENTS ──────────────────────────────────────────────────────────

app.get('/api/stock/movements', (req, res) => res.json(db.getMovements({ product_id: req.query.product_id, type: req.query.type })));

app.post('/api/stock/movements', (req, res) => {
  const { product_id, type, quantity, reason, reference } = req.body;
  if (!product_id || !type || !quantity) return res.status(400).json({ error: 'product_id, type y quantity son requeridos' });
  if (!['entrada', 'salida'].includes(type)) return res.status(400).json({ error: 'type debe ser "entrada" o "salida"' });
  if (quantity <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });

  const result = db.createMovement({ product_id, type, quantity: Number(quantity), reason: reason||null, reference: reference||null });
  if (!result) return res.status(404).json({ error: 'Producto no encontrado' });
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result);
});

// ─── GESDATTA WEBHOOK ─────────────────────────────────────────────────────────

app.post('/api/gesdatta/invoice', (req, res) => {
  const { invoice_id, invoice_number, client_name, client_email, total, items } = req.body;
  if (!invoice_id) return res.status(400).json({ error: 'invoice_id requerido' });

  // Buscar deal ya vinculado
  let deal = db.findDealByGesdatta(invoice_id);
  const stages = db.getStages();
  const soldStage = stages.find(s => s.name.toLowerCase().includes('vendido')) || stages[stages.length - 2];

  if (deal) {
    if (soldStage) db.updateDeal(deal.id, { stage_id: soldStage.id, gesdatta_invoice_number: invoice_number });
    db.createActivity({ deal_id: deal.id, contact_id: deal.contact_id||null, type: 'invoice_created', description: `Factura Gesdatta #${invoice_number} (Total: $${total})` });
    return res.json({ ok: true, action: 'updated', deal_id: deal.id });
  }

  // Buscar o crear contacto
  let contact = null;
  if (client_email) contact = db.getContacts().find(c => c.email === client_email);
  if (!contact && client_name) contact = db.getContacts().find(c => c.name.toLowerCase().includes(client_name.toLowerCase()));
  if (!contact && client_name) contact = db.createContact({ name: client_name, email: client_email||null });

  if (!soldStage) return res.status(500).json({ error: 'No se encontró etapa de Vendido' });

  const title = items?.length > 0 ? items.map(i => i.name || i.descripcion || i.description).filter(Boolean).join(', ').substring(0, 80) : `Factura Gesdatta #${invoice_number}`;
  const newDeal = db.createDeal({ title, contact_id: contact?.id||null, stage_id: soldStage.id, value: total||0, currency: 'ARS', gesdatta_invoice_id: invoice_id, gesdatta_invoice_number: invoice_number });
  db.createActivity({ deal_id: newDeal.id, contact_id: contact?.id||null, type: 'invoice_created', description: `Factura Gesdatta #${invoice_number} registrada automáticamente. Total: $${total}` });

  res.json({ ok: true, action: 'created', deal_id: newDeal.id, contact_id: contact?.id });
});

// ─── STATS ────────────────────────────────────────────────────────────────────

app.get('/api/stats', (req, res) => res.json(db.getStats()));

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`\n🚀 CRM Gesdatta corriendo en http://localhost:${PORT}\n`));
