import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { customers } from '../../../../db/schema';
import { authorize } from '../../../../lib/auth';
import { badRequest, notFound, optionalText, readBody, text, unauthorized } from '../../../../lib/http';
import { nextRef } from '../../../../lib/refs';

const statuses = new Set(['ACTIVE', 'ON_HOLD', 'ARCHIVED']);

export async function GET() {
  if (!(await authorize())) return unauthorized();
  const rows = await getDb().select().from(customers).orderBy(desc(customers.createdAt));
  return NextResponse.json({ customers: rows });
}

export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return unauthorized();
  const body = await readBody(request);
  if (!body) return badRequest('Invalid request body');

  const name = text(body.name);
  if (!name) return badRequest('Customer name is required');

  const now = new Date();
  const row = {
    id: crypto.randomUUID(),
    code: await nextRef('CUSTOMER'),
    name,
    contactName: optionalText(body.contactName),
    phone: optionalText(body.phone),
    email: optionalText(body.email),
    address: optionalText(body.address),
    status: 'ACTIVE',
    createdBy: user.email,
    createdAt: now,
  };
  await getDb().insert(customers).values(row);
  return NextResponse.json({ customer: row }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await authorize())) return unauthorized();
  const body = await readBody(request);
  if (!body) return badRequest('Invalid request body');
  const id = text(body.id);
  if (!id) return badRequest('Customer id is required');

  const db = getDb();
  const existing = await db.select().from(customers).where(eq(customers.id, id)).get();
  if (!existing) return notFound('Customer not found');

  const status = text(body.status);
  if (status && !statuses.has(status)) return badRequest('Unknown customer status');

  const updates: Partial<typeof customers.$inferInsert> = {};
  if (text(body.name)) updates.name = text(body.name) as string;
  if ('contactName' in body) updates.contactName = optionalText(body.contactName);
  if ('phone' in body) updates.phone = optionalText(body.phone);
  if ('email' in body) updates.email = optionalText(body.email);
  if ('address' in body) updates.address = optionalText(body.address);
  if (status) updates.status = status;
  if (Object.keys(updates).length === 0) return badRequest('No supported fields to update');

  const [updated] = await db.update(customers).set(updates).where(eq(customers.id, id)).returning();
  return NextResponse.json({ customer: updated });
}
