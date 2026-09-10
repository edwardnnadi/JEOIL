// Keep purchase capture focused by turning its existing fields into a four-step wizard.
function parsePurchaseAmount(value){
  const parsed=Number(String(value??'').replace(/,/g,'').trim());
  return Number.isFinite(parsed)?parsed:0;
}
function formatPurchaseAmount(value){
  return new Intl.NumberFormat('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2}).format(parsePurchaseAmount(value));
}
function bindPurchaseMoneyFields(form){
  const price=form.elements.unitPrice,total=form.elements.cost,qty=form.elements.qty;
  if(!price||!total||!qty)return;
  price.type='text';price.inputMode='decimal';total.type='text';
  price.closest('.field')?.classList.add('purchase-money-field');
  total.closest('.field')?.classList.add('purchase-money-field');
  if(price.value)price.value=formatPurchaseAmount(price.value);
  const refresh=()=>{total.value=formatPurchaseAmount(parsePurchaseAmount(qty.value)*parsePurchaseAmount(price.value));};
  price.addEventListener('input',refresh);
  qty.addEventListener('input',refresh);
  price.addEventListener('blur',()=>{if(price.value.trim())price.value=formatPurchaseAmount(price.value);refresh();});
  refresh();
}
function purchaseQualityStandard(form){
  const item=form.elements.namedItem('item')?.value||'';
  const category=form.elements.namedItem('category')?.value||'';
  const configured=itemStandard?.(item,category)||categoryStandard?.(category);
  return configured?.parameters?.length?configured:peanutStandard||configured||{name:'JE Oils Standard',parameters:[]};
}
function purchaseStandardCard(standard){
  const card=document.createElement('section');
  card.className='field full purchase-standard-card';
  card.dataset.purchaseStandard='true';
  const summary=document.createElement('div');
  summary.className='purchase-standard-summary';
  const name=document.createElement('strong');
  name.className='purchase-standard-name';
  const details=document.createElement('span');
  details.className='purchase-standard-details';
  summary.append(name,details);
  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.className='secondary purchase-standard-toggle';
  toggle.textContent='View parameters';
  toggle.setAttribute('aria-expanded','false');
  const parameters=document.createElement('ul');
  parameters.className='purchase-standard-parameters';
  parameters.hidden=true;
  toggle.onclick=()=>{const isOpen=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!isOpen));toggle.textContent=isOpen?'View parameters':'Hide parameters';parameters.hidden=isOpen;};
  card.append(summary,toggle,parameters);
  const render=nextStandard=>{
    const values=nextStandard?.parameters||[];
    name.textContent=nextStandard?.name||'JE Oils Standard';
    details.textContent=values.length
      ? `${values.length} quality parameter${values.length===1?'':'s'} configured for this purchase.`
      : 'Quality standard applied to this purchase.';
    parameters.replaceChildren(...values.map(parameter=>{
      const row=document.createElement('li');
      const label=document.createElement('span');
      label.textContent=parameter.label||'Quality parameter';
      const limit=document.createElement('strong');
      limit.textContent=[parameter.operator,parameter.limit,parameter.unit].filter(value=>value!==undefined&&value!==null&&value!=='').join(' ');
      row.append(label,limit);
      return row;
    }));
    toggle.hidden=!values.length;
    if(!values.length){parameters.hidden=true;toggle.setAttribute('aria-expanded','false');}
  };
  render(standard);
  return {card,render};
}
function buildPurchaseWizard(form){
  const area=$('#form-fields'),allFields=[...area.querySelectorAll('.field')];
  // See goods-inwards-wizard.js: the form is re-rendered per open, so a sticky
  // 'ready' flag suppressed the wizard on every purchase after the first.
  if(form.dataset.purchaseWizard==='ready'&&area.querySelector('.purchase-wizard'))return;
  if(!allFields.length)return;
  bindPurchaseMoneyFields(form);
  const groups=[
    {title:'Purchase details',help:'Record the commercial and item details.',names:['status','purchasedDate','purchasedById','category','item','itemDescription','supplier','qty','unit','unitPrice','cost']},
    {title:'Traceability',help:'Capture the source and supplier evidence for this lot.',names:['lotNo','originState','originLga','collectionSite','originCode','supplierReceiptId']},
    {title:'Field QC',help:'Record the initial QC inspection completed before collection. Any status change made after the purchase is saved requires a time and reason. Receiving quality is completed later in Goods Inwards.',names:['purchaseQcStatus','purchaseQcStatusHistory','purchaseQcTestRef','purchaseQcTestedAt','purchaseOilContent','purchaseFfa','purchaseInspectorId','purchaseMoisture','purchaseDamaged','purchaseForeignMatter','purchaseAflatoxin','purchaseCondition','purchaseDecision','purchaseNotes']},
    {title:'Attachments & review',help:'Attach supplier evidence and review before saving.',names:['attachmentsInput']}
  ];
  const fieldGroup=field=>{
    const names=[...field.querySelectorAll('[name]')].map(input=>input.name);
    const label=field.querySelector('label')?.textContent||'';
    if(label.includes('Purchase ID')||label.includes('Created by')||label.includes('Created date'))return 1;
    if(label.includes('Initial purchase quality')||label.includes('Field QC assessment'))return 2;
    const index=groups.findIndex(group=>names.some(name=>group.names.includes(name)));
    return index<0?0:index;
  };
  const buckets=groups.map(()=>[]);allFields.forEach(field=>buckets[fieldGroup(field)].push(field));
  area.innerHTML='';
  const wizard=document.createElement('div');wizard.className='purchase-wizard';
  const progress=document.createElement('div');progress.className='wizard-progress';
  groups.forEach((group,index)=>progress.insertAdjacentHTML('beforeend',`<button type="button" data-step="${index}" aria-label="Go to step ${index+1}: ${group.title}"><b>${index+1}</b>${group.title}</button>`));
  wizard.append(progress);
  const standardCards=[];
  const panels=groups.map((group,index)=>{const panel=document.createElement('section');panel.className='wizard-step';panel.dataset.step=index;panel.innerHTML=`<header><h3>${group.title}</h3><p>${group.help}</p></header><div class="form-grid"></div>`;const grid=panel.querySelector('.form-grid');if(index<3){const standardCard=purchaseStandardCard(purchaseQualityStandard(form));grid.append(standardCard.card);standardCards.push(standardCard)}buckets[index].forEach(field=>grid.append(field));wizard.append(panel);return panel});
  const refreshStandard=()=>standardCards.forEach(({render})=>render(purchaseQualityStandard(form)));
  form.elements.namedItem('item')?.addEventListener('change',refreshStandard);
  form.elements.namedItem('category')?.addEventListener('change',refreshStandard);
  form.elements.status?.closest('.field')?.classList.add('purchase-stage-field');
  const controls=document.createElement('div');controls.className='wizard-controls';controls.innerHTML='<button type="button" class="secondary wizard-back">Back</button><div class="wizard-forward"><button type="button" class="secondary wizard-cancel">Cancel</button><button type="button" class="primary wizard-next">Continue</button></div>';wizard.append(controls);area.append(wizard);
  const isEdit=/edit/.test(form.dataset.type||'');
  let step=0,save=$('#save-record'),modalActions=save.parentElement;
  const backButton=controls.querySelector('.wizard-back');
  const show=next=>{step=next;const isReview=step===groups.length-1;panels.forEach((panel,index)=>panel.hidden=index!==step);progress.querySelectorAll('button').forEach((item,index)=>{item.classList.toggle('active',index===step);item.toggleAttribute('aria-current',index===step);});controls.hidden=isReview;backButton.hidden=step===0&&!isEdit;backButton.textContent=step===0?'Back to purchases':'Back';save.hidden=!isReview;modalActions.hidden=!isReview;};
  const canAdvanceTo=next=>{for(let index=step;index<next;index++){const invalid=[...panels[index].querySelectorAll('[required]')].find(input=>!input.checkValidity());if(invalid){show(index);invalid.reportValidity();return false;}}return true;};
  progress.querySelectorAll('button').forEach(button=>button.onclick=()=>{const next=Number(button.dataset.step);if(next<=step||canAdvanceTo(next))show(next);});
  backButton.onclick=()=>step===0&&isEdit?$('#record-dialog').close():show(Math.max(0,step-1));
  controls.querySelector('.wizard-next').onclick=()=>{if(!canAdvanceTo(step+1))return;show(Math.min(groups.length-1,step+1));};
  controls.querySelector('.wizard-cancel').onclick=()=>$('#record-dialog').close();
  // Do not rely on the dialog's implicit submit default. It could close the
  // modal before the enhanced purchase handler receives the save action.
  save.type='button';
  save.onclick=()=>{
    for(let index=0;index<panels.length;index++){
      const invalid=[...panels[index].querySelectorAll('[required]')].find(input=>!input.checkValidity());
      if(invalid){show(index);invalid.reportValidity();return;}
    }
    form.requestSubmit();
  };
  form.dataset.purchaseWizard='ready';show(0);
}

