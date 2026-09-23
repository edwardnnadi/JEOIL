// Regressions from the end-to-end factory walkthrough: a field-QC edit pulling
// a collected load back to "QC accepted", and goods-inwards QC leaving no
// laboratory record. Run with: pnpm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const traceabilitySource = readFileSync(new URL('../public/purchase-traceability.js', import.meta.url), 'utf8');
const goodsInwardsSource = readFileSync(new URL('../public/goods-inwards.js', import.meta.url), 'utf8');
const purchaseWizardSource = readFileSync(new URL('../public/purchase-wizard.js', import.meta.url), 'utf8');
const goodsInwardsWizardSource = readFileSync(new URL('../public/goods-inwards-wizard.js', import.meta.url), 'utf8');
const reportsSource = readFileSync(new URL('../public/reports.js', import.meta.url), 'utf8');

function loadNamedFunction(sourceText, name, contextValues = {}) {
  const match = sourceText.match(new RegExp(`function ${name}\\([^]*?\\n}`));
  assert.ok(match, `${name} must be defined`);
  const context = { ...contextValues };
  vm.createContext(context);
  vm.runInContext(`${match[0]}; globalThis.result = ${name};`, context);
  return context.result;
}

const advancedPurchaseStage = () => loadNamedFunction(traceabilitySource, 'advancedPurchaseStage');

test('opening a purchase wizard restores a purchase-specific save label', () => {
  const configure = loadNamedFunction(purchaseWizardSource, 'configurePurchaseSaveButton');
  const save = { type: 'button', textContent: 'Finish receipt' };

  configure(save);

  assert.equal(save.type, 'submit');
  assert.equal(save.textContent, 'Save purchase');
});

test('Goods Inwards requires factory inspection only for QC-controlled items and exposes the linked field test', () => {
  assert.match(goodsInwardsWizardSource, /const required=window\.StockLedger\.requiresQualityCheck\(receivingItemName\(\)\);/);
  assert.match(goodsInwardsSource, /const qualityCheckRequired=window\.StockLedger\.requiresQualityCheck\(values\.item\);/);
  assert.match(goodsInwardsSource, /<label>Field test<\/label>/);
});

test('Report Centre includes laboratory and goods-outward operational registers', () => {
  assert.match(reportsSource, /'Lab Results'/);
  assert.match(reportsSource, /'Goods Outwards'/);
  assert.match(reportsSource, /function goodsOutwardRows/);
  assert.match(reportsSource, /function labResultRows/);
});

test('field QC never pulls a purchase back to an earlier stage', () => {
  const advance = advancedPurchaseStage();

  // The walkthrough failure: the load was already collected and on the road.
  assert.equal(advance('In transit', 'QC accepted'), null);
  assert.equal(advance('Arrived at factory', 'QC accepted'), null);
  assert.equal(advance('Moved to warehouse', 'QC accepted'), null);
  // Re-confirming the same stage is not a change either.
  assert.equal(advance('QC accepted', 'QC accepted'), null);
});

test('field QC still advances a purchase that has not moved past inspection', () => {
  const advance = advancedPurchaseStage();

  assert.equal(advance('Ordered', 'QC accepted'), 'QC accepted');
  assert.equal(advance('QC inspection', 'QC accepted'), 'QC accepted');
  // Terminal and off-ladder outcomes always apply, whatever the current stage.
  assert.equal(advance('Moved to warehouse', 'Rejected'), 'Rejected');
  assert.equal(advance('In transit', 'QC hold / retest'), 'QC hold / retest');
  assert.equal(advance('Ordered', null), null);
});

function labSync(state) {
  const decision = loadNamedFunction(goodsInwardsSource, 'labResultDecisionFor');
  let nextId = 900;
  return loadNamedFunction(goodsInwardsSource, 'syncLabResultForReceipt', {
    data: state,
    id: () => ++nextId,
    labResultDecisionFor: decision,
  });
}

const acceptedReceipt = () => ({
  id: 'GI-1006',
  goodsInwardsId: 'GIN-1006',
  purchaseId: 1010,
  decision: 'Accepted',
  qualityCheckRequired: true,
  qualityStandard: 'Groundnut kernels',
  qualityDate: '2026-09-16',
  receivedDate: '2026-09-16',
  batchNumber: 'LOT-1010',
  qualityCheckOfficer: 'A. Bello',
  decisionReason: 'Meets receiving standard.',
  qualityParameters: { moisture: 7.1, aflatoxin: 3.4 },
  moisture: 7.1,
  aflatoxin: 3.4,
});

test('an accepted goods receipt publishes its QC readings to Lab results', () => {
  const state = { labResults: [], goodsInwards: [] };
  const sync = labSync(state);
  const receipt = acceptedReceipt();

  sync(receipt);

  assert.equal(state.labResults.length, 1);
  const [result] = state.labResults;
  assert.equal(result.stage, 'GOODS_INWARDS');
  assert.equal(result.batchRef, 'LOT-1010');
  assert.equal(result.goodsInwardsRef, 'GIN-1006');
  assert.equal(result.goodsInwardsRecordId, 'GI-1006');
  assert.equal(result.decision, 'Pass');
  assert.equal(result.analyst, 'A. Bello');
  assert.deepEqual({ ...result.values }, { moisture: 7.1, aflatoxin: 3.4 });
});

test('re-saving a receipt updates its laboratory record instead of adding another', () => {
  const state = { labResults: [], goodsInwards: [] };
  const sync = labSync(state);
  const receipt = acceptedReceipt();

  sync(receipt);
  const originalId = state.labResults[0].id;
  receipt.decision = 'Rejected';
  receipt.decisionReason = 'Aflatoxin above limit on retest.';
  sync(receipt);

  assert.equal(state.labResults.length, 1);
  assert.equal(state.labResults[0].id, originalId);
  assert.equal(state.labResults[0].decision, 'Fail');
});

test('a receipt with no decision, or one that is deleted, leaves no laboratory record', () => {
  const state = { labResults: [], goodsInwards: [] };
  const sync = labSync(state);
  const receipt = acceptedReceipt();

  sync(receipt);
  assert.equal(state.labResults.length, 1);

  receipt.deleted = true;
  sync(receipt);
  assert.equal(state.labResults.length, 0);

  receipt.deleted = false;
  receipt.decision = 'Assess';
  sync(receipt);
  assert.equal(state.labResults.length, 0);
});

test('an item exempt from quality checks is not recorded as a laboratory test', () => {
  const state = { labResults: [], goodsInwards: [] };
  const sync = labSync(state);
  const receipt = { ...acceptedReceipt(), qualityCheckRequired: false };

  sync(receipt);

  assert.equal(state.labResults.length, 0);
});

test('a receipt with only the legacy nut columns still records its readings', () => {
  const state = { labResults: [], goodsInwards: [] };
  const sync = labSync(state);
  const receipt = { ...acceptedReceipt(), qualityParameters: {}, damaged: 1.8, foreignMatter: 0.4 };

  sync(receipt);

  assert.deepEqual({ ...state.labResults[0].values }, {
    'Moisture (%)': 7.1,
    'Damaged kernels (%)': 1.8,
    'Foreign matter (%)': 0.4,
    'Aflatoxin (ppb)': 3.4,
  });
});
