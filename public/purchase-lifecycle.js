// Purchases are commercial records until Goods Inwards records physical arrival.
// This page makes that boundary visible without treating an order as stock.
const lifecycleEscape = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));

function lifecycleReceiptFor(purchase) {
  return (data.goodsInwards || []).find((receipt) => receipt.purchaseId === purchase.id);
}

function lifecycleFor(purchase) {
  const receipt = lifecycleReceiptFor(purchase);
  if (purchase.status === 'Quote') return { label: 'Quote', detail: 'Supplier quote recorded; awaiting selection', tone: 'quote', receipt };
  if (receipt?.decision === 'Rejected' || purchase.status === 'Rejected') {
    return { label: 'Rejected', detail: 'Not collected; no warehouse stock', tone: 'rejected', receipt };
  }
  if (receipt?.warehouseId || purchase.warehouseId || purchase.status === 'Moved to warehouse') {
    return { label: 'Moved to warehouse', detail: receipt?.warehouseId ? 'Warehouse movement recorded' : 'Warehouse assignment required', tone: 'stored', receipt };
  }
  if (receipt?.arrivedAt || (receipt?.decision && receipt.decision !== 'Assess') || purchase.status === 'Arrived at factory' || purchase.status === 'Arrived' || purchase.status === 'Received') {
    return { label: 'Arrived at factory', detail: 'Awaiting QC / warehouse assignment', tone: 'arrived', receipt };
  }
  if (purchase.status === 'QC inspection') return { label: 'QC inspection', detail: 'Inspection is in progress at supplier site', tone: 'inspection', receipt };
  if (purchase.status === 'QC accepted') return { label: 'QC accepted', detail: 'Approved for collection and loading', tone: 'accepted', receipt };
  if (purchase.status === 'In transit') return { label: 'In transit', detail: 'Supplier load is on the way', tone: 'transit', receipt };
  if (purchase.status === 'Delivered') return { label: 'Delivered', detail: 'Delivered and awaiting warehouse assignment', tone: 'arrived', receipt };
  return { label: 'Ordered', detail: 'Awaiting supplier dispatch', tone: 'ordered', receipt };
}

function lifecycleWarehouse(lifecycle, purchase) {
  const receipt = lifecycle.receipt;
  if (lifecycle.label === 'Rejected') return '<span class="purchase-muted">No stock created</span>';
  const warehouseId = receipt?.warehouseId || purchase?.warehouseId;
  if (!warehouseId) return '<span class="purchase-muted">Not assigned</span>';
  const warehouse = (data.warehouses || []).find((entry) => entry.id === warehouseId);
  const name = warehouse?.name || receipt?.warehouseName || purchase?.warehouseName || 'Assigned warehouse';
  const location = warehouse?.location ? ` · ${warehouse.location}` : '';
  const movedAt = receipt?.warehouseAssignedDate || purchase?.warehouseAssignedDate;
  const moved = movedAt ? `<div class="item-note">Assigned ${date(movedAt)}</div>` : '';
  return `<strong>${lifecycleEscape(name)}</strong>${lifecycleEscape(location)}${moved}`;
}

function purchaseQcStage(purchase) {
  const receipt = lifecycleReceiptFor(purchase);
  if (!receipt) return 'Pending';
  if (receipt.decision === 'Accepted') return 'Passed';
  if (receipt.decision === 'Rejected') return 'Rejected';
  return 'In progress';
}

function purchaseQcSelect(purchase) {
  const stage = purchaseQcStage(purchase);
  const tone = { Pending: 'pending', 'In progress': 'hold', Passed: 'ok', Rejected: 'reject' }[stage];
  return `<span class="badge ${tone}">${stage}</span><div class="item-note">Goods-inwards QC</div>`;
}

function purchaseLogisticsStage(purchase) {
  if (purchase.status === 'Quote') return 'Quote';
  if (purchase.status === 'In transit') return 'In transit';
  if (purchase.status === 'Delivered' || purchase.status === 'Arrived at factory' || purchase.status === 'Moved to warehouse') return 'Delivered';
  return 'Ordered';
}

function purchaseLogisticsSelect(purchase) {
  const stage = purchaseLogisticsStage(purchase);
  return `<select class="purchase-logistics-select" data-purchase-id="${purchase.id}" aria-label="Logistics status for ${lifecycleEscape(purchase.purchaseId || purchase.item)}">${['Quote','Ordered','In transit','Delivered'].map((option) => `<option ${option === stage ? 'selected' : ''}>${option}</option>`).join('')}</select>`;
}

