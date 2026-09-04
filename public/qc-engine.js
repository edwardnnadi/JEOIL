// The browser collects a test; /api/qc is the only place that evaluates and
// persists ACCEPT/REJECT. It never calculates a quality decision itself.
const qcBaseRender = render;
const qcBaseOpenGoodsInward = typeof openGoodsInward === 'function' ? openGoodsInward : null;
const qcFieldMap = { moisture: 'moisture', oil_content: 'oilContent', ffa: 'ffa', foreign_matter: 'foreignMatter', aflatoxin: 'aflatoxin' };

function qcReceipt(id) { return (data.goodsInwards || []).find((record) => String(record.id) === String(id)); }
function qcReference(record) { return record.batch || record.purchaseReference || record.purchaseId || record.reference || `Record ${record.id}`; }
function qcResultFor(record, context, stage) {
  return context === 'RAW_MATERIAL' ? record.qcEngineResult : record.productQc?.[stage];
}
function qcBadge(result) {
  if (!result) return '<span class="badge pending">QC REQUIRED</span>';
  const style = result.overallResult === 'ACCEPT' || result.overallResult === 'PASS' ? 'ok' : 'reject';
  return `<span class="badge ${style}">${result.overallResult}</span>`;
}

function addQcActions() {
  document.querySelectorAll('.edit-receipt').forEach((button) => {
    const receipt = qcReceipt(button.dataset.receiptId);
    if (!receipt || button.parentElement.querySelector('.run-qc-engine')) return;
    const run = document.createElement('button');
    run.type = 'button'; run.className = 'text-btn run-qc-engine'; run.dataset.receiptId = receipt.id;
    run.textContent = receipt.qcEngineResult ? 'View QC' : 'Run QC';
    run.onclick = () => openQcEngine(receipt);
    button.parentElement.prepend(qcBadge(receipt.qcEngineResult));
    button.parentElement.prepend(run);
  });
  // Older saved state renders the original assessment table rather than the
  // goods-inwards table. Keep those historical assessments on the same engine
  // path instead of leaving a manual-decision loophole.
  const legacyRows = [...document.querySelectorAll('#quality-table tr')];
  legacyRows.forEach((row, index) => {
    const assessment = data.assessments?.[index];
    if (!assessment || row.querySelector('.run-qc-engine')) return;
    const cell = row.lastElementChild;
    if (!cell) return;
    const run = document.createElement('button');
    run.type = 'button'; run.className = 'text-btn run-qc-engine';
    run.textContent = assessment.qcEngineResult ? 'View QC' : 'Run QC';
    run.onclick = () => openQcEngine(assessment);
    cell.prepend(qcBadge(assessment.qcEngineResult));
    cell.prepend(run);
  });
  [...document.querySelectorAll('#production-table tr')].forEach((row, index) => {
    const production = data.production?.[index];
    if (!production || row.querySelector('.run-product-qc')) return;
    const cell = row.lastElementChild;
    if (!cell) return;
    ['IN_PROCESS', 'FINAL'].forEach((stage) => {
      const run = document.createElement('button');
      run.type = 'button'; run.className = 'text-btn run-product-qc';
      run.textContent = qcResultFor(production, 'FINISHED_PRODUCT', stage) ? `View ${stage === 'FINAL' ? 'final' : 'in-process'} QC` : `Run ${stage === 'FINAL' ? 'final' : 'in-process'} QC`;
      run.onclick = () => openQcEngine(production, 'FINISHED_PRODUCT', stage);
      cell.append(document.createElement('br'), run, qcBadge(qcResultFor(production, 'FINISHED_PRODUCT', stage)));
    });
  });
}

render = () => { qcBaseRender(); addQcActions(); };

// Legacy receipt rendering still expects a decision field. Hide its manual
// control and preserve a compatibility value derived from the engine record.
if (qcBaseOpenGoodsInward) {
  openGoodsInward = (receipt) => {
    qcBaseOpenGoodsInward(receipt);
    const form = $('#record-form');
    const control = form.elements.decision;
    if (!control) return;
    const result = receipt?.qcEngineResult;
    const value = result?.overallResult === 'ACCEPT' ? 'Accepted' : result?.overallResult === 'REJECT' ? 'Rejected' : 'Assess';
    control.closest('.field')?.replaceWith(document.createRange().createContextualFragment(`<input name="decision" type="hidden" value="${value}"><div class="field full qc-engine-note"><label>Quality decision</label><div class="item-note">The QC engine records this after a submitted test.${result ? ` Latest server decision: <strong>${result.overallResult}</strong>.` : ' Run QC after saving this receipt.'}</div></div>`));
  };
}

function qcInput(definition, record) {
  const saved = record.qcDraft?.[definition.parameterKey] ?? record[qcFieldMap[definition.parameterKey]] ?? '';
  if (definition.dataType === 'ENUM') {
    return `<div class="field"><label>${definition.displayName}</label><select name="${definition.parameterKey}" required><option value="">Select result</option>${definition.allowedValues.map((value) => `<option value="${value}" ${saved === value ? 'selected' : ''}>${value}</option>`).join('')}</select><div class="item-note">Allowed: ${definition.allowedValues.join(', ')}</div></div>`;
  }
  const limit = definition.thresholdValue === null ? 'Advisory only — limit not configured.' : `Server limit: ${definition.comparator === 'GTE' ? '≥' : '≤'} ${definition.thresholdValue}${definition.unit || ''}`;
  return `<div class="field"><label>${definition.displayName}${definition.unit ? ` (${definition.unit})` : ''}</label><input name="${definition.parameterKey}" type="number" min="0" step="0.01" value="${saved}" ${definition.isCritical ? 'required' : ''}><div class="item-note">${limit}</div></div>`;
}

