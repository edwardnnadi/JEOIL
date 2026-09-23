// Factory acceptance scenarios for the shared stock ledger and receiving policy.
// Run with: pnpm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/stock-ledger.js', import.meta.url), 'utf8');
const lifecycleSource = readFileSync(new URL('../public/purchase-lifecycle.js', import.meta.url), 'utf8');
const receivingSource = readFileSync(new URL('../public/receiving-assessment.js', import.meta.url), 'utf8');

function loadLedger(pageScriptData) {
  const context = {};
  vm.createContext(context);
  // Mirror the browser: app.js declares `data` with a top-level `let`, which
  // other scripts can read by name but which is not a property of `window`.
  if (pageScriptData) {
    context.__pageData = pageScriptData;
    vm.runInContext('let data = globalThis.__pageData; delete globalThis.__pageData;', context);
  }
  vm.runInContext(source, context);
  return context.StockLedger;
}

const VAULT_A = 11;
const VAULT_B = 12;

function factory() {
  return {
    warehouses: [{ id: VAULT_A, name: 'Vault A' }, { id: VAULT_B, name: 'Vault B' }],
    stock: [
      { id: 1, name: 'Peanut kernels', category: 'NUTS', qty: 0, unit: 'kg' },
      { id: 2, name: 'Firewood', category: 'Firewood', qty: 0, unit: 'stacks' },
    ],
    items: [
      { id: 201, name: 'Peanut kernels', category: 'NUTS', unit: 'kg' },
      { id: 204, name: 'Diesel', category: 'Petrol and Diesel', unit: 'L', qualityStandard: { name: 'Diesel', parameters: [{ key: 'flashPoint', label: 'Flash point', operator: '≥', limit: '52', unit: '°C' }] } },
      { id: 206, name: 'Firewood', category: 'Firewood', unit: 'stacks' },
      { id: 207, name: 'Floor detergent', category: 'Cleaning materials', unit: 'L' },
    ],
    categoryStandards: {},
    goodsInwards: [],
    stockMovements: [],
  };
}

// Mirrors what goods-inwards.js writes when a receipt is accepted into a warehouse.
function receive(state, { id, item, quantity, warehouseId, batch, decision = 'Accepted', postToLedger = true }) {
  const receipt = { id, item, qty: quantity, stockQty: quantity, stockOnHandQty: decision === 'Accepted' ? quantity : 0, decision, warehouseId, batchNumber: batch, supplier: 'Northern Growers Ltd' };
  state.goodsInwards.unshift(receipt);
  if (postToLedger && decision === 'Accepted') {
    state.stockMovements.unshift({ type: 'RECEIPT', item, quantity, warehouseId, sourceType: 'GOODS_RECEIPT', sourceId: id, lotNo: batch, at: '2026-09-15T08:00:00Z' });
  }
  return receipt;
}

// Mirrors production-enhancements.js issuing material to a run.
function issue(state, { item, quantity, warehouseId, lotNo = '' }) {
  state.stockMovements.unshift({ type: 'PRODUCTION_ISSUE', item, quantity: -quantity, warehouseId: String(warehouseId), sourceType: 'PRODUCTION_RUN', sourceId: 'PR-0001', lotNo });
}

function returnFromProduction(state, { item, quantity, warehouseId, lotNo = '' }) {
  state.stockMovements.unshift({ type: 'PRODUCTION_RETURN', item, quantity, warehouseId: String(warehouseId), sourceType: 'PRODUCTION_RUN', sourceId: 'PR-0001', lotNo });
}

const warehouseRow = (ledger, state, warehouseId, item) => ledger.warehouseStock(warehouseId, state).find(row => row.item === item);

function loadNamedFunction(sourceText, name, contextValues = {}) {
  const match = sourceText.match(new RegExp(`function ${name}\\([^]*?\\n}`));
  assert.ok(match, `${name} must be defined`);
  const context = { ...contextValues };
  vm.createContext(context);
  vm.runInContext(`${match[0]}; globalThis.result = ${name};`, context);
  return context.result;
}

