import { useState, useEffect, useCallback, useRef } from 'react';
import {
  api, type FreshnessResponse, type FreshnessLoad, type FreshnessConfig,
  type FreshnessSettings, type FreshnessLevel, ApiError,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { useSSE } from '@/lib/useSSE';
import { Timer, MapPin, Truck, AlertTriangle, CheckCircle2, Save, Gauge, Navigation } from 'lucide-react';

const LEVEL_META: Record<FreshnessLevel, { color: string; label: string }> = {
  expired:  { color: 'var(--red)',  label: 'Expired' },
  critical: { color: '#fb923c',     label: 'Critical' },
  warning:  { color: 'var(--gold)', label: 'Running low' },
  fresh:    { color: 'var(--green)', label: 'Fresh' },
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(15,28,54,.95),rgba(8,17,31,.95))',
      border: '1px solid var(--line)', borderRadius: 16, padding: 20,
      boxShadow: '0 8px 32px rgba(var(--shadow-rgb),.3)', ...style,
    }}>{children}</div>
  );
}

// Live remaining minutes from the server-issued pour-by instant, ticking down
// client-side between refetches so countdowns stay accurate to the second.
function liveRemaining(pourByIso: string | null, now: number): number | null {
  if (!pourByIso) return null;
  const t = new Date(pourByIso).getTime();
  if (Number.isNaN(t)) return null;
  return (t - now) / 60000;
}

function liveLevel(remainingMin: number | null, willMakeIt: boolean | null, cfg: FreshnessConfig): FreshnessLevel {
  if (remainingMin == null) return 'fresh';
  if (remainingMin <= 0) return 'expired';
  if (remainingMin <= cfg.warnMin || willMakeIt === false) return 'critical';
  if (remainingMin <= cfg.warnMin * 2) return 'warning';
  return 'fresh';
}

function fmtMin(min: number | null): string {
  if (min == null) return '—';
  const neg = min < 0;
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = Math.floor(abs % 60);
  const s = Math.floor((abs * 60) % 60);
  const body = h > 0 ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2, '0')}s`;
  return neg ? `-${body}` : body;
}

function fmtClock(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function LoadCard({ load, now, cfg }: { load: FreshnessLoad; now: number; cfg: FreshnessConfig }) {
  const remaining = liveRemaining(load.pourByIso, now);
  // ETA shrinks as the truck nears site only on refetch; recompute "will it make
  // it?" against the live remaining clock so the warning flips in real time.
  const willMakeIt = load.etaMin == null ? null : load.etaMin <= (remaining ?? 0);
  const level = liveLevel(remaining, willMakeIt, cfg);
  const meta = LEVEL_META[level];
  const pct = remaining == null ? 0 : Math.max(0, Math.min(100, (remaining / cfg.workingLifeMin) * 100));

  return (
    <Card style={{ padding: 16, borderColor: `color-mix(in srgb, ${meta.color} 45%, transparent)` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 800, color: 'var(--text)', fontSize: 15 }}>{load.challanNo}</span>
            <span style={{ background: 'rgba(56,189,248,.12)', color: 'var(--blue)', padding: '1px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{load.grade}</span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>{load.clientName ?? '—'} · {parseFloat(load.quantity).toFixed(1)} m³</div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
          color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${meta.color} 35%, transparent)`,
        }}>{meta.label}</span>
      </div>

      {/* Countdown */}
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: meta.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.5px' }}>
          {level === 'expired' ? 'OVERDUE' : fmtMin(remaining)}
        </span>
        {level !== 'expired' && <span style={{ color: 'var(--muted)', fontSize: 12 }}>until pour-by {fmtClock(load.pourByIso)}</span>}
      </div>

      {/* Life bar */}
      <div style={{ marginTop: 10, height: 7, borderRadius: 99, background: 'var(--chip-bg)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: meta.color, transition: 'width .9s linear' }} />
      </div>

      {/* ETA vs remaining */}
      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: 'var(--chip-bg)', borderRadius: 9, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'flex', alignItems: 'center', gap: 4 }}><Navigation size={11} /> ETA to site</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
            {load.hasLivePosition ? fmtMin(load.etaMin) : 'No GPS yet'}
          </div>
        </div>
        <div style={{ background: 'var(--chip-bg)', borderRadius: 9, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} /> Distance</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
            {load.distanceM == null ? '—' : load.distanceM >= 1000 ? `${(load.distanceM / 1000).toFixed(1)} km` : `${load.distanceM} m`}
          </div>
        </div>
      </div>

      {willMakeIt === false && level !== 'expired' && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: '#fb923c', fontSize: 12, fontWeight: 700 }}>
          <AlertTriangle size={13} /> ETA exceeds remaining life — may not reach site in time
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 11.5, flexWrap: 'wrap' }}>
        {load.vehicleNo && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Truck size={11} /> {load.vehicleNo}</span>}
        {load.siteName && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={11} /> {load.siteName}</span>}
        <span>Dispatched {fmtClock(load.dispatchTime)}</span>
      </div>
    </Card>
  );
}

