import { NextResponse } from 'next/server';

export const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
export const notFound = (error: string) => NextResponse.json({ error }, { status: 404 });
/**
 * 409 is used for the workflow gates (rejected material, unreleased batch,
 * over-receipt) rather than 400: the request is well formed, it is the state of
 * the record that forbids it.
 */
export const conflict = (error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status: 409 });

export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Quantities and prices must be finite and non-negative to be storable. */
export function positiveNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function nonNegativeNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function timestamp(value: unknown, fallback: Date): Date {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

/**
 * Floating-point quantities accumulate error across part-receipts, so the
 * over-receipt and over-dispatch comparisons round to grams/millilitres before
 * deciding a line is exhausted.
 */
export function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
