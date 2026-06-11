import { test, before, beforeEach, afterEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import type { Express } from 'express';
import nodemailer from 'nodemailer';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, auditLogs } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';

type Role = 'admin' | 'dispatcher' | 'plant_operator' | 'client' | 'driver';

let app: Express;

const PASSWORD = 'secret123';
const SMTP_KEYS = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_PORT', 'SMTP_FROM'] as const;
const savedEnv: Record<string, string | undefined> = {};

async function createUser(opts: {
  name: string;
  email: string;
  role?: Role;
  password?: string;
}) {
  const passwordHash = await bcrypt.hash(opts.password ?? PASSWORD, 10);
  const [row] = await db.insert(users).values({
    name: opts.name,
    email: opts.email,
    passwordHash,
    role: opts.role ?? 'dispatcher',
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

// Insert audit rows directly so tests can pin action, targetUserId and
// createdAt — control the POST flow doesn't give over the recorded timestamp.
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

// Make SMTP appear configured so email.ts proceeds to nodemailer.createTransport,
// which the tests then mock to simulate the send succeeding or failing.
function enableSmtp() {
  process.env.SMTP_HOST = 'smtp.test.local';
  process.env.SMTP_USER = 'mailer@test.local';
  process.env.SMTP_PASS = 'super-secret';
}

// Make SMTP appear unconfigured so email.ts short-circuits ("skipped") and never
// touches nodemailer at all.
function disableSmtp() {
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
}

// Replaces nodemailer.createTransport with a fake transporter whose sendMail
// either resolves (sent) or rejects (failed). Returns the sendMail mock so tests
// can assert whether/ how it was called.
function mockTransport(behavior: 'resolve' | 'reject') {
  const sendMail = mock.fn(async () => {
    if (behavior === 'reject') {
      throw new Error('simulated SMTP failure');
    }
    return { messageId: 'test-message-id' };
  });
  mock.method(nodemailer, 'createTransport', () => ({ sendMail }) as unknown as ReturnType<typeof nodemailer.createTransport>);
  return sendMail;
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  for (const k of SMTP_KEYS) savedEnv[k] = process.env[k];
  await db.execute(sql`TRUNCATE TABLE audit_logs, users, login_attempts RESTART IDENTITY CASCADE`);
});

afterEach(() => {
  mock.restoreAll();
  for (const k of SMTP_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

after(async () => {
  await pool.end();
});

test('user.created: welcome email SENT writes an audit entry with emailSent=true', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const token = tokenFor(admin);
  enableSmtp();
  const sendMail = mockTransport('resolve');

  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'New User', email: 'new@test.com', password: PASSWORD, role: 'dispatcher' });

  assert.equal(res.status, 201);
  assert.equal(res.body.emailSent, true, 'response reports the welcome email as sent');
  assert.equal(sendMail.mock.callCount(), 1, 'the transporter actually sent one message');

  const logs = await db.select().from(auditLogs)
    .where(and(eq(auditLogs.action, 'user.created'), eq(auditLogs.targetUserId, res.body.id)));
  assert.equal(logs.length, 1, 'exactly one user.created audit entry should exist');
  assert.equal(logs[0].actorId, admin.id);
  assert.equal(logs[0].actorName, admin.name);
  assert.equal(logs[0].targetUserEmail, 'new@test.com');
  assert.equal(logs[0].emailSent, true, 'audit entry records emailSent=true');
});

test('user.created: welcome email FAILED writes an audit entry with emailSent=false', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const token = tokenFor(admin);
  enableSmtp();
  const sendMail = mockTransport('reject');

  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'New User', email: 'new@test.com', password: PASSWORD, role: 'dispatcher' });

  // The user is still created even though the email failed.
  assert.equal(res.status, 201);
  assert.equal(res.body.emailSent, false, 'response reports the welcome email as not sent');
  assert.equal(sendMail.mock.callCount(), 1, 'sendMail was attempted (and threw)');

  const logs = await db.select().from(auditLogs)
    .where(and(eq(auditLogs.action, 'user.created'), eq(auditLogs.targetUserId, res.body.id)));
  assert.equal(logs.length, 1, 'a user.created audit entry is written even when the email fails');
  assert.equal(logs[0].emailSent, false, 'audit entry records emailSent=false on failure');
});

