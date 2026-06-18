import {
  TrendingUp, Clock, Truck, Users, IndianRupee, ArrowRight,
  ClipboardList, UserPlus, Printer, Radio, CarFront, Boxes, Monitor,
  Navigation, AlertCircle, Factory, MapPin, Bell, CheckCircle2,
  Plus, Activity, Gauge, ChevronRight,
} from 'lucide-react';

const ACCENT = '#1d4ed8';
const ACCENT_SOFT = '#eff4ff';
const AMBER = '#d97706';
const GREEN = '#16a34a';
const BLUE = '#0284c7';
const RED = '#dc2626';
const INK = '#0f172a';
const SLATE = '#64748b';
const LINE = '#e7ebf0';

const stats = [
  { label: 'Today Dispatch', value: '212.5', unit: 'm³', sub: '34 challans', icon: TrendingUp, tone: GREEN, trend: '+12.4%' },
  { label: 'Active Orders', value: '18', unit: '', sub: '6 pending', icon: Clock, tone: AMBER, trend: '+3' },
  { label: 'Online Challans', value: '7', unit: '', sub: 'in transit now', icon: Radio, tone: BLUE, trend: 'live' },
  { label: 'Clients', value: '146', unit: '', sub: 'accounts', icon: Users, tone: ACCENT, trend: '+5' },
  { label: 'Driver / TM Status', value: '8/12', unit: '', sub: '2 in maintenance', icon: CarFront, tone: AMBER, trend: '66%' },
  { label: 'Today Production', value: '248.0', unit: 'm³', sub: '41 batches', icon: Boxes, tone: BLUE, trend: '+8.1%' },
  { label: 'Outstanding', value: '₹38.6', unit: 'L', sub: 'receivables', icon: IndianRupee, tone: RED, trend: '−2.3%' },
];

const quickActions = [
  { label: 'New Challan', sub: 'Dispatch concrete', icon: Truck, tone: GREEN },
  { label: 'New Order', sub: 'Book a pour', icon: ClipboardList, tone: AMBER },
  { label: 'Add Client', sub: 'Onboard account', icon: UserPlus, tone: ACCENT },
  { label: 'Print Report', sub: 'Daily summary', icon: Printer, tone: BLUE },
];

const needsDispatch = [
  { client: 'Shapoorji Pallonji', site: 'Hiranandani Towers · Slab 7', grade: 'M40', ordered: 36, remaining: 21 },
  { client: 'L&T Construction', site: 'Metro Line 3 · Pier P-12', grade: 'M30', ordered: 48, remaining: 30 },
  { client: 'Kalpataru Group', site: 'Vista Residency · Raft', grade: 'M25', ordered: 24, remaining: 18 },
  { client: 'Godrej Properties', site: 'Emerald Heights · Column', grade: 'M35', ordered: 30, remaining: 12 },
];

const transitMixers = [
  { veh: 'MH-12-AB-1234', driver: 'Ramesh Patil', site: 'Hiranandani Towers', grade: 'M40', eta: '14 min', pct: 72 },
  { veh: 'MH-14-CU-0813', driver: 'Suresh Yadav', site: 'Metro Line 3', grade: 'M30', eta: '26 min', pct: 48 },
  { veh: 'MH-12-DX-7788', driver: 'Vinod Shinde', site: 'Vista Residency', grade: 'M25', eta: '9 min', pct: 85 },
  { veh: 'MH-43-KL-5521', driver: 'Anil Kamble', site: 'Emerald Heights', grade: 'M35', eta: '33 min', pct: 31 },
];

const recentDispatch = [
  { no: '0042', client: 'Shapoorji', veh: 'MH-12-AB-1234', grade: 'M40', qty: 7, status: 'dispatched' },
  { no: '0041', client: 'L&T', veh: 'MH-14-CU-0813', grade: 'M30', qty: 8, status: 'dispatched' },
  { no: '0040', client: 'Godrej', veh: 'MH-43-KL-5521', grade: 'M35', qty: 6, status: 'delivered' },
  { no: '0039', client: 'Kalpataru', veh: 'MH-12-DX-7788', grade: 'M25', qty: 7, status: 'dispatched' },
  { no: '0038', client: 'Lodha', veh: 'MH-04-GH-3390', grade: 'M30', qty: 9, status: 'delivered' },
  { no: '0037', client: 'Oberoi', veh: 'MH-02-BC-7741', grade: 'M40', qty: 7, status: 'pending' },
];

