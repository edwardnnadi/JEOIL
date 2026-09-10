// Deletion controls for Administration master data. Operational history is
// never deleted: purchase and stock records retain their original labels.
(() => {
  const itemUsageMessage = (item) => {
    const purchases = (data.purchases || []).filter((purchase) => purchase.item === item.name).length;
    const stock = (data.stock || []).filter((record) => record.name === item.name).length;
    return purchases || stock
      ? `\n\n${purchases ? `${purchases} purchase record(s)` : ''}${purchases && stock ? ' and ' : ''}${stock ? `${stock} stock record(s)` : ''} will retain this item's name as historical information.`
      : '';
  };

  const renderDeleteControls = () => {
    adminData();
    document.querySelectorAll('#items-table tr').forEach((row, index) => {
      const item = data.items[index];
      if (!item || row.querySelector('.delete-purchase-item')) return;
      const actions = row.lastElementChild;
      actions?.insertAdjacentHTML('beforeend', ` <button type="button" class="text-btn delete-purchase-item" data-item-id="${item.id}">Delete</button>`);
    });
    document.querySelectorAll('#categories-table tr').forEach((row, index) => {
      if (!data.categories[index] || row.querySelector('.delete-purchase-category')) return;
      row.lastElementChild?.insertAdjacentHTML('beforeend', ` <button type="button" class="text-btn delete-purchase-category" data-category-index="${index}">Delete</button>`);
    });
    document.querySelectorAll('#units-table tr').forEach((row, index) => {
      if (!data.units[index] || row.querySelector('.delete-purchase-unit')) return;
      row.lastElementChild?.insertAdjacentHTML('beforeend', ` <button type="button" class="text-btn delete-purchase-unit" data-unit-index="${index}">Delete</button>`);
    });
  };

  document.addEventListener('click', (event) => {
    const itemButton = event.target.closest('.delete-purchase-item');
    if (itemButton) {
      const item = data.items.find((entry) => String(entry.id) === itemButton.dataset.itemId);
      if (!item || !confirm(`Delete purchase item “${item.name}”?${itemUsageMessage(item)}\n\nThis removes it from future purchase selections only.`)) return;
      data.items = data.items.filter((entry) => entry !== item);
      save(); render();
      return;
    }

    const categoryButton = event.target.closest('.delete-purchase-category');
    if (categoryButton) {
      const index = +categoryButton.dataset.categoryIndex;
      const category = data.categories[index];
      if (!category) return;
      const usedByItems = data.items.filter((item) => item.category === category).length;
      if (usedByItems) return alert(`“${category}” is used by ${usedByItems} purchase item(s). Change or delete those purchase items before deleting the category.`);
      if (!confirm(`Delete category “${category}”? Historical purchases and stock records will retain their original category.`)) return;
      data.categories.splice(index, 1);
      if (data.categoryStandards) delete data.categoryStandards[category];
      save(); render();
      return;
    }

    const unitButton = event.target.closest('.delete-purchase-unit');
    if (unitButton) {
      const index = +unitButton.dataset.unitIndex;
      const unit = data.units[index];
      if (!unit) return;
      const usedByItems = data.items.filter((item) => item.unit === unit).length;
      if (usedByItems) return alert(`“${unit}” is used by ${usedByItems} purchase item(s). Change or delete those purchase items before deleting the unit.`);
      if (!confirm(`Delete unit “${unit}”? Historical purchases and stock records will retain their original unit.`)) return;
      data.units.splice(index, 1);
      save(); render();
    }
  });

  const priorRender = render;
  render = () => { priorRender(); renderDeleteControls(); };
  renderDeleteControls();
})();
