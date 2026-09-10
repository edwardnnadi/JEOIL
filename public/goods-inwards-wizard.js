// Guided receiving workflow: receipt selection, quality comparison, decision, then warehouse assignment.
function buildGoodsInwardsWizard(form,receipt){
  const area=$('#form-fields'),allFields=[...area.querySelectorAll('.field')];
  // The flag alone is not enough: #form-fields is re-rendered on every open, so
  // a sticky 'ready' left the second and later receipts with a flat form and no
  // wizard at all. Confirm the wizard is actually still in the DOM.
  if(form.dataset.goodsWizard==='ready'&&area.querySelector('.goods-inwards-wizard'))return;
  if(!allFields.length)return;
  const groups=[
    {title:'Select goods to receive',help:'Choose the purchase being received. Its supplier, item and ordered quantity will be brought through automatically.',names:['purchaseId','receivedDate','quantityOrdered','supplier','item','category','unit','receivedBy']},
    {title:'Inspect quality',help:'Enter the factory findings, then review the collection-versus-factory comparison below.',names:['batch','qualityDate','qty','oilContent','ffa','moisture','damaged','foreignMatter','aflatoxin','qualityCheckOfficerId']},
    {title:'Accept, hold or reject',help:'Record the final receiving decision and any observations.',names:['condition','decision','notes']},
    {title:'Assign to warehouse',help:'Assign accepted goods to a warehouse. This posts the quantity to Stock on Hand.',names:['warehouseId','warehouseAssignedById','warehouseAssignedDate']}
  ];
  const groupFor=field=>{
    const names=[...field.querySelectorAll('[name]')].map(input=>input.name),label=field.querySelector('label')?.textContent||'';
    if(field.classList.contains('purchase-trace-card')||field.classList.contains('initial-quality-card')||label.includes('Purchase traceability')||label.includes('Initial purchase quality'))return 1;
    if(label.includes('Created by')||label.includes('Created date'))return 0;
    const index=groups.findIndex(group=>names.some(name=>group.names.includes(name)));
    return index<0?0:index;
  };
  const buckets=groups.map(()=>[]);allFields.forEach(field=>buckets[groupFor(field)].push(field));
  // In the inspection step, officers enter factory findings before reviewing
  // the collection-versus-factory Measure table those values update.
  const qualityCards=buckets[1].filter(field=>field.classList.contains('initial-quality-card'));
  buckets[1]=[...buckets[1].filter(field=>!field.classList.contains('initial-quality-card')),...qualityCards];
  area.innerHTML='';
  const wizard=document.createElement('div');wizard.className='goods-inwards-wizard';
  const progress=document.createElement('div');progress.className='wizard-progress';
  groups.forEach((group,index)=>progress.insertAdjacentHTML('beforeend',`<button type="button" data-step="${index}" aria-label="Go to step ${index+1}: ${group.title}"><b>${index+1}</b>${group.title}</button>`));wizard.append(progress);
  const standardFor=()=>{
    const purchase=data.purchases.find(entry=>entry.id===+form.elements.purchaseId?.value);
    return itemStandard?.(form.elements.item?.value||purchase?.item,form.elements.category?.value||purchase?.category)||categoryStandard?.(form.elements.category?.value||purchase?.category)||peanutStandard||{name:'JE Oils Standard',parameters:[]};
  };
  const standardCard=()=>{
    const card=document.createElement('section');card.className='field full receiving-standard-card';
    const render=()=>{const standard=standardFor(),parameters=standard.parameters||[];card.innerHTML=`<div class="receiving-standard-heading"><strong>${goodsEscape(standard.name||'JE Oils Standard')}</strong><span>${parameters.length?`${parameters.length} acceptance parameter${parameters.length===1?'':'s'}`:'No acceptance parameters configured'}</span></div><ul>${parameters.map(parameter=>`<li><span>${goodsEscape(parameter.label||'Quality parameter')}</span><strong>${goodsEscape([parameter.operator,parameter.limit,parameter.unit].filter(Boolean).join(' '))}</strong></li>`).join('')||'<li><span>Configure the item standard in Administration to show limits here.</span></li>'}</ul>`;};
    render();return {card,render};
  };
  const selectStandard=standardCard(),inspectStandard=standardCard();
  const panels=groups.map((group,index)=>{const panel=document.createElement('section');panel.className='wizard-step';panel.dataset.step=index;panel.innerHTML=`<header><h3>${group.title}</h3><p>${group.help}</p></header><div class="form-grid"></div>`;const grid=panel.querySelector('.form-grid');if(index===0)grid.append(selectStandard.card);if(index===1){grid.classList.add('receiving-inspection-grid');grid.append(inspectStandard.card)}buckets[index].forEach(field=>grid.append(field));wizard.append(panel);return panel});
  const refreshStandards=()=>{selectStandard.render();inspectStandard.render();refreshReceivingDecision(form);};
  addReceivingDecisionPanel(form,panels[2],standardFor,receipt);
  const qualityOfficer=form.elements.qualityCheckOfficerId?.closest('.field');if(qualityOfficer)qualityOfficer.querySelector('label').textContent='Inspection officer';
  const controls=document.createElement('div');controls.className='wizard-controls';controls.innerHTML='<button type="button" class="secondary goods-wizard-back">Back</button><button type="button" class="primary goods-wizard-next">Continue</button>';wizard.append(controls);area.append(wizard);
  let step=0,save=$('#save-record');
  const syncDeliveryReadings=()=>{form._deliveryReadings=Object.fromEntries(receivingComparisonFields.map(([key])=>[key,form.elements[key]?.value??'']));refreshReceivingDecision(form);};
  const show=next=>{if(next===2)syncDeliveryReadings();step=next;if(step===groups.length-1&&typeof receivingApplyGate==='function')receivingApplyGate(form);panels.forEach((panel,index)=>panel.hidden=index!==step);progress.querySelectorAll('button').forEach((item,index)=>{item.classList.toggle('active',index===step);item.toggleAttribute('aria-current',index===step);});controls.querySelector('.goods-wizard-back').hidden=step===0;controls.querySelector('.goods-wizard-next').hidden=step===groups.length-1;save.hidden=step!==groups.length-1;if(step===groups.length-1)save.textContent='Finish receipt';};
  const canAdvanceTo=next=>{for(let index=step;index<next;index++){const invalid=[...panels[index].querySelectorAll('[required]')].find(input=>!input.checkValidity());if(invalid){show(index);invalid.reportValidity();return false;}}return true;};
  progress.querySelectorAll('button').forEach(button=>button.onclick=()=>{const next=Number(button.dataset.step);if(next<=step||canAdvanceTo(next))show(next);});
  controls.querySelector('.goods-wizard-back').onclick=()=>show(Math.max(0,step-1));
  controls.querySelector('.goods-wizard-next').onclick=()=>{if(!canAdvanceTo(step+1))return;show(Math.min(groups.length-1,step+1));};
  const purchase=form.elements.purchaseId;
  if(purchase){
    const existingChange=purchase.onchange;
    purchase.onchange=event=>{existingChange?.(event);const selected=data.purchases.find(purchase=>purchase.id===+form.elements.purchaseId.value);if(!selected){refreshStandards();return;}const linked=receiptForPurchase(selected);form.querySelector('.purchase-trace-card')?.replaceWith(document.createRange().createContextualFragment(purchaseTraceCard(linked)));refreshStandards();};
  }
  ['item','category'].forEach(name=>form.elements[name]?.addEventListener('change',refreshStandards));
  receivingComparisonFields.forEach(([key])=>{form.elements[key]?.addEventListener('input',syncDeliveryReadings);form.elements[key]?.addEventListener('change',syncDeliveryReadings);});
  form.dataset.goodsWizard='ready';show(0);
}

