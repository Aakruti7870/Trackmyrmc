import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, Play, CheckCircle2, AlertTriangle, ShieldAlert, Navigation, Clock, Zap, BarChart, Truck, Shield, Settings, User, ChevronLeft, ChevronRight } from "lucide-react";

/* ════════════════════════════════════════════════════════
   CONCRETE KING – RMC OPERATIONS OS (SOFT SERENE VARIANT)
   5 full-screen slides · No scroll · Soft organic BGs
════════════════════════════════════════════════════════ */

const C = {
  bg: "#FAF9F6", // Warm Off-White / Cream
  dark: "#3B3A37", // Warm Charcoal
  light: "#FFFFFF",
  accent: "#D6A39A", // Soft Blush
  green: "#A3C4BC", // Sage Green
  blue: "#B2C8D6", // Dusty Sky
  yellow: "#E8D3A2", // Warm Sand
  border: "1px solid rgba(59, 58, 55, 0.08)",
  shadow: "0 20px 40px rgba(59, 58, 55, 0.04), 0 1px 3px rgba(59, 58, 55, 0.02)",
  smShadow: "0 8px 16px rgba(59, 58, 55, 0.03)"
};

const openLogin = () => {
  if (typeof window !== "undefined") {
    window.open("/login", "_blank", "noopener,noreferrer");
  }
};

/* ── SOFT CANVAS 1: GENTLE BLOBS ── */
function BgBlobs() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let ani = 0; let t = 0;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    const draw = () => {
      t += 0.005; const W = cv.width, H = cv.height;
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      
      const drawBlob = (x: number, y: number, r: number, color: string, timeOffset: number) => {
        ctx.save();
        ctx.translate(x + Math.sin(t + timeOffset) * 50, y + Math.cos(t + timeOffset * 0.8) * 50);
        ctx.beginPath();
        for (let i = 0; i < Math.PI * 2; i += 0.1) {
          const radius = r + Math.sin(i * 3 + t + timeOffset) * 20 + Math.cos(i * 4 + t) * 15;
          ctx.lineTo(Math.cos(i) * radius, Math.sin(i) * radius);
        }
        ctx.closePath();
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.5);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(250, 249, 246, 0)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      };

      ctx.globalAlpha = 0.6;
      drawBlob(W * 0.8, H * 0.3, 300, 'rgba(214, 163, 154, 0.4)', 0);
      drawBlob(W * 0.6, H * 0.8, 400, 'rgba(178, 200, 214, 0.3)', 2);
      drawBlob(W * 0.2, H * 0.2, 250, 'rgba(163, 196, 188, 0.4)', 4);
      
      ani = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.8 }} />;
}

/* ── SOFT CANVAS 2: DRIFTING WAVES ── */
function BgWaves() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let ani = 0; let t = 0;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    const draw = () => {
      t += 0.008; const W = cv.width, H = cv.height;
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      
      ctx.globalAlpha = 0.4;
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        ctx.moveTo(0, H);
        for(let i=0; i<=W; i+=50) {
          const y = H * 0.6 + Math.sin(i * 0.002 + t + j) * 80 + Math.cos(i * 0.001 + t * 0.8) * 40 - j * 100;
          ctx.lineTo(i, y);
        }
        ctx.lineTo(W, H);
        ctx.fillStyle = j === 0 ? 'rgba(178, 200, 214, 0.2)' : j === 1 ? 'rgba(163, 196, 188, 0.2)' : 'rgba(232, 211, 162, 0.2)';
        ctx.fill();
      }
      
      ani = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.8 }} />;
}

