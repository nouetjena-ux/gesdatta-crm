const API = 'http://localhost:3456/api';

// ─── STATE ────────────────────────────────────────────────────────────────────
let state = {
  stages: [],
  deals: [],
  contacts: [],
  products: [],
  currentView: 'pipeline',
  editingDealId: null,
  editingContactId: null,
  editingProductId: null,
  selectedProductId: null,
  dragDealId: null,
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
  setupSearch();
  setupButtons();
  setupModals();
  await loadAll();
});

async function loadAll() {
  await Promise.all([loadStages(), loadDeals(), loadContacts(), loadProducts()]);
  renderPipeline();
  renderContacts();
}

// ─── API HELPERS ──────────────────────────────────────────────────────────────
async function api(method, path, data) {
  try {
    const res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error');
    return json;
  } catch (e) {
    toast(e.message, 'error');
    throw e;
  }
}

async function loadStages() { state.stages = await api('GET', '/stages'); }
async function loadDeals() { state.deals = await api('GET', '/deals'); }
async function loadContacts() { state.contacts = await api('GET', '/contacts'); }
async function loadProducts() { state.products = await api('GET', '/products'); }

// ─── NAV ──────────────────────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
    });
  });
}

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === `view-${view}`));
  document.getElementById('viewTitle').textContent = { pipeline: 'Pipeline', contacts: 'Contactos', dashboard: 'Dashboard', inventory: 'Inventario' }[view] || view;

  // show/hide top bar buttons
  const isPipeline = view === 'pipeline';
  const isContacts = view === 'contacts';
  const isInventory = view === 'inventory';
  document.getElementById('btnAddDeal').style.display = isPipeline ? '' : 'none';
  document.getElementById('btnAddContact').style.display = isContacts ? '' : 'none';
  document.getElementById('btnAddProduct').style.display = isInventory ? '' : 'none';
  document.getElementById('btnAddMovement').style.display = isInventory ? '' : 'none';

  if (view === 'dashboard') renderDashboard();
  if (view === 'inventory') renderInventory();
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
function setupSearch() {
  let timer;
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => applySearch(e.target.value), 300);
  });
}

function applySearch(q) {
  const lq = q.toLowerCase();
  if (state.currentView === 'pipeline') {
    document.querySelectorAll('.deal-card').forEach(card => {
      const match = card.dataset.title.toLowerCase().includes(lq) || card.dataset.contact.toLowerCase().includes(lq);
      card.style.display = match ? '' : 'none';
    });
  } else if (state.currentView === 'contacts') {
    document.querySelectorAll('.contact-card').forEach(card => {
      const match = card.dataset.name.toLowerCase().includes(lq) || card.dataset.company.toLowerCase().includes(lq);
      card.style.display = match ? '' : 'none';
    });
  }
}

// ─── BUTTONS ──────────────────────────────────────────────────────────────────
function setupButtons() {
  document.getElementById('btnAddDeal').addEventListener('click', () => openDealModal());
  document.getElementById('btnAddContact').addEventListener('click', () => openContactModal());
  document.getElementById('btnAddProduct').addEventListener('click', () => openProductModal());
  document.getElementById('btnAddMovement').addEventListener('click', () => openMovementModal());
}

