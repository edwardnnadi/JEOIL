import { desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { customers, salesOrderLines, salesOrders } from '../../../../db/schema';
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
  productName: string;
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
    const productName = text(line.productName);
    const unit = text(line.unit);
    const quantityOrdered = positiveNumber(line.quantityOrdered);
    const unitPrice = nonNegativeNumber(line.unitPrice ?? 0);
    if (!productName || !unit || quantityOrdered === null || unitPrice === null) return null;
    lines.push({ productName, unit, quantityOrdered, unitPrice });
  }
  return lines;
}

export async function GET(request: Request) {
  if (!(await authorize())) return unauthorized();
  const db = getDb();
  const status = new URL(request.url).searchParams.get('status');

  const orders = status
    ? await db.select().from(salesOrders).where(eq(salesOrders.status, status)).orderBy(desc(salesOrders.orderDate))
    : await db.select().from(salesOrders).orderBy(desc(salesOrders.orderDate));

  if (orders.length === 0) return NextResponse.json({ salesOrders: [] });

  const lines = await db
    .select()
    .from(salesOrderLines)
    .where(inArray(salesOrderLines.salesOrderId, orders.map((order) => order.id)));

  return NextResponse.json({
    salesOrders: orders.map((order) => ({
      ...order,
      lines: lines.filter((line) => line.salesOrderId === order.id),
    })),
  });
}

export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return unauthorized();
  const body = await readBody(request);
  if (!body) return badRequest('Invalid request body');

  const customerId = text(body.customerId);
  const lines = parseLines(body.lines);
  if (!customerId) return badRequest('Customer is required');
  if (!lines) return badRequest('At least one order line with product, unit and quantity is required');

  const db = getDb();
  const customer = await db.select().from(customers).where(eq(customers.id, customerId)).get();
  if (!customer) return notFound('Customer not found');
  if (customer.status !== 'ACTIVE') return conflict('Sales orders can only be raised for an active customer');

  const now = new Date();
  const orderId = crypto.randomUUID();
  const totalAmount = round(lines.reduce((sum, line) => sum + line.quantityOrdered * line.unitPrice, 0));

  await db.insert(salesOrders).values({
    id: orderId,
    soNumber: await nextRef('SALES_ORDER'),
    customerId,
    status: 'DRAFT',
    currency: text(body.currency) ?? 'NGN',
    orderDate: timestamp(body.orderDate, now),
    requiredDate: typeof body.requiredDate === 'string' ? timestamp(body.requiredDate, now) : null,
    totalAmount,
    notes: optionalText(body.notes),
    raisedBy: user.email,
    createdAt: now,
  });
  await db.insert(salesOrderLines).values(
    lines.map((line) => ({
      id: crypto.randomUUID(),
      salesOrderId: orderId,
      productName: line.productName,
      unit: line.unit,
      quantityOrdered: line.quantityOrdered,
      quantityDispatched: 0,
      unitPrice: line.unitPrice,
    })),
  );

  const order = await db.select().from(salesOrders).where(eq(salesOrders.id, orderId)).get();
  const savedLines = await db.select().from(salesOrderLines).where(eq(salesOrderLines.salesOrderId, orderId));
  return NextResponse.json({ salesOrder: { ...order, lines: savedLines } }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await authorize())) return unauthorized();
  const body = await readBody(request);
  if (!body) return badRequest('Invalid request body');
  const id = text(body.id);
  const action = text(body.action);
  if (!id) return badRequest('Sales order id is required');
  if (action !== 'CONFIRM' && action !== 'CANCEL') return badRequest('Action must be CONFIRM or CANCEL');

  const db = getDb();
  const order = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).get();
  if (!order) return notFound('Sales order not found');

  if (action === 'CONFIRM') {
    if (order.status !== 'DRAFT') return conflict(`Only a draft sales order can be confirmed (this one is ${order.status})`);
    const [updated] = await db.update(salesOrders).set({ status: 'CONFIRMED' }).where(eq(salesOrders.id, id)).returning();
    return NextResponse.json({ salesOrder: updated });
  }

  if (order.status === 'DISPATCHED' || order.status === 'PARTIALLY_DISPATCHED') {
    return conflict('A sales order with goods already dispatched cannot be cancelled');
  }
  const [updated] = await db.update(salesOrders).set({ status: 'CANCELLED' }).where(eq(salesOrders.id, id)).returning();
  return NextResponse.json({ salesOrder: updated });
}
