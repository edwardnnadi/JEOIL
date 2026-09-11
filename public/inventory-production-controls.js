// Inventory ledger and production-run controls. This module is loaded last so
// it can add controlled workflows without changing legacy record handlers.
(function () {
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const ref = (config, number) => `${config.prefix}${String(number).padStart(config.padding, '0')}${config.suffix}`;
  function inventoryData() {
    data.stockMovements ??= [];
    data.activeProductionRuns ??= [];
    data.productionConfig ??= { batch: { prefix: 'PR-', suffix: '', padding: 4, nextNumber: 1 } };
    data.productionConfig.batch ??= { prefix: 'PR-', suffix: '', padding: 4, nextNumber: 1 };
    data.productionConfig.issueTypes ??= ['Belt cut', 'Generator did not start', 'Blocked machine'];
  }
  window.recordStockMovement = movement => {
    inventoryData();
    data.stockMovements.unshift({ id: id(), at: new Date().toISOString(), by: currentOperator?.()?.name || 'Current user', ...movement });
  };
  function nextBatch() { inventoryData(); return ref(data.productionConfig.batch, data.productionConfig.batch.nextNumber); }
  function warehouseOptions() { return (data.warehouses || []).map(w => `<option value="${w.id}">${esc(w.name)}${w.location ? ` · ${esc(w.location)}` : ''}</option>`).join(''); }
  function machineOptions() {
    const machines = (data.machines || []).filter(machine => machine.name);
    return machines.map(machine => `<option value="${esc(machine.name)}">${esc(machine.name)}${machine.type ? ` · ${esc(machine.type)}` : ''}</option>`).join('');
  }
  function staffOptions() {
    const people = (data.people || []).filter(person => person.name);
    return `<option value="">${people.length ? 'Select staff' : 'No staff have been added in Admin'}</option>${people.map(person => `<option value="${esc(person.name)}">${esc(person.name)} · ${esc(person.role || person.type || 'Staff')}</option>`).join('')}`;
  }
  function warehouseAvailable(itemName,warehouseId) {
    if (!warehouseId) return 0;
    const matchingMovements=(data.stockMovements||[]).filter(m=>String(m.warehouseId)===String(warehouseId)&&(m.item===itemName||m.itemName===itemName));
    const receiptQuantity=(data.goodsInwards||[]).filter(receipt=>receipt.decision==='Accepted'&&String(receipt.warehouseId)===String(warehouseId)&&receipt.item===itemName&&!matchingMovements.some(m=>m.sourceType==='GOODS_RECEIPT'&&String(m.sourceId)===String(receipt.id))).reduce((sum,receipt)=>sum+Number(receipt.qty||0),0);
    return matchingMovements.reduce((sum,movement)=>sum+Number(movement.quantity||0),receiptQuantity);
  }
  function materialRows(warehouseId='') { return (data.stock || []).map(s => ({...s,available:warehouseAvailable(s.name,warehouseId)})).filter(s => s.available > 0).map(s => `<tr><td><label><input type="checkbox" name="material" value="${esc(s.name)}"> ${esc(s.name)}</label></td><td>${Number(s.available).toLocaleString()} ${esc(s.unit)}</td><td><input name="qty-${esc(s.name)}" type="number" min="0" max="${s.available}" step="any" value="0" aria-label="Quantity of ${esc(s.name)}"></td></tr>`).join('') || '<tr><td colspan="3">No available stock in this warehouse. Receive or transfer accepted goods first.</td></tr>'; }
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
    $('#form-fields').innerHTML = `<div class="form-grid"><div class="field"><label>Production batch no.</label><input name="batch" readonly value="${esc(nextBatch())}"></div><div class="field"><label>Run date</label><input name="date" type="date" required value="${today()}"></div><div class="field full"><label>Machines</label><select name="machines" multiple required aria-describedby="machine-selection-help">${machineOptions()}</select><div class="item-note" id="machine-selection-help">Select every machine used for this run.</div></div><div class="field"><label>Materials warehouse</label><select name="sourceWarehouseId" required><option value="">Select warehouse</option>${warehouseOptions()}</select></div><div class="field"><label>Output warehouse</label><select name="warehouseId" required><option value="">Select warehouse</option>${warehouseOptions()}</select></div><div class="field"><label>Factory manager</label><select name="manager" required>${(data.people || []).filter(p => p.type === 'User').map(p => `<option>${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label>Staff / roles</label><select name="staff" required>${staffOptions()}</select></div><div class="field full"><label>Materials and resources to issue</label><table class="run-materials"><thead><tr><th>Material</th><th>Available</th><th>Quantity to issue</th></tr></thead><tbody id="production-materials">${materialRows()}</tbody></table><div class="item-note">Select a materials warehouse to load its available stock. Starting the run records the issue from that warehouse.</div></div></div>`;
    const form = $('#record-form'); form.dataset.type = 'production-start'; form.elements.sourceWarehouseId.onchange=()=>{form.querySelector('#production-materials').innerHTML=materialRows(form.elements.sourceWarehouseId.value);}; showSubmitAction('Start production run'); $('#record-dialog').showModal();
  }
  function selectedMaterials(form) { return [...form.querySelectorAll('[name="material"]:checked')].map(box => ({ name: box.value, quantity: Number(form.elements[`qty-${box.value}`].value || 0) })).filter(m => m.quantity > 0); }
  function startRun(form) {
    const machines=[...form.elements.machines.selectedOptions].map(option=>option.value); if (!machines.length) return alert('Select at least one machine.');
    const warehouse = (data.warehouses || []).find(w => String(w.id) === String(form.elements.warehouseId.value)); const sourceWarehouse=(data.warehouses || []).find(w=>String(w.id)===String(form.elements.sourceWarehouseId.value)); if (!warehouse || !sourceWarehouse) return alert('Select the materials and output warehouses.');
    const materials = selectedMaterials(form); if (!materials.length) return alert('Select at least one material or resource and enter its quantity.');
    const shortage = materials.find(m => m.quantity > warehouseAvailable(m.name,sourceWarehouse.id));
    if (shortage) return alert(`Insufficient available stock for ${shortage.name} in ${sourceWarehouse.name}.`);
    const low=materials.find(m=>{const item=stockItem(m.name);return item&&Number(item.reorder)>0&&warehouseAvailable(m.name,sourceWarehouse.id)-m.quantity<=Number(item.reorder);});
    if (low&&!confirm(`${low.name} will be at or below its reorder level after this issue. Continue with the production run?`))return;
    data.productionConfig.batch.nextNumber = Number(data.productionConfig.batch.nextNumber) + 1;
    materials.forEach(m => { const item = stockItem(m.name); item.qty -= m.quantity; recordStockMovement({ type:'PRODUCTION_ISSUE', item:m.name, category:item.category, quantity:-m.quantity, unit:item.unit, warehouseId:sourceWarehouse.id, sourceType:'PRODUCTION_RUN', sourceId:form.elements.batch.value, note:'Issued at production start' }); });
    data.activeProductionRuns.unshift({ id:id(), batch:form.elements.batch.value, date:form.elements.date.value, machine:machines.join(' · '), machines, sourceWarehouseId:sourceWarehouse.id, sourceWarehouseName:sourceWarehouse.name, warehouseId:warehouse.id, warehouseName:warehouse.name, manager:form.elements.manager.value, staff:form.elements.staff.value, materials, issues:[], startedAt:new Date().toISOString(), status:'IN_PROGRESS' });
    save(); render(); $('#record-dialog').close();
  }
  function elapsedLabel(startedAt) {
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    return `${hours ? `${hours} hr ` : ''}${minutes} min ${String(seconds).padStart(2, '0')} sec elapsed`;
  }
  function updateActiveRunTimer() {
    const run = data.activeProductionRuns?.find(r => r.status === 'IN_PROGRESS');
    const timer = $('#production-elapsed');
    if (run && timer) timer.textContent = `${run.machine} · ${elapsedLabel(run.startedAt)}`;
  }
  function activeRunBanner() {
    const run = data.activeProductionRuns?.find(r => r.status === 'IN_PROGRESS'); let banner = $('#active-production-run');
    if (!run) { banner?.remove(); return; }
    if (!banner) { document.querySelector('#production-view .view-head').insertAdjacentHTML('afterend', '<section class="production-active" id="active-production-run"></section>'); banner = $('#active-production-run'); }
    const issueCount = (run.issues || []).length;
    banner.innerHTML = `<strong>${esc(run.batch)} is running</strong><span id="production-elapsed"></span>${issueCount ? `<span class="production-issue-count">${issueCount} issue${issueCount === 1 ? '' : 's'} recorded</span>` : ''}<button class="secondary" id="report-production-issue">+ Report issue</button><button class="secondary" id="end-production-run">End production run</button>`;
    updateActiveRunTimer();
    $('#report-production-issue').onclick = () => openIssue(run);
    $('#end-production-run').onclick = () => openEnd(run);
  }
  function openIssue(run) {
    inventoryData();
    const issueOptions = data.productionConfig.issueTypes.map(issue => `<option value="${esc(issue)}">${esc(issue)}</option>`).join('');
    const people = (data.people || []).filter(person => person.name).map(person => `<option value="${esc(person.name)}">${esc(person.name)}${person.role ? ` · ${esc(person.role)}` : ''}</option>`).join('');
    $('#modal-label').textContent = 'PRODUCTION ISSUE'; $('#modal-title').textContent = `Report issue for ${run.batch}`;
    $('#form-fields').innerHTML = `<div class="form-grid"><div class="field full"><label>Issue encountered</label><select name="issueType" required><option value="">Select issue type</option>${issueOptions}</select><div class="item-note">Issue types are managed in Admin → Production controls.</div></div><div class="field full"><label>What happened?</label><textarea name="issueDetails" required placeholder="Add any useful details about the issue"></textarea></div><div class="field"><label>Who encountered the issue?</label><select name="encounteredBy" required><option value="">Select person</option>${people}</select></div><div class="field"><label>How was it solved?</label><textarea name="resolution" required placeholder="Describe the action taken"></textarea></div></div>`;
    const form = $('#record-form'); form.dataset.type = 'production-issue'; form.dataset.runId = run.id; showSubmitAction('Save issue'); $('#record-dialog').showModal();
  }
  function saveIssue(form) {
    const run = data.activeProductionRuns?.find(entry => String(entry.id) === String(form.dataset.runId)); if (!run) return;
    const issueType = form.elements.issueType.value.trim(), details = form.elements.issueDetails.value.trim(), encounteredBy = form.elements.encounteredBy.value.trim(), resolution = form.elements.resolution.value.trim();
    if (!issueType || !details || !encounteredBy || !resolution) return alert('Complete the issue, person encountered, and resolution fields.');
    run.issues ??= [];
    run.issues.unshift({ id:id(), type:issueType, details, encounteredBy, resolution, recordedAt:new Date().toISOString(), recordedBy:currentOperator?.()?.name || 'Current user' });
    save(); render(); $('#record-dialog').close();
  }
  function openEnd(run) {
    $('#modal-label').textContent = 'PRODUCTION RUN'; $('#modal-title').textContent = `End ${run.batch}`;
    const machine=(data.machines||[]).find(entry=>entry.name===run.machine),rating=machine?.manufacturerRating||{},ratingNote=[rating.capacity&&`Capacity: ${rating.capacity}`,rating.input&&`Input: ${rating.input}`,rating.output&&`Output: ${rating.output}`].filter(Boolean).join(' · ');
    $('#form-fields').innerHTML = `<div class="form-grid"><div class="field full"><label>Production timing</label><div class="item-note">Started ${new Date(run.startedAt).toLocaleString()}. Confirm the recorded end time, or provide the actual earlier completion time.</div></div><div class="field"><label>End time is correct</label><select name="timeCorrect"><option value="yes">Yes — end now</option><option value="no">No — finished earlier</option></select></div><div class="field"><label>Actual completion time</label><input name="endedAt" type="datetime-local"></div><div class="field full"><label>Manufacturer's rating</label><div class="item-note">${esc(ratingNote || 'Enter the rating below to save it to this machine.')}</div></div><div class="field"><label>Manufacturer capacity rating</label><input name="manufacturerCapacity" value="${esc(rating.capacity)}" placeholder="e.g. 15 tonnes/day"></div><div class="field"><label>Manufacturer input rating</label><input name="manufacturerInput" value="${esc(rating.input)}" placeholder="e.g. 1,000 kg/day"></div><div class="field"><label>Manufacturer output rating</label><input name="manufacturerOutput" value="${esc(rating.output)}" placeholder="e.g. 350 kg/day"></div><div class="field"><label>Actual capacity rating</label><input name="actualCapacity" placeholder="e.g. 12 tonnes/day"></div><div class="field"><label>Actual input</label><input name="actualInput" placeholder="e.g. 900 kg/day"></div><div class="field"><label>Actual output</label><input name="actualOutput" placeholder="e.g. 315 kg/day"></div><div class="field"><label>Oil output</label><input name="oil" type="number" min="0" step="any" value="0"></div><div class="field"><label>Cake output</label><input name="cake" type="number" min="0" step="any" value="0"></div><div class="field"><label>Sludge output</label><input name="sludge" type="number" min="0" step="any" value="0"></div><div class="field full"><label>Consumption correction</label><textarea name="adjustment" placeholder="Explain material return, loss, or additional consumption. Use Stock adjustments for quantity corrections."></textarea></div></div>`;
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
    const machine=(data.machines||[]).find(entry=>entry.name===run.machine);if(machine)machine.manufacturerRating={capacity:form.elements.manufacturerCapacity.value.trim(),input:form.elements.manufacturerInput.value.trim(),output:form.elements.manufacturerOutput.value.trim()};
    Object.assign(run,{status:'COMPLETED',endedAt,endedAtRecorded:now.toISOString(),timeCorrect:correct,actualRating:{capacity:form.elements.actualCapacity.value.trim(),input:form.elements.actualInput.value.trim(),output:form.elements.actualOutput.value.trim()},outputs,adjustment:form.elements.adjustment.value}); data.production.unshift(run); save();render();$('#record-dialog').close();
  }
  $('#record-form').addEventListener('submit', event => { const form=event.currentTarget; if (!['production-start','production-end','production-issue'].includes(form.dataset.type)) return; event.preventDefault();event.stopImmediatePropagation(); if(form.dataset.type==='production-start')startRun(form);else if(form.dataset.type==='production-end')endRun(form);else saveIssue(form); }, true);
  $('#add-production').onclick=openStart;
  const originalRender=render; render=()=>{ originalRender(); inventoryData(); activeRunBanner(); };
  window.setInterval(updateActiveRunTimer, 1000);
  const originalAdmin=renderAdmin; renderAdmin=()=>{ originalAdmin(); inventoryData(); const grid=$('#admin-view .dashboard-grid'); if(!$('#production-master-panel'))grid.insertAdjacentHTML('beforeend','<section class="panel table-panel" id="production-master-panel"><div class="panel-head"><div><h3>Production controls</h3><p>Manage batch numbering, issue types, and the machines available to factory managers.</p></div></div><form id="production-master-form" class="form-grid"><div class="field"><label>Batch prefix</label><input name="prefix"></div><div class="field"><label>Batch suffix</label><input name="suffix"></div><div class="field"><label>Batch padding</label><input name="padding" type="number" min="1" max="12"></div><div class="field"><label>Next batch number</label><input name="nextNumber" type="number" min="1"></div><div class="field full"><label>Production issue types</label><textarea name="issueTypes" rows="3" aria-describedby="production-issue-types-help" placeholder="One issue per line"></textarea><div class="item-note" id="production-issue-types-help">One issue per line. These are available when a user reports an issue during an active production run.</div></div><div class="field full"><label>Available machines</label><p class="item-note" id="production-machines-list"></p></div><div class="field"><button class="primary" type="submit">Save production controls</button></div><p class="save-status" id="production-controls-status" role="status" aria-live="polite"></p></form></section>'); const form=$('#production-master-form'),cfg=data.productionConfig,status=$('#production-controls-status'),button=form.querySelector('button[type="submit"]'); form.elements.prefix.value=cfg.batch.prefix;form.elements.suffix.value=cfg.batch.suffix;form.elements.padding.value=cfg.batch.padding;form.elements.nextNumber.value=cfg.batch.nextNumber;form.elements.issueTypes.value=cfg.issueTypes.join('\n');const machines=(data.machines||[]).filter(machine=>machine.name).map(machine=>`${machine.name}${machine.type?` · ${machine.type}`:''}`);$('#production-machines-list').textContent=machines.length?machines.join(' · '):'No machines have been added yet. Add them in Admin Machines.';form.onsubmit=async e=>{e.preventDefault();const previous=JSON.stringify(cfg);const issueTypes=[...new Set(form.elements.issueTypes.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean))];if(!issueTypes.length){status.textContent='Add at least one production issue type.';return;}cfg.batch={prefix:form.elements.prefix.value.trim(),suffix:form.elements.suffix.value.trim(),padding:Math.min(12,Math.max(1,Number(form.elements.padding.value)||4)),nextNumber:Math.max(1,Number(form.elements.nextNumber.value)||1)};cfg.issueTypes=issueTypes;button.disabled=true;status.textContent='Saving…';try{const saved=await save();if(!saved)throw new Error('the page was updated elsewhere; the latest saved settings have been reloaded');status.textContent='Production controls saved.';render();}catch(error){Object.assign(cfg,JSON.parse(previous));status.textContent=`Could not save production controls: ${error.message||'please try again.'}`;console.error(error);}finally{button.disabled=false;}}; };
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
  const style=document.createElement('style');style.textContent='.run-materials{width:100%;min-width:0}.run-materials th,.run-materials td{padding:7px;border-bottom:1px solid var(--line)}.run-materials input[type=number]{max-width:120px}.production-active{display:flex;align-items:center;gap:14px;padding:13px 16px;margin:-8px 0 18px;border-radius:8px;background:#e9f0df}.production-active span{color:var(--muted);flex:1}.production-active .production-issue-count{flex:0 0 auto;color:#7b5421;font-size:12px;font-weight:600}.save-status{min-height:1.25em;margin:0;color:var(--muted)}';document.head.append(style);
  render();
})();
