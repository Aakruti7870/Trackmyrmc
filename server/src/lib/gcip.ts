/**
 * Google Cloud Identity Platform (GCIP) / Firebase Admin SDK integration.
 *
 * Phone-auth flow when GCIP is active:
 *   1. Client uses Firebase SDK to sign in with phone (handles reCAPTCHA).
 *   2. Firebase sends the SMS OTP.
 *   3. User enters the code → Firebase SDK returns an ID token.
 *   4. Client POSTs the ID token to /api/auth/gcip/verify.
 *   5. verifyGcipToken() checks the token and extracts the phone number.
 *
 * Graceful fallback: if FIREBASE_PROJECT_ID / FIREBASE_ADMIN_SDK_JSON are not
 * set, isGcipConfigured() returns false and the existing Twilio/WhatsApp OTP
 * path stays active with no behaviour change.
 */

import { type App, cert, getApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const GCIP_APP_NAME = 'rmc-gcip';
let _app: App | null = null;

function getFirebaseAdminApp(): App | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const sdkJson   = process.env.FIREBASE_ADMIN_SDK_JSON;
  if (!projectId || !sdkJson) return null;

  if (_app) return _app;

  // Re-use an already-initialised named app across hot-reloads.
  try {
    _app = getApp(GCIP_APP_NAME);
    return _app;
  } catch { /* not yet initialised */ }

  const serviceAccount = JSON.parse(sdkJson) as Parameters<typeof cert>[0];
  _app = initializeApp({ credential: cert(serviceAccount), projectId }, GCIP_APP_NAME);
  return _app;
}

/** Returns true when the GCIP credential env vars are both present. */
export function isGcipConfigured(): boolean {
  return !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_ADMIN_SDK_JSON);
}

/**
 * Verify a Firebase ID token and return the verified phone number.
 * Returns null if the token is invalid, expired, or GCIP is not configured.
 */
export async function verifyGcipToken(idToken: string): Promise<{ phoneNumber: string } | null> {
  const app = getFirebaseAdminApp();
  if (!app) return null;

  try {
    const decoded = await getAuth(app).verifyIdToken(idToken);
    if (!decoded.phone_number) return null;
    return { phoneNumber: decoded.phone_number };
  } catch {
    return null;
  }
}