// ─── PIPELINE RENDER ──────────────────────────────────────────────────────────
function renderPipeline() {
  const board = document.getElementById('pipelineBoard');
  board.innerHTML = '';

  state.stages.forEach(stage => {
    const stageDeals = state.deals.filter(d => d.stage_id === stage.id);
    const totalValue = stageDeals.reduce((s, d) => s + (d.value || 0), 0);

    const col = document.createElement('div');
    col.className = 'stage-column';
    col.innerHTML = `
      <div class="stage-header">
        <div class="stage-name-wrap">
          <div class="stage-dot" style="background:${stage.color}"></div>
          <span class="stage-name">${stage.name}</span>
        </div>
        <div class="stage-meta">
          <span class="stage-count">${stageDeals.length}</span>
          ${totalValue > 0 ? `<span class="stage-value">${formatCurrency(totalValue)}</span>` : ''}
        </div>
      </div>
      <div class="stage-deals" data-stage-id="${stage.id}"></div>
      <button class="stage-add-btn" data-stage="${stage.id}">+ Agregar deal</button>
    `;

    const dealsContainer = col.querySelector('.stage-deals');

    if (stageDeals.length === 0) {
      dealsContainer.innerHTML = `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M12 8v8"/></svg>
        Sin deals
      </div>`;
    } else {
      stageDeals.forEach(deal => {
        dealsContainer.appendChild(createDealCard(deal));
      });
    }

    setupDragDrop(dealsContainer);

    col.querySelector('.stage-add-btn').addEventListener('click', () => openDealModal(null, stage.id));

    board.appendChild(col);
  });
}

function createDealCard(deal) {
  const card = document.createElement('div');
  card.className = 'deal-card';
  card.dataset.dealId = deal.id;
  card.dataset.title = deal.title;
  card.dataset.contact = deal.contact_name || '';
  card.draggable = true;

  const initials = deal.contact_name ? deal.contact_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '';

  card.innerHTML = `
    <div class="deal-card-top">
      <div class="deal-card-title">${deal.title}</div>
      ${deal.gesdatta_invoice_id ? '<div class="deal-gesdatta-badge">FACTURADO</div>' : ''}
    </div>
    ${deal.contact_name ? `
      <div class="deal-card-contact">
        <div class="contact-mini-avatar" style="background:${deal.contact_avatar_color || '#6366f1'}">${initials}</div>
        <span class="contact-mini-name">${deal.contact_name}${deal.contact_company ? ` · ${deal.contact_company}` : ''}</span>
      </div>
    ` : ''}
    <div class="deal-card-footer">
      <div class="deal-value ${!deal.value ? 'zero'}">${deal.value ? formatCurrency(deal.value, deal.currency) : 'Sin valor'}</div>
      ${deal.expected_close ? `<div class="deal-date">${formatDate(deal.expected_close)}</div>` : ''}
    </div>
  `;

  card.addEventListener('click', () => openDealModal(deal.id));

  card.addEventListener('dragstart', e => {
    state.dragDealId = deal.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    state.dragDealId = null;
    document.querySelectorAll('.stage-deals').forEach(el => el.classList.remove('drag-over'));
  });

  return card;
}

function setupDragDrop(container) {
  container.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    container.classList.add('drag-over');
  });

  container.addEventListener('dragleave', e => {
    if (!container.contains(e.relatedTarget)) container.classList.remove('drag-over');
  });

  container.addEventListener('drop', async e => {
    e.preventDefault();
    container.classList.remove('drag-over');
    const stageId = container.dataset.stageId;
    if (!state.dragDealId || !stageId) return;

    const deal = state.deals.find(d => d.id === state.dragDealId);
    if (!deal || deal.stage_id === stageId) return;

    try {
      await api('PATCH', `/deals/${state.dragDealId}/stage`, { stage_id: stageId });
      deal.stage_id = stageId;
      const stage = state.stages.find(s => s.id === stageId);
      deal.stage_name = stage?.name;
      deal.stage_color = stage?.color;
      renderPipeline();
      toast(`Movido a ${stage?.name}`, 'success');
    } catch {}
  });
}

