import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { productionRuns, stockMovements } from '../../../../db/schema';
import { authorize } from '../../../../lib/auth';
import { badRequest, conflict, optionalText, positiveNumber, readBody, text, timestamp, unauthorized } from '../../../../lib/http';
import { nextRef } from '../../../../lib/refs';

type Material = { itemName: string; unit: string; quantity: number; lotNumber: string | null };

function materials(value: unknown): Material[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const parsed: Material[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const itemName = text(row.itemName), unit = text(row.unit), quantity = positiveNumber(row.quantity);
    if (!itemName || !unit || quantity === null) return null;
    parsed.push({ itemName, unit, quantity, lotNumber: optionalText(row.lotNumber) });
  }
  return parsed;
}

function optionalMaterials(value: unknown): Material[] | null {
  if (value === undefined || value === null) return [];
  return materials(value);
}

export async function GET(request: Request) {
  if (!(await authorize())) return unauthorized();
  const status = new URL(request.url).searchParams.get('status');
  const db = getDb();
  const runs = status ? await db.select().from(productionRuns).where(eq(productionRuns.status, status)).orderBy(desc(productionRuns.startedAt)) : await db.select().from(productionRuns).orderBy(desc(productionRuns.startedAt));
  return NextResponse.json({ productionRuns: runs.map(run => ({ ...run, staff: JSON.parse(run.staff) })) });
}

export async function POST(request: Request) {
  const user = await authorize(); if (!user) return unauthorized();
  const body = await readBody(request); if (!body) return badRequest('Invalid request body');
  const machine = text(body.machine), sourceWarehouse = text(body.sourceWarehouse), outputWarehouse = text(body.outputWarehouse), staff = body.staff;
  const inputs = materials(body.materials);
  if (!machine || !sourceWarehouse || !outputWarehouse || !Array.isArray(staff) || !inputs) return badRequest('Machine, warehouses, staff and at least one material are required');
  const db = getDb();
  for (const input of inputs) {
    const [balance] = await db.select({ quantity: sql<number>`coalesce(sum(${stockMovements.quantity}), 0)` }).from(stockMovements).where(and(eq(stockMovements.itemName, input.itemName), eq(stockMovements.unit, input.unit), eq(stockMovements.warehouse, sourceWarehouse)));
    if ((balance?.quantity ?? 0) < input.quantity) return conflict(`Insufficient ${input.itemName} in ${sourceWarehouse}`);
  }
  const now = new Date(), id = crypto.randomUUID(), batchNumber = await nextRef('PRODUCTION_RUN');
  const run = { id, batchNumber, machine, sourceWarehouse, outputWarehouse, staff: JSON.stringify(staff), status: 'IN_PROGRESS', startedBy: user.email, startedAt: timestamp(body.startedAt, now), endedAt: null, recordedEndedAt: null, endTimeConfirmed: null, notes: optionalText(body.notes) };
  await db.insert(productionRuns).values(run);
  await db.insert(stockMovements).values(inputs.map(input => ({ id: crypto.randomUUID(), movementType: 'PRODUCTION_ISSUE', itemName: input.itemName, unit: input.unit, quantity: -input.quantity, warehouse: sourceWarehouse, lotNumber: input.lotNumber, sourceType: 'PRODUCTION_RUN', sourceId: id, note: 'Issued at production start', recordedBy: user.email, recordedAt: now })));
  return NextResponse.json({ productionRun: { ...run, staff }, materials: inputs }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await authorize(); if (!user) return unauthorized();
  const body = await readBody(request); if (!body) return badRequest('Invalid request body');
  const id = text(body.id), action = text(body.action); if (!id || action !== 'END') return badRequest('Run id and END action are required');
  const outputs = materials(body.outputs); if (!outputs) return badRequest('At least one production output is required');
  const returns = optionalMaterials(body.returns); if (!returns) return badRequest('Invalid returned materials');
  const db = getDb(), run = await db.select().from(productionRuns).where(eq(productionRuns.id, id)).get();
  if (!run) return badRequest('Production run not found'); if (run.status !== 'IN_PROGRESS') return conflict(`Production run is already ${run.status}`);
  const issued = await db.select().from(stockMovements).where(and(eq(stockMovements.sourceType, 'PRODUCTION_RUN'), eq(stockMovements.sourceId, id), eq(stockMovements.movementType, 'PRODUCTION_ISSUE')));
  const availableReturns = new Map<string, number>();
  for (const issue of issued) {
    const key = `${issue.itemName}\u0000${issue.unit}\u0000${issue.lotNumber ?? ''}`;
    availableReturns.set(key, (availableReturns.get(key) ?? 0) + issue.quantity * -1);
  }
  for (const returned of returns) {
    const key = `${returned.itemName}\u0000${returned.unit}\u0000${returned.lotNumber ?? ''}`;
    const remaining = availableReturns.get(key) ?? 0;
    if (returned.quantity > remaining) return badRequest(`Returned ${returned.itemName} exceeds the quantity issued to this production run`);
    availableReturns.set(key, remaining - returned.quantity);
  }
  const confirmed = body.endTimeConfirmed === true; const now = new Date(); const endedAt = confirmed ? now : timestamp(body.endedAt, new Date(0));
  if (!confirmed && (endedAt.getTime() <= run.startedAt.getTime() || endedAt > now)) return badRequest('Actual end time must be after start and not in the future');
  await db.update(productionRuns).set({ status: 'COMPLETED', endedAt, recordedEndedAt: now, endTimeConfirmed: confirmed, notes: optionalText(body.notes) ?? run.notes }).where(eq(productionRuns.id, id));
  if (returns.length) await db.insert(stockMovements).values(returns.map(returned => ({ id: crypto.randomUUID(), movementType: 'PRODUCTION_RETURN', itemName: returned.itemName, unit: returned.unit, quantity: returned.quantity, warehouse: run.sourceWarehouse, lotNumber: returned.lotNumber, sourceType: 'PRODUCTION_RUN', sourceId: run.id, note: 'Unused material returned at production completion', recordedBy: user.email, recordedAt: now })));
  await db.insert(stockMovements).values(outputs.map(output => ({ id: crypto.randomUUID(), movementType: 'PRODUCTION_OUTPUT', itemName: output.itemName, unit: output.unit, quantity: output.quantity, warehouse: run.outputWarehouse, lotNumber: output.lotNumber, sourceType: 'PRODUCTION_RUN', sourceId: run.id, note: 'Recorded production output', recordedBy: user.email, recordedAt: now })));
  return NextResponse.json({ productionRun: { ...run, status: 'COMPLETED', endedAt, recordedEndedAt: now, endTimeConfirmed: confirmed }, outputs, returns });
}
