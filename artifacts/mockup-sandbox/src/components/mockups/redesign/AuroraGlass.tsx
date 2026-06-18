import {
  TrendingUp, Clock, Truck, Users, IndianRupee, ArrowRight, ArrowUpRight,
  ClipboardList, UserPlus, Printer, Radio, CarFront, Boxes, Monitor,
  Settings, Navigation, AlertCircle, Activity, MapPin, Plus, Zap, Gauge,
} from 'lucide-react';

const FONT_LINK =
  'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap';

const GOLD = '#f5b942';
const GOLD_HI = '#ffd479';
const CYAN = '#3ee6e0';
const GREEN = '#34d399';
const BLUE = '#5ab7ff';
const AMBER = '#fbbf24';
const RED = '#fb7185';
const VIOLET = '#a78bfa';

type StatColor = string;

const pendingQueue = [
  { client: 'Shapoorji Pallonji', site: 'Vasai Greens Twr-B', grade: 'M30', ordered: 120, remaining: 78 },
  { client: 'L&T Construction', site: 'Metro Line-9 Pier', grade: 'M40', ordered: 90, remaining: 54 },
  { client: 'Kalpataru Group', site: 'Immensa Wing-C', grade: 'M25', ordered: 60, remaining: 36 },
  { client: 'Godrej Properties', site: 'Hillside Phase-2', grade: 'M35', ordered: 75, remaining: 45 },
];

const stats: { label: string; value: string; sub: string; icon: typeof TrendingUp; color: StatColor; delta?: string }[] = [
  { label: 'Today Dispatch', value: '482.5', sub: 'm³ · 38 challans', icon: TrendingUp, color: GREEN, delta: '+12.4%' },
  { label: 'Active Orders', value: '24', sub: '9 pending', icon: Clock, color: GOLD, delta: '+3' },
  { label: 'Online Challans', value: '7', sub: 'in transit now', icon: Radio, color: CYAN },
  { label: 'Clients', value: '146', sub: 'accounts', icon: Users, color: BLUE, delta: '+5' },
  { label: 'Driver / TM Status', value: '8/12', sub: '2 in maintenance', icon: CarFront, color: VIOLET },
  { label: 'Today Production', value: '511.0', sub: 'm³ · 42 batches', icon: Boxes, color: BLUE },
  { label: 'Outstanding', value: '₹24.8L', sub: 'receivables', icon: IndianRupee, color: RED, delta: '-4.1%' },
];

const quickActions = [
  { label: 'New Challan', sub: 'Dispatch', icon: Truck, color: GREEN },
  { label: 'New Order', sub: 'Book volume', icon: ClipboardList, color: GOLD },
  { label: 'Add Client', sub: 'Onboard', icon: UserPlus, color: BLUE },
  { label: 'Print Report', sub: 'Shift / day', icon: Printer, color: AMBER },
];

const transit = [
  { veh: 'MH-12-AB-1234', driver: 'Ramesh Patil', site: 'Vasai Greens Twr-B', grade: 'M30', eta: '12 min', progress: 64 },
  { veh: 'MH-46-CU-0813', driver: 'Sandeep More', site: 'Metro Line-9 Pier', grade: 'M40', eta: '24 min', progress: 38 },
  { veh: 'MH-04-DX-7788', driver: 'Vinod Shinde', site: 'Immensa Wing-C', grade: 'M25', eta: '6 min', progress: 82 },
  { veh: 'MH-14-GH-5521', driver: 'Akash Jadhav', site: 'Hillside Phase-2', grade: 'M35', eta: '31 min', progress: 21 },
];

