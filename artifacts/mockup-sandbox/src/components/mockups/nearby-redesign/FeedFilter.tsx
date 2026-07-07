import React, { useState } from "react";
import {
  MapPin,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Star,
  Clock,
  Phone,
  Navigation,
  ShieldCheck,
  ChevronRight,
  Info,
  Map,
  List
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
    id: "1",
    name: "UltraTech RMC - Hinjewadi",
    distance: 2.3,
    address: "Phase 2, Hinjewadi IT Park, Pune",
    phone: "+91 98765 43210",
    openNow: true,
    hours: "6:00-20:00",
    deliveryRadius: 25,
    grades: ["M20", "M25", "M30"],
    thumb: "/__mockup/images/plant-thumb-1.png",
  },
  {
    id: "2",
    name: "ACC Concrete - Wakad",
    distance: 4.1,
    address: "Datta Mandir Road, Wakad, Pune",
    phone: "+91 98765 43211",
    openNow: true,
    hours: "7:00-22:00",
    deliveryRadius: 30,
    grades: ["M15", "M20", "M25", "M35"],
    thumb: "/__mockup/images/plant-thumb-2.png",
  },
  {
    id: "3",
    name: "Nuvoco RMX - Baner",
    distance: 6.8,
    address: "Baner Road, Near Bitwise, Pune",
    phone: "+91 98765 43212",
    openNow: true,
    hours: "6:00-21:00",
    deliveryRadius: 20,
    grades: ["M25", "M30", "M40"],
    thumb: "/__mockup/images/plant-thumb-1.png",
  },
  {
    id: "4",
    name: "Prism Johnson RMC - Balewadi",
    distance: 8.2,
    address: "Balewadi High Street, Pune",
    phone: "+91 98765 43213",
    openNow: false,
    hours: "8:00-18:00",
    deliveryRadius: 15,
    grades: ["M20", "M25"],
    thumb: "/__mockup/images/plant-thumb-2.png",
  },
];

const UNVERIFIED_PLANTS = [
  {
    id: "5",
    name: "Shree RMC Works - Ravet",
    distance: 11.0,
    address: "Mumbai-Pune Highway, Ravet, Pune",
    phone: "+91 98765 43214",
    openNow: true,
  },
  {
    id: "6",
    name: "Sai Concrete Suppliers - Punawale",
    distance: 13.0,
    address: "Punawale Road, Near Kate Wasti, Pune",
    phone: "+91 98765 43215",
    openNow: true,
  },
];

