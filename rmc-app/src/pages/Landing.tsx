import { useState, useEffect, useCallback } from "react";
import {
  Truck, Package, Timer, Wrench, Satellite, Bot, BarChart3,
  Crown, ShieldCheck, Settings, Lock, Play, AlertTriangle,
  ArrowUpRight, ChevronLeft, ChevronRight,
} from "lucide-react";
import SocialLinksBar from "@/components/SocialLinksBar";
import drumImg from "../assets/landing/slide1-drum.png";
import fleetImg from "../assets/landing/slide2-fleet.png";
import textureImg from "../assets/landing/slide3-texture.png";
import commandImg from "../assets/landing/slide4-command.png";
import plantImg from "../assets/landing/slide5-plant.png";

/* ════════════════════════════════════════════════════════
   CONCRETE KING – RMC OPERATIONS OS
   5 full-screen cinematic slides · No scroll · real photo BGs
   (generated assets in ../assets/landing) + legibility overlays.
   Auth actions navigate to the real /login page (SPA nav).
════════════════════════════════════════════════════════ */

const C = {
  teal:   "#00C9A7",
  dark:   "#050A0C",
  panel:  "rgba(10,22,24,0.78)",
  border: "rgba(0,201,167,0.15)",
  text:   "#E8F0EE",
  muted:  "#7A8F8D",
};

/* SPA-navigate to the real main-app /login page (wouter listens to popstate). */
const openLogin = () => {
  if (typeof window === "undefined") return;
  window.history.pushState({}, "", "/login");
  window.dispatchEvent(new PopStateEvent("popstate"));
};

/* ── LIVE FEED CLIPS (served from /public/ck/videos) ── */
const FEED = [
  { video: "ck-plant.mp4",    label: "Concrete Plant",   desc: "Modern RMC batching plant" },
  { video: "ck-batching.mp4", label: "Batching Process", desc: "Precision mix batching" },
  { video: "ck-transit.mp4",  label: "Transit Mixer",    desc: "En-route to your site" },
  { video: "ck-arrival.mp4",  label: "Site Arrival",     desc: "On-time delivery" },
  { video: "ck-pouring.mp4",  label: "Concrete Pouring", desc: "Pour in progress" },
  { video: "ck-quality.mp4",  label: "Quality Testing",  desc: "Slump & cube tests" },
];

/* ── PHOTO BACKGROUND (cinematic slide image + legibility overlay) ── */
function PhotoBg({src,overlay,pos="center",lazy=false}:{src:string;overlay?:string;pos?:string;lazy?:boolean}){
  return(
    <div style={{position:"absolute",inset:0,overflow:"hidden"}}>
      <img src={src} alt="" loading={lazy?"lazy":"eager"} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:pos}}/>
      <div style={{position:"absolute",inset:0,background:overlay??`linear-gradient(90deg, ${C.dark} 0%, rgba(5,10,12,0.82) 42%, rgba(5,10,12,0.35) 100%)`}}/>
      <div style={{position:"absolute",inset:0,background:`linear-gradient(0deg, ${C.dark} 0%, rgba(5,10,12,0) 42%)`}}/>
    </div>
  );
}

/* ── GLASS CARD ── */
const Glass=({children,style={}}:{children:React.ReactNode;style?:React.CSSProperties})=>(
  <div style={{background:C.panel,backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",border:`1px solid ${C.border}`,borderRadius:20,...style}}>{children}</div>
);

/* ── LABEL CHIP ── */
const Label=({children,color=C.teal}:{children:React.ReactNode;color?:string})=>(
  <div style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11,fontWeight:700,letterSpacing:"0.18em",color,fontFamily:"'JetBrains Mono',monospace",marginBottom:18}}>
    {children}
  </div>
);

