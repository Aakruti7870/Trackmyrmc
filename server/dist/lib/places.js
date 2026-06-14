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
// Returns the configured Places key, if any. We accept either a dedicated key or
// a general Maps key so operators aren't forced into a specific secret name.
export function placesApiKey() {
    return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || undefined;
}
export function isDiscoveryConfigured() {
    return !!placesApiKey();
}
// Cache responses briefly, keyed by coarse coordinates + radius, so a customer
// panning/refreshing doesn't re-bill the upstream for an identical search. The
// cache lives in Postgres (see response_cache) rather than in-process memory so
// every server instance shares one cached upstream call instead of each
// re-billing Places for the same nearby query under horizontal scaling.
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_PREFIX = 'places:';
let lastCacheCleanup = 0;
export async function discoverConcretePlants(lat, lng, radiusKm) {
    const key = placesApiKey();
    if (!key)
        throw new Error('Places API key not configured');
    const cacheKey = `${CACHE_PREFIX}${lat.toFixed(2)},${lng.toFixed(2)},${Math.round(radiusKm)}`;
    try {
        const [hit] = await db
            .select({ value: responseCache.value })
            .from(responseCache)
            .where(and(eq(responseCache.key, cacheKey), gt(responseCache.expiresAt, new Date())));
        if (hit)
            return hit.value;
    }
    catch (err) {
        // A cache read failure must not block discovery — fall through to the
        // upstream call as if it were a miss.
        console.error('places cache read error, treating as miss', err);
    }
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
            textQuery: 'ready mix concrete (RMC) plant',
            locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: biasRadius } },
            maxResultCount: 20,
        }),
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Places API ${resp.status}: ${text.slice(0, 300)}`);
    }
    const json = (await resp.json());
    const data = (json.places ?? [])
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
    try {
        const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
        await db
            .insert(responseCache)
            .values({ key: cacheKey, value: data, expiresAt })
            .onConflictDoUpdate({
            target: responseCache.key,
            set: { value: data, expiresAt },
        });
        // Opportunistic cleanup of expired rows, throttled to once per TTL window.
        const now = Date.now();
        if (now - lastCacheCleanup > CACHE_TTL_MS) {
            lastCacheCleanup = now;
            db.delete(responseCache).where(lt(responseCache.expiresAt, new Date())).catch(() => { });
        }
    }
    catch (err) {
        // A cache write failure is non-fatal: still return the fresh upstream data.
        console.error('places cache write error, returning uncached', err);
    }
    return data;
}
// Purge cached upstream responses whose TTL has already elapsed. discoverConcretePlants
// cleans opportunistically, but only when a fresh upstream call happens; on a
// low-traffic instance expired rows would linger indefinitely. A periodic
// background call keeps response_cache bounded regardless of traffic. The DELETE
// is idempotent and safe to run from multiple instances concurrently.
export async function cleanupExpiredCache() {
    const result = await db
        .delete(responseCache)
        .where(lt(responseCache.expiresAt, new Date()))
        .returning({ key: responseCache.key });
    return result.length;
}
