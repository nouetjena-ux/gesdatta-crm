const BASE = 'http://localhost:3456/api';

async function post(path, body) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}
async function get(path) {
  const r = await fetch(BASE + path);
  return r.json();
}
async function patch(path, body) {
  const r = await fetch(BASE + path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

async function seed() {
  console.log('🌱 Cargando demo...\n');

  const stages = await get('/stages');
  const stageMap = {};
  stages.forEach(s => stageMap[s.name] = s.id);

  // ── CONTACTOS ──────────────────────────────────────────────────────────────
  console.log('👥 Creando contactos...');
  const contactsData = [
    { name: 'Martín Rodríguez', email: 'martin@calefacciones-norte.com.ar', phone: '+54 9 11 5523-4411', company: 'Calefacciones Norte S.A.' },
    { name: 'Laura Fernández',  email: 'laura@termolux.com.ar',             phone: '+54 9 351 4812-9900', company: 'Termolux Córdoba' },
    { name: 'Diego Sánchez',    email: 'diego@constructora-bs.com.ar',       phone: '+54 9 11 6677-3300', company: 'Constructora Buenos Aires' },
    { name: 'Ana Gómez',        email: 'ana.gomez@hidrogas.com.ar',          phone: '+54 9 261 5541-2200', company: 'Hidrogas Mendoza' },
    { name: 'Carlos Villalba',  email: 'cvillalba@techocalor.com.ar',        phone: '+54 9 11 4430-8800', company: 'Techo & Calor' },
    { name: 'Sofía Pereyra',    email: 'spereyra@gmail.com',                 phone: '+54 9 11 2244-6677', company: null },
    { name: 'Roberto Acuña',    email: 'racuna@ferreteria-acuna.com.ar',     phone: '+54 9 341 6655-4400', company: 'Ferretería Acuña Hnos.' },
    { name: 'Valeria Moreno',   email: 'vmoreno@instaplumber.com.ar',        phone: '+54 9 11 7788-2211', company: 'InstaPlumber Instalaciones' },
  ];
  const contacts = [];
  for (const c of contactsData) {
    const created = await post('/contacts', c);
    contacts.push(created);
    process.stdout.write('.');
  }
  console.log(' ✓\n');

  // ── DEALS ──────────────────────────────────────────────────────────────────
  console.log('💼 Creando deals...');
  const dealsData = [
    // Nuevo Lead
    { title: 'Cotización 20 radiadores panel', contact_id: contacts[0].id, stage: 'Nuevo Lead',        value: 380000,  notes: 'Necesitan entrega en obra antes del 15/07' },
    { title: 'Consulta calefacción central',   contact_id: contacts[5].id, stage: 'Nuevo Lead',        value: 0,       notes: 'Llamó por Instagram, quiere presupuesto' },

    // Contactado
    { title: 'Provisión radiadores toallero x10', contact_id: contacts[1].id, stage: 'Contactado',    value: 220000,  notes: 'Proyecto baño hotel. Enviada ficha técnica.' },
    { title: 'Sistema calefacción planta industrial', contact_id: contacts[2].id, stage: 'Contactado', value: 1450000, notes: 'Reunión agendada para el martes' },

    // Propuesta Enviada
    { title: 'Radiadores panel 500W x30 uds',  contact_id: contacts[3].id, stage: 'Propuesta Enviada', value: 540000,  notes: 'Propuesta enviada el 20/06. Esperando respuesta.' },
    { title: 'Calefactores eléctricos x15',    contact_id: contacts[6].id, stage: 'Propuesta Enviada', value: 195000,  notes: 'Interesado, pide descuento por volumen' },
    { title: 'Kit instalación completo',        contact_id: contacts[7].id, stage: 'Propuesta Enviada', value: 87000,   notes: null },

    // Negociación
    { title: 'Radiadores de columna x8',        contact_id: contacts[4].id, stage: 'Negociación',      value: 312000,  notes: 'Pidió bajar 10%. Contra ofrecemos 5%.' },
    { title: 'Provisión anual material plomería', contact_id: contacts[2].id, stage: 'Negociación',    value: 2800000, notes: 'Contrato anual. En revisión legal.' },

    // Vendido
    { title: 'Radiador Urbano 500W x5',         contact_id: contacts[0].id, stage: 'Vendido',          value: 187500,  gesdatta_invoice_id: 'FAC-2024-001', gesdatta_invoice_number: '0001-00000123' },
    { title: 'Calefactor Eco 1000W x3',          contact_id: contacts[1].id, stage: 'Vendido',          value: 96000,   gesdatta_invoice_id: 'FAC-2024-002', gesdatta_invoice_number: '0001-00000124' },
    { title: 'Toallero eléctrico cromado x2',    contact_id: contacts[5].id, stage: 'Vendido',          value: 68000,   gesdatta_invoice_id: 'FAC-2024-003', gesdatta_invoice_number: '0001-00000125' },

    // Perdido
    { title: 'Proyecto calefacción edificio',    contact_id: contacts[3].id, stage: 'Perdido',          value: 890000,  notes: 'Ganó la competencia con precio más bajo' },
  ];

  const createdDeals = [];
  for (const d of dealsData) {
    const stageId = stageMap[d.stage];
    const created = await post('/deals', {
      title: d.title,
      contact_id: d.contact_id,
      stage_id: stageId,
      value: d.value,
      currency: 'ARS',
      notes: d.notes || null,
      gesdatta_invoice_id: d.gesdatta_invoice_id || null,
      gesdatta_invoice_number: d.gesdatta_invoice_number || null,
    });
    createdDeals.push(created);
    process.stdout.write('.');
  }
  console.log(' ✓\n');

  // ── ACTIVIDADES MANUALES ───────────────────────────────────────────────────
  console.log('📋 Agregando actividades...');
  const actData = [
    { deal: createdDeals[0], type: 'call',    desc: 'Llamada inicial. Muy interesado, pide presupuesto detallado.' },
    { deal: createdDeals[2], type: 'email',   desc: 'Enviamos ficha técnica y lista de precios actualizada.' },
    { deal: createdDeals[3], type: 'meeting', desc: 'Reunión en obra. Medición de espacios realizada.' },
    { deal: createdDeals[4], type: 'email',   desc: 'Propuesta formal enviada por email con condiciones comerciales.' },
    { deal: createdDeals[7], type: 'call',    desc: 'Negociación de precio. Cliente pide 10% de descuento.' },
    { deal: createdDeals[8], type: 'meeting', desc: 'Presentación en oficinas del cliente. Muy buena recepción.' },
    { deal: createdDeals[9],  type: 'note',   desc: 'Pago recibido. Preparando despacho para el miércoles.' },
    { deal: createdDeals[10], type: 'note',   desc: 'Entregado en obra. Cliente conforme.' },
  ];
  for (const a of actData) {
    await post('/activities', { deal_id: a.deal.id, contact_id: a.deal.contact_id, type: a.type, description: a.desc });
    process.stdout.write('.');
  }
  console.log(' ✓\n');

  // ── PRODUCTOS ──────────────────────────────────────────────────────────────
  console.log('📦 Creando productos...');
  const productsData = [
    { name: 'Radiador Panel 500W Urbano',   sku: 'RAD-PAN-500U',  unit: 'unidad', price: 37500,  stock_minimo: 10, description: 'Radiador panel de acero 500W - color blanco' },
    { name: 'Radiador Panel 1000W Urbano',  sku: 'RAD-PAN-1000U', unit: 'unidad', price: 58000,  stock_minimo: 8,  description: 'Radiador panel de acero 1000W - color blanco' },
    { name: 'Calefactor Eco 1500W',         sku: 'CAL-ECO-1500',  unit: 'unidad', price: 32000,  stock_minimo: 5,  description: 'Calefactor eléctrico portátil 1500W' },
    { name: 'Toallero Eléctrico Cromado',   sku: 'TOA-CROM-60',   unit: 'unidad', price: 34000,  stock_minimo: 6,  description: 'Toallero eléctrico cromado 60cm 150W' },
    { name: 'Termostato Digital Programable', sku: 'TER-DIG-PRO', unit: 'unidad', price: 18500,  stock_minimo: 15, description: 'Termostato digital WiFi programable' },
    { name: 'Caño Cobre 3/4" (metro)',       sku: 'CAÑ-CU-34',    unit: 'metro',  price: 4200,   stock_minimo: 50, description: 'Caño de cobre para instalaciones' },
    { name: 'Kit Instalación Radiador',      sku: 'KIT-INST-RAD', unit: 'kit',    price: 8700,   stock_minimo: 20, description: 'Valvulas, soportes y accesorios para 1 radiador' },
  ];
  const products = [];
  for (const p of productsData) {
    const created = await post('/products', p);
    products.push(created);
    process.stdout.write('.');
  }
  console.log(' ✓\n');

  // ── MOVIMIENTOS DE STOCK ───────────────────────────────────────────────────
  console.log('📊 Registrando movimientos de stock...');
  const movements = [
    // Radiador 500W
    { product_id: products[0].id, type: 'entrada', quantity: 50, reason: 'compra',            reference: 'OC-2024-001' },
    { product_id: products[0].id, type: 'salida',  quantity: 5,  reason: 'venta',             reference: 'FAC-2024-001' },
    { product_id: products[0].id, type: 'salida',  quantity: 8,  reason: 'venta',             reference: 'FAC-2024-005' },
    { product_id: products[0].id, type: 'entrada', quantity: 20, reason: 'compra',            reference: 'OC-2024-002' },
    { product_id: products[0].id, type: 'salida',  quantity: 3,  reason: 'devolucion_proveedor', reference: 'REM-2024-011' },
    // Radiador 1000W
    { product_id: products[1].id, type: 'entrada', quantity: 30, reason: 'compra',            reference: 'OC-2024-001' },
    { product_id: products[1].id, type: 'salida',  quantity: 12, reason: 'venta',             reference: 'FAC-2024-003' },
    { product_id: products[1].id, type: 'salida',  quantity: 4,  reason: 'venta',             reference: 'FAC-2024-007' },
    // Calefactor Eco
    { product_id: products[2].id, type: 'entrada', quantity: 25, reason: 'compra',            reference: 'OC-2024-003' },
    { product_id: products[2].id, type: 'salida',  quantity: 3,  reason: 'venta',             reference: 'FAC-2024-002' },
    { product_id: products[2].id, type: 'salida',  quantity: 6,  reason: 'venta',             reference: 'FAC-2024-006' },
    { product_id: products[2].id, type: 'salida',  quantity: 1,  reason: 'perdida',           reference: null },
    // Toallero
    { product_id: products[3].id, type: 'entrada', quantity: 20, reason: 'compra',            reference: 'OC-2024-002' },
    { product_id: products[3].id, type: 'salida',  quantity: 2,  reason: 'venta',             reference: 'FAC-2024-004' },
    { product_id: products[3].id, type: 'salida',  quantity: 5,  reason: 'venta',             reference: 'FAC-2024-008' },
    // Termostato
    { product_id: products[4].id, type: 'entrada', quantity: 40, reason: 'compra',            reference: 'OC-2024-003' },
    { product_id: products[4].id, type: 'salida',  quantity: 18, reason: 'venta',             reference: 'FAC-2024-multi' },
    { product_id: products[4].id, type: 'entrada', quantity: 10, reason: 'devolucion_cliente', reference: 'DEV-2024-001' },
    // Caño Cobre
    { product_id: products[5].id, type: 'entrada', quantity: 200, reason: 'compra',           reference: 'OC-2024-004' },
    { product_id: products[5].id, type: 'salida',  quantity: 45, reason: 'venta',             reference: 'FAC-2024-009' },
    { product_id: products[5].id, type: 'salida',  quantity: 30, reason: 'venta',             reference: 'FAC-2024-010' },
    // Kit Instalación
    { product_id: products[6].id, type: 'entrada', quantity: 60, reason: 'compra',            reference: 'OC-2024-004' },
    { product_id: products[6].id, type: 'salida',  quantity: 22, reason: 'venta',             reference: 'FAC-varios' },
    { product_id: products[6].id, type: 'ajuste_negativo', quantity: 2, reason: 'perdida',    reference: null },
  ];
  for (const m of movements) {
    await post('/stock/movements', m);
    process.stdout.write('.');
  }
  console.log(' ✓\n');

  // ── FACTURA GESDATTA DE EJEMPLO ────────────────────────────────────────────
  console.log('🧾 Simulando factura Gesdatta entrante...');
  await post('/gesdatta/invoice', {
    invoice_id: 'FAC-2024-DEMO',
    invoice_number: '0001-00000130',
    client_name: 'Valeria Moreno',
    client_email: 'vmoreno@instaplumber.com.ar',
    total: 156000,
    items: [
      { name: 'Radiador Panel 500W Urbano x4' },
      { name: 'Kit Instalación Radiador x4' },
    ],
  });
  console.log(' ✓\n');

  // ── RESUMEN ────────────────────────────────────────────────────────────────
  const stats = await get('/stats');
  console.log('═══════════════════════════════════════');
  console.log('✅ Demo cargada exitosamente');
  console.log('═══════════════════════════════════════');
  console.log(`👥 Contactos:   ${stats.totalContacts}`);
  console.log(`💼 Deals:       ${stats.totalDeals}`);
  console.log(`📦 Productos:   ${(await get('/products')).length}`);
  console.log(`💰 Valor total: $${stats.totalValue.toLocaleString('es-AR')}`);
  console.log(`✅ Vendido:     $${stats.soldValue.toLocaleString('es-AR')}`);
  console.log('═══════════════════════════════════════');
  console.log('\n🌐 Abrí http://localhost:3456\n');
}

seed().catch(console.error);
