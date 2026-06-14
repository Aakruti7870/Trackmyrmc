// Scoped retrieval layer for the AI Help Agent.
//
// This is the security heart of the feature. The AI model NEVER runs raw SQL and
// never receives a plant_id/role from the request body. It only ever sees data
// assembled here, where every retrieval function applies the existing
// `plantScope` (and customer/driver scoping) against the server-derived identity
// from `req.user`. A role can only call the functions its allow-list permits;
// anything else returns the standard refusal string and is never sent to the
// model. A plant-scoped user can never widen beyond their own plant.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, clients, orders, challans, ledgerEntries, plants, plantCustomers, vehicles, } from '../db/schema.js';
import { plantScope } from './tenancy.js';
import { isPlatformStaff } from './roleHierarchy.js';
export const REFUSAL = 'Sorry, you do not have permission to view this information.';
const PLANT_STAFF_ROLES = ['plant_owner', 'admin', 'supervisor', 'dispatcher', 'plant_operator', 'authority'];
// ---- helpers ---------------------------------------------------------------
// Every client row a customer owns: their legacy primary client plus one
// per-plant client for each plant they've ordered at. Mirrors me.ts so AI reads
// match what the customer sees in their own portal — and never another user's.
async function getUserClientIds(userId) {
    const ids = new Set();
    const [u] = await db.select({ linkedClientId: users.linkedClientId }).from(users).where(eq(users.id, userId));
    if (u?.linkedClientId != null)
        ids.add(u.linkedClientId);
    const pcs = await db.select({ clientId: plantCustomers.clientId })
        .from(plantCustomers).where(eq(plantCustomers.userId, userId));
    for (const pc of pcs)
        ids.add(pc.clientId);
    return [...ids];
}
function money(v) {
    return `₹${parseFloat(v ?? '0').toLocaleString('en-IN')}`;
}
// ---- retrieval registry ----------------------------------------------------
const RETRIEVALS = [
    // ----- customer -----
    {
        name: 'get_my_orders', topic: 'orders', roles: ['client'],
        run: async ({ user }) => {
            const clientIds = await getUserClientIds(user.id);
            if (clientIds.length === 0)
                return null;
            const rows = await db.select({
                orderNo: orders.orderNo, grade: orders.grade, quantity: orders.quantity,
                status: orders.status, deliveryDate: orders.deliveryDate, createdAt: orders.createdAt,
                plantName: plants.name,
            }).from(orders).leftJoin(plants, eq(orders.plantId, plants.id))
                .where(inArray(orders.clientId, clientIds))
                .orderBy(desc(orders.createdAt)).limit(8);
            if (rows.length === 0)
                return null;
            return 'Your recent orders:\n' + rows.map(r => `- ${r.orderNo}: ${r.grade}, ${r.quantity} m³, status ${r.status}` +
                `${r.plantName ? `, plant ${r.plantName}` : ''}${r.deliveryDate ? `, delivery ${r.deliveryDate}` : ''}`).join('\n');
        },
    },
    {
        name: 'get_my_deliveries', topic: 'deliveries', roles: ['client'],
        run: async ({ user }) => {
            const clientIds = await getUserClientIds(user.id);
            if (clientIds.length === 0)
                return null;
            const rows = await db.select({
                challanNo: challans.challanNo, grade: challans.grade, quantity: challans.quantity,
                status: challans.status, dispatchTime: challans.dispatchTime, deliveryTime: challans.deliveryTime,
                plantName: plants.name,
            }).from(challans).leftJoin(plants, eq(challans.plantId, plants.id))
                .where(inArray(challans.clientId, clientIds))
                .orderBy(desc(challans.createdAt)).limit(8);
            if (rows.length === 0)
                return null;
            return 'Your recent deliveries (challans):\n' + rows.map(r => `- ${r.challanNo}: ${r.grade}, ${r.quantity} m³, status ${r.status}` +
                `${r.dispatchTime ? `, dispatched ${new Date(r.dispatchTime).toLocaleString('en-IN')}` : ''}` +
                `${r.deliveryTime ? `, delivered ${new Date(r.deliveryTime).toLocaleString('en-IN')}` : ''}`).join('\n');
        },
    },
    {
        name: 'get_my_ledger', topic: 'ledger', roles: ['client'],
        run: async ({ user }) => {
            const clientId = user.linkedClientId;
            if (clientId == null)
                return null;
            const [c] = await db.select({
                outstandingAmount: clients.outstandingAmount, creditLimit: clients.creditLimit,
            }).from(clients).where(eq(clients.id, clientId));
            if (!c)
                return null;
            const recent = await db.select({
                type: ledgerEntries.type, amount: ledgerEntries.amount,
                description: ledgerEntries.description, createdAt: ledgerEntries.createdAt,
            }).from(ledgerEntries).where(eq(ledgerEntries.clientId, clientId))
                .orderBy(desc(ledgerEntries.createdAt)).limit(5);
            let out = `Your account balance: outstanding ${money(c.outstandingAmount)}, credit limit ${money(c.creditLimit)}.`;
            if (recent.length) {
                out += '\nRecent ledger entries:\n' + recent.map(e => `- ${e.type} ${money(e.amount)} — ${e.description}`).join('\n');
            }
            return out;
        },
    },
    // ----- driver -----
    {
        name: 'get_my_trips', topic: 'trips', roles: ['driver'],
        run: async ({ user }) => {
            const driverId = user.linkedDriverId;
            if (driverId == null)
                return null;
            const rows = await db.select({
                challanNo: challans.challanNo, grade: challans.grade, quantity: challans.quantity,
                status: challans.status, dispatchTime: challans.dispatchTime,
            }).from(challans).where(eq(challans.driverId, driverId))
                .orderBy(desc(challans.createdAt)).limit(10);
            if (rows.length === 0)
                return null;
            return 'Your recent trips:\n' + rows.map(r => `- ${r.challanNo}: ${r.grade}, ${r.quantity} m³, status ${r.status}` +
                `${r.dispatchTime ? `, dispatched ${new Date(r.dispatchTime).toLocaleString('en-IN')}` : ''}`).join('\n');
        },
    },
    // ----- staff / platform (plant-scoped) -----
    {
        name: 'get_plant_orders', topic: 'orders', roles: PLANT_STAFF_ROLES,
        run: async ({ scopePlantId }) => {
            const scope = plantScope(scopePlantId, orders.plantId);
            if (!scope)
                return null; // platform staff with no plant selected → no private data
            const rows = await db.select({
                orderNo: orders.orderNo, grade: orders.grade, quantity: orders.quantity,
                status: orders.status, createdAt: orders.createdAt, customerCode: clients.customerCode,
            }).from(orders).leftJoin(clients, eq(orders.clientId, clients.id))
                .where(scope).orderBy(desc(orders.createdAt)).limit(10);
            if (rows.length === 0)
                return null;
            return "Your plant's recent orders:\n" + rows.map(r => `- ${r.orderNo}: ${r.grade}, ${r.quantity} m³, status ${r.status}` +
                `${r.customerCode ? `, customer ${r.customerCode}` : ''}`).join('\n');
        },
    },
    {
        name: 'get_plant_dispatch', topic: 'deliveries', roles: PLANT_STAFF_ROLES,
        run: async ({ scopePlantId }) => {
            const scope = plantScope(scopePlantId, challans.plantId);
            if (!scope)
                return null;
            const rows = await db.select({
                challanNo: challans.challanNo, grade: challans.grade, quantity: challans.quantity,
                status: challans.status, dispatchTime: challans.dispatchTime,
            }).from(challans).where(scope).orderBy(desc(challans.createdAt)).limit(10);
            if (rows.length === 0)
                return null;
            return "Your plant's recent dispatch (challans):\n" + rows.map(r => `- ${r.challanNo}: ${r.grade}, ${r.quantity} m³, status ${r.status}` +
                `${r.dispatchTime ? `, dispatched ${new Date(r.dispatchTime).toLocaleString('en-IN')}` : ''}`).join('\n');
        },
    },
    {
        name: 'get_plant_production', topic: 'production', roles: PLANT_STAFF_ROLES,
        // Production is derived from this plant's own challans (dispatched volume by
        // grade). batch_records carry no plant/client linkage in this schema, so
        // exposing them would leak across plants — we deliberately do not read them.
        run: async ({ scopePlantId }) => {
            const scope = plantScope(scopePlantId, challans.plantId);
            if (!scope)
                return null;
            const rows = await db.select({
                grade: challans.grade,
                total: sql `COALESCE(SUM(${challans.quantity}), 0)`,
                loads: sql `COUNT(*)`,
            }).from(challans).where(scope).groupBy(challans.grade);
            if (rows.length === 0)
                return null;
            return "Your plant's production/dispatch by grade:\n" + rows.map(r => `- ${r.grade}: ${parseFloat(r.total).toLocaleString('en-IN')} m³ across ${r.loads} load(s)`).join('\n');
        },
    },
    {
        name: 'get_plant_clients', topic: 'clients', roles: PLANT_STAFF_ROLES,
        run: async ({ scopePlantId }) => {
            const scope = plantScope(scopePlantId, clients.plantId);
            if (!scope)
                return null;
            const rows = await db.select({
                customerCode: clients.customerCode, contactPerson: clients.contactPerson,
                outstandingAmount: clients.outstandingAmount,
            }).from(clients).where(scope).orderBy(desc(clients.id)).limit(15);
            if (rows.length === 0)
                return null;
            return "Your plant's customers:\n" + rows.map(r => `- ${r.customerCode ?? '(no code)'}: contact ${r.contactPerson}, outstanding ${money(r.outstandingAmount)}`).join('\n');
        },
    },
    {
        name: 'get_plant_ledger_summary', topic: 'ledger', roles: PLANT_STAFF_ROLES,
        run: async ({ scopePlantId }) => {
            const scope = plantScope(scopePlantId, clients.plantId);
            if (!scope)
                return null;
            const [agg] = await db.select({
                totalOutstanding: sql `COALESCE(SUM(${clients.outstandingAmount}), 0)`,
                customers: sql `COUNT(*)`,
            }).from(clients).where(scope);
            if (!agg)
                return null;
            return `Your plant's receivables: total outstanding ${money(agg.totalOutstanding)} across ${agg.customers} customer(s).`;
        },
    },
    {
        name: 'get_plant_fleet', topic: 'fleet', roles: PLANT_STAFF_ROLES,
        // Vehicles are a shared global pool in this app (not plant-partitioned), so
        // staff see the shared fleet and its status — consistent with the app design.
        run: async () => {
            const rows = await db.select({
                vehicleNo: vehicles.vehicleNo, type: vehicles.type, status: vehicles.status,
            }).from(vehicles).orderBy(desc(vehicles.id)).limit(20);
            if (rows.length === 0)
                return null;
            const counts = rows.reduce((m, v) => { m[v.status] = (m[v.status] ?? 0) + 1; return m; }, {});
            const summary = Object.entries(counts).map(([s, n]) => `${n} ${s}`).join(', ');
            return `Fleet (shared transit-mixer pool) — ${summary}:\n` + rows.map(v => `- ${v.vehicleNo} (${v.type}): ${v.status}`).join('\n');
        },
    },
    // ----- everyone: public plant info -----
    {
        name: 'get_public_plant_info', topic: 'plant_info',
        roles: ['client', 'driver', ...PLANT_STAFF_ROLES],
        run: async ({ scopePlantId }) => {
            if (scopePlantId != null) {
                const [p] = await db.select({
                    name: plants.name, city: plants.city, grades: plants.grades,
                    openTime: plants.openTime, closeTime: plants.closeTime, contactNumber: plants.contactNumber,
                }).from(plants).where(eq(plants.id, scopePlantId));
                if (p) {
                    return `Plant info — ${p.name}${p.city ? `, ${p.city}` : ''}. ` +
                        `Grades: ${(p.grades ?? []).join(', ') || 'n/a'}. ` +
                        `Hours: ${p.openTime ?? '—'}–${p.closeTime ?? '—'}. ` +
                        `Contact: ${p.contactNumber ?? 'n/a'}.`;
                }
            }
            // General/public marketplace info (no specific plant in scope).
            const [agg] = await db.select({ approved: sql `COUNT(*)` })
                .from(plants).where(and(eq(plants.plantStatus, 'approved'), eq(plants.verified, true)));
            return `TrackMyRMC is a ready-mix concrete marketplace with ${agg?.approved ?? 0} verified plant(s). ` +
                `Use "Find Plants" to discover approved plants near a delivery site and place an order.`;
        },
    },
];
// ---- intent detection ------------------------------------------------------
const TOPIC_KEYWORDS = {
    orders: /\border|orders|booking|ordered\b/i,
    deliveries: /\b(deliver|delivery|deliveries|challan|dispatch|where is|track|eta|arriv)/i,
    trips: /\b(trip|trips|my route|my delivery|assigned)/i,
    ledger: /\b(balance|outstanding|payment|ledger|invoice|due|bill|credit)/i,
    clients: /\b(client|clients|customer list|customers|all customers)/i,
    fleet: /\b(fleet|vehicle|vehicles|truck|trucks|mixer|transit)/i,
    production: /\b(production|produce|produced|batch|batches|manufactur)/i,
    plant_info: /\b(plant|plants|grade|grades|hours|timing|contact|location|near)/i,
    reports: /\b(report|reports|analytics|revenue|everyone|all plants|other plant|across plants|company-wide|companywide)/i,
};
function detectTopics(message) {
    const found = [];
    for (const [topic, re] of Object.entries(TOPIC_KEYWORDS)) {
        if (re.test(message))
            found.push(topic);
    }
    return found;
}
// Default topics to gather when the message matches no specific keyword, so the
// agent still has relevant grounding for an open-ended question.
function defaultTopics(role) {
    if (role === 'client')
        return ['orders', 'deliveries', 'ledger'];
    if (role === 'driver')
        return ['trips'];
    return ['orders', 'deliveries'];
}
function allowedRetrievalsForTopic(role, topic) {
    return RETRIEVALS.filter(r => r.topic === topic && r.roles.includes(role));
}
// Topics that exist in the registry but for which THIS role has no function.
function topicExistsForAnyRole(topic) {
    return RETRIEVALS.some(r => r.topic === topic);
}
// Validate a platform-staff plant selection and compute the effective scope.
// Plant-bound staff ignore any selectedPlantId — they are always hard-scoped to
// their own plant and can never widen. Platform staff (authority / global admin
// with plantId null) must pass a real plant id to see private data.
export async function resolveScopePlantId(user, selectedPlantId) {
    if (!isPlatformStaff(user)) {
        return user.plantId ?? null;
    }
    if (selectedPlantId == null || selectedPlantId === '')
        return null;
    const id = Number(selectedPlantId);
    if (!Number.isInteger(id) || id <= 0)
        return null;
    const [p] = await db.select({ id: plants.id }).from(plants).where(eq(plants.id, id));
    return p ? id : null;
}
export async function buildAiContext(user, message, scopePlantId) {
    const role = user.role;
    const detected = detectTopics(message);
    const topics = detected.length > 0 ? detected : defaultTopics(role);
    // Refusal gate: if the user explicitly asked about a topic that exists in the
    // registry but their role has NO function for, refuse outright. This is the
    // "disallowed call returns the refusal string and is never sent to the model"
    // rule (e.g. a customer asking for internal reports or the full client list).
    if (detected.length > 0) {
        for (const topic of detected) {
            if (topicExistsForAnyRole(topic) && allowedRetrievalsForTopic(role, topic).length === 0) {
                return { refused: true, context: '', functionsUsed: [] };
            }
        }
    }
    const ctx = { user, scopePlantId };
    const blocks = [];
    const functionsUsed = [];
    const ran = new Set();
    for (const topic of topics) {
        for (const fn of allowedRetrievalsForTopic(role, topic)) {
            if (ran.has(fn.name))
                continue;
            ran.add(fn.name);
            functionsUsed.push(fn.name);
            try {
                const block = await fn.run(ctx);
                if (block)
                    blocks.push(block);
            }
            catch (err) {
                console.error(`[ai] retrieval ${fn.name} failed`, err);
            }
        }
    }
    // Platform staff with no plant selected get a clear note so the model asks the
    // user to choose a plant rather than implying it has no data.
    if (isPlatformStaff(user) && scopePlantId == null) {
        blocks.push('Note: no specific plant is selected, so only general/public information is available. Ask the user to choose a plant to see private plant data.');
    }
    return {
        refused: false,
        context: blocks.length ? blocks.join('\n\n') : '(no matching data available for your account)',
        functionsUsed,
    };
}
