import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, clients, sites } from '../db/schema.js';
import { sendDeliveryNotificationEmail } from './email.js';
// Best-effort customer email for a challan status change. Loads the customer's
// email + delivery-site name and sends the relevant notification. Never throws:
// email delivery is non-critical, so any failure (missing email, SMTP down) is
// swallowed and logged so the originating request can never fail because of it.
export async function notifyChallanStatus(challanId, status) {
    try {
        const [row] = await db
            .select({
            challanNo: challans.challanNo,
            grade: challans.grade,
            quantity: challans.quantity,
            clientName: clients.name,
            email: clients.email,
            siteName: sites.name,
        })
            .from(challans)
            .leftJoin(clients, eq(challans.clientId, clients.id))
            .leftJoin(sites, eq(challans.siteId, sites.id))
            .where(eq(challans.id, challanId));
        if (!row || !row.email)
            return;
        await sendDeliveryNotificationEmail(row.email, row.clientName ?? 'Customer', {
            challanNo: row.challanNo,
            grade: row.grade,
            quantity: row.quantity,
            siteName: row.siteName ?? null,
            status,
        });
    }
    catch (err) {
        console.warn(`[notify] Failed to send ${status} notification for challan ${challanId}:`, err);
    }
}
