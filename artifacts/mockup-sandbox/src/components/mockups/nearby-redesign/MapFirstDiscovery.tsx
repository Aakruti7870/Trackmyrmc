import React, { useState } from "react";
import {
  Search,
  MapPin,
  ChevronDown,
  Navigation,
  Phone,
  ShieldCheck,
  Clock,
  Navigation2,
  List,
  Map as MapIcon,
  ChevronLeft
} from "lucide-react";

// Brand Palette
const TEAL = "#178a6e";
const TEAL_DEEP = "#0f766e";
const TEAL_BRIGHT = "#12876f";
const POSITIVE = "#22c55e";
const INFO = "#38bdf8";
const WARNING = "#f59e0b";
const DANGER = "#ef4444";
const INK = "#12211d";
const MUTED = "#6b7c76";
const SURFACE = "#ffffff";
const PAGE_BG = "#f4f7f5";
const HAIRLINE = "rgba(18,33,29,0.10)";

const RADIUS_OPTIONS = [40, 80, 100, 150, 250];

const VERIFIED_PLANTS = [
  {
    id: "v1",
    name: "UltraTech RMC - Hinjewadi",
    distance: 2.3,
    address: "Phase 1, Hinjewadi Rajiv Gandhi Infotech Park, Pune",
    phone: "+91 98765 43210",
    openNow: true,
    hours: "6:00-20:00",
    radius: 25,
    grades: ["M20", "M25", "M30"],
    x: 45, // percentage on map
    y: 30
  },
  {
    id: "v2",
    name: "ACC Concrete - Wakad",
    distance: 4.1,
    address: "Datta Mandir Road, Wakad, Pune",
    phone: "+91 98765 43211",
    openNow: true,
    hours: "6:00-20:00",
    radius: 30,
    grades: ["M15", "M20", "M25", "M35"],
    x: 65,
    y: 45
  },
  {
    id: "v3",
    name: "Nuvoco RMX - Baner",
    distance: 6.8,
    address: "Baner Road, Near Bitwise, Pune",
    phone: "+91 98765 43212",
    openNow: true,
    hours: "7:00-19:00",
    radius: 20,
    grades: ["M25", "M30", "M40"],
    x: 35,
    y: 60
  },
  {
    id: "v4",
    name: "Prism Johnson RMC - Balewadi",
    distance: 8.2,
    address: "Balewadi High Street, Pune",
    phone: "+91 98765 43213",
    openNow: false,
    hours: "6:00-20:00",
    radius: 25,
    grades: ["M20", "M25"],
    x: 75,
    y: 70
  }
];

const UNVERIFIED_PLANTS = [
  {
    id: "u1",
    name: "Shree RMC Works - Ravet",
    distance: 11.0,
    address: "Ravet Village Road, Pune",
    phone: "+91 98765 43214",
    openNow: true,
    hours: "8:00-18:00",
    x: 20,
    y: 20
  },
  {
    id: "u2",
    name: "Sai Concrete Suppliers - Punawale",
    distance: 13.0,
    address: "Punawale Road, Pune",
    phone: "+91 98765 43215",
    openNow: true,
    hours: "8:00-18:00",
    x: 85,
    y: 25
  }
];

