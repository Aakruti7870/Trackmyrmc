import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
const app = buildTestApp();
beforeEach(async () => { await db.execute(sql `TRUNCATE TABLE users RESTART IDENTITY CASCADE`); });
after(async () => { await pool.end(); });
test('retired DELETE /me/account still requires authentication', async () => {
    assert.equal((await request(app).delete('/api/me/account')).status, 401);
});
test('retired deletion endpoint cannot bypass mandatory OTP verification', async () => {
    const [user] = await db.insert(users).values({ name: 'Customer', email: 'customer-delete@example.com', phone: '+919876500099', role: 'client' }).returning();
    const token = signToken({ id: user.id, name: user.name, email: user.email, role: user.role });
    const response = await request(app).delete('/api/me/account').set('Authorization', `Bearer ${token}`);
    assert.equal(response.status, 410);
    assert.match(response.body.error, /OTP verification/);
    const [unchanged] = await db.select().from(users).where(sql `${users.id}=${user.id}`);
    assert.equal(unchanged.isActive, true);
    assert.equal(unchanged.deletedAt, null);
});
