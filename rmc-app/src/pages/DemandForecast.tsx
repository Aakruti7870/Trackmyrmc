import { useState, useEffect, useCallback } from 'react';
import { api, type ForecastResult, type GradeForecast, type Confidence } from '@/lib/api';
import { TrendingUp, Truck, Layers, CalendarDays, Info, Repeat, ClipboardList } from 'lucide-react';

const CONF_META: Record<Confidence, { color: string; label: string }> = {
  high:   { color: 'var(--green)', label: 'High confidence' },
  medium: { color: 'var(--gold)',  label: 'Medium confidence' },
  low:    { color: '#fb923c',      label: 'Low confidence' },
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

// UTC-based so the default "tomorrow" matches the backend's UTC date semantics
// (the forecast endpoint defaults and groups history by UTC date).
function tomorrowStr(): string {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

function Stat({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: color ?? 'var(--text)', marginTop: 6, letterSpacing: '-.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

function GradeRow({ g, max }: { g: GradeForecast; max: number }) {
  const conf = CONF_META[g.confidence];
  const pct = max > 0 ? (g.predictedQty / max) * 100 : 0;
  const bookedPct = g.predictedQty > 0 ? Math.min(100, ((g.bookedQty + g.recurringQty) / g.predictedQty) * 100) : 0;
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid rgba(38,52,73,.5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ background: 'rgba(56,189,248,.12)', color: 'var(--blue)', padding: '2px 11px', borderRadius: 7, fontSize: 13, fontWeight: 800 }}>{g.grade}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: conf.color }}>{conf.label}</span>
          <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{g.sampleDays} day{g.sampleDays === 1 ? '' : 's'} of history</span>
        </div>
        <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: 16 }}>{g.predictedQty.toFixed(1)} <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>m³</span></div>
      </div>
      {/* Predicted bar with committed (booked+recurring) overlay */}
      <div style={{ position: 'relative', height: 12, borderRadius: 99, background: 'var(--chip-bg)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'linear-gradient(90deg,var(--gold-dark),var(--gold))', borderRadius: 99 }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${(pct * bookedPct) / 100}%`, background: 'color-mix(in srgb, var(--green) 70%, transparent)', borderRadius: 99 }} />
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
        <span><span style={{ color: 'var(--green)', fontWeight: 700 }}>{g.bookedQty.toFixed(1)}</span> booked</span>
        <span><span style={{ color: 'var(--blue)', fontWeight: 700 }}>{g.recurringQty.toFixed(1)}</span> recurring</span>
        <span><span style={{ color: 'var(--gold)', fontWeight: 700 }}>{g.modelQty.toFixed(1)}</span> model estimate</span>
      </div>
    </div>
  );
}

export default function DemandForecast() {
  const [date, setDate] = useState<string>(tomorrowStr);
  const [data, setData] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Promise-chained (not async) so the effect that calls it never triggers a
  // synchronous setState — state only updates in the deferred .then/.finally.
  const load = useCallback((d: string) => {
    api.get<ForecastResult>(`/reports/forecast?date=${encodeURIComponent(d)}`)
      .then(res => { setData(res); setError(''); })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load forecast.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  const maxQty = data ? Math.max(1, ...data.grades.map(g => g.predictedQty)) : 1;
  const prettyDate = data ? new Date(`${data.date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-.3px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={24} style={{ color: 'var(--gold)' }} /> Demand Forecast
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '6px 0 0' }}>
            Smart demand prediction by grade — blends your order history with what's already booked and recurring, then sizes the fleet.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarDays size={16} style={{ color: 'var(--muted)' }} />
          <input
            type="date" value={date} onChange={e => { setLoading(true); setDate(e.target.value || tomorrowStr()); }}
            style={{ padding: '8px 11px', borderRadius: 9, background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13 }}
          />
        </div>
      </div>

      {loading ? (
        <Card><div style={{ textAlign: 'center', padding: 50, color: 'var(--muted)' }}>Crunching history…</div></Card>
      ) : error ? (
        <Card><div style={{ textAlign: 'center', padding: 40, color: 'var(--red)' }}>{error}</div></Card>
      ) : !data ? null : (
        <>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14, fontWeight: 600 }}>{prettyDate}</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(170px, 100%), 1fr))', gap: 12, marginBottom: 18 }}>
            <Stat icon={<TrendingUp size={13} />} label="Predicted demand" value={`${data.totalPredicted.toFixed(1)} m³`} sub={`${data.grades.length} grade${data.grades.length === 1 ? '' : 's'}`} color="var(--gold)" />
            <Stat icon={<ClipboardList size={13} />} label="Already booked" value={`${data.totalBooked.toFixed(1)} m³`} sub={`${data.totalRecurring.toFixed(1)} m³ recurring`} color="var(--green)" />
            <Stat icon={<Truck size={13} />} label="Truck loads" value={String(data.recommendedTruckLoads)} sub={`@ ${data.avgTruckCapacity} m³ avg capacity`} color="var(--blue)" />
            <Stat icon={<Layers size={13} />} label="Batches" value={String(data.recommendedBatches)} sub="suggested production runs" />
          </div>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14, marginBottom: 6 }}>Predicted demand by grade</div>
            {data.grades.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>
                No history or bookings to forecast from yet. Predictions appear once orders accumulate.
              </div>
            ) : (
              data.grades.map(g => <GradeRow key={g.grade} g={g} max={maxQty} />)
            )}
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <Info size={15} style={{ color: 'var(--blue)' }} />
              <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>How this forecast works</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.7 }}>
              {data.assumptions.map((a, i) => <li key={i}>{a}</li>)}
              <li style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Repeat size={11} /> No external AI service — a fully transparent, deterministic statistical model you can audit.
              </li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
