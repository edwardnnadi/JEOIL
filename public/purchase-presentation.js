// Clear purchase-entry order and financial formatting.
const purchaseLayoutModal=openModal;
openModal=(type,pid)=>{
  purchaseLayoutModal(type,pid);
  if(type!=='purchase')return;
  let form=$('#record-form'),qty=form.elements.qty,unit=form.elements.unit,price=form.elements.unitPrice,total=form.elements.cost;
  unit.closest('.field').querySelector('label').textContent='Units';
  qty.closest('.field').querySelector('label').textContent='Quantity';
  qty.closest('.field').before(unit.closest('.field'));
  price.closest('.field').querySelector('label').textContent='Unit price (₦)';
  total.closest('.field').querySelector('label').textContent='Total price (₦)';
  price.step='0.01';
  const calculate=()=>total.value=((Number(qty.value)||0)*(Number(price.value)||0)).toFixed(2);
  qty.oninput=calculate;price.oninput=calculate;calculate();
};
const formattedPurchases=purchases;
purchases=()=>{
  formattedPurchases();
  const currency=value=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0);
  document.querySelectorAll('#purchases-table tr').forEach(row=>{
    let cells=row.querySelectorAll('td');if(cells.length<8)return;
    let item=cells[1]?.querySelector('strong')?.textContent,supplier=cells[2]?.textContent;
    let purchase=data.purchases.find(record=>record.item===item&&record.supplier===supplier);if(!purchase)return;
    cells[5].textContent=currency(purchase.unitPrice??purchase.cost/purchase.qty);
    cells[7].querySelector('strong')?.replaceChildren(currency(purchase.cost));
  });
};
render();
// Use the centrally maintained default-unit list in purchase entry.
const populatedUnitsPurchaseModal=openModal;
openModal=(type,pid)=>{
  populatedUnitsPurchaseModal(type,pid);
  if(type!=='purchase')return;
  let form=$('#record-form'),unit=form.elements.unit,qty=form.elements.qty,price=form.elements.unitPrice,total=form.elements.cost;
  unit.outerHTML=`<select name="unit" required>${data.units.map(value=>`<option value="${value}">${value}</option>`).join('')}</select>`;
  unit=form.elements.unit;
  let quantityField=qty.closest('.field'),unitField=unit.closest('.field'),priceField=price.closest('.field'),totalField=total.closest('.field');
  quantityField.after(unitField); // Quantity and Units are a pair.
  priceField.style.gridColumn='1';totalField.style.gridColumn='2'; // Price fields remain a pair.
  let selected=data.items.find(item=>item.name===form.elements.item.value);if(selected&&data.units.includes(selected.unit))unit.value=selected.unit;
  form.elements.item.onchange=()=>{let item=data.items.find(entry=>entry.name===form.elements.item.value);if(item){form.elements.category.value=item.category;if(data.units.includes(item.unit))unit.value=item.unit}total.value=((Number(qty.value)||0)*(Number(price.value)||0)).toFixed(2)};
};
