import {
  Bell,
  User,
  Truck,
  ClipboardList,
  ChevronRight,
  Clock,
  Home,
  Menu,
  Timer,
  Layers,
  BarChart3,
  CalendarCheck,
  FileBarChart,
  Users,
  Building2,
  FileText,
  TrendingUp,
  Repeat,
  Fuel,
  FlaskConical,
  Plus,
  MapPin,
} from "lucide-react";

const TEAL = "#0f766e";
const TEAL_HI = "#12876f";
const TEAL_DEEP = "#0d5b54";
const INK = "#1c1917";
const MUTED = "#78716c";
const BG = "#fdfbf7";
const LINE = "rgba(28,25,23,0.10)";
const GREEN = "#15803d";
const BLUE = "#0284c7";
const AMBER = "#d97706";
const RED = "#ef4444";

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: TEAL }}>
        <Truck className="h-5 w-5 text-white" strokeWidth={2.2} />
      </div>
      <span className="text-[19px] font-extrabold tracking-tight" style={{ color: INK }}>
        Track<span style={{ color: TEAL }}>My</span>RMC
      </span>
    </div>
  );
}

function StatCard({
  value,
  unit,
  label,
  color,
  icon,
}: {
  value: string;
  unit?: string;
  label: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border bg-white p-3" style={{ borderColor: LINE }}>
      <div className="flex items-center gap-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-[19px] font-extrabold leading-none" style={{ color: INK }}>
          {value}
          {unit && <span className="text-[11px] font-semibold" style={{ color: MUTED }}> {unit}</span>}
        </span>
      </div>
      <span className="text-[11px] font-medium" style={{ color: MUTED }}>
        {label}
      </span>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  tint,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  tint: string;
  bg: string;
}) {
  return (
    <button className="flex flex-col items-center gap-1.5">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border" style={{ borderColor: LINE, background: bg }}>
        <span style={{ color: tint }}>{icon}</span>
      </div>
      <span className="text-[10.5px] font-medium leading-tight text-center" style={{ color: INK }}>
        {label}
      </span>
    </button>
  );
}

function TabItem({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button className="flex flex-col items-center gap-1">
      <span style={{ color: active ? TEAL : MUTED }}>{icon}</span>
      <span className="text-[10px] font-medium" style={{ color: active ? TEAL : MUTED }}>
        {label}
      </span>
    </button>
  );
}

