import { useState, useEffect } from 'react';
import { BarChart3, Download, Calendar } from 'lucide-react';
import { api } from '@/lib/api';

type ReportTab = 'client-wise' | 'grade-wise' | 'dispatch' | 'production';

interface ClientRow { clientName: string; totalQty: number; totalChallans: number }
interface GradeRow { grade: string; totalQty: number; totalChallans: number }
interface DispatchRow { date: string; totalQty: number; count: number }
interface ProductionRow { date: string; totalQty: number; count: number; grade: string }

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
];

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

export default function Reports() {
  const [tab, setTab] = useState<ReportTab>('client-wise');
  const [preset, setPreset] = useState(1);
  const [from, setFrom] = useState(() => isoDate(new Date(Date.now() - 7 * 86400000)));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [clientData, setClientData] = useState<ClientRow[]>([]);
  const [gradeData, setGradeData] = useState<GradeRow[]>([]);
  const [dispatchData, setDispatchData] = useState<DispatchRow[]>([]);
  const [productionData, setProductionData] = useState<ProductionRow[]>([]);
  const [loading, setLoading] = useState(false);

  function applyPreset(idx: number) {
    setPreset(idx);
    const days = PRESETS[idx].days;
    const today = new Date();
    const newFrom = days === 0 ? isoDate(today) : isoDate(new Date(today.getTime() - days * 86400000));
    setFrom(newFrom);
    setTo(isoDate(today));
  }

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      const params = `?from=${from}T00:00:00&to=${to}T23:59:59`;
      const [c, g, d, p] = await Promise.all([
        api.get<ClientRow[]>(`/reports/client-wise${params}`),
        api.get<GradeRow[]>(`/reports/grade-wise${params}`),
        api.get<DispatchRow[]>(`/reports/dispatch${params}`),
        api.get<ProductionRow[]>(`/reports/production${params}`),
      ]);
      if (cancelled) return;
      setClientData(c); setGradeData(g); setDispatchData(d); setProductionData(p);
      setLoading(false);
    }
    loadAll();
    return () => { cancelled = true; };
  }, [from, to]);

  function downloadCSV(report: string) {
    const params = `?report=${report}&from=${from}T00:00:00&to=${to}T23:59:59`;
    window.open(`/api/reports/export${params}`, '_blank');
  }

  const maxClientQty = Math.max(...clientData.map(r => Number(r.totalQty)), 1);
  const maxGradeQty = Math.max(...gradeData.map(r => Number(r.totalQty)), 1);
  const maxDispatchQty = Math.max(...dispatchData.map(r => Number(r.totalQty)), 1);

  const GRADE_COLORS = ['var(--blue)','var(--green)','var(--gold)','#a78bfa','#f97316','var(--red)','#06b6d4'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Reports</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>Analytics &amp; exports</p>
        </div>
        <button onClick={() => downloadCSV(tab === 'production' ? 'production' : 'dispatch')} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
          background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)',
          color: 'var(--green)', fontWeight: 700, fontSize: 13, borderRadius: 10, cursor: 'pointer',
        }}><Download size={15} /> Export CSV</button>
      </div>

      {/* Date range */}
      <div className="glass-card" style={{ padding: '14px 16px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
            <Calendar size={14} /> Date Range:
          </div>
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => applyPreset(i)} style={{
              padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: preset === i ? 'var(--gold)' : 'rgba(255,255,255,.05)',
              color: preset === i ? '#111' : 'var(--muted)', border: 'none',
            }}>{p.label}</button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreset(-1); }}
              style={{ padding: '5px 10px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none' }} />
            <span style={{ color: 'var(--muted)' }}>to</span>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPreset(-1); }}
              style={{ padding: '5px 10px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none' }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: 4 }}>
        {(['client-wise', 'grade-wise', 'dispatch', 'production'] as ReportTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '9px', background: tab === t ? 'color-mix(in srgb, var(--gold) 15%, transparent)' : 'transparent',
            border: tab === t ? '1px solid color-mix(in srgb, var(--gold) 25%, transparent)' : '1px solid transparent',
            borderRadius: 9, cursor: 'pointer',
            color: tab === t ? 'var(--gold)' : 'var(--muted)', fontSize: 13, fontWeight: tab === t ? 700 : 500,
          }}>{t.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px', fontSize: 13 }}>Loading…</div>}

      {!loading && (
        <div className="glass-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <BarChart3 size={16} style={{ color: 'var(--gold)' }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              {tab === 'client-wise' ? 'Client-wise Dispatch' : tab === 'grade-wise' ? 'Grade-wise Production' : tab === 'dispatch' ? 'Daily Dispatch Trend' : 'Daily Production'}
            </h3>
          </div>

          {tab === 'client-wise' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {clientData.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>No data for this period</div>}
              {clientData.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ minWidth: 160, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.clientName}</span>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 999, overflow: 'hidden', height: 10 }}>
                    <div style={{ width: `${(Number(r.totalQty) / maxClientQty) * 100}%`, height: '100%', background: 'linear-gradient(90deg,var(--gold),var(--gold-dark))', borderRadius: 999, transition: 'width .5s' }} />
                  </div>
                  <span style={{ minWidth: 70, fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{Number(r.totalQty).toFixed(1)} m³</span>
                  <span style={{ minWidth: 60, fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{r.totalChallans} trips</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'grade-wise' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {gradeData.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>No data for this period</div>}
              {gradeData.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 48, fontSize: 13, fontWeight: 700, color: GRADE_COLORS[i % GRADE_COLORS.length] }}>{r.grade}</span>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 999, overflow: 'hidden', height: 10 }}>
                    <div style={{ width: `${(Number(r.totalQty) / maxGradeQty) * 100}%`, height: '100%', background: GRADE_COLORS[i % GRADE_COLORS.length], borderRadius: 999, transition: 'width .5s', opacity: 0.85 }} />
                  </div>
                  <span style={{ minWidth: 70, fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{Number(r.totalQty).toFixed(1)} m³</span>
                  <span style={{ minWidth: 60, fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{r.totalChallans} batches</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'dispatch' && (
            <div>
              {dispatchData.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>No dispatch data for this period</div>}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 180, padding: '0 4px', overflowX: 'auto' }}>
                {dispatchData.map((r, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 50 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>{Number(r.totalQty).toFixed(0)}</span>
                    <div style={{
                      width: 36, background: 'linear-gradient(180deg,var(--green),var(--green-dark))',
                      borderRadius: '4px 4px 0 0',
                      height: `${Math.max(4, (Number(r.totalQty) / maxDispatchQty) * 140)}px`,
                      transition: 'height .5s',
                    }} />
                    <span style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.2 }}>
                      {new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      {['Date', 'Total (m³)', 'Challans'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', color: 'var(--muted)', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dispatchData.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(38,52,73,.4)' }}>
                        <td style={{ padding: '8px 12px' }}>{new Date(r.date).toLocaleDateString('en-IN')}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{Number(r.totalQty).toFixed(1)}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'production' && (
            <div>
              {productionData.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>No production data for this period</div>}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      {['Date', 'Grade', 'Qty (m³)', 'Batches'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', color: 'var(--muted)', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productionData.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(38,52,73,.4)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{new Date(r.date).toLocaleDateString('en-IN')}</td>
                        <td style={{ padding: '8px 12px' }}><span style={{ padding: '2px 8px', background: 'rgba(56,189,248,.12)', color: 'var(--blue)', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{r.grade}</span></td>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{Number(r.totalQty).toFixed(1)}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
