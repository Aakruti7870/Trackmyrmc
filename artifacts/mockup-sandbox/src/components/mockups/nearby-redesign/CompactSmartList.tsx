import React, { useState } from "react";
import {
  ChevronDown,
  MapPin,
  Search,
  SlidersHorizontal,
  Map,
  List,
  ShieldCheck,
  Clock,
  Phone,
  Truck,
  ArrowRight,
  Info,
  Layers,
  ChevronRight,
  Plus,
  ArrowUpRight
} from "lucide-react";

const COLORS = {
  primary: "#178a6e",
  primaryDeep: "#0f766e",
  primaryBright: "#12876f",
  positive: "#22c55e",
  info: "#38bdf8",
  warning: "#f59e0b",
  danger: "#ef4444",
  ink: "#12211d",
  muted: "#6b7c76",
  surface: "#ffffff",
  bg: "#f4f7f5",
  hairline: "rgba(18,33,29,0.10)",
};

const VERIFIED_PLANTS = [
  {
    id: "v1",
    name: "UltraTech RMC",
    location: "Hinjewadi",
    distance: 2.3,
    address: "Plot 45, Phase 1, MIDC Hinjewadi, Pune",
    phone: "+91 98765 43210",
    openNow: true,
    hours: "6:00-20:00",
    deliveryRadius: 25,
    grades: ["M20", "M25", "M30"],
  },
  {
    id: "v2",
    name: "ACC Concrete",
    location: "Wakad",
    distance: 4.1,
    address: "Survey No 12, Wakad-Thergaon Road, Pune",
    phone: "+91 87654 32109",
    openNow: true,
    hours: "24/7",
    deliveryRadius: 30,
    grades: ["M15", "M20", "M25", "M35"],
  },
  {
    id: "v3",
    name: "Nuvoco RMX",
    location: "Baner",
    distance: 6.8,
    address: "Sr 54/1, Near Baner Hills, Baner, Pune",
    phone: "+91 76543 21098",
    openNow: true,
    hours: "6:00-22:00",
    deliveryRadius: 20,
    grades: ["M25", "M30", "M40"],
  },
  {
    id: "v4",
    name: "Prism Johnson RMC",
    location: "Balewadi",
    distance: 8.2,
    address: "High Street, Balewadi, Pune",
    phone: "+91 65432 10987",
    openNow: false,
    hours: "Opens at 6:00",
    deliveryRadius: 25,
    grades: ["M20", "M25"],
  },
];

const OTHER_PLANTS = [
  {
    id: "u1",
    name: "Shree RMC Works",
    location: "Ravet",
    distance: 11.0,
    address: "Gat 89, Ravet, Pune",
    phone: "+91 99887 76655",
    openNow: true,
  },
  {
    id: "u2",
    name: "Sai Concrete Suppliers",
    location: "Punawale",
    distance: 13.0,
    address: "Punawale Bazar, Pune",
    phone: "+91 88776 65544",
    openNow: true,
  },
];