export function DeliveryStyle() {
  return (
    <div className="min-h-screen w-full" style={{ background: BG }}>
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col" style={{ background: BG }}>
        {/* Header */}
        <header className="flex items-center justify-between px-4 pt-4 pb-3">
          <Logo />
          <div className="flex items-center gap-3">
            <button className="relative flex h-9 w-9 items-center justify-center rounded-full border bg-white" style={{ borderColor: LINE }}>
              <Bell className="h-[18px] w-[18px]" style={{ color: INK }} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full" style={{ background: RED }} />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "#e7f2f0", border: `1.5px solid ${TEAL}` }}>
              <User className="h-[18px] w-[18px]" style={{ color: TEAL }} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-28">
          {/* Greeting */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px]" style={{ color: MUTED }}>
                Dispatch Desk · Aakruti Panvel
              </p>
              <h1 className="text-[19px] font-extrabold leading-tight" style={{ color: INK }}>
                Good morning, Suresh
              </h1>
            </div>
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ background: "#e8f5ec", border: `1px solid rgba(21,128,61,0.25)` }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: GREEN }} />
              <span className="text-[12px] font-bold" style={{ color: GREEN }}>
                Live
              </span>
            </div>
          </div>

          {/* Dispatched today banner */}
          <div
            className="mt-3 rounded-2xl p-4 text-white"
            style={{ background: `linear-gradient(120deg, ${TEAL_DEEP}, ${TEAL_HI})` }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-white/80">Dispatched today</p>
                <p className="text-[24px] font-extrabold leading-tight">
                  128.0 <span className="text-[14px] font-semibold text-white/85">m³</span>
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <Truck className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-[12px]">
              <span className="text-white/85">
                <span className="font-bold text-white">4</span> in transit
              </span>
              <span className="text-white/85">
                <span className="font-bold text-white">6</span> pending orders
              </span>
              <span className="text-white/85">
                <span className="font-bold text-white">245 m³</span> booked tomorrow
              </span>
            </div>
          </div>

          {/* Live stats */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <StatCard value="6" label="Orders to dispatch" color={AMBER} icon={<ClipboardList className="h-4 w-4" />} />
            <StatCard value="4" label="Challans in transit" color={BLUE} icon={<Timer className="h-4 w-4" />} />
            <StatCard value="12/15" label="Vehicles available" color={TEAL} icon={<Truck className="h-4 w-4" />} />
            <StatCard value="9" label="Drivers on duty" color={GREEN} icon={<Users className="h-4 w-4" />} />
          </div>

          {/* Needs Dispatch queue */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[16px] font-bold" style={{ color: INK }}>
                Needs Dispatch
              </h2>
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: AMBER }}>
                6
              </span>
            </div>
            <button className="flex items-center gap-0.5 text-[12.5px] font-semibold" style={{ color: TEAL }}>
              All Orders <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 space-y-2.5">
            {[
              { no: "ORD-1044", client: "Metro Rail Corp", grade: "M40", left: "15", total: "45", time: "09:00 AM", urgent: true },
              { no: "ORD-1043", client: "Kohinoor Constr.", grade: "M25", left: "6", total: "18", time: "11:30 AM", urgent: false },
            ].map((o) => (
              <div key={o.no} className="rounded-2xl border bg-white p-3.5" style={{ borderColor: LINE }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-bold" style={{ color: INK }}>
                        {o.no}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={o.urgent ? { background: "#fef2f2", color: RED } : { background: "#fef3e2", color: AMBER }}
                      >
                        {o.urgent ? "Urgent" : "Scheduled"}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px]" style={{ color: MUTED }}>
                      {o.client} · {o.grade}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11.5px] font-medium" style={{ color: MUTED }}>
                    <Clock className="h-3.5 w-3.5" /> {o.time}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="mb-1 flex justify-between text-[10.5px]" style={{ color: MUTED }}>
                      <span>{o.left} m³ left</span>
                      <span>of {o.total} m³</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "#eceae6" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${((+o.total - +o.left) / +o.total) * 100}%`, background: TEAL }}
                      />
                    </div>
                  </div>
                  <button className="rounded-lg px-3 py-1.5 text-[12px] font-bold text-white" style={{ background: TEAL }}>
                    Dispatch
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <h2 className="mt-6 text-[16px] font-bold" style={{ color: INK }}>
            Quick Actions
          </h2>
          <div className="mt-3 grid grid-cols-4 gap-x-2 gap-y-4">
            <QuickAction label="Orders" tint={TEAL} bg="#fff" icon={<ClipboardList className="h-6 w-6" />} />
            <QuickAction label="Dispatch" tint={TEAL} bg="#fff" icon={<Truck className="h-6 w-6" />} />
            <QuickAction label="Clients" tint={TEAL} bg="#fff" icon={<Building2 className="h-6 w-6" />} />
            <QuickAction label="Vehicles" tint={TEAL} bg="#fff" icon={<Truck className="h-6 w-6" />} />
            <QuickAction label="Drivers" tint={TEAL} bg="#fff" icon={<Users className="h-6 w-6" />} />
            <QuickAction label="Freshness" tint={TEAL} bg="#fff" icon={<Timer className="h-6 w-6" />} />
            <QuickAction label="Batch Report" tint={TEAL} bg="#fff" icon={<Layers className="h-6 w-6" />} />
            <QuickAction label="Challans" tint={TEAL} bg="#fff" icon={<FileText className="h-6 w-6" />} />
            <QuickAction label="Forecast" tint={TEAL} bg="#fff" icon={<TrendingUp className="h-6 w-6" />} />
            <QuickAction label="Recurring" tint={TEAL} bg="#fff" icon={<Repeat className="h-6 w-6" />} />
            <QuickAction label="Fuel Log" tint={TEAL} bg="#fff" icon={<Fuel className="h-6 w-6" />} />
            <QuickAction label="Mix Design" tint={TEAL} bg="#fff" icon={<FlaskConical className="h-6 w-6" />} />
            <QuickAction label="Shift Report" tint={TEAL} bg="#fff" icon={<FileBarChart className="h-6 w-6" />} />
            <QuickAction label="Attendance" tint={TEAL} bg="#fff" icon={<CalendarCheck className="h-6 w-6" />} />
            <QuickAction label="Reports" tint={TEAL} bg="#fff" icon={<BarChart3 className="h-6 w-6" />} />
            <QuickAction label="Profile" tint={TEAL} bg="#fff" icon={<User className="h-6 w-6" />} />
          </div>

          {/* In-transit tracking */}
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-[16px] font-bold" style={{ color: INK }}>
              In Transit
            </h2>
            <button className="flex items-center gap-0.5 text-[12.5px] font-semibold" style={{ color: TEAL }}>
              Live Map <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 space-y-2.5">
            {[
              { ch: "#CH-9902", driver: "Rajesh Kumar", veh: "TM-04", grade: "M40", eta: "12 min", pct: 70 },
              { ch: "#CH-9901", driver: "Amit Singh", veh: "TM-07", grade: "M25", eta: "28 min", pct: 40 },
            ].map((t) => (
              <div key={t.ch} className="flex items-center gap-3 rounded-2xl border bg-white p-3" style={{ borderColor: LINE }}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "#e0f2fe" }}>
                  <Truck className="h-5 w-5" style={{ color: BLUE }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-bold" style={{ color: INK }}>
                      {t.ch}
                    </span>
                    <span className="text-[11px]" style={{ color: MUTED }}>
                      {t.grade} · {t.veh}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-[11.5px]" style={{ color: MUTED }}>
                    <User className="h-3 w-3" /> {t.driver}
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-bold" style={{ background: "#e0f2fe", color: BLUE }}>
                  <MapPin className="h-3.5 w-3.5" /> {t.eta}
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Bottom Tab Bar with New Order FAB */}
        <nav
          className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-[420px] -translate-x-1/2 items-end justify-between border-t bg-white px-6 pb-3 pt-2"
          style={{ borderColor: LINE }}
        >
          <TabItem icon={<Home className="h-5 w-5" />} label="Home" active />
          <TabItem icon={<ClipboardList className="h-5 w-5" />} label="Orders" />
          <div className="flex flex-col items-center" style={{ transform: "translateY(-10px)" }}>
            <button
              className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
              style={{ background: TEAL, boxShadow: "0 8px 20px rgba(15,118,110,0.35)" }}
            >
              <Plus className="h-7 w-7" strokeWidth={2.6} />
            </button>
            <span className="mt-1 text-[10px] font-medium" style={{ color: MUTED }}>
              New Order
            </span>
          </div>
          <TabItem icon={<Truck className="h-5 w-5" />} label="Dispatch" />
          <TabItem icon={<Menu className="h-5 w-5" />} label="More" />
        </nav>
      </div>
    </div>
  );
}