test('a purchase stage change records the actor and preserves an unchanged stage history', () => {
  const recordPurchaseStage = loadNamedFunction(lifecycleSource, 'recordPurchaseStage', {
    currentOperator: () => ({ name: 'Nanfa Binlam' }),
  });
  const purchase = { status: 'Moved to warehouse', stageHistory: [{ from: 'Arrived at factory', to: 'Moved to warehouse' }] };

  recordPurchaseStage(purchase, 'In transit');
  assert.equal(purchase.status, 'In transit');
  assert.deepEqual(purchase.stageHistory.at(-1).from, 'Moved to warehouse');
  assert.deepEqual(purchase.stageHistory.at(-1).to, 'In transit');
  assert.deepEqual(purchase.stageHistory.at(-1).changedBy, 'Nanfa Binlam');

  const historyLength = purchase.stageHistory.length;
  recordPurchaseStage(purchase, 'In transit');
  assert.equal(purchase.stageHistory.length, historyLength);
});

test('an accepted goods receipt without a decision reason is blocked before persistence', () => {
  const enforceDecisionReason = loadNamedFunction(receivingSource, 'enforceDecisionReason');
  const reason = {
    value: '',
    message: '',
    setCustomValidity(message) { this.message = message; },
    reportValidity() { this.reported = true; },
  };
  const form = { dataset: { type: 'goods-inward' }, elements: { decision: { value: 'Accepted' }, decisionReason: reason } };

  assert.equal(enforceDecisionReason(form), false);
  assert.match(reason.message, /Record why this delivery/);
  assert.equal(reason.reported, true);
  reason.value = 'Meets receiving standard.';
  assert.equal(enforceDecisionReason(form), true);
});

test('a blocked decision reveals the wizard step holding the reason field', () => {
  // The reason sits on the inspection step while Finish receipt is on the last
  // one. Reporting validity on a hidden control shows the receiver nothing, so
  // the save looked dead: the guard must bring that step back into view.
  const enforceDecisionReason = loadNamedFunction(receivingSource, 'enforceDecisionReason');
  const revealed = [];
  const reason = {
    value: '',
    focused: false,
    setCustomValidity() {},
    reportValidity() { this.reported = true; },
    focus() { this.focused = true; },
    closest: () => ({ dataset: { step: '2' } }),
  };
  const form = {
    dataset: { type: 'goods-inward' },
    elements: { decision: { value: 'Rejected' }, decisionReason: reason },
    querySelector: (selector) => { revealed.push(selector); return { click() { revealed.push('clicked'); } }; },
  };

  assert.equal(enforceDecisionReason(form), false);
  assert.ok(revealed.some(entry => entry.includes('[data-step="2"]')), 'must target the step holding the reason field');
  assert.ok(revealed.includes('clicked'), 'must actually switch to that step');
  assert.equal(reason.reported, true);
  assert.equal(reason.focused, true);
});

test('screens that call the ledger without passing state read the page data binding', () => {
  const state = factory();
  receive(state, { id: 'GI-1', item: 'Peanut kernels', quantity: 10000, warehouseId: VAULT_A, batch: 'LOT-1' });
  issue(state, { item: 'Peanut kernels', quantity: 5100, warehouseId: VAULT_A, lotNo: 'LOT-1' });
  const ledger = loadLedger(state);

  assert.equal(ledger.warehouseBalance('Peanut kernels', VAULT_A), 4900);
  assert.equal(ledger.warehouseStock(VAULT_A).find(row => row.item === 'Peanut kernels').quantity, 4900);
  assert.equal(ledger.requiresQualityCheck('Floor detergent'), false);
  assert.equal(ledger.requiresQualityCheck('Peanut kernels'), true);
});

