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

function isAdministrator(payload: string, email: string) {
  // The local development identity has no matching person record. Never use
  // that shortcut in the deployed application.
  if (process.env.NODE_ENV !== 'production' && email === 'operations@jeoils.test') return true;
  try {
    const people = (JSON.parse(payload) as { people?: unknown }).people;
    return Array.isArray(people) && people.some((person) => {
      if (!person || typeof person !== 'object') return false;
      const record = person as { email?: unknown; role?: unknown };
      return typeof record.email === 'string' && record.email.toLowerCase() === email.toLowerCase() &&
        typeof record.role === 'string' && record.role.trim().toLowerCase() === 'administrator';
    });
  } catch {
    return false;
  }
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

// Completed production runs are an audit record. Starting and completing a run
// remains available to the operational workflow, but changing a run after it
// has been completed is limited to administrators.
function changedCompletedProduction(before: string | null, after: string) {
  try {
    const previous = before ? JSON.parse(before) as { production?: unknown } : {};
    const next = JSON.parse(after) as { production?: unknown };
    if (!Array.isArray(previous.production) || !Array.isArray(next.production)) return false;
    const nextById = new Map(next.production
      .filter((record): record is { id?: unknown } => Boolean(record) && typeof record === 'object')
      .map(record => [String(record.id), record]));
    return previous.production.some((record) => {
      if (!record || typeof record !== 'object') return false;
      const prior = record as { id?: unknown };
      return JSON.stringify(prior) !== JSON.stringify(nextById.get(String(prior.id)));
    });
  } catch {
    // Do not treat an invalid payload as a production edit; the client retains
    // its existing state validation behaviour and the request will be stored
    // only if it passes the normal persistence flow.
    return false;
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

  if (changedCompletedProduction(current?.payload ?? null, body.payload) &&
    !isAdministrator(current?.payload ?? body.payload, user.email)) {
    return NextResponse.json(
      { error: 'Administrator access is required to edit completed production records.' },
      { status: 403 },
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
    typeof body.collection !== 'string' ||
    !deletableCollections.has(body.collection) ||
    (!('all' in body) && (!('id' in body) || (typeof body.id !== 'string' && typeof body.id !== 'number'))) ||
    ('all' in body && body.all !== true)
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
    if (!isAdministrator(current.payload, user.email)) {
      return NextResponse.json({ error: 'Administrator access is required to delete operational records.' }, { status: 403 });
    }

    let state: Record<string, unknown>;
    try {
      state = JSON.parse(current.payload) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Stored application state is invalid' }, { status: 500 });
    }
    const records = state[body.collection];
    if (!Array.isArray(records)) return NextResponse.json({ error: 'Record collection is unavailable' }, { status: 404 });

    const deleteAll = 'all' in body && body.all === true;
    if (deleteAll && body.collection !== 'stock') {
      return NextResponse.json({ error: 'Only stock can be deleted in bulk.' }, { status: 400 });
    }
    const deletedRecords = deleteAll ? records : records.filter(record =>
      typeof record === 'object' && record !== null && 'id' in record && String(record.id) === String(body.id),
    );
    state[body.collection] = deleteAll ? [] : records.filter(record =>
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
      await appendActivity(
        deleteAll ? 'Deleted all stock items' : 'Deleted operational record',
        deleteAll ? `Deleted ${deletedRecords.length} stock item(s).` : `Deleted a record from ${body.collection}.`,
        user,
      );
      return NextResponse.json({ ok: true, payload: JSON.stringify(state), revision: updatedAt.getTime() });
    }
  }

  return NextResponse.json({ error: 'Could not apply deletion; please try again.' }, { status: 409 });
}
