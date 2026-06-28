import {
  Crown, Search, Bell, ShieldCheck, Building2, Inbox, IndianRupee,
  TrendingUp, Users, Plus, UserPlus, Upload, Radar, Check, X,
  MapPin, ChevronRight, Activity, MoreHorizontal,
} from "lucide-react";

const GOLD = "#e7b768";

function Stat({
  icon: Icon, label, value, sub, accent, alert,
}: {
  icon: any; label: string; value: string; sub?: string; accent?: boolean; alert?: boolean;
}) {
  return (
    <div
      className="relative rounded-2xl border p-4 flex flex-col gap-3 overflow-hidden"
      style={{
        background: accent
          ? "linear-gradient(160deg,rgba(231,183,104,0.14),rgba(231,183,104,0.03))"
          : "linear-gradient(160deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))",
        borderColor: accent ? "rgba(231,183,104,0.35)" : "rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center justify-between">
        <div
          className="h-9 w-9 rounded-lg grid place-items-center"
          style={{ background: "rgba(231,183,104,0.12)", color: GOLD }}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>
        {alert && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(239,68,68,0.18)", color: "#fca5a5" }}>
            NEEDS ACTION
          </span>
        )}
      </div>
      <div>
        <div className="text-[22px] font-bold leading-none text-white tracking-tight">{value}</div>
        <div className="text-[12px] text-zinc-400 mt-1.5">{label}</div>
        {sub && <div className="text-[11px] mt-0.5" style={{ color: GOLD }}>{sub}</div>}
      </div>
    </div>
  );
}

function SectionCard({
  title, icon: Icon, action, children,
}: { title: string; icon: any; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Icon className="h-[18px] w-[18px]" style={{ color: GOLD }} />
          <h3 className="text-[15px] font-semibold text-white">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Pill({ tone, children }: { tone: "live" | "lead" | "req"; children: React.ReactNode }) {
  const map = {
    live: { bg: "rgba(34,197,94,0.15)", c: "#86efac", label: children },
    lead: { bg: "rgba(56,189,248,0.15)", c: "#7dd3fc", label: children },
    req: { bg: "rgba(231,183,104,0.16)", c: GOLD, label: children },
  }[tone];
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
      style={{ background: map.bg, color: map.c }}>
      {map.label}
    </span>
  );
}

function GhostBtn({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <button
      className="w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors hover:border-[rgba(231,183,104,0.5)]"
      style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <span className="h-8 w-8 rounded-lg grid place-items-center shrink-0"
        style={{ background: "rgba(231,183,104,0.12)", color: GOLD }}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[13px] font-medium text-zinc-100">{children}</span>
      <ChevronRight className="h-4 w-4 text-zinc-600 ml-auto" />
    </button>
  );
}

export function PlatformControlCenter() {
  const requests = [
    { name: "Shree Balaji RMC", city: "Pune, MH", tag: "req" as const, meta: "Customer-requested · 4 asks", when: "12m ago" },
    { name: "UltraMix Concrete", city: "Nashik, MH", tag: "req" as const, meta: "Owner partner request", when: "1h ago" },
    { name: "Konkan ReadyMix", city: "Thane, MH", tag: "lead" as const, meta: "Discovered · GST verified", when: "3h ago" },
    { name: "Sahyadri Batching", city: "Satara, MH", tag: "lead" as const, meta: "Lead · awaiting owner login", when: "Yesterday" },
  ];

  const plants = [
    { name: "Deccan Ready Mix", city: "Pune", orders: 142, owner: "active", active: true, last: "8m ago" },
    { name: "Pinnacle Concrete", city: "Mumbai", orders: 98, owner: "active", active: true, last: "26m ago" },
    { name: "GreenStone RMC", city: "Nagpur", orders: 61, owner: "invited", active: true, last: "2h ago" },
    { name: "Metro Batching Co.", city: "Aurangabad", orders: 0, owner: "none", active: false, last: "—" },
  ];

  const activity = [
    { who: "You", what: "verified Deccan Ready Mix", when: "8m" },
    { who: "Priya (admin)", what: "provisioned operator login · Pinnacle", when: "41m" },
    { who: "System", what: "new onboarding request · Shree Balaji", when: "1h" },
    { who: "You", what: "deactivated Metro Batching Co.", when: "3h" },
  ];

  return (
    <div className="min-h-screen w-full font-sans text-white" style={{ background: "#0a0b0d" }}>
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 opacity-60"
        style={{ background: "radial-gradient(900px 420px at 12% -8%, rgba(231,183,104,0.10), transparent 60%)" }} />

      <div className="relative max-w-[1180px] mx-auto px-7 py-6">
        {/* Top bar */}
        <header className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl grid place-items-center"
              style={{ background: "rgba(231,183,104,0.14)", border: "1px solid rgba(231,183,104,0.35)" }}>
              <Crown className="h-5 w-5" style={{ color: GOLD }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-bold tracking-tight">CONCRETE KING</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(231,183,104,0.16)", color: GOLD }}>SUPER ADMIN</span>
              </div>
              <div className="text-[11px] text-zinc-500">Platform Control Center</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 rounded-xl border px-3 py-2 w-[260px]"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
              <Search className="h-4 w-4 text-zinc-500" />
              <span className="text-[12px] text-zinc-500">Search plants, owners, cities…</span>
            </div>
            <button className="relative h-9 w-9 rounded-xl border grid place-items-center"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}>
              <Bell className="h-[18px] w-[18px] text-zinc-300" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full" style={{ background: "#ef4444" }} />
            </button>
            <div className="h-9 w-9 rounded-full grid place-items-center text-[12px] font-bold text-black"
              style={{ background: GOLD }}>SA</div>
          </div>
        </header>

        {/* KPI grid — platform-level only */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-7">
          <Stat icon={Building2} label="Partner plants (live)" value="24" sub="+3 this month" accent />
          <Stat icon={Inbox} label="Onboarding queue" value="7" alert />
          <Stat icon={TrendingUp} label="Orders this month" value="1,284" />
          <Stat icon={IndianRupee} label="Platform GMV" value="₹4.2 Cr" sub="8,450 m³" />
          <Stat icon={ShieldCheck} label="Commission earned" value="₹21.3 L" />
          <Stat icon={Users} label="Active customers" value="612" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Onboarding pipeline — the core job */}
          <div className="lg:col-span-2 space-y-5">
            <SectionCard
              title="Onboarding pipeline"
              icon={Inbox}
              action={
                <button className="text-[12px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-black"
                  style={{ background: GOLD }}>
                  <Radar className="h-3.5 w-3.5" /> Discover plants
                </button>
              }
            >
              <div className="space-y-2.5">
                {requests.map((r) => (
                  <div key={r.name}
                    className="flex items-center gap-3 rounded-xl border px-3.5 py-3"
                    style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
                    <div className="h-9 w-9 rounded-lg grid place-items-center shrink-0"
                      style={{ background: "rgba(255,255,255,0.05)" }}>
                      <Building2 className="h-[18px] w-[18px] text-zinc-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-white truncate">{r.name}</span>
                        <Pill tone={r.tag}>{r.tag === "req" ? "REQUEST" : "LEAD"}</Pill>
                      </div>
                      <div className="text-[11.5px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                        <MapPin className="h-3 w-3" /> {r.city} · {r.meta}
                      </div>
                    </div>
                    <span className="text-[11px] text-zinc-600 hidden sm:block">{r.when}</span>
                    <button className="h-8 px-3 rounded-lg text-[12px] font-semibold text-black flex items-center gap-1"
                      style={{ background: GOLD }}>
                      <Check className="h-3.5 w-3.5" /> Onboard
                    </button>
                    <button className="h-8 w-8 rounded-lg grid place-items-center border"
                      style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                      <X className="h-3.5 w-3.5 text-zinc-400" />
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Partner plant directory */}
            <SectionCard
              title="Partner plants"
              icon={Building2}
              action={<span className="text-[12px] text-zinc-500">24 plants · 22 active</span>}
            >
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[11px] text-zinc-500" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <th className="font-medium px-4 py-2.5">Plant</th>
                      <th className="font-medium px-4 py-2.5">Owner login</th>
                      <th className="font-medium px-4 py-2.5">Orders</th>
                      <th className="font-medium px-4 py-2.5">Visible</th>
                      <th className="font-medium px-4 py-2.5">Last activity</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {plants.map((p, i) => (
                      <tr key={p.name} className="text-[13px]"
                        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{p.name}</div>
                          <div className="text-[11px] text-zinc-500">{p.city}</div>
                        </td>
                        <td className="px-4 py-3">
                          {p.owner === "active" && <Pill tone="live">ACTIVE</Pill>}
                          {p.owner === "invited" && <Pill tone="req">INVITED</Pill>}
                          {p.owner === "none" && <span className="text-[11px] text-zinc-600">— none —</span>}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{p.orders}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex h-5 w-9 rounded-full p-0.5"
                            style={{ background: p.active ? GOLD : "rgba(255,255,255,0.12)" }}>
                            <span className="h-4 w-4 rounded-full bg-black transition-transform"
                              style={{ transform: p.active ? "translateX(16px)" : "translateX(0)" }} />
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 text-[12px]">{p.last}</td>
                        <td className="px-4 py-3 text-right">
                          <button className="h-7 px-2.5 rounded-lg text-[12px] font-medium border text-zinc-300"
                            style={{ borderColor: "rgba(255,255,255,0.12)" }}>Manage</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>

          {/* Right rail */}
          <div className="space-y-5">
            <SectionCard title="Quick actions" icon={Plus}>
              <div className="space-y-2.5">
                <GhostBtn icon={Building2}>Add a plant</GhostBtn>
                <GhostBtn icon={UserPlus}>Provision a login</GhostBtn>
                <GhostBtn icon={Upload}>Import plants (CSV)</GhostBtn>
                <GhostBtn icon={Radar}>Discover nearby plants</GhostBtn>
              </div>
            </SectionCard>

            <SectionCard title="Users" icon={Users}>
              <div className="rounded-xl border px-4 py-4 mb-3 text-center"
                style={{ background: "rgba(231,183,104,0.06)", borderColor: "rgba(231,183,104,0.22)" }}>
                <div className="text-[34px] font-bold text-white leading-none">682</div>
                <div className="text-[12px] text-zinc-400 mt-1.5">total accounts on the platform</div>
              </div>
              <div className="grid grid-cols-3 gap-2.5 mb-3">
                {[
                  ["612", "Customers"],
                  ["55", "Staff"],
                  ["15", "Owners"],
                ].map(([v, k]) => (
                  <div key={k} className="rounded-xl border px-2 py-2.5 text-center"
                    style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
                    <div className="text-[16px] font-bold text-white leading-none">{v}</div>
                    <div className="text-[10.5px] text-zinc-500 mt-1">{k}</div>
                  </div>
                ))}
              </div>
              <div className="text-[11.5px] text-zinc-400 flex items-start gap-2 rounded-lg px-2.5 py-2"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: GOLD }} />
                <span>Individual user details are private. Per our privacy policy, only aggregate counts are shown — no personal data.</span>
              </div>
            </SectionCard>

            <SectionCard
              title="Recent activity"
              icon={Activity}
              action={<MoreHorizontal className="h-4 w-4 text-zinc-500" />}
            >
              <div className="space-y-3.5">
                {activity.map((a, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: GOLD }} />
                    <div className="flex-1">
                      <div className="text-[12.5px] text-zinc-200">
                        <span className="font-semibold text-white">{a.who}</span> {a.what}
                      </div>
                    </div>
                    <span className="text-[11px] text-zinc-600">{a.when}</span>
                  </div>
                ))}
              </div>
              <button className="mt-4 w-full text-[12px] font-medium py-2 rounded-lg border text-zinc-300"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                Open full audit log
              </button>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
