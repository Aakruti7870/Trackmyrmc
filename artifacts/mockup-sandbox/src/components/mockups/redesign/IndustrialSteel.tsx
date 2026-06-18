import {
  TrendingUp, Clock, Truck, Users, IndianRupee, ArrowRight, ArrowUpRight,
  ClipboardList, UserPlus, Printer, Radio, CarFront, Boxes, Monitor,
  Settings, Navigation, AlertTriangle, Activity, MapPin, Gauge, Plus,
  CheckCircle2, Wrench, Signal,
} from 'lucide-react';

const ORANGE = '#ff6a00';
const ORANGE_HI = '#ff8a3d';
const STEEL = '#1c2024';
const STEEL_2 = '#23282e';
const GRAPHITE = '#0e1114';
const LINE = 'rgba(255,255,255,.08)';
const GREEN = '#36d399';
const BLUE = '#3da9fc';
const AMBER = '#f5b301';
const RED = '#ff4d4d';

const FONT_LINK =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Archivo+Narrow:wght@600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap';

const DISPLAY = "'Archivo', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";

const needsDispatch = [
  { client: 'L&T Construction', site: 'Metro Line-3 · Bandra', grade: 'M40', ordered: 120, remaining: 78 },
  { client: 'Godrej Properties', site: 'Trees Phase-II · Vikhroli', grade: 'M30', ordered: 90, remaining: 54 },
  { client: 'Shapoorji Pallonji', site: 'Northern Lights · Thane', grade: 'M25', ordered: 60, remaining: 42 },
  { client: 'Kalpataru Ltd', site: 'Avana · Parel', grade: 'M35', ordered: 75, remaining: 30 },
];

const stats = [
  { label: 'Today Dispatch', value: '482', unit: 'm³', sub: '38 challans', icon: TrendingUp, color: GREEN, delta: '+12%' },
  { label: 'Active Orders', value: '17', unit: '', sub: '6 pending', icon: Clock, color: AMBER, delta: '+3' },
  { label: 'Online Challans', value: '09', unit: '', sub: 'in transit now', icon: Radio, color: BLUE, delta: 'LIVE' },
  { label: 'Clients', value: '124', unit: '', sub: 'accounts', icon: Users, color: BLUE, delta: '+5' },
  { label: 'Driver / TM Status', value: '8/12', unit: '', sub: '2 in maintenance', icon: CarFront, color: ORANGE, delta: '66%' },
  { label: 'Today Production', value: '510', unit: 'm³', sub: '41 batches', icon: Boxes, color: BLUE, delta: '+8%' },
  { label: 'Outstanding', value: '18.4', unit: 'L', sub: 'receivables', icon: IndianRupee, color: RED, delta: '₹' },
];

const quickActions = [
  { label: 'New Challan', icon: Truck, color: GREEN },
  { label: 'New Order', icon: ClipboardList, color: AMBER },
  { label: 'Add Client', icon: UserPlus, color: BLUE },
  { label: 'Print Report', icon: Printer, color: ORANGE },
];

const transit = [
  { vehicle: 'MH-12-AB-1234', driver: 'Ramesh Pawar', site: 'Metro Line-3 · Bandra', grade: 'M40', eta: '14 min' },
  { vehicle: 'MH-14-CD-7788', driver: 'Suresh Yadav', site: 'Trees Ph-II · Vikhroli', grade: 'M30', eta: '21 min' },
  { vehicle: 'MH-04-EF-5521', driver: 'Anil Gupta', site: 'Northern Lights · Thane', grade: 'M25', eta: '32 min' },
  { vehicle: 'MH-43-GH-9012', driver: 'Dinesh More', site: 'Avana · Parel', grade: 'M35', eta: '08 min' },
];

