// Single source of truth for warehouse stock and the receiving quality policy.
//
// Every screen that shows or validates an on-hand quantity (Warehouses, Stock
// locations, production material selection, transfers and adjustments) reads
// it from here, so two screens can never disagree about the same warehouse.
//
// Balance of an item in a warehouse =
//   every stock movement recorded against that warehouse
// + accepted goods receipts that were never posted to the movement ledger
//   (older records created before the ledger existed)
// + legacy finished-goods warehouse entries (never posted to the ledger).
//
// A receipt counts only when `decision === 'Accepted'` and it is not deleted.
(function (root) {
  const normalized = value => String(value ?? '').trim().toLowerCase();
  const number = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const round = value => Math.round(value * 1e6) / 1e6;
  const hasId = value => value !== undefined && value !== null && value !== '';
  // app.js declares `data` with a top-level `let`, which is a global binding
  // but not a property of `window`, so it must be resolved by name.
  // eslint-disable-next-line no-undef
  const pageData = () => (typeof data !== 'undefined' ? data : root.data);
  const stateOf = state => state || pageData() || {};

  function isAccepted(receipt) {
    return Boolean(receipt) && !receipt.deleted && receipt.decision === 'Accepted';
  }

  // Quantity a receipt posted to stock, in the item's stock unit.
  function receiptQuantity(receipt) {
    return number(receipt.stockOnHandQty ?? receipt.stockQty ?? receipt.qty);
  }

  function batchNumber(record) {
    return record?.batchNumber || record?.batch || record?.lotNo || '';
  }

  function movementItem(movement) {
    return movement.item ?? movement.itemName;
  }

  function entriesFor(itemName, state) {
    const source = stateOf(state);
    const name = normalized(itemName);
    const movements = (source.stockMovements || []).filter(movement =>
      normalized(movementItem(movement)) === name && hasId(movement.warehouseId),
    );
    const postedReceiptIds = new Set(movements
      .filter(movement => movement.sourceType === 'GOODS_RECEIPT')
      .map(movement => String(movement.sourceId)));
    const entries = movements.map(movement => ({
      warehouseId: String(movement.warehouseId),
      quantity: number(movement.quantity),
      kind: 'movement',
      record: movement,
    }));
    (source.goodsInwards || []).forEach(receipt => {
      if (!isAccepted(receipt) || normalized(receipt.item) !== name || !hasId(receipt.warehouseId)) return;
      if (postedReceiptIds.has(String(receipt.id))) return;
      entries.push({ warehouseId: String(receipt.warehouseId), quantity: receiptQuantity(receipt), kind: 'receipt', record: receipt });
    });
    (source.finishedGoodsWarehouseEntries || []).forEach(entry => {
      if (normalized(entry.item ?? entry.name) !== name || !hasId(entry.warehouseId)) return;
      entries.push({ warehouseId: String(entry.warehouseId), quantity: number(entry.qty ?? entry.quantity), kind: 'finished-goods', record: entry });
    });
    // Opening stock keyed to a warehouse on the stock card itself is used only
    // while nothing else has been recorded for the item.
    if (!entries.length) {
      const stockItem = (source.stock || []).find(item => normalized(item.name) === name);
      if (stockItem && hasId(stockItem.warehouseId)) {
        entries.push({ warehouseId: String(stockItem.warehouseId), quantity: number(stockItem.qty), kind: 'opening', record: stockItem });
      }
    }
    return entries;
  }

  function warehouseBalance(itemName, warehouseId, state) {
    if (!hasId(warehouseId)) return 0;
    const key = String(warehouseId);
    return round(entriesFor(itemName, state)
      .filter(entry => entry.warehouseId === key)
      .reduce((total, entry) => total + entry.quantity, 0));
  }

  function warehouseBalances(itemName, state) {
    const source = stateOf(state);
    const totals = new Map();
    entriesFor(itemName, state).forEach(entry => totals.set(entry.warehouseId, (totals.get(entry.warehouseId) || 0) + entry.quantity));
    const warehouses = new Map((source.warehouses || []).map(warehouse => [String(warehouse.id), warehouse]));
    return [...totals.entries()]
      .map(([warehouseId, quantity]) => ({ warehouseId, warehouse: warehouses.get(warehouseId), quantity: round(quantity) }))
      .filter(balance => balance.quantity > 0)
      .sort((a, b) => (a.warehouse?.name || '').localeCompare(b.warehouse?.name || ''));
  }

  function onHand(itemName, state) {
    const balances = warehouseBalances(itemName, state);
    if (balances.length) return round(balances.reduce((total, balance) => total + balance.quantity, 0));
    const stockItem = (stateOf(state).stock || []).find(item => normalized(item.name) === normalized(itemName));
    // Stock that has never been placed in a warehouse keeps its card value.
    return entriesFor(itemName, state).length ? 0 : number(stockItem?.qty);
  }

  // Every item with a positive balance in one warehouse, for the Warehouses view.
  function warehouseStock(warehouseId, state) {
    const source = stateOf(state);
    if (!hasId(warehouseId)) return [];
    const key = String(warehouseId);
    const names = new Map();
    const remember = name => { if (name && !names.has(normalized(name))) names.set(normalized(name), name); };
    (source.stock || []).forEach(item => remember(item.name));
    (source.stockMovements || []).forEach(movement => { if (String(movement.warehouseId) === key) remember(movementItem(movement)); });
    (source.goodsInwards || []).forEach(receipt => { if (String(receipt.warehouseId) === key) remember(receipt.item); });
    (source.finishedGoodsWarehouseEntries || []).forEach(entry => { if (String(entry.warehouseId) === key) remember(entry.item ?? entry.name); });

    return [...names.values()].map(name => {
      const entries = entriesFor(name, state).filter(entry => entry.warehouseId === key);
      const quantity = round(entries.reduce((total, entry) => total + entry.quantity, 0));
      const stockItem = (source.stock || []).find(item => normalized(item.name) === normalized(name));
      const receipts = (source.goodsInwards || []).filter(receipt =>
        isAccepted(receipt) && normalized(receipt.item) === normalized(name) && String(receipt.warehouseId) === key);
      const records = entries.map(entry => entry.record);
      const dates = [...records.map(record => record.at || record.postedAt), ...receipts.map(receipt => receipt.warehouseAssignedDate || receipt.receivedDate)]
        .filter(Boolean).map(String).sort();
      return {
        item: name,
        category: stockItem?.category || receipts[0]?.category || records.find(record => record.category)?.category || '',
        unit: stockItem?.unit || receipts[0]?.stockUnit || receipts[0]?.unit || records.find(record => record.unit)?.unit || '',
        quantity,
        lots: [...new Set(receipts.map(batchNumber).filter(Boolean))],
        suppliers: [...new Set(receipts.map(receipt => receipt.supplier).filter(Boolean))],
        lastMovementAt: dates[dates.length - 1] || '',
      };
    }).filter(row => row.quantity > 0).sort((a, b) => a.item.localeCompare(b.item));
  }

  // Quantity still available from one accepted purchase batch.
  function batchRemaining(receipt, state) {
    if (!isAccepted(receipt)) return 0;
    const batch = batchNumber(receipt);
    const issued = (stateOf(state).stockMovements || []).filter(movement =>
      (movement.type === 'PRODUCTION_ISSUE' || movement.type === 'PRODUCTION_RETURN') && batch && movement.lotNo === batch &&
      normalized(movementItem(movement)) === normalized(receipt.item) &&
      (!hasId(movement.warehouseId) || String(movement.warehouseId) === String(receipt.warehouseId)),
    ).reduce((total, movement) => total + number(movement.quantity), 0);
    return Math.max(0, round(receiptQuantity(receipt) + issued));
  }

  function acceptedBatches(warehouseIds, state) {
    const ids = new Set((Array.isArray(warehouseIds) ? warehouseIds : [warehouseIds]).filter(hasId).map(String));
    return (stateOf(state).goodsInwards || []).filter(receipt =>
      isAccepted(receipt) && batchNumber(receipt) && ids.has(String(receipt.warehouseId)) && batchRemaining(receipt, state) > 0,
    );
  }

  // ---- Receiving quality policy -------------------------------------------

  const nutStandardLabels = /oil\s*content|aflatoxin|kernel/i;

  function standardParameters(item, source) {
    const species = (item.speciesSpecs || []).flatMap(spec => spec?.standard?.parameters || []);
    if (species.length) return species;
    if (item.qualityStandard?.parameters?.length) return item.qualityStandard.parameters;
    return source.categoryStandards?.[item.category]?.parameters || [];
  }

  // Used once per item, before an administrator has set the flag explicitly.
  function defaultRequiresQualityCheck(item, state) {
    const source = stateOf(state);
    if (normalized(item.category) === 'nuts') return true;
    const parameters = standardParameters(item, source);
    if (!parameters.length) return false;
    // The nut standard was copied onto other items by an older editor default.
    // It is not a real specification for firewood, chemicals or packaging.
    return !parameters.some(parameter => nutStandardLabels.test(parameter.label || parameter.key || ''));
  }

  function purchaseItem(itemName, state) {
    return (stateOf(state).items || []).find(item => normalized(item.name) === normalized(itemName));
  }

  function requiresQualityCheck(itemName, state) {
    const item = purchaseItem(itemName, state);
    // An item outside the catalogue cannot have been cleared, so it is checked.
    if (!item) return true;
    return typeof item.requiresQualityCheck === 'boolean' ? item.requiresQualityCheck : defaultRequiresQualityCheck(item, state);
  }

  function applyQualityPolicyDefaults(state) {
    let changed = false;
    (stateOf(state).items || []).forEach(item => {
      if (typeof item.requiresQualityCheck === 'boolean') return;
      item.requiresQualityCheck = defaultRequiresQualityCheck(item, state);
      changed = true;
    });
    return changed;
  }

  root.StockLedger = {
    isAccepted,
    receiptQuantity,
    batchNumber,
    warehouseBalance,
    warehouseBalances,
    onHand,
    warehouseStock,
    batchRemaining,
    acceptedBatches,
    requiresQualityCheck,
    defaultRequiresQualityCheck,
    applyQualityPolicyDefaults,
  };
})(typeof window !== 'undefined' ? window : globalThis);
