import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { SignInButton, useAuth as useClerkAuth, useClerk } from '@clerk/clerk-react';
import { Crown } from 'lucide-react';
import { api, ApiError, type User } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { defaultPath } from '@/lib/permissions';

/**
 * Staff single sign-on entry. Rendered only when Clerk is
 * configured. The glowing crown opens Clerk's modal (email/password, Google,
 * Phone OTP, plus any providers enabled in the Clerk dashboard). Once a Clerk session
 * exists, we exchange its session token for the app's own JWT via
 * POST /api/auth/clerk. Non-staff identities are rejected by the server and the
 * Clerk session is dropped so the user isn't left half-authenticated.
 */
export default function ClerkStaffLogin({ onError }: { onError: (msg: string) => void }) {
  const { isSignedIn, getToken } = useClerkAuth();
  const { signOut } = useClerk();
  const { updateUser } = useAuth();
  const [, navigate] = useLocation();
  const [exchanging, setExchanging] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn || doneRef.current) return;
    doneRef.current = true;
    setExchanging(true);
    (async () => {
      try {
        const clerkToken = await getToken();
        if (!clerkToken) throw new Error('Could not retrieve your sign-on session.');
        const data = await api.post<{ token: string; user: User }>('/auth/clerk', { token: clerkToken });
        updateUser(data.user, data.token);
        navigate(defaultPath(data.user.role));
      } catch (err) {
        // Not a staff/authority account, or the exchange failed — sign out of
        // Clerk so a subsequent attempt starts clean, and surface the reason.
        try { await signOut(); } catch { /* ignore */ }
        doneRef.current = false;
        const msg = err instanceof ApiError || err instanceof Error ? err.message : 'Single sign-on failed.';
        onError(msg);
      } finally {
        setExchanging(false);
      }
    })();
  }, [isSignedIn, getToken, signOut, updateUser, navigate, onError]);

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 16px' }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(30,41,90,.12)' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Staff
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(30,41,90,.12)' }} />
      </div>

      <SignInButton mode="modal" fallbackRedirectUrl="/login">
        <button type="button" disabled={exchanging} className="crown-sso-btn">
          <Crown size={18} />
          {exchanging ? 'Signing in…' : 'Staff Sign-In'}
        </button>
      </SignInButton>

      <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
        Sign in with email, Google or phone — for admins, dispatchers
        &amp; plant operators. Clients &amp; drivers use the form above.
      </p>
    </div>
  );
}
