import { desc } from 'drizzle-orm';
import { db, type DB } from '../db/index.js';
import { orders } from '../db/schema.js';

type Executor = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

// Generate the next sequential order number (ORD-001, ORD-002, …). Shared by the
// customer order endpoint and the recurring-order scheduler so both produce the
// same format from a single source of truth. Pass the active transaction (`tx`)
// when called inside one so the read participates in the same unit of work.
export async function nextOrderNo(executor: Executor = db): Promise<string> {
  const [last] = await executor.select({ orderNo: orders.orderNo }).from(orders)
    .orderBy(desc(orders.id)).limit(1);
  if (!last) return 'ORD-001';
  const n = parseInt(last.orderNo.split('-')[1] || '0', 10);
  return `ORD-${String(n + 1).padStart(3, '0')}`;
}
