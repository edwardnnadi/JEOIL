// New records must never silently inherit the first option in a user-editable
// dropdown. Existing records retain their saved selections and workflow-owned
// statuses remain system-managed.
(() => {
  const dialog = document.querySelector('#record-dialog');
  const form = document.querySelector('#record-form');
  if (!dialog || !form || dialog.dataset.dropdownDefaultsReady) return;
  dialog.dataset.dropdownDefaultsReady = 'true';

  const systemOwned = new Set(['status', 'decision', 'purchaseQcStatus']);
  const isExistingRecord = () => Boolean(
    form.dataset.editId ||
    form.dataset.receiptId ||
    form.dataset.machineId ||
    form.dataset.warehouseId ||
    form.dataset.conversionIndex ||
    /(?:^|-)edit(?:$|-)/.test(form.dataset.type || ''),
  );
  const labelFor = (select) => select.closest('.field')?.querySelector('label')?.textContent?.trim().replace(/\s+/g, ' ') || 'an option';

  const clearNewRecordDefaults = () => {
    if (isExistingRecord()) return;
    form.querySelectorAll('select').forEach((select) => {
      if (select.multiple || select.disabled || select.dataset.keepDefault === 'true' || systemOwned.has(select.name)) return;
      if (!select.options.length || select.options[0].value === '') return;
      const option = document.createElement('option');
      option.value = '';
      option.textContent = `Select ${labelFor(select)}`;
      option.selected = true;
      select.prepend(option);
    });
  };

  const nativeShowModal = dialog.showModal.bind(dialog);
  dialog.showModal = () => {
    clearNewRecordDefaults();
    nativeShowModal();
  };
})();
