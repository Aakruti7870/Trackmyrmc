import { useState, useEffect } from 'react';
import { Timer, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { FreshnessConfig, FreshnessLevel } from '@/lib/api';

// Mirrors the server's freshness classification (server/src/lib/freshness.ts)
// so a client/driver sees the same level the plant does, using only the
// dispatch time and the shared working-life config — no plant-wide data.
function classify(remainingMin: number, config: FreshnessConfig): FreshnessLevel {
  if (remainingMin <= 0) return 'expired';
  if (remainingMin <= config.warnMin) return 'critical';
  if (remainingMin <= config.warnMin * 2) return 'warning';
  return 'fresh';
}

const LEVEL_STYLES: Record<FreshnessLevel, { color: string; label: string }> = {
  fresh:    { color: 'var(--green)', label: 'Fresh' },
  warning:  { color: 'var(--gold)',  label: 'Running low' },
  critical: { color: 'var(--red)',   label: 'Pour now' },
  expired:  { color: 'var(--red)',   label: 'Expired' },
};

function fmtRemaining(min: number): string {
  if (min <= 0) return 'past pour-by';
  if (min < 60) return `${Math.ceil(min)}m left`;
  const h = Math.floor(min / 60);
  const m = Math.ceil(min % 60);
  return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
}

function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  dispatchTime?: string | null;
  config: FreshnessConfig | null;
  variant?: 'banner' | 'chip';
}

// Self-ticking pour-by countdown for a single in-transit load. Renders nothing
// until the load has actually been dispatched (that's when the concrete clock
// starts) and the config has loaded.
export default function FreshnessCountdown({ dispatchTime, config, variant = 'banner' }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!dispatchTime || !config) return null;
  const dispatchMs = new Date(dispatchTime).getTime();
  if (!Number.isFinite(dispatchMs)) return null;

  const elapsedMin = (now - dispatchMs) / 60000;
  const remainingMin = config.workingLifeMin - elapsedMin;
  const pourByMs = dispatchMs + config.workingLifeMin * 60000;
  const level = classify(remainingMin, config);
  const s = LEVEL_STYLES[level];
  const Icon = level === 'fresh' ? CheckCircle2 : level === 'warning' ? Timer : AlertTriangle;

  if (variant === 'chip') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20,
        fontSize: 11, fontWeight: 700, color: s.color,
        background: `color-mix(in srgb, ${s.color} 13%, transparent)`,
        border: `1px solid color-mix(in srgb, ${s.color} 28%, transparent)`,
      }}>
        <Icon size={11} />
        {fmtRemaining(remainingMin)}
      </span>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 10, marginBottom: 12,
      background: `color-mix(in srgb, ${s.color} 11%, transparent)`,
      border: `1px solid color-mix(in srgb, ${s.color} 28%, transparent)`,
    }}>
      <Icon size={16} style={{ color: s.color, flexShrink: 0 }} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: s.color }}>
          {s.label} — {fmtRemaining(remainingMin)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          Pour by {fmtClock(pourByMs)} · {config.workingLifeMin} min working life
        </span>
      </div>
    </div>
  );
}
