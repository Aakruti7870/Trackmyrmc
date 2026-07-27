import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Pause, Play, Plus, Sparkles } from 'lucide-react';

type Promotion = { id:number; plantId:number; packageType:string; promotionRadiusKm:string; priorityRank:number; bannerTitle:string; bannerSubtitle?:string|null; showGlowingEffect:boolean; paymentStatus:string; startAt:string; endAt:string; isActive:boolean; };

export default function PlantPromotions() {
  const [rows,setRows]=useState<Promotion[]>([]); const [error,setError]=useState(''); const [notice,setNotice]=useState('');
  const [form,setForm]=useState({ plantId:'', packageType:'featured', promotionRadiusKm:'20', priorityRank:'1', bannerTitle:'Featured RMC Plant', bannerSubtitle:'', showGlowingEffect:true, paymentStatus:'paid', startAt:'', endAt:'', amountPaid:'', paymentReference:'', internalNotes:'' });
  const load=()=>api.get<Promotion[]>('/admin/plant-promotions').then(setRows).catch(e=>setError((e as Error).message));
  useEffect(load,[]);
  const create=async()=>{ setError(''); try { await api.post('/admin/plant-promotions',{...form,plantId:Number(form.plantId),promotionRadiusKm:Number(form.promotionRadiusKm),priorityRank:Number(form.priorityRank),amountPaid:form.amountPaid?Number(form.amountPaid):null,startAt:new Date(form.startAt).toISOString(),endAt:new Date(form.endAt).toISOString(),bannerSubtitle:form.bannerSubtitle||null,paymentReference:form.paymentReference||null,internalNotes:form.internalNotes||null}); setNotice('Promotion created. Activate it after checking payment and dates.'); load(); } catch(e){setError((e as Error).message);} };
  const action=async(id:number,type:'activate'|'pause')=>{ try{await api.post(`/admin/plant-promotions/${id}/${type}`,{});load();}catch(e){setError((e as Error).message);} };
  return <div style={{display:'grid',gap:16,paddingBottom:24}}><header className="card" style={{padding:20}}><h1 style={{margin:0,display:'flex',gap:8,alignItems:'center'}}><Sparkles/>Sponsored Plant Promotions</h1><p>Only Super Admin can control ranking, radius, banner and glow.</p></header>{error&&<div className="card" style={{padding:14}}>{error}</div>}{notice&&<div className="card" style={{padding:14}}>{notice}</div>}
  <section className="card" style={{padding:18,display:'grid',gap:12}}><h2>Create Promotion</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>
    <label>Plant ID<input className="input" type="number" min="1" value={form.plantId} onChange={e=>setForm(v=>({...v,plantId:e.target.value}))}/></label>
    <label>Package<select className="input" value={form.packageType} onChange={e=>setForm(v=>({...v,packageType:e.target.value}))}><option value="standard">Standard</option><option value="featured">Featured</option><option value="premium">Premium</option><option value="custom">Custom</option></select></label>
    <label>Radius (km)<input className="input" type="number" min="1" max="250" value={form.promotionRadiusKm} onChange={e=>setForm(v=>({...v,promotionRadiusKm:e.target.value}))}/></label>
    <label>Priority Rank<input className="input" type="number" min="1" value={form.priorityRank} onChange={e=>setForm(v=>({...v,priorityRank:e.target.value}))}/></label>
    <label>Start<input className="input" type="datetime-local" value={form.startAt} onChange={e=>setForm(v=>({...v,startAt:e.target.value}))}/></label>
    <label>End<input className="input" type="datetime-local" value={form.endAt} onChange={e=>setForm(v=>({...v,endAt:e.target.value}))}/></label>
    <label>Payment Status<select className="input" value={form.paymentStatus} onChange={e=>setForm(v=>({...v,paymentStatus:e.target.value}))}><option value="pending">Pending</option><option value="paid">Paid</option><option value="waived">Waived</option><option value="refunded">Refunded</option><option value="cancelled">Cancelled</option></select></label>
    <label>Amount Paid<input className="input" type="number" min="0" value={form.amountPaid} onChange={e=>setForm(v=>({...v,amountPaid:e.target.value}))}/></label>
    <label>Banner Title<input className="input" value={form.bannerTitle} onChange={e=>setForm(v=>({...v,bannerTitle:e.target.value}))}/></label>
    <label>Banner Subtitle<input className="input" value={form.bannerSubtitle} onChange={e=>setForm(v=>({...v,bannerSubtitle:e.target.value}))}/></label>
    <label>Payment Reference<input className="input" value={form.paymentReference} onChange={e=>setForm(v=>({...v,paymentReference:e.target.value}))}/></label>
    <label style={{display:'flex',alignItems:'center',gap:8,minHeight:44}}><input type="checkbox" checked={form.showGlowingEffect} onChange={e=>setForm(v=>({...v,showGlowingEffect:e.target.checked}))}/>Glowing pulse effect</label>
  </div><label>Internal Notes<textarea className="input" rows={3} value={form.internalNotes} onChange={e=>setForm(v=>({...v,internalNotes:e.target.value}))}/></label><button className="btn primary" onClick={create}><Plus size={17}/>Create Promotion</button></section>
  <section className="card" style={{padding:18}}><h2>Promotion List</h2><div style={{display:'grid',gap:10}}>{rows.map(r=><article key={r.id} style={{border:'1px solid var(--line)',borderRadius:12,padding:14,display:'grid',gap:8}}><div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><strong>Plant #{r.plantId} · {r.packageType}</strong><span>{r.isActive?'Active':'Inactive'}</span></div><div>Priority {r.priorityRank} · Radius {r.promotionRadiusKm} km · Payment {r.paymentStatus}</div><div>{new Date(r.startAt).toLocaleString('en-IN')} – {new Date(r.endAt).toLocaleString('en-IN')}</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{r.isActive?<button className="btn" onClick={()=>action(r.id,'pause')}><Pause size={16}/>Pause</button>:<button className="btn primary" onClick={()=>action(r.id,'activate')}><Play size={16}/>Activate</button>}</div></article>)}</div></section></div>;
}
