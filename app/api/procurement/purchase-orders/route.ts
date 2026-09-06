import { desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { purchaseOrderLines, purchaseOrders, suppliers } from '../../../../db/schema';
import { authorize } from '../../../../lib/auth';
import {
  badRequest,
  conflict,
  nonNegativeNumber,
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

type LineInput = {
  itemName: string;
  itemCategory: string | null;
  unit: string;
  quantityOrdered: number;
  unitPrice: number;
};

function parseLines(value: unknown): LineInput[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const lines: LineInput[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null;
    const line = entry as Record<string, unknown>;
    const itemName = text(line.itemName);
    const unit = text(line.unit);
    const quantityOrdered = positiveNumber(line.quantityOrdered);
    const unitPrice = nonNegativeNumber(line.unitPrice ?? 0);
    if (!itemName || !unit || quantityOrdered === null || unitPrice === null) return null;
    lines.push({ itemName, itemCategory: optionalText(line.itemCategory), unit, quantityOrdered, unitPrice });
  }
  return lines;
}

export async function GET(request: Request) {
  if (!(await authorize())) return unauthorized();
  const db = getDb();
  const status = new URL(request.url).searchParams.get('status');

  const orders = status
    ? await db.select().from(purchaseOrders).where(eq(purchaseOrders.status, status)).orderBy(desc(purchaseOrders.orderDate))
    : await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.orderDate));

  if (orders.length === 0) return NextResponse.json({ purchaseOrders: [] });

  const lines = await db
    .select()
    .from(purchaseOrderLines)
    .where(inArray(purchaseOrderLines.purchaseOrderId, orders.map((order) => order.id)));

  return NextResponse.json({
    purchaseOrders: orders.map((order) => ({
      ...order,
      lines: lines.filter((line) => line.purchaseOrderId === order.id),
    })),
  });
}

export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return unauthorized();
  const body = await readBody(request);
  if (!body) return badRequest('Invalid request body');

  const supplierId = text(body.supplierId);
  const lines = parseLines(body.lines);
  if (!supplierId) return badRequest('Supplier is required');
  if (!lines) return badRequest('At least one order line with item, unit and quantity is required');

  const db = getDb();
  const supplier = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).get();
  if (!supplier) return notFound('Supplier not found');
  if (supplier.status !== 'ACTIVE') return conflict('Purchase orders can only be raised against an active supplier');

  const now = new Date();
  const orderId = crypto.randomUUID();
  const totalAmount = round(lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitPrice, 0));

  await db.insert(purchaseOrders).values({
    id: orderId,
    poNumber: await nextRef('PURCHASE_ORDER'),
    supplierId,
    status: 'DRAFT',
    currency: text(body.currency) ?? 'NGN',
    orderDate: timestamp(body.orderDate, now),
    expectedDate: typeof body.expectedDate === 'string' ? timestamp(body.expectedDate, now) : null,
    totalAmount,
    notes: optionalText(body.notes),
    raisedBy: user.email,
    createdAt: now,
  });
  await db.insert(purchaseOrderLines).values(
    lines.map((line) => ({
      id: crypto.randomUUID(),
      purchaseOrderId: orderId,
      itemName: line.itemName,
      itemCategory: line.itemCategory,
      unit: line.unit,
      quantityOrdered: line.quantityOrdered,
      quantityReceived: 0,
      unitPrice: line.unitPrice,
    })),
  );

  const order = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, orderId)).get();
  const savedLines = await db.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, orderId));
  return NextResponse.json({ purchaseOrder: { ...order, lines: savedLines } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await authorize();
  if (!user) return unauthorized();
  const body = await readBody(request);
  if (!body) return badRequest('Invalid request body');
  const id = text(body.id);
  const action = text(body.action);
  if (!id) return badRequest('Purchase order id is required');
  if (action !== 'APPROVE' && action !== 'CANCEL') return badRequest('Action must be APPROVE or CANCEL');

  const db = getDb();
  const order = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).get();
  if (!order) return notFound('Purchase order not found');

  if (action === 'APPROVE') {
    if (order.status !== 'DRAFT') return conflict(`Only a draft purchase order can be approved (this one is ${order.status})`);
    // Approval is recorded against the signed-in identity rather than a
    // free-text name so the audit trail cannot be typed after the fact.
    const [updated] = await db
      .update(purchaseOrders)
      .set({ status: 'APPROVED', approvedBy: user.email, approvedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning();
    return NextResponse.json({ purchaseOrder: updated });
  }

  if (order.status === 'RECEIVED' || order.status === 'PARTIALLY_RECEIVED') {
    return conflict('A purchase order with goods already received cannot be cancelled');
  }
  const [updated] = await db
    .update(purchaseOrders)
    .set({ status: 'CANCELLED' })
    .where(eq(purchaseOrders.id, id))
    .returning();
  return NextResponse.json({ purchaseOrder: updated });
}