/* ── RING SVG ── */
function Ring({pct,color,size=130,label,grade,client,risk}:{pct:number;color:string;size?:number;label:string;grade:string;client:string;risk:boolean}){
  const r=50; const circ=2*Math.PI*r; const off=circ-(pct/100)*circ;
  return(
    <Glass style={{padding:"18px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center"}}>
      <svg width={size} height={size} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="rgba(5,15,12,0.7)" stroke="rgba(255,255,255,0.06)" strokeWidth="10"/>
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          transform="rotate(-90 60 60)" style={{filter:`drop-shadow(0 0 5px ${color})`}}/>
        <text x="60" y="55" textAnchor="middle" fontSize="22" fontWeight="900" fill={color} fontFamily="'JetBrains Mono',monospace">{pct}%</text>
        <text x="60" y="72" textAnchor="middle" fontSize="10" fill={C.muted} fontFamily="monospace">{grade}</text>
      </svg>
      <div style={{fontSize:12,color:C.text,fontWeight:700,marginBottom:2}}>{label}</div>
      <div style={{fontSize:10,color:C.muted,fontFamily:"'JetBrains Mono',monospace",marginBottom:risk?4:0}}>{client}</div>
      {risk&&<div style={{fontSize:9,color:"#F5455C",fontWeight:700,display:"flex",alignItems:"center",gap:4}}><AlertTriangle size={11}/> SLUMP RISK</div>}
    </Glass>
  );
}

