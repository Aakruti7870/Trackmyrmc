import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';

import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users, aiSettings } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
import { hashPassword } from '../lib/password.js';

let app: Express;

async function createUser(email: string) {
  const passwordHash = await hashPassword('secret123');
  const [user] = await db.insert(users).values({
    name: 'STT user', email, passwordHash, role: 'admin', isActive: true,
  }).returning();
  return user;
}

function tokenFor(u: { id: number; email: string; role: string; name: string }) {
  return signToken({ id: u.id, email: u.email, role: u.role, name: u.name, plantId: null, linkedClientId: null, linkedDriverId: null });
}

async function enableAgent() {
  await db.insert(aiSettings).values({ id: 1, enabled: true })
    .onConflictDoUpdate({ target: aiSettings.id, set: { enabled: true } });
}

// Run a body through /stt with the Gemini env temporarily "configured" so the
// availability gate passes and the request reaches body validation (which runs
// before any network call). The dummy values are restored afterwards so they
// never leak to other tests in this worker.
async function sttConfigured(token: string, body: Record<string, unknown>) {
  const prevBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const prevKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  process.env.AI_INTEGRATIONS_GEMINI_BASE_URL = 'http://localhost:0/unused';
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY = 'test-key';
  try {
    return await request(app).post('/api/ai/stt').set('Authorization', `Bearer ${token}`).send(body);
  } finally {
    if (prevBase === undefined) delete process.env.AI_INTEGRATIONS_GEMINI_BASE_URL; else process.env.AI_INTEGRATIONS_GEMINI_BASE_URL = prevBase;
    if (prevKey === undefined) delete process.env.AI_INTEGRATIONS_GEMINI_API_KEY; else process.env.AI_INTEGRATIONS_GEMINI_API_KEY = prevKey;
  }
}

before(() => {
  app = buildTestApp();
  // Treat the audio service as unconfigured by default so /stt reports its
  // graceful-unavailable path and /config advertises voiceInput=false.
  delete process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  delete process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE ai_settings, users, rate_limit_hits RESTART IDENTITY CASCADE`);
});

after(async () => { await pool.end(); });

test('speech-to-text requires authentication', async () => {
  const res = await request(app).post('/api/ai/stt').send({ audio: 'AAAA', mimeType: 'audio/webm' });
  assert.equal(res.status, 401);
});

test('speech-to-text reports unavailable (503) when the audio service is not configured', async () => {
  const user = await createUser('a@p.com');
  const res = await request(app).post('/api/ai/stt')
    .set('Authorization', `Bearer ${tokenFor(user)}`)
    .send({ audio: 'AAAA', mimeType: 'audio/webm' });
  assert.equal(res.status, 503);
});

test('config advertises voiceInput=false when the audio service is unconfigured', async () => {
  await enableAgent();
  const user = await createUser('cfg@p.com');
  const res = await request(app).get('/api/ai/config').set('Authorization', `Bearer ${tokenFor(user)}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.voiceInput, false);
});

test('config advertises voiceInput=true when the audio service is configured', async () => {
  await enableAgent();
  const user = await createUser('cfg2@p.com');
  const prevBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const prevKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  process.env.AI_INTEGRATIONS_GEMINI_BASE_URL = 'http://localhost:0/unused';
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY = 'test-key';
  try {
    const res = await request(app).get('/api/ai/config').set('Authorization', `Bearer ${tokenFor(user)}`);
    assert.equal(res.body.voiceInput, true);
  } finally {
    if (prevBase === undefined) delete process.env.AI_INTEGRATIONS_GEMINI_BASE_URL; else process.env.AI_INTEGRATIONS_GEMINI_BASE_URL = prevBase;
    if (prevKey === undefined) delete process.env.AI_INTEGRATIONS_GEMINI_API_KEY; else process.env.AI_INTEGRATIONS_GEMINI_API_KEY = prevKey;
  }
});

test('speech-to-text rejects a request with no audio (400)', async () => {
  const user = await createUser('b@p.com');
  const res = await sttConfigured(tokenFor(user), { mimeType: 'audio/webm' });
  assert.equal(res.status, 400);
});

test('speech-to-text rejects an unsupported audio format (400)', async () => {
  const user = await createUser('c@p.com');
  const res = await sttConfigured(tokenFor(user), { audio: 'AAAA', mimeType: 'audio/midi' });
  assert.equal(res.status, 400);
});

test('speech-to-text accepts a recorder mime type with codec params', async () => {
  const user = await createUser('d@p.com');
  // The codec suffix ("audio/webm;codecs=opus") must be stripped before the
  // allow-list check. With valid audio present, a supported mime passes
  // validation and reaches transcription, which fails against the unreachable
  // dummy endpoint → graceful 503 (NOT a 400 "unsupported format").
  const res = await sttConfigured(tokenFor(user), { audio: 'AAAA', mimeType: 'audio/webm;codecs=opus' });
  assert.equal(res.status, 503);
});

test('speech-to-text rejects an oversized clip (400)', async () => {
  const user = await createUser('e@p.com');
  const big = 'A'.repeat(9_000_001);
  const res = await sttConfigured(tokenFor(user), { audio: big, mimeType: 'audio/webm' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /too long/);
});
