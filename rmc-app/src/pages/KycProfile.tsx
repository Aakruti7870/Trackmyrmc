import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { SUPPORT_WHATSAPP_URL } from '@/lib/brand';
import {
  ShieldCheck, ShieldAlert, ShieldX, Clock,
  Loader2, RefreshCw, AlertCircle, CheckCircle2, ArrowRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type EkycStatus = 'not_started' | 'pending' | 'verified' | 'failed' | 'rejected';

interface KycState {
  configured: boolean;
  status: EkycStatus;
  isVerified: boolean;
  verifiedLegalName: string | null;
  verifiedAt: string | null;
  provider: string | null;
  maskedAadhaar: string | null;
  nameUpdateFailed: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const BADGE_MAP: Record<EkycStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Not Started',          color: 'var(--muted)',  bg: 'var(--glass-1)' },
  pending:     { label: 'Verification Pending', color: 'var(--gold)',   bg: 'color-mix(in srgb,var(--gold) 12%,transparent)' },
  verified:    { label: 'KYC Verified',         color: 'var(--green)',  bg: 'rgba(34,197,94,.12)' },
  failed:      { label: 'Verification Failed',  color: 'var(--red)',    bg: 'rgba(239,68,68,.12)' },
  rejected:    { label: 'Requires Attention',   color: 'var(--orange)', bg: 'rgba(245,158,11,.12)' },
};

function StatusBadge({ status }: { status: EkycStatus }) {
  const s = BADGE_MAP[status] ?? BADGE_MAP.not_started;
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  );
}

// ─── Shared card wrapper ──────────────────────────────────────────────────────

function KycCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 20,
      padding: '28px 22px', display: 'flex', flexDirection: 'column', gap: 18,
    }}>{children}</div>
  );
}

// ─── Shared buttons ───────────────────────────────────────────────────────────

function PrimaryBtn({
  onClick, disabled, children,
}: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        width: '100%', padding: '14px 20px', borderRadius: 14, border: 'none',
        background: disabled ? 'var(--line)' : 'var(--gold)',
        color: disabled ? 'var(--muted)' : '#fff',
        fontWeight: 800, fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'opacity .15s',
      }}
    >{children}</button>
  );
}

function SecondaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        width: '100%', padding: '12px 20px', borderRadius: 14,
        border: '1px solid var(--line)', background: 'transparent',
        color: 'var(--muted)', fontWeight: 700, fontSize: 14, cursor: 'pointer',
      }}
    >{children}</button>
  );
}

// ─── Screen: not_started / failed ─────────────────────────────────────────────

function StartScreen({ status, configured, starting, onStart }: {
  status: EkycStatus;
  configured: boolean;
  starting: boolean;
  onStart: () => void;
}) {
  const [, go] = useLocation();
  return (
    <KycCard>
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
          background: 'color-mix(in srgb,var(--gold) 12%,transparent)',
          border: '2px solid color-mix(in srgb,var(--gold) 30%,transparent)',
          display: 'grid', placeItems: 'center',
        }}>
          <ShieldCheck size={32} style={{ color: 'var(--gold)' }} />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 10px' }}>
          Complete KYC to Place Orders
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.65, margin: 0 }}>
          Verify your identity securely through DigiLocker. Use the mobile number
          linked with your Aadhaar account. DigiLocker will complete the identity
          verification process securely.
        </p>
      </div>

      {/* Security notice */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px',
        borderRadius: 12,
        background: 'color-mix(in srgb,var(--green) 8%,transparent)',
        border: '1px solid color-mix(in srgb,var(--green) 25%,transparent)',
      }}>
        <AlertCircle size={16} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0, lineHeight: 1.55 }}>
          <strong style={{ color: 'var(--text)' }}>
            TrackMyRMC will not ask you to manually enter or upload your Aadhaar,
            PAN or other identity documents on this screen.
          </strong>
        </p>
      </div>

      {/* Previous attempt failure notice */}
      {status === 'failed' && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px',
          borderRadius: 12,
          background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
        }}>
          <ShieldX size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: 'var(--red)', margin: 0, lineHeight: 1.55 }}>
            Your previous attempt could not be completed. Please try again using
            the mobile number linked with your Aadhaar account.
          </p>
        </div>
      )}

      {/* Service unavailable notice */}
      {!configured && (
        <div style={{
          padding: '10px 14px', borderRadius: 12,
          background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
          fontSize: 13, color: 'var(--red)',
        }}>
          DigiLocker verification is temporarily unavailable. Please try again later.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryBtn onClick={onStart} disabled={starting || !configured}>
          {starting
            ? <><Loader2 size={17} className="spin" /> Opening DigiLocker…</>
            : <><ShieldCheck size={17} /> Complete KYC</>}
        </PrimaryBtn>
        <SecondaryBtn onClick={() => go('/home')}>Back to Home</SecondaryBtn>
      </div>
    </KycCard>
  );
}

