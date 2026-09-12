// Ensures the receiving assessment always exposes the current controlled fields.
const receivingGoodsOpen=openGoodsInward;
openGoodsInward=receipt=>{
  receivingGoodsOpen(receipt);
  const form=$('#record-form'),fields=$('#form-fields');
  // Quality readings are rendered from the item's standard (Diesel has no oil
  // content or FFA), so only a form missing the core controls needs supplementing.
  if(form.elements.namedItem('qualityCheckOfficerId')&&form.elements.namedItem('notes'))return;
  const officerId=String(receipt?.qualityCheckOfficerId||''),officerName=receipt?.qualityCheckOfficer||receipt?.inspector||'';
  const number=value=>value===''||value===null||value===undefined?'':Number(value).toFixed(2);
  const officerOptions=data.people.map(person=>`<option value="${person.id}" ${String(person.id)===officerId||person.name===officerName?'selected':''}>${warehouseEscape(person.name)} · ${warehouseEscape(person.role||person.type||'Person')}</option>`).join('');
  const supplemental=`<section class="field full receiving-quality-assessment"><label>Goods Inwards Receiving Quality Assessment</label><div class="item-note">Complete this assessment at receipt. It is separate from the initial purchase assessment.</div></section>${form.elements.oilContent?'':`<div class="field"><label>Oil Content (%)</label><input name="oilContent" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${number(receipt?.oilContent)}"></div>`}${form.elements.ffa?'':`<div class="field"><label>FFA (%)</label><input name="ffa" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${number(receipt?.ffa)}"></div>`}${form.elements.qualityCheckOfficerId?'':`<div class="field"><label>Quality Check Officer</label><select name="qualityCheckOfficerId"><option value="">Select a person</option>${officerOptions}</select></div>`}${form.elements.notes?'':`<div class="field full"><label>Notes</label><textarea name="notes">${warehouseEscape(receipt?.notes||'')}</textarea></div>`}`;
  fields.querySelector('.purchase-trace-card, .initial-quality-card')?.insertAdjacentHTML('afterend',supplemental)||fields.insertAdjacentHTML('beforeend',supplemental);
};
