import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

export interface WhatsAppMessageAttempt {
  messageSid: string | null;
  event: string;
  orderId?: number | null;
  challanId?: number | null;
  plantId?: number | null;
  toPhone: string;
  status: string;
  errorCode?: string | null;
  channel: string;
}

/** Atomically skips logging when an asynchronously referenced parent was deleted. */
export async function recordWhatsAppAttempt(input: WhatsAppMessageAttempt): Promise<void> {
  const orderId = input.orderId ?? null;
  const challanId = input.challanId ?? null;
  const plantId = input.plantId ?? null;
  await db.execute(sql`
    WITH order_parent AS MATERIALIZED (
      SELECT id FROM orders WHERE id = ${orderId}::integer FOR KEY SHARE
    ), challan_parent AS MATERIALIZED (
      SELECT id FROM challans WHERE id = ${challanId}::integer FOR KEY SHARE
    ), plant_parent AS MATERIALIZED (
      SELECT id FROM plants WHERE id = ${plantId}::integer FOR KEY SHARE
    )
    INSERT INTO whatsapp_messages
      (message_sid, event, order_id, challan_id, plant_id, to_phone, status, error_code, channel)
    SELECT ${input.messageSid}, ${input.event}, ${orderId}::integer,
           ${challanId}::integer, ${plantId}::integer, ${input.toPhone},
           ${input.status}, ${input.errorCode ?? null}, ${input.channel}
    WHERE (${orderId}::integer IS NULL OR EXISTS (SELECT 1 FROM order_parent))
      AND (${challanId}::integer IS NULL OR EXISTS (SELECT 1 FROM challan_parent))
      AND (${plantId}::integer IS NULL OR EXISTS (SELECT 1 FROM plant_parent))
    ON CONFLICT (message_sid) DO NOTHING
  `);
}
