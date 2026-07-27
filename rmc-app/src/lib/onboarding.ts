// Tracks whether the pre-login feature carousel has already been shown, so
// returning visitors (and anyone who signs in) never see it again. Versioned
// key + safe JSON parsing so a future carousel redesign can reset it cleanly.
const ONBOARDING_KEY = 'trackmyrmc.onboarding.v1.completed';

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
