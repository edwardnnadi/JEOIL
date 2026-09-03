// Purchase edit controls: keep workflow stage first and safely remove an entire purchase trace.
const purchaseActionOpen=openModal;
openModal=(type,pid)=>{purchaseActionOpen(type,pid);$('#record-form .delete-purchase')?.remove();};
const purchaseActionEdit=editModal;
editModal=(kind,record)=>{
  purchaseActionEdit(kind,record);
  $('#record-form .delete-purchase')?.remove();
  if(kind!=='purchase')return;
  const form=$('#record-form'),stage=form.elements.status?.closest('.field'),firstStep=form.querySelector('.wizard-step[data-step="0"] .form-grid');
  if(stage&&firstStep){stage.querySelector('label').textContent='Purchase Stage';firstStep.prepend(stage);}
  let remove=form.querySelector('.delete-purchase');
  if(!remove){
    remove=document.createElement('button');remove.type='button';remove.className='secondary delete-purchase';remove.textContent='Delete purchase';
    remove.style.cssText='margin-right:auto;color:#9f2f25;border-color:#d89b95;';
    $('#save-record').parentElement.prepend(remove);
  }
  remove.onclick=()=>{
    if(!confirm(`Delete purchase ${record.purchaseId||record.item}? This will also remove its linked Goods Inwards record.`))return;
    const linked=(data.goodsInwards||[]).filter(receipt=>receipt.purchaseId===record.id);
    linked.forEach(receipt=>{const posted=+receipt.stockOnHandQty||0,stock=stockItem(receipt.item);if(stock&&posted)stock.qty-=posted;});
    data.goodsInwards=(data.goodsInwards||[]).filter(receipt=>receipt.purchaseId!==record.id);
    data.assessments=(data.assessments||[]).filter(assessment=>assessment.purchaseId!==record.id);
    data.purchases=data.purchases.filter(purchase=>purchase.id!==record.id);
    save();render();$('#record-dialog').close();
  };
};
