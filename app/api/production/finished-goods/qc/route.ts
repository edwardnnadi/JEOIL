import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '../../../../../db';
import { finishedGoodsBatches } from '../../../../../db/schema';
import { authorize } from '../../../../../lib/auth';
import { badRequest, conflict, notFound, readBody, text, unauthorized } from '../../../../../lib/http';
import { asValues, evaluateAndRecordQc } from '../../../../../lib/qc';

/**
 * The release gate.
 *
 * IN_PROCESS tests are recorded for the batch history but never change its
 * status. Only a FINAL-stage PASS sets RELEASED, and only RELEASED batches can
 * be dispatched, so goods out is controlled by the same server-side decision
 * that produced the verdict.
 */
export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return unauthorized();
  const body = await readBody(request);
  if (!body) return badRequest('Invalid request body');

  const batchId = text(body.finishedGoodsBatchId);
  const stage = text(body.stage) ?? 'FINAL';
  const values = asValues(body.values);
  if (!batchId) return badRequest('Finished goods batch id is required');
  if (stage !== 'IN_PROCESS' && stage !== 'FINAL') return badRequest('Stage must be IN_PROCESS or FINAL');
  if (!values) return badRequest('QC values must be an object of parameter readings');

  const db = getDb();
  const batch = await db.select().from(finishedGoodsBatches).where(eq(finishedGoodsBatches.id, batchId)).get();
  if (!batch) return notFound('Finished goods batch not found');
  if (batch.status === 'RELEASED' && stage === 'FINAL') {
    return conflict('This batch has already been released', { batchNumber: batch.batchNumber });
  }
  if (batch.status === 'DISPATCHED') {
    return conflict('This batch has already been fully dispatched', { batchNumber: batch.batchNumber });
  }

  const evaluation = await evaluateAndRecordQc({
    context: 'FINISHED_PRODUCT',
    stage,
    batchRef: batch.batchNumber,
    values,
    testedBy: user.email,
  });

  if (stage !== 'FINAL') {
    return NextResponse.json({ qc: evaluation, batch, released: false });
  }

  const now = new Date();
  const released = evaluation.overallResult === 'PASS';
  const [updated] = await db
    .update(finishedGoodsBatches)
    .set({
      status: released ? 'RELEASED' : 'REJECTED',
      qcTestResultId: evaluation.id,
      releasedBy: released ? user.email : null,
      releasedAt: released ? now : null,
    })
    .where(eq(finishedGoodsBatches.id, batch.id))
    .returning();

  return NextResponse.json({ qc: evaluation, batch: updated, released });
}
