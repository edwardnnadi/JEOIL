// Final purchase form enhancements: category-aware catalogue and JE Oils quote PDFs.
(() => {
  const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const formatMoney = value => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(Number(value) || 0);

  function syncItemsForCategory(form, preferred = '') {
    const category = form.elements.namedItem('category');
    const item = form.elements.namedItem('item');
    if (!category || !item) return;
    const choices = (data.items || []).filter(entry => entry.category === category.value);
    item.innerHTML = choices.length
      ? choices.map(entry => `<option value="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</option>`).join('')
      : '<option value="">No items configured for this category</option>';
    item.disabled = !choices.length;
    item.value = choices.some(entry => entry.name === preferred) ? preferred : (choices[0]?.name || '');
    const selected = choices.find(entry => entry.name === item.value);
    if (selected && form.elements.itemDescription) form.elements.itemDescription.value = selected.description || '';
  }

  function bindCategoryItems(form) {
    const category = form.elements.namedItem('category');
    const item = form.elements.namedItem('item');
    if (!category || !item || form.dataset.categoryItemsBound === 'true') return;
    form.dataset.categoryItemsBound = 'true';
    const initial = item.value;
    syncItemsForCategory(form, initial);
    category.addEventListener('change', () => syncItemsForCategory(form));
    item.addEventListener('change', () => {
      const selected = (data.items || []).find(entry => entry.name === item.value);
      if (selected && form.elements.itemDescription) form.elements.itemDescription.value = selected.description || '';
    });
  }

  function applyLoggedInCreator(form, existingPurchase) {
    const field = [...form.querySelectorAll('.field')].find(entry => entry.querySelector('label')?.textContent.trim() === 'Created by');
    if (!field) return;
    const operator = currentOperator?.() || data.people?.find(person => person.type === 'User');
    const name = existingPurchase?.createdBy || operator?.name || 'Current user';
    field.innerHTML = `<label>Created by</label><input name="createdBy" value="${escapeHtml(name)}" readonly>`;
  }

  const enhancedOpen = openModal;
  openModal = (type, purchaseId) => {
    enhancedOpen(type, purchaseId);
    if (type !== 'purchase') return;
    const form = document.querySelector('#record-form');
    if (!form) return;
    applyLoggedInCreator(form);
    bindCategoryItems(form);
  };

  const enhancedEdit = editModal;
  editModal = (kind, record) => {
    enhancedEdit(kind, record);
    if (kind !== 'purchase') return;
    const form = document.querySelector('#record-form');
    if (!form) return;
    applyLoggedInCreator(form, record);
    bindCategoryItems(form);
  };

  // A small self-contained PDF generator keeps quote download available offline
  // and avoids a large dependency in this local-first application.
  function pdfText(value) { return String(value ?? '').replace(/[^\x20-\x7e]/g, '?').replace(/([\\()])/g, '\\$1'); }
  function quotePdf(purchase) {
    const line = (text, x, y, size = 10, bold = false) => `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${pdfText(text)}) Tj ET`;
    const reference = purchase.purchaseId || `QUOTE-${purchase.id}`;
    const today = new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
    const content = [
      '0.15 0.19 0.13 rg 0 742 595 100 re f',
      '0.77 0.61 0.24 rg 0 738 595 4 re f',
      '1 1 1 rg', line('JE OILS', 42, 800, 25, true), line('PURCHASE QUOTATION', 42, 778, 11, true),
      '0.12 0.13 0.10 rg', line('Quote reference', 42, 705, 10, true), line(reference, 155, 705),
      line('Date issued', 42, 686, 10, true), line(today, 155, 686),
      line('Supplier', 42, 667, 10, true), line(purchase.supplier || '—', 155, 667),
      '0.95 0.94 0.89 rg 42 608 511 34 re f', '0.12 0.13 0.10 rg',
      line('ITEM DESCRIPTION', 52, 620, 9, true), line('QUANTITY', 315, 620, 9, true), line('UNIT PRICE', 407, 620, 9, true),
      line(purchase.item || 'Purchase item', 52, 579, 11, true), line(`${Number(purchase.qty || 0).toLocaleString()} ${purchase.unit || ''}`, 315, 579), line(formatMoney(purchase.unitPrice), 407, 579),
      '0.82 0.78 0.66 RG 42 558 m 553 558 l S',
      line('Total quotation value', 315, 522, 11, true), line(formatMoney(purchase.cost), 407, 522, 13, true),
      line('This quotation records the supplier offer. It becomes an order only when approved.', 42, 454, 9),
      line('Prepared by', 42, 390, 9, true), line(purchase.createdBy || 'JE Oils Operations', 42, 372, 10),
      line('Authorised signature', 350, 390, 9, true), '0.5 0.5 0.5 RG 350 365 m 535 365 l S',
      '0.12 0.13 0.10 rg', line('JE Oils  |  Quality-led edible oil operations', 42, 55, 8), line(`Generated ${today}`, 420, 55, 8),
    ].join('\n');
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([pdf], { type: 'application/pdf' });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.download-quote');
    if (!button) return;
    const purchase = data.purchases.find(entry => entry.id === +button.dataset.purchaseId);
    if (!purchase) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(quotePdf(purchase));
    link.download = `JE-Oils-Quote-${String(purchase.purchaseId || purchase.id).replace(/[^a-z0-9_-]/gi, '-')}.pdf`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
})();
