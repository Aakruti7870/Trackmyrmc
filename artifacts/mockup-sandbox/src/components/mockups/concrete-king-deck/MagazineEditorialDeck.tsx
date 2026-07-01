import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowRight, MapPin, Play, Clock, ShieldCheck, 
  AlertTriangle, Activity, BarChart, Globe, 
  TrendingUp, Truck, Lock, User, Smartphone,
  ChevronLeft, ChevronRight
} from "lucide-react";

const E = {
  bg: "#F2EFE9",
  ink: "#181818",
  inkLight: "#3D3D3D",
  accent: "#B04E31", 
  border: "#DEDAD1",
  panel: "#FFFFFF",
  muted: "#85837A"
};

const openLogin = () => {
  if (typeof window !== "undefined") {
    window.open("/login", "_blank", "noopener,noreferrer");
  }
};

/* ── CUSTOM STYLES & FONTS ── */
const MagazineStyles = () => (
  <style dangerouslySetInnerHTML={{__html: `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500;1,600&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

    .font-serif { font-family: 'Playfair Display', serif; }
    .font-sans { font-family: 'Inter', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }

    .editorial-bg { background-color: ${E.bg}; color: ${E.ink}; }
    
    .text-balance { text-wrap: balance; }
    
    .slide-enter { animation: slideIn 0.8s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
    .slide-exit { animation: slideOut 0.8s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
    
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-20px); }
    }

    .stagger-1 { animation-delay: 0.1s; }
    .stagger-2 { animation-delay: 0.15s; }
    .stagger-3 { animation-delay: 0.2s; }
    .stagger-4 { animation-delay: 0.25s; }

    .noise-overlay {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 50;
      opacity: 0.035;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    }

    /* Magazine specifics */
    .drop-cap::first-letter {
      font-family: 'Playfair Display', serif;
      font-size: 3.5em;
      font-weight: 600;
      float: left;
      line-height: 0.8;
      padding-top: 0.15em;
      padding-right: 0.1em;
      color: ${E.accent};
    }
    
    .column-rule {
      position: relative;
    }
    .column-rule::after {
      content: '';
      position: absolute;
      right: -1.5rem;
      top: 0;
      bottom: 0;
      width: 1px;
      background-color: ${E.border};
    }
    @media (max-width: 1024px) {
      .column-rule::after { display: none; }
    }
  `}} />
);

