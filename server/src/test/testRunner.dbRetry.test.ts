import { test } from 'node:test';
import assert from 'node:assert/strict';

// The helpers under test live in the test harness (scripts/dbAdminRetry.mjs),
// outside the TS source tree; a sibling .d.mts supplies their types. Importing
// them here exercises the real classifier + backoff used by `pnpm test` without
// spawning a database.
import {
  isTransientDbError,
  withAdminRetry,
  TRANSIENT_DB_CODES,
} from '../../scripts/dbAdminRetry.mjs';

// A fake error carrying a Postgres-style SQLSTATE / Node network `code`.
function dbErr(code: string): Error & { code: string } {
  return Object.assign(new Error(`boom ${code}`), { code });
}

// Capture backoff waits without real timers so the suite stays fast.
function fakeSleep() {
  const waits: number[] = [];
  return {
    waits,
    sleep: (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}

const noopLog = () => {};

test('isTransientDbError: every classified code is treated as transient', () => {
  for (const code of TRANSIENT_DB_CODES) {
    assert.equal(isTransientDbError(dbErr(code)), true, `${code} should be transient`);
  }
});

test('isTransientDbError: permanent SQLSTATE codes are not transient', () => {
  // 42P04 = duplicate_database ("already exists"), 42601 = syntax_error,
  // 28P01 = invalid_password, 3D000 = invalid_catalog_name.
  for (const code of ['42P04', '42601', '28P01', '3D000', '23505']) {
    assert.equal(isTransientDbError(dbErr(code)), false, `${code} should be permanent`);
  }
});

test('isTransientDbError: non-errors and code-less errors are not transient', () => {
  assert.equal(isTransientDbError(null), false);
  assert.equal(isTransientDbError(undefined), false);
  assert.equal(isTransientDbError(new Error('no code')), false);
  // A numeric code (not a string) must not match.
  assert.equal(isTransientDbError(Object.assign(new Error('x'), { code: 55006 })), false);
});

test('withAdminRetry: returns the result without sleeping when fn succeeds first try', async () => {
  const { waits, sleep } = fakeSleep();
  let calls = 0;
  const result = await withAdminRetry(
    'op',
    () => {
      calls += 1;
      return 'ok';
    },
    { sleep, log: noopLog },
  );
  assert.equal(result, 'ok');
  assert.equal(calls, 1, 'fn ran exactly once');
  assert.deepEqual(waits, [], 'no backoff on success');
});

test('withAdminRetry: retries transient errors and eventually succeeds', async () => {
  const { waits, sleep } = fakeSleep();
  let calls = 0;
  const result = await withAdminRetry(
    'op',
    () => {
      calls += 1;
      if (calls < 3) throw dbErr('57P03'); // cannot_connect_now (twice)
      return 'recovered';
    },
    { sleep, log: noopLog },
  );
  assert.equal(result, 'recovered');
  assert.equal(calls, 3, 'two failures then a success');
  assert.equal(waits.length, 2, 'one backoff per failed attempt');
});

test('withAdminRetry: gives up after the configured number of tries', async () => {
  const { waits, sleep } = fakeSleep();
  let calls = 0;
  await assert.rejects(
    withAdminRetry(
      'op',
      () => {
        calls += 1;
        throw dbErr('53300'); // too_many_connections — always transient
      },
      { tries: 4, delayMs: 10, sleep, log: noopLog },
    ),
    /boom 53300/,
  );
  assert.equal(calls, 4, 'fn attempted exactly `tries` times');
  assert.equal(waits.length, 3, 'sleeps between attempts but not after the last');
});

test('withAdminRetry: rethrows a permanent error immediately without retrying', async () => {
  const { waits, sleep } = fakeSleep();
  let calls = 0;
  await assert.rejects(
    withAdminRetry(
      'op',
      () => {
        calls += 1;
        throw dbErr('42P04'); // duplicate_database — permanent
      },
      { tries: 8, sleep, log: noopLog },
    ),
    /boom 42P04/,
  );
  assert.equal(calls, 1, 'no retries for a permanent error');
  assert.deepEqual(waits, [], 'no backoff for a permanent error');
});

test('withAdminRetry: applies capped exponential backoff', async () => {
  const { waits, sleep } = fakeSleep();
  await assert.rejects(
    withAdminRetry(
      'op',
      () => {
        throw dbErr('08006'); // connection_failure — transient
      },
      { tries: 8, delayMs: 250, maxDelayMs: 2000, sleep, log: noopLog },
    ),
  );
  // 250, 500, 1000, 2000, then capped at 2000 thereafter; 7 waits for 8 tries.
  assert.deepEqual(waits, [250, 500, 1000, 2000, 2000, 2000, 2000]);
});

test('withAdminRetry: passes the attempt number to fn', async () => {
  const { sleep } = fakeSleep();
  const seen: number[] = [];
  await withAdminRetry(
    'op',
    (attempt: number) => {
      seen.push(attempt);
      if (attempt < 3) throw dbErr('40001'); // serialization_failure
      return null;
    },
    { sleep, log: noopLog },
  );
  assert.deepEqual(seen, [1, 2, 3]);
});
