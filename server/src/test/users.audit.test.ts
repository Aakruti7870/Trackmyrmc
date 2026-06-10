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

test('GET /api/users/audit-log?action filters by event type', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([
    { action: 'user.created', targetUserEmail: 'a@x.com' },
    { action: 'password_reset', targetUserEmail: 'b@x.com' },
    { action: 'password_reset', targetUserEmail: 'c@x.com' },
  ]);

  const res = await request(app)
    .get('/api/users/audit-log?action=password_reset')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
  assert.ok(
    res.body.every((e: { action: string }) => e.action === 'password_reset'),
    'every returned entry has the filtered action',
  );
});

test('GET /api/users/audit-log?from/to filters by date range (to inclusive of whole day)', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  await seedAudit([
    { action: 'user.created', targetUserEmail: 'before@x.com', createdAt: new Date('2026-01-31T23:59:59Z') },
    { action: 'user.created', targetUserEmail: 'start@x.com', createdAt: new Date('2026-02-01T00:00:00Z') },
    { action: 'user.created', targetUserEmail: 'endday@x.com', createdAt: new Date('2026-02-28T18:30:00Z') },
    { action: 'user.created', targetUserEmail: 'after@x.com', createdAt: new Date('2026-03-01T00:00:00Z') },
  ]);

  const res = await request(app)
    .get('/api/users/audit-log?from=2026-02-01&to=2026-02-28')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  const emails = res.body.map((e: { targetUserEmail: string }) => e.targetUserEmail).sort();
  // 'endday@x.com' lands at 18:30 on the `to` date and must be included because
  // a date-only `to` is treated as inclusive of the entire day.
  assert.deepEqual(emails, ['endday@x.com', 'start@x.com']);
});

test('GET /api/users/audit-log combines action, date range and userId via AND', async () => {
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
    .get(`/api/users/audit-log?action=password_reset&from=2026-02-01&to=2026-02-28&userId=${target.id}`)
    .set('Authorization', `Bearer ${tokenFor(admin)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1, 'only the row matching all filters is returned');
  assert.equal(res.body[0].action, 'password_reset');
  assert.equal(res.body[0].targetUserId, target.id);
  assert.equal(res.body[0].targetUserEmail, 'target@x.com');
});

test('GET /api/users/audit-log rejects an invalid from date with 400', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const res = await request(app)
    .get('/api/users/audit-log?from=not-a-date')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 400);
});

test('GET /api/users/audit-log rejects an invalid to date with 400', async () => {
  const admin = await createUser({ name: 'Admin', email: 'admin@test.com', role: 'admin' });
  const res = await request(app)
    .get('/api/users/audit-log?to=not-a-date')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 400);
});
