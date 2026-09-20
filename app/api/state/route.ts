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
    const labels: Record<string, string> = {
      purchases: 'Purchases', goodsInwards: 'Goods inwards', assessments: 'Quality assessments',
      production: 'Production runs', stock: 'Stock', goodsOutwards: 'Goods outward', suppliers: 'Suppliers', people: 'People',
      warehouses: 'Warehouses', machines: 'Machines', labResults: 'Lab results', labRuns: 'Lab runs',
    };
    const recordName = (record: Record<string, unknown>) => String(
      record.reference ?? record.batch ?? record.name ?? record.item ?? record.product ?? record.id ?? 'record',
    );
    const changedFields = (beforeRecord: Record<string, unknown>, afterRecord: Record<string, unknown>) =>
      Object.keys(afterRecord).filter(key => key !== 'id' && JSON.stringify(beforeRecord[key]) !== JSON.stringify(afterRecord[key]))
        .slice(0, 4).map(key => key.replace(/([a-z])([A-Z])/g, '$1 $2'));
    const summaries = Object.keys(next).flatMap((key) => {
      if (JSON.stringify(previous[key]) === JSON.stringify(next[key])) return [];
      const label = labels[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2');
      if (!Array.isArray(previous[key]) || !Array.isArray(next[key])) return [label];
      const oldRecords = previous[key].filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object');
      const newRecords = next[key].filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object');
      const oldById = new Map(oldRecords.map(record => [String(record.id), record]));
      const newById = new Map(newRecords.map(record => [String(record.id), record]));
      const added = newRecords.find(record => !oldById.has(String(record.id)));
      if (added) return [`${label}: added ${recordName(added)}`];
      const removed = oldRecords.find(record => !newById.has(String(record.id)));
      if (removed) return [`${label}: removed ${recordName(removed)}`];
      const updated = newRecords.find(record => {
        const oldRecord = oldById.get(String(record.id));
        return oldRecord && JSON.stringify(oldRecord) !== JSON.stringify(record);
      });
      if (!updated) return [label];
      const fields = changedFields(oldById.get(String(updated.id))!, updated);
      return [`${label}: updated ${recordName(updated)}${fields.length ? ` (${fields.join(', ')})` : ''}`];
    });
    return summaries.slice(0, 6).join('; ') || 'Operational data';
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

type StateRecord = Record<string, unknown>;

function records(value: unknown): StateRecord[] {
  return Array.isArray(value) ? value.filter((entry): entry is StateRecord => Boolean(entry) && typeof entry === 'object') : [];
}

function movementId(movement: StateRecord) {
  const value = movement.id;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

/**
 * The legacy workspace persists a client-side aggregate, but the journal
 * within it is still our accounting record. Preserve its history and reject
 * unreasoned adjustments at the server boundary so DevTools or a hand-written
 * request cannot silently change a quantity.
 */
function inventoryIntegrityError(before: string | null, after: string): string | null {
  let previous: StateRecord;
  let next: StateRecord;
  try {
    previous = before ? JSON.parse(before) as StateRecord : {};
    next = JSON.parse(after) as StateRecord;
  } catch {
    return 'Invalid operational state';
  }

  const oldMovements = records(previous.stockMovements);
  const newMovements = records(next.stockMovements);
  const oldById = new Map<string, StateRecord>();
  for (const movement of oldMovements) {
    const id = movementId(movement);
    if (id) oldById.set(id, movement);
  }
  const seen = new Set<string>();
  const additions: StateRecord[] = [];
  for (const movement of newMovements) {
    const id = movementId(movement);
    if (!id || seen.has(id)) return 'Every stock movement must have a unique immutable identifier';
    seen.add(id);
    const original = oldById.get(id);
    if (original && JSON.stringify(original) !== JSON.stringify(movement)) return 'Recorded stock movements cannot be changed';
    if (!original) additions.push(movement);
  }
  if (oldById.size && [...oldById.keys()].some(id => !seen.has(id))) return 'Recorded stock movements cannot be deleted';

  const allowedTypes = new Set(['RECEIPT', 'OPENING_ALLOCATION', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'PRODUCTION_ISSUE', 'PRODUCTION_OUTPUT', 'CONSUMPTION_ISSUE']);
  for (const movement of additions) {
    const quantity = Number(movement.quantity);
    const type = typeof movement.type === 'string' ? movement.type : movement.movementType;
    const sourceType = typeof movement.sourceType === 'string' ? movement.sourceType : '';
    const note = typeof movement.note === 'string' ? movement.note.trim() : '';
    if (!allowedTypes.has(String(type)) || !Number.isFinite(quantity) || quantity === 0 || !sourceType) {
      return 'A new stock movement has invalid accounting details';
    }
    if ((type === 'ADJUSTMENT' || type === 'TRANSFER_IN' || type === 'TRANSFER_OUT') && note.length < 10) {
      return 'A reason of at least 10 characters is required for every adjustment or transfer';
    }
    if (type === 'ADJUSTMENT' && sourceType !== 'ADJUSTMENT') return 'Stock adjustments must be recorded as adjustment events';
    if (type === 'CONSUMPTION_ISSUE') {
      const useType = typeof movement.useType === 'string' ? movement.useType.trim() : '';
      const useLocation = typeof movement.useLocation === 'string' ? movement.useLocation.trim() : '';
      const issuedTo = typeof movement.issuedTo === 'string' ? movement.issuedTo.trim() : '';
      const issuedBy = typeof movement.issuedBy === 'string' ? movement.issuedBy.trim() : '';
      const issuedAt = typeof movement.issuedAt === 'string' ? Date.parse(movement.issuedAt) : Number.NaN;
      if (sourceType !== 'GOODS_OUTWARD' || quantity >= 0 || note.length < 10 || !useType || !useLocation || !issuedTo || !issuedBy || !Number.isFinite(issuedAt)) {
        return 'A goods-outward issue must identify its destination, purpose, responsible person, and issue time';
      }
    }
  }

  // The business record and the ledger event are a pair: neither can be
  // rewritten or inserted alone. This keeps the destination and purpose shown
  // in Goods outward tied to the quantity that actually left stock.
  const oldIssues = new Map(records(previous.goodsOutwards).map(issue => [String(issue.id ?? ''), issue]));
  const newIssues = new Map(records(next.goodsOutwards).map(issue => [String(issue.id ?? ''), issue]));
  for (const [issueId, oldIssue] of oldIssues) {
    if (!issueId || JSON.stringify(oldIssue) !== JSON.stringify(newIssues.get(issueId))) {
      return 'Recorded goods-outward issues cannot be changed or deleted';
    }
  }
  const addedIssueIds = new Set<string>();
  for (const [issueId, issue] of newIssues) {
    if (oldIssues.has(issueId)) continue;
    const requiredText = ['item', 'unit', 'warehouseName', 'useType', 'useLocation', 'purpose', 'issuedTo', 'issuedBy', 'issuedAt'];
    const warehouseId = issue.warehouseId;
    if (!issueId || requiredText.some(key => typeof issue[key] !== 'string' || !String(issue[key]).trim()) ||
      (typeof warehouseId !== 'string' && typeof warehouseId !== 'number') || !String(warehouseId).trim() ||
      !Number.isFinite(Number(issue.quantity)) || Number(issue.quantity) <= 0 || String(issue.purpose).trim().length < 10) {
      return 'A goods-outward issue is missing required traceability details';
    }
    addedIssueIds.add(issueId);
  }
  const consumptionMovementIds = new Set(additions
    .filter(movement => movement.type === 'CONSUMPTION_ISSUE' && movement.sourceType === 'GOODS_OUTWARD')
    .map(movement => String(movement.sourceId ?? '')));
  if ([...addedIssueIds].some(issueId => !consumptionMovementIds.has(issueId)) ||
    [...consumptionMovementIds].some(issueId => !addedIssueIds.has(issueId))) {
    return 'Every goods-outward record must have exactly one matching stock-consumption event';
  }

  // The stock-card quantity is an aggregate, never an independent source of
  // truth. Any card change must reconcile exactly to the newly appended
  // journal entries for that item. This also prevents direct edits to legacy
  // cards that have not yet had a movement recorded.
  const addedQuantityByItem = new Map<string, number>();
  additions.forEach(movement => {
    const name = String(movement.item ?? movement.itemName ?? '').trim().toLowerCase();
    if (name) addedQuantityByItem.set(name, (addedQuantityByItem.get(name) ?? 0) + Number(movement.quantity));
  });
  const oldStock = new Map(records(previous.stock).map(item => [String(item.id ?? item.name ?? ''), item]));
  const nextStockKeys = new Set<string>();
  for (const item of records(next.stock)) {
    const key = String(item.id ?? item.name ?? '');
    nextStockKeys.add(key);
    const original = oldStock.get(key);
    const name = String(item.name ?? '').trim().toLowerCase();
    const oldQuantity = original ? Number(original.qty) : 0;
    const newQuantity = Number(item.qty);
    if (!Number.isFinite(newQuantity) || !Number.isFinite(oldQuantity)) return 'Stock quantities must be valid numbers';
    const delta = Math.round((newQuantity - oldQuantity) * 1e6) / 1e6;
    const journalDelta = Math.round((addedQuantityByItem.get(name) ?? 0) * 1e6) / 1e6;
    if (delta !== 0 && delta !== journalDelta) {
      return 'Stock card quantities must reconcile to newly recorded receiving, usage, transfer, or adjustment events';
    }
  }
  if ([...oldStock.keys()].some(key => !nextStockKeys.has(key))) return 'Stock cards cannot be deleted; record a documented write-off or adjustment instead';
  return null;
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

  const inventoryError = inventoryIntegrityError(current?.payload ?? null, body.payload);
  if (inventoryError) return NextResponse.json({ error: inventoryError }, { status: 422 });

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