test('user.created: welcome email SKIPPED (SMTP not configured) writes emailSent=false and never calls nodemailer', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const token = tokenFor(admin);
  disableSmtp();
  const createTransportSpy = mock.method(nodemailer, 'createTransport');

  const res = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'New User', email: 'new@test.com', password: PASSWORD, role: 'dispatcher' });

  assert.equal(res.status, 201);
  assert.equal(res.body.emailSent, false, 'response reports the welcome email as not sent when skipped');
  assert.equal(
    createTransportSpy.mock.callCount(), 0,
    'no transporter is created when SMTP is unconfigured',
  );

  const logs = await db.select().from(auditLogs)
    .where(and(eq(auditLogs.action, 'user.created'), eq(auditLogs.targetUserId, res.body.id)));
  assert.equal(logs.length, 1, 'a user.created audit entry is written even when the email is skipped');
  assert.equal(logs[0].emailSent, false, 'audit entry records emailSent=false when skipped');
});

// The Users page Activity Log now reads the unified /api/audit-logs endpoint
// (audit.ts). These tests confirm the audit entries written by the user routes
// surface through that canonical endpoint, including the per-target filter the
// Users page relies on (targetUserId).
test('GET /api/audit-logs returns recorded entries for an admin', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const token = tokenFor(admin);
  disableSmtp();

  const created = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Audited User', email: 'audited@test.com', password: PASSWORD, role: 'dispatcher' });
  assert.equal(created.status, 201);

  const res = await request(app)
    .get('/api/audit-logs')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.rows), 'audit-logs returns a paged { rows } payload');
  assert.equal(typeof res.body.hasMore, 'boolean', 'audit-logs reports hasMore');
  const entry = res.body.rows.find(
    (e: { action: string; targetUserId: number }) =>
      e.action === 'user.created' && e.targetUserId === created.body.id,
  );
  assert.ok(entry, 'the user.created entry is returned from GET /api/audit-logs');
  assert.equal(entry.actorId, admin.id);
  assert.equal(entry.actorName, admin.name);
  assert.equal(entry.targetUserEmail, 'audited@test.com');
  assert.equal(entry.emailSent, false);
});

test('GET /api/audit-logs?targetUserId filters to one target user', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const token = tokenFor(admin);
  disableSmtp();

  const a = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`)
    .send({ name: 'User A', email: 'a@test.com', password: PASSWORD, role: 'dispatcher' });
  const b = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`)
    .send({ name: 'User B', email: 'b@test.com', password: PASSWORD, role: 'dispatcher' });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);

  const res = await request(app)
    .get(`/api/audit-logs?targetUserId=${a.body.id}`)
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.ok(res.body.rows.length >= 1, 'at least one entry for the filtered user');
  assert.ok(
    res.body.rows.every((e: { targetUserId: number }) => e.targetUserId === a.body.id),
    'every returned entry belongs to the filtered user',
  );
});

test('GET /api/audit-logs is forbidden for non-admins', async () => {
  await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const dispatcher = await createUser({ name: 'Dispatcher', email: 'disp@test.com', role: 'dispatcher' });
  const token = tokenFor(dispatcher);

  const res = await request(app)
    .get('/api/audit-logs')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 403);
});

test('GET /api/audit-logs?action filters by event type', async () => {
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
  assert.ok(
    res.body.rows.every((e: { action: string }) => e.action === 'password_reset'),
    'every returned entry has the filtered action',
  );
});

