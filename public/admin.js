const defaultPeople=[
  {id:101,name:'Edward Nnadi',type:'User',role:'Administrator',email:'edward@nnadi.com',phone:''},
  {id:106,name:'Edward Nnadi',type:'User',role:'Administrator',email:'edward.nnadi@jeanedwards.com',phone:''},
  {id:107,name:'Nnaemeka Ugwokegbe',type:'User',role:'Administrator',email:'nnaemeka.ugwokegbe@jeanedwards.com',phone:''},
  {id:102,name:'Daniel Reuben',type:'User',role:'Accounts Manager',email:'daniel.reuben@jeanedwards.com',phone:''},
  {id:103,name:'Nanfa Binlam',type:'User',role:'Operations Manager',email:'nanfa.binlam@thebodyshop.ng',phone:''},
  {id:104,name:'Faith Berida',type:'User',role:'Production Manager',email:'faith.berida@jeoils.com',phone:''},
  {id:105,name:'Benjamin Okereafor',type:'User',role:'Stock Taking',email:'benjamin.okereafor@jeoils.ng',phone:''},
];
const defaultItems=[{id:201,name:'Peanut kernels',category:'Peanut kernels',unit:'kg'},{id:202,name:'Caustic soda',category:'Chemicals',unit:'kg'},{id:203,name:'Bleaching earth',category:'Chemicals',unit:'kg'},{id:204,name:'Diesel',category:'Fuel & energy',unit:'L'},{id:205,name:'Charcoal',category:'Fuel & energy',unit:'bags'},{id:206,name:'Firewood',category:'Fuel & energy',unit:'stacks'}];
const defaultCategories=['Peanut kernels','Chemicals','Fuel & energy','Packaging','Maintenance','Other'];
const defaultUnits=['kg','g','tonne','L','mL','bag','sack','bale','bundle','stack','drum','jerrycan','carton','box','pack','piece','pallet','roll','cylinder'];
const peanutStandard={name:'JE Oils Standard',parameters:[
  {key:'oilContent',label:'Oil Content',operator:'≥',limit:'45.0',unit:'%'},
  {key:'ffa',label:'FFA',operator:'≤',limit:'4.0',unit:'%'},
  {key:'foreignMatter',label:'Foreign Matter',operator:'≤',limit:'0.2',unit:'%'},
  {key:'damagedKernels',label:'Damaged/Defective Kernels',operator:'≤',limit:'5.0',unit:'%'},
  {key:'aflatoxin',label:'Total Aflatoxin',operator:'≤',limit:'10',unit:'ppb'},
]};
const categoryStandard=(category)=>data.categoryStandards?.[category];
const itemStandard=(itemName,category,speciesName='')=>{const item=data.items?.find(entry=>entry.name===itemName);return item?.speciesSpecs?.find(species=>species.name===speciesName)?.standard||item?.speciesSpecs?.[0]?.standard||item?.qualityStandard||categoryStandard(category)};
const standardSummary=(category)=>{let standard=categoryStandard(category);return standard?.parameters?.length?`${standard.name||'Quality standard'} · ${standard.parameters.length} parameter${standard.parameters.length===1?'':'s'}`:'No quality standard configured'};
const standardRows=(parameters=[])=>parameters.map((parameter,index)=>`<div class="form-grid category-parameter-row" data-parameter-row><div class="field"><label>Parameter</label><input name="parameterLabel" value="${parameter.label||''}" placeholder="e.g. Oil Content" required></div><div class="field"><label>Limit</label><select name="parameterOperator"><option ${parameter.operator==='≥'?'selected':''}>≥</option><option ${parameter.operator==='>'?'selected':''}>></option><option ${parameter.operator==='≤'?'selected':''}>≤</option><option ${parameter.operator==='<'?'selected':''}><</option><option ${parameter.operator==='='?'selected':''}>=</option></select></div><div class="field"><label>Value</label><input name="parameterLimit" type="number" step="any" min="0" value="${parameter.limit??''}" required></div><div class="field"><label>Unit</label><input name="parameterUnit" value="${parameter.unit||''}" placeholder="%, ppb, etc." required></div><div class="field"><label>&nbsp;</label><button type="button" class="secondary remove-parameter" ${index===0&&parameters.length===1?'disabled':''}>Remove</button></div></div>`).join('');
function setupStandardEditor(standard=peanutStandard){
  let form=$('#record-form'),parameters=standard.parameters?.length?standard.parameters:[{label:'',operator:'≤',limit:'',unit:''}];
  form.querySelector('#category-parameters').innerHTML=standardRows(parameters);
  form.querySelector('#add-parameter').onclick=()=>{form.querySelector('#category-parameters').insertAdjacentHTML('beforeend',standardRows([{label:'',operator:'≤',limit:'',unit:''}]));bindParameterButtons()};
  function bindParameterButtons(){form.querySelectorAll('.remove-parameter').forEach(button=>button.onclick=()=>button.closest('[data-parameter-row]').remove())}bindParameterButtons();
}
function readStandard(form){
  let rows=[...form.querySelectorAll('[data-parameter-row]')],parameters=rows.map((row,index)=>({key:`parameter_${index+1}`,label:row.querySelector('[name="parameterLabel"]').value.trim(),operator:row.querySelector('[name="parameterOperator"]').value,limit:row.querySelector('[name="parameterLimit"]').value,unit:row.querySelector('[name="parameterUnit"]').value.trim()})).filter(parameter=>parameter.label&&parameter.limit!==''&&parameter.unit);
  return {name:form.elements.standardName.value.trim()||'JE Oils Standard',parameters};
}
function adminData(){
  data.people??=[];
  // Seed supplied People records once, while retaining any records already
  // maintained in Admin. Email is the stable key because names can change.
  let peopleAdded=false;
  defaultPeople.forEach(person=>{
    if(!data.people.some(existing=>existing.email?.toLowerCase()===person.email.toLowerCase())){
      data.people.push({...person});
      peopleAdded=true;
    }
  });
  if(peopleAdded) save();
  data.items??=defaultItems;
  // Roles are master data: retain both the starter role and any roles entered for people.
  data.roles??=[...new Set(data.people.map(p=>p.role).filter(Boolean))];
  data.categories??=[...defaultCategories];
  data.categoryStandards??={};
  if(!data.categoryStandards['Peanut kernels']) data.categoryStandards['Peanut kernels']=JSON.parse(JSON.stringify(peanutStandard));
  data.units??=[...defaultUnits];
  data.people.forEach(p=>{if(p.role&&!data.roles.includes(p.role))data.roles.push(p.role)});
  data.items.forEach(i=>{
    if(i.category&&!data.categories.includes(i.category))data.categories.push(i.category);
    if(i.unit&&!data.units.includes(i.unit))data.units.push(i.unit);
  });
}
function renderAdmin(){adminData();$('#people-table').innerHTML=data.people.map(p=>`<tr><td><strong>${p.name}</strong></td><td><span class="category">${p.type}</span></td><td>${p.role}</td><td>${p.email||p.phone||'—'}</td></tr>`).join('')||'<tr><td colspan="4">No people yet.</td></tr>';$('#items-table').innerHTML=data.items.map(i=>`<tr><td><strong>${i.name}</strong>${i.description?`<div class="item-note">${i.description}</div>`:''}</td><td><span class="category">${i.category}</span></td><td>${i.unit}</td></tr>`).join('')||'<tr><td colspan="3">No purchase items yet.</td></tr>'}
const baseRender=render;render=()=>{baseRender();renderAdmin()};
const basePurchases=purchases;purchases=()=>{basePurchases();adminData();let q=$('#purchase-search')?.value?.toLowerCase()||'',filter=$('#purchase-filter')?.value||'all',rows=data.purchases.filter(p=>(filter==='all'||p.category===filter)&&`${p.item} ${p.supplier}`.toLowerCase().includes(q));$('#purchases-table').innerHTML=rows.map(p=>{let a=assessmentFor(p),qa=a?badge(a.decision):`<button class="text-btn assess-btn" data-purchase="${p.id}">Assess →</button>`;return `<tr><td>${date(p.date)}</td><td><strong>${p.item}</strong></td><td>${p.supplier}</td><td>${p.purchasedBy||'—'}</td><td>${p.qty.toLocaleString()} ${p.unit}</td><td>${money(p.unitPrice??(p.cost/p.qty||0))}</td><td>${qa}</td><td><strong>${money(p.cost)}</strong></td></tr>`}).join('')||'<tr><td colspan="8">No purchases match your search.</td></tr>';document.querySelectorAll('.assess-btn').forEach(b=>b.onclick=()=>openModal('quality',+b.dataset.purchase))};
const baseOpen=openModal;openModal=(type,pid)=>{if(type!=='purchase')return baseOpen(type,pid);adminData();$('#modal-label').textContent='NEW PURCHASE';$('#modal-title').textContent='Record purchase';$('#form-fields').innerHTML=`<div class="form-grid"><div class="field"><label>Date</label><input name="date" type="date" required value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Purchased by</label><select name="purchasedBy" required>${data.people.filter(p=>p.type==='User').map(p=>`<option value="${p.name}">${p.name} · ${p.role}</option>`).join('')}</select></div><div class="field full"><label>Item purchased</label><select name="item" id="purchase-item" required>${data.items.map(i=>`<option value="${i.name}">${i.name} · ${i.category}</option>`).join('')}</select></div><div class="field"><label>Supplier</label><input name="supplier" list="supplier-list" required><datalist id="supplier-list">${data.suppliers.map(s=>`<option value="${s.name}">`).join('')}</datalist></div><div class="field"><label>Category</label><input name="category" readonly required></div><div class="field"><label>Quantity</label><input name="qty" type="number" min="0" step="any" required></div><div class="field"><label>Unit</label><input name="unit" required></div><div class="field"><label>Unit price (₦)</label><input name="unitPrice" type="number" min="0" step="any" required></div><div class="field"><label>Total (₦)</label><input name="cost" type="number" readonly required></div></div>`;let form=$('#record-form'),item=form.elements.item,category=form.elements.category,unit=form.elements.unit,qty=form.elements.qty,price=form.elements.unitPrice,total=form.elements.cost;function itemInfo(){return data.items.find(i=>i.name===item.value)}function sync(){let i=itemInfo();category.value=i?.category||'';unit.value=i?.unit||'';total.value=((+qty.value||0)*(+price.value||0)).toFixed(2)}item.onchange=sync;qty.oninput=sync;price.oninput=sync;sync();form.dataset.type='purchase';$('#record-dialog').showModal()};
function adminModal(type){let isPerson=type==='person';adminData();$('#modal-label').textContent=isPerson?'NEW PERSON':'NEW PURCHASE ITEM';$('#modal-title').textContent=isPerson?'Add person or user':'Add purchase item';$('#form-fields').innerHTML=isPerson?`<div class="form-grid"><div class="field full"><label>Full name</label><input name="name" required></div><div class="field"><label>Record type</label><select name="type"><option>User</option><option>Person</option></select></div><div class="field"><label>Role</label><input name="role" list="role-list" placeholder="Select or enter a new role" required><datalist id="role-list">${data.roles.map(role=>`<option value="${role}">`).join('')}</datalist></div><div class="field"><label>Email</label><input name="email" type="email"></div><div class="field"><label>Phone</label><input name="phone"></div></div>`:`<div class="form-grid"><div class="field full"><label>Item name</label><input name="name" required></div><div class="field full"><label>Item description</label><textarea name="description" rows="2" placeholder="Describe the item, grade, pack size or specification"></textarea></div><div class="field"><label>Category</label><input name="category" list="category-list" placeholder="Select or enter a new category" required><datalist id="category-list">${data.categories.map(category=>`<option value="${category}">`).join('')}</datalist></div><div class="field"><label>Default unit</label><input name="unit" list="unit-list" placeholder="Select or enter a unit" required><datalist id="unit-list">${data.units.map(unit=>`<option value="${unit}">`).join('')}</datalist></div></div>`;$('#record-form').dataset.type=type;$('#record-dialog').showModal()}
$('#add-person').onclick=()=>adminModal('person');$('#add-item').onclick=()=>adminModal('item');$('#record-form').addEventListener('submit',async e=>{let type=e.currentTarget.dataset.type;if(type!=='person'&&type!=='item')return;e.stopImmediatePropagation();e.preventDefault();let v=formData(e.currentTarget);adminData();if(type==='person'){if(v.type==='User'){let response=await fetch('/api/access/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(v)}),result=await response.json().catch(()=>({}));if(!response.ok){alert(result.error||'Cloudflare Access could not add this user.');return}data.people.unshift(result.person)}else{data.people.unshift({id:id(),...v})}if(v.role&&!data.roles.includes(v.role))data.roles.push(v.role)}else{data.items.unshift({id:id(),...v});if(v.category&&!data.categories.includes(v.category))data.categories.push(v.category);if(v.unit&&!data.units.includes(v.unit))data.units.push(v.unit)}save();$('#record-dialog').close();render()},true);render();
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
  $('#roles-table').innerHTML=data.roles.map((role,index)=>`<tr><td><strong>${role}</strong></td><td><button class="text-btn edit-role" data-role-index="${index}">Edit</button></td></tr>`).join('')||'<tr><td>No roles yet.</td></tr>';
  $('#add-role').onclick=()=>{
    $('#modal-label').textContent='NEW ROLE';$('#modal-title').textContent='Add role';
    $('#form-fields').innerHTML='<div class="form-grid"><div class="field full"><label>Role name</label><input name="role" placeholder="e.g. Procurement officer" required></div></div>';
    $('#record-form').dataset.type='role';$('#record-dialog').showModal();
  };
  document.querySelectorAll('.edit-role').forEach(button=>button.onclick=()=>{
    let index=+button.dataset.roleIndex,role=data.roles[index];
    $('#modal-label').textContent='EDIT ROLE';$('#modal-title').textContent='Edit role';
    $('#form-fields').innerHTML=`<div class="form-grid"><div class="field full"><label>Role name</label><input name="role" value="${role}" required></div></div>`;
    $('#record-form').dataset.type='role-edit';$('#record-form').dataset.roleIndex=index;$('#record-dialog').showModal();
  });
};
$('#record-form').addEventListener('submit',e=>{
  if(e.currentTarget.dataset.type!=='role')return;
  e.stopImmediatePropagation();let role=formData(e.currentTarget).role?.trim();adminData();
  if(role&&!data.roles.some(existing=>existing.toLowerCase()===role.toLowerCase()))data.roles.push(role);
  save();render();
},true);
$('#record-form').addEventListener('submit',e=>{
  if(e.currentTarget.dataset.type!=='role-edit')return;
  e.stopImmediatePropagation();let form=e.currentTarget,newRole=formData(form).role?.trim(),index=+form.dataset.roleIndex,oldRole=data.roles[index];adminData();
  if(newRole&&(!data.roles.some((role,i)=>i!==index&&role.toLowerCase()===newRole.toLowerCase()))){data.roles[index]=newRole;data.people.forEach(person=>{if(person.role===oldRole)person.role=newRole})}
  save();render();
},true);
render();
// People must use a role maintained in Admin → Roles.
const adminModalWithRoleSelect=adminModal;
adminModal=(type)=>{
  adminModalWithRoleSelect(type);
  if(type!=='person')return;
  let form=$('#record-form'),role=form.elements.role;
  role.outerHTML=`<select name="role" required>${data.roles.map(value=>`<option value="${value}">${value}</option>`).join('')}</select>`;
};
// Dedicated purchase-category master data in Admin.
const renderAdminWithCategories=renderAdmin;
renderAdmin=()=>{
  renderAdminWithCategories();
  let grid=$('#admin-view .dashboard-grid');
  if(!$('#categories-panel'))grid.insertAdjacentHTML('beforeend','<section class="panel table-panel" id="categories-panel"><div class="panel-head"><div><h3>Purchase categories</h3><p>Categories available for purchase items and purchase records.</p></div><button class="secondary" id="add-category">+ Add category</button></div><table><thead><tr><th>Category</th><th></th></tr></thead><tbody id="categories-table"></tbody></table></section>');
  $('#categories-table').innerHTML=data.categories.map((category,index)=>`<tr><td><strong>${category}</strong><div class="item-note">${standardSummary(category)}</div></td><td><button class="text-btn edit-category" data-category-index="${index}">Edit</button></td></tr>`).join('')||'<tr><td>No categories yet.</td></tr>';
  $('#add-category').onclick=()=>{
    $('#modal-label').textContent='NEW CATEGORY';$('#modal-title').textContent='Add purchase category';
    $('#form-fields').innerHTML='<div class="form-grid"><div class="field full"><label>Category name</label><input name="category" placeholder="e.g. Packaging" required></div><div class="field full"><label>Quality standard name</label><input name="standardName" value="JE Oils Standard" required></div><div class="field full"><label>Quality parameters</label><div class="item-note">Add the checks and acceptable limits used when receiving this category.</div></div><div class="field full" id="category-parameters"></div><div class="field"><button type="button" class="secondary" id="add-parameter">+ Add parameter</button></div></div>';
    setupStandardEditor({name:'JE Oils Standard',parameters:[{label:'',operator:'≤',limit:'',unit:''}]});
    $('#record-form').dataset.type='category';$('#record-dialog').showModal();
  };
  document.querySelectorAll('.edit-category').forEach(button=>button.onclick=()=>{
    let index=+button.dataset.categoryIndex,category=data.categories[index];
    $('#modal-label').textContent='EDIT CATEGORY';$('#modal-title').textContent='Edit purchase category';
    let standard=categoryStandard(category)||{name:'JE Oils Standard',parameters:[]};
    $('#form-fields').innerHTML=`<div class="form-grid"><div class="field full"><label>Category name</label><input name="category" value="${category}" required></div><div class="field full"><label>Quality standard name</label><input name="standardName" value="${standard.name||'JE Oils Standard'}" required></div><div class="field full"><label>Quality parameters</label><div class="item-note">These limits are used on the receiving quality check for this category.</div></div><div class="field full" id="category-parameters"></div><div class="field"><button type="button" class="secondary" id="add-parameter">+ Add parameter</button></div></div>`;
    setupStandardEditor(standard);
    $('#record-form').dataset.type='category-edit';$('#record-form').dataset.categoryIndex=index;$('#record-dialog').showModal();
  });
};
$('#record-form').addEventListener('submit',e=>{
  if(e.currentTarget.dataset.type!=='category')return;
  e.stopImmediatePropagation();let category=formData(e.currentTarget).category?.trim();adminData();
  if(category&&!data.categories.some(existing=>existing.toLowerCase()===category.toLowerCase())){data.categories.push(category);data.categoryStandards[category]=readStandard(e.currentTarget)}
  save();render();
},true);
$('#record-form').addEventListener('submit',e=>{
  if(e.currentTarget.dataset.type!=='category-edit')return;
  e.stopImmediatePropagation();let form=e.currentTarget,newCategory=formData(form).category?.trim(),index=+form.dataset.categoryIndex,oldCategory=data.categories[index];adminData();
  if(newCategory&&(!data.categories.some((category,i)=>i!==index&&category.toLowerCase()===newCategory.toLowerCase()))){
    data.categories[index]=newCategory;
    data.categoryStandards[newCategory]=readStandard(form);
    if(oldCategory!==newCategory)delete data.categoryStandards[oldCategory];
    data.items.forEach(item=>{if(item.category===oldCategory)item.category=newCategory});
    data.purchases.forEach(purchase=>{if(purchase.category===oldCategory)purchase.category=newCategory});
    data.stock.forEach(item=>{if(item.category===oldCategory)item.category=newCategory});
  }
  save();render();
},true);
render();
// Purchase records include their receipt quality assessment and audit details.
const standardPurchaseModal=openModal;
const currentOperator=()=>data.people.find(person=>person.email?.toLowerCase()===data.currentUserEmail?.toLowerCase())||data.people.find(person=>person.type==='User')||data.people[0];
const canDeleteRecords=()=>['Administrator','Operations Manager'].includes(currentOperator?.()?.role);
let qualityFields=(values={},category='Peanut kernels',itemName='',speciesName='')=>{let standard=itemStandard(itemName,category,speciesName),parameters=standard?.parameters||[];let parameterFields=parameters.map((parameter,index)=>`<div class="field"><label>${parameter.label} (${parameter.unit}) <span class="item-note">${parameter.operator} ${parameter.limit} ${parameter.unit}</span></label><input name="qualityParameter_${index}" type="number" min="0" step="any" value="${values.parameters?.[parameter.key]??''}"></div>`).join('');return `<div class="field full"><label>Quality assessment${standard?` · ${standard.name}`:''}</label><div class="item-note">Record the delivery inspection against this purchase item's configured acceptable limits.</div></div><div class="field"><label>Batch / lot number</label><input name="batch" value="${values.batch||''}"></div><div class="field"><label>Assessment date</label><input name="qualityDate" type="date" value="${values.date||new Date().toISOString().slice(0,10)}"></div>${parameterFields}<div class="field"><label>Visual condition</label><select name="condition">${['Clean and dry','Minor defects','Contamination observed'].map(value=>`<option ${value===(values.condition||'Clean and dry')?'selected':''}>${value}</option>`).join('')}</select></div><div class="field"><label>Quality decision</label><select name="decision">${['Accepted','Hold','Rejected'].map(value=>`<option ${value===(values.decision||'Accepted')?'selected':''}>${value}</option>`).join('')}</select></div><div class="field"><label>Inspector</label><input name="inspector" value="${values.inspector||currentOperator()?.name||''}"></div><div class="field full"><label>Quality notes</label><textarea name="notes">${values.notes||''}</textarea></div>`};
openModal=(type,pid)=>{
  if(type!=='purchase')return standardPurchaseModal(type,pid);
  adminData();let operator=currentOperator(),today=new Date().toISOString().slice(0,10);
  $('#modal-label').textContent='NEW PURCHASE';$('#modal-title').textContent='Record purchase and quality check';
  let initialCategory=data.items[0]?.category||data.categories[0];
  const purchaseFields=()=>`<div class="form-grid"><div class="field"><label>Purchased date</label><input name="purchasedDate" type="date" required value="${today}"></div><div class="field"><label>Purchased by</label><select name="purchasedById" required>${data.people.map(person=>`<option value="${person.id}">${person.name} · ${person.role}</option>`).join('')}</select></div><div class="field"><label>Created by</label><input value="${operator?.name||'Current user'}" readonly></div><div class="field"><label>Created date</label><input value="${today}" readonly></div><div class="field"><label>Category</label><select name="category" required>${data.categories.map(category=>`<option ${category===initialCategory?'selected':''}>${category}</option>`).join('')}</select></div><div class="field"><label>Item purchased</label><select name="item" required>${data.items.map(item=>`<option value="${item.name}">${item.name}</option>`).join('')}</select></div><div class="field full"><label>Item description</label><textarea name="itemDescription" rows="2" placeholder="Description, grade, pack size or purchase-specific specification">${data.items[0]?.description||''}</textarea></div><div class="field"><label>Supplier</label><input name="supplier" list="supplier-list" required><datalist id="supplier-list">${data.suppliers.map(supplier=>`<option value="${supplier.name}">`).join('')}</datalist></div><div class="field"><label>Quantity</label><input name="qty" type="number" min="0" step="any" required></div><div class="field"><label>Unit</label><input name="unit" required></div><div class="field"><label>Unit price (₦)</label><input name="unitPrice" type="number" min="0" step="any" required></div><div class="field"><label>Total (₦)</label><input name="cost" type="number" readonly required></div><div id="configured-quality-fields">${qualityFields({},initialCategory,data.items[0]?.name)}</div></div>`;
  $('#form-fields').innerHTML=purchaseFields();
  let form=$('#record-form'),item=form.elements.item,category=form.elements.category,unit=form.elements.unit,description=form.elements.itemDescription,qty=form.elements.qty,price=form.elements.unitPrice,total=form.elements.cost,speciesHost=document.createElement('div');speciesHost.className='field';item.closest('.field').insertAdjacentElement('afterend',speciesHost);
  function sync(updateDescription=false){let selected=data.items.find(entry=>entry.name===item.value);category.value=selected?.category||category.value;unit.value=selected?.unit||unit.value;if(updateDescription)description.value=selected?.description||'';total.value=((+qty.value||0)*(+price.value||0)).toFixed(2)}
  function syncSpecies(){let selected=data.items.find(entry=>entry.name===item.value),species=selected?.speciesSpecs||[];speciesHost.innerHTML=species.length?`<label>Species / grade</label><select name="species">${species.map(entry=>`<option value="${entry.name}">${entry.name}</option>`).join('')}</select>`:'';speciesHost.hidden=!species.length;if(form.elements.species)form.elements.species.onchange=syncQualityFields}
  function syncQualityFields(){form.querySelector('#configured-quality-fields').innerHTML=qualityFields({},category.value,item.value,form.elements.species?.value||'')}
  item.onchange=()=>{sync(true);syncSpecies();syncQualityFields()};category.onchange=()=>{let selected=data.items.find(entry=>entry.category===category.value);if(selected)item.value=selected.name;sync(true);syncSpecies();syncQualityFields()};qty.oninput=sync;price.oninput=sync;sync(true);syncSpecies();syncQualityFields();form.dataset.type='purchase-enhanced';$('#record-dialog').showModal();
};
$('#record-form').addEventListener('submit',event=>{
  if(event.currentTarget.dataset.type!=='purchase-enhanced')return;
  event.stopImmediatePropagation();let values=formData(event.currentTarget),person=data.people.find(entry=>entry.id===+values.purchasedById),operator=currentOperator(),purchase={id:id(),date:values.purchasedDate,purchasedById:+values.purchasedById,purchasedBy:person?.name||'',createdBy:operator?.name||'Current user',createdAt:new Date().toISOString(),item:values.item,itemDescription:values.itemDescription?.trim()||'',supplier:values.supplier,category:values.category,qty:+values.qty,unit:values.unit,unitPrice:+values.unitPrice,cost:+values.cost};
  // A purchase is a commercial commitment, not inventory. Available stock is
  // created only when its Goods Inwards receipt is accepted and finished into
  // a warehouse.
  data.purchases.unshift(purchase);
  purchase.species=values.species||'';let standard=itemStandard(purchase.item,purchase.category,purchase.species),assessment={id:id(),purchaseId:purchase.id,date:values.qualityDate,goods:purchase.item,species:purchase.species,supplier:purchase.supplier,batch:values.batch,condition:values.condition,decision:values.decision,inspector:values.inspector,notes:values.notes,parameters:{}};(standard?.parameters||[]).forEach((parameter,index)=>{let value=values[`qualityParameter_${index}`];assessment.parameters[parameter.key]=value===''?'':+value});data.assessments.unshift(assessment);save();render();
},true);
