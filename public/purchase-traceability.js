// Purchase traceability: controlled purchase references, origin and supplier evidence.
const nigeriaStates = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Federal Capital Territory','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
const nigeriaLgaSource = 'https://raw.githubusercontent.com/temikeezy/nigeria-geojson-data/main/data/lgas.json';
// Keep record attachments comfortably within the durable state payload limit.
const maxAttachmentBytes = 1000000;

function escapeValue(value=''){return String(value).replace(/[&<>'"]/g, character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));}
function traceabilityData(){
  data.purchaseIdConfig ??= {prefix:'PUR-',sequenceStart:1001,nextNumber:1001,padding:4,suffix:''};
  data.lotNoConfig ??= {prefix:'LOT-',suffix:'',padding:4};
  data.goodsInwardsIdConfig ??= {prefix:'GIN-',sequenceStart:1001,nextNumber:1001,padding:4,suffix:''};
  data.purchaseIdConfig.prefix ??= '';
  data.purchaseIdConfig.suffix ??= '';
  data.purchaseIdConfig.sequenceStart ??= 1001;
  data.purchaseIdConfig.nextNumber ??= data.purchaseIdConfig.sequenceStart;
  data.purchaseIdConfig.padding ??= 4;
  data.lotNoConfig.prefix ??= 'LOT-';
  data.lotNoConfig.suffix ??= '';
  data.lotNoConfig.padding ??= data.purchaseIdConfig.padding;
  data.goodsInwardsIdConfig.prefix ??= 'GIN-';
  data.goodsInwardsIdConfig.suffix ??= '';
  data.goodsInwardsIdConfig.sequenceStart ??= 1001;
  data.goodsInwardsIdConfig.nextNumber ??= data.goodsInwardsIdConfig.sequenceStart;
  data.goodsInwardsIdConfig.padding ??= 4;
  data.purchases.forEach(purchase=>purchase.attachments ??= []);
}
function purchaseReference(number=data.purchaseIdConfig.nextNumber){
  traceabilityData();
  return `${data.purchaseIdConfig.prefix}${String(number).padStart(data.purchaseIdConfig.padding,'0')}${data.purchaseIdConfig.suffix}`;
}
function nextPurchaseReference(){
  traceabilityData();
  const reference=purchaseReference();
  data.purchaseIdConfig.nextNumber=Number(data.purchaseIdConfig.nextNumber)+1;
  return reference;
}
function lotReference(purchaseId){traceabilityData();return `${data.lotNoConfig.prefix}${String(purchaseId).replace(/[^A-Za-z0-9]/g,'').slice(-data.lotNoConfig.padding).padStart(data.lotNoConfig.padding,'0')}${data.lotNoConfig.suffix}`;}
function goodsInwardsReference(number){traceabilityData();const next=number??data.goodsInwardsIdConfig.nextNumber;return `${data.goodsInwardsIdConfig.prefix}${String(next).padStart(data.goodsInwardsIdConfig.padding,'0')}${data.goodsInwardsIdConfig.suffix}`;}
function nextGoodsInwardsReference(){traceabilityData();const reference=goodsInwardsReference();data.goodsInwardsIdConfig.nextNumber=Number(data.goodsInwardsIdConfig.nextNumber)+1;return reference;}
function normalizeLgas(value){
  if(Array.isArray(value)) return value.map(item=>typeof item==='string'?item:(item.name||item.lga||item.LGA||'')).filter(Boolean);
  if(value&&typeof value==='object') return Object.values(value).flatMap(normalizeLgas);
  return [];
}
async function loadNigeriaLgas(){
  if(data.nigeriaLgas) return data.nigeriaLgas;
  try{
    const response=await fetch(nigeriaLgaSource);
    if(!response.ok) throw new Error('Unable to load LGAs');
    const source=await response.json();
    data.nigeriaLgas=Object.fromEntries(nigeriaStates.map(state=>[state,normalizeLgas(source[state]||source[state==='Nasarawa'?'Nassarawa':state]||source[state.replace('Federal Capital Territory','FCT')]||[])]));
    save();
  }catch(error){
    data.nigeriaLgas ??= Object.fromEntries(nigeriaStates.map(state=>[state,[]]));
  }
  return data.nigeriaLgas;
}
function stateOptions(selected=''){return `<option value="">Select state</option>${nigeriaStates.map(state=>`<option value="${state}" ${state===selected?'selected':''}>${state}</option>`).join('')}`;}
function lgaOptions(state,selected=''){let lgas=data.nigeriaLgas?.[state]||[];return `<option value="">${state?(lgas.length?'Select LGA':'Loading LGAs…'):'Select a state first'}</option>${lgas.map(lga=>`<option value="${escapeValue(lga)}" ${lga===selected?'selected':''}>${escapeValue(lga)}</option>`).join('')}`;}
function purchaseQualityFields(values={},auditChanges=false,statusLocked=false){
  const inspectorId=String(values.inspectorId||''),inspectorName=values.inspector||'';
  const qcStatus=values.status||({Accepted:'Accepted',Hold:'Hold / retest',Rejected:'Rejected'}[values.decision]||'Pending');
  const history=escapeValue(JSON.stringify(values.statusHistory||[]));
  const auditNote=auditChanges?'Changing the Field QC status requires a dated, reasoned audit entry.':'Set the initial Field QC status for this new purchase. A dated reason is only required when updating an existing purchase.';
  const statusControl=statusLocked?`<input name="purchaseQcStatus" value="${escapeValue(qcStatus)}" readonly aria-describedby="purchase-qc-status-note"><div id="purchase-qc-status-note" class="item-note">Change this status from the QC dropdown on the Purchases list.</div>`:`<select name="purchaseQcStatus" id="purchase-qc-status">${['Pending','Inspection in progress','Accepted','Hold / retest','Rejected'].map(value=>`<option ${value===qcStatus?'selected':''}>${value}</option>`).join('')}</select>`;
  return `<div class="field full"><label>Field QC assessment</label><div class="item-note">Record the QC inspection completed at the collection site. ${auditNote}</div></div><div class="field"><label>Field QC status</label>${statusControl}<input type="hidden" name="purchaseQcStatusHistory" value="${history}"></div><div class="field"><label>QC test reference</label><input name="purchaseQcTestRef" value="${escapeValue(values.testReference||'')}" placeholder="Inspection / lab report reference"></div><div class="field"><label>Inspection date and time</label><input name="purchaseQcTestedAt" type="datetime-local" value="${escapeValue(values.testedAt||'')}"></div><div class="field"><label>Oil Content (%)</label><input name="purchaseOilContent" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${values.oilContent??''}"></div><div class="field"><label>FFA (%)</label><input name="purchaseFfa" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${values.ffa??''}"></div><div class="field"><label>Inspector</label><select name="purchaseInspectorId"><option value="">Select a user</option>${data.people.filter(person=>person.type==='User').map(person=>`<option value="${person.id}" ${String(person.id)===inspectorId||person.name===inspectorName?'selected':''}>${escapeValue(person.name)} · ${escapeValue(person.role||person.type||'User')}</option>`).join('')}</select></div><div class="field"><label>Initial moisture (%)</label><input name="purchaseMoisture" type="number" min="0" step="0.01" value="${values.moisture??''}"></div><div class="field"><label>Initial damaged kernels (%)</label><input name="purchaseDamaged" type="number" min="0" step="0.01" value="${values.damaged??''}"></div><div class="field"><label>Initial foreign matter (%)</label><input name="purchaseForeignMatter" type="number" min="0" step="0.01" value="${values.foreignMatter??''}"></div><div class="field"><label>Initial aflatoxin (ppb)</label><input name="purchaseAflatoxin" type="number" min="0" step="0.01" value="${values.aflatoxin??''}"></div><div class="field"><label>Initial condition</label><select name="purchaseCondition">${['Clean and dry','Minor defects','Contamination observed'].map(value=>`<option ${value===(values.condition||'Clean and dry')?'selected':''}>${value}</option>`).join('')}</select></div><div class="field full"><label>Initial assessment notes</label><textarea name="purchaseNotes">${escapeValue(values.notes||'')}</textarea></div>`;
}
function purchaseQualityFromForm(values){const inspector=data.people.find(person=>person.id===+values.purchaseInspectorId),status=values.purchaseQcStatus||'Pending';let history=[];try{history=JSON.parse(values.purchaseQcStatusHistory||'[]')}catch{}return {status,statusHistory:Array.isArray(history)?history:[],testReference:values.purchaseQcTestRef?.trim()||'',testedAt:values.purchaseQcTestedAt||'',oilContent:values.purchaseOilContent===''?'':Number(Number(values.purchaseOilContent).toFixed(2)),ffa:values.purchaseFfa===''?'':Number(Number(values.purchaseFfa).toFixed(2)),inspectorId:inspector?.id||null,inspector:inspector?.name||'',moisture:values.purchaseMoisture===''?'':Number(Number(values.purchaseMoisture).toFixed(2)),damaged:values.purchaseDamaged===''?'':Number(Number(values.purchaseDamaged).toFixed(2)),foreignMatter:values.purchaseForeignMatter===''?'':Number(Number(values.purchaseForeignMatter).toFixed(2)),aflatoxin:values.purchaseAflatoxin===''?'':Number(Number(values.purchaseAflatoxin).toFixed(2)),condition:values.purchaseCondition||'',decision:status==='Accepted'?'Accepted':status==='Rejected'?'Rejected':status==='Hold / retest'?'Hold':'Assess',notes:values.purchaseNotes?.trim()||''};}
function traceabilityFields(purchase={}, isNew=false){
  const reference=isNew?purchaseReference():(purchase.purchaseId||'Not assigned');
  const lotNo=purchase.lotNo||lotReference(reference);
  return `<div class="form-grid purchase-traceability"><div class="field"><label>Purchase ID</label><input value="${escapeValue(reference)}" readonly><div class="item-note">Generated automatically from Admin settings.</div></div><div class="field"><label>Lot No.</label><input name="lotNo" value="${escapeValue(lotNo)}" readonly><div class="item-note">Generated automatically from the purchase ID.</div></div><div class="field"><label>Origin state</label><select name="originState" id="origin-state">${stateOptions(purchase.originState||'')}</select></div><div class="field"><label>Origin LGA</label><select name="originLga" id="origin-lga">${lgaOptions(purchase.originState||'',purchase.originLga||'')}</select></div><div class="field"><label>Collection site / community</label><input name="collectionSite" value="${escapeValue(purchase.collectionSite||'')}" placeholder="Village, market or collection point"></div><div class="field"><label>Origin code</label><input name="originCode" value="${escapeValue(purchase.originCode||'')}" maxlength="6" pattern="[A-Za-z]{2,6}" placeholder="e.g. Tar"><div class="item-note">Used in the generated batch reference after QC acceptance.</div></div><div class="field full"><label>Supplier receipt ID</label><input name="supplierReceiptId" value="${escapeValue(purchase.supplierReceiptId||'')}" placeholder="Receipt / invoice ID supplied by the supplier"></div>${purchaseQualityFields(purchase.purchaseQuality||assessmentFor(purchase)||{},!isNew,!isNew)}<div class="field full"><label>Attachments</label><input name="attachmentsInput" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"><div class="item-note">Attach up to 5 pictures or documents, 1 MB each. Attachments are stored with this purchase.</div><div class="attachment-list"></div></div></div>`;
}
function attachmentList(form, attachments){
  const list=form.querySelector('.attachment-list');
  const render=()=>list.innerHTML=attachments.length?attachments.map((attachment,index)=>`<div class="item-note"><a href="${attachment.dataUrl}" download="${escapeValue(attachment.name)}">${escapeValue(attachment.name)}</a> · ${Math.ceil(attachment.size/1024)} KB <button type="button" class="text-btn remove-attachment" data-index="${index}">Remove</button></div>`).join(''):'<div class="item-note">No attachments added.</div>';
  render();
  list.onclick=event=>{let button=event.target.closest('.remove-attachment');if(!button)return;attachments.splice(+button.dataset.index,1);render();};
  const input=form.elements.attachmentsInput;
  input.parentElement.querySelector('.item-note')?.replaceChildren('Add up to 5 inspection photos or supporting documents. Phone photos are compressed automatically before saving.');
  input.insertAdjacentHTML('afterend','<label class="field-camera-capture"><span>Take field photo</span><input type="file" accept="image/*" capture="environment" aria-label="Take field inspection photo"></label>');
  const cameraInput=input.parentElement.querySelector('.field-camera-capture input');
  const fileData=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
  const compressPhoto=async file=>{
    if(!file.type.startsWith('image/')||file.size<=maxAttachmentBytes)return {name:file.name,type:file.type||'application/octet-stream',size:file.size,dataUrl:await fileData(file)};
    const url=URL.createObjectURL(file);
    try{
      const image=await new Promise((resolve,reject)=>{const element=new Image();element.onload=()=>resolve(element);element.onerror=reject;element.src=url;});
      const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
      let quality=.82,blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
      while(blob&&blob.size>maxAttachmentBytes&&quality>.4){quality-=.12;blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));}
      if(!blob||blob.size>maxAttachmentBytes)throw new Error('Photo is still too large after compression.');
      return {name:file.name.replace(/\.[^.]+$/,'')+'.jpg',type:'image/jpeg',size:blob.size,dataUrl:await fileData(blob)};
    }finally{URL.revokeObjectURL(url);}
  };
  const addFiles=async files=>{
    if(attachments.length+files.length>5){alert('A purchase can have a maximum of 5 attachments.');input.value='';return;}
    for(const file of files){
      try{attachments.push({id:id(),...await compressPhoto(file)});}catch{alert(`${file.name} could not be prepared. Choose a photo under 1 MB or retake it at a lower resolution.`);}
    }
    render();
  };
  input.onchange=async()=>{await addFiles([...input.files]);input.value='';};
  cameraInput.onchange=async()=>{await addFiles([...cameraInput.files]);cameraInput.value='';};
}
async function connectOriginLga(form, selectedLga=''){
  await loadNigeriaLgas();
  const state=form.elements.originState,lga=form.elements.originLga;
  const update=()=>{lga.innerHTML=lgaOptions(state.value,state.value===form.dataset.initialState?selectedLga:'');lga.disabled=!state.value;};
  update();
  state.onchange=update;
}

function localDateTimeValue(date=new Date()){
  const pad=value=>String(value).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function stageForFieldQcStatus(status){
  return {Pending:'Ordered',"Inspection in progress":'QC inspection',Accepted:'QC accepted','Hold / retest':'QC hold / retest',Rejected:'Rejected'}[status]||null;
}
function bindPurchaseQcStatus(form,{auditChanges=false}={}){
  const select=form.elements.purchaseQcStatus,historyInput=form.elements.purchaseQcStatusHistory;
  if(!select||!historyInput||select.dataset.auditBound==='yes')return;
  select.dataset.auditBound='yes';
  select.dataset.confirmedStatus=select.value;
  const close=overlay=>{overlay.remove();select.focus();};
  const openChange=(from,to)=>{
    const overlay=document.createElement('div');
    overlay.className='qc-status-change';
    overlay.innerHTML=`<section class="qc-status-change-card" role="dialog" aria-modal="true" aria-labelledby="qc-status-change-title"><p class="eyebrow">FIELD QC AUDIT</p><h3 id="qc-status-change-title">Record QC status change</h3><p class="item-note">${escapeValue(from)} → <strong>${escapeValue(to)}</strong>. Record why this on-site inspection status changed.</p><div class="form-grid"><div class="field"><label>Date and time</label><input class="qc-change-date" type="datetime-local" value="${localDateTimeValue()}" required></div><div class="field full"><label>Reason for change</label><textarea class="qc-change-reason" placeholder="Explain the inspection result or reason for the status change" required></textarea></div></div><div class="qc-status-change-actions"><button type="button" class="secondary qc-change-cancel">Cancel</button><button type="button" class="primary qc-change-save">Record change</button></div></section>`;
    form.append(overlay);
    const dateInput=overlay.querySelector('.qc-change-date'),reasonInput=overlay.querySelector('.qc-change-reason');
    overlay.querySelector('.qc-change-cancel').onclick=()=>{select.value=from;close(overlay);};
    overlay.querySelector('.qc-change-save').onclick=()=>{
      const changedAt=dateInput.value,reason=reasonInput.value.trim();
      if(!changedAt||!reason){reasonInput.reportValidity();return;}
      let history=[];try{history=JSON.parse(historyInput.value||'[]')}catch{}
      const operator=typeof currentOperator==='function'?currentOperator():null;
      history.push({from,to,changedAt,reason,changedBy:operator?.name||'Current user'});
      historyInput.value=JSON.stringify(history);
      select.value=to;select.dataset.confirmedStatus=to;
      const purchaseStage=form.elements.status,stage=stageForFieldQcStatus(to);
      if(purchaseStage&&stage&&purchaseStage.value!=='Quote')purchaseStage.value=stage;
      close(overlay);
    };
    reasonInput.focus();
  };
  select.addEventListener('change',()=>{
    const from=select.dataset.confirmedStatus||'Pending',to=select.value;
    if(from===to)return;
    if(!auditChanges){
      select.dataset.confirmedStatus=to;
      const purchaseStage=form.elements.status,stage=stageForFieldQcStatus(to);
      if(purchaseStage&&stage&&purchaseStage.value!=='Quote')purchaseStage.value=stage;
      return;
    }
    select.value=from;
    openChange(from,to);
  });
}

const purchaseTraceabilityModal=openModal;
openModal=(type,pid)=>{
  purchaseTraceabilityModal(type,pid);
  if(type!=='purchase') return;
  traceabilityData();
  const form=$('#record-form');
  form.querySelector('#form-fields').insertAdjacentHTML('afterbegin',traceabilityFields({},true));
  const createdByField=[...form.querySelectorAll('.field')].find(field=>field.querySelector('label')?.textContent==='Created by');
  if(createdByField){
    const operator=currentOperator?.()||data.people.find(person=>person.type==='User');
    createdByField.innerHTML=`<label>Created by</label><select name="createdBy" required>${data.people.filter(person=>person.type==='User').map(person=>`<option value="${escapeValue(person.name)}" ${person.name===operator?.name?'selected':''}>${escapeValue(person.name)} · ${escapeValue(person.role||'User')}</option>`).join('')}</select>`;
  }
  // A quote stays a quote until the purchaser explicitly advances it to Ordered.
  if(form.elements.status)form.elements.status.value='Quote';
  form.dataset.type='purchase-traceability';
  form.__traceAttachments=[];
  attachmentList(form,form.__traceAttachments);
  connectOriginLga(form);
  bindPurchaseQcStatus(form);
};

const purchaseTraceabilityEdit=editModal;
editModal=(kind,record)=>{
  purchaseTraceabilityEdit(kind,record);
  if(kind!=='purchase') return;
  traceabilityData();
  const form=$('#record-form'),attachments=[...(record.attachments||[])];
  form.querySelector('#form-fields').insertAdjacentHTML('afterbegin',traceabilityFields(record,false));
  form.dataset.type='purchase-traceability-edit';
  form.dataset.editId=record.id;
  attachmentList(form,attachments);
  form.dataset.traceAttachments='active';
  form.__traceAttachments=attachments;
  form.dataset.initialState=record.originState||'';
  connectOriginLga(form,record.originLga||'');
  bindPurchaseQcStatus(form,{auditChanges:true});
};

const purchaseQcStatusStyle=document.createElement('style');
purchaseQcStatusStyle.textContent='.qc-status-change{position:fixed;inset:0;z-index:20;display:grid;place-items:center;padding:20px;background:rgb(20 34 24 / .55)}.qc-status-change-card{width:min(500px,100%);max-height:calc(100dvh - 40px);overflow:auto;padding:24px;border:1px solid var(--line);border-radius:16px;background:var(--surface,#fff);box-shadow:0 20px 60px rgb(0 0 0 / .25)}.qc-status-change-card h3{margin:3px 0 8px}.qc-status-change-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.qc-status-change-actions button{width:auto}.qc-status-change .form-grid{margin-top:16px}';
document.head.append(purchaseQcStatusStyle);

const mobileFieldCaptureStyle=document.createElement('style');
mobileFieldCaptureStyle.textContent='.field-camera-capture{display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin-top:10px;padding:10px 14px;border:1px solid #c9a227;border-radius:6px;background:#fbf3df;color:#4d3b08;font-size:13px;font-weight:700;cursor:pointer}.field-camera-capture input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}@media(max-width:620px){.field-camera-capture{width:100%;font-size:15px}.purchase-wizard .field input,.purchase-wizard .field select,.purchase-wizard .field textarea{min-height:44px;font-size:16px}.wizard-forward{width:100%}.wizard-forward button,.wizard-back{min-height:44px}.wizard-next{flex:1}}';
document.head.append(mobileFieldCaptureStyle);

$('#record-form').addEventListener('submit',event=>{
  const form=event.currentTarget;
  if(form.dataset.type!=='purchase-traceability') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const values=formData(form),person=data.people.find(entry=>entry.id===+values.purchasedById),operator=currentOperator?.()||data.people.find(entry=>entry.type==='User');
  const attachments=form.__traceAttachments||[];
  const requestedReference=values.purchaseNumberChoice||'__auto__';
  const pendingStages=['Quote','Ordered','QC inspection','QC accepted','QC hold / retest','In transit'];
  const existingPurchase=data.purchases.find(purchase=>purchase.purchaseId===requestedReference&&purchase.supplier===values.supplier&&pendingStages.includes(purchase.status||'Quote'));
  if(requestedReference!=='__auto__'&&!existingPurchase){alert('That purchase number is no longer available for this supplier. Select the next generated number or an undelivered purchase number.');return;}
  const purchaseId=existingPurchase?.purchaseId||nextPurchaseReference();
  const purchaseQuality=purchaseQualityFromForm(values);
  const purchase={id:id(),purchaseId,date:values.purchasedDate,status:values.status,purchasedById:+values.purchasedById,purchasedBy:person?.name||'',createdBy:values.createdBy||operator?.name||'Current user',createdAt:new Date().toISOString(),item:values.item,itemDescription:values.itemDescription?.trim()||'',supplier:values.supplier,category:values.category,qty:+values.qty,unit:values.unit,unitPrice:parsePurchaseAmount(values.unitPrice),cost:parsePurchaseAmount(values.cost),lotNo:values.lotNo?.trim()||lotReference(purchaseId),originState:values.originState||'',originLga:values.originLga||'',collectionSite:values.collectionSite?.trim()||'',originCode:values.originCode?.trim().toUpperCase()||'',supplierReceiptId:values.supplierReceiptId?.trim()||'',purchaseQuality,attachments,stockReceived:false,qualityStatus:purchaseQuality.decision};
  data.purchases.unshift(purchase);save();render();$('#record-dialog').close();
},true);

$('#record-form').addEventListener('submit',event=>{
  const form=event.currentTarget;
  if(form.dataset.type!=='purchase-traceability-edit') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const values=formData(form),purchase=data.purchases.find(entry=>entry.id===+form.dataset.editId),person=data.people.find(entry=>entry.id===+values.purchasedById);
  const purchaseQuality=purchaseQualityFromForm(values);
  Object.assign(purchase,{date:values.purchasedDate,status:values.status,purchasedById:+values.purchasedById,purchasedBy:person?.name||'',item:values.item,itemDescription:values.itemDescription?.trim()||'',supplier:values.supplier,category:values.category,qty:+values.qty,unit:values.unit,unitPrice:parsePurchaseAmount(values.unitPrice),cost:parsePurchaseAmount(values.cost),lotNo:values.lotNo?.trim()||'',originState:values.originState||'',originLga:values.originLga||'',collectionSite:values.collectionSite?.trim()||'',originCode:values.originCode?.trim().toUpperCase()||'',supplierReceiptId:values.supplierReceiptId?.trim()||'',purchaseQuality,qualityStatus:purchaseQuality.decision,attachments:form.__traceAttachments||purchase.attachments||[]});
  save();render();$('#record-dialog').close();
},true);

const traceabilityAdminRender=renderAdmin;
renderAdmin=()=>{
  traceabilityAdminRender();traceabilityData();
  const grid=$('#admin-view .dashboard-grid');
  if(!$('#purchase-number-panel'))grid.insertAdjacentHTML('beforeend','<section class="panel table-panel admin-section-panel" id="purchase-number-panel"><div class="panel-head"><div><h3>Purchase, lot &amp; goods inwards numbers</h3><p>Generated references for new purchases, lots and goods received records.</p></div></div><div class="form-grid"><div class="field"><label>Purchase numbers</label><p class="item-note" id="purchase-number-preview"></p><button class="primary configure-purchase-number" type="button">Configure purchase numbers</button></div><div class="field"><label>Lot numbers</label><p class="item-note" id="lot-number-preview"></p><button class="primary configure-lot-number" type="button">Configure lot numbers</button></div><div class="field"><label>Goods Inwards IDs</label><p class="item-note" id="goods-inwards-number-preview"></p><button class="primary configure-goods-inwards-number" type="button">Configure Goods Inwards IDs</button></div></div></section>');
  const config=data.purchaseIdConfig,lotConfig=data.lotNoConfig,nextPurchase=purchaseReference();
  $('#purchase-number-preview').textContent=`Next purchase No.: ${nextPurchase}`;
  $('#lot-number-preview').textContent=`Next lot No.: ${lotReference(nextPurchase)}`;
  $('#goods-inwards-number-preview').textContent=`Next Goods Inwards ID: ${goodsInwardsReference()}`;
  $('.configure-purchase-number').onclick=()=>openNumberingModal('purchase');
  $('.configure-lot-number').onclick=()=>openNumberingModal('lot');
  $('.configure-goods-inwards-number').onclick=()=>openNumberingModal('goods-inwards');
};

function openNumberingModal(kind){
  traceabilityData();const purchase=kind==='purchase',goodsInwards=kind==='goods-inwards',config=purchase?data.purchaseIdConfig:goodsInwards?data.goodsInwardsIdConfig:data.lotNoConfig;
  $('#modal-label').textContent=purchase?'PURCHASE NUMBER':goodsInwards?'GOODS INWARDS ID':'LOT NUMBER';$('#modal-title').textContent=purchase?'Configure purchase numbering':goodsInwards?'Configure Goods Inwards numbering':'Configure lot numbering';
  const preview=purchase?`Next purchase No.: ${escapeValue(purchaseReference())}`:goodsInwards?`Next Goods Inwards ID: ${escapeValue(goodsInwardsReference())}`:`Next lot No.: ${escapeValue(lotReference(purchaseReference()))}`;
  $('#form-fields').innerHTML=(purchase||goodsInwards)?`<div class="form-grid"><div class="field"><label>Prefix</label><input name="prefix" value="${escapeValue(config.prefix)}" placeholder="e.g. ${purchase?'PUR-':'GIN-'}"></div><div class="field"><label>Starting sequence number</label><input name="sequenceStart" type="number" min="1" value="${config.sequenceStart}" required></div><div class="field"><label>Suffix</label><input name="suffix" value="${escapeValue(config.suffix)}" placeholder="Optional suffix"></div><div class="field"><label>Number padding</label><input name="padding" type="number" min="1" max="12" value="${config.padding}" required></div><div class="field full"><div class="item-note">${preview}</div></div></div>`:`<div class="form-grid"><div class="field"><label>Prefix</label><input name="prefix" value="${escapeValue(config.prefix)}" placeholder="e.g. LOT-"></div><div class="field"><label>Suffix</label><input name="suffix" value="${escapeValue(config.suffix)}" placeholder="Optional suffix"></div><div class="field"><label>Number padding</label><input name="padding" type="number" min="1" max="12" value="${config.padding}" required></div><div class="field full"><div class="item-note">${preview}</div></div></div>`;
  const form=$('#record-form'),saveButton=$('#save-record');
  form.dataset.type=`${kind}-number-config`;
  $('#form-fields').insertAdjacentHTML('beforeend','<p class="save-status" id="numbering-save-status" role="status" aria-live="polite"></p>');
  // The purchase wizard turns this shared button into a regular button. Reset
  // it when opening an Administration form so this form always submits itself.
  saveButton.type='submit';saveButton.onclick=null;saveButton.disabled=false;saveButton.hidden=false;
  saveButton.parentElement.hidden=false;saveButton.textContent='Save settings';
  $('#record-dialog').showModal();
}

$('#record-form').addEventListener('submit',async event=>{
  const form=event.currentTarget,kind=form.dataset.type;if(!['purchase-number-config','lot-number-config','goods-inwards-number-config'].includes(kind))return;
  event.preventDefault();event.stopImmediatePropagation();const values=formData(form);
  if(kind==='purchase-number-config'){const config=data.purchaseIdConfig,oldStart=Number(config.sequenceStart),next=Number(config.nextNumber);config.prefix=values.prefix||'';config.suffix=values.suffix||'';config.padding=Math.max(1,Math.min(12,Number(values.padding)||4));config.sequenceStart=Math.max(1,Number(values.sequenceStart)||1);if(next===oldStart||next<config.sequenceStart)config.nextNumber=config.sequenceStart;}
  else if(kind==='goods-inwards-number-config'){const config=data.goodsInwardsIdConfig,oldStart=Number(config.sequenceStart),next=Number(config.nextNumber);config.prefix=values.prefix||'';config.suffix=values.suffix||'';config.padding=Math.max(1,Math.min(12,Number(values.padding)||4));config.sequenceStart=Math.max(1,Number(values.sequenceStart)||1);if(next===oldStart||next<config.sequenceStart)config.nextNumber=config.sequenceStart;}
  else data.lotNoConfig={...data.lotNoConfig,prefix:values.prefix||'',suffix:values.suffix||'',padding:Math.max(1,Math.min(12,Number(values.padding)||4))};
  const status=$('#numbering-save-status'),saveButton=$('#save-record');
  saveButton.disabled=true;if(status)status.textContent='Saving settings…';
  try{
    const saved=await save();
    if(!saved) throw new Error('the settings changed in another session; the latest saved version has been reloaded');
    if(status)status.textContent='Settings saved.';
    $('#record-dialog').close();render();
  }catch(error){
    if(status)status.textContent=`Could not save settings: ${error.message||'please try again.'}`;
    console.error(error);
  }finally{saveButton.disabled=false;}
},true);

const traceabilityPurchases=purchases;
purchases=()=>{
  traceabilityPurchases();
  document.querySelectorAll('#purchases-table tr').forEach(row=>{
    const item=row.querySelector('td:nth-child(2) strong')?.textContent,supplier=row.querySelector('td:nth-child(3)')?.textContent;
    const purchase=data.purchases.find(entry=>entry.item===item&&entry.supplier===supplier);
    if(!purchase||row.querySelector('.traceability-note')) return;
    row.querySelector('td:nth-child(2)')?.insertAdjacentHTML('beforeend',`<div class="item-note traceability-note">${escapeValue(purchase.purchaseId||'Legacy purchase')} · Lot: ${escapeValue(purchase.lotNo||'—')} · ${escapeValue(purchase.originState||'Origin not recorded')}${purchase.originLga?` / ${escapeValue(purchase.originLga)}`:''}${purchase.attachments?.length?` · ${purchase.attachments.length} attachment${purchase.attachments.length===1?'':'s'}`:''}</div>`);
  });
};
render();
