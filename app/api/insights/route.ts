import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { authorize } from '../../../lib/auth';
import { getDb } from '../../../db';
import { operationsState } from '../../../db/schema';

const MAX_QUESTION_LENGTH = 1_500;

function operationSnapshot(rawState: unknown) {
  const state = (rawState && typeof rawState === 'object' ? rawState : {}) as Record<string, unknown>;
  const list = (name: string, limit = 150) => Array.isArray(state[name]) ? state[name].slice(0, limit) : [];

  // Deliberately omit People contact details, attachments, and credentials. The model only needs operational facts.
  return {
    generatedAt: new Date().toISOString(),
    suppliers: list('suppliers').map((supplier) => {
      const value = supplier as Record<string, unknown>;
      return { name: value.name, products: value.products };
    }),
    stock: list('stock'),
    purchases: list('purchases'),
    goodsInwardsAssessments: list('assessments'),
    productionRuns: list('production'),
    warehouses: list('warehouses'),
  };
}

function responseText(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const response = payload as { output_text?: unknown; output?: unknown[] };
  if (typeof response.output_text === 'string') return response.output_text.trim();
  return (response.output ?? [])
    .flatMap((item) => {
      if (!item || typeof item !== 'object' || !Array.isArray((item as { content?: unknown }).content)) return [];
      return (item as { content: Array<{ type?: unknown; text?: unknown }> }).content
        .filter((content) => content.type === 'output_text' && typeof content.text === 'string')
        .map((content) => content.text as string);
    })
    .join('\n')
    .trim();
}

export async function POST(request: Request) {
  if (!(await authorize())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const body = await request.json().catch(() => null) as { question?: unknown } | null;
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: 'Enter a question of up to 1,500 characters.' }, { status: 400 });
  }

  const apiKey = (env as unknown as Record<string, string | undefined>).OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: 'AI Insights has not been connected to an OpenAI API project yet.',
      code: 'AI_NOT_CONFIGURED',
    }, { status: 503 });
  }

  const stateRow = await getDb().select().from(operationsState).where(eq(operationsState.id, 'main')).get();
  if (!stateRow) return NextResponse.json({ error: 'Operational data is not available yet.' }, { status: 404 });

  try {
    const snapshot = operationSnapshot(JSON.parse(stateRow.payload));
    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        store: false,
        instructions: [
          'You are the JE Oils operational insights assistant for a Nigerian edible-oils producer.',
          'Answer only from the supplied operational snapshot. Do not invent data, assumptions, suppliers, or measurements.',
          'Be concise, practical, and use Nigerian naira where monetary values are present.',
          'When comparing runs or records, name the records and explain the calculation or limitation.',
          'Call out operational risks such as low stock, missing quality decisions, supplier concentration, or incomplete production records.',
          'Use short headings and bullet points when useful.',
        ].join(' '),
        input: `Operational snapshot:\n${JSON.stringify(snapshot)}\n\nUser question: ${question}`,
      }),
    });

    const payload = await openAiResponse.json().catch(() => null);
    if (!openAiResponse.ok) {
      return NextResponse.json({ error: 'The AI service could not complete this request. Please try again.' }, { status: 502 });
    }

    const answer = responseText(payload);
    if (!answer) return NextResponse.json({ error: 'The AI service returned no answer. Please try again.' }, { status: 502 });
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: 'AI Insights could not analyse the current operational data.' }, { status: 500 });
  }
}
