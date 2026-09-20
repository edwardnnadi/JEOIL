// Field purchasing: what the buyer weighs, pays and loads at the collection
// site, and the truck that carries it to the factory. Goods Inwards compares
// the factory weight against the field net weight recorded here.
const fieldLogisticsNames=['amountPaid','paymentMethod','paymentReference','paidAt','vehicleRegNo','driverName','driverPhone','transportCost','waybillNo','dispatchedAt','expectedArrivalDate'];
const fieldNumberNames=['amountPaid','transportCost'];
const fieldEscape=value=>String(value??'').replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
const fieldNumber=value=>{const parsed=Number(String(value??'').replace(/,/g,'').trim());return String(value??'').trim()===''||!Number.isFinite(parsed)?'':parsed;};

function fieldLogisticsFields(purchase={}){
  const input=(name,label,attrs='',note='')=>`<div class="field"><label>${label}</label><input name="${name}" value="${fieldEscape(purchase[name])}" ${attrs}>${note?`<div class="item-note">${note}</div>`:''}</div>`;
  const methods=['','Cash','Bank transfer','POS','Mobile money','Cheque','Other'];
  return `<div class="form-grid purchase-field-logistics">
    <div class="field full"><label>Payment to supplier</label><div class="item-note">What was actually paid in the field. Attach the payment evidence on the last step.</div></div>
    ${input('amountPaid','Amount paid (₦)','type="number" min="0" step="any" inputmode="decimal"')}
    <div class="field"><label>Payment method</label><select name="paymentMethod">${methods.map(method=>`<option value="${method}" ${method===(purchase.paymentMethod||'')?'selected':''}>${method||'Not yet paid'}</option>`).join('')}</select></div>
    ${input('paymentReference','Payment reference','placeholder="Transfer ref., receipt or cheque no."')}
    ${input('paidAt','Paid at','type="datetime-local"')}
    <div class="field full field-payment-balance item-note" aria-live="polite"></div>
    <div class="field full"><label>Loading &amp; dispatch</label><div class="item-note">The vehicle carrying this lot to the factory.</div></div>
    ${input('vehicleRegNo','Vehicle registration no.','placeholder="e.g. KAN 123 XY" autocapitalize="characters"')}
    ${input('driverName','Driver name')}
    ${input('driverPhone','Driver phone','type="tel" inputmode="tel" placeholder="+234…"')}
    ${input('waybillNo','Waybill no.')}
    ${input('transportCost','Transport cost (₦)','type="number" min="0" step="any" inputmode="decimal"')}
    ${input('dispatchedAt','Dispatched at','type="datetime-local"')}
    ${input('expectedArrivalDate','Expected arrival','type="date"')}
  </div>`;
}

function bindFieldLogistics(form){
  const el=name=>form.elements.namedItem(name);
  const refresh=()=>{
    const balance=form.querySelector('.field-payment-balance');
    const total=fieldNumber(el('cost')?.value),paid=fieldNumber(el('amountPaid')?.value);
    if(balance)balance.textContent=paid!==''&&total!==''?`Balance outstanding: ₦${(total-paid).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:'';
  };
  ['amountPaid','unitPrice'].forEach(name=>{el(name)?.addEventListener('input',refresh);el(name)?.addEventListener('change',refresh);});
  const paymentMethod=el('paymentMethod'),paidAt=el('paidAt');
  paymentMethod?.addEventListener('change',()=>{if(!paymentMethod.value&&paidAt)paidAt.value='';refresh();});
  refresh();
}

window.purchaseFieldLogisticsFromForm=values=>Object.fromEntries(fieldLogisticsNames.map(name=>[name,fieldNumberNames.includes(name)?fieldNumber(values[name]):String(values[name]??'').trim()]).map(([name,value])=>[name,name==='vehicleRegNo'?value.toUpperCase():value]));
window.purchaseFieldLogisticsNames=fieldLogisticsNames;

const fieldLogisticsOpen=openModal;
openModal=(type,pid)=>{
  fieldLogisticsOpen(type,pid);
  if(type!=='purchase')return;
  const form=$('#record-form');
  form.querySelector('#form-fields').insertAdjacentHTML('beforeend',fieldLogisticsFields({}));
  bindFieldLogistics(form);
};
const fieldLogisticsEdit=editModal;
editModal=(kind,record)=>{
  fieldLogisticsEdit(kind,record);
  if(kind!=='purchase')return;
  const form=$('#record-form');
  form.querySelector('#form-fields').insertAdjacentHTML('beforeend',fieldLogisticsFields(record));
  bindFieldLogistics(form);
};

// A one-line summary reused by the purchases list and the Goods Inwards trace card.
window.purchaseFieldSummary=purchase=>{
  const truck=[purchase.vehicleRegNo,purchase.driverName].filter(Boolean).join(' · ');
  return [truck&&`Truck ${truck}`,purchase.waybillNo&&`Waybill ${purchase.waybillNo}`].filter(Boolean).join(' · ');
};
