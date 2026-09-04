import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import {
  qcParameterDefinitions,
  qcTestResultParameters,
  qcTestResults,
} from '../../../db/schema';

const OWNERS = new Set(['edward@nnadi.com', 'edward.nnadi@jeanedwards.com']);
const contexts = ['RAW_MATERIAL', 'FINISHED_PRODUCT'] as const;
const stages = ['RECEIPT', 'IN_PROCESS', 'FINAL'] as const;
const comparators = ['LTE', 'GTE', 'EQ', 'IN'] as const;

type Context = (typeof contexts)[number];
type Stage = (typeof stages)[number];
type Comparator = (typeof comparators)[number];
type SubmittedValue = string | number;

type Definition = {
  id: string;
  context: string;
  stage: string | null;
  parameterKey: string;
  displayName: string;
  unit: string | null;
  dataType: string;
  comparator: string;
  thresholdValue: number | null;
  allowedValues: string;
  isCritical: boolean;
  regulatoryRef: string | null;
};

async function authorize() {
  const user = await getChatGPTUser();
  return user && OWNERS.has(user.email.toLowerCase()) ? user : null;
}

const seedDefinitions = [
  ['raw-moisture-v1', 'RAW_MATERIAL', 'RECEIPT', 'moisture', 'Moisture', '%', 'NUMERIC', 'LTE', null, [], false, null],
  ['raw-oil-content-v1', 'RAW_MATERIAL', 'RECEIPT', 'oil_content', 'Oil Content', '%', 'NUMERIC', 'GTE', 45, [], true, null],
  ['raw-ffa-v1', 'RAW_MATERIAL', 'RECEIPT', 'ffa', 'FFA', '%', 'NUMERIC', 'LTE', 4, [], true, null],
  ['raw-foreign-matter-v1', 'RAW_MATERIAL', 'RECEIPT', 'foreign_matter', 'Foreign Matter', '%', 'NUMERIC', 'LTE', 0.2, [], true, null],
  ['raw-aflatoxin-v1', 'RAW_MATERIAL', 'RECEIPT', 'aflatoxin', 'Total Aflatoxin', 'ppb', 'NUMERIC', 'LTE', 10, [], true, null],
  ['product-in-process-ffa-v1', 'FINISHED_PRODUCT', 'IN_PROCESS', 'ffa', 'FFA', '%', 'NUMERIC', 'LTE', 2, [], true, 'NIS 388'],
  ['product-in-process-moisture-v1', 'FINISHED_PRODUCT', 'IN_PROCESS', 'moisture', 'Moisture', '%', 'NUMERIC', 'LTE', 0.2, [], true, 'NIS 388'],
  ['product-in-process-peroxide-v1', 'FINISHED_PRODUCT', 'IN_PROCESS', 'peroxide_value', 'Peroxide Value', 'meq O₂/kg', 'NUMERIC', 'LTE', 10, [], true, 'NIS 388'],
  ['product-in-process-appearance-v1', 'FINISHED_PRODUCT', 'IN_PROCESS', 'appearance', 'Colour/Appearance', null, 'ENUM', 'IN', null, ['Clear', 'Characteristic'], true, 'NIS 388'],
  ['product-in-process-odour-v1', 'FINISHED_PRODUCT', 'IN_PROCESS', 'odour', 'Odour', null, 'ENUM', 'IN', null, ['Characteristic', 'Good', 'Free from rancid odour'], true, 'NIS 388'],
  ['product-final-ffa-v1', 'FINISHED_PRODUCT', 'FINAL', 'ffa', 'FFA', '%', 'NUMERIC', 'LTE', 2, [], true, 'NIS 388'],
  ['product-final-moisture-v1', 'FINISHED_PRODUCT', 'FINAL', 'moisture', 'Moisture', '%', 'NUMERIC', 'LTE', 0.2, [], true, 'NIS 388'],
  ['product-final-peroxide-v1', 'FINISHED_PRODUCT', 'FINAL', 'peroxide_value', 'Peroxide Value', 'meq O₂/kg', 'NUMERIC', 'LTE', 10, [], true, 'NIS 388'],
  ['product-final-appearance-v1', 'FINISHED_PRODUCT', 'FINAL', 'appearance', 'Colour/Appearance', null, 'ENUM', 'IN', null, ['Clear', 'Characteristic'], true, 'NIS 388'],
  ['product-final-odour-v1', 'FINISHED_PRODUCT', 'FINAL', 'odour', 'Odour', null, 'ENUM', 'IN', null, ['Characteristic', 'Good', 'Free from rancid odour'], true, 'NIS 388'],
] as const;

