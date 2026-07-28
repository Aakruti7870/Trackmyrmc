import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, sql } from 'drizzle-orm';
import pg from 'pg';
import * as schema from './schema.js';
import { PLANT_DIRECTORY } from './plantDirectory.js';
import { hashPassword } from '../lib/password.js';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
// Idempotent insert: for each value, look it up by its natural key first and
// only insert when missing, returning the (existing or newly inserted) rows in
// input order. This makes the whole seed safe to re-run against a populated DB —
// existing demo data is reused (so downstream references like homePlant stay
// valid) and any genuinely new rows are added. It replaces the old
// `.returning().onConflictDoNothing()` pattern, which yielded an EMPTY array on
// a populated DB (every row conflicts) and corrupted every reference built from
// it (e.g. `homePlant = plantRows[0]` became undefined).
async function ensureSeeded(table, values, match) {
    const rows = [];
    for (const value of values) {
        const existing = await db.select().from(table).where(match(value)).limit(1);
        if (existing.length > 0) {
            rows.push(existing[0]);
        }
        else {
            const inserted = await db.insert(table).values(value).returning();
            rows.push(inserted[0]);
        }
    }
    return rows;
}
async function seed() {
    console.log('🌱 Seeding database...');
    const hash = (p) => hashPassword(p);
    await db.insert(schema.users).values([
        { name: 'Rajesh Kumar', email: 'admin@concreteking.example', passwordHash: await hash('admin123'), role: 'admin' },
        { name: 'Priya Sharma', email: 'dispatcher@concreteking.example', passwordHash: await hash('dispatch123'), role: 'dispatcher' },
        { name: 'Suresh Patel', email: 'operator@concreteking.example', passwordHash: await hash('operator123'), role: 'plant_operator' },
        { name: 'Arvind Builders', email: 'client@concreteking.example', passwordHash: await hash('client123'), role: 'client' },
        { name: 'Ganesh More', email: 'driver@concreteking.example', passwordHash: await hash('driver123'), role: 'driver' },
    ]).onConflictDoNothing();
    // Marketplace plants — seeded ONLY for CONCRETE KING's live service areas:
    // Navi Mumbai, Thane, Vashi, Belapur, Pune, Pimpri Chinchwad, Lonavla, Karjat,
    // Uran. Coordinates are real (Google-map) locations for each area. Most are
    // approved + active + verified (visible to customers); two demo rows are
    // pending / inactive to prove the nearby filter and admin onboarding flow.
    // Each plant carries a unique plantCode (PLT-NNN) — the tenant identifier the
    // per-plant customer codes hang off.
    const plantRows = await ensureSeeded(schema.plants, PLANT_DIRECTORY, (p) => eq(schema.plants.plantCode, p.plantCode));
    // The legacy single-tenant demo dataset (clients/orders/challans/ledger) is
    // bound to the first plant so it stays coherent as that plant's own tenant
    // data. Each demo client gets a per-plant customer code under that plant.
    // ensureSeeded resolves PLT-001 from the DB when it already exists, so this is
    // always the real Navi Mumbai hub row (never undefined) on a re-run.
    const homePlant = plantRows[0];
    if (!homePlant)
        throw new Error('Seed failed: PLT-001 plant could not be resolved');
    const custCode = (i) => `${homePlant.plantCode}-C${String(i + 1).padStart(4, '0')}`;
    const clientRows = await ensureSeeded(schema.clients, [
        { plantId: homePlant.id, customerCode: custCode(0), name: 'Arvind Builders Pvt Ltd', contactPerson: 'Arvind Shah', phone: '9876543210', email: 'arvind@arvindbuilders.com', gstNo: '27AAACL1234F1Z5', address: 'Plot 12, MIDC', city: 'Navi Mumbai', creditLimit: '500000', outstandingAmount: '125000' },
        { plantId: homePlant.id, customerCode: custCode(1), name: 'Marvel Realty Ltd', contactPerson: 'Suresh Marvel', phone: '9123456780', email: 'suresh@marvelrealty.com', gstNo: '27AABCM5678G1Z3', address: 'Sector 7, Kharghar', city: 'Navi Mumbai', creditLimit: '1000000', outstandingAmount: '380000' },
        { plantId: homePlant.id, customerCode: custCode(2), name: 'Thane Tower Projects', contactPerson: 'Rajan Thakur', phone: '9988776655', email: 'rajan@thanetower.com', gstNo: '27AAACT9012H1Z8', address: 'Ghodbunder Road', city: 'Thane', creditLimit: '750000', outstandingAmount: '95000' },
        { plantId: homePlant.id, customerCode: custCode(3), name: 'Panvel Infrastructure', contactPerson: 'Nilesh Jadhav', phone: '9765432109', email: 'nilesh@panvelinfra.com', gstNo: '27AADCP3456J1Z2', address: 'Sector 23, Panvel', city: 'Panvel', creditLimit: '600000', outstandingAmount: '45000' },
        { plantId: homePlant.id, customerCode: custCode(4), name: 'Kharghar Heights Builders', contactPerson: 'Deepak Mehra', phone: '9654321098', email: 'deepak@khargharh.com', gstNo: '27AAECK7890K1Z6', address: 'Plot 45, Sector 12', city: 'Kharghar', creditLimit: '400000', outstandingAmount: '210000' },
    ], (c) => and(eq(schema.clients.plantId, c.plantId), eq(schema.clients.customerCode, c.customerCode)));
    const siteRows = await ensureSeeded(schema.sites, [
        { clientId: clientRows[0].id, name: 'Arvind Galaxy Phase 2', address: 'Plot 12, Sector 4', city: 'Navi Mumbai' },
        { clientId: clientRows[1].id, name: 'Marvel Central Tower', address: 'Sector 7, Kharghar', city: 'Navi Mumbai' },
        { clientId: clientRows[1].id, name: 'Marvel Residency Wing B', address: 'Sector 10, Kharghar', city: 'Navi Mumbai' },
        { clientId: clientRows[2].id, name: 'Thane Central Tower B4', address: 'Ghodbunder Road, Near Station', city: 'Thane' },
        { clientId: clientRows[3].id, name: 'Panvel Tech Park Block C', address: 'Sector 23', city: 'Panvel' },
    ], (s) => and(eq(schema.sites.clientId, s.clientId), eq(schema.sites.name, s.name)));
    const driverRows = await ensureSeeded(schema.drivers, [
        { name: 'Ganesh More', phone: '9823456701', licenseNo: 'MH04-20180123456', licenseExpiry: '2026-09-15' },
        { name: 'Ramesh Patil', phone: '9823456702', licenseNo: 'MH04-20190234567', licenseExpiry: '2027-03-22' },
        { name: 'Sanjay Kamble', phone: '9823456703', licenseNo: 'MH04-20170345678', licenseExpiry: '2025-11-30' },
        { name: 'Vinod Shinde', phone: '9823456704', licenseNo: 'MH04-20200456789', licenseExpiry: '2028-06-10' },
    ], (d) => eq(schema.drivers.phone, d.phone));
    const vehicleRows = await ensureSeeded(schema.vehicles, [
        { vehicleNo: 'MH 46 CU 1122', type: 'Transit Mixer', capacity: '7', driverId: driverRows[0]?.id, insuranceExpiry: '2025-12-31', lastService: '2025-03-15', status: 'active' },
        { vehicleNo: 'MH 46 CU 0813', type: 'Transit Mixer', capacity: '7', driverId: driverRows[1]?.id, insuranceExpiry: '2026-06-30', lastService: '2025-04-20', status: 'active' },
        { vehicleNo: 'MH 46 BT 4521', type: 'Transit Mixer', capacity: '6', driverId: driverRows[2]?.id, insuranceExpiry: '2025-08-15', lastService: '2025-01-10', status: 'maintenance' },
        { vehicleNo: 'MH 46 DX 7788', type: 'Transit Mixer', capacity: '9', driverId: driverRows[3]?.id, insuranceExpiry: '2026-11-20', lastService: '2025-05-01', status: 'active' },
    ], (v) => eq(schema.vehicles.vehicleNo, v.vehicleNo));
    const today = new Date().toISOString().slice(0, 10);
    const hp = homePlant.id;
    const orderRows = await ensureSeeded(schema.orders, [
        { orderNo: 'ORD-001', plantId: hp, clientId: clientRows[0].id, siteId: siteRows[0].id, grade: 'M30', quantity: '42', pumpRequired: true, deliveryDate: today, status: 'in_progress', notes: 'Slab casting today morning' },
        { orderNo: 'ORD-002', plantId: hp, clientId: clientRows[1].id, siteId: siteRows[1].id, grade: 'M25', quantity: '28', pumpRequired: false, deliveryDate: today, status: 'pending' },
        { orderNo: 'ORD-003', plantId: hp, clientId: clientRows[2].id, siteId: siteRows[3].id, grade: 'M40', quantity: '56', pumpRequired: true, deliveryDate: today, status: 'in_progress' },
        { orderNo: 'ORD-004', plantId: hp, clientId: clientRows[3].id, siteId: siteRows[4].id, grade: 'M20', quantity: '21', pumpRequired: false, deliveryDate: today, status: 'pending' },
        { orderNo: 'ORD-005', plantId: hp, clientId: clientRows[4].id, siteId: null, grade: 'M35', quantity: '35', pumpRequired: true, deliveryDate: today, status: 'completed' },
        { orderNo: 'ORD-006', plantId: hp, clientId: clientRows[0].id, siteId: siteRows[0].id, grade: 'M20', quantity: '14', pumpRequired: false, deliveryDate: today, status: 'pending' },
        { orderNo: 'ORD-007', plantId: hp, clientId: clientRows[1].id, siteId: siteRows[2].id, grade: 'M30', quantity: '49', pumpRequired: true, deliveryDate: today, status: 'cancelled' },
    ], (o) => eq(schema.orders.orderNo, o.orderNo));
    const now = new Date();
    const h2 = new Date(now.getTime() - 2 * 3600000);
    const h4 = new Date(now.getTime() - 4 * 3600000);
    const challanRows = await ensureSeeded(schema.challans, [
        { challanNo: 'CH-0001', plantId: hp, orderId: orderRows[0]?.id, clientId: clientRows[0].id, siteId: siteRows[0].id, vehicleId: vehicleRows[0]?.id, driverId: driverRows[0]?.id, grade: 'M30', quantity: '7', pumpRequired: true, dispatchTime: h4, status: 'delivered', deliveryTime: new Date(h4.getTime() + 3600000) },
        { challanNo: 'CH-0002', plantId: hp, orderId: orderRows[0]?.id, clientId: clientRows[0].id, siteId: siteRows[0].id, vehicleId: vehicleRows[1]?.id, driverId: driverRows[1]?.id, grade: 'M30', quantity: '7', pumpRequired: true, dispatchTime: h2, status: 'dispatched' },
        { challanNo: 'CH-0003', plantId: hp, orderId: orderRows[2]?.id, clientId: clientRows[2].id, siteId: siteRows[3].id, vehicleId: vehicleRows[3]?.id, driverId: driverRows[3]?.id, grade: 'M40', quantity: '9', pumpRequired: true, dispatchTime: h2, status: 'dispatched' },
        { challanNo: 'CH-0004', plantId: hp, orderId: orderRows[4]?.id, clientId: clientRows[4].id, siteId: null, vehicleId: vehicleRows[0]?.id, driverId: driverRows[0]?.id, grade: 'M35', quantity: '7', pumpRequired: true, dispatchTime: h4, status: 'delivered', deliveryTime: new Date(h4.getTime() + 4200000) },
        { challanNo: 'CH-0005', plantId: hp, orderId: orderRows[0]?.id, clientId: clientRows[0].id, siteId: siteRows[0].id, vehicleId: vehicleRows[1]?.id, driverId: driverRows[1]?.id, grade: 'M30', quantity: '7', pumpRequired: false, dispatchTime: now, status: 'dispatched' },
        { challanNo: 'CH-0006', plantId: hp, orderId: orderRows[1]?.id, clientId: clientRows[1].id, siteId: siteRows[1].id, vehicleId: vehicleRows[3]?.id, driverId: driverRows[3]?.id, grade: 'M25', quantity: '7', pumpRequired: false, dispatchTime: now, status: 'dispatched' },
    ], (c) => eq(schema.challans.challanNo, c.challanNo));
    await ensureSeeded(schema.batchRecords, [
        { batchNo: 'BTH-001', grade: 'M30', quantity: '7', cementBags: 56, waterLiters: 175, sandKg: 840, aggregateKg: 1120, operator: 'Suresh Patel', remarks: 'Morning batch' },
        { batchNo: 'BTH-002', grade: 'M30', quantity: '7', cementBags: 56, waterLiters: 175, sandKg: 840, aggregateKg: 1120, operator: 'Suresh Patel' },
        { batchNo: 'BTH-003', grade: 'M40', quantity: '9', cementBags: 81, waterLiters: 198, sandKg: 990, aggregateKg: 1350, operator: 'Suresh Patel' },
        { batchNo: 'BTH-004', grade: 'M35', quantity: '7', cementBags: 63, waterLiters: 168, sandKg: 875, aggregateKg: 1225, operator: 'Suresh Patel' },
        { batchNo: 'BTH-005', grade: 'M25', quantity: '7', cementBags: 49, waterLiters: 182, sandKg: 805, aggregateKg: 1050, operator: 'Suresh Patel', remarks: 'Afternoon batch' },
        { batchNo: 'BTH-006', grade: 'M30', quantity: '7', cementBags: 56, waterLiters: 175, sandKg: 840, aggregateKg: 1120, operator: 'Suresh Patel' },
    ], (b) => eq(schema.batchRecords.batchNo, b.batchNo));
    await ensureSeeded(schema.ledgerEntries, [
        { clientId: clientRows[0].id, type: 'debit', amount: '125000', description: 'Invoice #INV-2025-001 - M30 Concrete Supply', referenceNo: 'INV-2025-001' },
        { clientId: clientRows[1].id, type: 'debit', amount: '420000', description: 'Invoice #INV-2025-002 - M25 Concrete Supply', referenceNo: 'INV-2025-002' },
        { clientId: clientRows[1].id, type: 'credit', amount: '40000', description: 'Payment received - NEFT', referenceNo: 'NEFT-20250405' },
        { clientId: clientRows[2].id, type: 'debit', amount: '95000', description: 'Invoice #INV-2025-003 - M40 Concrete Supply', referenceNo: 'INV-2025-003' },
        { clientId: clientRows[3].id, type: 'debit', amount: '45000', description: 'Invoice #INV-2025-004 - M20 Concrete Supply', referenceNo: 'INV-2025-004' },
        { clientId: clientRows[4].id, type: 'debit', amount: '280000', description: 'Invoice #INV-2025-005 - M35 Concrete Supply', referenceNo: 'INV-2025-005' },
        { clientId: clientRows[4].id, type: 'credit', amount: '70000', description: 'Payment received - Cheque', referenceNo: 'CHQ-20250418' },
    ], (l) => eq(schema.ledgerEntries.referenceNo, l.referenceNo));
    // Wire the demo client/driver users to their records. Only set the link when
    // it isn't already held by another live (non-soft-deleted) account — the
    // partial unique indexes (users_linked_client_unique / _driver_) would
    // otherwise raise 23505 on a populated DB where another user already owns the
    // link. Re-running on a clean seed is a self-no-op (link already points here).
    const [clientAccount] = await db.select({ id: schema.users.id, linkedClientId: schema.users.linkedClientId })
        .from(schema.users).where(eq(schema.users.email, 'client@concreteking.example'));
    if (clientAccount && clientAccount.linkedClientId !== clientRows[0].id) {
        await db.update(schema.users)
            .set({ linkedClientId: clientRows[0].id })
            .where(and(eq(schema.users.id, clientAccount.id), sql `NOT EXISTS (
          SELECT 1 FROM users link_owner
          WHERE link_owner.linked_client_id = ${clientRows[0].id}
            AND link_owner.deleted_at IS NULL
            AND link_owner.id <> ${clientAccount.id}
        )`));
    }
    const [driverAccount] = await db.select({ id: schema.users.id, linkedDriverId: schema.users.linkedDriverId })
        .from(schema.users).where(eq(schema.users.email, 'driver@concreteking.example'));
    if (driverAccount && driverAccount.linkedDriverId !== driverRows[0].id) {
        await db.update(schema.users)
            .set({ linkedDriverId: driverRows[0].id })
            .where(and(eq(schema.users.id, driverAccount.id), sql `NOT EXISTS (
          SELECT 1 FROM users link_owner
          WHERE link_owner.linked_driver_id = ${driverRows[0].id}
            AND link_owner.deleted_at IS NULL
            AND link_owner.id <> ${driverAccount.id}
        )`));
    }
    // Map the demo customer to their per-plant client at the home plant so the
    // marketplace cross-plant listing has a mapping row to read (mirrors what the
    // first marketplace order would create lazily via resolvePlantCustomer).
    const [clientUser] = await db.select({ id: schema.users.id })
        .from(schema.users).where(eq(schema.users.email, 'client@concreteking.example'));
    if (clientUser) {
        await db.insert(schema.plantCustomers)
            .values({ plantId: homePlant.id, userId: clientUser.id, clientId: clientRows[0].id })
            .onConflictDoNothing();
    }
    console.log('✅ Seed complete!');
    console.log('\n🔑 Demo Credentials:');
    console.log('  Admin:    admin@concreteking.example / admin123');
    console.log('  Dispatcher: dispatcher@concreteking.example / dispatch123');
    console.log('  Operator: operator@concreteking.example / operator123');
    console.log('  Client:   client@concreteking.example / client123');
    console.log('  Driver:   driver@concreteking.example / driver123');
}
async function runSeedLocked() {
    // CI, boot jobs, and operators can invoke the seed concurrently. Serialize
    // the complete natural-key upsert pass so two processes cannot race between
    // resolving a row and linking its demo user.
    await db.execute(sql `SELECT pg_advisory_lock(hashtext('trackmyrmc-demo-seed'))`);
    try {
        await seed();
    }
    finally {
        await db.execute(sql `SELECT pg_advisory_unlock(hashtext('trackmyrmc-demo-seed'))`).catch(() => { });
        await pool.end();
    }
}
runSeedLocked().catch(e => { console.error(e); process.exit(1); });
