import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { plants, clients, plantCustomers } from '../db/schema.js';
// Generate the next sequential plant code (PLT-001, PLT-002, …). Plant codes are
// the human-facing tenant identifier and the namespace customer codes hang off.
export async function nextPlantCode(executor = db) {
    const rows = await executor.select({ plantCode: plants.plantCode })
        .from(plants).where(sql `${plants.plantCode} IS NOT NULL`);
    let max = 0;
    for (const r of rows) {
        const n = parseInt((r.plantCode ?? '').split('-')[1] || '0', 10);
        if (Number.isFinite(n) && n > max)
            max = n;
    }
    return `PLT-${String(max + 1).padStart(3, '0')}`;
}
// Next per-plant customer code (e.g. PLT-001-C0001). The caller MUST hold a row
// lock on the plant (see resolvePlantCustomer) so two concurrent first-orders at
// the same plant can't mint the same code. Sequenced independently per plant, so
// two different plants safely reuse the same running number.
async function nextCustomerCode(tx, plantId, plantCode) {
    const [last] = await tx.select({ customerCode: clients.customerCode })
        .from(clients)
        .where(and(eq(clients.plantId, plantId), sql `${clients.customerCode} IS NOT NULL`))
        .orderBy(desc(clients.id)).limit(1);
    const prev = last?.customerCode ? parseInt(last.customerCode.split('-C')[1] || '0', 10) : 0;
    const n = Number.isFinite(prev) ? prev : 0;
    return `${plantCode}-C${String(n + 1).padStart(4, '0')}`;
}
// Resolve (or lazily create) the per-plant customer record for a global user at a
// given plant. Same user at two plants ⇒ two client rows ⇒ two customer codes;
// neither plant can see the other's row. Must run inside a transaction: it locks
// the plant row so customer-code minting is serialized per plant.
export async function resolvePlantCustomer(tx, plantId, userId, profile) {
    // Lock the plant row to serialize concurrent first-orders for this plant.
    const [plant] = await tx.select({ id: plants.id, plantCode: plants.plantCode })
        .from(plants).where(eq(plants.id, plantId)).for('update').limit(1);
    if (!plant)
        throw new Error('Plant not found');
    const [existing] = await tx.select({ clientId: plantCustomers.clientId, customerCode: clients.customerCode })
        .from(plantCustomers)
        .leftJoin(clients, eq(plantCustomers.clientId, clients.id))
        .where(and(eq(plantCustomers.plantId, plantId), eq(plantCustomers.userId, userId)))
        .limit(1);
    if (existing) {
        return { clientId: existing.clientId, customerCode: existing.customerCode ?? '' };
    }
    const plantCode = plant.plantCode ?? `PLT-${plantId}`;
    const customerCode = await nextCustomerCode(tx, plantId, plantCode);
    // The per-plant client's display name is the anonymous customer code, never the
    // customer's real/global company name — a plant only ever knows them by code.
    // Delivery-coordination fields (contact, phone) are copied so the plant can
    // fulfil the order; these live only in this plant's own row.
    const [client] = await tx.insert(clients).values({
        plantId,
        customerCode,
        name: customerCode,
        contactPerson: profile.contactPerson || profile.name,
        phone: profile.phone || '',
        email: profile.email ?? null,
        gstNo: profile.gstNo ?? null,
        address: profile.address ?? null,
        city: profile.city ?? null,
    }).returning({ id: clients.id });
    await tx.insert(plantCustomers).values({ plantId, userId, clientId: client.id });
    return { clientId: client.id, customerCode };
}
// Build the plant-scoping predicate for a plant-facing column (orders.plantId,
// challans.plantId, clients.plantId). A staff/owner request with a plantId set is
// hard-scoped to that plant; a null plantId (legacy global admin / marketplace
// authority) is unscoped and returns `undefined` (no extra filter). There is no
// query path that lets a plant-scoped user widen beyond their own plantId.
export function plantScope(actorPlantId, column) {
    if (actorPlantId == null)
        return undefined;
    return eq(column, actorPlantId);
}
// True when `clientId` is visible to the acting staff/owner under plant scoping.
// A plant-bound actor only sees clients in their own plant; a null-plant legacy
// global admin sees any existing client. Used to reject cross-tenant client
// binding on order/challan writes (a plant must never reference another plant's
// customer row).
export async function clientInScope(actorPlantId, clientId, executor = db) {
    const scope = plantScope(actorPlantId, clients.plantId);
    const where = scope ? and(eq(clients.id, clientId), scope) : eq(clients.id, clientId);
    const [row] = await executor.select({ id: clients.id }).from(clients).where(where).limit(1);
    return !!row;
}
export { isNull };
