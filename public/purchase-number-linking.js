// A supplier can have several purchase lines under one open purchase number.
// Once goods have arrived, moved to warehouse, or been rejected, the number is
// no longer offered for new lines.
(() => {
  const openStages = new Set(['Quote', 'Ordered', 'QC inspection', 'QC accepted', 'QC hold / retest', 'In transit']);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const openPurchaseNumbers = (supplier) => {
    const seen = new Set();
    return data.purchases.filter((purchase) => purchase.supplier === supplier && purchase.purchaseId && openStages.has(purchase.status || 'Quote') && !seen.has(purchase.purchaseId) && seen.add(purchase.purchaseId));
  };
  const installPurchaseNumberChoice = (form) => {
    const numberField = [...form.querySelectorAll('.field')].find((field) => field.querySelector('label')?.textContent.trim() === 'Purchase ID');
    if (!numberField || form.elements.purchaseNumberChoice) return;
      numberField.innerHTML = '<label>Purchase number</label><select name="purchaseNumberChoice" data-keep-default="true"></select><div class="item-note">Use the next generated number, or add this item to an undelivered purchase for the selected supplier.</div>';
    const selector = form.elements.purchaseNumberChoice;
    const syncLotNumber = () => {
      const purchaseId = selector.value === '__auto__' ? purchaseReference() : selector.value;
      const lotNo = form.elements.namedItem('lotNo');
      if (lotNo) lotNo.value = lotReference(purchaseId);
    };
    const refresh = () => {
      const previous = selector.value || '__auto__';
      const supplier = form.elements.supplier?.value.trim() || '';
      const open = openPurchaseNumbers(supplier);
      selector.innerHTML = `<option value="__auto__">Use next generated number (${escapeHtml(purchaseReference())})</option>${open.map((purchase) => `<option value="${escapeHtml(purchase.purchaseId)}">Add to ${escapeHtml(purchase.purchaseId)} · ${escapeHtml(purchase.status || 'Quote')}</option>`).join('')}`;
      selector.value = [...selector.options].some((option) => option.value === previous) ? previous : '__auto__';
      syncLotNumber();
    };
    form.elements.supplier?.addEventListener('input', refresh);
    form.elements.supplier?.addEventListener('change', refresh);
    selector.addEventListener('change', syncLotNumber);
    refresh();
  };
  const previousOpenModal = openModal;
  openModal = (type, purchaseId) => {
    previousOpenModal(type, purchaseId);
    if (type === 'purchase') installPurchaseNumberChoice(document.querySelector('#record-form'));
  };
})();
