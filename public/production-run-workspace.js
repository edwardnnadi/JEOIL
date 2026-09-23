// A run-focused workspace keeps production parameters, tests, and faults
// together while retaining the existing production register as the index.
(function () {
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const dateTime = value => value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
  const entry = value => Array.isArray(value) ? value.map(entry).join(' · ') : typeof value === 'object' && value ? `${value.quantity ?? value.qty ?? ''} ${value.unit ?? ''} ${value.name ?? value.item ?? ''}`.trim() : String(value ?? '—');
  const activeRun = () => (data.activeProductionRuns || []).find(run => run.status === 'IN_PROGRESS');
  const runs = () => [...(data.activeProductionRuns || []), ...(data.production || [])];
  const getRun = id => runs().find(run => String(run.id) === String(id));
  const isOpen = run => run?.status === 'IN_PROGRESS';
  let selectedRunId = null;
  let selectedTab = 'parameters';

  function dialog() {
    let element = document.querySelector('#production-run-dialog');
    if (element) return element;
    element = document.createElement('dialog');
    element.id = 'production-run-dialog';
    element.className = 'production-run-dialog';
    document.body.append(element);
    element.addEventListener('close', () => { selectedRunId = null; });
    return element;
  }

  function parameterPanel(run) {
    const materials = (run.materials || []).map(material => `<li>${esc(entry(material))}${material.warehouseName ? ` <span>${esc(material.warehouseName)}</span>` : ''}</li>`).join('') || `<li>${esc(entry(run.inputs))}</li>`;
    const outputs = (run.outputs || []).map(output => `<li>${esc(entry(output))}</li>`).join('') || `<li>${esc(entry(run.outputs || run.output ? run.outputs || `${run.output || ''} ${run.unit || ''} ${run.product || ''}` : 'Not recorded yet'))}</li>`;
    const machines = Array.isArray(run.machines) ? run.machines.join(' · ') : run.machine || '—';
    return `<div class="production-run-grid">
      <section><h3>Run details</h3><dl><div><dt>Batch</dt><dd>${esc(run.batch || run.reference || 'Production run')}</dd></div><div><dt>Status</dt><dd>${esc(run.status || 'Completed')}</dd></div><div><dt>Started</dt><dd>${esc(dateTime(run.startedAt || run.productionStart))}</dd></div><div><dt>Ended</dt><dd>${esc(dateTime(run.endedAt || run.productionEnd))}</dd></div><div><dt>Machines</dt><dd>${esc(machines)}</dd></div><div><dt>Manager</dt><dd>${esc(run.manager || run.supervisor || '—')}</dd></div><div><dt>Staff</dt><dd>${esc(Array.isArray(run.staff) ? run.staff.join(' · ') : run.staff || run.operator || '—')}</dd></div></dl></section>
      <section><h3>Materials issued</h3><ul class="production-run-list">${materials}</ul><h3>Outputs</h3><ul class="production-run-list">${outputs}</ul></section>
      <section><h3>Locations &amp; ratings</h3><dl><div><dt>Input warehouse</dt><dd>${esc(run.sourceWarehouseName || '—')}</dd></div><div><dt>Output warehouse</dt><dd>${esc(run.warehouseName || run.outputWarehouseName || '—')}</dd></div><div><dt>Actual capacity</dt><dd>${esc(run.actualRating?.capacity || '—')}</dd></div><div><dt>Actual input</dt><dd>${esc(run.actualRating?.input || '—')}</dd></div><div><dt>Actual output</dt><dd>${esc(run.actualRating?.output || '—')}</dd></div></dl></section>
    </div>`;
  }

  function resultPanel(run) {
    const materials = run.materials || [];
    const outputs = run.outputs || [];
    const totalInput = materials.reduce((total, material) => total + Number(material.quantity ?? material.qty ?? 0), 0) || Number(run.kernels || 0);
    const outputEntries = Array.isArray(outputs) ? outputs : [];
    const totalOutput = outputEntries.reduce((total, output) => total + Number(output.quantity ?? output.qty ?? 0), 0) || Number(run.oilOutput || 0) + Number(run.cake || 0) + Number(run.sludgeOutput || 0);
    const outputRows = outputEntries.length
      ? outputEntries.map(output => `<tr><td><strong>${esc(output.name || output.item || 'Output')}</strong></td><td>${esc(Number(output.quantity ?? output.qty ?? 0).toLocaleString())}</td><td>${esc(output.unit || '—')}</td><td>${esc(output.lotNumber || output.lotNo || '—')}</td></tr>`).join('')
      : [
        ['Oil', run.oilOutput], ['Cake', run.cake], ['Sludge', run.sludgeOutput],
      ].filter(([, quantity]) => Number(quantity) > 0).map(([name, quantity]) => `<tr><td><strong>${esc(name)}</strong></td><td>${esc(Number(quantity).toLocaleString())}</td><td>Mt</td><td>—</td></tr>`).join('') || `<tr><td colspan="4" class="muted">No production outputs have been recorded for this run.</td></tr>`;
    const actual = run.actualRating || {};
    const yieldPercent = totalInput > 0 && totalOutput > 0 ? (totalOutput / totalInput) * 100 : null;
    const resultState = isOpen(run) ? 'This run is still in progress. Results update when outputs are recorded.' : 'This completed run is an audit record and cannot be changed here.';
    return `<section class="production-results" aria-label="Production results">
      <div class="production-results-summary"><article><small>Status</small><strong>${esc(isOpen(run) ? 'In progress' : 'Completed')}</strong></article><article><small>Total input</small><strong>${esc(totalInput ? totalInput.toLocaleString() : '—')}</strong></article><article><small>Total output</small><strong>${esc(totalOutput ? totalOutput.toLocaleString() : '—')}</strong></article><article><small>Output yield</small><strong>${yieldPercent === null ? '—' : esc(`${yieldPercent.toFixed(1)}%`)}</strong></article></div>
      <p class="production-run-readonly">${esc(resultState)}</p>
      <h3>Recorded outputs</h3><div class="production-run-table"><table><thead><tr><th>Output</th><th>Quantity</th><th>Unit</th><th>Lot</th></tr></thead><tbody>${outputRows}</tbody></table></div>
      <div class="production-results-details"><div><small>Started</small><strong>${esc(dateTime(run.startedAt || run.productionStart))}</strong></div><div><small>Ended</small><strong>${esc(dateTime(run.endedAt || run.productionEnd))}</strong></div><div><small>Recorded output</small><strong>${esc(actual.output || '—')}</strong></div><div><small>Tests recorded</small><strong>${esc((run.testResults || []).length)}</strong></div></div>
    </section>`;
  }

  function testPanel(run) {
    const tests = run.testResults || [];
    const rows = tests.length ? tests.map(test => `<tr><td>${esc(test.testName)}</td><td><strong>${esc(test.decision || test.outcome || '—')}</strong></td><td>${esc(test.values ? Object.entries(test.values).map(([name, value]) => `${name}: ${value}`).join(' · ') : `${test.value || '—'} ${test.unit || ''}`)}</td><td>${esc(test.analyst || test.testedBy || '—')}</td><td>${esc(dateTime(test.recordedAt))}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">No tests have been recorded for this run.</td></tr>';
    const configured = (data.labTests || []).filter(test => test.active);
    const test = configured[0];
    const readingFields = test ? test.parameters.map((parameter, index) => `<div class="field"><label>${esc(parameter.name)}${parameter.unit ? ` (${esc(parameter.unit)})` : ''}<input name="labValue_${index}" required placeholder="${esc(parameter.limit || 'Enter result')}"></label></div>`).join('') : '';
    const action = !isOpen(run) ? '<p class="production-run-readonly">This run is complete. Its test history is read-only.</p>' : !test ? '<p class="production-run-empty">No active laboratory test is configured. An Administrator can add one in Administration → Laboratory tests.</p>' : `<form class="production-run-entry" data-run-entry="test"><h3>Record a production test</h3><p class="item-note">This uses the same test and peanut-quality parameters configured for the Laboratory page.</p><div class="form-grid"><div class="field"><label>Laboratory test<select name="labTest" class="production-test-select">${configured.map(option => `<option value="${esc(option.id)}">${esc(option.name)}</option>`).join('')}</select></label></div><div class="field"><label>Tested by<select name="testedBy" required>${peopleOptions()}</select></label></div><div class="field full"><label>Recorded readings</label><div class="form-grid production-test-readings">${readingFields}</div></div><div class="field"><label>Decision<select name="decision" required><option>Pass</option><option>Hold</option><option>Fail</option></select></label></div><div class="field full"><label>Observations<textarea name="notes" rows="2" placeholder="Optional observations or disposition"></textarea></label></div></div><button class="primary" type="submit">Save test result</button></form>`;
    return `<section class="production-run-table"><table><thead><tr><th>Test</th><th>Decision</th><th>Recorded readings</th><th>Tested by</th><th>Recorded</th></tr></thead><tbody>${rows}</tbody></table></section>${action}`;
  }

  function peopleOptions() { return `<option value="">Select person</option>${(data.people || []).filter(person => person.name).map(person => `<option value="${esc(person.name)}">${esc(person.name)}</option>`).join('')}`; }

  function faultPanel(run) {
    const faults = run.issues || [];
    const rows = faults.length ? faults.map(fault => `<article class="production-fault"><header><strong>${esc(fault.type)}</strong><span>${esc(dateTime(fault.recordedAt))}</span></header><p>${esc(fault.details)}</p><dl><div><dt>Reported by</dt><dd>${esc(fault.encounteredBy || fault.recordedBy || '—')}</dd></div><div><dt>Resolution</dt><dd>${esc(fault.resolution || 'Not recorded')}</dd></div></dl></article>`).join('') : '<p class="production-run-empty">No faults have been recorded for this run.</p>';
    const types = (data.productionConfig?.issueTypes || ['Belt cut', 'Generator did not start', 'Blocked machine']).map(type => `<option value="${esc(type)}">${esc(type)}</option>`).join('');
    const action = isOpen(run) ? `<form class="production-run-entry" data-run-entry="fault"><h3>Report a fault</h3><div class="form-grid"><div class="field"><label>Fault type<select name="issueType" required><option value="">Select fault type</option>${types}</select></label></div><div class="field"><label>Reported by<select name="encounteredBy" required>${peopleOptions()}</select></label></div><div class="field full"><label>What happened?<textarea name="issueDetails" rows="2" required></textarea></label></div><div class="field full"><label>Resolution<textarea name="resolution" rows="2" required placeholder="Describe the action taken"></textarea></label></div></div><button class="primary" type="submit">Save fault</button></form>` : '<p class="production-run-readonly">This run is complete. Its fault log is read-only.</p>';
    return `<section class="production-fault-list">${rows}</section>${action}`;
  }

  function draw() {
    const run = getRun(selectedRunId);
    const modal = dialog();
    if (!run) { modal.close(); return; }
    const content = selectedTab === 'results' ? resultPanel(run) : selectedTab === 'test' ? testPanel(run) : selectedTab === 'faults' ? faultPanel(run) : parameterPanel(run);
    modal.innerHTML = `<div class="production-run-head"><div><span>PRODUCTION RUN</span><h2>${esc(run.batch || run.reference || 'Production run')}</h2><p>${esc(isOpen(run) ? 'In progress' : 'Completed run record')}</p></div><button type="button" class="close" data-close-run aria-label="Close production run">×</button></div><div class="production-run-tabs" role="tablist" aria-label="Production run sections"><button type="button" role="tab" data-run-tab="results" aria-selected="${selectedTab === 'results'}">Results</button><button type="button" role="tab" data-run-tab="parameters" aria-selected="${selectedTab === 'parameters'}">Parameters</button><button type="button" role="tab" data-run-tab="test" aria-selected="${selectedTab === 'test'}">Test${(run.testResults || []).length ? ` (${run.testResults.length})` : ''}</button><button type="button" role="tab" data-run-tab="faults" aria-selected="${selectedTab === 'faults'}">Faults${(run.issues || []).length ? ` (${run.issues.length})` : ''}</button></div><div class="production-run-content" role="tabpanel">${content}</div>`;
  }

  function open(id, tab = 'parameters') { selectedRunId = id; selectedTab = tab; draw(); const modal = dialog(); if (!modal.open) modal.showModal(); }
  function repairActiveRunReference() {
    const run = activeRun();
    if (!run || run.batch !== 'PR-0NaN') return false;
    const used = new Set([...(data.activeProductionRuns || []), ...(data.production || [])].map(entry => entry.batch).filter(batch => batch && batch !== 'PR-0NaN'));
    let number = 1;
    let replacement = `PR-${String(number).padStart(4, '0')}`;
    while (used.has(replacement)) replacement = `PR-${String(++number).padStart(4, '0')}`;
    const startedAt = new Date(run.startedAt).getTime();
    run.batch = replacement;
    (data.stockMovements || []).filter(movement => movement.sourceId === 'PR-0NaN' && new Date(movement.at).getTime() >= startedAt)
      .forEach(movement => { movement.sourceId = replacement; });
    data.productionConfig ??= {};
    const config = data.productionConfig.batch;
    if (config && typeof config === 'object') config.nextNumber = Math.max(Number(config.nextNumber) || 1, number + 1);
    return true;
  }
  function decorate() {
    if (repairActiveRunReference()) void save();
    document.querySelectorAll('#production-table tr').forEach((row, index) => {
      const run = (data.production || [])[index];
      if (!run || row.querySelector('.production-register-view')) return;
      const batchCell = row.cells[1] || row.cells[0];
      const controlsCell = row.cells[5];
      batchCell?.insertAdjacentHTML('beforeend', `<div class="production-run-actions"><button class="text-btn open-production-run" type="button" data-run-id="${esc(run.id)}">Open run</button></div>`);
      controlsCell?.insertAdjacentHTML('beforeend', `<button class="text-btn production-register-view" type="button" data-run-id="${esc(run.id)}">View</button>`);
    });
    const active = activeRun();
    const banner = document.querySelector('#active-production-run');
    if (active && banner && !banner.querySelector('.production-register-view')) banner.querySelector('#end-production-run')?.insertAdjacentHTML('beforebegin', `<button class="secondary production-register-view" type="button" data-run-id="${esc(active.id)}">View</button><button class="secondary open-production-run" type="button" data-run-id="${esc(active.id)}">Open workspace</button>`);
  }

  document.addEventListener('click', event => {
    const openButton = event.target.closest('.open-production-run');
    if (openButton) { open(openButton.dataset.runId); return; }
    const viewButton = event.target.closest('.production-register-view');
    if (viewButton) { open(viewButton.dataset.runId, 'results'); return; }
    const resultsButton = event.target.closest('.view-production-results');
    if (resultsButton) { open(resultsButton.dataset.runId, 'results'); return; }
    const tab = event.target.closest('[data-run-tab]');
    if (tab) { selectedTab = tab.dataset.runTab; draw(); return; }
    if (event.target.closest('[data-close-run]')) dialog().close();
  });
  document.addEventListener('change', event => {
    const select = event.target.closest('.production-test-select');
    if (!select) return;
    const test = (data.labTests || []).find(entry => String(entry.id) === String(select.value));
    const readings = select.closest('form')?.querySelector('.production-test-readings');
    if (!test || !readings) return;
    readings.innerHTML = test.parameters.map((parameter, index) => `<div class="field"><label>${esc(parameter.name)}${parameter.unit ? ` (${esc(parameter.unit)})` : ''}<input name="labValue_${index}" required placeholder="${esc(parameter.limit || 'Enter result')}"></label></div>`).join('');
  });
  document.addEventListener('submit', event => {
    const form = event.target.closest('.production-run-entry');
    if (!form) return;
    event.preventDefault();
    const run = getRun(selectedRunId);
    if (!isOpen(run)) return;
    const values = Object.fromEntries(new FormData(form).entries());
    if (form.dataset.runEntry === 'test') {
      const test = (data.labTests || []).find(entry => String(entry.id) === String(values.labTest));
      if (!test) return alert('Select an active laboratory test.');
      const readings = {};
      test.parameters.forEach((parameter, index) => { readings[`${parameter.name}${parameter.unit ? ` (${parameter.unit})` : ''}`] = values[`labValue_${index}`]; });
      const recordedAt = new Date().toISOString();
      const result = { id: id(), date: recordedAt.slice(0, 10), testName: test.name, sampleType: test.sampleType, batchRef: run.batch, analyst: values.testedBy, decision: values.decision, notes: values.notes || '', values: readings, productionRunId: run.id, stage: 'IN_PRODUCTION', recordedAt };
      run.testResults ??= [];
      run.testResults.unshift(result);
      data.labResults ??= [];
      data.labResults.unshift(result);
    } else {
      run.issues ??= [];
      run.issues.unshift({ id: id(), type: values.issueType, details: values.issueDetails, encounteredBy: values.encounteredBy, resolution: values.resolution, recordedAt: new Date().toISOString(), recordedBy: currentOperator?.()?.name || 'Current user' });
    }
    void save(); render(); draw();
  });
  const previousRender = render;
  render = () => { previousRender(); decorate(); };
  render();
}());
