import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowRight, 
  MapPin, 
  Play, 
  Clock, 
  ShieldCheck, 
  Activity, 
  BarChart, 
  Globe, 
  TrendingUp, 
  Truck, 
  User, 
  Smartphone,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

/* ════════════════════════════════════════════════════════
   CONCRETE KING – RMC OPERATIONS OS
   Variant: GALLERY (Quiet-luxury refinement)
   Museum-grade restraint, precision grid, tabular numerals
════════════════════════════════════════════════════════ */

const E = {
  bg: "#F9F8F6",
  ink: "#1A1A1A",
  inkLight: "#333333",
  accent: "#A84E32", // Terracotta/rust
  border: "#EAE7E1", // Softer border for gallery feel
  panel: "#FFFFFF",
  muted: "#8C8982"
};

const openLogin = () => {
  if (typeof window !== "undefined") {
    window.open("/login", "_blank", "noopener,noreferrer");
  }
};

/* ── CUSTOM STYLES & FONTS ── */
const GalleryStyles = () => (
  <style dangerouslySetInnerHTML={{__html: `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

    .font-serif { font-family: 'Playfair Display', serif; }
    .font-sans { font-family: 'Inter', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }

    .gallery-bg { background-color: ${E.bg}; color: ${E.ink}; }
    
    .text-balance { text-wrap: balance; }
    .tabular-nums { font-variant-numeric: tabular-nums; }
    
    .slide-enter { animation: slideIn 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
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
      opacity: 0.025;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    }

    /* Hairline borders for gallery precision */
    .hairline-b { border-bottom: 1px solid ${E.border}; }
    .hairline-t { border-top: 1px solid ${E.border}; }
    .hairline-r { border-right: 1px solid ${E.border}; }
    .hairline-l { border-left: 1px solid ${E.border}; }
    .hairline-all { border: 1px solid ${E.border}; }
  `}} />
);

/* ── CANVAS 1: EDITORIAL DRUM (CALMER) ── */
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
      t.current += 0.002; const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      
      const dx = W * 0.75; const dy = H * 0.5;
      const rX = W * 0.22; const rY = H * 0.6;
      
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(t.current * 0.1);
      
      // Wireframe elegant drum - thinner, lighter
      ctx.strokeStyle = "rgba(26, 26, 26, 0.03)";
      ctx.lineWidth = 0.5;
      
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
      
      // Fine grid lines - museum gallery grid
      ctx.strokeStyle = "rgba(26, 26, 26, 0.02)";
      ctx.lineWidth = 0.5;
      for(let x=0; x<W; x+=80) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for(let y=0; y<H; y+=80) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" />;
}