// ─── CONTACTS RENDER ──────────────────────────────────────────────────────────
function renderContacts() {
  const grid = document.getElementById('contactsGrid');
  grid.innerHTML = '';

  if (state.contacts.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:60px 20px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      <span>No hay contactos. ¡Agregá el primero!</span>
    </div>`;
    return;
  }

  state.contacts.forEach(contact => {
    const initials = contact.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const contactDeals = state.deals.filter(d => d.contact_id === contact.id);
    const totalValue = contactDeals.reduce((s, d) => s + (d.value || 0), 0);

    const card = document.createElement('div');
    card.className = 'contact-card';
    card.dataset.name = contact.name;
    card.dataset.company = contact.company || '';
    card.innerHTML = `
      <div class="contact-card-header">
        <div class="contact-avatar" style="background:${contact.avatar_color}">${initials}</div>
        <div>
          <div class="contact-info-name">${contact.name}</div>
          ${contact.company ? `<div class="contact-info-company">${contact.company}</div>` : ''}
        </div>
      </div>
      <div class="contact-details">
        ${contact.email ? `<div class="contact-detail-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>${contact.email}</div>` : ''}
        ${contact.phone ? `<div class="contact-detail-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.55 5.55l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>${contact.phone}</div>` : ''}
      </div>
      <div class="contact-card-footer">
        <span class="contact-deals-count">${contactDeals.length} deal${contactDeals.length !== 1 ? 's' : ''}</span>
        ${totalValue > 0 ? `<span class="contact-deals-value">${formatCurrency(totalValue)}</span>` : ''}
      </div>
    `;
    card.addEventListener('click', () => openContactModal(contact.id));
    grid.appendChild(card);
  });
}

// ─── DASHBOARD RENDER ─────────────────────────────────────────────────────────
async function renderDashboard() {
  const grid = document.getElementById('dashboardGrid');
  grid.innerHTML = '<div style="grid-column:1/-1;color:var(--text3);padding:20px">Cargando...</div>';

  const stats = await api('GET', '/stats');

  const maxDeals = Math.max(...stats.dealsByStage.map(s => s.deal_count), 1);

  grid.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Deals Activos</div>
      <div class="stat-value">${stats.totalDeals}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Valor Total</div>
      <div class="stat-value" style="font-size:20px">${formatCurrency(stats.totalValue)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Vendidos</div>
      <div class="stat-value" style="color:var(--success)">${stats.soldDeals}</div>
      <div class="stat-sub">${formatCurrency(stats.soldValue)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Contactos</div>
      <div class="stat-value">${stats.totalContacts}</div>
    </div>

    <div class="dashboard-panel">
      <div class="panel-title">Deals por Etapa</div>
      ${stats.dealsByStage.map(s => `
        <div class="stage-bar-row">
          <div class="stage-bar-name">${s.name}</div>
          <div class="stage-bar-track">
            <div class="stage-bar-fill" style="width:${(s.deal_count/maxDeals)*100}%;background:${s.color}"></div>
          </div>
          <div class="stage-bar-count">${s.deal_count}</div>
        </div>
      `).join('')}
    </div>

    <div class="dashboard-panel">
      <div class="panel-title">Actividad Reciente</div>
      <div class="activity-feed">
        ${stats.recentActivities.length === 0 ? '<div class="empty-state">Sin actividad</div>' : ''}
        ${stats.recentActivities.map(a => `
          <div class="activity-item ${a.type}">
            <div class="activity-dot"></div>
            <div>
              <div class="activity-desc">${a.description}</div>
              <div class="activity-time">${formatDateTime(a.created_at)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ─── DEAL MODAL ───────────────────────────────────────────────────────────────
async function openDealModal(dealId = null, presetStageId = null) {
  state.editingDealId = dealId;
  const modal = document.getElementById('dealModal');
  const title = document.getElementById('dealModalTitle');
  const btnDelete = document.getElementById('btnDeleteDeal');

  // Populate stage select
  const stageSelect = document.getElementById('dealStage');
  stageSelect.innerHTML = state.stages.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  // Populate contact select
  const contactSelect = document.getElementById('dealContact');
  contactSelect.innerHTML = '<option value="">— Sin contacto —</option>' +
    state.contacts.map(c => `<option value="${c.id}">${c.name}${c.company ? ` (${c.company})` : ''}</option>`).join('');

  if (dealId) {
    title.textContent = 'Editar Deal';
    btnDelete.style.display = '';
    const deal = await api('GET', `/deals/${dealId}`);
    document.getElementById('dealTitle').value = deal.title;
    document.getElementById('dealValue').value = deal.value || '';
    document.getElementById('dealCurrency').value = deal.currency || 'ARS';
    document.getElementById('dealStage').value = deal.stage_id;
    document.getElementById('dealContact').value = deal.contact_id || '';
    document.getElementById('dealClose').value = deal.expected_close || '';
    document.getElementById('dealNotes').value = deal.notes || '';
    document.getElementById('dealGesdattaId').value = deal.gesdatta_invoice_id || '';
    document.getElementById('dealGesdattaNum').value = deal.gesdatta_invoice_number || '';

    // Render activities
    renderActivityList(deal.activities || []);
  } else {
    title.textContent = 'Nuevo Deal';
    btnDelete.style.display = 'none';
    document.getElementById('dealTitle').value = '';
    document.getElementById('dealValue').value = '';
    document.getElementById('dealCurrency').value = 'ARS';
    document.getElementById('dealStage').value = presetStageId || state.stages[0]?.id || '';
    document.getElementById('dealContact').value = '';
    document.getElementById('dealClose').value = '';
    document.getElementById('dealNotes').value = '';
    document.getElementById('dealGesdattaId').value = '';
    document.getElementById('dealGesdattaNum').value = '';
    document.getElementById('activityList').innerHTML = '';
  }

  modal.classList.add('open');
  document.getElementById('dealTitle').focus();
}

function renderActivityList(activities) {
  const list = document.getElementById('activityList');
  if (!activities.length) {
    list.innerHTML = '<div class="empty-state" style="padding:16px 0">Sin actividad aún</div>';
    return;
  }
  list.innerHTML = activities.map(a => `
    <div class="activity-entry ${a.type}">
      <div class="activity-entry-type">${activityTypeLabel(a.type)}</div>
      <div class="activity-entry-desc">${a.description}</div>
      <div class="activity-entry-time">${formatDateTime(a.created_at)}</div>
    </div>
  `).join('');
}

function activityTypeLabel(type) {
  const map = {
    deal_created: 'Deal creado',
    stage_changed: 'Etapa cambiada',
    invoice_created: 'Factura Gesdatta',
    note: 'Nota',
    call: 'Llamada',
    email: 'Email',
    meeting: 'Reunión',
  };
  return map[type] || type;
}

function setupModals() {
  // Close deal modal
  document.getElementById('closeDealModal').addEventListener('click', closeDealModal);
  document.getElementById('cancelDealModal').addEventListener('click', closeDealModal);
  document.getElementById('dealModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeDealModal(); });

  // Save deal
  document.getElementById('saveDeal').addEventListener('click', saveDeal);

  // Delete deal
  document.getElementById('btnDeleteDeal').addEventListener('click', async () => {
    if (!confirm('¿Eliminar este deal?')) return;
    await api('DELETE', `/deals/${state.editingDealId}`);
    state.deals = state.deals.filter(d => d.id !== state.editingDealId);
    closeDealModal();
    renderPipeline();
    toast('Deal eliminado');
  });

  // Add activity
  document.getElementById('btnAddActivity').addEventListener('click', async () => {
    const desc = document.getElementById('activityInput').value.trim();
    if (!desc || !state.editingDealId) return;
    const act = await api('POST', '/activities', { deal_id: state.editingDealId, type: 'note', description: desc });
    document.getElementById('activityInput').value = '';
    const deal = await api('GET', `/deals/${state.editingDealId}`);
    renderActivityList(deal.activities || []);
    toast('Actividad agregada', 'success');
  });

  // Product modal
  document.getElementById('closeProductModal').addEventListener('click', () => document.getElementById('productModal').classList.remove('open'));
  document.getElementById('cancelProductModal').addEventListener('click', () => document.getElementById('productModal').classList.remove('open'));
  document.getElementById('productModal').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('productModal').classList.remove('open'); });
  document.getElementById('saveProduct').addEventListener('click', saveProduct);
  document.getElementById('btnDeleteProduct').addEventListener('click', async () => {
    if (!confirm('¿Eliminar este producto y todos sus movimientos?')) return;
    await api('DELETE', `/products/${state.editingProductId}`);
    document.getElementById('productModal').classList.remove('open');
    state.editingProductId = null;
    if (state.selectedProductId === state.editingProductId) state.selectedProductId = null;
    await loadProducts();
    renderInventory();
    toast('Producto eliminado');
  });

  // Movement modal
  document.getElementById('closeMovementModal').addEventListener('click', () => document.getElementById('movementModal').classList.remove('open'));
  document.getElementById('cancelMovementModal').addEventListener('click', () => document.getElementById('movementModal').classList.remove('open'));
  document.getElementById('movementModal').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('movementModal').classList.remove('open'); });
  document.getElementById('saveMovement').addEventListener('click', saveMovement);

  document.querySelectorAll('.mov-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      document.getElementById('movType').value = type;
      document.querySelectorAll('.mov-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
      updateMovReasons(type);
    });
  });

  document.getElementById('movProduct').addEventListener('change', updateMovStockInfo);

  // Close contact modal
  document.getElementById('closeContactModal').addEventListener('click', closeContactModal);
  document.getElementById('cancelContactModal').addEventListener('click', closeContactModal);
  document.getElementById('contactModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeContactModal(); });

  // Save contact
  document.getElementById('saveContact').addEventListener('click', saveContact);

  // Delete contact
  document.getElementById('btnDeleteContact').addEventListener('click', async () => {
    if (!confirm('¿Eliminar este contacto?')) return;
    await api('DELETE', `/contacts/${state.editingContactId}`);
    state.contacts = state.contacts.filter(c => c.id !== state.editingContactId);
    closeContactModal();
    renderContacts();
    toast('Contacto eliminado');
  });
}

