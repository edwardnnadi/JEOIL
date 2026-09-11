(() => {
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const allowed = () => typeof canDeleteRecords === 'function' && canDeleteRecords();
  const deny = () => alert('Only Administrators can delete purchases, production records, or stock.');
  const remove = async (collection, id, label) => {
    if (!allowed()) return deny();
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    const response = await fetch('/api/state', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection, id }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return alert(result.error || `Could not delete ${label}.`);
    try {
      data = JSON.parse(result.payload);
      data.assessments ??= [];
      stateRevision = result.revision ?? null;
      render();
    } catch {
      alert(`Could not refresh records after deleting ${label}.`);
    }
  };
  window.deletePurchaseRecord = async (purchase) => {
    if (!allowed()) return deny();
    const response = await fetch('/api/state', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection: 'purchases', id: purchase.id }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return alert(result.error || `Could not delete purchase ${purchase.purchaseId || purchase.item}.`);
    try {
      data = JSON.parse(result.payload);
      data.assessments ??= [];
      stateRevision = result.revision ?? null;
      render();
      $('#record-dialog').close();
    } catch {
      alert('Could not refresh records after deleting the purchase.');
    }
  };
  const deleteAllStock = async () => {
    if (!allowed()) return deny();
    if (!data.stock?.length) return alert('There are no stock items to delete.');
    const confirmation = prompt(`This will permanently delete all ${data.stock.length} stock items. Type DELETE STOCK to continue.`);
    if (confirmation !== 'DELETE STOCK') return;
    const response = await fetch('/api/state', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collection: 'stock', all: true }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return alert(result.error || 'Could not delete stock items.');
    data = JSON.parse(result.payload); data.assessments ??= []; stateRevision = result.revision ?? null; render();
  };
  const addButtons = () => {
    if (!allowed()) return;
    const stockHeader = document.querySelector('#stock-view .view-head');
    if (stockHeader && !stockHeader.querySelector('#delete-all-stock')) {
      stockHeader.insertAdjacentHTML('beforeend', '<button class="secondary delete-all-stock" id="delete-all-stock" type="button">Delete all stock</button>');
      stockHeader.querySelector('#delete-all-stock')?.addEventListener('click', deleteAllStock);
    }
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
      window.deletePurchaseRecord(purchase);
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
