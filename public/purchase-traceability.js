// Purchase traceability: controlled purchase references, origin and supplier evidence.
const nigeriaStates = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Federal Capital Territory','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
const nigeriaLgaSource = 'https://raw.githubusercontent.com/temikeezy/nigeria-geojson-data/main/data/lgas.json';
// Keep record attachments comfortably within the durable state payload limit.
const maxAttachmentBytes = 1000000;

function escapeValue(value=''){return String(value).replace(/[&<>'"]/g, character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));}
function traceabilityData(){
  data.purchaseIdConfig ??= {prefix:'PUR-',sequenceStart:1001,nextNumber:1001,suffix:''};
  data.purchaseIdConfig.prefix ??= '';
  data.purchaseIdConfig.suffix ??= '';
  data.purchaseIdConfig.sequenceStart ??= 1001;
  data.purchaseIdConfig.nextNumber ??= data.purchaseIdConfig.sequenceStart;
  data.purchases.forEach(purchase=>purchase.attachments ??= []);
}
function purchaseReference(number=data.purchaseIdConfig.nextNumber){
  traceabilityData();
  return `${data.purchaseIdConfig.prefix}${number}${data.purchaseIdConfig.suffix}`;
}
function nextPurchaseReference(){
  traceabilityData();
  const reference=purchaseReference();
  data.purchaseIdConfig.nextNumber=Number(data.purchaseIdConfig.nextNumber)+1;
  return reference;
}
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
function purchaseQualityFields(values={}){
  const inspectorId=String(values.inspectorId||''),inspectorName=values.inspector||'';
  return `<div class="field full"><label>Initial purchase quality assessment</label><div class="item-note">This is the supplier / purchasing assessment. Receiving quality is completed separately in Goods Inwards.</div></div><div class="field"><label>Oil Content (%)</label><input name="purchaseOilContent" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${values.oilContent??''}"></div><div class="field"><label>FFA (%)</label><input name="purchaseFfa" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${values.ffa??''}"></div><div class="field"><label>Inspector</label><select name="purchaseInspectorId"><option value="">Select a person</option>${data.people.map(person=>`<option value="${person.id}" ${String(person.id)===inspectorId||person.name===inspectorName?'selected':''}>${escapeValue(person.name)} · ${escapeValue(person.role||person.type||'Person')}</option>`).join('')}</select></div><div class="field"><label>Initial moisture (%)</label><input name="purchaseMoisture" type="number" min="0" step="0.01" value="${values.moisture??''}"></div><div class="field"><label>Initial damaged kernels (%)</label><input name="purchaseDamaged" type="number" min="0" step="0.01" value="${values.damaged??''}"></div><div class="field"><label>Initial foreign matter (%)</label><input name="purchaseForeignMatter" type="number" min="0" step="0.01" value="${values.foreignMatter??''}"></div><div class="field"><label>Initial aflatoxin (ppb)</label><input name="purchaseAflatoxin" type="number" min="0" step="0.01" value="${values.aflatoxin??''}"></div><div class="field"><label>Initial condition</label><select name="purchaseCondition">${['Clean and dry','Minor defects','Contamination observed'].map(value=>`<option ${value===(values.condition||'Clean and dry')?'selected':''}>${value}</option>`).join('')}</select></div><div class="field"><label>Initial assessment</label><select name="purchaseDecision">${['Assess','Accepted','Hold','Rejected'].map(value=>`<option ${value===(values.decision||'Assess')?'selected':''}>${value}</option>`).join('')}</select></div><div class="field full"><label>Initial assessment notes</label><textarea name="purchaseNotes">${escapeValue(values.notes||'')}</textarea></div>`;
}
function purchaseQualityFromForm(values){const inspector=data.people.find(person=>person.id===+values.purchaseInspectorId);return {oilContent:values.purchaseOilContent===''?'':Number(Number(values.purchaseOilContent).toFixed(2)),ffa:values.purchaseFfa===''?'':Number(Number(values.purchaseFfa).toFixed(2)),inspectorId:inspector?.id||null,inspector:inspector?.name||'',moisture:values.purchaseMoisture===''?'':Number(Number(values.purchaseMoisture).toFixed(2)),damaged:values.purchaseDamaged===''?'':Number(Number(values.purchaseDamaged).toFixed(2)),foreignMatter:values.purchaseForeignMatter===''?'':Number(Number(values.purchaseForeignMatter).toFixed(2)),aflatoxin:values.purchaseAflatoxin===''?'':Number(Number(values.purchaseAflatoxin).toFixed(2)),condition:values.purchaseCondition||'',decision:values.purchaseDecision||'Assess',notes:values.purchaseNotes?.trim()||''};}
function traceabilityFields(purchase={}, isNew=false){
  const reference=isNew?purchaseReference():(purchase.purchaseId||'Not assigned');
  return `<div class="form-grid purchase-traceability"><div class="field"><label>Purchase ID</label><input value="${escapeValue(reference)}" readonly><div class="item-note">Generated automatically from Admin settings.</div></div><div class="field"><label>Lot No.</label><input name="lotNo" value="${escapeValue(purchase.lotNo||'')}" placeholder="Supplier or internal lot reference"></div><div class="field"><label>Origin state</label><select name="originState" id="origin-state">${stateOptions(purchase.originState||'')}</select></div><div class="field"><label>Origin LGA</label><select name="originLga" id="origin-lga">${lgaOptions(purchase.originState||'',purchase.originLga||'')}</select></div><div class="field full"><label>Supplier receipt ID</label><input name="supplierReceiptId" value="${escapeValue(purchase.supplierReceiptId||'')}" placeholder="Receipt / invoice ID supplied by the supplier"></div>${purchaseQualityFields(purchase.purchaseQuality||assessmentFor(purchase)||{})}<div class="field full"><label>Attachments</label><input name="attachmentsInput" type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"><div class="item-note">Attach up to 5 pictures or documents, 1 MB each. Attachments are stored with this purchase.</div><div class="attachment-list"></div></div></div>`;
}
function attachmentList(form, attachments){
  const list=form.querySelector('.attachment-list');
  const render=()=>list.innerHTML=attachments.length?attachments.map((attachment,index)=>`<div class="item-note"><a href="${attachment.dataUrl}" download="${escapeValue(attachment.name)}">${escapeValue(attachment.name)}</a> · ${Math.ceil(attachment.size/1024)} KB <button type="button" class="text-btn remove-attachment" data-index="${index}">Remove</button></div>`).join(''):'<div class="item-note">No attachments added.</div>';
  render();
  list.onclick=event=>{let button=event.target.closest('.remove-attachment');if(!button)return;attachments.splice(+button.dataset.index,1);render();};
  const input=form.elements.attachmentsInput;
  input.onchange=async()=>{
    const files=[...input.files];
    if(attachments.length+files.length>5){alert('A purchase can have a maximum of 5 attachments.');input.value='';return;}
    for(const file of files){
      if(file.size>maxAttachmentBytes){alert(`${file.name} is larger than the 1 MB attachment limit and was not added.`);continue;}
      const dataUrl=await new Promise((resolve,reject)=>{let reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
      attachments.push({id:id(),name:file.name,type:file.type||'application/octet-stream',size:file.size,dataUrl});
    }
    input.value='';render();
  };
}
async function connectOriginLga(form, selectedLga=''){
  await loadNigeriaLgas();
  const state=form.elements.originState,lga=form.elements.originLga;
  const update=()=>{lga.innerHTML=lgaOptions(state.value,state.value===form.dataset.initialState?selectedLga:'');lga.disabled=!state.value;};
  update();
  state.onchange=update;
}

const purchaseTraceabilityModal=openModal;
openModal=(type,pid)=>{
  purchaseTraceabilityModal(type,pid);
  if(type!=='purchase') return;
  traceabilityData();
  const form=$('#record-form');
  form.querySelector('#form-fields').insertAdjacentHTML('afterbegin',traceabilityFields({},true));
  form.dataset.type='purchase-traceability';
  form.__traceAttachments=[];
  attachmentList(form,form.__traceAttachments);
  connectOriginLga(form);
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
};

$('#record-form').addEventListener('submit',event=>{
  const form=event.currentTarget;
  if(form.dataset.type!=='purchase-traceability') return;
  event.stopImmediatePropagation();
  const values=formData(form),person=data.people.find(entry=>entry.id===+values.purchasedById),operator=currentOperator?.()||data.people.find(entry=>entry.type==='User');
  const attachments=form.__traceAttachments||[];
  const purchase={id:id(),purchaseId:nextPurchaseReference(),date:values.purchasedDate,status:values.status,purchasedById:+values.purchasedById,purchasedBy:person?.name||'',createdBy:operator?.name||'Current user',createdAt:new Date().toISOString(),item:values.item,supplier:values.supplier,category:values.category,qty:+values.qty,unit:values.unit,unitPrice:+values.unitPrice,cost:+values.cost,lotNo:values.lotNo?.trim()||'',originState:values.originState||'',originLga:values.originLga||'',supplierReceiptId:values.supplierReceiptId?.trim()||'',purchaseQuality:purchaseQualityFromForm(values),attachments,stockReceived:false,qualityStatus:'Assess'};
  data.purchases.unshift(purchase);save();render();
},true);

$('#record-form').addEventListener('submit',event=>{
  const form=event.currentTarget;
  if(form.dataset.type!=='purchase-traceability-edit') return;
  event.stopImmediatePropagation();
  const values=formData(form),purchase=data.purchases.find(entry=>entry.id===+form.dataset.editId),person=data.people.find(entry=>entry.id===+values.purchasedById);
  Object.assign(purchase,{date:values.purchasedDate,status:values.status,purchasedById:+values.purchasedById,purchasedBy:person?.name||'',item:values.item,supplier:values.supplier,category:values.category,qty:+values.qty,unit:values.unit,unitPrice:+values.unitPrice,cost:+values.cost,lotNo:values.lotNo?.trim()||'',originState:values.originState||'',originLga:values.originLga||'',supplierReceiptId:values.supplierReceiptId?.trim()||'',purchaseQuality:purchaseQualityFromForm(values),attachments:form.__traceAttachments||purchase.attachments||[]});
  save();render();
},true);

const traceabilityAdminRender=renderAdmin;
renderAdmin=()=>{
  traceabilityAdminRender();traceabilityData();
  const grid=$('#admin-view .dashboard-grid');
  if(!$('#purchase-id-panel')) grid.insertAdjacentHTML('beforeend','<section class="panel table-panel" id="purchase-id-panel"><div class="panel-head"><div><h3>Purchase ID format</h3><p>Configure the automatic reference used for new purchases.</p></div></div><form id="purchase-id-form" class="form-grid"><div class="field"><label>Prefix</label><input name="prefix" placeholder="e.g. PUR-"></div><div class="field"><label>Starting sequence number</label><input name="sequenceStart" type="number" min="1" required></div><div class="field"><label>Suffix</label><input name="suffix" placeholder="e.g. -NG"></div><div class="field full"><div class="item-note" id="purchase-id-preview"></div></div><div class="field"><button class="primary" type="submit">Save ID format</button></div></form></section>');
  const config=data.purchaseIdConfig,form=$('#purchase-id-form');
  form.elements.prefix.value=config.prefix;form.elements.sequenceStart.value=config.sequenceStart;form.elements.suffix.value=config.suffix;
  $('#purchase-id-preview').textContent=`Next purchase ID: ${purchaseReference()}`;
  form.onsubmit=event=>{event.preventDefault();const oldStart=Number(config.sequenceStart),next=Number(config.nextNumber),values=formData(form);config.prefix=values.prefix||'';config.suffix=values.suffix||'';config.sequenceStart=Math.max(1,Number(values.sequenceStart)||1);if(next===oldStart||next<config.sequenceStart)config.nextNumber=config.sequenceStart;save();render();};
};

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