async function saveDeal() {
  const title = document.getElementById('dealTitle').value.trim();
  if (!title) { toast('El título es requerido', 'error'); return; }

  const data = {
    title,
    value: parseFloat(document.getElementById('dealValue').value) || 0,
    currency: document.getElementById('dealCurrency').value,
    stage_id: document.getElementById('dealStage').value,
    contact_id: document.getElementById('dealContact').value || null,
    expected_close: document.getElementById('dealClose').value || null,
    notes: document.getElementById('dealNotes').value.trim() || null,
    gesdatta_invoice_id: document.getElementById('dealGesdattaId').value.trim() || null,
    gesdatta_invoice_number: document.getElementById('dealGesdattaNum').value.trim() || null,
  };

  if (state.editingDealId) {
    const updated = await api('PUT', `/deals/${state.editingDealId}`, data);
    const idx = state.deals.findIndex(d => d.id === state.editingDealId);
    if (idx !== -1) state.deals[idx] = { ...state.deals[idx], ...updated };
    toast('Deal actualizado', 'success');
  } else {
    const created = await api('POST', '/deals', data);
    state.deals.unshift(created);
    toast('Deal creado', 'success');
  }

  closeDealModal();
  renderPipeline();
  renderContacts();
}

function closeDealModal() {
  document.getElementById('dealModal').classList.remove('open');
  state.editingDealId = null;
}

