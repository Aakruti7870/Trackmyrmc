import {
  Bell,
  User,
  Plus,
  ClipboardList,
  MapPin,
  RotateCcw,
  Headphones,
  FileText,
  ChevronRight,
  Truck,
  Check,
  ShieldCheck,
  Home,
  Menu,
  Wallet,
  Receipt,
  Download,
  BadgeIndianRupee,
} from "lucide-react";

const TEAL = "#0f766e";
const TEAL_HI = "#12876f";
const TEAL_DEEP = "#0d5b54";
const INK = "#1c1917";
const MUTED = "#78716c";
const BG = "#fdfbf7";
const LINE = "rgba(28,25,23,0.10)";

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: TEAL }}
      >
        <Truck className="h-5 w-5 text-white" strokeWidth={2.2} />
      </div>
      <span className="text-[19px] font-extrabold tracking-tight" style={{ color: INK }}>
        Track<span style={{ color: TEAL }}>My</span>RMC
      </span>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
}) {
  return (
    <button className="flex flex-col items-center gap-1.5">
      <div
        className="relative flex h-14 w-14 items-center justify-center rounded-2xl border bg-white"
        style={{ borderColor: LINE }}
      >
        {icon}
        {badge}
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
  last,
}: {
  label: string;
  done?: boolean;
  active?: boolean;
  icon: React.ReactNode;
  last?: boolean;
}) {
  const color = done || active ? TEAL : "#cbc9c4";
  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="flex w-full items-center">
        <div className="flex-1">
          {!last && <div className="ml-0 h-[3px] w-full" style={{ background: "transparent" }} />}
        </div>
      </div>
      <div className="relative flex w-full items-center justify-center">
        {/* connector left is handled by parent grid; keep dot centered */}
        <div
          className="z-10 flex h-8 w-8 items-center justify-center rounded-full"
          style={{
            background: done ? TEAL : active ? "#e7f2f0" : "#f0efec",
            border: active ? `2px solid ${TEAL}` : "none",
          }}
        >
          {done ? (
            <Check className="h-4 w-4 text-white" strokeWidth={3} />
          ) : (
            <span style={{ color }}>{icon}</span>
          )}
        </div>
      </div>
      <span
        className="mt-1 text-[10px] font-medium"
        style={{ color: active ? TEAL : done ? INK : MUTED }}
      >
        {label}
      </span>
    </div>
  );
}

function BillItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex flex-1 flex-col items-center gap-1.5">
      <div
        className="flex h-14 w-full items-center justify-center rounded-xl border bg-white"
        style={{ borderColor: LINE }}
      >
        {icon}
      </div>
      <span className="text-[10.5px] font-medium leading-tight text-center" style={{ color: INK }}>
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
            <button
              className="relative flex h-9 w-9 items-center justify-center rounded-full border bg-white"
              style={{ borderColor: LINE }}
            >
              <Bell className="h-[18px] w-[18px]" style={{ color: INK }} />
              <span
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
                style={{ background: "#ef4444" }}
              />
            </button>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: "#e7f2f0", border: `1.5px solid ${TEAL}` }}
            >
              <User className="h-[18px] w-[18px]" style={{ color: TEAL }} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-28">
          {/* Hero */}
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{
              background: `linear-gradient(120deg, ${TEAL_DEEP} 0%, ${TEAL} 55%, ${TEAL_HI} 100%)`,
            }}
          >
            <img
              src="/__mockup/images/rmc-hero-truck.png"
              alt="Concrete mixer truck"
              className="absolute bottom-0 right-0 h-full w-[62%] object-cover object-left opacity-90"
              style={{
                maskImage: "linear-gradient(to right, transparent 0%, black 38%)",
                WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 38%)",
              }}
            />
            <div className="relative z-10 max-w-[62%] p-4">
              <h1 className="text-[20px] font-extrabold leading-[1.15] text-white">
                Ready Mix Concrete, On Time, Every Time.
              </h1>
              <p className="mt-1.5 text-[12px] leading-snug text-white/85">
                Order, track and manage concrete deliveries in real-time.
              </p>
              <button
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold shadow-sm"
                style={{ color: TEAL_DEEP }}
              >
                <Plus className="h-4 w-4" strokeWidth={2.6} /> Place Order
              </button>
            </div>
            <div className="absolute bottom-3 left-4 z-10 flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full"
                  style={{
                    width: i === 0 ? 16 : 6,
                    background: i === 0 ? "#ffffff" : "rgba(255,255,255,0.5)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-[16px] font-bold" style={{ color: INK }}>
              Quick Actions
            </h2>
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ background: "#e7f2f0" }}
            >
              <ShieldCheck className="h-4 w-4" style={{ color: TEAL }} />
              <span className="text-[12px] font-semibold" style={{ color: TEAL_DEEP }}>
                Complete KYC
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-6 gap-2">
            <QuickAction
              label="Place Order"
              icon={<Truck className="h-6 w-6" style={{ color: TEAL }} />}
              badge={
                <span
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-white"
                  style={{ background: TEAL }}
                >
                  <Plus className="h-3 w-3" strokeWidth={3} />
                </span>
              }
            />
            <QuickAction label="My Orders" icon={<ClipboardList className="h-6 w-6" style={{ color: TEAL }} />} />
            <QuickAction label="Track Live" icon={<MapPin className="h-6 w-6" style={{ color: TEAL }} />} />
            <QuickAction label="Statement" icon={<BadgeIndianRupee className="h-6 w-6" style={{ color: TEAL }} />} />
            <QuickAction label="Repeat Order" icon={<RotateCcw className="h-6 w-6" style={{ color: TEAL }} />} />
            <QuickAction label="Support" icon={<Headphones className="h-6 w-6" style={{ color: TEAL }} />} />
          </div>

          {/* Prompt banner (KYC instead of promo) */}
          <div
            className="mt-4 flex items-center gap-3 rounded-xl border px-3.5 py-3"
            style={{ background: "#f0f7f5", borderColor: "rgba(15,118,110,0.18)" }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "#d9ece8" }}
            >
              <ShieldCheck className="h-5 w-5" style={{ color: TEAL }} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold leading-tight" style={{ color: INK }}>
                Verify your identity to order faster
              </p>
              <p className="text-[11.5px]" style={{ color: MUTED }}>
                Complete Aadhaar KYC — takes under a minute.
              </p>
            </div>
            <button className="flex items-center gap-0.5 text-[12px] font-bold" style={{ color: TEAL }}>
              Verify <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* My Orders */}
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-[16px] font-bold" style={{ color: INK }}>
              My Orders
            </h2>
            <button className="flex items-center gap-0.5 text-[12.5px] font-semibold" style={{ color: TEAL }}>
              View All <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 rounded-2xl border bg-white p-4" style={{ borderColor: LINE }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold" style={{ color: INK }}>
                    Order #TM12345
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                    style={{ background: "#e7f2f0", color: TEAL_DEEP }}
                  >
                    On the way
                  </span>
                </div>
                <p className="mt-1 text-[12px]" style={{ color: MUTED }}>
                  M25 · 10 m³ · 2 Jul 2026 · 10:30 AM
                </p>
              </div>
              <Truck className="h-8 w-8" style={{ color: TEAL }} />
            </div>

            {/* Stepper */}
            <div className="relative mt-4">
              <div
                className="absolute left-[8%] right-[8%] top-4 h-[3px]"
                style={{ background: "#eceae6" }}
              />
              <div
                className="absolute left-[8%] top-4 h-[3px]"
                style={{ background: TEAL, width: "50%" }}
              />
              <div className="relative flex justify-between">
                <Step label="Pending" done icon={<Check className="h-4 w-4" />} />
                <Step label="Dispatched" done icon={<Truck className="h-4 w-4" />} />
                <Step label="On the way" active icon={<Truck className="h-4 w-4" />} />
                <Step label="Delivered" icon={<Check className="h-4 w-4" />} last />
              </div>
            </div>
          </div>

          {/* Billing & Documents (replaces Recharge & Bills) */}
          <h2 className="mt-6 text-[16px] font-bold" style={{ color: INK }}>
            Billing &amp; Documents
          </h2>
          <div className="mt-3 flex gap-2.5">
            <BillItem icon={<Wallet className="h-6 w-6" style={{ color: TEAL }} />} label="Statement" />
            <BillItem icon={<BadgeIndianRupee className="h-6 w-6" style={{ color: TEAL }} />} label="Outstanding" />
            <BillItem icon={<Receipt className="h-6 w-6" style={{ color: TEAL }} />} label="Challans" />
            <BillItem icon={<FileText className="h-6 w-6" style={{ color: TEAL }} />} label="Ledger" />
            <BillItem icon={<Download className="h-6 w-6" style={{ color: TEAL }} />} label="Download" />
          </div>

          {/* Find Plants Near You */}
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-[16px] font-bold" style={{ color: INK }}>
              Find Plants Near You
            </h2>
            <button className="flex items-center gap-0.5 text-[12.5px] font-semibold" style={{ color: TEAL }}>
              View All <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-2xl border bg-white p-3" style={{ borderColor: LINE }}>
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "#eef4f2" }}
            >
              <MapPin className="h-6 w-6" style={{ color: TEAL }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-bold" style={{ color: INK }}>
                  Aakruti Infra RMC
                </span>
                <span
                  className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold"
                  style={{ background: "#e7f2f0", color: TEAL_DEEP }}
                >
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
              </div>
              <p className="mt-0.5 text-[12px]" style={{ color: MUTED }}>
                2.4 km away · Panvel, Maharashtra
              </p>
            </div>
            <button
              className="rounded-xl px-3.5 py-2 text-[12px] font-bold text-white"
              style={{ background: TEAL }}
            >
              Order Now
            </button>
          </div>
        </main>

        {/* Bottom Tab Bar */}
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
              Place Order
            </span>
          </div>
          <TabItem icon={<MapPin className="h-5 w-5" />} label="Plants" />
          <TabItem icon={<Menu className="h-5 w-5" />} label="More" />
        </nav>
      </div>
    </div>
  );
}

function TabItem({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button className="flex flex-col items-center gap-1">
      <span style={{ color: active ? TEAL : MUTED }}>{icon}</span>
      <span
        className="text-[10px] font-medium"
        style={{ color: active ? TEAL : MUTED }}
      >
        {label}
      </span>
    </button>
  );
}