test('GET /api/audit-logs?from/to filters by date range (to inclusive of whole day)', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([
    { action: 'user.created', targetUserEmail: 'before@x.com', createdAt: new Date('2026-01-31T23:59:59Z') },
    { action: 'user.created', targetUserEmail: 'start@x.com', createdAt: new Date('2026-02-01T00:00:00Z') },
    { action: 'user.created', targetUserEmail: 'endday@x.com', createdAt: new Date('2026-02-28T18:30:00Z') },
    { action: 'user.created', targetUserEmail: 'after@x.com', createdAt: new Date('2026-03-01T00:00:00Z') },
  ]);

  const res = await request(app)
    .get('/api/audit-logs?from=2026-02-01&to=2026-02-28')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  const emails = res.body.rows.map((e: { targetUserEmail: string }) => e.targetUserEmail).sort();
  // 'endday@x.com' lands at 18:30 on the `to` date and must be included because
  // a date-only `to` is treated as inclusive of the entire day.
  assert.deepEqual(emails, ['endday@x.com', 'start@x.com']);
});

test('GET /api/audit-logs combines action, date range and targetUserId via AND', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const target = await createUser({ name: 'Target', email: 'target@x.com', role: 'dispatcher' });
  const other = await createUser({ name: 'Other', email: 'other@x.com', role: 'dispatcher' });
  await seedAudit([
    // Matches all three filters.
    { action: 'password_reset', targetUserId: target.id, targetUserEmail: 'target@x.com', createdAt: new Date('2026-02-10T10:00:00Z') },
    // Wrong action.
    { action: 'user.created', targetUserId: target.id, targetUserEmail: 'target@x.com', createdAt: new Date('2026-02-11T10:00:00Z') },
    // Wrong user.
    { action: 'password_reset', targetUserId: other.id, targetUserEmail: 'other@x.com', createdAt: new Date('2026-02-12T10:00:00Z') },
    // Out of date range.
    { action: 'password_reset', targetUserId: target.id, targetUserEmail: 'target@x.com', createdAt: new Date('2026-05-10T10:00:00Z') },
  ]);

  const res = await request(app)
    .get(`/api/audit-logs?action=password_reset&from=2026-02-01&to=2026-02-28&targetUserId=${target.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 1, 'only the row matching all filters is returned');
  assert.equal(res.body.rows[0].action, 'password_reset');
  assert.equal(res.body.rows[0].targetUserId, target.id);
  assert.equal(res.body.rows[0].targetUserEmail, 'target@x.com');
});

test('GET /api/audit-logs?actorId filters to one actor', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const other = await createUser({ name: 'Other Admin', email: 'other@test.com', role: 'admin' });
  await seedAudit([
    { actorId: admin.id, actorName: admin.name, action: 'user.created', targetUserEmail: 'a@x.com' },
    { actorId: admin.id, actorName: admin.name, action: 'password_reset', targetUserEmail: 'b@x.com' },
    { actorId: other.id, actorName: other.name, action: 'user.created', targetUserEmail: 'c@x.com' },
  ]);

  const res = await request(app)
    .get(`/api/audit-logs?actorId=${admin.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 2, 'only the chosen actor\'s entries are returned');
  assert.ok(
    res.body.rows.every((e: { actorId: number }) => e.actorId === admin.id),
    'every returned entry was performed by the filtered actor',
  );
});

