import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { plants } from '../db/schema.js';
import {
  rmcMarketAreas,
  rmcPlantCandidates,
  rmcPlantImportQueries,
  rmcPlantImportRuns,
} from '../db/rmcDiscoverySchema.js';
import { generateRmcSearchQueries, isLikelyDuplicate, normalizeRmcName, scoreRmcCandidate } from './rmcDiscovery.js';
import { searchAllRmcPlaces, type RmcGooglePlace } from './rmcPlacesClient.js';

function envInt(name: string, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
}

const MAX_CONCURRENCY = () => envInt('RMC_IMPORT_MAX_CONCURRENCY', 3, 10);
const MIN_SCORE = () => envInt('RMC_IMPORT_MIN_CONFIDENCE_SCORE', 45, 100);
const DUPLICATE_RADIUS_M = () => envInt('RMC_DUPLICATE_RADIUS_METERS', 200, 5_000);
const COOLDOWN_HOURS = () => envInt('RMC_IMPORT_MARKET_COOLDOWN_HOURS', 168, 24 * 365);

interface ImportQueryWork {
  queryId: number;
  marketId: number;
  queryText: string;
  locality: string;
  district: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

async function findPossibleDuplicate(place: RmcGooglePlace, locality: string): Promise<number | null> {
  const existingPlants = await db.select({
    id: plants.id,
    name: plants.name,
    latitude: plants.latitude,
    longitude: plants.longitude,
    city: plants.city,
    placeId: plants.placeId,
  }).from(plants);

  const normalized = normalizeRmcName(place.name);
  for (const plant of existingPlants) {
    if (plant.placeId && plant.placeId === place.placeId) return plant.id;
    const lat = Number(plant.latitude);
    const lng = Number(plant.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (isLikelyDuplicate(
      { name: place.name, latitude: place.latitude, longitude: place.longitude, locality },
      { name: plant.name, latitude: lat, longitude: lng, locality: plant.city },
      DUPLICATE_RADIUS_M(),
    )) return plant.id;
    if (normalizeRmcName(plant.name) === normalized && plant.city?.toLowerCase() === locality.toLowerCase()) return plant.id;
  }
  return null;
}

async function upsertCandidate(runId: number, work: ImportQueryWork, place: RmcGooglePlace): Promise<'inserted' | 'updated' | 'duplicate' | 'rejected'> {
  if (place.businessStatus === 'CLOSED_PERMANENTLY') return 'rejected';
  const confidence = scoreRmcCandidate({
    name: place.name,
    address: place.formattedAddress,
    types: place.types,
    minimumScore: MIN_SCORE(),
  });
  if (confidence.score < MIN_SCORE()) return 'rejected';

  const duplicatePlantId = await findPossibleDuplicate(place, work.locality);
  const discoveryStatus = duplicatePlantId ? 'DUPLICATE' : 'NEEDS_REVIEW';
  const now = new Date();

  const [existing] = await db.select({ id: rmcPlantCandidates.id })
    .from(rmcPlantCandidates)
    .where(eq(rmcPlantCandidates.googlePlaceId, place.placeId));

  await db.insert(rmcPlantCandidates).values({
    googlePlaceId: place.placeId,
    discoveredName: place.name,
    normalizedName: normalizeRmcName(place.name),
    formattedAddress: place.formattedAddress,
    locality: work.locality,
    district: work.district,
    state: 'Maharashtra',
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    googleMapsUri: place.googleMapsUri,
    googleBusinessStatus: place.businessStatus,
    googleTypes: place.types,
    source: 'GOOGLE_PLACES',
    confidenceScore: confidence.score,
    confidenceReasons: confidence.reasons,
    discoveryStatus,
    possibleDuplicateOfPlantId: duplicatePlantId,
    importRunId: runId,
    lastDiscoveredAt: now,
    lastGoogleCheckedAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: rmcPlantCandidates.googlePlaceId,
    set: {
      discoveredName: place.name,
      normalizedName: normalizeRmcName(place.name),
      formattedAddress: place.formattedAddress,
      locality: work.locality,
      district: work.district,
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      googleMapsUri: place.googleMapsUri,
      googleBusinessStatus: place.businessStatus,
      googleTypes: place.types,
      confidenceScore: confidence.score,
      confidenceReasons: confidence.reasons,
      discoveryStatus,
      possibleDuplicateOfPlantId: duplicatePlantId,
      importRunId: runId,
      lastDiscoveredAt: now,
      lastGoogleCheckedAt: now,
      updatedAt: now,
    },
  });

  if (duplicatePlantId) return 'duplicate';
  return existing ? 'updated' : 'inserted';
}

async function processOneQuery(runId: number, work: ImportQueryWork, signal: AbortSignal): Promise<void> {
  const startedAt = new Date();
  await db.update(rmcPlantImportQueries).set({ status: 'RUNNING', startedAt })
    .where(eq(rmcPlantImportQueries.id, work.queryId));

  try {
    const { places, pageCount } = await searchAllRmcPlaces({
      textQuery: work.queryText,
      latitude: work.latitude,
      longitude: work.longitude,
      radiusMeters: work.radiusMeters,
      signal,
    });

    const counters = { inserted: 0, updated: 0, duplicate: 0, rejected: 0 };
    for (const place of places) {
      const outcome = await upsertCandidate(runId, work, place);
      counters[outcome]++;
    }

    await db.update(rmcPlantImportQueries).set({
      status: 'COMPLETED',
      pageCount,
      resultCount: places.length,
      completedAt: new Date(),
    }).where(eq(rmcPlantImportQueries.id, work.queryId));

    await db.update(rmcPlantImportRuns).set({
      completedQueries: sql`${rmcPlantImportRuns.completedQueries} + 1`,
      totalResults: sql`${rmcPlantImportRuns.totalResults} + ${places.length}`,
      insertedCandidates: sql`${rmcPlantImportRuns.insertedCandidates} + ${counters.inserted}`,
      updatedCandidates: sql`${rmcPlantImportRuns.updatedCandidates} + ${counters.updated}`,
      duplicateCandidates: sql`${rmcPlantImportRuns.duplicateCandidates} + ${counters.duplicate}`,
      rejectedCandidates: sql`${rmcPlantImportRuns.rejectedCandidates} + ${counters.rejected}`,
      updatedAt: new Date(),
    }).where(eq(rmcPlantImportRuns.id, runId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(rmcPlantImportQueries).set({
      status: signal.aborted ? 'CANCELLED' : 'FAILED',
      errorMessage: message.slice(0, 2_000),
      completedAt: new Date(),
    }).where(eq(rmcPlantImportQueries.id, work.queryId));
    await db.update(rmcPlantImportRuns).set({
      completedQueries: sql`${rmcPlantImportRuns.completedQueries} + 1`,
      errorCount: sql`${rmcPlantImportRuns.errorCount} + 1`,
      errorSummary: sql`${rmcPlantImportRuns.errorSummary} || ${JSON.stringify([{ queryId: work.queryId, error: message.slice(0, 500) }])}::jsonb`,
      updatedAt: new Date(),
    }).where(eq(rmcPlantImportRuns.id, runId));
  }
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(workers);
}

export async function createRmcImportQueries(runId: number, marketIds: number[]): Promise<number> {
  const markets = await db.select().from(rmcMarketAreas)
    .where(and(inArray(rmcMarketAreas.id, marketIds), eq(rmcMarketAreas.isEnabled, true)));
  let count = 0;
  for (const market of markets) {
    const queries = generateRmcSearchQueries({
      locality: market.locality,
      marketName: market.marketName,
      industrial: /\bmidc\b/i.test(market.marketName) || /\bmidc\b/i.test(market.locality),
    });
    for (const queryText of queries) {
      await db.insert(rmcPlantImportQueries).values({
        importRunId: runId,
        marketAreaId: market.id,
        queryText,
      }).onConflictDoNothing();
      count++;
    }
  }
  await db.update(rmcPlantImportRuns).set({ totalQueries: count, updatedAt: new Date() })
    .where(eq(rmcPlantImportRuns.id, runId));
  return count;
}

export async function processRmcImportRun(runId: number): Promise<void> {
  const [claimed] = await db.update(rmcPlantImportRuns).set({
    status: 'RUNNING',
    startedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(eq(rmcPlantImportRuns.id, runId), eq(rmcPlantImportRuns.status, 'QUEUED')))
    .returning({ id: rmcPlantImportRuns.id });
  if (!claimed) return;

  const abortController = new AbortController();
  try {
    const queryRows = await db.select({
      queryId: rmcPlantImportQueries.id,
      marketId: rmcMarketAreas.id,
      queryText: rmcPlantImportQueries.queryText,
      locality: rmcMarketAreas.locality,
      district: rmcMarketAreas.district,
      latitude: rmcMarketAreas.latitude,
      longitude: rmcMarketAreas.longitude,
      radiusMeters: rmcMarketAreas.searchRadiusMeters,
    }).from(rmcPlantImportQueries)
      .innerJoin(rmcMarketAreas, eq(rmcPlantImportQueries.marketAreaId, rmcMarketAreas.id))
      .where(and(eq(rmcPlantImportQueries.importRunId, runId), eq(rmcPlantImportQueries.status, 'QUEUED')));

    const work: ImportQueryWork[] = queryRows.map(q => ({
      queryId: q.queryId,
      marketId: q.marketId,
      queryText: q.queryText,
      locality: q.locality,
      district: q.district,
      latitude: Number(q.latitude),
      longitude: Number(q.longitude),
      radiusMeters: q.radiusMeters,
    }));

    await runPool(work, MAX_CONCURRENCY(), async item => {
      const [run] = await db.select({ cancelRequested: rmcPlantImportRuns.cancelRequested })
        .from(rmcPlantImportRuns).where(eq(rmcPlantImportRuns.id, runId));
      if (run?.cancelRequested) {
        abortController.abort();
        return;
      }
      await processOneQuery(runId, item, abortController.signal);
    });

    const [run] = await db.select({ cancelRequested: rmcPlantImportRuns.cancelRequested })
      .from(rmcPlantImportRuns).where(eq(rmcPlantImportRuns.id, runId));
    const finalStatus = run?.cancelRequested ? 'CANCELLED' : 'COMPLETED';
    await db.update(rmcPlantImportRuns).set({ status: finalStatus, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(rmcPlantImportRuns.id, runId));

    const marketIds = [...new Set(work.map(w => w.marketId))];
    const nextScan = new Date(Date.now() + COOLDOWN_HOURS() * 3_600_000);
    if (marketIds.length > 0) {
      await db.update(rmcMarketAreas).set({ lastScannedAt: new Date(), nextScanEligibleAt: nextScan, updatedAt: new Date() })
        .where(inArray(rmcMarketAreas.id, marketIds));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(rmcPlantImportRuns).set({
      status: abortController.signal.aborted ? 'CANCELLED' : 'FAILED',
      completedAt: new Date(),
      errorCount: sql`${rmcPlantImportRuns.errorCount} + 1`,
      errorSummary: sql`${rmcPlantImportRuns.errorSummary} || ${JSON.stringify([{ error: message.slice(0, 500) }])}::jsonb`,
      updatedAt: new Date(),
    }).where(eq(rmcPlantImportRuns.id, runId));
  }
}

export function enqueueRmcImportRun(runId: number): void {
  setImmediate(() => {
    void processRmcImportRun(runId).catch(error => {
      console.error(JSON.stringify({ event: 'rmc_import_runner_failure', runId, error: error instanceof Error ? error.message : String(error) }));
    });
  });
}

export async function resumeQueuedRmcImportRuns(): Promise<void> {
  // A previous process instance dying mid-run leaves its row stuck at
  // RUNNING forever: nothing else claims RUNNING rows (processRmcImportRun's
  // claim guard only matches status='QUEUED'), and the active-run check in
  // the route blocks starting any new import while one is stuck. This runner
  // has no distributed lease/heartbeat, so on a fresh boot the only way a row
  // can still be RUNNING is that the process that owned it is gone — reclaim
  // it here. A cancellation that arrived too late to be observed is
  // finalized directly; anything else is put back in QUEUED so the normal
  // claim path below resumes it (already-completed queries are skipped since
  // per-query status persists independently of the run row).
  const orphaned = await db.select({ id: rmcPlantImportRuns.id, cancelRequested: rmcPlantImportRuns.cancelRequested })
    .from(rmcPlantImportRuns).where(eq(rmcPlantImportRuns.status, 'RUNNING'));
  for (const run of orphaned) {
    if (run.cancelRequested) {
      await db.update(rmcPlantImportRuns).set({ status: 'CANCELLED', completedAt: new Date(), updatedAt: new Date() })
        .where(eq(rmcPlantImportRuns.id, run.id));
    } else {
      await db.update(rmcPlantImportRuns).set({ status: 'QUEUED', updatedAt: new Date() })
        .where(eq(rmcPlantImportRuns.id, run.id));
    }
  }

  const queued = await db.select({ id: rmcPlantImportRuns.id }).from(rmcPlantImportRuns)
    .where(eq(rmcPlantImportRuns.status, 'QUEUED'));
  for (const run of queued) enqueueRmcImportRun(run.id);
}