function purchaseLifecycleRows() {
  const search = $('#purchase-search')?.value?.toLowerCase() || '';
  const category = $('#purchase-filter')?.value || 'all';
  const status = $('#purchase-status-filter')?.value || 'all';
  const receipt = $('#purchase-receipt-filter')?.value || 'all';
  const qc = $('#purchase-qc-filter')?.value || 'all';
  const warehouse = $('#purchase-warehouse-filter')?.value || 'all';
  const supplier = $('#purchase-supplier-filter')?.value || 'all';
  const item = $('#purchase-item-filter')?.value || 'all';
  const from = $('#purchase-date-from')?.value || '';
  const to = $('#purchase-date-to')?.value || '';
  return data.purchases.filter((purchase) =>
    (category === 'all' || purchase.category === category)
    && (status === 'all' || lifecycleFor(purchase).label === status)
    && (receipt === 'all' || Boolean(lifecycleReceiptFor(purchase)))
    && (qc === 'all' || purchaseQcStage(purchase) === qc)
    && (warehouse === 'all' || String(lifecycleFor(purchase).receipt?.warehouseId || purchase.warehouseId || '') === warehouse)
    && (supplier === 'all' || purchase.supplier === supplier)
    && (item === 'all' || purchase.item === item)
    && (!from || String(purchase.date) >= from)
    && (!to || String(purchase.date) <= to)
    && `${purchase.purchaseId || ''} ${purchase.item} ${purchase.supplier}`.toLowerCase().includes(search),
  );
}

function purchaseFilterOptions(values, label) {
  return `<option value="all">All ${label}</option>${values.filter(Boolean).map(value => ({ value: typeof value === 'object' ? value.value : value, label: typeof value === 'object' ? value.label : value })).filter((entry, index, entries) => entry.value && entries.findIndex(candidate => String(candidate.value) === String(entry.value)) === index).sort((left, right) => String(left.label).localeCompare(String(right.label))).map(entry => `<option value="${lifecycleEscape(entry.value)}">${lifecycleEscape(entry.label)}</option>`).join('')}`;
}

function ensurePurchaseFilters() {
  const base = $('#purchase-filter')?.closest('.filters');
  if (!base) return;
  let advanced = $('#purchase-advanced-filters');
  if (!advanced) {
    advanced = document.createElement('div');
    advanced.className = 'filters purchase-advanced-filters';
    advanced.id = 'purchase-advanced-filters';
    base.insertAdjacentElement('afterend', advanced);
  }
  const selected = Object.fromEntries([...advanced.querySelectorAll('select,input')].map(input => [input.id, input.value]));
  advanced.innerHTML = `<select id="purchase-receipt-filter" aria-label="Filter by receipt status"><option value="all">All purchased</option><option value="received">Received</option></select><select id="purchase-qc-filter" aria-label="Filter by QC"><option value="all">All QC results</option><option>Pending</option><option>In progress</option><option>Passed</option><option>Rejected</option></select><select id="purchase-warehouse-filter" aria-label="Filter by warehouse">${purchaseFilterOptions((data.warehouses || []).map(warehouse => ({ value: warehouse.id, label: warehouse.name })), 'warehouses')}</select><select id="purchase-supplier-filter" aria-label="Filter by supplier">${purchaseFilterOptions(data.purchases.map(purchase => purchase.supplier), 'suppliers')}</select><select id="purchase-item-filter" aria-label="Filter by item">${purchaseFilterOptions(data.purchases.map(purchase => purchase.item), 'items')}</select><label class="purchase-date-filter">From <input id="purchase-date-from" type="date" aria-label="Purchases from date"></label><label class="purchase-date-filter">To <input id="purchase-date-to" type="date" aria-label="Purchases to date"></label><button type="button" class="secondary purchase-clear-filters" id="purchase-clear-filters">Clear filters</button>`;
  Object.entries(selected).forEach(([id, value]) => { const input = advanced.querySelector(`#${id}`); if (input) input.value = value; });
  advanced.querySelectorAll('select,input').forEach(input => input.addEventListener('change', renderPurchaseLifecycle));
  $('#purchase-clear-filters').onclick = () => { advanced.querySelectorAll('select').forEach(select => { select.value = 'all'; }); advanced.querySelectorAll('input').forEach(input => { input.value = ''; }); $('#purchase-filter').value = 'all'; $('#purchase-status-filter').value = 'all'; $('#purchase-search').value = ''; renderPurchaseLifecycle(); };
}

