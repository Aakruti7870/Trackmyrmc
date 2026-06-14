// Live discovery of nearby ready-mix concrete plants via Google Places API (New)
// Text Search. These results are *unverified leads* — real-world plants that are
// not (yet) onboarded into our own directory. All calls happen server-side so the
// API key is never exposed to the browser.
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
// panning/refreshing doesn't re-bill the upstream for an identical search.
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
export async function discoverConcretePlants(lat, lng, radiusKm) {
    const key = placesApiKey();
    if (!key)
        throw new Error('Places API key not configured');
    const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)},${Math.round(radiusKm)}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS)
        return hit.data;
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
    cache.set(cacheKey, { at: Date.now(), data });
    return data;
}
