// Warehouses are master records used by receiving, storage and future stock transfers.
function warehouseData(){data.warehouses??=[];}
function warehouseEscape(value=''){return String(value).replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));}

function renderWarehouses(){
  warehouseData();
  $('#warehouses-table').innerHTML=data.warehouses.map(warehouse=>`<tr><td><strong>${warehouseEscape(warehouse.name)}</strong></td><td>${warehouseEscape(warehouse.location)}</td><td><button class="text-btn edit-warehouse" data-id="${warehouse.id}">Edit</button> <button class="text-btn delete-warehouse" data-id="${warehouse.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="3">No warehouses have been added yet.</td></tr>';
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
