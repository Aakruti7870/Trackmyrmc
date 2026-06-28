import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { buildTestApp } from './app.js';
import { db, pool } from '../db/index.js';
import { users } from '../db/schema.js';
import { signToken } from '../middleware/auth.js';
let app;
const KEY = 'MANUS_API_KEY';
const prevKey = process.env[KEY];
async function createUser(role, email) {
    const [u] = await db.insert(users).values({
        name: `${role} user`, email, role: role, isActive: true,
    }).returning();
    return u;
}
function tokenFor(u) {
    return signToken({ id: u.id, email: u.email, role: u.role, name: u.name });
}
// A canned Manus v2 response builder (success wrapper).
function manusJson(body) {
    return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, request_id: 'req_test', ...body }),
        text: async () => '',
    };
}
before(async () => {
    app = buildTestApp();
});
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
    mock.reset();
});
after(async () => {
    if (prevKey === undefined)
        delete process.env[KEY];
    else
        process.env[KEY] = prevKey;
    mock.reset();
    await pool.end();
});
test('GET /manus/status reports configured=false without the key', async () => {
    delete process.env[KEY];
    const su = await createUser('authority', 'boss@example.com');
    const res = await request(app)
        .get('/api/manus/status')
        .set('Authorization', `Bearer ${tokenFor(su)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.configured, false);
});
test('Manus routes reject anonymous requests with 401', async () => {
    const res = await request(app).get('/api/manus/tasks');
    assert.equal(res.status, 401);
});
test('Manus routes forbid non-management roles with 403', async () => {
    const driver = await createUser('driver', 'driver@example.com');
    const res = await request(app)
        .get('/api/manus/tasks')
        .set('Authorization', `Bearer ${tokenFor(driver)}`);
    assert.equal(res.status, 403);
});
test('POST /manus/tasks validates an empty prompt with 400', async () => {
    process.env[KEY] = 'test-key';
    const su = await createUser('authority', 'boss@example.com');
    const res = await request(app)
        .post('/api/manus/tasks')
        .set('Authorization', `Bearer ${tokenFor(su)}`)
        .send({ prompt: '   ' });
    assert.equal(res.status, 400);
});
test('POST /manus/tasks returns 503 when the key is missing', async () => {
    delete process.env[KEY];
    const su = await createUser('authority', 'boss@example.com');
    const res = await request(app)
        .post('/api/manus/tasks')
        .set('Authorization', `Bearer ${tokenFor(su)}`)
        .send({ prompt: 'do a thing' });
    assert.equal(res.status, 503);
});
test('POST /manus/tasks creates a task via the Manus API', async () => {
    process.env[KEY] = 'test-key';
    mock.method(global, 'fetch', async (_url, init) => {
        // The prompt must be forwarded in the documented message envelope.
        const body = JSON.parse(init?.body || '{}');
        assert.equal(body.message.content[0].text, 'Draft a quotation');
        return manusJson({
            task_id: 'task_123', task_title: 'Quotation draft',
            task_url: 'https://manus.im/app/task_123', share_url: 'https://manus.im/s/abc',
        });
    });
    const su = await createUser('admin', 'admin@example.com');
    const res = await request(app)
        .post('/api/manus/tasks')
        .set('Authorization', `Bearer ${tokenFor(su)}`)
        .send({ prompt: 'Draft a quotation' });
    assert.equal(res.status, 201);
    assert.equal(res.body.taskId, 'task_123');
    assert.equal(res.body.taskUrl, 'https://manus.im/app/task_123');
});
test('GET /manus/tasks maps the Manus list into our shape', async () => {
    process.env[KEY] = 'test-key';
    mock.method(global, 'fetch', async () => manusJson({
        data: [
            { id: 't1', title: 'First', created_at: 1700000000, updated_at: 1700000100, credit_usage: 12, task_url: 'https://manus.im/app/t1' },
            { id: 't2', title: null, created_at: 1700000200 },
        ],
        has_more: true,
        next_cursor: 'cur_2',
    }));
    const su = await createUser('authority', 'boss@example.com');
    const res = await request(app)
        .get('/api/manus/tasks')
        .set('Authorization', `Bearer ${tokenFor(su)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.tasks.length, 2);
    assert.equal(res.body.tasks[0].id, 't1');
    assert.equal(res.body.tasks[0].creditUsage, 12);
    assert.equal(res.body.hasMore, true);
    assert.equal(res.body.nextCursor, 'cur_2');
});
test('GET /manus/tasks/:id/messages derives status + result text', async () => {
    process.env[KEY] = 'test-key';
    mock.method(global, 'fetch', async () => manusJson({
        messages: [
            { type: 'user_message', content: 'please research X' },
            { type: 'assistant_message', content: 'Here is the report.' },
            { type: 'status_update', status_update: { agent_status: 'stopped' } },
        ],
    }));
    const su = await createUser('authority', 'boss@example.com');
    const res = await request(app)
        .get('/api/manus/tasks/task_123/messages')
        .set('Authorization', `Bearer ${tokenFor(su)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'stopped');
    assert.ok(res.body.resultText.includes('Here is the report.'));
    assert.ok(!res.body.resultText.includes('please research X'), 'user echo excluded');
});
test('Manus upstream errors are forwarded with their status', async () => {
    process.env[KEY] = 'test-key';
    mock.method(global, 'fetch', async () => ({
        ok: false,
        status: 429,
        json: async () => ({ ok: false, request_id: 'r', error: { code: 'rate_limited', message: 'Slow down' } }),
        text: async () => '',
    }));
    const su = await createUser('authority', 'boss@example.com');
    const res = await request(app)
        .get('/api/manus/tasks')
        .set('Authorization', `Bearer ${tokenFor(su)}`);
    assert.equal(res.status, 429);
    assert.equal(res.body.code, 'rate_limited');
});
