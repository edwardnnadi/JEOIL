import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const operationsState = sqliteTable('operations_state', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
