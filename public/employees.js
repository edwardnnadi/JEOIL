/*
 * Employees are operational master data, not application accounts.  Keeping
 * them in the existing people collection makes old records readable while the
 * explicit Employee type prevents this screen from ever provisioning Access.
 */
(function () {
  const esc = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const employeeRecords = () => (data.people || []).filter((person) => person.type === 'Employee' || person.type === 'Person');
  const employeeOptions = (selected = '', placeholder = 'Select an employee') => {
    const options = employeeRecords().map((person) => `<option value="${esc(person.id)}" ${String(person.id) === String(selected) ? 'selected' : ''}>${esc(person.name)}${person.jobTitle || person.role ? ` · ${esc(person.jobTitle || person.role)}` : ''}</option>`).join('');
    return `<option value="">${esc(placeholder)}</option>${options}`;
  };
  window.jeOilsEmployees = { records: employeeRecords, options: employeeOptions };

  function employeeModal() {
    $('#modal-label').textContent = 'NEW EMPLOYEE';
    $('#modal-title').textContent = 'Add employee';
    $('#form-fields').innerHTML = `<div class="form-grid"><div class="field full"><label>Full name</label><input name="name" required></div><div class="field"><label>Job title</label><input name="jobTitle" placeholder="e.g. Production operator" required></div><div class="field"><label>Department</label><input name="department" placeholder="e.g. Production"></div><div class="field"><label>Email</label><input name="email" type="email"></div><div class="field"><label>Phone</label><input name="phone"></div><div class="field full"><div class="item-note">Employees are available in operational records such as Goods Received and Production. Adding one does not create an application login or change any existing user permissions.</div></div></div>`;
    $('#record-form').dataset.type = 'employee';
    $('#record-dialog').showModal();
  }

  const addPersonButton = $('#add-person');
  if (!$('#add-employee')) {
    addPersonButton.insertAdjacentHTML('afterend', '<button class="secondary" id="add-employee" hidden>+ Add employee</button>');
  }
  const addEmployeeButton = $('#add-employee');
  addEmployeeButton.onclick = employeeModal;
  const syncEmployeeButton = () => {
    addEmployeeButton.hidden = $('#admin-view')?.dataset.adminSection !== 'people';
  };
  document.querySelectorAll('[data-admin-section], .nav-item:not(.admin-parent)').forEach((button) => {
    button.addEventListener('click', syncEmployeeButton);
  });
  $('#record-form').addEventListener('submit', (event) => {
    const form = event.currentTarget;
    if (form.dataset.type !== 'employee') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const values = formData(form);
    const name = values.name?.trim();
    if (!name) return;
    data.people ??= [];
    const duplicate = data.people.some((person) => person.name?.trim().toLowerCase() === name.toLowerCase() && person.type !== 'User');
    if (duplicate) return alert('An employee or operational person with this name already exists.');
    data.people.unshift({
      id: id(), name, type: 'Employee', jobTitle: values.jobTitle.trim(), department: values.department.trim(),
      email: values.email.trim(), phone: values.phone.trim(),
    });
    void save();
    $('#record-dialog').close();
    render();
  }, true);

  const renderBeforeEmployees = render;
  render = () => {
    renderBeforeEmployees();
    // Employees are managed only from Admin → Users & People. Do not expose
    // this operational master-data action in other Admin sections or views.
    syncEmployeeButton();
  };

  function replaceWithEmployeeSelect(form, name, selectedName) {
    const field = form.elements[name];
    if (!field) return;
    const selected = employeeRecords().find((person) => person.name === selectedName || String(person.id) === String(field.value));
    const select = document.createElement('select');
    select.name = name;
    select.required = field.required;
    select.innerHTML = employeeOptions(selected?.id, employeeRecords().length ? 'Select an employee' : 'Add an employee in Administration first');
    field.replaceWith(select);
  }

  const openModalBeforeEmployees = window.openModal;
  window.openModal = (type, pid) => {
    openModalBeforeEmployees(type, pid);
    if (type !== 'production') return;
    const form = $('#record-form');
    ['issuedBy', 'authorizedBy', 'receivedBy', 'supervisor', 'operator', 'productionSignOff'].forEach((name) => replaceWithEmployeeSelect(form, name));
  };
  render();
})();
