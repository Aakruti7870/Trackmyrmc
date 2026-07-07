import React, { useState } from 'react';
import { ChevronLeft, Star, MapPin, Navigation, Map as MapIcon, Plus, Minus, ToggleLeft, ToggleRight, Calendar, Clock, ChevronDown, Check } from 'lucide-react';
import './_group.css';

export function AuroraGlass() {
  const [grade, setGrade] = useState('M25');
  const [qty, setQty] = useState(8);
  const [pump, setPump] = useState(false);
  const [pumpLength, setPumpLength] = useState('30');

  const grades = ['M10', 'M15', 'M20', 'M25', 'M30', 'M35'];

  return (
    <div className="w-[390px] h-[844px] aurora-container font-outfit text-slate-200 flex flex-col relative mx-auto my-0 overflow-hidden shadow-2xl rounded-3xl border border-white/10">
      <div className="aurora-blob-1" />
      <div className="aurora-blob-2" />

      {/* Top App Bar */}
      <div className="flex items-center justify-between px-6 pt-12 pb-4 z-10 sticky top-0 bg-[#06090e]/60 backdrop-blur-xl border-b border-white/5">
        <button className="w-10 h-10 rounded-full flex items-center justify-center glass-pill text-white hover:bg-white/10">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-medium text-white tracking-wide">Place Order</h1>
        <div className="w-10 h-10"></div> {/* Spacer */}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar z-10 pb-36 px-5 space-y-6 pt-4">
        
        {/* Plant Card */}
        <div className="glass-panel p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-medium text-emerald-400 uppercase tracking-widest mb-1">Selected Plant</p>
              <h2 className="text-lg font-semibold text-white">Ambuja RMC — Whitefield</h2>
            </div>
            <button className="text-xs text-slate-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-full">
              Change
            </button>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 bg-black/30 px-2.5 py-1 rounded-full border border-white/5">
              <Navigation size={12} className="text-emerald-400" />
              <span className="text-xs font-medium text-slate-300">4.2 km away</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/30 px-2.5 py-1 rounded-full border border-white/5">
              <Star size={12} className="text-amber-400 fill-amber-400" />
              <span className="text-xs font-medium text-slate-300">4.8</span>
            </div>
          </div>
        </div>

        {/* Concrete Grade */}
        <div className="space-y-3">
          <div className="flex justify-between items-baseline px-1">
            <h3 className="text-sm font-medium text-white">Concrete Grade</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {grades.map(g => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium ${
                  grade === g ? 'active glass-pill' : 'glass-pill text-slate-400'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div className="glass-panel p-5 space-y-4">
          <div className="flex justify-between items-baseline">
            <h3 className="text-sm font-medium text-white">Quantity (m³)</h3>
            <span className="text-xs text-emerald-400/80">Min. load: 3 m³</span>
          </div>
          
          <div className="flex items-center justify-between bg-black/20 border border-white/5 rounded-2xl p-2">
            <button 
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Minus size={20} />
            </button>
            <div className="text-3xl font-light text-white tracking-tight">
              {qty} <span className="text-xl text-slate-500 font-normal">m³</span>
            </div>
            <button 
              onClick={() => setQty(qty + 1)}
              className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-panel p-4 flex flex-col gap-2">
            <label className="text-xs text-slate-400 font-medium">Delivery Date</label>
            <div className="flex items-center justify-between text-white">
              <span className="text-sm font-medium">Oct 24, 2023</span>
              <Calendar size={16} className="text-emerald-400/80" />
            </div>
          </div>
          <div className="glass-panel p-4 flex flex-col gap-2">
            <label className="text-xs text-slate-400 font-medium">Delivery Time</label>
            <div className="flex items-center justify-between text-white">
              <span className="text-sm font-medium">10:00 AM</span>
              <Clock size={16} className="text-emerald-400/80" />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="space-y-3">
          <div className="flex justify-between items-baseline px-1">
            <h3 className="text-sm font-medium text-white">Delivery Location</h3>
            <button className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <Navigation size={12} /> Use my location
            </button>
          </div>
          <div className="glass-panel overflow-hidden p-1">
            <div className="h-32 bg-[#0a0f16] rounded-t-[16px] relative flex items-center justify-center border-b border-white/5">
              {/* Map grid pattern */}
              <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
              <div className="absolute w-8 h-8 bg-emerald-500/20 rounded-full animate-ping"></div>
              <div className="relative z-10 w-4 h-4 bg-emerald-400 border-2 border-[#0a0f16] rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
            </div>
            <div className="p-4 space-y-3 bg-black/20 rounded-b-[16px]">
              <div className="flex items-start gap-3">
                <MapPin size={18} className="text-slate-400 mt-0.5" />
                <input 
                  type="text" 
                  defaultValue="Prestige Lakeside — Tower B"
                  className="bg-transparent text-sm text-white w-full focus:outline-none placeholder-slate-500 font-medium"
                  placeholder="Site name / address"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pump & Notes */}
        <div className="glass-panel p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-white">Concrete Pump</h3>
              <p className="text-xs text-slate-400 mt-0.5">Need a pump at site?</p>
            </div>
            <button onClick={() => setPump(!pump)}>
              {pump ? (
                <ToggleRight size={32} className="text-emerald-400" />
              ) : (
                <ToggleLeft size={32} className="text-slate-500" />
              )}
            </button>
          </div>
          
          {pump && (
            <div className="pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
              <label className="text-xs text-slate-400 font-medium mb-1.5 block">Pump line length (m)</label>
              <input 
                type="number" 
                value={pumpLength}
                onChange={(e) => setPumpLength(e.target.value)}
                className="glass-input w-full p-3 text-sm"
              />
            </div>
          )}

          <div className="pt-1">
            <label className="text-xs text-slate-400 font-medium mb-1.5 block">Notes for plant (Optional)</label>
            <textarea 
              className="glass-input w-full p-3 text-sm resize-none"
              rows={2}
              placeholder="Anything the plant should know?"
            ></textarea>
          </div>
        </div>

      </div>

      {/* Bottom Sticky Area */}
      <div className="absolute bottom-0 w-full glass-panel !rounded-none !rounded-t-[32px] !border-x-0 !border-b-0 p-6 pt-5 pb-8 z-20">
        <div className="flex justify-between items-end mb-5 px-1">
          <div>
            <p className="text-xs text-slate-400 font-medium mb-1">Estimated total</p>
            <p className="text-sm text-slate-300 font-medium">{grade} &middot; {qty} m³</p>
          </div>
          <div className="text-right">
            <h3 className="text-2xl font-semibold text-white">₹ 38,400</h3>
          </div>
        </div>
        <button className="glass-btn w-full py-4 text-[15px] tracking-wide flex items-center justify-center gap-2">
          Confirm order <ChevronLeft size={16} className="rotate-180 opacity-70" />
        </button>
      </div>
    </div>
  );
}
