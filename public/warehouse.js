// Warehouses are master records used by receiving, storage and future stock transfers.
function warehouseData(){data.warehouses??=[];}
function warehouseEscape(value=''){return String(value).replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));}
// One row per item with its current balance in this warehouse. Receipts,
// production issues, outputs, transfers and adjustments are all netted by the
// shared stock ledger, so this figure matches production material selection.
function warehouseItems(warehouse){
  return warehouse?window.StockLedger.warehouseStock(warehouse.id):[];
}
function warehouseItemRows(warehouse){
  const items=warehouseItems(warehouse);
  if(!items.length)return '<tr class="warehouse-items-empty"><td colspan="5">No stock is currently held in this warehouse.</td></tr>';
  return items.map(row=>`<tr><td><strong>${warehouseEscape(row.item)}</strong><div class="item-note">${row.lots.length?`Lots: ${warehouseEscape(row.lots.join(', '))}`:'—'}</div></td><td>${warehouseEscape(row.category||'—')}</td><td>${row.quantity.toLocaleString()} ${warehouseEscape(row.unit)}</td><td>${warehouseEscape(row.suppliers.join(', ')||'—')}</td><td>${warehouseEscape(row.lastMovementAt?row.lastMovementAt.slice(0,10):'—')}</td></tr>`).join('');
}

function renderWarehouses(){
  warehouseData();
  $('#warehouses-table').innerHTML=data.warehouses.map(warehouse=>{
    const items=warehouseItems(warehouse),isOpen=String(warehouse.id)===String(window.openWarehouseItemsId);
    return `<tr><td><strong>${warehouseEscape(warehouse.name)}</strong><div class="item-note">${items.length} ${items.length===1?'item':'items'} in stock</div></td><td>${warehouseEscape(warehouse.location)}</td><td><button class="text-btn view-warehouse-items" data-id="${warehouse.id}" aria-expanded="${isOpen}" aria-controls="warehouse-items-${warehouse.id}">${isOpen?'Hide items':'View items'}</button> <button class="text-btn edit-warehouse" data-id="${warehouse.id}">Edit</button> <button class="text-btn delete-warehouse" data-id="${warehouse.id}">Delete</button></td></tr>${isOpen?`<tr id="warehouse-items-${warehouse.id}" class="warehouse-items-row"><td colspan="3"><div class="warehouse-items"><h3>${warehouseEscape(warehouse.name)} items</h3><table><thead><tr><th>Item / lots</th><th>Category</th><th>On hand</th><th>Supplier</th><th>Last movement</th></tr></thead><tbody>${warehouseItemRows(warehouse)}</tbody></table></div></td></tr>`:''}`;
  }).join('')||'<tr><td colspan="3">No warehouses have been added yet.</td></tr>';
  document.querySelectorAll('.view-warehouse-items').forEach(button=>button.onclick=()=>{
    const warehouseId=button.dataset.id;
    window.openWarehouseItemsId=String(window.openWarehouseItemsId)===warehouseId?'':warehouseId;
    renderWarehouses();
  });
  document.querySelectorAll('.edit-warehouse').forEach(button=>button.onclick=()=>openWarehouse(data.warehouses.find(warehouse=>warehouse.id===+button.dataset.id)));
  document.querySelectorAll('.delete-warehouse').forEach(button=>button.onclick=()=>deleteWarehouse(data.warehouses.find(warehouse=>warehouse.id===+button.dataset.id)));
}

function openWarehouse(warehouse){
  $('#modal-label').textContent=warehouse?'EDIT WAREHOUSE':'NEW WAREHOUSE';
  $('#modal-title').textContent=warehouse?'Update warehouse':'Add warehouse';
  $('#form-fields').innerHTML=`<div class="form-grid"><div class="field full"><label>Warehouse Name</label><input name="warehouseName" value="${warehouseEscape(warehouse?.name||'')}" required></div><div class="field full"><label>Warehouse Location</label><input name="warehouseLocation" value="${warehouseEscape(warehouse?.location||'')}" required></div></div>`;
  const form=$('#record-form');form.dataset.type='warehouse';form.dataset.warehouseId=warehouse?.id||'';
  $('#record-dialog').showModal();
}

function deleteWarehouse(warehouse){
  if(!warehouse||!confirm(`Delete warehouse ${warehouse.name}?`))return;
  data.warehouses=data.warehouses.filter(record=>record!==warehouse);save();render();
}

$('#record-form').addEventListener('submit',event=>{
  const form=event.currentTarget;
  if(form.dataset.type!=='warehouse')return;
  event.stopImmediatePropagation();
  warehouseData();
  const values=formData(form),existing=data.warehouses.find(warehouse=>warehouse.id===+form.dataset.warehouseId);
  if(existing)Object.assign(existing,{name:values.warehouseName.trim(),location:values.warehouseLocation.trim()});
  else data.warehouses.unshift({id:id(),name:values.warehouseName.trim(),location:values.warehouseLocation.trim()});
  save();render();
},true);

$('#add-warehouse').onclick=()=>openWarehouse();
const warehouseRender=render;
render=()=>{warehouseRender();renderWarehouses();};
render();
