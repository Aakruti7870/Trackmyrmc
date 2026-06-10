// Test runner: provisions a fresh, uniquely-named test database, pushes the
// Drizzle schema to it, runs the node:test suite against it, then drops it.
//
// Each invocation gets its OWN database (suffixed with the runner PID and a
// timestamp). This is deliberate: the validation gate, the `test` workflow, and
// parallel task environments can all run `pnpm test` at the same time against
// the same base server. A single shared `<db>_test` database would let those
// concurrent runs TRUNCATE each other's tables mid-test, surfacing as flaky
// duplicate-key, foreign-key, and assertion failures. A per-run database keeps
// every run fully isolated and deterministic (e.g. the "last remaining admin"
// guard depends on the total admin count) and never touches development data.
import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  console.error('DATABASE_URL is not set. Cannot run tests.');
  process.exit(1);
}

const serverDir = path.dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, '');

const parsed = new URL(baseUrl);
const baseName = parsed.pathname.replace(/^\//, '');
// Unique per run so concurrent test runs never share a database. Postgres
// identifiers are capped at 63 bytes, so keep the base name short enough.
const suffix = `test_${process.pid}_${Date.now()}`;
const testName = `${baseName.slice(0, 63 - suffix.length - 1)}_${suffix}`;
const ssl = baseUrl.includes('localhost') ? false : { rejectUnauthorized: false };

async function dropTestDatabase() {
  const admin = new pg.Pool({ connectionString: baseUrl, ssl });
  try {
    // WITH (FORCE) (Postgres 13+) terminates any lingering connections so the
    // drop never blocks, even if a test left a connection open.
    await admin.query(`DROP DATABASE IF EXISTS "${testName}" WITH (FORCE)`);
  } catch (err) {
    console.error(`[test] Warning: failed to drop test database "${testName}":`, err.message);
  } finally {
    await admin.end();
  }
}

const admin = new pg.Pool({ connectionString: baseUrl, ssl });
try {
  await admin.query(`CREATE DATABASE "${testName}"`);
  console.log(`[test] Created test database "${testName}"`);
} finally {
  await admin.end();
}

const testUrl = new URL(baseUrl);
testUrl.pathname = `/${testName}`;
const testDatabaseUrl = testUrl.toString();
const env = { ...process.env, DATABASE_URL: testDatabaseUrl, NODE_ENV: 'test' };

let exitCode = 1;
try {
  console.log('[test] Pushing schema to test database...');
  const push = spawnSync('pnpm', ['exec', 'drizzle-kit', 'push', '--force'], {
    stdio: 'inherit',
    env,
    cwd: serverDir,
  });
  if (push.status !== 0) {
    console.error('[test] drizzle-kit push failed.');
    exitCode = push.status ?? 1;
  } else {
    const testFiles = findTests(path.join(serverDir, 'src'));
    if (testFiles.length === 0) {
      console.error('[test] No test files found.');
      exitCode = 1;
    } else {
      console.log(`[test] Running ${testFiles.length} test file(s)...`);
      // Run test files serially (--test-concurrency=1): every suite TRUNCATEs
      // the shared tables in its beforeEach, so concurrent files within a run
      // would clobber each other's data on this run's database.
      const run = spawnSync(
        'node',
        ['--import', 'tsx', '--experimental-test-module-mocks', '--test', '--test-concurrency=1', '--test-reporter', 'spec', ...testFiles],
        { stdio: 'inherit', env, cwd: serverDir },
      );
      exitCode = run.status ?? 1;
    }
  }
} finally {
  await dropTestDatabase();
}

process.exit(exitCode);

function findTests(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...findTests(full));
    } else if (entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}
