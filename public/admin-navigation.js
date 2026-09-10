(() => {
  const root = document.querySelector('#admin-view');
  const submenu = document.querySelector('#admin-submenu');
  const parent = document.querySelector('.admin-parent');
  if (!root || !submenu || !parent) return;

  const sectionDetails = {
    home: ['Administration', 'Manage the people and master data used throughout JE Oils Operations.'],
    people: ['Users & People', 'Maintain application users and operational contacts.'],
    roles: ['Roles', 'Maintain the roles that can be assigned to people and users.'],
    items: ['Purchase Items', 'Maintain the approved items that can be selected on purchases.'],
    catalogue: ['Categories & Units', 'Maintain the categories and default units used by purchase items.'],
    machines: ['Machines', 'Configure production equipment, service intervals and hour-meter readings.'],
    production: ['Production', 'Manage production batch numbering and view the machines available to factory managers.'],
    numbering: ['Purchase, lot & Goods Inwards numbers', 'Configure the automatically generated purchase, lot and Goods Inwards references.'],
    lab: ['Lab configuration', 'Configure the laboratory tests and result fields available to analysts.'],
    activity: ['User activity log', 'Immutable sign-in and operational activity history.'],
  };
  const visiblePanels = {
    home: [], people: ['people-panel'], roles: ['roles-panel'], items: ['items-panel'], catalogue: ['categories-panel', 'units-panel'], machines: ['machines-panel'], production: ['production-master-panel'], numbering: ['purchase-number-panel'], lab: ['lab-tests-panel'], activity: ['activity-log-panel'],
  };
  const storageKey = 'je-oils-admin-submenu-expanded';
  if (!root.querySelector('.admin-breadcrumbs')) root.querySelector('.view-head').insertAdjacentHTML('afterend', '<nav class="admin-breadcrumbs" aria-label="Administration breadcrumb"><button type="button" data-admin-section="home">Administration</button><span aria-hidden="true">/</span><span aria-current="page">Overview</span></nav>');
  if (!document.querySelector('#admin-breadcrumb-styles')) { const style=document.createElement('style'); style.id='admin-breadcrumb-styles'; style.textContent='.admin-breadcrumbs{display:flex;align-items:center;gap:7px;margin:-12px 0 18px;color:#708077;font-size:12px}.admin-breadcrumbs button{border:0;padding:0;background:transparent;color:#315c3a;font:600 12px inherit;cursor:pointer;text-decoration:underline;text-underline-offset:2px}.admin-breadcrumbs [aria-current]{color:#536257;font-weight:600}'; document.head.append(style); }
  const breadcrumbs = root.querySelector('.admin-breadcrumbs');
  const updateBreadcrumbs = (section) => {
    const current = section === 'home' ? 'Overview' : (sectionDetails[section]?.[0] || 'Administration');
    breadcrumbs.querySelector('[aria-current="page"]').textContent = current;
  };
  breadcrumbs.querySelector('button').onclick = () => setSection('home');

  if (!submenu.querySelector('[data-admin-section="production"]')) submenu.insertAdjacentHTML('beforeend', '<button type="button" data-admin-section="production">Production</button><button type="button" data-admin-section="numbering">Purchase, lot &amp; Goods Inwards numbers</button>');
  const overview = root.querySelector('#admin-overview');
  if (overview && !overview.querySelector('[data-admin-section="production"]')) overview.insertAdjacentHTML('beforeend', '<button type="button" class="admin-overview-card" data-admin-section="production"><span>PRODUCTION</span><strong>→</strong><small>Configure batch numbering and view machines</small></button><button type="button" class="admin-overview-card" data-admin-section="numbering"><span>PURCHASE, LOT &amp; GOODS INWARDS NUMBERS</span><strong>→</strong><small>Configure generated purchase, lot and Goods Inwards references</small></button>');
  if (overview && !overview.querySelector('[data-admin-section="lab"]')) overview.insertAdjacentHTML('beforeend', '<button type="button" class="admin-overview-card" data-admin-section="lab"><span>LAB CONFIGURATION</span><strong id="admin-lab-count">0</strong><small>Manage laboratory tests and result fields</small></button>');
  if (!submenu.querySelector('[data-admin-section="activity"]')) submenu.insertAdjacentHTML('beforeend', '<button type="button" data-admin-section="activity">User activity log</button>');
  if (overview && !overview.querySelector('[data-admin-section="activity"]')) overview.insertAdjacentHTML('beforeend', '<button type="button" class="admin-overview-card" data-admin-section="activity"><span>USER ACTIVITY LOG</span><strong>→</strong><small>Review sign-ins and operational changes</small></button>');

  const setExpanded = (expanded) => {
    submenu.hidden = !expanded;
    parent.setAttribute('aria-expanded', String(expanded));
    localStorage.setItem(storageKey, String(expanded));
  };

  const setSection = (section) => {
    if (section === 'warehouses') {
      root.dataset.adminSection = section;
      document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
      parent.classList.add('active');
      submenu.querySelectorAll('[data-admin-section]').forEach((button) => {
        button.classList.toggle('active', button.dataset.adminSection === section);
      });
      document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
      document.querySelector('#warehouse-view')?.classList.add('active');
      document.querySelector('#page-title').textContent = 'Warehouses';
      document.querySelector('#eyebrow').textContent = 'ADMINISTRATION';
      updateBreadcrumbs(section);
      setExpanded(true);
      return;
    }
    // Warehouses is rendered as a separate view. Returning to any other Admin
    // item must explicitly restore the Admin view before updating its panel.
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    parent.classList.add('active');
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
    root.classList.add('active');
    document.querySelector('#page-title').textContent = 'Administration';
    document.querySelector('#eyebrow').textContent = 'JE OILS OPERATIONS';
    const detail = sectionDetails[section] || sectionDetails.people;
    updateBreadcrumbs(section);
    root.dataset.adminSection = section;
    root.querySelector('#admin-section-title').textContent = detail[0];
    root.querySelector('#admin-section-description').textContent = detail[1];
    const isHome = section === 'home';
    // Users remains in the Administration context: retain the overview cards
    // above its table, while every other submenu item remains focused.
    root.querySelector('#admin-overview').hidden = !(isHome || section === 'people');
    root.querySelector('.admin-section-grid').hidden = isHome;
    // Admin panels are added by a few independent feature modules. Select the
    // grid's direct panels rather than relying on each module to remember a
    // presentation class, otherwise a selected section can expose every panel.
    root.querySelectorAll('.admin-section-grid > .panel').forEach((panel) => {
      panel.hidden = !(visiblePanels[section] || visiblePanels.people).includes(panel.id);
    });
    root.querySelector('#add-person').hidden = section !== 'people';
    root.querySelector('#add-item').hidden = section !== 'items';
    submenu.querySelectorAll('[data-admin-section]').forEach((button) => {
      button.classList.toggle('active', button.dataset.adminSection === section);
    });
    setExpanded(true);
  };

  const renderOverview = () => {
    adminData();
    data.warehouses ??= [];
    data.machines ??= [];
    root.querySelector('#admin-people-count').textContent = data.people.length.toLocaleString();
    root.querySelector('#admin-roles-count').textContent = data.roles.length.toLocaleString();
    root.querySelector('#admin-items-count').textContent = data.items.length.toLocaleString();
    root.querySelector('#admin-catalogue-count').textContent = `${data.categories.length} / ${data.units.length}`;
    root.querySelector('#admin-warehouses-count').textContent = data.warehouses.length.toLocaleString();
    const machinesCount = root.querySelector('#admin-machines-count');
    if (machinesCount) machinesCount.textContent = data.machines.length.toLocaleString();
    const labCount = root.querySelector('#admin-lab-count');
    if (labCount) labCount.textContent = (data.labTests || []).length.toLocaleString();
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
    renderOverview();
    if (root.classList.contains('active') || document.querySelector('#warehouse-view')?.classList.contains('active')) {
      setSection(root.dataset.adminSection || 'people');
    }
  };
  parent.addEventListener('click', () => {
    const alreadyOpen = !submenu.hidden;
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    parent.classList.add('active');
    document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
    root.classList.add('active');
    document.querySelector('#page-title').textContent = 'Administration';
    document.querySelector('#eyebrow').textContent = 'JE OILS OPERATIONS';
    setSection('home');
    setExpanded(!alreadyOpen);
  });
  submenu.querySelectorAll('[data-admin-section]').forEach((button) => button.addEventListener('click', () => setSection(button.dataset.adminSection)));
  root.querySelectorAll('#admin-overview [data-admin-section]').forEach((button) => button.addEventListener('click', () => setSection(button.dataset.adminSection)));
  document.querySelectorAll('.nav-item:not(.admin-parent)').forEach((button) => button.addEventListener('click', () => setExpanded(false)));
  setExpanded(false);
  render();
})();
