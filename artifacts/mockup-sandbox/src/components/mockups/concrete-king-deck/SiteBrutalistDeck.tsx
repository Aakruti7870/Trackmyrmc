import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, Play, CheckCircle2, AlertTriangle, ShieldAlert, Navigation, Clock, Zap, BarChart, Truck, Shield, Settings, User } from "lucide-react";

/* ════════════════════════════════════════════════════════
   CONCRETE KING – RMC OPERATIONS OS (BRUTALIST VARIANT)
   5 full-screen slides · No scroll · Brutalist geometric BGs
════════════════════════════════════════════════════════ */

const C = {
  bg: "#D4D4D4", // Concrete Grey
  dark: "#000000", // Pure Black
  light: "#FFFFFF",
  accent: "#FF3300", // Safety Orange/Red
  green: "#00E054",
  blue: "#0033FF",
  border: "3px solid #000000",
  shadow: "6px 6px 0px #000000",
  smShadow: "3px 3px 0px #000000"
};

const openLogin = () => {
  if (typeof window !== "undefined") {
    window.open("/login", "_blank", "noopener,noreferrer");
  }
};

/* ── BRUTALIST CANVAS 1: GEOMETRIC DRUM ── */
function BgDrum() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let ani = 0; let t = 0;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    const draw = () => {
      t += 0.02; const W = cv.width, H = cv.height;
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      
      // Grid
      ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.lineWidth = 2;
      for(let i=0; i<W; i+=40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
      for(let i=0; i<H; i+=40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }

      const dx = W * 0.65, dy = H * 0.5, r = Math.min(W, H) * 0.3;
      ctx.save(); ctx.translate(dx, dy); ctx.rotate(t * 0.5);
      
      // Harsh drum
      ctx.fillStyle = C.light; ctx.strokeStyle = C.dark; ctx.lineWidth = 4;
      ctx.beginPath();
      for(let i=0; i<6; i++) {
        const a = (i * Math.PI * 2) / 6;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      
      // Inner lines
      ctx.beginPath();
      for(let i=0; i<6; i++) {
        const a = (i * Math.PI * 2) / 6;
        ctx.moveTo(0,0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();

      // Center
      ctx.fillStyle = C.accent;
      ctx.beginPath(); ctx.arc(0,0, r*0.2, 0, Math.PI*2); ctx.fill(); ctx.stroke();

      ctx.restore();
      ani = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

/* ── BRUTALIST CANVAS 2: DATA HIGHWAY ── */
function BgHighway() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let ani = 0; let t = 0;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    const draw = () => {
      t += 0.05; const W = cv.width, H = cv.height;
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      
      ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 3;
      const roadY = H * 0.6;
      
      for(let i=0; i<10; i++) {
        const y = roadY + Math.pow(i, 1.5) * 5;
        if(y < H) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
      }
      
      ctx.fillStyle = C.dark;
      for(let i=0; i<5; i++) {
        const speed = 2 + i;
        const x = (t * speed * 20 + i * 300) % (W + 200) - 100;
        const y = roadY + 20 + i * 40;
        ctx.fillRect(x, y, 60, 20);
        ctx.fillStyle = C.accent;
        ctx.fillRect(x + 40, y + 5, 20, 10);
        ctx.fillStyle = C.dark;
      }
      ani = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

/* ── BRUTALIST CANVAS 3: HARSH POUR ── */
function BgPour() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let ani = 0; let t = 0;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    const drops = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), sp: 0.02 + Math.random() * 0.03, w: 10 + Math.random() * 20, h: 40 + Math.random() * 80 }));
    const draw = () => {
      t += 0.05; const W = cv.width, H = cv.height;
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      
      ctx.fillStyle = C.dark;
      drops.forEach(d => {
        d.y += d.sp;
        if (d.y > 1) d.y = -0.2;
        ctx.fillRect(W * 0.3 + d.x * W * 0.2, d.y * H, d.w, d.h);
      });
      
      ctx.fillStyle = C.accent;
      ctx.fillRect(W * 0.25, H * 0.8, W * 0.3, H * 0.2);
      ctx.fillStyle = C.dark;
      ctx.fillRect(W * 0.27, H * 0.82, W * 0.26, H * 0.18);

      ani = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

/* ── BRUTALIST CANVAS 4: COMMAND GRID ── */
function BgCommand() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let ani = 0; let t = 0;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    const draw = () => {
      t += 0.1; const W = cv.width, H = cv.height;
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      
      const size = 60;
      ctx.strokeStyle = C.dark; ctx.lineWidth = 2;
      for(let x=0; x<W; x+=size) {
        for(let y=0; y<H; y+=size) {
          if (Math.random() > 0.98) {
            ctx.fillStyle = Math.random() > 0.5 ? C.accent : C.blue;
            ctx.fillRect(x, y, size, size);
          }
          ctx.strokeRect(x, y, size, size);
        }
      }
      ani = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

/* ── BRUTALIST CANVAS 5: LOGIN NOISE ── */
function BgLogin() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    let ani = 0;
    const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
    sz(); window.addEventListener("resize", sz);
    const draw = () => {
      const W = cv.width, H = cv.height;
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      
      ctx.fillStyle = C.dark;
      for(let i=0; i<100; i++) {
        ctx.fillRect(Math.random() * W, Math.random() * H, Math.random() * 40, Math.random() * 10);
      }
      for(let i=0; i<20; i++) {
        ctx.fillStyle = C.accent;
        ctx.fillRect(Math.random() * W, Math.random() * H, 20, 20);
      }
      ani = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(ani); window.removeEventListener("resize", sz); };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

/* ── BRUTALIST CARD ── */
const BrutalCard = ({ children, style = {}, bg = C.light, color = C.dark }: any) => (
  <div style={{ background: bg, border: C.border, boxShadow: C.shadow, padding: 24, color, ...style }}>
    {children}
  </div>
);

/* ── LABEL CHIP ── */
const Label = ({ children, bg = C.dark, color = C.light }: any) => (
  <div style={{ display: "inline-block", background: bg, color, padding: "8px 16px", border: C.border, fontWeight: 900, fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 24, boxShadow: C.smShadow }}>
    {children}
  </div>
);

/* ── BRUTAL PROGRESS BAR ── */
function BrutalBar({ pct, color, label, grade, client, risk }: any) {
  return (
    <BrutalCard style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{label}</div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{client}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color, textShadow: "2px 2px 0px #000" }}>{pct}%</div>
          <div style={{ fontSize: 14, fontWeight: 900, background: C.dark, color: C.light, padding: "2px 6px", display: "inline-block" }}>{grade}</div>
        </div>
      </div>
      <div style={{ width: "100%", height: 24, border: C.border, background: C.light, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${pct}%`, background: color, borderRight: C.border }} />
      </div>
      {risk && <div style={{ marginTop: 12, background: C.accent, color: C.light, padding: "6px", fontWeight: 900, fontSize: 12, border: C.border, textAlign: "center", textTransform: "uppercase", boxShadow: C.smShadow }}>⚠ SLUMP RISK</div>}
    </BrutalCard>
  );
}

/* ════════════ SLIDE 1: HOME ════════════ */
function Slide1() {
  const [word, setWord] = useState(0);
  const words = ["Dispatch.", "Freshness.", "Fleet.", "Output."];
  const colors = [C.accent, C.green, C.blue, "#FFBB00"];
  useEffect(() => { const id = setInterval(() => setWord(w => (w + 1) % 4), 2800); return () => clearInterval(id); }, []);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
      <BgDrum />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 6vw", display: "grid", gridTemplateColumns: "1.2fr 0.8fr", alignItems: "center", gap: 40 }}>
        <div>
          <Label bg={C.accent}>READY MIX CONCRETE · OPERATIONS OS</Label>
          <h1 style={{ fontSize: "clamp(60px, 7vw, 90px)", fontWeight: 900, color: C.dark, lineHeight: 0.9, textTransform: "uppercase", textShadow: "4px 4px 0px #fff" }}>Control your</h1>
          <h1 style={{ fontSize: "clamp(60px, 7vw, 90px)", fontWeight: 900, lineHeight: 0.9, textTransform: "uppercase", color: colors[word], textShadow: "4px 4px 0px #000", marginBottom: 32, minHeight: "1em" }}>{words[word]}</h1>
          <p style={{ fontSize: 18, fontWeight: 700, color: C.dark, lineHeight: 1.6, maxWidth: 500, marginBottom: 40, background: C.light, padding: 16, border: C.border, boxShadow: C.smShadow }}>
            The only platform built ground-up for RMC plants. Live GPS, freshness tracking, IS-code AI, and fleet intelligence — <span style={{ background: C.accent, color: C.light, padding: "0 4px" }}>one screen.</span>
          </p>
          <div style={{ display: "flex", gap: 16, marginBottom: 60 }}>
            <button onClick={openLogin} style={{ padding: "16px 32px", border: C.border, background: C.dark, color: C.light, fontSize: 18, fontWeight: 900, cursor: "pointer", textTransform: "uppercase", boxShadow: C.shadow }}>Get Started →</button>
            <button style={{ padding: "16px 32px", border: C.border, background: C.light, color: C.dark, fontSize: 18, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textTransform: "uppercase", boxShadow: C.shadow }}>
              <Play fill="currentColor" size={18} /> Watch Demo
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            {[
              { icon: <Truck size={24}/>, v: "4", l: "Live Pours", s: "3 plants active", c: C.blue },
              { icon: <BarChart size={24}/>, v: "143 m³", l: "Today's Output", s: "+18% vs avg", c: C.green },
              { icon: <Clock size={24}/>, v: "96.4%", l: "On-Time Rate", s: "Last 7 days", c: C.accent },
              { icon: <Settings size={24}/>, v: "12", l: "Fleet Online", s: "2 in maintenance", c: "#FFBB00" },
            ].map((k, i) => (
              <BrutalCard key={i} style={{ padding: "16px 12px" }}>
                <div style={{ marginBottom: 12, background: k.c, display: "inline-block", padding: 8, border: C.border, color: C.dark }}>{k.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: C.dark, lineHeight: 1, marginBottom: 4 }}>{k.v}</div>
                <div style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>{k.l}</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{k.s}</div>
              </BrutalCard>
            ))}
          </div>
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
    { id: "MH 46 DC 0813", status: "Idle", speed: "Plant", col: C.dark },
  ];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "flex-end", paddingBottom: "8vh" }}>
      <BgHighway />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 6vw", display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "flex-end", gap: 60 }}>
        <BrutalCard style={{ marginBottom: 20 }}>
          <Label bg={C.blue}>LIVE GPS TRACKING</Label>
          <h2 style={{ fontSize: "clamp(50px, 6vw, 80px)", fontWeight: 900, color: C.dark, lineHeight: 0.9, textTransform: "uppercase" }}>Every mixer.</h2>
          <h2 style={{ fontSize: "clamp(50px, 6vw, 80px)", fontWeight: 900, color: C.blue, lineHeight: 0.9, textTransform: "uppercase", textShadow: "3px 3px 0px #000", marginBottom: 24 }}>Always visible.</h2>
          <p style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.6, maxWidth: 450 }}>Real-time location from your plant gate to the pour site. Watch live as mixers navigate Mumbai's roads. No calls. No guessing.</p>
        </BrutalCard>
        <BrutalCard bg={C.dark} color={C.light} style={{ padding: 32, marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "0.1em", marginBottom: 24, borderBottom: "3px solid #fff", paddingBottom: 12 }}>FLEET STATUS · LIVE</div>
          {trucks.map((tr, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: i < 3 ? `3px solid #333` : "none" }}>
              <div style={{ background: tr.col, border: "2px solid #fff", padding: 8, color: i === 3 ? C.light : C.dark }}><Navigation size={24} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{tr.id}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: tr.col, marginTop: 4, textTransform: "uppercase" }}>{tr.status}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: tr.col, background: "#222", padding: "4px 8px", border: "2px solid #fff" }}>
                  {tr.speed}
                </div>
              </div>
            </div>
          ))}
        </BrutalCard>
      </div>
    </div>
  );
}

