// Live discovery of nearby ready-mix concrete plants via Google Places API (New)
// Text Search. These results are *unverified leads* — real-world plants that are
// not (yet) onboarded into our own directory. All calls happen server-side so the
// API key is never exposed to the browser.

import { and, eq, gt, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { responseCache } from '../db/schema.js';

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
// Only request the fields we actually render — Places bills per-field category,
// so a tight mask keeps cost down.
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.currentOpeningHours.openNow',
].join(',');

export interface DiscoveredPlace {
  placeId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  contactNumber: string | null;
  openNow: boolean | null;
}

// A discovered supplier additionally carries the supplier category keys it
// matched (a single real-world business can satisfy more than one query, e.g.
// a plant that also lists itself as a concrete supplier).
export interface DiscoveredSupplier extends DiscoveredPlace {
  categories: string[];
}

// The RMC-adjacent supplier categories a Super Admin can hunt for on the map.
// Each runs an independent Places Text Search; results are merged + tagged. The
// `query` strings are tuned to surface the right business type on Google Maps.
export const SUPPLIER_CATEGORIES = [
  { key: 'ready_mix', label: 'Ready-mix concrete plant', query: 'ready mix concrete (RMC) plant' },
  { key: 'concrete_supplier', label: 'Concrete supplier', query: 'concrete supplier' },
  { key: 'concrete_contractor', label: 'Concrete contractor', query: 'concrete contractor' },
  { key: 'cement_supplier', label: 'Cement supplier', query: 'cement supplier' },
  { key: 'fly_ash', label: 'Fly ash supplier', query: 'fly ash supplier' },
  { key: 'ggbs', label: 'GGBS supplier', query: 'GGBS ground granulated blast furnace slag supplier' },
] as const;

export type SupplierCategoryKey = (typeof SUPPLIER_CATEGORIES)[number]['key'];

const VALID_CATEGORY_KEYS = new Set<string>(SUPPLIER_CATEGORIES.map(c => c.key));

export function isSupplierCategoryKey(key: string): key is SupplierCategoryKey {
  return VALID_CATEGORY_KEYS.has(key);
}

interface PlacesApiResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    nationalPhoneNumber?: string;
    currentOpeningHours?: { openNow?: boolean };
  }>;
}

// Returns the configured Places key, if any. We accept either a dedicated key or
// a general Maps key so operators aren't forced into a specific secret name.
export function placesApiKey(): string | undefined {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || undefined;
}

export function isDiscoveryConfigured(): boolean {
  return !!placesApiKey();
}

// Cache responses briefly, keyed by coarse coordinates + radius, so a customer
// panning/refreshing doesn't re-bill the upstream for an identical search. The
// cache lives in Postgres (see response_cache) rather than in-process memory so
// every server instance shares one cached upstream call instead of each
// re-billing Places for the same nearby query under horizontal scaling.
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_PREFIX = 'places:';

// Read a cached value by key, treating any read failure as a miss so a flaky
// cache never blocks discovery.
async function readCache<T>(cacheKey: string): Promise<T | null> {
  try {
    const [hit] = await db
      .select({ value: responseCache.value })
      .from(responseCache)
      .where(and(eq(responseCache.key, cacheKey), gt(responseCache.expiresAt, new Date())));
    return hit ? (hit.value as T) : null;
  } catch (err) {
    console.error('places cache read error, treating as miss', err);
    return null;
  }
}

// Write a value into the shared cache. A failure is non-fatal — callers still
// return the fresh upstream data.
async function writeCache(cacheKey: string, value: unknown): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    await db
      .insert(responseCache)
      .values({ key: cacheKey, value, expiresAt })
      .onConflictDoUpdate({ target: responseCache.key, set: { value, expiresAt } });
    // Expired rows are purged by the scheduled background job
    // (cleanupExpiredCache) rather than inline on the discovery path.
  } catch (err) {
    console.error('places cache write error, returning uncached', err);
  }
}

