// Metadata-driven reporting engine. Report definitions describe the data to
// use and presentation; the runner, totals, drill-down and exports are shared.
(() => {
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const number = value => Number(value) || 0;
  const text = value => String(value ?? '').trim();
  const title = value => text(value).replace(/([A-Z])/g, ' $1').replace(/^./, character => character.toUpperCase());
  const formatNumber = value => number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const currency = value => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(number(value));
  const dateValue = value => text(value).slice(0, 10);
  const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const uid = () => `report-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const allAreas = ['Purchases', 'Suppliers', 'Goods Inwards', 'Lab Results', 'Production', 'Goods Outwards', 'Yield & Efficiency', 'Stock', 'Traceability', 'Custom Reports'];

  const fields = {
    purchases: ['date', 'purchaseId', 'supplier', 'item', 'itemDescription', 'category', 'status', 'lotNo', 'unit', 'purchasedQuantity', 'purchasePrice', 'totalValue'],
    suppliers: ['supplier', 'contact', 'email', 'phone', 'productsSupplied', 'purchaseCount', 'totalValue', 'acceptedQuantity', 'rejectedQuantity', 'rejectionRate'],
    goodsInwards: ['date', 'goodsInwardsId', 'purchaseId', 'supplier', 'item', 'category', 'lotNo', 'supplierReceiptId', 'unit', 'receivedQuantity', 'acceptedQuantity', 'rejectedQuantity', 'moisture', 'oilContent', 'ffa', 'qualityGrade', 'decision', 'warehouse', 'purchasePrice'],
    production: ['date', 'batch', 'machine', 'warehouse', 'rawMaterialInput', 'finishedGoodsQuantity', 'byProductQuantity', 'wasteQuantity', 'productionLoss', 'yieldPercent', 'extractionYieldPercent', 'accountedPercent', 'status'],
    goodsOutwards: ['date', 'goodsOutwardsId', 'item', 'quantity', 'unit', 'warehouse', 'useType', 'useLocation', 'issuedTo', 'issuedBy', 'note', 'remainingQuantity'],
    labResults: ['date', 'testName', 'batchRef', 'item', 'stage', 'analyst', 'decision', 'note'],
    movements: ['date', 'movementType', 'item', 'category', 'quantity', 'unit', 'warehouse', 'sourceReference', 'note'],
    stock: ['item', 'category', 'quantity', 'unit', 'reorderLevel', 'warehouse', 'stockValue', 'stockStatus'],
    traceability: ['date', 'supplier', 'supplierLot', 'goodsInwardsId', 'purchaseId', 'productionBatch', 'finishedProduct', 'quantity', 'unit', 'warehouse'],
  };

  const labels = {
    date: 'Date', purchaseId: 'Purchase ID', goodsInwardsId: 'Goods Inwards ID', goodsOutwardsId: 'Goods Outward ID', supplier: 'Supplier', item: 'Product / material', itemDescription: 'Item description', category: 'Category', status: 'Status', lotNo: 'Lot no.', supplierReceiptId: 'Supplier receipt ID', unit: 'Unit', purchasedQuantity: 'Purchased quantity', receivedQuantity: 'Received quantity', acceptedQuantity: 'Accepted quantity', rejectedQuantity: 'Rejected quantity', purchasePrice: 'Purchase price', totalValue: 'Total value', moisture: 'Moisture %', oilContent: 'Oil content %', ffa: 'FFA %', qualityGrade: 'Quality grade', decision: 'Decision', warehouse: 'Warehouse', contact: 'Contact', email: 'Email', phone: 'Phone', productsSupplied: 'Products supplied', purchaseCount: 'Purchase count', rejectionRate: 'Rejection rate %', batch: 'Production batch', machine: 'Machine', rawMaterialInput: 'Raw material consumed', finishedGoodsQuantity: 'Finished goods quantity', byProductQuantity: 'By-product quantity', wasteQuantity: 'Waste quantity', productionLoss: 'Production loss', yieldPercent: 'Yield %', extractionYieldPercent: 'Extraction yield %', accountedPercent: 'Input accounted for %', movementType: 'Movement type', quantity: 'Quantity', sourceReference: 'Source reference', note: 'Reason / notes', useType: 'Use category', useLocation: 'Where used', issuedTo: 'Issued to', issuedBy: 'Issued by', remainingQuantity: 'Quantity remaining', testName: 'Test name', batchRef: 'Batch reference', stage: 'Test stage', analyst: 'Analyst', reorderLevel: 'Reorder level', stockValue: 'Stock value', stockStatus: 'Stock status', supplierLot: 'Supplier lot', productionBatch: 'Production batch', finishedProduct: 'Finished product', source: 'Source', qualityCheckOfficer: 'Quality check officer', qcBatchReference: 'QC batch reference'
  };
  const measures = new Set(['purchasedQuantity', 'receivedQuantity', 'acceptedQuantity', 'rejectedQuantity', 'rawMaterialInput', 'finishedGoodsQuantity', 'byProductQuantity', 'wasteQuantity', 'productionLoss', 'quantity', 'remainingQuantity', 'totalValue', 'purchasePrice', 'stockValue']);
  const percentFields = new Set(['rejectionRate', 'yieldPercent', 'extractionYieldPercent', 'accountedPercent', 'moisture', 'oilContent', 'ffa']);
  const moneyFields = new Set(['purchasePrice', 'totalValue', 'stockValue']);

  const report = (area, name, source, columns, groupBy = '', options = {}) => ({ id: `${area}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'), area, name, source, columns, groupBy, sortBy: options.sortBy || 'date', sortDirection: options.sortDirection || 'desc', permissions: options.permissions || ['All users'], favourite: false, ...options });
  const standardReports = [
    ...['Purchase Order Register', 'Purchases by Supplier', 'Purchases by Product / Raw Material', 'Purchases by Period', 'Open Purchase Orders', 'Outstanding Purchase Orders', 'Purchase Price History', 'Purchase Price Variance', 'Supplier Spend Analysis'].map(name => report('Purchases', name, 'purchases', ['date', 'purchaseId', 'supplier', 'item', 'category', 'purchasedQuantity', 'unit', 'purchasePrice', 'totalValue', 'status'], name.includes('Supplier') || name.includes('Spend') ? 'supplier' : name.includes('Product') ? 'item' : '')),
    ...['Supplier List', 'Supplier Purchase History', 'Supplier Performance', 'Supplier Delivery Performance', 'Supplier Price Comparison', 'Supplier Quality / Rejection Analysis'].map(name => report('Suppliers', name, 'suppliers', ['supplier', 'contact', 'email', 'productsSupplied', 'purchaseCount', 'totalValue', 'acceptedQuantity', 'rejectedQuantity', 'rejectionRate'], 'supplier')),
    ...['Goods Inwards Register', 'Goods Received by Supplier', 'Goods Received by Product', 'Purchase Order vs Quantity Received', 'Outstanding Purchase Order Receipts', 'Goods Received by Period', 'Rejected / Quarantined Goods', 'Raw Material Receipt History'].map(name => report('Goods Inwards', name, 'goodsInwards', ['date', 'goodsInwardsId', 'purchaseId', 'supplier', 'item', 'lotNo', 'receivedQuantity', 'acceptedQuantity', 'rejectedQuantity', 'unit', 'moisture', 'oilContent', 'ffa', 'decision', 'warehouse', 'purchasePrice'], name.includes('Supplier') ? 'supplier' : name.includes('Product') ? 'item' : '')),
    ...['Lab Result Register', 'Goods Inwards Factory Tests', 'Laboratory Results by Analyst', 'Failed or Held Laboratory Tests'].map(name => report('Lab Results', name, 'labResults', ['date', 'testName', 'batchRef', 'item', 'stage', 'analyst', 'decision', 'note'], name.includes('Analyst') ? 'analyst' : name.includes('Tests') ? 'decision' : '')),
    ...['Production Register', 'Production by Date', 'Production by Batch', 'Production by Product', 'Raw Material Consumed', 'Finished Product Produced', 'Input vs Output', 'Production Yield', 'Extraction Yield %', 'Production Loss', 'Waste / By-product', 'Production Efficiency', 'Production Variance'].map(name => report('Production', name, 'production', ['date', 'batch', 'machine', 'warehouse', 'rawMaterialInput', 'finishedGoodsQuantity', 'byProductQuantity', 'wasteQuantity', 'productionLoss', 'yieldPercent', 'extractionYieldPercent', 'accountedPercent', 'status'], name.includes('Date') ? 'date' : name.includes('Batch') ? 'batch' : '')),
    ...['Goods Outwards Register', 'Stock Issued by Location', 'Stock Issued to Person', 'Machine and Generator Consumption', 'Consumables Usage History'].map(name => report('Goods Outwards', name, 'goodsOutwards', ['date', 'goodsOutwardsId', 'item', 'quantity', 'unit', 'warehouse', 'useType', 'useLocation', 'issuedTo', 'issuedBy', 'note', 'remainingQuantity'], name.includes('Location') || name.includes('Machine') ? 'useLocation' : name.includes('Person') ? 'issuedTo' : 'item')),
    ...['Current Stock', 'Raw Peanut Stock', 'Finished Goods Stock', 'Stock by Warehouse / Location', 'Stock Movement Register', 'Stock Valuation', 'Stock Ageing', 'Slow Moving Stock', 'Low Stock', 'Stock Adjustments', 'Stock Transfers', 'Batch / Lot Stock', 'Stock Received vs Stock Consumed'].map(name => report('Stock', name, name.includes('Movement') || name.includes('Adjustments') || name.includes('Transfers') || name.includes('Received') ? 'movements' : 'stock', name.includes('Movement') || name.includes('Adjustments') || name.includes('Transfers') || name.includes('Received') ? ['date', 'movementType', 'item', 'category', 'quantity', 'unit', 'warehouse', 'sourceReference', 'note'] : ['item', 'category', 'quantity', 'unit', 'reorderLevel', 'warehouse', 'stockValue', 'stockStatus'], name.includes('Warehouse') ? 'warehouse' : name.includes('Stock') ? 'category' : '')),
    ...['Batch Yield Analysis', 'Extraction Yield %', 'Raw Material Input vs Finished Output', 'Mass Balance Report', 'Production Loss Report', 'Unaccounted Production Loss', 'Yield Variance by Batch', 'Yield Trend by Period', 'Yield by Supplier', 'Yield by Raw Material Batch', 'Supplier Yield Performance'].map(name => report('Yield & Efficiency', name, 'production', ['date', 'batch', 'machine', 'rawMaterialInput', 'finishedGoodsQuantity', 'byProductQuantity', 'wasteQuantity', 'productionLoss', 'yieldPercent', 'extractionYieldPercent', 'accountedPercent'], name.includes('Supplier') ? 'supplier' : name.includes('Period') ? 'date' : 'batch')),
    ...['Supplier Lot Traceability', 'Goods Receipt to Production Batch', 'Raw Material Batch to Production Batch', 'Production Batch Traceability', 'Raw Material to Finished Product', 'Finished Product back to Raw Material', 'Finished Product back to Supplier', 'Batch Stock History'].map(name => report('Traceability', name, 'traceability', ['date', 'supplier', 'supplierLot', 'goodsInwardsId', 'purchaseId', 'productionBatch', 'finishedProduct', 'quantity', 'unit', 'warehouse'], 'productionBatch')),
  ];

  const userRole = () => {
    const email = text(data.currentUserEmail).toLowerCase();
    return (data.people || []).find(person => text(person.email).toLowerCase() === email)?.role || 'User';
  };
  const canBuild = () => ['administrator', 'accounts manager', 'operations manager'].includes(userRole().toLowerCase());
  const canUse = definition => definition.permissions?.includes('All users') || definition.permissions?.some(role => role.toLowerCase() === userRole().toLowerCase());
  const reportDefinitions = () => [...standardReports, ...(data.customReports || [])].filter(canUse);

  function purchaseRows() {
    return (data.purchases || []).map(purchase => ({
      date: dateValue(purchase.purchasedDate || purchase.date || purchase.createdDate), purchaseId: purchase.purchaseId || purchase.id, supplier: purchase.supplier || '', item: purchase.item || '', itemDescription: purchase.itemDescription || '', category: purchase.category || '', status: purchase.status || purchase.stage || '', lotNo: purchase.batchNumber || purchase.lotNo || '', unit: purchase.unit || '', purchasedQuantity: number(purchase.qty || purchase.quantity), purchasePrice: number(purchase.unitPrice || (number(purchase.cost) / (number(purchase.qty || purchase.quantity) || 1))), totalValue: number(purchase.cost || purchase.total), _record: purchase,
    }));
  }
  function goodsRows() {
    return (data.goodsInwards || []).map(receipt => {
      const purchase = (data.purchases || []).find(record => String(record.id) === String(receipt.purchaseId)) || {};
      const received = number(receipt.qty ?? receipt.receivedQuantity ?? purchase.qty);
      const accepted = receipt.decision === 'Accepted' || receipt.status === 'Accepted' ? number(receipt.stockOnHandQty ?? received) : number(receipt.acceptedQuantity);
      const rejected = number(receipt.rejectedQuantity || (['Rejected', 'Quarantined'].includes(receipt.decision || receipt.status) ? received : 0));
      return { date: dateValue(receipt.receivedDate || receipt.date || receipt.createdDate), goodsInwardsId: receipt.goodsInwardsId || receipt.id, purchaseId: receipt.purchaseId || purchase.purchaseId || '', supplier: receipt.supplier || purchase.supplier || '', item: receipt.item || purchase.item || '', category: receipt.category || purchase.category || '', lotNo: receipt.batchNumber || receipt.lotNo || purchase.batchNumber || purchase.lotNo || '', supplierReceiptId: receipt.supplierReceiptId || purchase.supplierReceiptId || '', unit: receipt.unit || purchase.unit || '', receivedQuantity: received, acceptedQuantity: accepted, rejectedQuantity: rejected, moisture: receipt.moisture ?? '', oilContent: receipt.oilContent ?? '', ffa: receipt.ffa ?? '', qualityGrade: receipt.qualityGrade || '', decision: receipt.decision || receipt.status || 'Assess', warehouse: receipt.warehouseName || (data.warehouses || []).find(warehouse => String(warehouse.id) === String(receipt.warehouseId))?.name || '', purchasePrice: number(purchase.unitPrice || purchase.cost / (purchase.qty || 1)), _record: receipt };
    });
  }
  function productionRows() {
    return (data.production || []).map(run => {
      const materials = Array.isArray(run.materials) ? run.materials : [];
      const outputs = Array.isArray(run.outputs) ? run.outputs : [];
      const kernels = materials.filter(material => text(material.name).toLowerCase().includes('kernel')).reduce((total, material) => total + number(material.quantity), 0);
      const massOutputs = outputs.filter(output => text(output[2] || output.unit).toLowerCase() === 'kg').reduce((total, output) => total + number(output[1] ?? output.quantity), 0);
      const oil = outputs.filter(output => text(output[0] || output.name).toLowerCase().includes('oil')).reduce((total, output) => total + number(output[1] ?? output.quantity), 0);
      const cake = outputs.filter(output => text(output[0] || output.name).toLowerCase().includes('cake')).reduce((total, output) => total + number(output[1] ?? output.quantity), 0);
      const waste = outputs.filter(output => text(output[0] || output.name).toLowerCase().includes('sludge') || text(output[0] || output.name).toLowerCase().includes('waste')).reduce((total, output) => total + number(output[1] ?? output.quantity), 0);
      const input = kernels || materials.reduce((total, material) => total + number(material.quantity), 0);
      const finished = outputs.filter(output => !text(output[0] || output.name).toLowerCase().includes('sludge')).reduce((total, output) => total + number(output[1] ?? output.quantity), 0);
      const accounted = massOutputs + waste;
      return { date: dateValue(run.date || run.endedAt || run.startedAt), batch: run.batch || run.reference || run.id, machine: run.machine || '', warehouse: run.warehouseName || (data.warehouses || []).find(warehouse => String(warehouse.id) === String(run.warehouseId))?.name || '', rawMaterialInput: input, finishedGoodsQuantity: finished, byProductQuantity: cake, wasteQuantity: waste, productionLoss: Math.max(0, kernels - accounted), yieldPercent: kernels ? (massOutputs / kernels) * 100 : 0, extractionYieldPercent: kernels ? (oil / kernels) * 100 : 0, accountedPercent: kernels ? (accounted / kernels) * 100 : 0, status: run.status || 'Completed', supplier: '', _record: run };
    });
  }
  function goodsOutwardRows() {
    return (data.goodsOutwards || []).map(issue => ({
      date: dateValue(issue.issuedAt), goodsOutwardsId: issue.reference || issue.id, item: issue.item || '', quantity: number(issue.quantity), unit: issue.unit || '',
      warehouse: issue.warehouseName || (data.warehouses || []).find(warehouse => String(warehouse.id) === String(issue.warehouseId))?.name || '',
      useType: issue.useType || '', useLocation: issue.useLocation || '', issuedTo: issue.issuedTo || '', issuedBy: issue.issuedBy || '', note: issue.purpose || '', remainingQuantity: number(issue.remainingAfterIssue), _record: issue,
    }));
  }
  function labResultRows() {
    return (data.labResults || []).map(result => {
      const receipt = (data.goodsInwards || []).find(record => String(record.id) === String(result.goodsInwardsRecordId)) || {};
      return { date: dateValue(result.date || result.testedAt), testName: result.testName || '', batchRef: result.batchRef || '', item: receipt.item || '', stage: result.stage || '', analyst: result.analyst || '', decision: result.decision || '', note: result.notes || '', _record: result };
    });
  }
  function movementRows() { return (data.stockMovements || []).map(movement => ({ date: dateValue(movement.at || movement.date), movementType: movement.type || '', item: movement.item || movement.itemName || '', category: movement.category || (stockItem(movement.item || movement.itemName) || {}).category || '', quantity: number(movement.quantity), unit: movement.unit || (stockItem(movement.item || movement.itemName) || {}).unit || '', warehouse: movement.warehouseName || (data.warehouses || []).find(warehouse => String(warehouse.id) === String(movement.warehouseId))?.name || '', sourceReference: movement.sourceId || '', note: movement.note || '', _record: movement })); }
  function stockRows() { return (data.stock || []).map(item => ({ item: item.name, category: item.category || '', quantity: number(item.qty), unit: item.unit || '', reorderLevel: number(item.reorder), warehouse: (data.stockMovements || []).filter(movement => movement.item === item.name).map(movement => (data.warehouses || []).find(warehouse => String(warehouse.id) === String(movement.warehouseId))?.name).filter(Boolean).join(' · '), stockValue: 0, stockStatus: number(item.qty) <= number(item.reorder) ? 'Low stock' : 'In stock', _record: item })); }
  function supplierRows() {
    const purchases = purchaseRows(), receipts = goodsRows();
    return (data.suppliers || []).map(supplier => { const spend = purchases.filter(row => row.supplier === supplier.name); const received = receipts.filter(row => row.supplier === supplier.name); const accepted = received.reduce((total, row) => total + row.acceptedQuantity, 0); const rejected = received.reduce((total, row) => total + row.rejectedQuantity, 0); return { supplier: supplier.name, contact: supplier.contact || '', email: supplier.email || '', phone: supplier.phone || '', productsSupplied: Array.isArray(supplier.products) ? supplier.products.join(', ') : supplier.products || '', purchaseCount: spend.length, totalValue: spend.reduce((total, row) => total + row.totalValue, 0), acceptedQuantity: accepted, rejectedQuantity: rejected, rejectionRate: accepted + rejected ? (rejected / (accepted + rejected)) * 100 : 0, _record: supplier }; });
  }
  function traceabilityRows() {
    const receipts = goodsRows(), productions = productionRows();
    const rows = [];
    receipts.forEach(receipt => rows.push({ date: receipt.date, supplier: receipt.supplier, supplierLot: receipt.lotNo, goodsInwardsId: receipt.goodsInwardsId, purchaseId: receipt.purchaseId, productionBatch: '', finishedProduct: '', quantity: receipt.acceptedQuantity || receipt.receivedQuantity, unit: receipt.unit, warehouse: receipt.warehouse, _record: receipt._record }));
    productions.forEach(run => { const materials = Array.isArray(run._record.materials) ? run._record.materials : []; const outputs = Array.isArray(run._record.outputs) ? run._record.outputs : []; materials.forEach(material => { const receipt = receipts.find(item => item.item === material.name && (!material.lotNo || item.lotNo === material.lotNo)); outputs.forEach(output => rows.push({ date: run.date, supplier: receipt?.supplier || '', supplierLot: material.lotNo || receipt?.lotNo || '', goodsInwardsId: receipt?.goodsInwardsId || '', purchaseId: receipt?.purchaseId || '', productionBatch: run.batch, finishedProduct: output[0] || output.name || '', quantity: number(output[1] ?? output.quantity), unit: output[2] || output.unit || '', warehouse: run.warehouse, _record: run._record })); }); });
    return rows;
  }
  const sourceRows = source => ({ purchases: purchaseRows, suppliers: supplierRows, goodsInwards: goodsRows, labResults: labResultRows, production: productionRows, goodsOutwards: goodsOutwardRows, movements: movementRows, stock: stockRows, traceability: traceabilityRows }[source] || (() => []))();

  function filteredRows(definition, filters) {
    return sourceRows(definition.source).filter(row => {
      const rowDate = dateValue(row.date);
      if (filters.dateFrom && rowDate && rowDate < filters.dateFrom) return false;
      if (filters.dateTo && rowDate && rowDate > filters.dateTo) return false;
      return !filters.field || !filters.value || text(row[filters.field]).toLowerCase().includes(text(filters.value).toLowerCase());
    });
  }
  function groupedRows(rows, groupBy, columns) {
    if (!groupBy) return rows.map(row => ({ ...row, _detailRows: [row] }));
    const groups = new Map();
    rows.forEach(row => { const key = text(row[groupBy]) || 'Not recorded'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); });
    return [...groups.entries()].map(([key, detailRows]) => { const result = { [groupBy]: key, _detailRows: detailRows }; columns.forEach(column => { const values = detailRows.map(row => row[column]); result[column] = measures.has(column) ? values.reduce((total, value) => total + number(value), 0) : column === groupBy ? key : values.find(value => text(value)) || ''; }); return result; });
  }
  function sortedRows(rows, sortBy, direction) { return [...rows].sort((left, right) => { const a = left[sortBy], b = right[sortBy]; const compare = typeof a === 'number' || typeof b === 'number' ? number(a) - number(b) : text(a).localeCompare(text(b)); return direction === 'asc' ? compare : -compare; }); }
  function display(field, value) { if (moneyFields.has(field)) return currency(value); if (percentFields.has(field)) return `${formatNumber(value)}%`; if (measures.has(field)) return formatNumber(value); return esc(value || '—'); }

  let selectedReportId = null;
  let favouritesOnly = false;
  const byId = id => reportDefinitions().find(definition => definition.id === id);
  function currentDefinition() { return byId(selectedReportId); }
  function renderCatalogue() {
    const query = text(document.querySelector('#report-search')?.value).toLowerCase();
    const area = document.querySelector('#report-area-filters .active')?.dataset.area || 'All';
    const definitions = reportDefinitions().filter(definition => (!query || `${definition.name} ${definition.area}`.toLowerCase().includes(query)) && (area === 'All' || definition.area === area) && (!favouritesOnly || definition.favourite || (data.reportFavourites || []).includes(definition.id)));
    document.querySelector('#report-area-filters').innerHTML = ['All', ...allAreas].map(name => `<button type="button" class="${name === area ? 'active' : ''}" data-area="${esc(name)}">${esc(name)}</button>`).join('');
    document.querySelector('#report-catalogue-list').innerHTML = definitions.map(definition => `<article class="report-card"><div><span>${esc(definition.area)}</span><h3>${esc(definition.name)}</h3><p>${esc(definition.columns.slice(0, 3).map(field => labels[field] || title(field)).join(' · '))}</p></div><div class="report-card-actions"><button type="button" class="text-btn report-favourite" data-id="${esc(definition.id)}" aria-label="Toggle favourite">${(data.reportFavourites || []).includes(definition.id) || definition.favourite ? '★' : '☆'}</button><button type="button" class="primary open-report" data-id="${esc(definition.id)}">Open</button></div></article>`).join('') || '<p class="muted">No reports match your search.</p>';
    document.querySelectorAll('#report-area-filters button').forEach(button => button.onclick = () => { document.querySelectorAll('#report-area-filters button').forEach(item => item.classList.remove('active')); button.classList.add('active'); renderCatalogue(); });
    document.querySelectorAll('.open-report').forEach(button => button.onclick = () => openReport(button.dataset.id));
    document.querySelectorAll('.report-favourite').forEach(button => button.onclick = () => { data.reportFavourites ??= []; const index = data.reportFavourites.indexOf(button.dataset.id); if (index < 0) data.reportFavourites.push(button.dataset.id); else data.reportFavourites.splice(index, 1); save(); renderCatalogue(); });
  }
  function options(values, selected) { return values.map(value => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(labels[value] || title(value))}</option>`).join(''); }
  function openReport(id) { selectedReportId = id; document.querySelector('#report-runner').hidden = false; document.querySelector('#report-builder').hidden = true; renderReport(); document.querySelector('#report-runner').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function renderReport() {
    const definition = currentDefinition(); if (!definition) return;
    const available = fields[definition.source] || definition.columns;
    const current = document.querySelector('#report-runner form');
    const filters = current ? Object.fromEntries(new FormData(current).entries()) : { dateFrom: '', dateTo: '', field: '', value: '', groupBy: definition.groupBy || '', sortBy: definition.sortBy || 'date', direction: definition.sortDirection || 'desc' };
    let rows = filteredRows(definition, filters); rows = groupedRows(rows, filters.groupBy, definition.columns); rows = sortedRows(rows, filters.sortBy, filters.direction);
    const totals = Object.fromEntries(definition.columns.filter(field => measures.has(field)).map(field => [field, rows.reduce((total, row) => total + number(row[field]), 0)]));
    document.querySelector('#report-runner').innerHTML = `<div class="report-runner-head"><div><span>${esc(definition.area)}</span><h3>${esc(definition.name)}</h3><p>${rows.length.toLocaleString()} result${rows.length === 1 ? '' : 's'} · click a row to drill down</p></div><div class="report-export-actions"><button type="button" data-export="csv" class="secondary">CSV</button><button type="button" data-export="excel" class="secondary">Excel</button><button type="button" data-export="pdf" class="secondary">PDF</button><button type="button" id="save-report-customisation" class="primary">Save copy</button></div></div><form id="report-filters" class="report-filters"><label>From<input name="dateFrom" type="date" value="${esc(filters.dateFrom || '')}"></label><label>To<input name="dateTo" type="date" value="${esc(filters.dateTo || '')}"></label><label>Filter field<select name="field"><option value="">All fields</option>${options(available, filters.field)}</select></label><label>Contains<input name="value" value="${esc(filters.value || '')}" placeholder="Filter value"></label><label>Group by<select name="groupBy"><option value="">No grouping</option>${options(available, filters.groupBy)}</select></label><label>Sort by<select name="sortBy">${options(available, filters.sortBy)}</select></label><label>Direction<select name="direction"><option value="asc" ${filters.direction === 'asc' ? 'selected' : ''}>Ascending</option><option value="desc" ${filters.direction === 'desc' ? 'selected' : ''}>Descending</option></select></label><button class="primary" type="submit">Apply</button></form><div class="report-totals">${Object.entries(totals).map(([field, value]) => `<div><small>${esc(labels[field])}</small><strong>${display(field, value)}</strong></div>`).join('') || '<div><small>Transactions</small><strong>' + rows.length.toLocaleString() + '</strong></div>'}</div><div class="report-table-wrap"><table class="data-table report-table"><thead><tr>${definition.columns.map(field => `<th>${esc(labels[field] || title(field))}</th>`).join('')}</tr></thead><tbody>${rows.map((row, index) => `<tr class="report-drill-row" data-row="${index}">${definition.columns.map(field => `<td>${display(field, row[field])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${definition.columns.length}">No records match these filters.</td></tr>`}</tbody>${Object.keys(totals).length ? `<tfoot><tr>${definition.columns.map(field => `<td>${measures.has(field) ? `<strong>${display(field, totals[field])}</strong>` : field === definition.columns[0] ? '<strong>Total</strong>' : ''}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
    document.querySelector('#report-filters').onsubmit = event => { event.preventDefault(); renderReport(); };
    document.querySelectorAll('.report-drill-row').forEach(button => button.onclick = () => showDrilldown(rows[Number(button.dataset.row)]));
    document.querySelectorAll('[data-export]').forEach(button => button.onclick = () => exportReport(button.dataset.export, definition, rows));
    document.querySelector('#save-report-customisation').onclick = saveCustomisation;
  }
  function showDrilldown(row) {
    const detail = row._detailRows || [row];
    document.querySelector('#modal-label').textContent = 'REPORT DRILL-DOWN'; document.querySelector('#modal-title').textContent = `${detail.length} underlying transaction${detail.length === 1 ? '' : 's'}`;
    document.querySelector('#form-fields').innerHTML = `<div class="report-drill-list">${detail.map(item => `<article><dl>${Object.entries(item).filter(([key]) => !key.startsWith('_')).map(([key, value]) => `<div><dt>${esc(labels[key] || title(key))}</dt><dd>${esc(typeof value === 'object' ? JSON.stringify(value) : value || '—')}</dd></div>`).join('')}</dl></article>`).join('')}</div>`;
    document.querySelector('#record-form').dataset.type = 'report-drilldown'; document.querySelector('#save-record').hidden = true; document.querySelector('#record-dialog .modal-actions').hidden = true; document.querySelector('#record-dialog').showModal();
  }
  function exportReport(type, definition, rows) {
    const header = definition.columns.map(field => labels[field] || title(field)); const body = rows.map(row => definition.columns.map(field => row[field] ?? ''));
    if (type === 'pdf') { const tab = window.open('', '_blank'); if (!tab) return alert('Allow pop-ups to export this report as PDF.'); tab.document.write(`<html><head><title>${esc(definition.name)}</title><style>body{font-family:Arial;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:7px;text-align:left}th{background:#111;color:#d6ac36}</style></head><body><h1>${esc(definition.name)}</h1><p>Generated ${new Date().toLocaleString()}</p><table><thead><tr>${header.map(value => `<th>${esc(value)}</th>`).join('')}</tr></thead><tbody>${body.map(row => `<tr>${row.map(value => `<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`); tab.document.close(); tab.print(); return; }
    const csv = [header, ...body].map(row => row.map(csvCell).join(',')).join('\n'); const blob = new Blob([type === 'excel' ? `\ufeff${csv}` : csv], { type: type === 'excel' ? 'application/vnd.ms-excel;charset=utf-8' : 'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${definition.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${type === 'excel' ? 'xls' : 'csv'}`; link.click(); URL.revokeObjectURL(link.href);
  }
  function saveCustomisation() {
    if (!canBuild()) return alert('Only authorised managers and administrators can save custom reports.');
    const definition = currentDefinition(); const form = document.querySelector('#report-filters'); const values = Object.fromEntries(new FormData(form).entries()); const name = prompt('Name for this saved report copy:', `${definition.name} — custom`); if (!name?.trim()) return;
    data.customReports ??= []; data.customReports.unshift({ ...definition, id: uid(), name: name.trim(), area: 'Custom Reports', favourite: true, groupBy: values.groupBy || '', sortBy: values.sortBy || definition.sortBy, sortDirection: values.direction || definition.sortDirection, savedFilters: { dateFrom: values.dateFrom || '', dateTo: values.dateTo || '', field: values.field || '', value: values.value || '' }, permissions: ['All users'] }); save(); renderCatalogue(); alert('Saved in Custom Reports.');
  }
  function renderBuilder() {
    const root = document.querySelector('#report-builder'); if (!root) return; if (!canBuild()) { root.innerHTML = '<p>Report creation is available to Administrators, Operations Managers and Accounts Managers.</p>'; return; }
    const source = root.querySelector('[name="source"]')?.value || 'purchases'; const chosen = fields[source];
    root.innerHTML = `<div class="panel-head"><div><span>REPORT BUILDER</span><h3>Create a reusable report</h3><p>Select the business area and columns; the engine manages calculations, filtering and exports.</p></div></div><form id="custom-report-form" class="report-builder-form"><label>Report name<input name="name" required placeholder="e.g. Monthly kernel receipt analysis"></label><label>Reporting area<select name="area">${allAreas.filter(area => area !== 'Custom Reports').map(area => `<option>${esc(area)}</option>`).join('')}</select></label><label>Data source<select name="source">${Object.keys(fields).map(key => `<option value="${key}" ${key === source ? 'selected' : ''}>${esc(title(key))}</option>`).join('')}</select></label><label>Group by<select name="groupBy"><option value="">No grouping</option>${options(chosen, '')}</select></label><label>Sort by<select name="sortBy">${options(chosen, chosen.includes('date') ? 'date' : chosen[0])}</select></label><fieldset class="report-column-picker"><legend>Columns and measures</legend>${chosen.map(field => `<label><input type="checkbox" name="columns" value="${field}" ${field === 'date' || field === chosen[0] || measures.has(field) ? 'checked' : ''}> ${esc(labels[field] || title(field))}</label>`).join('')}</fieldset><button class="primary" type="submit">Save custom report</button></form>`;
    root.querySelector('[name="source"]').onchange = renderBuilder;
    root.querySelector('#custom-report-form').onsubmit = event => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); const columns = values.getAll('columns'); if (!columns.length) return alert('Select at least one column.'); data.customReports ??= []; const custom = { id: uid(), name: text(values.get('name')), area: 'Custom Reports', source: text(values.get('source')), columns, groupBy: text(values.get('groupBy')), sortBy: text(values.get('sortBy')), sortDirection: 'desc', permissions: ['All users'], favourite: true }; data.customReports.unshift(custom); save(); renderCatalogue(); openReport(custom.id); };
  }
  function setup() {
    const view = document.querySelector('#reports-view'); if (!view) return;
    document.querySelector('#report-search').oninput = renderCatalogue;
    document.querySelector('#report-favourites').onclick = () => { favouritesOnly = !favouritesOnly; document.querySelector('#report-favourites').classList.toggle('active', favouritesOnly); renderCatalogue(); };
    document.querySelector('#report-builder-toggle').onclick = () => { const builder = document.querySelector('#report-builder'); builder.hidden = !builder.hidden; if (!builder.hidden) { document.querySelector('#report-runner').hidden = true; renderBuilder(); } };
    renderCatalogue();
  }
  setup();
  const originalRender = render; render = () => { originalRender(); setup(); };
})();
