import { eq, gt, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { loginAttempts } from '../db/schema.js';

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export async function isLockedOut(key: string): Promise<{ locked: boolean; retryAfterMs?: number }> {
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key));
  if (!row || row.lockedUntil === null) return { locked: false };

  const remaining = row.lockedUntil.getTime() - Date.now();
  if (remaining > 0) {
    return { locked: true, retryAfterMs: remaining };
  }

  await db.update(loginAttempts)
    .set({ count: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(loginAttempts.key, key));

  return { locked: false };
}

export async function recordFailure(key: string): Promise<void> {
  await db
    .insert(loginAttempts)
    .values({
      key,
      count: 1,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        count: sql`${loginAttempts.count} + 1`,
        lockedUntil: sql`
          CASE
            WHEN ${loginAttempts.count} + 1 >= ${MAX_ATTEMPTS}
            THEN NOW() + (${LOCKOUT_MS} * INTERVAL '1 millisecond')
            ELSE NULL
          END
        `,
        updatedAt: sql`NOW()`,
      },
    });
}

export async function resetAttempts(key: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}

export interface ActiveLockout {
  key: string;
  count: number;
  lockedUntil: Date;
  retryAfterMs: number;
}

export async function getActiveLockouts(): Promise<ActiveLockout[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(loginAttempts)
    .where(gt(loginAttempts.lockedUntil, now));

  return rows
    .filter((row): row is typeof row & { lockedUntil: Date } => row.lockedUntil !== null)
    .map(row => ({
      key: row.key,
      count: row.count,
      lockedUntil: row.lockedUntil,
      retryAfterMs: row.lockedUntil.getTime() - Date.now(),
    }))
    .filter(l => l.retryAfterMs > 0)
    .sort((a, b) => b.retryAfterMs - a.retryAfterMs);
}

export async function clearLockout(key: string): Promise<boolean> {
  const result = await db
    .delete(loginAttempts)
    .where(eq(loginAttempts.key, key))
    .returning({ key: loginAttempts.key });
  return result.length > 0;
}

export async function cleanupOldAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - LOCKOUT_MS);
  await db.delete(loginAttempts).where(lt(loginAttempts.updatedAt, cutoff));
}

export async function getLockoutInfo(key: string): Promise<{ locked: boolean; lockedUntil: number | null }> {
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key));
  if (!row || row.lockedUntil === null) return { locked: false, lockedUntil: null };
  const remaining = row.lockedUntil.getTime() - Date.now();
  if (remaining <= 0) {
    await db.update(loginAttempts)
      .set({ count: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(loginAttempts.key, key));
    return { locked: false, lockedUntil: null };
  }
  return { locked: true, lockedUntil: row.lockedUntil.getTime() };
}
