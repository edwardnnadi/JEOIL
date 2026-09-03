// Keep purchase capture focused by turning its existing fields into a four-step wizard.
function buildPurchaseWizard(form){
  if(form.dataset.purchaseWizard==='ready')return;
  const area=$('#form-fields'),allFields=[...area.querySelectorAll('.field')];
  if(!allFields.length)return;
  const groups=[
    {title:'Purchase details',help:'Record the commercial and item details.',names:['status','purchasedDate','purchasedById','category','item','supplier','qty','unit','unitPrice','cost']},
    {title:'Traceability',help:'Capture the source and supplier evidence for this lot.',names:['lotNo','originState','originLga','supplierReceiptId']},
    {title:'Initial quality',help:'Record the purchase-time supplier assessment. Receiving quality is completed later in Goods Inwards.',names:['purchaseOilContent','purchaseFfa','purchaseInspectorId','purchaseMoisture','purchaseDamaged','purchaseForeignMatter','purchaseAflatoxin','purchaseCondition','purchaseDecision','purchaseNotes']},
    {title:'Attachments & review',help:'Attach supplier evidence and review before saving.',names:['attachmentsInput']}
  ];
  const fieldGroup=field=>{
    const names=[...field.querySelectorAll('[name]')].map(input=>input.name);
    const label=field.querySelector('label')?.textContent||'';
    if(label.includes('Purchase ID')||label.includes('Created by')||label.includes('Created date'))return 1;
    const index=groups.findIndex(group=>names.some(name=>group.names.includes(name)));
    return index<0?0:index;
  };
  const buckets=groups.map(()=>[]);allFields.forEach(field=>buckets[fieldGroup(field)].push(field));
  area.innerHTML='';
  const wizard=document.createElement('div');wizard.className='purchase-wizard';
  const progress=document.createElement('div');progress.className='wizard-progress';
  groups.forEach((group,index)=>progress.insertAdjacentHTML('beforeend',`<span data-step="${index}"><b>${index+1}</b>${group.title}</span>`));
  wizard.append(progress);
  const panels=groups.map((group,index)=>{const panel=document.createElement('section');panel.className='wizard-step';panel.dataset.step=index;panel.innerHTML=`<header><h3>${group.title}</h3><p>${group.help}</p></header><div class="form-grid"></div>`;buckets[index].forEach(field=>panel.querySelector('.form-grid').append(field));wizard.append(panel);return panel});
  const controls=document.createElement('div');controls.className='wizard-controls';controls.innerHTML='<button type="button" class="secondary wizard-back">Back</button><button type="button" class="primary wizard-next">Continue</button>';wizard.append(controls);area.append(wizard);
  let step=0,save=$('#save-record');
  const show=next=>{step=next;panels.forEach((panel,index)=>panel.hidden=index!==step);progress.querySelectorAll('span').forEach((item,index)=>item.classList.toggle('active',index===step));controls.querySelector('.wizard-back').hidden=step===0;controls.querySelector('.wizard-next').hidden=step===groups.length-1;save.hidden=step!==groups.length-1;};
  controls.querySelector('.wizard-back').onclick=()=>show(Math.max(0,step-1));
  controls.querySelector('.wizard-next').onclick=()=>{const required=[...panels[step].querySelectorAll('[required]')];if(required.some(input=>!input.reportValidity()))return;show(Math.min(groups.length-1,step+1));};
  form.dataset.purchaseWizard='ready';show(0);
}

const wizardPurchaseOpen=openModal;
openModal=(type,pid)=>{wizardPurchaseOpen(type,pid);if(type==='purchase')buildPurchaseWizard($('#record-form'));};
const wizardPurchaseEdit=editModal;
editModal=(kind,record)=>{wizardPurchaseEdit(kind,record);if(kind==='purchase')buildPurchaseWizard($('#record-form'));};

const wizardStyle=document.createElement('style');
wizardStyle.textContent='.wizard-progress{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 18px}.wizard-progress span{color:#887c68;font-size:12px;display:flex;gap:6px;align-items:center}.wizard-progress b{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#eee5d5;color:#5c513d}.wizard-progress span.active{color:#1e1b16;font-weight:700}.wizard-progress span.active b{background:#c89b3c;color:#16120a}.wizard-step header{margin-bottom:14px}.wizard-step h3{margin:0;color:#201b13}.wizard-step p{margin:4px 0 0;color:#776b58;font-size:13px}.wizard-controls{display:flex;justify-content:space-between;gap:10px;margin-top:18px}.wizard-step[hidden]{display:none!important}';
document.head.append(wizardStyle);
