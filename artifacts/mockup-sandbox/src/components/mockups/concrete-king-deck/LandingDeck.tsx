import { useState, useEffect, useRef, useCallback } from "react";

/* ════════════════════════════════════════════════════════
   CONCRETE KING – RMC OPERATIONS OS
   5 full-screen slides · No scroll · Canvas cinematic BGs
   Preview mockup: auth buttons route to the real /login page.
════════════════════════════════════════════════════════ */

const C = {
  teal:   "#00C9A7",
  dark:   "#050A0C",
  panel:  "rgba(10,22,24,0.78)",
  border: "rgba(0,201,167,0.15)",
  text:   "#E8F0EE",
  muted:  "#7A8F8D",
};

/* Route auth actions to the existing main-app /login page (new tab). */
const openLogin = () => {
  if (typeof window !== "undefined") {
    window.open("/login", "_blank", "noopener,noreferrer");
  }
};

/* ── CANVAS 1: CONCRETE DRUM ── */
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
      t.current += 0.006; const W = cv.width, H = cv.height;
      const bg = ctx.createLinearGradient(0,0,W,H);
      bg.addColorStop(0,"#02080A"); bg.addColorStop(0.5,"#071418"); bg.addColorStop(1,"#030809");
      ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
      for (let i=0;i<60;i++){
        const bx=(Math.sin(i*127.3)*0.5+0.5)*W*0.55+W*0.38;
        const by=(Math.sin(i*311.7)*0.5+0.5)*H*0.7+H*0.05;
        const br=2+Math.sin(i*2.1)*1.5;
        const op=0.08+Math.sin(t.current*0.3+i)*0.05;
        const color=i%3===0?`rgba(255,200,100,${op})`:`rgba(0,${150+i%80},${100+i%100},${op})`;
        const rg=ctx.createRadialGradient(bx,by,0,bx,by,br*4);
        rg.addColorStop(0,color.replace(String(op),String(op*3)));
        rg.addColorStop(1,"transparent");
        ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(bx,by,br*4,0,Math.PI*2); ctx.fill();
      }
      const ground = ctx.createLinearGradient(0,H*0.72,0,H);
      ground.addColorStop(0,"rgba(5,15,12,0.95)"); ground.addColorStop(1,"#020709");
      ctx.fillStyle=ground; ctx.fillRect(0,H*0.72,W,H);
      const dx=W*0.62, dy=H*0.44, rX=W*0.19, rY=H*0.50;
      ctx.save(); ctx.translate(dx,dy); ctx.rotate(t.current*0.35);
      const dg=ctx.createLinearGradient(-rX,-rY,rX,rY);
      dg.addColorStop(0,"#0A1F22"); dg.addColorStop(0.3,"#152E33"); dg.addColorStop(0.6,"#1E3E43"); dg.addColorStop(1,"#0A1F22");
      ctx.beginPath(); ctx.ellipse(0,0,rX,rY,0,0,Math.PI*2);
      ctx.fillStyle=dg; ctx.fill();
      for(let s=0;s<8;s++){
        const a=s*Math.PI/4;
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.lineTo(Math.cos(a)*rX*0.95,Math.sin(a)*rY*0.95);
        ctx.strokeStyle="rgba(0,201,167,0.06)"; ctx.lineWidth=1; ctx.stroke();
      }
      for(let b=0;b<4;b++){
        ctx.beginPath();
        for(let a=0;a<=Math.PI*5;a+=0.04){
          const fade=1-a/(Math.PI*5);
          const r=Math.min(rX,rY)*0.88*fade;
          const angle=a+(b*Math.PI*2)/4;
          const px=Math.cos(angle)*r*0.58, py=Math.sin(angle)*r;
          a===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
        }
        ctx.strokeStyle=`rgba(0,201,167,${0.12+b*0.03})`; ctx.lineWidth=2.5; ctx.stroke();
      }
      ctx.beginPath(); ctx.ellipse(0,0,rX,rY,0,0,Math.PI*2);
      const rimG=ctx.createLinearGradient(-rX,0,rX,0);
      rimG.addColorStop(0,"rgba(0,201,167,0)"); rimG.addColorStop(0.4,"rgba(0,201,167,0.35)"); rimG.addColorStop(1,"rgba(0,201,167,0)");
      ctx.strokeStyle=rimG; ctx.lineWidth=3; ctx.stroke();
      const ish=ctx.createRadialGradient(rX*0.2,-rY*0.1,rY*0.1,0,0,rY*0.95);
      ish.addColorStop(0,"rgba(0,201,167,0.04)"); ish.addColorStop(1,"rgba(0,0,0,0.6)");
      ctx.fillStyle=ish; ctx.beginPath(); ctx.ellipse(0,0,rX,rY,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
      const gring=ctx.createRadialGradient(dx,dy,Math.min(rX,rY)*0.85,dx,dy,Math.min(rX,rY)*1.3);
      gring.addColorStop(0,"transparent"); gring.addColorStop(0.7,"rgba(0,201,167,0.04)"); gring.addColorStop(1,"transparent");
      ctx.fillStyle=gring; ctx.beginPath(); ctx.ellipse(dx,dy,rX*1.3,rY*1.3,0,0,Math.PI*2); ctx.fill();
      for(let d=0;d<25;d++){
        const prog=((t.current*0.7+d*0.13)%1);
        const px=dx+rX*0.28+Math.sin(d*2.1+t.current)*rX*0.08;
        const py=dy+rY*0.45+prog*H*0.35;
        const sz2=(3-prog*2)*((d%3===0)?1.4:1);
        const al=0.55-prog*0.5;
        ctx.beginPath(); ctx.ellipse(px,py,sz2*0.5,sz2*1.8,0.15,0,Math.PI*2);
        ctx.fillStyle=`rgba(80,110,95,${al})`; ctx.fill();
      }
      const poolX=dx+rX*0.25, poolY=H*0.82;
      const pg=ctx.createRadialGradient(poolX,poolY,0,poolX,poolY,rX*0.9);
      pg.addColorStop(0,"rgba(65,95,80,0.65)"); pg.addColorStop(0.5,"rgba(45,75,60,0.35)"); pg.addColorStop(1,"rgba(30,55,45,0)");
      ctx.beginPath(); ctx.ellipse(poolX,poolY,rX*0.9,H*0.07,0,0,Math.PI*2); ctx.fillStyle=pg; ctx.fill();
      for(let r=0;r<3;r++){
        const rp=((t.current*0.9+r*0.33)%1);
        ctx.beginPath(); ctx.ellipse(poolX,poolY,rp*rX*0.85,rp*H*0.05,0,0,Math.PI*2);
        ctx.strokeStyle=`rgba(0,201,167,${(1-rp)*0.15})`; ctx.lineWidth=1; ctx.stroke();
      }
      for(let sp=0;sp<15;sp++){
        const sph=((t.current*0.8+sp*0.25)%1);
        const spx=poolX+(Math.sin(sp*2.7)*rX*0.6);
        const spy=poolY-sph*H*0.12+(sph-0.5)*(sph-0.5)*H*0.3;
        if(sph>0.1&&sph<0.9){
          ctx.beginPath(); ctx.arc(spx,spy,1.5,0,Math.PI*2);
          ctx.fillStyle=`rgba(80,110,90,${0.4*(1-sph)})`; ctx.fill();
        }
      }
      ctx.strokeStyle="rgba(15,35,30,0.5)"; ctx.lineWidth=2;
      [[W*0.42,H*0.2,W*0.42,H*0.9],[W*0.5,H*0.15,W*0.5,H*0.9],[W*0.9,H*0.1,W*0.9,H*0.9]].forEach(([x1,y1,x2,y2])=>{
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });
      const vig=ctx.createRadialGradient(W*0.4,H*0.45,H*0.05,W*0.4,H*0.45,H*1.0);
      vig.addColorStop(0,"transparent"); vig.addColorStop(0.55,"transparent"); vig.addColorStop(1,"rgba(3,8,10,0.88)");
      ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
      const lf=ctx.createLinearGradient(0,0,W*0.5,0);
      lf.addColorStop(0,"rgba(3,8,10,0.95)"); lf.addColorStop(0.55,"rgba(3,8,10,0.4)"); lf.addColorStop(1,"transparent");
      ctx.fillStyle=lf; ctx.fillRect(0,0,W,H);
      ani.current=requestAnimationFrame(draw);
    };
    draw();
    return ()=>{ cancelAnimationFrame(ani.current); window.removeEventListener("resize",sz); };
  },[]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>;
}

