import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../../db';
import { suppliers } from '../../../../db/schema';
import { authorize } from '../../../../lib/auth';
import { badRequest, notFound, optionalText, readBody, text, unauthorized } from '../../../../lib/http';
import { nextRef } from '../../../../lib/refs';

const statuses = new Set(['ACTIVE', 'SUSPENDED', 'ARCHIVED']);

function present(row: typeof suppliers.$inferSelect) {
  return { ...row, suppliedItems: JSON.parse(row.suppliedItems) as string[] };
}

export async function GET() {
  if (!(await authorize())) return unauthorized();
  const rows = await getDb().select().from(suppliers).orderBy(desc(suppliers.createdAt));
  return NextResponse.json({ suppliers: rows.map(present) });
}

export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return unauthorized();
  const body = await readBody(request);
  if (!body) return badRequest('Invalid request body');

  const name = text(body.name);
  if (!name) return badRequest('Supplier name is required');

  const suppliedItems = Array.isArray(body.suppliedItems)
    ? body.suppliedItems.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  const now = new Date();
  const row = {
    id: crypto.randomUUID(),
    code: await nextRef('SUPPLIER'),
    name,
    contactName: optionalText(body.contactName),
    phone: optionalText(body.phone),
    email: optionalText(body.email),
    address: optionalText(body.address),
    suppliedItems: JSON.stringify(suppliedItems),
    status: 'ACTIVE',
    createdBy: user.email,
    createdAt: now,
  };
  await getDb().insert(suppliers).values(row);
  return NextResponse.json({ supplier: present(row) }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await authorize())) return unauthorized();
  const body = await readBody(request);
  if (!body) return badRequest('Invalid request body');
  const id = text(body.id);
  if (!id) return badRequest('Supplier id is required');

  const db = getDb();
  const existing = await db.select().from(suppliers).where(eq(suppliers.id, id)).get();
  if (!existing) return notFound('Supplier not found');

  const status = text(body.status);
  if (status && !statuses.has(status)) return badRequest('Unknown supplier status');

  const updates: Partial<typeof suppliers.$inferInsert> = {};
  if (text(body.name)) updates.name = text(body.name) as string;
  if ('contactName' in body) updates.contactName = optionalText(body.contactName);
  if ('phone' in body) updates.phone = optionalText(body.phone);
  if ('email' in body) updates.email = optionalText(body.email);
  if ('address' in body) updates.address = optionalText(body.address);
  if (Array.isArray(body.suppliedItems)) {
    updates.suppliedItems = JSON.stringify(
      body.suppliedItems.filter((item): item is string => typeof item === 'string' && item.trim().length > 0),
    );
  }
  if (status) updates.status = status;

  // The supplier code is server-allocated and referenced by historical
  // documents, so it is deliberately absent from the updatable fields.
  if (Object.keys(updates).length === 0) return badRequest('No supported fields to update');

  const [updated] = await db.update(suppliers).set(updates).where(eq(suppliers.id, id)).returning();
  return NextResponse.json({ supplier: present(updated) });
}
