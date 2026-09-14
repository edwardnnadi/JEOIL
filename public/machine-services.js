// Controlled maintenance records for production equipment.
(() => {
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const today = () => new Date().toISOString().slice(0, 10);
  const components = [
    ['worm', 'Worm / screw service details'],
    ['belts', 'Belts'],
    ['pots', 'Pots'],
    ['bearings', 'Bearings'],
    ['lubrication', 'Lubrication'],
    ['other', 'Other'],
  ];
  const ensureData = () => {
    data.machines ??= [];
    data.machineServiceRecords ??= [];
  };
  const machineOptions = selected => (data.machines || []).map(machine => `<option value="${esc(machine.id)}" ${String(machine.id) === String(selected) ? 'selected' : ''}>${esc(machine.name)}${machine.type ? ` · ${esc(machine.type)}` : ''}</option>`).join('');
  const personOptions = selected => `<option value="">Select technician</option>${(data.people || []).filter(person => person.name).map(person => `<option ${person.name === selected ? 'selected' : ''}>${esc(person.name)}</option>`).join('')}`;
  const componentFields = record => components.map(([key, label]) => {
    const detail = record.components?.[key] || {};
    return `<div class="field full machine-service-component"><label>${label}</label><div class="form-grid"><div class="field"><label>Condition</label><select name="${key}Condition"><option ${detail.condition === 'Good' ? 'selected' : ''}>Good</option><option ${detail.condition === 'Serviced' ? 'selected' : ''}>Serviced</option><option ${detail.condition === 'Replaced' ? 'selected' : ''}>Replaced</option><option ${detail.condition === 'Repair required' ? 'selected' : ''}>Repair required</option><option ${!detail.condition ? 'selected' : ''}>Not inspected</option></select></div><div class="field"><label>Action / parts replaced</label><input name="${key}Action" value="${esc(detail.action)}" placeholder="Work completed or parts used"></div><div class="field full"><label>Service notes</label><textarea name="${key}Notes" rows="2" placeholder="Observations, measurements or follow-up">${esc(detail.notes)}</textarea></div></div></div>`;
  }).join('');
  const openServiceForm = record => {
    ensureData();
    if (!data.machines.length) return alert('Add a machine in Administration → Machines before recording a service.');
    const service = record || { serviceDate: today(), serviceType: 'Scheduled service', status: 'Completed', components: {} };
    $('#modal-label').textContent = record ? 'EDIT MACHINE SERVICE' : 'MACHINE SERVICE';
    $('#modal-title').textContent = record ? 'Update service record' : 'Add service details';
    $('#form-fields').innerHTML = `<div class="form-grid"><div class="field"><label>Machine</label><select name="machineId" required><option value="">Select machine</option>${machineOptions(service.machineId)}</select></div><div class="field"><label>Service date</label><input name="serviceDate" type="date" value="${esc(service.serviceDate)}" required></div><div class="field"><label>Service type</label><select name="serviceType"><option ${service.serviceType === 'Scheduled service' ? 'selected' : ''}>Scheduled service</option><option ${service.serviceType === 'Breakdown repair' ? 'selected' : ''}>Breakdown repair</option><option ${service.serviceType === 'Inspection' ? 'selected' : ''}>Inspection</option></select></div><div class="field"><label>Service status</label><select name="status"><option ${service.status === 'Completed' ? 'selected' : ''}>Completed</option><option ${service.status === 'Open' ? 'selected' : ''}>Open</option><option ${service.status === 'Deferred' ? 'selected' : ''}>Deferred</option></select></div><div class="field"><label>Technician / serviced by</label><select name="technician" required>${personOptions(service.technician)}</select></div><div class="field"><label>Machine hour meter</label><input name="hourMeter" type="number" min="0" step="0.1" value="${esc(service.hourMeter)}" placeholder="Hours at service"></div><div class="field"><label>Downtime (hours)</label><input name="downtimeHours" type="number" min="0" step="0.1" value="${esc(service.downtimeHours)}" placeholder="0"></div><div class="field"><label>Next service due</label><input name="nextDueDate" type="date" value="${esc(service.nextDueDate)}"></div>${componentFields(service)}<div class="field full"><label>Overall service notes</label><textarea name="notes" rows="3" placeholder="Summary, outstanding work or safety observations">${esc(service.notes)}</textarea></div></div>`;
    const form = $('#record-form');
    form.dataset.type = 'machine-service';
    form.dataset.serviceId = service.id || '';
    $('#save-record').textContent = record ? 'Save changes' : 'Save service record';
    $('#record-dialog').showModal();
  };
  const serviceSummary = record => components.filter(([key]) => {
    const condition = record.components?.[key]?.condition;
    return condition && condition !== 'Not inspected';
  }).map(([, label]) => label.replace(' / screw service details', '')).join(' · ') || 'No components recorded';
  const renderServices = () => {
    ensureData();
    const table = $('#machine-services-table');
    if (!table) return;
    table.innerHTML = [...data.machineServiceRecords].sort((left, right) => String(right.serviceDate).localeCompare(String(left.serviceDate))).map(record => {
      const machine = data.machines.find(entry => String(entry.id) === String(record.machineId));
      const tone = record.status === 'Completed' ? 'ok' : record.status === 'Deferred' ? 'hold' : 'pending';
      return `<tr><td>${date(record.serviceDate)}</td><td><strong>${esc(machine?.name || record.machineName || 'Machine removed')}</strong><div class="item-note">${esc(machine?.type || '')}</div></td><td>${esc(record.serviceType)}</td><td>${esc(serviceSummary(record))}</td><td>${esc(record.technician || '—')}</td><td>${record.nextDueDate ? date(record.nextDueDate) : 'Not set'}</td><td><span class="badge ${tone}">${esc(record.status)}</span></td><td><button class="text-btn edit-machine-service" data-service-id="${esc(record.id)}">Edit</button></td></tr>`;
    }).join('') || '<tr><td colspan="8">No machine service records yet. Add a service record to start maintenance traceability.</td></tr>';
    $('#add-machine-service').onclick = () => openServiceForm();
    table.querySelectorAll('.edit-machine-service').forEach(button => { button.onclick = () => openServiceForm(data.machineServiceRecords.find(record => String(record.id) === button.dataset.serviceId)); });
  };
  $('#record-form').addEventListener('submit', event => {
    const form = event.currentTarget;
    if (form.dataset.type !== 'machine-service') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const values = formData(form), machine = data.machines.find(entry => String(entry.id) === String(values.machineId));
    if (!machine) return alert('Select a machine.');
    const record = { id: form.dataset.serviceId || id(), machineId: machine.id, machineName: machine.name, serviceDate: values.serviceDate, serviceType: values.serviceType, status: values.status, technician: values.technician, hourMeter: Number(values.hourMeter) || 0, downtimeHours: Number(values.downtimeHours) || 0, nextDueDate: values.nextDueDate, notes: values.notes.trim(), components: Object.fromEntries(components.map(([key]) => [key, { condition: values[`${key}Condition`], action: values[`${key}Action`].trim(), notes: values[`${key}Notes`].trim() }])), recordedAt: new Date().toISOString() };
    const existing = data.machineServiceRecords.findIndex(entry => String(entry.id) === String(record.id));
    if (existing < 0) data.machineServiceRecords.unshift(record); else data.machineServiceRecords[existing] = record;
    if (record.status === 'Completed') { machine.lastServiceDate = record.serviceDate; machine.hoursSinceService = 0; }
    save(); render(); $('#record-dialog').close();
  }, true);
  const serviceRender = render;
  render = () => { serviceRender(); renderServices(); };
  const style = document.createElement('style');
  style.textContent = '.production-subpage{margin-left:18px;font-size:12px;padding-top:8px;padding-bottom:8px}.machine-service-component{padding:12px;border:1px solid var(--line);border-radius:7px;background:#fafbf8}.machine-service-component>label{color:var(--green);font-size:12px}';
  document.head.append(style);
  renderServices();
})();