/* ── CANVAS 2: HIGHWAY TRUCKS ── */
function BgHighway() {
  const ref=useRef<HTMLCanvasElement | null>(null);
  const ani=useRef<number>(0);
  const t=useRef(0);
  useEffect(()=>{
    const cv=ref.current; if(!cv)return;
    const ctx=cv.getContext("2d"); if(!ctx)return;
    const sz=()=>{cv.width=cv.offsetWidth;cv.height=cv.offsetHeight;};
    sz(); window.addEventListener("resize",sz);
    const trucks=[
      {xOff:0,   speed:1.4,lane:0.56,sc:1.15,col:"#00C9A7"},
      {xOff:420, speed:1.1,lane:0.65,sc:0.95,col:"#60A5FA"},
      {xOff:780, speed:1.25,lane:0.60,sc:1.05,col:"#00C9A7"},
      {xOff:200, speed:0.9,lane:0.70,sc:0.85,col:"#4ADE80"},
    ];
    const x=[-400,-200,-600,-100];
    const draw=()=>{
      t.current+=0.012; const W=cv.width,H=cv.height;
      ctx.clearRect(0,0,W,H);
      const sky=ctx.createLinearGradient(0,0,0,H);
      sky.addColorStop(0,"#020509"); sky.addColorStop(0.35,"#060D12"); sky.addColorStop(0.6,"#080F14"); sky.addColorStop(1,"#030709");
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
      for(let s=0;s<120;s++){
        const sx=(Math.sin(s*73.1)*0.5+0.5)*W;
        const sy=(Math.sin(s*197.3)*0.5+0.5)*H*0.45;
        const sop=0.15+Math.sin(t.current*0.4+s*0.5)*0.1;
        ctx.beginPath(); ctx.arc(sx,sy,0.7,0,Math.PI*2);
        ctx.fillStyle=`rgba(200,220,255,${sop})`; ctx.fill();
      }
      const buildings=[
        [W*0.0,H*0.5,W*0.08,H*0.2],[W*0.07,H*0.5,W*0.05,H*0.28],[W*0.12,H*0.5,W*0.07,H*0.15],
        [W*0.18,H*0.5,W*0.04,H*0.32],[W*0.22,H*0.5,W*0.09,H*0.12],[W*0.3,H*0.5,W*0.06,H*0.22],
        [W*0.75,H*0.5,W*0.06,H*0.18],[W*0.8,H*0.5,W*0.05,H*0.3],[W*0.84,H*0.5,W*0.08,H*0.14],
        [W*0.9,H*0.5,W*0.05,H*0.25],[W*0.94,H*0.5,W*0.06,H*0.16],
      ];
      buildings.forEach(([bx,by,bw,bh])=>{
        ctx.fillStyle="rgba(8,18,22,0.9)"; ctx.fillRect(bx,by-bh,bw,bh+10);
        for(let wr=0;wr<Math.floor(bh/14);wr++)
          for(let wc=0;wc<Math.floor(bw/10);wc++){
            if(Math.sin(wr*bx+wc*by)>0.2){
              ctx.fillStyle=`rgba(255,220,100,${0.08+Math.sin(t.current*0.1+wr+wc)*0.04})`;
              ctx.fillRect(bx+wc*10+2,by-bh+wr*14+2,5,7);
            }
          }
      });
      const roadY=H*0.52;
      const road=ctx.createLinearGradient(0,roadY,0,H);
      road.addColorStop(0,"#0A1418"); road.addColorStop(0.3,"#0D1820"); road.addColorStop(1,"#080E14");
      ctx.fillStyle=road; ctx.fillRect(0,roadY,W,H-roadY);
      const refl=ctx.createLinearGradient(0,roadY,0,H);
      refl.addColorStop(0,"rgba(0,201,167,0.04)"); refl.addColorStop(1,"transparent");
      ctx.fillStyle=refl; ctx.fillRect(0,roadY,W,H-roadY);
      ctx.setLineDash([50,35]);
      [[0.56],[0.63],[0.70]].forEach(([ly])=>{
        ctx.beginPath(); ctx.moveTo(0,H*ly); ctx.lineTo(W,H*ly);
        ctx.strokeStyle="rgba(255,255,200,0.1)"; ctx.lineWidth=2; ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.strokeStyle="rgba(255,160,60,0.12)"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(0,roadY); ctx.lineTo(W,roadY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,H-3); ctx.lineTo(W,H-3); ctx.stroke();
      for(let rs=0;rs<8;rs++){
        const rx=rs*W/8+((t.current*20+rs*50)%(W/8));
        ctx.beginPath(); ctx.moveTo(rx,roadY); ctx.lineTo(rx+30,H);
        ctx.strokeStyle="rgba(0,201,167,0.04)"; ctx.lineWidth=1; ctx.stroke();
      }
      trucks.forEach((tr,i)=>{
        x[i]=(x[i]+tr.speed*1.8)%(W+500)-300;
        const ty=H*tr.lane, sc=tr.sc;
        ctx.save(); ctx.translate(x[i],ty); ctx.scale(sc,sc);
        const hb=ctx.createLinearGradient(90,0,350,0);
        hb.addColorStop(0,"rgba(255,240,180,0.18)"); hb.addColorStop(1,"transparent");
        ctx.fillStyle=hb;
        ctx.beginPath(); ctx.moveTo(90,-25); ctx.lineTo(380,-80); ctx.lineTo(380,80); ctx.lineTo(90,25); ctx.closePath(); ctx.fill();
        const chassis=ctx.createLinearGradient(-200,-30,200,30);
        chassis.addColorStop(0,"#0D1F26"); chassis.addColorStop(0.5,"#172E36"); chassis.addColorStop(1,"#0D1F26");
        ctx.fillStyle=chassis; ctx.beginPath(); ctx.roundRect(-195,-28,265,56,8); ctx.fill();
        ctx.strokeStyle=`rgba(0,201,167,0.25)`; ctx.lineWidth=1; ctx.stroke();
        ctx.save(); ctx.translate(-78,-14); ctx.rotate(t.current*2.2);
        const dg=ctx.createLinearGradient(-38,-38,38,38);
        dg.addColorStop(0,"#112830"); dg.addColorStop(0.5,"#1A3D48"); dg.addColorStop(1,"#112830");
        ctx.beginPath(); ctx.ellipse(0,0,38,38,0,0,Math.PI*2); ctx.fillStyle=dg; ctx.fill();
        ctx.beginPath(); ctx.ellipse(0,0,38,38,0,0,Math.PI*2);
        ctx.strokeStyle=tr.col; ctx.lineWidth=2; ctx.stroke();
        for(let b=0;b<3;b++){
          const ba=b*Math.PI*2/3;
          ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(ba)*28,Math.sin(ba)*28);
          ctx.strokeStyle=`${tr.col}60`; ctx.lineWidth=2; ctx.stroke();
        }
        const dgl=ctx.createRadialGradient(0,0,10,0,0,50);
        dgl.addColorStop(0,`${tr.col}18`); dgl.addColorStop(1,"transparent");
        ctx.fillStyle=dgl; ctx.beginPath(); ctx.arc(0,0,50,0,Math.PI*2); ctx.fill();
        ctx.restore();
        const cab=ctx.createLinearGradient(48,-35,148,35);
        cab.addColorStop(0,"#162B34"); cab.addColorStop(1,"#0F1F26");
        ctx.fillStyle=cab; ctx.beginPath(); ctx.roundRect(50,-33,96,58,8); ctx.fill();
        ctx.strokeStyle="rgba(0,201,167,0.2)"; ctx.lineWidth=1; ctx.stroke();
        ctx.fillStyle="rgba(100,200,255,0.07)";
        ctx.beginPath(); ctx.roundRect(60,-24,76,30,4); ctx.fill();
        ctx.fillStyle="rgba(255,240,180,0.9)";
        ctx.beginPath(); ctx.ellipse(92,-12,5,4,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(92,12,5,4,0,0,Math.PI*2); ctx.fill();
        const hl=ctx.createRadialGradient(92,-12,0,92,-12,20);
        hl.addColorStop(0,"rgba(255,240,180,0.2)"); hl.addColorStop(1,"transparent");
        ctx.fillStyle=hl; ctx.beginPath(); ctx.arc(92,-12,20,0,Math.PI*2); ctx.fill();
        [-150,-60,60].forEach(wx=>{
          ctx.save(); ctx.translate(wx,29);
          const wg=ctx.createRadialGradient(0,0,5,0,0,14);
          wg.addColorStop(0,"#1A3040"); wg.addColorStop(1,"#0A1520");
          ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.fillStyle=wg; ctx.fill();
          ctx.strokeStyle="rgba(0,201,167,0.3)"; ctx.lineWidth=2; ctx.stroke();
          ctx.restore();
        });
        ctx.fillStyle="rgba(255,40,40,0.6)";
        ctx.beginPath(); ctx.ellipse(-192,-14,4,3,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-192,14,4,3,0,0,Math.PI*2); ctx.fill();
        ctx.restore();
      });
      const vig=ctx.createRadialGradient(W*0.5,H*0.5,H*0.15,W*0.5,H*0.5,H*0.9);
      vig.addColorStop(0,"transparent"); vig.addColorStop(1,"rgba(3,7,9,0.7)");
      ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
      const lf=ctx.createLinearGradient(0,0,W*0.45,0);
      lf.addColorStop(0,"rgba(3,7,9,0.92)"); lf.addColorStop(1,"transparent");
      ctx.fillStyle=lf; ctx.fillRect(0,0,W,H);
      ani.current=requestAnimationFrame(draw);
    };
    draw();
    return ()=>{cancelAnimationFrame(ani.current);window.removeEventListener("resize",sz);};
  },[]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>;
}

/* ── CANVAS 3: CONCRETE POUR / REBAR ── */
function BgPour() {
  const ref=useRef<HTMLCanvasElement | null>(null);
  const ani=useRef<number>(0);
  const t=useRef(0);
  useEffect(()=>{
    const cv=ref.current; if(!cv)return;
    const ctx=cv.getContext("2d"); if(!ctx)return;
    const sz=()=>{cv.width=cv.offsetWidth;cv.height=cv.offsetHeight;};
    sz(); window.addEventListener("resize",sz);
    const drops=Array.from({length:100},()=>({x:0.36+(Math.random()-0.5)*0.14,y:Math.random()*0.4,sp:0.004+Math.random()*0.006,sz:1.5+Math.random()*3.5,ph:Math.random()*Math.PI*2}));
    const draw=()=>{
      t.current+=0.008; const W=cv.width,H=cv.height;
      ctx.clearRect(0,0,W,H);
      const bg=ctx.createLinearGradient(0,0,W,H);
      bg.addColorStop(0,"#040C0A"); bg.addColorStop(0.5,"#071410"); bg.addColorStop(1,"#030A08");
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
      ctx.lineWidth=3; ctx.strokeStyle="rgba(35,55,45,0.5)";
      for(let r=0;r<6;r++){
        const ry=H*0.4+r*H*0.1;
        ctx.beginPath(); ctx.moveTo(0,ry); ctx.lineTo(W,ry); ctx.stroke();
      }
      for(let c=0;c<10;c++){
        const cx2=c*W*0.12;
        ctx.beginPath(); ctx.moveTo(cx2,H*0.3); ctx.lineTo(cx2+W*0.05,H); ctx.stroke();
      }
      ctx.lineWidth=2; ctx.strokeStyle="rgba(25,45,35,0.4)";
      for(let r=0;r<6;r++){
        const ry=H*0.38+r*H*0.12;
        for(let c=0;c<10;c++){
          ctx.beginPath(); ctx.arc(c*W*0.12+W*0.025,ry,5,0,Math.PI*2); ctx.stroke();
        }
      }
      ctx.strokeStyle="rgba(0,201,167,0.15)"; ctx.lineWidth=20; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(W*0.32,H*0.02); ctx.quadraticCurveTo(W*0.36,H*0.25,W*0.38,H*0.55); ctx.stroke();
      ctx.strokeStyle="rgba(50,90,70,0.5)"; ctx.lineWidth=13;
      ctx.beginPath(); ctx.moveTo(W*0.32,H*0.02); ctx.quadraticCurveTo(W*0.36,H*0.25,W*0.38,H*0.55); ctx.stroke();
      drops.forEach(d=>{
        d.y=(d.y+d.sp)%0.65;
        const dx=W*d.x+Math.sin(d.ph+d.y*10)*W*0.015;
        const dy=H*(0.06+d.y*0.65);
        const al=0.45-d.y*0.55;
        ctx.beginPath(); ctx.ellipse(dx,dy,d.sz*0.5,d.sz*2,0.1,0,Math.PI*2);
        ctx.fillStyle=`rgba(75,105,85,${al})`; ctx.fill();
      });
      const poolCx=W*0.38, poolCy=H*0.72;
      const pg=ctx.createRadialGradient(poolCx,poolCy,0,poolCx,poolCy,W*0.22);
      pg.addColorStop(0,"rgba(60,95,75,0.75)"); pg.addColorStop(0.5,"rgba(45,75,58,0.45)"); pg.addColorStop(1,"rgba(30,55,42,0)");
      ctx.beginPath(); ctx.ellipse(poolCx,poolCy,W*0.22,H*0.1,0,0,Math.PI*2); ctx.fillStyle=pg; ctx.fill();
      for(let r=0;r<4;r++){
        const rp=((t.current*0.9+r*0.28)%1);
        ctx.beginPath(); ctx.ellipse(poolCx,poolCy,rp*W*0.20,rp*H*0.08,0,0,Math.PI*2);
        ctx.strokeStyle=`rgba(0,201,167,${(1-rp)*0.18})`; ctx.lineWidth=1; ctx.stroke();
      }
      for(let g=0;g<30;g++){
        const gx=(Math.sin(g*73.1)*0.5+0.5)*W*0.6+W*0.15;
        const gy=H*0.78+Math.sin(g*197.3)*H*0.08;
        ctx.beginPath(); ctx.arc(gx,gy,1.5,0,Math.PI*2);
        ctx.fillStyle="rgba(50,80,60,0.15)"; ctx.fill();
      }
      const tg=ctx.createRadialGradient(W*0.36,H*0.55,0,W*0.36,H*0.55,W*0.18);
      tg.addColorStop(0,"rgba(0,201,167,0.06)"); tg.addColorStop(1,"transparent");
      ctx.fillStyle=tg; ctx.fillRect(0,0,W,H);
      const vig=ctx.createRadialGradient(W*0.38,H*0.5,H*0.08,W*0.38,H*0.5,H*0.9);
      vig.addColorStop(0,"transparent"); vig.addColorStop(0.5,"transparent"); vig.addColorStop(1,"rgba(3,9,7,0.88)");
      ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
      const lf=ctx.createLinearGradient(0,0,W*0.48,0);
      lf.addColorStop(0,"rgba(3,9,7,0.96)"); lf.addColorStop(1,"transparent");
      ctx.fillStyle=lf; ctx.fillRect(0,0,W,H);
      ani.current=requestAnimationFrame(draw);
    };
    draw();
    return ()=>{cancelAnimationFrame(ani.current);window.removeEventListener("resize",sz);};
  },[]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>;
}

/* ── CANVAS 4: COMMAND DATA ── */
function BgCommand() {
  const ref=useRef<HTMLCanvasElement | null>(null);
  const ani=useRef<number>(0);
  const t=useRef(0);
  useEffect(()=>{
    const cv=ref.current; if(!cv)return;
    const ctx=cv.getContext("2d"); if(!ctx)return;
    const sz=()=>{cv.width=cv.offsetWidth;cv.height=cv.offsetHeight;};
    sz(); window.addEventListener("resize",sz);
    const barVals=[38,62,51,73,58,45,29,64,70,55,48,73];
    const draw=()=>{
      t.current+=0.006; const W=cv.width,H=cv.height;
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle="#030709"; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle="rgba(0,201,167,0.04)"; ctx.lineWidth=1;
      for(let i=0;i<32;i++){ctx.beginPath();ctx.moveTo(i*W/32,0);ctx.lineTo(i*W/32,H);ctx.stroke();}
      for(let i=0;i<20;i++){ctx.beginPath();ctx.moveTo(0,i*H/20);ctx.lineTo(W,i*H/20);ctx.stroke();}
      barVals.forEach((v,i)=>{
        const bx=W*0.06+i*W*0.072; const bh=H*0.25*(v/80); const by=H*0.85-bh;
        const al=0.05+Math.sin(t.current*0.4+i*0.3)*0.02;
        const bg2=ctx.createLinearGradient(0,by,0,by+bh);
        bg2.addColorStop(0,`rgba(0,201,167,${al*2})`); bg2.addColorStop(1,`rgba(0,201,167,${al*0.3})`);
        ctx.fillStyle=bg2; ctx.beginPath(); ctx.roundRect(bx,by,W*0.052,bh,4); ctx.fill();
      });
      ctx.beginPath();
      barVals.forEach((v,i)=>{
        const bx=W*0.06+i*W*0.072+W*0.026; const by=H*0.85-H*0.25*(v/80);
        i===0?ctx.moveTo(bx,by):ctx.lineTo(bx,by);
      });
      ctx.strokeStyle="rgba(0,201,167,0.25)"; ctx.lineWidth=2; ctx.stroke();
      const fCards=[
        {x:0.12,y:0.12,w:0.15,h:0.12,label:"DISPATCH",val:"4 ACTIVE",c:"#00C9A7",float:0},
        {x:0.52,y:0.07,w:0.14,h:0.11,label:"FRESHNESS",val:"74%",c:"#4ADE80",float:1},
        {x:0.78,y:0.22,w:0.14,h:0.10,label:"M30 ORDERS",val:"8 TODAY",c:"#60A5FA",float:2},
        {x:0.06,y:0.52,w:0.13,h:0.09,label:"PLANT LOAD",val:"82%",c:"#F5A524",float:3},
        {x:0.68,y:0.55,w:0.14,h:0.10,label:"ON-TIME",val:"96.4%",c:"#00C9A7",float:4},
      ];
      fCards.forEach(fc=>{
        const fcx=W*fc.x,fcy=H*fc.y+Math.sin(t.current*0.7+fc.float)*5;
        const fcw=W*fc.w,fch=H*fc.h;
        ctx.fillStyle="rgba(8,18,22,0.75)";
        ctx.beginPath(); ctx.roundRect(fcx,fcy,fcw,fch,10); ctx.fill();
        ctx.strokeStyle=`${fc.c}30`; ctx.lineWidth=1; ctx.stroke();
        ctx.fillStyle=fc.c; ctx.font=`bold ${Math.floor(fch*0.3)}px 'JetBrains Mono',monospace`;
        ctx.textAlign="center"; ctx.fillText(fc.val,fcx+fcw/2,fcy+fch*0.62);
        ctx.fillStyle="rgba(255,255,255,0.2)"; ctx.font=`${Math.floor(fch*0.15)}px sans-serif`;
        ctx.fillText(fc.label,fcx+fcw/2,fcy+fch*0.28);
      });
      ctx.setLineDash([5,10]); ctx.strokeStyle="rgba(0,201,167,0.07)"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(W*0.195,H*0.18); ctx.lineTo(W*0.59,H*0.125); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W*0.66,H*0.125); ctx.lineTo(W*0.85,H*0.27); ctx.stroke();
      ctx.setLineDash([]);
      const cg=ctx.createRadialGradient(W*0.5,H*0.45,0,W*0.5,H*0.45,W*0.35);
      cg.addColorStop(0,"rgba(0,201,167,0.04)"); cg.addColorStop(1,"transparent");
      ctx.fillStyle=cg; ctx.fillRect(0,0,W,H);
      const vig=ctx.createRadialGradient(W*0.5,H*0.45,H*0.1,W*0.5,H*0.45,H*0.9);
      vig.addColorStop(0,"transparent"); vig.addColorStop(1,"rgba(3,7,9,0.82)");
      ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
      ani.current=requestAnimationFrame(draw);
    };
    draw();
    return ()=>{cancelAnimationFrame(ani.current);window.removeEventListener("resize",sz);};
  },[]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>;
}

/* ── CANVAS 5: NETWORK LOGIN ── */
function BgLogin() {
  const ref=useRef<HTMLCanvasElement | null>(null);
  const ani=useRef<number>(0);
  const t=useRef(0);
  useEffect(()=>{
    const cv=ref.current; if(!cv)return;
    const ctx=cv.getContext("2d"); if(!ctx)return;
    const sz=()=>{cv.width=cv.offsetWidth;cv.height=cv.offsetHeight;};
    sz(); window.addEventListener("resize",sz);
    const nodes=Array.from({length:22},()=>({x:Math.random(),y:Math.random(),vx:(Math.random()-0.5)*0.00025,vy:(Math.random()-0.5)*0.00025}));
    const draw=()=>{
      t.current+=0.007; const W=cv.width,H=cv.height;
      ctx.clearRect(0,0,W,H);
      const bg=ctx.createLinearGradient(0,0,W,H);
      bg.addColorStop(0,"#030709"); bg.addColorStop(0.5,"#060D11"); bg.addColorStop(1,"#030709");
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
      nodes.forEach(n=>{n.x=(n.x+n.vx+1)%1;n.y=(n.y+n.vy+1)%1;});
      nodes.forEach((n1,i)=>{
        nodes.forEach((n2,j)=>{
          if(j<=i)return;
          const dx=(n1.x-n2.x)*W,dy=(n1.y-n2.y)*H;
          const dist=Math.sqrt(dx*dx+dy*dy);
          if(dist<200){
            ctx.beginPath(); ctx.moveTo(n1.x*W,n1.y*H); ctx.lineTo(n2.x*W,n2.y*H);
            ctx.strokeStyle=`rgba(0,201,167,${0.08*(1-dist/200)})`; ctx.lineWidth=1; ctx.stroke();
          }
        });
      });
      nodes.forEach(n=>{
        const ng=ctx.createRadialGradient(n.x*W,n.y*H,0,n.x*W,n.y*H,6);
        ng.addColorStop(0,"rgba(0,201,167,0.5)"); ng.addColorStop(1,"transparent");
        ctx.fillStyle=ng; ctx.beginPath(); ctx.arc(n.x*W,n.y*H,6,0,Math.PI*2); ctx.fill();
        ctx.fillStyle="rgba(0,201,167,0.6)"; ctx.beginPath(); ctx.arc(n.x*W,n.y*H,2,0,Math.PI*2); ctx.fill();
      });
      const cg=ctx.createRadialGradient(W*0.5,H*0.5,0,W*0.5,H*0.5,W*0.35);
      cg.addColorStop(0,"rgba(0,201,167,0.05)"); cg.addColorStop(1,"transparent");
      ctx.fillStyle=cg; ctx.fillRect(0,0,W,H);
      const vig=ctx.createRadialGradient(W*0.5,H*0.5,H*0.1,W*0.5,H*0.5,H*0.85);
      vig.addColorStop(0,"transparent"); vig.addColorStop(1,"rgba(3,7,9,0.85)");
      ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
      const lf=ctx.createLinearGradient(0,0,W*0.46,0);
      lf.addColorStop(0,"rgba(3,7,9,0.9)"); lf.addColorStop(1,"transparent");
      ctx.fillStyle=lf; ctx.fillRect(0,0,W,H);
      ani.current=requestAnimationFrame(draw);
    };
    draw();
    return ()=>{cancelAnimationFrame(ani.current);window.removeEventListener("resize",sz);};
  },[]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%"}}/>;
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
      {risk&&<div style={{fontSize:9,color:"#F5455C",fontWeight:700,display:"flex",alignItems:"center",gap:4}}>⚠ SLUMP RISK</div>}
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
      <BgDrum/>
      <div style={{position:"relative",zIndex:2,width:"100%",padding:"0 6vw",display:"grid",gridTemplateColumns:"1.15fr 0.85fr",alignItems:"center",gap:40}}>
        <div>
          <Label>READY MIX CONCRETE · OPERATIONS OS</Label>
          <h1 style={{fontSize:"clamp(40px,5.5vw,72px)",fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:4,fontFamily:"Inter,sans-serif"}}>Control your</h1>
          <h1 style={{fontSize:"clamp(40px,5.5vw,72px)",fontWeight:900,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:24,fontFamily:"Inter,sans-serif",color:colors[word],transition:"color 0.4s",minHeight:"1.1em"}}>{words[word]}</h1>
          <p style={{fontSize:16,color:C.muted,lineHeight:1.75,maxWidth:430,marginBottom:36}}>The only platform built ground-up for RMC plants. Live GPS, freshness tracking, IS-code AI, and fleet intelligence — <em style={{color:C.text,fontStyle:"normal",fontWeight:500}}>one screen.</em></p>
          <div style={{display:"flex",gap:14,marginBottom:48}}>
            <button onClick={openLogin} style={{padding:"13px 32px",borderRadius:12,border:"none",background:C.teal,color:"#000",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"Inter,sans-serif",boxShadow:`0 6px 28px rgba(0,201,167,0.38)`,letterSpacing:"-0.01em"}}>Get Started →</button>
            <button style={{padding:"13px 28px",borderRadius:12,border:`1px solid ${C.border}`,background:"rgba(0,201,167,0.04)",color:C.muted,fontSize:14,fontWeight:500,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",gap:8}}>
              <span style={{width:22,height:22,borderRadius:"50%",border:`1px solid ${C.muted}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>▶</span>Watch Demo
            </button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[
              {icon:"🚛",v:"4",l:"Live Pours",s:"3 plants active"},
              {icon:"📦",v:"143 m³",l:"Today's Output",s:"+18% vs avg"},
              {icon:"⏱️",v:"96.4%",l:"On-Time Rate",s:"Last 7 days"},
              {icon:"🔧",v:"12",l:"Fleet Online",s:"2 in maintenance"},
            ].map((k,i)=>(
              <Glass key={i} style={{padding:"14px 12px"}}>
                <div style={{fontSize:18,marginBottom:6}}>{k.icon}</div>
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
      <BgHighway/>
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
              <div style={{width:34,height:34,borderRadius:10,background:"rgba(0,201,167,0.08)",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🚛</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:C.text,fontWeight:700}}>{tr.id}</div>
                <div style={{fontSize:11,color:tr.col,fontWeight:600,marginTop:2}}>{tr.status}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,color:tr.col,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
                  {tr.status==="Moving"&&<span style={{fontSize:9}}>↗</span>}{tr.speed}
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
      <BgPour/>
      <div style={{position:"relative",zIndex:2,width:"100%",padding:"0 6vw",display:"grid",gridTemplateColumns:"1fr 1fr",alignItems:"center",gap:48}}>
        <div>
          <Label color="#4ADE80">FRESHNESS GUARD</Label>
          <h2 style={{fontSize:"clamp(36px,5vw,66px)",fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:4,fontFamily:"Inter,sans-serif"}}>Never lose</h2>
          <h2 style={{fontSize:"clamp(36px,5vw,66px)",fontWeight:900,color:C.teal,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:24,fontFamily:"Inter,sans-serif"}}>a pour again.</h2>
          <p style={{fontSize:15,color:C.muted,lineHeight:1.75,maxWidth:400,marginBottom:28}}>IS 4926 mandates concrete be placed within 90 minutes of batching. Our real-time countdown rings alert your team before slump loss — automatically.</p>
          <div style={{display:"flex",gap:20}}>
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
    {icon:"🛰️",title:"GPS Tracking",desc:"Live, always"},
    {icon:"⏱️",title:"Freshness Guard",desc:"IS-code compliant"},
    {icon:"🤖",title:"Smart Plant AI",desc:"Voice & text"},
    {icon:"📊",title:"Demand Forecast",desc:"Hourly insights"},
    {icon:"🚛",title:"Fleet Control",desc:"Every mixer"},
  ];
  return(
    <div style={{position:"relative",width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <BgCommand/>
      <div style={{position:"relative",zIndex:2,width:"100%",padding:"0 6vw",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center"}}>
        <Label color="#60A5FA">COMMAND CENTER</Label>
        <h2 style={{fontSize:"clamp(38px,5.5vw,70px)",fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:4,fontFamily:"Inter,sans-serif"}}>One screen.</h2>
        <h2 style={{fontSize:"clamp(38px,5.5vw,70px)",fontWeight:900,color:C.teal,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:22,fontFamily:"Inter,sans-serif"}}>Total plant intelligence.</h2>
        <p style={{fontSize:16,color:C.muted,lineHeight:1.7,maxWidth:560,marginBottom:52}}>Dispatch, freshness, fleet, and demand forecasting — all unified. Built for plant managers who need answers in seconds, not minutes.</p>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",justifyContent:"center"}}>
          {feats.map((f,i)=>(
            <Glass key={i} style={{padding:"22px 20px",textAlign:"center",minWidth:150,flex:"1 1 140px",maxWidth:175}}>
              <div style={{fontSize:28,marginBottom:12}}>{f.icon}</div>
              <div style={{fontSize:13,color:C.text,fontWeight:700,marginBottom:5}}>{f.title}</div>
              <div style={{fontSize:11,color:C.muted}}>{f.desc}</div>
            </Glass>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════ SLIDE 5: LOGIN ════════════ */
function Slide5(){
  const [phone,setPhone]=useState("");
  const [step,setStep]=useState(0);
  const [otp,setOtp]=useState(["","","","","",""]);
  const otpRefs=useRef<(HTMLInputElement|null)[]>([]);
  const handleOtp=(v:string,i:number)=>{
    const n=[...otp]; n[i]=v.slice(-1); setOtp(n);
    if(v&&i<5)otpRefs.current[i+1]?.focus();
  };
  const roles=[{icon:"👑",label:"Owner"},{icon:"🛡️",label:"Admin"},{icon:"⚙️",label:"Operator"},{icon:"🚛",label:"Driver"}];
  return(
    <div style={{position:"relative",width:"100%",height:"100%",display:"flex",alignItems:"center"}}>
      <BgLogin/>
      <div style={{position:"relative",zIndex:2,width:"100%",padding:"0 7vw",display:"grid",gridTemplateColumns:"1fr 1fr",alignItems:"center",gap:64}}>
        <div>
          <Label>SECURE PLATFORM</Label>
          <h2 style={{fontSize:"clamp(34px,4.5vw,60px)",fontWeight:900,color:C.text,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:4,fontFamily:"Inter,sans-serif"}}>Secure access for</h2>
          <h2 style={{fontSize:"clamp(34px,4.5vw,60px)",fontWeight:900,color:C.teal,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:24,fontFamily:"Inter,sans-serif"}}>every plant role.</h2>
          <p style={{fontSize:15,color:C.muted,lineHeight:1.75,maxWidth:400,marginBottom:32}}>Plant Owner, Admin, Operator, Driver, Fleet Manager and Customer dashboards are separated by Plant ID. Your data stays private and controlled.</p>
          <Glass style={{padding:"18px 20px",marginBottom:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <span style={{color:C.teal,fontSize:14}}>🔒</span>
              <span style={{fontSize:11,color:C.teal,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.12em",fontWeight:700}}>PRIVACY PROTECTION</span>
            </div>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:16}}>Each plant has separate login access. Owners cannot see other plants. Staff only see assigned plant data.</p>
            <div style={{display:"flex",gap:20,justifyContent:"center"}}>
              {roles.map(r=>(
                <div key={r.label} style={{textAlign:"center"}}>
                  <div style={{width:44,height:44,borderRadius:12,background:"rgba(0,201,167,0.08)",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,margin:"0 auto 6px"}}>{r.icon}</div>
                  <div style={{fontSize:10,color:C.muted,fontWeight:600}}>{r.label}</div>
                </div>
              ))}
            </div>
          </Glass>
        </div>
        <Glass style={{padding:"36px 32px",maxWidth:400,margin:"0 auto",width:"100%"}}>
          {step===0?(
            <>
              <div style={{fontSize:24,fontWeight:800,color:C.text,marginBottom:6,fontFamily:"Inter,sans-serif"}}>Sign in</div>
              <div style={{fontSize:13,color:C.muted,marginBottom:28,lineHeight:1.5}}>Continue securely with your registered Google account.</div>
              <button onClick={openLogin} style={{width:"100%",padding:"13px 20px",borderRadius:12,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.97)",color:"#1F1F1F",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:20,boxShadow:"0 2px 12px rgba(0,0,0,0.3)"}}>
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.347 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
                <div style={{flex:1,height:1,background:"rgba(0,201,167,0.1)"}}/><span style={{fontSize:11,color:"#2A4042"}}>OR</span><div style={{flex:1,height:1,background:"rgba(0,201,167,0.1)"}}/>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,color:C.muted,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.1em",marginBottom:8}}>PHONE NUMBER</div>
                <div style={{display:"flex",gap:8}}>
                  <div style={{background:"rgba(0,0,0,0.35)",border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 13px",fontSize:13,color:C.muted,flexShrink:0}}>+91</div>
                  <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="98200 00000"
                    style={{flex:1,background:"rgba(0,0,0,0.35)",border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px",fontSize:13,color:C.text,outline:"none",fontFamily:"monospace"}}/>
                </div>
              </div>
              <button onClick={()=>setStep(1)} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:C.teal,color:"#000",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"Inter,sans-serif",boxShadow:`0 5px 22px rgba(0,201,167,0.35)`,marginBottom:20}}>Send OTP via WhatsApp →</button>
              <p style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.15)",lineHeight:1.6}}>By continuing, you agree to Concrete King <span style={{color:C.teal,cursor:"pointer"}}>Terms</span> & <span style={{color:C.teal,cursor:"pointer"}}>Privacy Policy</span>.</p>
            </>
          ):(
            <>
              <button onClick={()=>setStep(0)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:12,marginBottom:20,padding:0,display:"flex",alignItems:"center",gap:5}}>← Back</button>
              <div style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:5,fontFamily:"Inter,sans-serif"}}>Enter OTP</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:28}}>Sent to +91 {phone||"98200 00000"} via WhatsApp</div>
              <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:28}}>
                {otp.map((v,i)=>(
                  <input key={i} ref={el=>{otpRefs.current[i]=el;}} value={v} onChange={e=>handleOtp(e.target.value,i)} maxLength={1}
                    style={{width:42,height:50,textAlign:"center",background:"rgba(0,0,0,0.4)",border:`1px solid ${v?C.teal:C.border}`,borderRadius:10,fontSize:20,fontWeight:800,color:C.teal,outline:"none",fontFamily:"monospace"}}/>
                ))}
              </div>
              <button onClick={openLogin} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:C.teal,color:"#000",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"Inter,sans-serif",marginBottom:14}}>Verify & Enter App →</button>
              <p style={{textAlign:"center",fontSize:12,color:"#2A4042"}}>Didn't receive? <span style={{color:C.teal,cursor:"pointer"}}>Resend OTP</span></p>
            </>
          )}
        </Glass>
      </div>
    </div>
  );
}

/* ════════════ NAVBAR ════════════ */
function NavBar({slide,onGo}:{slide:number;onGo:(i:number)=>void}){
  const items=["Home","GPS","Freshness","Command","Login"];
  return(
    <div style={{position:"absolute",top:0,left:0,right:0,zIndex:100,height:60,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 32px",background:"rgba(5,10,12,0.82)",backdropFilter:"blur(22px)",WebkitBackdropFilter:"blur(22px)",borderBottom:"1px solid rgba(0,201,167,0.08)"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{width:32,height:32,borderRadius:9,background:C.teal,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🏗️</div>
        <div>
          <div style={{fontSize:14,fontWeight:900,color:C.text,letterSpacing:"-0.02em",lineHeight:1,fontFamily:"Inter,sans-serif"}}>Concrete King</div>
          <div style={{fontSize:8,color:C.muted,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.15em",lineHeight:1.2}}>RMC OPERATIONS OS</div>
        </div>
      </div>
      <div style={{display:"flex",gap:4}}>
        {items.map((it,i)=>(
          <button key={it} onClick={()=>onGo(i)}
            style={{border:"none",background:"transparent",color:slide===i?C.teal:C.muted,fontSize:13,fontWeight:slide===i?700:400,padding:"8px 16px",cursor:"pointer",fontFamily:"Inter,sans-serif",position:"relative",transition:"color 0.2s"}}>
            {it}
            {slide===i&&<div style={{position:"absolute",bottom:2,left:"50%",transform:"translateX(-50%)",width:"60%",height:2,background:C.teal,borderRadius:99}}/>}
          </button>
        ))}
      </div>
      <button onClick={openLogin} style={{padding:"9px 24px",borderRadius:99,border:"none",background:C.teal,color:"#000",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0}}>Login</button>
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
    <button onClick={onClick} style={{position:"absolute",[dir]:20,top:"50%",transform:"translateY(-50%)",zIndex:100,width:42,height:42,borderRadius:"50%",border:`1px solid ${C.border}`,background:"rgba(5,10,12,0.7)",backdropFilter:"blur(12px)",color:dir==="right"?C.teal:C.muted,fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{dir==="left"?"‹":"›"}</button>
  );
  return(<>{cur>0&&btn("left",onPrev)}{cur<total-1&&btn("right",onNext)}</>);
}

/* ════════════ ROOT ════════════ */
export function LandingDeck(){
  const [cur,setCur]=useState(0);
  const [anim,setAnim]=useState("in");
  const TOTAL=5;

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

  const SLIDES=[Slide1,Slide2,Slide3,Slide4,Slide5];
  const Slide=SLIDES[cur];

  return(
    <div style={{width:"100%",height:"100vh",overflow:"hidden",background:C.dark,fontFamily:"Inter,sans-serif",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap');
        @keyframes fadeIn{from{opacity:0;transform:scale(0.983)}to{opacity:1;transform:scale(1)}}
        @keyframes fadeOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(1.016)}}
        input::placeholder{color:#2A4042}
        button:hover{opacity:0.92}
      `}</style>
      <NavBar slide={cur} onGo={go}/>
      <div key={cur} style={{width:"100%",height:"100%",paddingTop:60,animation:`${anim==="in"?"fadeIn":"fadeOut"} 0.26s cubic-bezier(0.4,0,0.2,1) both`}}>
        <div style={{width:"100%",height:"100%",position:"relative"}}>
          <Slide/>
        </div>
      </div>
      <Arrows cur={cur} total={TOTAL} onPrev={()=>go(cur-1)} onNext={()=>go(cur+1)}/>
      <Dots cur={cur} total={TOTAL} onGo={go}/>
    </div>
  );
}

export default LandingDeck;
