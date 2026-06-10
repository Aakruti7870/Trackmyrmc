import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, auditLogs } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

type Role = 'admin' | 'dispatcher' | 'plant_operator' | 'client' | 'driver';

let app: Express;

const PASSWORD = 'secret123';

async function createUser(opts: {
  name: string; email: string; role?: Role; isActive?: boolean;
}) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: opts.role ?? 'dispatcher',
    isActive: opts.isActive ?? true,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

type AuditSeed = {
  actorId?: number | null;
  actorName?: string | null;
  action: string;
  targetUserId?: number | null;
  targetUserEmail?: string | null;
  detail?: string | null;
  emailSent?: boolean | null;
  createdAt?: Date;
};

async function seedAudit(rows: AuditSeed[]) {
  await db.insert(auditLogs).values(rows.map(r => ({
    actorId: r.actorId ?? null,
    actorName: r.actorName ?? null,
    action: r.action,
    targetUserId: r.targetUserId ?? null,
    targetUserEmail: r.targetUserEmail ?? null,
    detail: r.detail ?? null,
    emailSent: r.emailSent ?? null,
    ...(r.createdAt ? { createdAt: r.createdAt } : {}),
  })));
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE audit_logs, users, login_attempts RESTART IDENTITY CASCADE`);
});

after(async () => {
  await pool.end();
});

test('requires an admin: a dispatcher gets 403', async () => {
  const dispatcher = await createUser({ name: 'Dispatch', email: 'd@test.com', role: 'dispatcher' });
  const res = await request(app)
    .get('/api/audit-logs')
    .set('Authorization', `Bearer ${tokenFor(dispatcher)}`);
  assert.equal(res.status, 403);
});

test('returns the full trail across target types, newest first', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([
    { actorId: admin.id, actorName: admin.name, action: 'user.created', targetUserEmail: 'a@x.com', emailSent: true, createdAt: new Date('2026-01-01T10:00:00Z') },
    { actorId: admin.id, actorName: admin.name, action: 'password_reset', targetUserEmail: 'b@x.com', emailSent: false, createdAt: new Date('2026-01-03T10:00:00Z') },
    { actorId: admin.id, actorName: admin.name, action: 'role_change', targetUserEmail: 'c@x.com', detail: 'driver → admin', createdAt: new Date('2026-01-02T10:00:00Z') },
  ]);

  const res = await request(app)
    .get('/api/audit-logs')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 3);
  assert.equal(res.body.hasMore, false);
  // newest first
  assert.equal(res.body.rows[0].action, 'password_reset');
  assert.equal(res.body.rows[1].action, 'role_change');
  assert.equal(res.body.rows[2].action, 'user.created');
});

test('filters by action type', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([
    { action: 'user.created', targetUserEmail: 'a@x.com' },
    { action: 'password_reset', targetUserEmail: 'b@x.com' },
    { action: 'password_reset', targetUserEmail: 'c@x.com' },
  ]);

  const res = await request(app)
    .get('/api/audit-logs?action=password_reset')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 2);
  assert.ok(res.body.rows.every((r: { action: string }) => r.action === 'password_reset'));
});

test('filters by multiple actions (comma-separated)', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([
    { action: 'user.created', targetUserEmail: 'a@x.com' },
    { action: 'user.deleted', targetUserEmail: 'b@x.com' },
    { action: 'password_reset', targetUserEmail: 'c@x.com' },
  ]);

  const res = await request(app)
    .get('/api/audit-logs?action=user.created,user.deleted')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 2);
  assert.ok(res.body.rows.every((r: { action: string }) => r.action !== 'password_reset'));
});

test('filters by actor', async () => {
  const admin = await createUser({ name: 'Admin One', email: 'admin@test.com', role: 'admin' });
  const other = await createUser({ name: 'Admin Two', email: 'admin2@test.com', role: 'admin' });
  await seedAudit([
    { actorId: admin.id, actorName: admin.name, action: 'user.created', targetUserEmail: 'a@x.com' },
    { actorId: other.id, actorName: other.name, action: 'user.created', targetUserEmail: 'b@x.com' },
  ]);

  const res = await request(app)
    .get(`/api/audit-logs?actorId=${admin.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 1);
  assert.equal(res.body.rows[0].actorId, admin.id);
});

