import { useState, useEffect } from 'react';
import { BarChart3, Download, Calendar, Fuel, AlertTriangle, MapPin, Check } from 'lucide-react';
import { api, type FuelReconResponse, type VehicleAlert } from '@/lib/api';
import { useVarianceTolerance, isWithinTolerance } from '@/lib/variance';

type ReportTab = 'client-wise' | 'grade-wise' | 'dispatch' | 'trip-timing' | 'production' | 'fuel';

interface ClientRow { clientName: string; totalQty: number; deliveredQty: number; plannedForDelivered: number; variance: number; totalChallans: number }
interface GradeRow { grade: string; totalQty: number; deliveredQty: number; plannedForDelivered: number; variance: number; totalChallans: number }
interface DispatchRow { date: string; totalQty: number; deliveredQty: number; plannedForDelivered: number; variance: number; count: number }
interface ProductionRow { date: string; totalQty: number; count: number; grade: string }
interface TripTimingRow { date: string; tripsWithTravel: number; tripsWithSite: number; avgTravelMin: number; avgSiteMin: number; totalBillableIdleMin: number; idleTrips: number; totalIdleCharge: number }
interface TripTimingResponse { freeMin: number; ratePerHour: number | null; rows: TripTimingRow[] }

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
  const [tripTiming, setTripTiming] = useState<TripTimingResponse>({ freeMin: 45, ratePerHour: null, rows: [] });
  const [fuelRecon, setFuelRecon] = useState<FuelReconResponse | null>(null);
  const [alerts, setAlerts] = useState<VehicleAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const tolerance = useVarianceTolerance();

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
      const [c, g, d, p, tt, fr, al] = await Promise.all([
        api.get<ClientRow[]>(`/reports/client-wise${params}`),
        api.get<GradeRow[]>(`/reports/grade-wise${params}`),
        api.get<DispatchRow[]>(`/reports/dispatch${params}`),
        api.get<ProductionRow[]>(`/reports/production${params}`),
        api.get<TripTimingResponse>(`/reports/trip-timing${params}`),
        api.get<FuelReconResponse>(`/reports/fuel-reconciliation${params}`),
        api.get<VehicleAlert[]>(`/positions/alerts?open=1`),
      ]);
      if (cancelled) return;
      setClientData(c); setGradeData(g); setDispatchData(d); setProductionData(p); setTripTiming(tt);
      setFuelRecon(fr); setAlerts(al);
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

  // Planned-vs-delivered totals over delivered challans only (those with a recorded delivered qty)
  const totalPlanned = dispatchData.reduce((s, r) => s + Number(r.plannedForDelivered || 0), 0);
  const totalDelivered = dispatchData.reduce((s, r) => s + Number(r.deliveredQty || 0), 0);
  const netVariance = totalDelivered - totalPlanned;
  const varColor = (v: number, planned: number) => isWithinTolerance(v, planned, tolerance) ? 'var(--muted)' : v > 0 ? 'var(--blue)' : 'var(--red)';
  const varText = (v: number, planned: number) => isWithinTolerance(v, planned, tolerance) ? '0.0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Reports</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>Analytics &amp; exports</p>
        </div>
        <button onClick={() => downloadCSV(tab === 'production' ? 'production' : tab === 'fuel' ? 'fuel-reconciliation' : 'dispatch')} style={{
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
              background: preset === i ? 'var(--gold)' : 'var(--chip-bg)',
              color: preset === i ? '#111' : 'var(--muted)', border: 'none',
            }}>{p.label}</button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreset(-1); }}
              style={{ padding: '5px 10px', background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none' }} />
            <span style={{ color: 'var(--muted)' }}>to</span>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPreset(-1); }}
              style={{ padding: '5px 10px', background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none' }} />
          </div>
        </div>
      </div>

      {/* Planned vs delivered variance summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div className="glass-card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>TOTAL PLANNED</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{totalPlanned.toFixed(1)} <span style={{ fontSize: 13, color: 'var(--muted)' }}>m³</span></div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>across delivered challans</div>
        </div>
        <div className="glass-card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>TOTAL DELIVERED</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{totalDelivered.toFixed(1)} <span style={{ fontSize: 13, color: 'var(--muted)' }}>m³</span></div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>actual at site</div>
        </div>
        <div className="glass-card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>NET VARIANCE</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: varColor(netVariance, totalPlanned) }}>{varText(netVariance, totalPlanned)} <span style={{ fontSize: 13, color: 'var(--muted)' }}>m³</span></div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{isWithinTolerance(netVariance, totalPlanned, tolerance) ? 'on target' : netVariance < 0 ? 'short delivery' : 'over delivery'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 12, padding: 4 }}>
        {(['client-wise', 'grade-wise', 'dispatch', 'trip-timing', 'production', 'fuel'] as ReportTab[]).map(t => (
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
              {tab === 'client-wise' ? 'Client-wise Dispatch' : tab === 'grade-wise' ? 'Grade-wise Production' : tab === 'dispatch' ? 'Daily Dispatch Trend' : tab === 'trip-timing' ? 'Trip Timing & Idle Charges' : tab === 'fuel' ? 'Fuel Reconciliation & Theft Alerts' : 'Daily Production'}
            </h3>
          </div>

          {tab === 'client-wise' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {clientData.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>No data for this period</div>}
              {clientData.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ minWidth: 160, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.clientName}</span>
                  <div style={{ flex: 1, background: 'var(--chip-bg)', borderRadius: 999, overflow: 'hidden', height: 10 }}>
                    <div style={{ width: `${(Number(r.totalQty) / maxClientQty) * 100}%`, height: '100%', background: 'linear-gradient(90deg,var(--gold),var(--gold-dark))', borderRadius: 999, transition: 'width .5s' }} />
                  </div>
                  <span style={{ minWidth: 70, fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{Number(r.totalQty).toFixed(1)} m³</span>
                  <span style={{ minWidth: 64, fontSize: 12, fontWeight: 700, color: varColor(Number(r.variance), Number(r.plannedForDelivered)), textAlign: 'right' }} title="Delivered − planned (delivered challans)">{varText(Number(r.variance), Number(r.plannedForDelivered))}</span>
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
                  <div style={{ flex: 1, background: 'var(--chip-bg)', borderRadius: 999, overflow: 'hidden', height: 10 }}>
                    <div style={{ width: `${(Number(r.totalQty) / maxGradeQty) * 100}%`, height: '100%', background: GRADE_COLORS[i % GRADE_COLORS.length], borderRadius: 999, transition: 'width .5s', opacity: 0.85 }} />
                  </div>
                  <span style={{ minWidth: 70, fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{Number(r.totalQty).toFixed(1)} m³</span>
                  <span style={{ minWidth: 64, fontSize: 12, fontWeight: 700, color: varColor(Number(r.variance), Number(r.plannedForDelivered)), textAlign: 'right' }} title="Delivered − planned (delivered challans)">{varText(Number(r.variance), Number(r.plannedForDelivered))}</span>
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
                      {['Date', 'Planned (m³)', 'Delivered (m³)', 'Variance (m³)', 'Challans'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', color: 'var(--muted)', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dispatchData.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '8px 12px' }}>{new Date(r.date).toLocaleDateString('en-IN')}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{Number(r.totalQty).toFixed(1)}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--green)' }}>{Number(r.deliveredQty).toFixed(1)}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: varColor(Number(r.variance), Number(r.plannedForDelivered)) }} title="Delivered − planned (delivered challans)">{varText(Number(r.variance), Number(r.plannedForDelivered))}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'trip-timing' && (
            <div>
              {(() => {
                const rows = tripTiming.rows;
                const totalBillableIdle = rows.reduce((s, r) => s + Number(r.totalBillableIdleMin || 0), 0);
                const totalCharge = rows.reduce((s, r) => s + Number(r.totalIdleCharge || 0), 0);
                const totalIdleTrips = rows.reduce((s, r) => s + Number(r.idleTrips || 0), 0);
                const tripsWithSite = rows.reduce((s, r) => s + Number(r.tripsWithSite || 0), 0);
                const tripsWithTravel = rows.reduce((s, r) => s + Number(r.tripsWithTravel || 0), 0);
                const wTravelSum = rows.reduce((s, r) => s + Number(r.avgTravelMin || 0) * Number(r.tripsWithTravel || 0), 0);
                const wSiteSum = rows.reduce((s, r) => s + Number(r.avgSiteMin || 0) * Number(r.tripsWithSite || 0), 0);
                const avgTravel = tripsWithTravel ? wTravelSum / tripsWithTravel : 0;
                const avgSite = tripsWithSite ? wSiteSum / tripsWithSite : 0;
                const fmt = (m: number) => { const h = Math.floor(m / 60); const mm = Math.round(m % 60); return h ? `${h}h ${mm}m` : `${mm}m`; };
                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
                      <div style={{ padding: '12px 14px', background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>AVG TRAVEL</div>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(avgTravel)}</div>
                      </div>
                      <div style={{ padding: '12px 14px', background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>AVG TIME AT SITE</div>
                        <div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(avgSite)}</div>
                      </div>
                      <div style={{ padding: '12px 14px', background: 'color-mix(in srgb, var(--gold) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 20%, transparent)', borderRadius: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>BILLABLE IDLE</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{fmt(totalBillableIdle)}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{totalIdleTrips} of {tripsWithSite} trips · free {tripTiming.freeMin}m</div>
                      </div>
                      {tripTiming.ratePerHour != null && (
                        <div style={{ padding: '12px 14px', background: 'color-mix(in srgb, var(--gold) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 20%, transparent)', borderRadius: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>IDLE CHARGES</div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>₹{totalCharge.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>@ ₹{tripTiming.ratePerHour}/hr</div>
                        </div>
                      )}
                    </div>
                    {rows.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>No trip-timing data for this period</div>}
                    {rows.length > 0 && (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--line)' }}>
                              {['Date', 'Avg Travel', 'Avg Site', 'Billable Idle', 'Idle Trips', ...(tripTiming.ratePerHour != null ? ['Idle Charge'] : [])].map(h => (
                                <th key={h} style={{ padding: '8px 12px', color: 'var(--muted)', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                                <td style={{ padding: '8px 12px' }}>{new Date(r.date).toLocaleDateString('en-IN')}</td>
                                <td style={{ padding: '8px 12px', fontWeight: 700 }}>{fmt(Number(r.avgTravelMin))}</td>
                                <td style={{ padding: '8px 12px', fontWeight: 700 }}>{fmt(Number(r.avgSiteMin))}</td>
                                <td style={{ padding: '8px 12px', fontWeight: 700, color: Number(r.totalBillableIdleMin) > 0 ? 'var(--gold)' : 'var(--muted)' }}>{fmt(Number(r.totalBillableIdleMin))}</td>
                                <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{r.idleTrips} / {r.tripsWithSite}</td>
                                {tripTiming.ratePerHour != null && (
                                  <td style={{ padding: '8px 12px', fontWeight: 700, color: Number(r.totalIdleCharge) > 0 ? 'var(--gold)' : 'var(--muted)' }}>₹{Number(r.totalIdleCharge).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                );
              })()}
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
                      <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
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

          {tab === 'fuel' && (
            <div>
              {/* Theft / unscheduled-stop & route-deviation alerts */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <AlertTriangle size={15} style={{ color: alerts.length ? 'var(--red)' : 'var(--muted)' }} />
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Open Theft / Movement Alerts {alerts.length > 0 && <span style={{ color: 'var(--red)' }}>({alerts.length})</span>}</h4>
                </div>
                {alerts.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12, padding: '8px 0' }}>No open alerts. Unscheduled stops & route deviations show up here.</div>}
                {alerts.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {alerts.map(a => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10 }}>
                        <MapPin size={15} style={{ color: 'var(--red)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            {a.type === 'unscheduled_stop' ? 'Unscheduled stop' : 'Route deviation'}
                            {a.vehicleNo && <span style={{ color: 'var(--muted)', fontWeight: 500 }}> · {a.vehicleNo}</span>}
                            {a.driverName && <span style={{ color: 'var(--muted)', fontWeight: 500 }}> · {a.driverName}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {a.detail || (a.distanceM != null ? `${a.distanceM} m` : '')}
                            {a.challanNo && ` · ${a.challanNo}`} · {new Date(a.createdAt).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <button
                          onClick={async () => { await api.post(`/positions/alerts/${a.id}/ack`, {}); setAlerts(prev => prev.filter(x => x.id !== a.id)); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--chip-bg)', color: 'var(--text)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
                        ><Check size={13} /> Acknowledge</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Per-vehicle fuel reconciliation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Fuel size={15} style={{ color: 'var(--gold)' }} />
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Per-vehicle Reconciliation</h4>
                {fuelRecon && <span style={{ fontSize: 11, color: 'var(--muted)' }}>variance threshold {fuelRecon.config.reconVariancePct}%</span>}
              </div>
              {(!fuelRecon || fuelRecon.rows.length === 0) && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>No fuel data for this period. Log diesel fills and set vehicle mileage to enable reconciliation.</div>}
              {fuelRecon && fuelRecon.rows.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        {['Vehicle', 'Distance (km)', 'Idle (h)', 'Expected (L)', 'Actual (L)', 'Variance', 'Fills'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', color: 'var(--muted)', fontWeight: 600, textAlign: 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fuelRecon.rows.map(r => (
                        <tr key={r.vehicleId} style={{ borderBottom: '1px solid var(--line)', background: r.flagged ? 'rgba(239,68,68,.06)' : 'transparent' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                            {r.flagged && <AlertTriangle size={12} style={{ color: 'var(--red)', marginRight: 5, verticalAlign: 'middle' }} />}
                            {r.vehicleNo || `#${r.vehicleId}`}
                          </td>
                          <td style={{ padding: '8px 12px' }}>{r.km.toFixed(0)} <span style={{ color: 'var(--muted)', fontSize: 11 }}>({r.tripsWithOdometer}/{r.trips})</span></td>
                          <td style={{ padding: '8px 12px' }}>{r.idleHours.toFixed(1)}</td>
                          <td style={{ padding: '8px 12px' }}>{r.expectedLitres != null ? r.expectedLitres.toFixed(1) : <span style={{ color: 'var(--muted)' }} title="Set vehicle mileage to compute">n/a</span>}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 700 }}>{r.actualLitres.toFixed(1)}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: r.variancePct == null ? 'var(--muted)' : r.flagged ? 'var(--red)' : 'var(--green)' }}>
                            {r.variancePct != null ? `${r.variancePct > 0 ? '+' : ''}${r.variancePct.toFixed(1)}%` : '—'}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{r.fills}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
                    Expected = distance ÷ mileage (km/L) + idle hours × idle burn (L/h). Rows over the variance threshold are flagged as possible theft/leakage.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
