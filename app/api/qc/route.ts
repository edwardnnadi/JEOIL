import { NextResponse } from 'next/server';
import { authorize } from '../../../lib/auth';
import {
  asValues,
  asFieldComparison,
  definitionsFor,
  evaluateAndRecordQc,
  isContext,
  isStage,
} from '../../../lib/qc';

export async function GET(request: Request) {
  if (!(await authorize())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const context = searchParams.get('context');
  const stage = searchParams.get('stage');
  if (!isContext(context) || !isStage(stage)) {
    return NextResponse.json({ error: 'Invalid QC context or stage' }, { status: 400 });
  }
  const definitions = await definitionsFor(context, stage);
  return NextResponse.json({
    definitions: definitions.map((definition) => ({
      ...definition,
      allowedValues: JSON.parse(definition.allowedValues) as string[],
    })),
  });
}

export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const body: unknown = await request.json();
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const input = body as Record<string, unknown>;
  const values = asValues(input.values);
  const fieldComparison = input.fieldComparison === undefined ? undefined : asFieldComparison(input.fieldComparison);
  if (!isContext(input.context) || !isStage(input.stage) || typeof input.batchRef !== 'string' || !input.batchRef.trim() || !values) {
    return NextResponse.json({ error: 'Invalid QC submission' }, { status: 400 });
  }
  if (input.fieldComparison !== undefined && !fieldComparison) return NextResponse.json({ error: 'Invalid field QC comparison' }, { status: 400 });

  const evaluation = await evaluateAndRecordQc({
    context: input.context,
    stage: input.stage,
    batchRef: input.batchRef,
    values,
    testedBy: user.email,
    fieldComparison,
  });
  return NextResponse.json(evaluation);
}
