import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { getDb } from '../../../../db';
import { activityLog, operationsState } from '../../../../db/schema';

const ACCOUNT_ID = 'b079fe48a08e73449253807b0033a7f8';
const WORKER_NAME = 'je-oils-operations';
const SECRET_NAME = 'OPENAI_API_KEY';
const MODEL = 'gpt-5.6-luna';

type Person = { email?: unknown; role?: unknown };

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function administrator() {
  const email = (await headers()).get('cf-access-authenticated-user-email')?.trim().toLowerCase();
  if (!email) return null;
  const state = await getDb().select().from(operationsState).where(eq(operationsState.id, 'main')).get();
  if (!state) return null;
  try {
    const people = (JSON.parse(state.payload).people ?? []) as Person[];
    return people.some((person) =>
      typeof person.email === 'string' && person.email.toLowerCase() === email &&
      typeof person.role === 'string' && person.role.trim().toLowerCase() === 'administrator',
    ) ? email : null;
  } catch {
    return null;
  }
}

function secretAutomationToken() {
  return (env as unknown as Record<string, string | undefined>).CF_WORKER_SECRETS_API_TOKEN;
}

async function verifyOpenAiKey(apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: 'Reply only: Connection verified.', max_output_tokens: 16, store: false }),
  });
  if (response.ok) return;
  if (response.status === 401) throw new Error('OpenAI rejected this API key. Create a new project API key and try again.');
  if (response.status === 403) throw new Error('This API key does not have access to the configured AI model.');
  if (response.status === 429) throw new Error('OpenAI could not run the test because the project has no available API credit or has reached its limit.');
  throw new Error('OpenAI could not verify this key. Check its project, billing, and model access.');
}

async function writeWorkerSecret(apiKey: string) {
  const token = secretAutomationToken();
  if (!token) throw new Error('AI Settings is not connected to Cloudflare yet. An owner must add CF_WORKER_SECRETS_API_TOKEN once.');
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${WORKER_NAME}/secrets/${SECRET_NAME}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'secret_text', text: apiKey }),
    },
  );
  const result = await response.json().catch(() => null) as { success?: boolean; errors?: Array<{ message?: string }> } | null;
  if (!response.ok || !result?.success) throw new Error(result?.errors?.[0]?.message ?? 'Cloudflare could not save the encrypted key.');
}

async function audit(email: string, action: string, details: string) {
  await getDb().insert(activityLog).values({
    id: crypto.randomUUID(), userId: email, userName: email, userEmail: email,
    action, details, occurredAt: new Date(),
  });
}

export async function GET() {
  const email = await administrator();
  if (!email) return error('Administrator access is required.', 403);
  const configured = Boolean((env as unknown as Record<string, string | undefined>)[SECRET_NAME]);
  return NextResponse.json({ configured, automationConfigured: Boolean(secretAutomationToken()), model: MODEL });
}

export async function POST(request: Request) {
  const email = await administrator();
  if (!email) return error('Administrator access is required.', 403);
  const body = await request.json().catch(() => null) as { apiKey?: unknown } | null;
  const apiKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!apiKey.startsWith('sk-') || apiKey.length < 20 || apiKey.length > 500) {
    return error('Enter a valid OpenAI project API key.', 400);
  }
  try {
    // Validate before storing. The key is never written to D1, logs, or a response.
    await verifyOpenAiKey(apiKey);
    await writeWorkerSecret(apiKey);
    await audit(email, 'Updated AI integration key', 'Verified and replaced the encrypted OpenAI API key through AI Settings.');
    return NextResponse.json({ ok: true, message: 'OpenAI connection verified and saved securely.' });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'AI settings could not be saved.';
    await audit(email, 'AI integration update failed', 'An OpenAI API key update was attempted but was not saved.');
    return error(message, 502);
  }
}