function SettingsPanel({ onSaved }: { onSaved: (cfg: FreshnessConfig) => void }) {
  const { showToast } = useToast();
  const [form, setForm] = useState<{ workingLifeMin: string; warnMin: string; avgSpeedKmh: string }>({ workingLifeMin: '', warnMin: '', avgSpeedKmh: '' });
  const [defaults, setDefaults] = useState<FreshnessConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<FreshnessSettings>('/admin/freshness-settings')
      .then(s => {
        setForm({ workingLifeMin: String(s.workingLifeMin), warnMin: String(s.warnMin), avgSpeedKmh: String(s.avgSpeedKmh) });
        setDefaults(s.defaults);
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await api.post<FreshnessSettings>('/admin/freshness-settings', form);
      onSaved({ workingLifeMin: res.workingLifeMin, warnMin: res.warnMin, avgSpeedKmh: res.avgSpeedKmh });
      showToast('Freshness settings saved.', 'success');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not save settings.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof typeof form, label: string, hint: string) => (
    <div style={{ flex: 1, minWidth: 150 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</label>
      <input
        type="number" min="1" value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={defaults ? String(defaults[key]) : ''}
        style={{ width: '100%', marginTop: 5, padding: '8px 11px', borderRadius: 9, boxSizing: 'border-box', background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13 }}
      />
      <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>{hint}</div>
    </div>
  );

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Gauge size={16} style={{ color: 'var(--gold)' }} />
        <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>Freshness thresholds</span>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {field('workingLifeMin', 'Working life (min)', 'Usable life of a load from dispatch')}
        {field('warnMin', 'Warn at (min left)', 'Flag a load below this remaining')}
        {field('avgSpeedKmh', 'Avg speed (km/h)', 'Fallback when no GPS speed')}
        <button onClick={save} disabled={saving} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, cursor: saving ? 'wait' : 'pointer',
          background: 'var(--gold)', color: '#111827', border: 'none', padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 800, opacity: saving ? 0.6 : 1,
        }}><Save size={14} /> Save</button>
      </div>
    </Card>
  );
}

export default function FreshnessGuard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'authority';
  const { subscribe } = useSSE();
  const [data, setData] = useState<FreshnessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [cfgOverride, setCfgOverride] = useState<FreshnessConfig | null>(null);

  // Promise-chained (not async) so the effect that calls it never triggers a
  // synchronous setState — state only updates in the deferred .then/.finally.
  const load = useCallback(() => {
    api.get<FreshnessResponse>('/positions/freshness')
      .then(res => { setData(res); setError(''); })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load freshness data.'))
      .finally(() => setLoading(false));
  }, []);

  // Debounce bursty position updates into a single refetch.
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) return;
    refetchTimer.current = setTimeout(() => { refetchTimer.current = null; load(); }, 1500);
  }, [load]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 30000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const unsubPos = subscribe('vehicle.position', scheduleRefetch);
    const unsubChallan = subscribe('challan.updated', scheduleRefetch);
    const unsubFresh = subscribe('challan.freshness', scheduleRefetch);
    const unsubReconnect = subscribe('reconnect', load);
    return () => {
      clearInterval(poll); clearInterval(tick);
      unsubPos(); unsubChallan(); unsubFresh(); unsubReconnect();
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    };
  }, [load, scheduleRefetch, subscribe]);

  const cfg = cfgOverride ?? data?.config ?? { workingLifeMin: 120, warnMin: 30, avgSpeedKmh: 25 };
  const loads = data?.loads ?? [];

  // Live re-rank by the ticking remaining clock so the most urgent float to top.
  const enriched = loads.map(l => {
    const remaining = liveRemaining(l.pourByIso, now);
    const willMakeIt = l.etaMin == null ? null : l.etaMin <= (remaining ?? 0);
    return { load: l, level: liveLevel(remaining, willMakeIt, cfg), remaining };
  });
  const rank: Record<FreshnessLevel, number> = { expired: 0, critical: 1, warning: 2, fresh: 3 };
  enriched.sort((a, b) => rank[a.level] - rank[b.level] || (a.remaining ?? Infinity) - (b.remaining ?? Infinity));

  const counts = enriched.reduce<Record<FreshnessLevel, number>>((acc, e) => { acc[e.level] += 1; return acc; }, { expired: 0, critical: 0, warning: 0, fresh: 0 });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-.3px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Timer size={24} style={{ color: 'var(--gold)' }} /> Concrete Freshness Guard
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '6px 0 0' }}>
          Live pour-by countdown for every in-transit load, with GPS arrival prediction. Loads turn critical when they may expire before reaching site.
        </p>
      </div>

      {isAdmin && <SettingsPanel onSaved={setCfgOverride} />}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 18 }}>
        {(['expired', 'critical', 'warning', 'fresh'] as FreshnessLevel[]).map(lvl => (
          <Card key={lvl} style={{ padding: 14, borderColor: `color-mix(in srgb, ${LEVEL_META[lvl].color} 35%, transparent)` }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>{LEVEL_META[lvl].label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: LEVEL_META[lvl].color, marginTop: 4 }}>{counts[lvl]}</div>
          </Card>
        ))}
      </div>

      {loading ? (
        <Card><div style={{ textAlign: 'center', padding: 50, color: 'var(--muted)' }}>Loading live loads…</div></Card>
      ) : error ? (
        <Card><div style={{ textAlign: 'center', padding: 40, color: 'var(--red)' }}>{error}</div></Card>
      ) : enriched.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 50, color: 'var(--muted)' }}>
            <CheckCircle2 size={34} style={{ color: 'var(--green)', display: 'block', margin: '0 auto 12px', opacity: .8 }} />
            No loads in transit right now. Dispatched challans will appear here with a live freshness countdown.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))', gap: 14 }}>
          {enriched.map(e => <LoadCard key={e.load.challanId} load={e.load} now={now} cfg={cfg} />)}
        </div>
      )}
    </div>
  );
}