export default function FeedFilter() {
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  return (
    <div
      className="relative flex flex-col mx-auto overflow-hidden font-sans"
      style={{
        width: "390px",
        height: "844px",
        backgroundColor: COLORS.bg,
        color: COLORS.ink,
      }}
    >
      {/* Header Area */}
      <div
        className="z-10 flex flex-col pt-12 pb-3 px-4 shadow-sm shrink-0"
        style={{ backgroundColor: COLORS.surface }}
      >
        {/* Top Row: Location & Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full" style={{ backgroundColor: "rgba(23,138,110,0.1)" }}>
              <MapPin size={18} color={COLORS.primaryDeep} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: COLORS.muted }}>
                Deliver to
              </span>
              <div className="flex items-center gap-1 cursor-pointer">
                <span className="text-[15px] font-extrabold" style={{ color: COLORS.ink }}>
                  Hinjewadi, Pune
                </span>
                <ChevronDown size={16} color={COLORS.primary} />
              </div>
            </div>
          </div>
          
          <button 
            className="flex items-center justify-center p-2 rounded-full border"
            style={{ borderColor: COLORS.hairline, backgroundColor: COLORS.bg }}
            onClick={() => setViewMode(viewMode === "list" ? "map" : "list")}
          >
            {viewMode === "list" ? (
              <Map size={18} color={COLORS.ink} />
            ) : (
              <List size={18} color={COLORS.ink} />
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search size={18} color={COLORS.muted} />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-[15px] font-medium outline-none border-none placeholder-opacity-70 shadow-sm"
            placeholder="Search plants, grades, or locations..."
            style={{
              backgroundColor: COLORS.bg,
              color: COLORS.ink,
            }}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 border-l border-opacity-10" style={{ borderColor: COLORS.hairline }}>
            <div className="pl-3">
              <SlidersHorizontal size={18} color={COLORS.primaryDeep} />
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-1 -mx-4 px-4">
          <div className="flex shrink-0 items-center justify-center px-3 py-1.5 rounded-lg border font-semibold text-[13px] shadow-sm"
            style={{ borderColor: COLORS.hairline, backgroundColor: COLORS.surface }}>
            Radius: 100km <ChevronDown size={14} className="ml-1" />
          </div>
          <div className="flex shrink-0 items-center justify-center px-3 py-1.5 rounded-lg border font-semibold text-[13px] shadow-sm"
            style={{ borderColor: COLORS.primary, backgroundColor: "rgba(23,138,110,0.05)", color: COLORS.primaryDeep }}>
            Open now
          </div>
          <div className="flex shrink-0 items-center justify-center px-3 py-1.5 rounded-lg border font-semibold text-[13px] shadow-sm"
            style={{ borderColor: COLORS.hairline, backgroundColor: COLORS.surface }}>
            M25 <ChevronDown size={14} className="ml-1" />
          </div>
          <div className="flex shrink-0 items-center justify-center px-3 py-1.5 rounded-lg border font-semibold text-[13px] shadow-sm"
            style={{ borderColor: COLORS.hairline, backgroundColor: COLORS.surface }}>
            Sort: Nearest <ChevronDown size={14} className="ml-1" />
          </div>
        </div>
      </div>

      {/* Feed Area */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-20">
        <h2 className="text-[17px] font-bold mb-3 flex items-center gap-2" style={{ color: COLORS.ink }}>
          Verified Partners <span className="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider">{VERIFIED_PLANTS.length} available</span>
        </h2>
        
        <div className="flex flex-col gap-4 mb-8">
          {VERIFIED_PLANTS.map((plant) => (
            <div
              key={plant.id}
              className="rounded-2xl p-4 shadow-sm border relative overflow-hidden"
              style={{ backgroundColor: COLORS.surface, borderColor: COLORS.hairline }}
            >
              {/* Badge */}
              <div className="absolute top-0 right-0 bg-green-50 px-2 py-1 rounded-bl-lg border-b border-l flex items-center gap-1" style={{ borderColor: 'rgba(34,197,94,0.2)' }}>
                <ShieldCheck size={12} color={COLORS.positive} />
                <span className="text-[10px] font-bold" style={{ color: COLORS.positive }}>VERIFIED</span>
              </div>

              <div className="flex gap-3 mb-3">
                <div className="w-[84px] h-[84px] rounded-xl overflow-hidden shrink-0 border" style={{ borderColor: COLORS.hairline, backgroundColor: COLORS.bg }}>
                  <img src={plant.thumb} alt={plant.name} className="w-full h-full object-cover mix-blend-multiply" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <h3 className="text-[16px] font-bold leading-tight truncate mb-1">{plant.name}</h3>
                  <div className="flex items-center gap-1.5 text-[12px] font-medium mb-1.5" style={{ color: COLORS.muted }}>
                    <MapPin size={12} /> {plant.distance} km away
                  </div>
                  <div className="flex items-center gap-2 text-[12px] font-medium">
                    <span className="flex items-center gap-1" style={{ color: plant.openNow ? COLORS.positive : COLORS.danger }}>
                      <Clock size={12} /> {plant.openNow ? "Open" : "Closed"}
                    </span>
                    <span style={{ color: COLORS.muted }}>• {plant.hours}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {plant.grades.map(grade => (
                  <span key={grade} className="px-2 py-0.5 rounded text-[11px] font-bold" style={{ backgroundColor: COLORS.bg, color: COLORS.ink }}>
                    {grade}
                  </span>
                ))}
                <span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor: COLORS.bg, color: COLORS.muted }}>
                  Up to {plant.deliveryRadius}km
                </span>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 py-2.5 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-transform active:scale-95"
                  style={{ backgroundColor: COLORS.primary, color: COLORS.surface }}>
                  Place Order
                </button>
                <button className="px-4 py-2.5 rounded-xl font-bold text-[14px] flex items-center justify-center border transition-transform active:scale-95"
                  style={{ borderColor: COLORS.hairline, color: COLORS.primaryDeep, backgroundColor: COLORS.surface }}>
                  <Map size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1" style={{ backgroundColor: COLORS.hairline }}></div>
          <h2 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: COLORS.muted }}>
            Other Nearby Plants
          </h2>
          <div className="h-px flex-1" style={{ backgroundColor: COLORS.hairline }}></div>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          {UNVERIFIED_PLANTS.map((plant) => (
            <div
              key={plant.id}
              className="rounded-xl p-3 border"
              style={{ backgroundColor: COLORS.bg, borderColor: COLORS.hairline }}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-[14px] font-bold leading-tight mb-1">{plant.name}</h3>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: COLORS.muted }}>
                    <MapPin size={11} /> {plant.distance} km • {plant.address}
                  </div>
                </div>
                <div className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 text-[9px] font-bold uppercase tracking-wide">
                  Not Onboarded
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-3">
                <button className="flex-1 py-2 rounded-lg font-bold text-[12px] border"
                  style={{ borderColor: COLORS.hairline, color: COLORS.ink, backgroundColor: COLORS.surface }}>
                  Request this plant
                </button>
                <button className="px-3 py-2 rounded-lg font-bold text-[12px] border flex items-center justify-center"
                  style={{ borderColor: COLORS.hairline, color: COLORS.ink, backgroundColor: COLORS.surface }}>
                  <Navigation size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 pb-6 opacity-60">
          <Phone size={14} color={COLORS.muted} />
          <span className="text-[12px] font-medium" style={{ color: COLORS.muted }}>Need help? Call +91 74982 86760</span>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
