import { useEffect, useState } from 'react';
import { Download, X, Share, Plus, MoreVertical } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'ck-install-banner-dismissed';

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

export default function InstallAppBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [showHelp, setShowHelp] = useState(false);
  const ios = isIos();

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setDismissed(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') dismiss();
      setDeferred(null);
      return;
    }
    setShowHelp(true);
  }

  // Only surface the banner when installation is actually possible:
  // a native prompt is queued, or iOS (which needs manual Add-to-Home-Screen).
  const canInstall = deferred !== null || ios;
  if (dismissed || isStandalone() || !canInstall) return null;

  return (
    <>
      <div role="region" aria-label="Install app" style={{
        position: 'fixed', left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        zIndex: 60, margin: '0 auto', maxWidth: 560,
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16,
        background: 'var(--menu-bg)',
        border: '1px solid var(--line)', boxShadow: '0 18px 44px -18px rgba(var(--shadow-rgb),.45)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text)' }}>Install TrackMyRMC</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.4 }}>
            One-tap access, full-screen, faster loading.
          </div>
        </div>
        <button type="button" onClick={install} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 11,
          fontWeight: 800, fontSize: 13.5, cursor: 'pointer', border: 'none', flexShrink: 0,
          background: 'var(--gold)', color: '#ffffff', fontFamily: 'inherit',
        }}>
          <Download size={15} /> Install
        </button>
        <button type="button" onClick={dismiss} aria-label="Dismiss install banner" style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, flexShrink: 0,
        }}>
          <X size={18} />
        </button>
      </div>

      {showHelp && (
        <div onClick={() => setShowHelp(false)} style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(5,9,20,.66)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: 380, background: 'var(--surface)',
            border: '1px solid var(--line)', borderRadius: 18, padding: 22, color: 'var(--text)', fontFamily: 'inherit',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <strong style={{ fontSize: 16 }}>Install CONCRETE KING</strong>
              <button type="button" onClick={() => setShowHelp(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}>
                <X size={18} />
              </button>
            </div>
            {ios ? (
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.9 }}>
                <li>Tap the <Share size={13} style={{ verticalAlign: 'middle' }} /> <strong>Share</strong> button in Safari.</li>
                <li>Choose <strong>Add to Home Screen</strong> <Plus size={13} style={{ verticalAlign: 'middle' }} />.</li>
                <li>Tap <strong>Add</strong> — done!</li>
              </ol>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.9 }}>
                <li>Open your browser menu <MoreVertical size={13} style={{ verticalAlign: 'middle' }} /> (top-right).</li>
                <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                <li>Confirm — the icon appears on your home screen.</li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}