const recentDispatch = [
  { challan: 'CH-20418', client: 'L&T', vehicle: 'MH-12-AB-1234', grade: 'M40', qty: '8.0', status: 'in_transit' },
  { challan: 'CH-20417', client: 'Godrej', vehicle: 'MH-14-CD-7788', grade: 'M30', qty: '6.0', status: 'in_transit' },
  { challan: 'CH-20416', client: 'Shapoorji', vehicle: 'MH-04-EF-5521', grade: 'M25', qty: '7.0', status: 'delivered' },
  { challan: 'CH-20415', client: 'Kalpataru', vehicle: 'MH-43-GH-9012', grade: 'M35', qty: '8.0', status: 'delivered' },
  { challan: 'CH-20414', client: 'Lodha', vehicle: 'MH-12-XY-3456', grade: 'M30', qty: '6.0', status: 'pending' },
  { challan: 'CH-20413', client: 'Oberoi', vehicle: 'MH-02-PQ-1199', grade: 'M40', qty: '9.0', status: 'cancelled' },
];

const activeOrders = [
  { order: 'ORD-3391', client: 'L&T Construction', grade: 'M40', qty: 120, done: 42, status: 'in_progress' },
  { order: 'ORD-3390', client: 'Godrej Properties', grade: 'M30', qty: 90, done: 36, status: 'in_progress' },
  { order: 'ORD-3389', client: 'Shapoorji Pallonji', grade: 'M25', qty: 60, done: 18, status: 'pending' },
  { order: 'ORD-3388', client: 'Kalpataru Ltd', grade: 'M35', qty: 75, done: 45, status: 'in_progress' },
];

const feed = [
  { color: GREEN, Icon: CheckCircle2, title: 'Challan #CH-20416 · Delivered', sub: 'Shapoorji · M25 · 7.0 m³', time: '2m' },
  { color: BLUE, Icon: Truck, title: 'Challan #CH-20418 · Dispatched', sub: 'L&T · M40 · 8.0 m³', time: '6m' },
  { color: AMBER, Icon: ClipboardList, title: 'Order ORD-3391 · In Progress', sub: 'L&T · M40 · 120 m³', time: '18m' },
  { color: RED, Icon: AlertTriangle, title: 'TM MH-09-RT-4502 · Maintenance', sub: 'Drum bearing service due', time: '40m' },
  { color: BLUE, Icon: Boxes, title: 'Batch B-2208 completed', sub: 'M30 · 6.0 m³ · Plant Alpha', time: '52m' },
];

function statusMeta(s: string) {
  switch (s) {
    case 'delivered': return { label: 'DELIVERED', color: GREEN };
    case 'in_transit': return { label: 'IN TRANSIT', color: BLUE };
    case 'in_progress': return { label: 'IN PROGRESS', color: BLUE };
    case 'pending': return { label: 'PENDING', color: AMBER };
    case 'cancelled': return { label: 'CANCELLED', color: RED };
    default: return { label: s.toUpperCase(), color: '#8a929b' };
  }
}

const hazard =
  'repeating-linear-gradient(45deg, rgba(255,106,0,.9) 0 14px, rgba(20,20,20,.9) 14px 28px)';

