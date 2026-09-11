// Receiving settlement and warehouse gating. The single collection-versus-
// factory comparison is rendered by goods-inwards.js beside the quality form.
const receivingEscape = (value) => goodsEscape(value);
const receivingParameters = [
  ['moisture', 'Moisture', '%'],
  ['oilContent', 'Oil content', '%'],
  ['ffa', 'FFA', '%'],
  ['damaged', 'Damaged kernels', '%'],
  ['foreignMatter', 'Foreign matter', '%'],
  ['aflatoxin', 'Aflatoxin', 'ppb'],
];

const receivingNumber = (value) => {
  const parsed = Number(value);
  return value === '' || value === null || value === undefined || !Number.isFinite(parsed) ? null : parsed;
};
const receivingQty = (value, unit) =>
  value === '' || value === null || value === undefined
    ? '—'
    : `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${receivingEscape(unit || '')}`.trim();
const receivingMoney = (value) =>
  value === '' || value === null || value === undefined
    ? '—'
    : `₦${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A signed delta reads better than two bare numbers the reader must subtract. */
function receivingDelta(before, after, suffix = '') {
  if (before === null || after === null || before === '' || after === '') return '<span class="rv-delta rv-none">—</span>';
  const difference = Number((after - before).toFixed(3));
  if (difference === 0) return '<span class="rv-delta rv-same">no change</span>';
  const direction = difference > 0 ? 'rv-up' : 'rv-down';
  return `<span class="rv-delta ${direction}">${difference > 0 ? '+' : ''}${difference}${suffix}</span>`;
}

/** Money deltas run to nine figures here, so they are never shown unformatted. */
function receivingMoneyDelta(before, after) {
  if (before === null || after === null || before === '' || after === '') return '<span class="rv-delta rv-none">—</span>';
  const difference = Number((after - before).toFixed(2));
  if (difference === 0) return '<span class="rv-delta rv-same">no change</span>';
  const sign = difference > 0 ? '+' : '−';
  return `<span class="rv-delta ${difference > 0 ? 'rv-up' : 'rv-down'}">${sign}${receivingMoney(Math.abs(difference))}</span>`;
}

function receivingComparisonCard(receipt, live = {}) {
  const claimed = receipt.purchaseQuality || {};
  const rows = receivingParameters
    .map(([key, label, unit]) => {
      const before = receivingNumber(claimed[key]);
      const after = receivingNumber(live[key] ?? receipt[key]);
      return `<tr><th>${label}</th><td>${before === null ? '—' : `${before}${unit}`}</td><td>${after === null ? '<em>not tested</em>' : `${after}${unit}`}</td><td>${receivingDelta(before, after, unit)}</td></tr>`;
    })
    .join('');

  const ordered = receivingNumber(receipt.orderedQty);
  const delivered = receivingNumber(live.qty ?? receipt.qty);
  const quantityRow = `<tr class="rv-quantity"><th>Quantity</th><td>${receivingQty(receipt.orderedQty, receipt.unit)}</td><td>${receivingQty(live.qty ?? receipt.qty, receipt.unit)}</td><td>${receivingDelta(ordered, delivered, ` ${receipt.unit || ''}`)}</td></tr>`;

  return `<div class="field full receiving-comparison"><label>Order versus delivery</label>
    <div class="item-note">The left column is what the supplier ordered and claimed at purchase. The right column is what the site actually found.</div>
    <div class="rv-scroll"><table class="rv-table"><thead><tr><th>Check</th><th>Ordered / claimed</th><th>Found on site</th><th>Difference</th></tr></thead>
    <tbody>${quantityRow}${rows}</tbody></table></div></div>`;
}

function receivingSettlementCard(receipt, live = {}) {
  const draft = applyMoistureSettlement({
    qty: live.qty ?? receipt.qty,
    moisture: live.moisture ?? receipt.moisture,
    unitPrice: receipt.unitPrice,
    cost: receipt.cost,
    purchaseQuality: receipt.purchaseQuality,
  });
  const base = draft.moistureBase;
  const orderValue = Number(receipt.cost) || 0;
  const payable = draft.payableCost;
  const untested = draft.adjustedQty === '';

  const settlement = untested
    ? '<p class="rv-empty">Enter the field moisture reading to settle this delivery.</p>'
    : `<div class="rv-scroll"><table class="rv-table rv-settlement"><tbody>
        <tr><th>Delivered into store</th><td>${receivingQty(live.qty ?? receipt.qty, receipt.unit)}</td><td class="rv-note">everything received, water included</td></tr>
        <tr><th>Payable quantity at ${base}% benchmark</th><td>${receivingQty(draft.adjustedQty, receipt.unit)}</td><td class="rv-note">${receivingDelta(receivingNumber(live.qty ?? receipt.qty), draft.adjustedQty, ` ${receipt.unit || ''}`)} against delivered</td></tr>
        <tr class="rv-strong"><th>Order value</th><td>${receivingMoney(orderValue)}</td><td class="rv-note">as purchased</td></tr>
        <tr class="rv-strong"><th>Payable Amount</th><td>${receivingMoney(payable)}</td><td class="rv-note">${receivingMoneyDelta(orderValue, payable)} against order value</td></tr>
      </tbody></table></div>`;

  return `<div class="field full receiving-settlement"><label>Moisture settlement</label>
    <div class="item-note">Factory moisture is compared with the purchase-time inspection. If it is equal to or lower than that result, the agreed amount is paid in full. Only a higher factory moisture reading reduces what is owed.</div>
    <div class="rv-base"><label for="rv-base-input">Purchase-time moisture benchmark (%)</label><input id="rv-base-input" name="moistureBase" type="number" min="0" max="99" step="0.1" value="${base}" readonly></div>
    ${settlement}</div>`;
}

function receivingDecisionValue(form) {
  return form.elements.decision?.value || 'Assess';
}

/**
 * Warehouse assignment is the moment stock comes into existence, so it stays
 * closed until the server QC engine has returned ACCEPT. Disabling the inputs
 * matches the check in adjustStockForWarehouseAssignment rather than relying on
 * the storekeeper to notice.
 */
function receivingApplyGate(form) {
  const decision = receivingDecisionValue(form);
  const accepted = decision === 'Accepted';
  const panel = form.querySelector('.wizard-step[data-step="3"]');
  if (!panel) return;
  ['warehouseId', 'warehouseAssignedById', 'warehouseAssignedDate'].forEach((name) => {
    const control = form.elements[name];
    if (!control) return;
    control.disabled = !accepted;
    if (!accepted && name === 'warehouseId') control.value = '';
  });
  let banner = panel.querySelector('.rv-gate');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'rv-gate';
    panel.querySelector('header').append(banner);
  }
  banner.hidden = accepted;
  banner.className = `rv-gate rv-gate-${decision === 'Rejected' ? 'reject' : 'wait'}`;
  banner.innerHTML = decision === 'Rejected'
    ? '<strong>Rejected — no stock will be created.</strong> This material cannot be assigned to a warehouse. Record the disposal or return to supplier against this receipt.'
    : '<strong>Awaiting a quality decision.</strong> Run the QC check on the previous step. Warehouse assignment opens only once the engine returns ACCEPT.';
}

function receivingDecisionReason(form, receipt) {
  const panel = form.querySelector('.wizard-step[data-step="2"] .form-grid');
  if (!panel || form.elements.decisionReason) return;
  panel.insertAdjacentHTML(
    'beforeend',
    `<div class="field full"><label>Reason for the decision</label><textarea name="decisionReason" rows="3" placeholder="Why was this delivery accepted, held or rejected?">${receivingEscape(receipt?.decisionReason || '')}</textarea><div class="item-note">Required once a decision has been recorded. This is the explanation an auditor reads next to the verdict.</div></div>`,
  );
}

function receivingParameterKey(label = '') {
  const normalised = label.toLowerCase().replace(/[^a-z]/g, '');
  return { quantity: 'qty', oilcontent: 'oilContent', ffa: 'ffa', moisture: 'moisture', damagedkernels: 'damaged', damaged: 'damaged', foreignmatter: 'foreignMatter', aflatoxin: 'aflatoxin' }[normalised];
}

function receivingMeetsStandard(value, operator, limit) {
  if (value === null || !Number.isFinite(Number(limit))) return null;
  const measured = Number(value), threshold = Number(limit);
  return ({ '≥': measured >= threshold, '>': measured > threshold, '≤': measured <= threshold, '<': measured < threshold, '=': measured === threshold })[operator] ?? null;
}

function addReceivingDecisionPanel(form, panel, getStandard, existingReceipt) {
  const grid = panel?.querySelector('.form-grid');
  if (!grid || grid.querySelector('.receiving-decision-review')) return;
  const review = document.createElement('section');
  review.className = 'field full receiving-decision-review';
  review.innerHTML = '<label>Purchase, delivery and JE Oils Standard</label><div class="item-note">Review the measured change and JE Oils Standard before choosing the final disposition.</div><div class="receiving-comparison-wrap"><table class="receiving-comparison"><thead><tr><th>Measure</th><th>Quality check at purchase</th><th>Quality check at delivery</th><th>Change</th></tr></thead><tbody data-receiving-decision-rows></tbody></table></div><div class="receiving-recommendation" role="status" aria-live="polite"></div>';
  grid.prepend(review);
  review._getStandard = getStandard;
  form._receivingReceipt = existingReceipt || null;
  refreshReceivingDecision(form);
}

function refreshReceivingDecision(form) {
  const review = form.querySelector('.receiving-decision-review');
  if (!review) return;
  const purchase = data.purchases.find(entry => entry.id === +form.elements.purchaseId?.value);
  const receipt = purchase ? receiptForPurchase(purchase) : (form._receivingReceipt || {});
  const assessment = receipt.purchaseQuality || {};
  const standard = review._getStandard?.() || itemStandard?.(form.elements.namedItem('item')?.value, form.elements.category?.value) || { name: 'JE Oils Standard', parameters: [] };
  const rows = review.querySelector('[data-receiving-decision-rows]');
  const delivery = form._deliveryReadings || {};
  rows.innerHTML = receivingComparisonFields.map(([key, label, unit, sourceKey]) => {
    const before = key === 'qty' ? receipt[sourceKey] ?? receipt.qty : assessment[key];
    const after = delivery[key] ?? form.elements[key]?.value;
    const difference = comparisonNumber(after) === null || comparisonNumber(before) === null ? '—' : `${Number(after) - Number(before) > 0 ? '+' : ''}${Number((Number(after) - Number(before)).toFixed(2))}${unit ? ` ${unit}` : ''}`;
    return `<tr><th scope="row">${label}</th><td>${comparisonValue(before, unit || receipt.unit || '')}</td><td>${comparisonNumber(after) === null ? 'Not recorded' : comparisonValue(after, unit || receipt.unit || '')}</td><td>${difference}</td></tr>`;
  }).join('');
  const checked = (standard.parameters || []).map(parameter => {
    const key = receivingParameterKey(parameter.label);
    const value = key ? comparisonNumber(delivery[key] ?? form.elements[key]?.value) : null;
    return { parameter, value, outcome: receivingMeetsStandard(value, parameter.operator, parameter.limit) };
  }).filter(item => item.outcome !== null);
  const failures = checked.filter(item => !item.outcome);
  const recommendation = review.querySelector('.receiving-recommendation');
  if (!checked.length) recommendation.innerHTML = `<strong>Recommendation unavailable</strong><span>Enter delivery readings for the configured ${goodsEscape(standard.name || 'JE Oils Standard')} parameters.</span>`;
  else if (!failures.length) recommendation.innerHTML = `<strong>Recommended: Accept</strong><span>All ${checked.length} recorded reading${checked.length === 1 ? '' : 's'} meet the ${goodsEscape(standard.name || 'JE Oils Standard')}.</span>`;
  else recommendation.innerHTML = `<strong>Recommended: ${failures.length > 1 ? 'Reject' : 'Hold'}</strong><span>${failures.map(item => goodsEscape(item.parameter.label)).join(', ')} ${failures.length === 1 ? 'is' : 'are'} outside the ${goodsEscape(standard.name || 'JE Oils Standard')}. ${failures.length > 1 ? 'Reject or escalate for a documented exception.' : 'Hold for review or retest.'}</span>`;
  recommendation.className = `receiving-recommendation ${!checked.length ? 'is-pending' : !failures.length ? 'is-accept' : failures.length > 1 ? 'is-reject' : 'is-hold'}`;
}
window.addReceivingDecisionPanel = addReceivingDecisionPanel;
window.refreshReceivingDecision = refreshReceivingDecision;

function receivingRefresh(form, receipt) {
  const live = {
    qty: form.elements.qty?.value,
    moisture: form.elements.moisture?.value,
    oilContent: form.elements.oilContent?.value,
    ffa: form.elements.ffa?.value,
    damaged: form.elements.damaged?.value,
    foreignMatter: form.elements.foreignMatter?.value,
    aflatoxin: form.elements.aflatoxin?.value,
  };
  const settlement = form.querySelector('.receiving-settlement');
  if (settlement) {
    const focused = document.activeElement?.id === 'rv-base-input';
    settlement.outerHTML = receivingSettlementCard(receipt, live);
    if (focused) form.querySelector('#rv-base-input')?.focus();
  }
  receivingBindBase(form, receipt);
}

function receivingBindBase(form, receipt) {
  const input = form.querySelector('#rv-base-input');
  if (!input || input.dataset.bound === 'yes') return;
  input.dataset.bound = 'yes';
  input.onchange = () => {
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 0 || value >= 100) return;
    data.settings ??= {};
    data.settings.baseMoisture = value;
    save();
    receivingRefresh(form, receipt);
  };
}

const receivingBaseOpen = openGoodsInward;
openGoodsInward = (receipt) => {
  receivingBaseOpen(receipt);
  const form = $('#record-form');
  const inspect = form.querySelector('.wizard-step[data-step="1"] .form-grid');
  if (!inspect) return;
  const current = receipt || {};
  // Temporarily disabled at the user's request. Keep the settlement card and
  // its calculation code above for a future supplier-payment workflow.
  // inspect.insertAdjacentHTML('beforeend', receivingSettlementCard(current));
  // receivingBindBase(form, current);
  receivingDecisionReason(form, current);
  receivingApplyGate(form);

  // The decision is selected on step three, after this modal initially opens.
  // Re-evaluate the warehouse gate immediately so Accepted can proceed without
  // closing and reopening the receipt.
  form.elements.decision?.addEventListener('change', () => receivingApplyGate(form));

  ['qty', 'moisture', 'oilContent', 'ffa', 'damaged', 'foreignMatter', 'aflatoxin'].forEach((name) => {
    const control = form.elements[name];
    if (!control) return;
    control.addEventListener('input', () => receivingRefresh(form, current));
  });
};

// A decision without a reason is the gap the paper trail keeps falling through,
// so it is enforced at submit rather than left to the officer's discretion.
$('#record-form').addEventListener(
  'submit',
  (event) => {
    const form = event.currentTarget;
    if (form.dataset.type !== 'goods-inward') return;
    const decision = receivingDecisionValue(form);
    const reason = form.elements.decisionReason;
    if (decision === 'Assess' || !reason) return;
    if (reason.value.trim()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    reason.setCustomValidity('Record why this delivery was accepted, held or rejected.');
    reason.reportValidity();
    reason.oninput = () => reason.setCustomValidity('');
  },
  true,
);

const receivingStyle = document.createElement('style');
receivingStyle.textContent =
  '.rv-table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}' +
  '.rv-table th,.rv-table td{text-align:left;padding:7px 10px;border-bottom:1px solid #ece3d3}' +
  '.rv-table thead th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8a7d68;border-bottom:1px solid #ddd0b8}' +
  '.rv-table tbody th{font-weight:600;color:#3d3527;width:34%}' +
  '.rv-table .rv-quantity td,.rv-table .rv-quantity th{background:#fbf6ec}' +
  '.rv-table .rv-strong th,.rv-table .rv-strong td{font-weight:700;color:#201b13}' +
  '.rv-note{color:#8a7d68;font-size:12px;font-weight:400}' +
  '.rv-delta{font-weight:600}.rv-up{color:#2f7d4f}.rv-down{color:#9f2f25}.rv-same,.rv-none{color:#8a7d68;font-weight:400}' +
  '.rv-empty{margin:10px 0 0;color:#8a7d68;font-size:13px}' +
  '.rv-base{display:flex;align-items:center;gap:10px;margin-top:10px}' +
  '.rv-base label{font-size:12px;color:#6d6250;margin:0}' +
  '.rv-base input{width:90px}' +
  '.rv-gate{margin-top:10px;padding:10px 12px;border-radius:8px;font-size:13px;line-height:1.45}' +
  '.rv-gate-wait{background:#fbf1dc;border:1px solid #e6cf9a;color:#6b5417}' +
  '.rv-gate-reject{background:#fbe9e7;border:1px solid #e3b3ac;color:#8c2b21}' +
  '.qc-change-value{transition:background-color .15s ease}.qc-change-value.is-better{color:#285f32;background:rgb(126 185 117 / var(--qc-heat,.12));font-weight:700}.qc-change-value.is-worse{color:#8d3029;background:rgb(211 115 103 / var(--qc-heat,.12));font-weight:700}.qc-change-value.is-same{color:#5d625b;background:rgb(157 164 152 / var(--qc-heat,.08))}.qc-change-value.is-unavailable{color:#6d6e64}' +
  '.receiving-comparison,.receiving-settlement{margin-bottom:6px}'+
  '.rv-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}'+
  '.rv-table{min-width:420px}' +
  '.receiving-recommendation{display:grid;gap:3px;margin-top:12px;padding:10px 12px;border:1px solid;border-radius:7px;font-size:13px;line-height:1.4}' +
  '.receiving-recommendation span{font-size:12px}.receiving-recommendation.is-pending{color:#6b5417;background:#fbf1dc;border-color:#e6cf9a}.receiving-recommendation.is-accept{color:#285f32;background:#edf6ea;border-color:#bfd7b9}.receiving-recommendation.is-hold{color:#765118;background:#fff5df;border-color:#e4cc96}.receiving-recommendation.is-reject{color:#8c2b21;background:#fbe9e7;border-color:#e3b3ac}';
document.head.append(receivingStyle);