// One raw Places Text Search around a point. Shared by the customer-facing
// single-query discovery and the Super Admin multi-category discovery. Not
// cached itself — callers cache their merged result.
async function searchPlaces(textQuery: string, lat: number, lng: number, radiusKm: number): Promise<DiscoveredPlace[]> {
  const key = placesApiKey();
  if (!key) throw new Error('Places API key not configured');

  // Places Text Search circle bias caps at 50km; we still post-filter by the
  // caller's true radius in the route.
  const biasRadius = Math.min(Math.max(radiusKm, 1) * 1000, 50000);

  const resp = await fetch(PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: biasRadius } },
      maxResultCount: 20,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Places API ${resp.status}: ${text.slice(0, 300)}`);
  }

  const json = (await resp.json()) as PlacesApiResponse;
  return (json.places ?? [])
    .map(p => ({
      placeId: p.id ?? '',
      name: p.displayName?.text ?? '',
      address: p.formattedAddress ?? null,
      latitude: p.location?.latitude ?? NaN,
      longitude: p.location?.longitude ?? NaN,
      contactNumber: p.nationalPhoneNumber ?? null,
      openNow: p.currentOpeningHours?.openNow ?? null,
    }))
    .filter(p => p.placeId && p.name && Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
}

export async function discoverConcretePlants(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<DiscoveredPlace[]> {
  const cacheKey = `${CACHE_PREFIX}${lat.toFixed(2)},${lng.toFixed(2)},${Math.round(radiusKm)}`;
  const cached = await readCache<DiscoveredPlace[]>(cacheKey);
  if (cached) return cached;

  const data = await searchPlaces('ready mix concrete (RMC) plant', lat, lng, radiusKm);
  await writeCache(cacheKey, data);
  return data;
}

// Super-Admin supplier hunt: run one Text Search per requested category, merge
// by placeId (a place can match several categories, so we collect the matched
// keys), and tag each result. Cached as one merged payload keyed by coarse
// coords + radius + the (sorted) category set so an identical search doesn't
// re-bill the upstream for every category again.
export async function discoverSuppliers(
  lat: number,
  lng: number,
  radiusKm: number,
  categoryKeys: SupplierCategoryKey[],
): Promise<DiscoveredSupplier[]> {
  const key = placesApiKey();
  if (!key) throw new Error('Places API key not configured');

  const cats = SUPPLIER_CATEGORIES.filter(c => categoryKeys.includes(c.key));
  if (cats.length === 0) return [];

  const catSig = cats.map(c => c.key).sort().join('+');
  const cacheKey = `${CACHE_PREFIX}sup:${lat.toFixed(2)},${lng.toFixed(2)},${Math.round(radiusKm)},${catSig}`;
  const cached = await readCache<DiscoveredSupplier[]>(cacheKey);
  if (cached) return cached;

  // Run the per-category searches concurrently. A single category failing must
  // not sink the whole hunt — log it and merge whatever succeeded.
  const settled = await Promise.allSettled(
    cats.map(async c => ({ key: c.key, places: await searchPlaces(c.query, lat, lng, radiusKm) })),
  );

  const byPlaceId = new Map<string, DiscoveredSupplier>();
  for (const r of settled) {
    if (r.status === 'rejected') {
      console.error('supplier category search failed', r.reason);
      continue;
    }
    for (const p of r.value.places) {
      const existing = byPlaceId.get(p.placeId);
      if (existing) {
        if (!existing.categories.includes(r.value.key)) existing.categories.push(r.value.key);
      } else {
        byPlaceId.set(p.placeId, { ...p, categories: [r.value.key] });
      }
    }
  }

  // If every category search failed we have nothing to merge — surface the
  // failure rather than caching an empty result as if no suppliers exist.
  if (byPlaceId.size === 0 && settled.every(r => r.status === 'rejected')) {
    throw new Error('All supplier category searches failed');
  }

  const data = [...byPlaceId.values()];
  await writeCache(cacheKey, data);
  return data;
}

// Purge cached upstream responses whose TTL has already elapsed. discoverConcretePlants
// no longer cleans inline, so this periodic background call is the sole mechanism
// that keeps response_cache bounded regardless of traffic. The DELETE is
// idempotent and safe to run from multiple instances concurrently.
export async function cleanupExpiredCache(): Promise<number> {
  const result = await db
    .delete(responseCache)
    .where(lt(responseCache.expiresAt, new Date()))
    .returning({ key: responseCache.key });
  return result.length;
}
