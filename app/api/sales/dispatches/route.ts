import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import {
  dispatches,
  finishedGoodsBatches,
  salesOrderLines,
  salesOrders,
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

const dispatchableStatuses = new Set(['CONFIRMED', 'PARTIALLY_DISPATCHED']);

export async function GET(request: Request) {
  if (!(await authorize())) return unauthorized();
  const db = getDb();
  const salesOrderId = new URL(request.url).searchParams.get('salesOrderId');
  const rows = salesOrderId
    ? await db.select().from(dispatches).where(eq(dispatches.salesOrderId, salesOrderId)).orderBy(desc(dispatches.dispatchedAt))
    : await db.select().from(dispatches).orderBy(desc(dispatches.dispatchedAt));
  return NextResponse.json({ dispatches: rows });
}

/**
 * Goods out.
 *
 * Three server-side conditions must hold, and the client cannot satisfy any of
 * them by sending different values: the order is confirmed, the finished-goods
 * batch is RELEASED by a FINAL-stage QC pass, and neither the order line nor
 * the batch is being over-drawn.
 */
export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return unauthorized();
  const body = await readBody(request);
  if (!body) return badRequest('Invalid request body');

  const salesOrderLineId = text(body.salesOrderLineId);
  const finishedGoodsBatchId = text(body.finishedGoodsBatchId);
  const quantity = positiveNumber(body.quantity);
  if (!salesOrderLineId) return badRequest('Sales order line is required');
  if (!finishedGoodsBatchId) return badRequest('Finished goods batch is required');
  if (quantity === null) return badRequest('Dispatch quantity must be greater than zero');

  const db = getDb();
  const line = await db.select().from(salesOrderLines).where(eq(salesOrderLines.id, salesOrderLineId)).get();
  if (!line) return notFound('Sales order line not found');
  const order = await db.select().from(salesOrders).where(eq(salesOrders.id, line.salesOrderId)).get();
  if (!order) return notFound('Sales order not found');
  const batch = await db.select().from(finishedGoodsBatches).where(eq(finishedGoodsBatches.id, finishedGoodsBatchId)).get();
  if (!batch) return notFound('Finished goods batch not found');

  if (!dispatchableStatuses.has(order.status)) {
    return conflict(`Goods cannot be dispatched against a ${order.status} sales order`, { soNumber: order.soNumber });
  }
  if (batch.status !== 'RELEASED') {
    return conflict(
      `Batch ${batch.batchNumber} is ${batch.status} and has not been released by final QC. Dispatch is blocked.`,
      { batchNumber: batch.batchNumber, batchStatus: batch.status },
    );
  }

  const outstanding = round(line.quantityOrdered - line.quantityDispatched);
  if (round(quantity) > outstanding) {
    return conflict('Dispatch quantity exceeds the outstanding quantity on this order line', {
      outstanding,
      unit: line.unit,
    });
  }
  if (round(quantity) > round(batch.quantityRemaining)) {
    return conflict('Dispatch quantity exceeds the quantity remaining in this batch', {
      remaining: round(batch.quantityRemaining),
      unit: batch.unit,
    });
  }

  const now = new Date();
  const dispatch = {
    id: crypto.randomUUID(),
    dispatchNumber: await nextRef('DISPATCH'),
    salesOrderId: order.id,
    salesOrderLineId: line.id,
    finishedGoodsBatchId: batch.id,
    customerId: order.customerId,
    quantity,
    unit: line.unit,
    vehicleRef: optionalText(body.vehicleRef),
    driverName: optionalText(body.driverName),
    dispatchedBy: user.email,
    dispatchedAt: timestamp(body.dispatchedAt, now),
  };
  await db.insert(dispatches).values(dispatch);

  const batchRemaining = round(batch.quantityRemaining - quantity);
  await db
    .update(finishedGoodsBatches)
    .set({ quantityRemaining: batchRemaining, status: batchRemaining <= 0 ? 'DISPATCHED' : batch.status })
    .where(eq(finishedGoodsBatches.id, batch.id));

  const lineDispatched = round(line.quantityDispatched + quantity);
  await db
    .update(salesOrderLines)
    .set({ quantityDispatched: lineDispatched })
    .where(eq(salesOrderLines.id, line.id));

  const allLines = await db.select().from(salesOrderLines).where(eq(salesOrderLines.salesOrderId, order.id));
  const fullyDispatched = allLines.every((entry) =>
    round(entry.id === line.id ? lineDispatched : entry.quantityDispatched) >= round(entry.quantityOrdered),
  );
  await db
    .update(salesOrders)
    .set({ status: fullyDispatched ? 'DISPATCHED' : 'PARTIALLY_DISPATCHED' })
    .where(eq(salesOrders.id, order.id));

  return NextResponse.json({ dispatch }, { status: 201 });
}
