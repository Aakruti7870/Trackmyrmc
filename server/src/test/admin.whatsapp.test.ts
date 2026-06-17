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
import { WHATSAPP_KEYS } from '../lib/whatsapp.js';

let app: Express;
const PASSWORD = 'secret123';

async function createUser(role: string, email: string) {
  const passwordHash = await hashPassword(PASSWORD);
  const [row] = await db.insert(users).values({
    name: role, email, passwordHash, role: role as typeof users.$inferInsert['role'], isActive: true,
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

// `configured` reflects the Twilio sender env; this suite asserts the UNSET
// (not-configured) default, so clear any ambient Twilio creds for the file.
const TWILIO_ENV_KEYS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM'] as const;
const savedTwilioEnv: Record<string, string | undefined> = {};

before(() => {
  for (const k of TWILIO_ENV_KEYS) {
    savedTwilioEnv[k] = process.env[k];
    delete process.env[k];
  }
  app = buildTestApp();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE audit_logs, users, app_settings RESTART IDENTITY CASCADE`);
});

after(async () => {
  for (const k of TWILIO_ENV_KEYS) {
    if (savedTwilioEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedTwilioEnv[k];
  }
  await pool.end();
});

test('defaults to all-on with empty template SIDs when unset', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const res = await request(app)
    .get('/api/admin/whatsapp-settings')
    .set('Authorization', `Bearer ${tokenFor(admin)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.enabled, true);
  assert.equal(res.body.orderEnabled, true);
  assert.equal(res.body.dispatchEnabled, true);
  assert.equal(res.body.deliveryEnabled, true);
  assert.equal(res.body.orderTemplateSid, null);
  // configured reflects the Twilio sender env, absent in tests.
  assert.equal(res.body.configured, false);
});

test('POST persists toggles + template SIDs and writes an audit entry', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const token = tokenFor(admin);

  const res = await request(app).post('/api/admin/whatsapp-settings')
    .set('Authorization', `Bearer ${token}`)
    .send({
      enabled: true, orderEnabled: false,
      orderTemplateSid: 'HXorder123', dispatchTemplateSid: 'HXdispatch456',
    });
  assert.equal(res.status, 200);
  assert.equal(res.body.orderEnabled, false);
  assert.equal(res.body.orderTemplateSid, 'HXorder123');

  assert.equal(await settingValue(WHATSAPP_KEYS.orderEnabled), 'false');
  assert.equal(await settingValue(WHATSAPP_KEYS.orderTemplateSid), 'HXorder123');
  assert.equal(await settingValue(WHATSAPP_KEYS.dispatchTemplateSid), 'HXdispatch456');

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'whatsapp_settings_updated'));
  assert.equal(logs.length, 1);
  assert.equal(logs[0].actorId, admin.id);
});

test('a blank template SID clears the stored value', async () => {
  const admin = await createUser('admin', 'admin@test.com');
  const token = tokenFor(admin);

  await request(app).post('/api/admin/whatsapp-settings')
    .set('Authorization', `Bearer ${token}`).send({ deliveryTemplateSid: 'HXdelivery' });
  assert.equal(await settingValue(WHATSAPP_KEYS.deliveryTemplateSid), 'HXdelivery');

  const res = await request(app).post('/api/admin/whatsapp-settings')
    .set('Authorization', `Bearer ${token}`).send({ deliveryTemplateSid: '' });
  assert.equal(res.status, 200);
  assert.equal(await settingValue(WHATSAPP_KEYS.deliveryTemplateSid), null);
  assert.equal(res.body.deliveryTemplateSid, null);
});

test('non-admins cannot read or write the settings', async () => {
  const dispatcher = await createUser('dispatcher', 'd@test.com');
  const token = tokenFor(dispatcher);

  const get = await request(app).get('/api/admin/whatsapp-settings').set('Authorization', `Bearer ${token}`);
  assert.equal(get.status, 403);

  const post = await request(app).post('/api/admin/whatsapp-settings')
    .set('Authorization', `Bearer ${token}`).send({ enabled: false });
  assert.equal(post.status, 403);
  assert.equal(await settingValue(WHATSAPP_KEYS.enabled), null);
});
