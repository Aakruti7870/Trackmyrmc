import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  ArrowRight, 
  MapPin, 
  Play, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  BarChart, 
  Globe, 
  TrendingUp, 
  Truck, 
  Lock, 
  User, 
  Smartphone,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

/* ════════════════════════════════════════════════════════
   CONCRETE KING – RMC OPERATIONS OS
   Variant: EDITORIAL (Premium, Refined, Journalistic)
════════════════════════════════════════════════════════ */

const E = {
  bg: "#F9F8F6",
  ink: "#1A1A1A",
  inkLight: "#333333",
  accent: "#A84E32", // Terracotta/rust
  border: "#E2DFD8",
  panel: "#FFFFFF",
  muted: "#8C8982"
};

const openLogin = () => {
  if (typeof window !== "undefined") {
    window.open("/login", "_blank", "noopener,noreferrer");
  }
};

/* ── CUSTOM STYLES & FONTS ── */
const EditorialStyles = () => (
  <style dangerouslySetInnerHTML={{__html: `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,800;1,400;1,600&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

    .font-serif { font-family: 'Playfair Display', serif; }
    .font-sans { font-family: 'Inter', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }

    .editorial-bg { background-color: ${E.bg}; color: ${E.ink}; }
    
    .text-balance { text-wrap: balance; }
    
    .slide-enter { animation: slideIn 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
    .slide-exit { animation: slideOut 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
    
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(40px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-40px); }
    }

    .stagger-1 { animation-delay: 0.1s; }
    .stagger-2 { animation-delay: 0.2s; }
    .stagger-3 { animation-delay: 0.3s; }
    .stagger-4 { animation-delay: 0.4s; }

    .noise-overlay {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 50;
      opacity: 0.04;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    }

    /* Magazine layout borders */
    .border-grid {
      border: 1px solid ${E.border};
    }
    .border-grid-b {
      border-bottom: 1px solid ${E.border};
    }
    .border-grid-r {
      border-right: 1px solid ${E.border};
    }
  `}} />
);

/* ── CANVAS 1: EDITORIAL DRUM ── */
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
      t.current += 0.005; const W = cv.width, H = cv.height;
      ctx.fillStyle = E.bg; ctx.fillRect(0, 0, W, H);
      
      const dx = W * 0.7; const dy = H * 0.5;
      const rX = W * 0.25; const rY = H * 0.55;
      
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(t.current * 0.2);
      
      // Wireframe elegant drum
      ctx.strokeStyle = "rgba(26, 26, 26, 0.05)";
      ctx.lineWidth = 1;
      
      for(let i=0; i<16; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, rX * (i/16), rY, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for(let i=0; i<16; i++) {
        const a = i * Math.PI / 8;
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.lineTo(Math.cos(a) * rX, Math.sin(a) * rY);
        ctx.stroke();
      }
      
      ctx.restore();
      
      // Fine grid lines
      ctx.strokeStyle = "rgba(26, 26, 26, 0.03)";
      for(let x=0; x<W; x+=100) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for(let y=0; y<H; y+=100) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-60" />;
}

