import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, sql } from 'drizzle-orm';

import { db, pool } from '../db/index.js';
import { appSettings } from '../db/schema.js';
import { SMTP_KEYS } from '../lib/email.js';
import { setSetting } from '../lib/settings.js';
import { syncSmtpFromEnv } from '../lib/smtpRecovery.js';

const ENV_VARS = ['SMTP_SYNC_FROM_ENV', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] as const;
const savedEnv: Record<string, string | undefined> = {};
for (const k of ENV_VARS) savedEnv[k] = process.env[k];

async function settingValue(key: string): Promise<string | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  return row?.value ?? null;
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE app_settings RESTART IDENTITY CASCADE`);
  for (const k of ENV_VARS) delete process.env[k];
});

after(async () => {
  for (const k of ENV_VARS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  await pool.end();
});

test('does nothing when SMTP_SYNC_FROM_ENV is not set', async () => {
  await setSetting(SMTP_KEYS.pass, 'stale-password');
  process.env.SMTP_PASS = 'new-app-password';

  await syncSmtpFromEnv();

  assert.equal(await settingValue(SMTP_KEYS.pass), 'stale-password');
});

test('overwrites persisted settings from env when flag is set', async () => {
  await setSetting(SMTP_KEYS.host, 'smtp.gmail.com');
  await setSetting(SMTP_KEYS.user, 'old@example.com');
  await setSetting(SMTP_KEYS.pass, 'stale-password');

  process.env.SMTP_SYNC_FROM_ENV = '1';
  process.env.SMTP_USER = 'new@example.com';
  process.env.SMTP_PASS = 'abcd efgh ijkl mnop';

  await syncSmtpFromEnv();

  // Present env vars overwrite the persisted values...
  assert.equal(await settingValue(SMTP_KEYS.user), 'new@example.com');
  assert.equal(await settingValue(SMTP_KEYS.pass), 'abcd efgh ijkl mnop');
  // ...while keys absent from the environment keep their persisted value.
  assert.equal(await settingValue(SMTP_KEYS.host), 'smtp.gmail.com');
});

test('blank env vars are ignored (never wipe a persisted value)', async () => {
  await setSetting(SMTP_KEYS.pass, 'stale-password');

  process.env.SMTP_SYNC_FROM_ENV = '1';
  process.env.SMTP_PASS = '   ';

  await syncSmtpFromEnv();

  assert.equal(await settingValue(SMTP_KEYS.pass), 'stale-password');
});

test('inserts settings that did not exist before', async () => {
  process.env.SMTP_SYNC_FROM_ENV = '1';
  process.env.SMTP_HOST = 'smtp.gmail.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_FROM = 'noreply@example.com';

  await syncSmtpFromEnv();

  assert.equal(await settingValue(SMTP_KEYS.host), 'smtp.gmail.com');
  assert.equal(await settingValue(SMTP_KEYS.port), '587');
  assert.equal(await settingValue(SMTP_KEYS.from), 'noreply@example.com');
});
