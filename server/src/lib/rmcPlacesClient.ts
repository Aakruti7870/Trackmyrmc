const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.businessStatus',
  'places.googleMapsUri',
  'places.types',
  'nextPageToken',
].join(',');

export interface RmcGooglePlace {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  latitude: number;
  longitude: number;
  businessStatus: string | null;
  googleMapsUri: string | null;
  types: string[];
}

interface PlacesResponse {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    businessStatus?: string;
    googleMapsUri?: string;
    types?: string[];
  }>;
  nextPageToken?: string;
}

export interface PlacesSearchOptions {
  textQuery: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryLimit?: number;
}

function readPositiveInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function placesKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not configured');
  return key;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function mergeSignals(parent: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Places request timed out after ${timeoutMs}ms`)), timeoutMs);
  const onAbort = () => controller.abort(parent?.reason);
  parent?.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onAbort);
    },
  };
}

async function requestPage(options: PlacesSearchOptions, pageToken?: string): Promise<PlacesResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const retryLimit = Math.min(options.retryLimit ?? readPositiveInt('RMC_IMPORT_RETRY_LIMIT', 3), 3);
  const radius = Math.min(Math.max(Math.round(options.radiusMeters), 1_000), 50_000);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retryLimit; attempt++) {
    const merged = mergeSignals(options.signal, timeoutMs);
    try {
      const response = await fetchImpl(PLACES_TEXT_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': placesKey(),
          'X-Goog-FieldMask': PLACES_FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: options.textQuery,
          languageCode: 'en',
          regionCode: 'IN',
          pageSize: 20,
          includeFutureOpeningBusinesses: false,
          locationBias: {
            circle: {
              center: { latitude: options.latitude, longitude: options.longitude },
              radius,
            },
          },
          ...(pageToken ? { pageToken } : {}),
        }),
        signal: merged.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const retryable = response.status === 429 || response.status >= 500;
        const error = new Error(`Google Places ${response.status}: ${body.slice(0, 300)}`);
        if (!retryable || attempt >= retryLimit) throw error;
        lastError = error;
      } else {
        return await response.json() as PlacesResponse;
      }
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted || attempt >= retryLimit) throw error;
    } finally {
      merged.cleanup();
    }

    const backoffMs = Math.min(4_000, 500 * 2 ** attempt) + Math.floor(Math.random() * 200);
    console.warn(JSON.stringify({
      event: 'rmc_places_retry',
      query: options.textQuery,
      attempt: attempt + 1,
      backoffMs,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    }));
    await sleep(backoffMs, options.signal);
  }
  throw lastError instanceof Error ? lastError : new Error('Google Places request failed');
}

export function parsePlacesResponse(response: PlacesResponse): RmcGooglePlace[] {
  return (response.places ?? [])
    .map(place => ({
      placeId: place.id?.trim() ?? '',
      name: place.displayName?.text?.trim() ?? '',
      formattedAddress: place.formattedAddress?.trim() || null,
      latitude: place.location?.latitude ?? Number.NaN,
      longitude: place.location?.longitude ?? Number.NaN,
      businessStatus: place.businessStatus ?? null,
      googleMapsUri: place.googleMapsUri ?? null,
      types: Array.isArray(place.types) ? place.types.filter((x): x is string => typeof x === 'string') : [],
    }))
    .filter(place => place.placeId && place.name && Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
}

export async function searchAllRmcPlaces(options: PlacesSearchOptions): Promise<{ places: RmcGooglePlace[]; pageCount: number }> {
  const byId = new Map<string, RmcGooglePlace>();
  let pageToken: string | undefined;
  let pageCount = 0;

  do {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const response = await requestPage(options, pageToken);
    pageCount++;
    for (const place of parsePlacesResponse(response)) byId.set(place.placeId, place);
    pageToken = response.nextPageToken || undefined;
    if (pageToken) await sleep(1_500, options.signal);
  } while (pageToken);

  return { places: [...byId.values()], pageCount };
}