function renderPurchaseLifecycle() {
  ensurePurchaseFilters();
  const statusFilter = $('#purchase-status-filter');
  if (statusFilter && ![...statusFilter.options].some((option) => option.value === 'Quote')) statusFilter.insertAdjacentHTML('afterbegin', '<option>Quote</option>');
  const table = $('#purchases-table')?.closest('table');
  if (!table) return;
  table.querySelector('thead').innerHTML = '<tr><th>Date</th><th>Ordered at</th><th>Purchase / item</th><th>Supplier</th><th>Quantity</th><th>Logistics status</th><th>Warehouse</th><th>QC</th><th>Total</th><th></th></tr>';
  const rows = purchaseLifecycleRows();
  $('#purchases-table').innerHTML = rows.map((purchase) => {
    const lifecycle = lifecycleFor(purchase);
    return `<tr>
      <td>${date(purchase.date)}</td>
      <td>${purchase.createdAt ? new Date(purchase.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '<span class="purchase-muted">Not recorded</span>'}</td>
      <td><strong>${lifecycleEscape(purchase.item)}</strong><div class="item-note">${lifecycleEscape(purchase.purchaseId || `Purchase ${purchase.id}`)}${purchase.lotNo ? ` · Lot: ${lifecycleEscape(purchase.lotNo)}` : ''}</div></td>
      <td>${lifecycleEscape(purchase.supplier)}</td>
      <td>${Number(purchase.qty || 0).toLocaleString()} ${lifecycleEscape(purchase.unit)}</td>
      <td>${purchaseLogisticsSelect(purchase)}<div class="item-note">${lifecycle.detail}</div></td>
      <td>${lifecycleWarehouse(lifecycle, purchase)}</td>
      <td>${purchaseQcSelect(purchase)}</td>
      <td><strong>${money(purchase.cost)}</strong></td>
      <td>${!purchase.stockReceived&&!['Quote','Rejected'].includes(lifecycle.label)?`<button class="text-btn receive-purchase" data-purchase-id="${purchase.id}">Receive goods</button> `:''}${editButton('purchase', purchase.id)}${canDeleteRecords?.()?` <button class="text-btn delete-purchase-direct" data-purchase-id="${purchase.id}">Delete</button>`:''}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="10">No purchases match your search.</td></tr>';
}

const lifecycleRender = render;
render = () => {
  lifecycleRender();
  renderPurchaseLifecycle();
};

const lifecycleStyle = document.createElement('style');
lifecycleStyle.textContent = '.purchase-lifecycle{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}.purchase-lifecycle-quote{background:#edf0f3;color:#4c5a68}.purchase-lifecycle-ordered{background:#f1eee8;color:#5d5445}.purchase-lifecycle-inspection{background:#fff3d8;color:#815b16}.purchase-lifecycle-accepted{background:#e9f2db;color:#476e32}.purchase-lifecycle-transit{background:#e7f0fb;color:#245981}.purchase-lifecycle-arrived{background:#e7f4eb;color:#277143}.purchase-lifecycle-stored{background:#dfeee4;color:#1f653a}.purchase-lifecycle-rejected{background:#fbe8e6;color:#983329}.purchase-muted{color:#887c68;font-size:13px}.purchase-qc-select,.purchase-logistics-select{min-width:116px;padding:6px 28px 6px 8px;border:1px solid #d5d6ca;border-radius:3px;background:#fff;color:#41443b;font-size:11px;font-weight:600;cursor:pointer}.purchase-qc-select:focus,.purchase-logistics-select:focus{outline:2px solid #c89b3c;outline-offset:2px}';
document.head.append(lifecycleStyle);

function closeLifecycleDialog(overlay, focusTarget) {
  overlay.remove();
  focusTarget?.focus();
}

function openQcChangeDialog(purchase, select, nextStage) {
  const quality = purchase.purchaseQuality || {};
  const current = purchaseQcStage(purchase);
  const nextStatus = { Pending: 'Pending', 'In progress': 'Inspection in progress', Passed: 'Accepted', Rejected: 'Rejected' }[nextStage];
  const overlay = document.createElement('div');
  overlay.className = 'qc-status-change';
  overlay.innerHTML = `<section class="qc-status-change-card" role="dialog" aria-modal="true" aria-labelledby="purchase-qc-change-title"><p class="eyebrow">FIELD QC AUDIT</p><h3 id="purchase-qc-change-title">Record QC status change</h3><p class="item-note">${lifecycleEscape(current)} → <strong>${lifecycleEscape(nextStage)}</strong>. Explain why the on-site QC status changed.</p><div class="form-grid"><div class="field"><label>Date and time</label><input class="qc-change-date" type="datetime-local" value="${localDateTimeValue()}" required></div><div class="field full"><label>Reason for change</label><textarea class="qc-change-reason" required placeholder="Explain the inspection result or reason for the status change"></textarea></div></div><div class="qc-status-change-actions"><button type="button" class="secondary qc-change-cancel">Cancel</button><button type="button" class="primary qc-change-save">Record change</button></div></section>`;
  document.body.append(overlay);
  const reason = overlay.querySelector('.qc-change-reason');
  overlay.querySelector('.qc-change-cancel').onclick = () => { select.value = current; closeLifecycleDialog(overlay, select); };
  overlay.querySelector('.qc-change-save').onclick = () => {
    const changedAt = overlay.querySelector('.qc-change-date').value;
    const reasonText = reason.value.trim();
    if (!changedAt || !reasonText) { reason.reportValidity(); return; }
    const history = Array.isArray(quality.statusHistory) ? quality.statusHistory : [];
    quality.statusHistory = [...history, { from: quality.status || 'Pending', to: nextStatus, changedAt, reason: reasonText, changedBy: currentOperator?.()?.name || 'Current user' }];
    quality.status = nextStatus;
    quality.decision = nextStatus === 'Accepted' ? 'Accepted' : nextStatus === 'Rejected' ? 'Rejected' : 'Assess';
    purchase.purchaseQuality = quality;
    purchase.qualityStatus = quality.decision;
    const stage = stageForFieldQcStatus(nextStatus);
    if (stage) purchase.status = stage;
    save(); render(); closeLifecycleDialog(overlay);
  };
  reason.focus();
}

function openWarehouseAssignmentDialog(purchase, select) {
  const warehouses = data.warehouses || [];
  if (!warehouses.length) { alert('Add a warehouse before marking this purchase as delivered.'); select.value = purchaseLogisticsStage(purchase); return; }
  const overlay = document.createElement('div');
  overlay.className = 'qc-status-change';
  overlay.innerHTML = `<section class="qc-status-change-card" role="dialog" aria-modal="true" aria-labelledby="warehouse-assignment-title"><p class="eyebrow">DELIVERY RECEIVED</p><h3 id="warehouse-assignment-title">Assign delivered purchase</h3><p class="item-note">Choose the warehouse responsible for this delivered purchase.</p><div class="form-grid"><div class="field full"><label>Warehouse</label><select class="delivery-warehouse" required>${warehouses.map(warehouse => `<option value="${warehouse.id}" ${warehouse.id === purchase.warehouseId ? 'selected' : ''}>${lifecycleEscape(warehouse.name)}${warehouse.location ? ` · ${lifecycleEscape(warehouse.location)}` : ''}</option>`).join('')}</select></div></div><div class="qc-status-change-actions"><button type="button" class="secondary qc-change-cancel">Cancel</button><button type="button" class="primary delivery-save">Assign warehouse</button></div></section>`;
  document.body.append(overlay);
  overlay.querySelector('.qc-change-cancel').onclick = () => { select.value = purchaseLogisticsStage(purchase); closeLifecycleDialog(overlay, select); };
  overlay.querySelector('.delivery-save').onclick = () => {
    const warehouse = warehouses.find(entry => entry.id === +overlay.querySelector('.delivery-warehouse').value);
    if (!warehouse) return;
    purchase.status = 'Delivered';
    purchase.warehouseId = warehouse.id;
    purchase.warehouseName = warehouse.name;
    purchase.warehouseAssignedDate = new Date().toISOString().slice(0, 10);
    save(); render(); closeLifecycleDialog(overlay);
  };
  overlay.querySelector('.delivery-warehouse').focus();
}

document.addEventListener('change', (event) => {
  const qc = event.target.closest('.purchase-qc-select');
  if (qc) {
    const purchase = data.purchases.find(entry => entry.id === +qc.dataset.purchaseId);
    if (purchase && qc.value !== purchaseQcStage(purchase)) openQcChangeDialog(purchase, qc, qc.value);
    return;
  }
  const logistics = event.target.closest('.purchase-logistics-select');
  if (!logistics) return;
  const purchase = data.purchases.find(entry => entry.id === +logistics.dataset.purchaseId);
  if (!purchase || logistics.value === purchaseLogisticsStage(purchase)) return;
  if (logistics.value === 'Delivered') { openWarehouseAssignmentDialog(purchase, logistics); return; }
  purchase.status = logistics.value;
  if (logistics.value !== 'Delivered') {
    delete purchase.warehouseId; delete purchase.warehouseName; delete purchase.warehouseAssignedDate;
  }
  save(); render();
});

// Goods Inwards is deliberately the gateway between purchase and available
// inventory: this action opens a receipt draft and never posts stock itself.
document.addEventListener('click', event => {
  const button = event.target.closest('.receive-purchase');
  if (!button) return;
  const purchase = data.purchases.find(entry => entry.id === +button.dataset.purchaseId);
  if (purchase) openGoodsInward((data.goodsInwards || []).find(receipt => receipt.purchaseId === purchase.id) || receiptForPurchase(purchase));
});

renderPurchaseLifecycle();
$('#purchase-status-filter').onchange = renderPurchaseLifecycle;
