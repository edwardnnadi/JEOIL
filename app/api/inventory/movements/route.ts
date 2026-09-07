import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { stockMovements } from '../../../../db/schema';
import { authorize } from '../../../../lib/auth';
import { badRequest, conflict, optionalText, positiveNumber, readBody, text, unauthorized } from '../../../../lib/http';

export async function GET(request: Request) {
  if (!(await authorize())) return unauthorized();
  const url = new URL(request.url);
  const item = url.searchParams.get('item');
  const warehouse = url.searchParams.get('warehouse');
  const db = getDb();
  const filters = [item ? eq(stockMovements.itemName, item) : undefined, warehouse ? eq(stockMovements.warehouse, warehouse) : undefined].filter(Boolean);
  const movements = filters.length ? await db.select().from(stockMovements).where(and(...filters)).orderBy(desc(stockMovements.recordedAt)) : await db.select().from(stockMovements).orderBy(desc(stockMovements.recordedAt));
  return NextResponse.json({ stockMovements: movements });
}

export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return unauthorized();
  const body = await readBody(request);
  if (!body) return badRequest('Invalid request body');
  const action = text(body.action);
  const itemName = text(body.itemName);
  const unit = text(body.unit);
  const warehouse = text(body.warehouse);
  const quantity = positiveNumber(body.quantity);
  if (!itemName || !unit || !warehouse || quantity === null) return badRequest('Item, unit, warehouse and positive quantity are required');
  const db = getDb();
  const now = new Date();
  if (action === 'ADJUSTMENT') {
    const direction = text(body.direction);
    if (direction !== 'IN' && direction !== 'OUT') return badRequest('Adjustment direction must be IN or OUT');
    if (direction === 'OUT') {
      const [balance] = await db.select({ quantity: sql<number>`coalesce(sum(${stockMovements.quantity}), 0)` }).from(stockMovements).where(and(eq(stockMovements.itemName, itemName), eq(stockMovements.warehouse, warehouse)));
      if ((balance?.quantity ?? 0) < quantity) return conflict('Adjustment would make warehouse stock negative');
    }
    const movement = { id: crypto.randomUUID(), movementType: 'ADJUSTMENT', itemName, unit, quantity: direction === 'OUT' ? -quantity : quantity, warehouse, lotNumber: optionalText(body.lotNumber), sourceType: 'ADJUSTMENT', sourceId: crypto.randomUUID(), note: optionalText(body.note), recordedBy: user.email, recordedAt: now };
    await db.insert(stockMovements).values(movement);
    return NextResponse.json({ stockMovements: [movement] }, { status: 201 });
  }
  if (action !== 'TRANSFER') return badRequest('Action must be ADJUSTMENT or TRANSFER');
  const destinationWarehouse = text(body.destinationWarehouse);
  if (!destinationWarehouse || destinationWarehouse === warehouse) return badRequest('A different destination warehouse is required');
  const [balance] = await db.select({ quantity: sql<number>`coalesce(sum(${stockMovements.quantity}), 0)` }).from(stockMovements).where(and(eq(stockMovements.itemName, itemName), eq(stockMovements.warehouse, warehouse)));
  if ((balance?.quantity ?? 0) < quantity) return conflict('Transfer exceeds source warehouse stock');
  const sourceId = crypto.randomUUID();
  const common = { itemName, unit, lotNumber: optionalText(body.lotNumber), sourceType: 'TRANSFER', sourceId, note: optionalText(body.note), recordedBy: user.email, recordedAt: now };
  const outbound = { ...common, id: crypto.randomUUID(), movementType: 'TRANSFER_OUT', quantity: -quantity, warehouse };
  const inbound = { ...common, id: crypto.randomUUID(), movementType: 'TRANSFER_IN', quantity, warehouse: destinationWarehouse };
  await db.insert(stockMovements).values([outbound, inbound]);
  return NextResponse.json({ stockMovements: [outbound, inbound] }, { status: 201 });
}
