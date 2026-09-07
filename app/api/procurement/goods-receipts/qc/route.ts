import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../../../db';
import { goodsReceipts, purchaseOrderLines, purchaseOrders, rawMaterialBatches, stockMovements } from '../../../../../db/schema';
import { authorize } from '../../../../../lib/auth';
import { badRequest, conflict, notFound, readBody, round, text, unauthorized } from '../../../../../lib/http';
import { asValues, evaluateAndRecordQc } from '../../../../../lib/qc';
import { nextRef } from '../../../../../lib/refs';

/**
 * The receiving QC gate.
 *
 * The server evaluates the submitted readings against the active rulebook and,
 * in the same request, either creates the raw-material batch (ACCEPT) or does
 * not (REJECT). Because batch creation lives only on the ACCEPT branch, there
 * is no sequence of API calls that puts rejected material into stock.
 */
export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return unauthorized();
  const body = await readBody(request);
  if (!body) return badRequest('Invalid request body');

  const goodsReceiptId = text(body.goodsReceiptId);
  const values = asValues(body.values);
  if (!goodsReceiptId) return badRequest('Goods receipt id is required');
  if (!values) return badRequest('QC values must be an object of parameter readings');

  const db = getDb();
  const receipt = await db.select().from(goodsReceipts).where(eq(goodsReceipts.id, goodsReceiptId)).get();
  if (!receipt) return notFound('Goods receipt not found');
  if (receipt.qcStatus !== 'PENDING') {
    return conflict(`This receipt has already been tested (${receipt.qcStatus}). Record a re-test as a new receipt.`, {
      qcStatus: receipt.qcStatus,
      qcTestResultId: receipt.qcTestResultId,
    });
  }
  const line = await db.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.id, receipt.purchaseOrderLineId)).get();
  if (!line) return notFound('Purchase order line not found');
  const nextReceived = round(line.quantityReceived + receipt.quantityReceived);
  if (nextReceived > round(line.quantityOrdered)) {
    return conflict('Accepted quantity would exceed the outstanding purchase-order line quantity');
  }

  const evaluation = await evaluateAndRecordQc({
    context: 'RAW_MATERIAL',
    stage: 'RECEIPT',
    batchRef: receipt.grnNumber,
    values,
    testedBy: user.email,
  });

  await db
    .update(goodsReceipts)
    .set({ qcStatus: evaluation.overallResult, qcTestResultId: evaluation.id })
    .where(eq(goodsReceipts.id, receipt.id));

  if (evaluation.overallResult !== 'ACCEPT') {
    return NextResponse.json({ qc: evaluation, batch: null, stockCreated: false });
  }

  const now = new Date();
  const batch = {
    id: crypto.randomUUID(),
    batchNumber: await nextRef('RAW_MATERIAL_BATCH'),
    goodsReceiptId: receipt.id,
    itemName: receipt.itemName,
    unit: receipt.unit,
    quantityReceived: receipt.quantityReceived,
    quantityRemaining: receipt.quantityReceived,
    warehouse: receipt.warehouse,
    createdAt: now,
  };
  await db.insert(rawMaterialBatches).values(batch);
  await db.insert(stockMovements).values({
    id: crypto.randomUUID(),
    movementType: 'RECEIPT',
    itemName: receipt.itemName,
    unit: receipt.unit,
    quantity: receipt.quantityReceived,
    warehouse: receipt.warehouse,
    lotNumber: batch.batchNumber,
    sourceType: 'GOODS_RECEIPT',
    sourceId: receipt.id,
    note: 'Accepted goods receipt',
    recordedBy: user.email,
    recordedAt: now,
  });

  await db.update(purchaseOrderLines).set({ quantityReceived: nextReceived }).where(eq(purchaseOrderLines.id, line.id));
  const lines = await db.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, receipt.purchaseOrderId));
  const isComplete = lines.every(entry => round(entry.id === line.id ? nextReceived : entry.quantityReceived) >= round(entry.quantityOrdered));
  await db.update(purchaseOrders).set({ status: isComplete ? 'RECEIVED' : 'PARTIALLY_RECEIVED' }).where(eq(purchaseOrders.id, receipt.purchaseOrderId));

  return NextResponse.json({ qc: evaluation, batch, stockCreated: true });
}
