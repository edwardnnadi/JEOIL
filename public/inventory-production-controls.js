// Inventory ledger and production-run controls. This module is loaded last so
// it can add controlled workflows without changing legacy record handlers.
(function () {
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const ref = (config, number) => `${config.prefix}${String(number).padStart(config.padding, '0')}${config.suffix}`;
  function inventoryData() {
    data.stockMovements ??= [];
    data.activeProductionRuns ??= [];
    data.productionConfig ??= { batch: { prefix: 'PR-', suffix: '', padding: 4, nextNumber: 1 }, machines: [], resources: [] };
    data.productionConfig.batch ??= { prefix: 'PR-', suffix: '', padding: 4, nextNumber: 1 };
  }
  window.recordStockMovement = movement => {
    inventoryData();
    data.stockMovements.unshift({ id: id(), at: new Date().toISOString(), by: currentOperator?.()?.name || 'Current user', ...movement });
  };
  function nextBatch() { inventoryData(); return ref(data.productionConfig.batch, data.productionConfig.batch.nextNumber); }
  function warehouseOptions() { return (data.warehouses || []).map(w => `<option value="${w.id}">${esc(w.name)}${w.location ? ` · ${esc(w.location)}` : ''}</option>`).join(''); }
  function materialRows() { return (data.stock || []).filter(s => Number(s.qty) > 0).map(s => `<tr><td><label><input type="checkbox" name="material" value="${esc(s.name)}"> ${esc(s.name)}</label></td><td>${Number(s.qty).toLocaleString()} ${esc(s.unit)}</td><td><input name="qty-${esc(s.name)}" type="number" min="0" step="any" value="0" aria-label="Quantity of ${esc(s.name)}"></td></tr>`).join('') || '<tr><td colspan="3">No available stock. Receive accepted goods first.</td></tr>'; }
  function showSubmitAction(label) {
    const actions = document.querySelector('#record-dialog .modal-actions');
    const submit = $('#save-record');
    actions.hidden = false;
    submit.hidden = false;
    submit.disabled = false;
    submit.type = 'submit';
    submit.textContent = label;
  }
  function openStart() {
    inventoryData();
    $('#modal-label').textContent = 'PRODUCTION RUN'; $('#modal-title').textContent = 'Start production run';
    $('#form-fields').innerHTML = `<div class="form-grid"><div class="field"><label>Production batch no.</label><input name="batch" readonly value="${esc(nextBatch())}"></div><div class="field"><label>Run date</label><input name="date" type="date" required value="${today()}"></div><div class="field"><label>Machine</label><select name="machine" required><option value="">Select machine</option>${data.productionConfig.machines.map(m => `<option>${esc(m)}</option>`).join('')}</select></div><div class="field"><label>Materials warehouse</label><select name="sourceWarehouseId" required><option value="">Select warehouse</option>${warehouseOptions()}</select></div><div class="field"><label>Output warehouse</label><select name="warehouseId" required><option value="">Select warehouse</option>${warehouseOptions()}</select></div><div class="field"><label>Factory manager</label><select name="manager" required>${(data.people || []).filter(p => p.type === 'User').map(p => `<option>${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label>Staff / roles</label><input name="staff" required placeholder="Names and roles"></div><div class="field full"><label>Materials and resources to issue</label><table class="run-materials"><thead><tr><th>Material</th><th>Available</th><th>Quantity to issue</th></tr></thead><tbody>${materialRows()}</tbody></table><div class="item-note">Starting the run immediately records consumption from stock. Any correction is recorded later as an adjustment.</div></div></div>`;
    const form = $('#record-form'); form.dataset.type = 'production-start'; showSubmitAction('Start production run'); $('#record-dialog').showModal();
  }
  function selectedMaterials(form) { return [...form.querySelectorAll('[name="material"]:checked')].map(box => ({ name: box.value, quantity: Number(form.elements[`qty-${box.value}`].value || 0) })).filter(m => m.quantity > 0); }
  function startRun(form) {
    const materials = selectedMaterials(form); if (!materials.length) return alert('Select at least one material or resource and enter its quantity.');
    const shortage = materials.find(m => { const item = stockItem(m.name); return !item || m.quantity > Number(item.qty); });
    if (shortage) return alert(`Insufficient available stock for ${shortage.name}.`);
    const warehouse = (data.warehouses || []).find(w => String(w.id) === String(form.elements.warehouseId.value)); const sourceWarehouse=(data.warehouses || []).find(w=>String(w.id)===String(form.elements.sourceWarehouseId.value)); if (!warehouse || !sourceWarehouse) return alert('Select the materials and output warehouses.');
    data.productionConfig.batch.nextNumber = Number(data.productionConfig.batch.nextNumber) + 1;
    materials.forEach(m => { const item = stockItem(m.name); item.qty -= m.quantity; recordStockMovement({ type:'PRODUCTION_ISSUE', item:m.name, category:item.category, quantity:-m.quantity, unit:item.unit, warehouseId:sourceWarehouse.id, sourceType:'PRODUCTION_RUN', sourceId:form.elements.batch.value, note:'Issued at production start' }); });
    data.activeProductionRuns.unshift({ id:id(), batch:form.elements.batch.value, date:form.elements.date.value, machine:form.elements.machine.value, sourceWarehouseId:sourceWarehouse.id, sourceWarehouseName:sourceWarehouse.name, warehouseId:warehouse.id, warehouseName:warehouse.name, manager:form.elements.manager.value, staff:form.elements.staff.value, materials, startedAt:new Date().toISOString(), status:'IN_PROGRESS' });
    save(); render(); $('#record-dialog').close();
  }
  function activeRunBanner() {
    const run = data.activeProductionRuns?.find(r => r.status === 'IN_PROGRESS'); let banner = $('#active-production-run');
    if (!run) { banner?.remove(); return; }
    if (!banner) { document.querySelector('#production-view .view-head').insertAdjacentHTML('afterend', '<section class="production-active" id="active-production-run"></section>'); banner = $('#active-production-run'); }
    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(run.startedAt).getTime()) / 60000));
    banner.innerHTML = `<strong>${esc(run.batch)} is running</strong><span>${esc(run.machine)} · ${elapsed} min elapsed</span><button class="secondary" id="end-production-run">End production run</button>`;
    $('#end-production-run').onclick = () => openEnd(run);
  }
  function openEnd(run) {
    $('#modal-label').textContent = 'PRODUCTION RUN'; $('#modal-title').textContent = `End ${run.batch}`;
    $('#form-fields').innerHTML = `<div class="form-grid"><div class="field full"><label>Production timing</label><div class="item-note">Started ${new Date(run.startedAt).toLocaleString()}. Confirm the recorded end time, or provide the actual earlier completion time.</div></div><div class="field"><label>End time is correct</label><select name="timeCorrect"><option value="yes">Yes — end now</option><option value="no">No — finished earlier</option></select></div><div class="field"><label>Actual completion time</label><input name="endedAt" type="datetime-local"></div><div class="field"><label>Oil output</label><input name="oil" type="number" min="0" step="any" value="0"></div><div class="field"><label>Cake output</label><input name="cake" type="number" min="0" step="any" value="0"></div><div class="field"><label>Sludge output</label><input name="sludge" type="number" min="0" step="any" value="0"></div><div class="field full"><label>Consumption correction</label><textarea name="adjustment" placeholder="Explain material return, loss, or additional consumption. Use Stock adjustments for quantity corrections."></textarea></div></div>`;
    const form=$('#record-form'); form.dataset.type='production-end'; form.dataset.runId=run.id; showSubmitAction('End production run'); $('#record-dialog').showModal();
  }
  function endRun(form) {
    const run=data.activeProductionRuns.find(r => String(r.id) === String(form.dataset.runId)); if (!run) return;
    const now=new Date(), correct=form.elements.timeCorrect.value==='yes';
    if (!correct && !form.elements.endedAt.value) return alert('Enter the actual completion time.');
    const endedAt=correct ? now.toISOString() : new Date(form.elements.endedAt.value).toISOString();
    if (!correct && (new Date(endedAt) < new Date(run.startedAt) || new Date(endedAt) > now)) return alert('Enter an actual completion time between the start time and now.');
    const outputs=[['Crude groundnut oil',Number(form.elements.oil.value||0),'L'],['Groundnut cake',Number(form.elements.cake.value||0),'kg'],['Sludge',Number(form.elements.sludge.value||0),'kg']].filter(([,q])=>q>0);
    outputs.forEach(([name, quantity, unit])=>{let item=stockItem(name); if(item)item.qty+=quantity; else { item={id:id(),name,category:'Finished goods',qty:quantity,unit,reorder:0};data.stock.push(item); } recordStockMovement({type:'PRODUCTION_OUTPUT',item:name,category:'Finished goods',quantity,unit,warehouseId:run.warehouseId,sourceType:'PRODUCTION_RUN',sourceId:run.batch,note:'Finished production output'});});
    Object.assign(run,{status:'COMPLETED',endedAt,endedAtRecorded:now.toISOString(),timeCorrect:correct,outputs,adjustment:form.elements.adjustment.value}); data.production.unshift(run); save();render();$('#record-dialog').close();
  }
  $('#record-form').addEventListener('submit', event => { const form=event.currentTarget; if (!['production-start','production-end'].includes(form.dataset.type)) return; event.preventDefault();event.stopImmediatePropagation(); if(form.dataset.type==='production-start')startRun(form);else endRun(form); }, true);
  $('#add-production').onclick=openStart;
  const originalRender=render; render=()=>{ originalRender(); inventoryData(); activeRunBanner(); };
  const originalAdmin=renderAdmin; renderAdmin=()=>{ originalAdmin(); inventoryData(); const grid=$('#admin-view .dashboard-grid'); if(!$('#production-master-panel'))grid.insertAdjacentHTML('beforeend','<section class="panel table-panel" id="production-master-panel"><div class="panel-head"><div><h3>Production controls</h3><p>Manage batch numbering, machines, and resources available to factory managers.</p></div></div><form id="production-master-form" class="form-grid"><div class="field"><label>Batch prefix</label><input name="prefix"></div><div class="field"><label>Batch suffix</label><input name="suffix"></div><div class="field"><label>Batch padding</label><input name="padding" type="number" min="1" max="12"></div><div class="field"><label>Next batch number</label><input name="nextNumber" type="number" min="1"></div><div class="field full"><label>Machines (one per line)</label><textarea name="machines"></textarea></div><div class="field full"><label>Resources (one per line)</label><textarea name="resources"></textarea></div><div class="field"><button class="primary">Save production controls</button></div></form></section>'); const form=$('#production-master-form'),cfg=data.productionConfig; Object.assign(form.elements,{ });form.elements.prefix.value=cfg.batch.prefix;form.elements.suffix.value=cfg.batch.suffix;form.elements.padding.value=cfg.batch.padding;form.elements.nextNumber.value=cfg.batch.nextNumber;form.elements.machines.value=cfg.machines.join('\n');form.elements.resources.value=cfg.resources.join('\n');form.onsubmit=e=>{e.preventDefault();cfg.batch={prefix:form.elements.prefix.value,suffix:form.elements.suffix.value,padding:Math.max(1,Number(form.elements.padding.value)||4),nextNumber:Math.max(1,Number(form.elements.nextNumber.value)||1)};cfg.machines=form.elements.machines.value.split('\n').map(x=>x.trim()).filter(Boolean);cfg.resources=form.elements.resources.value.split('\n').map(x=>x.trim()).filter(Boolean);save();render();}; };
  function openInventoryAction(type) {
    const items=(data.stock||[]).map(s=>`<option value="${esc(s.name)}">${esc(s.name)} · ${Number(s.qty).toLocaleString()} ${esc(s.unit)}</option>`).join('');
    $('#modal-label').textContent='INVENTORY CONTROL'; $('#modal-title').textContent=type==='transfer'?'Transfer warehouse stock':'Adjust stock';
    $('#form-fields').innerHTML=type==='transfer'?`<div class="form-grid"><div class="field full"><label>Material</label><select name="item">${items}</select></div><div class="field"><label>From warehouse</label><select name="fromWarehouse">${warehouseOptions()}</select></div><div class="field"><label>To warehouse</label><select name="toWarehouse">${warehouseOptions()}</select></div><div class="field"><label>Quantity</label><input name="quantity" type="number" min="0.001" step="any" required></div><div class="field full"><label>Reason</label><textarea name="note" required></textarea></div></div>`:`<div class="form-grid"><div class="field full"><label>Material</label><select name="item">${items}</select></div><div class="field"><label>Warehouse</label><select name="warehouseId">${warehouseOptions()}</select></div><div class="field"><label>Quantity change</label><input name="quantity" type="number" step="any" required placeholder="Use - for reduction"></div><div class="field full"><label>Reason</label><textarea name="note" required></textarea></div></div>`;
    const form=$('#record-form');form.dataset.type=`inventory-${type}`;$('#save-record').textContent=type==='transfer'?'Record transfer':'Record adjustment';$('#record-dialog').showModal();
  }
  $('#record-form').addEventListener('submit',event=>{const form=event.currentTarget,type=form.dataset.type;if(!['inventory-transfer','inventory-adjustment'].includes(type))return;event.preventDefault();event.stopImmediatePropagation();const item=stockItem(form.elements.item.value),quantity=Number(form.elements.quantity.value);if(!item||!Number.isFinite(quantity)||quantity===0)return alert('Enter a valid quantity.');if(type==='inventory-transfer'){if(form.elements.fromWarehouse.value===form.elements.toWarehouse.value)return alert('Choose two different warehouses.');recordStockMovement({type:'TRANSFER_OUT',item:item.name,category:item.category,quantity:-quantity,unit:item.unit,warehouseId:+form.elements.fromWarehouse.value,sourceType:'TRANSFER',sourceId:id(),note:form.elements.note.value});recordStockMovement({type:'TRANSFER_IN',item:item.name,category:item.category,quantity,unit:item.unit,warehouseId:+form.elements.toWarehouse.value,sourceType:'TRANSFER',sourceId:id(),note:form.elements.note.value});}else{if(item.qty+quantity<0)return alert('This adjustment would make stock negative.');item.qty+=quantity;recordStockMovement({type:'ADJUSTMENT',item:item.name,category:item.category,quantity,unit:item.unit,warehouseId:+form.elements.warehouseId.value,sourceType:'ADJUSTMENT',sourceId:id(),note:form.elements.note.value});}save();render();$('#record-dialog').close();},true);
  function inventoryControls() {
    const stockHead=$('#stock-view .view-head'); if(stockHead&&!$('#inventory-actions'))stockHead.insertAdjacentHTML('beforeend','<div class="header-actions" id="inventory-actions"><button class="secondary" id="transfer-stock">Transfer stock</button><button class="primary" id="adjust-stock">Adjust stock</button></div>');
    $('#transfer-stock')?.addEventListener('click',()=>openInventoryAction('transfer')); $('#adjust-stock')?.addEventListener('click',()=>openInventoryAction('adjustment'));
    const view=$('#warehouse-view'); if(view&&!$('#warehouse-stock-filter'))view.querySelector('.view-head').insertAdjacentHTML('afterend',`<div class="filters" id="warehouse-stock-filter"><select id="warehouse-filter"><option value="">All warehouses</option>${warehouseOptions()}</select><select id="warehouse-item-filter"><option value="">All stock</option>${(data.stock||[]).map(s=>`<option>${esc(s.name)}</option>`).join('')}</select></div>`);
    const filter=()=>{const warehouseId=$('#warehouse-filter')?.value||'',item=$('#warehouse-item-filter')?.value||'';document.querySelectorAll('#warehouses-table > tr').forEach(row=>{if(row.classList.contains('warehouse-items-row'))return;const id=row.querySelector('.view-warehouse-items')?.dataset.id;const matchesWarehouse=!warehouseId||String(id)===String(warehouseId);const matchesItem=!item||(warehouseItems(data.warehouses.find(w=>String(w.id)===String(id)))||[]).some(entry=>(entry.item||'')===item);row.hidden=!(matchesWarehouse&&matchesItem);});};$('#warehouse-filter')?.addEventListener('change',filter);$('#warehouse-item-filter')?.addEventListener('change',filter);
    ['purchases','quality','production'].forEach(name=>{const head=$(`#${name}-view .view-head`);if(head&&!head.querySelector('.print-document'))head.insertAdjacentHTML('beforeend',`<button class="secondary print-document" data-print="${name}">Print</button>`);});document.querySelectorAll('.print-document').forEach(button=>button.onclick=()=>window.print());
  }
  const controlsRender=render;render=()=>{controlsRender();inventoryControls();};
  const style=document.createElement('style');style.textContent='.run-materials{width:100%;min-width:0}.run-materials th,.run-materials td{padding:7px;border-bottom:1px solid var(--line)}.run-materials input[type=number]{max-width:120px}.production-active{display:flex;align-items:center;gap:14px;padding:13px 16px;margin:-8px 0 18px;border-radius:8px;background:#e9f0df}.production-active span{color:var(--muted);flex:1}';document.head.append(style);
  render();
})();