// ─── CONTACT MODAL ────────────────────────────────────────────────────────────
async function openContactModal(contactId = null) {
  state.editingContactId = contactId;
  const modal = document.getElementById('contactModal');
  const btnDelete = document.getElementById('btnDeleteContact');

  if (contactId) {
    document.getElementById('contactModalTitle').textContent = 'Editar Contacto';
    btnDelete.style.display = '';
    const contact = await api('GET', `/contacts/${contactId}`);
    document.getElementById('contactName').value = contact.name;
    document.getElementById('contactEmail').value = contact.email || '';
    document.getElementById('contactPhone').value = contact.phone || '';
    document.getElementById('contactCompany').value = contact.company || '';
  } else {
    document.getElementById('contactModalTitle').textContent = 'Nuevo Contacto';
    btnDelete.style.display = 'none';
    document.getElementById('contactName').value = '';
    document.getElementById('contactEmail').value = '';
    document.getElementById('contactPhone').value = '';
    document.getElementById('contactCompany').value = '';
  }

  modal.classList.add('open');
  document.getElementById('contactName').focus();
}

async function saveContact() {
  const name = document.getElementById('contactName').value.trim();
  if (!name) { toast('El nombre es requerido', 'error'); return; }

  const data = {
    name,
    email: document.getElementById('contactEmail').value.trim() || null,
    phone: document.getElementById('contactPhone').value.trim() || null,
    company: document.getElementById('contactCompany').value.trim() || null,
  };

  if (state.editingContactId) {
    const updated = await api('PUT', `/contacts/${state.editingContactId}`, data);
    const idx = state.contacts.findIndex(c => c.id === state.editingContactId);
    if (idx !== -1) state.contacts[idx] = updated;
    toast('Contacto actualizado', 'success');
  } else {
    const created = await api('POST', '/contacts', data);
    state.contacts.unshift(created);
    toast('Contacto creado', 'success');
  }

  closeContactModal();
  renderContacts();

  // Refresh deal contact selects
  if (document.getElementById('dealModal').classList.contains('open')) {
    const contactSelect = document.getElementById('dealContact');
    contactSelect.innerHTML = '<option value="">— Sin contacto —</option>' +
      state.contacts.map(c => `<option value="${c.id}">${c.name}${c.company ? ` (${c.company})` : ''}</option>`).join('');
  }
}

