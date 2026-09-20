// Production additions kept separate from the legacy flow so existing runs,
// stock movements and permissions retain their current behaviour.
(function () {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const today = () => new Date().toISOString().slice(0, 10);
  const makeId = () => Date.now() + Math.floor(Math.random() * 1000);
  const isAdministrator = () => {
    const person = (data.people || []).find(entry => entry.email && String(entry.email).toLowerCase() === String(data.currentUserEmail || '').toLowerCase()) ||
      (data.people || []).find(entry => entry.type === 'User');
    return person?.role === 'Administrator';
  };
  const ledger = () => window.StockLedger;
  const warehouses = () => data.warehouses || [];
  const peopleOptions = () => `<option value="">Select person</option>${(data.people || []).filter(person => person.name).map(person => `<option value="${esc(person.name)}">${esc(person.name)}${person.role ? ` — ${esc(person.role)}` : ''}</option>`).join('')}`;
  const purchaseBatchNumber = receipt => ledger().batchNumber(receipt);
  const purchaseBatchAvailable = receipt => ledger().batchRemaining(receipt);
  const acceptedPurchaseBatches = warehouseIds => ledger().acceptedBatches(warehouseIds);
  const purchaseBatchOptions = warehouseIds => acceptedPurchaseBatches(warehouseIds).map(receipt =>
    `<option value="${esc(receipt.id)}">${esc(purchaseBatchNumber(receipt))} · ${esc(receipt.item)} · ${esc(receipt.warehouseName || '')} · ${purchaseBatchAvailable(receipt).toLocaleString()} ${esc(receipt.stockUnit || receipt.unit || '')} available · received ${esc(receipt.receivedDate || '')}</option>`,
  ).join('');

  // Tick boxes replace Ctrl/Cmd multi-selects: every option is visible and a
  // second choice cannot silently clear the first.
  const choiceBoxes = (name, options, emptyText) => options.length
    ? `<div class="choice-grid" role="group">${options.map(option => `<label class="choice-box"><input type="checkbox" name="${name}" value="${esc(option.value)}"><span><strong>${esc(option.label)}</strong>${option.note ? `<small>${esc(option.note)}</small>` : ''}</span></label>`).join('')}</div>`
    : `<p class="item-note">${esc(emptyText)}</p>`;
  const checkedValues = (form, name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
  const machineChoices = () => choiceBoxes('machines', (data.machines || []).filter(machine => machine.name).map(machine => ({ value: machine.name, label: machine.name, note: machine.type })), 'No machines have been added. Add them in Administration → Machines.');
  const warehouseChoices = () => choiceBoxes('sourceWarehouseIds', warehouses().map(warehouse => ({ value: warehouse.id, label: warehouse.name, note: warehouse.location })), 'No warehouses have been added.');
  const staffChoices = () => choiceBoxes('staff', (data.people || []).filter(person => person.name).map(person => ({ value: person.name, label: person.name, note: person.role })), 'No staff have been added in Administration.');

  // The inventory controls own the structured production reference setting.
  // Older enhancements treated this object as a number, which converted it to
  // NaN and produced references such as PR-0NaN.
  function productionReferenceConfig() {
    data.productionConfig ??= {};
    const current = data.productionConfig.batch;
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      data.productionConfig.batch = { prefix: 'PR-', suffix: '', padding: 4, nextNumber: 1 };
    }
    const config = data.productionConfig.batch;
    config.prefix = typeof config.prefix === 'string' ? config.prefix : 'PR-';
    config.suffix = typeof config.suffix === 'string' ? config.suffix : '';
    config.padding = Number.isInteger(Number(config.padding)) ? Math.max(1, Math.min(12, Number(config.padding))) : 4;
    config.nextNumber = Number.isInteger(Number(config.nextNumber)) && Number(config.nextNumber) > 0 ? Number(config.nextNumber) : 1;
    return config;
  }

  function nextProductionReference() {
    const config = productionReferenceConfig();
    const used = new Set([...(data.activeProductionRuns || []), ...(data.production || [])].map(run => run.batch).filter(Boolean));
    while (used.has(`${config.prefix}${String(config.nextNumber).padStart(config.padding, '0')}${config.suffix}`)) config.nextNumber += 1;
    const reference = `${config.prefix}${String(config.nextNumber).padStart(config.padding, '0')}${config.suffix}`;
    config.nextNumber += 1;
    return reference;
  }

  // Available quantity comes from the shared stock ledger, so it always matches
  // the Warehouses view for the same item and warehouse.
  const availableAt = (item, warehouseId) => ledger().warehouseBalance(item, warehouseId);
  const materialKey = (warehouseId, item) => `${warehouseId}::${item}`;
  const qtyInput = (form, key) => form.querySelector(`.production-material-qty[data-qty-for="${CSS.escape(key)}"]`);

  function materialRows(selectedWarehouseIds) {
    if (!selectedWarehouseIds.length) return '<tr><td colspan="5" class="muted">Tick the input warehouses you will pick materials from.</td></tr>';
    return selectedWarehouseIds.map(warehouseId => {
      const warehouse = warehouses().find(entry => String(entry.id) === String(warehouseId));
      const warehouseName = warehouse?.name || 'Warehouse';
      const rows = (data.stock || []).map(item => ({ item, available: availableAt(item.name, warehouseId) }))
        .filter(entry => entry.available > 0)
        .map(({ item, available }) => {
          const key = materialKey(warehouseId, item.name);
          return `<tr class="production-material-row" data-search="${esc(`${item.name} ${item.category || ''}`.toLowerCase())}"><td><label class="material-pick"><input type="checkbox" class="multi-production-material" data-key="${esc(key)}" data-item="${esc(item.name)}" data-warehouse-id="${esc(warehouseId)}" data-warehouse-name="${esc(warehouseName)}"><span>${esc(item.name)}</span></label></td><td>${esc(warehouseName)}</td><td>${available.toLocaleString()}</td><td>${esc(item.unit || '—')}</td><td><input class="production-material-qty" data-qty-for="${esc(key)}" type="number" min="0" max="${available}" step="any" placeholder="0" aria-label="Quantity of ${esc(item.name)} from ${esc(warehouseName)}"></td></tr>`;
        });
      return `<tr class="production-material-group"><th colspan="5">${esc(warehouseName)}</th></tr>${rows.join('') || `<tr><td colspan="5" class="muted">No stock is available in ${esc(warehouseName)}.</td></tr>`}`;
    }).join('');
  }

  function openStartProduction() {
    if (!warehouses().length) return alert('Add at least one warehouse before starting production.');
    $('#modal-label').textContent = 'PRODUCTION';
    $('#modal-title').textContent = 'Start production run';
    $('#form-fields').innerHTML = `<div class="form-grid">
      <div class="field full"><label>Machines</label>${machineChoices()}</div>
      <div class="field full"><label>Input warehouses</label>${warehouseChoices()}<small>Tick every warehouse materials will be picked from.</small></div>
      <div class="field full"><label>Purchase batch</label><select name="purchaseBatchReceiptId" required disabled><option value="">Tick an input warehouse first</option></select><small>Choose the accepted, QC-tested batch to be consumed in this run.</small></div>
      <div class="field"><label>Output warehouse</label><select name="warehouseId" required><option value="">Select output warehouse</option>${warehouses().map(warehouse => `<option value="${esc(warehouse.id)}">${esc(warehouse.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Production manager</label><select name="manager" required>${peopleOptions()}</select></div>
      <div class="field full"><label>Staff</label>${staffChoices()}</div>
      <div class="field full"><label>Materials to issue</label><input type="search" class="production-material-search" placeholder="Search materials" aria-label="Search materials"><div class="production-material-scroll"><table class="data-table"><thead><tr><th>Material</th><th>Input warehouse</th><th>Available</th><th>Unit</th><th>Issue quantity</th></tr></thead><tbody id="multi-production-materials">${materialRows([])}</tbody></table></div><div class="item-note">Enter a quantity to select a material. Units are taken from the stock item and are retained with the issue record.</div></div>
    </div>`;
    const form = $('#record-form');
    form.dataset.type = 'multi-warehouse-production-start';
    form.dataset.editKind = '';
    const materials = $('#multi-production-materials');
    const search = form.querySelector('.production-material-search');
    const applySearch = () => {
      const term = search.value.trim().toLowerCase();
      materials.querySelectorAll('.production-material-row').forEach(row => { row.hidden = Boolean(term) && !row.dataset.search.includes(term); });
    };
    const refreshSources = () => {
      const ids = checkedValues(form, 'sourceWarehouseIds');
      const batchSelector = form.elements.purchaseBatchReceiptId;
      const selectedBatch = batchSelector.value;
      batchSelector.disabled = !ids.length;
      batchSelector.innerHTML = `<option value="">${ids.length ? 'Select accepted purchase batch' : 'Tick an input warehouse first'}</option>${purchaseBatchOptions(ids)}`;
      if ([...batchSelector.options].some(option => option.value === selectedBatch)) batchSelector.value = selectedBatch;
      // Keep what has been entered for warehouses that are still ticked.
      const typed = new Map([...materials.querySelectorAll('.production-material-qty')].filter(input => input.value !== '').map(input => [input.dataset.qtyFor, input.value]));
      const ticked = new Set([...materials.querySelectorAll('.multi-production-material:checked')].map(box => box.dataset.key));
      materials.innerHTML = materialRows(ids);
      materials.querySelectorAll('.production-material-qty').forEach(input => { if (typed.has(input.dataset.qtyFor)) input.value = typed.get(input.dataset.qtyFor); });
      materials.querySelectorAll('.multi-production-material').forEach(box => { box.checked = ticked.has(box.dataset.key); });
      applySearch();
    };
    form.querySelectorAll('input[name="sourceWarehouseIds"]').forEach(box => box.addEventListener('change', refreshSources));
    search.addEventListener('input', applySearch);
    materials.addEventListener('input', event => {
      const input = event.target.closest('.production-material-qty');
      if (!input) return;
      const box = materials.querySelector(`.multi-production-material[data-key="${CSS.escape(input.dataset.qtyFor)}"]`);
      if (box) box.checked = Number(input.value) > 0;
    });
    materials.addEventListener('change', event => {
      const box = event.target.closest('.multi-production-material');
      if (box && box.checked) qtyInput(form, box.dataset.key)?.focus();
    });
    $('#save-record').textContent = 'Start production';
    $('#save-record').hidden = false;
    $('#save-record').disabled = false;
    $('#record-dialog .modal-actions').hidden = false;
    $('#record-dialog').showModal();
  }

  function startProduction(form) {
    const sourceIds = checkedValues(form, 'sourceWarehouseIds');
    const machines = checkedValues(form, 'machines');
    const staff = checkedValues(form, 'staff');
    const outputWarehouse = warehouses().find(warehouse => String(warehouse.id) === String(form.elements.warehouseId.value));
    const sourceWarehouses = sourceIds.map(id => warehouses().find(warehouse => String(warehouse.id) === String(id))).filter(Boolean);
    const receipt = acceptedPurchaseBatches(sourceIds).find(entry => String(entry.id) === String(form.elements.purchaseBatchReceiptId.value));
    const materials = [...form.querySelectorAll('.multi-production-material:checked')].map(box => {
      const quantity = Number(qtyInput(form, box.dataset.key)?.value || 0);
      const stockItem = (data.stock || []).find(item => item.name === box.dataset.item);
      return { name: box.dataset.item, quantity, unit: stockItem?.unit || '', warehouseId: box.dataset.warehouseId, warehouseName: box.dataset.warehouseName };
    }).filter(material => material.quantity > 0);
    if (!machines.length) return alert('Tick at least one machine.');
    if (!sourceWarehouses.length) return alert('Tick at least one input warehouse.');
    if (!outputWarehouse) return alert('Select the output warehouse.');
    if (!materials.length) return alert('Enter a quantity for at least one material.');
    if (!receipt) return alert('Select an accepted purchase batch for this production run.');
    const batchNumber = purchaseBatchNumber(receipt);
    const batchMaterial = materials.find(material => material.name === receipt.item && String(material.warehouseId) === String(receipt.warehouseId));
    if (!batchMaterial) return alert(`Include ${receipt.item} from purchase batch ${batchNumber} in the materials issued.`);
    if (batchMaterial.quantity > purchaseBatchAvailable(receipt)) return alert(`Only ${purchaseBatchAvailable(receipt).toLocaleString()} ${receipt.stockUnit || receipt.unit || ''} remains in purchase batch ${batchNumber}.`);
    if (materials.some(material => !sourceIds.includes(String(material.warehouseId)))) return alert('Each selected material must come from one of the ticked input warehouses.');
    const shortage = materials.find(material => material.quantity > availableAt(material.name, material.warehouseId));
    if (shortage) return alert(`Only ${availableAt(shortage.name, shortage.warehouseId).toLocaleString()} ${shortage.unit} of ${shortage.name} is available in ${shortage.warehouseName}.`);
    const batch = nextProductionReference();
    materials.forEach(material => {
      const stock = (data.stock || []).find(item => item.name === material.name);
      if (stock) stock.qty = Number(stock.qty || 0) - material.quantity;
      const isPurchaseBatchMaterial = material.name === receipt.item && String(material.warehouseId) === String(receipt.warehouseId);
      window.recordStockMovement({ type: 'PRODUCTION_ISSUE', item: material.name, quantity: -material.quantity, unit: material.unit, warehouseId: material.warehouseId, sourceType: 'PRODUCTION_RUN', sourceId: batch, lotNo: isPurchaseBatchMaterial ? batchNumber : '', note: `Issued to ${batch} from ${material.warehouseName}${isPurchaseBatchMaterial ? ` (purchase batch ${batchNumber})` : ''}` });
    });
    data.activeProductionRuns ??= [];
    const machineRatings = machines.map(name => {
      const machine = (data.machines || []).find(entry => entry.name === name);
      return {
        id: machine?.id || '',
        name,
        manufacturerRating: { ...(machine?.manufacturerRating || {}) },
      };
    });
    data.activeProductionRuns.unshift({
      id: makeId(), batch, date: today(), machine: machines.join(' · '), machines,
      machineRatings,
      sourceWarehouseId: sourceWarehouses[0].id, sourceWarehouseName: sourceWarehouses.map(warehouse => warehouse.name).join(' · '),
      sourceWarehouses: sourceWarehouses.map(warehouse => ({ id: warehouse.id, name: warehouse.name })),
      warehouseId: outputWarehouse.id, warehouseName: outputWarehouse.name,
      manager: form.elements.manager.value, staff, purchaseBatchNumber: batchNumber, purchaseId: receipt.purchaseId || '', goodsInwardsId: receipt.goodsInwardsId || receipt.id,
      materials: materials.map(material => material.name === receipt.item && String(material.warehouseId) === String(receipt.warehouseId) ? { ...material, batchNumber, lotNo: batchNumber, goodsInwardsId: receipt.goodsInwardsId || receipt.id } : material), issues: [], testResults: [], startedAt: new Date().toISOString(), status: 'IN_PROGRESS',
    });
    save(); render(); $('#record-dialog').close();
  }

  function openTestResult() {
    const run = (data.activeProductionRuns || []).find(candidate => candidate.status === 'IN_PROGRESS');
    if (!run) return alert('There is no active production run.');
    $('#modal-label').textContent = 'PRODUCTION TEST';
    $('#modal-title').textContent = `Record test result — ${run.batch}`;
    $('#form-fields').innerHTML = `<div class="form-grid">
      <div class="field"><label>Test name</label><input name="testName" required placeholder="e.g. Oil clarity"></div>
      <div class="field"><label>Result</label><select name="outcome" required><option value="Pass">Pass</option><option value="Fail">Fail</option><option value="Observation">Observation</option></select></div>
      <div class="field"><label>Reading</label><input name="value" required placeholder="e.g. 0.12"></div>
      <div class="field"><label>Unit</label><input name="unit" placeholder="e.g. %"></div>
      <div class="field full"><label>Tested by</label><select name="testedBy" required>${peopleOptions()}</select></div>
      <div class="field full"><label>Notes</label><textarea name="notes" placeholder="Method, observations, or follow-up required"></textarea></div>
    </div>`;
    const form = $('#record-form');
    form.dataset.type = 'production-test-result'; form.dataset.runId = run.id;
    $('#save-record').textContent = 'Save test result'; $('#save-record').hidden = false; $('#save-record').disabled = false;
    $('#record-dialog .modal-actions').hidden = false; $('#record-dialog').showModal();
  }

  function saveTestResult(form) {
    const run = (data.activeProductionRuns || []).find(candidate => String(candidate.id) === String(form.dataset.runId));
    if (!run || run.status !== 'IN_PROGRESS') return alert('That production run is no longer active.');
    const values = formData(form);
    run.testResults ??= [];
    run.testResults.unshift({ id: makeId(), testName: values.testName, outcome: values.outcome, value: values.value, unit: values.unit, testedBy: values.testedBy, notes: values.notes, recordedAt: new Date().toISOString() });
    save(); render(); $('#record-dialog').close();
  }

  const originalRender = render;
  render = () => {
    originalRender();
    if (!isAdministrator()) document.querySelectorAll('.edit-record[data-edit-kind="production"]').forEach(button => button.closest('td')?.remove());
    document.querySelectorAll('#production-table tr').forEach((row, index) => {
      const results = data.production?.[index]?.testResults || [];
      if (results.length && !row.querySelector('.production-test-summary')) {
        const cell = row.cells[Math.max(0, row.cells.length - 1)];
        cell?.insertAdjacentHTML('beforeend', `<div class="production-test-summary muted" style="margin-top:6px">Tests: ${results.map(result => `${esc(result.testName)} (${esc(result.outcome)})`).join(', ')}</div>`);
      }
    });
  };

  $('#add-production').onclick = openStartProduction;
  document.addEventListener('click', event => {
    const button = event.target.closest('.edit-record[data-edit-kind="production"]');
    if (button && !isAdministrator()) { event.preventDefault(); event.stopImmediatePropagation(); alert('Only an Administrator can edit a completed production record.'); }
  }, true);
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.dataset.type === 'multi-warehouse-production-start') { event.preventDefault(); event.stopImmediatePropagation(); startProduction(form); }
    if (form.dataset.type === 'production-test-result') { event.preventDefault(); event.stopImmediatePropagation(); saveTestResult(form); }
    if (form.dataset.type === 'edit' && form.dataset.editKind === 'production' && !isAdministrator()) { event.preventDefault(); event.stopImmediatePropagation(); alert('Only an Administrator can edit a completed production record.'); }
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .choice-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:8px; }
    .choice-box { display:flex; align-items:flex-start; gap:10px; margin:0; padding:10px 12px; border:1px solid var(--line,#ddd0b8); border-radius:8px; background:#fff; cursor:pointer; font-weight:400; }
    .choice-box:has(input:checked) { border-color:#c89b3c; background:#fbf3df; }
    .choice-box:has(input:focus-visible) { outline:2px solid #c89b3c; outline-offset:2px; }
    .choice-box input { width:18px; height:18px; margin:1px 0 0; flex:0 0 auto; }
    .choice-box span { display:grid; gap:2px; min-width:0; }
    .choice-box small { color:var(--muted,#776b58); font-size:12px; }
    .production-material-search { margin-bottom:8px; }
    .production-material-scroll { overflow-x:auto; max-height:360px; overflow-y:auto; border:1px solid var(--line,#ddd0b8); border-radius:8px; }
    .production-material-scroll table { margin:0; min-width:560px; }
    .production-material-group th { position:sticky; top:0; background:#f3ecdd; text-align:left; font-size:12px; letter-spacing:.04em; text-transform:uppercase; }
    .material-pick { display:flex; align-items:center; gap:8px; margin:0; font-weight:600; cursor:pointer; }
    .material-pick input { width:18px; height:18px; margin:0; }
    .production-material-qty { max-width:130px; }
  `;
  document.head.append(style);
  render();
}());
