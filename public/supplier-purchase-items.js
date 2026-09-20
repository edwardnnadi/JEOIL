// Supplier products are selected from the maintained Administration →
// Purchase Items catalogue rather than entered as free text. Linking products
// is optional, and a missing purchase item can be added from the supplier form.
(() => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const selectedItemIds = (supplier) => {
    const existing = new Set((supplier.productItemIds || []).map(String));
    if (existing.size) return existing;
    const names = String(supplier.products || '').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
    return new Set(data.items.filter((item) => names.includes(item.name.toLowerCase())).map((item) => String(item.id)));
  };
  const itemCategories = () => [...new Set([...(data.categories || []), ...data.items.map((item) => item.category)].filter(Boolean))];
  const productChoices = (selected = new Set()) => data.items.length
    ? data.items.map((item) => `<label class="supplier-product-choice" data-category="${escapeHtml(item.category)}"><input type="checkbox" name="supplierProductItem" value="${item.id}" ${selected.has(String(item.id)) ? 'checked' : ''}><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(item.unit)}</small></span></label>`).join('')
    : '<p class="item-note">No purchase items exist yet. Add one below, or save the supplier now and link products later.</p>';
  const categoryFilterOptions = () => `<option value="">All categories</option>${itemCategories().map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}`;
  const supplierForm = (supplier = {}) => `<div class="form-grid"><div class="field full"><label>Supplier / company name</label><input name="name" value="${escapeHtml(supplier.name)}" required></div><div class="field"><label>Contact person</label><input name="contact" value="${escapeHtml(supplier.contact)}" required></div><div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(supplier.phone)}" required></div><div class="field"><label>Email</label><input name="email" type="email" value="${escapeHtml(supplier.email)}"></div><div class="field full"><label>Address</label><textarea name="address" rows="2" placeholder="Street, city, state">${escapeHtml(supplier.address)}</textarea></div><div class="field full"><label>Default transporter / haulage company</label><input name="transporterName" value="${escapeHtml(supplier.transporterName)}" placeholder="Used as the supplier's usual transporter"></div><div class="field"><label>Filter products by category</label><select id="supplier-product-category-filter">${categoryFilterOptions()}</select></div><div class="field full"><label>Products supplied (optional)</label><div class="item-note">Tick the purchase items this supplier provides. You can link products later.</div><div class="supplier-product-choices">${productChoices(selectedItemIds(supplier))}</div></div><div class="field full supplier-new-item"><details><summary>+ Add purchase item</summary><div class="form-grid"><div class="field"><label for="supplier-new-item-name">Item name</label><input id="supplier-new-item-name" data-new-item="name" placeholder="e.g. Floor detergent"></div><div class="field"><label for="supplier-new-item-category">Category</label><input id="supplier-new-item-category" data-new-item="category" list="supplier-new-item-categories" placeholder="Select or enter a category"><datalist id="supplier-new-item-categories">${itemCategories().map((category) => `<option value="${escapeHtml(category)}">`).join('')}</datalist></div><div class="field"><label for="supplier-new-item-unit">Default unit</label><input id="supplier-new-item-unit" data-new-item="unit" list="supplier-new-item-units" placeholder="Select or enter a unit"><datalist id="supplier-new-item-units">${(data.units || []).map((unit) => `<option value="${escapeHtml(unit)}">`).join('')}</datalist></div><div class="field full"><label class="qc-policy-check"><input type="checkbox" data-new-item="requiresQualityCheck"> Requires quality check at receiving</label><div class="item-note">Leave unticked for consumables such as firewood, cleaning materials and packaging.</div></div><div class="field"><button type="button" class="secondary" id="supplier-add-item">Add item and link it</button></div></div></details></div></div>`;

  const bindCategoryFilter = (form) => {
    const categoryFilter = form.querySelector('#supplier-product-category-filter');
    categoryFilter.onchange = () => form.querySelectorAll('.supplier-product-choice').forEach((choice) => {
      choice.hidden = Boolean(categoryFilter.value) && choice.dataset.category !== categoryFilter.value;
    });
  };

  const bindAddItem = (form) => {
    const field = (key) => form.querySelector(`[data-new-item="${key}"]`);
    form.querySelector('#supplier-add-item').onclick = () => {
      const name = field('name').value.trim(), category = field('category').value.trim(), unit = field('unit').value.trim();
      if (!name || !category || !unit) return alert('Enter the item name, category and default unit.');
      const checked = new Set(new FormData(form).getAll('supplierProductItem').map(String));
      let item = data.items.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
      if (!item) {
        item = { id: id(), name, category, unit, requiresQualityCheck: field('requiresQualityCheck').checked };
        data.items.unshift(item);
        if (!data.categories?.includes(category)) (data.categories ??= []).push(category);
        if (!data.units?.includes(unit)) (data.units ??= []).push(unit);
        save();
      }
      checked.add(String(item.id));
      form.querySelector('.supplier-product-choices').innerHTML = productChoices(checked);
      form.querySelector('#supplier-product-category-filter').innerHTML = categoryFilterOptions();
      ['name', 'category', 'unit'].forEach((key) => { field(key).value = ''; });
      field('requiresQualityCheck').checked = false;
      form.querySelector('.supplier-new-item details').open = false;
    };
  };

  const openSupplierModal = (supplier) => {
    adminData();
    document.querySelector('#modal-label').textContent = supplier ? 'EDIT SUPPLIER' : 'NEW SUPPLIER';
    document.querySelector('#modal-title').textContent = supplier ? 'Update supplier' : 'Add supplier';
    document.querySelector('#form-fields').innerHTML = supplierForm(supplier);
    const form = document.querySelector('#record-form');
    bindCategoryFilter(form);
    bindAddItem(form);
    form.dataset.type = supplier ? 'supplier-purchase-items-edit' : 'supplier-purchase-items-new';
    form.dataset.supplierId = supplier?.id || '';
    const saveButton = document.querySelector('#save-record'), actions = document.querySelector('#record-dialog .modal-actions');
    saveButton.textContent = supplier ? 'Save supplier' : 'Add supplier'; saveButton.type = 'submit'; saveButton.hidden = false; saveButton.disabled = false; actions.hidden = false;
    document.querySelector('#record-dialog').showModal();
  };

  const previousOpenModal = openModal;
  openModal = (type, purchaseId) => type === 'supplier' ? openSupplierModal() : previousOpenModal(type, purchaseId);
  const previousEditModal = editModal;
  editModal = (kind, record) => kind === 'supplier' ? openSupplierModal(record) : previousEditModal(kind, record);

  document.querySelector('#record-form').addEventListener('submit', (event) => {
    const form = event.currentTarget;
    if (!['supplier-purchase-items-new', 'supplier-purchase-items-edit'].includes(form.dataset.type)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const values = formData(form);
    const chosenIds = new Set(new FormData(form).getAll('supplierProductItem').map(String));
    const products = data.items.filter((item) => chosenIds.has(String(item.id)));
    const record = { name: values.name.trim(), contact: values.contact.trim(), phone: values.phone.trim(), email: values.email.trim(), address: values.address.trim(), transporterName: values.transporterName.trim(), productItemIds: products.map((item) => item.id), products: products.map((item) => item.name).join(', ') };
    const supplierId = +form.dataset.supplierId;
    const existing = data.suppliers.find((supplier) => supplier.id === supplierId);
    if (existing) Object.assign(existing, record);
    else data.suppliers.unshift({ id: id(), ...record });
    save();
    document.querySelector('#record-dialog').close();
    render();
  }, true);

  const style = document.createElement('style');
  style.textContent = '.supplier-new-item details{padding:10px 12px;border:1px dashed var(--line,#ddd0b8);border-radius:8px}.supplier-new-item summary{cursor:pointer;font-weight:600}.supplier-new-item .form-grid{margin-top:12px}.qc-policy-check{display:flex;align-items:center;gap:8px;font-weight:600;cursor:pointer}.qc-policy-check input{width:18px;height:18px;margin:0}';
  document.head.append(style);
})();
