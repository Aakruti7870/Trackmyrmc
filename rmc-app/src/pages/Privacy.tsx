import { useEffect } from 'react';

const PRIVACY_POLICY_URL = 'https://trackmyrmc.com/privacy_policy';

export default function Privacy() {
  useEffect(() => {
    window.location.replace(PRIVACY_POLICY_URL);
  }, []);

  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
      background: 'var(--bg)',
      color: 'var(--text)',
      textAlign: 'center',
    }}>
      <section style={{
        width: 'min(460px, 100%)',
        padding: 28,
        borderRadius: 18,
        background: 'var(--panel)',
        border: '1px solid var(--line)',
      }}>
        <img
          src="/privacy_policy/trackmyrmc-policy-icon.svg"
          alt="TrackMyRMC"
          width={64}
          height={64}
          style={{ borderRadius: 16 }}
        />
        <h1 style={{ margin: '16px 0 8px', fontSize: 26 }}>TrackMyRMC Privacy Policy</h1>
        <p style={{ margin: '0 0 18px', color: 'var(--muted)', lineHeight: 1.6 }}>
          Opening the official TrackMyRMC Privacy Policy.
        </p>
        <a
          href={PRIVACY_POLICY_URL}
          style={{
            display: 'inline-flex',
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 18px',
            borderRadius: 10,
            background: 'var(--gold)',
            color: '#172033',
            fontWeight: 800,
            textDecoration: 'none',
          }}
        >
          Open Privacy Policy
        </a>
      </section>
    </main>
  );
}
