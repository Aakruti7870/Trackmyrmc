import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql, eq } from 'drizzle-orm';

import { db, pool } from '../db/index.js';
import {
  plants, clients, sites, drivers, vehicles, orders, challans,
  batchRecords, ledgerEntries, users, plantCustomers,
} from '../db/schema.js';

// The demo seed (src/db/seed.ts) was made idempotent so it can be re-run against
// an already-populated database without crashing or creating duplicate demo
// records. This suite guards that behaviour: it seeds a fresh database, runs the
// seed a SECOND time, and asserts the second run succeeds, adds no duplicate
// rows, and leaves the demo client/driver user links intact. A regression to the
// old `.returning().onConflictDoNothing()` pattern (empty array on a populated
// DB → undefined references) would fail the second run here.

const seedScript = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'db',
  'seed.ts',
);

// Run src/db/seed.ts as its own process against this worker's DATABASE_URL,
// exactly as `pnpm db:seed` would. Resolves with the exit code and captured
// output so a failing run surfaces its stderr in the assertion message.
function runSeed(): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn('node', ['--import', 'tsx', seedScript], {
      env: { ...process.env },
    });
    let output = '';
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
    child.on('error', (err) => resolve({ code: 1, output: `failed to start: ${err.message}` }));
  });
}

const countTables = {
  plants, clients, sites, drivers, vehicles, orders, challans,
  batchRecords, ledgerEntries, users, plantCustomers,
};
type CountKey = keyof typeof countTables;

async function snapshotCounts(): Promise<Record<CountKey, number>> {
  const entries = await Promise.all(
    (Object.keys(countTables) as CountKey[]).map(async (key) => {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(countTables[key]);
      return [key, n] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<CountKey, number>;
}

async function linkSnapshot() {
  const [clientUser] = await db
    .select({ linkedClientId: users.linkedClientId })
    .from(users)
    .where(eq(users.email, 'client@concreteking.example'));
  const [driverUser] = await db
    .select({ linkedDriverId: users.linkedDriverId })
    .from(users)
    .where(eq(users.email, 'driver@concreteking.example'));
  return { clientUser, driverUser };
}

let firstCounts: Record<CountKey, number>;
let secondCounts: Record<CountKey, number>;
let secondRun: { code: number; output: string };

before(async () => {
  // Start from a guaranteed-empty database so the first seed is a true fresh-DB
  // run (other test files share this worker DB and leave rows behind).
  await db.execute(sql`
    TRUNCATE TABLE
      plant_customers, challans, orders, sites, clients, batch_records,
      ledger_entries, audit_logs, login_attempts, vehicles, drivers, users, plants
    RESTART IDENTITY CASCADE
  `);

  const first = await runSeed();
  assert.equal(first.code, 0, `first seed run should succeed:\n${first.output}`);
  firstCounts = await snapshotCounts();

  secondRun = await runSeed();
  secondCounts = await snapshotCounts();
});

after(async () => {
  await pool.end();
});

test('re-running the seed completes without error', () => {
  assert.equal(secondRun.code, 0, `second seed run should succeed:\n${secondRun.output}`);
});

test('the first seed actually populated the demo data', () => {
  // Guard against a vacuous pass: if the first run had inserted nothing, the
  // "no duplicates" check would trivially hold. These are the demo dataset sizes.
  assert.ok(firstCounts.plants >= 45, `expected the demo plants to be seeded, got ${firstCounts.plants}`);
  assert.equal(firstCounts.clients, 5);
  assert.equal(firstCounts.sites, 5);
  assert.equal(firstCounts.drivers, 4);
  assert.equal(firstCounts.vehicles, 4);
  assert.equal(firstCounts.orders, 7);
  assert.equal(firstCounts.challans, 6);
  assert.equal(firstCounts.batchRecords, 6);
  assert.equal(firstCounts.ledgerEntries, 7);
  assert.equal(firstCounts.users, 5);
  assert.equal(firstCounts.plantCustomers, 1);
});

test('re-running the seed creates no duplicate demo records', () => {
  assert.deepEqual(
    secondCounts,
    firstCounts,
    'row counts must be identical after the second seed (no duplicates inserted)',
  );
});

test('the demo client and driver user links survive a re-run', async () => {
  const { clientUser, driverUser } = await linkSnapshot();

  // The demo client/driver accounts must still be wired to the first demo
  // client/driver record after the second run.
  const [firstClient] = await db.select({ id: clients.id }).from(clients)
    .orderBy(clients.id).limit(1);
  const [firstDriver] = await db.select({ id: drivers.id }).from(drivers)
    .orderBy(drivers.id).limit(1);

  assert.ok(clientUser, 'demo client account should exist');
  assert.ok(driverUser, 'demo driver account should exist');
  assert.equal(clientUser.linkedClientId, firstClient.id, 'client account stays linked to the demo client');
  assert.equal(driverUser.linkedDriverId, firstDriver.id, 'driver account stays linked to the demo driver');
});