const activeOrders = [
  { no: 'ORD-2291', client: 'Shapoorji Pallonji', grade: 'M40', qty: 36, status: 'in_progress' },
  { no: 'ORD-2290', client: 'L&T Construction', grade: 'M30', qty: 48, status: 'in_progress' },
  { no: 'ORD-2289', client: 'Kalpataru Group', grade: 'M25', qty: 24, status: 'pending' },
  { no: 'ORD-2288', client: 'Godrej Properties', grade: 'M35', qty: 30, status: 'pending' },
];

const feed = [
  { tone: GREEN, icon: CheckCircle2, title: 'Challan #0040 delivered', sub: 'Godrej · M35 · 6 m³', time: '2m' },
  { tone: BLUE, icon: Truck, title: 'Challan #0042 dispatched', sub: 'Shapoorji · M40 · 7 m³', time: '8m' },
  { tone: AMBER, icon: Clock, title: 'Order ORD-2289 awaiting dispatch', sub: 'Kalpataru · M25 · 24 m³', time: '17m' },
  { tone: BLUE, icon: Boxes, title: 'Batch B-2204 completed', sub: 'M30 · 8 m³ · Plant A', time: '24m' },
  { tone: RED, icon: AlertCircle, title: 'MH-46-AB-4455 flagged maintenance', sub: 'Brake service due', time: '41m' },
];

const statusMap: Record<string, { c: string; bg: string; label: string }> = {
  dispatched: { c: BLUE, bg: '#e0f2fe', label: 'In Transit' },
  delivered: { c: GREEN, bg: '#dcfce7', label: 'Delivered' },
  pending: { c: AMBER, bg: '#fef3c7', label: 'Pending' },
  in_progress: { c: ACCENT, bg: ACCENT_SOFT, label: 'In Progress' },
};

function StatusPill({ status }: { status: string }) {
  const s = statusMap[status] ?? statusMap.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, color: s.c, background: s.bg, letterSpacing: '.2px',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.c }} />
      {s.label}
    </span>
  );
}

