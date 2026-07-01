import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, Play, CheckCircle2, AlertTriangle, ShieldAlert, Navigation, Clock, Zap, BarChart, Truck, Shield, Settings, User, ChevronLeft, ChevronRight } from "lucide-react";

/* ════════════════════════════════════════════════════════
   CONCRETE KING – RMC OPERATIONS OS (ETHEREAL GLASS VARIANT)
   5 full-screen slides · No scroll · Translucent, glowing, deep
════════════════════════════════════════════════════════ */

const C = {
  bgBase: "#0A0B10",
  glassBg: "rgba(255, 255, 255, 0.03)",
  glassBorder: "rgba(255, 255, 255, 0.08)",
  light: "#FFFFFF",
  textPrimary: "rgba(255, 255, 255, 0.95)",
  textSecondary: "rgba(255, 255, 255, 0.6)",
  cyan: "#4DEEEA",
  violet: "#B070FF",
  rose: "#FF8AA5",
  success: "#4DEEEA", // Ethereal cyan for success
  warning: "#FFD070", // Soft gold for caution
  critical: "#FF8AA5" // Rose for critical
};

const openLogin = () => {
  if (typeof window !== "undefined") {
    window.open("/login", "_blank", "noopener,noreferrer");
  }
};

/* ── ETHEREAL CANVAS BACKGROUNDS ── */
// Soft glowing gradient fields / gentle particle light, low and dreamy.
function createAuroraCanvas(colors: string[], speedMulti: number = 1) {
  return function AuroraCanvas() {
    const ref = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
      const cv = ref.current; if (!cv) return;
      const ctx = cv.getContext("2d"); if (!ctx) return;
      let ani = 0; let t = 0;
      const sz = () => { cv.width = cv.offsetWidth; cv.height = cv.offsetHeight; };
      sz(); window.addEventListener("resize", sz);
      
      const orbs = colors.map((col, i) => ({
        x: Math.random() * cv.width,
        y: Math.random() * cv.height,
        r: cv.width * 0.4 + Math.random() * cv.width * 0.2,
        col,
        vx: (Math.random() - 0.5) * 0.5 * speedMulti,
        vy: (Math.random() - 0.5) * 0.5 * speedMulti,
        ph: Math.random() * Math.PI * 2
      }));

      const draw = () => {
        t += 0.01 * speedMulti; 
        const W = cv.width, H = cv.height;
        ctx.fillStyle = C.bgBase; ctx.fillRect(0, 0, W, H);
        
        ctx.globalCompositeOperation = "screen";
        orbs.forEach(o => {
          o.x += o.vx;
          o.y += o.vy + Math.sin(t + o.ph) * 0.5;
          if (o.x < -o.r) o.x = W + o.r;
          if (o.x > W + o.r) o.x = -o.r;
          if (o.y < -o.r) o.y = H + o.r;
          if (o.y > H + o.r) o.y = -o.r;

          const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
          grad.addColorStop(0, o.col + "33"); // 20% opacity
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);
        });
        ctx.globalCompositeOperation = "source-over";
        ani = requestAnimationFrame(draw);
      };
      draw();
      return () => { cancelAnimationFrame(ani); window.removeEventListener("resize", sz); };
    }, []);
    return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", filter: "blur(60px)" }} />;
  };
}

const BgDrum = createAuroraCanvas([C.cyan, C.violet, "#224488"], 0.8);
const BgHighway = createAuroraCanvas([C.cyan, "#116688", C.rose], 1.2);
const BgPour = createAuroraCanvas([C.violet, C.rose, "#442266"], 1);
const BgCommand = createAuroraCanvas([C.cyan, C.violet, C.rose], 0.6);
const BgLogin = createAuroraCanvas(["#224488", C.violet, "#112244"], 0.5);

/* ── ETHEREAL GLASS CARD ── */
const GlassCard = ({ children, style = {}, className = "" }: any) => (
  <div className={className} style={{ 
    background: C.glassBg, 
    border: `1px solid ${C.glassBorder}`, 
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)", 
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    borderRadius: "24px",
    padding: 32, 
    color: C.textPrimary,
    transition: "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.5s ease",
    ...style 
  }}>
    {children}
  </div>
);

