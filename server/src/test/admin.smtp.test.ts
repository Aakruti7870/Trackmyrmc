import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { hashPassword } from '../lib/password.js';
import { eq, sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, appSettings, auditLogs } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { getSmtpConfig, SMTP_KEYS } from '../lib/email.js';

let app: Express;
const PASSWORD = 'secret123';

async function createAdmin(email = 'admin@test.com') {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: 'Admin', email, passwordHash, role: 'admin', isActive: true,
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
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_FROM;
});

after(async () => {
  await pool.end();
});

test('POST /admin/smtp-settings persists all fields and reports configured', async () => {
  const admin = await createAdmin();
  const token = tokenFor(admin);

  const res = await request(app)
    .post('/api/admin/smtp-settings')
    .set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.example.com', port: '465', user: 'mailer@example.com', from: 'noreply@example.com', pass: 'topsecret' });

  assert.equal(res.status, 200);
  assert.equal(res.body.host, 'smtp.example.com');
  assert.equal(res.body.port, '465');
  assert.equal(res.body.configured, true);
  // The username/from are masked in the response (no plaintext leak).
  assert.notEqual(res.body.user, 'mailer@example.com');
  assert.ok(res.body.user.includes('•'));

  // Values are persisted in the database so they survive a restart.
  assert.equal(await settingValue(SMTP_KEYS.host), 'smtp.example.com');
  assert.equal(await settingValue(SMTP_KEYS.port), '465');
  assert.equal(await settingValue(SMTP_KEYS.pass), 'topsecret');

  // The email layer resolves the persisted config.
  const cfg = await getSmtpConfig();
  assert.equal(cfg.host, 'smtp.example.com');
  assert.equal(cfg.pass, 'topsecret');

  // An audit entry is written.
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'smtp_settings_updated'));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].actorId, admin.id);
});

test('audit detail names which SMTP fields changed (without secret values)', async () => {
  const admin = await createAdmin();
  const token = tokenFor(admin);

  // First save: every field is new, so all of them should be listed.
  await request(app).post('/api/admin/smtp-settings').set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.example.com', port: '587', user: 'mailer@example.com', from: 'noreply@example.com', pass: 'topsecret' });

  let logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'smtp_settings_updated')).orderBy(auditLogs.id);
  assert.equal(logs.length, 1);
  const first = logs[0].detail ?? '';
  assert.match(first, /host/);
  assert.match(first, /port/);
  assert.match(first, /username/);
  assert.match(first, /from address/);
  assert.match(first, /password rotated/);
  // The secret value must never appear in the audit detail.
  assert.ok(!first.includes('topsecret'), 'password value must not be logged');

  // Second save: only the host changes; a blank password keeps the old one.
  await request(app).post('/api/admin/smtp-settings').set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp2.example.com', port: '587', user: 'mailer@example.com', from: 'noreply@example.com', pass: '' });

  logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'smtp_settings_updated')).orderBy(auditLogs.id);
  assert.equal(logs.length, 2);
  const second = logs[1].detail ?? '';
  assert.match(second, /host/);
  assert.ok(!/port/.test(second), 'unchanged port must not be listed');
  assert.ok(!/username/.test(second), 'unchanged username must not be listed');
  assert.ok(!/password rotated/.test(second), 'a kept password must not report rotation');

  // Third save: rotate only the password.
  await request(app).post('/api/admin/smtp-settings').set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp2.example.com', port: '587', user: 'mailer@example.com', from: 'noreply@example.com', pass: 'newsecret' });

  logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'smtp_settings_updated')).orderBy(auditLogs.id);
  assert.equal(logs.length, 3);
  const third = logs[2].detail ?? '';
  assert.match(third, /password rotated/);
  assert.ok(!third.includes('newsecret'), 'rotated password value must not be logged');
  assert.ok(!/host/.test(third), 'unchanged host must not be listed');

  // Fourth save: identical values -> no field changes reported.
  await request(app).post('/api/admin/smtp-settings').set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp2.example.com', port: '587', user: 'mailer@example.com', from: 'noreply@example.com', pass: '' });

  logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'smtp_settings_updated')).orderBy(auditLogs.id);
  assert.equal(logs.length, 4);
  assert.match(logs[3].detail ?? '', /No fields were changed/);
});

test('persisted settings take precedence over env vars; blank fields fall back to env', async () => {
  process.env.SMTP_HOST = 'env-host.example.com';
  process.env.SMTP_USER = 'env-user@example.com';
  process.env.SMTP_PASS = 'env-pass';

  const admin = await createAdmin();
  const token = tokenFor(admin);

  // Override only the host; leave the rest blank so they fall back to env.
  const res = await request(app)
    .post('/api/admin/smtp-settings')
    .set('Authorization', `Bearer ${token}`)
    .send({ host: 'db-host.example.com', port: '', user: '', from: '', pass: '' });
  assert.equal(res.status, 200);

  const cfg = await getSmtpConfig();
  assert.equal(cfg.host, 'db-host.example.com', 'persisted host wins');
  assert.equal(cfg.user, 'env-user@example.com', 'blank user falls back to env');
  assert.equal(cfg.pass, 'env-pass', 'blank password falls back to env');
});

