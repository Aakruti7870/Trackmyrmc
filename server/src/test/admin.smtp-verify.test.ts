import { test, before, beforeEach, afterEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';
import nodemailer from 'nodemailer';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, auditLogs } from '../db/schema.js';
import { desc } from 'drizzle-orm';
import { signToken } from '../middleware/auth.js';
import { SMTP_KEYS } from '../lib/email.js';
import { setSetting } from '../lib/settings.js';

let app: Express;
const PASSWORD = 'secret123';

type Role = 'admin' | 'dispatcher' | 'plant_operator' | 'client' | 'driver';

async function createUser(role: Role, email: string) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: role === 'admin' ? 'Admin' : 'Staff', email, passwordHash, role, isActive: true,
  }).returning();
  return row;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}

// Replaces nodemailer.createTransport with a fake transporter whose verify()
// either resolves (connection OK) or rejects (connection failed). Captures the
// auth config it was created with so tests can assert which password was used.
function mockTransport(behavior: 'resolve' | 'reject', error = 'ECONNREFUSED — connection refused') {
  const captured: { auth?: { user?: string; pass?: string } } = {};
  const verify = mock.fn(async () => {
    if (behavior === 'reject') throw new Error(error);
    return true;
  });
  mock.method(
    nodemailer,
    'createTransport',
    (config: { auth?: { user?: string; pass?: string } }) => {
      captured.auth = config.auth;
      return { verify } as unknown as ReturnType<typeof nodemailer.createTransport>;
    },
  );
  return { verify, captured };
}