/* ════════════ SLIDE 1: HOME ════════════ */
function Slide1(){
  const [word,setWord]=useState(0);
  const words=["Dispatch.","Freshness.","Fleet.","Output."];
  const colors=[C.teal,"#4ADE80","#60A5FA","#F5A524"];
  useEffect(()=>{const id=setInterval(()=>setWord(w=>(w+1)%4),2800);return()=>clearInterval(id);},[]);
  return(
    <div style={{position:"relative",width:"100%",height:"100%",display:"flex",alignItems:"center"}}>
      <PhotoBg src={drumImg}/>
      <div style={{position:"relative",zIndex:2,width:"100%",padding:"0 6vw",display:"grid",gridTemplateColumns:"1.15fr 0.85fr",alignItems:"center",gap:40}}>
        <div>
          <Label>READY MIX CONCRETE · OPERATIONS OS</Label>
          <h1 style={{fontSize:"clamp(40px,5.5vw,72px)",fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:4,fontFamily:"Inter,sans-serif"}}>Control your</h1>
          <h1 style={{fontSize:"clamp(40px,5.5vw,72px)",fontWeight:900,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:24,fontFamily:"Inter,sans-serif",color:colors[word],transition:"color 0.4s",minHeight:"1.1em"}}>{words[word]}</h1>
          <p style={{fontSize:16,color:C.muted,lineHeight:1.75,maxWidth:430,marginBottom:36}}>The only platform built ground-up for RMC plants. Live GPS, freshness tracking, IS-code AI, and fleet intelligence — <em style={{color:C.text,fontStyle:"normal",fontWeight:500}}>one screen.</em></p>
          <div style={{display:"flex",gap:14,marginBottom:48,flexWrap:"wrap"}}>
            <button onClick={openLogin} style={{padding:"13px 32px",borderRadius:12,border:"none",background:C.teal,color:"#04110E",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"Inter,sans-serif",boxShadow:`0 6px 28px rgba(0,201,167,0.38)`,letterSpacing:"-0.01em"}}>Get Started →</button>
            <button onClick={openLogin} style={{padding:"13px 28px",borderRadius:12,border:`1px solid ${C.border}`,background:"rgba(0,201,167,0.04)",color:C.muted,fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",gap:8}}>
              <span style={{width:22,height:22,borderRadius:"50%",border:`1px solid ${C.muted}`,display:"flex",alignItems:"center",justifyContent:"center"}}><Play size={9} fill={C.muted} color={C.muted}/></span>Watch Demo
            </button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[
              {Icon:Truck,v:"4",l:"Live Pours",s:"3 plants active"},
              {Icon:Package,v:"143 m³",l:"Today's Output",s:"+18% vs avg"},
              {Icon:Timer,v:"96.4%",l:"On-Time Rate",s:"Last 7 days"},
              {Icon:Wrench,v:"12",l:"Fleet Online",s:"2 in maintenance"},
            ].map((k,i)=>(
              <Glass key={i} style={{padding:"14px 12px"}}>
                <div style={{marginBottom:8,color:C.teal,display:"flex"}}><k.Icon size={18}/></div>
                <div style={{fontSize:20,fontWeight:900,color:C.teal,fontFamily:"'JetBrains Mono',monospace",lineHeight:1,marginBottom:3}}>{k.v}</div>
                <div style={{fontSize:11,color:C.text,fontWeight:600,marginBottom:2}}>{k.l}</div>
                <div style={{fontSize:10,color:C.muted}}>{k.s}</div>
              </Glass>
            ))}
          </div>
        </div>
        <div/>
      </div>
    </div>
  );
}

/* ════════════ SLIDE 2: GPS ════════════ */
function Slide2(){
  const trucks=[
    {id:"MH 46 DC 0814",status:"Moving",speed:"38 km/h",col:C.teal},
    {id:"MH 48 T 5967",status:"Moving",speed:"42 km/h",col:C.teal},
    {id:"MH 46 BB 9003",status:"Arrived",speed:"Site",col:"#4ADE80"},
    {id:"MH 46 DC 0813",status:"Idle",speed:"Plant",col:C.muted},
  ];
  return(
    <div style={{position:"relative",width:"100%",height:"100%",display:"flex",alignItems:"flex-end",paddingBottom:"8vh"}}>
      <PhotoBg src={fleetImg} lazy overlay={`linear-gradient(90deg, rgba(5,10,12,0.92) 0%, rgba(5,10,12,0.55) 45%, rgba(5,10,12,0.2) 100%)`}/>
      <div style={{position:"relative",zIndex:2,width:"100%",padding:"0 6vw",display:"grid",gridTemplateColumns:"1fr 1fr",alignItems:"flex-end",gap:60}}>
        <div>
          <Label color={C.teal}>LIVE GPS TRACKING</Label>
          <h2 style={{fontSize:"clamp(38px,5.5vw,70px)",fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:4,fontFamily:"Inter,sans-serif"}}>Every mixer.</h2>
          <h2 style={{fontSize:"clamp(38px,5.5vw,70px)",fontWeight:900,color:C.teal,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:22,fontFamily:"Inter,sans-serif"}}>Always visible.</h2>
          <p style={{fontSize:15,color:C.muted,lineHeight:1.75,maxWidth:400}}>Real-time location from your plant gate to the pour site. Watch live as mixers navigate Mumbai's roads. No calls. No guessing.</p>
        </div>
        <Glass style={{padding:"22px 24px",marginBottom:20}}>
          <div style={{fontSize:10,color:C.teal,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.14em",fontWeight:700,marginBottom:18}}>FLEET STATUS · LIVE</div>
          {trucks.map((tr,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:i<3?`1px solid rgba(0,201,167,0.07)`:"none"}}>
              <div style={{width:34,height:34,borderRadius:10,background:"rgba(0,201,167,0.08)",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:C.teal}}><Truck size={16}/></div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:C.text,fontWeight:700}}>{tr.id}</div>
                <div style={{fontSize:11,color:tr.col,fontWeight:600,marginTop:2}}>{tr.status}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,color:tr.col,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                  {tr.status==="Moving"&&<ArrowUpRight size={11}/>}{tr.speed}
                </div>
              </div>
            </div>
          ))}
        </Glass>
      </div>
    </div>
  );
}

