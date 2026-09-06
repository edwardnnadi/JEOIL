import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { getDb } from '../db';
import {
  qcParameterDefinitions,
  qcTestResultParameters,
  qcTestResults,
} from '../db/schema';

export const contexts = ['RAW_MATERIAL', 'FINISHED_PRODUCT'] as const;
export const stages = ['RECEIPT', 'IN_PROCESS', 'FINAL'] as const;
const comparators = ['LTE', 'GTE', 'EQ', 'IN'] as const;

export type QcContext = (typeof contexts)[number];
export type QcStage = (typeof stages)[number];
export type Comparator = (typeof comparators)[number];
export type SubmittedValue = string | number;

export type FieldComparison = {
  baseline: Record<string, number | null>;
  received: Record<string, number | null>;
};

export type ParameterOutcome = {
  parameterKey: string;
  displayName: string;
  submittedValue: SubmittedValue | null;
  unit: string | null;
  comparator: Comparator;
  threshold: string;
  isCritical: boolean;
  /**
   * RECORDED is distinct from MISSING: the reading was taken and stored, but
   * the parameter carries no reject limit by design. Moisture is the case that
   * matters — it drives supplier settlement, never the QC verdict — and calling
   * a captured reading "missing" misrepresents the test that was performed.
   */
  status: 'PASS' | 'FAIL' | 'MISSING' | 'RECORDED';
};

export type QcEvaluation = {
  id: string;
  context: QcContext;
  stage: QcStage;
  batchRef: string;
  testedBy: string;
  testedAt: string;
  overallResult: 'ACCEPT' | 'REJECT' | 'PASS' | 'FAIL';
  passed: ParameterOutcome[];
  failed: ParameterOutcome[];
  missing: ParameterOutcome[];
  recorded: ParameterOutcome[];
  allParameters: ParameterOutcome[];
};

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

/**
 * Raw-material rejection limits are oil content, FFA, foreign matter, defective
 * kernels and aflatoxin. Moisture is deliberately absent: the live tracker
 * accepts a receipt at 8.2%, and moisture instead drives the supplier
 * settlement calculation at an 8% payment base. The older POC workbook states
 * moisture ≤ 8% as a limit; the live tracker supersedes it until the QC lead
 * approves a separate reject limit, at which point this row gains a threshold
 * and isCritical is set.
 */
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

export async function definitionsFor(context: QcContext, stage: QcStage): Promise<Definition[]> {
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

export function isContext(value: unknown): value is QcContext {
  return typeof value === 'string' && contexts.includes(value as QcContext);
}

export function isStage(value: unknown): value is QcStage {
  return typeof value === 'string' && stages.includes(value as QcStage);
}

export function asValues(value: unknown): Record<string, SubmittedValue> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.entries(value).every(([, entry]) => typeof entry === 'string' || typeof entry === 'number')
    ? (value as Record<string, SubmittedValue>)
    : null;
}

const fieldComparisonRules = [
  ['quantity', 'Quantity received', 'GTE', 0.005, 'relative'],
  ['oilContent', 'Oil Content', 'GTE', 0.1, 'absolute'],
  ['ffa', 'FFA', 'LTE', 0.1, 'absolute'],
  ['moisture', 'Moisture', 'LTE', 0.1, 'absolute'],
  ['damaged', 'Damaged kernels', 'LTE', 0.1, 'absolute'],
  ['foreignMatter', 'Foreign Matter', 'LTE', 0.1, 'absolute'],
  ['aflatoxin', 'Total Aflatoxin', 'LTE', 1, 'absolute'],
] as const;

export function asFieldComparison(value: unknown): FieldComparison | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (!candidate.baseline || !candidate.received || typeof candidate.baseline !== 'object' || typeof candidate.received !== 'object') return null;
  const normalise = (source: unknown) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
    const result: Record<string, number | null> = {};
    for (const [key, raw] of Object.entries(source)) {
      if (!fieldComparisonRules.some(([ruleKey]) => ruleKey === key)) continue;
      if (raw === null || raw === '') { result[key] = null; continue; }
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
      result[key] = raw;
    }
    return result;
  };
  const baseline = normalise(candidate.baseline), received = normalise(candidate.received);
  return baseline && received ? { baseline, received } : null;
}

