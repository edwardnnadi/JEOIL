// Goods Inwards is the controlled receiving point for purchased materials and quality release.
const goodsEscape=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
const goodsNumber=value=>value===''||value===null||value===undefined?'':Number(value).toFixed(2);
const purchaseLabel=purchase=>`${purchase.purchaseId||`Purchase ${purchase.id}`} · ${purchase.item} · ${purchase.supplier}`;
const linkedPurchaseFields=['purchaseId','purchaseReference','purchaseDate','purchaseStatus','item','supplier','category','qty','unit','unitPrice','cost','purchasedById','purchasedBy','createdBy','createdAt','lotNo','originState','originLga','supplierReceiptId','purchaseQuality','attachments'];

function receiptForPurchase(purchase){
  const initialAssessment=purchase.purchaseQuality||assessmentFor(purchase)||{};
  return {id:`purchase-${purchase.id}`,linkedPurchase:true,receivedDate:purchase.date,purchaseId:purchase.id,purchaseReference:purchase.purchaseId||`Purchase ${purchase.id}`,purchaseDate:purchase.date,purchaseStatus:purchase.status||'Quote',item:purchase.item,supplier:purchase.supplier,category:purchase.category,qty:+purchase.qty,unit:purchase.unit,unitPrice:+purchase.unitPrice||0,cost:+purchase.cost||0,purchasedById:purchase.purchasedById||'',purchasedBy:purchase.purchasedBy||'',createdBy:purchase.createdBy||'',createdAt:purchase.createdAt||purchase.date,lotNo:purchase.lotNo||initialAssessment.batch||'',originState:purchase.originState||'',originLga:purchase.originLga||'',supplierReceiptId:purchase.supplierReceiptId||'',purchaseQuality:initialAssessment,attachments:[...(purchase.attachments||[])],batch:purchase.lotNo||initialAssessment.batch||'',qualityDate:purchase.date,moisture:'',damaged:'',foreignMatter:'',aflatoxin:'',oilContent:'',ffa:'',condition:'',decision:'Assess',qualityCheckOfficerId:'',qualityCheckOfficer:'',notes:''};
}

function syncReceiptFromPurchase(receipt,purchase){
  const source=receiptForPurchase(purchase);
  linkedPurchaseFields.forEach(field=>receipt[field]=source[field]);
  receipt.batch=receipt.batch||source.batch;
  return receipt;
}

function ensureGoodsInwards(){
  data.goodsInwards??=[];
  data.purchases.forEach(purchase=>{
    let receipt=data.goodsInwards.find(record=>record.purchaseId===purchase.id);
    if(!receipt){receipt=receiptForPurchase(purchase);data.goodsInwards.unshift(receipt)}else syncReceiptFromPurchase(receipt,purchase);
    purchase.status='Receive goods';purchase.qualityStatus=receipt.decision||'Assess';
  });
}

function receiptBadge(decision){return badge(decision||'Assess')}

