import { useState, useEffect } from 'react';
import { Plus, X, Search, Pencil, Trash2, Phone, Mail, Building } from 'lucide-react';
import { clientStore } from '@/lib/store';
import type { Client } from '@/lib/types';

const empty: Omit<Client, 'id' | 'createdAt'> = { name: '', contactPerson: '', phone: '', email: '', address: '', gst: '' };

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const reload = () => setClients(clientStore.getAll());
  useEffect(() => { reload(); }, []);

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.contactPerson.toLowerCase().includes(q) || c.phone.includes(q);
  });

  function openAdd() { setForm({ ...empty }); setEditId(null); setShowForm(true); }
  function openEdit(c: Client) { setForm({ name: c.name, contactPerson: c.contactPerson, phone: c.phone, email: c.email, address: c.address, gst: c.gst }); setEditId(c.id); setShowForm(true); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) clientStore.update(editId, form); else clientStore.add(form);
    setShowForm(false); reload();
  }

  function doDelete() { if (deleteId) { clientStore.remove(deleteId); reload(); setDeleteId(null); } }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(38,52,73,.4)', border: '1px solid #263449',
    borderRadius: 10, padding: '9px 12px', color: '#eef5ff', fontSize: 14, outline: 'none'
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#9fb0c7', marginBottom: 5, display: 'block' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Clients</h2>
          <p style={{ margin: '5px 0 0', color: '#9fb0c7', fontSize: 14 }}>{clients.length} registered clients</p>
        </div>
        <button onClick={openAdd} data-testid="button-add-client" style={{
          display: 'flex', alignItems: 'center', gap: 7,
          borderRadius: 12, padding: '10px 18px',
          background: 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)',
          color: '#111827', fontWeight: 800, fontSize: 14,
          boxShadow: '0 12px 30px rgba(255,183,3,.18)'
        }}>
          <Plus size={16} /> Add Client
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 18 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9fb0c7' }} />
        <input placeholder="Search by name, contact, phone..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-clients"
          style={{ ...inputStyle, paddingLeft: 34 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
        {filtered.map(c => (
          <div key={c.id} className="glass-card" style={{ padding: 20 }} data-testid={`client-card-${c.id}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 14,
                  background: 'linear-gradient(135deg,#1d2d47,#263449)',
                  border: '1px solid rgba(255,255,255,.1)',
                  display: 'grid', placeItems: 'center', flexShrink: 0
                }}>
                  <Building size={18} color="#f7c948" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                  <div style={{ color: '#9fb0c7', fontSize: 12, marginTop: 2 }}>{c.contactPerson}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(c)} data-testid={`button-edit-client-${c.id}`} style={{ background: 'rgba(56,189,248,.12)', border: 'none', borderRadius: 8, padding: '6px 8px', color: '#38bdf8', cursor: 'pointer' }}><Pencil size={13} /></button>
                <button onClick={() => setDeleteId(c.id)} data-testid={`button-delete-client-${c.id}`} style={{ background: 'rgba(239,68,68,.12)', border: 'none', borderRadius: 8, padding: '6px 8px', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={13} /></button>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9fb0c7', fontSize: 13 }}>
                <Phone size={13} /> {c.phone || '—'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9fb0c7', fontSize: 13 }}>
                <Mail size={13} /> {c.email || '—'}
              </div>
              {c.address && <div style={{ color: '#9fb0c7', fontSize: 12, paddingTop: 2, borderTop: '1px solid #263449', marginTop: 4 }}>{c.address}</div>}
              {c.gst && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: '#9fb0c7' }}>GST:</span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#eef5ff' }}>{c.gst}</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #263449', fontSize: 11, color: '#9fb0c7' }}>
              Since {c.createdAt}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#9fb0c7' }}>No clients found</div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,9,20,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="glass-card" style={{ padding: 28, width: '100%', maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editId ? 'Edit Client' : 'Add Client'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', color: '#9fb0c7', padding: 4 }}><X size={18} /></button>
            </div>
            <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={labelStyle}>Company Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Nexus Infra Pvt Ltd" style={inputStyle} data-testid="input-client-name" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Contact Person</label>
                  <input value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Name" style={inputStyle} data-testid="input-contact-person" />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit number" style={inputStyle} data-testid="input-phone" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@company.com" style={inputStyle} data-testid="input-email" />
              </div>
              <div>
                <label style={labelStyle}>Address</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="City, State" style={inputStyle} data-testid="input-address" />
              </div>
              <div>
                <label style={labelStyle}>GST Number</label>
                <input value={form.gst} onChange={e => setForm(f => ({ ...f, gst: e.target.value.toUpperCase() }))} placeholder="27XXXXX1234X1ZX" style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '.5px' }} data-testid="input-gst" />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 18px', borderRadius: 10, background: '#1a2940', color: '#eef5ff', border: '1px solid #263449', fontWeight: 600, fontSize: 14 }}>Cancel</button>
                <button type="submit" data-testid="button-save-client" style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,#ffe08a,#f6b818 48%,#d97706)', color: '#111827', fontWeight: 800, fontSize: 14 }}>{editId ? 'Update' : 'Save Client'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,9,20,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ padding: 28, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700 }}>Delete Client?</h3>
            <p style={{ color: '#9fb0c7', marginBottom: 20, fontSize: 14 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '9px 16px', borderRadius: 10, background: '#1a2940', color: '#eef5ff', border: '1px solid #263449', fontSize: 14 }}>Cancel</button>
              <button onClick={doDelete} data-testid="button-confirm-delete-client" style={{ padding: '9px 16px', borderRadius: 10, background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: 14 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