export default function MapFirstDiscovery() {
  const [radius, setRadius] = useState(100);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);

  const allPlants = [...VERIFIED_PLANTS, ...UNVERIFIED_PLANTS];
  
  return (
    <div className="relative mx-auto overflow-hidden bg-[#f4f7f5] text-[#12211d] flex flex-col" style={{ width: 390, height: 844, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Map Area */}
      <div className="absolute top-0 left-0 w-full h-[65%] bg-[#e5e5e5]">
        <img 
          src="/__mockup/images/map-bg.png" 
          alt="Map" 
          className="w-full h-full object-cover opacity-80 mix-blend-multiply"
        />
        
        {/* User Location Pin */}
        <div className="absolute flex flex-col items-center" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
          <div className="w-12 h-12 bg-[#38bdf8]/20 rounded-full flex items-center justify-center animate-pulse">
            <div className="w-4 h-4 bg-[#38bdf8] rounded-full border-2 border-white shadow-sm" />
          </div>
        </div>

        {/* Plant Pins */}
        {allPlants.map(plant => {
          const isVerified = 'radius' in plant;
          const isSelected = selectedPlantId === plant.id;
          
          return (
            <div 
              key={plant.id}
              className="absolute flex flex-col items-center cursor-pointer transition-transform"
              style={{ 
                left: `${plant.x}%`, 
                top: `${plant.y}%`, 
                transform: `translate(-50%, -100%) scale(${isSelected ? 1.1 : 1})`,
                zIndex: isSelected ? 10 : 1
              }}
              onClick={() => setSelectedPlantId(plant.id)}
            >
              <div className="bg-white rounded-lg shadow-md px-2 py-1 mb-1 border" style={{ borderColor: isVerified ? TEAL : HAIRLINE }}>
                <span className="text-[10px] font-bold" style={{ color: isVerified ? TEAL_DEEP : MUTED }}>
                  {plant.distance}km
                </span>
              </div>
              <div className="relative">
                <MapPin 
                  size={isSelected ? 32 : 28} 
                  fill={isVerified ? TEAL : "#e5e7eb"} 
                  color={isVerified ? "white" : MUTED} 
                  strokeWidth={1.5}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Floating Controls */}
      <div className="absolute top-0 left-0 w-full z-20 p-4 pt-12 flex flex-col gap-3" style={{ background: 'linear-gradient(to bottom, rgba(244,247,245,0.9) 0%, rgba(244,247,245,0) 100%)' }}>
        
        {/* Header & Search */}
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-[rgba(18,33,29,0.1)]">
            <ChevronLeft size={20} color={INK} />
          </button>
          
          <div className="flex-1 bg-white rounded-full shadow-sm border border-[rgba(18,33,29,0.1)] flex items-center px-4 h-12">
            <Search size={18} color={MUTED} />
            <input 
              type="text" 
              placeholder="Search plants, cities..." 
              className="flex-1 bg-transparent border-none outline-none ml-2 text-[14px] text-[#12211d] placeholder:text-[#6b7c76]"
            />
          </div>

          <button className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-[rgba(18,33,29,0.1)]">
            <List size={20} color={INK} />
          </button>
        </div>

        {/* Location & Radius */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 bg-white rounded-full py-1.5 px-3 w-fit shadow-sm border border-[rgba(18,33,29,0.1)]">
            <Navigation2 size={14} color={INFO} className="fill-[#38bdf8]/20" />
            <span className="text-[12px] font-semibold text-[#12211d]">Hinjewadi, Pune</span>
            <ChevronDown size={14} color={MUTED} />
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {RADIUS_OPTIONS.map(r => (
              <button 
                key={r}
                onClick={() => setRadius(r)}
                className="px-3 py-1.5 rounded-full text-[12px] font-bold shadow-sm whitespace-nowrap transition-colors"
                style={{ 
                  backgroundColor: radius === r ? TEAL : SURFACE,
                  color: radius === r ? SURFACE : INK,
                  border: `1px solid ${radius === r ? TEAL : HAIRLINE}`
                }}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Bottom Sheet List */}
      <div className="absolute bottom-0 left-0 w-full h-[50%] bg-[#f4f7f5] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.08)] z-30 flex flex-col">
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-[#d1d5db] rounded-full"></div>
        </div>
        
        <div className="px-4 pb-2 pt-1 flex justify-between items-end">
          <h2 className="text-[18px] font-extrabold text-[#12211d]">Nearby Plants</h2>
          <span className="text-[12px] font-medium text-[#6b7c76]">Showing {allPlants.length} results</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8 flex flex-col gap-4">
          
          <div className="flex flex-col gap-3">
            <h3 className="text-[11px] font-bold tracking-wider text-[#6b7c76] uppercase mt-1">Verified Partners</h3>
            
            {VERIFIED_PLANTS.map(plant => (
              <div 
                key={plant.id} 
                onClick={() => setSelectedPlantId(plant.id)}
                className="bg-white rounded-2xl p-4 shadow-sm border transition-all"
                style={{ borderColor: selectedPlantId === plant.id ? TEAL : HAIRLINE }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <ShieldCheck size={16} color={POSITIVE} />
                      <h4 className="text-[15px] font-bold text-[#12211d] leading-tight">{plant.name}</h4>
                    </div>
                    <p className="text-[12px] text-[#6b7c76]">{plant.address}</p>
                  </div>
                  <div className="bg-[#f4f7f5] px-2 py-1 rounded-lg">
                    <span className="text-[13px] font-bold text-[#12211d]">{plant.distance}</span>
                    <span className="text-[10px] text-[#6b7c76] ml-0.5">km</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4 mt-3">
                  <div className="flex items-center gap-1 bg-[#f4f7f5] px-2 py-1 rounded-md">
                    <Clock size={12} color={plant.openNow ? POSITIVE : WARNING} />
                    <span className="text-[11px] font-semibold" style={{ color: plant.openNow ? POSITIVE : WARNING }}>
                      {plant.openNow ? "Open" : "Closed"} • {plant.hours}
                    </span>
                  </div>
                  <div className="bg-[#f4f7f5] px-2 py-1 rounded-md text-[11px] font-medium text-[#6b7c76]">
                    Delivers up to {plant.radius}km
                  </div>
                </div>

                <div className="flex gap-1.5 mb-4 overflow-x-hidden">
                  {plant.grades.map(g => (
                    <span key={g} className="bg-[#f0f9f6] text-[#0f766e] border border-[#178a6e]/20 px-2 py-0.5 rounded text-[11px] font-bold">
                      {g}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 bg-[#178a6e] text-white py-2.5 rounded-xl text-[13px] font-bold shadow-sm">
                    Place Order
                  </button>
                  <button className="w-11 h-11 border border-[#178a6e]/30 bg-[#f0f9f6] rounded-xl flex items-center justify-center">
                    <Phone size={18} color={TEAL_DEEP} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 mt-2">
            <h3 className="text-[11px] font-bold tracking-wider text-[#6b7c76] uppercase">Other Plants Nearby</h3>
            
            {UNVERIFIED_PLANTS.map(plant => (
              <div key={plant.id} className="bg-white/60 rounded-2xl p-4 border border-[rgba(18,33,29,0.05)]">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="text-[14px] font-bold text-[#12211d] mb-1">{plant.name}</h4>
                    <p className="text-[12px] text-[#6b7c76]">{plant.address}</p>
                  </div>
                  <div className="bg-white px-2 py-1 rounded-lg border border-[rgba(18,33,29,0.05)]">
                    <span className="text-[12px] font-bold text-[#12211d]">{plant.distance}</span>
                    <span className="text-[10px] text-[#6b7c76] ml-0.5">km</span>
                  </div>
                </div>

                <div className="inline-block bg-[#f3f4f6] px-2 py-1 rounded text-[10px] font-bold text-[#6b7c76] mb-3">
                  UNVERIFIED • NOT ONBOARDED
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 bg-white border border-[rgba(18,33,29,0.15)] text-[#12211d] py-2 rounded-xl text-[12px] font-bold shadow-sm">
                    Request this plant
                  </button>
                  <button className="flex-1 bg-white border border-[rgba(18,33,29,0.15)] text-[#12211d] py-2 rounded-xl text-[12px] font-bold shadow-sm flex items-center justify-center gap-1">
                    <Navigation size={14} /> Directions
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="py-4 text-center">
            <span className="text-[11px] text-[#6b7c76]">Need help? Call <span className="font-bold text-[#178a6e]">+91 74982 86760</span></span>
          </div>

        </div>
      </div>
      
    </div>
  );
}
