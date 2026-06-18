import {
  TrendingUp, Clock, Truck, Users, IndianRupee, ArrowRight, ArrowUpRight,
  ClipboardList, UserPlus, Printer, Radio, CarFront, Boxes, Monitor,
  Settings, Navigation, AlertCircle, Factory, MapPin, Bell, CheckCircle2,
  Plus, Activity, Zap, Gauge, ChevronRight,
} from 'lucide-react';

const FONT_LINK =
  'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap';

// ── Aurora palette, tuned for a LIGHT surface (kept legible) ──
const GOLD = '#d68a0a';
const GOLD_HI = '#f5b942';
const CYAN = '#0e9aa7';
const CYAN_HI = '#3ee6e0';
const GREEN = '#15a06a';
const BLUE = '#2a83d6';
const AMBER = '#d97706';
const RED = '#e11d57';
const VIOLET = '#8b6df0';

const INK = '#0f172a';
const SLATE = '#5a6b85';

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Frosted light-glass card ──
const glassCard: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.78), rgba(255,255,255,0.55))',
  border: '1px solid rgba(255,255,255,0.85)',
  borderRadius: 20,
  backdropFilter: 'blur(20px) saturate(140%)',
  WebkitBackdropFilter: 'blur(20px) saturate(140%)',
  boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 18px 44px -22px rgba(30,41,90,0.28), 0 2px 8px -4px rgba(30,41,90,0.12)',
};

const stats: { label: string; value: string; unit?: string; sub: string; icon: typeof TrendingUp; color: string; delta?: string }[] = [
  { label: 'Today Dispatch', value: '212.5', unit: 'm³', sub: '34 challans', icon: TrendingUp, color: GREEN, delta: '+12.4%' },
  { label: 'Active Orders', value: '18', sub: '6 pending', icon: Clock, color: GOLD, delta: '+3' },
  { label: 'Online Challans', value: '7', sub: 'in transit now', icon: Radio, color: CYAN },
  { label: 'Clients', value: '146', sub: 'accounts', icon: Users, color: BLUE, delta: '+5' },
  { label: 'Driver / TM Status', value: '8/12', sub: '2 in maintenance', icon: CarFront, color: VIOLET },
  { label: 'Today Production', value: '248.0', unit: 'm³', sub: '41 batches', icon: Boxes, color: BLUE },
  { label: 'Outstanding', value: '₹38.6', unit: 'L', sub: 'receivables', icon: IndianRupee, color: RED, delta: '-2.3%' },
];

const quickActions = [
  { label: 'New Challan', sub: 'Dispatch concrete', icon: Truck, color: GREEN },
  { label: 'New Order', sub: 'Book a pour', icon: ClipboardList, color: GOLD },
  { label: 'Add Client', sub: 'Onboard account', icon: UserPlus, color: BLUE },
  { label: 'Print Report', sub: 'Daily summary', icon: Printer, color: AMBER },
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
  { no: 'ORD-2291', client: 'Shapoorji Pallonji', grade: 'M40', qty: 36, done: 15, status: 'in_progress' },
  { no: 'ORD-2290', client: 'L&T Construction', grade: 'M30', qty: 48, done: 18, status: 'in_progress' },
  { no: 'ORD-2289', client: 'Kalpataru Group', grade: 'M25', qty: 24, done: 6, status: 'pending' },
  { no: 'ORD-2288', client: 'Godrej Properties', grade: 'M35', qty: 30, done: 18, status: 'pending' },
];

const feed = [
  { color: GREEN, icon: CheckCircle2, title: 'Challan #0040 delivered', sub: 'Godrej · M35 · 6 m³', time: '2m' },
  { color: CYAN, icon: Truck, title: 'Challan #0042 dispatched', sub: 'Shapoorji · M40 · 7 m³', time: '8m' },
  { color: GOLD, icon: Clock, title: 'Order ORD-2289 awaiting dispatch', sub: 'Kalpataru · M25 · 24 m³', time: '17m' },
  { color: BLUE, icon: Boxes, title: 'Batch B-2204 completed', sub: 'M30 · 8 m³ · Plant A', time: '24m' },
  { color: RED, icon: AlertCircle, title: 'MH-46-AB-4455 flagged maintenance', sub: 'Brake service due', time: '41m' },
];