/* ── LABEL CHIP ── */
const Label = ({ children, color = C.cyan }: any) => (
  <div style={{ 
    display: "inline-block", 
    background: `rgba(255,255,255,0.05)`, 
    color: color, 
    padding: "6px 16px", 
    borderRadius: "30px",
    border: `1px solid rgba(255,255,255,0.1)`, 
    fontWeight: 300, 
    fontSize: 13, 
    letterSpacing: "0.2em", 
    textTransform: "uppercase", 
    marginBottom: 24,
    boxShadow: `0 0 20px ${color}22`
  }}>
    {children}
  </div>
);

/* ── ETHEREAL PROGRESS BAR ── */
function GlassBar({ pct, color, label, grade, client, risk }: any) {
  return (
    <GlassCard style={{ padding: "20px 24px", borderRadius: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 300, color: C.textPrimary, letterSpacing: "0.05em" }}>{label}</div>
          <div style={{ fontSize: 13, fontWeight: 300, color: C.textSecondary, marginTop: 4 }}>{client}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 200, color, textShadow: `0 0 16px ${color}66` }}>{pct}%</div>
          <div style={{ fontSize: 12, fontWeight: 400, color: C.textSecondary, letterSpacing: "0.1em", marginTop: 4 }}>{grade}</div>
        </div>
      </div>
      <div style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${pct}%`, background: color, borderRadius: 3, boxShadow: `0 0 10px ${color}` }} />
      </div>
      {risk && (
        <div style={{ marginTop: 16, color: C.critical, fontSize: 12, fontWeight: 400, letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={14} /> SLUMP RISK
        </div>
      )}
    </GlassCard>
  );
}

/* ════════════ SLIDE 1: HOME ════════════ */
function Slide1() {
  const [word, setWord] = useState(0);
  const words = ["Dispatch.", "Freshness.", "Fleet.", "Output."];
  const colors = [C.cyan, C.violet, C.rose, C.textPrimary];
  
  useEffect(() => { 
    const id = setInterval(() => setWord(w => (w + 1) % 4), 2800); 
    return () => clearInterval(id); 
  }, []);
  
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
      <BgDrum />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 6vw", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", alignItems: "center", gap: 60 }}>
        <div>
          <Label color={C.cyan}>READY MIX CONCRETE · OPERATIONS OS</Label>
          <h1 style={{ fontSize: "clamp(50px, 6vw, 76px)", fontWeight: 200, color: C.textPrimary, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Control your</h1>
          <h1 style={{ 
            fontSize: "clamp(50px, 6vw, 76px)", 
            fontWeight: 300, 
            lineHeight: 1.1, 
            color: colors[word], 
            letterSpacing: "-0.02em",
            marginBottom: 40, 
            minHeight: "1.2em",
            textShadow: `0 0 30px ${colors[word]}66`,
            transition: "color 1s ease"
          }}>
            {words[word]}
          </h1>
          <p style={{ fontSize: 18, fontWeight: 300, color: C.textSecondary, lineHeight: 1.7, maxWidth: 480, marginBottom: 48 }}>
            The only platform built ground-up for RMC plants. Live GPS, freshness tracking, IS-code AI, and fleet intelligence — <span style={{ color: C.textPrimary, fontWeight: 400 }}>one screen.</span>
          </p>
          <div style={{ display: "flex", gap: 20, marginBottom: 60 }}>
            <button onClick={openLogin} className="ethereal-btn" style={{ 
              padding: "16px 36px", 
              borderRadius: "30px", 
              background: `linear-gradient(135deg, ${C.cyan}22, ${C.violet}22)`, 
              border: `1px solid ${C.cyan}44`,
              color: C.cyan, 
              fontSize: 15, 
              fontWeight: 400, 
              letterSpacing: "0.1em",
              cursor: "pointer", 
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: `0 0 20px ${C.cyan}22`,
              backdropFilter: "blur(10px)"
            }}>
              Get Started <ArrowRight size={16} />
            </button>
            <button className="ethereal-btn-ghost" style={{ 
              padding: "16px 36px", 
              borderRadius: "30px", 
              background: "transparent", 
              border: `1px solid rgba(255,255,255,0.1)`, 
              color: C.textPrimary, 
              fontSize: 15, 
              fontWeight: 300, 
              letterSpacing: "0.1em",
              cursor: "pointer", 
              display: "flex", 
              alignItems: "center", 
              gap: 12 
            }}>
              <Play fill="currentColor" size={14} opacity={0.7} /> Watch Demo
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
          {[
            { icon: <Truck size={20} strokeWidth={1.5}/>, v: "4", l: "Live Pours", s: "3 plants active", c: C.cyan },
            { icon: <BarChart size={20} strokeWidth={1.5}/>, v: "143 m³", l: "Today's Output", s: "+18% vs avg", c: C.violet },
            { icon: <Clock size={20} strokeWidth={1.5}/>, v: "96.4%", l: "On-Time Rate", s: "Last 7 days", c: C.rose },
            { icon: <Settings size={20} strokeWidth={1.5}/>, v: "12", l: "Fleet Online", s: "2 in maintenance", c: C.textPrimary },
          ].map((k, i) => (
            <GlassCard key={i} style={{ padding: "24px", borderRadius: "20px" }}>
              <div style={{ marginBottom: 20, color: k.c, opacity: 0.8 }}>{k.icon}</div>
              <div style={{ fontSize: 32, fontWeight: 200, color: C.textPrimary, lineHeight: 1, marginBottom: 8, letterSpacing: "-0.02em" }}>{k.v}</div>
              <div style={{ fontSize: 13, fontWeight: 300, color: C.textSecondary, letterSpacing: "0.05em", marginBottom: 4 }}>{k.l}</div>
              <div style={{ fontSize: 12, fontWeight: 300, color: "rgba(255,255,255,0.4)" }}>{k.s}</div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════ SLIDE 2: GPS ════════════ */
function Slide2() {
  const trucks = [
    { id: "MH 46 DC 0814", status: "Moving", speed: "38 km/h", col: C.cyan },
    { id: "MH 48 T 5967", status: "Moving", speed: "42 km/h", col: C.cyan },
    { id: "MH 46 BB 9003", status: "Arrived", speed: "Site", col: C.violet },
    { id: "MH 46 DC 0813", status: "Idle", speed: "Plant", col: C.textSecondary },
  ];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
      <BgHighway />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 6vw", display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", gap: 80 }}>
        <div>
          <Label color={C.cyan}>LIVE GPS TRACKING</Label>
          <h2 style={{ fontSize: "clamp(46px, 5.5vw, 64px)", fontWeight: 200, color: C.textPrimary, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Every mixer.</h2>
          <h2 style={{ fontSize: "clamp(46px, 5.5vw, 64px)", fontWeight: 300, color: C.cyan, lineHeight: 1.1, letterSpacing: "-0.02em", textShadow: `0 0 30px ${C.cyan}55`, marginBottom: 32 }}>Always visible.</h2>
          <p style={{ fontSize: 18, fontWeight: 300, color: C.textSecondary, lineHeight: 1.7, maxWidth: 450 }}>
            Real-time location from your plant gate to the pour site. Watch live as mixers navigate Mumbai's roads. No calls. No guessing.
          </p>
        </div>
        <GlassCard style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "32px 32px 24px", borderBottom: `1px solid ${C.glassBorder}` }}>
            <div style={{ fontSize: 12, fontWeight: 400, color: C.textSecondary, letterSpacing: "0.2em", textTransform: "uppercase" }}>Fleet Status · Live</div>
          </div>
          <div style={{ padding: "16px 32px 32px" }}>
            {trucks.map((tr, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 0", borderBottom: i < 3 ? `1px solid ${C.glassBorder}` : "none" }}>
                <div style={{ 
                  width: 40, height: 40, 
                  borderRadius: "50%", 
                  background: `${tr.col}11`, 
                  border: `1px solid ${tr.col}44`, 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: tr.col,
                  boxShadow: `0 0 15px ${tr.col}22`
                }}>
                  <Navigation size={16} strokeWidth={1.5} style={{ transform: "rotate(45deg)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 300, color: C.textPrimary, letterSpacing: "0.05em" }}>{tr.id}</div>
                  <div style={{ fontSize: 13, fontWeight: 300, color: tr.col, marginTop: 4, letterSpacing: "0.05em" }}>{tr.status}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 200, color: C.textPrimary }}>
                    {tr.speed}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

/* ════════════ SLIDE 3: FRESHNESS ════════════ */
function Slide3() {
  const pours = [
    { id: "TM-0814", pct: 74, color: C.cyan, grade: "M25", client: "P.G. Constructions", risk: false },
    { id: "TM-5967", pct: 46, color: C.warning, grade: "M20", client: "Ananth Corporation", risk: false },
    { id: "TM-9003", pct: 12, color: C.critical, grade: "M30", client: "DS Infrastructure", risk: true },
    { id: "TM-0813", pct: 62, color: C.cyan, grade: "M10", client: "Hiravati Agro", risk: false },
  ];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
      <BgPour />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 6vw", display: "grid", gridTemplateColumns: "1fr 1.2fr", alignItems: "center", gap: 60 }}>
        <div>
          <Label color={C.violet}>FRESHNESS GUARD</Label>
          <h2 style={{ fontSize: "clamp(46px, 5.5vw, 64px)", fontWeight: 200, color: C.textPrimary, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Never lose</h2>
          <h2 style={{ fontSize: "clamp(46px, 5.5vw, 64px)", fontWeight: 300, color: C.violet, lineHeight: 1.1, letterSpacing: "-0.02em", textShadow: `0 0 30px ${C.violet}55`, marginBottom: 32 }}>a pour again.</h2>
          <p style={{ fontSize: 18, fontWeight: 300, color: C.textSecondary, lineHeight: 1.7, marginBottom: 40 }}>
            IS 4926 mandates concrete be placed within 90 minutes of batching. Our real-time countdown rings alert your team before slump loss — automatically.
          </p>
          <div style={{ display: "flex", gap: 24 }}>
            {[{ c: C.cyan, l: "Safe >40%" }, { c: C.warning, l: "Caution" }, { c: C.critical, l: "Critical" }].map(x => (
              <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 300, color: C.textSecondary, letterSpacing: "0.05em" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: x.c, boxShadow: `0 0 8px ${x.c}` }} />
                {x.l}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {pours.map(p => <GlassBar key={p.id} {...p} />)}
        </div>
      </div>
    </div>
  );
}

/* ════════════ SLIDE 4: COMMAND ════════════ */
function Slide4() {
  const feats = [
    { icon: <Navigation size={24} strokeWidth={1.5}/>, title: "GPS Tracking", desc: "Live, always", col: C.cyan },
    { icon: <Clock size={24} strokeWidth={1.5}/>, title: "Freshness Guard", desc: "IS-code compliant", col: C.violet },
    { icon: <Zap size={24} strokeWidth={1.5}/>, title: "Smart Plant AI", desc: "Voice & text", col: C.rose },
    { icon: <BarChart size={24} strokeWidth={1.5}/>, title: "Demand Forecast", desc: "Hourly insights", col: C.warning },
    { icon: <Truck size={24} strokeWidth={1.5}/>, title: "Fleet Control", desc: "Every mixer", col: C.textPrimary },
  ];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <BgCommand />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 6vw", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <Label color={C.cyan}>COMMAND CENTER</Label>
        <h2 style={{ fontSize: "clamp(46px, 5.5vw, 64px)", fontWeight: 200, color: C.textPrimary, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 8 }}>One screen.</h2>
        <h2 style={{ fontSize: "clamp(46px, 5.5vw, 64px)", fontWeight: 300, color: C.cyan, lineHeight: 1.1, letterSpacing: "-0.02em", textShadow: `0 0 30px ${C.cyan}44`, marginBottom: 32 }}>Total plant intelligence.</h2>
        <p style={{ fontSize: 18, fontWeight: 300, color: C.textSecondary, lineHeight: 1.7, maxWidth: 700, marginBottom: 64 }}>
          Dispatch, freshness, fleet, and demand forecasting — all unified. Built for plant managers who need answers in seconds, not minutes.
        </p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
          {feats.map((f, i) => (
            <GlassCard key={i} style={{ 
              padding: "32px 24px", 
              textAlign: "center", 
              minWidth: 180, 
              flex: "1 1 160px", 
              maxWidth: 220,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              borderRadius: "24px",
              background: `linear-gradient(180deg, ${C.glassBg}, transparent)`
            }}>
              <div style={{ 
                width: 56, height: 56, 
                borderRadius: "50%", 
                background: `${f.col}11`, 
                border: `1px solid ${f.col}33`, 
                display: "flex", alignItems: "center", justifyContent: "center",
                color: f.col,
                marginBottom: 24,
                boxShadow: `0 0 20px ${f.col}22`
              }}>
                {f.icon}
              </div>
              <div style={{ fontSize: 16, color: C.textPrimary, fontWeight: 300, marginBottom: 8, letterSpacing: "0.05em" }}>{f.title}</div>
              <div style={{ fontSize: 13, fontWeight: 300, color: C.textSecondary }}>{f.desc}</div>
            </GlassCard>
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
  
  const roles = [
    { icon: <User strokeWidth={1.5} size={20}/>, label: "Owner" }, 
    { icon: <Shield strokeWidth={1.5} size={20}/>, label: "Admin" }, 
    { icon: <Settings strokeWidth={1.5} size={20}/>, label: "Operator" }, 
    { icon: <Truck strokeWidth={1.5} size={20}/>, label: "Driver" }
  ];
  
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
      <BgLogin />
      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "0 6vw", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", alignItems: "center", gap: 80 }}>
        <div>
          <Label color={C.violet}>SECURE PLATFORM</Label>
          <h2 style={{ fontSize: "clamp(46px, 5.5vw, 64px)", fontWeight: 200, color: C.textPrimary, lineHeight: 1.1, letterSpacing: "-0.02em" }}>Secure access for</h2>
          <h2 style={{ fontSize: "clamp(46px, 5.5vw, 64px)", fontWeight: 300, color: C.violet, lineHeight: 1.1, letterSpacing: "-0.02em", textShadow: `0 0 30px ${C.violet}55`, marginBottom: 40 }}>every plant role.</h2>
          <p style={{ fontSize: 18, fontWeight: 300, color: C.textSecondary, lineHeight: 1.7, maxWidth: 500, marginBottom: 48 }}>
            Plant Owner, Admin, Operator, Driver, Fleet Manager and Customer dashboards are separated by Plant ID. Your data stays private and controlled.
          </p>
          <div style={{ display: "flex", gap: 32 }}>
            {roles.map(r => (
              <div key={r.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ 
                  width: 48, height: 48, 
                  borderRadius: "50%", 
                  background: `rgba(255,255,255,0.03)`, 
                  border: `1px solid ${C.glassBorder}`, 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: C.textPrimary,
                  backdropFilter: "blur(10px)"
                }}>
                  {r.icon}
                </div>
                <div style={{ fontSize: 13, fontWeight: 300, color: C.textSecondary, letterSpacing: "0.05em" }}>{r.label}</div>
              </div>
            ))}
          </div>
        </div>
        
        <GlassCard style={{ padding: "40px", width: "100%", maxWidth: 440, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 24, fontWeight: 200, color: C.textPrimary, marginBottom: 8, letterSpacing: "0.05em" }}>
              {step === 0 ? "Sign In" : "Verify Number"}
            </div>
            <div style={{ fontSize: 14, color: C.textSecondary, fontWeight: 300 }}>
              {step === 0 ? "Enter your phone to continue" : `Code sent to +91 ${phone}`}
            </div>
          </div>
          
          {step === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <button onClick={openLogin} style={{ 
                width: "100%", padding: "14px", borderRadius: "12px", 
                background: "rgba(255,255,255,0.05)", border: `1px solid ${C.glassBorder}`,
                color: C.textPrimary, fontSize: 15, fontWeight: 300, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                transition: "background 0.2s"
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>
              
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ flex: 1, height: 1, background: C.glassBorder }}></div>
                <div style={{ fontSize: 12, color: C.textSecondary, fontWeight: 300 }}>OR</div>
                <div style={{ flex: 1, height: 1, background: C.glassBorder }}></div>
              </div>
              
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ 
                  padding: "0 16px", borderRadius: "12px", 
                  background: "rgba(0,0,0,0.2)", border: `1px solid ${C.glassBorder}`,
                  color: C.textSecondary, display: "flex", alignItems: "center",
                  fontSize: 15, fontWeight: 300
                }}>
                  +91
                </div>
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="Phone number"
                  style={{ 
                    flex: 1, padding: "14px 16px", borderRadius: "12px", 
                    background: "rgba(0,0,0,0.2)", border: `1px solid ${C.glassBorder}`,
                    color: C.textPrimary, fontSize: 15, fontWeight: 300,
                    outline: "none"
                  }} 
                />
              </div>
              
              <button 
                onClick={() => setStep(1)} 
                disabled={phone.length < 10}
                style={{ 
                  width: "100%", padding: "16px", borderRadius: "12px", 
                  background: phone.length >= 10 ? `linear-gradient(135deg, ${C.violet}88, ${C.cyan}88)` : "rgba(255,255,255,0.05)", 
                  border: `1px solid ${phone.length >= 10 ? C.violet : C.glassBorder}`,
                  color: phone.length >= 10 ? C.light : C.textSecondary, 
                  fontSize: 15, fontWeight: 400, letterSpacing: "0.05em",
                  cursor: phone.length >= 10 ? "pointer" : "not-allowed",
                  marginTop: 8,
                  transition: "all 0.3s"
                }}
              >
                Send OTP via WhatsApp
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                {otp.map((d, i) => (
                  <input 
                    key={i} 
                    ref={el => otpRefs.current[i] = el}
                    type="text" 
                    maxLength={1} 
                    value={d} 
                    onChange={e => handleOtp(e.target.value, i)}
                    style={{ 
                      width: 44, height: 52, borderRadius: "12px", 
                      background: "rgba(0,0,0,0.2)", 
                      border: `1px solid ${d ? C.cyan : C.glassBorder}`,
                      color: C.cyan, fontSize: 20, fontWeight: 300, textAlign: "center",
                      outline: "none",
                      boxShadow: d ? `0 0 10px ${C.cyan}33` : "none",
                      transition: "all 0.2s"
                    }} 
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <button onClick={() => setStep(0)} style={{ 
                  padding: "16px", borderRadius: "12px", 
                  background: "rgba(255,255,255,0.05)", border: `1px solid ${C.glassBorder}`,
                  color: C.textPrimary, cursor: "pointer"
                }}>
                  <ChevronLeft size={20} />
                </button>
                <button onClick={openLogin} style={{ 
                  flex: 1, padding: "16px", borderRadius: "12px", 
                  background: `linear-gradient(135deg, ${C.cyan}88, ${C.violet}88)`, 
                  border: `1px solid ${C.cyan}`,
                  color: C.light, fontSize: 15, fontWeight: 400, letterSpacing: "0.05em",
                  cursor: "pointer",
                  boxShadow: `0 0 20px ${C.cyan}44`
                }}>
                  Verify & Enter App
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

/* ════════════ MAIN DECK COMPONENT ════════════ */
export function EtherealGlassDeck() {
  const [slide, setSlide] = useState(0);
  const slides = [<Slide1/>, <Slide2/>, <Slide3/>, <Slide4/>, <Slide5/>];
  
  const next = useCallback(() => setSlide(s => Math.min(slides.length - 1, s + 1)), [slides.length]);
  const prev = useCallback(() => setSlide(s => Math.max(0, s - 1)), []);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, prev]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'Outfit', sans-serif; background: ${C.bgBase}; overflow: hidden; }
        
        .ethereal-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 25px ${C.cyan}44 !important;
        }
        .ethereal-btn-ghost:hover {
          background: rgba(255,255,255,0.05) !important;
        }
        
        .nav-item {
          color: ${C.textSecondary};
          cursor: pointer;
          font-size: 13px;
          font-weight: 300;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          transition: color 0.3s ease;
        }
        .nav-item.active { color: ${C.cyan}; text-shadow: 0 0 10px ${C.cyan}66; }
        .nav-item:hover { color: ${C.textPrimary}; }
      `}</style>
      
      <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden", background: C.bgBase }}>
        {/* Slides Track */}
        <div style={{ 
          display: "flex", 
          width: `${slides.length * 100}%`, 
          height: "100%", 
          transform: `translateX(-${(slide / slides.length) * 100}%)`, 
          transition: "transform 1s cubic-bezier(0.2, 0.8, 0.2, 1)" 
        }}>
          {slides.map((S, i) => (
            <div key={i} style={{ width: `${100 / slides.length}%`, height: "100%" }}>
              {S}
            </div>
          ))}
        </div>

        {/* Top Navbar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "32px 6vw", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: "8px", background: `linear-gradient(135deg, ${C.cyan}, ${C.violet})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 20px ${C.cyan}66` }}>
              <div style={{ width: 14, height: 14, border: `2px solid ${C.bgBase}`, borderRadius: "4px" }}></div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 400, color: C.textPrimary, letterSpacing: "0.1em" }}>CONCRETE<span style={{ fontWeight: 200 }}>KING</span></div>
          </div>
          <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
            {["Home", "GPS", "Freshness", "Command"].map((item, i) => (
              <div key={item} className={`nav-item ${slide === i ? "active" : ""}`} onClick={() => setSlide(i)}>{item}</div>
            ))}
            <div onClick={() => setSlide(4)} className={`nav-item ${slide === 4 ? "active" : ""}`} style={{ padding: "8px 24px", borderRadius: "20px", border: `1px solid ${slide === 4 ? C.cyan : C.glassBorder}`, color: C.textPrimary }}>Login</div>
          </div>
        </div>

        {/* Navigation Controls */}
        <div style={{ position: "absolute", bottom: 40, left: "6vw", right: "6vw", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10 }}>
          <div style={{ display: "flex", gap: 12 }}>
            {slides.map((_, i) => (
              <div key={i} onClick={() => setSlide(i)} style={{ 
                height: 4, 
                width: slide === i ? 32 : 12, 
                borderRadius: 2,
                background: slide === i ? C.cyan : C.glassBorder, 
                cursor: "pointer", 
                transition: "all 0.5s ease",
                boxShadow: slide === i ? `0 0 10px ${C.cyan}66` : "none"
              }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <button onClick={prev} disabled={slide === 0} style={{ 
              width: 48, height: 48, borderRadius: "50%", 
              background: "rgba(255,255,255,0.03)", border: `1px solid ${C.glassBorder}`, 
              color: slide === 0 ? C.textSecondary : C.textPrimary, 
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: slide === 0 ? "default" : "pointer",
              opacity: slide === 0 ? 0.3 : 1,
              backdropFilter: "blur(10px)",
              transition: "all 0.3s"
            }}>
              <ChevronLeft size={20} strokeWidth={1.5} />
            </button>
            <button onClick={next} disabled={slide === slides.length - 1} style={{ 
              width: 48, height: 48, borderRadius: "50%", 
              background: "rgba(255,255,255,0.03)", border: `1px solid ${C.glassBorder}`, 
              color: slide === slides.length - 1 ? C.textSecondary : C.textPrimary, 
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: slide === slides.length - 1 ? "default" : "pointer",
              opacity: slide === slides.length - 1 ? 0.3 : 1,
              backdropFilter: "blur(10px)",
              transition: "all 0.3s"
            }}>
              <ChevronRight size={20} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default EtherealGlassDeck;