export default function CompactSmartList() {
  const [tab, setTab] = useState<"verified" | "all">("verified");
  const [radius, setRadius] = useState(100);

  return (
    <div
      className="relative mx-auto flex h-[844px] w-[390px] flex-col overflow-hidden font-sans"
      style={{ backgroundColor: COLORS.bg }}
    >
      {/* Sticky Header */}
      <header className="z-10 flex flex-col bg-white pt-12 pb-3 shadow-sm" style={{ borderBottom: `1px solid ${COLORS.hairline}` }}>
        <div className="px-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.hairline}` }}>
            <MapPin className="h-4 w-4" style={{ color: COLORS.primaryDeep }} />
            <span className="text-[13px] font-semibold" style={{ color: COLORS.ink }}>Hinjewadi, Pune</span>
            <ChevronDown className="h-3.5 w-3.5 ml-0.5" style={{ color: COLORS.muted }} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full bg-white p-1" style={{ border: `1px solid ${COLORS.hairline}` }}>
              <button className="flex items-center justify-center rounded-full px-3 py-1 shadow-sm" style={{ backgroundColor: COLORS.ink, color: COLORS.surface }}>
                <List className="h-3.5 w-3.5 mr-1" />
                <span className="text-[11px] font-bold">List</span>
              </button>
              <button className="flex items-center justify-center rounded-full px-3 py-1" style={{ color: COLORS.muted }}>
                <Map className="h-3.5 w-3.5 mr-1" />
                <span className="text-[11px] font-bold">Map</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 px-4 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5 bg-[#f4f7f5]">
            <Search className="h-4 w-4" style={{ color: COLORS.muted }} />
            <input
              type="text"
              placeholder="Search plants, grades..."
              className="w-full bg-transparent text-[14px] font-medium outline-none placeholder:font-normal"
              style={{ color: COLORS.ink }}
            />
          </div>
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4f7f5]">
            <SlidersHorizontal className="h-4 w-4" style={{ color: COLORS.ink }} />
          </button>
        </div>

        <div className="mt-4 px-4 flex items-center justify-between">
          <div className="flex gap-4">
            <button
              onClick={() => setTab("verified")}
              className="relative pb-2 text-[14px] font-bold"
              style={{ color: tab === "verified" ? COLORS.primaryDeep : COLORS.muted }}
            >
              Verified Partners
              {tab === "verified" && (
                <span className="absolute bottom-0 left-0 h-[2px] w-full rounded-t-full" style={{ backgroundColor: COLORS.primary }} />
              )}
            </button>
            <button
              onClick={() => setTab("all")}
              className="relative pb-2 text-[14px] font-bold"
              style={{ color: tab === "all" ? COLORS.primaryDeep : COLORS.muted }}
            >
              All Plants
              {tab === "all" && (
                <span className="absolute bottom-0 left-0 h-[2px] w-full rounded-t-full" style={{ backgroundColor: COLORS.primary }} />
              )}
            </button>
          </div>
          
          <div className="flex items-center gap-1 pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: COLORS.muted }}>Sort by</span>
            <div className="flex items-center gap-0.5 text-[12px] font-bold" style={{ color: COLORS.ink }}>
              Distance <ChevronDown className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {/* Radius Nudge */}
        <div className="mb-2 flex items-center justify-between rounded-xl px-3 py-2.5" style={{ backgroundColor: "#e0f2fe" }}>
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4" style={{ color: "#0284c7" }} />
            <span className="text-[12px] font-medium" style={{ color: "#0369a1" }}>Showing plants within 100 km.</span>
          </div>
          <button className="text-[12px] font-bold" style={{ color: "#0284c7" }}>Widen to 150 km</button>
        </div>

        {/* Verified Plants */}
        {VERIFIED_PLANTS.map((plant) => (
          <div key={plant.id} className="flex flex-col rounded-2xl bg-white p-3.5 shadow-sm" style={{ border: `1px solid ${COLORS.hairline}` }}>
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[15px] font-bold" style={{ color: COLORS.ink }}>{plant.name}</h3>
                  <div className="flex items-center gap-0.5 rounded px-1 py-0.5" style={{ backgroundColor: "#dcfce7" }}>
                    <ShieldCheck className="h-3 w-3" style={{ color: COLORS.positive }} />
                    <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "#166534" }}>Verified</span>
                  </div>
                </div>
                <p className="mt-0.5 text-[12px] font-medium" style={{ color: COLORS.muted }}>
                  {plant.distance} km · {plant.location}
                </p>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    {plant.openNow && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: COLORS.positive }}></span>}
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: plant.openNow ? COLORS.positive : COLORS.warning }}></span>
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: plant.openNow ? COLORS.positive : COLORS.warning }}>
                    {plant.openNow ? "OPEN NOW" : "CLOSED"}
                  </span>
                </div>
                <span className="mt-0.5 text-[10px] font-semibold" style={{ color: COLORS.muted }}>{plant.hours}</span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: COLORS.muted }}>
                <Truck className="h-3.5 w-3.5" />
                Delivers up to {plant.deliveryRadius}km
              </div>
              <div className="h-3 w-[1px]" style={{ backgroundColor: COLORS.hairline }} />
              <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: COLORS.muted }}>
                <Layers className="h-3.5 w-3.5" />
                {plant.grades.length} Grades available
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {plant.grades.map(grade => (
                <span key={grade} className="rounded bg-[#f4f7f5] px-1.5 py-0.5 text-[11px] font-bold" style={{ color: COLORS.ink, border: `1px solid ${COLORS.hairline}` }}>
                  {grade}
                </span>
              ))}
            </div>

            <div className="mt-3.5 flex items-center gap-2 pt-3.5" style={{ borderTop: `1px solid ${COLORS.hairline}` }}>
              <button className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl font-bold text-[13px] text-white transition-opacity active:opacity-80" style={{ backgroundColor: COLORS.primary }}>
                Place Order <ArrowRight className="h-4 w-4" />
              </button>
              <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.hairline}`, color: COLORS.primaryDeep }}>
                <MapPin className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Other Plants */}
        {tab === "all" && OTHER_PLANTS.map((plant) => (
          <div key={plant.id} className="flex flex-col rounded-2xl bg-white p-3.5 shadow-sm opacity-90" style={{ border: `1px dashed ${COLORS.hairline}` }}>
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[14px] font-bold" style={{ color: COLORS.ink }}>{plant.name}</h3>
                </div>
                <p className="mt-0.5 text-[12px] font-medium" style={{ color: COLORS.muted }}>
                  {plant.distance} km · {plant.location}
                </p>
              </div>
              <div className="rounded bg-gray-100 px-1.5 py-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Unverified</span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 pt-3" style={{ borderTop: `1px solid ${COLORS.hairline}` }}>
              <button className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl font-bold text-[12px]" style={{ backgroundColor: COLORS.bg, color: COLORS.ink, border: `1px solid ${COLORS.hairline}` }}>
                Request this plant
              </button>
              <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: COLORS.bg, border: `1px solid ${COLORS.hairline}`, color: COLORS.ink }}>
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {tab === "all" && OTHER_PLANTS.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-[13px] font-medium" style={{ color: COLORS.muted }}>No other plants found in this area.</p>
          </div>
        )}
      </main>

      {/* Subtle Support Footer */}
      <div className="bg-white py-3 px-4 flex items-center justify-center gap-2 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <Phone className="h-3.5 w-3.5" style={{ color: COLORS.muted }} />
        <span className="text-[11px] font-medium" style={{ color: COLORS.muted }}>Need help? +91 74982 86760</span>
      </div>
    </div>
  );
}
