// Tracks whether the pre-login feature carousel has already been shown, so
// returning visitors (and anyone who signs in) never see it again. Versioned
// key + safe JSON parsing so a future carousel redesign can reset it cleanly.
const ONBOARDING_KEY = 'trackmyrmc.onboarding.v1.completed';

// Session-scoped splash key — sessionStorage clears on tab/app close so the
// 5-second brand splash plays once per app launch (correct native-app feel).
const SPLASH_KEY = 'trackmyrmc.splash.v1.seen';

export function hasSeenSplash(): boolean {
  try { return sessionStorage.getItem(SPLASH_KEY) === '1'; } catch { return false; }
}

export function markSplashSeen(): void {
  try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch { /* best-effort */ }
}

export function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    // If storage is unavailable, don't force the carousel on every load.
    return true;
  }
}

export function markOnboardingComplete(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    // Best-effort — worst case the carousel reappears next launch.
  }
}
