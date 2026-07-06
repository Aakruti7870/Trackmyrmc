import {
  Bell,
  User,
  Truck,
  ClipboardList,
  Wallet,
  TriangleAlert,
  CalendarCheck,
  FileText,
  ChevronRight,
  Check,
  Navigation,
  Phone,
  MessageCircle,
  Home,
  Menu,
  Clock,
  MapPin,
  IndianRupee,
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
  label,
  color,
  icon,
}: {
  value: string;
  label: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-2xl border bg-white p-3" style={{ borderColor: LINE }}>
      <div className="flex items-center gap-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-[20px] font-extrabold leading-none" style={{ color: INK }}>
          {value}
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

function Step({
  label,
  done,
  active,
  icon,
}: {
  label: string;
  done?: boolean;
  active?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-1 flex-col items-center">
      <div
        className="z-10 flex h-7 w-7 items-center justify-center rounded-full"
        style={{
          background: done ? TEAL : active ? "#e7f2f0" : "#f0efec",
          border: active ? `2px solid ${TEAL}` : "none",
        }}
      >
        {done ? (
          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
        ) : (
          <span style={{ color: active ? TEAL : "#cbc9c4" }}>{icon}</span>
        )}
      </div>
      <span
        className="mt-1 text-center text-[9px] font-medium leading-tight"
        style={{ color: active ? TEAL : done ? INK : MUTED }}
      >
        {label}
      </span>
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
          {/* Greeting + Attendance status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px]" style={{ color: MUTED }}>
                Good morning,
              </p>
              <h1 className="text-[19px] font-extrabold leading-tight" style={{ color: INK }}>
                Ramesh Yadav
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

          {/* Attendance banner */}
          <div
            className="mt-3 flex items-center gap-3 rounded-2xl p-3.5 text-white"
            style={{ background: `linear-gradient(120deg, ${TEAL_DEEP}, ${TEAL_HI})` }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-[12px] text-white/80">Checked in at 7:05 AM</p>
              <p className="text-[15px] font-bold">Shift running · 4h 20m</p>
            </div>
            <button className="rounded-xl bg-white px-3 py-2 text-[12px] font-bold" style={{ color: TEAL_DEEP }}>
              Check Out
            </button>
          </div>

          {/* Today stats */}
          <div className="mt-4 flex gap-2.5">
            <StatCard value="2" label="Active trips" color={BLUE} icon={<Truck className="h-4 w-4" />} />
            <StatCard value="5" label="Delivered today" color={GREEN} icon={<Check className="h-4 w-4" strokeWidth={3} />} />
            <StatCard value="3" label="Pending claims" color={TEAL} icon={<Wallet className="h-4 w-4" />} />
          </div>

          {/* Active Trip */}
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-[16px] font-bold" style={{ color: INK }}>
              Active Trip
            </h2>
            <button className="flex items-center gap-0.5 text-[12.5px] font-semibold" style={{ color: TEAL }}>
              My Trips <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 rounded-2xl border bg-white p-4" style={{ borderColor: LINE }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[14px] font-bold" style={{ color: INK }}>
                    #CH1042
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: "#e0f2fe", color: BLUE }}>
                    In transit
                  </span>
                </div>
                <p className="mt-1 text-[12px]" style={{ color: MUTED }}>
                  M25 · 6.0 m³ · <span className="font-mono">MH-46-AB-1234</span>
                </p>
              </div>
              <Truck className="h-8 w-8" style={{ color: BLUE }} />
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl p-2.5" style={{ background: "#f7f5f1" }}>
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TEAL }} />
              <div className="text-[12px]" style={{ color: INK }}>
                <span className="font-semibold">Skyline Towers, Panvel</span>
                <span style={{ color: MUTED }}> · Kohinoor Constructions</span>
              </div>
            </div>

            {/* Stepper */}
            <div className="relative mt-4">
              <div className="absolute left-[10%] right-[10%] top-[13px] h-[3px]" style={{ background: "#eceae6" }} />
              <div className="absolute left-[10%] top-[13px] h-[3px]" style={{ background: TEAL, width: "30%" }} />
              <div className="relative flex justify-between">
                <Step label="Dispatched" done icon={<Truck className="h-3.5 w-3.5" />} />
                <Step label="In transit" active icon={<Navigation className="h-3.5 w-3.5" />} />
                <Step label="Reached" icon={<MapPin className="h-3.5 w-3.5" />} />
                <Step label="Unloading" icon={<Clock className="h-3.5 w-3.5" />} />
                <Step label="Delivered" icon={<Check className="h-3.5 w-3.5" />} />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-bold text-white" style={{ background: TEAL }}>
                <Navigation className="h-4 w-4" /> Navigate
              </button>
              <button className="flex h-10 w-11 items-center justify-center rounded-xl border" style={{ borderColor: LINE }}>
                <Phone className="h-[18px] w-[18px]" style={{ color: TEAL }} />
              </button>
              <button className="flex h-10 w-11 items-center justify-center rounded-xl border" style={{ borderColor: LINE }}>
                <MessageCircle className="h-[18px] w-[18px]" style={{ color: GREEN }} />
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <h2 className="mt-6 text-[16px] font-bold" style={{ color: INK }}>
            Quick Actions
          </h2>
          <div className="mt-3 grid grid-cols-4 gap-y-4">
            <QuickAction label="My Trips" tint={TEAL} bg="#fff" icon={<ClipboardList className="h-6 w-6" />} />
            <QuickAction label="Expenses" tint={TEAL} bg="#fff" icon={<Wallet className="h-6 w-6" />} />
            <QuickAction label="Attendance" tint={TEAL} bg="#fff" icon={<CalendarCheck className="h-6 w-6" />} />
            <QuickAction label="Challans" tint={TEAL} bg="#fff" icon={<FileText className="h-6 w-6" />} />
            <QuickAction label="SOS" tint={RED} bg="#fef2f2" icon={<TriangleAlert className="h-6 w-6" />} />
            <QuickAction label="Profile" tint={TEAL} bg="#fff" icon={<User className="h-6 w-6" />} />
          </div>

          {/* Add expense prompt */}
          <div className="mt-5 flex items-center gap-3 rounded-xl border px-3.5 py-3" style={{ background: "#f0f7f5", borderColor: "rgba(15,118,110,0.18)" }}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "#d9ece8" }}>
              <IndianRupee className="h-5 w-5" style={{ color: TEAL }} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold leading-tight" style={{ color: INK }}>
                Log today's fuel &amp; toll
              </p>
              <p className="text-[11.5px]" style={{ color: MUTED }}>
                Add receipts to get reimbursed faster.
              </p>
            </div>
            <button className="flex items-center gap-0.5 text-[12px] font-bold" style={{ color: TEAL }}>
              Add <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Recent Challans */}
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-[16px] font-bold" style={{ color: INK }}>
              Recent Challans
            </h2>
            <button className="flex items-center gap-0.5 text-[12.5px] font-semibold" style={{ color: TEAL }}>
              View All <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 space-y-2.5">
            {[
              { no: "#CH1039", grade: "M30", qty: "8.0", site: "Green Valley, Kharghar", ok: true },
              { no: "#CH1038", grade: "M25", qty: "6.0", site: "Metro Depot, Taloja", ok: true },
            ].map((c) => (
              <div key={c.no} className="flex items-center gap-3 rounded-2xl border bg-white p-3" style={{ borderColor: LINE }}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "#eef4f2" }}>
                  <FileText className="h-5 w-5" style={{ color: TEAL }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13px] font-bold" style={{ color: INK }}>
                      {c.no}
                    </span>
                    <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: "#e8f5ec", color: GREEN }}>
                      Delivered
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px]" style={{ color: MUTED }}>
                    {c.grade} · {c.qty} m³ · {c.site}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4" style={{ color: MUTED }} />
              </div>
            ))}
          </div>
        </main>

        {/* Bottom Tab Bar with SOS FAB */}
        <nav
          className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-[420px] -translate-x-1/2 items-end justify-between border-t bg-white px-6 pb-3 pt-2"
          style={{ borderColor: LINE }}
        >
          <TabItem icon={<Home className="h-5 w-5" />} label="Home" active />
          <TabItem icon={<ClipboardList className="h-5 w-5" />} label="Trips" />
          <div className="flex flex-col items-center" style={{ transform: "translateY(-10px)" }}>
            <button
              className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
              style={{ background: RED, boxShadow: "0 8px 20px rgba(239,68,68,0.4)" }}
            >
              <TriangleAlert className="h-7 w-7" strokeWidth={2.4} />
            </button>
            <span className="mt-1 text-[10px] font-bold" style={{ color: RED }}>
              SOS
            </span>
          </div>
          <TabItem icon={<CalendarCheck className="h-5 w-5" />} label="Attendance" />
          <TabItem icon={<Menu className="h-5 w-5" />} label="More" />
        </nav>
      </div>
    </div>
  );
}
