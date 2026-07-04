import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { plants } from '../db/schema.js';
import { PLANT_DIRECTORY } from '../db/plantDirectory.js';

/**
 * Idempotently guarantee that the canonical RMC plant directory exists. Run once
 * at boot. New databases (dev or freshly-published production) start with zero
 * plants, which makes the customer-facing "Nearby RMC Plants" page show nothing.
 * This inserts the curated directory, skipping any plant whose plantCode already
 * exists (onConflictDoNothing on the unique plantCode), so it is safe to run on
 * every startup and never touches or overwrites plants added through onboarding.
 */
export async function ensurePlantDirectory(): Promise<number> {
  if (PLANT_DIRECTORY.length === 0) return 0;
  const inserted = await db
    .insert(plants)
    .values(PLANT_DIRECTORY)
    .onConflictDoNothing({ target: plants.plantCode })
    .returning({ id: plants.id });
  if (inserted.length > 0) {
    console.log(`ensurePlantDirectory: seeded ${inserted.length} plant(s)`);
  }
  return inserted.length;
}

/**
 * Backfill networkStatus for plants that were customer-visible under the legacy
 * gate (approved + active + location-verified + verified) but still carry the
 * default networkStatus='pending'. The customer-facing endpoints now gate on
 * networkStatus==='active' && showOnNetwork, so without this every existing
 * partner plant would silently disappear from the network dashboard on deploy.
 * Idempotent (only touches rows still at the default), safe to run every boot.
 */
export async function backfillNetworkStatus(): Promise<number> {
  const updated = await db
    .update(plants)
    .set({ networkStatus: 'active' })
    .where(and(
      eq(plants.networkStatus, 'pending'),
      eq(plants.plantStatus, 'approved'),
      eq(plants.isActive, true),
      eq(plants.locationVerified, true),
      eq(plants.verified, true),
    ))
    .returning({ id: plants.id });
  if (updated.length > 0) {
    console.log(`backfillNetworkStatus: activated ${updated.length} existing partner plant(s)`);
  }
  return updated.length;
}