/* ── CANVAS ANIMATIONS ── */
// Make them quieter
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
      t.current += 0.003; const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      
      const dx = W * 0.75; const dy = H * 0.5;
      const rX = W * 0.2; const rY = H * 0.45;
      
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(t.current * 0.1);
      
      ctx.strokeStyle = "rgba(24, 24, 24, 0.03)";
      ctx.lineWidth = 0.5;
      
      for(let i=0; i<12; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, rX * (i/12), rY, 0, 0, Math.PI * 2);
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
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-50" />;
}

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
      { x: 0, speed: 0.8, y: 0.3, width: 40 },
      { x: 300, speed: 0.5, y: 0.5, width: 60 },
      { x: 600, speed: 1.0, y: 0.7, width: 35 },
    ];
    
    const draw = () => {
      t.current += 0.005; const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      
      ctx.strokeStyle = "rgba(24, 24, 24, 0.02)";
      ctx.lineWidth = 0.5;
      for (let i=0; i<15; i++) {
        ctx.beginPath();
        for (let x=0; x<W; x+=50) {
          const y = H * (i/15) + Math.sin(x*0.003 + t.current) * 15;
          x===0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      
      ctx.fillStyle = E.ink;
      trucks.forEach(tr => {
        tr.x = (tr.x + tr.speed) % (W + 200);
        const actualX = tr.x - 100;
        const actualY = H * tr.y;
        
        ctx.globalAlpha = 0.06;
        ctx.fillRect(actualX, actualY, tr.width, 1);
        ctx.globalAlpha = 0.8;
        ctx.fillRect(actualX + tr.width - 6, actualY - 0.5, 6, 2);
      });
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-60" />;
}

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
      t.current += 0.003; const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      
      const drawBlob = (x:number, y:number, r:number, offset:number, color:string) => {
        ctx.beginPath();
        for (let a=0; a<Math.PI*2; a+=0.1) {
          const rad = r + Math.sin(a*3 + t.current + offset) * (r*0.05) + Math.cos(a*2 - t.current) * (r*0.05);
          const px = x + Math.cos(a) * rad;
          const py = y + Math.sin(a) * rad;
          a===0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      };
      
      drawBlob(W*0.6, H*0.6, H*0.35, 0, "rgba(222, 218, 209, 0.3)");
      drawBlob(W*0.65, H*0.65, H*0.25, 2, "rgba(24, 24, 24, 0.02)");
      drawBlob(W*0.55, H*0.7, H*0.15, 4, "rgba(176, 78, 49, 0.03)");
      
      ctx.strokeStyle = "rgba(24, 24, 24, 0.04)";
      ctx.lineWidth = 0.5;
      for (let i=0; i<8; i++) {
        const lx = W*0.3 + i*30;
        const ly = (t.current * 30 + i * 150) % H;
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.beginPath(); ctx.arc(lx, ly, 1.5, 0, Math.PI*2); ctx.fillStyle="rgba(24,24,24,0.06)"; ctx.fill();
      }
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-70" />;
}

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
      t.current += 0.003; const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      
      ctx.strokeStyle = "rgba(24, 24, 24, 0.03)";
      ctx.lineWidth = 0.5;
      
      for (let x=0; x<W; x+=80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y=0; y<H; y+=80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      
      ctx.fillStyle = "rgba(24, 24, 24, 0.02)";
      for (let i=0; i<15; i++) {
        const h = Math.abs(Math.sin(i*0.4 + t.current)) * 80 + 10;
        ctx.fillRect(W*0.65 + i*15, H*0.8 - h, 6, h);
      }
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-50" />;
}

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
      vx: (Math.random()-0.5)*0.0005, vy: (Math.random()-0.5)*0.0005
    }));
    
    const draw = () => {
      t.current += 0.01; const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      
      nodes.forEach(n => { n.x = (n.x + n.vx + 1) % 1; n.y = (n.y + n.vy + 1) % 1; });
      
      ctx.lineWidth = 0.5;
      nodes.forEach((n1, i) => {
        nodes.forEach((n2, j) => {
          if (j <= i) return;
          const dx = (n1.x - n2.x)*W, dy = (n1.y - n2.y)*H;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 180) {
            ctx.beginPath(); ctx.moveTo(n1.x*W, n1.y*H); ctx.lineTo(n2.x*W, n2.y*H);
            ctx.strokeStyle = `rgba(24, 24, 24, ${0.03 * (1 - dist/180)})`;
            ctx.stroke();
          }
        });
      });
      
      ctx.fillStyle = "rgba(24, 24, 24, 0.06)";
      nodes.forEach(n => {
        ctx.beginPath(); ctx.arc(n.x*W, n.y*H, 1, 0, Math.PI*2); ctx.fill();
      });
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-60" />;
}