test('receiving 10,000 kg into Vault A shows 10,000 kg in the warehouse view and production selection', () => {
  const ledger = loadLedger();
  const state = factory();
  receive(state, { id: 'GI-1', item: 'Peanut kernels', quantity: 10000, warehouseId: VAULT_A, batch: 'LOT-1' });

  assert.equal(warehouseRow(ledger, state, VAULT_A, 'Peanut kernels').quantity, 10000);
  assert.equal(ledger.warehouseBalance('Peanut kernels', VAULT_A, state), 10000);
});

test('issuing 5,100 kg to production leaves 4,900 kg on both screens', () => {
  const ledger = loadLedger();
  const state = factory();
  receive(state, { id: 'GI-1', item: 'Peanut kernels', quantity: 10000, warehouseId: VAULT_A, batch: 'LOT-1' });
  issue(state, { item: 'Peanut kernels', quantity: 5100, warehouseId: VAULT_A, lotNo: 'LOT-1' });

  assert.equal(warehouseRow(ledger, state, VAULT_A, 'Peanut kernels').quantity, 4900);
  assert.equal(ledger.warehouseBalance('Peanut kernels', VAULT_A, state), 4900);
  assert.equal(ledger.batchRemaining(state.goodsInwards[0], state), 4900);
});

test('returning unused issued material restores its warehouse and purchase-batch balance', () => {
  const ledger = loadLedger();
  const state = factory();
  receive(state, { id: 'GI-1', item: 'Peanut kernels', quantity: 10000, warehouseId: VAULT_A, batch: 'LOT-1' });
  issue(state, { item: 'Peanut kernels', quantity: 5100, warehouseId: VAULT_A, lotNo: 'LOT-1' });
  returnFromProduction(state, { item: 'Peanut kernels', quantity: 900, warehouseId: VAULT_A, lotNo: 'LOT-1' });

  assert.equal(warehouseRow(ledger, state, VAULT_A, 'Peanut kernels').quantity, 5800);
  assert.equal(ledger.warehouseBalance('Peanut kernels', VAULT_A, state), 5800);
  assert.equal(ledger.batchRemaining(state.goodsInwards[0], state), 5800);
});

test('a ledger movement never hides accepted receipts that pre-date the ledger', () => {
  const ledger = loadLedger();
  const state = factory();
  // Older receipt: accepted and warehoused but never written to the ledger.
  receive(state, { id: 'GI-OLD', item: 'Peanut kernels', quantity: 10000, warehouseId: VAULT_A, batch: 'LOT-OLD', postToLedger: false });
  state.stockMovements.unshift({ type: 'TRANSFER_IN', item: 'Peanut kernels', quantity: 4900, warehouseId: VAULT_A, sourceType: 'TRANSFER' });

  // The former production formula (`ledgerTotal || receipts`) returned 4,900 here.
  assert.equal(ledger.warehouseBalance('Peanut kernels', VAULT_A, state), 14900);
  assert.equal(warehouseRow(ledger, state, VAULT_A, 'Peanut kernels').quantity, 14900);
});

test('allocating legacy card stock before a transfer makes both warehouse balances available', () => {
  const ledger = loadLedger();
  const state = factory();
  // This mirrors a stock card created before warehouse movements existed.
  state.stock[1].qty = 20;
  state.stockMovements.unshift(
    { type: 'OPENING_ALLOCATION', item: 'Firewood', quantity: 20, warehouseId: VAULT_A, sourceType: 'OPENING_STOCK' },
    { type: 'TRANSFER_OUT', item: 'Firewood', quantity: -5, warehouseId: VAULT_A, sourceType: 'TRANSFER' },
    { type: 'TRANSFER_IN', item: 'Firewood', quantity: 5, warehouseId: VAULT_B, sourceType: 'TRANSFER' },
  );

  assert.equal(ledger.warehouseBalance('Firewood', VAULT_A, state), 15);
  assert.equal(ledger.warehouseBalance('Firewood', VAULT_B, state), 5);
  assert.equal(ledger.onHand('Firewood', state), 20);
});

