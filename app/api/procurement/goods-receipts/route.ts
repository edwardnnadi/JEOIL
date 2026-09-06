import { desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import {
  goodsReceipts,
  purchaseOrderLines,
  purchaseOrders,
  rawMaterialBatches,
} from '../../../../db/schema';
import { authorize } from '../../../../lib/auth';
import {
  badRequest,
  conflict,
  notFound,
  optionalText,
  positiveNumber,
  readBody,
  round,
  text,
  timestamp,
  unauthorized,
} from '../../../../lib/http';
import { nextRef } from '../../../../lib/refs';

const receivableStatuses = new Set(['APPROVED', 'PARTIALLY_RECEIVED']);

export async function GET(request: Request) {
  if (!(await authorize())) return unauthorized();
  const db = getDb();
  const qcStatus = new URL(request.url).searchParams.get('qcStatus');

  const receipts = qcStatus
    ? await db.select().from(goodsReceipts).where(eq(goodsReceipts.qcStatus, qcStatus)).orderBy(desc(goodsReceipts.receivedAt))
    : await db.select().from(goodsReceipts).orderBy(desc(goodsReceipts.receivedAt));

  if (receipts.length === 0) return NextResponse.json({ goodsReceipts: [] });

  // Batches are attached so a warehouse screen can show, per receipt, whether
  // stock actually exists — a rejected receipt will never have one.
  const batches = await db
    .select()
    .from(rawMaterialBatches)
    .where(inArray(rawMaterialBatches.goodsReceiptId, receipts.map((receipt) => receipt.id)));

  return NextResponse.json({
    goodsReceipts: receipts.map((receipt) => ({
      ...receipt,
      batch: batches.find((batch) => batch.goodsReceiptId === receipt.id) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return unauthorized();
  const body = await readBody(request);
  if (!body) return badRequest('Invalid request body');

  const purchaseOrderLineId = text(body.purchaseOrderLineId);
  const quantityReceived = positiveNumber(body.quantityReceived);
  if (!purchaseOrderLineId) return badRequest('Purchase order line is required');
  if (quantityReceived === null) return badRequest('Quantity received must be greater than zero');

  const db = getDb();
  const line = await db.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.id, purchaseOrderLineId)).get();
  if (!line) return notFound('Purchase order line not found');
  const order = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, line.purchaseOrderId)).get();
  if (!order) return notFound('Purchase order not found');

  if (!receivableStatuses.has(order.status)) {
    return conflict(`Goods cannot be received against a ${order.status} purchase order`, { poNumber: order.poNumber });
  }

  const outstanding = round(line.quantityOrdered - line.quantityReceived);
  if (round(quantityReceived) > outstanding) {
    return conflict('Quantity received exceeds the outstanding quantity on this order line', {
      outstanding,
      unit: line.unit,
    });
  }

  const now = new Date();
  const receipt = {
    id: crypto.randomUUID(),
    grnNumber: await nextRef('GOODS_RECEIPT'),
    purchaseOrderId: order.id,
    purchaseOrderLineId: line.id,
    supplierId: order.supplierId,
    itemName: line.itemName,
    unit: line.unit,
    quantityReceived,
    warehouse: optionalText(body.warehouse),
    vehicleRef: optionalText(body.vehicleRef),
    waybillRef: optionalText(body.waybillRef),
    // A receipt is created unquarantined-but-untested. Warehouse stock is not
    // created here; it is created by the QC gate only on ACCEPT.
    qcStatus: 'PENDING',
    qcTestResultId: null,
    receivedBy: user.email,
    receivedAt: timestamp(body.receivedAt, now),
  };
  await db.insert(goodsReceipts).values(receipt);

  // The draft receipt reserves no inventory and does not settle the purchase
  // line. Those updates are made by the accepted QC finish gate instead.

  return NextResponse.json({ goodsReceipt: { ...receipt, batch: null } }, { status: 201 });
}
