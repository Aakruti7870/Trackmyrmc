import { test, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
function fullConfig(over = {}) {
    return {
        enabled: true, orderEnabled: true, dispatchEnabled: true, deliveryEnabled: true,
        orderTemplateSid: 'HXorder', dispatchTemplateSid: 'HXdispatch', deliveryTemplateSid: 'HXdelivery',
        configured: true, ...over,
    };
}
let cfg = fullConfig();
let waSent = [];
let waBehavior = 'record';
let sidSeq = 0;
let failureAlerts = [];
mock.module('../lib/email.js', {
    namedExports: {
        sendDeliveryNotificationEmail: async () => true,
        sendWhatsAppFailureAlertEmail: async (emails, details) => {
            failureAlerts.push({ emails, details });
            return true;
        },
        sendOrderPlacedEmail: async () => true,
        sendBatchLoggedEmail: async () => true,
        sendWelcomeEmail: async () => true,
        sendPasswordResetNotification: async () => false,
        sendTestEmail: async () => ({ ok: false }),
        getSmtpSettings: async () => ({ host: null, port: null, user: null, from: null, configured: false }),
        verifySmtpConnection: async () => ({ ok: false }),
        getSmtpConfig: async () => ({ host: null, port: null, user: null, pass: null, from: null }),
        SMTP_KEYS: { host: 'smtp_host', port: 'smtp_port', user: 'smtp_user', pass: 'smtp_pass', from: 'smtp_from' },
    },
});
mock.module('../lib/whatsapp.js', {
    namedExports: {
        getWhatsAppConfig: async () => cfg,
        // Mirrors the real gating in whatsapp.ts: global switch AND per-event toggle
        // AND an approved template for that event.
        eventEnabled: (c, event) => {
            if (!c.enabled)
                return false;
            if (event === 'order')
                return c.orderEnabled && !!c.orderTemplateSid;
            if (event === 'dispatch')
                return c.dispatchEnabled && !!c.dispatchTemplateSid;
            return c.deliveryEnabled && !!c.deliveryTemplateSid;
        },
        sendWhatsAppTemplate: async (to, sid, vars) => {
            if (waBehavior === 'throw')
                throw new Error('provider exploded (stubbed)');
            waSent.push({ to, sid, vars });
            // Mirror a real Twilio-accepted send so deliveryNotify can persist the SID
            // + initial status the way it does in production.
            sidSeq += 1;
            return { ok: true, channel: 'whatsapp', sid: `SM${String(sidSeq).padStart(6, '0')}`, status: 'queued' };
        },
        WHATSAPP_KEYS: {},
        DEFAULT_WHATSAPP_ENABLED: true,
    },
});
const { db, pool } = await import('../db/index.js');
const { clients, sites, challans, orders, whatsappMessages, users } = await import('../db/schema.js');
const { notifyChallanStatus, notifyOrderPlaced, notifyStaffOfWhatsAppFailure } = await import('../lib/deliveryNotify.js');
const { eq } = await import('drizzle-orm');
let seq = 0;
async function seedChallan(opts = {}) {
    const [client] = await db.insert(clients).values({
        name: 'Acme Co', contactPerson: 'Jane',
        phone: opts.phone === undefined ? '9991112222' : opts.phone,
        email: null,
    }).returning();
    let siteId = null;
    if (opts.withSite) {
        const [site] = await db.insert(sites).values({ clientId: client.id, name: 'Tower B' }).returning();
        siteId = site.id;
    }
    seq += 1;
    const [challan] = await db.insert(challans).values({
        challanNo: `CH-W${String(seq).padStart(4, '0')}`,
        clientId: client.id, siteId, grade: 'M30', quantity: '8.00',
        status: 'dispatched', dispatchTime: new Date(),
    }).returning();
    return challan;
}
async function seedOrder(opts = {}) {
    const [client] = await db.insert(clients).values({
        name: 'Acme Co', contactPerson: 'Jane',
        phone: opts.phone === undefined ? '9991112222' : opts.phone,
        email: null,
    }).returning();
    seq += 1;
    const [order] = await db.insert(orders).values({
        orderNo: `ORD-W${String(seq).padStart(3, '0')}`,
        clientId: client.id, grade: 'M25', quantity: '6.00', status: 'pending',
    }).returning();
    return order;
}
beforeEach(async () => {
    waSent = [];
    waBehavior = 'record';
    sidSeq = 0;
    failureAlerts = [];
    cfg = fullConfig();
    await db.execute(sql `TRUNCATE TABLE whatsapp_messages, challans, orders, sites, clients, users RESTART IDENTITY CASCADE`);
});
after(async () => { await pool.end(); });
test('dispatch sends the dispatch template with challan variables', async () => {
    const challan = await seedChallan({ withSite: true });
    await notifyChallanStatus(challan.id, 'dispatched');
    assert.equal(waSent.length, 1);
    assert.equal(waSent[0].sid, 'HXdispatch');
    assert.equal(waSent[0].to, '9991112222');
    assert.equal(waSent[0].vars['2'], challan.challanNo);
    assert.equal(waSent[0].vars['3'], 'M30');
    assert.equal(waSent[0].vars['5'], 'Tower B');
});
test('delivery sends the delivery template', async () => {
    const challan = await seedChallan({ withSite: false });
    await notifyChallanStatus(challan.id, 'delivered');
    assert.equal(waSent.length, 1);
    assert.equal(waSent[0].sid, 'HXdelivery');
});
test('order placement sends the order template', async () => {
    const order = await seedOrder();
    await notifyOrderPlaced(order.id);
    assert.equal(waSent.length, 1);
    assert.equal(waSent[0].sid, 'HXorder');
    assert.equal(waSent[0].vars['2'], order.orderNo);
});
test('persists a whatsapp_messages row with the SID + initial status for a dispatch', async () => {
    const challan = await seedChallan({ withSite: true });
    await notifyChallanStatus(challan.id, 'dispatched');
    const rows = await db.select().from(whatsappMessages).where(eq(whatsappMessages.challanId, challan.id));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].event, 'dispatch');
    assert.equal(rows[0].status, 'queued');
    assert.equal(rows[0].channel, 'whatsapp');
    assert.ok(rows[0].messageSid?.startsWith('SM'));
    assert.equal(rows[0].orderId, null);
});
test('persists a whatsapp_messages row linked to the order for a placement', async () => {
    const order = await seedOrder();
    await notifyOrderPlaced(order.id);
    const rows = await db.select().from(whatsappMessages).where(eq(whatsappMessages.orderId, order.id));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].event, 'order');
    assert.ok(rows[0].messageSid?.startsWith('SM'));
    assert.equal(rows[0].challanId, null);
});
test('records no message when the event is gated off (nothing sent, nothing logged)', async () => {
    cfg = fullConfig({ dispatchEnabled: false });
    const challan = await seedChallan();
    await notifyChallanStatus(challan.id, 'dispatched');
    const rows = await db.select().from(whatsappMessages);
    assert.equal(rows.length, 0);
});
test('skips when the global switch is off', async () => {
    cfg = fullConfig({ enabled: false });
    const challan = await seedChallan();
    await notifyChallanStatus(challan.id, 'dispatched');
    assert.equal(waSent.length, 0);
});
test('skips a single event when its toggle is off', async () => {
    cfg = fullConfig({ dispatchEnabled: false });
    const challan = await seedChallan();
    await notifyChallanStatus(challan.id, 'dispatched');
    assert.equal(waSent.length, 0);
});
test('skips when the event has no template configured', async () => {
    cfg = fullConfig({ orderTemplateSid: null });
    const order = await seedOrder();
    await notifyOrderPlaced(order.id);
    assert.equal(waSent.length, 0);
});
test('skips when the customer has no phone', async () => {
    // clients.phone is NOT NULL, so "no phone" surfaces as an empty string — the
    // notify guard treats any falsy phone (null or '') as "nothing to send".
    const challan = await seedChallan({ phone: '' });
    await notifyChallanStatus(challan.id, 'dispatched');
    assert.equal(waSent.length, 0);
});
test('skips silently for an unknown id', async () => {
    await notifyChallanStatus(999999, 'delivered');
    await notifyOrderPlaced(999999);
    assert.equal(waSent.length, 0);
});
test('never throws when the WhatsApp sender fails', async () => {
    waBehavior = 'throw';
    const challan = await seedChallan();
    // Must resolve without rejecting — a failing send can never break the request.
    await notifyChallanStatus(challan.id, 'dispatched');
    assert.equal(waSent.length, 0);
});
// --- Staff failure alert -----------------------------------------------------
async function seedStaff(role, email, opts = {}) {
    await db.insert(users).values({
        name: role, email, passwordHash: 'x',
        role: role,
        isActive: opts.active ?? true,
    });
}
test('failure alert emails every active staff mailbox in the alert roles', async () => {
    await seedStaff('admin', 'admin@test.com');
    await seedStaff('dispatcher', 'dispatch@test.com');
    await seedStaff('authority', 'authority@test.com');
    await seedStaff('plant_operator', 'op@test.com');
    // Excluded: a customer, a driver and an inactive admin.
    await seedStaff('client', 'client@test.com');
    await seedStaff('driver', 'driver@test.com');
    await seedStaff('admin', 'gone@test.com', { active: false });
    const order = await seedOrder();
    const [msg] = await db.insert(whatsappMessages).values({
        messageSid: 'SMfailmail', event: 'order', orderId: order.id,
        toPhone: '+919991112222', status: 'failed', errorCode: '63016', channel: 'whatsapp',
    }).returning();
    await notifyStaffOfWhatsAppFailure(msg.messageSid);
    assert.equal(failureAlerts.length, 1);
    const recipients = [...failureAlerts[0].emails].sort();
    assert.deepEqual(recipients, ['admin@test.com', 'authority@test.com', 'dispatch@test.com', 'op@test.com']);
    assert.equal(failureAlerts[0].details.event, 'order');
    assert.equal(failureAlerts[0].details.orderNo, order.orderNo);
    assert.equal(failureAlerts[0].details.toPhone, '+919991112222');
    assert.equal(failureAlerts[0].details.errorCode, '63016');
});
test('failure alert skips the email when no staff mailboxes resolve', async () => {
    const order = await seedOrder();
    const [msg] = await db.insert(whatsappMessages).values({
        messageSid: 'SMnostaff', event: 'order', orderId: order.id,
        toPhone: '+910000000000', status: 'failed', channel: 'whatsapp',
    }).returning();
    await notifyStaffOfWhatsAppFailure(msg.messageSid);
    assert.equal(failureAlerts.length, 0);
});
test('failure alert resolves nothing (and never throws) for an unknown SID', async () => {
    await notifyStaffOfWhatsAppFailure('SMdoesnotexist');
    assert.equal(failureAlerts.length, 0);
});
