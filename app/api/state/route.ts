import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { operationsState } from '../../../db/schema';

const OWNER = 'edward.nnadi@jeanedwards.com';

async function authorize() {
  const user = await getChatGPTUser();
  return user?.email.toLowerCase() === OWNER ? user : null;
}

export async function GET() {
  if (!(await authorize())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const row = await getDb().select().from(operationsState).where(eq(operationsState.id, 'main')).get();
  return NextResponse.json({ payload: row?.payload ?? null });
}

export async function POST(request: Request) {
  if (!(await authorize())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const body = await request.json();
  if (typeof body.payload !== 'string' || body.payload.length > 1_000_000) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  await getDb().insert(operationsState).values({ id: 'main', payload: body.payload, updatedAt: new Date() }).onConflictDoUpdate({ target: operationsState.id, set: { payload: body.payload, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