/* ── SOFT CANVAS 3: GENTLE GLOWS ── */
function BgGlow() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let ani = 0; let t = 0;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    const draw = () => {
      t += 0.01; const W = cv.width, H = cv.height;
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      
      const drawGlow = (x: number, y: number, r: number, color: string) => {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(250, 249, 246, 0)');
        ctx.fillStyle = grad;
        ctx.fill();
      };

      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.5;
      
      drawGlow(W * 0.3 + Math.sin(t) * 100, H * 0.4 + Math.cos(t) * 50, 400, 'rgba(232, 211, 162, 0.3)');
      drawGlow(W * 0.7 + Math.cos(t*0.8) * 100, H * 0.6 + Math.sin(t*0.9) * 50, 500, 'rgba(163, 196, 188, 0.3)');
      
      ctx.globalCompositeOperation = "source-over";
      ani = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.8 }} />;
}

/* ── SOFT CANVAS 4: AIRY PARTICLES ── */
function BgParticles() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let ani = 0; let t = 0;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random(), y: Math.random(),
      sp: 0.0005 + Math.random() * 0.001,
      r: 2 + Math.random() * 6,
      offset: Math.random() * Math.PI * 2
    }));
    const draw = () => {
      t += 0.01; const W = cv.width, H = cv.height;
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      
      particles.forEach(p => {
        p.y -= p.sp;
        if (p.y < -0.1) p.y = 1.1;
        
        ctx.beginPath();
        const px = p.x * W + Math.sin(t * 0.5 + p.offset) * 20;
        const py = p.y * H;
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(178, 200, 214, ${0.1 + Math.sin(t + p.offset) * 0.1})`;
        ctx.fill();
      });
      ani = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

/* ── SOFT CANVAS 5: MINIMAL GRADIENT ── */
function BgMinimal() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let ani = 0; let t = 0;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    const draw = () => {
      t += 0.005; const W = cv.width, H = cv.height;
      
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, C.bg);
      grad.addColorStop(1, 'rgba(232, 211, 162, 0.15)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      
      ani = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

/* ── SOFT CARD ── */
const SoftCard = ({ children, style = {}, bg = C.light, color = C.dark }: any) => (
  <div style={{ background: bg, border: C.border, boxShadow: C.shadow, padding: 32, borderRadius: 24, color, transition: "transform 0.4s ease, box-shadow 0.4s ease", ...style }}>
    {children}
  </div>
);

/* ── LABEL CHIP ── */
const Label = ({ children, bg = "rgba(59, 58, 55, 0.05)", color = C.dark }: any) => (
  <div style={{ display: "inline-block", background: bg, color, padding: "6px 16px", borderRadius: 100, fontWeight: 500, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 24 }}>
    {children}
  </div>
);

/* ── SOFT PROGRESS BAR ── */
function SoftBar({ pct, color, label, grade, client, risk }: any) {
  return (
    <SoftCard style={{ padding: 24, paddingBottom: risk ? 24 : 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: C.dark, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 14, color: "rgba(59, 58, 55, 0.6)" }}>{client}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 300, color: C.dark }}>{pct}%</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(59, 58, 55, 0.5)", marginTop: 4 }}>{grade}</div>
        </div>
      </div>
      <div style={{ width: "100%", height: 6, background: "rgba(59, 58, 55, 0.06)", borderRadius: 100, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${pct}%`, background: color, borderRadius: 100, transition: "width 1s cubic-bezier(0.2, 0.8, 0.2, 1)" }} />
      </div>
      {risk && <div style={{ marginTop: 16, color: C.accent, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={14} /> Slump risk detected</div>}
    </SoftCard>
  );
}

/* ════════════ SLIDE 1: HOME ════════════ */
function Slide1() {
  const [word, setWord] = useState(0);
  const words = ["Dispatch.", "Freshness.", "Fleet.", "Output."];
  const colors = [C.accent, C.green, C.blue, C.yellow];
  useEffect(() => { const id = setInterval(() => setWord(w => (w + 1) % 4), 2800); return () => clearInterval(id); }, []);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
      <BgBlobs />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 8vw", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", alignItems: "center", gap: 60 }}>
        <div>
          <Label>READY MIX CONCRETE · OPERATIONS OS</Label>
          <h1 style={{ fontFamily: "Outfit, system-ui, sans-serif", fontSize: "clamp(48px, 6vw, 72px)", fontWeight: 300, color: C.dark, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Control your <br/>
            <span style={{ color: colors[word], fontWeight: 400, transition: "color 0.8s ease" }}>{words[word]}</span>
          </h1>
          <p style={{ fontSize: 18, color: "rgba(59, 58, 55, 0.7)", lineHeight: 1.6, maxWidth: 480, marginTop: 24, marginBottom: 40 }}>
            The only platform built ground-up for RMC plants. Live GPS, freshness tracking, IS-code AI, and fleet intelligence — one screen.
          </p>
          <div style={{ display: "flex", gap: 16, marginBottom: 60 }}>
            <button onClick={openLogin} style={{ padding: "16px 32px", borderRadius: 100, background: C.dark, color: C.light, fontSize: 16, fontWeight: 500, cursor: "pointer", border: "none", transition: "transform 0.2s, box-shadow 0.2s", boxShadow: C.smShadow }}>Get Started</button>
            <button style={{ padding: "16px 32px", borderRadius: 100, background: "rgba(255, 255, 255, 0.5)", border: C.border, color: C.dark, fontSize: 16, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, backdropFilter: "blur(10px)" }}>
              <Play size={16} /> Watch Demo
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {[
            { icon: <Truck size={20}/>, v: "4", l: "Live Pours", s: "3 plants active", c: C.blue },
            { icon: <BarChart size={20}/>, v: "143 m³", l: "Today's Output", s: "+18% vs avg", c: C.green },
            { icon: <Clock size={20}/>, v: "96.4%", l: "On-Time Rate", s: "Last 7 days", c: C.accent },
            { icon: <Settings size={20}/>, v: "12", l: "Fleet Online", s: "2 in maintenance", c: C.yellow },
          ].map((k, i) => (
            <SoftCard key={i} style={{ padding: 24, background: "rgba(255, 255, 255, 0.7)", backdropFilter: "blur(20px)" }}>
              <div style={{ marginBottom: 16, color: k.c, background: "rgba(255, 255, 255, 0.8)", width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: C.smShadow }}>{k.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 300, color: C.dark, marginBottom: 8 }}>{k.v}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.dark }}>{k.l}</div>
              <div style={{ fontSize: 13, color: "rgba(59, 58, 55, 0.5)", marginTop: 4 }}>{k.s}</div>
            </SoftCard>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════ SLIDE 2: GPS ════════════ */
function Slide2() {
  const trucks = [
    { id: "MH 46 DC 0814", status: "Moving", speed: "38 km/h", col: C.blue },
    { id: "MH 48 T 5967", status: "Moving", speed: "42 km/h", col: C.blue },
    { id: "MH 46 BB 9003", status: "Arrived", speed: "Site", col: C.green },
    { id: "MH 46 DC 0813", status: "Idle", speed: "Plant", col: "rgba(59, 58, 55, 0.4)" },
  ];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
      <BgWaves />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 8vw", display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", gap: 80 }}>
        <div>
          <Label bg="rgba(178, 200, 214, 0.2)">LIVE GPS TRACKING</Label>
          <h2 style={{ fontFamily: "Outfit, system-ui, sans-serif", fontSize: "clamp(40px, 5vw, 64px)", fontWeight: 300, color: C.dark, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 24 }}>Every mixer. Always visible.</h2>
          <p style={{ fontSize: 18, color: "rgba(59, 58, 55, 0.7)", lineHeight: 1.6, maxWidth: 450 }}>Real-time location from your plant gate to the pour site. No calls. No guessing.</p>
        </div>
        <SoftCard style={{ padding: 0, overflow: "hidden", background: "rgba(255, 255, 255, 0.8)", backdropFilter: "blur(20px)" }}>
          <div style={{ padding: "24px 32px", borderBottom: C.border, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(59, 58, 55, 0.6)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Fleet Status</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.green }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }}/> Live</div>
          </div>
          <div style={{ padding: "12px 32px" }}>
            {trucks.map((tr, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 0", borderBottom: i < 3 ? C.border : "none" }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255, 255, 255, 0.5)", border: C.border, display: "flex", alignItems: "center", justifyContent: "center", color: tr.col }}><Navigation size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: C.dark }}>{tr.id}</div>
                  <div style={{ fontSize: 13, color: "rgba(59, 58, 55, 0.5)", marginTop: 2 }}>{tr.status}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.dark }}>
                  {tr.speed}
                </div>
              </div>
            ))}
          </div>
        </SoftCard>
      </div>
    </div>
  );
}

