import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { operationsState } from '../../../db/schema';

const OWNERS = new Set(['edward@nnadi.com', 'edward.nnadi@jeanedwards.com']);

async function authorize() {
  const user = await getChatGPTUser();
  return user && OWNERS.has(user.email.toLowerCase()) ? user : null;
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
  return NextResponse.json({ payload });
}

export async function POST(request: Request) {
  if (!(await authorize())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();
  if (typeof body.payload !== 'string' || body.payload.length > 1_000_000) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  await getDb().insert(operationsState).values({ id: 'main', payload: body.payload, updatedAt: new Date() }).onConflictDoUpdate({ target: operationsState.id, set: { payload: body.payload, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
