const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, AttemptRecord>();

function getRecord(key: string): AttemptRecord {
  let record = attempts.get(key);
  if (!record) {
    record = { count: 0, lockedUntil: null };
    attempts.set(key, record);
  }
  return record;
}

export function isLockedOut(key: string): { locked: boolean; retryAfterMs?: number } {
  const record = getRecord(key);
  if (record.lockedUntil !== null) {
    const remaining = record.lockedUntil - Date.now();
    if (remaining > 0) {
      return { locked: true, retryAfterMs: remaining };
    }
    record.count = 0;
    record.lockedUntil = null;
  }
  return { locked: false };
}

export function recordFailure(key: string): void {
  const record = getRecord(key);
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
  }
}

export function resetAttempts(key: string): void {
  attempts.delete(key);
}

export { MAX_ATTEMPTS, LOCKOUT_MS };
