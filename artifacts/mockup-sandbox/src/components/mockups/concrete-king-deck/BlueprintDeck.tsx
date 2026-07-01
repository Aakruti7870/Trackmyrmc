import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowRight, Play, CheckCircle2, AlertTriangle, XCircle, 
  MapPin, Activity, Navigation, Smartphone, Truck, ShieldCheck, 
  Settings, Cpu, BarChart4, ChevronRight, ChevronLeft
} from "lucide-react";

/* ════════════════════════════════════════════════════════
   CONCRETE KING – RMC OPERATIONS OS (BLUEPRINT VARIANT)
════════════════════════════════════════════════════════ */

const C = {
  bg:      "#05203A", // deep architectural blue
  grid:    "rgba(77, 184, 255, 0.15)", // faint cyan grid
  cyan:    "#4DB8FF",
  cyanDim: "rgba(77, 184, 255, 0.3)",
  white:   "#FFFFFF",
  yellow:  "#FFD166", // highlight
  panel:   "rgba(5, 32, 58, 0.75)",
  border:  "rgba(77, 184, 255, 0.4)",
  text:    "#E6F4FF",
  muted:   "#8CB8D9",
};

const openLogin = () => {
  if (typeof window !== "undefined") {
    window.open("/login", "_blank", "noopener,noreferrer");
  }
};