// ─── Screen: pending ──────────────────────────────────────────────────────────

function PendingScreen({ checking, onCheck }: { checking: boolean; onCheck: () => void }) {
  const [, go] = useLocation();
  return (
    <KycCard>
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
          background: 'color-mix(in srgb,var(--gold) 12%,transparent)',
          border: '2px solid color-mix(in srgb,var(--gold) 30%,transparent)',
          display: 'grid', placeItems: 'center',
        }}>
          <Clock size={32} style={{ color: 'var(--gold)' }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 10px' }}>
          KYC Verification in Progress
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.65, margin: 0 }}>
          Your DigiLocker verification has been submitted. We are checking the
          latest verification status.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryBtn onClick={onCheck} disabled={checking}>
          {checking
            ? <><Loader2 size={17} className="spin" /> Checking…</>
            : <><RefreshCw size={17} /> Check Status</>}
        </PrimaryBtn>
        <SecondaryBtn onClick={() => go('/home')}>Back to Home</SecondaryBtn>
      </div>
    </KycCard>
  );
}

// ─── Screen: verified ─────────────────────────────────────────────────────────

function VerifiedScreen({ kyc }: { kyc: KycState }) {
  const [, go] = useLocation();
  return (
    <KycCard>
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px',
          background: 'rgba(34,197,94,.12)',
          border: '2px solid rgba(34,197,94,.3)',
          display: 'grid', placeItems: 'center',
        }}>
          <CheckCircle2 size={38} style={{ color: 'var(--green)' }} />
        </div>
        <div style={{
          fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
          color: 'var(--green)', marginBottom: 8, textTransform: 'uppercase',
        }}>
          KYC VERIFIED
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 10px' }}>
          Your identity has been verified successfully.
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.65, margin: 0 }}>
          You can now place concrete orders securely using the TrackMyRMC app.
        </p>
      </div>

      {/* Verification details */}
      <div style={{
        background: 'rgba(34,197,94,.06)',
        border: '1px solid rgba(34,197,94,.2)',
        borderRadius: 14, padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {kyc.verifiedLegalName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={16} style={{ color: 'var(--green)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Verified Legal Name
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                {kyc.verifiedLegalName}
              </div>
            </div>
          </div>
        )}
        {kyc.verifiedAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Verified On
              </div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>{fmtDate(kyc.verifiedAt)}</div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
            Verified through DigiLocker
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryBtn onClick={() => go('/nearby-plants')}>
          Place Order Now <ArrowRight size={16} />
        </PrimaryBtn>
        <SecondaryBtn onClick={() => go('/profile')}>Back to Profile</SecondaryBtn>
      </div>
    </KycCard>
  );
}

// ─── Screen: rejected ─────────────────────────────────────────────────────────

function RejectedScreen() {
  const [, go] = useLocation();
  return (
    <KycCard>
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
          background: 'rgba(245,158,11,.1)',
          border: '2px solid rgba(245,158,11,.3)',
          display: 'grid', placeItems: 'center',
        }}>
          <ShieldAlert size={32} style={{ color: 'var(--orange)' }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '0 0 10px' }}>
          KYC Verification Requires Attention
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.65, margin: 0 }}>
          Your identity verification could not be approved. Please review the
          available information or contact TrackMyRMC support.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryBtn onClick={() => window.open(SUPPORT_WHATSAPP_URL, '_blank', 'noopener')}>
          Contact Support
        </PrimaryBtn>
        <SecondaryBtn onClick={() => go('/home')}>Back to Home</SecondaryBtn>
      </div>
    </KycCard>
  );
}

// ─── Screen: network error ────────────────────────────────────────────────────

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  const [, go] = useLocation();
  return (
    <KycCard>
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 14px',
          background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
          display: 'grid', placeItems: 'center',
        }}>
          <ShieldX size={28} style={{ color: 'var(--red)' }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '0 0 8px' }}>
          Could Not Check KYC Status
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.65, margin: 0 }}>
          We could not check your KYC status right now. Please check your
          internet connection and try again.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryBtn onClick={onRetry}>
          <RefreshCw size={16} /> Try Again
        </PrimaryBtn>
        <SecondaryBtn onClick={() => go('/home')}>Back to Home</SecondaryBtn>
      </div>
    </KycCard>
  );
}

// ─── Screen: role not eligible for personal KYC ───────────────────────────────

