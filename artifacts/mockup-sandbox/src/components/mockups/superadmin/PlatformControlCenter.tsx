import {
  ShieldCheck, Bell, Menu, Building2, Inbox, IndianRupee, TrendingUp,
  Users, Plus, UserPlus, Upload, Radar, Check, X, MapPin, ChevronRight,
  Activity, Crown, Wrench, Calculator, UserCog, KeyRound,
} from "lucide-react";

const TEAL = "#178a6e";
const TEAL_GRAD = "linear-gradient(135deg,#1aa17f,#127a61)";
const INK = "#0f2e29";

function Stat({
  icon: Icon, label, value, sub, alert,
}: {
  icon: any; label: string; value: string; sub?: string; alert?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white border p-4 flex flex-col gap-3"
      style={{ borderColor: "#e3efeb", boxShadow: "0 1px 2px rgba(15,46,41,0.04)" }}>
      <div className="flex items-center justify-between">
        <div className="h-9 w-9 rounded-xl grid place-items-center"
          style={{ background: "rgba(23,138,110,0.10)", color: TEAL }}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        {alert && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(239,68,68,0.12)", color: "#dc2626" }}>
            NEEDS ACTION
          </span>
        )}
      </div>
      <div>
        <div className="text-[22px] font-bold leading-none tracking-tight" style={{ color: INK }}>{value}</div>
        <div className="text-[12px] mt-1.5" style={{ color: "#5b716c" }}>{label}</div>
        {sub && <div className="text-[11px] mt-0.5 font-medium" style={{ color: TEAL }}>{sub}</div>}
      </div>
    </div>
  );
}