/* ════════════ SLIDE 3: FRESHNESS ════════════ */
function Slide3() {
  const pours = [
    { id: "TM-0814", pct: 74, color: C.blue, grade: "M25", client: "P.G. Constructions", risk: false },
    { id: "TM-5967", pct: 46, color: "#FFBB00", grade: "M20", client: "Ananth Corporation", risk: false },
    { id: "TM-9003", pct: 12, color: C.accent, grade: "M30", client: "DS Infrastructure", risk: true },
    { id: "TM-0813", pct: 62, color: C.blue, grade: "M10", client: "Hiravati Agro", risk: false },
  ];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
      <BgPour />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 6vw", display: "grid", gridTemplateColumns: "1fr 1.2fr", alignItems: "center", gap: 48 }}>
        <BrutalCard bg={C.light}>
          <Label bg={C.green}>FRESHNESS GUARD</Label>
          <h2 style={{ fontSize: "clamp(46px, 5.5vw, 76px)", fontWeight: 900, color: C.dark, lineHeight: 0.9, textTransform: "uppercase" }}>Never lose</h2>
          <h2 style={{ fontSize: "clamp(46px, 5.5vw, 76px)", fontWeight: 900, color: C.green, lineHeight: 0.9, textTransform: "uppercase", textShadow: "3px 3px 0px #000", marginBottom: 24 }}>a pour again.</h2>
          <p style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.6, marginBottom: 32 }}>IS 4926 mandates concrete be placed within 90 minutes of batching. Our real-time countdown rings alert your team before slump loss — automatically.</p>
          <div style={{ display: "flex", gap: 24, padding: 16, background: C.dark, color: C.light, border: C.border }}>
            {[{ c: C.blue, l: "Safe >40%" }, { c: "#FFBB00", l: "Caution" }, { c: C.accent, l: "Critical" }].map(x => (
              <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, textTransform: "uppercase" }}>
                <span style={{ width: 16, height: 16, background: x.c, border: "2px solid #fff", display: "inline-block" }} />
                {x.l}
              </div>
            ))}
          </div>
        </BrutalCard>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {pours.map(p => <BrutalBar key={p.id} {...p} />)}
        </div>
      </div>
    </div>
  );
}