test('only decision "Accepted" puts a receipt into stock; held, rejected and deleted receipts do not', () => {
  const ledger = loadLedger();
  const state = factory();
  receive(state, { id: 'GI-HOLD', item: 'Peanut kernels', quantity: 3000, warehouseId: VAULT_A, batch: 'LOT-H', decision: 'Hold' });
  state.goodsInwards[0].status = 'Accepted';
  const deleted = receive(state, { id: 'GI-DEL', item: 'Peanut kernels', quantity: 2000, warehouseId: VAULT_A, batch: 'LOT-D', postToLedger: false });
  deleted.deleted = true;

  assert.equal(ledger.warehouseBalance('Peanut kernels', VAULT_A, state), 0);
  assert.equal(warehouseRow(ledger, state, VAULT_A, 'Peanut kernels'), undefined);
  assert.equal(ledger.acceptedBatches([VAULT_A], state).length, 0);
});

test('a run can draw the same material from two warehouses without mixing balances', () => {
  const ledger = loadLedger();
  const state = factory();
  receive(state, { id: 'GI-A', item: 'Peanut kernels', quantity: 6000, warehouseId: VAULT_A, batch: 'LOT-A' });
  receive(state, { id: 'GI-B', item: 'Peanut kernels', quantity: 4000, warehouseId: VAULT_B, batch: 'LOT-B' });
  receive(state, { id: 'GI-F', item: 'Firewood', quantity: 40, warehouseId: VAULT_B, batch: 'LOT-F' });
  issue(state, { item: 'Peanut kernels', quantity: 6000, warehouseId: VAULT_A, lotNo: 'LOT-A' });
  issue(state, { item: 'Peanut kernels', quantity: 1500, warehouseId: VAULT_B });
  issue(state, { item: 'Firewood', quantity: 10, warehouseId: VAULT_B });

  assert.equal(ledger.warehouseBalance('Peanut kernels', VAULT_A, state), 0);
  assert.equal(ledger.warehouseBalance('Peanut kernels', VAULT_B, state), 2500);
  assert.equal(ledger.warehouseBalance('Firewood', VAULT_B, state), 30);
  assert.equal(ledger.onHand('Peanut kernels', state), 2500);
  assert.deepEqual(ledger.acceptedBatches([VAULT_A, VAULT_B], state).map(receipt => receipt.batchNumber).sort(), ['LOT-B', 'LOT-F']);
});

test('cleaning materials and firewood are received without QC; oil inputs and diesel require it', () => {
  const ledger = loadLedger();
  const state = factory();

  assert.equal(ledger.requiresQualityCheck('Floor detergent', state), false);
  assert.equal(ledger.requiresQualityCheck('Firewood', state), false);
  assert.equal(ledger.requiresQualityCheck('Peanut kernels', state), true);
  assert.equal(ledger.requiresQualityCheck('Diesel', state), true);
  assert.equal(ledger.requiresQualityCheck('Unknown item', state), true);
});

test('the copied nut standard does not force firewood through QC, and an explicit setting always wins', () => {
  const ledger = loadLedger();
  const state = factory();
  const firewood = state.items.find(item => item.name === 'Firewood');
  firewood.speciesSpecs = [{ name: 'Standard', standard: { name: 'JE Oils Standard', parameters: [{ key: 'parameter_1', label: 'Oil Content', operator: '≥', limit: '45', unit: '%' }] } }];

  assert.equal(ledger.requiresQualityCheck('Firewood', state), false);
  assert.equal(ledger.applyQualityPolicyDefaults(state), true);
  assert.equal(firewood.requiresQualityCheck, false);
  assert.equal(ledger.applyQualityPolicyDefaults(state), false);

  firewood.requiresQualityCheck = true;
  assert.equal(ledger.requiresQualityCheck('Firewood', state), true);
  state.items.find(item => item.name === 'Peanut kernels').requiresQualityCheck = false;
  assert.equal(ledger.requiresQualityCheck('Peanut kernels', state), false);
});
