// Goods Inwards is the controlled receiving point for purchased materials and quality release.
const goodsEscape=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
const goodsNumber=value=>value===''||value===null||value===undefined?'':Number(value).toFixed(2);
const goodsMoney=value=>value===''||value===null||value===undefined?'—':`₦${Number(value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
// Stock is always posted in the item's base unit. A receiver can record the
// supplier's pack/unit, but it must have a configured conversion before it can
// enter stock. This prevents a quantity of drums, bags or litres being added
// together merely because the item name is the same.
const normalizedGoodsUnit=value=>String(value||'').trim().toLowerCase();
function goodsItem(itemName){return (data.items||[]).find(item=>item.name===itemName);}
function stockUnitFor(itemName,fallbackUnit=''){
  return stockItem(itemName)?.unit||goodsItem(itemName)?.unit||fallbackUnit;
}
function unitFactor(fromUnit,toUnit){
  if(normalizedGoodsUnit(fromUnit)===normalizedGoodsUnit(toUnit))return 1;
  const conversion=(data.unitConversions||[]).find(entry=>normalizedGoodsUnit(entry.fromUnit)===normalizedGoodsUnit(fromUnit)&&normalizedGoodsUnit(entry.toUnit)===normalizedGoodsUnit(toUnit));
  const factor=Number(conversion?.factor);
  return Number.isFinite(factor)&&factor>0?factor:null;
}
function stockQuantityForReceipt(receipt){
  if(receipt.stockQty!==undefined)return Number(receipt.stockQty)||0;
  const stockUnit=receipt.stockUnit||stockUnitFor(receipt.item,receipt.unit);
  const factor=unitFactor(receipt.unit,stockUnit);
  return factor===null?Number(receipt.stockOnHandQty??receipt.qty)||0:Number((Number(receipt.qty||0)*factor).toFixed(6));
}
// Shown only once a receipt is accepted: this is the figure procurement and
// accounts settle against, not a payment the app has made.
function settlementNote(receipt){
  if(receipt.decision!=='Accepted'||receipt.payableCost===''||receipt.payableCost===null||receipt.payableCost===undefined)return '';
  const dry=receipt.adjustedQty===''||receipt.adjustedQty===null||receipt.adjustedQty===undefined?'':` · ${Number(receipt.adjustedQty).toLocaleString(undefined,{maximumFractionDigits:3})} ${goodsEscape(receipt.unit||'')} dry-equivalent at ${receipt.moistureBase??DEFAULT_BASE_MOISTURE}% base`;
  return `<div class="item-note settlement-note">Payable ${goodsMoney(receipt.payableCost)}${dry}</div>`;
}
const purchaseLabel=purchase=>`${purchase.purchaseId||`Purchase ${purchase.id}`} · ${purchase.item} · ${purchase.supplier}`;
// `qty` is deliberately absent: it holds the quantity actually delivered, which
// must be free to differ from the quantity ordered. Re-syncing it would erase
// the very variance the receiving screen exists to show.
const linkedPurchaseFields=['purchaseId','purchaseReference','purchaseDate','purchaseStatus','item','supplier','category','orderedQty','unit','unitPrice','cost','purchasedById','purchasedBy','createdBy','createdAt','lotNo','originState','originLga','collectionSite','originCode','supplierReceiptId','purchaseQuality','attachments'];
const purchaseStageOrder=['Quote','Ordered','QC inspection','QC accepted','In transit','Arrived at factory','Moved to warehouse','Rejected'];
const DEFAULT_BASE_MOISTURE=8;
function baseMoisture(){const configured=Number(data.settings?.baseMoisture);return Number.isFinite(configured)&&configured>=0&&configured<100?configured:DEFAULT_BASE_MOISTURE;}

/**
 * Moisture settlement.
 *
 * Every delivered kilogram is received into store, water included, so `qty` —
 * the quantity that reaches Stock on Hand — is never reduced here. What
 * moisture changes is the amount payable: the supplier is paid for the
 * dry-equivalent weight the load would have at the contract base moisture.
 * Recording both figures keeps "what we hold" and "what we owe" separately
 * auditable instead of collapsing them into one adjusted number.
 */
function applyMoistureSettlement(record){
  const configuredBase=baseMoisture(),claimedMoisture=Number(record.purchaseQuality?.moisture),base=Number.isFinite(claimedMoisture)&&claimedMoisture>=0&&claimedMoisture<100?claimedMoisture:configuredBase,moisture=Number(record.moisture),gross=Number(record.qty)||0,unitPrice=Number(record.unitPrice)||0,agreedCost=Number(record.cost)||gross*unitPrice;
  record.moistureBase=base;
  if(record.moisture===''||record.moisture===null||record.moisture===undefined||!Number.isFinite(moisture)||!gross){record.adjustedQty='';record.moistureVariance='';record.payableCost='';return record;}
  // The purchase-time inspection is the agreed quality benchmark. Better (or
  // equal) factory moisture must retain the agreed price; only deterioration
  // after purchase reduces the payable amount.
  const adjusted=moisture<=base?gross:gross*(100-moisture)/(100-base);
  record.adjustedQty=Number(adjusted.toFixed(3));
  record.moistureVariance=Number((adjusted-gross).toFixed(3));
  record.payableCost=moisture<=base?Number(agreedCost.toFixed(2)):Number((Math.min(adjusted*unitPrice,agreedCost)).toFixed(2));
  return record;
}

function receiptForPurchase(purchase){
  const initialAssessment=purchase.purchaseQuality||assessmentFor(purchase)||{};
  return {id:`purchase-${purchase.id}`,linkedPurchase:true,receivedDate:purchase.date,purchaseId:purchase.id,purchaseReference:purchase.purchaseId||`Purchase ${purchase.id}`,purchaseDate:purchase.date,purchaseStatus:purchase.status||'Quote',item:purchase.item,supplier:purchase.supplier,category:purchase.category,orderedQty:+purchase.qty,qty:+purchase.qty,unit:purchase.unit,unitPrice:+purchase.unitPrice||0,cost:+purchase.cost||0,purchasedById:purchase.purchasedById||'',purchasedBy:purchase.purchasedBy||'',createdBy:purchase.createdBy||'',createdAt:purchase.createdAt||purchase.date,lotNo:purchase.lotNo||initialAssessment.batch||'',originState:purchase.originState||'',originLga:purchase.originLga||'',collectionSite:purchase.collectionSite||'',originCode:purchase.originCode||'',supplierReceiptId:purchase.supplierReceiptId||'',purchaseQuality:initialAssessment,attachments:[...(purchase.attachments||[])],batch:purchase.lotNo||initialAssessment.batch||'',qualityDate:purchase.date,moisture:'',damaged:'',foreignMatter:'',aflatoxin:'',oilContent:'',ffa:'',condition:'',decision:'Assess',qualityCheckOfficerId:'',qualityCheckOfficer:'',notes:''};
}

function syncReceiptFromPurchase(receipt,purchase){
  const source=receiptForPurchase(purchase);
  linkedPurchaseFields.forEach(field=>receipt[field]=source[field]);
  receipt.batch=receipt.batch||source.batch;
  return receipt;
}

/**
 * The order stage follows what has physically happened to the goods.
 *
 * Until an inspection produces a decision the buyer owns the stage, so a
 * purchase can sit at Quote, Ordered or In transit without the receiving screen
 * dragging it forward. Once QC has decided, the stage is system-set and the two
 * terminal stages are never chosen by hand.
 */
function purchaseStageFor(purchase,receipt){
  if(receipt.decision==='Rejected')return 'Rejected';
  // `arrivedAt` is written only when the receiver saves Goods Inwards. Older
  // received records are recognised from their warehouse or QC decision.
  if(receipt.warehouseId)return 'Moved to warehouse';
  if(receipt.arrivedAt||receipt.decision!=='Assess')return 'Arrived at factory';
  return purchaseStageOrder.includes(purchase.status)&&purchase.status!=='Rejected'?purchase.status:'Ordered';
}

function ensureGoodsInwards(){
  data.goodsInwards??=[];
  data.purchases.forEach(purchase=>{
    let receipt=data.goodsInwards.find(record=>record.purchaseId===purchase.id);
    if(!receipt){receipt=receiptForPurchase(purchase);data.goodsInwards.unshift(receipt)}
    // A deleted receipt remains as a hidden marker against its purchase. This
    // prevents automatic placeholder creation, while allowing the same
    // purchase to be received again through the normal wizard.
    if(receipt.deleted){purchase.qualityStatus='Assess';purchase.stockReceived=false;return;}
    if(receipt.orderedQty===undefined)receipt.orderedQty=+purchase.qty;
    purchase.status=purchaseStageFor(purchase,receipt);
    purchase.qualityStatus=receipt.decision||'Assess';
    syncReceiptFromPurchase(receipt,purchase);
  });
}

function receiptBadge(decision){return badge(decision||'Assess')}

function goodsQualityFields(values={}){
  const officerId=String(values.qualityCheckOfficerId||''),officerName=values.qualityCheckOfficer||values.inspector||'';
  return `<div class="field full"><label>Goods inwards quality assessment</label><div class="item-note">Assess the delivered lot before it is released for production.</div></div><div class="field"><label>Batch / lot number</label><input name="batch" value="${goodsEscape(values.batch||'')}"></div><div class="field"><label>Assessment date</label><input name="qualityDate" type="date" value="${goodsEscape(values.date||values.qualityDate||new Date().toISOString().slice(0,10))}"></div><div class="field"><label>Visual condition</label><select name="condition">${['Clean and dry','Minor defects','Contamination observed'].map(value=>`<option ${value===(values.condition||'Clean and dry')?'selected':''}>${value}</option>`).join('')}</select></div><div class="field"><label>Quality decision</label><select name="decision">${['Assess','Accepted','Hold','Rejected'].map(value=>`<option ${value===(values.decision||'Assess')?'selected':''}>${value}</option>`).join('')}</select></div><div class="field"><label>Quality check officer</label><select name="qualityCheckOfficerId" required><option value="">Select user</option>${data.people.filter(person=>person.type==='User').map(person=>`<option value="${person.id}" ${String(person.id)===officerId||person.name===officerName?'selected':''}>${goodsEscape(person.name)} · ${goodsEscape(person.role||person.type||'User')}</option>`).join('')}</select></div><div class="field full"><label>Notes</label><textarea name="notes">${goodsEscape(values.notes||'')}</textarea></div>`;
}

function purchaseTraceCard(receipt={}){
  if(!receipt.purchaseId)return '';
  const origin=[receipt.collectionSite,receipt.originLga,receipt.originState].filter(Boolean).join(', ')||'—';
  const attachments=(receipt.attachments||[]).map(file=>`<a href="${goodsEscape(file.dataUrl||'')}" download="${goodsEscape(file.name||'attachment')}">${goodsEscape(file.name||'Attachment')}</a>`).join(' · ')||'None';
  return `<div class="field full purchase-trace-card"><label>Purchase traceability</label><div class="item-note"><strong>${goodsEscape(receipt.purchaseReference||'—')}</strong> · ${goodsEscape(receipt.purchaseStatus||'—')} · Lot: ${goodsEscape(receipt.lotNo||'—')} · Origin: ${goodsEscape(origin)}${receipt.originCode?` (${goodsEscape(receipt.originCode)})`:''} · Supplier receipt: ${goodsEscape(receipt.supplierReceiptId||'—')}<br>Purchased by: ${goodsEscape(receipt.purchasedBy||'—')} · Unit price: ₦${(+receipt.unitPrice||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} · Total: ₦${(+receipt.cost||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}<br>Purchase attachments: ${attachments}</div></div>`;
}

// Receiving readings follow the delivered item's configured quality standard
// (e.g. Diesel), not a fixed nut list. Nut parameters keep their original
// receipt columns so existing records, lists and reports still read them.
const legacyReceivingFields={oilContent:'oilContent',ffa:'ffa',moisture:'moisture',damagedKernels:'damaged',damaged:'damaged',foreignMatter:'foreignMatter',aflatoxin:'aflatoxin'};
const receivingFieldName=key=>legacyReceivingFields[key]||`qualityParameter_${String(key).replace(/[^A-Za-z0-9_]/g,'')}`;
function receivingStandardFor(itemName,category){
  if(itemName)return itemStandard?.(itemName,category)||categoryStandard?.(category)||{name:'No quality standard configured',parameters:[]};
  return categoryStandard?.(category)||peanutStandard||{name:'JE Oils Standard',parameters:[]};
}
function formReceivingStandard(form){
  const purchase=data.purchases.find(entry=>entry.id===+form.elements.namedItem('purchaseId')?.value);
  return receivingStandardFor(form.elements.namedItem('item')?.value||purchase?.item,form.elements.namedItem('category')?.value||purchase?.category);
}
// Nut deliveries have always recorded moisture at receipt although the nut
// standard does not list it, so it is kept for those standards only.
function receivingStandardParameters(standard){
  const parameters=[...(standard?.parameters||[])];
  if(parameters.some(parameter=>parameter.key==='oilContent')&&!parameters.some(parameter=>parameter.key==='moisture'))parameters.splice(2,0,{key:'moisture',label:'Moisture',unit:'%'});
  return parameters;
}
// [field name, label, unit, baseline source, standard key, operator]
function receivingComparisonFieldsFor(form){
  return [['qty','Quantity','','orderedQty'],...receivingStandardParameters(formReceivingStandard(form)).map(parameter=>[receivingFieldName(parameter.key),parameter.label||parameter.key,parameter.unit||'',undefined,parameter.key,parameter.operator])];
}
// More material and oil are favourable; every quality contaminant is better
// when lower. A standard's operator (≥ / ≤) decides this for other parameters.
const favourableDirection={qty:'higher',oilContent:'higher',ffa:'lower',moisture:'lower',damaged:'lower',foreignMatter:'lower',aflatoxin:'lower'};
function receivingDirection(field,operator=''){return /[≥>]/.test(operator)?'higher':/[≤<]/.test(operator)?'lower':favourableDirection[field]||'lower';}
// Field QC stores readings by standard key; older purchase records used the receipt columns.
function receivingBaseline(assessment,field,key){const value=assessment?.parameters?.[key];return value!==undefined&&value!==null&&value!==''?value:assessment?.[field];}
function receivingReadingValue(receipt,field,key){const value=receipt?.qualityParameters?.[key];return value!==undefined?value:receipt?.[field];}
function comparisonNumber(value){return value===''||value===null||value===undefined||!Number.isFinite(Number(value))?null:Number(value);}
function comparisonValue(value,unit=''){const number=comparisonNumber(value);return number===null?'—':`${number.toLocaleString(undefined,{maximumFractionDigits:2})}${unit?' '+unit:''}`;}
function receivingParameterFieldsHtml(standard,values={}){
  return receivingStandardParameters(standard).map(parameter=>{
    const limit=[parameter.operator,parameter.limit,parameter.unit].filter(value=>value!==undefined&&value!==null&&value!=='').join(' ');
    return `<div class="field receiving-parameter-field" data-parameter-key="${goodsEscape(parameter.key)}"><label>${goodsEscape(parameter.label||parameter.key)}${parameter.unit?` (${goodsEscape(parameter.unit)})`:''}</label><input name="${goodsEscape(receivingFieldName(parameter.key))}" type="number" step="any" inputmode="decimal" value="${goodsEscape(values[parameter.key]??'')}">${limit?`<div class="item-note">Standard: ${goodsEscape(limit)}</div>`:''}</div>`;
  }).join('')||'<div class="field receiving-parameter-field"><div class="item-note">No quality parameters are configured for this item. Configure its standard in Administration.</div></div>';
}
// Re-rendered whenever the purchase, item or category changes; readings already
// typed for a parameter that is still in the standard are kept.
function renderReceivingParameterFields(form,receipt){
  const anchor=form.elements.namedItem('qualityCheckOfficerId')?.closest('.field');
  if(!anchor)return;
  const standard=formReceivingStandard(form);
  const values=Object.fromEntries(receivingStandardParameters(standard).map(parameter=>{const value=receivingReadingValue(receipt,receivingFieldName(parameter.key),parameter.key);return [parameter.key,value===null||value===undefined?'':value];}));
  form.querySelectorAll('.receiving-parameter-field').forEach(field=>{const input=field.querySelector('input');if(input&&input.value!=='')values[field.dataset.parameterKey]=input.value;field.remove();});
  anchor.insertAdjacentHTML('beforebegin',receivingParameterFieldsHtml(standard,values));
  form._deliveryReadings=null;
  form.querySelectorAll('.receiving-parameter-field input').forEach(input=>input.addEventListener('input',()=>{form._deliveryReadings=null;window.refreshReceivingDecision?.(form);}));
}
function initialQualityCard(receipt={}){
  // Purchase/delivery notes were deliberately removed from the inspection
  // screen. The live comparison now belongs with the receiving decision.
  return '';
}

function refreshInitialQualityComparison(form){
  form.querySelectorAll('[data-qc-comparison]').forEach(row=>{
    const key=row.dataset.qcComparison,unit=row.dataset.qcUnit||'',baseline=comparisonNumber(row.dataset.qcBaseline),received=comparisonNumber(form.elements[key]?.value);
    const receivedCell=row.querySelector('.qc-received-value'),changeCell=row.querySelector('.qc-change-value');
    if(received===null){receivedCell.textContent='Not recorded';changeCell.textContent='—';changeCell.className='qc-change-value is-unavailable';changeCell.style.removeProperty('--qc-heat');return;}
    receivedCell.textContent=comparisonValue(received,unit);
    if(baseline===null){changeCell.textContent='No baseline';changeCell.className='qc-change-value is-unavailable';changeCell.style.removeProperty('--qc-heat');return;}
    const difference=received-baseline,sign=difference>0?'+':'';
    if(difference===0){changeCell.textContent=`0${unit?' '+unit:''} · No change`;changeCell.className='qc-change-value is-same';changeCell.style.setProperty('--qc-heat','.08');return;}
    const better=(difference>0)===((favourableDirection[key]||'lower')==='higher');
    const heat=Math.min(.52,Math.max(.12,Math.abs(difference)/(Math.abs(baseline)||Math.abs(received)||1)*.65+.12)).toFixed(2);
    changeCell.textContent=`${sign}${difference.toLocaleString(undefined,{maximumFractionDigits:2})}${unit?' '+unit:''} · ${better?'Better':'Worse'}`;
    changeCell.className=`qc-change-value ${better?'is-better':'is-worse'}`;
    changeCell.style.setProperty('--qc-heat',heat);
  });
}

function receiptFields(receipt={}){
  const operator=currentOperator?.()||data.people.find(person=>person.type==='User'),today=new Date().toISOString().slice(0,10);
  const receiptUnits=[...new Set([...(data.units||[]),receipt.unit].filter(Boolean))];
  return `<div class="form-grid"><div class="field"><label>Goods received date</label><input name="receivedDate" type="date" value="${goodsEscape(receipt.receivedDate||today)}" required></div><div class="field"><label>Link to purchase</label><select name="purchaseId"><option value="">Standalone receipt</option>${data.purchases.map(purchase=>`<option value="${purchase.id}" ${purchase.id===receipt.purchaseId?'selected':''}>${goodsEscape(purchaseLabel(purchase))}</option>`).join('')}</select></div>${purchaseTraceCard(receipt)}${initialQualityCard(receipt)}<div class="field"><label>Supplier</label><input name="supplier" value="${goodsEscape(receipt.supplier||'')}" required></div><div class="field"><label>Item received</label><select name="item" required>${data.items.map(item=>`<option value="${goodsEscape(item.name)}" ${item.name===receipt.item?'selected':''}>${goodsEscape(item.name)}</option>`).join('')}</select></div><div class="field"><label>Category</label><select name="category" required>${data.categories.map(category=>`<option ${category===receipt.category?'selected':''}>${goodsEscape(category)}</option>`).join('')}</select></div><div class="field"><label>Quantity received</label><input name="qty" type="number" min="0" step="any" value="${goodsEscape(receipt.qty??'')}" required></div><div class="field"><label>Receipt unit</label><select name="unit" required>${receiptUnits.map(unit=>`<option value="${goodsEscape(unit)}" ${unit===receipt.unit?'selected':''}>${goodsEscape(unit)}</option>`).join('')}</select><div class="item-note">Stock is posted in the item's base unit; conversions are managed in Administration.</div></div><div class="field"><label>Received by</label><select name="receivedBy">${data.people.map(person=>`<option ${person.name===(receipt.receivedBy||operator?.name)?'selected':''}>${goodsEscape(person.name)}</option>`).join('')}</select></div><div class="field"><label>Assign to warehouse</label><select name="warehouseId"><option value="">Not yet assigned</option>${(data.warehouses||[]).map(warehouse=>`<option value="${warehouse.id}" ${warehouse.id===receipt.warehouseId?'selected':''}>${goodsEscape(warehouse.name)} · ${goodsEscape(warehouse.location)}</option>`).join('')}</select><div class="item-note">Assigning posts the quantity to Stock on Hand.</div></div><div class="field"><label>Assigned by</label><select name="warehouseAssignedById"><option value="">Select a person</option>${data.people.map(person=>`<option value="${person.id}" ${person.id===receipt.warehouseAssignedById?'selected':''}>${goodsEscape(person.name)} · ${goodsEscape(person.role||person.type||'Person')}</option>`).join('')}</select></div><div class="field"><label>Warehouse assignment date</label><input name="warehouseAssignedDate" type="date" value="${goodsEscape(receipt.warehouseAssignedDate||today)}"></div><div class="field"><label>Created by</label><input value="${goodsEscape(receipt.createdBy||operator?.name||'Current user')}" readonly></div><div class="field"><label>Created date</label><input value="${goodsEscape((receipt.createdAt||today).slice(0,10))}" readonly></div>${goodsQualityFields(receipt)}</div>`;
}

// `HTMLFormControlsCollection.item` is a browser method, so the purchase-item
// select must be resolved with namedItem rather than property access.
const goodsFormControl=(form,name)=>form.elements.namedItem(name);

function fillGoodsFromPurchase(form,purchase){
  if(!purchase)return;
  goodsFormControl(form,'item').value=purchase.item;form.elements.supplier.value=purchase.supplier;form.elements.category.value=purchase.category;form.elements.qty.value=purchase.qty;form.elements.unit.value=purchase.unit;if(form.elements.quantityOrdered)form.elements.quantityOrdered.value=`${purchase.qty} ${purchase.unit||''}`.trim();
  const current={purchaseId:purchase.id};syncReceiptFromPurchase(current,purchase);
  form.querySelector('.purchase-trace-card')?.replaceWith(document.createRange().createContextualFragment(purchaseTraceCard(current)));
  form.querySelector('.initial-quality-card')?.replaceWith(document.createRange().createContextualFragment(initialQualityCard(current)));
  if(form.elements.batch&&!form.elements.batch.value)form.elements.batch.value=purchase.lotNo||'';
  refreshInitialQualityComparison(form);
}

// A receipt linked to a purchase must retain the item's purchase traceability.
// Keep these catalogue fields in the submitted form data, but prevent them from
// being changed independently of the selected purchase.
function setPurchaseLinkedFieldState(form,purchase){
  const linked=Boolean(purchase);
  ['supplier','item','category','unit'].forEach(name=>{
    const field=goodsFormControl(form,name);
    if(!field)return;
    field.setAttribute('aria-readonly',String(linked));
    field.tabIndex=linked?-1:0;
    field.readOnly=linked;
    field.style.pointerEvents=linked?'none':'';
    field.style.backgroundColor=linked?'#f5f6f2':'';
    field.title=linked?'Set by the linked purchase':'';
    field.closest('.field')?.classList.toggle('purchase-linked-field',linked);
  });
  const itemField=goodsFormControl(form,'item')?.closest('.field');
  if(itemField){
    let note=itemField.querySelector('.purchase-linked-note');
    if(linked&&!note){
      note=document.createElement('div');
      note.className='item-note purchase-linked-note';
      note.textContent='Pulled from the selected purchase. Change the linked purchase to update this item.';
      itemField.append(note);
    }else if(!linked)note?.remove();
  }
}

function openGoodsInward(receipt){
  ensureGoodsInwards();$('#modal-label').textContent=receipt?'EDIT GOODS RECEIVED':'GOODS RECEIVED';$('#modal-title').textContent=receipt?'Update goods inward record':'Receive goods and complete quality check';$('#form-fields').innerHTML=receiptFields(receipt);
  const form=$('#record-form');form.dataset.type='goods-inward';form.dataset.receiptId=receipt?.id||'';
  const goodsInwardsId=receipt?.goodsInwardsId||goodsInwardsReference();
  const identifier=document.createElement('div');identifier.className='field';identifier.innerHTML=`<label>Goods Inwards ID</label><input name="goodsInwardsId" value="${goodsEscape(goodsInwardsId)}" readonly><div class="item-note">Generated automatically from Administration settings.</div>`;
  form.querySelector('#form-fields .form-grid')?.prepend(identifier);
  const linkedPurchase=receipt?.purchaseId&&data.purchases.find(purchase=>purchase.id===receipt.purchaseId);
  const qcReference=receipt?.purchaseQuality?.testReference||linkedPurchase?.purchaseQuality?.testReference||'';
  const qcBatchReferenceField=document.createElement('div');qcBatchReferenceField.className='field';qcBatchReferenceField.innerHTML=`<label>QC Batch Reference</label><input name="qcBatchReference" value="${goodsEscape(qcReference)}" readonly><div class="item-note">Linked from the purchase Field QC record.</div>`;
  form.querySelector('#form-fields .form-grid')?.prepend(qcBatchReferenceField);
  const purchaseField=form.elements.purchaseId?.closest('.field');
  if(purchaseField){
    const ordered=document.createElement('div');ordered.className='field';ordered.innerHTML=`<label>Quantity ordered</label><input name="quantityOrdered" value="${goodsEscape(receipt?.orderedQty??'')} ${goodsEscape(receipt?.unit||'')}" readonly>`;
    purchaseField.insertAdjacentElement('afterend',ordered);
  }
  const createdByField=[...form.querySelectorAll('.field')].find(field=>field.querySelector('label')?.textContent==='Created by');
  if(createdByField){const createdBy=receipt?.createdBy||'';createdByField.innerHTML=`<label>Created by</label><select name="createdBy" required><option value="" ${createdBy?'':'selected'}>Select user</option>${data.people.filter(person=>person.type==='User'&&person.name).map(person=>`<option value="${goodsEscape(person.name)}" ${person.name===createdBy?'selected':''}>${goodsEscape(person.name)} · ${goodsEscape(person.role||'User')}</option>`).join('')}</select>`;}
  const users=data.people.filter(person=>person.type==='User'&&person.name);
  const receivedBy=receipt?.receivedBy||'';
  if(form.elements.receivedBy){form.elements.receivedBy.required=true;form.elements.receivedBy.innerHTML=`<option value="" ${receivedBy?'':'selected'}>Select user</option>${users.map(person=>`<option value="${goodsEscape(person.name)}" ${person.name===receivedBy?'selected':''}>${goodsEscape(person.name)} · ${goodsEscape(person.role||'User')}</option>`).join('')}`;}
  const assignedBy=receipt?.warehouseAssignedById??'';
  if(form.elements.warehouseAssignedById)form.elements.warehouseAssignedById.innerHTML=`<option value="" ${assignedBy?'':'selected'}>Select user</option>${users.map(person=>`<option value="${person.id}" ${String(person.id)===String(assignedBy)?'selected':''}>${goodsEscape(person.name)} · ${goodsEscape(person.role||'User')}</option>`).join('')}`;
  form.elements.purchaseId.onchange=()=>{
    const purchase=data.purchases.find(entry=>entry.id===+form.elements.purchaseId.value);
    const linkedReceipt=purchase&&data.goodsInwards.find(record=>record.purchaseId===purchase.id);
    // Every purchase has one controlled Goods Inwards record. Selecting the
    // purchase must update that record rather than create a second receipt.
    form.dataset.receiptId=linkedReceipt?.id||'';
    fillGoodsFromPurchase(form,purchase);
    setPurchaseLinkedFieldState(form,purchase);
    if(form.elements.qcBatchReference)form.elements.qcBatchReference.value=purchase?.purchaseQuality?.testReference||'';
  };
  goodsFormControl(form,'item').onchange=()=>{const item=data.items.find(entry=>entry.name===goodsFormControl(form,'item').value);if(item){form.elements.category.value=item.category;form.elements.unit.value=item.unit}};
  if(linkedPurchase)fillGoodsFromPurchase(form,linkedPurchase);
  setPurchaseLinkedFieldState(form,linkedPurchase);
  renderReceivingParameterFields(form,receipt);
  refreshInitialQualityComparison(form);
  $('#record-dialog').showModal();
}

function renderGoodsInwards(){
  ensureGoodsInwards();const view=$('#quality-view');view.querySelector('.view-head h2').textContent='Goods inwards';view.querySelector('.view-head p').textContent='Receive goods, assess quality, and retain complete purchase traceability.';
  const add=$('#add-quality');add.textContent='+ Record goods received';add.onclick=()=>openGoodsInward();
  const visibleReceipts=data.goodsInwards.filter(receipt=>!receipt.deleted);
  $('#quality-stats').innerHTML=[['Receipts',visibleReceipts.length],['Accepted',visibleReceipts.filter(record=>record.decision==='Accepted').length],['Assess / hold / rejected',visibleReceipts.filter(record=>['Assess','Hold','Rejected'].includes(record.decision)).length]].map(item=>`<div class="quality-stat"><small>${item[0]}</small><strong>${item[1]}</strong></div>`).join('');
  $('#quality-table').parentElement.querySelector('thead').innerHTML='<tr><th>Received</th><th>Completed at</th><th>Goods / lot</th><th>Supplier / origin</th><th>Quantity</th><th>Warehouse</th><th>Inspection</th><th>Decision</th><th>Officer</th><th></th></tr>';
  $('#quality-table').innerHTML=[...visibleReceipts].sort((a,b)=>String(b.receivedDate).localeCompare(String(a.receivedDate))).map(receipt=>{const origin=[receipt.originLga,receipt.originState].filter(Boolean).join(', '),warehouse=(data.warehouses||[]).find(entry=>entry.id===receipt.warehouseId),warehouseText=warehouse?warehouse.name:'Not assigned',completed=receipt.finalizedAt||receipt.arrivedAt||receipt.createdAt;const readings=receivingStandardParameters(receivingStandardFor(receipt.item,receipt.category)).map(parameter=>{const value=comparisonNumber(receivingReadingValue(receipt,receivingFieldName(parameter.key),parameter.key));return `${goodsEscape(parameter.label||parameter.key)} ${value===null?'—':`${value.toLocaleString(undefined,{maximumFractionDigits:4})}${parameter.unit?` ${goodsEscape(parameter.unit)}`:''}`}`;});const result=readings.map((reading,index)=>`${index?(index%2?' · ':'<br>'):''}${reading}`).join('')||'No parameters configured';return `<tr><td>${date(receipt.receivedDate)}</td><td>${completed?new Date(completed).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'Not recorded'}</td><td><strong>${goodsEscape(receipt.item)}</strong><div class="item-note">${goodsEscape(receipt.purchaseReference||'Standalone receipt')} · Lot: ${goodsEscape(receipt.lotNo||receipt.batch||'—')}</div></td><td>${goodsEscape(receipt.supplier)}<div class="item-note">${goodsEscape(origin||'Origin not recorded')}</div></td><td>${(+receipt.qty).toLocaleString()} ${goodsEscape(receipt.unit)}${settlementNote(receipt)}</td><td>${goodsEscape(warehouseText)}<div class="item-note">${goodsEscape(receipt.warehouseAssignedBy||'—')} · ${receipt.warehouseAssignedDate?date(receipt.warehouseAssignedDate):'—'}</div></td><td class="quality-result">${result}</td><td>${receiptBadge(receipt.decision)}</td><td>${goodsEscape(receipt.qualityCheckOfficer||'—')}</td><td><button class="text-btn edit-receipt" data-receipt-id="${goodsEscape(receipt.id)}">Edit</button>${canDeleteRecords?.()?` <button class="text-btn delete-receipt" data-receipt-id="${goodsEscape(receipt.id)}">Delete</button>`:''}</td></tr>`;}).join('')||'<tr><td colspan="10">No goods received yet.</td></tr>';
  document.querySelectorAll('.edit-receipt').forEach(button=>button.onclick=()=>openGoodsInward(data.goodsInwards.find(receipt=>String(receipt.id)===button.dataset.receiptId)));
  document.querySelectorAll('.delete-receipt').forEach(button=>button.onclick=()=>deleteReceipt(data.goodsInwards.find(receipt=>String(receipt.id)===button.dataset.receiptId)));
  [...visibleReceipts].sort((a,b)=>String(b.receivedDate).localeCompare(String(a.receivedDate))).forEach((receipt,index)=>{
    const detail=document.querySelectorAll('#quality-table tr')[index]?.querySelector('td:nth-child(3) .item-note');
    if(detail&&receipt.goodsInwardsId&&!detail.textContent.includes(receipt.goodsInwardsId))detail.textContent=`${receipt.goodsInwardsId} · ${detail.textContent}`;
  });
}

function deleteReceipt(receipt){
  if(!canDeleteRecords?.()){alert('Only Administrators and Operations Managers can delete records.');return;}
  if(!receipt||!confirm(`Delete goods receipt for ${receipt.item}? Any accepted quantity will be removed from Stock on Hand. The purchase itself will not be deleted.`))return;
  const postedQty=Number(receipt.stockOnHandQty)||0,stock=stockItem(receipt.item);
  if(stock&&postedQty)stock.qty-=postedQty;
  if(data.stockMovements)data.stockMovements=data.stockMovements.filter(movement=>!(movement.sourceType==='GOODS_RECEIPT'&&String(movement.sourceId)===String(receipt.id)));
  const purchase=receipt.linkedPurchase&&data.purchases.find(entry=>entry.id===receipt.purchaseId);
  if(purchase){purchase.stockReceived=false;purchase.qualityStatus='Assess';purchase.status='In Transit';}
  Object.assign(receipt,{deleted:true,deletedAt:new Date().toISOString(),deletedBy:currentOperator?.()?.name||'Current user',stockOnHandQty:0,warehouseId:null,warehouseName:'',warehouseAssignedById:null,warehouseAssignedBy:'',warehouseAssignedDate:'',finalizedAt:null});
  save();render();
}

const baseQualityRender=quality;quality=()=>renderGoodsInwards();

// The legacy page is re-rendered by several independently loaded scripts.
// Bind the primary receive action at document level so a later render cannot
// silently replace the button's handler with the obsolete quality-assessment
// action (or leave it without a handler).
document.addEventListener('click',event=>{
  const trigger=event.target.closest?.('#add-quality');
  if(!trigger)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try{openGoodsInward();}
  catch(error){
    console.error('Could not open the Goods Inwards wizard.',error);
    alert(`The Goods Inwards wizard could not open: ${error?.message||'Unknown error'}`);
  }
},true);

function adjustStockForWarehouseAssignment(previousItem,previousQty,record,isPreviouslyPosted){
  // Assigning a warehouse is not on its own enough to create stock: the QC
  // decision must be Accepted. Held and rejected material therefore has no
  // route into Stock on Hand, and reversing an earlier acceptance backs the
  // posted quantity out again.
  const currentQty=record.warehouseId&&record.decision==='Accepted'?Number(record.stockQty)||0:0;
  if(isPreviouslyPosted&&previousQty===undefined){record.stockOnHandQty=currentQty;return;}
  const removeFromStock=(itemName,quantity)=>{if(!quantity)return;const stock=stockItem(itemName);if(stock)stock.qty-=quantity;};
  const addToStock=(itemName,quantity)=>{if(!quantity)return;const stock=stockItem(itemName);if(stock)stock.qty+=quantity;else data.stock.push({id:id(),name:itemName,category:record.category,qty:quantity,unit:record.stockUnit||record.unit,reorder:0});};
  if(previousItem===record.item){addToStock(record.item,currentQty-(previousQty||0));}
  else {removeFromStock(previousItem,previousQty||0);addToStock(record.item,currentQty);}
  record.stockOnHandQty=currentQty;
}
$('#record-form').addEventListener('submit',event=>{
  if(event.currentTarget.dataset.type!=='goods-inward')return;
  event.stopImmediatePropagation();
  const form=event.currentTarget,values=formData(form),receiptId=form.dataset.receiptId,purchase=data.purchases.find(record=>record.id===+values.purchaseId),existing=(receiptId?data.goodsInwards.find(record=>String(record.id)===receiptId):null)||(purchase?data.goodsInwards.find(record=>record.purchaseId===purchase.id):null),operator=currentOperator?.()||data.people.find(person=>person.type==='User'),previousItem=existing?.item||'',previousQty=existing?stockQuantityForReceipt(existing):undefined,isPreviouslyPosted=!!(existing?.linkedPurchase&&data.purchases.find(purchase=>purchase.id===existing.purchaseId)?.stockReceived);
  const stockUnit=stockUnitFor(values.item,values.unit),conversionFactor=unitFactor(values.unit,stockUnit);
  if(conversionFactor===null){alert(`No conversion is configured from ${values.unit} to the ${stockUnit} stock unit for ${values.item}. Add it in Administration → Categories & Units before posting this receipt.`);return;}
  const stockQty=Number((Number(values.qty||0)*conversionFactor).toFixed(6));
  const restoringDeletedReceipt=!!existing?.deleted;
  const record=existing||{id:id(),createdBy:operator?.name||'Current user',createdAt:new Date().toISOString()};
  const warehouse=(data.warehouses||[]).find(entry=>entry.id===+values.warehouseId),warehouseAssignee=data.people.find(person=>person.id===+values.warehouseAssignedById);
  record.goodsInwardsId=existing?.goodsInwardsId||nextGoodsInwardsReference();
  Object.assign(record,{deleted:false,deletedAt:'',deletedBy:'',purchaseId:purchase?.id||null,linkedPurchase:!!purchase,receivedDate:values.receivedDate,arrivedAt:restoringDeletedReceipt?new Date().toISOString():(existing?.arrivedAt||new Date().toISOString()),item:values.item,supplier:values.supplier,category:values.category,qty:+values.qty,unit:values.unit,stockQty,stockUnit,receivedBy:values.receivedBy,warehouseId:warehouse?.id||null,warehouseName:warehouse?.name||'',warehouseAssignedById:warehouseAssignee?.id||null,warehouseAssignedBy:warehouseAssignee?.name||'',warehouseAssignedDate:warehouse?values.warehouseAssignedDate||new Date().toISOString().slice(0,10):'',batch:values.batch,qualityDate:values.qualityDate,condition:values.condition,decision:values.decision,notes:values.notes});
  // Readings are saved per parameter of the item's standard; nut parameters
  // also keep their original columns for existing lists and reports.
  const readingNumber=(value,places)=>value===''||value===undefined||value===null||!Number.isFinite(Number(value))?'':Number(Number(value).toFixed(places));
  ['moisture','damaged','foreignMatter','aflatoxin','oilContent','ffa'].forEach(field=>record[field]=readingNumber(values[field],2));
  const receivingStandard=formReceivingStandard(form);
  record.qualityStandard=receivingStandard.name||'';
  record.qualityParameters=Object.fromEntries(receivingStandardParameters(receivingStandard).map(parameter=>[parameter.key,readingNumber(values[receivingFieldName(parameter.key)],4)]));
  record.createdBy=values.createdBy?.trim()||record.createdBy;
  const officer=data.people.find(person=>person.id===+values.qualityCheckOfficerId);record.qualityCheckOfficerId=officer?.id||null;record.qualityCheckOfficer=officer?.name||'';record.inspector=record.qualityCheckOfficer;
  record.decisionReason=values.decisionReason||'';
  if(purchase){
    syncReceiptFromPurchase(record,purchase);
    // Keep the measured receipt quantity and its supplier unit. The linked
    // purchase provides traceability, not permission to overwrite what was
    // physically delivered.
    Object.assign(record,{qty:+values.qty,unit:values.unit,stockQty,stockUnit});
  }
  applyMoistureSettlement(record);
  if(purchase){purchase.status=purchaseStageFor(purchase,record);purchase.qualityStatus=record.decision||'Assess'}
  adjustStockForWarehouseAssignment(previousItem,previousQty,record,isPreviouslyPosted);
  // Completion of an accepted receipt is the only route from a purchase into
  // available stock. A held/rejected receipt remains visible but unavailable.
  if(purchase)purchase.stockReceived=record.decision==='Accepted'&&!!record.warehouseId;
  if(data.stockMovements)data.stockMovements=data.stockMovements.filter(movement=>!(movement.sourceType==='GOODS_RECEIPT'&&String(movement.sourceId)===String(record.id)));
  if(record.decision==='Accepted'&&record.warehouseId){
    record.finalizedAt=record.finalizedAt||new Date().toISOString();
    if(typeof recordStockMovement==='function')recordStockMovement({type:'RECEIPT',item:record.item,category:record.category,quantity:record.stockQty,unit:record.stockUnit,warehouseId:record.warehouseId,sourceType:'GOODS_RECEIPT',sourceId:record.id,lotNo:record.batch||record.lotNo||'',note:`Accepted goods receipt (${record.qty} ${record.unit})`});
  }else record.finalizedAt=null;
  if(!existing)data.goodsInwards.unshift(record);save();render();
},true);
render();