test('a blank password keeps the previously saved password', async () => {
  const admin = await createAdmin();
  const token = tokenFor(admin);

  await request(app).post('/api/admin/smtp-settings').set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.example.com', port: '587', user: 'u@example.com', from: 'f@example.com', pass: 'firstpass' });

  // Save again with a blank password but a changed host.
  await request(app).post('/api/admin/smtp-settings').set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp2.example.com', port: '587', user: 'u@example.com', from: 'f@example.com', pass: '' });

  const cfg = await getSmtpConfig();
  assert.equal(cfg.host, 'smtp2.example.com');
  assert.equal(cfg.pass, 'firstpass', 'a blank password must not erase the stored one');
});

test('partial update: omitting user/from/pass keeps their stored values', async () => {
  const admin = await createAdmin();
  const token = tokenFor(admin);

  // Fully configure first.
  await request(app).post('/api/admin/smtp-settings').set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.example.com', port: '587', user: 'mailer@example.com', from: 'noreply@example.com', pass: 'topsecret' });

  // Now save again sending ONLY host/port (as the UI does when an admin edits
  // just those). user/from/pass are omitted entirely and must be preserved.
  const res = await request(app).post('/api/admin/smtp-settings').set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp-new.example.com', port: '465' });
  assert.equal(res.status, 200);

  assert.equal(await settingValue(SMTP_KEYS.host), 'smtp-new.example.com');
  assert.equal(await settingValue(SMTP_KEYS.port), '465');
  assert.equal(await settingValue(SMTP_KEYS.user), 'mailer@example.com', 'omitted user must be kept');
  assert.equal(await settingValue(SMTP_KEYS.from), 'noreply@example.com', 'omitted from must be kept');
  assert.equal(await settingValue(SMTP_KEYS.pass), 'topsecret', 'omitted password must be kept');

  const cfg = await getSmtpConfig();
  assert.equal(cfg.host, 'smtp-new.example.com');
  assert.equal(cfg.user, 'mailer@example.com');
  assert.equal(cfg.pass, 'topsecret');
});

test('explicit empty string clears a field (reverts to env fallback)', async () => {
  process.env.SMTP_USER = 'env-user@example.com';

  const admin = await createAdmin();
  const token = tokenFor(admin);

  await request(app).post('/api/admin/smtp-settings').set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.example.com', port: '587', user: 'mailer@example.com', from: 'noreply@example.com', pass: 'topsecret' });

  // Explicitly send user as an empty string -> clears the persisted value.
  const res = await request(app).post('/api/admin/smtp-settings').set('Authorization', `Bearer ${token}`)
    .send({ host: 'smtp.example.com', port: '587', user: '' });
  assert.equal(res.status, 200);

  assert.equal(await settingValue(SMTP_KEYS.user), null, 'empty string clears the persisted user');
  const cfg = await getSmtpConfig();
  assert.equal(cfg.user, 'env-user@example.com', 'cleared user falls back to env');
});

test('validation: rejects a non-numeric port and an invalid from address', async () => {
  const admin = await createAdmin();
  const token = tokenFor(admin);

  const badPort = await request(app).post('/api/admin/smtp-settings').set('Authorization', `Bearer ${token}`)
    .send({ port: 'abc' });
  assert.equal(badPort.status, 400);

  const badFrom = await request(app).post('/api/admin/smtp-settings').set('Authorization', `Bearer ${token}`)
    .send({ from: 'not-an-email' });
  assert.equal(badFrom.status, 400);

  // Nothing should have been persisted.
  assert.equal(await settingValue(SMTP_KEYS.port), null);
  assert.equal(await settingValue(SMTP_KEYS.from), null);
});

test('non-admins cannot read or write SMTP settings', async () => {
  const passwordHash = await hashPassword(PASSWORD);
  const [dispatcher] = await db.insert(users).values({
    name: 'Dispatch', email: 'd@test.com', passwordHash, role: 'dispatcher', isActive: true,
  }).returning();
  const token = tokenFor(dispatcher);

  const get = await request(app).get('/api/admin/smtp-settings').set('Authorization', `Bearer ${token}`);
  assert.equal(get.status, 403);

  const post = await request(app).post('/api/admin/smtp-settings').set('Authorization', `Bearer ${token}`)
    .send({ host: 'x.example.com' });
  assert.equal(post.status, 403);
});
