/**
 * Widget Settings — /widget-settings
 *
 * Lets authenticated users configure their Android home-screen widget:
 * enable/disable, compact vs detailed mode, show/hide specific fields,
 * manual refresh, and reset.
 *
 * Only meaningful on Android (Capacitor). On web/PWA, a "not available"
 * notice is shown instead.
 */

import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  liveWidgetAvailable,
  updateLiveWidget,
  setWidgetMode,
} from '@/lib/liveWidget';
import {
  LayoutGrid, Smartphone, RefreshCw, RotateCcw,
  ChevronLeft, Bell, Eye, EyeOff,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type WidgetPrefs = {
  enabled: boolean;
  mode: 'compact' | 'detailed';
  liveNotification: boolean;
  showCustomerName: boolean;
  showVehicleNumber: boolean;
  showQuantity: boolean;
};

const DEFAULT_PREFS: WidgetPrefs = {
  enabled: true,
  mode: 'detailed',
  liveNotification: true,
  showCustomerName: true,
  showVehicleNumber: true,
  showQuantity: true,
};

const STORAGE_KEY = 'trackmyrmc_widget_prefs';

function loadPrefs(): WidgetPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_PREFS };
}

function savePrefs(prefs: WidgetPrefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); }
  catch { /* ignore */ }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WidgetSettings() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [, go] = useLocation();
  const [prefs, setPrefs] = useState<WidgetPrefs>(loadPrefs);
  const [refreshing, setRefreshing] = useState(false);

  const isAndroid = liveWidgetAvailable();
  const role = user?.role ?? 'client';

  const update = useCallback((patch: Partial<WidgetPrefs>) => {
    setPrefs(p => {
      const next = { ...p, ...patch };
      savePrefs(next);
      if (patch.mode) {
        setWidgetMode(patch.mode).catch(() => null);
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    if (!isAndroid) return;
    setRefreshing(true);
    // Trigger a native widget refresh by pushing current state.
    updateLiveWidget({
      role: role as 'driver' | 'customer' | 'client' | 'staff' | 'admin' | 'plant_owner' | 'authority',
      title: 'Refreshing…',
      line1: 'Fetching latest data',
    })
      .catch(() => null)
      .finally(() => {
        setRefreshing(false);
        showToast('Widget refresh triggered', 'success');
      });
  }, [isAndroid, role, showToast]);

  const handleReset = useCallback(() => {
    savePrefs(DEFAULT_PREFS);
    setPrefs(DEFAULT_PREFS);
    if (isAndroid) {
      setWidgetMode('detailed').catch(() => null);
      showToast('Widget reset to defaults', 'success');
    }
  }, [isAndroid, showToast]);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10,
      }}>
        <button
          onClick={() => go('/profile')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>
        <LayoutGrid size={20} style={{ color: 'var(--gold)' }} />
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
          Widget Settings
        </h1>
      </div>

      {!isAndroid ? (
        /* Web/PWA — widgets only available on Android native app */
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          <Smartphone size={40} style={{ marginBottom: 16, opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: 15 }}>
            Home-screen widgets are only available on the Android app.
          </p>
          <p style={{ marginTop: 8, fontSize: 13 }}>
            Install CONCRETE KING from Google Play to add a widget to your home screen.
          </p>
        </div>
      ) : (
        <div style={{ padding: '20px 20px 0' }}>
          {/* Enable widget */}
          <Section title="Widget">
            <Toggle
              label="Enable widget"
              description="Show live data on your home screen"
              value={prefs.enabled}
              onChange={v => update({ enabled: v })}
            />
            <Toggle
              label="Live notification fallback"
              description="Show a persistent notification when the widget cannot refresh"
              value={prefs.liveNotification}
              onChange={v => update({ liveNotification: v })}
              icon={<Bell size={15} />}
            />
          </Section>

          {/* Display mode */}
          <Section title="Display">
            <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
              {(['compact', 'detailed'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => update({ mode: m })}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                    cursor: 'pointer', fontWeight: 600, fontSize: 13,
                    background: prefs.mode === m ? 'var(--gold)' : 'var(--chip-bg)',
                    color: prefs.mode === m ? '#000' : 'var(--muted)',
                    transition: 'all .15s',
                  }}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
              Compact shows a minimal 2×1 badge. Detailed uses the full widget size.
            </p>
          </Section>

          {/* Field visibility — role-aware */}
          <Section title="Show / hide fields">
            {(role === 'driver') && (
              <Toggle
                label="Customer name"
                description="Show the customer's company name on the widget"
                value={prefs.showCustomerName}
                onChange={v => update({ showCustomerName: v })}
                icon={prefs.showCustomerName ? <Eye size={15} /> : <EyeOff size={15} />}
              />
            )}
            <Toggle
              label="Vehicle number"
              description="Show the assigned vehicle registration"
              value={prefs.showVehicleNumber}
              onChange={v => update({ showVehicleNumber: v })}
              icon={prefs.showVehicleNumber ? <Eye size={15} /> : <EyeOff size={15} />}
            />
            <Toggle
              label="Quantity (m³)"
              description="Show the concrete quantity"
              value={prefs.showQuantity}
              onChange={v => update({ showQuantity: v })}
              icon={prefs.showQuantity ? <Eye size={15} /> : <EyeOff size={15} />}
            />
          </Section>

          {/* Actions */}
          <Section title="Actions">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={actionBtnStyle}
            >
              <RefreshCw size={15} style={{ opacity: refreshing ? 0.5 : 1 }} />
              {refreshing ? 'Refreshing…' : 'Refresh now'}
            </button>
            <button onClick={handleReset} style={{ ...actionBtnStyle, marginTop: 10, color: '#EF4444' }}>
              <RotateCcw size={15} />
              Reset widget to defaults
            </button>
          </Section>

          {/* Security notice */}
          <div style={{
            margin: '24px 0', padding: '14px 16px', borderRadius: 12,
            background: 'var(--chip-bg)', border: '1px solid var(--border)',
            fontSize: 12, color: 'var(--muted)', lineHeight: 1.5,
          }}>
            <strong style={{ color: 'var(--text)' }}>Security</strong>
            <br />
            All widget data is cleared automatically when you log out. Suspended accounts
            stop receiving widget updates immediately. Every widget tap re-validates your
            identity, role, and data access before showing order or delivery details.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{
        margin: '0 0 12px', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--muted)',
      }}>
        {title}
      </h2>
      <div style={{
        background: 'var(--card)', borderRadius: 14,
        border: '1px solid var(--border)', overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

function Toggle({
  label, description, value, onChange, icon,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px', borderBottom: '1px solid var(--border)',
    }}>
      {icon && (
        <span style={{ color: 'var(--gold)', flexShrink: 0 }}>{icon}</span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{description}</div>
        )}
      </div>
      <button
        onClick={() => onChange(!value)}
        aria-checked={value}
        role="switch"
        style={{
          flexShrink: 0, width: 44, height: 24, borderRadius: 12, border: 'none',
          cursor: 'pointer', padding: 2,
          background: value ? 'var(--gold)' : 'var(--border)',
          transition: 'background .2s',
          display: 'flex', alignItems: 'center',
          justifyContent: value ? 'flex-end' : 'flex-start',
        }}
      >
        <span style={{
          width: 20, height: 20, borderRadius: 10, background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.3)',
        }} />
      </button>
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 8, padding: '13px 0', border: 'none', cursor: 'pointer',
  background: 'none', fontSize: 14, fontWeight: 600, color: 'var(--text)',
  borderBottom: '1px solid var(--border)',
};