/* ════════════ SLIDE 4: COMMAND ════════════ */
function Slide4() {
  const feats = [
    { icon: <Navigation size={32}/>, title: "GPS Tracking", desc: "Live, always", col: C.blue },
    { icon: <Clock size={32}/>, title: "Freshness Guard", desc: "IS-code compliant", col: C.green },
    { icon: <Zap size={32}/>, title: "Smart Plant AI", desc: "Voice & text", col: "#FFBB00" },
    { icon: <BarChart size={32}/>, title: "Demand Forecast", desc: "Hourly insights", col: C.accent },
    { icon: <Truck size={32}/>, title: "Fleet Control", desc: "Every mixer", col: C.light },
  ];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <BgCommand />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 6vw", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <Label bg={C.dark} color={C.light}>COMMAND CENTER</Label>
        <h2 style={{ fontSize: "clamp(50px, 6vw, 80px)", fontWeight: 900, color: C.dark, lineHeight: 0.9, textTransform: "uppercase", background: C.light, padding: "0 16px", border: C.border, boxShadow: C.shadow, marginBottom: 8 }}>One screen.</h2>
        <h2 style={{ fontSize: "clamp(50px, 6vw, 80px)", fontWeight: 900, color: C.light, background: C.dark, padding: "0 16px", border: "3px solid #fff", lineHeight: 0.9, textTransform: "uppercase", boxShadow: C.shadow, marginBottom: 32 }}>Total plant intelligence.</h2>
        <p style={{ fontSize: 20, fontWeight: 800, color: C.dark, lineHeight: 1.5, maxWidth: 700, marginBottom: 60, background: C.light, padding: 24, border: C.border, boxShadow: C.shadow }}>Dispatch, freshness, fleet, and demand forecasting — all unified. Built for plant managers who need answers in seconds, not minutes.</p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
          {feats.map((f, i) => (
            <BrutalCard key={i} bg={f.col} style={{ textAlign: "center", minWidth: 200, flex: "1 1 180px", maxWidth: 220, transform: i % 2 === 0 ? "rotate(-2deg)" : "rotate(2deg)" }}>
              <div style={{ background: C.dark, color: C.light, display: "inline-block", padding: 12, border: "2px solid #fff", marginBottom: 16 }}>{f.icon}</div>
              <div style={{ fontSize: 18, color: C.dark, fontWeight: 900, marginBottom: 8, textTransform: "uppercase", lineHeight: 1.1 }}>{f.title}</div>
              <div style={{ fontSize: 14, fontWeight: 700, background: C.light, border: C.border, padding: "4px 8px" }}>{f.desc}</div>
            </BrutalCard>
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
  const roles = [{ icon: <User/>, label: "Owner" }, { icon: <Shield/>, label: "Admin" }, { icon: <Settings/>, label: "Operator" }, { icon: <Truck/>, label: "Driver" }];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
      <BgLogin />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 7vw", display: "grid", gridTemplateColumns: "1.2fr 0.8fr", alignItems: "center", gap: 64 }}>
        <div>
          <Label bg={C.accent}>SECURE PLATFORM</Label>
          <h2 style={{ fontSize: "clamp(46px, 5.5vw, 76px)", fontWeight: 900, color: C.dark, lineHeight: 0.9, textTransform: "uppercase", textShadow: "3px 3px 0px #fff" }}>Secure access for</h2>
          <h2 style={{ fontSize: "clamp(46px, 5.5vw, 76px)", fontWeight: 900, color: C.accent, lineHeight: 0.9, textTransform: "uppercase", textShadow: "3px 3px 0px #000", marginBottom: 32 }}>every plant role.</h2>
          <p style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.6, maxWidth: 500, marginBottom: 40, background: C.light, padding: 24, border: C.border, boxShadow: C.shadow }}>Plant Owner, Admin, Operator, Driver, Fleet Manager and Customer dashboards are separated by Plant ID. Your data stays private and controlled.</p>
          <BrutalCard bg={C.dark} color={C.light}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, borderBottom: "3px solid #fff", paddingBottom: 16 }}>
              <ShieldAlert size={28} color={C.accent} />
              <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "0.1em" }}>PRIVACY PROTECTION</span>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5, marginBottom: 24 }}>Each plant has separate login access. Owners cannot see other plants. Staff only see assigned plant data.</p>
            <div style={{ display: "flex", gap: 24, justifyContent: "center" }}>
              {roles.map(r => (
                <div key={r.label} style={{ textAlign: "center" }}>
                  <div style={{ width: 64, height: 64, background: C.light, color: C.dark, border: "3px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", boxShadow: "4px 4px 0px #FF3300" }}>{r.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, textTransform: "uppercase" }}>{r.label}</div>
                </div>
              ))}
            </div>
          </BrutalCard>
        </div>
        <BrutalCard bg={C.light} style={{ padding: 40, width: "100%", maxWidth: 500, margin: "0 auto" }}>
          {step === 0 ? (
            <>
              <div style={{ fontSize: 36, fontWeight: 900, color: C.dark, marginBottom: 12, textTransform: "uppercase", borderBottom: C.border, paddingBottom: 16 }}>Sign in</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 32, lineHeight: 1.5 }}>Continue securely with your registered Google account.</div>
              <button onClick={openLogin} style={{ width: "100%", padding: "16px 24px", border: C.border, background: C.light, color: C.dark, fontSize: 18, fontWeight: 900, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 24, boxShadow: C.shadow, textTransform: "uppercase" }}>
                <svg width="24" height="24" viewBox="0 0 18 18">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
                  <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.347 2.825.957 4.039l3.007-2.332z" fill="#FBBC05" />
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                <div style={{ flex: 1, height: 3, background: C.dark }} /><span style={{ fontSize: 16, fontWeight: 900 }}>OR</span><div style={{ flex: 1, height: 3, background: C.dark }} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 12, textTransform: "uppercase" }}>PHONE NUMBER</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ background: C.bg, border: C.border, padding: "16px", fontSize: 18, fontWeight: 900, flexShrink: 0 }}>+91</div>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="98200 00000"
                    style={{ flex: 1, background: C.light, border: C.border, padding: "16px", fontSize: 18, fontWeight: 900, outline: "none", width: "100%" }} />
                </div>
              </div>
              <button onClick={() => setStep(1)} style={{ width: "100%", padding: "16px", border: C.border, background: C.dark, color: C.light, fontSize: 18, fontWeight: 900, cursor: "pointer", textTransform: "uppercase", boxShadow: C.shadow, marginBottom: 24 }}>Send OTP via WhatsApp →</button>
              <p style={{ textAlign: "center", fontSize: 12, fontWeight: 800, lineHeight: 1.6 }}>By continuing, you agree to Concrete King <span style={{ textDecoration: "underline", cursor: "pointer" }}>Terms</span> & <span style={{ textDecoration: "underline", cursor: "pointer" }}>Privacy Policy</span>.</p>
            </>
          ) : (
            <>
              <button onClick={() => setStep(0)} style={{ background: "none", border: "none", color: C.dark, cursor: "pointer", fontSize: 16, fontWeight: 900, marginBottom: 24, padding: 0, display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase" }}>← Back</button>
              <div style={{ fontSize: 36, fontWeight: 900, color: C.dark, marginBottom: 12, textTransform: "uppercase", borderBottom: C.border, paddingBottom: 16 }}>Enter OTP</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 32 }}>Sent to +91 {phone || "98200 00000"} via WhatsApp</div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 40 }}>
                {otp.map((v, i) => (
                  <input key={i} ref={el => { otpRefs.current[i] = el; }} value={v} onChange={e => handleOtp(e.target.value, i)} maxLength={1}
                    style={{ width: 50, height: 60, textAlign: "center", background: v ? C.dark : C.bg, color: v ? C.light : C.dark, border: C.border, fontSize: 24, fontWeight: 900, outline: "none", boxShadow: C.smShadow }} />
                ))}
              </div>
              <button onClick={openLogin} style={{ width: "100%", padding: "16px", border: C.border, background: C.accent, color: C.light, fontSize: 18, fontWeight: 900, cursor: "pointer", textTransform: "uppercase", boxShadow: C.shadow, marginBottom: 24 }}>Verify & Enter App →</button>
              <p style={{ textAlign: "center", fontSize: 14, fontWeight: 800 }}>Didn't receive? <span style={{ textDecoration: "underline", cursor: "pointer" }}>Resend OTP</span></p>
            </>
          )}
        </BrutalCard>
      </div>
    </div>
  );
}

