import webpush from 'web-push';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pushSubscriptions, users } from '../db/schema.js';
// Web Push (browser/PWA) delivery for order & dispatch notifications. These pop
// up on the customer's device even when the app is closed, complementing the
// in-app SSE toasts (which only fire while the app is open) and email. All
// sends are best-effort: a missing key or a dead endpoint never throws back
// into the originating request.
let configured = null;
// Lazily configure web-push with the VAPID keypair from the environment. Caches
// the result so a missing key only warns once. Returns false when keys are
// absent so callers can silently no-op.
function ensureConfigured() {
    if (configured !== null)
        return configured;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) {
        console.warn('[push] VAPID keys not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY missing). ' +
            'Web push disabled.');
        configured = false;
        return false;
    }
    const subject = process.env.VAPID_SUBJECT || 'mailto:notifications@example.com';
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    return true;
}
export function isPushConfigured() {
    return ensureConfigured();
}
// The public key the browser needs to create a subscription. Public by design.
export function getVapidPublicKey() {
    return process.env.VAPID_PUBLIC_KEY || null;
}
// Upsert a subscription keyed by its (globally unique) endpoint. Re-subscribing
// the same browser refreshes the keys and re-owns the row for this user.
export async function saveSubscription(userId, sub, userAgent) {
    await db
        .insert(pushSubscriptions)
        .values({
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent: userAgent ?? null,
    })
        .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent ?? null },
    });
}
// Delete a subscription. When a userId is supplied the delete is scoped to that
// owner so a caller can only remove their own endpoint (prevents revoking
// another user's push delivery). The unscoped form is used internally for
// pruning endpoints the push service has reported as gone (404/410).
export async function deleteSubscription(endpoint, userId) {
    const where = userId == null
        ? eq(pushSubscriptions.endpoint, endpoint)
        : and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId));
    await db.delete(pushSubscriptions).where(where);
}
// Send to every subscription a single user has (they may have several devices).
export async function sendPushToUser(userId, payload) {
    if (!ensureConfigured())
        return 0;
    const subs = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));
    return sendToSubs(subs, payload);
}
// Send to every active, non-deleted account linked to a customer (client) row.
// This is the order/delivery notification fan-out.
export async function sendPushToClientUsers(clientId, payload) {
    if (!ensureConfigured())
        return 0;
    const linked = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.linkedClientId, clientId), eq(users.isActive, true), isNull(users.deletedAt)));
    if (linked.length === 0)
        return 0;
    const ids = linked.map((u) => u.id);
    const subs = await db
        .select()
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.userId, ids));
    return sendToSubs(subs, payload);
}
// Deliver one payload to a set of subscriptions in parallel, pruning endpoints
// the push service reports as gone (404/410). Returns how many were accepted.
async function sendToSubs(subs, payload) {
    if (subs.length === 0)
        return 0;
    const body = JSON.stringify(payload);
    let sent = 0;
    const dead = [];
    await Promise.all(subs.map(async (s) => {
        try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
            sent += 1;
        }
        catch (err) {
            const status = err.statusCode;
            if (status === 404 || status === 410)
                dead.push(s.endpoint);
            else
                console.warn('[push] send failed:', status, err.message);
        }
    }));
    if (dead.length > 0) {
        try {
            await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, dead));
        }
        catch (err) {
            console.warn('[push] failed to prune dead subscriptions:', err);
        }
    }
    return sent;
}