async function definitionsFor(context: Context, stage: Stage): Promise<Definition[]> {
  const db = getDb();
  const now = new Date();
  let definitions = await db
    .select()
    .from(qcParameterDefinitions)
    .where(
      and(
        eq(qcParameterDefinitions.context, context),
        or(eq(qcParameterDefinitions.stage, stage), isNull(qcParameterDefinitions.stage)),
        isNull(qcParameterDefinitions.effectiveTo),
        lte(qcParameterDefinitions.effectiveFrom, now),
      ),
    );

  if (definitions.length === 0) {
    const createdAt = new Date();
    // D1 has a conservative SQL-variable limit, so seed one definition per
    // statement rather than generating a single wide multi-row insert.
    for (const definition of seedDefinitions) {
      await db
        .insert(qcParameterDefinitions)
        .values({
          id: definition[0], context: definition[1], stage: definition[2], parameterKey: definition[3], displayName: definition[4], unit: definition[5], dataType: definition[6], comparator: definition[7], thresholdValue: definition[8], allowedValues: JSON.stringify(definition[9]), isCritical: definition[10], regulatoryRef: definition[11], effectiveFrom: createdAt, createdBy: 'system-seed', createdAt,
        })
        .onConflictDoNothing();
    }
    definitions = await db
      .select()
      .from(qcParameterDefinitions)
      .where(
        and(
          eq(qcParameterDefinitions.context, context),
          or(eq(qcParameterDefinitions.stage, stage), isNull(qcParameterDefinitions.stage)),
          isNull(qcParameterDefinitions.effectiveTo),
        ),
      );
  }

  return definitions;
}

function isContext(value: unknown): value is Context {
  return typeof value === 'string' && contexts.includes(value as Context);
}

function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && stages.includes(value as Stage);
}

function asValues(value: unknown): Record<string, SubmittedValue> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.entries(value).every(([, entry]) => typeof entry === 'string' || typeof entry === 'number')
    ? (value as Record<string, SubmittedValue>)
    : null;
}

function parameterStatus(value: SubmittedValue | undefined, comparator: Comparator, threshold: number | null, allowedValues: string[]) {
  if (value === undefined || value === null || value === '') return 'MISSING' as const;
  if (comparator === 'IN') return allowedValues.includes(String(value)) ? 'PASS' : 'FAIL';
  const numericValue = Number(value);
  // A deliberately open advisory limit (raw-material moisture at launch) is
  // recorded as not yet evaluable, never presented as a failed test.
  if (threshold === null) return 'MISSING' as const;
  if (!Number.isFinite(numericValue)) return 'FAIL' as const;
  if (comparator === 'LTE') return numericValue <= threshold ? 'PASS' : 'FAIL';
  if (comparator === 'GTE') return numericValue >= threshold ? 'PASS' : 'FAIL';
  return numericValue === threshold ? 'PASS' : 'FAIL';
}

function thresholdLabel(comparator: Comparator, threshold: number | null, allowedValues: string[]) {
  return comparator === 'IN' ? allowedValues.join(' / ') : String(threshold ?? 'Not set');
}

export async function GET(request: Request) {
  if (!(await authorize())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const context = searchParams.get('context');
  const stage = searchParams.get('stage');
  if (!isContext(context) || !isStage(stage)) return NextResponse.json({ error: 'Invalid QC context or stage' }, { status: 400 });
  const definitions = await definitionsFor(context, stage);
  return NextResponse.json({ definitions: definitions.map((definition) => ({ ...definition, allowedValues: JSON.parse(definition.allowedValues) as string[] })) });
}

export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const body: unknown = await request.json();
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (!isContext(input.context) || !isStage(input.stage) || typeof input.batchRef !== 'string' || !input.batchRef.trim() || !asValues(input.values)) {
    return NextResponse.json({ error: 'Invalid QC submission' }, { status: 400 });
  }

  const definitions = await definitionsFor(input.context, input.stage);
  const values = input.values as Record<string, SubmittedValue>;
  const outcomes = definitions.map((definition) => {
    const comparator = definition.comparator as Comparator;
    const allowedValues = JSON.parse(definition.allowedValues) as string[];
    const submittedValue = values[definition.parameterKey];
    return { parameterKey: definition.parameterKey, displayName: definition.displayName, submittedValue: submittedValue ?? null, unit: definition.unit, comparator, threshold: thresholdLabel(comparator, definition.thresholdValue, allowedValues), isCritical: definition.isCritical, status: parameterStatus(submittedValue, comparator, definition.thresholdValue, allowedValues) };
  });
  const blocked = outcomes.some((outcome) => outcome.isCritical && outcome.status !== 'PASS');
  const overallResult = input.context === 'RAW_MATERIAL' ? (blocked ? 'REJECT' : 'ACCEPT') : (blocked ? 'FAIL' : 'PASS');
  const db = getDb();
  const now = new Date();
  const resultId = crypto.randomUUID();
  await db.insert(qcTestResults).values({ id: resultId, context: input.context, stage: input.stage, batchRef: input.batchRef.trim(), testedBy: user.email, testedAt: now, overallResult, createdAt: now });
  await db.insert(qcTestResultParameters).values(outcomes.map((outcome) => ({ id: crypto.randomUUID(), qcTestResultId: resultId, parameterKey: outcome.parameterKey, displayName: outcome.displayName, submittedValue: String(outcome.submittedValue ?? ''), unit: outcome.unit, comparator: outcome.comparator, thresholdSnapshot: outcome.threshold, isCritical: outcome.isCritical, status: outcome.status })));
  return NextResponse.json({ id: resultId, context: input.context, stage: input.stage, batchRef: input.batchRef.trim(), testedBy: user.email, testedAt: now.toISOString(), overallResult, passed: outcomes.filter((outcome) => outcome.status === 'PASS'), failed: outcomes.filter((outcome) => outcome.status === 'FAIL'), missing: outcomes.filter((outcome) => outcome.status === 'MISSING'), allParameters: outcomes });
}
