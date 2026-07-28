// Session-scoped splash key — sessionStorage clears on tab/app close so the
// 5-second brand splash plays once per app launch (correct native-app feel).
const SPLASH_KEY = 'trackmyrmc.splash.v1.seen';

export function hasSeenSplash(): boolean {
  try { return sessionStorage.getItem(SPLASH_KEY) === '1'; } catch { return false; }
}

export function markSplashSeen(): void {
  try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch { /* best-effort */ }
}
