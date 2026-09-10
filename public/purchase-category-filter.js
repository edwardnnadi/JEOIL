// Final purchase-wizard binding. This file deliberately runs after every
// purchase enhancement so Category always controls the Item Purchased list.
(() => {
  const escapeOption = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const categoryKey = (value) => String(value ?? '').trim().toLocaleLowerCase();

  // Some existing shared states pre-date the Purchase Items master data and
  // retain an empty array. Recover it here, before the wizard filters, rather
  // than waiting for the separate Administration screen to render and save.
  // A dedicated migration marker means later intentional deletions remain
  // respected and are never recreated.
  const ensurePurchaseItemCatalogue = () => {
    if (data.items?.length || data.purchaseItemsStarterMigrationDone) return;
    data.items = defaultItems.map((entry) => ({ ...entry }));
    data.categories ??= [];
    data.units ??= [];
    defaultCategories.forEach((category) => {
      if (!data.categories.includes(category)) data.categories.push(category);
    });
    defaultUnits.forEach((unit) => {
      if (!data.units.includes(unit)) data.units.push(unit);
    });
    data.purchaseItemsStarterMigrationDone = true;
    save().catch((error) => console.error('Could not restore the Purchase Items catalogue.', error));
  };

  const applySelectedItem = (form) => {
    const selected = data.items.find((entry) => entry.name === form.elements.item?.value);
    if (!selected) return;
    if (form.elements.unit && data.units.includes(selected.unit)) form.elements.unit.value = selected.unit;
    if (form.elements.itemDescription) form.elements.itemDescription.value = selected.description || '';
  };

  const filterItems = (form, preferred = '') => {
    ensurePurchaseItemCatalogue();
    const category = form.elements.category;
    const item = form.elements.item;
    if (!category || !item) return;
    const available = data.items.filter((entry) => categoryKey(entry.category) === categoryKey(category.value));
    item.innerHTML = available.length
      ? available.map((entry) => `<option value="${escapeOption(entry.name)}">${escapeOption(entry.name)}</option>`).join('')
      : '<option value="">No Purchase Items in this category</option>';
    item.disabled = !available.length;
    item.value = available.some((entry) => entry.name === preferred) ? preferred : (available[0]?.name || '');
    applySelectedItem(form);
  };

  const previousOpenModal = openModal;
  openModal = (type, purchaseId) => {
    previousOpenModal(type, purchaseId);
    if (type !== 'purchase') return;
    const form = document.querySelector('#record-form');
    const category = form?.elements.category;
    const item = form?.elements.item;
    if (!form || !category || !item) return;
    filterItems(form, item.value);
    category.addEventListener('change', () => filterItems(form));
    item.addEventListener('change', () => applySelectedItem(form));
  };
})();
