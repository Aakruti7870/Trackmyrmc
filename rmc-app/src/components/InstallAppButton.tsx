import { useEffect, useState } from 'react';
import { Download, X, Share, Plus, MoreVertical } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mm = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return mm || iosStandalone;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function InstallAppButton({ variant = 'primary' }: { variant?: 'primary' | 'sidebar' }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      setShowHelp(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setDeferred(null);
      return;
    }
    setShowHelp(true);
  }

  const ios = isIos();

  const buttonStyle: React.CSSProperties = variant === 'sidebar'
    ? {
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
        background: 'color-mix(in srgb, var(--gold) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
        color: 'var(--gold)', fontSize: 12.5, fontWeight: 700, textAlign: 'left',
      }
    : {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
        padding: '12px 18px', borderRadius: 12, cursor: 'pointer',
        background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
        border: 'none', color: '#111', fontSize: 14, fontWeight: 800,
        boxShadow: '0 10px 24px color-mix(in srgb, var(--gold) 28%, transparent)',
      };

  return (
    <>
      <button type="button" onClick={handleClick} style={buttonStyle}>
        <Download size={variant === 'sidebar' ? 14 : 16} />
        <span style={{ flex: variant === 'sidebar' ? 1 : 'initial' }}>Install App</span>
      </button>

      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(5,9,20,.66)', backdropFilter: 'blur(3px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 380,
              background: 'linear-gradient(135deg, var(--surface), var(--panel2))',
              border: '1px solid var(--line)', borderRadius: 18, padding: 22,
              color: 'var(--text)', fontFamily: 'var(--font-app)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <strong style={{ fontSize: 16 }}>Install CONCRETE KING</strong>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              Add CONCRETE KING to your home screen for one-tap access, full-screen mode and faster loading.
            </p>

            {ios ? (
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.9 }}>
                <li>Tap the <Share size={13} style={{ verticalAlign: 'middle' }} /> <strong>Share</strong> button in Safari.</li>
                <li>Choose <strong>Add to Home Screen</strong> <Plus size={13} style={{ verticalAlign: 'middle' }} />.</li>
                <li>Tap <strong>Add</strong> — done!</li>
              </ol>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.9 }}>
                <li>Open your browser menu <MoreVertical size={13} style={{ verticalAlign: 'middle' }} /> (top-right).</li>
                <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                <li>Confirm — the CONCRETE KING icon appears on your home screen.</li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}
