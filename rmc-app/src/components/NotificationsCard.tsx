import { useEffect, useState } from 'react';
import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react';
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSupported,
  type PushStatus,
} from '@/lib/push';
import {
  isAlertSoundEnabled,
  setAlertSoundEnabled,
  playAlertSound,
  unlockAlertSound,
  getAlertSoundChoice,
  setAlertSoundChoice,
  ALERT_SOUND_CHOICES,
  type AlertSoundChoice,
} from '@/lib/alertSound';
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
  const [soundOn, setSoundOn] = useState(() => isAlertSoundEnabled());
  const [soundChoice, setSoundChoice] = useState<AlertSoundChoice>(() => getAlertSoundChoice());

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setAlertSoundEnabled(next);
    if (next) {
      // This runs inside a click handler, so it doubles as the gesture that
      // unlocks audio, and previews the chime so the user hears the change.
      unlockAlertSound();
      playAlertSound('success', soundChoice);
    }
  };

  const pickSound = (choice: AlertSoundChoice) => {
    setSoundChoice(choice);
    setAlertSoundChoice(choice);
    // Runs inside a click, so it can unlock audio and preview the picked sound.
    unlockAlertSound();
    if (soundOn) playAlertSound('success', choice);
  };

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
            : 'var(--gold)',
          border: subscribed ? '1px solid var(--line)' : 'none',
          cursor: busy || !supported || status === 'denied' ? 'not-allowed' : 'pointer',
          color: subscribed ? 'var(--text)' : '#ffffff',
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

      {/* Alert sounds — in-app chime that plays when a new alert arrives */}
      <div
        style={{
          borderTop: '1px solid var(--line)',
          marginTop: 22,
          paddingTop: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: `color-mix(in srgb, ${soundOn ? 'var(--green)' : 'var(--gold)'} 13%, transparent)`,
              border: `1px solid color-mix(in srgb, ${soundOn ? 'var(--green)' : 'var(--gold)'} 27%, transparent)`,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            {soundOn ? (
              <Volume2 size={15} style={{ color: 'var(--green)' }} />
            ) : (
              <VolumeX size={15} style={{ color: 'var(--gold)' }} />
            )}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Alert Sounds</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Play a chime when a new alert arrives while the app is open
            </div>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={soundOn}
          aria-label="Toggle alert sounds"
          onClick={toggleSound}
          style={{
            position: 'relative',
            width: 46,
            height: 26,
            flexShrink: 0,
            borderRadius: 999,
            border: '1px solid var(--line)',
            background: soundOn ? 'var(--green)' : 'var(--menu-bg)',
            cursor: 'pointer',
            transition: 'background .15s',
            padding: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: soundOn ? 22 : 2,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,.3)',
              transition: 'left .15s',
            }}
          />
        </button>
      </div>

      {/* Sound picker — choose which chime plays; tapping one previews it. */}
      {soundOn && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>
            Notification sound — tap to preview
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALERT_SOUND_CHOICES.map((c) => {
              const selected = c.value === soundChoice;
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pickSound(c.value)}
                  style={{
                    flex: '1 1 140px',
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    background: selected
                      ? 'color-mix(in srgb, var(--green) 14%, transparent)'
                      : 'var(--menu-bg)',
                    border: `1px solid ${selected ? 'var(--green)' : 'var(--line)'}`,
                    transition: 'background .15s, border-color .15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Volume2
                      size={14}
                      style={{ color: selected ? 'var(--green)' : 'var(--muted)', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{c.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
