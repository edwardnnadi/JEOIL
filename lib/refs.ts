import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { idSequences } from '../db/schema';

export type SequenceKey =
  | 'PURCHASE_ORDER'
  | 'GOODS_RECEIPT'
  | 'RAW_MATERIAL_BATCH'
  | 'FINISHED_GOODS_BATCH'
  | 'SALES_ORDER'
  | 'DISPATCH'
  | 'SUPPLIER'
  | 'CUSTOMER'
  | 'PRODUCTION_RUN';

const defaults: Record<SequenceKey, { prefix: string; padding: number }> = {
  PURCHASE_ORDER: { prefix: 'PO', padding: 4 },
  GOODS_RECEIPT: { prefix: 'GRN', padding: 4 },
  RAW_MATERIAL_BATCH: { prefix: 'RM', padding: 4 },
  FINISHED_GOODS_BATCH: { prefix: 'FG', padding: 4 },
  SALES_ORDER: { prefix: 'SO', padding: 4 },
  DISPATCH: { prefix: 'DN', padding: 4 },
  SUPPLIER: { prefix: 'SUP', padding: 3 },
  CUSTOMER: { prefix: 'CUS', padding: 3 },
  PRODUCTION_RUN: { prefix: 'PR', padding: 4 },
};

/**
 * Allocates the next reference for a document type, e.g. `PO-0007`.
 *
 * The increment is a single UPDATE ... RETURNING so two concurrent receipts
 * cannot read the same counter and mint the same number. D1 offers no
 * SELECT-then-UPDATE isolation that would make the read-modify-write form safe.
 */
export async function nextRef(key: SequenceKey): Promise<string> {
  const db = getDb();
  const { prefix, padding } = defaults[key];

  await db
    .insert(idSequences)
    .values({ key, prefix, nextValue: 1, padding })
    .onConflictDoNothing();

  const [row] = await db
    .update(idSequences)
    .set({ nextValue: sql`${idSequences.nextValue} + 1` })
    .where(eq(idSequences.key, key))
    .returning({ nextValue: idSequences.nextValue, prefix: idSequences.prefix, padding: idSequences.padding });

  if (!row) throw new Error(`Reference sequence ${key} could not be allocated.`);

  // `nextValue` now holds the value *after* the increment, so the number just
  // handed out is one below it.
  const allocated = row.nextValue - 1;
  return `${row.prefix}-${String(allocated).padStart(row.padding, '0')}`;
}