test('filters by date range (inclusive of whole end day)', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([
    { action: 'user.created', targetUserEmail: 'old@x.com', createdAt: new Date('2026-01-01T10:00:00Z') },
    { action: 'user.created', targetUserEmail: 'mid@x.com', createdAt: new Date('2026-02-15T18:00:00Z') },
    { action: 'user.created', targetUserEmail: 'new@x.com', createdAt: new Date('2026-03-30T10:00:00Z') },
  ]);

  const res = await request(app)
    .get('/api/audit-logs?from=2026-02-01&to=2026-02-28')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 1);
  assert.equal(res.body.rows[0].targetUserEmail, 'mid@x.com');
});

test('free-text search matches actor, target email and detail', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([
    { actorName: 'Alice', action: 'user.created', targetUserEmail: 'find@example.com' },
    { actorName: 'Bob', action: 'role_change', targetUserEmail: 'other@x.com', detail: 'driver → admin' },
    { actorName: 'Carol', action: 'user.created', targetUserEmail: 'nope@x.com' },
  ]);

  const byEmail = await request(app)
    .get('/api/audit-logs?q=find@example')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(byEmail.body.rows.length, 1);
  assert.equal(byEmail.body.rows[0].targetUserEmail, 'find@example.com');

  const byDetail = await request(app)
    .get('/api/audit-logs?q=driver')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(byDetail.body.rows.length, 1);
  assert.equal(byDetail.body.rows[0].actorName, 'Bob');

  const byActor = await request(app)
    .get('/api/audit-logs?q=carol')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(byActor.body.rows.length, 1);
  assert.equal(byActor.body.rows[0].actorName, 'Carol');
});

test('combines filters with AND', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([
    { actorId: admin.id, actorName: admin.name, action: 'password_reset', targetUserEmail: 'a@x.com', createdAt: new Date('2026-02-10T10:00:00Z') },
    { actorId: admin.id, actorName: admin.name, action: 'user.created', targetUserEmail: 'b@x.com', createdAt: new Date('2026-02-10T10:00:00Z') },
    { actorId: admin.id, actorName: admin.name, action: 'password_reset', targetUserEmail: 'c@x.com', createdAt: new Date('2026-05-10T10:00:00Z') },
  ]);

  const res = await request(app)
    .get('/api/audit-logs?action=password_reset&from=2026-02-01&to=2026-02-28')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 1);
  assert.equal(res.body.rows[0].targetUserEmail, 'a@x.com');
});

test('facets returns distinct actions and actors', async () => {
  const admin = await createUser({ name: 'Admin One', email: 'admin@test.com', role: 'admin' });
  const other = await createUser({ name: 'Admin Two', email: 'admin2@test.com', role: 'admin' });
  await seedAudit([
    { actorId: admin.id, actorName: admin.name, action: 'user.created', targetUserEmail: 'a@x.com' },
    { actorId: admin.id, actorName: admin.name, action: 'user.created', targetUserEmail: 'b@x.com' },
    { actorId: other.id, actorName: other.name, action: 'password_reset', targetUserEmail: 'c@x.com' },
    { actorId: null, actorName: null, action: 'lockout_cleared', targetUserEmail: 'd@x.com' },
  ]);

  const res = await request(app)
    .get('/api/audit-logs/facets')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.deepEqual([...res.body.actions].sort(), ['lockout_cleared', 'password_reset', 'user.created']);
  assert.equal(res.body.actors.length, 2);
  const ids = res.body.actors.map((a: { id: number }) => a.id).sort((x: number, y: number) => x - y);
  assert.deepEqual(ids, [admin.id, other.id].sort((x, y) => x - y));
});

test('invalid actorId returns 400', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const res = await request(app)
    .get('/api/audit-logs?actorId=abc')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 400);
});

