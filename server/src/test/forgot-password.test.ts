import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, passwordSetupTokens } from '../db/schema.js';
import { hashPassword } from '../lib/password.js';
import { createInviteToken } from '../lib/inviteToken.js';
import { trustedResetBaseUrl } from '../routes/auth.js';

let app: Express;

async function createUser(opts: { email: string; isActive?: boolean; deletedAt?: Date | null }) {
  const passwordHash = await hashPassword('secret123');
  const [row] = await db.insert(users).values({
    name: 'User',
    email: opts.email,
    passwordHash,
    role: 'admin',
    isActive: opts.isActive ?? true,
    deletedAt: opts.deletedAt ?? null,
  }).returning();
  return row;
}

async function tokenCountFor(userId: number) {
  const rows = await db.select().from(passwordSetupTokens).where(eq(passwordSetupTokens.userId, userId));
  return rows.length;
}

before(() => { app = buildTestApp(); });

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE audit_logs, password_setup_tokens, users, plants RESTART IDENTITY CASCADE`);
});

after(async () => { await pool.end(); });

// --- Issue 1: host-header reset-link poisoning -----------------------------
// The reset origin is derived from trusted configuration only. The function
// takes no request, so a forged Host / X-Forwarded-Host header structurally
// cannot influence the link an attacker would receive a victim's token through.
test('trustedResetBaseUrl prefers APP_URL and ignores request headers entirely', () => {
  const savedApp = process.env.APP_URL;
  const savedPublic = process.env.PUBLIC_URL;
  try {
    process.env.APP_URL = 'https://trusted.example.com/';
    process.env.PUBLIC_URL = '';
    assert.equal(trustedResetBaseUrl(), 'https://trusted.example.com');
  } finally {
    if (savedApp === undefined) delete process.env.APP_URL; else process.env.APP_URL = savedApp;
    if (savedPublic === undefined) delete process.env.PUBLIC_URL; else process.env.PUBLIC_URL = savedPublic;
  }
});

test('trustedResetBaseUrl falls back to the Replit dev domain, never a request host', () => {
  const savedApp = process.env.APP_URL;
  const savedPublic = process.env.PUBLIC_URL;
  const savedDev = process.env.REPLIT_DEV_DOMAIN;
  try {
    delete process.env.APP_URL;
    delete process.env.PUBLIC_URL;
    process.env.REPLIT_DEV_DOMAIN = 'my-repl.replit.dev';
    assert.equal(trustedResetBaseUrl(), 'https://my-repl.replit.dev');

    delete process.env.REPLIT_DEV_DOMAIN;
    assert.equal(trustedResetBaseUrl(), null);
  } finally {
    if (savedApp === undefined) delete process.env.APP_URL; else process.env.APP_URL = savedApp;
    if (savedPublic === undefined) delete process.env.PUBLIC_URL; else process.env.PUBLIC_URL = savedPublic;
    if (savedDev === undefined) delete process.env.REPLIT_DEV_DOMAIN; else process.env.REPLIT_DEV_DOMAIN = savedDev;
  }
});

test('forgot-password with a forged X-Forwarded-Host still responds generically and issues a reset token', async () => {
  const user = await createUser({ email: 'victim@test.com' });

  const res = await request(app)
    .post('/api/auth/forgot-password')
    .set('X-Forwarded-Host', 'attacker.example')
    .set('Host', 'attacker.example')
    .send({ email: 'victim@test.com' });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  // A token is issued for a real active user, but its link origin came from
  // trusted config — never the attacker-controlled Host header above.
  assert.equal(await tokenCountFor(user.id), 1);
  const [tok] = await db.select().from(passwordSetupTokens).where(eq(passwordSetupTokens.userId, user.id));
  assert.equal(tok.kind, 'reset');
});

// --- Issue 2: suspended-account reactivation bypass ------------------------
test('forgot-password issues NO reset token for a suspended account', async () => {
  const user = await createUser({ email: 'suspended@test.com', isActive: false });

  const res = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'suspended@test.com' });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true); // generic, no enumeration
  assert.equal(await tokenCountFor(user.id), 0);
});

test('forgot-password issues NO reset token for a soft-deleted account', async () => {
  const user = await createUser({ email: 'gone@test.com', deletedAt: new Date() });

  const res = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'gone@test.com' });

  assert.equal(res.status, 200);
  assert.equal(await tokenCountFor(user.id), 0);
});

test('a reset token cannot reactivate an account suspended after the token was issued', async () => {
  const user = await createUser({ email: 'racy@test.com', isActive: true });
  // Token minted while active...
  const { token } = await createInviteToken(user.id, undefined, 'reset');
  // ...then an admin suspends the account.
  await db.update(users).set({ isActive: false }).where(eq(users.id, user.id));

  const set = await request(app)
    .post('/api/auth/set-password')
    .send({ token, password: 'brandnewpass1' });

  assert.equal(set.status, 403);
  assert.equal(set.body.reason, 'disabled');

  // Account stays suspended and the (locked-out) password is unchanged enough
  // that the user still cannot sign in.
  const [after] = await db.select().from(users).where(eq(users.id, user.id));
  assert.equal(after.isActive, false);
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'racy@test.com', password: 'brandnewpass1' });
  assert.notEqual(login.status, 200);
});

test('an invite token (kind=invite) still reactivates a freshly-provisioned owner', async () => {
  const user = await createUser({ email: 'owner@test.com', isActive: false });
  const { token } = await createInviteToken(user.id); // default kind = 'invite'

  const set = await request(app)
    .post('/api/auth/set-password')
    .send({ token, password: 'ownerpass123' });

  assert.equal(set.status, 200);
  const [after] = await db.select().from(users).where(eq(users.id, user.id));
  assert.equal(after.isActive, true);
});