/* ════════════ SLIDE 3: FRESHNESS ════════════ */
function Slide3() {
  const pours = [
    { id: "TM-0814", pct: 74, color: C.blue, grade: "M25", client: "P.G. Constructions", risk: false },
    { id: "TM-5967", pct: 46, color: C.yellow, grade: "M20", client: "Ananth Corporation", risk: false },
    { id: "TM-9003", pct: 12, color: C.accent, grade: "M30", client: "DS Infrastructure", risk: true },
    { id: "TM-0813", pct: 62, color: C.green, grade: "M10", client: "Hiravati Agro", risk: false },
  ];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
      <BgGlow />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 8vw", display: "grid", gridTemplateColumns: "0.9fr 1.1fr", alignItems: "center", gap: 60 }}>
        <div>
          <Label bg="rgba(163, 196, 188, 0.2)">FRESHNESS GUARD</Label>
          <h2 style={{ fontFamily: "Outfit, system-ui, sans-serif", fontSize: "clamp(40px, 5vw, 64px)", fontWeight: 300, color: C.dark, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 24 }}>Never lose a pour again.</h2>
          <p style={{ fontSize: 18, color: "rgba(59, 58, 55, 0.7)", lineHeight: 1.6, marginBottom: 40 }}>IS 4926 mandates concrete be placed within 90 minutes of batching. Our real-time countdown alerts your team gracefully.</p>
          <div style={{ display: "flex", gap: 24 }}>
            {[{ c: C.blue, l: "Safe >40%" }, { c: C.yellow, l: "Caution" }, { c: C.accent, l: "Critical" }].map(x => (
              <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(59, 58, 55, 0.6)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: x.c }} />
                {x.l}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {pours.map(p => <SoftBar key={p.id} {...p} />)}
        </div>
      </div>
    </div>
  );
}

