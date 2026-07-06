import {
  Bell,
  User,
  Truck,
  ClipboardList,
  ChevronRight,
  Check,
  Clock,
  Home,
  Menu,
  Timer,
  FlaskConical,
  Layers,
  BarChart3,
  CalendarCheck,
  FileBarChart,
  Factory,
  AlertTriangle,
  Plus,
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
      <span className="text-[11px] font-medium leading-tight text-center" style={{ color: INK }}>
        {label}
      </span>
    </button>
  );
}

function FreshnessRow({
  no,
  grade,
  client,
  remaining,
  level,
  pct,
}: {
  no: string;
  grade: string;
  client: string;
  remaining: string;
  level: "fresh" | "warning" | "critical";
  pct: number;
}) {
  const color = level === "fresh" ? GREEN : level === "warning" ? AMBER : RED;
  const tintBg = level === "fresh" ? "#e8f5ec" : level === "warning" ? "#fef3e2" : "#fef2f2";
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-white p-3" style={{ borderColor: LINE }}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: tintBg }}>
        <Timer className="h-5 w-5" style={{ color }} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-bold" style={{ color: INK }}>
            {no}
          </span>
          <span className="text-[11.5px]" style={{ color: MUTED }}>
            {grade} · {client}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "#eceae6" }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
      <div className="text-right">
        <span className="font-mono text-[14px] font-extrabold" style={{ color }}>
          {remaining}
        </span>
        <p className="text-[9.5px] font-medium" style={{ color: MUTED }}>
          pour-by
        </p>
      </div>
    </div>
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
          {/* Greeting + plant */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px]" style={{ color: MUTED }}>
                Aakruti Infra RMC · Panvel
              </p>
              <h1 className="text-[19px] font-extrabold leading-tight" style={{ color: INK }}>
                Morning Shift
              </h1>
            </div>
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ background: "#e8f5ec", border: `1px solid rgba(21,128,61,0.25)` }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: GREEN }} />
              <span className="text-[12px] font-bold" style={{ color: GREEN }}>
                On Duty
              </span>
            </div>
          </div>

          {/* Shift target banner */}
          <div
            className="mt-3 rounded-2xl p-4 text-white"
            style={{ background: `linear-gradient(120deg, ${TEAL_DEEP}, ${TEAL_HI})` }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-white/80">Today's production</p>
                <p className="text-[24px] font-extrabold leading-tight">
                  42.5 <span className="text-[14px] font-semibold text-white/85">/ 50 m³</span>
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <Factory className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: "85%" }} />
            </div>
            <p className="mt-1.5 text-[11px] text-white/80">85% of shift target · 12 batches produced</p>
          </div>

          {/* Today stats */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <StatCard value="38.0" unit="m³" label="Dispatched today" color={GREEN} icon={<Truck className="h-4 w-4" />} />
            <StatCard value="4" label="Loads in transit" color={BLUE} icon={<Timer className="h-4 w-4" />} />
            <StatCard value="6" label="Pending orders" color={AMBER} icon={<ClipboardList className="h-4 w-4" />} />
            <StatCard value="8/10" label="Vehicles online" color={TEAL} icon={<Truck className="h-4 w-4" />} />
          </div>

          {/* Freshness Guard */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[16px] font-bold" style={{ color: INK }}>
                Freshness Guard
              </h2>
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: RED }}>
                1
              </span>
            </div>
            <button className="flex items-center gap-0.5 text-[12.5px] font-semibold" style={{ color: TEAL }}>
              View All <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 space-y-2.5">
            <FreshnessRow no="#CH1042" grade="M25" client="Kohinoor" remaining="42:10" level="fresh" pct={72} />
            <FreshnessRow no="#CH1041" grade="M30" client="Skyline" remaining="18:35" level="warning" pct={38} />
            <FreshnessRow no="#CH1039" grade="M25" client="Metro" remaining="06:12" level="critical" pct={12} />
          </div>

          {/* Quick Actions */}
          <h2 className="mt-6 text-[16px] font-bold" style={{ color: INK }}>
            Quick Actions
          </h2>
          <div className="mt-3 grid grid-cols-4 gap-y-4">
            <QuickAction label="New Batch" tint={TEAL} bg="#fff" icon={<Plus className="h-6 w-6" />} />
            <QuickAction label="Batch Report" tint={TEAL} bg="#fff" icon={<Layers className="h-6 w-6" />} />
            <QuickAction label="Mix Design" tint={TEAL} bg="#fff" icon={<FlaskConical className="h-6 w-6" />} />
            <QuickAction label="Freshness" tint={TEAL} bg="#fff" icon={<Timer className="h-6 w-6" />} />
            <QuickAction label="Shift Report" tint={TEAL} bg="#fff" icon={<FileBarChart className="h-6 w-6" />} />
            <QuickAction label="Reports" tint={TEAL} bg="#fff" icon={<BarChart3 className="h-6 w-6" />} />
            <QuickAction label="Attendance" tint={TEAL} bg="#fff" icon={<CalendarCheck className="h-6 w-6" />} />
            <QuickAction label="Profile" tint={TEAL} bg="#fff" icon={<User className="h-6 w-6" />} />
          </div>

          {/* Attendance strip */}
          <div className="mt-5 flex items-center gap-3 rounded-xl border px-3.5 py-3" style={{ background: "#f0f7f5", borderColor: "rgba(15,118,110,0.18)" }}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "#d9ece8" }}>
              <Clock className="h-5 w-5" style={{ color: TEAL }} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold leading-tight" style={{ color: INK }}>
                Checked in at 6:00 AM · 4h 30m
              </p>
              <p className="text-[11.5px]" style={{ color: MUTED }}>
                Morning shift · ends 2:00 PM
              </p>
            </div>
            <button className="rounded-lg px-3 py-1.5 text-[12px] font-bold text-white" style={{ background: TEAL }}>
              Check Out
            </button>
          </div>

          {/* Latest batch */}
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-[16px] font-bold" style={{ color: INK }}>
              Latest Batch
            </h2>
            <button className="flex items-center gap-0.5 text-[12.5px] font-semibold" style={{ color: TEAL }}>
              All Batches <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 rounded-2xl border bg-white p-4" style={{ borderColor: LINE }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[14px] font-bold" style={{ color: INK }}>
                    Batch #B-0212
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: "#e8f5ec", color: GREEN }}>
                    Batched
                  </span>
                </div>
                <p className="mt-1 text-[12px]" style={{ color: MUTED }}>
                  M25 · 6.0 m³ · 10:24 AM
                </p>
              </div>
              <Layers className="h-8 w-8" style={{ color: TEAL }} />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                { k: "Cement", v: "48 bags" },
                { k: "Water", v: "1080 L" },
                { k: "Sand", v: "2640 kg" },
                { k: "Agg.", v: "4020 kg" },
              ].map((m) => (
                <div key={m.k} className="rounded-lg px-2 py-1.5 text-center" style={{ background: "#f7f5f1" }}>
                  <p className="text-[9.5px] font-medium" style={{ color: MUTED }}>
                    {m.k}
                  </p>
                  <p className="text-[11px] font-bold" style={{ color: INK }}>
                    {m.v}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Bottom Tab Bar with New Batch FAB */}
        <nav
          className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-[420px] -translate-x-1/2 items-end justify-between border-t bg-white px-6 pb-3 pt-2"
          style={{ borderColor: LINE }}
        >
          <TabItem icon={<Home className="h-5 w-5" />} label="Home" active />
          <TabItem icon={<Timer className="h-5 w-5" />} label="Freshness" />
          <div className="flex flex-col items-center" style={{ transform: "translateY(-10px)" }}>
            <button
              className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
              style={{ background: TEAL, boxShadow: "0 8px 20px rgba(15,118,110,0.35)" }}
            >
              <Plus className="h-7 w-7" strokeWidth={2.6} />
            </button>
            <span className="mt-1 text-[10px] font-medium" style={{ color: MUTED }}>
              New Batch
            </span>
          </div>
          <TabItem icon={<BarChart3 className="h-5 w-5" />} label="Reports" />
          <TabItem icon={<Menu className="h-5 w-5" />} label="More" />
        </nav>
      </div>
    </div>
  );
}