/* ── CANVAS 2: HIGHWAY TRUCKS ── */
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
      { x: 0, speed: 1.2, y: 0.3, width: 60 },
      { x: 300, speed: 0.8, y: 0.5, width: 80 },
      { x: 600, speed: 1.5, y: 0.7, width: 50 },
      { x: 100, speed: 1.0, y: 0.85, width: 70 },
    ];
    
    const draw = () => {
      t.current += 0.01; const W = cv.width, H = cv.height;
      ctx.fillStyle = E.bg; ctx.fillRect(0, 0, W, H);
      
      // Topographic lines
      ctx.strokeStyle = "rgba(26, 26, 26, 0.04)";
      ctx.lineWidth = 1;
      for (let i=0; i<20; i++) {
        ctx.beginPath();
        for (let x=0; x<W; x+=50) {
          const y = H * (i/20) + Math.sin(x*0.005 + t.current) * 20;
          x===0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      
      // Abstract trucks (black dashes)
      ctx.fillStyle = E.ink;
      trucks.forEach(tr => {
        tr.x = (tr.x + tr.speed) % (W + 200);
        const actualX = tr.x - 100;
        const actualY = H * tr.y;
        
        ctx.globalAlpha = 0.1;
        ctx.fillRect(actualX, actualY, tr.width, 2);
        ctx.globalAlpha = 1.0;
        ctx.fillRect(actualX + tr.width - 10, actualY - 1, 10, 4);
      });
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-70" />;
}

/* ── CANVAS 3: POUR ── */
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
      t.current += 0.005; const W = cv.width, H = cv.height;
      ctx.fillStyle = E.bg; ctx.fillRect(0, 0, W, H);
      
      // Organic elegant blobs
      const drawBlob = (x:number, y:number, r:number, offset:number, color:string) => {
        ctx.beginPath();
        for (let a=0; a<Math.PI*2; a+=0.1) {
          const rad = r + Math.sin(a*3 + t.current + offset) * (r*0.1) + Math.cos(a*2 - t.current) * (r*0.1);
          const px = x + Math.cos(a) * rad;
          const py = y + Math.sin(a) * rad;
          a===0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      };
      
      drawBlob(W*0.6, H*0.6, H*0.4, 0, "rgba(226, 223, 216, 0.4)");
      drawBlob(W*0.65, H*0.65, H*0.3, 2, "rgba(26, 26, 26, 0.03)");
      drawBlob(W*0.55, H*0.7, H*0.2, 4, "rgba(168, 78, 50, 0.05)");
      
      // Vertical dripping lines (like ink)
      ctx.strokeStyle = "rgba(26, 26, 26, 0.08)";
      ctx.lineWidth = 1;
      for (let i=0; i<15; i++) {
        const lx = W*0.4 + i*20;
        const ly = (t.current * 50 + i * 100) % H;
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.beginPath(); ctx.arc(lx, ly, 2, 0, Math.PI*2); ctx.fillStyle="rgba(26,26,26,0.1)"; ctx.fill();
      }
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-80" />;
}

/* ── CANVAS 4: COMMAND DATA ── */
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
      t.current += 0.005; const W = cv.width, H = cv.height;
      ctx.fillStyle = E.bg; ctx.fillRect(0, 0, W, H);
      
      ctx.strokeStyle = "rgba(26, 26, 26, 0.05)";
      ctx.lineWidth = 1;
      
      // Architectural drafting lines
      for (let x=0; x<W; x+=60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y=0; y<H; y+=60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      
      ctx.strokeStyle = "rgba(168, 78, 50, 0.1)";
      ctx.beginPath(); ctx.moveTo(W*0.2, 0); ctx.lineTo(W*0.2, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, H*0.3); ctx.lineTo(W, H*0.3); ctx.stroke();
      
      // Abstract data bars
      ctx.fillStyle = "rgba(26, 26, 26, 0.04)";
      for (let i=0; i<20; i++) {
        const h = Math.abs(Math.sin(i*0.5 + t.current)) * 100 + 20;
        ctx.fillRect(W*0.6 + i*15, H*0.8 - h, 10, h);
      }
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-60" />;
}

/* ── CANVAS 5: LOGIN ── */
function BgLogin() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const ani = useRef<number>(0);
  const t = useRef(0);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    
    const nodes = Array.from({length: 40}, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random()-0.5)*0.001, vy: (Math.random()-0.5)*0.001
    }));
    
    const draw = () => {
      t.current += 0.01; const W = cv.width, H = cv.height;
      ctx.fillStyle = E.bg; ctx.fillRect(0, 0, W, H);
      
      nodes.forEach(n => { n.x = (n.x + n.vx + 1) % 1; n.y = (n.y + n.vy + 1) % 1; });
      
      ctx.lineWidth = 0.5;
      nodes.forEach((n1, i) => {
        nodes.forEach((n2, j) => {
          if (j <= i) return;
          const dx = (n1.x - n2.x)*W, dy = (n1.y - n2.y)*H;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 150) {
            ctx.beginPath(); ctx.moveTo(n1.x*W, n1.y*H); ctx.lineTo(n2.x*W, n2.y*H);
            ctx.strokeStyle = `rgba(26, 26, 26, ${0.05 * (1 - dist/150)})`;
            ctx.stroke();
          }
        });
      });
      
      ctx.fillStyle = "rgba(26, 26, 26, 0.1)";
      nodes.forEach(n => {
        ctx.beginPath(); ctx.arc(n.x*W, n.y*H, 1.5, 0, Math.PI*2); ctx.fill();
      });
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-80" />;
}