type ChallanStatus = 'delivered' | 'dispatched' | 'pending';
const recentChallans: { no: string; client: string; veh: string; grade: string; qty: number; status: ChallanStatus }[] = [
  { no: 'CK-20841', client: 'Shapoorji', veh: 'MH-12-AB-1234', grade: 'M30', qty: 6, status: 'dispatched' },
  { no: 'CK-20840', client: 'L&T', veh: 'MH-46-CU-0813', grade: 'M40', qty: 7, status: 'dispatched' },
  { no: 'CK-20839', client: 'Kalpataru', veh: 'MH-04-DX-7788', grade: 'M25', qty: 6, status: 'delivered' },
  { no: 'CK-20838', client: 'Godrej', veh: 'MH-14-GH-5521', grade: 'M35', qty: 8, status: 'dispatched' },
  { no: 'CK-20837', client: 'Lodha', veh: 'MH-02-KL-9090', grade: 'M30', qty: 6, status: 'delivered' },
  { no: 'CK-20836', client: 'Raymond', veh: 'MH-43-PQ-3311', grade: 'M20', qty: 5, status: 'pending' },
];

const activeOrders = [
  { no: 'ORD-3391', client: 'Shapoorji Pallonji', grade: 'M30', qty: 120, done: 42, status: 'in_progress' },
  { no: 'ORD-3390', client: 'L&T Construction', grade: 'M40', qty: 90, done: 36, status: 'in_progress' },
  { no: 'ORD-3388', client: 'Kalpataru Group', grade: 'M25', qty: 60, done: 24, status: 'pending' },
  { no: 'ORD-3385', client: 'Godrej Properties', grade: 'M35', qty: 75, done: 30, status: 'in_progress' },
];

const feed = [
  { color: GREEN, icon: Truck, title: 'Challan #CK-20839 · Delivered', sub: 'Kalpataru · M25 · 6 m³', time: '2m' },
  { color: CYAN, icon: Navigation, title: 'MH-04-DX-7788 reached site', sub: 'Immensa Wing-C · pouring started', time: '8m' },
  { color: GOLD, icon: ClipboardList, title: 'Order ORD-3388 · Pending', sub: 'Kalpataru · M25 · 60 m³', time: '15m' },
  { color: BLUE, icon: Boxes, title: 'Batch #B-4421 produced', sub: 'M40 · 7.0 m³ · plant Alpha', time: '22m' },
  { color: RED, icon: AlertCircle, title: 'TM MH-09-RT-1200 in maintenance', sub: 'Gearbox check · ETA 2h', time: '40m' },
];

function statusMeta(s: ChallanStatus | string): { color: string; label: string } {
  switch (s) {
    case 'delivered': return { color: GREEN, label: 'Delivered' };
    case 'dispatched': return { color: CYAN, label: 'In Transit' };
    case 'in_progress': return { color: BLUE, label: 'In Progress' };
    case 'pending': return { color: GOLD, label: 'Pending' };
    default: return { color: '#94a3b8', label: s };
  }
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const glassCard: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(30,38,66,0.66), rgba(16,21,40,0.5))',
  border: '1px solid rgba(255,255,255,0.09)',
  borderRadius: 20,
  backdropFilter: 'blur(22px)',
  WebkitBackdropFilter: 'blur(22px)',
  boxShadow: '0 24px 60px -28px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.07)',
};

