(() => {
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const allowed = () => typeof canDeleteRecords === 'function' && canDeleteRecords();
  const deny = () => alert('Only Administrators and Operations Managers can delete records.');
  const remove = (collection, id, label) => {
    if (!allowed()) return deny();
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    data[collection] = (data[collection] || []).filter(record => String(record.id) !== String(id));
    save(); render();
  };
  const addButtons = () => {
    if (!allowed()) return;
    document.querySelectorAll('.stock-card').forEach((card, index) => {
      const record = data.stock?.[index]; if (!record || card.querySelector('.delete-record')) return;
      card.querySelector('header')?.insertAdjacentHTML('beforeend', `<button class="text-btn delete-record" data-kind="stock" data-id="${esc(record.id)}">Delete</button>`);
    });
    document.querySelectorAll('.supplier-card').forEach((card, index) => {
      const record = data.suppliers?.[index]; if (!record || card.querySelector('.delete-record')) return;
      card.insertAdjacentHTML('beforeend', `<button class="text-btn delete-record" data-kind="supplier" data-id="${esc(record.id)}">Delete</button>`);
    });
    document.querySelectorAll('#production-table tr').forEach((row, index) => {
      const record = data.production?.[index]; if (!record || row.querySelector('.delete-record')) return;
      row.insertAdjacentHTML('beforeend', `<td><button class="text-btn delete-record" data-kind="production" data-id="${esc(record.id)}">Delete</button></td>`);
    });
  };
  document.addEventListener('click', event => {
    const purchaseButton = event.target.closest('.delete-purchase-direct');
    if (purchaseButton) {
      if (!allowed()) return deny();
      const purchase = data.purchases?.find(record => String(record.id) === purchaseButton.dataset.purchaseId);
      if (!purchase || !confirm(`Delete purchase ${purchase.purchaseId || purchase.item}? This also removes its linked Goods Inwards record.`)) return;
      const receipts = (data.goodsInwards || []).filter(receipt => String(receipt.purchaseId) === String(purchase.id));
      receipts.forEach(receipt => { const stock = stockItem(receipt.item); const posted = Number(receipt.stockOnHandQty || 0); if (stock && posted) stock.qty -= posted; });
      data.goodsInwards = (data.goodsInwards || []).filter(receipt => String(receipt.purchaseId) !== String(purchase.id));
      data.assessments = (data.assessments || []).filter(assessment => String(assessment.purchaseId) !== String(purchase.id));
      data.purchases = data.purchases.filter(record => String(record.id) !== String(purchase.id));
      save(); render();
      return;
    }
    const button = event.target.closest('.delete-record'); if (!button) return;
    const { kind, id } = button.dataset;
    if (kind === 'supplier' && (data.purchases || []).some(purchase => purchase.supplier === data.suppliers.find(s => String(s.id) === id)?.name)) return alert('Delete or reassign this supplier’s purchases before deleting the supplier.');
    remove({stock:'stock', supplier:'suppliers', production:'production'}[kind], id, `${kind} record`);
  });
  const priorRender = render;
  render = () => { priorRender(); addButtons(); };
  render();
})();