test('GET /api/audit-logs combines actorId with action and date range via AND', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const other = await createUser({ name: 'Other Admin', email: 'other@test.com', role: 'admin' });
  await seedAudit([
    // Matches actor + action + range.
    { actorId: admin.id, actorName: admin.name, action: 'password_reset', targetUserEmail: 'a@x.com', createdAt: new Date('2026-02-10T10:00:00Z') },
    // Right actor, wrong action.
    { actorId: admin.id, actorName: admin.name, action: 'user.created', targetUserEmail: 'b@x.com', createdAt: new Date('2026-02-11T10:00:00Z') },
    // Wrong actor.
    { actorId: other.id, actorName: other.name, action: 'password_reset', targetUserEmail: 'c@x.com', createdAt: new Date('2026-02-12T10:00:00Z') },
    // Right actor + action, out of range.
    { actorId: admin.id, actorName: admin.name, action: 'password_reset', targetUserEmail: 'd@x.com', createdAt: new Date('2026-05-10T10:00:00Z') },
  ]);

  const res = await request(app)
    .get(`/api/audit-logs?actorId=${admin.id}&action=password_reset&from=2026-02-01&to=2026-02-28`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 1, 'only the row matching actor + action + range is returned');
  assert.equal(res.body.rows[0].actorId, admin.id);
  assert.equal(res.body.rows[0].action, 'password_reset');
  assert.equal(res.body.rows[0].targetUserEmail, 'a@x.com');
});

test('GET /api/audit-logs rejects an invalid actorId with 400', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const res = await request(app)
    .get('/api/audit-logs?actorId=not-a-number')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 400);
});

test('GET /api/audit-logs/facets lists the distinct actors', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const other = await createUser({ name: 'Other Admin', email: 'other@test.com', role: 'admin' });
  await seedAudit([
    { actorId: admin.id, actorName: admin.name, action: 'user.created', targetUserEmail: 'a@x.com' },
    { actorId: other.id, actorName: other.name, action: 'user.created', targetUserEmail: 'b@x.com' },
    // Null-actor (system) entries must not produce a phantom actor facet.
    { actorId: null, actorName: null, action: 'smtp_test', targetUserEmail: null },
  ]);

  const res = await request(app)
    .get('/api/audit-logs/facets')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  const ids = res.body.actors.map((a: { id: number }) => a.id).sort((x: number, y: number) => x - y);
  assert.deepEqual(ids, [admin.id, other.id].sort((x, y) => x - y));
});

test('GET /api/audit-logs?q matches across actor name, target email, detail and action', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([
    // Matches via actorName.
    { actorId: admin.id, actorName: 'Priya Sharma', action: 'user.created', targetUserEmail: 'a@x.com', detail: 'made an account' },
    // Matches via targetUserEmail.
    { actorId: admin.id, actorName: 'Admin', action: 'user.updated', targetUserEmail: 'priya@x.com', detail: 'changed role' },
    // Matches via detail.
    { actorId: admin.id, actorName: 'Admin', action: 'password_reset', targetUserEmail: 'b@x.com', detail: 'reset for Priya' },
    // Matches via action.
    { actorId: admin.id, actorName: 'Admin', action: 'priya.special', targetUserEmail: 'c@x.com', detail: 'special event' },
    // Matches none of the four fields.
    { actorId: admin.id, actorName: 'Other', action: 'user.deleted', targetUserEmail: 'z@x.com', detail: 'nothing here' },
  ]);

  const res = await request(app)
    .get('/api/audit-logs?q=priya')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 4, 'every entry mentioning the term in any searchable field is returned');
  const emails = res.body.rows.map((e: { targetUserEmail: string }) => e.targetUserEmail).sort();
  assert.deepEqual(emails, ['a@x.com', 'b@x.com', 'c@x.com', 'priya@x.com']);
});

test('GET /api/audit-logs?q is case-insensitive and excludes non-matches', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([
    { actorId: admin.id, actorName: 'Admin', action: 'user.created', targetUserEmail: 'MATCH@x.com', detail: null },
    { actorId: admin.id, actorName: 'Admin', action: 'user.created', targetUserEmail: 'nope@x.com', detail: null },
  ]);

  const res = await request(app)
    .get('/api/audit-logs?q=match')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.rows.length, 1, 'case-insensitive match returns exactly the matching row');
  assert.equal(res.body.rows[0].targetUserEmail, 'MATCH@x.com');
});

