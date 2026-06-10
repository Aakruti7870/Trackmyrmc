import React from 'react';
import { Clock, Navigation2, FileText, CheckCircle2 } from 'lucide-react';
import './_group.css';

export function ShiftHandover() {
  const shiftStart = 6 * 60; // 06:00
  const shiftEnd = 14 * 60; // 14:00
  const shiftDuration = shiftEnd - shiftStart;
  const currentTime = 10 * 60 + 54; // 10:54

  const timeToPercent = (hours: number, mins: number) => {
    const t = hours * 60 + mins;
    return Math.max(0, Math.min(100, ((t - shiftStart) / shiftDuration) * 100));
  };

  const batches = [
    { time: '06:10', p: timeToPercent(6, 10) },
    { time: '07:15', p: timeToPercent(7, 15) },
    { time: '07:50', p: timeToPercent(7, 50) },
    { time: '08:20', p: timeToPercent(8, 20) },
    { time: '09:05', p: timeToPercent(9, 5) },
    { time: '10:10', p: timeToPercent(10, 10) },
  ];
  
  const currentPercent = timeToPercent(10, 54);

  return (
    <div className="min-h-screen bg-[#08111f] text-slate-300 font-sans p-6 md:p-10 flex justify-center">
      <div className="w-full max-w-5xl space-y-10">

        {/* Header */}
        <header className="flex justify-between items-end border-b border-slate-800 pb-6">
          <div>
            <p className="text-slate-5g00 uppercase tracking-widest text-xs font-semibold mb-2 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Shift Handover Report
            </p>
            <h1 className="text-3xl font-light text-white tracking-tight">Morning Shift</h1>
          </div>
          <div className="text-right">
            <p className="text-slate-400 font-mono text-sm bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
              06:00 — 14:00
            </p>
            <p className="text-[#f7c948] font-mono text-xs flex items-center justify-end gap-2 mt-3">
              <span className="w-2 h-2 rounded-full bg-[#f7c948] animate-pulse-amber shadow-[0_0_8px_#f7c948]"></span>
              10:54 NOW
            </p>
          </div>
        </header>

        {/* Zone 1: My Shift */}
        <section className="bg-slate-900/40 rounded-2xl p-8 border border-slate-800/60 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 opacity-[0.03] pointer-events-none">
             <span className="text-[16rem] font-bold tracking-tighter">88</span>
          </div>

          <div className="flex flex-col lg:flex-row gap-12 relative z-10">
            {/* Shift Score */}
            <div className="flex-shrink-0 min-w-[200px]">
              <p className="text-slate-500 text-xs mb-3 uppercase tracking-widest font-semibold">Shift Score</p>
              <div className="flex items-baseline gap-1">
                <span className="text-7xl font-light text-white tracking-tighter tabular-nums">88</span>
                <span className="text-3xl text-slate-500 font-light">%</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden max-w-[120px]">
                  <div className="h-full bg-white rounded-full" style={{ width: '88%' }} />
                </div>
              </div>
              <p className="text-slate-400 text-sm mt-3">
                <span className="text-white font-medium">44</span> / 50 m³ target
              </p>
            </div>

            {/* Timeline */}
            <div className="flex-grow flex flex-col justify-center py-4">
              <p className="text-slate-500 text-xs mb-8 uppercase tracking-widest font-semibold">Production Timeline</p>
              <div className="relative h-1.5 bg-slate-800 rounded-full w-full">
                {/* Time Elapsed Bar */}
                <div
                  className="absolute top-0 left-0 h-full bg-slate-700/50 rounded-full"
                  style={{ width: `${currentPercent}%` }}
                />
                
                {/* Batches Dots */}
                {batches.map((b, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 w-3 h-3 bg-white border-2 border-[#08111f] rounded-full -translate-y-1/2 -translate-x-1/2 shadow-[0_0_8px_rgba(255,255,255,0.4)] group cursor-default hover:scale-150 transition-transform z-10"
                    style={{ left: `${b.p}%` }}
                  >
                     <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-white text-[#08111f] text-xs py-1.5 px-3 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity font-mono pointer-events-none whitespace-nowrap z-20">
                       <span className="font-bold opacity-50 mr-2">#{i+1}</span>{b.time}
                     </div>
                  </div>
                ))}
                
                {/* Current Time Marker */}
                <div
                   className="absolute top-1/2 w-0.5 h-6 bg-[#f7c948] -translate-y-1/2 shadow-[0_0_10px_rgba(247,201,72,0.5)] z-0"
                   style={{ left: `${currentPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-4 text-xs font-mono text-slate-500">
                <span>06:00</span>
                <span>14:00</span>
              </div>
            </div>

            {/* Grades Breakdown */}
            <div className="flex-shrink-0 flex flex-col justify-center min-w-[180px]">
               <p className="text-slate-500 text-xs mb-4 uppercase tracking-widest font-semibold">Mix Breakdown</p>
               <div className="flex flex-col gap-2.5">
                 <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm">
                   <span className="text-white font-medium flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> M30
                   </span> 
                   <span className="text-slate-400 font-mono">3 loads</span>
                 </div>
                 <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm">
                   <span className="text-white font-medium flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span> M40
                   </span> 
                   <span className="text-slate-400 font-mono">2 loads</span>
                 </div>
                 <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm">
                   <span className="text-white font-medium flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> M35
                   </span> 
                   <span className="text-slate-400 font-mono">1 load</span>
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* Zone 2: Right Now */}
        <section>
          <h2 className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-4 flex items-center gap-2">
            <Navigation2 className="w-4 h-4 text-[#f7c948]" /> Right Now · In Transit
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 'CH-0002', dest: 'Arvind Galaxy', rem: '25m', p: 40 },
              { id: 'CH-0003', dest: 'Thane Tower', rem: '13m', p: 70 },
              { id: 'CH-0005', dest: 'Ramesh Patil', rem: 'En route', p: 15 },
            ].map((ch) => (
              <div key={ch.id} className="bg-slate-900/30 border border-slate-800/50 p-5 rounded-xl flex flex-col justify-between hover:bg-slate-900/50 hover:border-slate-700 transition-all cursor-default group">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <span className="text-white font-mono text-sm bg-slate-800 px-2 py-0.5 rounded">{ch.id}</span>
                    <p className="text-slate-300 text-sm mt-2 font-medium">{ch.dest}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[#f7c948] font-mono text-xs bg-[#f7c948]/10 border border-[#f7c948]/20 px-2 py-1 rounded shadow-sm">{ch.rem}</span>
                  </div>
                </div>
                <div className="relative h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                  <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-500/50 to-[#f7c948] rounded-full transition-all duration-1000" style={{ width: `${ch.p}%` }}>
                    <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/30 rounded-full"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Zone 3: Handover Notes */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6 border-t border-slate-800/50">
          <div>
            <h2 className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-4">
              Pending Dispatch (Next Shift)
            </h2>
            <div className="space-y-2">
              {[
                { id: 'ORD-002', client: 'Marvel', vol: '28m³', mix: 'M25' },
                { id: 'ORD-004', client: 'Panvel', vol: '21m³', mix: 'M20' },
                { id: 'ORD-006', client: 'Arvind', vol: '14m³', mix: 'M20' },
              ].map((ord) => (
                <div key={ord.id} className="flex items-center justify-between p-3 rounded-lg bg-transparent border border-slate-800/40 hover:bg-slate-900/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                    <div>
                      <span className="text-slate-400 font-mono text-xs block mb-0.5">{ord.id}</span>
                      <span className="text-white text-sm">{ord.client}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-right">
                    <span className="text-slate-500 font-mono">{ord.mix}</span>
                    <span className="text-white font-medium w-12">{ord.vol}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <h2 className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Shift Memo</span>
              <span className="text-slate-600 font-mono text-[10px]">AUTO-SAVED 10:48</span>
            </h2>
            <div className="relative flex-grow min-h-[140px]">
              <textarea
                className="w-full h-full bg-slate-900/30 border border-slate-800/50 rounded-xl p-5 text-slate-300 text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-[#f7c948]/50 focus:border-[#f7c948]/50 transition-all font-mono placeholder-slate-600"
                defaultValue="Shift notes: Batch mixer #2 serviced, pump available. Client Thane confirmed pour for 2pm."
                spellCheck={false}
              />
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
