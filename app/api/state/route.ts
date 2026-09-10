import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { authorize } from '../../../lib/auth';
import { getDb } from '../../../db';
import { activityLog, operationsState } from '../../../db/schema';

async function appendActivity(action: string, details: string, user: Awaited<ReturnType<typeof authorize>>) {
  if (!user) return;
  await getDb().insert(activityLog).values({
    id: crypto.randomUUID(), userId: user.userId, userName: user.fullName || user.displayName,
    userEmail: user.email, action, details, occurredAt: new Date(),
  });
}

function changedAreas(before: string | null, after: string) {
  try {
    const previous = before ? JSON.parse(before) as Record<string, unknown> : {};
    const next = JSON.parse(after) as Record<string, unknown>;
    const areas = Object.keys(next).filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]));
    return areas.slice(0, 6).join(', ') || 'operational data';
  } catch {
    return 'operational data';
  }
}

export async function GET() {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const row = await getDb().select().from(operationsState).where(eq(operationsState.id, 'main')).get();
  let payload = row?.payload ?? null;
  if (payload) {
    try {
      const state = JSON.parse(payload);
      state.currentUserEmail = user.email;
      payload = JSON.stringify(state);
    } catch {
      // The stored payload is validated by the client; return it unchanged if legacy data is malformed.
    }
  }
  await appendActivity('Signed in', 'Opened the JE Oils Operations workspace.', user);
  return NextResponse.json({
    payload,
    revision: row?.updatedAt.getTime() ?? null,
  });
}

export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const body: unknown = await request.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('payload' in body) ||
    typeof body.payload !== 'string' ||
    body.payload.length > 10_000_000
  ) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  }

  const suppliedRevision: unknown = 'revision' in body ? body.revision : undefined;
  if (suppliedRevision !== null && suppliedRevision !== undefined &&
    (typeof suppliedRevision !== 'number' || !Number.isSafeInteger(suppliedRevision) || suppliedRevision < 0)) {
    return NextResponse.json({ error: 'Invalid state revision' }, { status: 400 });
  }
  const revision = suppliedRevision as number | null | undefined;

  const db = getDb();
  const current = await db.select().from(operationsState).where(eq(operationsState.id, 'main')).get();
  const currentRevision = current?.updatedAt.getTime() ?? null;
  if (revision !== currentRevision) {
    return NextResponse.json(
      { error: 'State changed in another session', payload: current?.payload ?? null, revision: currentRevision },
      { status: 409 },
    );
  }

  const updatedAt = new Date(Math.max(Date.now(), (currentRevision ?? 0) + 1));
  if (!current) {
    await db.insert(operationsState).values({ id: 'main', payload: body.payload, updatedAt });
  } else {
    const updated = await db
      .update(operationsState)
      .set({ payload: body.payload, updatedAt })
      .where(and(eq(operationsState.id, 'main'), eq(operationsState.updatedAt, current.updatedAt)))
      .returning({ revision: operationsState.updatedAt })
      .get();
    if (!updated) {
      const latest = await db.select().from(operationsState).where(eq(operationsState.id, 'main')).get();
      return NextResponse.json(
        { error: 'State changed in another session', payload: latest?.payload ?? null, revision: latest?.updatedAt.getTime() ?? null },
        { status: 409 },
      );
    }
  }

  await appendActivity('Updated operations data', `Changed: ${changedAreas(current?.payload ?? null, body.payload)}.`, user);

  return NextResponse.json({ ok: true, revision: updatedAt.getTime() });
}

const deletableCollections = new Set(['stock', 'suppliers', 'production', 'purchases']);

export async function DELETE(request: Request) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const body: unknown = await request.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('collection' in body) ||
    !('id' in body) ||
    typeof body.collection !== 'string' ||
    !deletableCollections.has(body.collection) ||
    (typeof body.id !== 'string' && typeof body.id !== 'number')
  ) {
    return NextResponse.json({ error: 'Invalid deletion request' }, { status: 400 });
  }

  const db = getDb();
  // Retry against the latest row if another update lands between the read and
  // write. This preserves the requested deletion without reverting unrelated
  // changes made by that other session.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await db.select().from(operationsState).where(eq(operationsState.id, 'main')).get();
    if (!current) return NextResponse.json({ error: 'No application state exists' }, { status: 404 });

    let state: Record<string, unknown>;
    try {
      state = JSON.parse(current.payload) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Stored application state is invalid' }, { status: 500 });
    }
    const records = state[body.collection];
    if (!Array.isArray(records)) return NextResponse.json({ error: 'Record collection is unavailable' }, { status: 404 });

    const deletedRecords = records.filter(record =>
      typeof record === 'object' && record !== null && 'id' in record && String(record.id) === String(body.id),
    );
    state[body.collection] = records.filter(record =>
      !(typeof record === 'object' && record !== null && 'id' in record && String(record.id) === String(body.id)),
    );
    if (body.collection === 'purchases') {
      const purchaseIds = new Set(deletedRecords.map(record => String((record as { id: string | number }).id)));
      const receipts = Array.isArray(state.goodsInwards) ? state.goodsInwards : [];
      const linkedReceipts = receipts.filter(receipt =>
        typeof receipt === 'object' && receipt !== null && 'purchaseId' in receipt && purchaseIds.has(String(receipt.purchaseId)),
      ) as Array<{ item?: unknown; stockOnHandQty?: unknown }>;
      state.goodsInwards = receipts.filter(receipt =>
        !(typeof receipt === 'object' && receipt !== null && 'purchaseId' in receipt && purchaseIds.has(String(receipt.purchaseId))),
      );
      if (Array.isArray(state.assessments)) {
        state.assessments = state.assessments.filter(assessment =>
          !(typeof assessment === 'object' && assessment !== null && 'purchaseId' in assessment && purchaseIds.has(String(assessment.purchaseId))),
        );
      }
      if (Array.isArray(state.stock)) {
        linkedReceipts.forEach(receipt => {
          const quantity = Number(receipt.stockOnHandQty || 0);
          const stock = state.stock as Array<{ name?: unknown; qty?: unknown }>;
          const item = stock.find(entry => String(entry.name || '').toLowerCase() === String(receipt.item || '').toLowerCase());
          if (item && quantity) item.qty = Number(item.qty || 0) - quantity;
        });
      }
    }
    const updatedAt = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1));
    const updated = await db
      .update(operationsState)
      .set({ payload: JSON.stringify(state), updatedAt })
      .where(and(eq(operationsState.id, 'main'), eq(operationsState.updatedAt, current.updatedAt)))
      .returning({ revision: operationsState.updatedAt })
      .get();
    if (updated) {
      await appendActivity('Deleted operational record', `Deleted a record from ${body.collection}.`, user);
      return NextResponse.json({ ok: true, payload: JSON.stringify(state), revision: updatedAt.getTime() });
    }
  }

  return NextResponse.json({ error: 'Could not apply deletion; please try again.' }, { status: 409 });
}
