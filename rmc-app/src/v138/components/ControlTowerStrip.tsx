import type { ControlTowerItem } from '../controlTower/engine';

type Props={ items:ControlTowerItem[]; onNavigate?:(route:string)=>void; title?:string };
const icon=(s:ControlTowerItem['severity'])=>s==='danger'?'!':s==='warning'?'△':'i';

export function ControlTowerStrip({items,onNavigate,title='Control Tower'}:Props){
  if(!items.length) return null;
  return <section className="tmr-v138-card" style={{marginTop:16,overflow:'hidden'}} aria-label={title}>
    <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 14px',borderBottom:'1px solid var(--line)'}}>
      <strong style={{fontSize:15,color:'var(--text)'}}>{title}</strong>
      <span className="tmr-v138-chip" style={{color:'var(--status-success)',background:'var(--status-success-soft)'}}>{items.length} active</span>
    </header>
    <div>{items.map((item,i)=>{
      const c=item.severity==='danger'?'var(--status-danger)':item.severity==='warning'?'var(--status-warning)':'var(--status-info)';
      const bg=item.severity==='danger'?'var(--status-danger-soft)':item.severity==='warning'?'var(--status-warning-soft)':'var(--status-info-soft)';
      return <button key={item.id} className="tmr-v138-tap" onClick={()=>item.route&&onNavigate?.(item.route)}
        style={{width:'100%',display:'grid',gridTemplateColumns:'36px minmax(0,1fr) auto',gap:10,alignItems:'center',padding:'11px 14px',textAlign:'left',background:'transparent',border:'none',borderBottom:i===items.length-1?'none':'1px solid var(--line)',cursor:item.route?'pointer':'default'}}>
        <span aria-hidden style={{width:32,height:32,borderRadius:10,display:'grid',placeItems:'center',fontWeight:900,color:c,background:bg}}>{icon(item.severity)}</span>
        <span style={{minWidth:0}}><span style={{display:'block',fontSize:13,fontWeight:800,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.title}</span>{item.detail&&<span style={{display:'block',fontSize:11.5,color:'var(--muted)',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.detail}</span>}</span>
        {item.metric&&<strong style={{fontSize:12,color:c,whiteSpace:'nowrap'}}>{item.metric}</strong>}
      </button>})}</div>
  </section>;
}