test('pages through results with limit + offset, exposing hasMore', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  // Seed 5 entries, oldest → newest by createdAt
  await seedAudit(
    Array.from({ length: 5 }, (_, i) => ({
      action: 'user.created',
      targetUserEmail: `user${i}@x.com`,
      createdAt: new Date(`2026-01-0${i + 1}T10:00:00Z`),
    })),
  );

  // Page 1: newest two, more remain
  const page1 = await request(app)
    .get('/api/audit-logs?limit=2&offset=0')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(page1.status, 200);
  assert.equal(page1.body.rows.length, 2);
  assert.equal(page1.body.hasMore, true);
  assert.equal(page1.body.rows[0].targetUserEmail, 'user4@x.com');
  assert.equal(page1.body.rows[1].targetUserEmail, 'user3@x.com');

  // Page 2: next two, still more
  const page2 = await request(app)
    .get('/api/audit-logs?limit=2&offset=2')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(page2.body.rows.length, 2);
  assert.equal(page2.body.hasMore, true);
  assert.equal(page2.body.rows[0].targetUserEmail, 'user2@x.com');
  assert.equal(page2.body.rows[1].targetUserEmail, 'user1@x.com');

  // Page 3: last one, no more
  const page3 = await request(app)
    .get('/api/audit-logs?limit=2&offset=4')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(page3.body.rows.length, 1);
  assert.equal(page3.body.hasMore, false);
  assert.equal(page3.body.rows[0].targetUserEmail, 'user0@x.com');
});

test('paging respects active filters', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([
    { action: 'password_reset', targetUserEmail: 'p1@x.com', createdAt: new Date('2026-01-01T10:00:00Z') },
    { action: 'user.created', targetUserEmail: 'c1@x.com', createdAt: new Date('2026-01-02T10:00:00Z') },
    { action: 'password_reset', targetUserEmail: 'p2@x.com', createdAt: new Date('2026-01-03T10:00:00Z') },
    { action: 'password_reset', targetUserEmail: 'p3@x.com', createdAt: new Date('2026-01-04T10:00:00Z') },
  ]);

  const page1 = await request(app)
    .get('/api/audit-logs?action=password_reset&limit=2&offset=0')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(page1.body.rows.length, 2);
  assert.equal(page1.body.hasMore, true);
  assert.ok(page1.body.rows.every((r: { action: string }) => r.action === 'password_reset'));

  const page2 = await request(app)
    .get('/api/audit-logs?action=password_reset&limit=2&offset=2')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(page2.body.rows.length, 1);
  assert.equal(page2.body.hasMore, false);
  assert.equal(page2.body.rows[0].targetUserEmail, 'p1@x.com');
});

test('returns the exact total count of matching rows, independent of paging', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit(
    Array.from({ length: 5 }, (_, i) => ({
      action: 'user.created',
      targetUserEmail: `user${i}@x.com`,
      createdAt: new Date(`2026-01-0${i + 1}T10:00:00Z`),
    })),
  );

  // Full set: total matches the row count.
  const all = await request(app)
    .get('/api/audit-logs')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(all.status, 200);
  assert.equal(all.body.total, 5);
  assert.equal(all.body.rows.length, 5);

  // A narrow page still reports the full total, not just the page size.
  const page = await request(app)
    .get('/api/audit-logs?limit=2&offset=2')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(page.body.total, 5);
  assert.equal(page.body.rows.length, 2);
  assert.equal(page.body.hasMore, true);
});

test('total count honors the active filters', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([
    { action: 'password_reset', targetUserEmail: 'p1@x.com' },
    { action: 'password_reset', targetUserEmail: 'p2@x.com' },
    { action: 'password_reset', targetUserEmail: 'p3@x.com' },
    { action: 'user.created', targetUserEmail: 'c1@x.com' },
  ]);

  const res = await request(app)
    .get('/api/audit-logs?action=password_reset&limit=2')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  // Only the 3 matching rows are counted, not all 4.
  assert.equal(res.body.total, 3);
  assert.equal(res.body.rows.length, 2);
  assert.equal(res.body.hasMore, true);
});

test('total is zero when nothing matches', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([{ action: 'user.created', targetUserEmail: 'a@x.com' }]);

  const res = await request(app)
    .get('/api/audit-logs?q=no-such-thing')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 0);
  assert.equal(res.body.rows.length, 0);
  assert.equal(res.body.hasMore, false);
});

test('invalid offset returns 400', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const res = await request(app)
    .get('/api/audit-logs?offset=-1')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 400);
});
