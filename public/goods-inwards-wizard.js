// Guided receiving workflow: receipt selection, quality comparison, decision, then warehouse assignment.
function buildGoodsInwardsWizard(form,receipt){
  const area=$('#form-fields'),allFields=[...area.querySelectorAll('.field')];
  // The flag alone is not enough: #form-fields is re-rendered on every open, so
  // a sticky 'ready' left the second and later receipts with a flat form and no
  // wizard at all. Confirm the wizard is actually still in the DOM.
  if(form.dataset.goodsWizard==='ready'&&area.querySelector('.goods-inwards-wizard'))return;
  if(!allFields.length)return;
  const groups=[
    {title:'Select goods to receive',help:'Choose the purchase being received. Its supplier, item and quantity will be brought through automatically.',names:['purchaseId','receivedDate','supplier','item','category','qty','unit','receivedBy']},
    {title:'Inspect quality',help:'Compare the purchase-time assessment with the inspection completed at receipt.',names:['batch','qualityDate','oilContent','ffa','moisture','damaged','foreignMatter','aflatoxin','qualityCheckOfficerId']},
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
  area.innerHTML='';
  const wizard=document.createElement('div');wizard.className='goods-inwards-wizard';
  const progress=document.createElement('div');progress.className='wizard-progress';
  groups.forEach((group,index)=>progress.insertAdjacentHTML('beforeend',`<span data-step="${index}"><b>${index+1}</b>${group.title}</span>`));wizard.append(progress);
  const panels=groups.map((group,index)=>{const panel=document.createElement('section');panel.className='wizard-step';panel.dataset.step=index;panel.innerHTML=`<header><h3>${group.title}</h3><p>${group.help}</p></header><div class="form-grid"></div>`;buckets[index].forEach(field=>panel.querySelector('.form-grid').append(field));wizard.append(panel);return panel});
  const qualityOfficer=form.elements.qualityCheckOfficerId?.closest('.field');if(qualityOfficer)qualityOfficer.querySelector('label').textContent='Inspection officer';
  const controls=document.createElement('div');controls.className='wizard-controls';controls.innerHTML='<button type="button" class="secondary goods-wizard-back">Back</button><button type="button" class="primary goods-wizard-next">Continue</button>';wizard.append(controls);area.append(wizard);
  let step=0,save=$('#save-record');
  const show=next=>{step=next;if(step===groups.length-1&&typeof receivingApplyGate==='function')receivingApplyGate(form);panels.forEach((panel,index)=>panel.hidden=index!==step);progress.querySelectorAll('span').forEach((item,index)=>item.classList.toggle('active',index===step));controls.querySelector('.goods-wizard-back').hidden=step===0;controls.querySelector('.goods-wizard-next').hidden=step===groups.length-1;save.hidden=step!==groups.length-1;};
  controls.querySelector('.goods-wizard-back').onclick=()=>show(Math.max(0,step-1));
  controls.querySelector('.goods-wizard-next').onclick=()=>{const required=[...panels[step].querySelectorAll('[required]')];if(required.some(input=>!input.reportValidity()))return;show(Math.min(groups.length-1,step+1));};
  const purchase=form.elements.purchaseId;
  if(purchase){
    const existingChange=purchase.onchange;
    purchase.onchange=event=>{existingChange?.(event);const selected=data.purchases.find(purchase=>purchase.id===+form.elements.purchaseId.value);if(!selected)return;const linked=receiptForPurchase(selected);form.querySelector('.purchase-trace-card')?.replaceWith(document.createRange().createContextualFragment(purchaseTraceCard(linked)));form.querySelector('.initial-quality-card')?.replaceWith(document.createRange().createContextualFragment(initialQualityCard(linked)));};
  }
  form.dataset.goodsWizard='ready';show(0);
}

const goodsWizardOpen=openGoodsInward;
openGoodsInward=receipt=>{goodsWizardOpen(receipt);buildGoodsInwardsWizard($('#record-form'),receipt);};

const goodsWizardStyle=document.createElement('style');
goodsWizardStyle.textContent='.goods-inwards-wizard .wizard-progress{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}.goods-inwards-wizard .wizard-progress span{color:#887c68;font-size:12px;display:flex;gap:6px;align-items:center}.goods-inwards-wizard .wizard-progress b{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#eee5d5;color:#5c513d}.goods-inwards-wizard .wizard-progress span.active{color:#1e1b16;font-weight:700}.goods-inwards-wizard .wizard-progress span.active b{background:#c89b3c;color:#16120a}.goods-inwards-wizard .wizard-step header{margin-bottom:14px}.goods-inwards-wizard .wizard-step h3{margin:0;color:#201b13}.goods-inwards-wizard .wizard-step p{margin:4px 0 0;color:#776b58;font-size:13px}.goods-inwards-wizard .wizard-controls{display:flex;justify-content:space-between;gap:10px;margin-top:18px}.goods-inwards-wizard .wizard-step[hidden]{display:none!important}';
document.head.append(goodsWizardStyle);
