import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, appSettings, auditLogs } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { VARIANCE_KEYS, getVarianceTolerance, isWithinTolerance } from '../lib/variance.js';

let app: Express;
const PASSWORD = 'secret123';

async function createUser(role: string, email: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [row] = await db.insert(users).values({
    name: role, email, passwordHash, role, isActive: true,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

async function settingValue(key: string): Promise<string | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  return row?.value ?? null;
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE audit_logs, users, app_settings RESTART IDENTITY CASCADE`);
});

after(async () => {
  await pool.end();
});

test('defaults to 0.1 m³ / 0% when unset', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const res = await request(app)
    .get('/api/admin/variance-tolerance')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.abs, 0.1);
  assert.equal(res.body.pct, 0);
});

test('POST persists both bands and writes an audit entry', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const token = tokenFor(admin);

  const res = await request(app).post('/api/admin/variance-tolerance')
    .set('Authorization', `Bearer ${token}`)
    .send({ abs: '0.25', pct: '5' });
  assert.equal(res.status, 200);
  assert.equal(res.body.abs, 0.25);
  assert.equal(res.body.pct, 5);

  assert.equal(await settingValue(VARIANCE_KEYS.abs), '0.25');
  assert.equal(await settingValue(VARIANCE_KEYS.pct), '5');

  const resolved = await getVarianceTolerance();
  assert.deepEqual(resolved, { abs: 0.25, pct: 5 });

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'variance_tolerance_updated'));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].actorId, admin.id);
  assert.match(logs[0].detail ?? '', /0\.1.*0\.25/);
});

test('accepts numeric (non-string) values too', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const res = await request(app).post('/api/admin/variance-tolerance')
    .set('Authorization', `Bearer ${tokenFor(admin)}`)
    .send({ abs: 0.5, pct: 2 });
  assert.equal(res.status, 200);
  assert.equal(res.body.abs, 0.5);
  assert.equal(res.body.pct, 2);
});

test('an empty string clears a value, reverting to the default', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const token = tokenFor(admin);

  await request(app).post('/api/admin/variance-tolerance')
    .set('Authorization', `Bearer ${token}`).send({ abs: '0.3', pct: '4' });

  const res = await request(app).post('/api/admin/variance-tolerance')
    .set('Authorization', `Bearer ${token}`).send({ abs: '' });
  assert.equal(res.status, 200);
  assert.equal(await settingValue(VARIANCE_KEYS.abs), null, 'empty string clears abs');
  assert.equal(res.body.abs, 0.1, 'cleared abs reverts to default');
  assert.equal(res.body.pct, 4, 'pct untouched');
});

test('rejects negative absolute and out-of-range percentage', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const token = tokenFor(admin);

  const badAbs = await request(app).post('/api/admin/variance-tolerance')
    .set('Authorization', `Bearer ${token}`).send({ abs: '-1' });
  assert.equal(badAbs.status, 400);

  const badPct = await request(app).post('/api/admin/variance-tolerance')
    .set('Authorization', `Bearer ${token}`).send({ pct: '150' });
  assert.equal(badPct.status, 400);

  assert.equal(await settingValue(VARIANCE_KEYS.abs), null);
  assert.equal(await settingValue(VARIANCE_KEYS.pct), null);
});

test('any authenticated user can read the tolerance via /reports', async () => {
  const dispatcher = await createUser('dispatcher', 'd@test.com');
  const res = await request(app)
    .get('/api/reports/variance-tolerance')
    .set('Authorization', `Bearer ${tokenFor(dispatcher)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.abs, 0.1);
});

test('non-admins cannot write the tolerance', async () => {
  const dispatcher = await createUser('dispatcher', 'd@test.com');
  const token = tokenFor(dispatcher);

  const get = await request(app).get('/api/admin/variance-tolerance').set('Authorization', `Bearer ${token}`);
  assert.equal(get.status, 403);

  const post = await request(app).post('/api/admin/variance-tolerance')
    .set('Authorization', `Bearer ${token}`).send({ abs: '0.9' });
  assert.equal(post.status, 403);
  assert.equal(await settingValue(VARIANCE_KEYS.abs), null);
});

test('isWithinTolerance honours the more generous of the two bands', () => {
  // Absolute-only (default): a 0.2 delta on a 10 m³ load is flagged.
  assert.equal(isWithinTolerance(0.2, 10, { abs: 0.1, pct: 0 }), false);
  // 5% of 10 m³ = 0.5, so the same 0.2 delta is now on target.
  assert.equal(isWithinTolerance(0.2, 10, { abs: 0.1, pct: 5 }), true);
  // The absolute band still applies for tiny loads where the percentage is smaller.
  assert.equal(isWithinTolerance(0.1, 1, { abs: 0.1, pct: 5 }), true);
});
