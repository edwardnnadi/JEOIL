// Final purchase-wizard binding. Item Purchased is deliberately independent
// of Category: buyers choose from the full approved item catalogue.
(() => {
  const escapeOption = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

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

  const populateItems = (form, preferred = '') => {
    ensurePurchaseItemCatalogue();
    // `HTMLFormControlsCollection` has an `item()` method, so use the named
    // lookup to obtain this purchase form's `<select name="item">`.
    const item = form.elements.namedItem('item');
    if (!item) return;
    const available = data.items;
    item.innerHTML = available.length
      ? available.map((entry) => `<option value="${escapeOption(entry.name)}">${escapeOption(entry.name)}</option>`).join('')
      : '<option value="">No Purchase Items available</option>';
    item.disabled = !available.length;
    item.value = available.some((entry) => entry.name === preferred) ? preferred : (available[0]?.name || '');
    applySelectedItem(form);
  };

  const previousOpenModal = openModal;
  openModal = (type, purchaseId) => {
    previousOpenModal(type, purchaseId);
    if (type !== 'purchase') return;
    const form = document.querySelector('#record-form');
    const item = form?.elements.namedItem('item');
    if (!form || !item) return;
    populateItems(form, item.value);
    item.addEventListener('change', () => applySelectedItem(form));
  };
})();
