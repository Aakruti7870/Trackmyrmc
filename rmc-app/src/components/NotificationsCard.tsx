import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSupported,
  type PushStatus,
} from '@/lib/push';
import { useToast } from '@/lib/toast';

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 18,
  padding: '28px 30px',
  boxShadow: '0 8px 32px rgba(var(--shadow-rgb),.35)',
};

// Opt-in control for browser/PWA push notifications. These pop up on the user's
// device for order & delivery updates even when the app is closed, in addition
// to email. Push only works in the installed/published app (the service worker
// is disabled in dev), so the control degrades gracefully when unavailable.
export default function NotificationsCard() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<PushStatus>('unsubscribed');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getPushStatus().then((s) => {
      if (!cancelled) {
        setStatus(s);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const supported = isPushSupported();
  const subscribed = status === 'subscribed';

  const handleToggle = async () => {
    setBusy(true);
    try {
      if (subscribed) {
        const next = await unsubscribeFromPush();
        setStatus(next);
        showToast('Push notifications turned off', 'success');
      } else {
        const next = await subscribeToPush();
        setStatus(next);
        if (next === 'subscribed') {
          showToast('Push notifications enabled', 'success');
        } else if (next === 'denied') {
          showToast('Notifications are blocked in your browser settings', 'error');
        } else if (next === 'unavailable') {
          showToast('Push is only available in the installed or published app', 'error');
        } else if (next === 'unsupported') {
          showToast('This browser does not support push notifications', 'error');
        }
      }
    } catch {
      showToast('Could not update notification settings', 'error');
    } finally {
      setBusy(false);
    }
  };

  let hint = 'Get order and delivery alerts on this device — even when the app is closed.';
  if (status === 'denied') {
    hint = 'Notifications are blocked. Enable them for this site in your browser settings, then try again.';
  } else if (!supported) {
    hint = 'This browser does not support push notifications. Email alerts are still sent.';
  } else if (subscribed) {
    hint = 'You will receive order and delivery alerts on this device, even when the app is closed.';
  }

  const accent = subscribed ? 'var(--green)' : 'var(--gold)';

  return (
    <div style={{ ...card, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: `color-mix(in srgb, ${accent} 13%, transparent)`,
            border: `1px solid color-mix(in srgb, ${accent} 27%, transparent)`,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {subscribed ? (
            <Bell size={15} style={{ color: accent }} />
          ) : (
            <BellOff size={15} style={{ color: accent }} />
          )}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Push Notifications</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Pop-up alerts on this device, even when the app is not open
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 18px' }}>
        {hint}
      </p>

      <button
        type="button"
        onClick={handleToggle}
        disabled={busy || !supported || status === 'denied' || !loaded}
        style={{
          padding: '11px 22px',
          borderRadius: 10,
          background: subscribed
            ? 'transparent'
            : 'linear-gradient(135deg,var(--gold),#eab308)',
          border: subscribed ? '1px solid var(--line)' : 'none',
          cursor: busy || !supported || status === 'denied' ? 'not-allowed' : 'pointer',
          color: subscribed ? 'var(--text)' : '#08111f',
          fontWeight: 800,
          fontSize: 14,
          opacity: !supported || status === 'denied' ? 0.5 : 1,
          transition: 'opacity .15s',
        }}
      >
        {busy
          ? 'Working…'
          : subscribed
            ? 'Turn off notifications'
            : 'Enable notifications'}
      </button>
    </div>
  );
}