/* ════════════ NAVBAR ════════════ */
function NavBar({ slide, onGo }: { slide: number; onGo: (i: number) => void }) {
  const items = ["Home", "GPS", "Freshness", "Command", "Login"];
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100, height: 80, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px", background: C.bg, borderBottom: C.border }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <div style={{ width: 48, height: 48, background: C.dark, color: C.light, display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #fff", boxShadow: C.smShadow }}><CheckCircle2 size={28}/></div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.dark, letterSpacing: "0em", lineHeight: 1, textTransform: "uppercase" }}>Concrete King</div>
          <div style={{ fontSize: 12, color: C.dark, fontWeight: 800, letterSpacing: "0.1em", lineHeight: 1.4 }}>RMC OPERATIONS OS</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {items.map((it, i) => (
          <button key={it} onClick={() => onGo(i)}
            style={{ border: slide === i ? C.border : "none", background: slide === i ? C.dark : "transparent", color: slide === i ? C.light : C.dark, fontSize: 16, fontWeight: 900, padding: "12px 24px", cursor: "pointer", textTransform: "uppercase", boxShadow: slide === i ? C.smShadow : "none" }}>
            {it}
          </button>
        ))}
      </div>
      <button onClick={openLogin} style={{ padding: "14px 32px", border: C.border, background: C.accent, color: C.light, fontSize: 16, fontWeight: 900, cursor: "pointer", textTransform: "uppercase", boxShadow: C.smShadow, flexShrink: 0 }}>Login</button>
    </div>
  );
}

