import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { challans, clients, sites, orders, plants } from '../db/schema.js';
import { sendDeliveryNotificationEmail } from './email.js';
import { getWhatsAppConfig, eventEnabled, sendWhatsAppTemplate } from './whatsapp.js';

// Best-effort customer notifications for order/challan lifecycle events. Each
// function loads what it needs, sends an email (where applicable) and/or a
// WhatsApp template message, and NEVER throws: these are non-critical side
// effects, so any failure (missing contact, SMTP/WhatsApp down) is swallowed and
// logged so the originating request can never fail because of it.

// Send the WhatsApp update for a challan status change. Gated by the global +
// per-event toggle and the presence of an approved template. Best-effort.
async function notifyChallanWhatsApp(
  status: 'dispatched' | 'delivered',
  row: { challanNo: string; grade: string; quantity: string; clientName: string | null; phone: string | null; siteName: string | null },
): Promise<void> {
  try {
    if (!row.phone) return;
    const cfg = await getWhatsAppConfig();
    const event = status === 'dispatched' ? 'dispatch' : 'delivery';
    if (!eventEnabled(cfg, event)) return;
    const templateSid = event === 'dispatch' ? cfg.dispatchTemplateSid : cfg.deliveryTemplateSid;
    // Variables map to the template's numbered placeholders in this order:
    //   {{1}} customer  {{2}} challan no  {{3}} grade  {{4}} quantity  {{5}} site
    await sendWhatsAppTemplate(row.phone, templateSid, {
      '1': row.clientName ?? 'Customer',
      '2': row.challanNo,
      '3': row.grade,
      '4': row.quantity,
      '5': row.siteName ?? '—',
    });
  } catch (err) {
    console.warn(`[notify] WhatsApp ${status} notification failed:`, err);
  }
}

// A challan moved to dispatched/delivered — notify the customer by email and
// WhatsApp. Loads the customer's contact details + delivery-site name.
export async function notifyChallanStatus(
  challanId: number,
  status: 'dispatched' | 'delivered',
): Promise<void> {
  try {
    const [row] = await db
      .select({
        challanNo: challans.challanNo,
        grade: challans.grade,
        quantity: challans.quantity,
        clientName: clients.name,
        email: clients.email,
        phone: clients.phone,
        siteName: sites.name,
      })
      .from(challans)
      .leftJoin(clients, eq(challans.clientId, clients.id))
      .leftJoin(sites, eq(challans.siteId, sites.id))
      .where(eq(challans.id, challanId));

    if (!row) return;

    if (row.email) {
      await sendDeliveryNotificationEmail(row.email, row.clientName ?? 'Customer', {
        challanNo: row.challanNo,
        grade: row.grade,
        quantity: row.quantity,
        siteName: row.siteName ?? null,
        status,
      });
    }

    await notifyChallanWhatsApp(status, row);
  } catch (err) {
    console.warn(`[notify] Failed to send ${status} notification for challan ${challanId}:`, err);
  }
}

// A customer placed a new order — send them a WhatsApp confirmation. There is no
// email counterpart today; order confirmation is WhatsApp-only by design. Loads
// the order details plus the customer's phone and the issuing plant's name.
export async function notifyOrderPlaced(orderId: number): Promise<void> {
  try {
    const cfg = await getWhatsAppConfig();
    if (!eventEnabled(cfg, 'order')) return;

    const [row] = await db
      .select({
        orderNo: orders.orderNo,
        grade: orders.grade,
        quantity: orders.quantity,
        deliveryDate: orders.deliveryDate,
        clientName: clients.name,
        phone: clients.phone,
        plantName: plants.name,
      })
      .from(orders)
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .leftJoin(plants, eq(orders.plantId, plants.id))
      .where(eq(orders.id, orderId));

    if (!row || !row.phone) return;

    // Variables map to the template's numbered placeholders in this order:
    //   {{1}} customer  {{2}} order no  {{3}} grade  {{4}} quantity
    //   {{5}} delivery date  {{6}} plant
    await sendWhatsAppTemplate(row.phone, cfg.orderTemplateSid, {
      '1': row.clientName ?? 'Customer',
      '2': row.orderNo,
      '3': row.grade,
      '4': row.quantity,
      '5': row.deliveryDate ?? 'to be scheduled',
      '6': row.plantName ?? 'the plant',
    });
  } catch (err) {
    console.warn(`[notify] Failed to send order-placed notification for order ${orderId}:`, err);
  }
}
