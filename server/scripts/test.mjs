// Test runner: provisions fresh, uniquely-named test databases, pushes the
// Drizzle schema once, then runs the node:test suite across several parallel
// workers — each with its OWN isolated database — and finally drops them all.
//
// Why per-worker databases?
//   Every suite TRUNCATEs the shared tables in its beforeEach, so two suites
//   touching the same database concurrently would clobber each other's data,
//   surfacing as flaky duplicate-key, foreign-key, and assertion failures.
//   Historically this forced strictly serial execution (--test-concurrency=1
//   on a single database), making wall-clock time bound by the slowest serial
//   chain of ~40 files.
//
// How parallelism is made safe:
//   The test files are sharded across N workers. Each worker runs node:test
//   over its own subset of files (still --test-concurrency=1, so files WITHIN a
//   worker run one at a time and never clobber each other) against a database
//   that belongs only to that worker. Workers run at the same time, so the
//   total wall-clock time drops to roughly the slowest single shard instead of
//   the sum of all files.
//
// Why a template database?
//   drizzle-kit push is the slow part of setup. We push the schema ONCE into a
//   template database, then create each worker's database with
//   `CREATE DATABASE <w> TEMPLATE <tmpl>`, which is a fast file-level copy. This
//   avoids running drizzle-kit push N times.
//
// Every database name is suffixed with the runner PID and a timestamp so that
// concurrent `pnpm test` invocations (validation gate, the `test` workflow,
// parallel task environments) never share a database or touch dev data.
import pg from 'pg';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
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
const ssl = baseUrl.includes('localhost') ? false : { rejectUnauthorized: false };

// Build a unique, <=63-byte Postgres-safe database name for the given tag.
const runTag = `${process.pid}_${Date.now()}`;
function makeDbName(tag) {
  const suffix = `_test_${tag}_${runTag}`;
  return `${baseName.slice(0, Math.max(1, 63 - suffix.length))}${suffix}`;
}

const templateName = makeDbName('tmpl');

function urlFor(dbName) {
  const u = new URL(baseUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
}

// Strip any ambient SMTP credentials so the suite can never open a real network
// connection to a live mail server. The deployed/dev environment may have real
// SMTP_* secrets set; without this, tests that create users or trigger welcome /
// password-reset emails (and don't mock the email module) build a real
// transporter and stall on a live Gmail handshake (EAUTH). Tests that
// intentionally exercise SMTP set their own fake env vars and mock
// nodemailer.createTransport, so clearing the ambient ones here is safe and
// keeps coverage unchanged.
const baseEnv = { ...process.env, NODE_ENV: 'test' };
for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM']) {
  delete baseEnv[key];
}

async function dropDatabase(name) {
  const admin = new pg.Pool({ connectionString: baseUrl, ssl });
  try {
    // WITH (FORCE) (Postgres 13+) terminates any lingering connections so the
    // drop never blocks, even if a test left a connection open.
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  } catch (err) {
    console.error(`[test] Warning: failed to drop database "${name}":`, err.message);
  } finally {
    await admin.end();
  }
}

// A run normally drops its own databases in the `finally` below, but a hard
// kill (SIGKILL, OOM, CI cancellation) skips that cleanup and leaves orphaned
// databases behind. Left unchecked they accumulate until the Postgres server
// hits its database/connection limits and new runs start failing. So before
// each run we sweep away leftovers from PREVIOUS runs.
//
// Every test database name ends with `_test_<tag>_<pid>_<ms-timestamp>`, where
// the timestamp is the `Date.now()` from when its run started. We parse that
// timestamp out of the name and only drop databases older than a safe
// threshold, so a concurrently-running sibling run's fresh databases (and the
// real dev database, which never matches the pattern) are left untouched.
const STALE_DB_AGE_MS = 60 * 60 * 1000; // 1 hour
const TEST_DB_RE = /_test_(?:tmpl|w\d+)_\d+_(\d+)$/;

async function sweepStaleDatabases() {
  const admin = new pg.Pool({ connectionString: baseUrl, ssl });
  let candidates = [];
  try {
    const { rows } = await admin.query('SELECT datname FROM pg_database');
    candidates = rows.map((r) => r.datname);
  } catch (err) {
    console.error('[test] Warning: stale-database sweep failed to list databases:', err.message);
    return;
  } finally {
    await admin.end();
  }

  const now = Date.now();
  const stale = [];
  for (const datname of candidates) {
    if (datname === baseName) continue; // never the real dev database
    const m = TEST_DB_RE.exec(datname);
    if (!m) continue;
    const ts = Number(m[1]);
    if (!Number.isFinite(ts)) continue;
    if (now - ts > STALE_DB_AGE_MS) stale.push(datname);
  }

  if (stale.length === 0) return;
  console.log(`[test] Sweeping ${stale.length} stale test database(s) from interrupted runs: ${stale.join(', ')}`);
  await Promise.all(stale.map((name) => dropDatabase(name)));
}

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