/* ════════════ DOTS + ARROWS ════════════ */
function Dots({ cur, total, onGo }: { cur: number; total: number; onGo: (i: number) => void }) {
  return (
    <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 16, zIndex: 100, alignItems: "center" }}>
      {Array.from({ length: total }).map((_, i) => (
        <button key={i} onClick={() => onGo(i)} style={{ border: C.border, background: i === cur ? C.dark : C.bg, width: i === cur ? 48 : 24, height: 24, cursor: "pointer", boxShadow: C.smShadow, transition: "width 0.2s" }} />
      ))}
    </div>
  );
}
function Arrows({ cur, total, onPrev, onNext }: { cur: number; total: number; onPrev: () => void; onNext: () => void }) {
  const btn = (dir: "left" | "right", onClick: () => void) => (
    <button onClick={onClick} style={{ position: "absolute", [dir]: 32, top: "50%", transform: "translateY(-50%)", zIndex: 100, width: 64, height: 64, border: C.border, background: C.light, color: C.dark, fontSize: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: C.shadow, fontWeight: 900 }}>{dir === "left" ? "←" : "→"}</button>
  );
  return (<>{cur > 0 && btn("left", onPrev)}{cur < total - 1 && btn("right", onNext)}</>);
}

/* ════════════ ROOT ════════════ */
export default function SiteBrutalistDeck() {
  const [cur, setCur] = useState(0);
  const [anim, setAnim] = useState("in");
  const TOTAL = 5;

  const go = useCallback((idx: number) => {
    if (idx === cur || idx < 0 || idx >= TOTAL) return;
    setAnim("out");
    setTimeout(() => { setCur(idx); setAnim("in"); }, 200);
  }, [cur]);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(cur + 1); if (e.key === "ArrowLeft") go(cur - 1); };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, [cur, go]);

  const SLIDES = [Slide1, Slide2, Slide3, Slide4, Slide5];
  const Slide = SLIDES[cur];

  return (
    <div style={{ width: "100%", height: "100vh", overflow: "hidden", background: C.bg, fontFamily: "'Space Mono', monospace", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        @keyframes brutalIn { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes brutalOut { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-40px); opacity: 0; } }
        input::placeholder { color: #888; }
        button:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0px #000 !important; }
        * { box-sizing: border-box; }
      `}</style>
      <NavBar slide={cur} onGo={go} />
      <div key={cur} style={{ width: "100%", height: "100%", paddingTop: 80, animation: `${anim === "in" ? "brutalIn" : "brutalOut"} 0.2s steps(4, end) both` }}>
        <Slide />
      </div>
      <Dots cur={cur} total={TOTAL} onGo={go} />
      <Arrows cur={cur} total={TOTAL} onPrev={() => go(cur - 1)} onNext={() => go(cur + 1)} />
    </div>
  );
}

export { SiteBrutalistDeck };