function RoleBlockedScreen() {
  const [, go] = useLocation();
  return (
    <KycCard>
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 14px',
          background: 'rgba(212,148,26,.10)', border: '1px solid rgba(212,148,26,.30)',
          display: 'grid', placeItems: 'center',
        }}>
          <ShieldCheck size={28} style={{ color: 'var(--gold)' }} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', margin: '0 0 8px' }}>
          KYC Not Required
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.65, margin: 0 }}>
          Personal identity verification (DigiLocker / Aadhaar eKYC) is only required
          for customer accounts placing orders. Your staff account does not need this step.
        </p>
      </div>
      <SecondaryBtn onClick={() => go('/home')}>Back to Home</SecondaryBtn>
    </KycCard>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KycProfile() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [kyc, setKyc] = useState<KycState | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [roleBlocked, setRoleBlocked] = useState(false);

  // Low-level data fetch — returns a Promise without touching state directly.
  // All callers apply their own setState in .then/.catch chains so state
  // updates never fire synchronously in an effect body (react-hooks/set-state-in-effect).
  const getStatus = useCallback(() => api.get<KycState>('/kyc/status'), []);

  // Mount: load status once via promise chain
  useEffect(() => {
    getStatus()
      .then(data => { setKyc(data); setFetchError(null); setRoleBlocked(false); })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) { setRoleBlocked(true); }
        else { setFetchError(e instanceof Error ? e.message : 'Network error'); }
      })
      .finally(() => setLoading(false));
  }, [getStatus]);

  // Auto-refresh when the user returns from the DigiLocker external browser.
  // Task #22: if the server reports nameUpdateFailed, show a toast so the user
  // knows they should update their display name in Profile settings.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      getStatus()
        .then(data => {
          setKyc(data);
          setFetchError(null);
          if (data.nameUpdateFailed) {
            showToast(
              'Your identity is verified! Please update your display name in Profile settings.',
              'info',
            );
          }
        })
        .catch(() => { /* keep showing the last known state on background refresh */ });
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [getStatus, showToast]);

  // "Check Status" button — explicit manual refresh
  const handleCheck = useCallback(() => {
    setChecking(true);
    getStatus()
      .then(data => { setKyc(data); setFetchError(null); setRoleBlocked(false); })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) { setRoleBlocked(true); }
        else { setFetchError(e instanceof Error ? e.message : 'Network error'); }
      })
      .finally(() => setChecking(false));
  }, [getStatus]);

  // Error screen "Try Again"
  const handleRetry = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    setRoleBlocked(false);
    getStatus()
      .then(data => { setKyc(data); setFetchError(null); setRoleBlocked(false); })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 403) { setRoleBlocked(true); }
        else { setFetchError(e instanceof Error ? e.message : 'Network error'); }
      })
      .finally(() => setLoading(false));
  }, [getStatus]);

  const handleStart = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      const { authUrl } = await api.post<{ authUrl: string }>('/kyc/start', {});
      // Open the DigiLocker auth URL in the system browser.
      // window.open works in both the web app and the Capacitor Android WebView —
      // Android routes _blank to the default browser, so DigiLocker can handle
      // its own OTP/biometric flow outside the app sandbox.
      window.open(authUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : 'Could not start verification. Please try again.',
        'error',
      );
    } finally {
      setStarting(false);
    }
  }, [starting, showToast]);

  // ─── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--muted)' }}>
        <Loader2
          size={28} className="spin"
          style={{ color: 'var(--gold)', display: 'block', margin: '0 auto 14px' }}
        />
        <div style={{ fontSize: 14 }}>Checking your KYC status…</div>
      </div>
    );
  }

  // ─── Role not eligible ───────────────────────────────────────────────────────
  if (roleBlocked) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
        <PageHead status={null} />
        <RoleBlockedScreen />
      </div>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────────────
  if (fetchError || !kyc) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
        <PageHead status={null} />
        <ErrorScreen onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px 32px' }}>
      <PageHead status={kyc.status} />

      {kyc.status === 'verified'  && <VerifiedScreen kyc={kyc} />}
      {kyc.status === 'pending'   && <PendingScreen checking={checking} onCheck={handleCheck} />}
      {kyc.status === 'rejected'  && <RejectedScreen />}
      {(kyc.status === 'not_started' || kyc.status === 'failed') && (
        <StartScreen
          status={kyc.status}
          configured={kyc.configured}
          starting={starting}
          onStart={handleStart}
        />
      )}
    </div>
  );
}

function PageHead({ status }: { status: EkycStatus | null }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ShieldCheck size={22} style={{ color: 'var(--gold)' }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          KYC &amp; Verification
        </h1>
      </div>
      {status && <StatusBadge status={status} />}
    </div>
  );
}
