/**
 * LocationDisclosureModal
 *
 * Google Play Prominent Disclosure requirement: this full-screen dialog must
 * appear BEFORE the Android system location permission popup whenever the app
 * requests ACCESS_FINE_LOCATION or ACCESS_BACKGROUND_LOCATION for the first time.
 *
 * It registers itself with locationDisclosure.ts on mount so that any code that
 * calls requestLocationDisclosure() will trigger this UI.
 */
import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import {
  markLocationDisclosureAccepted,
  registerDisclosureModal,
} from '@/lib/locationDisclosure';

type ResolveFn = (accepted: boolean) => void;

export default function LocationDisclosureModal() {
  const [visible, setVisible] = useState(false);
  const resolveFnRef = useRef<ResolveFn | null>(null);

  useEffect(() => {
    return registerDisclosureModal((resolve) => {
      resolveFnRef.current = resolve;
      setVisible(true);
    });
  }, []);

  const settle = (accepted: boolean) => {
    const fn = resolveFnRef.current;
    resolveFnRef.current = null;
    setVisible(false);
    fn?.(accepted);
  };

  const handleContinue = () => {
    markLocationDisclosureAccepted();
    settle(true);
  };

  const handleDecline = () => {
    settle(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="loc-disc-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'var(--surface, #fff)',
          borderRadius: '20px',
          padding: '32px 24px 24px',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
        }}
      >
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(8,120,95,0.1)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px',
            }}
          >
            <MapPin size={30} color="var(--gold, #08785f)" />
          </div>
          <h2
            id="loc-disc-title"
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 800,
              color: 'var(--ink, #172033)',
              lineHeight: 1.25,
            }}
          >
            Location Permission Required
          </h2>
        </div>

        {/* Body */}
        <p
          style={{
            margin: '0 0 10px',
            fontSize: '15px',
            color: 'var(--ink, #172033)',
            fontWeight: 600,
          }}
        >
          TrackMyRMC uses your location to:
        </p>
        <ul
          style={{
            margin: '0 0 16px',
            paddingLeft: '20px',
            fontSize: '14px',
            color: 'var(--muted, #526078)',
            lineHeight: 1.6,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <li>Show nearby RMC plants based on your position</li>
          <li>Track driver deliveries during active orders</li>
          <li>Provide live order tracking for customers</li>
          <li>Improve delivery accuracy and route planning</li>
        </ul>

        <div
          style={{
            background: 'var(--chip-bg, #f0faf8)',
            border: '1px solid rgba(8,120,95,0.15)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '16px',
            fontSize: '13px',
            color: 'var(--muted, #526078)',
            lineHeight: 1.55,
          }}
        >
          <p style={{ margin: '0 0 6px' }}>
            Your location is only collected while these features are in use.
          </p>
          <p style={{ margin: '0 0 6px' }}>
            <strong style={{ color: 'var(--ink, #172033)' }}>
              Background location
            </strong>{' '}
            is used only during an active delivery when driver tracking is enabled.
          </p>
          <p style={{ margin: 0 }}>
            Your location is <strong style={{ color: 'var(--ink, #172033)' }}>never sold or shared</strong> for advertising.
          </p>
        </div>

        {/* Buttons */}
        <button
          onClick={handleContinue}
          style={{
            width: '100%',
            minHeight: '48px',
            border: 'none',
            borderRadius: '12px',
            background: 'var(--gold, #08785f)',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
            marginBottom: '10px',
            letterSpacing: '0.02em',
          }}
        >
          Continue
        </button>
        <button
          onClick={handleDecline}
          style={{
            width: '100%',
            minHeight: '44px',
            border: '1.5px solid var(--border, #dce4e8)',
            borderRadius: '12px',
            background: 'transparent',
            color: 'var(--muted, #526078)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Not Now
        </button>
      </div>
    </div>
  );
}