function Card({
  title, icon: Icon, action, children,
}: { title: string; icon: any; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border p-5"
      style={{ borderColor: "#e3efeb", boxShadow: "0 1px 2px rgba(15,46,41,0.04)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Icon className="h-[18px] w-[18px]" style={{ color: TEAL }} />
          <h3 className="text-[15px] font-semibold" style={{ color: INK }}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

type Tone = "active" | "invited" | "none" | "owner" | "admin" | "operator" | "accountant" | "lead" | "req";
function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const map: Record<Tone, { bg: string; c: string }> = {
    active: { bg: "rgba(34,197,94,0.14)", c: "#15803d" },
    invited: { bg: "rgba(245,158,11,0.16)", c: "#b45309" },
    none: { bg: "rgba(100,116,139,0.14)", c: "#64748b" },
    owner: { bg: "rgba(23,138,110,0.14)", c: TEAL },
    admin: { bg: "rgba(23,138,110,0.14)", c: TEAL },
    operator: { bg: "rgba(56,189,248,0.16)", c: "#0284c7" },
    accountant: { bg: "rgba(168,85,247,0.14)", c: "#7c3aed" },
    lead: { bg: "rgba(56,189,248,0.16)", c: "#0284c7" },
    req: { bg: "rgba(23,138,110,0.14)", c: TEAL },
  };
  const s = map[tone];
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center"
      style={{ background: s.bg, color: s.c }}>
      {children}
    </span>
  );
}

function Avatar({ name, tone = TEAL }: { name: string; tone?: string }) {
  return (
    <span className="h-7 w-7 rounded-full grid place-items-center text-[11px] font-bold shrink-0"
      style={{ background: "rgba(23,138,110,0.10)", color: tone }}>
      {name.charAt(0)}
    </span>
  );
}

function ActionChip({ icon: Icon, label, hint }: { icon: any; label: string; hint: string }) {
  return (
    <button className="flex items-center gap-3 rounded-2xl bg-white border px-4 py-3.5 text-left w-full transition-shadow hover:shadow-md"
      style={{ borderColor: "#e3efeb", boxShadow: "0 1px 2px rgba(15,46,41,0.04)" }}>
      <span className="h-9 w-9 rounded-xl grid place-items-center shrink-0"
        style={{ background: "rgba(23,138,110,0.10)", color: TEAL }}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold leading-tight" style={{ color: INK }}>{label}</span>
        <span className="block text-[11.5px]" style={{ color: TEAL }}>{hint} →</span>
      </span>
    </button>
  );
}

const roleIcon: Record<string, any> = { Admin: UserCog, Operator: Wrench, Accountant: Calculator };

function PlantCard({ p }: { p: typeof plants[number] }) {
  return (
    <div className="rounded-2xl border" style={{ borderColor: "#e3efeb", background: "#fbfdfc" }}>
      {/* header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="h-10 w-10 rounded-xl grid place-items-center shrink-0"
          style={{ background: "rgba(23,138,110,0.10)", color: TEAL }}>
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14.5px] font-semibold truncate" style={{ color: INK }}>{p.name}</span>
            {p.status === "live"
              ? <Pill tone="active">LIVE</Pill>
              : <Pill tone="none">OFFLINE</Pill>}
          </div>
          <div className="text-[11.5px] mt-0.5 flex items-center gap-1.5" style={{ color: "#5b716c" }}>
            <MapPin className="h-3 w-3" /> {p.city} · {p.orders} orders · {p.last}
          </div>
        </div>
        {/* visibility toggle */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-medium" style={{ color: "#5b716c" }}>
            {p.visible ? "Visible" : "Hidden"}
          </span>
          <span className="inline-flex h-5 w-9 rounded-full p-0.5"
            style={{ background: p.visible ? TEAL : "#cbd5cf" }}>
            <span className="h-4 w-4 rounded-full bg-white transition-transform"
              style={{ transform: p.visible ? "translateX(16px)" : "translateX(0)" }} />
          </span>
        </div>
      </div>

      {/* assigned people */}
      <div className="px-4 pb-4">
        <div className="rounded-xl border bg-white px-3.5 py-3" style={{ borderColor: "#e8f1ee" }}>
          {/* owner */}
          <div className="flex items-center gap-2.5 pb-2.5 mb-2.5"
            style={{ borderBottom: "1px solid #eef4f1" }}>
            <Avatar name={p.owner.name} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold truncate" style={{ color: INK }}>{p.owner.name}</div>
              <div className="text-[10.5px]" style={{ color: "#5b716c" }}>Plant owner</div>
            </div>
            {p.owner.status === "active" && <Pill tone="active">ACTIVE</Pill>}
            {p.owner.status === "invited" && <Pill tone="invited">INVITED</Pill>}
            {p.owner.status === "none" && <Pill tone="none">NO OWNER</Pill>}
          </div>

          {/* staff */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10.5px] font-semibold tracking-wide" style={{ color: "#5b716c" }}>
              STAFF · {p.staff.length}
            </span>
          </div>
          {p.staff.length === 0 ? (
            <div className="text-[11.5px] py-1" style={{ color: "#94a3a0" }}>No staff assigned yet.</div>
          ) : (
            <div className="space-y-2">
              {p.staff.map((s) => {
                const RI = roleIcon[s.role] ?? Users;
                return (
                  <div key={s.name} className="flex items-center gap-2.5">
                    <span className="h-6 w-6 rounded-lg grid place-items-center shrink-0"
                      style={{ background: "rgba(23,138,110,0.08)", color: TEAL }}>
                      <RI className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[12.5px] font-medium truncate flex-1" style={{ color: INK }}>{s.name}</span>
                    <Pill tone={s.role.toLowerCase() as Tone}>{s.role}</Pill>
                    {s.status === "active"
                      ? <Pill tone="active">active</Pill>
                      : <Pill tone="invited">invited</Pill>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* actions */}
        <div className="flex items-center gap-2 mt-3">
          <button className="flex-1 h-9 rounded-xl text-[12.5px] font-semibold text-white flex items-center justify-center gap-1.5"
            style={{ background: TEAL_GRAD }}>
            <UserPlus className="h-3.5 w-3.5" /> Provision login
          </button>
          <button className="h-9 px-4 rounded-xl text-[12.5px] font-semibold border"
            style={{ borderColor: "#d6e4df", color: INK }}>
            Manage plant
          </button>
        </div>
      </div>
    </div>
  );
}

const plants = [
  {
    name: "Deccan Ready Mix", city: "Pune", orders: 142, visible: true, status: "live", last: "8m ago",
    owner: { name: "Ramesh Patil", status: "active" },
    staff: [
      { name: "Priya Sharma", role: "Admin", status: "active" },
      { name: "Anil Kumar", role: "Operator", status: "active" },
      { name: "Sunita Rao", role: "Accountant", status: "invited" },
    ],
  },
  {
    name: "Pinnacle Concrete", city: "Mumbai", orders: 98, visible: true, status: "live", last: "26m ago",
    owner: { name: "Vikram Shah", status: "active" },
    staff: [
      { name: "Deepak More", role: "Operator", status: "active" },
      { name: "Neha Joshi", role: "Accountant", status: "active" },
    ],
  },
  {
    name: "GreenStone RMC", city: "Nagpur", orders: 61, visible: true, status: "live", last: "2h ago",
    owner: { name: "Suresh Patel", status: "invited" },
    staff: [
      { name: "Rahul Verma", role: "Operator", status: "invited" },
    ],
  },
  {
    name: "Metro Batching Co.", city: "Aurangabad", orders: 0, visible: false, status: "offline", last: "—",
    owner: { name: "Unassigned", status: "none" },
    staff: [],
  },
] as const;

export function PlatformControlCenter() {
  const requests = [
    { name: "Shree Balaji RMC", city: "Pune, MH", tag: "req" as const, meta: "Customer-requested · 4 asks", when: "12m ago" },
    { name: "UltraMix Concrete", city: "Nashik, MH", tag: "req" as const, meta: "Owner partner request", when: "1h ago" },
    { name: "Konkan ReadyMix", city: "Thane, MH", tag: "lead" as const, meta: "Discovered · GST verified", when: "3h ago" },
  ];

  const activity = [
    { who: "You", what: "verified Deccan Ready Mix", when: "8m" },
    { who: "You", what: "provisioned operator login · Pinnacle", when: "41m" },
    { who: "System", what: "new onboarding request · Shree Balaji", when: "1h" },
    { who: "You", what: "deactivated Metro Batching Co.", when: "3h" },
  ];

  return (
    <div className="min-h-screen w-full font-sans"
      style={{ background: "linear-gradient(180deg,#ffffff 0%,#eef7f4 100%)", color: INK }}>
      {/* top app bar */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b" style={{ borderColor: "#e3efeb" }}>
        <div className="max-w-[1180px] mx-auto px-7 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg grid place-items-center text-white" style={{ background: TEAL_GRAD }}>
              <Crown className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-bold tracking-tight" style={{ color: INK }}>TrackMyRMC</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
              style={{ background: "rgba(34,197,94,0.14)", color: "#15803d" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#16a34a" }} /> Live
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative h-9 w-9 rounded-xl border grid place-items-center" style={{ borderColor: "#e3efeb" }}>
              <Bell className="h-[18px] w-[18px]" style={{ color: "#5b716c" }} />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full" style={{ background: "#ef4444" }} />
            </button>
            <button className="h-9 w-9 rounded-xl border grid place-items-center" style={{ borderColor: "#e3efeb" }}>
              <Menu className="h-[18px] w-[18px]" style={{ color: "#5b716c" }} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1180px] mx-auto px-7 py-6">
        {/* page title */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-6 w-6" style={{ color: TEAL }} />
              <h1 className="text-[26px] font-bold tracking-tight" style={{ color: INK }}>Platform Control Center</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: "rgba(23,138,110,0.12)", color: TEAL }}>SUPER ADMIN</span>
            </div>
            <p className="text-[13px] mt-1" style={{ color: "#5b716c" }}>Welcome back, Super · Sunday, 28 June 2026</p>
          </div>
        </div>

        {/* quick actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <ActionChip icon={Building2} label="Add a Plant" hint="Onboard" />
          <ActionChip icon={UserPlus} label="Provision Login" hint="Create access" />
          <ActionChip icon={Radar} label="Discover Plants" hint="Find nearby" />
          <ActionChip icon={Upload} label="Import Plants" hint="Upload CSV" />
        </div>

        {/* KPI grid — platform-level only */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
          <Stat icon={Building2} label="Partner plants (live)" value="24" sub="+3 this month" />
          <Stat icon={Inbox} label="Onboarding queue" value="7" alert />
          <Stat icon={TrendingUp} label="Orders this month" value="1,284" />
          <Stat icon={IndianRupee} label="Platform GMV" value="₹4.2 Cr" sub="8,450 m³" />
          <Stat icon={ShieldCheck} label="Commission earned" value="₹21.3 L" />
          <Stat icon={Users} label="Active customers" value="612" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* left */}
          <div className="lg:col-span-2 space-y-5">
            <Card
              title="Onboarding pipeline"
              icon={Inbox}
              action={
                <button className="text-[12px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-white"
                  style={{ background: TEAL_GRAD }}>
                  <Radar className="h-3.5 w-3.5" /> Discover
                </button>
              }
            >
              <div className="space-y-2.5">
                {requests.map((r) => (
                  <div key={r.name} className="flex items-center gap-3 rounded-xl border px-3.5 py-3"
                    style={{ borderColor: "#e8f1ee", background: "#fbfdfc" }}>
                    <div className="h-9 w-9 rounded-lg grid place-items-center shrink-0"
                      style={{ background: "rgba(23,138,110,0.08)", color: TEAL }}>
                      <Building2 className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold truncate" style={{ color: INK }}>{r.name}</span>
                        <Pill tone={r.tag}>{r.tag === "req" ? "REQUEST" : "LEAD"}</Pill>
                      </div>
                      <div className="text-[11.5px] mt-0.5 flex items-center gap-1.5" style={{ color: "#5b716c" }}>
                        <MapPin className="h-3 w-3" /> {r.city} · {r.meta}
                      </div>
                    </div>
                    <span className="text-[11px] hidden sm:block" style={{ color: "#94a3a0" }}>{r.when}</span>
                    <button className="h-8 px-3 rounded-lg text-[12px] font-semibold text-white flex items-center gap-1"
                      style={{ background: TEAL_GRAD }}>
                      <Check className="h-3.5 w-3.5" /> Onboard
                    </button>
                    <button className="h-8 w-8 rounded-lg grid place-items-center border" style={{ borderColor: "#e3efeb" }}>
                      <X className="h-3.5 w-3.5" style={{ color: "#5b716c" }} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Partner plants — staff & owners nested under each plant */}
            <Card
              title="Partner plants — owners & staff"
              icon={Building2}
              action={<span className="text-[12px]" style={{ color: "#5b716c" }}>24 plants · 22 active</span>}
            >
              <div className="space-y-3.5">
                {plants.map((p) => <PlantCard key={p.name} p={p} />)}
              </div>
            </Card>
          </div>

          {/* right rail */}
          <div className="space-y-5">
            {/* Customers — aggregate only (privacy) */}
            <Card title="Customers" icon={Users}>
              <div className="rounded-xl border px-4 py-4 mb-3 text-center"
                style={{ background: "rgba(23,138,110,0.05)", borderColor: "rgba(23,138,110,0.18)" }}>
                <div className="text-[34px] font-bold leading-none" style={{ color: INK }}>612</div>
                <div className="text-[12px] mt-1.5" style={{ color: "#5b716c" }}>active customer accounts</div>
              </div>
              <div className="text-[11.5px] flex items-start gap-2 rounded-lg px-2.5 py-2"
                style={{ background: "#f3f8f6", color: "#5b716c" }}>
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: TEAL }} />
                <span>Customer details stay private. Per our privacy policy, only the aggregate count is shown — no personal data.</span>
              </div>
            </Card>

            <Card title="Access summary" icon={KeyRound}>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  ["15", "Owners"],
                  ["40", "Staff"],
                  ["6", "Pending"],
                ].map(([v, k]) => (
                  <div key={k} className="rounded-xl border px-2 py-2.5 text-center" style={{ borderColor: "#e8f1ee" }}>
                    <div className="text-[18px] font-bold leading-none" style={{ color: INK }}>{v}</div>
                    <div className="text-[10.5px] mt-1" style={{ color: "#5b716c" }}>{k}</div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] mt-3 flex items-center gap-1.5" style={{ color: "#5b716c" }}>
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: TEAL }} />
                Owners & staff are managed under their plant above.
              </div>
            </Card>

            <Card title="Recent activity" icon={Activity}>
              <div className="space-y-3.5">
                {activity.map((a, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: TEAL }} />
                    <div className="flex-1">
                      <div className="text-[12.5px]" style={{ color: "#334e48" }}>
                        <span className="font-semibold" style={{ color: INK }}>{a.who}</span> {a.what}
                      </div>
                    </div>
                    <span className="text-[11px]" style={{ color: "#94a3a0" }}>{a.when}</span>
                  </div>
                ))}
              </div>
              <button className="mt-4 w-full text-[12px] font-medium py-2 rounded-lg border"
                style={{ borderColor: "#d6e4df", color: INK }}>
                Open full audit log
              </button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
