import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Pause, Play, Sparkles } from 'lucide-react';

type PaidAd = { id:number; plantId:number; promotionRadiusKm:string; priorityRank:number; showGlowingEffect:boolean; paymentStatus:string; startAt:string; endAt:string; isActive:boolean; };
type Plant = { id:number; name:string; city?:string|null };

export default function PlantPromotions() {
  const [rows,setRows]=useState<PaidAd[]>([]);
  const [plants,setPlants]=useState<Plant[]>([]);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [plantId,setPlantId]=useState('');
  const [days,setDays]=useState('7');

  const load=()=>Promise.all([api.get<PaidAd[]>('/admin/plant-promotions'),api.get<Plant[]>('/plants')])
    .then(([ads,plantRows])=>{setRows(ads);setPlants(plantRows);})
    .catch(e=>setError((e as Error).message));

  useEffect(()=>{void load();},[]);

  const activatePaidAd=async()=>{
    setError(''); setNotice('');
    const selectedPlantId=Number(plantId); const selectedDays=Number(days);
    if(!Number.isInteger(selectedPlantId)||selectedPlantId<1){setError('Select a plant.');return;}
    if(!Number.isInteger(selectedDays)||selectedDays<1||selectedDays>365){setError('Days must be between 1 and 365.');return;}
    const startAt=new Date(); const endAt=new Date(startAt.getTime()+selectedDays*86400000);
    try{
      const created=await api.post<PaidAd>('/admin/plant-promotions',{
        plantId:selectedPlantId,packageType:'custom',promotionRadiusKm:15,priorityRank:1,
        bannerTitle:'',bannerSubtitle:null,showGlowingEffect:true,paymentStatus:'paid',
        startAt:startAt.toISOString(),endAt:endAt.toISOString(),amountPaid:null,
        paymentReference:null,internalNotes:null,
      });
      await api.post(`/admin/plant-promotions/${created.id}/activate`,{});
      setNotice(`Paid Ad activated for ${selectedDays} day${selectedDays===1?'':'s'}. The plant will move to the top and glow for customers within 15 km of the plant.`);
      await load();
    }catch(e){setError((e as Error).message);}
  };

  const action=async(id:number,type:'activate'|'pause')=>{try{await api.post(`/admin/plant-promotions/${id}/${type}`,{});await load();}catch(e){setError((e as Error).message);}};

  return <div style={{display:'grid',gap:16,paddingBottom:24}}>
    <header className="card" style={{padding:20}}><h1 style={{margin:0,display:'flex',gap:8,alignItems:'center'}}><Sparkles/>Paid Plant Ads</h1><p style={{marginBottom:0}}>Super Admin only. Select a plant and number of days. The plant moves to the top within 15 km of its own location and receives a glowing pulsing effect. No new customer-facing label is added.</p></header>
    {error&&<div className="card" style={{padding:14,color:'var(--red)'}}>{error}</div>}
    {notice&&<div className="card" style={{padding:14,color:'var(--green)'}}>{notice}</div>}
    <section className="card" style={{padding:18,display:'grid',gap:14}}>
      <h2 style={{margin:0}}>Activate Paid Ad</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
        <label>Plant<select className="input" value={plantId} onChange={e=>setPlantId(e.target.value)}><option value="">Select plant</option>{plants.map(p=><option key={p.id} value={p.id}>{p.name}{p.city?` — ${p.city}`:''}</option>)}</select></label>
        <label>Number of days<input className="input" type="number" min="1" max="365" value={days} onChange={e=>setDays(e.target.value)}/></label>
      </div>
      <div style={{fontSize:13,color:'var(--muted)'}}>Radius is fixed at 15 km from the selected plant. Glowing pulsing effect is enabled automatically.</div>
      <button className="btn primary" onClick={activatePaidAd}><Play size={17}/>Activate Paid Ad</button>
    </section>
    <section className="card" style={{padding:18}}><h2>Paid Ad List</h2><div style={{display:'grid',gap:10}}>{rows.map(r=>{const plant=plants.find(p=>p.id===r.plantId);return <article key={r.id} style={{border:'1px solid var(--line)',borderRadius:12,padding:14,display:'grid',gap:8}}><div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><strong>{plant?.name??`Plant #${r.plantId}`}</strong><span>{r.isActive?'Active':'Inactive'}</span></div><div>15 km radius · Glow {r.showGlowingEffect?'On':'Off'}</div><div>{new Date(r.startAt).toLocaleString('en-IN')} – {new Date(r.endAt).toLocaleString('en-IN')}</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{r.isActive?<button className="btn" onClick={()=>action(r.id,'pause')}><Pause size={16}/>Pause</button>:<button className="btn primary" onClick={()=>action(r.id,'activate')}><Play size={16}/>Activate</button>}</div></article>;})}</div></section>
  </div>;
}