function qualityFields(values={}){
  const officerId=String(values.qualityCheckOfficerId||''),officerName=values.qualityCheckOfficer||values.inspector||'';
  return `<div class="field full"><label>Goods inwards quality assessment</label><div class="item-note">Assess the delivered lot before it is released for production.</div></div><div class="field"><label>Batch / lot number</label><input name="batch" value="${goodsEscape(values.batch||'')}"></div><div class="field"><label>Assessment date</label><input name="qualityDate" type="date" value="${goodsEscape(values.date||values.qualityDate||new Date().toISOString().slice(0,10))}"></div><div class="field"><label>Oil content (%)</label><input name="oilContent" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${goodsNumber(values.oilContent)}"></div><div class="field"><label>FFA (%)</label><input name="ffa" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${goodsNumber(values.ffa)}"></div><div class="field"><label>Moisture (%)</label><input name="moisture" type="number" min="0" step="0.01" inputmode="decimal" value="${goodsNumber(values.moisture)}"></div><div class="field"><label>Damaged kernels (%)</label><input name="damaged" type="number" min="0" step="0.01" inputmode="decimal" value="${goodsNumber(values.damaged)}"></div><div class="field"><label>Foreign matter (%)</label><input name="foreignMatter" type="number" min="0" step="0.01" inputmode="decimal" value="${goodsNumber(values.foreignMatter)}"></div><div class="field"><label>Aflatoxin (ppb)</label><input name="aflatoxin" type="number" min="0" step="0.01" inputmode="decimal" value="${goodsNumber(values.aflatoxin)}"></div><div class="field"><label>Visual condition</label><select name="condition">${['Clean and dry','Minor defects','Contamination observed'].map(value=>`<option ${value===(values.condition||'Clean and dry')?'selected':''}>${value}</option>`).join('')}</select></div><div class="field"><label>Quality decision</label><select name="decision">${['Assess','Accepted','Hold','Rejected'].map(value=>`<option ${value===(values.decision||'Assess')?'selected':''}>${value}</option>`).join('')}</select></div><div class="field"><label>Quality check officer</label><select name="qualityCheckOfficerId"><option value="">Select a person</option>${data.people.map(person=>`<option value="${person.id}" ${String(person.id)===officerId||person.name===officerName?'selected':''}>${goodsEscape(person.name)} · ${goodsEscape(person.role||person.type||'Person')}</option>`).join('')}</select></div><div class="field full"><label>Notes</label><textarea name="notes">${goodsEscape(values.notes||'')}</textarea></div>`;
}

function purchaseTraceCard(receipt={}){
  if(!receipt.purchaseId)return '';
  const origin=[receipt.originLga,receipt.originState].filter(Boolean).join(', ')||'—';
  const attachments=(receipt.attachments||[]).map(file=>`<a href="${goodsEscape(file.dataUrl||'')}" download="${goodsEscape(file.name||'attachment')}">${goodsEscape(file.name||'Attachment')}</a>`).join(' · ')||'None';
  return `<div class="field full purchase-trace-card"><label>Purchase traceability</label><div class="item-note"><strong>${goodsEscape(receipt.purchaseReference||'—')}</strong> · ${goodsEscape(receipt.purchaseStatus||'—')} · Lot: ${goodsEscape(receipt.lotNo||'—')} · Origin: ${goodsEscape(origin)} · Supplier receipt: ${goodsEscape(receipt.supplierReceiptId||'—')}<br>Purchased by: ${goodsEscape(receipt.purchasedBy||'—')} · Unit price: ₦${(+receipt.unitPrice||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} · Total: ₦${(+receipt.cost||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}<br>Purchase attachments: ${attachments}</div></div>`;
}

function initialQualityCard(receipt={}){
  const assessment=receipt.purchaseQuality;
  if(!assessment)return '<div class="field full initial-quality-card"><label>Initial purchase quality assessment</label><div class="item-note">No purchase-time assessment was recorded for this legacy purchase.</div></div>';
  const result=`Oil Content ${goodsNumber(assessment.oilContent)===''?'—':goodsNumber(assessment.oilContent)+'%'} · FFA ${goodsNumber(assessment.ffa)===''?'—':goodsNumber(assessment.ffa)+'%'}<br>Moisture ${goodsNumber(assessment.moisture)===''?'—':goodsNumber(assessment.moisture)+'%'} · Damaged ${goodsNumber(assessment.damaged)===''?'—':goodsNumber(assessment.damaged)+'%'} · Foreign matter ${goodsNumber(assessment.foreignMatter)===''?'—':goodsNumber(assessment.foreignMatter)+'%'} · Aflatoxin ${goodsNumber(assessment.aflatoxin)===''?'—':goodsNumber(assessment.aflatoxin)+' ppb'}`;
  return `<div class="field full initial-quality-card"><label>Initial purchase quality assessment</label><div class="item-note">${result}<br>Inspector: ${goodsEscape(assessment.inspector||'—')} · Condition: ${goodsEscape(assessment.condition||'—')} · Initial decision: ${goodsEscape(assessment.decision||'Assess')}<br>Notes: ${goodsEscape(assessment.notes||'—')}</div></div>`;
}

