import React from 'react';
import { Truck, Navigation, Settings, Package, Activity, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import './_group.css';

export function CommandCenter() {
  return (
    <div className="flex flex-col h-screen w-full font-sans overflow-hidden text-slate-300" style={{ backgroundColor: '#08111f' }}>
      
      {/* Top Status Bar (KPIs) */}
      <header className="flex-none h-12 border-b border-slate-800 bg-[#0a1526] flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#f7c948]" />
          <span className="font-bold text-white tracking-wide">TRACKMYRMC <span className="text-slate-500 font-normal">CMD CENTER</span></span>
        </div>
        
        <div className="flex items-center gap-6 text-sm font-medium">
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            <Package className="w-4 h-4 text-emerald-400" />
            <span className="text-white">44m³</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            <Settings className="w-4 h-4 text-blue-400" />
            <span className="text-white">6 batches</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            <Truck className="w-4 h-4 text-[#f7c948]" />
            <span className="text-white">5 orders</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            <Navigation className="w-4 h-4 text-purple-400" />
            <span className="text-white">3/4 fleet</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            <span className="text-emerald-400 font-bold">₹8.6L</span>
          </div>
        </div>
      </header>

      {/* Main Live Operations Zone (60%+) */}
      <main className="flex-grow relative border-b border-slate-800 bg-gradient-to-b from-[#0a1526] to-[#08111f] p-8 overflow-hidden">
        <div className="absolute top-6 left-8">
          <h2 className="text-xs font-bold tracking-widest text-slate-500 uppercase">Live Routing Schematic</h2>
        </div>

        {/* Schematic Layout */}
        <div className="h-full flex flex-col justify-center max-w-6xl mx-auto relative">
          
          {/* Main Route Line */}
          <div className="absolute top-1/2 left-0 right-0 h-1 route-line -translate-y-1/2 opacity-30 z-0"></div>

          {/* Nodes */}
          <div className="flex justify-between items-center relative z-10">
            
            {/* Plant Node */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-slate-600 flex items-center justify-center shadow-xl shadow-black/50">
                <Settings className="w-10 h-10 text-slate-400 animate-spin-slow" />
              </div>
              <div className="text-center">
                <div className="text-white font-bold tracking-wider">PLANT ALPHA</div>
                <div className="text-xs text-emerald-400">OPERATIONAL</div>
              </div>
            </div>

            {/* Trucks en route */}
            <div className="flex-grow flex flex-col gap-12 px-12 relative -top-16">
              
              {/* Truck 1: Delivering */}
              <div className="self-end mr-12 bg-[#1a2639] border border-[#f7c948] rounded-lg p-3 w-64 shadow-lg shadow-[#f7c948]/10 animate-pulse-amber flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#f7c948]" />
                    <span className="text-white font-bold text-sm">MH 46 CU 1122</span>
                  </div>
                  <span className="text-xs bg-[#f7c948] text-black px-1.5 py-0.5 rounded font-bold">DELIVERING</span>
                </div>
                <div className="text-xs text-slate-400">Ganesh More • Arvind Galaxy</div>
              </div>

              {/* Truck 2: En Route */}
              <div className="self-center bg-[#1a2639] border border-slate-700 rounded-lg p-3 w-64 flex flex-col gap-2 relative">
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-400" />
                    <span className="text-white font-bold text-sm">MH 46 CU 0813</span>
                  </div>
                  <span className="text-xs text-blue-400 font-mono">ETA 25m</span>
                </div>
                <div className="text-xs text-slate-400">Ramesh Patil • En Route</div>
              </div>

              {/* Truck 3: En Route Fast */}
              <div className="self-start ml-24 bg-[#1a2639] border border-slate-700 rounded-lg p-3 w-64 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-400" />
                    <span className="text-white font-bold text-sm">MH 46 DX 7788</span>
                  </div>
                  <span className="text-xs text-blue-400 font-mono">ETA 13m</span>
                </div>
                <div className="text-xs text-slate-400">Vinod Shinde • Thane Tower</div>
              </div>

            </div>

            {/* Sites Node */}
            <div className="flex flex-col items-center gap-4 relative top-8">
               <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-dashed border-[#f7c948] flex items-center justify-center">
                <Navigation className="w-8 h-8 text-[#f7c948]" />
              </div>
              <div className="text-center">
                <div className="text-white font-bold tracking-wider">ACTIVE SITES</div>
                <div className="text-xs text-[#f7c948]">POURING</div>
              </div>
            </div>

          </div>
          
          {/* Maintenance Truck (Bottom Left) */}
          <div className="absolute bottom-4 left-4 bg-slate-900 border border-red-900/50 rounded-lg p-2 w-48 flex items-center gap-3 opacity-70">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <div className="text-white text-xs font-bold">MH 46 AB 4455</div>
              <div className="text-[10px] text-red-400 uppercase tracking-wider">Maintenance</div>
            </div>
          </div>

        </div>
      </main>

      {/* Bottom Data Feeds (30%) */}
      <footer className="h-72 flex flex-none bg-[#0a1526]">
        
        {/* Recent Challans (Left Column) */}
        <div className="w-1/2 border-r border-slate-800 flex flex-col">
          <div className="px-6 py-3 border-b border-slate-800 bg-[#0c1a2f] flex justify-between items-center">
            <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Recent Challans</h3>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">Live Feed</span>
          </div>
          <div className="flex-grow overflow-hidden relative p-4">
            {/* Auto-scrolling list simulation */}
            <div className="flex flex-col gap-3 animate-scroll">
              <ChallanCard id="CH-0005" status="Dispatched" grade="M30" volume="7m³" time="Just now" />
              <ChallanCard id="CH-0004" status="Delivered" grade="M35" volume="7m³" time="12m ago" />
              <ChallanCard id="CH-0003" status="Dispatched" grade="M40" volume="9m³" time="28m ago" />
              <ChallanCard id="CH-0002" status="Dispatched" grade="M30" volume="7m³" time="45m ago" />
              <ChallanCard id="CH-0001" status="Delivered" grade="M30" volume="7m³" time="1h ago" />
               <ChallanCard id="CH-0005" status="Dispatched" grade="M30" volume="7m³" time="Just now" />
              <ChallanCard id="CH-0004" status="Delivered" grade="M35" volume="7m³" time="12m ago" />
            </div>
            {/* Gradient mask for smooth scroll out */}
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#0a1526] to-transparent z-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0a1526] to-transparent z-10 pointer-events-none"></div>
          </div>
        </div>

        {/* Pending Actions (Right Column) */}
        <div className="w-1/2 flex flex-col">
           <div className="px-6 py-3 border-b border-slate-800 bg-[#0c1a2f] flex justify-between items-center">
            <h3 className="text-xs font-bold tracking-widest text-[#f7c948] uppercase">Pending Dispatch Queue</h3>
            <span className="text-[10px] bg-[#f7c948]/20 text-[#f7c948] px-2 py-0.5 rounded font-bold">2 Waiting</span>
          </div>
          <div className="flex-grow p-4 overflow-y-auto flex flex-col gap-3 bg-slate-900/50">
            
            <div className="bg-[#1a2639] border border-slate-700 rounded-lg p-4 flex justify-between items-center group hover:border-slate-500 transition-colors">
              <div>
                <div className="text-white font-bold">Arvind Galaxy • Foundation</div>
                <div className="text-sm text-slate-400 mt-1">Req: 21m³ M30 • <span className="text-emerald-400">14m³ remaining</span></div>
              </div>
              <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                Assign Truck
              </button>
            </div>

            <div className="bg-[#1a2639] border border-slate-700 rounded-lg p-4 flex justify-between items-center group hover:border-slate-500 transition-colors">
              <div>
                <div className="text-white font-bold">Thane Tower • Slab 4</div>
                <div className="text-sm text-slate-400 mt-1">Req: 9m³ M40 • <span className="text-[#f7c948]">Waiting for Mixer</span></div>
              </div>
              <button className="bg-[#f7c948] hover:bg-[#e5b637] text-black px-4 py-2 rounded text-sm font-bold transition-colors">
                Start Batch
              </button>
            </div>

          </div>
        </div>

      </footer>
    </div>
  );
}

function ChallanCard({ id, status, grade, volume, time }: { id: string, status: string, grade: string, volume: string, time: string }) {
  const isDelivered = status === "Delivered";
  
  return (
    <div className="bg-[#132035] border border-slate-800 rounded p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {isDelivered ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : (
          <Clock className="w-5 h-5 text-blue-400" />
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">{id}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${isDelivered ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {status}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{time}</div>
        </div>
      </div>
      <div className="text-right">
        <div className={`font-bold ${grade === 'M40' ? 'text-purple-400' : 'text-slate-300'}`}>{grade}</div>
        <div className="text-sm text-slate-400">{volume}</div>
      </div>
    </div>
  );
}
