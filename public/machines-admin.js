// Equipment master data for production maintenance planning.
(() => {
  const root = document.querySelector('#admin-view');
  const grid = root?.querySelector('.admin-section-grid');
  const submenu = document.querySelector('#admin-submenu');
  const overview = document.querySelector('#admin-overview');
  if (!root || !grid || !submenu || !overview) return;

  const esc = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&gt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const today = () => new Date().toISOString().slice(0, 10);
  const machineTypes = ['Goyum Round Kettle Oil Expeller', 'Kurma 15-ton Oil Expeller', 'Oil filter press', 'Seed cleaner', 'Kernel roaster', 'Oil storage tank', 'Other'];

  const ensureMachines = () => {
    data.machines ??= [];
    const kurmaExpellers = [
      { name: 'Kurma Expeller 1', type: 'Kurma 15-ton Oil Expeller', manufacturer: 'Kurma' },
      { name: 'Kurma Expeller 2', type: 'Kurma 15-ton Oil Expeller', manufacturer: 'Kurma' },
    ];
    let added = false;
    kurmaExpellers.forEach((machine) => {
      if (data.machines.some((entry) => entry.name === machine.name)) return;
      data.machines.push({ id: id(), ...machine, model: '15-ton expeller', serialNumber: '', lastServiceDate: '', hoursSinceService: 0, serviceIntervalHours: 0, serviceIntervalDays: 0, notes: '' });
      added = true;
    });
    if (added) save();
  };
  const serviceState = (machine) => {
    const hours = Number(machine.hoursSinceService) || 0;
    const intervalHours = Number(machine.serviceIntervalHours) || 0;
    const intervalDays = Number(machine.serviceIntervalDays) || 0;
    const days = machine.lastServiceDate ? Math.floor((Date.now() - new Date(`${machine.lastServiceDate}T00:00:00`).getTime()) / 86400000) : null;
    const overdue = (intervalHours && hours >= intervalHours) || (intervalDays && days !== null && days >= intervalDays);
    if (overdue) return { label: 'Service due', tone: 'reject', detail: intervalHours && hours >= intervalHours ? `${hours.toLocaleString()} / ${intervalHours.toLocaleString()} h` : `${days} / ${intervalDays} days` };
    return { label: 'In service', tone: 'ok', detail: `${hours.toLocaleString()} h since service` };
  };

  submenu.insertAdjacentHTML('beforeend', '<button type="button" data-admin-section="machines">Machines</button>');
  overview.insertAdjacentHTML('beforeend', '<button type="button" class="admin-overview-card" data-admin-section="machines"><span>MACHINES</span><strong id="admin-machines-count">0</strong><small>Configure equipment, hour meters and maintenance intervals</small></button>');
  grid.insertAdjacentHTML('beforeend', '<section class="panel table-panel admin-section-panel" id="machines-panel"><div class="panel-head"><div><h3>Machines</h3><p>Production equipment and preventive-maintenance settings.</p></div><button class="primary" id="add-machine">+ Add machine</button></div><table><thead><tr><th>Machine</th><th>Type</th><th>Last service</th><th>Hour meter</th><th>Service status</th><th></th></tr></thead><tbody id="machines-table"></tbody></table></section>');

  const openMachineModal = (index) => {
    ensureMachines();
    const machine = index === undefined ? { type: 'Goyum Round Kettle Oil Expeller', manufacturer: 'Goyum', lastServiceDate: today(), hoursSinceService: 0, serviceIntervalHours: 500, serviceIntervalDays: 180 } : data.machines[index];
    document.querySelector('#modal-label').textContent = index === undefined ? 'NEW MACHINE' : 'EDIT MACHINE';
    document.querySelector('#modal-title').textContent = index === undefined ? 'Add production machine' : 'Configure machine';
    document.querySelector('#form-fields').innerHTML = `<div class="form-grid"><div class="field full"><label>Machine name</label><input name="name" value="${esc(machine.name)}" placeholder="e.g. Expeller 1" required></div><div class="field"><label>Machine type</label><select name="type">${machineTypes.map((type) => `<option ${type === machine.type ? 'selected' : ''}>${esc(type)}</option>`).join('')}</select></div><div class="field"><label>Manufacturer</label><input name="manufacturer" value="${esc(machine.manufacturer || 'Goyum')}" placeholder="e.g. Goyum" required></div><div class="field"><label>Model / configuration</label><input name="model" value="${esc(machine.model)}" placeholder="Model, capacity or setup"></div><div class="field"><label>Serial / asset number</label><input name="serialNumber" value="${esc(machine.serialNumber)}" placeholder="Serial or asset ID"></div><div class="field"><label>Date of last service</label><input name="lastServiceDate" type="date" value="${esc(machine.lastServiceDate)}"></div><div class="field"><label>Hours run since last service</label><input name="hoursSinceService" type="number" min="0" step="0.1" value="${machine.hoursSinceService ?? 0}" required></div><div class="field"><label>Service interval (run hours)</label><input name="serviceIntervalHours" type="number" min="0" step="1" value="${machine.serviceIntervalHours ?? ''}" placeholder="e.g. 500"></div><div class="field"><label>Service interval (days)</label><input name="serviceIntervalDays" type="number" min="0" step="1" value="${machine.serviceIntervalDays ?? ''}" placeholder="e.g. 180"></div><div class="field full"><label>Maintenance notes</label><textarea name="notes" rows="3" placeholder="Service scope, lubrication requirements or issues to monitor">${esc(machine.notes)}</textarea></div></div>`;
    const form = document.querySelector('#record-form');
    form.dataset.type = 'machine-admin';
    form.dataset.machineIndex = index === undefined ? '' : String(index);
    document.querySelector('#record-dialog').showModal();
  };

  const renderMachines = () => {
    ensureMachines();
    const table = document.querySelector('#machines-table');
    if (!table) return;
    table.innerHTML = data.machines.map((machine, index) => {
      const state = serviceState(machine);
      return `<tr><td><strong>${esc(machine.name)}</strong><div class="item-note">${esc(machine.manufacturer || '—')}${machine.model ? ` · ${esc(machine.model)}` : ''}${machine.serialNumber ? ` · ${esc(machine.serialNumber)}` : ''}</div></td><td>${esc(machine.type)}</td><td>${machine.lastServiceDate ? date(machine.lastServiceDate) : 'Not recorded'}</td><td>${(Number(machine.hoursSinceService) || 0).toLocaleString()} h<div class="item-note">Interval: ${machine.serviceIntervalHours || '—'} h / ${machine.serviceIntervalDays || '—'} days</div></td><td><span class="badge ${state.tone}">${state.label}</span><div class="item-note">${state.detail}</div></td><td><button class="text-btn edit-machine" data-machine-index="${index}">Configure</button></td></tr>`;
    }).join('') || '<tr><td colspan="6">No machines configured yet. Add a Goyum or Kurma expeller to begin maintenance tracking.</td></tr>';
    document.querySelector('#add-machine').onclick = () => openMachineModal();
    table.querySelectorAll('.edit-machine').forEach((button) => { button.onclick = () => openMachineModal(+button.dataset.machineIndex); });
    document.querySelector('#admin-machines-count').textContent = data.machines.length.toLocaleString();
  };

  document.querySelector('#record-form').addEventListener('submit', (event) => {
    const form = event.currentTarget;
    if (form.dataset.type !== 'machine-admin') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const values = formData(form);
    const machine = { id: form.dataset.machineIndex === '' ? id() : data.machines[+form.dataset.machineIndex].id, name: values.name.trim(), type: values.type, manufacturer: values.manufacturer.trim(), model: values.model.trim(), serialNumber: values.serialNumber.trim(), lastServiceDate: values.lastServiceDate, hoursSinceService: Number(values.hoursSinceService) || 0, serviceIntervalHours: Number(values.serviceIntervalHours) || 0, serviceIntervalDays: Number(values.serviceIntervalDays) || 0, notes: values.notes.trim() };
    if (form.dataset.machineIndex === '') data.machines.unshift(machine); else data.machines[+form.dataset.machineIndex] = machine;
    save();
    document.querySelector('#record-dialog').close();
    render();
  }, true);

  const machinesRender = render;
  render = () => { machinesRender(); renderMachines(); };
  renderMachines();
})();
