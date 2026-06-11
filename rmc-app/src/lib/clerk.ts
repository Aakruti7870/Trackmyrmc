// Single place that decides whether Clerk single sign-on is available in this
// build. When VITE_CLERK_PUBLISHABLE_KEY is absent the ClerkProvider is never
// mounted and every Clerk affordance is hidden, so the app degrades cleanly to
// the legacy email/password login.
export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
export const clerkEnabled = Boolean(CLERK_PUBLISHABLE_KEY);

/**
 * End the Clerk browser session on logout, when Clerk is configured. Uses the
 * global Clerk instance (set by ClerkProvider) so it can be called from outside
 * the provider's React tree without conditionally calling a hook. Best-effort:
 * clearing the local app token is what actually logs the user out.
 */
export async function clerkSignOutIfEnabled(): Promise<void> {
  if (!clerkEnabled) return;
  const w = window as unknown as { Clerk?: { signOut?: () => Promise<void> } };
  try {
    await w.Clerk?.signOut?.();
  } catch {
    // ignore — local session is already being cleared by the caller
  }
}
