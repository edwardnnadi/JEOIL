// Supplier products are selected from the maintained Administration →
// Purchase Items catalogue, rather than being entered as free text.
(() => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const selectedItemIds = (supplier) => {
    const existing = new Set((supplier.productItemIds || []).map(String));
    if (existing.size) return existing;
    const names = String(supplier.products || '').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
    return new Set(data.items.filter((item) => names.includes(item.name.toLowerCase())).map((item) => String(item.id)));
  };
  const productChoices = (selected = new Set()) => data.items.map((item) => `<label class="supplier-product-choice" data-category="${escapeHtml(item.category)}"><input type="checkbox" name="supplierProductItem" value="${item.id}" ${selected.has(String(item.id)) ? 'checked' : ''}><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(item.unit)}</small></span></label>`).join('');
  const supplierForm = (supplier = {}) => {
    const categories = [...new Set(data.items.map((item) => item.category).filter(Boolean))];
    return `<div class="form-grid"><div class="field full"><label>Supplier / company name</label><input name="name" value="${escapeHtml(supplier.name)}" required></div><div class="field"><label>Contact person</label><input name="contact" value="${escapeHtml(supplier.contact)}" required></div><div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(supplier.phone)}" required></div><div class="field"><label>Email</label><input name="email" type="email" value="${escapeHtml(supplier.email)}"></div><div class="field"><label>Filter products by category</label><select id="supplier-product-category-filter"><option value="">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}</select></div><div class="field full"><label>Products supplied</label><div class="item-note">Select one or more items from Administration → Purchase Items.</div><div class="supplier-product-choices">${productChoices(selectedItemIds(supplier))}</div></div></div>`;
  };

  const openSupplierModal = (supplier) => {
    adminData();
    if (!data.items.length) return alert('Add at least one Purchase Item in Administration before linking products to a supplier.');
    document.querySelector('#modal-label').textContent = supplier ? 'EDIT SUPPLIER' : 'NEW SUPPLIER';
    document.querySelector('#modal-title').textContent = supplier ? 'Update supplier' : 'Add supplier';
    document.querySelector('#form-fields').innerHTML = supplierForm(supplier);
    const form = document.querySelector('#record-form');
    const categoryFilter = form.querySelector('#supplier-product-category-filter');
    categoryFilter.onchange = () => form.querySelectorAll('.supplier-product-choice').forEach((choice) => {
      choice.hidden = Boolean(categoryFilter.value) && choice.dataset.category !== categoryFilter.value;
    });
    form.dataset.type = supplier ? 'supplier-purchase-items-edit' : 'supplier-purchase-items-new';
    form.dataset.supplierId = supplier?.id || '';
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
    if (!products.length) return alert('Select at least one product supplied.');
    const record = { name: values.name.trim(), contact: values.contact.trim(), phone: values.phone.trim(), email: values.email.trim(), productItemIds: products.map((item) => item.id), products: products.map((item) => item.name).join(', ') };
    const supplierId = +form.dataset.supplierId;
    const existing = data.suppliers.find((supplier) => supplier.id === supplierId);
    if (existing) Object.assign(existing, record);
    else data.suppliers.unshift({ id: id(), ...record });
    save();
    document.querySelector('#record-dialog').close();
    render();
  }, true);
})();
