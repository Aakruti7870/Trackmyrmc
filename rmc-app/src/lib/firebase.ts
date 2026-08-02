/**
 * Firebase client helpers for GCIP phone authentication.
 *
 * Only active when both VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID
 * are set. Falls back silently (isGcipEnabled() === false) so the existing
 * Twilio/WhatsApp OTP flow is completely unchanged until credentials exist.
 *
 * The firebase/app and firebase/auth modules are dynamically imported so
 * they are excluded from the main bundle when GCIP is disabled.
 */

const FIREBASE_API_KEY   = import.meta.env.VITE_FIREBASE_API_KEY   as string | undefined;
const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;

/** True when GCIP credentials are present in the build environment. */
export function isGcipEnabled(): boolean {
  return !!(FIREBASE_API_KEY && FIREBASE_PROJECT_ID);
}

// Internal reference to the pending confirmation result after sendOtp().
type ConfirmationResult = {
  confirm: (code: string) => Promise<{ user: { getIdToken: () => Promise<string> } }>;
};
let _pendingConfirmation: ConfirmationResult | null = null;

/**
 * Initiate Firebase phone sign-in.
 * An invisible reCAPTCHA is rendered in `recaptchaContainerId` (a div in the DOM).
 * Resolves when Firebase has sent the SMS; rejects on error.
 *
 * Only call when isGcipEnabled() === true.
 */
export async function gcipSendOtp(phoneNumber: string, recaptchaContainerId: string): Promise<void> {
  if (!FIREBASE_API_KEY || !FIREBASE_PROJECT_ID) {
    throw new Error('GCIP is not configured');
  }

  const [{ initializeApp, getApp, getApps }, { getAuth, signInWithPhoneNumber, RecaptchaVerifier }] =
    await Promise.all([import('firebase/app'), import('firebase/auth')]);

  const app = getApps().length > 0
    ? getApp()
    : initializeApp({
        apiKey:     FIREBASE_API_KEY,
        authDomain: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
        projectId:  FIREBASE_PROJECT_ID,
      });

  const auth     = getAuth(app);
  const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' });

  _pendingConfirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
}

/**
 * Confirm the OTP code entered by the user.
 * Returns the Firebase ID token to be sent to /api/auth/gcip/verify.
 *
 * Only call after a successful gcipSendOtp().
 */
export async function gcipVerifyOtp(code: string): Promise<string> {
  if (!_pendingConfirmation) throw new Error('No pending GCIP verification — call gcipSendOtp first');
  const credential = await _pendingConfirmation.confirm(code);
  return credential.user.getIdToken();
}

/** Clear the pending confirmation (e.g. when user changes their number). */
export function gcipReset(): void {
  _pendingConfirmation = null;
}
