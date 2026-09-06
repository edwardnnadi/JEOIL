import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { authorize } from '../../../lib/auth';
import { getDb } from '../../../db';
import { operationsState } from '../../../db/schema';

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
  return NextResponse.json({ payload });
}

export async function POST(request: Request) {
  if (!(await authorize())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
  await getDb().insert(operationsState).values({ id: 'main', payload: body.payload, updatedAt: new Date() }).onConflictDoUpdate({ target: operationsState.id, set: { payload: body.payload, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
