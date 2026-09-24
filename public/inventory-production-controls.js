// Inventory ledger and production-run controls. This module is loaded last so
// it can add controlled workflows without changing legacy record handlers.
(function () {
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  let stockMovementSequence = 0;
  // A production completion may post oil, cake, and sludge in one event loop.
  // Date.now() alone can therefore create duplicate movement IDs.
  const stockMovementId = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${++stockMovementSequence}`;
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
    data.stockMovements.unshift({ id: stockMovementId(), at: new Date().toISOString(), by: currentOperator?.()?.name || 'Current user', ...movement });
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
  // Quantities come from the shared stock ledger (stock-ledger.js).
  function warehouseAvailable(itemName,warehouseId) { return window.StockLedger.warehouseBalance(itemName,warehouseId); }
  // Older stock cards pre-date warehouse-level movements. Their quantity is
  // real stock, but it has no location yet, so the first transfer must assign
  // it to the selected source warehouse rather than incorrectly reporting 0.
  function legacyUnallocatedStock(item) {
    const located = window.StockLedger.warehouseBalances(item.name).reduce((total, balance) => total + Number(balance.quantity || 0), 0);
    return Math.max(0, Number(item.qty || 0) - located);
  }
  function sourceAvailableForTransfer(item, warehouseId) {
    const recorded = warehouseAvailable(item.name, warehouseId);
    return recorded > 0 ? { quantity: recorded, needsAllocation: false } : { quantity: legacyUnallocatedStock(item), needsAllocation: legacyUnallocatedStock(item) > 0 };
  }
  // A production run must name the accepted purchase batch it consumes. This
  // keeps the production record connected to the receiving and QC records.
  function acceptedPurchaseBatches(warehouseId='') {
    return window.StockLedger.acceptedBatches(warehouseId ? [warehouseId] : (data.warehouses || []).map(warehouse => warehouse.id));
  }
  function purchaseBatchNumber(receipt) { return window.StockLedger.batchNumber(receipt); }
  function purchaseBatchAvailable(receipt) { return window.StockLedger.batchRemaining(receipt); }
  function purchaseBatchOptions(warehouseId='') {
    return acceptedPurchaseBatches(warehouseId).map(receipt => {
      const batch = purchaseBatchNumber(receipt), available = purchaseBatchAvailable(receipt);
      return `<option value="${esc(receipt.id)}">${esc(batch)} · ${esc(receipt.item)} · ${available.toLocaleString()} ${esc(receipt.stockUnit || receipt.unit || '')} available · received ${esc(receipt.receivedDate || '')}</option>`;
    }).join('');
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
    $('#form-fields').innerHTML = `<div class="form-grid"><div class="field"><label>Production batch no.</label><input name="batch" readonly value="${esc(nextBatch())}"></div><div class="field"><label>Run date</label><input name="date" type="date" required value="${today()}"></div><div class="field full"><label>Machines</label><select name="machines" multiple required aria-describedby="machine-selection-help">${machineOptions()}</select><div class="item-note" id="machine-selection-help">Select every machine used for this run.</div></div><div class="field"><label>Materials warehouse</label><select name="sourceWarehouseId" required><option value="">Select warehouse</option>${warehouseOptions()}</select></div><div class="field"><label>Purchase batch</label><select name="purchaseBatchReceiptId" required disabled><option value="">Select a materials warehouse first</option></select><div class="item-note">Only accepted, QC-tested batches are available for production.</div></div><div class="field"><label>Output warehouse</label><select name="warehouseId" required><option value="">Select warehouse</option>${warehouseOptions()}</select></div><div class="field"><label>Factory manager</label><select name="manager" required>${(data.people || []).filter(p => p.type === 'User').map(p => `<option>${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label>Staff / roles</label><select name="staff" required>${staffOptions()}</select></div><div class="field full"><label>Materials and resources to issue</label><table class="run-materials"><thead><tr><th>Material</th><th>Available</th><th>Quantity to issue</th></tr></thead><tbody id="production-materials">${materialRows()}</tbody></table><div class="item-note">Select a materials warehouse and accepted purchase batch before starting the run. The selected batch is carried to the production and inventory records.</div></div></div>`;
    const form = $('#record-form');
    const refreshPurchaseBatches=()=>{
      const selector=form.elements.purchaseBatchReceiptId, warehouseId=form.elements.sourceWarehouseId.value;
      selector.disabled=!warehouseId;
      selector.innerHTML=`<option value="">${warehouseId?'Select accepted purchase batch':'Select a materials warehouse first'}</option>${purchaseBatchOptions(warehouseId)}`;
      form.querySelector('#production-materials').innerHTML=materialRows(warehouseId);
    };
    form.dataset.type = 'production-start'; form.elements.sourceWarehouseId.onchange=refreshPurchaseBatches; refreshPurchaseBatches(); showSubmitAction('Start production run'); $('#record-dialog').showModal();
  }
  function selectedMaterials(form) { return [...form.querySelectorAll('[name="material"]:checked')].map(box => ({ name: box.value, quantity: Number(form.elements[`qty-${box.value}`].value || 0) })).filter(m => m.quantity > 0); }
  function startRun(form) {
    const machines=[...form.elements.machines.selectedOptions].map(option=>option.value); if (!machines.length) return alert('Select at least one machine.');
    const warehouse = (data.warehouses || []).find(w => String(w.id) === String(form.elements.warehouseId.value)); const sourceWarehouse=(data.warehouses || []).find(w=>String(w.id)===String(form.elements.sourceWarehouseId.value)); if (!warehouse || !sourceWarehouse) return alert('Select the materials and output warehouses.');
    const receipt=acceptedPurchaseBatches(sourceWarehouse.id).find(entry=>String(entry.id)===String(form.elements.purchaseBatchReceiptId.value));
    if (!receipt) return alert('Select an accepted purchase batch for this production run.');
    const purchaseBatchNumberValue=purchaseBatchNumber(receipt);
    const materials = selectedMaterials(form); if (!materials.length) return alert('Select at least one material or resource and enter its quantity.');
    const batchMaterial=materials.find(material=>material.name===receipt.item);
    if (!batchMaterial) return alert(`Include ${receipt.item} from purchase batch ${purchaseBatchNumberValue} in the materials issued.`);
    if (batchMaterial.quantity>purchaseBatchAvailable(receipt)) return alert(`Only ${purchaseBatchAvailable(receipt).toLocaleString()} ${receipt.stockUnit||receipt.unit||''} remains in purchase batch ${purchaseBatchNumberValue}.`);
    const shortage = materials.find(m => m.quantity > warehouseAvailable(m.name,sourceWarehouse.id));
    if (shortage) return alert(`Insufficient available stock for ${shortage.name} in ${sourceWarehouse.name}.`);
    const low=materials.find(m=>{const item=stockItem(m.name);return item&&Number(item.reorder)>0&&warehouseAvailable(m.name,sourceWarehouse.id)-m.quantity<=Number(item.reorder);});
    if (low&&!confirm(`${low.name} will be at or below its reorder level after this issue. Continue with the production run?`))return;
    data.productionConfig.batch.nextNumber = Number(data.productionConfig.batch.nextNumber) + 1;
    materials.forEach(m => { const item = stockItem(m.name), isPurchaseBatchMaterial=m.name===receipt.item; item.qty -= m.quantity; recordStockMovement({ type:'PRODUCTION_ISSUE', item:m.name, category:item.category, quantity:-m.quantity, unit:item.unit, warehouseId:sourceWarehouse.id, sourceType:'PRODUCTION_RUN', sourceId:form.elements.batch.value, lotNo:isPurchaseBatchMaterial?purchaseBatchNumberValue:'', note:`Issued at production start${isPurchaseBatchMaterial?` from purchase batch ${purchaseBatchNumberValue}`:''}` }); });
    const machineRatings=machines.map(name=>{const machine=(data.machines||[]).find(entry=>entry.name===name);return{id:machine?.id||'',name,manufacturerRating:{...(machine?.manufacturerRating||{})}};});
    materials.forEach(material=>{material.unit=stockItem(material.name)?.unit||'';if(material.name===receipt.item){material.batchNumber=purchaseBatchNumberValue;material.lotNo=purchaseBatchNumberValue;material.goodsInwardsId=receipt.goodsInwardsId||receipt.id;}});
    data.activeProductionRuns.unshift({ id:id(), batch:form.elements.batch.value, date:form.elements.date.value, machine:machines.join(' · '), machines, machineRatings, purchaseBatchNumber:purchaseBatchNumberValue, purchaseId:receipt.purchaseId||'', goodsInwardsId:receipt.goodsInwardsId||receipt.id, sourceWarehouseId:sourceWarehouse.id, sourceWarehouseName:sourceWarehouse.name, warehouseId:warehouse.id, warehouseName:warehouse.name, manager:form.elements.manager.value, staff:form.elements.staff.value, materials, issues:[], startedAt:new Date().toISOString(), status:'IN_PROGRESS' });
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
    banner.innerHTML = `<strong>${esc(run.batch)} is running</strong><span id="production-elapsed"></span><button class="secondary" id="end-production-run">End production</button>`;
    updateActiveRunTimer();
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
    const selectedMachines=Array.isArray(run.machines)&&run.machines.length?run.machines:String(run.machine||'').split(' · ').filter(Boolean);
    const ratingSnapshot=(run.machineRatings||[]).find(entry=>entry.name===selectedMachines[0]);
    const machine=(data.machines||[]).find(entry=>String(entry.id)===String(ratingSnapshot?.id)||entry.name===selectedMachines[0]);
    const rating=ratingSnapshot?.manufacturerRating||machine?.manufacturerRating||{};
    const machineName=ratingSnapshot?.name||machine?.name||selectedMachines[0]||'selected machine';
    const ratingNote=[rating.capacity&&`Capacity: ${rating.capacity}`,rating.input&&`Input: ${rating.input}`,rating.output&&`Output: ${rating.output}`].filter(Boolean).join(' · ');
    const actualInput=(run.materials||[]).map(material=>`${Number(material.quantity||0).toLocaleString()}${material.unit?` ${material.unit}`:''} ${material.name}`).join(' · ') || 'No issued materials recorded';
    const returnRows=(run.materials||[]).map((material,index)=>`<tr><td>${esc(material.name)}${material.lotNo?`<div class="item-note">Lot: ${esc(material.lotNo)}</div>`:''}</td><td>${Number(material.quantity||0).toLocaleString()} ${esc(material.unit||'')}</td><td><input name="return-${index}" type="number" min="0" max="${Number(material.quantity||0)}" step="any" value="0" aria-label="Quantity of ${esc(material.name)} returned to stock"></td></tr>`).join('') || '<tr><td colspan="3">No issued materials recorded.</td></tr>';
    const outputWarehouseOptions=(data.warehouses||[]).map(warehouse=>`<option value="${esc(warehouse.id)}" ${String(warehouse.id)===String(run.warehouseId)?'selected':''}>${esc(warehouse.name)}${warehouse.location?` · ${esc(warehouse.location)}`:''}</option>`).join('');
    const outputUnit=(name,fallback)=>stockItem(name)?.unit||fallback;
    $('#form-fields').innerHTML = `<div class="form-grid">
      <div class="field full"><h3>1. Confirm when the run ended</h3><div class="item-note">Started ${new Date(run.startedAt).toLocaleString()}. Use the time the machines stopped producing, not the time you started this form.</div></div>
      <div class="field"><label>Did the run end now?<select name="timeCorrect"><option value="yes">Yes — end it now</option><option value="no">No — it finished earlier</option></select></label><div class="item-note">Choose “finished earlier” only when the recorded end time would be wrong.</div></div>
      <div class="field"><label>Actual completion time<input name="endedAt" type="datetime-local"></label><div class="item-note">Fill this only if the run finished earlier. It must be after the start time.</div></div>
      <div class="field full"><h3>2. Tell us what came out of the run</h3><p class="item-note">Enter the actual quantities physically produced. These quantities are added to finished-goods stock in the selected warehouse. Do not leave them at zero if product was produced.</p></div>
      <div class="field full"><label>Finished-goods warehouse<select name="warehouseId" required><option value="">Select output warehouse</option>${outputWarehouseOptions}</select></label><div class="item-note">Choose where the oil, cake and sludge are physically stored after this run.</div></div>
      <div class="field"><label>Crude groundnut oil produced<input name="oil" type="number" min="0" step="any" value="0"></label><div class="item-note">Enter the measured litres of crude oil. Enter 0 only if none was produced.</div></div>
      <div class="field"><label>Oil unit<input name="oilUnit" value="${esc(outputUnit('Crude groundnut oil','L'))}" readonly></label><div class="item-note">The stock unit is fixed for consistent inventory records.</div></div>
      <div class="field"><label>Groundnut cake produced<input name="cake" type="number" min="0" step="any" value="0"></label><div class="item-note">Enter the measured weight of cake. Enter 0 only if none was produced.</div></div>
      <div class="field"><label>Cake unit<input name="cakeUnit" value="${esc(outputUnit('Groundnut cake','kg'))}" readonly></label><div class="item-note">The stock unit is fixed for consistent inventory records.</div></div>
      <div class="field"><label>Sludge produced<input name="sludge" type="number" min="0" step="any" value="0"></label><div class="item-note">Enter the measured weight of sludge. Enter 0 only if none was produced.</div></div>
      <div class="field"><label>Sludge unit<input name="sludgeUnit" value="${esc(outputUnit('Sludge','kg'))}" readonly></label><div class="item-note">The stock unit is fixed for consistent inventory records.</div></div>
      <div class="field full"><label>Why was no finished output produced? <textarea name="zeroOutputReason" rows="2" placeholder="Required only when oil, cake and sludge are all zero; e.g. machine breakdown before extraction."></textarea></label><div class="item-note">If every output is zero, give the reason so the completed record is understandable.</div></div>
      <div class="field full"><h3>3. Account for unused material</h3><p class="item-note">Only enter material that was physically returned to the warehouse. The app calculates actual consumption as issued quantity minus returned quantity.</p></div>
      <div class="field full"><label>Unused materials returned to stock</label><table class="run-materials"><thead><tr><th>Material</th><th>Issued</th><th>Return quantity</th></tr></thead><tbody>${returnRows}</tbody></table><div class="item-note">The returned quantity goes back to the source warehouse and remains linked to this production run.</div></div>
      <div class="field full"><h3>4. Record performance information</h3><p class="item-note">These fields help compare the machine’s expected performance with what happened in this run. They do not change stock.</p></div>
      <div class="field full"><label>Manufacturer's rating — ${esc(machineName)}</label><div class="item-note">${esc(ratingNote || 'No manufacturer rating was recorded for this machine when the run started.')}</div></div>
      <div class="field"><label>Manufacturer capacity rating<input name="manufacturerCapacity" value="${esc(rating.capacity)}" placeholder="e.g. 15 tonnes/day"></label><div class="item-note">The capacity stated by the machine manufacturer. Update only if the previous value is incorrect.</div></div>
      <div class="field"><label>Manufacturer input rating<input name="manufacturerInput" value="${esc(rating.input)}" placeholder="e.g. 1,000 kg/day"></label><div class="item-note">The amount of raw material the manufacturer says this machine can process.</div></div>
      <div class="field"><label>Manufacturer output rating<input name="manufacturerOutput" value="${esc(rating.output)}" placeholder="e.g. 350 kg/day"></label><div class="item-note">The output the manufacturer says this machine should produce.</div></div>
      <div class="field"><label>Actual capacity achieved<input name="actualCapacity" placeholder="e.g. 12 tonnes/day"></label><div class="item-note">What the machine actually achieved during this run.</div></div>
      <div class="field full"><label>Material issued to this run<input name="actualInput" value="${esc(actualInput)}" readonly></label><div class="item-note">Brought forward automatically from the materials issued at the start; it cannot be edited here.</div></div>
      <div class="field"><label>Actual output rate (optional)<input name="actualOutput" placeholder="e.g. 315 kg/day"></label><div class="item-note">Optional performance note, such as oil produced per day. This is not the finished-goods quantity above.</div></div>
      <div class="field full"><label>Notes about loss, extra consumption or returns<textarea name="adjustment" placeholder="Describe anything unusual, such as a spill, machine loss or a reason for material returned."></textarea></label><div class="item-note">Use Stock adjustments separately for a stock-count correction.</div></div>
    </div>`;
    const form=$('#record-form'); form.dataset.type='production-end'; form.dataset.runId=run.id; showSubmitAction('End production run'); $('#record-dialog').showModal();
  }
  async function endRun(form) {
    const run=data.activeProductionRuns.find(r => String(r.id) === String(form.dataset.runId)); if (!run) return;
    const now=new Date(), correct=form.elements.timeCorrect.value==='yes';
    if (!correct && !form.elements.endedAt.value) return alert('Enter the actual completion time.');
    const endedAt=correct ? now.toISOString() : new Date(form.elements.endedAt.value).toISOString();
    if (!correct && (new Date(endedAt) < new Date(run.startedAt) || new Date(endedAt) > now)) return alert('Enter an actual completion time between the start time and now.');
    const outputWarehouse=(data.warehouses||[]).find(warehouse=>String(warehouse.id)===String(form.elements.warehouseId.value));
    if (!outputWarehouse) return alert('Select the warehouse that will receive the finished goods.');
    const outputs=[['Crude groundnut oil',Number(form.elements.oil.value||0),form.elements.oilUnit.value],['Groundnut cake',Number(form.elements.cake.value||0),form.elements.cakeUnit.value],['Sludge',Number(form.elements.sludge.value||0),form.elements.sludgeUnit.value]].filter(([,q])=>q>0);
    const zeroOutputReason=form.elements.zeroOutputReason.value.trim();
    if (!outputs.length && zeroOutputReason.length < 10) return alert('No output has been entered. If this run produced no oil, cake or sludge, explain why in “Why was no finished output produced?” before completing it.');
    const returnedMaterials=(run.materials||[]).map((material,index)=>({...material,issuedQuantity:Number(material.quantity||0),quantity:Number(form.elements[`return-${index}`]?.value||0)})).filter(material=>material.quantity>0);
    const invalidReturn=returnedMaterials.find(material=>!Number.isFinite(material.quantity)||material.quantity>material.issuedQuantity);
    if (invalidReturn) return alert(`The return quantity for ${invalidReturn.name} cannot exceed the quantity issued.`);
    returnedMaterials.forEach(material=>{const item=stockItem(material.name);if(!item)return;item.qty+=material.quantity;recordStockMovement({type:'PRODUCTION_RETURN',item:material.name,category:item.category,quantity:material.quantity,unit:material.unit||item.unit,warehouseId:material.warehouseId||run.sourceWarehouseId,sourceType:'PRODUCTION_RUN',sourceId:run.batch,lotNo:material.lotNo||'',note:'Unused material returned at production completion'});});
    outputs.forEach(([name, quantity, unit])=>{let item=stockItem(name); if(item)item.qty+=quantity; else { item={id:id(),name,category:'Finished goods',qty:quantity,unit,reorder:0};data.stock.push(item); } recordStockMovement({type:'PRODUCTION_OUTPUT',item:name,category:'Finished goods',quantity,unit,warehouseId:outputWarehouse.id,sourceType:'PRODUCTION_RUN',sourceId:run.batch,note:'Finished production output'});});
    const selectedMachine=(run.machineRatings||[])[0]||{}; const machine=(data.machines||[]).find(entry=>String(entry.id)===String(selectedMachine.id)||entry.name===selectedMachine.name||entry.name===(run.machines||[])[0]);if(machine)machine.manufacturerRating={capacity:form.elements.manufacturerCapacity.value.trim(),input:form.elements.manufacturerInput.value.trim(),output:form.elements.manufacturerOutput.value.trim()};
    Object.assign(run,{status:'COMPLETED',endedAt,endedAtRecorded:now.toISOString(),timeCorrect:correct,warehouseId:outputWarehouse.id,warehouseName:outputWarehouse.name,actualRating:{capacity:form.elements.actualCapacity.value.trim(),input:form.elements.actualInput.value.trim(),output:form.elements.actualOutput.value.trim()},outputs,returnedMaterials,zeroOutputReason,adjustment:form.elements.adjustment.value}); data.activeProductionRuns=data.activeProductionRuns.filter(entry=>String(entry.id)!==String(run.id)); data.production.unshift(run);
    const submit = form.querySelector('button[type="submit"]');
    if (submit) { submit.disabled = true; submit.textContent = 'Saving completed run…'; }
    try {
      const saved = await save();
      if (!saved) {
        alert('The completed run could not be saved. The latest records have been reloaded; please try again.');
        render();
        return;
      }
      render();
      $('#record-dialog').close();
    } catch (error) {
      console.error(error);
      alert(`The completed run could not be saved: ${error.message || 'please try again.'}`);
      render();
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = 'End production run'; }
    }
  }
  $('#record-form').addEventListener('submit', event => { const form=event.currentTarget; if (!['production-start','production-end','production-issue'].includes(form.dataset.type)) return; event.preventDefault();event.stopImmediatePropagation(); if(form.dataset.type==='production-start')startRun(form);else if(form.dataset.type==='production-end')void endRun(form);else saveIssue(form); }, true);
  $('#add-production').onclick=openStart;
  const originalRender=render; render=()=>{ originalRender(); inventoryData(); activeRunBanner(); };
  window.setInterval(updateActiveRunTimer, 1000);
  const originalAdmin=renderAdmin; renderAdmin=()=>{ originalAdmin(); inventoryData(); const grid=$('#admin-view .dashboard-grid'); if(!$('#production-master-panel'))grid.insertAdjacentHTML('beforeend','<section class="panel table-panel" id="production-master-panel"><div class="panel-head"><div><h3>Production controls</h3><p>Manage batch numbering, issue types, and the machines available to factory managers.</p></div></div><form id="production-master-form" class="form-grid"><div class="field"><label>Batch prefix</label><input name="prefix"></div><div class="field"><label>Batch suffix</label><input name="suffix"></div><div class="field"><label>Batch padding</label><input name="padding" type="number" min="1" max="12"></div><div class="field"><label>Next batch number</label><input name="nextNumber" type="number" min="1"></div><div class="field full"><label>Production issue types</label><textarea name="issueTypes" rows="3" aria-describedby="production-issue-types-help" placeholder="One issue per line"></textarea><div class="item-note" id="production-issue-types-help">One issue per line. These are available when a user reports an issue during an active production run.</div></div><div class="field full"><label>Available machines</label><p class="item-note" id="production-machines-list"></p></div><div class="field"><button class="primary" type="submit">Save production controls</button></div><p class="save-status" id="production-controls-status" role="status" aria-live="polite"></p></form></section>'); const form=$('#production-master-form'),cfg=data.productionConfig,status=$('#production-controls-status'),button=form.querySelector('button[type="submit"]'); form.elements.prefix.value=cfg.batch.prefix;form.elements.suffix.value=cfg.batch.suffix;form.elements.padding.value=cfg.batch.padding;form.elements.nextNumber.value=cfg.batch.nextNumber;form.elements.issueTypes.value=cfg.issueTypes.join('\n');const machines=(data.machines||[]).filter(machine=>machine.name).map(machine=>`${machine.name}${machine.type?` · ${machine.type}`:''}`);$('#production-machines-list').textContent=machines.length?machines.join(' · '):'No machines have been added yet. Add them in Admin Machines.';form.onsubmit=async e=>{e.preventDefault();const previous=JSON.stringify(cfg);const issueTypes=[...new Set(form.elements.issueTypes.value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean))];if(!issueTypes.length){status.textContent='Add at least one production issue type.';return;}cfg.batch={prefix:form.elements.prefix.value.trim(),suffix:form.elements.suffix.value.trim(),padding:Math.min(12,Math.max(1,Number(form.elements.padding.value)||4)),nextNumber:Math.max(1,Number(form.elements.nextNumber.value)||1)};cfg.issueTypes=issueTypes;button.disabled=true;status.textContent='Saving…';try{const saved=await save();if(!saved)throw new Error('the page was updated elsewhere; the latest saved settings have been reloaded');status.textContent='Production controls saved.';render();}catch(error){Object.assign(cfg,JSON.parse(previous));status.textContent=`Could not save production controls: ${error.message||'please try again.'}`;console.error(error);}finally{button.disabled=false;}}; };
  function openInventoryAction(type) {
    const items=(data.stock||[]).map(s=>`<option value="${esc(s.name)}">${esc(s.name)} · ${Number(s.qty).toLocaleString()} ${esc(s.unit)}</option>`).join('');
    $('#modal-label').textContent='INVENTORY CONTROL'; $('#modal-title').textContent=type==='transfer'?'Transfer warehouse stock':'Adjust stock';
    $('#form-fields').innerHTML=type==='transfer'?`<div class="form-grid"><div class="field full"><label>Material</label><select name="item">${items}</select></div><div class="field"><label>From warehouse</label><select name="fromWarehouse">${warehouseOptions()}</select></div><div class="field"><label>To warehouse</label><select name="toWarehouse">${warehouseOptions()}</select></div><div class="field full"><div class="item-note" id="transfer-availability" aria-live="polite"></div></div><div class="field"><label>Quantity</label><input name="quantity" type="number" min="0.001" step="any" required></div><div class="field full"><label>Reason</label><textarea name="note" minlength="10" required placeholder="Explain why this stock is moving"></textarea></div></div>`:`<div class="form-grid"><div class="field full"><label>Material</label><select name="item">${items}</select></div><div class="field"><label>Warehouse</label><select name="warehouseId">${warehouseOptions()}</select></div><div class="field"><label>Quantity change</label><input name="quantity" type="number" step="any" required placeholder="Use - for reduction"></div><div class="field full"><label>Reason</label><textarea name="note" minlength="10" required placeholder="Explain the count variance, loss, damage, or correction"></textarea></div></div>`;
    const form=$('#record-form');
    if(type==='transfer'){
      const availability=()=>{const item=stockItem(form.elements.item.value),source=(data.warehouses||[]).find(warehouse=>String(warehouse.id)===String(form.elements.fromWarehouse.value)),available=item&&sourceAvailableForTransfer(item,source?.id);const note=$('#transfer-availability');if(!item||!source||!note)return;note.textContent=available.needsAllocation?`${available.quantity.toLocaleString()} ${item.unit} is unassigned legacy stock. It will be assigned to ${source.name} before this transfer.`:`${available.quantity.toLocaleString()} ${item.unit} available in ${source.name}.`;};
      form.elements.item.onchange=availability;form.elements.fromWarehouse.onchange=availability;availability();
    }
    form.dataset.type=`inventory-${type}`;$('#save-record').textContent=type==='transfer'?'Record transfer':'Record adjustment';$('#record-dialog').showModal();
  }
  $('#record-form').addEventListener('submit',event=>{const form=event.currentTarget,type=form.dataset.type;if(!['inventory-transfer','inventory-adjustment'].includes(type))return;event.preventDefault();event.stopImmediatePropagation();const note=form.elements.note.value.trim();if(note.length<10)return alert('Enter a reason of at least 10 characters.');const item=stockItem(form.elements.namedItem('item').value),quantity=Number(form.elements.quantity.value);if(!item||!Number.isFinite(quantity)||quantity===0)return alert('Enter a valid quantity.');if(type==='inventory-transfer'){if(form.elements.fromWarehouse.value===form.elements.toWarehouse.value)return alert('Choose two different warehouses.');const sourceId=form.elements.fromWarehouse.value,source=(data.warehouses||[]).find(warehouse=>String(warehouse.id)===String(sourceId)),availability=sourceAvailableForTransfer(item,sourceId);if(quantity<=0||quantity>availability.quantity)return alert(`Only ${availability.quantity.toLocaleString()} ${item.unit} of ${item.name} is available in the source warehouse.`);if(availability.needsAllocation)recordStockMovement({type:'OPENING_ALLOCATION',item:item.name,category:item.category,quantity:availability.quantity,unit:item.unit,warehouseId:+sourceId,sourceType:'OPENING_STOCK',sourceId:id(),note:`Assigned legacy stock to ${source?.name||'source warehouse'} before transfer.`});const transferId=id();recordStockMovement({type:'TRANSFER_OUT',item:item.name,category:item.category,quantity:-quantity,unit:item.unit,warehouseId:+sourceId,sourceType:'TRANSFER',sourceId:transferId,note});recordStockMovement({type:'TRANSFER_IN',item:item.name,category:item.category,quantity,unit:item.unit,warehouseId:+form.elements.toWarehouse.value,sourceType:'TRANSFER',sourceId:transferId,note});}else{const adjustAvailable=warehouseAvailable(item.name,form.elements.warehouseId.value);if(adjustAvailable+quantity<0)return alert(`This adjustment would make ${item.name} negative in that warehouse (${adjustAvailable.toLocaleString()} ${item.unit} available).`);item.qty+=quantity;recordStockMovement({type:'ADJUSTMENT',item:item.name,category:item.category,quantity,unit:item.unit,warehouseId:+form.elements.warehouseId.value,sourceType:'ADJUSTMENT',sourceId:id(),note});}save();render();$('#record-dialog').close();},true);
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