/* ── COMPONENT ── */
export default function EditorialDeck() {
  const [slide, setSlide] = useState(0);
  const [rotIndex, setRotIndex] = useState(0);
  const words = ["Dispatch.", "Freshness.", "Fleet.", "Output."];

  useEffect(() => {
    const iv = setInterval(() => setRotIndex(r => (r + 1) % words.length), 2500);
    return () => clearInterval(iv);
  }, [words.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setSlide(s => Math.min(4, s + 1));
      if (e.key === "ArrowLeft") setSlide(s => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const [otpStep, setOtpStep] = useState(false);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden editorial-bg font-sans flex flex-col selection:bg-[#A84E32] selection:text-white">
      <EditorialStyles />
      <div className="noise-overlay" />

      {/* TOP NAVBAR */}
      <nav className="absolute top-0 left-0 w-full z-40 px-8 py-6 flex justify-between items-center border-b border-[#E2DFD8] bg-[#F9F8F6]/90 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1A1A1A] flex items-center justify-center rounded-sm">
            <div className="w-3 h-3 bg-[#F9F8F6] rounded-full" />
          </div>
          <div>
            <span className="font-serif font-bold text-xl tracking-tight text-[#1A1A1A] uppercase">Concrete King</span>
            <span className="ml-3 text-[10px] font-mono tracking-widest text-[#8C8982]">RMC OPERATIONS OS</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8 text-[11px] font-mono tracking-widest text-[#8C8982]">
          {["Home", "GPS", "Freshness", "Command", "Login"].map((item, i) => (
            <button key={item} onClick={() => setSlide(i)} className={\`uppercase hover:text-[#1A1A1A] transition-colors \${slide === i ? 'text-[#1A1A1A] font-bold border-b border-[#1A1A1A] pb-1' : ''}\`}>
              {item}
            </button>
          ))}
        </div>
        <button onClick={openLogin} className="border border-[#1A1A1A] text-[#1A1A1A] px-5 py-2 text-xs font-mono tracking-widest uppercase hover:bg-[#1A1A1A] hover:text-[#F9F8F6] transition-colors duration-300">
          Login
        </button>
      </nav>

      {/* SLIDES CONTAINER */}
      <div className="flex-1 relative w-full h-full">
        
        {/* SLIDE 0: HOME */}
        {slide === 0 && (
          <div className="absolute inset-0 w-full h-full overflow-hidden slide-enter">
            <BgDrum />
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-8 md:px-24 max-w-7xl mx-auto pt-20">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                
                <div className="lg:col-span-7 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 mb-8 stagger-1">
                    <span className="w-8 h-[1px] bg-[#A84E32]"></span>
                    <span className="text-[#A84E32] font-mono text-xs tracking-[0.2em] uppercase">Ready Mix Concrete · Operations OS</span>
                  </div>
                  
                  <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif text-[#1A1A1A] leading-[1.05] tracking-tight mb-8 stagger-2">
                    Control your<br />
                    <span className="text-[#A84E32] italic">{words[rotIndex]}</span>
                  </h1>
                  
                  <p className="text-[#333333] text-lg md:text-xl font-sans font-light leading-relaxed max-w-xl mb-12 stagger-3 text-balance">
                    The only platform built ground-up for RMC plants. Connect your batching plant, transit mixers, and site engineers on one screen.
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-4 stagger-4">
                    <button onClick={openLogin} className="bg-[#1A1A1A] text-[#F9F8F6] px-8 py-4 text-sm font-sans font-medium hover:bg-[#333333] transition-colors flex items-center gap-2">
                      Get Started <ArrowRight className="w-4 h-4" />
                    </button>
                    <button className="bg-transparent border border-[#E2DFD8] text-[#1A1A1A] px-8 py-4 text-sm font-sans font-medium hover:border-[#1A1A1A] transition-colors flex items-center gap-2">
                      <Play className="w-4 h-4" /> Watch Demo
                    </button>
                  </div>
                </div>
                
                <div className="lg:col-span-5 flex flex-col justify-center stagger-4">
                  <div className="border border-[#E2DFD8] bg-[#FFFFFF] p-8 shadow-sm">
                    <h3 className="font-mono text-[10px] tracking-widest text-[#8C8982] uppercase mb-6 border-b border-[#E2DFD8] pb-4">Live Performance</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-6">
                      <div>
                        <div className="flex items-center gap-2 text-[#333333] mb-1">
                          <Activity className="w-4 h-4 text-[#A84E32]" />
                          <span className="text-xs font-mono uppercase tracking-wider">Live Pours</span>
                        </div>
                        <div className="text-3xl font-serif text-[#1A1A1A] mb-1">4</div>
                        <div className="text-[10px] font-sans text-[#8C8982]">3 plants active</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-[#333333] mb-1">
                          <BarChart className="w-4 h-4 text-[#A84E32]" />
                          <span className="text-xs font-mono uppercase tracking-wider">Today's Output</span>
                        </div>
                        <div className="text-3xl font-serif text-[#1A1A1A] mb-1">143 <span className="text-xl text-[#8C8982]">m³</span></div>
                        <div className="text-[10px] font-sans text-[#A84E32] font-medium">+18% vs avg</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-[#333333] mb-1">
                          <ShieldCheck className="w-4 h-4 text-[#A84E32]" />
                          <span className="text-xs font-mono uppercase tracking-wider">On-Time Rate</span>
                        </div>
                        <div className="text-3xl font-serif text-[#1A1A1A] mb-1">96.4%</div>
                        <div className="text-[10px] font-sans text-[#8C8982]">Last 7 days</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-[#333333] mb-1">
                          <Truck className="w-4 h-4 text-[#A84E32]" />
                          <span className="text-xs font-mono uppercase tracking-wider">Fleet Online</span>
                        </div>
                        <div className="text-3xl font-serif text-[#1A1A1A] mb-1">12</div>
                        <div className="text-[10px] font-sans text-[#8C8982]">2 in maintenance</div>
                      </div>
                    </div>
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 1: GPS */}
        {slide === 1 && (
          <div className="absolute inset-0 w-full h-full overflow-hidden slide-enter">
            <BgHighway />
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-8 md:px-24 max-w-7xl mx-auto pt-20">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-5 flex flex-col justify-center order-2 lg:order-1 stagger-3">
                  <div className="bg-[#FFFFFF] border border-[#E2DFD8] shadow-sm flex flex-col h-full max-h-[500px]">
                    <div className="p-6 border-b border-[#E2DFD8] flex justify-between items-center bg-[#F9F8F6]">
                      <div className="font-mono text-[10px] tracking-widest text-[#1A1A1A] uppercase flex items-center gap-2">
                        <span className="w-2 h-2 bg-[#A84E32] rounded-full animate-pulse"></span>
                        Fleet Status
                      </div>
                      <div className="text-[10px] font-sans text-[#8C8982]">Live</div>
                    </div>
                    <div className="p-0 flex-1 overflow-auto">
                      {[
                        { id: "MH 46 DC 0814", stat: "Moving 38 km/h", c: "text-[#A84E32]" },
                        { id: "MH 48 T 5967", stat: "Moving 42 km/h", c: "text-[#A84E32]" },
                        { id: "MH 46 BB 9003", stat: "Arrived Site", c: "text-[#1A1A1A]" },
                        { id: "MH 46 DC 0813", stat: "Idle Plant", c: "text-[#8C8982]" }
                      ].map((t, i) => (
                        <div key={i} className="flex justify-between items-center p-6 border-b border-[#E2DFD8] last:border-0 hover:bg-[#F9F8F6] transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 border border-[#E2DFD8] rounded-full flex items-center justify-center bg-[#FFFFFF]">
                              <Truck className="w-4 h-4 text-[#1A1A1A]" />
                            </div>
                            <span className="font-mono text-sm font-medium text-[#1A1A1A]">{t.id}</span>
                          </div>
                          <span className={\`font-sans text-xs \${t.c}\`}>{t.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="lg:col-span-7 flex flex-col justify-center order-1 lg:order-2">
                  <div className="inline-flex items-center gap-2 mb-8 stagger-1">
                    <span className="w-8 h-[1px] bg-[#A84E32]"></span>
                    <span className="text-[#A84E32] font-mono text-xs tracking-[0.2em] uppercase">Live GPS Tracking</span>
                  </div>
                  <h2 className="text-5xl md:text-7xl font-serif text-[#1A1A1A] leading-[1.05] tracking-tight mb-8 stagger-2">
                    Every mixer.<br />
                    <span className="italic">Always visible.</span>
                  </h2>
                  <p className="text-[#333333] text-lg font-sans font-light leading-relaxed max-w-xl stagger-3">
                    Stop calling drivers. See exactly where your concrete is, predict site arrivals, and auto-detect when pouring starts and ends with geo-fencing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 2: FRESHNESS */}
        {slide === 2 && (
          <div className="absolute inset-0 w-full h-full overflow-hidden slide-enter">
            <BgPour />
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-8 md:px-24 max-w-7xl mx-auto pt-20">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-6 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 mb-8 stagger-1">
                    <span className="w-8 h-[1px] bg-[#A84E32]"></span>
                    <span className="text-[#A84E32] font-mono text-xs tracking-[0.2em] uppercase">Freshness Guard</span>
                  </div>
                  <h2 className="text-5xl md:text-7xl font-serif text-[#1A1A1A] leading-[1.05] tracking-tight mb-8 stagger-2">
                    Never lose<br />
                    <span className="italic text-[#A84E32]">a pour again.</span>
                  </h2>
                  <p className="text-[#333333] text-lg font-sans font-light leading-relaxed max-w-xl mb-8 stagger-3">
                    Concrete dies in 90 minutes. Our IS 4926 compliant countdown tracks exactly how much time is left before slump loss, alerting you before loads are rejected.
                  </p>
                  
                  <div className="flex items-center gap-6 font-mono text-[10px] uppercase tracking-widest text-[#8C8982] stagger-4">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#1A1A1A]"></div>Safe</div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#A84E32]"></div>Caution</div>
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full border border-[#A84E32] text-[#A84E32] flex items-center justify-center text-[8px]">!</div>Critical</div>
                  </div>
                </div>
                
                <div className="lg:col-span-6 flex flex-col justify-center stagger-3">
                  <div className="space-y-4">
                    {[
                      { id: "TM-0814", mix: "M25", site: "P.G. Constructions", val: 74, status: "safe" },
                      { id: "TM-5967", mix: "M20", site: "Ananth Corporation", val: 46, status: "caution" },
                      { id: "TM-9003", mix: "M30", site: "DS Infrastructure", val: 12, status: "critical", msg: "SLUMP RISK" },
                      { id: "TM-0813", mix: "M10", site: "Hiravati Agro", val: 62, status: "safe" }
                    ].map((row, i) => (
                      <div key={i} className={\`bg-[#FFFFFF] border \${row.status === 'critical' ? 'border-[#A84E32]' : 'border-[#E2DFD8]'} p-6 flex flex-col gap-4 shadow-sm\`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-mono font-medium text-sm text-[#1A1A1A] mb-1">{row.id} <span className="text-[#8C8982] font-normal mx-2">|</span> {row.mix}</div>
                            <div className="text-xs font-sans text-[#8C8982]">{row.site}</div>
                          </div>
                          <div className={\`font-serif text-2xl \${row.status === 'critical' ? 'text-[#A84E32]' : 'text-[#1A1A1A]'}\`}>
                            {row.val}%
                          </div>
                        </div>
                        <div className="h-1 w-full bg-[#F9F8F6] relative overflow-hidden">
                          <div className={\`absolute top-0 left-0 h-full \${row.status === 'critical' ? 'bg-[#A84E32]' : row.status === 'caution' ? 'bg-[#8C8982]' : 'bg-[#1A1A1A]'}\`} style={{width: \`\${row.val}%\`}}></div>
                        </div>
                        {row.msg && <div className="text-[10px] font-mono tracking-widest text-[#A84E32] uppercase">{row.msg}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 3: COMMAND */}
        {slide === 3 && (
          <div className="absolute inset-0 w-full h-full overflow-hidden slide-enter">
            <BgCommand />
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-8 md:px-24 max-w-7xl mx-auto pt-20">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <div className="inline-flex items-center gap-2 mb-6 stagger-1">
                  <span className="w-8 h-[1px] bg-[#A84E32]"></span>
                  <span className="text-[#A84E32] font-mono text-xs tracking-[0.2em] uppercase">Command Center</span>
                  <span className="w-8 h-[1px] bg-[#A84E32]"></span>
                </div>
                <h2 className="text-5xl md:text-7xl font-serif text-[#1A1A1A] leading-[1.05] tracking-tight mb-6 stagger-2">
                  One screen.<br />
                  <span className="italic">Total plant intelligence.</span>
                </h2>
                <p className="text-[#333333] text-lg font-sans font-light leading-relaxed stagger-3">
                  Replace WhatsApp groups and Excel sheets. A unified operations dashboard that gives you complete command over production, logistics, and quality.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 stagger-4">
                {[
                  { title: "GPS Tracking", desc: "Live, always", icon: MapPin },
                  { title: "Freshness Guard", desc: "IS-code compliant", icon: Clock },
                  { title: "Smart Plant AI", desc: "Voice & text", icon: Globe },
                  { title: "Demand Forecast", desc: "Hourly insights", icon: TrendingUp },
                  { title: "Fleet Control", desc: "Every mixer", icon: Truck }
                ].map((f, i) => (
                  <div key={i} className="border border-[#E2DFD8] bg-[#FFFFFF] p-6 flex flex-col items-center text-center hover:bg-[#F9F8F6] transition-colors cursor-default">
                    <f.icon className="w-6 h-6 text-[#A84E32] mb-4" strokeWidth={1.5} />
                    <h4 className="font-serif font-medium text-[#1A1A1A] text-lg mb-2">{f.title}</h4>
                    <p className="font-sans text-xs text-[#8C8982]">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 4: LOGIN */}
        {slide === 4 && (
          <div className="absolute inset-0 w-full h-full overflow-hidden slide-enter">
            <BgLogin />
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-8 md:px-24 max-w-7xl mx-auto pt-20">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
                <div className="flex flex-col stagger-1">
                  <div className="inline-flex items-center gap-2 mb-8">
                    <span className="w-8 h-[1px] bg-[#A84E32]"></span>
                    <span className="text-[#A84E32] font-mono text-xs tracking-[0.2em] uppercase">Secure Platform</span>
                  </div>
                  <h2 className="text-5xl md:text-7xl font-serif text-[#1A1A1A] leading-[1.05] tracking-tight mb-8">
                    Secure access for<br />
                    <span className="italic">every plant role.</span>
                  </h2>
                  <p className="text-[#333333] text-lg font-sans font-light leading-relaxed mb-12 max-w-md">
                    Enterprise-grade security with role-based access control. Plant data is siloed and encrypted.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { role: "Owner", icon: ShieldCheck },
                      { role: "Admin", icon: User },
                      { role: "Operator", icon: Activity },
                      { role: "Driver", icon: Smartphone }
                    ].map((r, i) => (
                      <div key={i} className="flex items-center gap-3 p-4 border border-[#E2DFD8] bg-[#FFFFFF]">
                        <r.icon className="w-4 h-4 text-[#A84E32]" />
                        <span className="font-mono text-xs uppercase tracking-wider text-[#1A1A1A]">{r.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="stagger-3 relative">
                  <div className="absolute -inset-4 bg-[#FFFFFF] border border-[#E2DFD8] shadow-xl z-0" />
                  <div className="relative z-10 p-8 sm:p-12 bg-[#FFFFFF]">
                    <div className="mb-10 text-center">
                      <h3 className="font-serif text-3xl text-[#1A1A1A] mb-3">Welcome to Concrete King</h3>
                      <p className="font-sans text-sm text-[#8C8982]">Sign in to access your plant operations</p>
                    </div>

                    {!otpStep ? (
                      <div className="space-y-6">
                        <button onClick={openLogin} className="w-full border border-[#E2DFD8] text-[#1A1A1A] font-sans font-medium py-4 flex items-center justify-center gap-3 hover:bg-[#F9F8F6] transition-colors">
                          <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                          Continue with Google
                        </button>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex-1 h-[1px] bg-[#E2DFD8]"></div>
                          <span className="font-mono text-[10px] text-[#8C8982] uppercase tracking-widest">Or Phone</span>
                          <div className="flex-1 h-[1px] bg-[#E2DFD8]"></div>
                        </div>
                        
                        <div className="flex gap-3">
                          <div className="w-16 border border-[#E2DFD8] bg-[#F9F8F6] flex items-center justify-center font-mono text-sm text-[#1A1A1A]">+91</div>
                          <input type="text" placeholder="Enter mobile number" className="flex-1 border border-[#E2DFD8] bg-[#FFFFFF] px-4 py-4 font-sans text-sm focus:outline-none focus:border-[#1A1A1A] transition-colors placeholder-[#8C8982]" />
                        </div>
                        
                        <button onClick={() => setOtpStep(true)} className="w-full bg-[#1A1A1A] text-[#F9F8F6] font-sans font-medium py-4 flex items-center justify-center gap-2 hover:bg-[#333333] transition-colors mt-2">
                          Send OTP via WhatsApp <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="text-center mb-8">
                          <div className="text-sm font-sans text-[#333333] mb-1">Code sent to your WhatsApp</div>
                          <div className="text-xs font-mono text-[#8C8982]">+91 ••••• •••••</div>
                        </div>
                        
                        <div className="flex justify-between gap-2">
                          {[1,2,3,4,5,6].map(i => (
                            <input key={i} type="text" maxLength={1} className="w-full aspect-square border border-[#E2DFD8] text-center font-mono text-xl focus:outline-none focus:border-[#1A1A1A] transition-colors" />
                          ))}
                        </div>
                        
                        <div className="flex gap-4 mt-8">
                          <button onClick={() => setOtpStep(false)} className="px-6 border border-[#E2DFD8] text-[#1A1A1A] hover:bg-[#F9F8F6] transition-colors">
                            Back
                          </button>
                          <button onClick={openLogin} className="flex-1 bg-[#1A1A1A] text-[#F9F8F6] font-sans font-medium py-4 flex items-center justify-center gap-2 hover:bg-[#333333] transition-colors">
                            Verify & Enter App <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        )}

      </div>

      {/* BOTTOM DOTS */}
      <div className="absolute bottom-8 left-0 w-full z-40 flex justify-center gap-3">
        {[0, 1, 2, 3, 4].map(i => (
          <button 
            key={i} 
            onClick={() => setSlide(i)}
            className={\`w-2 h-2 rounded-full transition-all duration-300 \${slide === i ? 'bg-[#A84E32] w-6' : 'bg-[#1A1A1A]/20 hover:bg-[#1A1A1A]/40'}\`}
            aria-label={\`Go to slide \${i + 1}\`}
          />
        ))}
      </div>
      
      {/* ARROWS */}
      <div className="absolute bottom-6 right-8 z-40 flex gap-2">
        <button 
          onClick={() => setSlide(s => Math.max(0, s - 1))}
          className={\`w-10 h-10 flex items-center justify-center border transition-colors \${slide === 0 ? 'border-[#E2DFD8] text-[#E2DFD8] cursor-not-allowed' : 'border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F8F6]'}\`}
          disabled={slide === 0}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setSlide(s => Math.min(4, s + 1))}
          className={\`w-10 h-10 flex items-center justify-center border transition-colors \${slide === 4 ? 'border-[#E2DFD8] text-[#E2DFD8] cursor-not-allowed' : 'border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F8F6]'}\`}
          disabled={slide === 4}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
