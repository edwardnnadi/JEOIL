// Stock location details are derived from the inventory journal. This keeps the
// stock card total and each warehouse balance tied to the same source of truth.
(function () {
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);

  const normalized = value => String(value || '').trim().toLowerCase();
  const number = value => Number(value) || 0;

  function warehouseBalances(item) {
    const itemName = normalized(item.name);
    const movements = (data.stockMovements || []).filter(movement =>
      normalized(movement.item || movement.itemName) === itemName &&
      movement.warehouseId !== undefined && movement.warehouseId !== null,
    );

    // Modern records use the ledger. Older received/finished-goods records
    // did not always create ledger entries, so retain a safe compatibility
    // path for them instead of showing an empty location dialog.
    const sourceEntries = movements.length
      ? movements.map(movement => ({
          warehouseId: movement.warehouseId,
          quantity: number(movement.quantity),
        }))
      : [
          ...(data.goodsInwards || [])
            .filter(receipt =>
              normalized(receipt.item) === itemName &&
              receipt.decision === 'Accepted' &&
              receipt.warehouseId !== undefined && receipt.warehouseId !== null,
            )
            .map(receipt => ({
              warehouseId: receipt.warehouseId,
              quantity: number(receipt.stockOnHandQty ?? receipt.qty),
            })),
          ...(data.finishedGoodsWarehouseEntries || [])
            .filter(entry =>
              normalized(entry.item || entry.name) === itemName &&
              entry.warehouseId !== undefined && entry.warehouseId !== null,
            )
            .map(entry => ({ warehouseId: entry.warehouseId, quantity: number(entry.qty) })),
          item.warehouseId === undefined || item.warehouseId === null
            ? []
            : [{ warehouseId: item.warehouseId, quantity: number(item.qty) }],
        ];

    const warehouses = new Map((data.warehouses || []).map(warehouse => [String(warehouse.id), warehouse]));
    const balances = new Map();
    sourceEntries.forEach(({ warehouseId, quantity }) => {
      const key = String(warehouseId);
      balances.set(key, (balances.get(key) || 0) + quantity);
    });

    return [...balances.entries()]
      .filter(([, quantity]) => quantity > 0)
      .map(([warehouseId, quantity]) => ({
        warehouse: warehouses.get(warehouseId),
        quantity,
      }))
      .sort((a, b) => (a.warehouse?.name || '').localeCompare(b.warehouse?.name || ''));
  }

  // Warehouse movements are the authoritative quantity once an item has been
  // received, transferred, adjusted or issued through a warehouse. Legacy
  // opening stock without a warehouse record remains visible as its stored
  // value until it is brought into a warehouse.
  function onHandQuantity(item) {
    const balances = warehouseBalances(item);
    return balances.length ? balances.reduce((sum, balance) => sum + number(balance.quantity), 0) : number(item.qty);
  }

  function ensureDialog() {
    let dialog = document.querySelector('#stock-location-dialog');
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.id = 'stock-location-dialog';
    dialog.className = 'stock-location-dialog';
    dialog.innerHTML = `
      <div class="stock-location-modal-head">
        <div>
          <p class="modal-label">STOCK LOCATION</p>
          <h2 id="stock-location-title">Warehouse availability</h2>
        </div>
        <button class="close" type="button" aria-label="Close stock locations">×</button>
      </div>
      <p class="stock-location-summary" id="stock-location-summary"></p>
      <div class="stock-location-list" id="stock-location-list"></div>
      <div class="modal-actions"><button class="secondary" type="button">Close</button></div>`;
    dialog.querySelectorAll('button').forEach(button => button.addEventListener('click', () => dialog.close()));
    document.body.append(dialog);
    return dialog;
  }

  function showLocations(item) {
    const dialog = ensureDialog();
    const balances = warehouseBalances(item);
    dialog.querySelector('#stock-location-title').textContent = item.name;
    const total = onHandQuantity(item);
    dialog.querySelector('#stock-location-summary').textContent = `${total.toLocaleString()} ${item.unit} currently on hand`;
    dialog.querySelector('#stock-location-list').innerHTML = balances.length
      ? balances.map(({ warehouse, quantity }) => `
          <article class="stock-location-row">
            <div><strong>${escapeHtml(warehouse?.name || 'Unknown warehouse')}</strong>${warehouse?.location ? `<span>${escapeHtml(warehouse.location)}</span>` : ''}</div>
            <b>${quantity.toLocaleString()} <small>${escapeHtml(item.unit)}</small></b>
          </article>`).join('')
      : '<p class="stock-location-empty">No warehouse balance has been recorded for this item yet.</p>';
    dialog.showModal();
  }

  const originalStock = stock;
  stock = function renderStockWithLocations() {
    originalStock();
    document.querySelectorAll('.stock-card').forEach((card, index) => {
      const item = data.stock?.[index];
      if (!item || card.querySelector('.view-stock-locations')) return;
      const onHand = onHandQuantity(item);
      const stockNumber = card.querySelector('.stock-number');
      if (stockNumber) stockNumber.textContent = onHand.toLocaleString();
      const status = card.querySelector('.badge');
      if (status) {
        const low = onHand <= number(item.reorder);
        status.classList.toggle('low', low);
        status.classList.toggle('ok', !low);
        status.textContent = low ? 'LOW STOCK' : 'IN STOCK';
      }
      const footer = card.querySelector('.stock-footer');
      footer?.insertAdjacentHTML('afterend', '<button class="text-btn view-stock-locations" type="button">Location</button>');
      card.querySelector('.view-stock-locations')?.addEventListener('click', () => showLocations(item));
    });
  };

  const style = document.createElement('style');
  style.textContent = `
    .view-stock-locations { margin-top: 12px; padding: 0; }
    .stock-location-dialog { width: min(520px, calc(100% - 32px)); }
    .stock-location-modal-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding:25px 25px 0; }
    .stock-location-modal-head h2 { font:700 24px 'Playfair Display'; margin:0; }
    .stock-location-summary { color:var(--muted); margin:10px 25px 18px; }
    .stock-location-list { border-top:1px solid var(--line); }
    .stock-location-row { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:15px 25px; border-bottom:1px solid var(--line); }
    .stock-location-row strong, .stock-location-row span { display:block; }
    .stock-location-row span { color:var(--muted); font-size:12px; margin-top:3px; }
    .stock-location-row b { white-space:nowrap; font:700 18px 'Playfair Display'; }
    .stock-location-row small { color:var(--muted); font:500 12px 'DM Sans'; }
    .stock-location-empty { color:var(--muted); margin:20px 25px; }
    .stock-location-dialog .modal-actions { margin:0; padding:18px 25px 25px; }
  `;
  document.head.append(style);
  stock();
})();