/* ── CANVAS 2: HIGHWAY TRUCKS (CALMER) ── */
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
      { x: 0, speed: 0.5, y: 0.3, width: 40 },
      { x: 300, speed: 0.3, y: 0.5, width: 60 },
      { x: 600, speed: 0.7, y: 0.7, width: 35 },
      { x: 100, speed: 0.4, y: 0.85, width: 50 },
    ];
    
    const draw = () => {
      t.current += 0.005; const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      
      // Topographic lines - fainter, slower
      ctx.strokeStyle = "rgba(26, 26, 26, 0.02)";
      ctx.lineWidth = 0.5;
      for (let i=0; i<20; i++) {
        ctx.beginPath();
        for (let x=0; x<W; x+=50) {
          const y = H * (i/20) + Math.sin(x*0.003 + t.current) * 15;
          x===0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      
      // Abstract trucks
      ctx.fillStyle = E.ink;
      trucks.forEach(tr => {
        tr.x = (tr.x + tr.speed) % (W + 200);
        const actualX = tr.x - 100;
        const actualY = H * tr.y;
        
        ctx.globalAlpha = 0.05;
        ctx.fillRect(actualX, actualY, tr.width, 1);
        ctx.globalAlpha = 0.8;
        ctx.fillRect(actualX + tr.width - 6, actualY - 0.5, 6, 2);
      });
      ctx.globalAlpha = 1.0;
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-50 pointer-events-none" />;
}

/* ── CANVAS 3: POUR (CALMER) ── */
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
      t.current += 0.002; const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      
      // Organic elegant blobs - more transparent, slower
      const drawBlob = (x:number, y:number, r:number, offset:number, color:string) => {
        ctx.beginPath();
        for (let a=0; a<Math.PI*2; a+=0.1) {
          const rad = r + Math.sin(a*3 + t.current + offset) * (r*0.08) + Math.cos(a*2 - t.current) * (r*0.08);
          const px = x + Math.cos(a) * rad;
          const py = y + Math.sin(a) * rad;
          a===0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      };
      
      drawBlob(W*0.65, H*0.6, H*0.35, 0, "rgba(234, 231, 225, 0.3)");
      drawBlob(W*0.7, H*0.65, H*0.25, 2, "rgba(26, 26, 26, 0.02)");
      drawBlob(W*0.6, H*0.7, H*0.15, 4, "rgba(168, 78, 50, 0.03)");
      
      // Vertical dripping lines (like ink)
      ctx.strokeStyle = "rgba(26, 26, 26, 0.03)";
      ctx.lineWidth = 0.5;
      for (let i=0; i<10; i++) {
        const lx = W*0.45 + i*30;
        const ly = (t.current * 30 + i * 150) % H;
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.beginPath(); ctx.arc(lx, ly, 1.5, 0, Math.PI*2); ctx.fillStyle="rgba(26,26,26,0.05)"; ctx.fill();
      }
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" />;
}

/* ── CANVAS 4: COMMAND DATA (CALMER) ── */
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
      t.current += 0.002; const W = cv.width, H = cv.height;
      ctx.clearRect(0, 0, W, H);
      
      ctx.strokeStyle = "rgba(26, 26, 26, 0.02)";
      ctx.lineWidth = 0.5;
      
      // Architectural drafting lines
      for (let x=0; x<W; x+=80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y=0; y<H; y+=80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      
      ctx.strokeStyle = "rgba(168, 78, 50, 0.05)";
      ctx.beginPath(); ctx.moveTo(W*0.25, 0); ctx.lineTo(W*0.25, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, H*0.35); ctx.lineTo(W, H*0.35); ctx.stroke();
      
      // Abstract data bars
      ctx.fillStyle = "rgba(26, 26, 26, 0.02)";
      for (let i=0; i<16; i++) {
        const h = Math.abs(Math.sin(i*0.4 + t.current)) * 80 + 10;
        ctx.fillRect(W*0.65 + i*20, H*0.8 - h, 8, h);
      }
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-50 pointer-events-none" />;
}

/* ── CANVAS 5: LOGIN (CALMER) ── */
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
      t.current += 0.005; const W = cv.width, H = cv.height;
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
            ctx.strokeStyle = `rgba(26, 26, 26, ${0.03 * (1 - dist/180)})`;
            ctx.stroke();
          }
        });
      });
      
      ctx.fillStyle = "rgba(26, 26, 26, 0.05)";
      nodes.forEach(n => {
        ctx.beginPath(); ctx.arc(n.x*W, n.y*H, 1, 0, Math.PI*2); ctx.fill();
      });
      
      ani.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani.current); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full opacity-60 pointer-events-none" />;
}