function closeContactModal() {
  document.getElementById('contactModal').classList.remove('open');
  state.editingContactId = null;
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────

async function renderInventory() {
  const layout = document.getElementById('inventoryLayout');
  await loadProducts();

  layout.innerHTML = `
    <div class="products-panel">
      <div class="products-panel-header">
        <h2>Productos (${state.products.length})</h2>
      </div>
      <div class="products-list" id="productsList"></div>
    </div>
    <div class="movements-panel">
      <div class="movements-panel-header">
        <h2 id="movPanelTitle">Últimos movimientos</h2>
        <div class="movements-panel-subtitle" id="movPanelSubtitle">Todos los productos</div>
      </div>
      <div class="movements-list" id="movementsList"></div>
    </div>
  `;

  renderProductsList();
  await renderMovementsList();
}

function renderProductsList() {
  const container = document.getElementById('productsList');
  if (!container) return;

  if (state.products.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:40px 16px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
      <span>No hay productos. ¡Agregá el primero!</span>
    </div>`;
    return;
  }

  container.innerHTML = state.products.map(p => {
    const stock = p.stock_actual || 0;
    const stockClass = stock === 0 ? 'zero' : stock <= (p.stock_minimo || 0) ? 'low' : 'ok';
    const isSelected = p.id === state.selectedProductId;
    return `
      <div class="product-row ${isSelected ? 'selected' : ''}" data-product-id="${p.id}">
        <div class="product-row-icon">📦</div>
        <div class="product-row-info">
          <div class="product-row-name">${p.name}</div>
          <div class="product-row-sku">${p.sku || 'Sin SKU'}</div>
        </div>
        <div class="product-row-stock">
          <div class="stock-number ${stockClass}">${stock}</div>
          <div class="stock-unit">${p.unit || 'unid.'}</div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.product-row').forEach(row => {
    row.addEventListener('click', async () => {
      const productId = row.dataset.productId;
      if (state.selectedProductId === productId) {
        // doble click → editar
        openProductModal(productId);
        return;
      }
      state.selectedProductId = productId;
      renderProductsList();
      const p = state.products.find(p => p.id === productId);
      document.getElementById('movPanelTitle').textContent = p?.name || 'Movimientos';
      document.getElementById('movPanelSubtitle').textContent = `Stock actual: ${p?.stock_actual || 0} ${p?.unit || 'unid.'}`;
      await renderMovementsList(productId);
    });

    row.addEventListener('dblclick', () => openProductModal(row.dataset.productId));
  });
}

