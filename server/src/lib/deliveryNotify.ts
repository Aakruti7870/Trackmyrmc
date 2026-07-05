import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { batchRecords, challans, clients, sites, orders, plants, users, whatsappMessages } from '../db/schema.js';
import { normalizePhone } from './otp.js';
import { isRealEmail } from './customerAccount.js';
import { sendDeliveryNotificationEmail, sendWhatsAppFailureAlertEmail, sendOrderPlacedEmail, sendBatchLoggedEmail } from './email.js';
import { sendPushToClientUsers, sendPushToStaff } from './push.js';
import { emitSSEEvent } from './sseEmitter.js';
import {
  getWhatsAppConfig,
  eventEnabled,
  type WhatsAppEvent,
  type WhatsAppSendResult,
} from './whatsapp.js';
import { sendWhatsAppWithRetry } from './whatsappRetry.js';

// Staff roles alerted when a customer's WhatsApp update fails to deliver. Mirrors
// the delivery-status panel's readers, including `authority` (the super-admin,
// which sits outside the SSE STAFF_ROLES set) so the role allow-list reaches it.
const WHATSAPP_FAILURE_ALERT_ROLES = ['admin', 'dispatcher', 'authority', 'plant_operator'] as const;

// Best-effort customer notifications for order/challan lifecycle events. Each
// function loads what it needs, sends an email (where applicable) and/or a
// WhatsApp template message, and NEVER throws: these are non-critical side
// effects, so any failure (missing contact, SMTP/WhatsApp down) is swallowed and
// logged so the originating request can never fail because of it.

// Persist one WhatsApp notification attempt so staff can later see whether it was
// actually queued/sent/delivered/read or silently failed. The send-time status
// is recorded here; Twilio's status-callback webhook advances it in place by
// matching messageSid. Best-effort: a logging failure must never break notify.
async function recordWhatsAppMessage(
  event: WhatsAppEvent,
  link: { orderId?: number | null; challanId?: number | null; plantId?: number | null },
  toPhone: string | null,
  result: WhatsAppSendResult,
): Promise<void> {
  try {
    // Map the send result to a stored status: a real send carries Twilio's
    // initial state, the dev fallback is 'dev', and a rejected send is 'error'.
    const status = result.ok ? (result.status ?? (result.channel === 'dev' ? 'dev' : 'queued')) : 'error';
    await db.insert(whatsappMessages).values({
      messageSid: result.sid ?? null,
      event,
      orderId: link.orderId ?? null,
      challanId: link.challanId ?? null,
      plantId: link.plantId ?? null,
      toPhone: normalizePhone(toPhone) ?? (toPhone ?? ''),
      status,
      errorCode: result.error ? result.error.slice(0, 200) : null,
      channel: result.channel,
    });
  } catch (err) {
    console.warn('[notify] Failed to record WhatsApp message status:', err);
  }
}

// Send the WhatsApp update for a challan status change. Gated by the global +
// per-event toggle and the presence of an approved template. Best-effort.
async function notifyChallanWhatsApp(
  status: 'dispatched' | 'delivered',
  row: { challanId: number; plantId: number | null; challanNo: string; grade: string; quantity: string; clientName: string | null; phone: string | null; siteName: string | null },
): Promise<void> {
  try {
    if (!row.phone) return;
    const cfg = await getWhatsAppConfig();
    const event = status === 'dispatched' ? 'dispatch' : 'delivery';
    if (!eventEnabled(cfg, event)) return;
    const templateSid = event === 'dispatch' ? cfg.dispatchTemplateSid : cfg.deliveryTemplateSid;
    // Variables map to the template's numbered placeholders in this order:
    //   {{1}} customer  {{2}} challan no  {{3}} grade  {{4}} quantity  {{5}} site
    const result = await sendWhatsAppWithRetry(row.phone, templateSid, {
      '1': row.clientName ?? 'Customer',
      '2': row.challanNo,
      '3': row.grade,
      '4': row.quantity,
      '5': row.siteName ?? '—',
    }, event);
    await recordWhatsAppMessage(event, { challanId: row.challanId, plantId: row.plantId }, row.phone, result);
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
        plantId: challans.plantId,
        clientId: challans.clientId,
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

    if (isRealEmail(row.email)) {
      await sendDeliveryNotificationEmail(row.email, row.clientName ?? 'Customer', {
        challanNo: row.challanNo,
        grade: row.grade,
        quantity: row.quantity,
        siteName: row.siteName ?? null,
        status,
      });
    }

    // Web push to the customer's linked accounts — pops up even when the app is
    // closed. Best-effort: a missing VAPID key or dead endpoint never throws.
    try {
      await sendPushToClientUsers(row.clientId, {
        title: status === 'dispatched'
          ? 'Your concrete is on the way'
          : 'Your concrete has been delivered',
        body: status === 'dispatched'
          ? `Challan ${row.challanNo} — ${row.quantity} m³ ${row.grade} has been dispatched${row.siteName ? ` to ${row.siteName}` : ''}.`
          : `Challan ${row.challanNo} — ${row.quantity} m³ ${row.grade} has been delivered.`,
        url: '/my-orders',
        tag: `challan-${challanId}`,
      });
    } catch (err) {
      console.warn(`[notify] challan ${status} push failed:`, err);
    }

    await notifyChallanWhatsApp(status, { challanId, ...row });
  } catch (err) {
    console.warn(`[notify] Failed to send ${status} notification for challan ${challanId}:`, err);
  }
}

