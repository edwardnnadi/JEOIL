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
  const warehouses = () => data.warehouses || [];
  const warehouseOptions = () => warehouses().map(warehouse => `<option value="${esc(warehouse.id)}">${esc(warehouse.name)}</option>`).join('');
  const peopleOptions = () => `<option value="">Select person</option>${(data.people || []).filter(person => person.name).map(person => `<option value="${esc(person.name)}">${esc(person.name)}${person.role ? ` — ${esc(person.role)}` : ''}</option>`).join('')}`;
  const machineOptions = () => (data.machines || []).filter(machine => machine.name).map(machine => `<option value="${esc(machine.name)}">${esc(machine.name)}</option>`).join('');

  function availableAt(item, warehouseId) {
    const movements = (data.stockMovements || []).filter(movement => movement.item === item && String(movement.warehouseId) === String(warehouseId));
    const ledgerTotal = movements.reduce((total, movement) => total + Number(movement.quantity || 0), 0);
    const receipts = (data.goodsInwards || []).filter(receipt => receipt.item === item && String(receipt.warehouseId) === String(warehouseId) && receipt.status === 'Accepted')
      .reduce((total, receipt) => total + Number(receipt.stockOnHandQty || receipt.qty || 0), 0);
    return ledgerTotal || receipts;
  }

  function materialRows(selectedWarehouseIds) {
    const ids = selectedWarehouseIds.length ? selectedWarehouseIds : warehouses().map(warehouse => String(warehouse.id));
    let index = 0;
    return ids.flatMap(warehouseId => {
      const warehouse = warehouses().find(entry => String(entry.id) === String(warehouseId));
      return (data.stock || []).map(item => ({ item, available: availableAt(item.name, warehouseId) }))
        .filter(entry => entry.available > 0)
        .map(({ item, available }) => {
          const key = `material-${index++}`;
          return `<tr><td><label><input type="checkbox" class="multi-production-material" data-key="${key}" data-item="${esc(item.name)}" data-warehouse-id="${esc(warehouseId)}" data-warehouse-name="${esc(warehouse?.name || '')}"> ${esc(item.name)}</label></td><td>${esc(warehouse?.name || 'Warehouse')}</td><td>${available} ${esc(item.unit || '')}</td><td><input id="${key}" type="number" min="0" step="any" placeholder="0"></td></tr>`;
        });
    }).join('') || '<tr><td colspan="4" class="muted">No available stock in the selected warehouse(s).</td></tr>';
  }

  function openStartProduction() {
    if (!warehouses().length) return alert('Add at least one warehouse before starting production.');
    $('#modal-label').textContent = 'PRODUCTION';
    $('#modal-title').textContent = 'Start production run';
    $('#form-fields').innerHTML = `<div class="form-grid">
      <div class="field full"><label>Machines</label><select name="machines" multiple required>${machineOptions()}</select><small>Hold Ctrl/Cmd to select multiple machines.</small></div>
      <div class="field full"><label>Input warehouses</label><select name="sourceWarehouseIds" multiple required>${warehouseOptions()}</select><small>Select every warehouse materials will be issued from.</small></div>
      <div class="field"><label>Output warehouse</label><select name="warehouseId" required>${warehouseOptions()}</select></div>
      <div class="field"><label>Production manager</label><select name="manager" required>${peopleOptions()}</select></div>
      <div class="field full"><label>Staff</label><select name="staff" multiple>${peopleOptions()}</select></div>
      <div class="field full"><label>Materials to issue</label><table class="data-table"><thead><tr><th>Material</th><th>Input warehouse</th><th>Available</th><th>Issue quantity</th></tr></thead><tbody id="multi-production-materials">${materialRows([])}</tbody></table></div>
    </div>`;
    const form = $('#record-form');
    form.dataset.type = 'multi-warehouse-production-start';
    form.dataset.editKind = '';
    const sourceSelector = form.elements.sourceWarehouseIds;
    sourceSelector.onchange = () => {
      const ids = [...sourceSelector.selectedOptions].map(option => option.value);
      $('#multi-production-materials').innerHTML = materialRows(ids);
    };
    $('#save-record').textContent = 'Start production';
    $('#save-record').hidden = false;
    $('#save-record').disabled = false;
    $('#record-dialog .modal-actions').hidden = false;
    $('#record-dialog').showModal();
  }

  function startProduction(form) {
    const sourceIds = [...form.elements.sourceWarehouseIds.selectedOptions].map(option => option.value);
    const machines = [...form.elements.machines.selectedOptions].map(option => option.value);
    const outputWarehouse = warehouses().find(warehouse => String(warehouse.id) === String(form.elements.warehouseId.value));
    const sourceWarehouses = sourceIds.map(id => warehouses().find(warehouse => String(warehouse.id) === String(id))).filter(Boolean);
    const materials = [...form.querySelectorAll('.multi-production-material:checked')].map(box => {
      const quantity = Number(form.querySelector(`#${CSS.escape(box.dataset.key)}`).value || 0);
      return { name: box.dataset.item, quantity, warehouseId: box.dataset.warehouseId, warehouseName: box.dataset.warehouseName };
    }).filter(material => material.quantity > 0);
    if (!machines.length || !outputWarehouse || !sourceWarehouses.length || !materials.length) return alert('Select machines, input and output warehouses, and at least one material quantity.');
    if (materials.some(material => !sourceIds.includes(String(material.warehouseId)))) return alert('Each selected material must come from one of the selected input warehouses.');
    const shortage = materials.find(material => material.quantity > availableAt(material.name, material.warehouseId));
    if (shortage) return alert(`${shortage.name} does not have enough available stock in ${shortage.warehouseName}.`);
    data.productionConfig ??= { batch: 0 };
    data.productionConfig.batch = Number(data.productionConfig.batch || 0) + 1;
    const batch = `PR-${String(data.productionConfig.batch).padStart(4, '0')}`;
    materials.forEach(material => {
      const stock = (data.stock || []).find(item => item.name === material.name);
      if (stock) stock.qty = Number(stock.qty || 0) - material.quantity;
      window.recordStockMovement({ type: 'PRODUCTION_ISSUE', item: material.name, quantity: -material.quantity, warehouseId: material.warehouseId, sourceType: 'PRODUCTION_RUN', sourceId: batch, note: `Issued to ${batch}` });
    });
    data.activeProductionRuns ??= [];
    data.activeProductionRuns.unshift({
      id: makeId(), batch, date: today(), machine: machines.join(' · '), machines,
      sourceWarehouseId: sourceWarehouses[0].id, sourceWarehouseName: sourceWarehouses.map(warehouse => warehouse.name).join(' · '),
      sourceWarehouses: sourceWarehouses.map(warehouse => ({ id: warehouse.id, name: warehouse.name })),
      warehouseId: outputWarehouse.id, warehouseName: outputWarehouse.name,
      manager: form.elements.manager.value, staff: [...form.elements.staff.selectedOptions].map(option => option.value), materials, issues: [], testResults: [], startedAt: new Date().toISOString(), status: 'IN_PROGRESS',
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
    const banner = $('#active-production-run');
    const active = (data.activeProductionRuns || []).find(run => run.status === 'IN_PROGRESS');
    if (banner && active && !banner.querySelector('#record-production-test')) {
      const count = (active.testResults || []).length;
      banner.insertAdjacentHTML('beforeend', `<span class="muted" style="margin-left:auto">${count} test result${count === 1 ? '' : 's'}</span><button id="record-production-test" class="btn secondary" type="button">+ Record test result</button>`);
      $('#record-production-test').onclick = openTestResult;
    }
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
  render();
}());
