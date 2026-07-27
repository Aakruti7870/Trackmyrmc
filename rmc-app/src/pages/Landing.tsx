import { useState, useEffect } from "react";
import { MapPin, MousePointerClick, ShieldCheck, BadgeCheck, Crown, ArrowRight, LogIn } from "lucide-react";
import SocialLinksBar from "@/components/SocialLinksBar";
import FeatureCarousel from "@/components/FeatureCarousel";
import { hasCompletedOnboarding, markOnboardingComplete } from "@/lib/onboarding";

/* ════════════════════════════════════════════════════════
   CONCRETE KING – RMC OPERATIONS OS
   Compact 2-step experience: a single Home hero whose CTAs
   take the user straight to the real /login page (SPA nav).
════════════════════════════════════════════════════════ */

/* Theme-driven palette — reads the app-wide Day/Night tokens so the landing
   page re-themes together with the rest of the app. */
const C = {
  teal:   "var(--gold)",
  dark:   "var(--bg)",
  panel:  "var(--panel)",
  border: "var(--line)",
  text:   "var(--text)",
  muted:  "var(--muted)",
};

/* SPA-navigate to the real main-app /login page (wouter listens to popstate). */
const openLogin = () => {
  if (typeof window === "undefined") return;
  window.history.pushState({}, "", "/login");
  window.dispatchEvent(new PopStateEvent("popstate"));
};

/* ── FLAT CARD ── */
const Glass=({children,style={},className=""}:{children:React.ReactNode;style?:React.CSSProperties;className?:string})=>(
  <div className={className} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:20,boxShadow:"0 1px 3px rgba(var(--shadow-rgb),0.06), 0 8px 24px rgba(var(--shadow-rgb),0.05)",...style}}>{children}</div>
);

/* ── LABEL CHIP ── */
const Label=({children,color=C.teal}:{children:React.ReactNode;color?:string})=>(
  <div className="ck-label" style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11,fontWeight:700,letterSpacing:"0.18em",color,fontFamily:"'JetBrains Mono',monospace",marginBottom:18}}>
    {children}
  </div>
);

/* ════════════ HOME ════════════ */
function Home(){
  const [word,setWord]=useState(0);
  const words=["Dispatch.","Freshness.","Fleet.","Output."];
  const colors=[C.teal,"#16a34a","#2563eb","#d97706"];
  useEffect(()=>{const id=setInterval(()=>setWord(w=>(w+1)%4),2800);return()=>clearInterval(id);},[]);
  return(
    <div style={{position:"relative",width:"100%",height:"100%",display:"flex",alignItems:"center"}}>
      <div className="ck-hero-grid" style={{position:"relative",zIndex:2,width:"100%",padding:"0 6vw",display:"grid",gridTemplateColumns:"1.15fr 0.85fr",alignItems:"center",gap:40}}>
        <div>
          <Label>READY MIX CONCRETE · OPERATIONS OS</Label>
          <h1 className="ck-h1" style={{fontSize:"clamp(40px,5.5vw,72px)",fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:4,fontFamily:"Inter,sans-serif"}}>Control your</h1>
          <h1 className="ck-h1 ck-h1-word" style={{fontSize:"clamp(40px,5.5vw,72px)",fontWeight:900,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:24,fontFamily:"Inter,sans-serif",color:colors[word],transition:"color 0.4s",minHeight:"1.1em"}}>{words[word]}</h1>
          <p className="ck-sub" style={{fontSize:16,color:C.muted,lineHeight:1.75,maxWidth:430,marginBottom:36}}>The only platform built ground-up for RMC plants. Live GPS, freshness tracking, IS-code AI, and fleet intelligence — <em style={{color:C.text,fontStyle:"normal",fontWeight:500}}>one screen.</em></p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[
              {Icon:MapPin,l:"Live Tracking",s:"Real-time mixer GPS"},
              {Icon:MousePointerClick,l:"Easy to Use",s:"Order in seconds"},
              {Icon:ShieldCheck,l:"KYC Verified Users",s:"Aadhaar-checked"},
              {Icon:BadgeCheck,l:"Verified Plants",s:"Approved suppliers"},
            ].map((k,i)=>(
              <Glass key={i} className="ck-feature-card" style={{padding:"16px 12px"}}>
                <div className="ck-feature-icon" style={{marginBottom:10,color:C.teal,display:"flex"}}><k.Icon size={22}/></div>
                <div style={{fontSize:13,color:C.text,fontWeight:700,marginBottom:3,lineHeight:1.2}}>{k.l}</div>
                <div style={{fontSize:10,color:C.muted}}>{k.s}</div>
              </Glass>
            ))}
          </div>
        </div>
        <div className="ck-next-col" style={{display:"flex",justifyContent:"flex-end"}}>
          <button onClick={openLogin} style={{textAlign:"left",cursor:"pointer",background:"none",border:"none",padding:0,width:"100%",maxWidth:340}}>
            <Glass className="ck-signin-card" style={{padding:"26px 26px",display:"flex",flexDirection:"column",gap:18}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:46,height:46,borderRadius:13,background:"rgba(15,118,110,0.10)",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:C.teal,flexShrink:0}}><LogIn size={22}/></div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.16em",color:C.teal,fontFamily:"'JetBrains Mono',monospace",marginBottom:4}}>NEXT</div>
                  <div style={{fontSize:18,fontWeight:800,color:C.text,fontFamily:"Inter,sans-serif",lineHeight:1.1}}>Sign in to continue</div>
                </div>
              </div>
              <p style={{fontSize:13,color:C.muted,lineHeight:1.6,margin:0}}>Customers and plant staff — one quick step to your dashboard.</p>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                <span style={{fontSize:13,fontWeight:700,color:C.text}}>Go to Login</span>
                <span style={{width:34,height:34,borderRadius:"50%",background:C.teal,color:"#ffffff",display:"flex",alignItems:"center",justifyContent:"center"}}><ArrowRight size={18}/></span>
              </div>
            </Glass>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════ NAVBAR ════════════ */
