import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export * from './operations-schema';

export const operationsState = sqliteTable('operations_state', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

/**
 * Append-only security and operations history. This table is deliberately not
 * exposed through the state API, which prevents normal application edits or
 * deletes from altering the audit trail.
 */
export const activityLog = sqliteTable(
  'activity_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    userName: text('user_name').notNull(),
    userEmail: text('user_email').notNull(),
    action: text('action').notNull(),
    details: text('details').notNull(),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('activity_log_occurred_at_idx').on(table.occurredAt)],
);

/**
 * The QC rulebook is intentionally stored as data. New standards and revised
 * limits therefore take effect without moving decision logic into the client.
 */
export const qcParameterDefinitions = sqliteTable(
  'qc_parameter_definitions',
  {
    id: text('id').primaryKey(),
    context: text('context').notNull(),
    stage: text('stage'),
    parameterKey: text('parameter_key').notNull(),
    displayName: text('display_name').notNull(),
    unit: text('unit'),
    dataType: text('data_type').notNull(),
    comparator: text('comparator').notNull(),
    thresholdValue: real('threshold_value'),
    allowedValues: text('allowed_values').notNull().default('[]'),
    isCritical: integer('is_critical', { mode: 'boolean' }).notNull().default(true),
    regulatoryRef: text('regulatory_ref'),
    effectiveFrom: integer('effective_from', { mode: 'timestamp_ms' }).notNull(),
    effectiveTo: integer('effective_to', { mode: 'timestamp_ms' }),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('qc_definition_lookup_idx').on(
      table.context,
      table.stage,
      table.parameterKey,
      table.effectiveTo,
    ),
  ],
);

export const qcTestResults = sqliteTable(
  'qc_test_results',
  {
    id: text('id').primaryKey(),
    context: text('context').notNull(),
    stage: text('stage').notNull(),
    batchRef: text('batch_ref').notNull(),
    testedBy: text('tested_by').notNull(),
    testedAt: integer('tested_at', { mode: 'timestamp_ms' }).notNull(),
    overallResult: text('overall_result').notNull(),
    overriddenBy: text('overridden_by'),
    overrideReason: text('override_reason'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('qc_result_batch_idx').on(table.batchRef),
    index('qc_result_history_idx').on(table.context, table.stage, table.testedAt),
  ],
);

export const qcTestResultParameters = sqliteTable(
  'qc_test_result_parameters',
  {
    id: text('id').primaryKey(),
    qcTestResultId: text('qc_test_result_id')
      .notNull()
      .references(() => qcTestResults.id),
    parameterKey: text('parameter_key').notNull(),
    displayName: text('display_name').notNull(),
    submittedValue: text('submitted_value').notNull(),
    unit: text('unit'),
    comparator: text('comparator').notNull(),
    thresholdSnapshot: text('threshold_snapshot').notNull(),
    isCritical: integer('is_critical', { mode: 'boolean' }).notNull(),
    status: text('status').notNull(),
  },
  (table) => [index('qc_result_parameter_result_idx').on(table.qcTestResultId)],
);
