import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { finishedGoodsBatches } from '../../../../db/schema';
import { authorize } from '../../../../lib/auth';
import {
  badRequest,
  optionalText,
  positiveNumber,
  readBody,
  text,
  timestamp,
  unauthorized,
} from '../../../../lib/http';
import { nextRef } from '../../../../lib/refs';

export async function GET(request: Request) {
  if (!(await authorize())) return unauthorized();
  const db = getDb();
  const status = new URL(request.url).searchParams.get('status');
  const batches = status
    ? await db.select().from(finishedGoodsBatches).where(eq(finishedGoodsBatches.status, status)).orderBy(desc(finishedGoodsBatches.producedAt))
    : await db.select().from(finishedGoodsBatches).orderBy(desc(finishedGoodsBatches.producedAt));
  return NextResponse.json({ finishedGoodsBatches: batches });
}

export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return unauthorized();
  const body = await readBody(request);
  if (!body) return badRequest('Invalid request body');

  const productName = text(body.productName);
  const unit = text(body.unit);
  const quantityProduced = positiveNumber(body.quantityProduced);
  if (!productName) return badRequest('Product name is required');
  if (!unit) return badRequest('Unit is required');
  if (quantityProduced === null) return badRequest('Quantity produced must be greater than zero');

  const now = new Date();
  // Output is born in QUARANTINE. Nothing but a FINAL-stage QC pass moves it on,
  // so a batch can never be dispatched simply because production recorded it.
  const batch = {
    id: crypto.randomUUID(),
    batchNumber: await nextRef('FINISHED_GOODS_BATCH'),
    productName,
    unit,
    quantityProduced,
    quantityRemaining: quantityProduced,
    productionRunRef: optionalText(body.productionRunRef),
    status: 'QUARANTINE',
    qcTestResultId: null,
    releasedBy: null,
    releasedAt: null,
    producedBy: user.email,
    producedAt: timestamp(body.producedAt, now),
  };
  await getDb().insert(finishedGoodsBatches).values(batch);
  return NextResponse.json({ finishedGoodsBatch: batch }, { status: 201 });
}