// A customer placed a new order — confirm it across every channel: email and
// web push (always, when contactable) plus a gated WhatsApp template. Loads the
// order details, the customer's email/phone and the issuing plant's name.
export async function notifyOrderPlaced(orderId: number): Promise<void> {
  try {
    const [row] = await db
      .select({
        plantId: orders.plantId,
        clientId: orders.clientId,
        orderNo: orders.orderNo,
        grade: orders.grade,
        quantity: orders.quantity,
        deliveryDate: orders.deliveryDate,
        clientName: clients.name,
        email: clients.email,
        phone: clients.phone,
        plantName: plants.name,
      })
      .from(orders)
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .leftJoin(plants, eq(orders.plantId, plants.id))
      .where(eq(orders.id, orderId));

    if (!row) return;

    // Email confirmation (when the customer has an email on file). Independent of
    // the WhatsApp toggle — email is always sent if we can.
    if (isRealEmail(row.email)) {
      try {
        await sendOrderPlacedEmail(row.email, row.clientName ?? 'Customer', {
          orderNo: row.orderNo,
          grade: row.grade,
          quantity: row.quantity,
          deliveryDate: row.deliveryDate ?? null,
          plantName: row.plantName ?? null,
        });
      } catch (err) {
        console.warn(`[notify] order-placed email failed for order ${orderId}:`, err);
      }
    }

    // Web push to the customer's linked accounts — pops up even when closed.
    try {
      await sendPushToClientUsers(row.clientId, {
        title: 'Order received',
        body: `Order ${row.orderNo} — ${row.quantity} m³ ${row.grade} has been received by ${row.plantName ?? 'the plant'}.`,
        url: '/my-orders',
        tag: `order-${orderId}`,
      });
    } catch (err) {
      console.warn(`[notify] order-placed push failed for order ${orderId}:`, err);
    }

    // WhatsApp confirmation — gated by the per-event toggle, an approved template
    // and a phone number on file. Variables map to the template's numbered
    // placeholders: {{1}} customer {{2}} order no {{3}} grade {{4}} quantity
    // {{5}} delivery date {{6}} plant.
    const cfg = await getWhatsAppConfig();
    if (eventEnabled(cfg, 'order') && row.phone) {
      const result = await sendWhatsAppWithRetry(row.phone, cfg.orderTemplateSid, {
        '1': row.clientName ?? 'Customer',
        '2': row.orderNo,
        '3': row.grade,
        '4': row.quantity,
        '5': row.deliveryDate ?? 'to be scheduled',
        '6': row.plantName ?? 'the plant',
      }, 'order');
      await recordWhatsAppMessage('order', { orderId, plantId: row.plantId }, row.phone, result);
    }
  } catch (err) {
    console.warn(`[notify] Failed to send order-placed notification for order ${orderId}:`, err);
  }
}

// Plant staff alerted when an order needs approval (mirrors the batch roles).
const ORDER_APPROVAL_ROLES = ['admin', 'plant_owner', 'supervisor', 'dispatcher'] as const;