function fieldComparisonOutcomes(comparison?: FieldComparison): ParameterOutcome[] {
  if (!comparison) return [];
  return fieldComparisonRules.flatMap(([key, displayName, comparator, tolerance, kind]) => {
    const baseline = comparison.baseline[key], received = comparison.received[key];
    if (baseline === null || baseline === undefined || received === null || received === undefined) return [];
    const threshold = comparator === 'GTE'
      ? baseline - (kind === 'relative' ? baseline * tolerance : tolerance)
      : baseline + tolerance;
    const status = parameterStatus(received, comparator, threshold, []);
    const toleranceLabel = kind === 'relative' ? '0.5%' : key === 'aflatoxin' ? '1 ppb' : '0.1 percentage points';
    return [{
      parameterKey: `field_comparison_${key}`,
      displayName: `Field QC comparison — ${displayName}`,
      submittedValue: received,
      unit: key === 'quantity' ? null : key === 'aflatoxin' ? 'ppb' : '%',
      comparator,
      threshold: `Field result ${baseline}; tolerance ${toleranceLabel}; ${comparator === 'GTE' ? 'minimum' : 'maximum'} ${Number(threshold.toFixed(3))}`,
      isCritical: true,
      status,
    }];
  });
}

function parameterStatus(
  value: SubmittedValue | undefined,
  comparator: Comparator,
  threshold: number | null,
  allowedValues: string[],
): ParameterOutcome['status'] {
  if (value === undefined || value === null || value === '') return 'MISSING';
  if (comparator === 'IN') return allowedValues.includes(String(value)) ? 'PASS' : 'FAIL';
  const numericValue = Number(value);
  // A parameter with no configured limit is advisory: the reading is kept for
  // analysis and settlement, and never presented as a passed or failed test.
  if (threshold === null) return 'RECORDED';
  if (!Number.isFinite(numericValue)) return 'FAIL';
  if (comparator === 'LTE') return numericValue <= threshold ? 'PASS' : 'FAIL';
  if (comparator === 'GTE') return numericValue >= threshold ? 'PASS' : 'FAIL';
  return numericValue === threshold ? 'PASS' : 'FAIL';
}

function thresholdLabel(comparator: Comparator, threshold: number | null, allowedValues: string[]) {
  if (comparator === 'IN') return allowedValues.join(' / ');
  return threshold === null ? 'No reject limit — recorded only' : String(threshold);
}

/**
 * The single place a quality verdict is reached. Both the standalone QC screen
 * and the goods-receipt / finished-goods gates call this, so there is no second
 * implementation that could drift from the rulebook.
 */
export async function evaluateAndRecordQc(input: {
  context: QcContext;
  stage: QcStage;
  batchRef: string;
  values: Record<string, SubmittedValue>;
  testedBy: string;
  fieldComparison?: FieldComparison;
}): Promise<QcEvaluation> {
  const definitions = await definitionsFor(input.context, input.stage);
  const outcomes: ParameterOutcome[] = definitions.map((definition) => {
    const comparator = definition.comparator as Comparator;
    const allowedValues = JSON.parse(definition.allowedValues) as string[];
    const submittedValue = input.values[definition.parameterKey];
    return {
      parameterKey: definition.parameterKey,
      displayName: definition.displayName,
      submittedValue: submittedValue ?? null,
      unit: definition.unit,
      comparator,
      threshold: thresholdLabel(comparator, definition.thresholdValue, allowedValues),
      isCritical: definition.isCritical,
      status: parameterStatus(submittedValue, comparator, definition.thresholdValue, allowedValues),
    };
  });

  outcomes.push(...(input.context === 'RAW_MATERIAL' && input.stage === 'RECEIPT' ? fieldComparisonOutcomes(input.fieldComparison) : []));
  const blocked = outcomes.some((outcome) => outcome.isCritical && outcome.status !== 'PASS');
  const overallResult = input.context === 'RAW_MATERIAL'
    ? (blocked ? 'REJECT' : 'ACCEPT')
    : (blocked ? 'FAIL' : 'PASS');

  const db = getDb();
  const now = new Date();
  const resultId = crypto.randomUUID();
  const batchRef = input.batchRef.trim();

  await db.insert(qcTestResults).values({
    id: resultId,
    context: input.context,
    stage: input.stage,
    batchRef,
    testedBy: input.testedBy,
    testedAt: now,
    overallResult,
    createdAt: now,
  });
  await db.insert(qcTestResultParameters).values(
    outcomes.map((outcome) => ({
      id: crypto.randomUUID(),
      qcTestResultId: resultId,
      parameterKey: outcome.parameterKey,
      displayName: outcome.displayName,
      submittedValue: String(outcome.submittedValue ?? ''),
      unit: outcome.unit,
      comparator: outcome.comparator,
      thresholdSnapshot: outcome.threshold,
      isCritical: outcome.isCritical,
      status: outcome.status,
    })),
  );

  return {
    id: resultId,
    context: input.context,
    stage: input.stage,
    batchRef,
    testedBy: input.testedBy,
    testedAt: now.toISOString(),
    overallResult,
    passed: outcomes.filter((outcome) => outcome.status === 'PASS'),
    failed: outcomes.filter((outcome) => outcome.status === 'FAIL'),
    missing: outcomes.filter((outcome) => outcome.status === 'MISSING'),
    recorded: outcomes.filter((outcome) => outcome.status === 'RECORDED'),
    allParameters: outcomes,
  };
}