function qcResultCard(result) {
  if (!result) return '';
  const accepted = result.overallResult === 'ACCEPT' || result.overallResult === 'PASS';
  const rows = result.allParameters.map((item) => `<li class="qc-outcome qc-${item.status.toLowerCase()}"><strong>${item.status === 'PASS' ? '✓' : item.status === 'FAIL' ? '×' : '–'} ${item.displayName}</strong><span>${item.submittedValue ?? 'Not entered'}${item.unit ? ` ${item.unit}` : ''} · ${item.comparator === 'GTE' ? '≥' : item.comparator === 'LTE' ? '≤' : 'Allowed:'} ${item.threshold}</span></li>`).join('');
  return `<section class="qc-result-card ${accepted ? 'qc-result-pass' : 'qc-result-fail'}"><p class="modal-label">SERVER DECISION</p><h3>${result.overallResult}</h3><p>Reference: ${result.batchRef} · recorded ${new Date(result.testedAt).toLocaleString('en-GB')}</p><ul>${rows}</ul></section>`;
}

async function openQcEngine(record, context = 'RAW_MATERIAL', stage = 'RECEIPT') {
  const isRawMaterial = context === 'RAW_MATERIAL';
  $('#modal-label').textContent = isRawMaterial ? 'RAW MATERIAL QC' : stage === 'FINAL' ? 'FINAL PRODUCT QC' : 'IN-PROCESS PRODUCT QC';
  $('#modal-title').textContent = `QC test · ${record.item || record.goods || record.reference || 'production batch'}`;
  $('#form-fields').innerHTML = '<div class="qc-loading" role="status">Loading current QC limits…</div>';
  const form = $('#record-form'); form.dataset.type = 'qc-engine'; form.dataset.receiptId = record.id; form.dataset.qcContext = context; form.dataset.qcStage = stage;
  $('#record-dialog').showModal();
  try {
    const response = await fetch(`/api/qc?context=${context}&stage=${stage}`);
    if (!response.ok) throw new Error('QC limits could not be loaded.');
    const { definitions } = await response.json();
    form.dataset.qcDefinitions = JSON.stringify(definitions);
    const fieldName = isRawMaterial ? 'Receipt reference' : 'Production batch reference';
    const help = isRawMaterial ? 'Use the receipt reference until an accepted material batch is assigned.' : 'Use the production run reference for this in-process or final test.';
    $('#form-fields').innerHTML = `<div class="qc-engine-intro"><strong>Server-controlled decision</strong><p>The QC engine, not this form, calculates and records the release decision.</p></div><div class="form-grid"><div class="field full"><label>${fieldName}</label><input name="batchRef" value="${qcReference(record)}" required><div class="item-note">${help}</div></div>${definitions.map((definition) => qcInput(definition, record)).join('')}</div>${qcResultCard(qcResultFor(record, context, stage))}`;
  } catch (error) {
    $('#form-fields').innerHTML = `<div class="qc-engine-error" role="alert">${error instanceof Error ? error.message : 'QC limits could not be loaded.'}</div>`;
  }
}

$('#record-form').addEventListener('submit', async (event) => {
  const form = event.currentTarget;
  if (form.dataset.type !== 'qc-engine') return;
  event.preventDefault(); event.stopImmediatePropagation();
  const context = form.dataset.qcContext || 'RAW_MATERIAL';
  const stage = form.dataset.qcStage || 'RECEIPT';
  const collection = context === 'RAW_MATERIAL' ? (data.goodsInwards || data.assessments || []) : (data.production || []);
  const record = collection.find((entry) => String(entry.id) === String(form.dataset.receiptId)) || (context === 'RAW_MATERIAL' ? data.assessments?.find((entry) => String(entry.id) === String(form.dataset.receiptId)) : null);
  if (!record) return;
  const definitions = JSON.parse(form.dataset.qcDefinitions || '[]');
  const values = Object.fromEntries(definitions.map((definition) => {
    const value = form.elements[definition.parameterKey]?.value ?? '';
    return [definition.parameterKey, definition.dataType === 'NUMERIC' && value !== '' ? Number(value) : value];
  }));
  const submit = $('#save-record'); submit.disabled = true; submit.textContent = 'Evaluating…';
  try {
    const response = await fetch('/api/qc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context, stage, batchRef: form.elements.batchRef.value, values }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'QC evaluation failed.');
    record.qcDraft = values;
    if (context === 'RAW_MATERIAL') {
      record.qcEngineResult = result;
      record.decision = result.overallResult === 'ACCEPT' ? 'Accepted' : 'Rejected';
      record.qualityStatus = record.decision;
    } else {
      record.productQc ??= {};
      record.productQc[stage] = result;
    }
    save(); render();
    $('#form-fields').insertAdjacentHTML('beforeend', qcResultCard(result));
    submit.textContent = 'Recorded';
  } catch (error) {
    $('#form-fields').insertAdjacentHTML('afterbegin', `<div class="qc-engine-error" role="alert">${error instanceof Error ? error.message : 'QC evaluation failed.'}</div>`);
    submit.disabled = false; submit.textContent = 'Evaluate & record';
  }
}, true);

render();
