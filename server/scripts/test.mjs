// Test runner: provisions an isolated `<db>_test` database, pushes the Drizzle
// schema to it, then runs the node:test suite against it. Using a dedicated
// database keeps tests deterministic (e.g. the "last remaining admin" guard
// depends on the total admin count) and never touches development data.
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
const testName = `${baseName}_test`;
const ssl = baseUrl.includes('localhost') ? false : { rejectUnauthorized: false };

const admin = new pg.Pool({ connectionString: baseUrl, ssl });
try {
  const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [testName]);
  if (existing.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${testName}"`);
    console.log(`[test] Created test database "${testName}"`);
  } else {
    console.log(`[test] Reusing test database "${testName}"`);
  }
} finally {
  await admin.end();
}

const testUrl = new URL(baseUrl);
testUrl.pathname = `/${testName}`;
const testDatabaseUrl = testUrl.toString();
const env = { ...process.env, DATABASE_URL: testDatabaseUrl, NODE_ENV: 'test' };

console.log('[test] Pushing schema to test database...');
const push = spawnSync('pnpm', ['exec', 'drizzle-kit', 'push', '--force'], {
  stdio: 'inherit',
  env,
  cwd: serverDir,
});
if (push.status !== 0) {
  console.error('[test] drizzle-kit push failed.');
  process.exit(push.status ?? 1);
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

const testFiles = findTests(path.join(serverDir, 'src'));
if (testFiles.length === 0) {
  console.error('[test] No test files found.');
  process.exit(1);
}

console.log(`[test] Running ${testFiles.length} test file(s)...`);
const run = spawnSync(
  'node',
  ['--import', 'tsx', '--test', '--test-reporter', 'spec', ...testFiles],
  { stdio: 'inherit', env, cwd: serverDir },
);
process.exit(run.status ?? 1);
