import { test, before, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
let sent = [];
let behavior = 'success';
mock.module('../lib/email.js', {
    namedExports: {
        sendDeliveryNotificationEmail: async (email, name, details) => {
            if (behavior === 'throw')
                throw new Error('SMTP down (stubbed)');
            sent.push({ email, name, details });
            return true;
        },
        sendOrderPlacedEmail: async () => true,
        sendBatchLoggedEmail: async () => true,
        sendWelcomeEmail: async () => true,
        sendLoginCodeEmail: async () => true,
        sendPasswordResetNotification: async () => false,
        sendWhatsAppFailureAlertEmail: async () => true,
        sendTestEmail: async () => ({ ok: false }),
        getSmtpSettings: async () => ({ host: null, port: null, user: null, from: null, configured: false }),
        verifySmtpConnection: async () => ({ ok: false }),
        getSmtpConfig: async () => ({ host: null, port: null, user: null, pass: null, from: null }),
        SMTP_KEYS: { host: 'smtp_host', port: 'smtp_port', user: 'smtp_user', pass: 'smtp_pass', from: 'smtp_from' },
    },
});
const { db, pool } = await import('../db/index.js');
const { clients, sites, challans } = await import('../db/schema.js');
const { notifyChallanStatus } = await import('../lib/deliveryNotify.js');
let challanSeq = 0;
async function seedChallan(opts) {
    const [client] = await db.insert(clients).values({
        name: 'Acme Co', contactPerson: 'Jane', phone: '1112223333',
        email: opts.email === undefined ? 'cust@test.com' : opts.email,
    }).returning();
    let siteId = null;
    if (opts.withSite) {
        const [site] = await db.insert(sites).values({ clientId: client.id, name: 'Tower B' }).returning();
        siteId = site.id;
    }
    challanSeq += 1;
    const [challan] = await db.insert(challans).values({
        challanNo: `CH-N${String(challanSeq).padStart(4, '0')}`,
        clientId: client.id, siteId, grade: 'M30', quantity: '8.00',
        status: 'dispatched', dispatchTime: new Date(),
    }).returning();
    return challan;
}
before(() => { });
beforeEach(async () => {
    sent = [];
    behavior = 'success';
    await db.execute(sql `TRUNCATE TABLE challans, recurring_orders, orders, sites, clients RESTART IDENTITY CASCADE`);
});
after(async () => { await pool.end(); });
test('sends a dispatched notification with the challan details', async () => {
    const challan = await seedChallan({ withSite: true });
    await notifyChallanStatus(challan.id, 'dispatched');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].email, 'cust@test.com');
    assert.equal(sent[0].name, 'Acme Co');
    assert.equal(sent[0].details.status, 'dispatched');
    assert.equal(sent[0].details.challanNo, challan.challanNo);
    assert.equal(sent[0].details.grade, 'M30');
    assert.equal(sent[0].details.siteName, 'Tower B');
});
test('sends a delivered notification (siteName null when no site)', async () => {
    const challan = await seedChallan({ withSite: false });
    await notifyChallanStatus(challan.id, 'delivered');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].details.status, 'delivered');
    assert.equal(sent[0].details.siteName, null);
});
test('skips silently when the client has no email', async () => {
    const challan = await seedChallan({ email: null });
    await notifyChallanStatus(challan.id, 'dispatched');
    assert.equal(sent.length, 0);
});
test('skips silently for an unknown challan id', async () => {
    await notifyChallanStatus(999999, 'dispatched');
    assert.equal(sent.length, 0);
});
test('never throws when the email sender fails', async () => {
    behavior = 'throw';
    const challan = await seedChallan({ withSite: true });
    await notifyChallanStatus(challan.id, 'delivered');
    assert.equal(sent.length, 0);
});
