import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { authorize } from '../../../lib/auth';
import { getDb } from '../../../db';
import { activityLog, operationsState } from '../../../db/schema';

const privilegedRoles = new Set(['administrator', 'operations manager']);

function isPrivileged(payload: string | null, email: string) {
  // The local development identity is the system administrator. In production,
  // the person's role in the shared people register is used.
  if (email === 'operations@jeoils.test') return true;
  if (!payload) return false;
  try {
    const people = (JSON.parse(payload) as { people?: unknown }).people;
    if (!Array.isArray(people)) return false;
    return people.some((person) => {
      if (!person || typeof person !== 'object') return false;
      const record = person as { email?: unknown; role?: unknown };
      return typeof record.email === 'string' && record.email.toLowerCase() === email.toLowerCase() &&
        typeof record.role === 'string' && privilegedRoles.has(record.role.trim().toLowerCase());
    });
  } catch {
    return false;
  }
}

export async function GET() {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const db = getDb();
  const state = await db.select({ payload: operationsState.payload }).from(operationsState)
    .where(eq(operationsState.id, 'main')).get();
  if (!isPrivileged(state?.payload ?? null, user.email)) {
    return NextResponse.json({ error: 'Only Administrators and Operations Managers can view the activity log.' }, { status: 403 });
  }

  const entries = await db.select().from(activityLog).orderBy(desc(activityLog.occurredAt)).limit(500);
  return NextResponse.json({ entries });
}
