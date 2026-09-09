(() => {
  const root = document.querySelector('#admin-view');
  const submenu = document.querySelector('#admin-submenu');
  const parent = document.querySelector('.admin-parent');
  if (!root || !submenu || !parent) return;

  const sectionDetails = {
    people: ['Users & People', 'Maintain application users and operational contacts.'],
    roles: ['Roles', 'Maintain the roles that can be assigned to people and users.'],
    items: ['Purchase Items', 'Maintain the approved items that can be selected on purchases.'],
    catalogue: ['Categories & Units', 'Maintain the categories and default units used by purchase items.'],
  };
  const visiblePanels = {
    people: ['people-panel'], roles: ['roles-panel'], items: ['items-panel'], catalogue: ['categories-panel', 'units-panel'],
  };
  const storageKey = 'je-oils-admin-submenu-expanded';

  const setExpanded = (expanded) => {
    const shouldShow = expanded && parent.classList.contains('active');
    submenu.hidden = !shouldShow;
    parent.setAttribute('aria-expanded', String(shouldShow));
    localStorage.setItem(storageKey, String(expanded));
  };

  const setSection = (section) => {
    if (section === 'warehouses') {
      root.dataset.adminSection = section;
      document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
      parent.classList.add('active');
      document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
      document.querySelector('#warehouse-view')?.classList.add('active');
      document.querySelector('#page-title').textContent = 'Warehouses';
      document.querySelector('#eyebrow').textContent = 'ADMINISTRATION';
      setExpanded(true);
      return;
    }
    const detail = sectionDetails[section] || sectionDetails.people;
    root.dataset.adminSection = section;
    root.querySelector('#admin-section-title').textContent = detail[0];
    root.querySelector('#admin-section-description').textContent = detail[1];
    root.querySelectorAll('.admin-section-panel').forEach((panel) => {
      panel.hidden = !(visiblePanels[section] || visiblePanels.people).includes(panel.id);
    });
    root.querySelector('#add-person').hidden = section !== 'people';
    root.querySelector('#add-item').hidden = section !== 'items';
    submenu.querySelectorAll('[data-admin-section]').forEach((button) => {
      button.classList.toggle('active', button.dataset.adminSection === section);
    });
    setExpanded(true);
  };

  const addUnitsPanel = () => {
    if (document.querySelector('#units-panel')) return;
    const grid = root.querySelector('.admin-section-grid');
    grid.insertAdjacentHTML('beforeend', '<section class="panel table-panel admin-section-panel" id="units-panel"><div class="panel-head"><div><h3>Default units</h3><p>Units available for purchase items and stock records.</p></div><button class="secondary" id="add-unit">+ Add unit</button></div><table><thead><tr><th>Unit</th><th></th></tr></thead><tbody id="units-table"></tbody></table></section>');
  };
  const renderUnits = () => {
    addUnitsPanel();
    adminData();
    const table = document.querySelector('#units-table');
    table.innerHTML = data.units.map((unit, index) => `<tr><td><strong>${unit}</strong></td><td><button class="text-btn edit-unit" data-unit-index="${index}">Edit</button></td></tr>`).join('') || '<tr><td>No units yet.</td><td></td></tr>';
    document.querySelector('#add-unit').onclick = () => openUnitModal();
    document.querySelectorAll('.edit-unit').forEach((button) => button.onclick = () => openUnitModal(+button.dataset.unitIndex));
  };
  const openUnitModal = (index) => {
    const unit = index === undefined ? '' : data.units[index];
    const escapedUnit = String(unit || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    document.querySelector('#modal-label').textContent = unit ? 'EDIT UNIT' : 'NEW UNIT';
    document.querySelector('#modal-title').textContent = unit ? 'Edit default unit' : 'Add default unit';
    document.querySelector('#form-fields').innerHTML = `<div class="form-grid"><div class="field full"><label>Unit name</label><input name="unit" value="${escapedUnit}" placeholder="e.g. kg, litre, bag" required></div></div>`;
    const form = document.querySelector('#record-form');
    form.dataset.type = 'unit-admin';
    form.dataset.unitIndex = index === undefined ? '' : String(index);
    document.querySelector('#record-dialog').showModal();
  };
  document.querySelector('#record-form').addEventListener('submit', (event) => {
    const form = event.currentTarget;
    if (form.dataset.type !== 'unit-admin') return;
    event.stopImmediatePropagation();
    event.preventDefault();
    const unit = formData(form).unit.trim();
    const index = form.dataset.unitIndex;
    adminData();
    if (!unit) return;
    if (index === '') {
      if (!data.units.some((value) => value.toLowerCase() === unit.toLowerCase())) data.units.push(unit);
    } else {
      const oldUnit = data.units[+index];
      if (!data.units.some((value, valueIndex) => valueIndex !== +index && value.toLowerCase() === unit.toLowerCase())) {
        data.units[+index] = unit;
        data.items.forEach((item) => { if (item.unit === oldUnit) item.unit = unit; });
      }
    }
    save();
    document.querySelector('#record-dialog').close();
    render();
  }, true);

  const priorRender = render;
  render = () => {
    priorRender();
    renderUnits();
    if (root.classList.contains('active') || document.querySelector('#warehouse-view')?.classList.contains('active')) {
      setSection(root.dataset.adminSection || 'people');
    }
  };
  parent.addEventListener('click', () => {
    const alreadyOpen = !submenu.hidden;
    setSection(root.dataset.adminSection || 'people');
    if (document.querySelector('#admin-view').classList.contains('active') && alreadyOpen) setExpanded(false);
  });
  submenu.querySelectorAll('[data-admin-section]').forEach((button) => button.addEventListener('click', () => setSection(button.dataset.adminSection)));
  document.querySelectorAll('.nav-item:not(.admin-parent)').forEach((button) => button.addEventListener('click', () => setExpanded(false)));
  setExpanded(localStorage.getItem(storageKey) === 'true');
  render();
})();
