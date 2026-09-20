// Controlled opening-stock entry. Normal purchases must be received through
// Goods Inwards; this path exists only to place pre-existing balances into a
// real warehouse with an auditable ledger entry.
(function () {
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const originalOpenModal = openModal;

  openModal = function (type, purchaseId) {
    if (type !== 'stock') return originalOpenModal(type, purchaseId);
    const warehouses = data.warehouses || [];
    $('#modal-label').textContent = 'OPENING STOCK';
    $('#modal-title').textContent = 'Allocate stock to a warehouse';
    $('#form-fields').innerHTML = `<div class="form-grid">
      <div class="field full"><div class="item-note"><strong>Use this only for stock already on site or a verified opening balance.</strong> Record all new purchases through Purchases and Goods Inwards so they are traceable, quality-checked where required, and received into a warehouse.</div></div>
      <div class="field"><label>Item name</label><input name="name" required></div>
      <div class="field"><label>Category</label><input name="category" list="opening-stock-categories" required><datalist id="opening-stock-categories">${(data.categories || []).map(category => `<option value="${escapeHtml(category)}">`).join('')}</datalist></div>
      <div class="field"><label>Quantity to allocate</label><input name="qty" type="number" min="0.000001" step="any" required></div>
      <div class="field"><label>Unit</label><input name="unit" list="opening-stock-units" required><datalist id="opening-stock-units">${(data.units || []).map(unit => `<option value="${escapeHtml(unit)}">`).join('')}</datalist></div>
      <div class="field"><label>Warehouse</label><select name="warehouseId" required><option value="">Select warehouse</option>${warehouses.map(warehouse => `<option value="${escapeHtml(warehouse.id)}">${escapeHtml(warehouse.name)}${warehouse.location ? ` · ${escapeHtml(warehouse.location)}` : ''}</option>`).join('')}</select></div>
      <div class="field"><label>Reorder level</label><input name="reorder" type="number" min="0" step="any" value="0" required></div>
      <div class="field full"><label>Reason / reference</label><input name="note" placeholder="e.g. Opening count on 17 Sep 2026" required></div>
    </div>`;
    const form = $('#record-form');
    form.dataset.type = 'opening-stock';
    $('#record-dialog').showModal();
  };

  $('#record-form').addEventListener('submit', event => {
    const form = event.currentTarget;
    if (form.dataset.type !== 'opening-stock') return;
    const values = formData(form);
    const quantity = Number(values.qty);
    const reorder = Number(values.reorder);
    const warehouse = (data.warehouses || []).find(entry => String(entry.id) === String(values.warehouseId));
    if (!warehouse || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(reorder) || reorder < 0) {
      event.preventDefault();
      alert('Enter a positive quantity, a valid reorder level, and a warehouse.');
      return;
    }
    const existing = stockItem(values.name.trim());
    if (existing) {
      if (String(existing.unit).trim().toLowerCase() !== values.unit.trim().toLowerCase()) {
        event.preventDefault();
        alert(`${existing.name} is already recorded in ${existing.unit}. Use that unit when allocating stock.`);
        return;
      }
      existing.qty += quantity;
      existing.reorder = reorder;
    } else {
      data.stock.push({ id: id(), name: values.name.trim(), category: values.category.trim(), qty: quantity, unit: values.unit.trim(), reorder });
    }
    window.recordStockMovement?.({
      type: 'OPENING_BALANCE', item: values.name.trim(), category: values.category.trim(), quantity,
      unit: values.unit.trim(), warehouseId: warehouse.id, sourceType: 'OPENING_STOCK', sourceId: id(),
      note: values.note.trim(),
    });
    save();
    render();
  }, true);
}());
