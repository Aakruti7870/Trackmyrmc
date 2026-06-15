// Pure, dependency-free helpers for retrying one-off database ADMIN operations
// (template CREATE DATABASE, the stale-DB sweep listing) in the test harness.
// Extracted from scripts/test.mjs so they can be unit-tested without spawning a
// real database — the classifier and backoff logic are the easy things to get
// subtly wrong (treating a permanent error as transient, or an unbounded wait),
// and a regression there would only surface as a real run flaking.

// Postgres SQLSTATE (and Node network) codes that indicate a TRANSIENT, retryable
// condition during a one-off admin operation — the server still warming up,
// connection blips, too many connections, lock contention, or an object briefly
// in use. Permanent errors (bad syntax, "already exists", auth) are NOT in this
// set so they bubble up immediately instead of being retried pointlessly.
export const TRANSIENT_DB_CODES = new Set([
  // SQLSTATE classes 08 (connection), 53 (insufficient resources),
  // 57 (operator intervention / cannot_connect_now), plus lock/serialization.
  '08000', '08003', '08006', '08001', '08004', '08007', '08P01',
  '53000', '53100', '53200', '53300', '53400',
  '57P01', '57P02', '57P03', '57P05',
  '40001', '40P01', '55006', '55P03', 'XX000',
  // Node libpq/socket-level failures surfaced by the pg driver.
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EHOSTUNREACH',
]);

export function isTransientDbError(err) {
  return !!err && typeof err.code === 'string' && TRANSIENT_DB_CODES.has(err.code);
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Run a one-off admin operation, retrying on transient database errors with a
// bounded exponential backoff (capped). Permanent errors are rethrown at once.
// `fn` receives the current attempt number; it should be idempotent (CREATE
// DATABASE IF... / re-listing) since it may run several times. This mirrors the
// retry strategy in createDbFromTemplate but classifies the broader family of
// startup/load hiccups rather than only 55006.
//
// `sleep` and `log` are injectable so tests can run without real waits or noise;
// production callers use the real timer-backed sleep and console.error.
export async function withAdminRetry(
  label,
  fn,
  { tries = 8, delayMs = 250, maxDelayMs = 2000, sleep = defaultSleep, log = console.error } = {},
) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (!isTransientDbError(err) || attempt >= tries) throw err;
      const wait = Math.min(delayMs * 2 ** (attempt - 1), maxDelayMs);
      log(
        `[test] ${label} hit transient error ${err.code} (attempt ${attempt}/${tries}); retrying in ${wait}ms...`,
      );
      await sleep(wait);
    }
  }
}
