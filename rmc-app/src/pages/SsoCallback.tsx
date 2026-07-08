import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { api, ApiError, type User } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Landing page for Clerk's Google (OAuth) redirect on the *customer* side.
 *
 * Clerk sends the browser here after the Google consent screen. We first
 * complete the OAuth handshake (which activates the Clerk session), then exchange
 * the resulting session token for the app's own JWT via the customer-Google
 * endpoint, which maps the verified email to a 'client' account. On any failure
 * we drop the Clerk session so a retry starts clean and send the user back to
 * /login with the reason.
 *
 * Staff Google sign-in does NOT use this page — it goes through the staff modal
 * and the staff token-exchange — so this page only ever resolves customers.
 */
export default function SsoCallback() {
  const { handleRedirectCallback, signOut } = useClerk();
  const { isSignedIn, getToken } = useClerkAuth();
  const { updateUser } = useAuth();
  const [, navigate] = useLocation();
  const [error, setError] = useState('');
  const handledRef = useRef(false);
  const exchangedRef = useRef(false);

  // Step 1: finish the OAuth handshake. Pass a no-op navigate so Clerk doesn't
  // redirect on its own — the isSignedIn watcher below drives the next step.
  // A watchdog guarantees we never hang on the spinner: if the handshake never
  // yields a session (failed/abandoned callback), bail back to /login.
  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    const watchdog = setTimeout(() => {
      if (exchangedRef.current) return; // a session arrived; exchange owns the flow
      setError('Google sign-in could not be completed. Please try again.');
      setTimeout(() => navigate('/login'), 2500);
    }, 12000);
    handleRedirectCallback({}, async () => {}).catch(() => {
      // Non-fatal (e.g. already signed in): the watcher still runs the exchange.
      // If no session ever appears, the watchdog above sends the user back.
    });
    return () => clearTimeout(watchdog);
  }, [handleRedirectCallback, navigate]);

  // Step 2: once a Clerk session exists, exchange it for the app JWT (customer).
  useEffect(() => {
    if (!isSignedIn || exchangedRef.current) return;
    exchangedRef.current = true;
    (async () => {
      try {
        const clerkToken = await getToken();
        if (!clerkToken) throw new Error('Could not retrieve your sign-in session.');
        const data = await api.post<{ token: string; user: User }>(
          '/auth/clerk/customer/google', { token: clerkToken },
        );
        updateUser(data.user, data.token);
        navigate('/');
      } catch (err) {
        try { await signOut(); } catch { /* ignore */ }
        const msg = err instanceof ApiError || err instanceof Error ? err.message : 'Google sign-in failed.';
        setError(msg);
        setTimeout(() => navigate('/login'), 2500);
      }
    })();
  }, [isSignedIn, getToken, updateUser, navigate, signOut]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14,
      background: 'var(--bg)', color: 'var(--text)', padding: 24, textAlign: 'center',
    }}>
      {error ? (
        <>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#ef4444', margin: 0 }}>{error}</p>
          <p style={{ fontSize: 13, color: 'var(--muted, #94a3b8)', margin: 0 }}>Taking you back to sign in…</p>
        </>
      ) : (
        <>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '3px solid var(--line)', borderTopColor: 'var(--gold, #178a6e)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ fontSize: 14, color: 'var(--muted, #94a3b8)', margin: 0 }}>Completing sign-in…</p>
          <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
        </>
      )}
    </div>
  );
}
