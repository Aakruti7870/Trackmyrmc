import {
  Bell,
  User,
  Truck,
  ChevronRight,
  Home,
  BarChart3,
  FileText,
  Wallet,
  Calculator,
  Download,
  Check,
  X,
  TrendingUp,
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
    <div className="flex flex-col gap-1 rounded-2xl border bg-white p-3" style={{ borderColor: LINE }}>
      <div className="flex items-center gap-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-[19px] font-extrabold leading-none" style={{ color: INK }}>
          {value}
        </span>
      </div>
      <span className="text-[11px] font-medium" style={{ color: MUTED }}>
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
          {/* Greeting */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[13px]" style={{ color: MUTED }}>
                  Accounts
                </p>
                <span className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: "#e7f2f0", color: TEAL }}>
                  <Calculator className="h-3 w-3" /> Finance
                </span>
              </div>
              <h1 className="text-[19px] font-extrabold leading-tight" style={{ color: INK }}>
                Good morning, Neha
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

          {/* Outstanding banner */}
          <div
            className="mt-3 rounded-2xl p-4 text-white"
            style={{ background: `linear-gradient(120deg, ${TEAL_DEEP}, ${TEAL_HI})` }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-white/80">Outstanding to collect</p>
                <p className="text-[24px] font-extrabold leading-tight">₹3.62L</p>
              </div>
              <button className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12px] font-bold" style={{ color: TEAL_DEEP }}>
                <Download className="h-4 w-4" /> Export
              </button>
            </div>
            <div className="mt-3 flex gap-4 text-[12px]">
              <span className="text-white/85">
                <span className="font-bold text-white">18</span> unpaid challans
              </span>
              <span className="text-white/85">
                <span className="font-bold text-white">₹9.8L</span> billed this month
              </span>
            </div>
          </div>

          {/* Finance stats */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <StatCard value="3" label="Expenses to review" color={AMBER} icon={<Wallet className="h-4 w-4" />} />
            <StatCard value="142" label="Challans this month" color={BLUE} icon={<FileText className="h-4 w-4" />} />
            <StatCard value="₹8,280" label="Reimbursed today" color={GREEN} icon={<Check className="h-4 w-4" strokeWidth={3} />} />
            <StatCard value="+12%" label="vs last month" color={TEAL} icon={<TrendingUp className="h-4 w-4" />} />
          </div>

          {/* Expense approvals */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[16px] font-bold" style={{ color: INK }}>
                Expense Approvals
              </h2>
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: AMBER }}>
                3
              </span>
            </div>
            <button className="flex items-center gap-0.5 text-[12.5px] font-semibold" style={{ color: TEAL }}>
              Review All <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 space-y-2.5">
            {[
              { who: "Rajesh Kumar", cat: "Fuel", amt: "7,800", note: "HP Pump, Vashi · 85.5 L" },
              { who: "Amit Singh", cat: "Toll", amt: "480", note: "Mumbai-Pune Expressway" },
              { who: "Vijay More", cat: "Repair", amt: "2,150", note: "Tyre replacement · TM-02" },
            ].map((e) => (
              <div key={e.who} className="flex items-center gap-3 rounded-2xl border bg-white p-3" style={{ borderColor: LINE }}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "#fef3e2" }}>
                  <Wallet className="h-5 w-5" style={{ color: AMBER }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold" style={{ color: INK }}>
                      ₹{e.amt}
                    </span>
                    <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold" style={{ background: "#f0efec", color: MUTED }}>
                      {e.cat}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px]" style={{ color: MUTED }}>
                    {e.who} · {e.note}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#e8f5ec" }}>
                    <Check className="h-4 w-4" style={{ color: GREEN }} strokeWidth={3} />
                  </button>
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#fef2f2" }}>
                    <X className="h-4 w-4" style={{ color: RED }} strokeWidth={3} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Recent challans for billing */}
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
              { no: "#CH1042", client: "Kohinoor Constr.", amt: "42,600", paid: false },
              { no: "#CH1039", client: "Metro Rail Corp", amt: "1,08,000", paid: true },
              { no: "#CH1038", client: "Green Valley", amt: "36,000", paid: true },
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
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold"
                      style={c.paid ? { background: "#e8f5ec", color: GREEN } : { background: "#fef3e2", color: AMBER }}
                    >
                      {c.paid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px]" style={{ color: MUTED }}>
                    {c.client}
                  </p>
                </div>
                <span className="text-[13px] font-extrabold" style={{ color: INK }}>
                  ₹{c.amt}
                </span>
              </div>
            ))}
          </div>
        </main>

        {/* Bottom Tab Bar — full coverage of the 4 finance screens */}
        <nav
          className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-[420px] -translate-x-1/2 items-center justify-between border-t bg-white px-7 pb-3 pt-2"
          style={{ borderColor: LINE }}
        >
          <TabItem icon={<Home className="h-5 w-5" />} label="Home" active />
          <TabItem icon={<BarChart3 className="h-5 w-5" />} label="Reports" />
          <TabItem icon={<FileText className="h-5 w-5" />} label="Challans" />
          <TabItem icon={<Wallet className="h-5 w-5" />} label="Expenses" />
          <TabItem icon={<User className="h-5 w-5" />} label="Profile" />
        </nav>
      </div>
    </div>
  );
}