/* ════════════ SLIDE 3: FRESHNESS ════════════ */
function Slide3(){
  const pours=[
    {id:"TM-0814",pct:74,color:C.teal,grade:"M25",client:"P.G. Constructions",risk:false},
    {id:"TM-5967",pct:46,color:"#F5A524",grade:"M20",client:"Ananth Corporation",risk:false},
    {id:"TM-9003",pct:12,color:"#F5455C",grade:"M30",client:"DS Infrastructure",risk:true},
    {id:"TM-0813",pct:62,color:"#60A5FA",grade:"M10",client:"Hiravati Agro",risk:false},
  ];
  return(
    <div style={{position:"relative",width:"100%",height:"100%",display:"flex",alignItems:"center"}}>
      <PhotoBg src={textureImg} lazy overlay={`linear-gradient(90deg, rgba(5,10,12,0.95) 0%, rgba(5,10,12,0.82) 55%, rgba(5,10,12,0.65) 100%)`}/>
      <div style={{position:"relative",zIndex:2,width:"100%",padding:"0 6vw",display:"grid",gridTemplateColumns:"1fr 1fr",alignItems:"center",gap:48}}>
        <div>
          <Label color="#4ADE80">FRESHNESS GUARD</Label>
          <h2 style={{fontSize:"clamp(36px,5vw,66px)",fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:4,fontFamily:"Inter,sans-serif"}}>Never lose</h2>
          <h2 style={{fontSize:"clamp(36px,5vw,66px)",fontWeight:900,color:C.teal,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:24,fontFamily:"Inter,sans-serif"}}>a pour again.</h2>
          <p style={{fontSize:15,color:C.muted,lineHeight:1.75,maxWidth:400,marginBottom:28}}>IS 4926 mandates concrete be placed within 90 minutes of batching. Our real-time countdown rings alert your team before slump loss — automatically.</p>
          <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
            {[{c:C.teal,l:"Safe >40%"},{c:"#F5A524",l:"Caution"},{c:"#F5455C",l:"Critical"}].map(x=>(
              <div key={x.l} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.muted}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:x.c,display:"inline-block"}}/>
                {x.l}
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {pours.map(p=><Ring key={p.id} pct={p.pct} color={p.color} grade={p.grade} client={p.client} label={p.id} risk={p.risk}/>)}
        </div>
      </div>
    </div>
  );
}