/* ── COMPONENT ── */
export default function MagazineEditorialDeck() {
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
    <div className="relative w-full h-[100dvh] overflow-hidden editorial-bg font-sans flex flex-col selection:bg-[#B04E31] selection:text-white">
      <MagazineStyles />
      <div className="noise-overlay" />

      {/* TOP NAVBAR: Masthead Style */}
      <nav className="absolute top-0 left-0 w-full z-40 px-8 py-5 flex justify-between items-center border-b border-[#DEDAD1] bg-[#F2EFE9]/95 backdrop-blur-sm">
        <div className="flex flex-col">
          <span className="font-serif font-bold text-2xl tracking-tight text-[#181818] uppercase leading-none">Concrete King</span>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[9px] font-mono tracking-widest text-[#85837A]">ISSUE 01</span>
            <span className="w-1 h-1 rounded-full bg-[#B04E31]"></span>
            <span className="text-[9px] font-mono tracking-widest text-[#85837A]">RMC OPERATIONS OS</span>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-10 text-[10px] font-mono tracking-widest text-[#85837A]">
          {["Home", "GPS", "Freshness", "Command", "Login"].map((item, i) => (
            <button key={item} onClick={() => setSlide(i)} className={`uppercase hover:text-[#181818] transition-all ${slide === i ? 'text-[#181818] font-medium border-b border-[#181818] pb-1' : ''}`}>
              {item}
            </button>
          ))}
        </div>
        
        <button onClick={openLogin} className="border border-[#181818] text-[#181818] px-6 py-2.5 text-[10px] font-mono tracking-widest uppercase hover:bg-[#181818] hover:text-[#F2EFE9] transition-colors duration-300">
          Login
        </button>
      </nav>

      {/* BOTTOM FOLIO */}
      <div className="absolute bottom-0 left-0 w-full px-8 py-5 z-40 flex justify-between items-center border-t border-[#DEDAD1]/50 pointer-events-none">
        <span className="text-[10px] font-mono tracking-widest text-[#85837A]">CONCRETE KING QUARTERLY</span>
        <span className="text-[10px] font-mono tracking-widest text-[#181818]">PG. {slide.toString().padStart(2, '0')}</span>
      </div>

      {/* SLIDES CONTAINER */}
      <div className="flex-1 relative w-full h-full pt-[88px] pb-[60px]">
        
        {/* SLIDE 0: HOME */}
        {slide === 0 && (
          <div className="absolute inset-0 pt-[88px] pb-[60px] w-full h-full overflow-hidden slide-enter">
            <BgDrum />
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-8 md:px-24 max-w-[1400px] mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 h-full items-center py-12">
                
                <div className="lg:col-span-7 flex flex-col justify-center column-rule h-full">
                  <div className="inline-flex items-center gap-3 mb-10 stagger-1">
                    <span className="w-12 h-[1px] bg-[#B04E31]"></span>
                    <span className="text-[#B04E31] font-mono text-[10px] tracking-[0.25em] uppercase">Ready Mix Concrete · Operations OS</span>
                  </div>
                  
                  <h1 className="text-6xl md:text-8xl lg:text-[100px] font-serif text-[#181818] leading-[0.95] tracking-tight mb-10 stagger-2">
                    Control your<br />
                    <span className="text-[#B04E31] italic">{words[rotIndex]}</span>
                  </h1>
                  
                  <div className="w-full max-w-xl stagger-3 mb-12">
                    <p className="text-[#3D3D3D] text-[17px] font-sans font-light leading-[1.7] text-balance drop-cap">
                      The only platform built ground-up for RMC plants. Connect your batching plant, transit mixers, and site engineers on one screen. Eliminate guesswork and secure every pour.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-6 stagger-4">
                    <button onClick={openLogin} className="bg-[#181818] text-[#F2EFE9] px-10 py-4 text-xs font-mono tracking-widest uppercase hover:bg-[#3D3D3D] transition-colors flex items-center gap-3">
                      Get Started <ArrowRight className="w-3 h-3" />
                    </button>
                    <button className="bg-transparent text-[#181818] px-6 py-4 text-xs font-mono tracking-widest uppercase hover:text-[#B04E31] transition-colors flex items-center gap-3 border-b border-transparent hover:border-[#B04E31]">
                      <Play className="w-3 h-3" /> Watch Demo
                    </button>
                  </div>
                </div>
                
                <div className="lg:col-span-5 flex flex-col justify-center stagger-4 h-full">
                  <div className="bg-[#FFFFFF] border border-[#DEDAD1] p-10 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between border-b border-[#DEDAD1] pb-6 mb-8">
                      <h3 className="font-mono text-[11px] tracking-[0.2em] text-[#181818] uppercase">Live Performance</h3>
                      <span className="w-2 h-2 rounded-full bg-[#B04E31] animate-pulse"></span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-12 gap-x-8">
                      <div>
                        <div className="flex items-center gap-2 text-[#85837A] mb-2 border-b border-[#DEDAD1]/50 pb-2">
                          <Activity className="w-3.5 h-3.5 text-[#B04E31]" />
                          <span className="text-[10px] font-mono uppercase tracking-widest">Live Pours</span>
                        </div>
                        <div className="text-4xl font-serif text-[#181818] mb-1">4</div>
                        <div className="text-[11px] font-sans text-[#85837A]">3 plants active</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-[#85837A] mb-2 border-b border-[#DEDAD1]/50 pb-2">
                          <BarChart className="w-3.5 h-3.5 text-[#B04E31]" />
                          <span className="text-[10px] font-mono uppercase tracking-widest">Today's Output</span>
                        </div>
                        <div className="text-4xl font-serif text-[#181818] mb-1">143 <span className="text-2xl text-[#85837A] font-light">m³</span></div>
                        <div className="text-[11px] font-sans text-[#B04E31]">+18% vs avg</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-[#85837A] mb-2 border-b border-[#DEDAD1]/50 pb-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#B04E31]" />
                          <span className="text-[10px] font-mono uppercase tracking-widest">On-Time Rate</span>
                        </div>
                        <div className="text-4xl font-serif text-[#181818] mb-1">96.4%</div>
                        <div className="text-[11px] font-sans text-[#85837A]">Last 7 days</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-[#85837A] mb-2 border-b border-[#DEDAD1]/50 pb-2">
                          <Truck className="w-3.5 h-3.5 text-[#B04E31]" />
                          <span className="text-[10px] font-mono uppercase tracking-widest">Fleet Online</span>
                        </div>
                        <div className="text-4xl font-serif text-[#181818] mb-1">12</div>
                        <div className="text-[11px] font-sans text-[#85837A]">2 in maintenance</div>
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
          <div className="absolute inset-0 pt-[88px] pb-[60px] w-full h-full overflow-hidden slide-enter">
            <BgHighway />
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-8 md:px-24 max-w-[1400px] mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 h-full items-center py-12">
                <div className="lg:col-span-5 flex flex-col justify-center order-2 lg:order-1 stagger-3 h-full">
                  <div className="bg-[#FFFFFF] border border-[#DEDAD1] shadow-sm flex flex-col h-full max-h-[500px]">
                    <div className="p-8 border-b border-[#DEDAD1] flex justify-between items-center bg-[#F2EFE9]/50">
                      <div className="font-mono text-[11px] tracking-[0.2em] text-[#181818] uppercase flex items-center gap-3">
                        <span className="w-2 h-2 bg-[#B04E31] rounded-full animate-pulse"></span>
                        Fleet Status
                      </div>
                      <div className="text-[10px] font-mono tracking-widest text-[#85837A] uppercase border border-[#DEDAD1] px-2 py-1">Live</div>
                    </div>
                    <div className="p-0 flex-1 overflow-auto">
                      {[
                        { id: "MH 46 DC 0814", stat: "Moving 38 km/h", c: "text-[#B04E31]" },
                        { id: "MH 48 T 5967", stat: "Moving 42 km/h", c: "text-[#B04E31]" },
                        { id: "MH 46 BB 9003", stat: "Arrived Site", c: "text-[#181818]" },
                        { id: "MH 46 DC 0813", stat: "Idle Plant", c: "text-[#85837A]" }
                      ].map((t, i) => (
                        <div key={i} className="flex justify-between items-center px-8 py-6 border-b border-[#DEDAD1] last:border-0 hover:bg-[#F2EFE9]/50 transition-colors">
                          <div className="flex items-center gap-5">
                            <div className="w-10 h-10 border border-[#DEDAD1] flex items-center justify-center bg-[#FFFFFF]">
                              <Truck className="w-4 h-4 text-[#181818]" strokeWidth={1.5} />
                            </div>
                            <span className="font-mono text-sm text-[#181818] tracking-wide">{t.id}</span>
                          </div>
                          <span className={`font-mono text-[10px] uppercase tracking-widest ${t.c}`}>{t.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="lg:col-span-7 flex flex-col justify-center order-1 lg:order-2 column-rule h-full lg:pl-12">
                  <div className="inline-flex items-center gap-3 mb-10 stagger-1">
                    <span className="w-12 h-[1px] bg-[#B04E31]"></span>
                    <span className="text-[#B04E31] font-mono text-[10px] tracking-[0.25em] uppercase">Live GPS Tracking</span>
                  </div>
                  <h2 className="text-6xl md:text-8xl font-serif text-[#181818] leading-[0.95] tracking-tight mb-10 stagger-2">
                    Every mixer.<br />
                    <span className="italic text-[#85837A]">Always visible.</span>
                  </h2>
                  
                  {/* Pull quote treatment */}
                  <div className="border-l-2 border-[#B04E31] pl-8 py-2 mb-8 stagger-3">
                    <p className="text-[#3D3D3D] text-[20px] font-serif italic leading-relaxed">
                      "Stop calling drivers. See exactly where your concrete is, predict site arrivals, and auto-detect when pouring starts."
                    </p>
                  </div>
                  
                  <p className="text-[#85837A] text-[15px] font-sans font-light leading-[1.7] max-w-lg stagger-4">
                    Geo-fencing automatically logs plant departures and site arrivals, giving dispatchers pinpoint accuracy without constant phone calls.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 2: FRESHNESS */}
        {slide === 2 && (
          <div className="absolute inset-0 pt-[88px] pb-[60px] w-full h-full overflow-hidden slide-enter">
            <BgPour />
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-8 md:px-24 max-w-[1400px] mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 h-full items-center py-12">
                <div className="lg:col-span-6 flex flex-col justify-center column-rule h-full">
                  <div className="inline-flex items-center gap-3 mb-10 stagger-1">
                    <span className="w-12 h-[1px] bg-[#B04E31]"></span>
                    <span className="text-[#B04E31] font-mono text-[10px] tracking-[0.25em] uppercase">Freshness Guard</span>
                  </div>
                  <h2 className="text-6xl md:text-8xl font-serif text-[#181818] leading-[0.95] tracking-tight mb-10 stagger-2">
                    Never lose<br />
                    <span className="italic text-[#B04E31]">a pour again.</span>
                  </h2>
                  <p className="text-[#3D3D3D] text-[17px] font-sans font-light leading-[1.7] max-w-xl mb-12 stagger-3 text-balance">
                    Concrete dies in <strong className="font-medium text-[#181818]">90 minutes</strong>. Our IS 4926 compliant countdown tracks exactly how much time is left before slump loss, alerting you before loads are rejected.
                  </p>
                  
                  <div className="flex items-center gap-8 font-mono text-[10px] uppercase tracking-widest text-[#85837A] stagger-4 border-t border-[#DEDAD1] pt-6 w-max">
                    <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-sm bg-[#181818]"></div>Safe</div>
                    <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-sm bg-[#B04E31]/60"></div>Caution</div>
                    <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-sm bg-[#B04E31] flex items-center justify-center"></div>Critical</div>
                  </div>
                </div>
                
                <div className="lg:col-span-6 flex flex-col justify-center stagger-3 h-full">
                  <div className="space-y-4">
                    {[
                      { id: "TM-0814", mix: "M25", site: "P.G. Constructions", val: 74, status: "safe" },
                      { id: "TM-5967", mix: "M20", site: "Ananth Corporation", val: 46, status: "caution" },
                      { id: "TM-9003", mix: "M30", site: "DS Infrastructure", val: 12, status: "critical", msg: "SLUMP RISK" },
                      { id: "TM-0813", mix: "M10", site: "Hiravati Agro", val: 62, status: "safe" }
                    ].map((row, i) => (
                      <div key={i} className={`bg-[#FFFFFF] border ${row.status === 'critical' ? 'border-[#B04E31] shadow-[0_0_15px_rgba(176,78,49,0.1)]' : 'border-[#DEDAD1]'} p-6 flex flex-col gap-5 transition-all`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-mono text-sm text-[#181818] mb-1.5 tracking-wide">
                              {row.id} <span className="text-[#DEDAD1] font-light mx-2">/</span> <span className="text-[#85837A]">{row.mix}</span>
                            </div>
                            <div className="text-[13px] font-serif italic text-[#3D3D3D]">{row.site}</div>
                          </div>
                          <div className={`font-mono text-2xl ${row.status === 'critical' ? 'text-[#B04E31]' : 'text-[#181818]'}`}>
                            {row.val}%
                          </div>
                        </div>
                        <div className="h-[2px] w-full bg-[#F2EFE9] relative overflow-hidden">
                          <div className={`absolute top-0 left-0 h-full ${row.status === 'critical' ? 'bg-[#B04E31]' : row.status === 'caution' ? 'bg-[#B04E31]/60' : 'bg-[#181818]'}`} style={{width: `${row.val}%`}}></div>
                        </div>
                        {row.msg && <div className="text-[9px] font-mono tracking-[0.2em] text-[#B04E31] uppercase mt-1">{row.msg}</div>}
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
          <div className="absolute inset-0 pt-[88px] pb-[60px] w-full h-full overflow-hidden slide-enter">
            <BgCommand />
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-8 md:px-24 max-w-[1400px] mx-auto py-12">
              <div className="text-center max-w-4xl mx-auto mb-20">
                <div className="inline-flex items-center gap-3 mb-8 stagger-1">
                  <span className="w-12 h-[1px] bg-[#B04E31]"></span>
                  <span className="text-[#B04E31] font-mono text-[10px] tracking-[0.25em] uppercase">Command Center</span>
                  <span className="w-12 h-[1px] bg-[#B04E31]"></span>
                </div>
                <h2 className="text-6xl md:text-8xl font-serif text-[#181818] leading-[0.95] tracking-tight mb-8 stagger-2">
                  One screen.<br />
                  <span className="italic text-[#85837A]">Total plant intelligence.</span>
                </h2>
                <p className="text-[#3D3D3D] text-[17px] font-sans font-light leading-[1.7] max-w-2xl mx-auto stagger-3">
                  Replace WhatsApp groups and Excel sheets. A unified operations dashboard that gives you complete command over production, logistics, and quality.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-0 border-t border-l border-[#DEDAD1] stagger-4 bg-[#F2EFE9]">
                {[
                  { title: "GPS Tracking", desc: "Live, always", icon: MapPin },
                  { title: "Freshness Guard", desc: "IS-code compliant", icon: Clock },
                  { title: "Smart Plant AI", desc: "Voice & text", icon: Globe },
                  { title: "Demand Forecast", desc: "Hourly insights", icon: TrendingUp },
                  { title: "Fleet Control", desc: "Every mixer", icon: Truck }
                ].map((f, i) => (
                  <div key={i} className="border-r border-b border-[#DEDAD1] bg-[#FFFFFF] p-10 flex flex-col items-center text-center hover:bg-[#F2EFE9]/50 transition-colors group cursor-default">
                    <f.icon className="w-8 h-8 text-[#B04E31] mb-6 group-hover:scale-110 transition-transform duration-500 ease-out" strokeWidth={1} />
                    <h4 className="font-serif font-medium text-[#181818] text-xl mb-3">{f.title}</h4>
                    <p className="font-mono text-[10px] tracking-widest uppercase text-[#85837A]">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 4: LOGIN */}
        {slide === 4 && (
          <div className="absolute inset-0 pt-[88px] pb-[60px] w-full h-full overflow-hidden slide-enter">
            <BgLogin />
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-8 md:px-24 max-w-[1400px] mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 h-full items-center py-12">
                <div className="lg:col-span-6 flex flex-col stagger-1 column-rule h-full justify-center">
                  <div className="inline-flex items-center gap-3 mb-10">
                    <span className="w-12 h-[1px] bg-[#B04E31]"></span>
                    <span className="text-[#B04E31] font-mono text-[10px] tracking-[0.25em] uppercase">Secure Platform</span>
                  </div>
                  <h2 className="text-6xl md:text-8xl font-serif text-[#181818] leading-[0.95] tracking-tight mb-10">
                    Secure access for<br />
                    <span className="italic text-[#85837A]">every plant role.</span>
                  </h2>
                  <p className="text-[#3D3D3D] text-[17px] font-sans font-light leading-[1.7] mb-16 max-w-md">
                    Enterprise-grade security with role-based access control. Plant data is siloed and encrypted.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-px bg-[#DEDAD1] border border-[#DEDAD1] max-w-md">
                    {[
                      { role: "Owner", icon: ShieldCheck },
                      { role: "Admin", icon: User },
                      { role: "Operator", icon: Activity },
                      { role: "Driver", icon: Smartphone }
                    ].map((r, i) => (
                      <div key={i} className="flex items-center gap-4 p-5 bg-[#FFFFFF] hover:bg-[#F2EFE9]/30 transition-colors">
                        <r.icon className="w-4 h-4 text-[#B04E31]" strokeWidth={1.5} />
                        <span className="font-mono text-[11px] uppercase tracking-widest text-[#181818]">{r.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="lg:col-span-6 stagger-3 flex justify-center lg:justify-end">
                  <div className="w-full max-w-md bg-[#FFFFFF] border border-[#DEDAD1] p-10 sm:p-12 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] relative">
                    {/* Corner decorative marks */}
                    <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#181818]"></div>
                    <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[#181818]"></div>
                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[#181818]"></div>
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-[#181818]"></div>
                    
                    <div className="mb-12 text-center">
                      <h3 className="font-serif text-3xl text-[#181818] mb-4">Concrete King</h3>
                      <p className="font-mono text-[10px] tracking-widest uppercase text-[#85837A]">Sign in to operations</p>
                    </div>

                    {!otpStep ? (
                      <div className="space-y-6">
                        <button onClick={openLogin} className="w-full border border-[#DEDAD1] text-[#181818] font-mono text-[11px] uppercase tracking-widest py-4 flex items-center justify-center gap-3 hover:bg-[#F2EFE9] hover:border-[#181818] transition-all">
                          <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                          Continue with Google
                        </button>
                        
                        <div className="flex items-center gap-4 py-2">
                          <div className="flex-1 h-[1px] bg-[#DEDAD1]"></div>
                          <span className="font-mono text-[9px] text-[#85837A] uppercase tracking-[0.2em]">Or Phone</span>
                          <div className="flex-1 h-[1px] bg-[#DEDAD1]"></div>
                        </div>
                        
                        <div className="flex gap-0 border border-[#DEDAD1] focus-within:border-[#181818] transition-colors">
                          <div className="w-16 bg-[#F2EFE9] border-r border-[#DEDAD1] flex items-center justify-center font-mono text-[13px] text-[#181818]">+91</div>
                          <input type="text" placeholder="Enter mobile number" className="flex-1 bg-[#FFFFFF] px-5 py-4 font-mono text-[13px] focus:outline-none transition-colors placeholder-[#85837A]" />
                        </div>
                        
                        <button onClick={() => setOtpStep(true)} className="w-full bg-[#181818] text-[#F2EFE9] font-mono text-[11px] uppercase tracking-widest py-4 flex items-center justify-center gap-3 hover:bg-[#B04E31] transition-colors mt-4">
                          Send OTP via WhatsApp <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="text-center">
                          <div className="text-[13px] font-sans text-[#3D3D3D] mb-2">Code sent to your WhatsApp</div>
                          <div className="text-[11px] font-mono tracking-widest text-[#B04E31]">+91 ••••• •••••</div>
                        </div>
                        
                        <div className="flex justify-between gap-3">
                          {[1,2,3,4,5,6].map(i => (
                            <input key={i} type="text" maxLength={1} className="w-full aspect-square border border-[#DEDAD1] bg-[#F2EFE9]/30 text-center font-serif text-2xl focus:outline-none focus:border-[#181818] focus:bg-[#FFFFFF] transition-all" />
                          ))}
                        </div>
                        
                        <div className="flex gap-4 pt-4">
                          <button onClick={() => setOtpStep(false)} className="px-6 border border-[#DEDAD1] text-[#181818] font-mono text-[10px] uppercase tracking-widest hover:bg-[#F2EFE9] transition-colors">
                            Back
                          </button>
                          <button onClick={openLogin} className="flex-1 bg-[#181818] text-[#F2EFE9] font-mono text-[10px] uppercase tracking-widest py-4 flex items-center justify-center gap-3 hover:bg-[#B04E31] transition-colors">
                            Verify & Enter <ArrowRight className="w-3 h-3" />
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

      {/* BOTTOM PAGINATION DOTS (re-styled as thick ticks) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 pointer-events-none">
        {[0, 1, 2, 3, 4].map(i => (
          <button 
            key={i} 
            onClick={() => setSlide(i)}
            className={`h-1 transition-all duration-500 pointer-events-auto ${slide === i ? 'bg-[#181818] w-8' : 'bg-[#DEDAD1] w-3 hover:bg-[#85837A]'}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
      
      {/* ARROWS */}
      <div className="absolute bottom-0 right-0 z-50 flex border-t border-l border-[#DEDAD1]">
        <button 
          onClick={() => setSlide(s => Math.max(0, s - 1))}
          className={`w-16 h-[60px] flex items-center justify-center border-r border-[#DEDAD1] transition-colors ${slide === 0 ? 'text-[#DEDAD1] cursor-not-allowed bg-[#F2EFE9]' : 'text-[#181818] hover:bg-[#181818] hover:text-[#F2EFE9] bg-[#FFFFFF]'}`}
          disabled={slide === 0}
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <button 
          onClick={() => setSlide(s => Math.min(4, s + 1))}
          className={`w-16 h-[60px] flex items-center justify-center transition-colors ${slide === 4 ? 'text-[#DEDAD1] cursor-not-allowed bg-[#F2EFE9]' : 'text-[#181818] hover:bg-[#181818] hover:text-[#F2EFE9] bg-[#FFFFFF]'}`}
          disabled={slide === 4}
        >
          <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