function receiptFields(receipt={}){
  const operator=currentOperator?.()||data.people.find(person=>person.type==='User'),today=new Date().toISOString().slice(0,10);
  return `<div class="form-grid"><div class="field"><label>Goods received date</label><input name="receivedDate" type="date" value="${goodsEscape(receipt.receivedDate||today)}" required></div><div class="field"><label>Link to purchase</label><select name="purchaseId"><option value="">Standalone receipt</option>${data.purchases.map(purchase=>`<option value="${purchase.id}" ${purchase.id===receipt.purchaseId?'selected':''}>${goodsEscape(purchaseLabel(purchase))}</option>`).join('')}</select></div>${purchaseTraceCard(receipt)}${initialQualityCard(receipt)}<div class="field"><label>Supplier</label><input name="supplier" value="${goodsEscape(receipt.supplier||'')}" required></div><div class="field"><label>Item received</label><select name="item" required>${data.items.map(item=>`<option value="${goodsEscape(item.name)}" ${item.name===receipt.item?'selected':''}>${goodsEscape(item.name)}</option>`).join('')}</select></div><div class="field"><label>Category</label><select name="category" required>${data.categories.map(category=>`<option ${category===receipt.category?'selected':''}>${goodsEscape(category)}</option>`).join('')}</select></div><div class="field"><label>Quantity received</label><input name="qty" type="number" min="0" step="any" value="${goodsEscape(receipt.qty??'')}" required></div><div class="field"><label>Unit</label><input name="unit" value="${goodsEscape(receipt.unit||'')}" required></div><div class="field"><label>Received by</label><select name="receivedBy">${data.people.map(person=>`<option ${person.name===(receipt.receivedBy||operator?.name)?'selected':''}>${goodsEscape(person.name)}</option>`).join('')}</select></div><div class="field"><label>Assign to warehouse</label><select name="warehouseId"><option value="">Not yet assigned</option>${(data.warehouses||[]).map(warehouse=>`<option value="${warehouse.id}" ${warehouse.id===receipt.warehouseId?'selected':''}>${goodsEscape(warehouse.name)} · ${goodsEscape(warehouse.location)}</option>`).join('')}</select><div class="item-note">Assigning posts the quantity to Stock on Hand.</div></div><div class="field"><label>Assigned by</label><select name="warehouseAssignedById"><option value="">Select a person</option>${data.people.map(person=>`<option value="${person.id}" ${person.id===receipt.warehouseAssignedById?'selected':''}>${goodsEscape(person.name)} · ${goodsEscape(person.role||person.type||'Person')}</option>`).join('')}</select></div><div class="field"><label>Warehouse assignment date</label><input name="warehouseAssignedDate" type="date" value="${goodsEscape(receipt.warehouseAssignedDate||today)}"></div><div class="field"><label>Created by</label><input value="${goodsEscape(receipt.createdBy||operator?.name||'Current user')}" readonly></div><div class="field"><label>Created date</label><input value="${goodsEscape((receipt.createdAt||today).slice(0,10))}" readonly></div>${qualityFields(receipt)}</div>`;
}

function fillGoodsFromPurchase(form,purchase){
  if(!purchase)return;
  form.elements.item.value=purchase.item;form.elements.supplier.value=purchase.supplier;form.elements.category.value=purchase.category;form.elements.qty.value=purchase.qty;form.elements.unit.value=purchase.unit;
  const current={purchaseId:purchase.id};syncReceiptFromPurchase(current,purchase);
  form.querySelector('.purchase-trace-card')?.replaceWith(document.createRange().createContextualFragment(purchaseTraceCard(current)));
  if(form.elements.batch&&!form.elements.batch.value)form.elements.batch.value=purchase.lotNo||'';
}

function openGoodsInward(receipt){
  ensureGoodsInwards();$('#modal-label').textContent=receipt?'EDIT GOODS RECEIVED':'GOODS RECEIVED';$('#modal-title').textContent=receipt?'Update goods inward record':'Receive goods and complete quality check';$('#form-fields').innerHTML=receiptFields(receipt);
  const form=$('#record-form');form.dataset.type='goods-inward';form.dataset.receiptId=receipt?.id||'';
  form.elements.purchaseId.onchange=()=>fillGoodsFromPurchase(form,data.purchases.find(purchase=>purchase.id===+form.elements.purchaseId.value));
  form.elements.item.onchange=()=>{const item=data.items.find(entry=>entry.name===form.elements.item.value);if(item){form.elements.category.value=item.category;form.elements.unit.value=item.unit}};
  $('#record-dialog').showModal();
}

