import 'dotenv/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import pg from 'pg';
import * as schema from './schema.js';

// One-off, idempotent migration that lifts a legacy single-tenant database into
// the multi-tenant model:
//
//  1. Every plant gets a unique plantCode (PLT-NNN) if it lacks one.
//  2. A "home" plant is chosen (the lowest-id plant; one is created if the table
//     is empty) and all legacy clients/orders/challans with a null plantId are
//     bound to it — that plant becomes the tenant that owns the pre-existing data.
//  3. Every client with a plantId but no customerCode is assigned a sequential
//     per-plant customer code (PLT-NNN-CNNNN).
//  4. Each user.linkedClientId is mirrored into plant_customers so the customer's
//     cross-plant order listing has a mapping row to read.
//
// Re-running is safe: each step only touches rows that still need it.

const { Pool } = pg;

export interface MultiTenantMigrationResult {
  plantCodesAssigned: number;
  homePlantId: number;
  homePlantCreated: boolean;
  clientsBound: number;
  ordersBound: number;
  challansBound: number;
  customerCodesAssigned: number;
  mappingsCreated: number;
}

type DB = NodePgDatabase<typeof schema>;

// Assign PLT-NNN to every plant missing a code, continuing from the highest
// existing number so re-runs never collide with already-coded plants.
async function backfillPlantCodes(db: DB, log: (m: string) => void): Promise<number> {
  const all = await db.select({ id: schema.plants.id, plantCode: schema.plants.plantCode })
    .from(schema.plants).orderBy(asc(schema.plants.id));
  let max = 0;
  for (const p of all) {
    const n = parseInt((p.plantCode ?? '').split('-')[1] || '0', 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  let assigned = 0;
  for (const p of all) {
    if (p.plantCode) continue;
    const code = `PLT-${String(++max).padStart(3, '0')}`;
    await db.update(schema.plants).set({ plantCode: code }).where(eq(schema.plants.id, p.id));
    assigned++;
    log(`  ✔ plant #${p.id} → ${code}`);
  }
  return assigned;
}

// The lowest-id plant hosts legacy data. If there are no plants at all, create a
// placeholder so legacy rows still have a tenant to belong to.
async function resolveHomePlant(db: DB): Promise<{ id: number; plantCode: string; created: boolean }> {
  const [existing] = await db.select({ id: schema.plants.id, plantCode: schema.plants.plantCode })
    .from(schema.plants).orderBy(asc(schema.plants.id)).limit(1);
  if (existing) return { id: existing.id, plantCode: existing.plantCode ?? 'PLT-001', created: false };

  const [created] = await db.insert(schema.plants).values({
    plantCode: 'PLT-001', name: 'Default Plant', address: '', city: '', contactNumber: '',
    latitude: '0', longitude: '0', plantStatus: 'approved', isActive: true, locationVerified: true,
  }).returning({ id: schema.plants.id, plantCode: schema.plants.plantCode });
  return { id: created.id, plantCode: created.plantCode ?? 'PLT-001', created: true };
}

// Assign sequential per-plant customer codes to coded plants' clients that still
// lack one, continuing from the highest existing number for that plant.
async function backfillCustomerCodes(db: DB, log: (m: string) => void): Promise<number> {
  const codedPlants = await db.select({ id: schema.plants.id, plantCode: schema.plants.plantCode })
    .from(schema.plants).where(sql`${schema.plants.plantCode} IS NOT NULL`);
  let assigned = 0;
  for (const plant of codedPlants) {
    const plantClients = await db.select({ id: schema.clients.id, customerCode: schema.clients.customerCode })
      .from(schema.clients).where(eq(schema.clients.plantId, plant.id)).orderBy(asc(schema.clients.id));
    let max = 0;
    for (const c of plantClients) {
      const n = c.customerCode ? parseInt(c.customerCode.split('-C')[1] || '0', 10) : 0;
      if (Number.isFinite(n) && n > max) max = n;
    }
    for (const c of plantClients) {
      if (c.customerCode) continue;
      const code = `${plant.plantCode}-C${String(++max).padStart(4, '0')}`;
      await db.update(schema.clients).set({ customerCode: code }).where(eq(schema.clients.id, c.id));
      assigned++;
      log(`  ✔ client #${c.id} → ${code}`);
    }
  }
  return assigned;
}

// Mirror each user.linkedClientId into plant_customers (when the client is now
// tenant-bound) so the cross-plant customer listing has a mapping to read.
async function backfillMappings(db: DB): Promise<number> {
  const linked = await db.select({ userId: schema.users.id, clientId: schema.users.linkedClientId, plantId: schema.clients.plantId })
    .from(schema.users)
    .innerJoin(schema.clients, eq(schema.users.linkedClientId, schema.clients.id))
    .where(sql`${schema.clients.plantId} IS NOT NULL`);
  let created = 0;
  for (const row of linked) {
    if (row.clientId == null || row.plantId == null) continue;
    const inserted = await db.insert(schema.plantCustomers)
      .values({ plantId: row.plantId, userId: row.userId, clientId: row.clientId })
      .onConflictDoNothing().returning({ id: schema.plantCustomers.id });
    if (inserted.length > 0) created++;
  }
  return created;
}

export async function migrateMultiTenant(
  db: DB,
  log: (msg: string) => void = () => {},
): Promise<MultiTenantMigrationResult> {
  const plantCodesAssigned = await backfillPlantCodes(db, log);
  const home = await resolveHomePlant(db);
  if (home.created) log(`  ✔ created home plant #${home.id} (${home.plantCode})`);

  // Bind legacy rows (null plantId) to the home plant.
  const boundClients = await db.update(schema.clients)
    .set({ plantId: home.id }).where(isNull(schema.clients.plantId))
    .returning({ id: schema.clients.id });
  const boundOrders = await db.update(schema.orders)
    .set({ plantId: home.id }).where(isNull(schema.orders.plantId))
    .returning({ id: schema.orders.id });
  const boundChallans = await db.update(schema.challans)
    .set({ plantId: home.id }).where(isNull(schema.challans.plantId))
    .returning({ id: schema.challans.id });

  const customerCodesAssigned = await backfillCustomerCodes(db, log);
  const mappingsCreated = await backfillMappings(db);

  const result: MultiTenantMigrationResult = {
    plantCodesAssigned,
    homePlantId: home.id,
    homePlantCreated: home.created,
    clientsBound: boundClients.length,
    ordersBound: boundOrders.length,
    challansBound: boundChallans.length,
    customerCodesAssigned,
    mappingsCreated,
  };

  log(`\n✅ Multi-tenant migration complete: ${JSON.stringify(result)}`);
  return result;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  try {
    console.log('🏗️  Migrating to multi-tenant model...');
    await migrateMultiTenant(db, (msg) => console.log(msg));
  } finally {
    await pool.end();
  }
}

// Only run when executed directly as a script, not when imported by tests.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (invokedDirectly) {
  main().catch(e => { console.error(e); process.exit(1); });
}
