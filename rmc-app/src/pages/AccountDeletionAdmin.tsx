import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type RequestRow = { id:number; fullName:string; mobile?:string|null; email?:string|null; reason?:string|null; status:string; rejectionReason?:string|null; requestedAt:string; completedAt?:string|null };
const statuses = ['pending_verification','verified','processing','completed','rejected'] as const;
const labels: Record<string,string> = { pending_verification:'Pending verification', verified:'Verified', processing:'Processing', completed:'Completed', rejected:'Rejected with reason' };

export default function AccountDeletionAdmin() {
  const [rows,setRows] = useState<RequestRow[]>([]);
  const [error,setError] = useState('');
  const load = () => api.get<RequestRow[]>('/account-deletion-requests/admin').then(setRows).catch(e=>setError(e instanceof Error?e.message:'Unable to load requests.'));
  useEffect(load,[]);
  async function update(row:RequestRow,status:string) {
    const rejectionReason = status === 'rejected' ? window.prompt('Rejection reason (required):')?.trim() : undefined;
    if (status === 'rejected' && !rejectionReason) return;
    try { await api.patch(`/account-deletion-requests/admin/${row.id}`,{status,rejectionReason}); load(); }
    catch(e){setError(e instanceof Error?e.message:'Update failed.');}
  }
  return <div style={{maxWidth:1000,margin:'0 auto'}}><h1>Account deletion requests</h1><p style={{color:'var(--muted)'}}>Verify ownership and track permanent customer deletion. Completed requests cannot be restored.</p>{error&&<p style={{color:'var(--red)'}}>{error}</p>}<div style={{display:'grid',gap:12}}>{rows.map(row=><article key={row.id} style={{padding:16,border:'1px solid var(--glass-border)',borderRadius:12,background:'var(--panel)'}}><strong>#{row.id} · {row.fullName}</strong><div style={{fontSize:13,color:'var(--muted)',margin:'6px 0'}}>{row.mobile||'No mobile'} · {row.email||'No email'} · {new Date(row.requestedAt).toLocaleString()}</div>{row.reason&&<p>{row.reason}</p>}<label>Status <select aria-label={`Status for request ${row.id}`} disabled={row.status==='completed'} value={row.status} onChange={e=>void update(row,e.target.value)}>{statuses.map(s=><option value={s} key={s}>{labels[s]}</option>)}</select></label>{row.rejectionReason&&<p style={{color:'var(--red)'}}>Reason: {row.rejectionReason}</p>}</article>)}</div>{!rows.length&&!error&&<p>No deletion requests.</p>}</div>;
}