/* ── CANVAS 1: WIREFRAME CAD DRUM ── */
function BgDrum() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const ani = useRef<number>(0);
  const t = useRef(0);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    const draw = () => {
      t.current += 0.01; const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      
      // Blueprint background + grid
      ctx.fillStyle = C.bg; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      for(let i=0; i<W; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
      for(let i=0; i<H; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(W,i); ctx.stroke(); }

      const dx = W * 0.65, dy = H * 0.45, rX = W * 0.2, rY = H * 0.55;
      
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(t.current * 0.25);
      
      // Wireframe cylinder
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 1.5;
      
      const numLines = 16;
      for(let i=0; i<numLines; i++) {
        const a = (i * Math.PI * 2) / numLines;
        ctx.beginPath();
        ctx.ellipse(0, 0, rX, rY, 0, a, a + Math.PI);
        ctx.stroke();
      }

      // Spiral (threads)
      ctx.strokeStyle = C.yellow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for(let a=0; a<=Math.PI*8; a+=0.05) {
        const r = Math.min(rX, rY) * (0.2 + 0.8 * (a/(Math.PI*8)));
        const angle = a - t.current;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r * (rY/rX);
        if(a===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.stroke();
      
      ctx.restore();
      
      // Scanning lines / measurements
      ctx.strokeStyle = C.white;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(dx - rX, dy); ctx.lineTo(dx + rX, dy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(dx, dy - rY); ctx.lineTo(dx, dy + rY); ctx.stroke();
      ctx.setLineDash([]);
      
      // Crosshairs
      ctx.fillStyle = C.cyan;
      ctx.fillRect(dx - 5, dy - 1, 11, 3);
      ctx.fillRect(dx - 1, dy - 5, 3, 11);

      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>;
}

/* ── CANVAS 2: WIREFRAME HIGHWAY ── */
function BgHighway() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const ani = useRef<number>(0);
  const t = useRef(0);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    
    const trucks = [
      {x: -100, y: 0.55, speed: 2, c: C.cyan},
      {x: -400, y: 0.65, speed: 1.5, c: C.yellow},
      {x: -800, y: 0.60, speed: 1.8, c: C.cyan},
      {x: -200, y: 0.70, speed: 1.2, c: C.white},
    ];

    const draw = () => {
      t.current += 0.015; const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      
      ctx.fillStyle = C.bg; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      for(let i=0; i<W; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
      for(let i=0; i<H; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(W,i); ctx.stroke(); }

      const roadY = H * 0.52;
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, roadY); ctx.lineTo(W, roadY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, H - 20); ctx.lineTo(W, H - 20); ctx.stroke();
      
      ctx.setLineDash([20, 20]);
      ctx.strokeStyle = C.cyanDim;
      ctx.beginPath(); ctx.moveTo(0, roadY + (H-roadY)*0.33); ctx.lineTo(W, roadY + (H-roadY)*0.33); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, roadY + (H-roadY)*0.66); ctx.lineTo(W, roadY + (H-roadY)*0.66); ctx.stroke();
      ctx.setLineDash([]);

      trucks.forEach((tr, i) => {
        tr.x += tr.speed * 2;
        if (tr.x > W + 200) tr.x = -200;
        
        ctx.save();
        ctx.translate(tr.x, H * tr.y);
        
        // Wireframe truck body
        ctx.strokeStyle = tr.c;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-80, -20, 100, 30);
        ctx.strokeRect(25, -15, 30, 25);
        
        // Wheels
        ctx.beginPath(); ctx.arc(-50, 10, 8, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(-20, 10, 8, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(40, 10, 8, 0, Math.PI*2); ctx.stroke();
        
        // Data label hovering above
        ctx.fillStyle = tr.c;
        ctx.font = "10px monospace";
        ctx.fillText(`TRK-${i+1} : ${Math.floor(tr.speed * 20)}KM/H`, -75, -28);
        ctx.beginPath(); ctx.moveTo(-75, -25); ctx.lineTo(-80, -20); ctx.stroke();
        
        ctx.restore();
      });

      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>;
}

/* ── CANVAS 3: VECTOR CONTOUR POUR ── */
function BgPour() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const ani = useRef<number>(0);
  const t = useRef(0);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    
    const draw = () => {
      t.current += 0.01; const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      
      ctx.fillStyle = C.bg; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      for(let i=0; i<W; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
      for(let i=0; i<H; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(W,i); ctx.stroke(); }

      const cx = W * 0.35;
      
      // Structural Rebar
      ctx.strokeStyle = C.cyanDim;
      ctx.lineWidth = 2;
      for(let i=0; i<10; i++) {
        const x = cx - 150 + i * 30;
        ctx.beginPath(); ctx.moveTo(x, H * 0.4); ctx.lineTo(x, H); ctx.stroke();
      }
      for(let i=0; i<10; i++) {
        const y = H * 0.4 + i * 40;
        ctx.beginPath(); ctx.moveTo(cx - 180, y); ctx.lineTo(cx + 180, y); ctx.stroke();
      }

      // Fluid Flow Splines
      ctx.lineWidth = 1.5;
      for(let i=0; i<12; i++) {
        ctx.strokeStyle = i % 3 === 0 ? C.yellow : C.cyan;
        ctx.beginPath();
        const startX = cx + (i - 6) * 10;
        ctx.moveTo(startX, 0);
        
        let py = 0;
        let px = startX;
        while(py < H) {
          py += 20;
          px += Math.sin(t.current + py * 0.02 + i) * 15;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>;
}

/* ── CANVAS 4: RADAR/COMMAND ── */
function BgCommand() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const ani = useRef<number>(0);
  const t = useRef(0);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    
    const draw = () => {
      t.current += 0.02; const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      
      ctx.fillStyle = C.bg; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      for(let i=0; i<W; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
      for(let i=0; i<H; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(W,i); ctx.stroke(); }

      const cx = W * 0.5, cy = H * 0.45;
      const rMax = Math.min(W, H) * 0.4;
      
      // Radar circles
      ctx.strokeStyle = C.cyanDim;
      for(let i=1; i<=4; i++) {
        ctx.beginPath(); ctx.arc(cx, cy, rMax * (i/4), 0, Math.PI*2); ctx.stroke();
      }
      
      // Radar sweep
      const angle = t.current % (Math.PI*2);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * rMax, cy + Math.sin(angle) * rMax);
      ctx.strokeStyle = C.cyan;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Data nodes
      for(let i=0; i<8; i++) {
        const a = (i * Math.PI*2)/8;
        const d = rMax * (0.4 + 0.4 * Math.sin(i*7.123));
        const nx = cx + Math.cos(a)*d;
        const ny = cy + Math.sin(a)*d;
        ctx.fillStyle = C.yellow;
        ctx.beginPath(); ctx.arc(nx, ny, 3, 0, Math.PI*2); ctx.fill();
        
        ctx.font = "10px monospace";
        ctx.fillStyle = C.cyan;
        ctx.fillText(`P-${i} DATA`, nx + 8, ny + 3);
      }

      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>;
}

/* ── CANVAS 5: NETWORK NODES ── */
function BgLogin() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const ani = useRef<number>(0);
  const t = useRef(0);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    
    const nodes = Array.from({length: 30}, () => ({
      x: Math.random(), y: Math.random(), 
      vx: (Math.random()-0.5)*0.001, vy: (Math.random()-0.5)*0.001
    }));
    
    const draw = () => {
      t.current += 0.01; const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      
      ctx.fillStyle = C.bg; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      for(let i=0; i<W; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
      for(let i=0; i<H; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(W,i); ctx.stroke(); }

      nodes.forEach(n => { n.x = (n.x + n.vx + 1) % 1; n.y = (n.y + n.vy + 1) % 1; });
      
      nodes.forEach((n1, i) => {
        nodes.forEach((n2, j) => {
          if (j <= i) return;
          const dx = (n1.x - n2.x) * W, dy = (n1.y - n2.y) * H;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 150) {
            ctx.beginPath(); ctx.moveTo(n1.x*W, n1.y*H); ctx.lineTo(n2.x*W, n2.y*H);
            ctx.strokeStyle = `rgba(77, 184, 255, ${0.4 * (1 - dist/150)})`;
            ctx.stroke();
          }
        });
      });
      
      nodes.forEach(n => {
        ctx.fillStyle = C.white;
        ctx.beginPath(); ctx.arc(n.x*W, n.y*H, 2, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = C.cyan;
        ctx.beginPath(); ctx.arc(n.x*W, n.y*H, 5, 0, Math.PI*2); ctx.stroke();
      });

      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>;
}


/* ════════════════════════════════════════════════════════
   MAIN DECK COMPONENT
════════════════════════════════════════════════════════ */

export default function BlueprintDeck() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [rotatingWord, setRotatingWord] = useState("Dispatch.");
  const [otpStep, setOtpStep] = useState(false);
  const [phone, setPhone] = useState("");
  const words = ["Dispatch.", "Freshness.", "Fleet.", "Output."];

  useEffect(() => {
    const int = setInterval(() => {
      setRotatingWord(prev => words[(words.indexOf(prev) + 1) % words.length]);
    }, 2500);
    return () => clearInterval(int);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setActiveSlide(s => Math.min(4, s + 1));
      if (e.key === "ArrowLeft") setActiveSlide(s => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const navItems = ["Home", "GPS", "Freshness", "Command", "Login"];

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#05203A] text-[#E6F4FF] selection:bg-[#4DB8FF] selection:text-[#05203A]">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Jura:wght@500;700&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        
        .font-blueprint { font-family: 'Jura', sans-serif; }
        .font-mono { font-family: 'Space Mono', monospace; }
        
        .blueprint-panel {
          background: rgba(5, 32, 58, 0.75);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(77, 184, 255, 0.4);
          box-shadow: 0 0 20px rgba(77, 184, 255, 0.05);
        }
        .blueprint-panel-corner {
          position: absolute;
          width: 8px; height: 8px;
          border: 1px solid #4DB8FF;
        }
        .bp-tl { top: -1px; left: -1px; border-right: none; border-bottom: none; }
        .bp-tr { top: -1px; right: -1px; border-left: none; border-bottom: none; }
        .bp-bl { bottom: -1px; left: -1px; border-right: none; border-top: none; }
        .bp-br { bottom: -1px; right: -1px; border-left: none; border-top: none; }
        
        .blueprint-btn {
          background: rgba(77, 184, 255, 0.1);
          border: 1px solid #4DB8FF;
          color: #4DB8FF;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .blueprint-btn:hover {
          background: #4DB8FF;
          color: #05203A;
          box-shadow: 0 0 15px rgba(77, 184, 255, 0.4);
        }
        .blueprint-btn-solid {
          background: #4DB8FF;
          color: #05203A;
          border: 1px solid #4DB8FF;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .blueprint-btn-solid:hover {
          background: #FFD166;
          border-color: #FFD166;
          box-shadow: 0 0 20px rgba(255, 209, 102, 0.4);
        }
        
        .tech-text { text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.85rem; }
      `}} />

      {/* TOP NAV */}
      <nav className="absolute top-0 w-full z-50 p-6 flex justify-between items-center font-mono tech-text text-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 border border-[#4DB8FF] flex items-center justify-center bg-[rgba(77,184,255,0.1)]">
            <span className="text-[#FFD166] font-bold text-xl leading-none">C</span>
          </div>
          <div>
            <div className="font-blueprint font-bold text-lg tracking-wider text-white">CONCRETE KING</div>
            <div className="text-[#4DB8FF] text-xs">RMC OPERATIONS OS</div>
          </div>
        </div>
        
        <div className="hidden md:flex gap-8">
          {navItems.map((item, i) => (
            <button key={i} onClick={() => setActiveSlide(i)} 
                    className={\`transition-colors \${activeSlide === i ? "text-[#FFD166]" : "text-[#8CB8D9] hover:text-[#4DB8FF]"}\`}>
              [{item}]
            </button>
          ))}
        </div>
        
        <button onClick={openLogin} className="blueprint-btn px-6 py-2 hidden md:block">
          LOGIN
        </button>
      </nav>

      {/* SLIDES CONTAINER */}
      <div className="relative w-full h-full">
        {/* SLIDE 1: HOME */}
        <div className={\`absolute inset-0 transition-opacity duration-1000 \${activeSlide === 0 ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}\`}>
          <BgDrum />
          <div className="absolute inset-0 flex flex-col justify-center items-start px-12 lg:px-24">
            <div className="max-w-3xl z-10 relative">
              <div className="font-mono text-[#FFD166] mb-4 tech-text flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FFD166] rounded-full animate-pulse"></span>
                READY MIX CONCRETE · OPERATIONS OS
              </div>
              <h1 className="font-blueprint text-6xl lg:text-8xl font-bold leading-tight mb-6">
                Control your <br />
                <span className="text-[#4DB8FF] inline-block min-w-[300px]">{rotatingWord}</span>
              </h1>
              <p className="font-mono text-lg text-[#8CB8D9] mb-10 max-w-2xl leading-relaxed">
                The only platform built ground-up for RMC plants. Unify your batching, GPS fleet tracking, automated quality guardrails, and customer dispatch on one screen.
              </p>
              <div className="flex gap-4 font-mono">
                <button onClick={openLogin} className="blueprint-btn-solid px-8 py-4 flex items-center gap-3">
                  Get Started <ArrowRight size={18} />
                </button>
                <button className="blueprint-btn px-8 py-4 flex items-center gap-3">
                  <Play size={18} /> Watch Demo
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
                {[
                  { icon: Truck, val: "4 Live Pours", sub: "3 plants active" },
                  { icon: Activity, val: "143 m³ Today's Output", sub: "+18% vs avg" },
                  { icon: ShieldCheck, val: "96.4% On-Time Rate", sub: "Last 7 days" },
                  { icon: Navigation, val: "12 Fleet Online", sub: "2 in maintenance" }
                ].map((s,i) => (
                  <div key={i} className="font-mono pt-4 border-t border-[rgba(77,184,255,0.3)]">
                    <s.icon size={20} className="text-[#FFD166] mb-3" />
                    <div className="text-white font-bold mb-1">{s.val}</div>
                    <div className="text-[#8CB8D9] text-sm">{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 2: GPS */}
        <div className={\`absolute inset-0 transition-opacity duration-1000 \${activeSlide === 1 ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}\`}>
          <BgHighway />
          <div className="absolute inset-0 flex items-center px-12 lg:px-24">
            <div className="grid lg:grid-cols-2 gap-16 w-full items-center z-10">
              <div>
                <div className="font-mono text-[#FFD166] mb-4 tech-text flex items-center gap-2">
                  <Navigation size={16} /> LIVE GPS TRACKING
                </div>
                <h1 className="font-blueprint text-5xl lg:text-7xl font-bold leading-tight mb-6">
                  Every mixer.<br />
                  <span className="text-[#4DB8FF]">Always visible.</span>
                </h1>
                <p className="font-mono text-lg text-[#8CB8D9] mb-8 max-w-xl leading-relaxed">
                  Real-time fleet tracking built for concrete. See when trucks arrive at site, when pouring begins, and when they are empty and returning. No more phone calls to drivers.
                </p>
              </div>
              
              <div className="relative blueprint-panel p-8">
                <div className="blueprint-panel-corner bp-tl"></div><div className="blueprint-panel-corner bp-tr"></div>
                <div className="blueprint-panel-corner bp-bl"></div><div className="blueprint-panel-corner bp-br"></div>
                <h3 className="font-mono text-[#4DB8FF] tech-text mb-6 flex items-center gap-2">
                  <Activity size={16} /> Live Fleet Status
                </h3>
                <div className="space-y-4 font-mono">
                  {[
                    { id: "MH 46 DC 0814", status: "Moving 38 km/h", color: "text-[#4DB8FF]" },
                    { id: "MH 48 T 5967", status: "Moving 42 km/h", color: "text-[#4DB8FF]" },
                    { id: "MH 46 BB 9003", status: "Arrived Site", color: "text-[#FFD166]" },
                    { id: "MH 46 DC 0813", status: "Idle Plant", color: "text-[#8CB8D9]" },
                  ].map((tr, i) => (
                    <div key={i} className="flex justify-between items-center p-4 border border-[rgba(77,184,255,0.2)] bg-[rgba(77,184,255,0.05)]">
                      <div className="flex items-center gap-3">
                        <Truck size={18} className={tr.color} />
                        <span className="font-bold">{tr.id}</span>
                      </div>
                      <span className={\`text-sm \${tr.color}\`}>{tr.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 3: FRESHNESS */}
        <div className={\`absolute inset-0 transition-opacity duration-1000 \${activeSlide === 2 ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}\`}>
          <BgPour />
          <div className="absolute inset-0 flex items-center px-12 lg:px-24">
            <div className="grid lg:grid-cols-2 gap-16 w-full items-center z-10">
              <div className="relative blueprint-panel p-8">
                <div className="blueprint-panel-corner bp-tl"></div><div className="blueprint-panel-corner bp-tr"></div>
                <div className="blueprint-panel-corner bp-bl"></div><div className="blueprint-panel-corner bp-br"></div>
                <div className="flex justify-between mb-8 text-sm font-mono tech-text">
                  <span className="text-[#4DB8FF] flex items-center gap-2"><CheckCircle2 size={14}/> Safe (100-30%)</span>
                  <span className="text-[#FFD166] flex items-center gap-2"><AlertTriangle size={14}/> Caution (29-10%)</span>
                  <span className="text-red-400 flex items-center gap-2"><XCircle size={14}/> Critical (&lt;10%)</span>
                </div>
                <div className="space-y-6 font-mono">
                  {[
                    { id: "TM-0814", mix: "M25", site: "P.G. Constructions", pct: 74, color: "bg-[#4DB8FF]" },
                    { id: "TM-5967", mix: "M20", site: "Ananth Corporation", pct: 46, color: "bg-[#4DB8FF]" },
                    { id: "TM-9003", mix: "M30", site: "DS Infrastructure", pct: 12, color: "bg-red-400", alert: " — SLUMP RISK" },
                    { id: "TM-0813", mix: "M10", site: "Hiravati Agro", pct: 62, color: "bg-[#4DB8FF]" },
                  ].map((t, i) => (
                    <div key={i} className="relative">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-bold">{t.id} <span className="text-[#8CB8D9] font-normal px-2">{t.mix}</span> {t.site}</span>
                        <span className="text-white">{t.pct}% {t.alert && <span className="text-red-400">{t.alert}</span>}</span>
                      </div>
                      <div className="h-1 bg-[rgba(77,184,255,0.1)] w-full overflow-hidden">
                        <div className={\`h-full \${t.color}\`} style={{ width: \`\${t.pct}%\` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <div className="font-mono text-[#FFD166] mb-4 tech-text flex items-center gap-2">
                  <ShieldCheck size={16} /> FRESHNESS GUARD
                </div>
                <h1 className="font-blueprint text-5xl lg:text-7xl font-bold leading-tight mb-6">
                  Never lose<br />
                  <span className="text-[#4DB8FF]">a pour again.</span>
                </h1>
                <p className="font-mono text-lg text-[#8CB8D9] mb-8 max-w-xl leading-relaxed">
                  Automatic IS 4926 90-minute compliance tracking. The system watches dispatch times and transit delays, alerting operators instantly if a batch approaches critical slump loss.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SLIDE 4: COMMAND */}
        <div className={\`absolute inset-0 transition-opacity duration-1000 \${activeSlide === 3 ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}\`}>
          <BgCommand />
          <div className="absolute inset-0 flex flex-col justify-center items-center px-12 lg:px-24 text-center z-10">
            <div className="font-mono text-[#FFD166] mb-4 tech-text flex items-center justify-center gap-2">
              <Cpu size={16} /> COMMAND CENTER
            </div>
            <h1 className="font-blueprint text-5xl lg:text-7xl font-bold leading-tight mb-6">
              One screen.<br />
              <span className="text-[#4DB8FF]">Total plant intelligence.</span>
            </h1>
            <p className="font-mono text-lg text-[#8CB8D9] mb-12 max-w-2xl leading-relaxed mx-auto">
              Bring your entire operation into a single, unified view. AI-driven insights, live metrics, and comprehensive control over every aspect of your plant.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full max-w-5xl font-mono text-left">
              {[
                { title: "GPS Tracking", sub: "Live, always", icon: Navigation },
                { title: "Freshness Guard", sub: "IS-code compliant", icon: ShieldCheck },
                { title: "Smart Plant AI", sub: "Voice & text", icon: Cpu },
                { title: "Demand Forecast", sub: "Hourly insights", icon: BarChart4 },
                { title: "Fleet Control", sub: "Every mixer", icon: Truck },
              ].map((f, i) => (
                <div key={i} className="blueprint-panel p-6 relative group hover:border-[#FFD166] transition-colors cursor-default">
                  <div className="blueprint-panel-corner bp-tl"></div><div className="blueprint-panel-corner bp-br"></div>
                  <f.icon size={24} className="text-[#4DB8FF] mb-4 group-hover:text-[#FFD166] transition-colors" />
                  <div className="text-white font-bold mb-1">{f.title}</div>
                  <div className="text-[#8CB8D9] text-xs uppercase">{f.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SLIDE 5: LOGIN */}
        <div className={\`absolute inset-0 transition-opacity duration-1000 \${activeSlide === 4 ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}\`}>
          <BgLogin />
          <div className="absolute inset-0 flex items-center px-12 lg:px-24">
            <div className="grid lg:grid-cols-2 gap-16 w-full items-center z-10">
              <div>
                <div className="font-mono text-[#FFD166] mb-4 tech-text flex items-center gap-2">
                  <ShieldCheck size={16} /> SECURE PLATFORM
                </div>
                <h1 className="font-blueprint text-5xl lg:text-7xl font-bold leading-tight mb-6">
                  Secure access for<br />
                  <span className="text-[#4DB8FF]">every plant role.</span>
                </h1>
                <p className="font-mono text-lg text-[#8CB8D9] mb-8 max-w-xl leading-relaxed">
                  Role-based access ensures everyone sees exactly what they need. Industry-standard security keeps your plant data private.
                </p>
                <div className="blueprint-panel p-6 flex flex-wrap gap-4 max-w-md relative">
                  <div className="blueprint-panel-corner bp-tl"></div><div className="blueprint-panel-corner bp-tr"></div>
                  <div className="blueprint-panel-corner bp-bl"></div><div className="blueprint-panel-corner bp-br"></div>
                  {["Owner", "Admin", "Operator", "Driver"].map(role => (
                    <div key={role} className="border border-[rgba(77,184,255,0.4)] px-4 py-2 font-mono text-sm uppercase text-[#4DB8FF]">
                      {role}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="relative blueprint-panel p-10 max-w-md mx-auto w-full">
                <div className="blueprint-panel-corner bp-tl"></div><div className="blueprint-panel-corner bp-tr"></div>
                <div className="blueprint-panel-corner bp-bl"></div><div className="blueprint-panel-corner bp-br"></div>
                <h2 className="font-blueprint text-3xl font-bold text-white mb-2">Access Portal</h2>
                <p className="font-mono text-[#8CB8D9] text-sm mb-8">Enter your credentials to continue</p>
                
                {!otpStep ? (
                  <div className="space-y-6 font-mono">
                    <button onClick={openLogin} className="w-full blueprint-btn py-3 flex items-center justify-center gap-3">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Continue with Google
                    </button>
                    <div className="relative flex items-center">
                      <div className="flex-grow border-t border-[rgba(77,184,255,0.2)]"></div>
                      <span className="flex-shrink-0 mx-4 text-[#8CB8D9] text-xs uppercase">OR PHONE NUMBER</span>
                      <div className="flex-grow border-t border-[rgba(77,184,255,0.2)]"></div>
                    </div>
                    <div>
                      <div className="flex gap-2">
                        <div className="w-16 flex items-center justify-center border border-[rgba(77,184,255,0.4)] bg-[rgba(5,32,58,0.5)] text-[#E6F4FF]">
                          +91
                        </div>
                        <input 
                          type="tel" 
                          placeholder="Phone number" 
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="flex-1 bg-[rgba(5,32,58,0.5)] border border-[rgba(77,184,255,0.4)] p-3 text-[#E6F4FF] placeholder:text-[#8CB8D9] focus:outline-none focus:border-[#4DB8FF]"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => setOtpStep(true)}
                      className="w-full blueprint-btn-solid py-3 flex justify-center items-center gap-2"
                    >
                      Send OTP via WhatsApp <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 font-mono">
                    <p className="text-sm text-[#8CB8D9]">Enter the 6-digit code sent to +91 {phone || "XXXXX XXXXX"}</p>
                    <div className="flex gap-2 justify-between">
                      {[1,2,3,4,5,6].map(i => (
                        <input key={i} type="text" maxLength={1} className="w-12 h-14 bg-[rgba(5,32,58,0.5)] border border-[rgba(77,184,255,0.4)] text-center text-xl text-white focus:outline-none focus:border-[#4DB8FF]" />
                      ))}
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => setOtpStep(false)} className="blueprint-btn px-6 py-3">
                        Back
                      </button>
                      <button onClick={openLogin} className="flex-1 blueprint-btn-solid py-3 flex justify-center items-center gap-2">
                        Verify & Enter App <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="absolute bottom-8 w-full px-12 lg:px-24 flex justify-between items-center z-50 font-mono">
        <div className="flex gap-4 items-center">
          <button onClick={() => setActiveSlide(s => Math.max(0, s-1))} disabled={activeSlide === 0}
                  className={\`p-3 border transition-colors \${activeSlide === 0 ? "border-[rgba(77,184,255,0.1)] text-[rgba(77,184,255,0.2)] cursor-not-allowed" : "border-[#4DB8FF] text-[#4DB8FF] hover:bg-[#4DB8FF] hover:text-[#05203A]"}\`}>
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => setActiveSlide(s => Math.min(4, s+1))} disabled={activeSlide === 4}
                  className={\`p-3 border transition-colors \${activeSlide === 4 ? "border-[rgba(77,184,255,0.1)] text-[rgba(77,184,255,0.2)] cursor-not-allowed" : "border-[#4DB8FF] text-[#4DB8FF] hover:bg-[#4DB8FF] hover:text-[#05203A]"}\`}>
            <ChevronRight size={20} />
          </button>
        </div>
        
        <div className="flex gap-3">
          {[0, 1, 2, 3, 4].map(i => (
            <button key={i} onClick={() => setActiveSlide(i)} 
                    className={\`h-1 transition-all duration-300 \${activeSlide === i ? "w-12 bg-[#FFD166]" : "w-4 bg-[rgba(77,184,255,0.3)] hover:bg-[#4DB8FF]"}\`} />
          ))}
        </div>
        
        <div className="text-[#8CB8D9] text-sm tech-text">
          {activeSlide + 1} / 5
        </div>
      </div>
    </div>
  );
}
