import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import * as schema from './schema.js';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
async function seed() {
    console.log('🌱 Seeding database...');
    const hash = (p) => bcrypt.hash(p, 10);
    const [admin] = await db.insert(schema.users).values([
        { name: 'Rajesh Kumar', email: 'admin@aakruti.com', passwordHash: await hash('admin123'), role: 'admin' },
        { name: 'Priya Sharma', email: 'dispatcher@aakruti.com', passwordHash: await hash('dispatch123'), role: 'dispatcher' },
        { name: 'Suresh Patel', email: 'operator@aakruti.com', passwordHash: await hash('operator123'), role: 'plant_operator' },
        { name: 'Arvind Builders', email: 'client@aakruti.com', passwordHash: await hash('client123'), role: 'client' },
        { name: 'Ganesh More', email: 'driver@aakruti.com', passwordHash: await hash('driver123'), role: 'driver' },
    ]).returning().onConflictDoNothing();
    const clientRows = await db.insert(schema.clients).values([
        { name: 'Arvind Builders Pvt Ltd', contactPerson: 'Arvind Shah', phone: '9876543210', email: 'arvind@arvindbuilders.com', gstNo: '27AAACL1234F1Z5', address: 'Plot 12, MIDC', city: 'Navi Mumbai', creditLimit: '500000', outstandingAmount: '125000' },
        { name: 'Marvel Realty Ltd', contactPerson: 'Suresh Marvel', phone: '9123456780', email: 'suresh@marvelrealty.com', gstNo: '27AABCM5678G1Z3', address: 'Sector 7, Kharghar', city: 'Navi Mumbai', creditLimit: '1000000', outstandingAmount: '380000' },
        { name: 'Thane Tower Projects', contactPerson: 'Rajan Thakur', phone: '9988776655', email: 'rajan@thanetower.com', gstNo: '27AAACT9012H1Z8', address: 'Ghodbunder Road', city: 'Thane', creditLimit: '750000', outstandingAmount: '95000' },
        { name: 'Panvel Infrastructure', contactPerson: 'Nilesh Jadhav', phone: '9765432109', email: 'nilesh@panvelinfra.com', gstNo: '27AADCP3456J1Z2', address: 'Sector 23, Panvel', city: 'Panvel', creditLimit: '600000', outstandingAmount: '45000' },
        { name: 'Kharghar Heights Builders', contactPerson: 'Deepak Mehra', phone: '9654321098', email: 'deepak@khargharh.com', gstNo: '27AAECK7890K1Z6', address: 'Plot 45, Sector 12', city: 'Kharghar', creditLimit: '400000', outstandingAmount: '210000' },
    ]).returning().onConflictDoNothing();
    const siteRows = await db.insert(schema.sites).values([
        { clientId: clientRows[0].id, name: 'Arvind Galaxy Phase 2', address: 'Plot 12, Sector 4', city: 'Navi Mumbai' },
        { clientId: clientRows[1].id, name: 'Marvel Central Tower', address: 'Sector 7, Kharghar', city: 'Navi Mumbai' },
        { clientId: clientRows[1].id, name: 'Marvel Residency Wing B', address: 'Sector 10, Kharghar', city: 'Navi Mumbai' },
        { clientId: clientRows[2].id, name: 'Thane Central Tower B4', address: 'Ghodbunder Road, Near Station', city: 'Thane' },
        { clientId: clientRows[3].id, name: 'Panvel Tech Park Block C', address: 'Sector 23', city: 'Panvel' },
    ]).returning().onConflictDoNothing();
    const driverRows = await db.insert(schema.drivers).values([
        { name: 'Ganesh More', phone: '9823456701', licenseNo: 'MH04-20180123456', licenseExpiry: '2026-09-15' },
        { name: 'Ramesh Patil', phone: '9823456702', licenseNo: 'MH04-20190234567', licenseExpiry: '2027-03-22' },
        { name: 'Sanjay Kamble', phone: '9823456703', licenseNo: 'MH04-20170345678', licenseExpiry: '2025-11-30' },
        { name: 'Vinod Shinde', phone: '9823456704', licenseNo: 'MH04-20200456789', licenseExpiry: '2028-06-10' },
    ]).returning().onConflictDoNothing();
    const vehicleRows = await db.insert(schema.vehicles).values([
        { vehicleNo: 'MH 46 CU 1122', type: 'Transit Mixer', capacity: '7', driverId: driverRows[0]?.id, insuranceExpiry: '2025-12-31', lastService: '2025-03-15', status: 'active' },
        { vehicleNo: 'MH 46 CU 0813', type: 'Transit Mixer', capacity: '7', driverId: driverRows[1]?.id, insuranceExpiry: '2026-06-30', lastService: '2025-04-20', status: 'active' },
        { vehicleNo: 'MH 46 BT 4521', type: 'Transit Mixer', capacity: '6', driverId: driverRows[2]?.id, insuranceExpiry: '2025-08-15', lastService: '2025-01-10', status: 'maintenance' },
        { vehicleNo: 'MH 46 DX 7788', type: 'Transit Mixer', capacity: '9', driverId: driverRows[3]?.id, insuranceExpiry: '2026-11-20', lastService: '2025-05-01', status: 'active' },
    ]).returning().onConflictDoNothing();
    const today = new Date().toISOString().slice(0, 10);
    const orderRows = await db.insert(schema.orders).values([
        { orderNo: 'ORD-001', clientId: clientRows[0].id, siteId: siteRows[0].id, grade: 'M30', quantity: '42', pumpRequired: true, deliveryDate: today, status: 'in_progress', notes: 'Slab casting today morning' },
        { orderNo: 'ORD-002', clientId: clientRows[1].id, siteId: siteRows[1].id, grade: 'M25', quantity: '28', pumpRequired: false, deliveryDate: today, status: 'pending' },
        { orderNo: 'ORD-003', clientId: clientRows[2].id, siteId: siteRows[3].id, grade: 'M40', quantity: '56', pumpRequired: true, deliveryDate: today, status: 'in_progress' },
        { orderNo: 'ORD-004', clientId: clientRows[3].id, siteId: siteRows[4].id, grade: 'M20', quantity: '21', pumpRequired: false, deliveryDate: today, status: 'pending' },
        { orderNo: 'ORD-005', clientId: clientRows[4].id, siteId: null, grade: 'M35', quantity: '35', pumpRequired: true, deliveryDate: today, status: 'completed' },
        { orderNo: 'ORD-006', clientId: clientRows[0].id, siteId: siteRows[0].id, grade: 'M20', quantity: '14', pumpRequired: false, deliveryDate: today, status: 'pending' },
        { orderNo: 'ORD-007', clientId: clientRows[1].id, siteId: siteRows[2].id, grade: 'M30', quantity: '49', pumpRequired: true, deliveryDate: today, status: 'cancelled' },
    ]).returning().onConflictDoNothing();
    const now = new Date();
    const h2 = new Date(now.getTime() - 2 * 3600000);
    const h4 = new Date(now.getTime() - 4 * 3600000);
    const challanRows = await db.insert(schema.challans).values([
        { challanNo: 'CH-0001', orderId: orderRows[0]?.id, clientId: clientRows[0].id, siteId: siteRows[0].id, vehicleId: vehicleRows[0]?.id, driverId: driverRows[0]?.id, grade: 'M30', quantity: '7', pumpRequired: true, dispatchTime: h4, status: 'delivered', deliveryTime: new Date(h4.getTime() + 3600000) },
        { challanNo: 'CH-0002', orderId: orderRows[0]?.id, clientId: clientRows[0].id, siteId: siteRows[0].id, vehicleId: vehicleRows[1]?.id, driverId: driverRows[1]?.id, grade: 'M30', quantity: '7', pumpRequired: true, dispatchTime: h2, status: 'dispatched' },
        { challanNo: 'CH-0003', orderId: orderRows[2]?.id, clientId: clientRows[2].id, siteId: siteRows[3].id, vehicleId: vehicleRows[3]?.id, driverId: driverRows[3]?.id, grade: 'M40', quantity: '9', pumpRequired: true, dispatchTime: h2, status: 'dispatched' },
        { challanNo: 'CH-0004', orderId: orderRows[4]?.id, clientId: clientRows[4].id, siteId: null, vehicleId: vehicleRows[0]?.id, driverId: driverRows[0]?.id, grade: 'M35', quantity: '7', pumpRequired: true, dispatchTime: h4, status: 'delivered', deliveryTime: new Date(h4.getTime() + 4200000) },
        { challanNo: 'CH-0005', orderId: orderRows[0]?.id, clientId: clientRows[0].id, siteId: siteRows[0].id, vehicleId: vehicleRows[1]?.id, driverId: driverRows[1]?.id, grade: 'M30', quantity: '7', pumpRequired: false, dispatchTime: now, status: 'dispatched' },
        { challanNo: 'CH-0006', orderId: orderRows[1]?.id, clientId: clientRows[1].id, siteId: siteRows[1].id, vehicleId: vehicleRows[3]?.id, driverId: driverRows[3]?.id, grade: 'M25', quantity: '7', pumpRequired: false, dispatchTime: now, status: 'dispatched' },
    ]).returning().onConflictDoNothing();
    await db.insert(schema.batchRecords).values([
        { batchNo: 'BTH-001', grade: 'M30', quantity: '7', cementBags: 56, waterLiters: 175, sandKg: 840, aggregateKg: 1120, operator: 'Suresh Patel', remarks: 'Morning batch' },
        { batchNo: 'BTH-002', grade: 'M30', quantity: '7', cementBags: 56, waterLiters: 175, sandKg: 840, aggregateKg: 1120, operator: 'Suresh Patel' },
        { batchNo: 'BTH-003', grade: 'M40', quantity: '9', cementBags: 81, waterLiters: 198, sandKg: 990, aggregateKg: 1350, operator: 'Suresh Patel' },
        { batchNo: 'BTH-004', grade: 'M35', quantity: '7', cementBags: 63, waterLiters: 168, sandKg: 875, aggregateKg: 1225, operator: 'Suresh Patel' },
        { batchNo: 'BTH-005', grade: 'M25', quantity: '7', cementBags: 49, waterLiters: 182, sandKg: 805, aggregateKg: 1050, operator: 'Suresh Patel', remarks: 'Afternoon batch' },
        { batchNo: 'BTH-006', grade: 'M30', quantity: '7', cementBags: 56, waterLiters: 175, sandKg: 840, aggregateKg: 1120, operator: 'Suresh Patel' },
    ]).onConflictDoNothing();
    await db.insert(schema.ledgerEntries).values([
        { clientId: clientRows[0].id, type: 'debit', amount: '125000', description: 'Invoice #INV-2025-001 - M30 Concrete Supply', referenceNo: 'INV-2025-001' },
        { clientId: clientRows[1].id, type: 'debit', amount: '420000', description: 'Invoice #INV-2025-002 - M25 Concrete Supply', referenceNo: 'INV-2025-002' },
        { clientId: clientRows[1].id, type: 'credit', amount: '40000', description: 'Payment received - NEFT', referenceNo: 'NEFT-20250405' },
        { clientId: clientRows[2].id, type: 'debit', amount: '95000', description: 'Invoice #INV-2025-003 - M40 Concrete Supply', referenceNo: 'INV-2025-003' },
        { clientId: clientRows[3].id, type: 'debit', amount: '45000', description: 'Invoice #INV-2025-004 - M20 Concrete Supply', referenceNo: 'INV-2025-004' },
        { clientId: clientRows[4].id, type: 'debit', amount: '280000', description: 'Invoice #INV-2025-005 - M35 Concrete Supply', referenceNo: 'INV-2025-005' },
        { clientId: clientRows[4].id, type: 'credit', amount: '70000', description: 'Payment received - Cheque', referenceNo: 'CHQ-20250418' },
    ]).onConflictDoNothing();
    console.log('✅ Seed complete!');
    console.log('\n🔑 Demo Credentials:');
    console.log('  Admin:    admin@aakruti.com / admin123');
    console.log('  Dispatcher: dispatcher@aakruti.com / dispatch123');
    console.log('  Operator: operator@aakruti.com / operator123');
    console.log('  Client:   client@aakruti.com / client123');
    console.log('  Driver:   driver@aakruti.com / driver123');
    await pool.end();
}
seed().catch(e => { console.error(e); process.exit(1); });