async function renderMovementsList(productId = null) {
  const container = document.getElementById('movementsList');
  if (!container) return;

  const url = productId ? `/stock/movements?product_id=${productId}` : '/stock/movements';
  const movements = await api('GET', url);

  if (movements.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:40px 16px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
      <span>Sin movimientos aún</span>
    </div>`;
    return;
  }

  const reasonLabels = {
    compra: 'Compra', devolucion_cliente: 'Dev. cliente', ajuste_positivo: 'Ajuste +',
    venta: 'Venta', devolucion_proveedor: 'Dev. proveedor', ajuste_negativo: 'Ajuste -',
    perdida: 'Pérdida/Rotura', otro: 'Otro',
  };

  container.innerHTML = movements.map(m => `
    <div class="movement-item">
      <div class="movement-icon ${m.type}">
        ${m.type === 'entrada'
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'}
      </div>
      <div class="movement-info">
        <div class="movement-product">${m.product_name || 'Producto'}</div>
        <div class="movement-detail">
          ${reasonLabels[m.reason] || m.reason || m.type}
          ${m.reference ? ` · ${m.reference}` : ''}
          · ${formatDateTime(m.created_at)}
        </div>
      </div>
      <div class="movement-qty ${m.type}">${m.type === 'entrada' ? '+' : '-'}${m.quantity}</div>
    </div>
  `).join('');
}

// ─── PRODUCT MODAL ────────────────────────────────────────────────────────────

async function openProductModal(productId = null) {
  state.editingProductId = productId;
  const modal = document.getElementById('productModal');
  const btnDelete = document.getElementById('btnDeleteProduct');

  if (productId) {
    document.getElementById('productModalTitle').textContent = 'Editar Producto';
    btnDelete.style.display = '';
    const p = await api('GET', `/products/${productId}`);
    document.getElementById('productName').value = p.name;
    document.getElementById('productSku').value = p.sku || '';
    document.getElementById('productUnit').value = p.unit || 'unidad';
    document.getElementById('productPrice').value = p.price || '';
    document.getElementById('productStockMin').value = p.stock_minimo || 0;
    document.getElementById('productDescription').value = p.description || '';
  } else {
    document.getElementById('productModalTitle').textContent = 'Nuevo Producto';
    btnDelete.style.display = 'none';
    document.getElementById('productName').value = '';
    document.getElementById('productSku').value = '';
    document.getElementById('productUnit').value = 'unidad';
    document.getElementById('productPrice').value = '';
    document.getElementById('productStockMin').value = '0';
    document.getElementById('productDescription').value = '';
  }

  modal.classList.add('open');
  document.getElementById('productName').focus();
}

async function saveProduct() {
  const name = document.getElementById('productName').value.trim();
  if (!name) { toast('El nombre es requerido', 'error'); return; }

  const data = {
    name,
    sku: document.getElementById('productSku').value.trim() || null,
    unit: document.getElementById('productUnit').value,
    price: parseFloat(document.getElementById('productPrice').value) || 0,
    stock_minimo: parseInt(document.getElementById('productStockMin').value) || 0,
    description: document.getElementById('productDescription').value.trim() || null,
  };

  if (state.editingProductId) {
    await api('PUT', `/products/${state.editingProductId}`, data);
    toast('Producto actualizado', 'success');
  } else {
    await api('POST', '/products', data);
    toast('Producto creado', 'success');
  }

  document.getElementById('productModal').classList.remove('open');
  state.editingProductId = null;
  await loadProducts();
  renderProductsList();
}

// ─── MOVEMENT MODAL ───────────────────────────────────────────────────────────

function openMovementModal(presetProductId = null) {
  const modal = document.getElementById('movementModal');

  // Populate product select
  const sel = document.getElementById('movProduct');
  sel.innerHTML = '<option value="">— Seleccionar producto —</option>' +
    state.products.map(p => `<option value="${p.id}" data-stock="${p.stock_actual || 0}" data-unit="${p.unit || 'unid.'}">${p.name}${p.sku ? ` (${p.sku})` : ''} — Stock: ${p.stock_actual || 0}</option>`).join('');

  if (presetProductId || state.selectedProductId) {
    sel.value = presetProductId || state.selectedProductId;
    updateMovStockInfo();
  }

  document.getElementById('movQuantity').value = '';
  document.getElementById('movReference').value = '';
  document.getElementById('movReason').value = '';

  // Reset type to entrada
  document.getElementById('movType').value = 'entrada';
  document.querySelectorAll('.mov-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'entrada'));
  updateMovReasons('entrada');

  modal.classList.add('open');
}

function updateMovStockInfo() {
  const sel = document.getElementById('movProduct');
  const opt = sel.options[sel.selectedIndex];
  const info = document.getElementById('movStockInfo');
  if (opt && opt.value) {
    document.getElementById('movStockActual').textContent = `${opt.dataset.stock} ${opt.dataset.unit}`;
    info.style.display = '';
  } else {
    info.style.display = 'none';
  }
}

function updateMovReasons(type) {
  const sel = document.getElementById('movReason');
  const entradaOptions = ['', 'compra', 'devolucion_cliente', 'ajuste_positivo', 'otro'];
  const salidaOptions = ['', 'venta', 'devolucion_proveedor', 'ajuste_negativo', 'perdida', 'otro'];
  const labels = {
    '': '— Sin motivo —', compra: 'Compra a proveedor', devolucion_cliente: 'Devolución de cliente',
    ajuste_positivo: 'Ajuste de inventario (+)', venta: 'Venta', devolucion_proveedor: 'Devolución a proveedor',
    ajuste_negativo: 'Ajuste de inventario (-)', perdida: 'Pérdida / Rotura', otro: 'Otro',
  };
  const opts = type === 'entrada' ? entradaOptions : salidaOptions;
  sel.innerHTML = opts.map(v => `<option value="${v}">${labels[v]}</option>`).join('');
}

async function saveMovement() {
  const product_id = document.getElementById('movProduct').value;
  const type = document.getElementById('movType').value;
  const quantity = parseFloat(document.getElementById('movQuantity').value);
  const reason = document.getElementById('movReason').value || null;
  const reference = document.getElementById('movReference').value.trim() || null;

  if (!product_id) { toast('Seleccioná un producto', 'error'); return; }
  if (!quantity || quantity <= 0) { toast('La cantidad debe ser mayor a 0', 'error'); return; }

  await api('POST', '/stock/movements', { product_id, type, quantity, reason, reference });
  toast(`${type === 'entrada' ? 'Entrada' : 'Salida'} registrada`, 'success');

  document.getElementById('movementModal').classList.remove('open');
  await loadProducts();
  renderProductsList();
  await renderMovementsList(state.selectedProductId);

  // Actualizar stock info en header si hay producto seleccionado
  if (state.selectedProductId) {
    const p = state.products.find(p => p.id === state.selectedProductId);
    if (p) document.getElementById('movPanelSubtitle').textContent = `Stock actual: ${p.stock_actual || 0} ${p.unit || 'unid.'}`;
  }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function formatCurrency(value, currency = 'ARS') {
  const num = parseFloat(value) || 0;
  if (currency === 'USD') return `U$D ${num.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  return `$${num.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T') + 'Z');
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function toast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}