export function IndustrialSteel() {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: GRAPHITE,
        color: '#e9edf1',
        fontFamily: DISPLAY,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      <style>{`
        @import url('${FONT_LINK}');
        @keyframes is_pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.7)} }
        @keyframes is_dash { to { stroke-dashoffset: -28; } }
        @keyframes is_spin { to { transform: rotate(360deg); } }
        @keyframes is_truck { 0%{left:2%} 100%{left:88%} }
        @keyframes is_blip { 0%,100%{opacity:.4} 50%{opacity:1} }
        .is-card { transition: transform .15s ease, border-color .15s ease; }
        .is-card:hover { transform: translateY(-2px); border-color: rgba(255,106,0,.5); }
        .is-row:hover { background: rgba(255,255,255,.03); }
        .is-scroll::-webkit-scrollbar { height:8px; width:8px; }
        .is-scroll::-webkit-scrollbar-thumb { background:#333; border-radius:0; }
      `}</style>

      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '26px 28px 60px' }}>

        {/* ============ HEADER ============ */}
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            gap: 18, flexWrap: 'wrap', marginBottom: 22,
            borderBottom: `2px solid ${LINE}`, paddingBottom: 20,
          }}
        >
          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            {/* hazard stripe accent */}
            <div style={{ width: 8, borderRadius: 2, background: hazard }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <h1 style={{
                  margin: 0, fontSize: 38, fontWeight: 900, letterSpacing: '-1px',
                  textTransform: 'uppercase', lineHeight: 1, color: '#fff',
                }}>
                  Command<span style={{ color: ORANGE }}> Center</span>
                </h1>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 9px', borderRadius: 3, background: 'rgba(255,77,77,.14)',
                  border: `1px solid ${RED}55`, fontFamily: MONO, fontSize: 11, fontWeight: 700,
                  letterSpacing: '1px', color: RED,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: RED, animation: 'is_pulse 1.4s infinite' }} />
                  LIVE
                </span>
              </div>
              <p style={{ margin: 0, color: '#8a929b', fontSize: 13, fontFamily: MONO }}>
                Welcome back, <span style={{ color: '#cfd6dd' }}>Vikram</span> · {today.toUpperCase()}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button style={btnSecondary(BLUE)}>
              <ClipboardList size={15} /> SHIFT REPORT
            </button>
            <button style={btnSecondary(AMBER)}>
              <Monitor size={15} /> CONTROL ROOM
            </button>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '9px 16px', borderRadius: 4,
              background: 'rgba(54,211,153,.10)', border: `1px solid ${GREEN}40`,
            }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: GREEN, boxShadow: `0 0 10px ${GREEN}` }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: GREEN, letterSpacing: '1px' }}>PLANT ONLINE</span>
            </div>
          </div>
        </div>

        {/* ============ NEEDS DISPATCH BAND ============ */}
        <div style={{
          marginBottom: 22, background: STEEL, border: `1px solid ${AMBER}40`,
          borderRadius: 6, overflow: 'hidden',
          boxShadow: `inset 4px 0 0 ${AMBER}`,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 18px', borderBottom: `1px solid ${LINE}`, flexWrap: 'wrap', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} style={{ color: AMBER }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase' }}>
                Needs Dispatch
              </h3>
            </div>
            <span style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 3,
              color: AMBER, background: 'rgba(245,179,1,.14)', letterSpacing: '.5px',
            }}>
              {needsDispatch.length} ORDERS WAITING
            </span>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 1,
            background: LINE,
          }}>
            {needsDispatch.map((o) => (
              <div key={o.client} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '14px 16px', background: STEEL,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {o.client}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#8a929b', marginTop: 2, fontFamily: MONO }}>
                    {o.site}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 7, alignItems: 'center' }}>
                    <span style={gradeChip(o.grade)}>{o.grade}</span>
                    <span style={{ fontSize: 11, color: '#9aa3ac', fontFamily: MONO }}>
                      {o.ordered}m³ · <span style={{ color: AMBER, fontWeight: 700 }}>{o.remaining}m³ left</span>
                    </span>
                  </div>
                </div>
                <button style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  padding: '9px 13px', borderRadius: 4, fontSize: 12, fontWeight: 800, letterSpacing: '.4px',
                  color: '#111', border: 'none', textTransform: 'uppercase',
                  background: `linear-gradient(135deg, ${ORANGE_HI}, ${ORANGE})`,
                  boxShadow: `0 4px 14px ${ORANGE}55`,
                }}>
                  <Truck size={14} /> Assign
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ============ QUICK ACTIONS ============ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginBottom: 14 }}>
          {quickActions.map(({ label, icon: Icon, color }) => (
            <div key={label} className="is-card" style={{
              display: 'flex', alignItems: 'center', gap: 13, padding: '16px 18px', cursor: 'pointer',
              background: STEEL, border: `1px solid ${LINE}`, borderRadius: 5, borderLeft: `3px solid ${color}`,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 4, flexShrink: 0, display: 'grid', placeItems: 'center',
                background: `${color}1f`, border: `1px solid ${color}40`,
              }}>
                <Icon size={20} style={{ color }} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{label}</div>
                <div style={{ fontSize: 10.5, color: '#8a929b', display: 'flex', alignItems: 'center', gap: 3, fontFamily: MONO, letterSpacing: '.5px' }}>
                  OPEN <ArrowRight size={11} />
                </div>
              </div>
              <Plus size={16} style={{ color: '#5b636c' }} />
            </div>
          ))}
        </div>

        {/* ============ KPI STAT CARDS ============ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(178px,1fr))', gap: 12, marginBottom: 22 }}>
          {stats.map(({ label, value, unit, sub, icon: Icon, color, delta }) => (
            <div key={label} className="is-card" style={{
              position: 'relative', overflow: 'hidden', padding: 16,
              background: `linear-gradient(180deg, ${STEEL_2}, ${STEEL})`,
              border: `1px solid ${LINE}`, borderTop: `3px solid ${color}`, borderRadius: 5,
            }}>
              {/* corner grid texture */}
              <div style={{
                position: 'absolute', top: -10, right: -10, width: 70, height: 70, opacity: .07,
                backgroundImage: `linear-gradient(${color} 1px,transparent 1px),linear-gradient(90deg,${color} 1px,transparent 1px)`,
                backgroundSize: '9px 9px',
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 4, display: 'grid', placeItems: 'center', background: `${color}1c`, border: `1px solid ${color}33` }}>
                  <Icon size={17} style={{ color }} />
                </div>
                <span style={{
                  fontFamily: MONO, fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 3,
                  color, background: `${color}18`, letterSpacing: '.5px',
                }}>{delta}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 34, fontWeight: 900, color: '#fff', lineHeight: .9, letterSpacing: '-1px', fontFamily: DISPLAY }}>{value}</span>
                {unit && <span style={{ fontSize: 14, fontWeight: 700, color: '#9aa3ac' }}>{unit}</span>}
              </div>
              <div style={{ fontSize: 11, color: '#8a929b', marginTop: 7, fontFamily: MONO, letterSpacing: '.3px' }}>{sub}</div>
              <div style={{ fontSize: 10.5, color: '#5b636c', marginTop: 9, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ============ LIVE ROUTING SCHEMATIC ============ */}
        <div style={{
          marginBottom: 22, background: STEEL, border: `1px solid ${LINE}`, borderRadius: 6, overflow: 'hidden',
        }}>
          <SectionHead icon={Radio} color={BLUE} title="Live Routing Schematic" right="09 MIXERS IN TRANSIT" />
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px', gap: 16, alignItems: 'center' }}>
              {/* PLANT NODE */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 84, height: 84, margin: '0 auto', borderRadius: 8, display: 'grid', placeItems: 'center',
                  background: STEEL_2, border: `2px solid ${ORANGE}`, boxShadow: `0 0 24px ${ORANGE}40`,
                }}>
                  <Settings size={36} style={{ color: ORANGE, animation: 'is_spin 9s linear infinite' }} />
                </div>
                <div style={{ marginTop: 9, fontSize: 12, fontWeight: 800, letterSpacing: '1px', color: '#fff' }}>PLANT ALPHA</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, fontFamily: MONO }}>OPERATIONAL</div>
              </div>

              {/* TRANSIT CARDS */}
              <div>
                <div style={{ position: 'relative', height: 4, margin: '0 8px 16px', background: STEEL_2, borderRadius: 2, overflow: 'hidden' }}>
                  <svg width="100%" height="4" style={{ position: 'absolute', inset: 0 }}>
                    <line x1="0" y1="2" x2="100%" y2="2" stroke={BLUE} strokeWidth="3" strokeDasharray="14 14" style={{ animation: 'is_dash 1s linear infinite' }} />
                  </svg>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
                  {transit.map((t) => (
                    <div key={t.vehicle} className="is-card" style={{
                      padding: '11px 13px', background: STEEL_2, border: `1px solid ${BLUE}38`, borderRadius: 5,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <Truck size={14} style={{ color: BLUE, flexShrink: 0 }} />
                          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.vehicle}</span>
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 800, letterSpacing: '.5px', padding: '2px 6px', borderRadius: 3,
                          color: BLUE, background: `${BLUE}1c`, flexShrink: 0,
                        }}>EN ROUTE</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#9aa3ac', marginTop: 7, fontFamily: MONO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.driver} · {t.site}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <span style={gradeChip(t.grade)}>{t.grade}</span>
                        <span style={{ fontSize: 10.5, color: GREEN, fontFamily: MONO, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} /> ETA {t.eta}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SITES NODE */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 84, height: 84, margin: '0 auto', borderRadius: 8, display: 'grid', placeItems: 'center',
                  background: STEEL_2, border: `2px dashed ${AMBER}`,
                }}>
                  <Navigation size={32} style={{ color: AMBER }} />
                </div>
                <div style={{ marginTop: 9, fontSize: 12, fontWeight: 800, letterSpacing: '1px', color: '#fff' }}>SITES</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: AMBER, fontFamily: MONO }}>POURING</div>
              </div>
            </div>
          </div>
        </div>

        {/* ============ GPS MAP HERO ============ */}
        <div style={{
          marginBottom: 22, background: STEEL, border: `1px solid ${LINE}`, borderRadius: 6, overflow: 'hidden',
        }}>
          <SectionHead icon={MapPin} color={ORANGE} title="Live GPS Tracking" right="GPS SIGNAL · STRONG" />
          <div style={{
            position: 'relative', height: 320, overflow: 'hidden',
            background: `radial-gradient(circle at 30% 40%, #16202a, ${GRAPHITE})`,
          }}>
            {/* blueprint grid */}
            <div style={{
              position: 'absolute', inset: 0, opacity: .35,
              backgroundImage:
                'linear-gradient(rgba(61,169,252,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(61,169,252,.10) 1px,transparent 1px)',
              backgroundSize: '36px 36px',
            }} />
            {/* route paths */}
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
              <path d="M 120 250 C 300 180, 480 260, 660 120" fill="none" stroke={ORANGE} strokeWidth="3" strokeDasharray="10 10" style={{ animation: 'is_dash 1.4s linear infinite' }} opacity="0.85" />
              <path d="M 120 250 C 360 320, 560 200, 880 230" fill="none" stroke={BLUE} strokeWidth="3" strokeDasharray="10 10" style={{ animation: 'is_dash 1.8s linear infinite' }} opacity="0.7" />
              <path d="M 120 250 C 280 120, 520 80, 760 70" fill="none" stroke={GREEN} strokeWidth="3" strokeDasharray="10 10" style={{ animation: 'is_dash 2.2s linear infinite' }} opacity="0.6" />
            </svg>

            {/* plant marker */}
            <MapMarker x={120} y={250} color={ORANGE} label="PLANT ALPHA" Icon={Settings} big />
            {/* truck markers */}
            <MapMarker x={500} y={200} color={BLUE} label="MH-12-AB-1234" Icon={Truck} />
            <MapMarker x={680} y={130} color={ORANGE} label="MH-43-GH-9012" Icon={Truck} />
            <MapMarker x={760} y={75} color={GREEN} label="MH-04-EF-5521" Icon={Truck} />
            {/* site markers */}
            <MapMarker x={880} y={230} color={AMBER} label="Vikhroli" Icon={MapPin} />

            {/* telemetry overlay */}
            <div style={{
              position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 10, flexWrap: 'wrap',
            }}>
              {[
                { Icon: Signal, label: 'Avg Speed', val: '42 km/h', c: BLUE },
                { Icon: Gauge, label: 'Fleet Util', val: '66%', c: ORANGE },
                { Icon: Activity, label: 'On-Time', val: '94%', c: GREEN },
              ].map((m) => (
                <div key={m.label} style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderRadius: 4,
                  background: 'rgba(10,13,16,.78)', border: `1px solid ${m.c}40`, backdropFilter: 'blur(6px)',
                }}>
                  <m.Icon size={16} style={{ color: m.c }} />
                  <div>
                    <div style={{ fontSize: 9, color: '#8a929b', letterSpacing: '1px', fontFamily: MONO }}>{m.label.toUpperCase()}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{m.val}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 7,
              padding: '6px 12px', borderRadius: 4, background: 'rgba(10,13,16,.78)', border: `1px solid ${GREEN}40`,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: GREEN, animation: 'is_blip 1.2s infinite' }} />
              <span style={{ fontSize: 11, fontFamily: MONO, color: GREEN, fontWeight: 700, letterSpacing: '.5px' }}>4 UNITS TRACKED</span>
            </div>
          </div>
        </div>

        {/* ============ LOWER GRID ============ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr .85fr .85fr', gap: 16 }}>

          {/* RECENT DISPATCH TABLE */}
          <div style={{ background: STEEL, border: `1px solid ${LINE}`, borderRadius: 6, overflow: 'hidden' }}>
            <SectionHead icon={Truck} color={GREEN} title="Recent Dispatch" right="VIEW ALL" rightArrow />
            <div className="is-scroll" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: GRAPHITE }}>
                    {['Challan', 'Client', 'Vehicle', 'Grade', 'Qty', 'Status'].map((h) => (
                      <th key={h} style={{
                        padding: '10px 14px', textAlign: 'left', fontFamily: MONO, fontSize: 10,
                        fontWeight: 700, letterSpacing: '1px', color: '#8a929b', textTransform: 'uppercase',
                        borderBottom: `1px solid ${LINE}`,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentDispatch.map((r) => {
                    const m = statusMeta(r.status);
                    return (
                      <tr key={r.challan} className="is-row" style={{ borderBottom: `1px solid ${LINE}` }}>
                        <td style={{ padding: '11px 14px', fontFamily: MONO, fontWeight: 700, color: ORANGE }}>{r.challan}</td>
                        <td style={{ padding: '11px 14px', color: '#e9edf1', fontWeight: 600 }}>{r.client}</td>
                        <td style={{ padding: '11px 14px', fontFamily: MONO, fontSize: 11, color: '#9aa3ac' }}>{r.vehicle}</td>
                        <td style={{ padding: '11px 14px' }}><span style={gradeChip(r.grade)}>{r.grade}</span></td>
                        <td style={{ padding: '11px 14px', fontFamily: MONO, color: '#cfd6dd' }}>{r.qty} m³</td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 3,
                            fontSize: 10, fontWeight: 800, letterSpacing: '.5px', color: m.color, background: `${m.color}1c`,
                            fontFamily: MONO,
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color }} />
                            {m.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ACTIVE ORDERS */}
          <div style={{ background: STEEL, border: `1px solid ${LINE}`, borderRadius: 6, overflow: 'hidden' }}>
            <SectionHead icon={ClipboardList} color={AMBER} title="Active Orders" right="VIEW ALL" rightArrow />
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeOrders.map((o) => {
                const pct = Math.round((o.done / o.qty) * 100);
                const m = statusMeta(o.status);
                return (
                  <div key={o.order} style={{ padding: '12px 13px', background: STEEL_2, border: `1px solid ${LINE}`, borderRadius: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: AMBER }}>{o.order}</span>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.5px', color: m.color, fontFamily: MONO }}>{m.label}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.client}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 7px' }}>
                      <span style={gradeChip(o.grade)}>{o.grade}</span>
                      <span style={{ fontSize: 11, color: '#9aa3ac', fontFamily: MONO }}>{o.done}/{o.qty} m³</span>
                    </div>
                    <div style={{ height: 5, background: GRAPHITE, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${ORANGE}, ${ORANGE_HI})` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ACTIVITY FEED */}
          <div style={{ background: STEEL, border: `1px solid ${LINE}`, borderRadius: 6, overflow: 'hidden' }}>
            <SectionHead icon={Activity} color={BLUE} title="Activity Feed" right="LIVE" />
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {feed.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 11, padding: '11px 6px', borderBottom: i < feed.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                  <div style={{
                    width: 32, height: 32, flexShrink: 0, borderRadius: 4, display: 'grid', placeItems: 'center',
                    background: `${f.color}1a`, border: `1px solid ${f.color}33`,
                  }}>
                    <f.Icon size={15} style={{ color: f.color }} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#e9edf1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.title}</div>
                    <div style={{ fontSize: 11, color: '#8a929b', marginTop: 2, fontFamily: MONO }}>{f.sub}</div>
                  </div>
                  <span style={{ fontSize: 10, color: '#5b636c', fontFamily: MONO, flexShrink: 0 }}>{f.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* footer strip */}
        <div style={{
          marginTop: 26, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: 16, borderTop: `1px solid ${LINE}`, flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: MONO, fontSize: 11, color: '#5b636c', letterSpacing: '.5px' }}>
            <Wrench size={13} style={{ color: ORANGE }} /> CONCRETE KING · TRACKMYRMC · OPS CONSOLE v2.4
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: '#5b636c' }}>SYNCED · {new Date().toLocaleTimeString('en-IN')}</div>
        </div>
      </div>
    </div>
  );
}

function btnSecondary(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 4, cursor: 'pointer',
    background: `${color}14`, border: `1px solid ${color}45`, color, fontSize: 12, fontWeight: 800,
    letterSpacing: '.6px', fontFamily: DISPLAY,
  };
}

function gradeChip(grade: string): React.CSSProperties {
  return {
    display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10.5, fontWeight: 800,
    letterSpacing: '.5px', fontFamily: MONO, color: '#111',
    background: 'linear-gradient(135deg,#cfd6dd,#9aa3ac)',
  };
}

function SectionHead({
  icon: Icon, color, title, right, rightArrow,
}: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; color: string; title: string; right?: string; rightArrow?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '13px 18px', borderBottom: `1px solid ${LINE}`, background: GRAPHITE,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={16} style={{ color }} />
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', color: '#fff' }}>{title}</h3>
      </div>
      {right && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 10.5,
          fontWeight: 700, letterSpacing: '.8px', color: rightArrow ? color : '#8a929b', cursor: rightArrow ? 'pointer' : 'default',
        }}>
          {right} {rightArrow && <ArrowUpRight size={13} />}
        </span>
      )}
    </div>
  );
}

function MapMarker({
  x, y, color, label, Icon, big,
}: { x: number; y: number; color: string; label: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; big?: boolean }) {
  const size = big ? 46 : 34;
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)', zIndex: 2 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <span style={{
          position: 'absolute', inset: -8, borderRadius: '50%', border: `2px solid ${color}`, opacity: .4,
          animation: 'is_blip 1.6s infinite',
        }} />
        <div style={{
          width: size, height: size, borderRadius: big ? 8 : '50%', display: 'grid', placeItems: 'center',
          background: 'rgba(10,13,16,.9)', border: `2px solid ${color}`, boxShadow: `0 0 16px ${color}66`,
        }}>
          <Icon size={big ? 22 : 16} style={{ color }} />
        </div>
      </div>
      <div style={{
        position: 'absolute', top: size + 4, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap',
        fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color, background: 'rgba(10,13,16,.85)',
        padding: '2px 6px', borderRadius: 3, letterSpacing: '.5px',
      }}>{label}</div>
    </div>
  );
}