const goodsWizardOpen=openGoodsInward;
openGoodsInward=receipt=>{goodsWizardOpen(receipt);buildGoodsInwardsWizard($('#record-form'),receipt);};

const goodsWizardStyle=document.createElement('style');
goodsWizardStyle.textContent='#record-dialog:has(#record-form[data-type="goods-inward"]){width:min(1180px,calc(100vw - 48px))}.goods-inwards-wizard .wizard-progress{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}.goods-inwards-wizard .wizard-progress button{border:0;padding:0;background:transparent;color:#887c68;font:12px inherit;display:flex;gap:6px;align-items:center;cursor:pointer}.goods-inwards-wizard .wizard-progress b{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#eee5d5;color:#5c513d}.goods-inwards-wizard .wizard-progress button.active{color:#1e1b16;font-weight:700}.goods-inwards-wizard .wizard-progress button.active b{background:#c89b3c;color:#16120a}.goods-inwards-wizard .wizard-step header{margin-bottom:14px}.goods-inwards-wizard .wizard-step h3{margin:0;color:#201b13}.goods-inwards-wizard .wizard-step p{margin:4px 0 0;color:#776b58;font-size:13px}.goods-inwards-wizard .wizard-controls{display:flex;justify-content:space-between;gap:10px;margin-top:18px}.goods-inwards-wizard .wizard-step[hidden]{display:none!important}.receiving-standard-card{align-content:start;gap:10px;padding:13px 14px;border:1px solid #d8e2d3;border-radius:7px;background:#f5f8f1;color:#39523c}.receiving-standard-heading{display:grid;gap:2px}.receiving-standard-heading span{color:#657368;font-size:12px}.receiving-standard-card ul{display:grid;gap:7px;margin:0;padding:10px 0 0;border-top:1px solid #d8e2d3;list-style:none}.receiving-standard-card li{display:flex;justify-content:space-between;gap:12px;color:#657368;font-size:12px}.receiving-standard-card li strong{color:#39523c;white-space:nowrap}.receiving-inspection-grid{grid-template-columns:minmax(270px,.72fr) minmax(0,1fr)}.receiving-inspection-grid .receiving-standard-card{grid-column:1;grid-row:span 8}.receiving-inspection-grid .field:not(.receiving-standard-card){grid-column:2}.receiving-inspection-grid .field.full:not(.receiving-standard-card){grid-column:2}@media(max-width:760px){#record-dialog:has(#record-form[data-type="goods-inward"]){width:calc(100vw - 20px)}.goods-inwards-wizard .wizard-progress{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px}.goods-inwards-wizard .wizard-progress button{font-size:11px;align-items:flex-start;text-align:left}.receiving-inspection-grid{grid-template-columns:1fr}.receiving-inspection-grid .receiving-standard-card,.receiving-inspection-grid .field:not(.receiving-standard-card),.receiving-inspection-grid .field.full:not(.receiving-standard-card){grid-column:1;grid-row:auto}}';
document.head.append(goodsWizardStyle);
