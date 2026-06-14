import 'dotenv/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import * as schema from './schema.js';

// One-off, idempotent migration that gives FLEET (vehicles) and PRODUCTION
// (batch_records) a `plant_id`, closing the cross-plant leak where both were a
// single global pool every plant could read.
//
// - vehicles.plant_id is backfilled from the plant of each vehicle's most-recent
//   challan (a vehicle that has only ever dispatched for one plant is attributed
//   to it; a never-dispatched vehicle stays NULL — visible only to a null-plant
//   global admin until an owner adopts it).
// - batch_records carry no order/challan linkage in this schema, so legacy rows
//   cannot be attributed to a plant and are deliberately left NULL. New batches
//   are stamped with the creating staff member's plant going forward.
//
// Re-running is safe: columns use ADD COLUMN IF NOT EXISTS and the backfill only
// touches rows whose plant_id is still NULL.

const { Pool } = pg;

export interface FleetProductionPlantMigrationResult {
  addedVehiclePlantColumn: boolean;
  addedBatchPlantColumn: boolean;
  vehiclesBackfilled: number;
}

type DB = NodePgDatabase<typeof schema>;

async function columnExists(db: DB, table: string, column: string): Promise<boolean> {
  const res = await db.execute(
    sql`SELECT 1 FROM information_schema.columns WHERE table_name = ${table} AND column_name = ${column}`,
  );
  return res.rows.length > 0;
}

export async function migrateFleetProductionPlant(
  db: DB,
  log: (msg: string) => void = () => {},
): Promise<FleetProductionPlantMigrationResult> {
  const hadVehicleCol = await columnExists(db, 'vehicles', 'plant_id');
  const hadBatchCol = await columnExists(db, 'batch_records', 'plant_id');

  await db.execute(
    sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS plant_id integer REFERENCES plants(id)`,
  );
  log(hadVehicleCol ? '  – vehicles.plant_id already present' : '  ✔ added vehicles.plant_id');

  await db.execute(
    sql`ALTER TABLE batch_records ADD COLUMN IF NOT EXISTS plant_id integer REFERENCES plants(id)`,
  );
  log(hadBatchCol ? '  – batch_records.plant_id already present' : '  ✔ added batch_records.plant_id');

  // Backfill each NULL-plant vehicle with the plant of its most-recent challan.
  const backfill = await db.execute(sql`
    UPDATE vehicles v
    SET plant_id = sub.plant_id
    FROM (
      SELECT DISTINCT ON (c.vehicle_id) c.vehicle_id, c.plant_id
      FROM challans c
      WHERE c.vehicle_id IS NOT NULL AND c.plant_id IS NOT NULL
      ORDER BY c.vehicle_id, c.created_at DESC
    ) sub
    WHERE v.id = sub.vehicle_id AND v.plant_id IS NULL
  `);
  const vehiclesBackfilled = backfill.rowCount ?? 0;
  log(`  ✔ backfilled ${vehiclesBackfilled} vehicle(s) from their most-recent challan's plant`);
  log('  – batch_records left NULL (no order/challan linkage to attribute legacy rows)');

  const result: FleetProductionPlantMigrationResult = {
    addedVehiclePlantColumn: !hadVehicleCol,
    addedBatchPlantColumn: !hadBatchCol,
    vehiclesBackfilled,
  };
  log(`\n✅ fleet/production plant scoping migration complete: ${JSON.stringify(result)}`);
  return result;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  try {
    console.log('🏭 Scoping fleet (vehicles) and production (batch_records) by plant...');
    await migrateFleetProductionPlant(db, (msg) => console.log(msg));
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
