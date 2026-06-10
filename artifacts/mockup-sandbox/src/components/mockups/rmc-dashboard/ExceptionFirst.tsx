import React from 'react';
import { AlertTriangle, Wrench, Clock, TrendingUp, Truck, Terminal } from 'lucide-react';

export function ExceptionFirst() {
  return (
    <div className="min-h-screen bg-[#03050a] text-slate-500 font-sans p-6 md:p-12 flex flex-col selection:bg-amber-500/30">
      {/* Header / Ambient Status */}
      <div className="flex justify-between items-center mb-12 md:mb-20">
        <div className="flex items-center gap-3">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-20"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500/40"></span>
          </div>
          <span className="text-[10px] font-mono tracking-[0.2em] text-slate-600 uppercase">System Telemetry</span>
        </div>
        <div className="text-[10px] font-mono tracking-[0.2em] text-slate-600 uppercase">
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      </div>

      {/* EXCEPTIONS ZONE - Loud, colorful, top-anchored */}
      <div className="mb-16 md:mb-24 space-y-3 w-full max-w-4xl mx-auto md:mx-0">
        <h2 className="text-[10px] font-mono tracking-widest text-slate-600 uppercase mb-6 pl-1">Action Required</h2>

        {/* Priority 1: Maintenance */}
        <div className="bg-amber-500 text-black p-5 sm:p-6 rounded shadow-[0_0_40px_-15px_rgba(245,158,11,0.3)] flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between group cursor-pointer transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-4">
            <div className="bg-black/10 p-3 rounded-full shrink-0">
              <Wrench className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight">MH 46 AB 4455 — In Maintenance</h3>
              <p className="text-amber-950 text-xs sm:text-sm font-medium mt-1">Vehicle immobilized. Expected resolution: 4 hours.</p>
            </div>
          </div>
          <button className="bg-black text-amber-500 px-4 py-2 text-xs sm:text-sm font-bold rounded uppercase tracking-wider hover:bg-zinc-900 transition-colors shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
            View Details
          </button>
        </div>

        {/* Priority 2: Financial */}
        <div className="bg-[#1a1405] border border-amber-900/50 text-amber-500 p-5 rounded flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between group cursor-pointer hover:bg-[#1f1705] transition-colors">
          <div className="flex items-center gap-4">
            <div className="bg-amber-950/50 p-3 rounded-full shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold tracking-tight">₹8.6L Outstanding Overdue</h3>
              <p className="text-amber-700 text-xs sm:text-sm mt-0.5">Across 5 active clients. Threshold exceeded.</p>
            </div>
          </div>
          <button className="text-amber-600 text-xs sm:text-sm font-semibold uppercase tracking-wider hover:text-amber-400 transition-colors mt-2 sm:mt-0 w-full sm:w-auto text-left sm:text-right">
            Review Accounts
          </button>
        </div>

        {/* Priority 3: Operations */}
        <div className="bg-[#120f0a] border border-orange-900/30 text-orange-400 p-5 rounded flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between group cursor-pointer hover:bg-[#17130c] transition-colors">
          <div className="flex items-center gap-4">
            <div className="bg-orange-950/30 p-3 rounded-full shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-700" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-medium tracking-tight">3 Stale Orders Pending</h3>
              <p className="text-orange-800 text-xs sm:text-sm mt-0.5">Pending &gt; 1 shift without dispatch action.</p>
            </div>
          </div>
          <button className="text-orange-700 text-xs sm:text-sm font-semibold uppercase tracking-wider hover:text-orange-500 transition-colors mt-2 sm:mt-0 w-full sm:w-auto text-left sm:text-right">
            Process Orders
          </button>
        </div>
      </div>

      <div className="flex-grow"></div>

      {/* AMBIENT ZONE - Quiet, muted, peripheral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 pt-12 border-t border-slate-900/30">
        
        {/* Production Pulse */}
        <div className="space-y-5">
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] font-mono tracking-widest text-slate-700 uppercase flex items-center gap-2">
              <TrendingUp className="w-3 h-3" /> Production Pulse
            </span>
            <span className="text-xs font-mono text-slate-600">44 / 150 m³</span>
          </div>
          <div className="h-px w-full bg-slate-900 overflow-hidden relative">
            <div className="absolute top-0 bottom-0 left-0 bg-slate-600 w-[29%]">
              <div className="absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-r from-transparent to-white/20 animate-pulse"></div>
            </div>
          </div>
          <div className="text-[10px] text-slate-700 font-mono">
            6 challans dispatched today
          </div>
        </div>

        {/* Dispatch Log */}
        <div className="space-y-5">
          <span className="text-[10px] font-mono tracking-widest text-slate-700 uppercase flex items-center gap-2">
            <Terminal className="w-3 h-3" /> Event Log
          </span>
          <div className="space-y-2.5 font-mono text-[10px]">
            <div className="flex gap-4 text-slate-500 hover:text-slate-400 transition-colors">
              <span className="text-slate-700 shrink-0">14:02</span>
              <span className="truncate">DSP-042 dispatched to Horizon Tower</span>
            </div>
            <div className="flex gap-4 text-slate-500 hover:text-slate-400 transition-colors">
              <span className="text-slate-700 shrink-0">13:45</span>
              <span className="truncate">Batch #108 completed (M30)</span>
            </div>
            <div className="flex gap-4 text-slate-600 hover:text-slate-400 transition-colors">
              <span className="text-slate-800 shrink-0">13:12</span>
              <span className="truncate">DSP-041 delivered at Sector 4</span>
            </div>
            <div className="flex gap-4 text-slate-700">
              <span className="text-slate-800 shrink-0">12:30</span>
              <span className="truncate">System heartbeat OK</span>
            </div>
          </div>
        </div>

        {/* Active Fleet */}
        <div className="space-y-5">
          <span className="text-[10px] font-mono tracking-widest text-slate-700 uppercase flex items-center gap-2">
            <Truck className="w-3 h-3" /> Fleet Topology
          </span>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-800 shadow-[0_0_5px_rgba(4,120,87,0.5)]"></span>
              <span className="text-[10px] font-mono text-slate-500">MH46-1122</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-800 shadow-[0_0_5px_rgba(4,120,87,0.5)]"></span>
              <span className="text-[10px] font-mono text-slate-500">MH46-3344</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-800 shadow-[0_0_5px_rgba(4,120,87,0.5)]"></span>
              <span className="text-[10px] font-mono text-slate-500">MH46-5566</span>
            </div>
            <div className="flex items-center gap-2 opacity-40">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-800"></span>
              <span className="text-[10px] font-mono text-slate-600 line-through">MH46-4455</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-700 font-mono mt-2">
            3 Active • 1 Maintenance
          </div>
        </div>

      </div>
    </div>
  );
}
