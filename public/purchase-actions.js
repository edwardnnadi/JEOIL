// Purchase edit controls: keep workflow stage first and safely remove an entire purchase trace.
const purchaseActionOpen=openModal;
openModal=(type,pid)=>{purchaseActionOpen(type,pid);$('#record-form .delete-purchase')?.remove();};
const purchaseActionEdit=editModal;
editModal=(kind,record)=>{
  purchaseActionEdit(kind,record);
  $('#record-form .delete-purchase')?.remove();
  if(kind!=='purchase')return;
  if(!canDeleteRecords?.())return;
  const form=$('#record-form'),stage=form.elements.status?.closest('.field'),firstStep=form.querySelector('.wizard-step[data-step="0"] .form-grid');
  if(stage&&firstStep){stage.querySelector('label').textContent='Purchase Stage';firstStep.prepend(stage);}
  let remove=form.querySelector('.delete-purchase');
  if(!remove){
    remove=document.createElement('button');remove.type='button';remove.className='secondary delete-purchase';remove.textContent='Delete purchase';
    remove.style.cssText='margin-right:auto;color:#9f2f25;border-color:#d89b95;';
    $('#save-record').parentElement.prepend(remove);
  }
  remove.onclick=()=>{
    if(!canDeleteRecords?.()){alert('Only Administrators and Operations Managers can delete records.');return;}
    if(!confirm(`Delete purchase ${record.purchaseId||record.item}? This will also remove its linked Goods Inwards record.`))return;
    window.deletePurchaseRecord?.(record);
  };
};