function NavBar(){
  return(
    <div style={{position:"absolute",top:0,left:0,right:0,zIndex:100,height:"calc(60px + env(safe-area-inset-top, 0px))",paddingTop:"env(safe-area-inset-top, 0px)",display:"flex",alignItems:"center",justifyContent:"space-between",paddingLeft:"max(20px, env(safe-area-inset-left, 0px))",paddingRight:"max(20px, env(safe-area-inset-right, 0px))",background:"var(--header-bg)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",borderBottom:`1px solid ${C.border}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{width:32,height:32,borderRadius:9,background:C.teal,display:"flex",alignItems:"center",justifyContent:"center"}}><Crown size={18} color="#ffffff"/></div>
        <div>
          <div style={{fontSize:14,fontWeight:900,color:C.text,letterSpacing:"-0.02em",lineHeight:1,fontFamily:"Inter,sans-serif"}}>Concrete King</div>
          <div style={{fontSize:8,color:C.muted,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.15em",lineHeight:1.2}}>RMC OPERATIONS OS</div>
        </div>
      </div>
      <button onClick={openLogin} style={{padding:"9px 24px",borderRadius:99,border:"none",background:C.teal,color:"#ffffff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0}}>Login</button>
    </div>
  );
}

/* ════════════ ROOT ════════════ */
export default function Landing(){
  const [showOnboarding, setShowOnboarding] = useState(() => !hasCompletedOnboarding());
  if (showOnboarding) {
    return <FeatureCarousel onDone={() => { markOnboardingComplete(); setShowOnboarding(false); }} />;
  }
  return(
    <div className="ck-root" style={{width:"100%",overflow:"hidden",background:C.dark,fontFamily:"Inter,sans-serif",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap');
        @keyframes ckFadeIn{from{opacity:0;transform:scale(0.983)}to{opacity:1;transform:scale(1)}}
        input::placeholder{color:var(--muted)}
        .ck-deck button:hover{opacity:0.92}
        /* Fit the landing screen exactly to the viewport (dynamic vh where
           supported) so it never scrolls; falls back to vh on old browsers. */
        .ck-root{height:100vh;height:100dvh;max-height:100dvh;}
        @media (max-width:920px){
          .ck-hero-grid{grid-template-columns:1fr !important;gap:14px !important;align-content:center;padding:10px 20px !important;overflow:hidden;max-height:100%}
          .ck-next-col{justify-content:stretch !important;order:-1}
          .ck-next-col button{max-width:100% !important}
          .ck-h1{font-size:clamp(30px,8.5vw,44px) !important;margin-bottom:2px !important}
          .ck-h1-word{margin-bottom:12px !important}
          .ck-sub{font-size:13px !important;line-height:1.5 !important;margin-bottom:14px !important;max-width:100% !important}
          .ck-label{margin-bottom:8px !important}
          .ck-signin-card{padding:16px !important;gap:12px !important}
          .ck-feature-card{padding:11px 10px !important}
          .ck-feature-icon{margin-bottom:6px !important}
        }
        @media (max-width:560px){
          .ck-hero-grid > div:first-child > div:last-child{grid-template-columns:repeat(2,1fr) !important}
        }
        /* Very short phones (e.g. 360x640): trim further so it still fits. */
        @media (max-width:920px) and (max-height:720px){
          .ck-hero-grid{gap:10px !important}
          .ck-h1{font-size:clamp(26px,7.5vw,38px) !important}
          .ck-sub{margin-bottom:10px !important}
          .ck-signin-card{padding:13px !important;gap:9px !important}
        }
      `}</style>
      <div className="ck-deck" style={{width:"100%",height:"100%",position:"relative"}}>
        <NavBar/>
        <div style={{position:"absolute",inset:0,paddingTop:"calc(60px + env(safe-area-inset-top, 0px))",paddingBottom:"env(safe-area-inset-bottom, 0px)",animation:"ckFadeIn 0.26s cubic-bezier(0.4,0,0.2,1) both"}}>
          <div style={{width:"100%",height:"100%",position:"relative"}}>
            <Home/>
          </div>
        </div>
        {/* Social links — bottom-right of the landing screen */}
        <div className="ck-socials" style={{position:"absolute",right:14,bottom:"calc(10px + env(safe-area-inset-bottom, 0px))",zIndex:110}}>
          <SocialLinksBar compact/>
        </div>
      </div>
    </div>
  );
}
