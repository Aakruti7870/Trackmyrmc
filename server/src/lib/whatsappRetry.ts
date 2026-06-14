import { eq, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { whatsappRetries } from '../db/schema.js';
import {
  sendWhatsAppTemplate,
  type WhatsAppEvent,
  type WhatsAppSendResult,
} from './whatsapp.js';

// Out-of-band retry for business WhatsApp notifications whose first, inline send
// failed transiently (provider unreachable / 5xx / 429). The originating request
// (order placement, dispatch, delivery) still fires-and-forgets a single inline
// send and never blocks on this — failed transient sends are persisted to the
// whatsapp_retries table and re-sent later by a background tick with exponential
// backoff. Permanent failures (bad number, template error, unconfigured) are
// never enqueued, so the queue only ever holds messages that a retry might save.

// Total send attempts before we give up, INCLUDING the inline attempt that ran
// in the request. So 1 inline + 4 background retries.
export const MAX_ATTEMPTS = 5;

// Backoff base and ceiling. The delay before the next attempt grows
// exponentially from BASE, doubling each attempt, capped at MAX_BACKOFF_MS.
export const BACKOFF_BASE_MS = 60 * 1000; // 1 minute
export const MAX_BACKOFF_MS = 30 * 60 * 1000; // 30 minutes

// While a row is being processed it is "leased" — its nextAttemptAt is pushed
// this far into the future so a concurrent/overlapping tick won't grab it too.
// If the process crashes mid-send the lease simply expires and the row becomes
// due again, giving crash-safe at-least-once delivery.
export const LEASE_MS = 5 * 60 * 1000; // 5 minutes

// Delay in ms before the (attemptsMade + 1)-th attempt, given how many attempts
// have already been made. attemptsMade=1 (just the inline send) → BASE; each
// further attempt doubles, capped at MAX_BACKOFF_MS.
export function backoffDelayMs(attemptsMade: number): number {
  const delay = BACKOFF_BASE_MS * 2 ** (attemptsMade - 1);
  return Math.min(delay, MAX_BACKOFF_MS);
}

// Persist a transiently-failed send so the background tick can re-send it.
// Caller must have already confirmed result.retryable; only called with a valid
// recipient + template (the only case a send is ever retryable). Never throws —
// a failure to enqueue must not surface to the request.
export async function enqueueWhatsAppRetry(params: {
  toPhone: string;
  templateSid: string;
  variables: Record<string, string>;
  event?: WhatsAppEvent;
  error?: string;
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  try {
    await db.insert(whatsappRetries).values({
      toPhone: params.toPhone,
      templateSid: params.templateSid,
      variables: params.variables,
      event: params.event ?? null,
      attempts: 1,
      lastError: params.error ?? null,
      nextAttemptAt: new Date(now.getTime() + backoffDelayMs(1)),
    });
  } catch (err) {
    console.warn('[whatsapp] failed to enqueue retry:', err);
  }
}

// Send once inline (exactly as before), and if that fails transiently, enqueue
// it for background retry. Returns the inline result unchanged so callers keep
// their existing fire-and-forget contract. This is the entry point delivery
// notifications should use instead of sendWhatsAppTemplate directly.
export async function sendWhatsAppWithRetry(
  toPhone: string | null | undefined,
  templateSid: string | null | undefined,
  variables: Record<string, string>,
  event?: WhatsAppEvent,
): Promise<WhatsAppSendResult> {
  const result = await sendWhatsAppTemplate(toPhone, templateSid, variables);
  // retryable is only ever true when toPhone + templateSid were valid (that is
  // the only path that reaches a real provider call), so the narrowing below
  // always holds; the guard keeps TypeScript happy and is defensive.
  if (!result.ok && result.retryable && toPhone && templateSid) {
    await enqueueWhatsAppRetry({ toPhone, templateSid, variables, event, error: result.error });
  }
  return result;
}

export interface RetryRunResult {
  // Re-sends that finally succeeded.
  sent: number;
  // Re-sends that failed transiently again and were rescheduled.
  retried: number;
  // Rows dropped because the failure was permanent or attempts were exhausted.
  gaveUp: number;
}

// Process every due retry row. Each row is claimed in its own short transaction
// (FOR UPDATE SKIP LOCKED + lease) so the network send happens OUTSIDE any
// transaction — no DB lock or pooled connection is held during the HTTP call,
// and overlapping ticks / multiple instances never double-process a row. Returns
// counts for logging. Safe to call repeatedly; idempotent per due row.
export async function runDueWhatsAppRetries(now = new Date()): Promise<RetryRunResult> {
  const result: RetryRunResult = { sent: 0, retried: 0, gaveUp: 0 };

  for (;;) {
    // Phase 1: atomically claim the oldest due row by leasing it forward so a
    // concurrent tick won't also pick it up.
    const claimed = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(whatsappRetries)
        .where(lte(whatsappRetries.nextAttemptAt, now))
        .orderBy(whatsappRetries.nextAttemptAt)
        .limit(1)
        .for('update', { skipLocked: true });
      if (!row) return null;
      await tx
        .update(whatsappRetries)
        .set({ nextAttemptAt: new Date(now.getTime() + LEASE_MS) })
        .where(eq(whatsappRetries.id, row.id));
      return row;
    });
    if (!claimed) break;

    // Phase 2: attempt the send with no transaction / lock held.
    const res = await sendWhatsAppTemplate(
      claimed.toPhone,
      claimed.templateSid,
      claimed.variables as Record<string, string>,
    );

    // Phase 3: record the outcome.
    if (res.ok) {
      await db.delete(whatsappRetries).where(eq(whatsappRetries.id, claimed.id));
      result.sent += 1;
    } else if (res.retryable && claimed.attempts + 1 < MAX_ATTEMPTS) {
      const attempts = claimed.attempts + 1;
      await db
        .update(whatsappRetries)
        .set({
          attempts,
          lastError: res.error ?? null,
          nextAttemptAt: new Date(now.getTime() + backoffDelayMs(attempts)),
        })
        .where(eq(whatsappRetries.id, claimed.id));
      result.retried += 1;
    } else {
      // Permanent failure, or out of attempts: stop retrying.
      await db.delete(whatsappRetries).where(eq(whatsappRetries.id, claimed.id));
      result.gaveUp += 1;
    }
  }

  return result;
}