function renderGoodsInwards(){
  ensureGoodsInwards();const view=$('#quality-view');view.querySelector('.view-head h2').textContent='Goods inwards';view.querySelector('.view-head p').textContent='Receive goods, assess quality, and retain complete purchase traceability.';
  const add=$('#add-quality');add.textContent='+ Record goods received';add.onclick=()=>openGoodsInward();
  $('#quality-stats').innerHTML=[['Receipts',data.goodsInwards.length],['Accepted',data.goodsInwards.filter(record=>record.decision==='Accepted').length],['Assess / hold / rejected',data.goodsInwards.filter(record=>['Assess','Hold','Rejected'].includes(record.decision)).length]].map(item=>`<div class="quality-stat"><small>${item[0]}</small><strong>${item[1]}</strong></div>`).join('');
  $('#quality-table').parentElement.querySelector('thead').innerHTML='<tr><th>Received</th><th>Goods / lot</th><th>Supplier / origin</th><th>Quantity</th><th>Warehouse</th><th>Inspection</th><th>Decision</th><th>Officer</th><th></th></tr>';
  $('#quality-table').innerHTML=[...data.goodsInwards].sort((a,b)=>String(b.receivedDate).localeCompare(String(a.receivedDate))).map(receipt=>{const origin=[receipt.originLga,receipt.originState].filter(Boolean).join(', '),warehouse=(data.warehouses||[]).find(entry=>entry.id===receipt.warehouseId),warehouseText=warehouse?warehouse.name:'Not assigned';const result=`Oil ${goodsNumber(receipt.oilContent)===''?'—':goodsNumber(receipt.oilContent)+'%'} · FFA ${goodsNumber(receipt.ffa)===''?'—':goodsNumber(receipt.ffa)+'%'}<br>Moisture ${goodsNumber(receipt.moisture)===''?'—':goodsNumber(receipt.moisture)+'%'} · Damaged ${goodsNumber(receipt.damaged)===''?'—':goodsNumber(receipt.damaged)+'%'}<br>Foreign matter ${goodsNumber(receipt.foreignMatter)===''?'—':goodsNumber(receipt.foreignMatter)+'%'} · Aflatoxin ${goodsNumber(receipt.aflatoxin)===''?'—':goodsNumber(receipt.aflatoxin)+' ppb'}`;return `<tr><td>${date(receipt.receivedDate)}</td><td><strong>${goodsEscape(receipt.item)}</strong><div class="item-note">${goodsEscape(receipt.purchaseReference||'Standalone receipt')} · Lot: ${goodsEscape(receipt.lotNo||receipt.batch||'—')}</div></td><td>${goodsEscape(receipt.supplier)}<div class="item-note">${goodsEscape(origin||'Origin not recorded')}</div></td><td>${(+receipt.qty).toLocaleString()} ${goodsEscape(receipt.unit)}</td><td>${goodsEscape(warehouseText)}<div class="item-note">${goodsEscape(receipt.warehouseAssignedBy||'—')} · ${receipt.warehouseAssignedDate?date(receipt.warehouseAssignedDate):'—'}</div></td><td class="quality-result">${result}</td><td>${receiptBadge(receipt.decision)}</td><td>${goodsEscape(receipt.qualityCheckOfficer||'—')}</td><td><button class="text-btn edit-receipt" data-receipt-id="${goodsEscape(receipt.id)}">Edit</button> <button class="text-btn delete-receipt" data-receipt-id="${goodsEscape(receipt.id)}">Delete</button></td></tr>`;}).join('')||'<tr><td colspan="9">No goods received yet.</td></tr>';
  document.querySelectorAll('.edit-receipt').forEach(button=>button.onclick=()=>openGoodsInward(data.goodsInwards.find(receipt=>String(receipt.id)===button.dataset.receiptId)));
  document.querySelectorAll('.delete-receipt').forEach(button=>button.onclick=()=>deleteReceipt(data.goodsInwards.find(receipt=>String(receipt.id)===button.dataset.receiptId)));
}

