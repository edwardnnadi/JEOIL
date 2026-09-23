// Read-only record inspection for operational registers. This is deliberately
// separate from edit forms so viewing a record never changes it or bypasses
// role-based edit controls.
(() => {
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const title = key => String(key).replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^./, char => char.toUpperCase());
  const ignored = new Set(['id', 'deleted', 'components', 'values', 'testResults', 'issues', 'materials', 'outputs', 'machineRatings', 'sourceWarehouses', 'stageHistory']);
  const format = value => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.length ? value.map(format).join(' · ') : '—';
    if (typeof value === 'object') return Object.entries(value).filter(([, entry]) => entry !== '' && entry !== null && entry !== undefined).map(([key, entry]) => `${title(key)}: ${format(entry)}`).join(' · ') || '—';
    return String(value);
  };
  const detailRows = record => Object.entries(record).filter(([key, value]) => !ignored.has(key) && value !== '' && value !== null && value !== undefined && !(Array.isArray(value) && !value.length)).map(([key, value]) => `<div><dt>${esc(title(key))}</dt><dd>${esc(format(value))}</dd></div>`).join('');
  const table = (heading, rows) => rows?.length ? `<section class="record-view-section"><h3>${esc(heading)}</h3><div class="record-view-table"><table><tbody>${rows.map(([label, value]) => `<tr><th>${esc(label)}</th><td>${esc(format(value))}</td></tr>`).join('')}</tbody></table></div></section>` : '';

  function dialog() {
    let element = document.querySelector('#record-view-dialog');
    if (element) return element;
    element = document.createElement('dialog');
    element.id = 'record-view-dialog';
    element.className = 'record-view-dialog';
    document.body.append(element);
    return element;
  }

  function relatedSections(kind, record) {
    if (kind === 'purchase') return table('Progress history', (record.stageHistory || []).map(event => [`${event.from || 'Created'} → ${event.to || 'Updated'}`, `${event.changedAt || '—'} · ${event.changedBy || '—'}${event.reason ? ` · ${event.reason}` : ''}`]));
    if (kind === 'goods') return table('Inspection readings', Object.entries(record.receivingReadings || record.readings || {}).map(([name, value]) => [name, value]));
    if (kind === 'lab') return `${table('Recorded readings', Object.entries(record.values || {}).map(([name, value]) => [name, value]))}${table('Observations', record.notes ? [['Notes', record.notes]] : [])}`;
    if (kind === 'service') return `${table('Components inspected', Object.entries(record.components || {}).map(([name, component]) => [title(name), component]))}${table('Service notes', record.notes ? [['Notes', record.notes]] : [])}`;
    if (kind === 'production') return `${table('Materials issued', (record.materials || []).map(material => [material.name || material.item || 'Material', `${format(material.quantity ?? material.qty)} ${material.unit || ''} · ${material.warehouseName || 'Warehouse not recorded'}`]))}${table('Outputs', (record.outputs || []).map(output => [output.name || output.item || 'Output', `${format(output.quantity ?? output.qty)} ${output.unit || ''} · Lot: ${output.lotNumber || output.lotNo || '—'}`]))}${table('Recorded tests', (record.testResults || []).map(test => [test.testName || 'Test', `${test.decision || test.outcome || '—'} · ${test.analyst || test.testedBy || '—'} · ${format(test.values || test.value)}`]))}${table('Fault log', (record.issues || []).map(issue => [issue.type || 'Issue', `${issue.details || '—'} · Resolution: ${issue.resolution || 'Not recorded'}`]))}`;
    return '';
  }

  function open(kind, record) {
    if (!record) return;
    const labels = { purchase: 'Purchase', goods: 'Goods inwards record', lab: 'Laboratory result', service: 'Machine service record', production: 'Production run' };
    const heading = kind === 'purchase' ? record.purchaseId || record.item : kind === 'goods' ? record.goodsInwardsId || record.item : kind === 'lab' ? record.batchRef || record.testName : kind === 'production' ? record.batch || record.reference : record.machineName || record.serviceType;
    const modal = dialog();
    modal.innerHTML = `<div class="record-view-head"><div><span>${esc(labels[kind])}</span><h2>${esc(heading || labels[kind])}</h2><p>Read-only record details</p></div><button type="button" class="close" data-close-record-view aria-label="Close record details">×</button></div><div class="record-view-content"><dl class="record-view-grid">${detailRows(record) || '<div><dt>Record</dt><dd>No additional details recorded.</dd></div>'}</dl>${relatedSections(kind, record)}</div>`;
    if (!modal.open) modal.showModal();
  }

  const visiblePurchases = () => typeof window.purchaseLifecycleRows === 'function' ? window.purchaseLifecycleRows() : data.purchases || [];
  const visibleReceipts = () => [...(data.goodsInwards || [])].filter(record => !record.deleted).sort((left, right) => String(right.receivedDate).localeCompare(String(left.receivedDate)));
  const visibleLabResults = () => [...(data.labResults || [])].filter(record => record.stage !== 'GOODS_INWARDS' || (data.goodsInwards || []).some(receipt => String(receipt.id) === String(record.goodsInwardsRecordId) && !receipt.deleted)).sort((left, right) => String(right.date).localeCompare(String(left.date)));
  const visibleServices = () => [...(data.machineServiceRecords || [])].sort((left, right) => String(right.serviceDate).localeCompare(String(left.serviceDate)));

  function addAction(row, kind, record) {
    if (!row || !record || row.querySelector('.view-record')) return;
    const actionCell = row.querySelector('td:last-child');
    if (!actionCell) return;
    actionCell.insertAdjacentHTML('afterbegin', `<button type="button" class="text-btn view-record" data-record-kind="${kind}" data-record-id="${esc(record.id)}">View</button> `);
  }

  function decorate() {
    document.querySelectorAll('#purchases-table tr').forEach((row, index) => addAction(row, 'purchase', visiblePurchases()[index]));
    document.querySelectorAll('#quality-table tr').forEach((row, index) => addAction(row, 'goods', visibleReceipts()[index]));
    document.querySelectorAll('#lab-results-table tr').forEach((row, index) => addAction(row, 'lab', visibleLabResults()[index]));
    document.querySelectorAll('#machine-services-table tr').forEach((row, index) => addAction(row, 'service', visibleServices()[index]));
    document.querySelectorAll('#production-table tr').forEach((row, index) => {
      const record = (data.production || [])[index];
      const batchCell = row.cells[1];
      if (!record || !batchCell || batchCell.querySelector('.view-record')) return;
      batchCell.insertAdjacentHTML('beforeend', `<div class="production-run-actions"><button type="button" class="text-btn view-record" data-record-kind="production" data-record-id="${esc(record.id)}">View details</button></div>`);
    });
    const activeRun = (data.activeProductionRuns || []).find(record => record.status === 'IN_PROGRESS');
    const activeBanner = document.querySelector('#active-production-run');
    if (activeRun && activeBanner && !activeBanner.querySelector('.view-record')) {
      activeBanner.querySelector('#end-production-run')?.insertAdjacentHTML('beforebegin', `<button type="button" class="secondary view-record" data-record-kind="production" data-record-id="${esc(activeRun.id)}">View details</button>`);
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.view-record');
    if (button) {
      const lists = { purchase: data.purchases || [], goods: data.goodsInwards || [], lab: data.labResults || [], service: data.machineServiceRecords || [], production: [...(data.activeProductionRuns || []), ...(data.production || [])] };
      open(button.dataset.recordKind, lists[button.dataset.recordKind]?.find(record => String(record.id) === String(button.dataset.recordId)));
      return;
    }
    if (event.target.closest('[data-close-record-view]')) dialog().close();
  });

  const previousRender = render;
  render = () => { previousRender(); decorate(); };
  const style = document.createElement('style');
  style.textContent = '.record-view-dialog{width:min(100% - 32px,880px);max-height:min(860px,calc(100vh - 32px));padding:0;border:0;border-radius:10px;background:var(--panel,#fff);color:var(--ink,#172018)}.record-view-dialog::backdrop{background:rgba(18,28,20,.48)}.record-view-head{display:flex;justify-content:space-between;gap:16px;padding:20px 24px 14px;border-bottom:1px solid var(--line)}.record-view-head span{font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--muted)}.record-view-head h2{margin:3px 0;font:700 25px "Playfair Display",serif}.record-view-head p{margin:0;color:var(--muted)}.record-view-content{padding:22px 24px 26px;overflow:auto}.record-view-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;margin:0}.record-view-grid>div{padding:9px 0;border-bottom:1px solid var(--line)}.record-view-grid dt{font-size:12px;color:var(--muted)}.record-view-grid dd{margin:3px 0 0;overflow-wrap:anywhere}.record-view-section{margin-top:24px}.record-view-section h3{margin:0 0 10px;font:700 17px "Playfair Display",serif}.record-view-table{overflow-x:auto}.record-view-table table{min-width:500px;width:100%;border-collapse:collapse}.record-view-table th,.record-view-table td{padding:10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.record-view-table th{width:34%;color:var(--muted);font-weight:600}@media(max-width:700px){.record-view-dialog{width:100%;max-height:100vh;border-radius:0}.record-view-head,.record-view-content{padding-left:16px;padding-right:16px}.record-view-grid{grid-template-columns:1fr}}';
  document.head.append(style);
  decorate();
})();
