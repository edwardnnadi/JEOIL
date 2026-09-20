// Goods outward is the controlled route for consumables and maintenance parts.
// It deliberately creates a stock-ledger event instead of using an adjustment:
// every reduction identifies the receiver, destination and operational reason.
(() => {
  const $ = selector => document.querySelector(selector);
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const escValue = value => typeof esc === 'function' ? esc(value) : String(value ?? '');
  const nowLocal = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  };
  const warehouseById = warehouseId => (data.warehouses || []).find(warehouse => String(warehouse.id) === String(warehouseId));
  const stockItem = itemName => (data.stock || []).find(item => item.name === itemName);
  const available = (itemName, warehouseId) => number(window.StockLedger?.warehouseBalance(itemName, warehouseId));

  function renderGoodsOutwards() {
    const table = $('#goods-outwards-table');
    if (!table) return;
    const records = [...(data.goodsOutwards || [])].sort((a, b) => String(b.issuedAt || '').localeCompare(String(a.issuedAt || '')));
    table.innerHTML = records.length ? records.map(record => {
      const remaining = number(record.remainingAfterIssue);
      return `<tr><td>${escValue(new Date(record.issuedAt).toLocaleString())}</td><td>${escValue(record.reference)}</td><td>${escValue(record.item)}<small>${escValue(record.warehouseName)}</small></td><td>${number(record.quantity).toLocaleString()} ${escValue(record.unit)}</td><td>${escValue(record.useLocation)}</td><td><strong>${escValue(record.useType)}</strong><small>${escValue(record.purpose)}</small></td><td>${escValue(record.issuedTo)}</td><td>${escValue(record.issuedBy)}</td><td>${remaining.toLocaleString()} ${escValue(record.unit)}</td></tr>`;
    }).join('') : '<tr><td colspan="9" class="empty">No goods have been issued yet. Use “Issue stock” to create a traceable consumption record.</td></tr>';
  }

  function openGoodsOutward() {
    const stockOptions = (data.stock || []).filter(item => number(item.qty) > 0).map(item =>
      `<option value="${escValue(item.name)}">${escValue(item.name)} · ${number(item.qty).toLocaleString()} ${escValue(item.unit)}</option>`,
    ).join('');
    const warehouseOptions = (data.warehouses || []).map(warehouse =>
      `<option value="${escValue(warehouse.id)}">${escValue(warehouse.name)}${warehouse.location ? ` · ${escValue(warehouse.location)}` : ''}</option>`,
    ).join('');
    const operator = currentOperator?.();
    const peopleOptions = (data.people || []).filter(person => person.name).map(person =>
      `<option value="${escValue(person.name)}">${escValue(person.name)}${person.role ? ` · ${escValue(person.role)}` : ''}</option>`,
    ).join('');
    $('#modal-label').textContent = 'GOODS OUTWARD';
    $('#modal-title').textContent = 'Issue stock for use';
    $('#form-fields').innerHTML = `<div class="form-grid"><div class="field full"><label>Item to issue</label><select name="item" required><option value="">Select stock item</option>${stockOptions}</select></div><div class="field"><label>Issue from warehouse</label><select name="warehouseId" required><option value="">Select warehouse</option>${warehouseOptions}</select></div><div class="field"><label>Quantity issued</label><input name="quantity" type="number" min="0.001" step="any" required></div><div class="field full"><div class="item-note" id="goods-outward-availability" aria-live="polite">Select an item and warehouse to see the remaining balance.</div></div><div class="field"><label>Use category</label><select name="useType" required><option value="">Select category</option><option>Machine maintenance</option><option>Generator operation</option><option>Production support</option><option>Cleaning and sanitation</option><option>Packaging</option><option>Facility operations</option><option>Other operational use</option></select></div><div class="field"><label>Where was it used?</label><input name="useLocation" required maxlength="120" placeholder="e.g. Generator A or Expeller 2"></div><div class="field"><label>Issued to</label><select name="issuedTo" required><option value="">Select recipient</option>${peopleOptions}</select></div><div class="field"><label>Issued by</label><select name="issuedBy" required><option value="">Select issuer</option>${(data.people || []).filter(person => person.name).map(person=>`<option value="${escValue(person.name)}" ${person.name===operator?.name?'selected':''}>${escValue(person.name)}${person.role ? ` · ${escValue(person.role)}` : ''}</option>`).join('')}</select></div><div class="field"><label>Date and time issued</label><input name="issuedAt" type="datetime-local" required value="${nowLocal()}"></div><div class="field full"><label>How and why was it used?</label><textarea name="purpose" minlength="10" maxlength="1000" required placeholder="Describe the work, fault, job, or operational purpose"></textarea></div></div>`;
    const form = $('#record-form');
    const showAvailability = () => {
      const note = $('#goods-outward-availability');
      const item = stockItem(form.elements.item.value);
      const warehouse = warehouseById(form.elements.warehouseId.value);
      if (!note || !item || !warehouse) return;
      note.textContent = `${available(item.name, warehouse.id).toLocaleString()} ${item.unit} available in ${warehouse.name}.`;
    };
    form.elements.item.onchange = showAvailability;
    form.elements.warehouseId.onchange = showAvailability;
    form.dataset.type = 'goods-outward';
    $('#save-record').textContent = 'Issue stock';
    $('#record-dialog').showModal();
  }

  $('#record-form').addEventListener('submit', event => {
    const form = event.currentTarget;
    if (form.dataset.type !== 'goods-outward') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const item = stockItem(form.elements.item.value);
    const warehouse = warehouseById(form.elements.warehouseId.value);
    const quantity = number(form.elements.quantity.value);
    const useType = form.elements.useType.value.trim();
    const useLocation = form.elements.useLocation.value.trim();
    const issuedTo = form.elements.issuedTo.value.trim();
    const issuedBy = form.elements.issuedBy.value.trim();
    const purpose = form.elements.purpose.value.trim();
    const issuedAt = form.elements.issuedAt.value;
    if (!item || !warehouse || quantity <= 0 || !useType || !useLocation || !issuedTo || !issuedBy || purpose.length < 10 || !issuedAt) {
      return alert('Complete every Goods outward field, including a useful explanation of at least 10 characters.');
    }
    const balanceBefore = available(item.name, warehouse.id);
    if (quantity > balanceBefore) return alert(`Only ${balanceBefore.toLocaleString()} ${item.unit} is available in ${warehouse.name}.`);
    const issueId = id();
    const remainingAfterIssue = Math.round((balanceBefore - quantity) * 1e6) / 1e6;
    const record = {
      id: issueId,
      reference: `GO-${String(issueId).padStart(5, '0')}`,
      item: item.name,
      unit: item.unit,
      quantity,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      useType,
      useLocation,
      purpose,
      issuedTo,
      issuedAt: new Date(issuedAt).toISOString(),
      issuedBy,
      balanceBeforeIssue: balanceBefore,
      remainingAfterIssue,
    };
    data.goodsOutwards ??= [];
    data.goodsOutwards.unshift(record);
    item.qty -= quantity;
    recordStockMovement({
      type: 'CONSUMPTION_ISSUE', item: item.name, category: item.category, quantity: -quantity, unit: item.unit,
      warehouseId: warehouse.id, sourceType: 'GOODS_OUTWARD', sourceId: issueId, note: purpose,
      useType, useLocation, issuedTo, issuedBy, issuedAt: record.issuedAt,
    });
    save();
    render();
    $('#record-dialog').close();
  }, true);

  $('#add-goods-outward')?.addEventListener('click', openGoodsOutward);
  const previousRender = render;
  render = () => { previousRender(); renderGoodsOutwards(); };
  renderGoodsOutwards();
})();
