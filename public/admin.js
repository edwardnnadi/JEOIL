const defaultPeople=[{id:101,name:'Edward Nnadi',type:'User',role:'Administrator',email:'edward@nnadi.com',phone:''}];
const defaultItems=[{id:201,name:'Peanut kernels',category:'Peanut kernels',unit:'kg'},{id:202,name:'Caustic soda',category:'Chemicals',unit:'kg'},{id:203,name:'Bleaching earth',category:'Chemicals',unit:'kg'},{id:204,name:'Diesel',category:'Fuel & energy',unit:'L'},{id:205,name:'Charcoal',category:'Fuel & energy',unit:'bags'},{id:206,name:'Firewood',category:'Fuel & energy',unit:'stacks'}];
const defaultCategories=['Peanut kernels','Chemicals','Fuel & energy','Packaging','Maintenance','Other'];
const defaultUnits=['kg','g','tonne','L','mL','bag','sack','bale','bundle','stack','drum','jerrycan','carton','box','pack','piece','pallet','roll','cylinder'];
function adminData(){
  data.people??=defaultPeople;
  data.items??=defaultItems;
  // Roles are master data: retain both the starter role and any roles entered for people.
  data.roles??=[...new Set(data.people.map(p=>p.role).filter(Boolean))];
  data.categories??=[...defaultCategories];
  data.units??=[...defaultUnits];
  data.people.forEach(p=>{if(p.role&&!data.roles.includes(p.role))data.roles.push(p.role)});
  data.items.forEach(i=>{
    if(i.category&&!data.categories.includes(i.category))data.categories.push(i.category);
    if(i.unit&&!data.units.includes(i.unit))data.units.push(i.unit);
  });
}
function renderAdmin(){adminData();$('#people-table').innerHTML=data.people.map(p=>`<tr><td><strong>${p.name}</strong></td><td><span class="category">${p.type}</span></td><td>${p.role}</td><td>${p.email||p.phone||'—'}</td></tr>`).join('')||'<tr><td colspan="4">No people yet.</td></tr>';$('#items-table').innerHTML=data.items.map(i=>`<tr><td><strong>${i.name}</strong></td><td><span class="category">${i.category}</span></td><td>${i.unit}</td></tr>`).join('')||'<tr><td colspan="3">No purchase items yet.</td></tr>'}
const baseRender=render;render=()=>{baseRender();renderAdmin()};
const basePurchases=purchases;purchases=()=>{basePurchases();adminData();let q=$('#purchase-search')?.value?.toLowerCase()||'',filter=$('#purchase-filter')?.value||'all',rows=data.purchases.filter(p=>(filter==='all'||p.category===filter)&&`${p.item} ${p.supplier}`.toLowerCase().includes(q));$('#purchases-table').innerHTML=rows.map(p=>{let a=assessmentFor(p),qa=a?badge(a.decision):`<button class="text-btn assess-btn" data-purchase="${p.id}">Assess →</button>`;return `<tr><td>${date(p.date)}</td><td><strong>${p.item}</strong></td><td>${p.supplier}</td><td>${p.purchasedBy||'—'}</td><td>${p.qty.toLocaleString()} ${p.unit}</td><td>${money(p.unitPrice??(p.cost/p.qty||0))}</td><td>${qa}</td><td><strong>${money(p.cost)}</strong></td></tr>`}).join('')||'<tr><td colspan="8">No purchases match your search.</td></tr>';document.querySelectorAll('.assess-btn').forEach(b=>b.onclick=()=>openModal('quality',+b.dataset.purchase))};
const baseOpen=openModal;openModal=(type,pid)=>{if(type!=='purchase')return baseOpen(type,pid);adminData();$('#modal-label').textContent='NEW PURCHASE';$('#modal-title').textContent='Record purchase';$('#form-fields').innerHTML=`<div class="form-grid"><div class="field"><label>Date</label><input name="date" type="date" required value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Purchased by</label><select name="purchasedBy" required>${data.people.filter(p=>p.type==='User').map(p=>`<option value="${p.name}">${p.name} · ${p.role}</option>`).join('')}</select></div><div class="field full"><label>Item purchased</label><select name="item" id="purchase-item" required>${data.items.map(i=>`<option value="${i.name}">${i.name} · ${i.category}</option>`).join('')}</select></div><div class="field"><label>Supplier</label><input name="supplier" list="supplier-list" required><datalist id="supplier-list">${data.suppliers.map(s=>`<option value="${s.name}">`).join('')}</datalist></div><div class="field"><label>Category</label><input name="category" readonly required></div><div class="field"><label>Quantity</label><input name="qty" type="number" min="0" step="any" required></div><div class="field"><label>Unit</label><input name="unit" required></div><div class="field"><label>Unit price (₦)</label><input name="unitPrice" type="number" min="0" step="any" required></div><div class="field"><label>Total (₦)</label><input name="cost" type="number" readonly required></div></div>`;let form=$('#record-form'),item=form.elements.item,category=form.elements.category,unit=form.elements.unit,qty=form.elements.qty,price=form.elements.unitPrice,total=form.elements.cost;function itemInfo(){return data.items.find(i=>i.name===item.value)}function sync(){let i=itemInfo();category.value=i?.category||'';unit.value=i?.unit||'';total.value=((+qty.value||0)*(+price.value||0)).toFixed(2)}item.onchange=sync;qty.oninput=sync;price.oninput=sync;sync();form.dataset.type='purchase';$('#record-dialog').showModal()};
function adminModal(type){let isPerson=type==='person';adminData();$('#modal-label').textContent=isPerson?'NEW PERSON':'NEW PURCHASE ITEM';$('#modal-title').textContent=isPerson?'Add person or user':'Add purchase item';$('#form-fields').innerHTML=isPerson?`<div class="form-grid"><div class="field full"><label>Full name</label><input name="name" required></div><div class="field"><label>Record type</label><select name="type"><option>User</option><option>Person</option></select></div><div class="field"><label>Role</label><input name="role" list="role-list" placeholder="Select or enter a new role" required><datalist id="role-list">${data.roles.map(role=>`<option value="${role}">`).join('')}</datalist></div><div class="field"><label>Email</label><input name="email" type="email"></div><div class="field"><label>Phone</label><input name="phone"></div></div>`:`<div class="form-grid"><div class="field full"><label>Item name</label><input name="name" required></div><div class="field"><label>Category</label><input name="category" list="category-list" placeholder="Select or enter a new category" required><datalist id="category-list">${data.categories.map(category=>`<option value="${category}">`).join('')}</datalist></div><div class="field"><label>Default unit</label><input name="unit" list="unit-list" placeholder="Select or enter a unit" required><datalist id="unit-list">${data.units.map(unit=>`<option value="${unit}">`).join('')}</datalist></div></div>`;$('#record-form').dataset.type=type;$('#record-dialog').showModal()}
$('#add-person').onclick=()=>adminModal('person');$('#add-item').onclick=()=>adminModal('item');$('#record-form').addEventListener('submit',e=>{let type=e.currentTarget.dataset.type;if(type!=='person'&&type!=='item')return;e.stopImmediatePropagation();let v=formData(e.currentTarget);adminData();if(type==='person'){data.people.unshift({id:id(),...v});if(v.role&&!data.roles.includes(v.role))data.roles.push(v.role)}else{data.items.unshift({id:id(),...v});if(v.category&&!data.categories.includes(v.category))data.categories.push(v.category);if(v.unit&&!data.units.includes(v.unit))data.units.push(v.unit)}save();render()},true);render();
// Make every saved category visible in the purchase form as well.
const purchaseOpenWithCategory=openModal;
openModal=(type,pid)=>{
  purchaseOpenWithCategory(type,pid);
  if(type!=='purchase')return;
  let form=$('#record-form'),oldCategory=form.elements.category,item=form.elements.item,unit=form.elements.unit;
  oldCategory.outerHTML=`<select name="category" required>${data.categories.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>`;
  let category=form.elements.category,selected=data.items.find(i=>i.name===item.value);
  if(selected)category.value=selected.category;
  category.onchange=()=>{let match=data.items.find(i=>i.category===category.value);if(match){item.value=match.name;unit.value=match.unit}};
};
// Dedicated role master-data area in Admin.
const renderAdminWithRoles=renderAdmin;
renderAdmin=()=>{
  renderAdminWithRoles();
  let grid=$('#admin-view .dashboard-grid');
  if(!$('#roles-panel'))grid.insertAdjacentHTML('beforeend','<section class="panel table-panel" id="roles-panel"><div class="panel-head"><div><h3>Roles</h3><p>Roles available when creating or editing people.</p></div><button class="secondary" id="add-role">+ Add role</button></div><table><thead><tr><th>Role</th></tr></thead><tbody id="roles-table"></tbody></table></section>');
  $('#roles-table').innerHTML=data.roles.map(role=>`<tr><td><strong>${role}</strong></td></tr>`).join('')||'<tr><td>No roles yet.</td></tr>';
  $('#add-role').onclick=()=>{
    $('#modal-label').textContent='NEW ROLE';$('#modal-title').textContent='Add role';
    $('#form-fields').innerHTML='<div class="form-grid"><div class="field full"><label>Role name</label><input name="role" placeholder="e.g. Procurement officer" required></div></div>';
    $('#record-form').dataset.type='role';$('#record-dialog').showModal();
  };
};
$('#record-form').addEventListener('submit',e=>{
  if(e.currentTarget.dataset.type!=='role')return;
  e.stopImmediatePropagation();let role=formData(e.currentTarget).role?.trim();adminData();
  if(role&&!data.roles.some(existing=>existing.toLowerCase()===role.toLowerCase()))data.roles.push(role);
  save();render();
},true);
render();