function deleteReceipt(receipt){
  if(!receipt||!confirm(`Delete goods receipt for ${receipt.item}?`))return;
  const stock=stockItem(receipt.item);if(stock)stock.qty-=+receipt.qty;
  if(receipt.linkedPurchase){data.purchases=data.purchases.filter(purchase=>purchase.id!==receipt.purchaseId);data.assessments=data.assessments.filter(assessment=>assessment.purchaseId!==receipt.purchaseId)}
  data.goodsInwards=data.goodsInwards.filter(record=>record!==receipt);save();render();
}

const baseQualityRender=quality;quality=()=>renderGoodsInwards();
function adjustStockForWarehouseAssignment(previousItem,previousQty,record,isPreviouslyPosted){
  const currentQty=record.warehouseId?+record.qty:0;
  if(isPreviouslyPosted&&previousQty===undefined){record.stockOnHandQty=+record.qty;return;}
  const removeFromStock=(itemName,quantity)=>{if(!quantity)return;const stock=stockItem(itemName);if(stock)stock.qty-=quantity;};
  const addToStock=(itemName,quantity)=>{if(!quantity)return;const stock=stockItem(itemName);if(stock)stock.qty+=quantity;else data.stock.push({id:id(),name:itemName,category:record.category,qty:quantity,unit:record.unit,reorder:0});};
  if(previousItem===record.item){addToStock(record.item,currentQty-(previousQty||0));}
  else {removeFromStock(previousItem,previousQty||0);addToStock(record.item,currentQty);}
  record.stockOnHandQty=currentQty;
}
$('#record-form').addEventListener('submit',event=>{
  if(event.currentTarget.dataset.type!=='goods-inward')return;
  event.stopImmediatePropagation();
  const form=event.currentTarget,values=formData(form),receiptId=form.dataset.receiptId,existing=receiptId?data.goodsInwards.find(record=>String(record.id)===receiptId):null,operator=currentOperator?.()||data.people.find(person=>person.type==='User'),previousItem=existing?.item||'',previousQty=existing?.stockOnHandQty,isPreviouslyPosted=!!(existing?.linkedPurchase&&data.purchases.find(purchase=>purchase.id===existing.purchaseId)?.stockReceived);
  const purchase=data.purchases.find(record=>record.id===+values.purchaseId),record=existing||{id:id(),createdBy:operator?.name||'Current user',createdAt:new Date().toISOString()};
  const warehouse=(data.warehouses||[]).find(entry=>entry.id===+values.warehouseId),warehouseAssignee=data.people.find(person=>person.id===+values.warehouseAssignedById);
  Object.assign(record,{purchaseId:purchase?.id||null,linkedPurchase:!!purchase,receivedDate:values.receivedDate,item:values.item,supplier:values.supplier,category:values.category,qty:+values.qty,unit:values.unit,receivedBy:values.receivedBy,warehouseId:warehouse?.id||null,warehouseName:warehouse?.name||'',warehouseAssignedById:warehouseAssignee?.id||null,warehouseAssignedBy:warehouseAssignee?.name||'',warehouseAssignedDate:warehouse?values.warehouseAssignedDate||new Date().toISOString().slice(0,10):'',batch:values.batch,qualityDate:values.qualityDate,condition:values.condition,decision:values.decision,notes:values.notes});
  ['moisture','damaged','foreignMatter','aflatoxin','oilContent','ffa'].forEach(field=>record[field]=values[field]===''?'':Number(Number(values[field]).toFixed(2)));
  const officer=data.people.find(person=>person.id===+values.qualityCheckOfficerId);record.qualityCheckOfficerId=officer?.id||null;record.qualityCheckOfficer=officer?.name||'';record.inspector=record.qualityCheckOfficer;
  if(purchase){syncReceiptFromPurchase(record,purchase);purchase.status='Receive goods';purchase.qualityStatus=record.decision||'Assess'}
  adjustStockForWarehouseAssignment(previousItem,previousQty,record,isPreviouslyPosted);
  if(purchase)purchase.stockReceived=!!record.warehouseId;
  if(!existing)data.goodsInwards.unshift(record);save();render();
},true);
render();
