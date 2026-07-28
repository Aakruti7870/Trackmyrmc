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
//   The test files are distributed across N workers. Each worker owns its own
//   database and runs one file at a time (each file is a fresh `node --test`
//   invocation with --test-concurrency=1, so files WITHIN a worker run serially
//   and never clobber each other). Workers run at the same time, so the total
//   wall-clock time drops to roughly the slowest single shard instead of the
//   sum of all files.
//
// Why a work-stealing queue instead of fixed round-robin shards?
//   Files finish very unevenly — the bcrypt-heavy users.delete / auth.lockout /
//   users.authority suites cost far more than the rest, and (because the work is
//   in bcrypt rounds, not file length) cost does NOT track file size. A static
//   round-robin split therefore left one worker doing ~107s while another
//   finished in ~48s, and the run was bound by that unlucky-heavy worker.
//   Instead, all files go into one shared queue and every worker pulls the next
//   file the instant it goes idle. A worker that draws a heavy file simply runs
//   fewer files, so the workers finish within ~one file of each other and the
//   total drops toward the cost of the single heaviest file.
//
// Why recorded timings?
//   To shrink the tail further we dispatch heaviest-first (longest-processing-
//   time ordering): the queue is sorted by each file's last recorded duration so
//   the expensive suites start immediately and never strand a worker at the end.
//   Timings are written to .test-timings.json after every run; a missing/stale
//   entry just means that file is dispatched early and the queue self-corrects —
//   the work-stealing keeps things balanced even with no timing data at all.
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
import { readdirSync, readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTransientDbError, withAdminRetry } from './dbAdminRetry.mjs';

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
//
// The WHATSAPP_META_* credentials are stripped for the same reason: they are set
// globally (Phone Number ID env var + access-token secret) for real delivery, so
// without this every suite would see the Meta sender as configured and the
// WhatsApp business-notification path would switch from its expected
// Twilio/dev-fallback behaviour to Meta. Tests that intentionally exercise the
// Meta path set their own fake WHATSAPP_META_* env and stub global.fetch.
const baseEnv = { ...process.env, NODE_ENV: 'test' };
for (const key of [
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM',
  'WHATSAPP_META_PHONE_NUMBER_ID', 'WHATSAPP_META_ACCESS_TOKEN',
  'WHATSAPP_META_API_VERSION', 'WHATSAPP_META_LANG',
]) {
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
    // Listing is best-effort but the sweep keeps the server under its database
    // limit, so tolerate transient hiccups (server warming up, connection blip)
    // with bounded retry before giving up rather than skipping the sweep on the
    // first stumble.
    const { rows } = await withAdminRetry(
      'stale-database sweep list',
      () => admin.query('SELECT datname FROM pg_database'),
    );
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

// Per-file recorded durations live next to this script keyed by path relative to
// serverDir. They are only a scheduling HINT (heaviest-first dispatch), never a
// correctness input, so a missing/corrupt file is harmless.
const TIMINGS_PATH = path.join(serverDir, '.test-timings.json');

function loadTimings() {
  try {
    const data = JSON.parse(readFileSync(TIMINGS_PATH, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {}; // first run, or a concurrent writer left it momentarily unreadable
  }
}

// Merge fresh measurements into the existing file and write atomically (temp +
// rename) so a concurrent `pnpm test` reading the file never sees a half-written
// blob. Best-effort: timing data is a hint, so any failure is swallowed.
function saveTimings(measured) {
  try {
    const merged = { ...loadTimings(), ...measured };
    const tmp = `${TIMINGS_PATH}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(merged, null, 2));
    renameSync(tmp, TIMINGS_PATH);
  } catch (err) {
    console.error('[test] Warning: could not persist test timings:', err.message);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The transient-error classifier and bounded-backoff retry wrapper used for the
// one-off admin operations below live in ./dbAdminRetry.mjs so they can be
// unit-tested without spawning a real database (see
// src/test/testRunner.dbRetry.test.ts). isTransientDbError + withAdminRetry are
// imported at the top of this file.

// Count live sessions attached to `dbName` (excluding our own backend).
async function sessionCount(admin, dbName) {
  const { rows } = await admin.query(
    `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [dbName],
  );
  return rows[0]?.n ?? 0;
}

// Terminate every straggler backend on `dbName` and then poll until it truly
// has zero sessions. CREATE DATABASE ... TEMPLATE requires the source to have
// no other sessions; a backend from drizzle-kit push can linger briefly after
// that process exits, so we wait it out instead of racing it.
async function terminateAndWaitForIdle(admin, dbName, { tries = 50, delayMs = 100 } = {}) {
  for (let attempt = 0; attempt < tries; attempt++) {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    if ((await sessionCount(admin, dbName)) === 0) return;
    await sleep(delayMs);
  }
  console.error(
    `[test] Warning: template "${dbName}" still has sessions after waiting; attempting clone anyway.`,
  );
}

// Clone `dbName` from `templateName`, retrying on Postgres error 55006
// ("source database is being accessed by other users"). Even after polling to
// zero sessions there's an inherent race where a new backend attaches in the
// gap before CREATE DATABASE acquires its lock, so re-terminate and retry with
// a short backoff rather than failing the whole run.
async function createDbFromTemplate(admin, dbName, templateName, { tries = 8, delayMs = 250 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      await admin.query(`CREATE DATABASE "${dbName}" TEMPLATE "${templateName}"`);
      return;
    } catch (err) {
      if (err?.code !== '55006' || attempt >= tries) throw err;
      console.error(
        `[test] CREATE DATABASE "${dbName}" hit 55006 (attempt ${attempt}/${tries}); re-terminating template sessions and retrying...`,
      );
      await terminateAndWaitForIdle(admin, templateName);
      await sleep(delayMs);
    }
  }
}

// Run a SINGLE test file as its own `node --test` process against `dbName`.
// Output is buffered and flushed as one contiguous block on close so the
// parallel workers' spec reporters never interleave into unreadable noise.
function runFile(file, dbName) {
  return new Promise((resolve) => {
    const env = { ...baseEnv, DATABASE_URL: urlFor(dbName) };
    // --test-concurrency=1: a file may contain several top-level tests; keep
    //   them serial so they don't race on the worker's shared database.
    // --test-force-exit: some suites exercise SSE/streaming endpoints that can
    //   leave a socket or timer holding the event loop open after every test has
    //   already passed; without this the run would hang on exit.
    const started = Date.now();
    const child = spawn(
      'node',
      ['--import', 'tsx', '--experimental-test-module-mocks', '--test', '--test-concurrency=1', '--test-force-exit', '--test-reporter', 'spec', file],
      { env, cwd: serverDir },
    );
    let buf = '';
    child.stdout.on('data', (d) => { buf += d; });
    child.stderr.on('data', (d) => { buf += d; });
    child.on('close', (code, signal) => {
      resolve({ code: code ?? 1, signal: signal ?? null, buf, ms: Date.now() - started });
    });
    child.on('error', (err) => {
      resolve({ code: 1, signal: null, buf: `failed to start: ${err.message}\n`, ms: Date.now() - started });
    });
  });
}

// One worker: owns `dbName`, and keeps pulling the next file from the shared
// `queue` until it is empty. Because every idle worker races for the same queue,
// a worker that draws a heavy file simply ends up running fewer files — this is
// the work-stealing that keeps all workers finishing within ~one file of each
// other regardless of how lumpy the per-file costs are.
function runWorker(index, dbName, queue, measured) {
  return new Promise((resolve) => {
    let worstCode = 0;
    let count = 0;
    let totalMs = 0;
    const failures = [];
    const step = () => {
      const file = queue.shift(); // shift() is atomic between awaits (single-threaded)
      if (file === undefined) {
        resolve({ code: worstCode, count, totalMs, failures });
        return;
      }
      runFile(file, dbName).then(({ code, signal, buf, ms }) => {
        const rel = path.relative(serverDir, file);
        measured[rel] = ms;
        count += 1;
        totalMs += ms;
        if (code !== 0) {
          worstCode = 1;
          failures.push({ file: rel, code, signal });
        }
        console.log(
          `\n===== worker ${index + 1} — ${path.basename(file)} — exit ${code}${signal ? ` (${signal})` : ''} — ${(ms / 1000).toFixed(1)}s =====`,
        );
        process.stdout.write(buf);
        step();
      });
    };
    step();
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
      // The very first admin operation of the run; under heavy concurrent load
      // the server may still be warming up or briefly out of connections, so
      // tolerate transient errors with bounded retry instead of aborting the
      // whole run before a single test executes.
      await withAdminRetry('CREATE DATABASE template', () =>
        admin.query(`CREATE DATABASE "${templateName}"`),
      );
      console.log(`[test] Created template database "${templateName}"`);
    } finally {
      await admin.end();
    }
  }
  createdDbs.push(templateName);

  console.log('[test] Pushing schema to template database...');
  // Invoke the local drizzle-kit binary directly rather than via `pnpm exec`.
  // When this harness is launched through `pnpm test`, a nested `pnpm exec`
  // deadlocks against the outer pnpm process and the push stalls indefinitely
  // (the run never reaches a single test). The .bin shim runs drizzle-kit with
  // no pnpm layer in between, so the push completes in ~2s as expected.
  const drizzleKitBin = path.join(serverDir, 'node_modules', '.bin', 'drizzle-kit');
  const push = spawnSync(drizzleKitBin, ['push', '--force'], {
    stdio: 'inherit',
    env: { ...baseEnv, DATABASE_URL: urlFor(templateName) },
    cwd: serverDir,
  });
  let migrationsFailed = false;
  if (push.status === 0) {
    // The RMC discovery columns/tables and the KYC lifecycle enum rename are
    // hand-run production migrations (see server/src/db/migrate-*.ts) — they
    // are not part of the Drizzle-managed schema `drizzle-kit push` just
    // applied, the same way they aren't picked up by a bare `db:push` in
    // production. Apply them to the template here so every worker database
    // (cloned from this template below) carries the same schema the app
    // actually runs against; without this, any test touching those columns
    // fails with "column ... does not exist" only under `pnpm test`, never
    // under a plain `db:push`+manual-migrate local setup.
    console.log('[test] Applying hand-run migrations to template database...');
    const tsxBin = path.join(serverDir, 'node_modules', '.bin', 'tsx');
    for (const script of ['src/db/migrate-rmc-discovery.ts', 'src/db/migrate-kyc-lifecycle.ts']) {
      const migrate = spawnSync(tsxBin, [script], {
        stdio: 'inherit',
        env: { ...baseEnv, DATABASE_URL: urlFor(templateName) },
        cwd: serverDir,
      });
      if (migrate.status !== 0) {
        console.error(`[test] ${script} failed against the template database.`);
        migrationsFailed = true;
        exitCode = migrate.status ?? 1;
        break;
      }
    }
  }
  if (push.status !== 0) {
    console.error('[test] drizzle-kit push failed.');
    exitCode = push.status ?? 1;
  } else if (migrationsFailed) {
    // exitCode already set above.
  } else {
    const testFiles = findTests(path.join(serverDir, 'src')).sort();
    if (testFiles.length === 0) {
      console.error('[test] No test files found.');
      exitCode = 1;
    } else {
      // 2. Decide worker count.
      const requested = Number(process.env.TEST_WORKERS) || 0;
      const workerCount = Math.max(
        1,
        Math.min(requested > 0 ? requested : os.cpus().length, testFiles.length, 6),
      );

      // 3. Build the shared work queue, ordered heaviest-first (longest-
      //    processing-time). We sort by last recorded duration; files with no
      //    recorded timing (new files, or a fresh checkout with no
      //    .test-timings.json) sort to the FRONT so a potentially-heavy new file
      //    is dispatched early rather than stranding a worker at the very end.
      //    The work-stealing in runWorker means even a perfectly wrong order
      //    still balances — this just tightens the tail.
      const timings = loadTimings();
      const queue = [...testFiles].sort((a, b) => {
        const ta = timings[path.relative(serverDir, a)];
        const tb = timings[path.relative(serverDir, b)];
        const sa = ta === undefined ? Infinity : ta;
        const sb = tb === undefined ? Infinity : tb;
        return sb - sa; // descending: heaviest (and unknown) first
      });

      // 4. Create one database per worker from the template (fast copy).
      const workerDbs = [];
      const admin = new pg.Pool({ connectionString: baseUrl, ssl });
      try {
        // CREATE DATABASE ... TEMPLATE requires zero sessions on the source.
        // drizzle-kit push runs in its own (already-exited) process, but its
        // backend can linger briefly on the server; terminate any stragglers
        // and then poll pg_stat_activity until the template truly has zero
        // sessions before cloning, so the copy never trips error 55006
        // ("source database is being accessed by other users").
        await terminateAndWaitForIdle(admin, templateName);
        for (let i = 0; i < workerCount; i++) {
          const dbName = makeDbName(`w${i}`);
          // Even after polling to zero sessions there's an inherent race: a new
          // backend can attach in the gap before CREATE DATABASE acquires its
          // lock. Retry a few times with a short backoff, re-terminating each
          // time, instead of failing the entire run on a transient 55006.
          await createDbFromTemplate(admin, dbName, templateName);
          createdDbs.push(dbName);
          workerDbs.push(dbName);
        }
      } finally {
        await admin.end();
      }

      console.log(
        `[test] Running ${testFiles.length} test file(s) across ${workerCount} work-stealing worker(s)...`,
      );
      // 5. Run all workers in parallel against the shared queue; fail the run if
      //    any file failed. `measured` collects this run's per-file durations.
      const measured = {};
      const results = await Promise.all(
        workerDbs.map((dbName, i) => runWorker(i, dbName, queue, measured)),
      );
      exitCode = results.every((r) => r.code === 0) ? 0 : 1;

      const failures = results.flatMap((r) => r.failures);
      if (failures.length > 0) {
        console.error('\n[test] Failing test processes:');
        for (const failure of failures) {
          console.error(
            `[test]   ${failure.file}: exit ${failure.code}${failure.signal ? ` (${failure.signal})` : ''}`,
          );
        }
      }

      // 6. Persist timings for next run's ordering, and report the balance so the
      //    spread between the busiest and idlest worker is visible.
      saveTimings(measured);
      const totals = results.map((r) => r.totalMs / 1000);
      const slowest = Math.max(...totals);
      const fastest = Math.min(...totals);
      console.log(
        `[test] Worker busy-time: ${results
          .map((r, i) => `w${i + 1}=${(r.totalMs / 1000).toFixed(0)}s/${r.count}f`)
          .join('  ')}  (spread ${(slowest - fastest).toFixed(0)}s)`,
      );
    }
  }
} finally {
  // 7. Drop every database we created (workers + template).
  await Promise.all(createdDbs.map((name) => dropDatabase(name)));
}

process.exit(exitCode);