// A customer placed (or resubmitted) an order that now awaits staff approval.
// Alert the issuing plant's staff by real-time SSE toast and web push so it lands
// in their Pending Orders queue immediately. Best-effort: never throws back.
export async function notifyOrderPendingApproval(orderId: number): Promise<void> {
  try {
    const [row] = await db
      .select({
        plantId: orders.plantId,
        orderNo: orders.orderNo,
        grade: orders.grade,
        quantity: orders.quantity,
        deliveryDate: orders.deliveryDate,
        clientName: clients.name,
      })
      .from(orders)
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .where(eq(orders.id, orderId));
    if (!row) return;

    // Real-time toast for plant staff so the pending order surfaces without a
    // refresh. Scoped to the approval roles (never customers/drivers).
    emitSSEEvent(
      'order.pending_approval',
      { orderId, orderNo: row.orderNo, grade: row.grade, quantity: row.quantity, clientName: row.clientName },
      { roles: [...ORDER_APPROVAL_ROLES], plantId: row.plantId },
    );

    if (row.plantId != null) {
      try {
        await sendPushToStaff(row.plantId, ORDER_APPROVAL_ROLES, {
          title: 'Order awaiting approval',
          body: `Order ${row.orderNo} — ${row.quantity} m³ ${row.grade}${row.clientName ? ` from ${row.clientName}` : ''} needs approval.`,
          url: '/dispatch',
          tag: `order-approval-${orderId}`,
        });
      } catch (err) {
        console.warn(`[notify] order-pending-approval push failed for order ${orderId}:`, err);
      }
    }
  } catch (err) {
    console.warn(`[notify] Failed to send pending-approval notification for order ${orderId}:`, err);
  }
}

// Staff approved (decision='approved') or rejected (decision='rejected') an
// order — tell the customer by web push (and SSE, already emitted by the route).
// Best-effort: never throws back into the originating request.
export async function notifyOrderDecision(orderId: number, decision: 'approved' | 'rejected'): Promise<void> {
  try {
    const [row] = await db
      .select({
        clientId: orders.clientId,
        orderNo: orders.orderNo,
        grade: orders.grade,
        quantity: orders.quantity,
        rejectionReason: orders.rejectionReason,
        plantName: plants.name,
      })
      .from(orders)
      .leftJoin(plants, eq(orders.plantId, plants.id))
      .where(eq(orders.id, orderId));
    if (!row) return;

    try {
      await sendPushToClientUsers(row.clientId, {
        title: decision === 'approved' ? 'Order approved' : 'Order needs changes',
        body: decision === 'approved'
          ? `Order ${row.orderNo} — ${row.quantity} m³ ${row.grade} has been approved by ${row.plantName ?? 'the plant'}.`
          : `Order ${row.orderNo} was not approved${row.rejectionReason ? `: ${row.rejectionReason}` : '. Please review and resubmit.'}`,
        url: '/my-orders',
        tag: `order-decision-${orderId}`,
      });
    } catch (err) {
      console.warn(`[notify] order-${decision} push failed for order ${orderId}:`, err);
    }
  } catch (err) {
    console.warn(`[notify] Failed to send ${decision} notification for order ${orderId}:`, err);
  }
}

// Plant staff alerted when a production batch is logged.
const BATCH_NOTIFY_ROLES = ['admin', 'plant_owner', 'supervisor', 'dispatcher'] as const;

// A production batch was logged — alert the plant's staff (NOT customers) by web
// push and email so production is visible in real time. Scoped to the batch's
// own plant; legacy null-plant batches have no plant audience and are skipped.
// Best-effort: never throws back into the originating request.
export async function notifyBatchLogged(batchId: number): Promise<void> {
  try {
    const [row] = await db
      .select({
        plantId: batchRecords.plantId,
        batchNo: batchRecords.batchNo,
        grade: batchRecords.grade,
        quantity: batchRecords.quantity,
        operator: batchRecords.operator,
        plantName: plants.name,
      })
      .from(batchRecords)
      .leftJoin(plants, eq(batchRecords.plantId, plants.id))
      .where(eq(batchRecords.id, batchId));

    if (!row || row.plantId == null) return;

    // Web push to plant staff — pops up even when the app is closed.
    try {
      await sendPushToStaff(row.plantId, BATCH_NOTIFY_ROLES, {
        title: 'New batch logged',
        body: `Batch ${row.batchNo} — ${row.quantity} m³ ${row.grade}${row.operator ? ` by ${row.operator}` : ''}.`,
        url: '/batch-report',
        tag: `batch-${batchId}`,
      });
    } catch (err) {
      console.warn(`[notify] batch-logged push failed for batch ${batchId}:`, err);
    }

    // Email to active plant staff in the notify roles (excluding phone-only
    // @otp.local placeholder mailboxes).
    try {
      const staff = await db
        .select({ email: users.email })
        .from(users)
        .where(
          and(
            isNull(users.deletedAt),
            eq(users.isActive, true),
            eq(users.plantId, row.plantId),
            inArray(users.role, [...BATCH_NOTIFY_ROLES]),
          ),
        );
      const emails = new Set<string>();
      for (const s of staff) if (s.email && !s.email.endsWith('@otp.local')) emails.add(s.email);
      if (emails.size > 0) {
        await sendBatchLoggedEmail([...emails], {
          batchNo: row.batchNo,
          grade: row.grade,
          quantity: row.quantity,
          operator: row.operator,
          plantName: row.plantName,
        });
      }
    } catch (err) {
      console.warn(`[notify] batch-logged email failed for batch ${batchId}:`, err);
    }
  } catch (err) {
    console.warn(`[notify] Failed to send batch-logged notification for batch ${batchId}:`, err);
  }
}