export function DaylightOps() {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div
      className="font-['Inter']"
      style={{ minHeight: '100vh', background: '#f6f8fb', color: INK, padding: '28px 32px 48px' }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Sora:wght@600;700;800&display=swap');
        @keyframes do-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.7)} }
        @keyframes do-dash { to { stroke-dashoffset: -40; } }
        @keyframes do-float { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-4px) } }
        @keyframes do-truck { 0%{ left:6% } 100%{ left:78% } }
        .do-card { background:#fff; border:1px solid ${LINE}; border-radius:18px; box-shadow:0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.10); }
        .do-hover { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .do-hover:hover { transform: translateY(-2px); box-shadow:0 1px 2px rgba(15,23,42,.05), 0 18px 38px -16px rgba(29,78,216,.28); border-color:#cfdcff; }
      `}</style>

      <div style={{ maxWidth: 1340, margin: '0 auto' }}>

        {/* ===== Header ===== */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h1 className="font-['Sora']" style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-1px', color: INK }}>
                Command Center
              </h1>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999,
                background: '#fee2e2', color: RED, fontSize: 11, fontWeight: 800, letterSpacing: '.6px',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: RED, animation: 'do-pulse 1.4s infinite' }} />
                LIVE
              </span>
            </div>
            <p style={{ margin: 0, color: SLATE, fontSize: 13.5, fontWeight: 500 }}>
              Welcome back, Rajesh · {today}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 11, cursor: 'pointer',
              background: '#fff', border: `1px solid ${LINE}`, color: INK, fontSize: 13, fontWeight: 600,
              boxShadow: '0 1px 2px rgba(15,23,42,.04)',
            }}>
              <ClipboardList size={15} style={{ color: SLATE }} /> Shift Report
            </button>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 11, cursor: 'pointer',
              background: '#fff', border: `1px solid ${LINE}`, color: INK, fontSize: 13, fontWeight: 600,
              boxShadow: '0 1px 2px rgba(15,23,42,.04)',
            }}>
              <Monitor size={15} style={{ color: SLATE }} /> Control Room
            </button>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 15px', borderRadius: 11,
              background: '#ecfdf3', border: '1px solid #c7f0d6',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, boxShadow: `0 0 0 4px ${'#c7f0d6'}` }} />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: '#15803d', letterSpacing: '.3px' }}>PLANT ONLINE</span>
            </div>
          </div>
        </header>

        {/* ===== Needs Dispatch band ===== */}
        <section className="do-card" style={{ padding: 20, marginBottom: 22, borderColor: '#fde9c7', background: 'linear-gradient(180deg,#fffdf8,#ffffff)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: '#fef3c7' }}>
                <AlertCircle size={18} style={{ color: AMBER }} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: INK }}>Needs Dispatch</h2>
                <p style={{ margin: 0, fontSize: 12, color: SLATE }}>Orders waiting on a mixer assignment</p>
              </div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 800, padding: '5px 11px', borderRadius: 999, color: AMBER, background: '#fef3c7' }}>
              {needsDispatch.length} waiting
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 12 }}>
            {needsDispatch.map((o) => (
              <div key={o.client + o.site} className="do-hover" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '14px 15px', borderRadius: 14, background: '#fff', border: `1px solid ${LINE}`,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {o.client}
                  </div>
                  <div style={{ fontSize: 11.5, color: SLATE, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.site}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT, background: ACCENT_SOFT, padding: '2px 7px', borderRadius: 6 }}>{o.grade}</span>
                    <span style={{ fontSize: 11.5, color: SLATE }}>{o.ordered} m³ ordered</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: AMBER }}>{o.remaining} m³ left</span>
                  </div>
                </div>
                <button style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  padding: '9px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: '#fff',
                  background: ACCENT, border: 'none', boxShadow: '0 6px 14px -6px rgba(29,78,216,.6)',
                }}>
                  <Truck size={14} /> Assign
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ===== Quick actions ===== */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 14, marginBottom: 22 }}>
          {quickActions.map((a) => (
            <button key={a.label} className="do-card do-hover" style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: `${a.tone}14` }}>
                <a.icon size={20} style={{ color: a.tone }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>{a.label}</div>
                <div style={{ fontSize: 11.5, color: SLATE }}>{a.sub}</div>
              </div>
              <Plus size={16} style={{ color: SLATE, flexShrink: 0 }} />
            </button>
          ))}
        </section>

        {/* ===== KPI stat cards ===== */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 22 }}>
          {stats.map((s) => (
            <div key={s.label} className="do-card do-hover" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: `${s.tone}14` }}>
                  <s.icon size={17} style={{ color: s.tone }} />
                </div>
                <span style={{
                  fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                  color: s.tone, background: `${s.tone}14`, letterSpacing: '.2px',
                }}>{s.trend}</span>
              </div>
              <div style={{ fontSize: 11.5, color: SLATE, fontWeight: 600, marginBottom: 5 }}>{s.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span className="font-['Sora']" style={{ fontSize: 26, fontWeight: 800, color: INK, lineHeight: 1, letterSpacing: '-.5px' }}>{s.value}</span>
                {s.unit && <span style={{ fontSize: 14, fontWeight: 700, color: SLATE }}>{s.unit}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: SLATE, marginTop: 6 }}>{s.sub}</div>
            </div>
          ))}
        </section>

        {/* ===== Map hero + Routing schematic ===== */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 18, marginBottom: 22 }}>

          {/* Live GPS map */}
          <div className="do-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${LINE}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <MapPin size={17} style={{ color: ACCENT }} />
                <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: INK }}>Live GPS Tracking</h3>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: BLUE, fontWeight: 700 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: BLUE, animation: 'do-pulse 1.4s infinite' }} />
                7 vehicles live
              </span>
            </div>

            <div style={{ position: 'relative', height: 360, background: 'linear-gradient(135deg,#eef3fb 0%,#f4f7fc 60%,#eaf0f9 100%)', overflow: 'hidden' }}>
              {/* grid */}
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                <defs>
                  <pattern id="do-grid" width="44" height="44" patternUnits="userSpaceOnUse">
                    <path d="M44 0 L0 0 0 44" fill="none" stroke="#dce4f0" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#do-grid)" />
                {/* faux rivers / roads */}
                <path d="M -20 90 Q 300 40 520 150 T 980 120" fill="none" stroke="#d3deef" strokeWidth="9" strokeLinecap="round" />
                <path d="M 60 360 Q 240 240 460 300 T 900 250" fill="none" stroke="#d3deef" strokeWidth="9" strokeLinecap="round" />
                {/* animated routes */}
                <path d="M 110 300 C 260 220, 360 160, 520 150" fill="none" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 10" style={{ animation: 'do-dash 1.1s linear infinite' }} />
                <path d="M 110 300 C 280 320, 460 280, 650 210" fill="none" stroke={BLUE} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 10" style={{ animation: 'do-dash 1.4s linear infinite' }} />
                <path d="M 110 300 C 220 360, 380 360, 540 320" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeDasharray="2 10" style={{ animation: 'do-dash 1.3s linear infinite' }} />
              </svg>

              {/* plant origin marker */}
              <div style={{ position: 'absolute', left: '11%', top: '78%', transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: '#fff', border: `2px solid ${ACCENT}`, display: 'grid', placeItems: 'center', boxShadow: '0 8px 20px -6px rgba(29,78,216,.4)' }}>
                  <Factory size={22} style={{ color: ACCENT }} />
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: ACCENT, marginTop: 5 }}>PLANT A</div>
              </div>

              {/* truck markers */}
              {[
                { l: '49%', t: '40%', tone: ACCENT, label: 'MH-12-AB-1234' },
                { l: '64%', t: '56%', tone: BLUE, label: 'MH-14-CU-0813' },
                { l: '52%', t: '85%', tone: GREEN, label: 'MH-12-DX-7788' },
              ].map((m) => (
                <div key={m.label} style={{ position: 'absolute', left: m.l, top: m.t, transform: 'translate(-50%,-50%)', animation: 'do-float 3s ease-in-out infinite' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: m.tone, display: 'grid', placeItems: 'center', boxShadow: `0 6px 16px -4px ${m.tone}99`, border: '3px solid #fff' }}>
                    <Truck size={15} style={{ color: '#fff' }} />
                  </div>
                </div>
              ))}

              {/* destination pins */}
              {[
                { l: '78%', t: '32%' }, { l: '85%', t: '50%' }, { l: '72%', t: '68%' },
              ].map((p, i) => (
                <div key={i} style={{ position: 'absolute', left: p.l, top: p.t, transform: 'translate(-50%,-100%)' }}>
                  <MapPin size={26} style={{ color: AMBER, fill: '#fff6e6' }} />
                </div>
              ))}

              {/* legend */}
              <div style={{ position: 'absolute', left: 16, bottom: 16, display: 'flex', gap: 14, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.85)', backdropFilter: 'blur(6px)', border: `1px solid ${LINE}`, fontSize: 11, fontWeight: 600, color: SLATE }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT }} /> En route</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN }} /> Arriving</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={11} style={{ color: AMBER }} /> Sites</span>
              </div>
            </div>
          </div>

          {/* Routing schematic */}
          <div className="do-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Activity size={17} style={{ color: ACCENT }} />
                <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: INK }}>Live Routing</h3>
              </div>
              <span style={{ fontSize: 11.5, color: SLATE, fontWeight: 600 }}>Plant → Sites</span>
            </div>

            {/* mini flow header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 12px', borderRadius: 12, background: ACCENT_SOFT, border: '1px solid #dbe6ff' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 800, color: ACCENT }}>
                <Factory size={14} /> PLANT
              </span>
              <div style={{ flex: 1, height: 2, borderTop: `2px dashed ${ACCENT}`, opacity: .5 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: BLUE }}>4 EN ROUTE</span>
              <div style={{ flex: 1, height: 2, borderTop: `2px dashed ${AMBER}`, opacity: .5 }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 800, color: AMBER }}>
                <Navigation size={14} /> SITES
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {transitMixers.map((m) => (
                <div key={m.veh} className="do-hover" style={{ padding: '12px 13px', borderRadius: 12, border: `1px solid ${LINE}`, background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: '#e0f2fe', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Truck size={14} style={{ color: BLUE }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, fontFamily: 'monospace' }}>{m.veh}</div>
                        <div style={{ fontSize: 11, color: SLATE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.driver} · {m.site}</div>
                      </div>
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 800, color: BLUE, background: '#e0f2fe', padding: '3px 7px', borderRadius: 999, letterSpacing: '.3px' }}>EN ROUTE</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 999, background: '#eef2f7', overflow: 'hidden' }}>
                      <div style={{ width: `${m.pct}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg,${ACCENT},${BLUE})` }} />
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: SLATE, whiteSpace: 'nowrap' }}>ETA {m.eta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Lower grid ===== */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 18 }}>

          {/* Recent dispatch */}
          <div className="do-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${LINE}` }}>
              <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: INK }}>Recent Dispatch</h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: ACCENT, cursor: 'pointer' }}>
                View all <ArrowRight size={13} />
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: SLATE }}>
                  {['Challan', 'Client', 'Vehicle', 'Grade', 'Qty', 'Status'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', background: '#fafbfd' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentDispatch.map((r) => (
                  <tr key={r.no} style={{ borderTop: `1px solid ${LINE}` }}>
                    <td style={{ padding: '11px 14px', fontWeight: 800, color: ACCENT, fontFamily: 'monospace' }}>#{r.no}</td>
                    <td style={{ padding: '11px 14px', color: INK, fontWeight: 600 }}>{r.client}</td>
                    <td style={{ padding: '11px 14px', color: SLATE, fontFamily: 'monospace', fontSize: 11.5 }}>{r.veh}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT, background: ACCENT_SOFT, padding: '2px 7px', borderRadius: 6 }}>{r.grade}</span>
                    </td>
                    <td style={{ padding: '11px 14px', color: INK, fontWeight: 600 }}>{r.qty} m³</td>
                    <td style={{ padding: '11px 14px' }}><StatusPill status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Active orders */}
          <div className="do-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: INK }}>Active Orders</h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: ACCENT, cursor: 'pointer' }}>
                All <ChevronRight size={13} />
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeOrders.map((o) => (
                <div key={o.no} className="do-hover" style={{ padding: '12px 13px', borderRadius: 12, border: `1px solid ${LINE}`, background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: ACCENT, fontFamily: 'monospace' }}>{o.no}</span>
                    <StatusPill status={o.status} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.client}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: SLATE, background: '#f1f5f9', padding: '2px 7px', borderRadius: 6 }}>{o.grade}</span>
                    <span style={{ fontSize: 11.5, color: SLATE }}>{o.qty} m³</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity feed */}
          <div className="do-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={16} style={{ color: ACCENT }} />
                <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: INK }}>Activity</h3>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: GREEN, background: '#dcfce7', padding: '3px 8px', borderRadius: 999 }}>LIVE</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {feed.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 11, paddingBottom: i === feed.length - 1 ? 0 : 14, position: 'relative' }}>
                  {i !== feed.length - 1 && (
                    <span style={{ position: 'absolute', left: 14, top: 30, bottom: 0, width: 1, background: LINE }} />
                  )}
                  <div style={{ width: 29, height: 29, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: `${f.tone}16`, zIndex: 1 }}>
                    <f.icon size={14} style={{ color: f.tone }} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{f.title}</div>
                      <span style={{ fontSize: 10.5, color: SLATE, flexShrink: 0 }}>{f.time}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: SLATE, marginTop: 2 }}>{f.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
