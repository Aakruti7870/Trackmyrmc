import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from '../lib/password.js';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../db/index.js';
import { users, clients, drivers } from '../db/schema.js';
// These tests bypass the application-level findLinkConflict guard entirely and
// write straight to the database, proving the one-account-per-client/driver rule
// is enforced by the partial unique indexes themselves (users_linked_client_unique
// and users_linked_driver_unique). Without them, a future refactor could drop the
// index or the catch in routes/users.ts and the route-level suite would stay green.
const PASSWORD = 'secret123';
async function createClient(name = 'Acme Corp') {
    const [row] = await db.insert(clients).values({
        name, contactPerson: 'Contact', phone: '8888888888', creditLimit: '0', outstandingAmount: '0',
    }).returning();
    return row;
}
async function createDriver(name = 'John Driver') {
    const [row] = await db.insert(drivers).values({ name, phone: '9999999999' }).returning();
    return row;
}
async function insertUser(opts) {
    const passwordHash = await hashPassword(PASSWORD);
    const [row] = await db.insert(users).values({
        name: opts.name,
        email: opts.email,
        passwordHash,
        role: opts.role ?? 'client',
        isActive: opts.isActive ?? true,
        linkedClientId: opts.linkedClientId ?? null,
        linkedDriverId: opts.linkedDriverId ?? null,
        deletedAt: opts.deletedAt ?? null,
    }).returning();
    return row;
}
// A Postgres unique-violation surfaces as code 23505 with the offending index in
// `constraint`. routes/users.ts (linkUniqueViolationMessage) keys off exactly
// these two values to turn the raw DB error into a friendly 409, so the tests
// assert both — if the index were renamed or dropped, this would catch it.
//
// drizzle-orm (>=0.44) wraps every failed query in a `DrizzleQueryError` and
// hangs the original `pg` DatabaseError off `.cause`, so the 23505/constraint
// fields now live one level down. Unwrap to the underlying pg error before
// asserting (falling back to the top-level error for direct pg rejections).
function assertUniqueViolation(err, constraint) {
    const e = err;
    const code = e?.code ?? e?.cause?.code;
    const actualConstraint = e?.constraint ?? e?.cause?.constraint;
    assert.equal(code, '23505', 'DB should reject with a unique-violation (23505)');
    assert.equal(actualConstraint, constraint, `violation should name the ${constraint} index`);
}
before(() => { });
beforeEach(async () => {
    await db.execute(sql `TRUNCATE TABLE audit_logs, users, clients, drivers, login_attempts RESTART IDENTITY CASCADE`);
});
after(async () => { await pool.end(); });
test('DB rejects a direct INSERT of a second live user linked to the same client (23505)', async () => {
    const client = await createClient();
    await insertUser({ name: 'First', email: 'first@test.com', linkedClientId: client.id });
    await assert.rejects(insertUser({ name: 'Second', email: 'second@test.com', linkedClientId: client.id }), (err) => {
        assertUniqueViolation(err, 'users_linked_client_unique');
        return true;
    });
    // Only the first account holds the link — the duplicate insert was rolled back.
    const linked = await db.select({ id: users.id }).from(users).where(eq(users.linkedClientId, client.id));
    assert.equal(linked.length, 1, 'exactly one live account may hold a client link');
});
test('DB rejects a direct INSERT of a second live user linked to the same driver (23505)', async () => {
    const driver = await createDriver();
    await insertUser({ name: 'First', email: 'first@test.com', role: 'driver', linkedDriverId: driver.id });
    await assert.rejects(insertUser({ name: 'Second', email: 'second@test.com', role: 'driver', linkedDriverId: driver.id }), (err) => {
        assertUniqueViolation(err, 'users_linked_driver_unique');
        return true;
    });
    const linked = await db.select({ id: users.id }).from(users).where(eq(users.linkedDriverId, driver.id));
    assert.equal(linked.length, 1, 'exactly one live account may hold a driver link');
});
test('DB rejects a direct UPDATE that points a second live user at an already-linked client (23505)', async () => {
    const client = await createClient();
    await insertUser({ name: 'Holder', email: 'holder@test.com', linkedClientId: client.id });
    const other = await insertUser({ name: 'Other', email: 'other@test.com' });
    await assert.rejects(db.update(users).set({ linkedClientId: client.id }).where(eq(users.id, other.id)), (err) => {
        assertUniqueViolation(err, 'users_linked_client_unique');
        return true;
    });
    // The blocked update left the second account unlinked.
    const [row] = await db.select({ linkedClientId: users.linkedClientId }).from(users).where(eq(users.id, other.id));
    assert.equal(row.linkedClientId, null, 'a rejected update must not link the second account');
});
test('DB rejects a direct UPDATE that points a second live user at an already-linked driver (23505)', async () => {
    const driver = await createDriver();
    await insertUser({ name: 'Holder', email: 'holder@test.com', role: 'driver', linkedDriverId: driver.id });
    const other = await insertUser({ name: 'Other', email: 'other@test.com', role: 'driver' });
    await assert.rejects(db.update(users).set({ linkedDriverId: driver.id }).where(eq(users.id, other.id)), (err) => {
        assertUniqueViolation(err, 'users_linked_driver_unique');
        return true;
    });
    const [row] = await db.select({ linkedDriverId: users.linkedDriverId }).from(users).where(eq(users.id, other.id));
    assert.equal(row.linkedDriverId, null, 'a rejected update must not link the second account');
});
test('partial index allows re-linking a client once the holding account is soft-deleted', async () => {
    const client = await createClient();
    const holder = await insertUser({ name: 'Holder', email: 'holder@test.com', linkedClientId: client.id });
    // While the holder is live the link is taken.
    await assert.rejects(insertUser({ name: 'Blocked', email: 'blocked@test.com', linkedClientId: client.id }), (err) => { assertUniqueViolation(err, 'users_linked_client_unique'); return true; });
    // Soft-deleting the holder drops it out of the partial index (deleted_at IS NULL),
    // freeing the client to be linked again.
    await db.update(users).set({ deletedAt: new Date(), isActive: false }).where(eq(users.id, holder.id));
    const reused = await insertUser({ name: 'Reused', email: 'reused@test.com', linkedClientId: client.id });
    assert.ok(reused.id, 'a new live account may take the link once the holder is soft-deleted');
    // The constraint is still live: a *second* live account is rejected again.
    await assert.rejects(insertUser({ name: 'Blocked2', email: 'blocked2@test.com', linkedClientId: client.id }), (err) => { assertUniqueViolation(err, 'users_linked_client_unique'); return true; });
});
test('partial index allows re-linking a driver once the holding account is soft-deleted', async () => {
    const driver = await createDriver();
    const holder = await insertUser({ name: 'Holder', email: 'holder@test.com', role: 'driver', linkedDriverId: driver.id });
    await assert.rejects(insertUser({ name: 'Blocked', email: 'blocked@test.com', role: 'driver', linkedDriverId: driver.id }), (err) => { assertUniqueViolation(err, 'users_linked_driver_unique'); return true; });
    await db.update(users).set({ deletedAt: new Date(), isActive: false }).where(eq(users.id, holder.id));
    const reused = await insertUser({ name: 'Reused', email: 'reused@test.com', role: 'driver', linkedDriverId: driver.id });
    assert.ok(reused.id, 'a new live account may take the driver link once the holder is soft-deleted');
    await assert.rejects(insertUser({ name: 'Blocked2', email: 'blocked2@test.com', role: 'driver', linkedDriverId: driver.id }), (err) => { assertUniqueViolation(err, 'users_linked_driver_unique'); return true; });
});
test('partial index ignores NULL links: many live accounts may have no client/driver link', async () => {
    // The WHERE ... IS NOT NULL clause means unlinked accounts never collide, even
    // though they all share a NULL linkedClientId/linkedDriverId.
    await insertUser({ name: 'A', email: 'a@test.com', role: 'dispatcher' });
    await insertUser({ name: 'B', email: 'b@test.com', role: 'dispatcher' });
    const c = await insertUser({ name: 'C', email: 'c@test.com', role: 'dispatcher' });
    assert.ok(c.id, 'multiple unlinked live accounts coexist without a unique violation');
});
