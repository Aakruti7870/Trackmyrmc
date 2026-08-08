import { openExistingAiAssistant } from '../ai/existingAiBridge';
import { promptsForRole } from '../ai/rolePrompts';
export function AiQuickAccess({role}:{role?:string}){
  const prompts=promptsForRole(role).slice(0,3);
  return <section className="tmr-v138-card" style={{marginTop:16,padding:14}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
      <div><strong style={{display:'block',fontSize:14,color:'var(--text)'}}>AI Copilot</strong><span style={{fontSize:11.5,color:'var(--muted)'}}>Uses the assistant already included in TrackMyRMC.</span></div>
      <button className="tmr-v138-tap" onClick={openExistingAiAssistant} style={{border:0,borderRadius:12,padding:'8px 12px',background:'linear-gradient(135deg,var(--gold-mid),var(--gold-dark))',color:'#fff',fontWeight:800}}>Ask AI</button>
    </div>
    <div style={{display:'flex',gap:6,overflowX:'auto',marginTop:11,paddingBottom:2}}>{prompts.map(p=><button key={p} onClick={openExistingAiAssistant} className="tmr-v138-chip tmr-v138-tap" style={{flex:'0 0 auto',background:'var(--gold-tint)',color:'var(--text)',cursor:'pointer'}} title={`Open AI and ask: ${p}`}>{p}</button>)}</div>
  </section>;
}