before(() => {
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE audit_logs, users, app_settings RESTART IDENTITY CASCADE`);
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_FROM;
});

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await pool.end();
});

test('rejects unauthenticated requests with 401', async () => {
  const res = await request(app)
    .post('/api/admin/smtp-settings/verify')
    .send({ host: 'smtp.example.com', user: 'u@example.com', pass: 'p' });
  assert.equal(res.status, 401);
});

test('rejects non-admins with 403', async () => {
  const dispatcher = await createUser('dispatcher', 'd@test.com');
  const token = tokenFor(dispatcher);

  const res = await request(app)
    .post('/api/admin/smtp-settings/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.example.com', user: 'u@example.com', pass: 'p' });
  assert.equal(res.status, 403);
});

test('returns 400 on an invalid port', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const token = tokenFor(admin);

  const res = await request(app)
    .post('/api/admin/smtp-settings/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.example.com', port: 'abc', user: 'u@example.com', pass: 'p' });

  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
});

test('returns 400 on an invalid from address', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const token = tokenFor(admin);

  const res = await request(app)
    .post('/api/admin/smtp-settings/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.example.com', from: 'not-an-email', user: 'u@example.com', pass: 'p' });

  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
});

test('returns 502 with the error message when the connection fails', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const token = tokenFor(admin);
  const { verify } = mockTransport('reject', 'getaddrinfo ENOTFOUND smtp.bogus.example');

  const res = await request(app)
    .post('/api/admin/smtp-settings/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.bogus.example', port: '587', user: 'u@example.com', pass: 'topsecret' });

  assert.equal(res.status, 502);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /ENOTFOUND/);
  assert.equal(verify.mock.callCount(), 1, 'transporter.verify was actually attempted');
});

test('returns 200 ok when the connection succeeds', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const token = tokenFor(admin);
  const { verify } = mockTransport('resolve');

  const res = await request(app)
    .post('/api/admin/smtp-settings/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.example.com', port: '587', user: 'u@example.com', pass: 'topsecret' });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(verify.mock.callCount(), 1);
});

test('a blank password tests against the stored password (merges with saved value)', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const token = tokenFor(admin);

  // Persist a full SMTP config first, including a password.
  await setSetting(SMTP_KEYS.host, 'smtp.example.com');
  await setSetting(SMTP_KEYS.port, '587');
  await setSetting(SMTP_KEYS.user, 'mailer@example.com');
  await setSetting(SMTP_KEYS.pass, 'stored-secret');

  const { verify, captured } = mockTransport('resolve');

  // Admin edits only the host and leaves the password blank — the verify must
  // still run against the stored password, not an empty one.
  const res = await request(app)
    .post('/api/admin/smtp-settings/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.example.com', port: '587', user: 'mailer@example.com', pass: '' });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(verify.mock.callCount(), 1);
  assert.equal(captured.auth?.pass, 'stored-secret', 'a blank password falls back to the saved one');
});

test('incomplete config (no stored/supplied password) reports a helpful error without connecting', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const token = tokenFor(admin);
  const { verify } = mockTransport('resolve');

  // Host + user but no password anywhere -> verification cannot proceed.
  const res = await request(app)
    .post('/api/admin/smtp-settings/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.example.com', port: '587', user: 'u@example.com', pass: '' });

  assert.equal(res.status, 502);
  assert.equal(res.body.ok, false);
  assert.match(res.body.error, /incomplete/i);
  assert.equal(verify.mock.callCount(), 0, 'no connection attempt when the config is incomplete');
});

test('records a success audit entry naming the actor when the connection succeeds', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const token = tokenFor(admin);
  mockTransport('resolve');

  const res = await request(app)
    .post('/api/admin/smtp-settings/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.example.com', port: '587', user: 'u@example.com', pass: 'topsecret' });
  assert.equal(res.status, 200);

  const [entry] = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  assert.ok(entry, 'an audit entry was written');
  assert.equal(entry.action, 'smtp_verify');
  assert.equal(entry.status, 'success');
  assert.equal(entry.actorId, admin.id);
  assert.equal(entry.actorName, 'Admin');
});

test('records a failure audit entry with the error message but never the password', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const token = tokenFor(admin);
  mockTransport('reject', 'getaddrinfo ENOTFOUND smtp.bogus.example');

  const res = await request(app)
    .post('/api/admin/smtp-settings/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.bogus.example', port: '587', user: 'u@example.com', pass: 'topsecret' });
  assert.equal(res.status, 502);

  const [entry] = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  assert.ok(entry, 'an audit entry was written');
  assert.equal(entry.action, 'smtp_verify');
  assert.equal(entry.status, 'failure');
  assert.match(entry.detail ?? '', /ENOTFOUND/);
  assert.doesNotMatch(entry.detail ?? '', /topsecret/, 'the password is never logged');
});

test('history endpoint returns both smtp_test and smtp_verify rows, newest first', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const token = tokenFor(admin);

  // Seed one of each kind with explicit, ordered timestamps so the "newest
  // first" assertion is deterministic regardless of insertion speed. An
  // unrelated action is included to prove the endpoint filters to mail tests.
  await db.insert(auditLogs).values([
    {
      actorId: admin.id, actorName: 'Admin', action: 'smtp_test',
      status: 'success', detail: 'Test email sent', emailSent: true,
      createdAt: new Date('2026-01-01T10:00:00Z'),
    },
    {
      actorId: admin.id, actorName: 'Admin', action: 'smtp_verify',
      status: 'failure', detail: 'getaddrinfo ENOTFOUND smtp.bogus.example',
      createdAt: new Date('2026-01-01T11:00:00Z'),
    },
    {
      actorId: admin.id, actorName: 'Admin', action: 'user_create',
      status: 'success', detail: 'unrelated entry',
      createdAt: new Date('2026-01-01T12:00:00Z'),
    },
  ]);

  const res = await request(app)
    .get('/api/admin/email-test/history')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));

  // Only the two mail-test kinds are surfaced; the unrelated action is excluded.
  const actions = res.body.map((r: { action: string }) => r.action);
  assert.deepEqual(actions, ['smtp_verify', 'smtp_test'], 'both kinds, newest first');
  assert.ok(!actions.includes('user_create'), 'unrelated actions are filtered out');
});