/* ── COMPONENT ── */
export default function GalleryEditorialDeck() {
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
    <div className="relative w-full h-[100dvh] overflow-hidden gallery-bg font-sans flex flex-col selection:bg-[#A84E32] selection:text-white">
      <GalleryStyles />
      <div className="noise-overlay" />

      {/* TOP NAVBAR - Museum Grade Precision */}
      <nav className="absolute top-0 left-0 w-full z-40 px-10 py-8 flex justify-between items-center bg-[#F9F8F6]/80 backdrop-blur-md hairline-b">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-[#1A1A1A] flex items-center justify-center rounded-[2px]">
            <div className="w-2.5 h-2.5 bg-[#F9F8F6] rounded-full" />
          </div>
          <div className="flex flex-col">
            <span className="font-serif font-medium text-lg tracking-wide text-[#1A1A1A] uppercase leading-none">Concrete King</span>
            <span className="text-[9px] font-mono tracking-[0.3em] text-[#8C8982] mt-1.5 uppercase">RMC Operations OS</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-10 text-[10px] font-mono tracking-[0.2em] text-[#8C8982]">
          {["Home", "GPS", "Freshness", "Command", "Login"].map((item, i) => (
            <button 
              key={item} 
              onClick={() => setSlide(i)} 
              className={`uppercase hover:text-[#1A1A1A] transition-all duration-500 relative py-1
                ${slide === i ? 'text-[#1A1A1A]' : ''}
              `}
            >
              {item}
              <span className={`absolute bottom-0 left-0 h-[1px] bg-[#1A1A1A] transition-all duration-500 ${slide === i ? 'w-full' : 'w-0'}`} />
            </button>
          ))}
        </div>
        <button onClick={openLogin} className="hairline-all bg-transparent text-[#1A1A1A] px-6 py-2.5 text-[10px] font-mono tracking-[0.2em] uppercase hover:bg-[#1A1A1A] hover:text-[#F9F8F6] transition-colors duration-500">
          Login
        </button>
      </nav>

      {/* SLIDES CONTAINER */}
      <div className="flex-1 relative w-full h-full">
        
        {/* SLIDE 0: HOME */}
        {slide === 0 && (
          <div className="absolute inset-0 w-full h-full overflow-hidden slide-enter">
            <BgDrum />
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-10 md:px-24 max-w-7xl mx-auto pt-24">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">
                
                <div className="lg:col-span-7 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-4 mb-10 stagger-1">
                    <span className="w-12 h-[1px] bg-[#A84E32]"></span>
                    <span className="text-[#A84E32] font-mono text-[10px] tracking-[0.3em] uppercase">Ready Mix Concrete · Operations OS</span>
                  </div>
                  
                  <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-serif font-medium text-[#1A1A1A] leading-[1.05] tracking-tight mb-10 stagger-2">
                    Control your<br />
                    <span className="text-[#A84E32] italic font-light">{words[rotIndex]}</span>
                  </h1>
                  
                  <p className="text-[#333333] text-lg font-sans font-light leading-[1.8] max-w-xl mb-14 stagger-3 text-balance">
                    The only platform built ground-up for RMC plants. Connect your batching plant, transit mixers, and site engineers on one screen.
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-6 stagger-4">
                    <button onClick={openLogin} className="bg-[#1A1A1A] text-[#F9F8F6] px-10 py-4 text-sm font-sans font-medium hover:bg-[#333333] transition-colors duration-500 flex items-center gap-3">
                      Get Started <ArrowRight className="w-4 h-4" />
                    </button>
                    <button onClick={openLogin} className="bg-transparent hairline-all text-[#1A1A1A] px-10 py-4 text-sm font-sans font-medium hover:bg-[#F9F8F6] transition-colors duration-500 flex items-center gap-3">
                      <Play className="w-3 h-3 fill-current" /> Watch Demo
                    </button>
                  </div>
                </div>
                
                <div className="lg:col-span-5 flex flex-col justify-center stagger-4">
                  <div className="bg-[#FFFFFF] p-10 hairline-all shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                    <h3 className="font-mono text-[9px] tracking-[0.3em] text-[#8C8982] uppercase mb-8 hairline-b pb-4">Live Performance</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-10 gap-x-8">
                      <div>
                        <div className="flex items-center gap-2.5 text-[#333333] mb-2">
                          <Activity className="w-3.5 h-3.5 text-[#A84E32]" />
                          <span className="text-[10px] font-mono uppercase tracking-[0.15em]">Live Pours</span>
                        </div>
                        <div className="text-4xl font-serif text-[#1A1A1A] mb-1.5 tabular-nums">4</div>
                        <div className="text-[11px] font-sans font-medium text-[#8C8982]">3 plants active</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 text-[#333333] mb-2">
                          <BarChart className="w-3.5 h-3.5 text-[#A84E32]" />
                          <span className="text-[10px] font-mono uppercase tracking-[0.15em]">Today's Output</span>
                        </div>
                        <div className="text-4xl font-serif text-[#1A1A1A] mb-1.5 tabular-nums">143<span className="text-2xl text-[#8C8982] font-light ml-1">m³</span></div>
                        <div className="text-[11px] font-sans font-medium text-[#A84E32]">+18% vs avg</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 text-[#333333] mb-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#A84E32]" />
                          <span className="text-[10px] font-mono uppercase tracking-[0.15em]">On-Time Rate</span>
                        </div>
                        <div className="text-4xl font-serif text-[#1A1A1A] mb-1.5 tabular-nums">96.4<span className="text-2xl text-[#8C8982] font-light">%</span></div>
                        <div className="text-[11px] font-sans font-medium text-[#8C8982]">Last 7 days</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 text-[#333333] mb-2">
                          <Truck className="w-3.5 h-3.5 text-[#A84E32]" />
                          <span className="text-[10px] font-mono uppercase tracking-[0.15em]">Fleet Online</span>
                        </div>
                        <div className="text-4xl font-serif text-[#1A1A1A] mb-1.5 tabular-nums">12</div>
                        <div className="text-[11px] font-sans font-medium text-[#8C8982]">2 in maintenance</div>
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
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-10 md:px-24 max-w-7xl mx-auto pt-24">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-center">
                <div className="lg:col-span-5 flex flex-col justify-center order-2 lg:order-1 stagger-3">
                  <div className="bg-[#FFFFFF] hairline-all shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col h-full max-h-[520px]">
                    <div className="p-8 hairline-b flex justify-between items-center bg-[#F9F8F6]">
                      <div className="font-mono text-[9px] tracking-[0.3em] text-[#1A1A1A] uppercase flex items-center gap-3">
                        <span className="w-1.5 h-1.5 bg-[#A84E32] rounded-full animate-pulse"></span>
                        Fleet Status
                      </div>
                      <div className="text-[10px] font-mono tracking-widest text-[#8C8982] uppercase">Live</div>
                    </div>
                    <div className="p-0 flex-1 overflow-auto">
                      {[
                        { id: "MH 46 DC 0814", stat: "Moving 38 km/h", c: "text-[#A84E32]" },
                        { id: "MH 48 T 5967", stat: "Moving 42 km/h", c: "text-[#A84E32]" },
                        { id: "MH 46 BB 9003", stat: "Arrived Site", c: "text-[#1A1A1A]" },
                        { id: "MH 46 DC 0813", stat: "Idle Plant", c: "text-[#8C8982]" }
                      ].map((t, i) => (
                        <div key={i} className="flex justify-between items-center px-8 py-6 hairline-b last:border-0 hover:bg-[#F9F8F6] transition-colors duration-300">
                          <div className="flex items-center gap-5">
                            <div className="w-10 h-10 hairline-all rounded-full flex items-center justify-center bg-[#FFFFFF]">
                              <Truck className="w-3.5 h-3.5 text-[#1A1A1A]" />
                            </div>
                            <span className="font-mono text-[13px] tracking-wider text-[#1A1A1A] tabular-nums">{t.id}</span>
                          </div>
                          <span className={`font-mono text-[11px] uppercase tracking-wider tabular-nums ${t.c}`}>{t.stat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="lg:col-span-7 flex flex-col justify-center order-1 lg:order-2">
                  <div className="inline-flex items-center gap-4 mb-10 stagger-1">
                    <span className="w-12 h-[1px] bg-[#A84E32]"></span>
                    <span className="text-[#A84E32] font-mono text-[10px] tracking-[0.3em] uppercase">Live GPS Tracking</span>
                  </div>
                  <h2 className="text-5xl md:text-7xl font-serif font-medium text-[#1A1A1A] leading-[1.05] tracking-tight mb-10 stagger-2">
                    Every mixer.<br />
                    <span className="italic font-light">Always visible.</span>
                  </h2>
                  <p className="text-[#333333] text-lg font-sans font-light leading-[1.8] max-w-xl stagger-3">
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
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-10 md:px-24 max-w-7xl mx-auto pt-24">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-center">
                <div className="lg:col-span-6 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-4 mb-10 stagger-1">
                    <span className="w-12 h-[1px] bg-[#A84E32]"></span>
                    <span className="text-[#A84E32] font-mono text-[10px] tracking-[0.3em] uppercase">Freshness Guard</span>
                  </div>
                  <h2 className="text-5xl md:text-7xl font-serif font-medium text-[#1A1A1A] leading-[1.05] tracking-tight mb-10 stagger-2">
                    Never lose<br />
                    <span className="italic font-light text-[#A84E32]">a pour again.</span>
                  </h2>
                  <p className="text-[#333333] text-lg font-sans font-light leading-[1.8] max-w-xl mb-12 stagger-3">
                    Concrete dies in 90 minutes. Our IS 4926 compliant countdown tracks exactly how much time is left before slump loss, alerting you before loads are rejected.
                  </p>
                  
                  <div className="flex items-center gap-8 font-mono text-[9px] uppercase tracking-[0.2em] text-[#8C8982] stagger-4">
                    <div className="flex items-center gap-2.5"><div className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A]"></div>Safe</div>
                    <div className="flex items-center gap-2.5"><div className="w-1.5 h-1.5 rounded-full bg-[#A84E32]"></div>Caution</div>
                    <div className="flex items-center gap-2.5"><div className="w-3 h-3 rounded-full border border-[#A84E32] text-[#A84E32] flex items-center justify-center text-[7px]">!</div>Critical</div>
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
                      <div key={i} className={`bg-[#FFFFFF] ${row.status === 'critical' ? 'border border-[#A84E32]' : 'hairline-all'} p-6 lg:p-8 flex flex-col gap-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-500`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-mono text-[13px] tracking-wider text-[#1A1A1A] mb-1.5 tabular-nums">
                              {row.id} <span className="text-[#EAE7E1] mx-3">|</span> <span className="font-medium">{row.mix}</span>
                            </div>
                            <div className="text-[12px] font-sans text-[#8C8982]">{row.site}</div>
                          </div>
                          <div className={`font-serif text-3xl tabular-nums ${row.status === 'critical' ? 'text-[#A84E32]' : 'text-[#1A1A1A]'}`}>
                            {row.val}<span className="text-xl font-light opacity-60">%</span>
                          </div>
                        </div>
                        <div className="h-[2px] w-full bg-[#F9F8F6] relative overflow-hidden rounded-full">
                          <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${row.status === 'critical' ? 'bg-[#A84E32]' : row.status === 'caution' ? 'bg-[#A84E32] opacity-50' : 'bg-[#1A1A1A]'}`} style={{width: `${row.val}%`}}></div>
                        </div>
                        {row.msg && <div className="text-[9px] font-mono tracking-[0.2em] text-[#A84E32] uppercase">{row.msg}</div>}
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
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-10 md:px-24 max-w-7xl mx-auto pt-24">
              <div className="text-center max-w-3xl mx-auto mb-20">
                <div className="inline-flex items-center gap-4 mb-8 stagger-1">
                  <span className="w-8 h-[1px] bg-[#A84E32]"></span>
                  <span className="text-[#A84E32] font-mono text-[10px] tracking-[0.3em] uppercase">Command Center</span>
                  <span className="w-8 h-[1px] bg-[#A84E32]"></span>
                </div>
                <h2 className="text-5xl md:text-7xl font-serif font-medium text-[#1A1A1A] leading-[1.05] tracking-tight mb-8 stagger-2">
                  One screen.<br />
                  <span className="italic font-light">Total plant intelligence.</span>
                </h2>
                <p className="text-[#333333] text-lg font-sans font-light leading-[1.8] stagger-3 mx-auto max-w-2xl">
                  Replace WhatsApp groups and Excel sheets. A unified operations dashboard that gives you complete command over production, logistics, and quality.
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 stagger-4">
                {[
                  { title: "GPS Tracking", desc: "Live, always", icon: MapPin },
                  { title: "Freshness Guard", desc: "IS-code compliant", icon: Clock },
                  { title: "Smart Plant AI", desc: "Voice & text", icon: Globe },
                  { title: "Demand Forecast", desc: "Hourly insights", icon: TrendingUp },
                  { title: "Fleet Control", desc: "Every mixer", icon: Truck }
                ].map((f, i) => (
                  <div key={i} className="hairline-all bg-[#FFFFFF] p-8 flex flex-col items-center text-center hover:bg-[#F9F8F6] transition-colors duration-500 cursor-default shadow-[0_4px_20px_rgb(0,0,0,0.01)] group">
                    <div className="w-12 h-12 rounded-full hairline-all flex items-center justify-center mb-6 group-hover:border-[#A84E32]/30 transition-colors duration-500">
                      <f.icon className="w-5 h-5 text-[#A84E32]" strokeWidth={1} />
                    </div>
                    <h4 className="font-serif font-medium text-[#1A1A1A] text-lg mb-3">{f.title}</h4>
                    <p className="font-sans text-[12px] text-[#8C8982] font-light">{f.desc}</p>
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
            <div className="relative z-10 w-full h-full flex flex-col justify-center px-10 md:px-24 max-w-7xl mx-auto pt-24">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 lg:gap-32 items-center">
                <div className="flex flex-col stagger-1">
                  <div className="inline-flex items-center gap-4 mb-10">
                    <span className="w-12 h-[1px] bg-[#A84E32]"></span>
                    <span className="text-[#A84E32] font-mono text-[10px] tracking-[0.3em] uppercase">Secure Platform</span>
                  </div>
                  <h2 className="text-5xl md:text-7xl font-serif font-medium text-[#1A1A1A] leading-[1.05] tracking-tight mb-10">
                    Secure access for<br />
                    <span className="italic font-light">every plant role.</span>
                  </h2>
                  <p className="text-[#333333] text-lg font-sans font-light leading-[1.8] mb-14 max-w-md">
                    Enterprise-grade security with role-based access control. Plant data is siloed and encrypted.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { role: "Owner", icon: ShieldCheck },
                      { role: "Admin", icon: User },
                      { role: "Operator", icon: Activity },
                      { role: "Driver", icon: Smartphone }
                    ].map((r, i) => (
                      <div key={i} className="flex items-center gap-4 p-5 hairline-all bg-[#FFFFFF] hover:bg-[#F9F8F6] transition-colors duration-500">
                        <r.icon className="w-4 h-4 text-[#A84E32]" strokeWidth={1.5} />
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#1A1A1A]">{r.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="stagger-3 relative">
                  <div className="absolute -inset-6 bg-[#FFFFFF] hairline-all shadow-[0_20px_60px_rgb(0,0,0,0.04)] z-0" />
                  <div className="relative z-10 p-10 sm:p-14 bg-[#FFFFFF]">
                    <div className="mb-12 text-center">
                      <h3 className="font-serif font-medium text-3xl text-[#1A1A1A] mb-4">Welcome to Concrete King</h3>
                      <p className="font-sans text-[13px] text-[#8C8982] font-light">Sign in to access your plant operations</p>
                    </div>

                    {!otpStep ? (
                      <div className="space-y-6">
                        <button onClick={openLogin} className="w-full hairline-all text-[#1A1A1A] font-sans text-[13px] font-medium py-4 flex items-center justify-center gap-3 hover:bg-[#F9F8F6] transition-colors duration-300">
                          <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                          Continue with Google
                        </button>
                        
                        <div className="flex items-center gap-5 py-2">
                          <div className="flex-1 h-[1px] bg-[#EAE7E1]"></div>
                          <span className="font-mono text-[9px] text-[#8C8982] uppercase tracking-[0.2em]">Or Phone</span>
                          <div className="flex-1 h-[1px] bg-[#EAE7E1]"></div>
                        </div>
                        
                        <div className="flex gap-4">
                          <div className="w-16 hairline-all bg-[#F9F8F6] flex items-center justify-center font-mono text-[13px] text-[#1A1A1A]">+91</div>
                          <input type="text" placeholder="Enter mobile number" className="flex-1 hairline-all bg-[#FFFFFF] px-5 py-4 font-sans text-[13px] focus:outline-none focus:border-[#1A1A1A] transition-colors duration-300 placeholder-[#8C8982] tabular-nums" />
                        </div>
                        
                        <button onClick={() => setOtpStep(true)} className="w-full bg-[#1A1A1A] text-[#F9F8F6] font-sans text-[13px] font-medium py-4 flex items-center justify-center gap-3 hover:bg-[#333333] transition-colors duration-500 mt-4">
                          Send OTP via WhatsApp <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="text-center mb-10">
                          <div className="text-[13px] font-sans text-[#333333] mb-2 font-light">Code sent to your WhatsApp</div>
                          <div className="text-[11px] font-mono text-[#8C8982] tracking-widest tabular-nums">+91 ••••• •••••</div>
                        </div>
                        
                        <div className="flex justify-between gap-3">
                          {[1,2,3,4,5,6].map(i => (
                            <input key={i} type="text" maxLength={1} className="w-full aspect-square hairline-all text-center font-mono text-2xl text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A] focus:bg-[#F9F8F6] transition-colors duration-300" />
                          ))}
                        </div>
                        
                        <div className="flex gap-4 mt-10">
                          <button onClick={() => setOtpStep(false)} className="px-8 hairline-all text-[#1A1A1A] text-[13px] font-sans font-medium hover:bg-[#F9F8F6] transition-colors duration-500">
                            Back
                          </button>
                          <button onClick={openLogin} className="flex-1 bg-[#1A1A1A] text-[#F9F8F6] font-sans text-[13px] font-medium py-4 flex items-center justify-center gap-3 hover:bg-[#333333] transition-colors duration-500">
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
      <div className="absolute bottom-10 left-0 w-full z-40 flex justify-center gap-4">
        {[0, 1, 2, 3, 4].map(i => (
          <button 
            key={i} 
            onClick={() => setSlide(i)}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-700 ${slide === i ? 'bg-[#A84E32] w-8' : 'bg-[#1A1A1A]/20 hover:bg-[#1A1A1A]/40'}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
      
      {/* ARROWS */}
      <div className="absolute bottom-8 right-10 z-40 flex gap-3">
        <button 
          onClick={() => setSlide(s => Math.max(0, s - 1))}
          className={`w-12 h-12 flex items-center justify-center hairline-all transition-colors duration-500 rounded-full ${slide === 0 ? 'border-[#EAE7E1] text-[#EAE7E1] cursor-not-allowed' : 'border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F8F6]'}`}
          disabled={slide === 0}
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button 
          onClick={() => setSlide(s => Math.min(4, s + 1))}
          className={`w-12 h-12 flex items-center justify-center hairline-all transition-colors duration-500 rounded-full ${slide === 4 ? 'border-[#EAE7E1] text-[#EAE7E1] cursor-not-allowed' : 'border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#F9F8F6]'}`}
          disabled={slide === 4}
        >
          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