// Run one worker: node:test over `files` against `dbName`. Output is buffered
// and printed as a contiguous block when the worker finishes, so the parallel
// workers' spec reporters don't interleave into unreadable noise.
function runWorker(index, files, dbName) {
  return new Promise((resolve) => {
    const env = { ...baseEnv, DATABASE_URL: urlFor(dbName) };
    // --test-concurrency=1: files within a worker share that worker's database,
    //   so they must still run one at a time (each TRUNCATEs shared tables).
    // --test-force-exit: some suites exercise SSE/streaming endpoints that can
    //   leave a socket or timer holding the event loop open after every test has
    //   already passed; without this the run would hang on exit.
    const child = spawn(
      'node',
      ['--import', 'tsx', '--experimental-test-module-mocks', '--test', '--test-concurrency=1', '--test-force-exit', '--test-reporter', 'spec', ...files],
      { env, cwd: serverDir },
    );
    let buf = '';
    child.stdout.on('data', (d) => { buf += d; });
    child.stderr.on('data', (d) => { buf += d; });
    child.on('close', (code) => {
      const names = files.map((f) => path.basename(f)).join(', ');
      console.log(`\n===== worker ${index + 1} (${files.length} file(s): ${names}) — exit ${code} =====`);
      process.stdout.write(buf);
      resolve(code ?? 1);
    });
    child.on('error', (err) => {
      console.error(`[test] worker ${index + 1} failed to start:`, err.message);
      resolve(1);
    });
  });
}

const createdDbs = [];
let exitCode = 1;
try {
  // 0. Sweep away orphaned databases left behind by previously-killed runs.
  await sweepStaleDatabases();

  // 1. Create + schema-push a template database once.
  {
    const admin = new pg.Pool({ connectionString: baseUrl, ssl });
    try {
      await admin.query(`CREATE DATABASE "${templateName}"`);
      console.log(`[test] Created template database "${templateName}"`);
    } finally {
      await admin.end();
    }
  }
  createdDbs.push(templateName);

  console.log('[test] Pushing schema to template database...');
  const push = spawnSync('pnpm', ['exec', 'drizzle-kit', 'push', '--force'], {
    stdio: 'inherit',
    env: { ...baseEnv, DATABASE_URL: urlFor(templateName) },
    cwd: serverDir,
  });
  if (push.status !== 0) {
    console.error('[test] drizzle-kit push failed.');
    exitCode = push.status ?? 1;
  } else {
    const testFiles = findTests(path.join(serverDir, 'src')).sort();
    if (testFiles.length === 0) {
      console.error('[test] No test files found.');
      exitCode = 1;
    } else {
      // 2. Decide worker count and shard files round-robin (spreads heavy
      //    files across shards rather than clustering them in one).
      const requested = Number(process.env.TEST_WORKERS) || 0;
      const workerCount = Math.max(
        1,
        Math.min(requested > 0 ? requested : os.cpus().length, testFiles.length, 6),
      );
      const shards = Array.from({ length: workerCount }, () => []);
      testFiles.forEach((file, i) => shards[i % workerCount].push(file));

      // 3. Create one database per worker from the template (fast copy).
      const admin = new pg.Pool({ connectionString: baseUrl, ssl });
      try {
        // CREATE DATABASE ... TEMPLATE requires zero sessions on the source.
        // drizzle-kit push runs in its own (already-exited) process, but its
        // backend can linger briefly on the server; terminate any stragglers
        // so the copy never trips error 55006 ("source database is being
        // accessed by other users").
        await admin.query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [templateName],
        );
        for (let i = 0; i < workerCount; i++) {
          const dbName = makeDbName(`w${i}`);
          await admin.query(`CREATE DATABASE "${dbName}" TEMPLATE "${templateName}"`);
          createdDbs.push(dbName);
          shards[i].dbName = dbName;
        }
      } finally {
        await admin.end();
      }

      console.log(
        `[test] Running ${testFiles.length} test file(s) across ${workerCount} parallel worker(s)...`,
      );
      // 4. Run all workers in parallel; fail the run if any worker fails.
      const codes = await Promise.all(
        shards.map((files, i) => runWorker(i, files, files.dbName)),
      );
      exitCode = codes.every((c) => c === 0) ? 0 : 1;
    }
  }
} finally {
  // 5. Drop every database we created (workers + template).
  await Promise.all(createdDbs.map((name) => dropDatabase(name)));
}

process.exit(exitCode);