const statusMap: Record<string, { c: string; label: string }> = {
  dispatched: { c: CYAN, label: 'In Transit' },
  delivered: { c: GREEN, label: 'Delivered' },
  pending: { c: GOLD, label: 'Pending' },
  in_progress: { c: BLUE, label: 'In Progress' },
};

function StatusPill({ status }: { status: string }) {
  const s = statusMap[status] ?? statusMap.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
      fontSize: 11, fontWeight: 800, color: s.c, background: hexA(s.c, 0.13),
      border: `1px solid ${hexA(s.c, 0.28)}`, letterSpacing: '.2px',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.c }} />
      {s.label}
    </span>
  );
}

export function DaylightGlass() {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div
      className="font-['Inter'] relative"
      style={{ minHeight: '100vh', background: '#eef2f9', color: INK, overflow: 'hidden' }}
    >
      <link rel="stylesheet" href={FONT_LINK} />
      <style>{`
        @keyframes dg-pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(2.6);opacity:0} }
        @keyframes dg-dash { to { stroke-dashoffset: -120; } }
        @keyframes dg-float { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-4px) } }
        @keyframes dg-spin { to { transform: rotate(360deg); } }
        @keyframes dg-drift  { 0%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(4%,-3%,0) scale(1.12)} 100%{transform:translate3d(0,0,0) scale(1)} }
        @keyframes dg-drift2 { 0%{transform:translate3d(0,0,0) scale(1.05)} 50%{transform:translate3d(-5%,4%,0) scale(1)} 100%{transform:translate3d(0,0,0) scale(1.05)} }
        @keyframes dg-shimmer { 0%{ background-position:-200% 0 } 100%{ background-position:200% 0 } }
        .dg-shimmer {
          background: linear-gradient(110deg, ${GOLD}, ${GOLD_HI} 45%, ${GOLD});
          background-size: 200% 100%;
          animation: dg-shimmer 5s linear infinite;
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .dg-hover { transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease; }
        .dg-hover:hover {
          transform: translateY(-3px);
          border-color: ${hexA(GOLD, 0.55)};
          box-shadow: 0 1px 0 rgba(255,255,255,0.95) inset, 0 26px 56px -24px rgba(30,41,90,0.36), 0 0 0 1px ${hexA(GOLD, 0.2)};
        }
        .dg-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .dg-scroll::-webkit-scrollbar-thumb { background: rgba(30,41,90,0.18); border-radius: 99px; }
      `}</style>

      {/* ===== Light aurora / mesh background ===== */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '-16%', left: '-6%', width: '52%', height: '58%',
          background: `radial-gradient(circle at center, ${hexA(GOLD_HI, 0.38)}, transparent 62%)`,
          filter: 'blur(80px)', animation: 'dg-drift 20s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', top: '-12%', right: '-10%', width: '50%', height: '56%',
          background: `radial-gradient(circle at center, ${hexA(CYAN_HI, 0.32)}, transparent 60%)`,
          filter: 'blur(90px)', animation: 'dg-drift2 24s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-24%', left: '24%', width: '56%', height: '60%',
          background: `radial-gradient(circle at center, ${hexA(VIOLET, 0.22)}, transparent 62%)`,
          filter: 'blur(100px)', animation: 'dg-drift 28s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(30,41,90,0.05) 1px, transparent 1px)',
          backgroundSize: '34px 34px', opacity: 0.6,
        }} />
      </div>

      <div className="relative z-10" style={{ maxWidth: 1340, margin: '0 auto', padding: '28px 32px 48px' }}>

        {/* ===== Header ===== */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h1 className="font-['Sora']" style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: INK }}>
                Command <span className="dg-shimmer">Center</span>
              </h1>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 999,
                background: hexA(RED, 0.1), border: `1px solid ${hexA(RED, 0.3)}`,
              }}>
                <span style={{ position: 'relative', display: 'inline-flex', width: 7, height: 7 }}>
                  <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: RED, animation: 'dg-pulse 1.8s ease-out infinite' }} />
                  <span style={{ position: 'relative', width: 7, height: 7, borderRadius: '50%', background: RED }} />
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.6px', color: RED }}>LIVE</span>
              </span>
            </div>
            <p style={{ margin: 0, color: SLATE, fontSize: 13.5, fontWeight: 500 }}>
              Welcome back, <span style={{ color: INK, fontWeight: 700 }}>Rajesh</span> · {today}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button className="dg-hover" style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 12, cursor: 'pointer',
              background: hexA(BLUE, 0.1), border: `1px solid ${hexA(BLUE, 0.3)}`, color: BLUE, fontSize: 12.5, fontWeight: 700,
            }}>
              <ClipboardList size={15} /> Shift Report
            </button>
            <button className="dg-hover" style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 12, cursor: 'pointer',
              background: hexA(GOLD, 0.12), border: `1px solid ${hexA(GOLD, 0.32)}`, color: GOLD, fontSize: 12.5, fontWeight: 700,
            }}>
              <Monitor size={15} /> Control Room
            </button>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 15px', borderRadius: 12,
              background: hexA(GREEN, 0.12), border: `1px solid ${hexA(GREEN, 0.3)}`,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, boxShadow: `0 0 10px ${GREEN}` }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#0f7a52', letterSpacing: '.3px' }}>PLANT ONLINE</span>
            </div>
          </div>
        </header>

        {/* ===== Needs Dispatch band ===== */}
        <section className="dg-hover" style={{ ...glassCard, padding: 20, marginBottom: 22, borderColor: hexA(GOLD, 0.4) }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: hexA(GOLD, 0.14), border: `1px solid ${hexA(GOLD, 0.28)}` }}>
                <AlertCircle size={18} style={{ color: GOLD }} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: INK }}>Needs Dispatch</h2>
                <p style={{ margin: 0, fontSize: 12, color: SLATE }}>Orders waiting on a mixer assignment</p>
              </div>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 800, padding: '5px 11px', borderRadius: 999, color: GOLD, background: hexA(GOLD, 0.14), border: `1px solid ${hexA(GOLD, 0.28)}` }}>
              {needsDispatch.length} orders waiting
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
            {needsDispatch.map((o) => (
              <div key={o.client + o.site} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '14px 15px', borderRadius: 14,
                background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.8) inset',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {o.client}
                  </div>
                  <div style={{ fontSize: 11.5, color: SLATE, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.site}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: CYAN, background: hexA(CYAN, 0.12), border: `1px solid ${hexA(CYAN, 0.25)}`, padding: '2px 7px', borderRadius: 6 }}>{o.grade}</span>
                    <span style={{ fontSize: 11.5, color: SLATE }}>{o.ordered} m³ ordered</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: GOLD }}>{o.remaining} m³ left</span>
                  </div>
                </div>
                <button className="dg-hover" style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  padding: '9px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 800, color: '#1a1205',
                  background: `linear-gradient(135deg, ${GOLD_HI}, ${GOLD})`, border: 'none',
                  boxShadow: `0 8px 18px -8px ${hexA(GOLD, 0.7)}`,
                }}>
                  <Truck size={14} /> Assign Truck
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ===== Quick actions ===== */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 14, marginBottom: 22 }}>
          {quickActions.map((a) => (
            <button key={a.label} className="dg-hover" style={{
              ...glassCard, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: hexA(a.color, 0.14), border: `1px solid ${hexA(a.color, 0.28)}` }}>
                <a.icon size={20} style={{ color: a.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>{a.label}</div>
                <div style={{ fontSize: 11.5, color: SLATE, display: 'flex', alignItems: 'center', gap: 4 }}>{a.sub} <ArrowRight size={11} /></div>
              </div>
              <Plus size={16} style={{ color: SLATE, flexShrink: 0 }} />
            </button>
          ))}
        </section>

        {/* ===== KPI stat cards ===== */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 22 }}>
          {stats.map((s) => (
            <div key={s.label} className="dg-hover" style={{ ...glassCard, padding: 18, position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`, opacity: 0.9,
              }} />
              <div style={{
                position: 'absolute', top: -30, right: -30, width: 110, height: 110, borderRadius: '50%',
                background: `radial-gradient(circle, ${hexA(s.color, 0.16)}, transparent 70%)`,
              }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, position: 'relative' }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: hexA(s.color, 0.14), border: `1px solid ${hexA(s.color, 0.26)}` }}>
                  <s.icon size={17} style={{ color: s.color }} />
                </div>
                {s.delta && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
                    color: s.delta.startsWith('-') ? RED : GREEN,
                    background: s.delta.startsWith('-') ? hexA(RED, 0.12) : hexA(GREEN, 0.12),
                  }}>
                    <ArrowUpRight size={11} style={{ transform: s.delta.startsWith('-') ? 'rotate(90deg)' : 'none' }} />
                    {s.delta.replace('-', '')}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: SLATE, fontWeight: 600, marginBottom: 5, position: 'relative' }}>{s.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, position: 'relative' }}>
                <span className="font-['Sora']" style={{ fontSize: 28, fontWeight: 800, color: INK, lineHeight: 1, letterSpacing: '-.5px' }}>{s.value}</span>
                {s.unit && <span style={{ fontSize: 14, fontWeight: 700, color: SLATE }}>{s.unit}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: SLATE, marginTop: 6, position: 'relative' }}>{s.sub}</div>
            </div>
          ))}
        </section>

        {/* ===== Live Routing Schematic ===== */}
        <section style={{ ...glassCard, padding: 24, marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 800, color: INK }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', background: hexA(CYAN, 0.14), border: `1px solid ${hexA(CYAN, 0.28)}` }}>
                <Radio size={16} style={{ color: CYAN }} />
              </span>
              Live Routing Schematic
            </h2>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: SLATE, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: CYAN, boxShadow: `0 0 8px ${CYAN}` }} />
              {transitMixers.length} mixers in transit
            </span>
          </div>

          <div style={{ display: 'grid', alignItems: 'center', gap: 16, gridTemplateColumns: 'auto 1fr auto' }}>
            {/* Plant node */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 80, height: 80, borderRadius: 22, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.6)', border: `2px solid ${hexA(CYAN, 0.45)}`, boxShadow: `0 0 30px -6px ${hexA(CYAN, 0.4)}` }}>
                <Factory size={32} style={{ color: CYAN }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.5px', color: INK }}>PLANT A</div>
                <div style={{ fontSize: 10, fontWeight: 800, color: GREEN }}>OPERATIONAL</div>
              </div>
            </div>

            {/* Transit mixers */}
            <div style={{ position: 'relative', padding: '0 8px' }}>
              <svg style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', width: '100%', height: 24 }} preserveAspectRatio="none" viewBox="0 0 100 10">
                <line x1="0" y1="5" x2="100" y2="5" stroke={hexA(CYAN, 0.45)} strokeWidth="0.6"
                  strokeDasharray="4 3" style={{ animation: 'dg-dash 3s linear infinite' }} />
              </svg>
              <div style={{ position: 'relative', display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(215px,1fr))' }}>
                {transitMixers.map((m, i) => (
                  <div key={m.veh} className="dg-hover" style={{
                    borderRadius: 16, padding: 14,
                    background: 'rgba(255,255,255,0.72)', border: `1px solid ${hexA(CYAN, 0.32)}`,
                    boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 0 14px 30px -18px rgba(30,41,90,0.3)',
                    animation: 'dg-float 4s ease-in-out infinite', animationDelay: `${i * 0.3}s`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <Truck size={14} style={{ color: CYAN, flexShrink: 0 }} />
                        <span className="font-['Space_Grotesk']" style={{ fontWeight: 700, fontSize: 12.5, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.veh}</span>
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.4px', padding: '3px 7px', borderRadius: 999, flexShrink: 0, color: CYAN, background: hexA(CYAN, 0.14), border: `1px solid ${hexA(CYAN, 0.28)}` }}>EN ROUTE</span>
                    </div>
                    <div style={{ fontSize: 11, color: SLATE, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.driver} · {m.grade}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: SLATE, marginBottom: 8 }}>
                      <MapPin size={11} style={{ color: GOLD }} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.site}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: 'rgba(30,41,90,0.1)' }}>
                      <div style={{ width: `${m.pct}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${CYAN}, ${GREEN})` }} />
                    </div>
                    <div style={{ fontSize: 10, color: SLATE, marginTop: 6 }}>ETA <span style={{ fontWeight: 700, color: GREEN }}>{m.eta}</span></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sites node */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.6)', border: `2px dashed ${hexA(GOLD, 0.6)}`, boxShadow: `0 0 30px -8px ${hexA(GOLD, 0.5)}` }}>
                <Navigation size={26} style={{ color: GOLD }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.5px', color: INK }}>SITES</div>
                <div style={{ fontSize: 10, fontWeight: 800, color: GOLD }}>POURING</div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Live GPS map hero ===== */}
        <section style={{ ...glassCard, padding: 0, marginBottom: 22, overflow: 'hidden' }}>
          <div style={{ position: 'relative', height: 320, background: 'linear-gradient(135deg,#f0f5fc 0%,#eaf1fb 55%,#f2eefb 100%)', overflow: 'hidden' }}>
            {/* map grid */}
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.7 }}>
              <defs>
                <pattern id="dg-grid" width="46" height="46" patternUnits="userSpaceOnUse">
                  <path d="M46 0H0V46" fill="none" stroke="rgba(42,131,214,0.1)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dg-grid)" />
            </svg>

            {/* route lines */}
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} preserveAspectRatio="none" viewBox="0 0 1000 320">
              <path d="M120,240 C300,170 420,260 560,160 S820,100 900,130" fill="none"
                stroke={hexA(CYAN, 0.85)} strokeWidth="2.5" strokeDasharray="9 7" style={{ animation: 'dg-dash 4s linear infinite' }} />
              <path d="M120,240 C260,260 360,130 520,210 S760,270 880,220" fill="none"
                stroke={hexA(GOLD, 0.8)} strokeWidth="2.5" strokeDasharray="9 7" style={{ animation: 'dg-dash 5s linear infinite' }} />
              <path d="M120,240 C320,310 500,190 640,260 S840,310 920,260" fill="none"
                stroke={hexA(VIOLET, 0.7)} strokeWidth="2" strokeDasharray="6 6" style={{ animation: 'dg-dash 6s linear infinite' }} />
            </svg>

            {/* plant marker */}
            <div style={{ position: 'absolute', left: '11%', top: '74%' }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.9)', border: `1.5px solid ${CYAN}`, boxShadow: `0 0 24px ${hexA(CYAN, 0.5)}` }}>
                <Factory size={20} style={{ color: CYAN }} />
              </div>
            </div>

            {/* truck markers */}
            {[
              { l: '54%', t: '49%', c: CYAN, label: 'MH-12-AB-1234', eta: '14m' },
              { l: '88%', t: '38%', c: GREEN, label: 'MH-12-DX-7788', eta: '9m' },
              { l: '50%', t: '66%', c: GOLD, label: 'MH-14-CU-0813', eta: '26m' },
            ].map((m) => (
              <div key={m.label} style={{ position: 'absolute', left: m.l, top: m.t, transform: 'translate(-50%,-50%)' }}>
                <div style={{ position: 'relative', animation: 'dg-float 3.5s ease-in-out infinite' }}>
                  <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: m.c, opacity: 0.3, animation: 'dg-pulse 2.2s ease-out infinite' }} />
                  <div style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#fff', border: `2px solid ${m.c}`, boxShadow: `0 6px 16px -4px ${hexA(m.c, 0.7)}` }}>
                    <Truck size={15} style={{ color: m.c }} />
                  </div>
                  <div className="font-['Space_Grotesk']" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', marginTop: 6, whiteSpace: 'nowrap', padding: '3px 8px', borderRadius: 8, fontSize: 9.5, fontWeight: 700, background: 'rgba(255,255,255,0.92)', border: `1px solid ${hexA(m.c, 0.4)}`, color: INK, boxShadow: '0 6px 14px -8px rgba(30,41,90,0.4)' }}>
                    {m.label} · {m.eta}
                  </div>
                </div>
              </div>
            ))}

            {/* destination marker */}
            <div style={{ position: 'absolute', left: '90%', top: '40%' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: hexA(GOLD, 0.16), border: `1.5px dashed ${GOLD}` }}>
                <MapPin size={16} style={{ color: GOLD }} />
              </div>
            </div>

            {/* overlay header */}
            <div style={{ position: 'absolute', top: 16, left: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.9)', boxShadow: '0 4px 12px -6px rgba(30,41,90,0.3)' }}>
                <Activity size={15} style={{ color: GREEN }} />
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>Live GPS Tracking</div>
                <div style={{ fontSize: 10.5, color: SLATE }}>Mumbai Metropolitan Region · 7 vehicles online</div>
              </div>
            </div>

            {/* overlay stats */}
            <div style={{ position: 'absolute', bottom: 16, left: 20, display: 'flex', gap: 10 }}>
              {[
                { icon: Zap, label: 'Avg speed', val: '34 km/h', c: CYAN },
                { icon: Gauge, label: 'On-time', val: '94%', c: GREEN },
                { icon: MapPin, label: 'Coverage', val: '12 sites', c: GOLD },
              ].map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', boxShadow: '0 6px 16px -10px rgba(30,41,90,0.35)' }}>
                  <s.icon size={14} style={{ color: s.c }} />
                  <div>
                    <div style={{ fontSize: 9.5, color: SLATE, lineHeight: 1 }}>{s.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: INK, lineHeight: 1.3 }}>{s.val}</div>
                  </div>
                </div>
              ))}
            </div>

            <button style={{ position: 'absolute', top: 16, right: 20, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', background: hexA(GOLD, 0.14), border: `1px solid ${hexA(GOLD, 0.4)}`, color: GOLD }}>
              <Navigation size={13} /> Full Map
            </button>
          </div>
        </section>

        {/* ===== Lower grid ===== */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.95fr 0.95fr', gap: 18 }}>

          {/* Recent dispatch */}
          <div style={{ ...glassCard, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: INK }}>Recent Dispatch</h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: CYAN, cursor: 'pointer' }}>
                View all <ArrowRight size={13} />
              </span>
            </div>
            <div className="dg-scroll" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ color: SLATE }}>
                    {['Challan', 'Client', 'Vehicle', 'Grade', 'Qty', 'Status'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '0 8px 10px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid rgba(30,41,90,0.1)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentDispatch.map((r) => (
                    <tr key={r.no} style={{ borderBottom: '1px solid rgba(30,41,90,0.06)' }}>
                      <td className="font-['Space_Grotesk']" style={{ padding: '10px 8px', fontWeight: 800, color: GOLD }}>#{r.no}</td>
                      <td style={{ padding: '10px 8px', color: INK, fontWeight: 600 }}>{r.client}</td>
                      <td className="font-['Space_Grotesk']" style={{ padding: '10px 8px', color: SLATE, fontSize: 11.5 }}>{r.veh}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: CYAN, background: hexA(CYAN, 0.12), border: `1px solid ${hexA(CYAN, 0.25)}`, padding: '2px 7px', borderRadius: 6 }}>{r.grade}</span>
                      </td>
                      <td style={{ padding: '10px 8px', color: INK, fontWeight: 600 }}>{r.qty} m³</td>
                      <td style={{ padding: '10px 8px' }}><StatusPill status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active orders */}
          <div style={{ ...glassCard, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: INK }}>Active Orders</h3>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: CYAN, cursor: 'pointer' }}>
                All <ChevronRight size={13} />
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeOrders.map((o) => {
                const pct = Math.round((o.done / o.qty) * 100);
                return (
                  <div key={o.no} style={{ padding: '12px 13px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.55)', boxShadow: '0 1px 0 rgba(255,255,255,0.8) inset' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className="font-['Space_Grotesk']" style={{ fontSize: 12, fontWeight: 800, color: GOLD }}>{o.no}</span>
                      <StatusPill status={o.status} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.client}</div>
                    <div style={{ fontSize: 11.5, color: SLATE, margin: '4px 0 8px' }}>{o.grade} · {o.done}/{o.qty} m³</div>
                    <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: 'rgba(30,41,90,0.1)' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_HI})` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity feed */}
          <div style={{ ...glassCard, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={16} style={{ color: CYAN }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: INK }}>Activity Feed</h3>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: GREEN, background: hexA(GREEN, 0.12), border: `1px solid ${hexA(GREEN, 0.25)}`, padding: '3px 8px', borderRadius: 999 }}>LIVE</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {feed.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 11, paddingBottom: i === feed.length - 1 ? 0 : 14, position: 'relative' }}>
                  {i !== feed.length - 1 && (
                    <span style={{ position: 'absolute', left: 14, top: 30, bottom: 0, width: 1, background: 'rgba(30,41,90,0.1)' }} />
                  )}
                  <div style={{ width: 29, height: 29, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: hexA(f.color, 0.14), border: `1px solid ${hexA(f.color, 0.25)}`, zIndex: 1 }}>
                    <f.icon size={14} style={{ color: f.color }} />
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

export default DaylightGlass;