test('GET /api/audit-logs paging: limit/offset slice and hasMore/total report accurately', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  // Five rows with strictly increasing timestamps so the newest-first ordering
  // is deterministic: e5 is newest, e1 is oldest.
  await seedAudit([
    { actorId: admin.id, actorName: 'Admin', action: 'user.created', targetUserEmail: 'e1@x.com', createdAt: new Date('2026-02-01T10:00:00Z') },
    { actorId: admin.id, actorName: 'Admin', action: 'user.created', targetUserEmail: 'e2@x.com', createdAt: new Date('2026-02-02T10:00:00Z') },
    { actorId: admin.id, actorName: 'Admin', action: 'user.created', targetUserEmail: 'e3@x.com', createdAt: new Date('2026-02-03T10:00:00Z') },
    { actorId: admin.id, actorName: 'Admin', action: 'user.created', targetUserEmail: 'e4@x.com', createdAt: new Date('2026-02-04T10:00:00Z') },
    { actorId: admin.id, actorName: 'Admin', action: 'user.created', targetUserEmail: 'e5@x.com', createdAt: new Date('2026-02-05T10:00:00Z') },
  ]);

  const page1 = await request(app)
    .get('/api/audit-logs?limit=2&offset=0')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(page1.status, 200);
  assert.equal(page1.body.rows.length, 2, 'first page holds exactly `limit` rows');
  assert.deepEqual(
    page1.body.rows.map((e: { targetUserEmail: string }) => e.targetUserEmail),
    ['e5@x.com', 'e4@x.com'],
    'first page returns the two newest rows',
  );
  assert.equal(page1.body.total, 5, 'total counts every matching row regardless of the page');
  assert.equal(page1.body.hasMore, true, 'hasMore is true while later pages remain');

  const page2 = await request(app)
    .get('/api/audit-logs?limit=2&offset=2')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(page2.status, 200);
  assert.deepEqual(
    page2.body.rows.map((e: { targetUserEmail: string }) => e.targetUserEmail),
    ['e3@x.com', 'e2@x.com'],
    'second page continues after the first page with no overlap',
  );
  assert.equal(page2.body.total, 5);
  assert.equal(page2.body.hasMore, true);

  const page3 = await request(app)
    .get('/api/audit-logs?limit=2&offset=4')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(page3.status, 200);
  assert.deepEqual(
    page3.body.rows.map((e: { targetUserEmail: string }) => e.targetUserEmail),
    ['e1@x.com'],
    'the final page returns the remaining row',
  );
  assert.equal(page3.body.total, 5);
  assert.equal(page3.body.hasMore, false, 'hasMore is false on the last page');
});

test('GET /api/audit-logs?offset rejects a negative offset with 400', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const res = await request(app)
    .get('/api/audit-logs?offset=-1')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 400);
});

test('GET /api/audit-logs?offset rejects a non-numeric offset with 400', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const res = await request(app)
    .get('/api/audit-logs?offset=not-a-number')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 400);
});

test('GET /api/audit-logs/facets lists the distinct actions', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([
    { actorId: admin.id, actorName: admin.name, action: 'user.created', targetUserEmail: 'a@x.com' },
    { actorId: admin.id, actorName: admin.name, action: 'password_reset', targetUserEmail: 'b@x.com' },
    // A duplicate action must collapse to a single facet entry.
    { actorId: admin.id, actorName: admin.name, action: 'password_reset', targetUserEmail: 'c@x.com' },
  ]);

  const res = await request(app)
    .get('/api/audit-logs/facets')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.actions), 'facets returns an actions array');
  assert.deepEqual(
    [...res.body.actions].sort(),
    ['password_reset', 'user.created'],
    'each distinct action appears exactly once',
  );
});

test('GET /api/audit-logs?from rejects an invalid from date with 400', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const res = await request(app)
    .get('/api/audit-logs?from=not-a-date')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 400);
});

test('GET /api/audit-logs?to rejects an invalid to date with 400', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const res = await request(app)
    .get('/api/audit-logs?to=not-a-date')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 400);
});
