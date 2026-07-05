// Background location seam for native (Capacitor) duty tracking.
//
// On the web, live duty tracking uses the browser Geolocation API from the
// Attendance page (navigator.geolocation.watchPosition) — that only runs while
// the tab/app is in the foreground, which is fine for a PWA. On the native
// Android/iOS build we want the on-duty GPS stream to keep flowing while the app
// is backgrounded (a driver's phone in their pocket, a supervisor walking the
// yard). That requires a native background-geolocation plugin plus the matching
// OS permissions and a foreground service.
//
// This module is intentionally a NO-OP stub: it documents the integration point
// and keeps the web build unchanged. When the native build lands, wire a plugin
// such as @capacitor-community/background-geolocation (or @transistorsoft's
// background-geolocation) into start()/stop() below and post fixes to
// POST /attendance/location exactly as the web watcher does — the server side is
// already role-generic (see server/src/routes/attendance.ts), so no backend
// change is needed to support background fixes.
//
// Enable it only on native (import.meta.env.VITE_NATIVE or Capacitor.isNativePlatform())
// so the web/PWA path is never affected.

export interface BackgroundLocationHandle {
  stop: () => void;
}

export interface BackgroundLocationOptions {
  // Called with each background fix; the caller forwards it to the attendance
  // location endpoint (same shape the foreground watcher posts).
  onFix?: (fix: { lat: number; lng: number; speed?: number | null; heading?: number | null; accuracy?: number | null }) => void;
}

// Returns true when a native background-location provider is available. Always
// false on the web build (no plugin, no background execution).
export function isBackgroundLocationSupported(): boolean {
  return false;
}

// Start streaming location in the background. NO-OP on web; on native this is
// where the Capacitor background-geolocation plugin would be started. Returns a
// handle whose stop() the caller invokes on check-out.
export async function startBackgroundLocation(
  opts: BackgroundLocationOptions = {},
): Promise<BackgroundLocationHandle> {
  void opts;
  // Web / PWA: nothing to do — foreground watchPosition already covers it.
  return { stop: () => {} };
}