const wizardPurchaseOpen=openModal;
openModal=(type,pid)=>{wizardPurchaseOpen(type,pid);if(type==='purchase')buildPurchaseWizard($('#record-form'));};
const wizardPurchaseEdit=editModal;
editModal=(kind,record)=>{wizardPurchaseEdit(kind,record);if(kind==='purchase')buildPurchaseWizard($('#record-form'));};

const wizardStyle=document.createElement('style');
wizardStyle.textContent='.wizard-progress{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}.wizard-progress button{border:0;padding:0;background:transparent;color:#887c68;font:12px inherit;display:flex;gap:6px;align-items:center;cursor:pointer}.wizard-progress b{display:grid;place-items:center;flex:0 0 22px;width:22px;height:22px;border-radius:50%;background:#eee5d5;color:#5c513d}.wizard-progress button.active{color:#1e1b16;font-weight:700}.wizard-progress button.active b{background:#c89b3c;color:#16120a}.wizard-step header{margin-bottom:14px}.wizard-step h3{margin:0;color:#201b13}.wizard-step p{margin:4px 0 0;color:#776b58;font-size:13px}.wizard-controls{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:18px}.wizard-forward{display:flex;gap:10px}.wizard-step[hidden],.wizard-controls[hidden],.modal-actions[hidden],.purchase-standard-parameters[hidden]{display:none!important}#record-dialog{width:min(960px,calc(100vw - 48px));max-height:calc(100dvh - 24px);overflow:hidden}#record-form{max-height:calc(100dvh - 24px);min-width:0;overflow:auto;overscroll-behavior:contain}.purchase-wizard,.purchase-wizard .form-grid,.purchase-wizard .field{min-width:0}.purchase-wizard .form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.purchase-wizard .field input,.purchase-wizard .field select,.purchase-wizard .field textarea{width:100%;min-width:0}.purchase-wizard .purchase-standard-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:10px 12px;border:1px solid #d8e2d3;border-radius:6px;background:#f5f8f1;color:#39523c}.purchase-standard-summary{display:grid;gap:2px}.purchase-standard-name{font-size:13px}.purchase-standard-details{color:#657368;font-size:12px}.purchase-standard-toggle{align-self:center;padding:6px 10px;font-size:12px;white-space:nowrap}.purchase-standard-parameters{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 20px;margin:2px 0 0;padding:10px 0 0;border-top:1px solid #d8e2d3;list-style:none}.purchase-standard-parameters li{display:flex;justify-content:space-between;gap:12px;color:#657368;font-size:12px}.purchase-standard-parameters strong{color:#39523c;white-space:nowrap}.purchase-wizard input[name="purchaseQcStatus"][readonly]{background:#edf0ed;color:#6e756d;border-color:#d3d8d1;cursor:not-allowed}.purchase-wizard .item-note{overflow-wrap:anywhere}.purchase-wizard .purchase-stage-field{padding:13px 14px;border:1px solid #ded6b3;border-radius:8px;background:#fbf8ed;gap:7px}.purchase-wizard .purchase-stage-field label{color:#5c513d}.purchase-wizard .purchase-stage-field select{background:#fff;border-color:#c8b978;font-weight:700}.purchase-wizard .purchase-stage-field .item-note{margin:0;color:#75694e}.purchase-wizard .purchase-money-field input{text-align:right;font-variant-numeric:tabular-nums}@media(max-width:760px){#record-dialog{width:calc(100vw - 20px)}#record-form{padding:18px}.modal-head{margin-bottom:16px}.modal-head h2{font-size:21px;line-height:1.15}.purchase-wizard .form-grid{grid-template-columns:minmax(0,1fr)}.purchase-wizard .wizard-progress{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px}.purchase-wizard .wizard-progress button{font-size:11px;align-items:flex-start;text-align:left}.purchase-wizard .purchase-standard-card{grid-template-columns:minmax(0,1fr)}.purchase-standard-toggle{justify-self:start}.purchase-standard-parameters{grid-template-columns:minmax(0,1fr)}.purchase-wizard .wizard-controls{position:sticky;bottom:-18px;background:#fff;padding:12px 0 2px;margin-top:16px}.wizard-forward{margin-left:auto}}';
document.head.append(wizardStyle);
