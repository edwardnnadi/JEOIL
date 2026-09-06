/* Production run controls follow the approved production register. */
(function () {
  const originalOpenModal = window.openModal;
  let originalSubmit = document.querySelector('#record-form');

  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const quantity = (value, unit) => `${Number(value || 0).toLocaleString()} ${unit}`;
  const stock = (name) => data.stock.find((item) => item.name.toLowerCase() === name.toLowerCase());
  const personOptions = () => (data.people || []).map((person) => `<option value="${esc(person.name)}">`).join('');
  const warehouseOptions = () => (data.warehouses || []).map((warehouse) => `<option value="${esc(warehouse.id)}">${esc(warehouse.name)}${warehouse.location ? ` · ${esc(warehouse.location)}` : ''}</option>`).join('');

  function productionFields() {
    const kernels = stock('Peanut kernels');
    return `<div class="form-grid production-flow-form">
      <div class="field full"><h3>1. Warehouse issue</h3><p class="item-note">The warehouse manager records the material balance and authorisation before production receives the batch.</p></div>
      <div class="field"><label>Date</label><input name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="field"><label>Production batch no.</label><input name="reference" placeholder="e.g. JEO-Tar001" required></div>
      <div class="field"><label>Warehouse balance before issue (Mt)</label><input name="warehouseBalanceBefore" type="number" min="0" step="0.001" required value="${kernels ? (kernels.qty / 1000).toFixed(3) : 0}"></div>
      <div class="field"><label>Qty issued by warehouse (Mt)</label><input name="kernels" type="number" min="0" step="0.001" required></div>
      <div class="field"><label>Issued by warehouse manager</label><input name="issuedBy" list="production-people" required></div>
      <div class="field"><label>Authorised by</label><input name="authorizedBy" list="production-people" required placeholder="Factory Manager"></div>
      <div class="field"><label>Received by production</label><input name="receivedBy" list="production-people" required></div>
      <div class="field full"><h3>2. Production run</h3><p class="item-note">Record the actual operating window and the people responsible for the run.</p></div>
      <div class="field"><label>Production start date &amp; time</label><input name="productionStart" type="datetime-local" required></div>
      <div class="field"><label>Production end date &amp; time</label><input name="productionEnd" type="datetime-local" required></div>
      <div class="field"><label>Supervisor</label><input name="supervisor" list="production-people" required></div>
      <div class="field"><label>Operator</label><input name="operator" list="production-people" required></div>
      <div class="field full"><h3>3. Outputs and consumption</h3><p class="item-note">Enter actual output and fuel use. Yield is calculated automatically from oil output and warehouse quantity issued.</p></div>
      <div class="field full"><label>Finished-output warehouse</label><select name="outputWarehouseId" required><option value="">${(data.warehouses || []).length ? 'Select destination warehouse' : 'Add a warehouse before recording production'}</option>${warehouseOptions()}</select><div class="item-note">All finished outputs from this run will be posted to the selected warehouse.</div></div>
      <div class="field"><label>Oil output (Mt)</label><input name="oilOutput" type="number" min="0" step="0.001" value="0" required></div>
      <div class="field"><label>Cake output (Mt)</label><input name="cake" type="number" min="0" step="0.001" value="0" required></div>
      <div class="field"><label>Sludge output (Mt)</label><input name="sludgeOutput" type="number" min="0" step="0.001" value="0" required></div>
      <div class="field"><label>Yield %</label><input name="yield" type="number" min="0" max="100" step="0.01" readonly aria-describedby="yield-help"><span id="yield-help" class="item-note">Calculated from oil output ÷ quantity issued.</span></div>
      <div class="field"><label>Firewood consumption</label><input name="firewood" type="number" min="0" step="0.1" value="0" required></div>
      <div class="field"><label>Diesel consumption</label><input name="diesel" type="number" min="0" step="0.1" value="0" required></div>
      <div class="field"><label>Status</label><select name="status"><option>In progress</option><option selected>Completed</option><option>On hold</option></select></div>
      <div class="field"><label>Production sign-off</label><input name="productionSignOff" list="production-people" required placeholder="Factory Manager"></div>
      <datalist id="production-people">${personOptions()}</datalist>
    </div>`;
  }

  window.openModal = function (type, pid) {
    originalOpenModal(type, pid);
    if (type !== 'production') return;
    // Keep non-production form behaviour untouched. Production gets a fresh
    // form with only this register's submission handler.
    const replacementForm = originalSubmit.cloneNode(true);
    originalSubmit.replaceWith(replacementForm);
    originalSubmit = replacementForm;
    originalSubmit.addEventListener('submit', submitProduction, true);
    originalSubmit.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', () => document.querySelector('#record-dialog').close());
    });
    document.querySelector('#form-fields').innerHTML = productionFields();
    const updateYield = () => {
      const form = document.querySelector('#record-form');
      const issued = Number(form.elements.kernels.value);
      const oil = Number(form.elements.oilOutput.value);
      form.elements.yield.value = issued > 0 ? ((oil / issued) * 100).toFixed(2) : '';
    };
    document.querySelector('[name="kernels"]').addEventListener('input', updateYield);
    document.querySelector('[name="oilOutput"]').addEventListener('input', updateYield);
  };

  window.production = function () {
    const tbody = document.querySelector('#production-table');
    tbody.innerHTML = data.production.map((run) => {
      if (!run.warehouseBalanceBefore && !run.productionStart) return `<tr><td>${date(run.date)}</td><td><strong>${esc(run.reference || 'Production run')}</strong></td><td>${esc(run.inputs || run.materials || '—')}</td><td>—</td><td>${esc(run.outputs || `${run.output || 0} ${run.unit || ''} ${run.product || ''}`)}</td><td>—</td><td>—</td></tr>`;
      return `<tr><td>${date(run.date)}</td><td><strong>${esc(run.reference)}</strong><div class="item-note">Received: ${esc(run.receivedBy)}</div></td><td>Before: ${quantity(run.warehouseBalanceBefore, 'Mt')}<br>Issued: ${quantity(run.kernels, 'Mt')}<br>After: ${quantity(run.warehouseBalanceAfter, 'Mt')}<div class="item-note">${esc(run.issuedBy)} · authorised by ${esc(run.authorizedBy)}</div></td><td>${esc(run.productionStart)} – ${esc(run.productionEnd)}<div class="item-note">Supervisor: ${esc(run.supervisor)}<br>Operator: ${esc(run.operator)}</div></td><td>Oil: ${quantity(run.oilOutput, 'Mt')}<br>Cake: ${quantity(run.cake, 'Mt')}<br>Sludge: ${quantity(run.sludgeOutput, 'Mt')}<div class="item-note">Yield: ${Number(run.yield || 0).toFixed(2)}% · ${esc(run.outputWarehouseName || 'Warehouse not recorded')}</div></td><td>Firewood: ${Number(run.firewood || 0).toLocaleString()}<br>Diesel: ${Number(run.diesel || 0).toLocaleString()}</td><td>${esc(run.status)}<div class="item-note">Signed by ${esc(run.productionSignOff)}</div></td></tr>`;
    }).join('') || '<tr><td colspan="7">No production records yet.</td></tr>';
  };

  const submitProduction = (event) => {
    if (originalSubmit.dataset.type !== 'production') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const values = Object.fromEntries(new FormData(originalSubmit).entries());
    const kernels = Number(values.kernels || 0);
    const oil = Number(values.oilOutput || 0);
    const firewood = Number(values.firewood || 0);
    const diesel = Number(values.diesel || 0);
    const kernelStock = stock('Peanut kernels');
    const firewoodStock = stock('Firewood');
    const dieselStock = stock('Diesel');
    const outputWarehouse = (data.warehouses || []).find((warehouse) => String(warehouse.id) === String(values.outputWarehouseId));
    if (!outputWarehouse) return alert('Select the warehouse that will receive the finished outputs.');
    const availableKernelsMt = kernelStock ? kernelStock.qty / 1000 : 0;
    if (!kernels || !kernelStock || kernels > availableKernelsMt) return alert(`Only ${availableKernelsMt.toFixed(3)} Mt of Peanut kernels is available.`);
    if (kernels > Number(values.warehouseBalanceBefore)) return alert('The quantity issued cannot exceed the warehouse balance before issue.');
    if ((firewood && (!firewoodStock || firewood > firewoodStock.qty)) || (diesel && (!dieselStock || diesel > dieselStock.qty))) return alert('Firewood or diesel consumption exceeds the available warehouse balance.');
    if (new Date(values.productionEnd) <= new Date(values.productionStart)) return alert('Production end must be after production start.');
    kernelStock.qty -= kernels * 1000;
    if (firewoodStock) firewoodStock.qty -= firewood;
    if (dieselStock) dieselStock.qty -= diesel;
    const finishedOutputs = [['Crude groundnut oil', oil, 'Mt'], ['Groundnut cake', Number(values.cake || 0), 'Mt'], ['Sludge', Number(values.sludgeOutput || 0), 'Mt']].filter(([, amount]) => amount > 0);
    finishedOutputs.forEach(([name, amount, unit]) => {
      const item = stock(name);
      if (item) item.qty += amount;
      else data.stock.push({ id: id(), name, category: 'Finished goods', qty: amount, unit, reorder: 0 });
    });
    data.finishedGoodsWarehouseEntries ??= [];
    const productionRunId = id();
    finishedOutputs.forEach(([item, qty, unit]) => data.finishedGoodsWarehouseEntries.unshift({ id: id(), productionRunId, productionRunRef: values.reference, warehouseId: outputWarehouse.id, warehouseName: outputWarehouse.name, item, category: 'Finished goods', qty, unit, source: 'Production output', postedAt: values.productionEnd }));
    data.production.unshift({ id: productionRunId, ...values, outputWarehouseName: outputWarehouse.name, kernels, oilOutput: oil, cake: Number(values.cake || 0), sludgeOutput: Number(values.sludgeOutput || 0), firewood, diesel, warehouseBalanceBefore: Number(values.warehouseBalanceBefore), warehouseBalanceAfter: Number(values.warehouseBalanceBefore) - kernels, yield: kernels ? (oil / kernels) * 100 : 0, inputs: `${quantity(kernels, 'Mt')} Peanut kernels · ${firewood} Firewood · ${diesel} Diesel`, outputs: `${quantity(oil, 'Mt')} Oil · ${quantity(values.cake, 'Mt')} Cake · ${quantity(values.sludgeOutput, 'Mt')} Sludge` });
    void save();
    render();
    document.querySelector('#record-dialog').close();
  };
})();