/* ════════════ SLIDE 4: COMMAND ════════════ */
function Slide4(){
  const feats=[
    {Icon:Satellite,title:"GPS Tracking",desc:"Live, always"},
    {Icon:Timer,title:"Freshness Guard",desc:"IS-code compliant"},
    {Icon:Bot,title:"Smart Plant AI",desc:"Voice & text"},
    {Icon:BarChart3,title:"Demand Forecast",desc:"Hourly insights"},
    {Icon:Truck,title:"Fleet Control",desc:"Every mixer"},
  ];
  return(
    <div style={{position:"relative",width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <PhotoBg src={commandImg} lazy overlay={`radial-gradient(circle at 50% 42%, rgba(5,10,12,0.5) 0%, ${C.dark} 78%)`}/>
      <div style={{position:"relative",zIndex:2,width:"100%",padding:"0 6vw",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center"}}>
        <Label color="#60A5FA">COMMAND CENTER</Label>
        <h2 style={{fontSize:"clamp(38px,5.5vw,70px)",fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:4,fontFamily:"Inter,sans-serif"}}>One screen.</h2>
        <h2 style={{fontSize:"clamp(38px,5.5vw,70px)",fontWeight:900,color:C.teal,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:22,fontFamily:"Inter,sans-serif"}}>Total plant intelligence.</h2>
        <p style={{fontSize:16,color:C.muted,lineHeight:1.7,maxWidth:560,marginBottom:52}}>Dispatch, freshness, fleet, and demand forecasting — all unified. Built for plant managers who need answers in seconds, not minutes.</p>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",justifyContent:"center"}}>
          {feats.map((f,i)=>(
            <Glass key={i} style={{padding:"22px 20px",textAlign:"center",minWidth:150,flex:"1 1 140px",maxWidth:175}}>
              <div style={{marginBottom:12,color:C.teal,display:"flex",justifyContent:"center"}}><f.Icon size={26}/></div>
              <div style={{fontSize:13,color:C.text,fontWeight:700,marginBottom:5}}>{f.title}</div>
              <div style={{fontSize:11,color:C.muted}}>{f.desc}</div>
            </Glass>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════ SLIDE 5: LIVE FEED ════════════ */
function SlideFeed({active=false}:{active?:boolean}){
  return(
    <div style={{position:"relative",width:"100%",height:"100%",display:"flex",alignItems:"center",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:`radial-gradient(circle at 50% 20%, rgba(0,201,167,0.07) 0%, ${C.dark} 72%)`}}/>
      <section id="feed" aria-label="Live Feed" style={{position:"relative",zIndex:2,width:"100%",padding:"0 6vw"}}>
        <Label color="#F5455C">
          <span style={{width:8,height:8,borderRadius:"50%",background:"#F5455C",display:"inline-block"}}/>
          LIVE FEED
        </Label>
        <h2 style={{fontSize:"clamp(30px,4vw,52px)",fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.03em",margin:"0 0 10px",fontFamily:"Inter,sans-serif"}}>Live Feed</h2>
        <p style={{fontSize:15,color:C.muted,lineHeight:1.7,maxWidth:560,margin:"0 0 26px"}}>Watch our plants in action — concrete plant, batching, transit, arrival, pouring, and quality testing.</p>
        <div className="ck-feed-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {FEED.map(f=>(
            <div key={f.video} style={{position:"relative",height:"clamp(110px,19vh,190px)",borderRadius:16,overflow:"hidden",border:`1px solid ${C.border}`,background:"rgba(10,22,24,0.78)"}}>
              {active&&(
                <video src={`/ck/videos/${f.video}`} autoPlay muted loop playsInline preload="auto" aria-label={f.label}
                  style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
              )}
              <div style={{position:"absolute",top:10,left:10,display:"inline-flex",alignItems:"center",gap:6,padding:"3px 9px",borderRadius:999,background:"rgba(5,10,12,0.6)",backdropFilter:"blur(6px)"}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:"#F5455C",display:"inline-block"}}/>
                <span style={{fontSize:9.5,fontWeight:700,letterSpacing:1.4,color:"#fff"}}>LIVE</span>
              </div>
              <div style={{position:"absolute",left:0,right:0,bottom:0,padding:"24px 12px 10px",background:"linear-gradient(to top, rgba(5,10,12,0.85) 0%, rgba(5,10,12,0.4) 60%, transparent 100%)"}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{f.label}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ════════════ SLIDE 6: LOGIN ════════════ */
function Slide5(){
  const roles=[{Icon:Crown,label:"Owner"},{Icon:ShieldCheck,label:"Admin"},{Icon:Settings,label:"Operator"},{Icon:Truck,label:"Driver"}];
  return(
    <div style={{position:"relative",width:"100%",height:"100%",display:"flex",alignItems:"center"}}>
      <PhotoBg src={plantImg} lazy overlay={`linear-gradient(90deg, rgba(5,10,12,0.9) 0%, rgba(5,10,12,0.72) 50%, rgba(5,10,12,0.5) 100%)`}/>
      <div className="ck-login-grid" style={{position:"relative",zIndex:2,width:"100%",padding:"0 7vw",display:"grid",gridTemplateColumns:"1fr 1fr",alignItems:"center",gap:64}}>
        <div>
          <Label>SECURE PLATFORM</Label>
          <h2 style={{fontSize:"clamp(34px,4.5vw,60px)",fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:4,fontFamily:"Inter,sans-serif"}}>Secure access for</h2>
          <h2 style={{fontSize:"clamp(34px,4.5vw,60px)",fontWeight:900,color:C.teal,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:24,fontFamily:"Inter,sans-serif"}}>every plant role.</h2>
          <p style={{fontSize:15,color:C.muted,lineHeight:1.75,maxWidth:400,marginBottom:32}}>Plant Owner, Admin, Operator, Driver, Fleet Manager and Customer dashboards are separated by Plant ID. Your data stays private and controlled.</p>
          <Glass style={{padding:"18px 20px",marginBottom:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <Lock size={14} color={C.teal}/>
              <span style={{fontSize:11,color:C.teal,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.12em",fontWeight:700}}>PRIVACY PROTECTION</span>
            </div>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.6,margin:0}}>Each plant has separate login access. Owners cannot see other plants. Staff only see assigned plant data.</p>
          </Glass>
        </div>
        <Glass style={{padding:"36px 32px",maxWidth:400,margin:"0 auto",width:"100%"}}>
          <div style={{fontSize:24,fontWeight:800,color:C.text,marginBottom:6,fontFamily:"Inter,sans-serif"}}>Sign in</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:28,lineHeight:1.5}}>Continue securely with your registered Google account.</div>
          <button onClick={openLogin} style={{width:"100%",padding:"13px 20px",borderRadius:12,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.97)",color:"#1F1F1F",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:24,boxShadow:"0 2px 12px rgba(0,0,0,0.3)"}}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.347 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
            <div style={{flex:1,height:1,background:"rgba(0,201,167,0.1)"}}/><span style={{fontSize:11,color:C.muted}}>OR</span><div style={{flex:1,height:1,background:"rgba(0,201,167,0.1)"}}/>
          </div>
          <div style={{display:"flex",gap:16,justifyContent:"center",marginBottom:24}}>
            {roles.map(r=>(
              <button key={r.label} onClick={openLogin} style={{textAlign:"center",background:"none",border:"none",cursor:"pointer",padding:0}}>
                <div style={{width:44,height:44,borderRadius:12,background:"rgba(0,201,167,0.08)",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:C.teal,margin:"0 auto 6px"}}><r.Icon size={20}/></div>
                <div style={{fontSize:10,color:C.muted,fontWeight:600}}>{r.label}</div>
              </button>
            ))}
          </div>
          <p style={{textAlign:"center",fontSize:11,color:C.muted,lineHeight:1.6,margin:0}}>By continuing, you agree to Concrete King <span style={{color:C.teal,cursor:"pointer"}}>Terms</span> & <span style={{color:C.teal,cursor:"pointer"}}>Privacy Policy</span>.</p>
        </Glass>
      </div>
    </div>
  );
}

/* ════════════ NAVBAR ════════════ */
function NavBar({slide,onGo}:{slide:number;onGo:(i:number)=>void}){
  const items=["Home","GPS","Freshness","Command","Feed","Login"];
  return(
    <div style={{position:"absolute",top:0,left:0,right:0,zIndex:100,height:60,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 32px",background:"rgba(5,10,12,0.82)",backdropFilter:"blur(22px)",WebkitBackdropFilter:"blur(22px)",borderBottom:"1px solid rgba(0,201,167,0.08)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{width:32,height:32,borderRadius:9,background:C.teal,display:"flex",alignItems:"center",justifyContent:"center"}}><Crown size={18} color="#04110E"/></div>
        <div>
          <div style={{fontSize:14,fontWeight:900,color:C.text,letterSpacing:"-0.02em",lineHeight:1,fontFamily:"Inter,sans-serif"}}>Concrete King</div>
          <div style={{fontSize:8,color:C.muted,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.15em",lineHeight:1.2}}>RMC OPERATIONS OS</div>
        </div>
      </div>
      <div className="ck-nav-links" style={{display:"flex",gap:4}}>
        {items.map((it,i)=>(
          <button key={it} onClick={()=>onGo(i)}
            style={{border:"none",background:"transparent",color:slide===i?C.teal:C.muted,fontSize:13,fontWeight:slide===i?700:400,padding:"8px 16px",cursor:"pointer",fontFamily:"Inter,sans-serif",position:"relative",transition:"color 0.2s"}}>
            {it}
            {slide===i&&<div style={{position:"absolute",bottom:2,left:"50%",transform:"translateX(-50%)",width:"60%",height:2,background:C.teal,borderRadius:99}}/>}
          </button>
        ))}
      </div>
      <button onClick={openLogin} style={{padding:"9px 24px",borderRadius:99,border:"none",background:C.teal,color:"#04110E",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0}}>Login</button>
    </div>
  );
}

/* ════════════ DOTS + ARROWS ════════════ */
function Dots({cur,total,onGo}:{cur:number;total:number;onGo:(i:number)=>void}){
  return(
    <div style={{position:"absolute",bottom:24,left:"50%",transform:"translateX(-50%)",display:"flex",gap:8,zIndex:100,alignItems:"center"}}>
      {Array.from({length:total}).map((_,i)=>(
        <button key={i} onClick={()=>onGo(i)} style={{border:"none",background:"none",padding:4,cursor:"pointer"}}>
          <div style={{width:i===cur?26:7,height:7,borderRadius:4,background:i===cur?C.teal:"rgba(0,201,167,0.2)",transition:"all 0.35s cubic-bezier(0.4,0,0.2,1)",boxShadow:i===cur?`0 0 10px ${C.teal}`:"none"}}/>
        </button>
      ))}
    </div>
  );
}
function Arrows({cur,total,onPrev,onNext}:{cur:number;total:number;onPrev:()=>void;onNext:()=>void}){
  const btn=(dir:"left"|"right",onClick:()=>void)=>(
    <button onClick={onClick} style={{position:"absolute",[dir]:20,top:"50%",transform:"translateY(-50%)",zIndex:100,width:42,height:42,borderRadius:"50%",border:`1px solid ${C.border}`,background:"rgba(5,10,12,0.7)",backdropFilter:"blur(12px)",color:dir==="right"?C.teal:C.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{dir==="left"?<ChevronLeft size={20}/>:<ChevronRight size={20}/>}</button>
  );
  return(<>{cur>0&&btn("left",onPrev)}{cur<total-1&&btn("right",onNext)}</>);
}

/* ════════════ ROOT ════════════ */
export default function Landing(){
  const [cur,setCur]=useState(0);
  const [anim,setAnim]=useState("in");
  const TOTAL=6;

  const go=useCallback((idx:number)=>{
    if(idx===cur||idx<0||idx>=TOTAL)return;
    setAnim("out");
    setTimeout(()=>{setCur(idx);setAnim("in");},240);
  },[cur]);

  useEffect(()=>{
    const kd=(e:KeyboardEvent)=>{if(e.key==="ArrowRight")go(cur+1);if(e.key==="ArrowLeft")go(cur-1);};
    window.addEventListener("keydown",kd);
    return()=>window.removeEventListener("keydown",kd);
  },[cur,go]);

  /* All slides stay mounted in the DOM (hidden slides use display:none) so
     crawlers and non-interactive extractors see every section's real <h2> and
     copy — incl. the Live Feed heading + intro that mirror the prerendered
     shell in index.html. Hidden media stays cheap: PhotoBg imgs are lazy and
     feed <video>s only mount on the active slide. */
  const SLIDES:React.ComponentType<{active?:boolean}>[]=[Slide1,Slide2,Slide3,Slide4,SlideFeed,Slide5];

  return(
    <div style={{width:"100%",height:"100vh",overflow:"hidden",background:C.dark,fontFamily:"Inter,sans-serif",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap');
        @keyframes ckFadeIn{from{opacity:0;transform:scale(0.983)}to{opacity:1;transform:scale(1)}}
        @keyframes ckFadeOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(1.016)}}
        input::placeholder{color:#2A4042}
        .ck-deck button:hover{opacity:0.92}
        @media (max-width: 860px){
          .ck-nav-links{display:none !important;}
          .ck-login-grid{grid-template-columns:1fr !important;gap:28px !important;}
          .ck-feed-grid{grid-template-columns:repeat(2,1fr) !important;gap:10px !important;}
        }
      `}</style>
      <div className="ck-deck" style={{width:"100%",height:"100%",position:"relative"}}>
        <NavBar slide={cur} onGo={go}/>
        {SLIDES.map((S,i)=>(
          <div key={i} style={{position:"absolute",inset:0,paddingTop:60,display:i===cur?"block":"none",animation:i===cur?`${anim==="in"?"ckFadeIn":"ckFadeOut"} 0.26s cubic-bezier(0.4,0,0.2,1) both`:"none"}}>
            <div style={{width:"100%",height:"100%",position:"relative"}}>
              <S active={i===cur}/>
            </div>
          </div>
        ))}
        <Arrows cur={cur} total={TOTAL} onPrev={()=>go(cur-1)} onNext={()=>go(cur+1)}/>
        <Dots cur={cur} total={TOTAL} onGo={go}/>
        {/* Social links — visible on every slide of the landing deck (bottom-right) */}
        <div className="ck-socials" style={{position:"absolute",right:14,bottom:12,zIndex:110}}>
          <SocialLinksBar compact/>
        </div>
      </div>
    </div>
  );
}
