import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { getDb } from '../../../../db';
import { operationsState } from '../../../../db/schema';

const ACCOUNT_ID = 'b079fe48a08e73449253807b0033a7f8';
const APPLICATION_DOMAIN = 'app.jeoilsoperations.com';

type Person = { email?: unknown; role?: unknown };
type AccessApplication = { id: string; domain?: string };

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function requestingAdministrator() {
  const requestHeaders = await headers();
  const email = requestHeaders.get('cf-access-authenticated-user-email')?.trim().toLowerCase();
  if (!email) return null;

  const state = await getDb().select().from(operationsState).where(eq(operationsState.id, 'main')).get();
  if (!state) return null;
  try {
    const people = (JSON.parse(state.payload).people ?? []) as Person[];
    return people.some(
      (person) =>
        typeof person.email === 'string' &&
        person.email.toLowerCase() === email &&
        typeof person.role === 'string' &&
        person.role.toLowerCase() === 'administrator',
    )
      ? email
      : null;
  } catch {
    return null;
  }
}

async function cloudflare(path: string, init: RequestInit = {}) {
  const token = (env as unknown as Record<string, string | undefined>).CF_ACCESS_API_TOKEN;
  if (!token) throw new Error('Cloudflare Access provisioning has not been configured.');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const payload = (await response.json()) as { success: boolean; result?: unknown; errors?: Array<{ message?: string }> };
  if (!response.ok || !payload.success) {
    throw new Error(payload.errors?.[0]?.message ?? 'Cloudflare Access could not update the user policy.');
  }
  return payload.result;
}

export async function POST(request: Request) {
  if (!(await requestingAdministrator())) return jsonError('Administrator access is required.', 403);
  const body = (await request.json()) as { name?: unknown; email?: unknown; role?: unknown; phone?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const role = typeof body.role === 'string' ? body.role.trim() : '';
  if (!/^\S+@\S+\.\S+$/.test(email)) return jsonError('A valid email address is required.', 400);
  if (!name || !role) return jsonError('A user name and role are required.', 400);

  try {
    const db = getDb();
    const stateRow = await db.select().from(operationsState).where(eq(operationsState.id, 'main')).get();
    if (!stateRow) return jsonError('Operational state is not available.', 500);
    const state = JSON.parse(stateRow.payload) as { people?: Array<Record<string, unknown>>; roles?: string[] };
    state.people ??= [];
    if (state.people.some((person) => typeof person.email === 'string' && person.email.toLowerCase() === email)) {
      return jsonError('A user with this email already exists.', 409);
    }

    const apps = (await cloudflare('/access/apps')) as AccessApplication[];
    const app = apps.find((candidate) => candidate.domain === APPLICATION_DOMAIN);
    if (!app) return jsonError('The JE Oils Cloudflare Access application was not found.', 500);

    const policy = await cloudflare(`/access/apps/${app.id}/policies`, {
      method: 'POST',
      body: JSON.stringify({
        name: `JE Oils user: ${email}`,
        decision: 'allow',
        include: [{ email: { email } }],
      }),
    }) as { id: string };

    const person = {
      id: Date.now(), name, type: 'User', role, email,
      phone: typeof body.phone === 'string' ? body.phone.trim() : '',
      accessPolicyId: policy.id, accessStatus: 'Active',
    };
    state.people.unshift(person);
    state.roles ??= [];
    if (!state.roles.includes(role)) state.roles.push(role);
    await db.update(operationsState).set({ payload: JSON.stringify(state), updatedAt: new Date() }).where(eq(operationsState.id, 'main'));

    return NextResponse.json({ ok: true, person }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'User access could not be provisioned.', 502);
  }
}