// A WhatsApp customer update (order/dispatch/delivery) was reported by Twilio's
// status callback as failed/undelivered — the customer never received it. Alert
// staff proactively so they can phone the customer instead. Sends a real-time
// SSE toast (scoped to the staff roles) plus a best-effort email to active staff.
// Identified by Twilio's MessageSid, which the webhook has already matched to the
// stored notification row. Best-effort: never throws back into the webhook.
export async function notifyStaffOfWhatsAppFailure(messageSid: string): Promise<void> {
  try {
    const [row] = await db
      .select({
        event: whatsappMessages.event,
        status: whatsappMessages.status,
        errorCode: whatsappMessages.errorCode,
        toPhone: whatsappMessages.toPhone,
        orderId: whatsappMessages.orderId,
        challanId: whatsappMessages.challanId,
        plantId: whatsappMessages.plantId,
        orderNo: orders.orderNo,
        challanNo: challans.challanNo,
      })
      .from(whatsappMessages)
      .leftJoin(orders, eq(whatsappMessages.orderId, orders.id))
      .leftJoin(challans, eq(whatsappMessages.challanId, challans.id))
      .where(eq(whatsappMessages.messageSid, messageSid));

    if (!row) return;

    // Real-time in-app toast for staff. Scoped to the alert roles via an explicit
    // allow-list so it reaches `authority` (outside the SSE STAFF_ROLES set) and
    // is never delivered to customers/drivers. The payload names the order/challan,
    // the customer phone and the Twilio error code so staff can act immediately.
    emitSSEEvent(
      'whatsapp.failed',
      {
        event: row.event,
        status: row.status,
        errorCode: row.errorCode,
        toPhone: row.toPhone,
        orderId: row.orderId,
        challanId: row.challanId,
        orderNo: row.orderNo,
        challanNo: row.challanNo,
      },
      { roles: [...WHATSAPP_FAILURE_ALERT_ROLES] },
    );

    // Best-effort email to every active staff mailbox in the alert roles. Folded
    // into a single message; skipped silently when no mailboxes resolve or SMTP
    // is unconfigured. A normalized event keeps the email helper's union type tight.
    try {
      const event: 'order' | 'dispatch' | 'delivery' =
        row.event === 'dispatch' || row.event === 'delivery' ? row.event : 'order';
      const staff = await db
        .select({ email: users.email })
        .from(users)
        .where(
          and(
            isNull(users.deletedAt),
            eq(users.isActive, true),
            inArray(users.role, [...WHATSAPP_FAILURE_ALERT_ROLES]),
          ),
        );
      const emails = new Set<string>();
      for (const s of staff) if (s.email) emails.add(s.email);
      if (emails.size > 0) {
        await sendWhatsAppFailureAlertEmail([...emails], {
          event,
          toPhone: row.toPhone,
          status: row.status,
          errorCode: row.errorCode,
          orderNo: row.orderNo,
          challanNo: row.challanNo,
        });
      }
    } catch (err) {
      console.warn('[notify] Failed to email staff about a WhatsApp delivery failure:', err);
    }
  } catch (err) {
    console.warn(`[notify] Failed to alert staff of WhatsApp failure ${messageSid}:`, err);
  }
}