export function AuroraGlass() {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div
      className="font-['Sora'] text-slate-200 min-h-screen w-full relative"
      style={{ background: '#070a14', overflow: 'hidden' }}
    >
      <link rel="stylesheet" href={FONT_LINK} />
      <style>{`
        @keyframes auroraDrift {
          0%   { transform: translate3d(0,0,0) scale(1); }
          50%  { transform: translate3d(4%, -3%, 0) scale(1.12); }
          100% { transform: translate3d(0,0,0) scale(1); }
        }
        @keyframes auroraDrift2 {
          0%   { transform: translate3d(0,0,0) scale(1.05); }
          50%  { transform: translate3d(-5%, 4%, 0) scale(1); }
          100% { transform: translate3d(0,0,0) scale(1.05); }
        }
        @keyframes livePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes dashFlow { to { stroke-dashoffset: -120; } }
        @keyframes spinSlow { to { transform: rotate(360deg); } }
        @keyframes truckBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .ag-shimmer {
          background: linear-gradient(110deg, ${GOLD_HI}, ${GOLD} 45%, ${GOLD_HI});
          background-size: 200% 100%;
          animation: shimmer 5s linear infinite;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .ag-hover { transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
        .ag-hover:hover { transform: translateY(-3px); border-color: ${hexA(GOLD, 0.45)}; box-shadow: 0 30px 70px -30px rgba(0,0,0,0.8), 0 0 0 1px ${hexA(GOLD, 0.18)}; }
        .ag-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .ag-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 99px; }
      `}</style>

      {/* ===== Aurora / mesh background ===== */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '-18%', left: '-8%', width: '52%', height: '60%',
          background: `radial-gradient(circle at center, ${hexA(VIOLET, 0.5)}, transparent 62%)`,
          filter: 'blur(70px)', animation: 'auroraDrift 18s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', top: '-10%', right: '-12%', width: '50%', height: '58%',
          background: `radial-gradient(circle at center, ${hexA(CYAN, 0.34)}, transparent 60%)`,
          filter: 'blur(80px)', animation: 'auroraDrift2 22s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-22%', left: '20%', width: '55%', height: '60%',
          background: `radial-gradient(circle at center, ${hexA(GOLD, 0.28)}, transparent 62%)`,
          filter: 'blur(90px)', animation: 'auroraDrift 26s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '34px 34px', opacity: 0.5,
        }} />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-7 py-7">
        {/* ===== Header ===== */}
        <header className="flex items-start justify-between gap-4 flex-wrap mb-7">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-[34px] font-extrabold tracking-tight text-white leading-none">
                Command <span className="ag-shimmer">Center</span>
              </h1>
              {/* LIVE badge */}
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{ background: hexA(RED, 0.12), border: `1px solid ${hexA(RED, 0.35)}` }}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full"
                    style={{ background: RED, animation: 'livePulse 1.8s ease-out infinite' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: RED }} />
                </span>
                <span className="text-[11px] font-bold tracking-widest" style={{ color: RED }}>LIVE</span>
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Welcome back, <span className="text-slate-200 font-semibold">Rahul</span> · {today}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button className="ag-hover flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold tracking-wide"
              style={{ background: hexA(BLUE, 0.1), border: `1px solid ${hexA(BLUE, 0.32)}`, color: BLUE }}>
              <ClipboardList size={15} /> SHIFT REPORT
            </button>
            <button className="ag-hover flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold tracking-wide"
              style={{ background: hexA(GOLD, 0.1), border: `1px solid ${hexA(GOLD, 0.32)}`, color: GOLD }}>
              <Monitor size={15} /> CONTROL ROOM
            </button>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ background: hexA(GREEN, 0.1), border: `1px solid ${hexA(GREEN, 0.3)}` }}>
              <span className="h-2 w-2 rounded-full" style={{ background: GREEN, boxShadow: `0 0 10px ${GREEN}` }} />
              <span className="text-[12px] font-bold tracking-wide" style={{ color: GREEN }}>PLANT ONLINE</span>
            </div>
          </div>
        </header>

        {/* ===== Needs Dispatch band ===== */}
        <section className="mb-6 ag-hover" style={{ ...glassCard, padding: 20, borderColor: hexA(GOLD, 0.3) }}>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h2 className="flex items-center gap-2.5 text-[15px] font-bold text-white">
              <span className="grid place-items-center h-8 w-8 rounded-lg" style={{ background: hexA(GOLD, 0.14) }}>
                <AlertCircle size={16} style={{ color: GOLD }} />
              </span>
              Needs Dispatch
            </h2>
            <span className="text-[11px] font-bold px-3 py-1.5 rounded-full"
              style={{ color: GOLD, background: hexA(GOLD, 0.14) }}>
              {pendingQueue.length} orders waiting
            </span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))' }}>
            {pendingQueue.map((q) => (
              <div key={q.client} className="flex items-center justify-between gap-3 rounded-2xl p-3.5"
                style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold text-white truncate">{q.client}</div>
                  <div className="text-[11.5px] text-slate-400 truncate">{q.site}</div>
                  <div className="text-[11.5px] mt-1.5 text-slate-400">
                    <span className="font-bold text-slate-200">{q.grade}</span> · ordered {q.ordered} m³ ·{' '}
                    <span className="font-bold" style={{ color: GOLD }}>{q.remaining} m³ left</span>
                  </div>
                </div>
                <button className="ag-hover flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[12px] font-extrabold"
                  style={{ color: '#1a1205', background: `linear-gradient(135deg, ${GOLD_HI}, ${GOLD})`, boxShadow: `0 8px 20px -8px ${hexA(GOLD, 0.7)}` }}>
                  <Truck size={14} /> Assign Truck
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ===== Quick actions ===== */}
        <section className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
          {quickActions.map((a) => (
            <button key={a.label} className="ag-hover text-left flex items-center gap-3.5 p-4" style={{ ...glassCard }}>
              <span className="grid place-items-center h-11 w-11 rounded-xl flex-shrink-0"
                style={{ background: hexA(a.color, 0.14), border: `1px solid ${hexA(a.color, 0.3)}` }}>
                <a.icon size={20} style={{ color: a.color }} />
              </span>
              <div className="min-w-0">
                <div className="text-[14.5px] font-bold text-white flex items-center gap-1.5">{a.label}</div>
                <div className="text-[11.5px] text-slate-400 flex items-center gap-1">{a.sub} <ArrowRight size={11} /></div>
              </div>
            </button>
          ))}
        </section>

        {/* ===== KPI stat cards (7) ===== */}
        <section className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(186px, 1fr))' }}>
          {stats.map((s) => (
            <div key={s.label} className="ag-hover relative overflow-hidden p-5" style={{ ...glassCard }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`, opacity: 0.9,
              }} />
              <div style={{
                position: 'absolute', top: -30, right: -30, width: 110, height: 110, borderRadius: '50%',
                background: `radial-gradient(circle, ${hexA(s.color, 0.18)}, transparent 70%)`,
              }} />
              <div className="flex items-center justify-between mb-4 relative">
                <span className="grid place-items-center h-9 w-9 rounded-xl"
                  style={{ background: hexA(s.color, 0.14), border: `1px solid ${hexA(s.color, 0.28)}` }}>
                  <s.icon size={16} style={{ color: s.color }} />
                </span>
                {s.delta && (
                  <span className="flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      color: s.delta.startsWith('-') ? RED : GREEN,
                      background: s.delta.startsWith('-') ? hexA(RED, 0.12) : hexA(GREEN, 0.12),
                    }}>
                    <ArrowUpRight size={11} style={{ transform: s.delta.startsWith('-') ? 'rotate(90deg)' : 'none' }} />
                    {s.delta.replace('-', '')}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-slate-400 font-medium mb-1 relative">{s.label}</div>
              <div className="text-[30px] font-extrabold text-white leading-none tracking-tight relative">{s.value}</div>
              <div className="text-[12px] text-slate-400 mt-1.5 relative">{s.sub}</div>
            </div>
          ))}
        </section>

        {/* ===== Live Routing Schematic ===== */}
        <section className="mb-6 p-6" style={{ ...glassCard }}>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h2 className="flex items-center gap-2.5 text-[15px] font-bold text-white">
              <span className="grid place-items-center h-8 w-8 rounded-lg" style={{ background: hexA(CYAN, 0.14) }}>
                <Radio size={16} style={{ color: CYAN }} />
              </span>
              Live Routing Schematic
            </h2>
            <span className="text-[12px] text-slate-400 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: CYAN, boxShadow: `0 0 8px ${CYAN}` }} />
              {transit.length} mixers in transit
            </span>
          </div>

          <div className="grid items-center gap-4" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
            {/* Plant node */}
            <div className="flex flex-col items-center gap-2">
              <div className="grid place-items-center h-20 w-20 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: `2px solid ${hexA(CYAN, 0.4)}`, boxShadow: `0 0 30px -6px ${hexA(CYAN, 0.45)}` }}>
                <Settings size={32} style={{ color: CYAN, animation: 'spinSlow 9s linear infinite' }} />
              </div>
              <div className="text-center">
                <div className="text-[12px] font-extrabold tracking-wider text-white">PLANT ALPHA</div>
                <div className="text-[10px] font-bold" style={{ color: GREEN }}>OPERATIONAL</div>
              </div>
            </div>

            {/* Transit mixers */}
            <div className="relative px-2">
              <svg className="absolute left-0 right-0 top-1/2 -translate-y-1/2 w-full h-6" preserveAspectRatio="none" viewBox="0 0 100 10">
                <line x1="0" y1="5" x2="100" y2="5" stroke={hexA(CYAN, 0.3)} strokeWidth="0.6"
                  strokeDasharray="4 3" style={{ animation: 'dashFlow 3s linear infinite' }} />
              </svg>
              <div className="relative grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {transit.map((t, i) => (
                  <div key={t.veh} className="ag-hover rounded-2xl p-3.5"
                    style={{ background: 'rgba(16,22,40,0.82)', border: `1px solid ${hexA(CYAN, 0.3)}`, animation: 'truckBob 4s ease-in-out infinite', animationDelay: `${i * 0.3}s` }}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <Truck size={14} style={{ color: CYAN, flexShrink: 0 }} />
                        <span className="font-bold text-[12.5px] text-white truncate font-['Space_Grotesk']">{t.veh}</span>
                      </span>
                      <span className="text-[9px] font-extrabold tracking-wider px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: CYAN, background: hexA(CYAN, 0.15) }}>EN ROUTE</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mb-2">{t.driver} · {t.grade}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-300 mb-2">
                      <MapPin size={11} style={{ color: GOLD }} /> <span className="truncate">{t.site}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width: `${t.progress}%`, background: `linear-gradient(90deg, ${CYAN}, ${GREEN})` }} />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1.5">ETA <span className="font-bold" style={{ color: GREEN }}>{t.eta}</span></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sites node */}
            <div className="flex flex-col items-center gap-2">
              <div className="grid place-items-center h-16 w-16 rounded-full"
                style={{ background: 'rgba(255,255,255,0.05)', border: `2px dashed ${hexA(GOLD, 0.55)}`, boxShadow: `0 0 30px -8px ${hexA(GOLD, 0.5)}` }}>
                <Navigation size={26} style={{ color: GOLD }} />
              </div>
              <div className="text-center">
                <div className="text-[12px] font-extrabold tracking-wider text-white">SITES</div>
                <div className="text-[10px] font-bold" style={{ color: GOLD }}>POURING</div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Live GPS map hero ===== */}
        <section className="mb-6 relative overflow-hidden" style={{ ...glassCard, padding: 0 }}>
          <div className="relative" style={{ height: 300, background: 'radial-gradient(120% 120% at 30% 10%, #0e1730, #070a14 70%)' }}>
            {/* map grid */}
            <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.5 }}>
              <defs>
                <pattern id="agGrid" width="46" height="46" patternUnits="userSpaceOnUse">
                  <path d="M46 0H0V46" fill="none" stroke="rgba(94,183,255,0.08)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#agGrid)" />
            </svg>

            {/* route lines */}
            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 300">
              <path d="M120,230 C300,160 420,250 560,150 S820,90 900,120" fill="none"
                stroke={hexA(CYAN, 0.7)} strokeWidth="2.5" strokeDasharray="9 7" style={{ animation: 'dashFlow 4s linear infinite' }} />
              <path d="M120,230 C260,250 360,120 520,200 S760,260 880,210" fill="none"
                stroke={hexA(GOLD, 0.6)} strokeWidth="2.5" strokeDasharray="9 7" style={{ animation: 'dashFlow 5s linear infinite' }} />
              <path d="M120,230 C320,300 500,180 640,250 S840,300 920,250" fill="none"
                stroke={hexA(VIOLET, 0.5)} strokeWidth="2" strokeDasharray="6 6" style={{ animation: 'dashFlow 6s linear infinite' }} />
            </svg>

            {/* plant marker */}
            <div className="absolute" style={{ left: '11%', top: '74%' }}>
              <div className="grid place-items-center h-11 w-11 rounded-xl"
                style={{ background: hexA(CYAN, 0.18), border: `1.5px solid ${CYAN}`, boxShadow: `0 0 24px ${hexA(CYAN, 0.6)}` }}>
                <Settings size={20} style={{ color: CYAN }} />
              </div>
            </div>

            {/* truck markers */}
            {[
              { l: '54%', t: '49%', c: CYAN, label: 'MH-12-AB-1234', eta: '12m' },
              { l: '88%', t: '38%', c: GREEN, label: 'MH-04-DX-7788', eta: '6m' },
              { l: '50%', t: '66%', c: GOLD, label: 'MH-46-CU-0813', eta: '24m' },
            ].map((m) => (
              <div key={m.label} className="absolute" style={{ left: m.l, top: m.t, transform: 'translate(-50%,-50%)' }}>
                <div className="relative" style={{ animation: 'truckBob 3.5s ease-in-out infinite' }}>
                  <span className="absolute inset-0 rounded-full" style={{ background: m.c, opacity: 0.25, animation: 'livePulse 2.2s ease-out infinite' }} />
                  <div className="relative grid place-items-center h-9 w-9 rounded-full"
                    style={{ background: '#0b1020', border: `1.5px solid ${m.c}`, boxShadow: `0 0 16px ${hexA(m.c, 0.7)}` }}>
                    <Truck size={15} style={{ color: m.c }} />
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap px-2 py-1 rounded-lg text-[9.5px] font-bold font-['Space_Grotesk']"
                    style={{ background: 'rgba(8,12,26,0.92)', border: `1px solid ${hexA(m.c, 0.4)}`, color: '#e2e8f0' }}>
                    {m.label} · {m.eta}
                  </div>
                </div>
              </div>
            ))}

            {/* destination marker */}
            <div className="absolute" style={{ left: '90%', top: '40%' }}>
              <div className="grid place-items-center h-9 w-9 rounded-full"
                style={{ background: hexA(GOLD, 0.16), border: `1.5px dashed ${GOLD}` }}>
                <MapPin size={16} style={{ color: GOLD }} />
              </div>
            </div>

            {/* overlay header */}
            <div className="absolute top-4 left-5 flex items-center gap-2.5">
              <span className="grid place-items-center h-8 w-8 rounded-lg" style={{ background: 'rgba(8,12,26,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Activity size={15} style={{ color: GREEN }} />
              </span>
              <div>
                <div className="text-[13px] font-bold text-white">Live GPS Tracking</div>
                <div className="text-[10.5px] text-slate-400">Mumbai Metropolitan Region · 7 vehicles online</div>
              </div>
            </div>

            {/* overlay stats */}
            <div className="absolute bottom-4 left-5 flex gap-2.5">
              {[
                { icon: Zap, label: 'Avg speed', val: '34 km/h', c: CYAN },
                { icon: Gauge, label: 'On-time', val: '94%', c: GREEN },
                { icon: MapPin, label: 'Coverage', val: '12 sites', c: GOLD },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(8,12,26,0.78)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(8px)' }}>
                  <s.icon size={14} style={{ color: s.c }} />
                  <div>
                    <div className="text-[9.5px] text-slate-400 leading-none">{s.label}</div>
                    <div className="text-[13px] font-bold text-white leading-tight">{s.val}</div>
                  </div>
                </div>
              ))}
            </div>

            <button className="absolute top-4 right-5 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11.5px] font-bold"
              style={{ background: hexA(GOLD, 0.14), border: `1px solid ${hexA(GOLD, 0.35)}`, color: GOLD }}>
              <Navigation size={13} /> Full Map
            </button>
          </div>
        </section>

        {/* ===== Lower grid ===== */}
        <section className="grid gap-4" style={{ gridTemplateColumns: '1.25fr 0.9fr 0.9fr' }}>
          {/* Recent Dispatch */}
          <div className="p-5" style={{ ...glassCard }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-white">Recent Dispatch</h3>
              <span className="flex items-center gap-1 text-[12px] cursor-pointer" style={{ color: CYAN }}>View all <ArrowRight size={12} /></span>
            </div>
            <div className="overflow-x-auto ag-scroll">
              <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="text-slate-400 text-left">
                    {['Challan', 'Client', 'Vehicle', 'Grade', 'Qty', 'Status'].map((h) => (
                      <th key={h} className="font-semibold pb-2.5 px-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentChallans.map((c) => {
                    const m = statusMeta(c.status);
                    return (
                      <tr key={c.no} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="py-2.5 px-2 font-bold font-['Space_Grotesk']" style={{ color: GOLD }}>{c.no}</td>
                        <td className="py-2.5 px-2 text-slate-200">{c.client}</td>
                        <td className="py-2.5 px-2 text-slate-400 font-['Space_Grotesk'] text-[11px]">{c.veh}</td>
                        <td className="py-2.5 px-2 text-slate-200">{c.grade}</td>
                        <td className="py-2.5 px-2 text-slate-200">{c.qty} m³</td>
                        <td className="py-2.5 px-2">
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ color: m.color, background: hexA(m.color, 0.14) }}>{m.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Orders */}
          <div className="p-5" style={{ ...glassCard }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-white">Active Orders</h3>
              <span className="flex items-center gap-1 text-[12px] cursor-pointer" style={{ color: CYAN }}>View all <ArrowRight size={12} /></span>
            </div>
            <div className="flex flex-col gap-2.5">
              {activeOrders.map((o) => {
                const m = statusMeta(o.status);
                const pct = Math.round((o.done / o.qty) * 100);
                return (
                  <div key={o.no} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[12.5px] font-['Space_Grotesk']" style={{ color: GOLD }}>{o.no}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold" style={{ color: m.color, background: hexA(m.color, 0.14) }}>{m.label}</span>
                    </div>
                    <div className="text-[12px] text-slate-200 truncate">{o.client}</div>
                    <div className="text-[11px] text-slate-400 mb-2">{o.grade} · {o.done}/{o.qty} m³</div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_HI})` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notification feed */}
          <div className="p-5" style={{ ...glassCard }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-white">Activity Feed</h3>
              <span className="grid place-items-center h-6 w-6 rounded-lg cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Plus size={13} className="text-slate-300" />
              </span>
            </div>
            <div className="flex flex-col gap-3.5">
              {feed.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="grid place-items-center h-8 w-8 rounded-lg flex-shrink-0 mt-0.5"
                    style={{ background: hexA(f.color, 0.14), border: `1px solid ${hexA(f.color, 0.25)}` }}>
                    <f.icon size={14} style={{ color: f.color }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-slate-100 leading-snug">{f.title}</div>
                    <div className="text-[11px] text-slate-400 truncate">{f.sub}</div>
                  </div>
                  <span className="text-[10.5px] text-slate-500 flex-shrink-0">{f.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AuroraGlass;
