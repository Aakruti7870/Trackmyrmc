export type AutomaticTheme = 'concrete-gold' | 'infra-green';

type Coordinates = { latitude: number; longitude: number };

const DAY_THEME: AutomaticTheme = 'concrete-gold';
const NIGHT_THEME: AutomaticTheme = 'infra-green';
const FALLBACK_DAY_START_HOUR = 6;
const FALLBACK_NIGHT_START_HOUR = 18;
const LOCATION_CACHE_KEY = 'trackmyrmc.theme.coordinates';

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

/**
 * Lightweight NOAA-style sunrise/sunset approximation. It deliberately avoids
 * a network dependency so the Android WebView can select a theme offline.
 */
function calculateSolarTime(date: Date, coords: Coordinates, sunrise: boolean): Date | null {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  const longitudeHour = coords.longitude / 15;
  const approximateTime = dayOfYear + ((sunrise ? 6 : 18) - longitudeHour) / 24;
  const meanAnomaly = 0.9856 * approximateTime - 3.289;
  let trueLongitude = meanAnomaly + 1.916 * Math.sin(toRadians(meanAnomaly)) + 0.02 * Math.sin(toRadians(2 * meanAnomaly)) + 282.634;
  trueLongitude = normalizeDegrees(trueLongitude);

  let rightAscension = toDegrees(Math.atan(0.91764 * Math.tan(toRadians(trueLongitude))));
  rightAscension = normalizeDegrees(rightAscension);
  rightAscension += Math.floor(trueLongitude / 90) * 90 - Math.floor(rightAscension / 90) * 90;
  rightAscension /= 15;

  const sinDeclination = 0.39782 * Math.sin(toRadians(trueLongitude));
  const cosDeclination = Math.cos(Math.asin(sinDeclination));
  const zenith = 90.833;
  const cosHourAngle =
    (Math.cos(toRadians(zenith)) - sinDeclination * Math.sin(toRadians(coords.latitude))) /
    (cosDeclination * Math.cos(toRadians(coords.latitude)));

  if (cosHourAngle > 1 || cosHourAngle < -1) return null;

  let hourAngle = sunrise
    ? 360 - toDegrees(Math.acos(cosHourAngle))
    : toDegrees(Math.acos(cosHourAngle));
  hourAngle /= 15;

  const localMeanTime = hourAngle + rightAscension - 0.06571 * approximateTime - 6.622;
  const utcHours = ((localMeanTime - longitudeHour) % 24 + 24) % 24;
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  utc.setUTCMinutes(Math.round(utcHours * 60));
  return utc;
}

function readCachedCoordinates(): Coordinates | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCATION_CACHE_KEY) ?? 'null') as Coordinates | null;
    if (!parsed || !Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function cacheCoordinates(coords: Coordinates): void {
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(coords));
  } catch {
    // Theme selection must never block application startup.
  }
}

function fallbackTheme(now: Date): AutomaticTheme {
  const hour = now.getHours();
  return hour >= FALLBACK_DAY_START_HOUR && hour < FALLBACK_NIGHT_START_HOUR ? DAY_THEME : NIGHT_THEME;
}

export function resolveAutomaticTheme(now = new Date(), coords = readCachedCoordinates()): AutomaticTheme {
  if (!coords) return fallbackTheme(now);
  const sunrise = calculateSolarTime(now, coords, true);
  const sunset = calculateSolarTime(now, coords, false);
  if (!sunrise || !sunset) return fallbackTheme(now);
  return now >= sunrise && now < sunset ? DAY_THEME : NIGHT_THEME;
}

export function applyAutomaticTheme(now = new Date(), coords?: Coordinates | null): AutomaticTheme {
  const theme = resolveAutomaticTheme(now, coords ?? readCachedCoordinates());
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === NIGHT_THEME ? 'dark' : 'light';
  return theme;
}

function refreshFromCurrentPosition(): void {
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const value = { latitude: coords.latitude, longitude: coords.longitude };
      cacheCoordinates(value);
      applyAutomaticTheme(new Date(), value);
    },
    () => undefined,
    { enableHighAccuracy: false, maximumAge: 24 * 60 * 60 * 1000, timeout: 5000 },
  );
}

/**
 * Refines the theme with a device fix, but only when location access was
 * already granted for some other feature (trip tracking, plant search,
 * delivery pin, etc). The automatic theme must never itself trigger a
 * location permission prompt — a cached fix or the hour-based fallback is
 * used instead until the app already holds permission for another reason.
 */
function requestLocationForTheme(): void {
  if (!('geolocation' in navigator)) return;
  if ('permissions' in navigator && navigator.permissions?.query) {
    navigator.permissions.query({ name: 'geolocation' as PermissionName })
      .then(status => { if (status.state === 'granted') refreshFromCurrentPosition(); })
      .catch(() => undefined);
    return;
  }
  // Permissions API unavailable: fall back to the cached fix (if any) and the
  // hour-based default rather than risk an unsolicited permission prompt.
}

export function startAutomaticTheme(): () => void {
  applyAutomaticTheme();
  requestLocationForTheme();

  const interval = window.setInterval(() => applyAutomaticTheme(), 60_000);
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      applyAutomaticTheme();
      requestLocationForTheme();
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