/* ════════════ SLIDE 4: COMMAND ════════════ */
function Slide4() {
  const feats = [
    { icon: <Navigation size={24}/>, title: "GPS Tracking", desc: "Live, always", col: "rgba(178, 200, 214, 0.15)" },
    { icon: <Clock size={24}/>, title: "Freshness Guard", desc: "IS-code compliant", col: "rgba(163, 196, 188, 0.15)" },
    { icon: <Zap size={24}/>, title: "Smart Plant AI", desc: "Voice & text", col: "rgba(232, 211, 162, 0.15)" },
    { icon: <BarChart size={24}/>, title: "Demand Forecast", desc: "Hourly insights", col: "rgba(214, 163, 154, 0.15)" },
    { icon: <Truck size={24}/>, title: "Fleet Control", desc: "Every mixer", col: "rgba(255, 255, 255, 0.5)" },
  ];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <BgParticles />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 8vw", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <Label>COMMAND CENTER</Label>
        <h2 style={{ fontFamily: "Outfit, system-ui, sans-serif", fontSize: "clamp(40px, 5vw, 64px)", fontWeight: 300, color: C.dark, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 24 }}>One screen. Total plant intelligence.</h2>
        <p style={{ fontSize: 18, color: "rgba(59, 58, 55, 0.7)", lineHeight: 1.6, maxWidth: 640, marginBottom: 60 }}>Dispatch, freshness, fleet, and demand forecasting — beautifully unified. Built for clarity and calm.</p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
          {feats.map((f, i) => (
            <SoftCard key={i} bg={f.col} style={{ textAlign: "center", flex: "1 1 200px", maxWidth: 240, padding: "32px 24px", backdropFilter: "blur(10px)" }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(255, 255, 255, 0.6)", color: C.dark, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>{f.icon}</div>
              <div style={{ fontSize: 16, color: C.dark, fontWeight: 500, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 14, color: "rgba(59, 58, 55, 0.6)" }}>{f.desc}</div>
            </SoftCard>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════ SLIDE 5: LOGIN ════════════ */
function Slide5() {
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState(0);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const handleOtp = (v: string, i: number) => {
    const n = [...otp]; n[i] = v.slice(-1); setOtp(n);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  };
  const roles = [{ icon: <User size={20}/>, label: "Owner" }, { icon: <Shield size={20}/>, label: "Admin" }, { icon: <Settings size={20}/>, label: "Operator" }, { icon: <Truck size={20}/>, label: "Driver" }];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
      <BgMinimal />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 8vw", display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", gap: 80 }}>
        <div>
          <Label bg="rgba(214, 163, 154, 0.2)">SECURE PLATFORM</Label>
          <h2 style={{ fontFamily: "Outfit, system-ui, sans-serif", fontSize: "clamp(40px, 5vw, 64px)", fontWeight: 300, color: C.dark, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 24 }}>Secure access for every plant role.</h2>
          <p style={{ fontSize: 18, color: "rgba(59, 58, 55, 0.7)", lineHeight: 1.6, maxWidth: 480, marginBottom: 40 }}>Plant Owner, Admin, Operator, Driver, Fleet Manager and Customer dashboards are separated by Plant ID. Your data stays private.</p>
          <div style={{ display: "flex", gap: 24 }}>
            {roles.map(r => (
              <div key={r.label} style={{ textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(255, 255, 255, 0.6)", color: C.dark, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>{r.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(59, 58, 55, 0.6)" }}>{r.label}</div>
              </div>
            ))}
          </div>
        </div>
        
        <SoftCard style={{ maxWidth: 420, margin: "0 auto", width: "100%", background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(20px)" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h3 style={{ fontSize: 24, fontWeight: 300, color: C.dark, marginBottom: 8 }}>{step === 0 ? "Welcome Back" : "Verify Phone"}</h3>
            <p style={{ fontSize: 14, color: "rgba(59, 58, 55, 0.6)" }}>{step === 0 ? "Enter your phone number to continue" : `Code sent via WhatsApp to ${phone}`}</p>
          </div>
          
          {step === 0 ? (
            <div>
              <button onClick={openLogin} style={{ width: "100%", padding: "14px", borderRadius: 100, background: "rgba(59, 58, 55, 0.04)", border: "none", color: C.dark, fontSize: 15, fontWeight: 500, marginBottom: 24, cursor: "pointer", transition: "background 0.2s" }}>Continue with Google</button>
              
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ height: 1, flex: 1, background: "rgba(59, 58, 55, 0.1)" }} />
                <span style={{ fontSize: 12, color: "rgba(59, 58, 55, 0.4)" }}>OR</span>
                <div style={{ height: 1, flex: 1, background: "rgba(59, 58, 55, 0.1)" }} />
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                <div style={{ padding: "14px", borderRadius: 16, background: C.bg, border: C.border, color: "rgba(59, 58, 55, 0.6)", fontSize: 15 }}>+91</div>
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="Phone Number" 
                  style={{ flex: 1, padding: "14px", borderRadius: 16, background: C.bg, border: C.border, color: C.dark, fontSize: 15, outline: "none" }}
                />
              </div>
              <button onClick={() => phone.length > 8 && setStep(1)} style={{ width: "100%", padding: "16px", borderRadius: 100, background: C.dark, color: C.light, border: "none", fontSize: 16, fontWeight: 500, cursor: "pointer", opacity: phone.length > 8 ? 1 : 0.5, transition: "opacity 0.2s" }}>
                Send OTP via WhatsApp
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 32 }}>
                {otp.map((v, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    value={v}
                    onChange={e => handleOtp(e.target.value, i)}
                    style={{ width: 44, height: 52, borderRadius: 12, border: C.border, background: C.bg, textAlign: "center", fontSize: 20, fontWeight: 400, color: C.dark, outline: "none" }}
                    maxLength={1}
                  />
                ))}
              </div>
              <button onClick={openLogin} style={{ width: "100%", padding: "16px", borderRadius: 100, background: C.dark, color: C.light, border: "none", fontSize: 16, fontWeight: 500, cursor: "pointer", marginBottom: 16 }}>
                Verify & Enter App
              </button>
              <button onClick={() => setStep(0)} style={{ width: "100%", padding: "14px", borderRadius: 100, background: "transparent", border: "none", color: "rgba(59, 58, 55, 0.6)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                Back
              </button>
            </div>
          )}
        </SoftCard>
      </div>
    </div>
  );
}

/* ════════════ MAIN DECK APP ════════════ */
export default function SoftSereneDeck() {
  const [slide, setSlide] = useState(0);
  const slides = [<Slide1 key={0}/>, <Slide2 key={1}/>, <Slide3 key={2}/>, <Slide4 key={3}/>, <Slide5 key={4}/>];
  
  const next = useCallback(() => setSlide(s => Math.min(s + 1, 4)), []);
  const prev = useCallback(() => setSlide(s => Math.max(s - 1, 0)), []);
  
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [next, prev]);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: C.bg, fontFamily: "system-ui, -apple-system, sans-serif", color: C.dark }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        button:hover { opacity: 0.9; }
      `}</style>
      
      {/* NAVBAR */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "24px 40px", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.dark, color: C.light, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>CK</div>
          <span style={{ fontWeight: 600, letterSpacing: "0.05em", color: C.dark }}>CONCRETE KING</span>
        </div>
        <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {["Home", "GPS", "Freshness", "Command", "Login"].map((item, i) => (
            <button key={item} onClick={() => setSlide(i)} style={{ background: "none", border: "none", color: slide === i ? C.dark : "rgba(59, 58, 55, 0.4)", fontWeight: 500, cursor: "pointer", fontSize: 14, transition: "color 0.3s" }}>
              {item}
            </button>
          ))}
          <button onClick={openLogin} style={{ padding: "10px 24px", borderRadius: 100, background: "rgba(59, 58, 55, 0.05)", color: C.dark, border: "none", fontWeight: 500, cursor: "pointer", fontSize: 14 }}>
            Login
          </button>
        </div>
      </div>

      {/* SLIDES */}
      <div style={{ width: "500vw", height: "100vh", display: "flex", transform: `translateX(-${slide * 100}vw)`, transition: "transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {slides.map((S, i) => <div key={i} style={{ width: "100vw", height: "100vh" }}>{S}</div>)}
      </div>

      {/* CONTROLS */}
      <div style={{ position: "absolute", bottom: 40, left: 40, right: 40, zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={prev} disabled={slide === 0} style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255, 255, 255, 0.8)", border: C.border, display: "flex", alignItems: "center", justifyContent: "center", cursor: slide === 0 ? "not-allowed" : "pointer", opacity: slide === 0 ? 0 : 1, transition: "opacity 0.3s, transform 0.2s", color: C.dark, backdropFilter: "blur(10px)" }}>
          <ChevronLeft size={24} />
        </button>
        
        <div style={{ display: "flex", gap: 12 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <button key={i} onClick={() => setSlide(i)} style={{ width: slide === i ? 32 : 8, height: 8, borderRadius: 4, background: slide === i ? C.dark : "rgba(59, 58, 55, 0.2)", border: "none", cursor: "pointer", transition: "all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)", padding: 0 }} />
          ))}
        </div>

        <button onClick={next} disabled={slide === 4} style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255, 255, 255, 0.8)", border: C.border, display: "flex", alignItems: "center", justifyContent: "center", cursor: slide === 4 ? "not-allowed" : "pointer", opacity: slide === 4 ? 0 : 1, transition: "opacity 0.3s, transform 0.2s", color: C.dark, backdropFilter: "blur(10px)" }}>
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}

export { SoftSereneDeck };