import React, { useState } from 'react';
import { ChevronLeft, MapPin, Navigation, Star, ChevronDown, Plus, Minus, Info, Settings2, ShieldAlert } from 'lucide-react';

export function Blueprint() {
  const [grade, setGrade] = useState('M25');
  const [qty, setQty] = useState(8);
  const [pump, setPump] = useState(false);
  const [pumpLength, setPumpLength] = useState('30');

  const unitPrice = 4800; // base price for M25

  return (
    <div className="font-sans text-[#E0E0E6] flex flex-col h-full overflow-hidden bg-[#121216] relative selection:bg-[#FF8C00] selection:text-black">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
        
        .blueprint-container {
          font-family: 'Chakra Petch', sans-serif;
          background-color: #121216;
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 24px 24px;
          background-position: center center;
        }

        .font-mono-num {
          font-family: 'Space Mono', monospace;
        }
        
        .hairline-border {
          border: 1px solid #33333E;
        }
        
        .hairline-border-b {
          border-bottom: 1px solid #33333E;
        }
        
        .hairline-border-t {
          border-top: 1px solid #33333E;
        }

        .hairline-border-r {
          border-right: 1px solid #33333E;
        }

        .hairline-border-l {
          border-left: 1px solid #33333E;
        }

        .tech-shadow {
          box-shadow: 4px 4px 0px 0px rgba(0,0,0,0.5);
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar {
          width: 4px;
        }
        ::-webkit-scrollbar-track {
          background: #121216;
        }
        ::-webkit-scrollbar-thumb {
          background: #FF8C00;
        }
      `}</style>

      <div className="blueprint-container absolute inset-0 pointer-events-none" />

      {/* App Bar */}
      <div className="relative z-10 flex items-center h-14 px-4 bg-[#1C1C22] hairline-border-b sticky top-0">
        <button className="w-8 h-8 flex items-center justify-center bg-[#282832] hairline-border hover:bg-[#33333E] transition-colors">
          <ChevronLeft size={18} className="text-[#FF8C00]" />
        </button>
        <div className="flex-1 flex justify-center text-sm font-bold tracking-[0.2em] uppercase text-[#E0E0E6]">
          Place Order
        </div>
        <div className="w-8 h-8 flex items-center justify-center bg-[#282832] hairline-border text-[10px] font-mono-num text-[#888899]">
          #01
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto pb-32">
        {/* Plant Card */}
        <div className="p-4 hairline-border-b bg-[#18181E]/80 backdrop-blur-sm">
          <div className="text-[10px] text-[#FF8C00] font-bold tracking-widest uppercase mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#FF8C00] rounded-sm animate-pulse" />
            Selected Facility
          </div>
          <div className="bg-[#212128] hairline-border p-3 flex items-start justify-between tech-shadow">
            <div>
              <h2 className="text-base font-semibold tracking-wide text-white">Ambuja RMC — Whitefield</h2>
              <div className="flex items-center gap-3 mt-1.5 font-mono-num text-[11px] text-[#888899]">
                <div className="flex items-center gap-1">
                  <Navigation size={12} className="text-[#FF8C00]" />
                  <span>4.2 km</span>
                </div>
                <div className="w-px h-3 bg-[#33333E]" />
                <div className="flex items-center gap-1 text-[#E0E0E6]">
                  <Star size={12} className="fill-[#FF8C00] text-[#FF8C00]" />
                  <span>4.8</span>
                </div>
              </div>
            </div>
            <button className="text-[10px] font-bold uppercase tracking-wider text-[#FF8C00] bg-[#FF8C00]/10 px-2 py-1 hairline-border hover:bg-[#FF8C00]/20 transition-colors">
              Change
            </button>
          </div>
        </div>

        {/* Concrete Grade */}
        <div className="p-4 hairline-border-b bg-[#121216]/80 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] text-[#888899] font-bold tracking-widest uppercase">
              Mix Spec [Grade]
            </div>
            <Settings2 size={14} className="text-[#555566]" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['M10', 'M15', 'M20', 'M25', 'M30', 'M35'].map(g => (
              <button 
                key={g}
                onClick={() => setGrade(g)}
                className={`h-10 text-[13px] font-bold tracking-wider uppercase transition-all flex items-center justify-center relative
                  ${grade === g 
                    ? 'bg-[#FF8C00] text-black tech-shadow' 
                    : 'bg-[#1C1C22] text-[#888899] hairline-border hover:text-white'
                  }`}
              >
                {grade === g && <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-black" />}
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div className="p-4 hairline-border-b bg-[#18181E]/80 backdrop-blur-sm">
          <div className="text-[10px] text-[#888899] font-bold tracking-widest uppercase mb-3">
            Volumetric Req [Qty]
          </div>
          <div className="flex items-end gap-4">
            <div className="flex-1 bg-[#121216] hairline-border flex items-center justify-between p-2">
              <button 
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-10 h-10 bg-[#282832] flex items-center justify-center text-[#FF8C00] hover:bg-[#33333E] active:scale-95 transition-all"
              >
                <Minus size={16} />
              </button>
              <div className="flex items-baseline gap-1 font-mono-num">
                <span className="text-3xl text-white leading-none">{qty}</span>
                <span className="text-[#888899] text-sm font-sans tracking-widest uppercase">m³</span>
              </div>
              <button 
                onClick={() => setQty(qty + 1)}
                className="w-10 h-10 bg-[#282832] flex items-center justify-center text-[#FF8C00] hover:bg-[#33333E] active:scale-95 transition-all"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[#FF8C00]/80">
            <Info size={12} />
            <span className="text-[10px] font-mono-num uppercase tracking-wider">Min load: 3.0 m³</span>
          </div>
        </div>

        {/* Schedule */}
        <div className="p-4 hairline-border-b bg-[#121216]/80 backdrop-blur-sm">
          <div className="text-[10px] text-[#888899] font-bold tracking-widest uppercase mb-3">
            Deployment Schedule
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-[#1C1C22] hairline-border p-3 flex justify-between items-center relative overflow-hidden group hover:bg-[#212128] transition-colors cursor-pointer">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF8C00]" />
              <div>
                <div className="text-[9px] uppercase tracking-widest text-[#555566] mb-1">Date</div>
                <div className="font-mono-num text-[13px] text-white">2026-10-24</div>
              </div>
              <ChevronDown size={14} className="text-[#FF8C00]" />
            </div>
            <div className="flex-1 bg-[#1C1C22] hairline-border p-3 flex justify-between items-center relative overflow-hidden group hover:bg-[#212128] transition-colors cursor-pointer">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF8C00]" />
              <div>
                <div className="text-[9px] uppercase tracking-widest text-[#555566] mb-1">Time</div>
                <div className="font-mono-num text-[13px] text-white">08:00 AM</div>
              </div>
              <ChevronDown size={14} className="text-[#FF8C00]" />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="p-4 hairline-border-b bg-[#18181E]/80 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-3">
            <div className="text-[10px] text-[#888899] font-bold tracking-widest uppercase">
              Target Coordinates
            </div>
            <button className="text-[10px] text-[#FF8C00] font-bold tracking-widest uppercase bg-[#FF8C00]/10 px-2 py-1 hairline-border flex items-center gap-1.5 hover:bg-[#FF8C00]/20 transition-colors">
              <MapPin size={10} />
              GPS Sync
            </button>
          </div>
          
          <div className="h-28 bg-[#121216] hairline-border relative overflow-hidden mb-3 group">
            {/* Synthetic Map Background */}
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: 'radial-gradient(#555566 1px, transparent 1px)',
              backgroundSize: '10px 10px'
            }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <div className="w-12 h-12 rounded-full border border-[#FF8C00]/30 bg-[#FF8C00]/10 flex items-center justify-center relative animate-pulse">
                <div className="w-2 h-2 bg-[#FF8C00] rounded-full" />
                <div className="absolute inset-0 border border-[#FF8C00] rounded-full scale-[1.5] opacity-20" />
              </div>
            </div>
            {/* Crosshairs */}
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[#FF8C00]/20" />
            <div className="absolute left-0 right-0 top-1/2 h-px bg-[#FF8C00]/20" />
            <div className="absolute bottom-2 left-2 text-[8px] font-mono-num text-[#FF8C00]">LAT 12.9716 / LNG 77.5946</div>
          </div>

          <div className="bg-[#1C1C22] hairline-border p-3 focus-within:border-[#FF8C00] transition-colors relative">
            <div className="text-[9px] uppercase tracking-widest text-[#555566] mb-1">Site Designation</div>
            <input 
              type="text"
              defaultValue="Prestige Lakeside — Tower B"
              className="w-full bg-transparent text-[13px] font-medium text-white outline-none placeholder:text-[#555566]"
            />
          </div>
        </div>

        {/* Concrete Pump */}
        <div className="p-4 hairline-border-b bg-[#121216]/80 backdrop-blur-sm">
          <label className="flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-6 hairline-border p-0.5 relative transition-colors ${pump ? 'bg-[#FF8C00]/20 border-[#FF8C00]' : 'bg-[#1C1C22]'}`}>
                <div className={`w-4 h-4 bg-white transition-transform ${pump ? 'translate-x-4 bg-[#FF8C00]' : 'bg-[#555566]'}`} />
              </div>
              <div className="text-[12px] font-bold tracking-wide text-white uppercase">Require Pump Asset?</div>
            </div>
            <input type="checkbox" checked={pump} onChange={(e) => setPump(e.target.checked)} className="hidden" />
          </label>
          
          {pump && (
            <div className="mt-4 flex items-end gap-3 pl-13">
              <div className="w-8 h-8 border-l border-b border-[#33333E] rounded-bl-lg mb-4 opacity-50" />
              <div className="flex-1 bg-[#1C1C22] hairline-border p-3 relative">
                <div className="text-[9px] uppercase tracking-widest text-[#555566] mb-1">Hose Length Requirement (m)</div>
                <input 
                  type="number"
                  value={pumpLength}
                  onChange={(e) => setPumpLength(e.target.value)}
                  className="w-full bg-transparent text-[14px] font-mono-num text-[#FF8C00] outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="p-4 hairline-border-b bg-[#18181E]/80 backdrop-blur-sm">
          <div className="text-[10px] text-[#888899] font-bold tracking-widest uppercase mb-2">
            Operational Directives [Notes]
          </div>
          <textarea 
            placeholder="Anything the plant should know?"
            rows={2}
            className="w-full bg-[#1C1C22] hairline-border p-3 text-[13px] font-medium text-white outline-none placeholder:text-[#555566] resize-none focus:border-[#FF8C00] transition-colors"
          />
        </div>
      </div>

      {/* Pinned Bottom Area */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-[#121216] hairline-border-t">
        {/* Strip Background Pattern */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, #33333E 4px, #33333E 8px)'
        }} />
        
        <div className="relative bg-[#1C1C22]/95 backdrop-blur-md px-4 py-3 pb-safe">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-[#282832] hairline-border px-2 py-1 text-[10px] font-mono-num text-[#FF8C00]">
                {grade}
              </div>
              <div className="text-[#555566]">×</div>
              <div className="bg-[#282832] hairline-border px-2 py-1 text-[10px] font-mono-num text-[#E0E0E6]">
                {qty} m³
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-widest text-[#888899] mb-0.5">Est. Financial Impact</div>
              <div className="font-mono-num text-base text-[#FF8C00]">
                ₹ {(unitPrice * qty).toLocaleString()}
              </div>
            </div>
          </div>
          
          <button className="w-full h-14 bg-[#FF8C00] hover:bg-[#FF991A] text-black font-bold tracking-[0.15em] uppercase text-sm tech-shadow flex items-center justify-center gap-2 transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
            <ShieldAlert size={16} className="text-black/50" />
            Confirm Order
            <ShieldAlert size={16} className="text-black/50" />
          </button>
        </div>
      </div>
    </div>
  );
}
