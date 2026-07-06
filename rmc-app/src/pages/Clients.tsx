import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, ChevronRight, MapPin, Phone, Link2 } from 'lucide-react';
import { api, type Client, type Site, type LedgerEntry } from '@/lib/api';
import { useToast } from '@/lib/toast';

type Tab = 'overview' | 'sites' | 'ledger';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<Partial<Client>>({});
  const [editing, setEditing] = useState<Client | null>(null);
  const [drawer, setDrawer] = useState<Client | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [sites, setSites] = useState<Site[]>([]);
  const [ledger, setLedger] = useState<{ entries: LedgerEntry[]; outstanding: number }>({ entries: [], outstanding: 0 });
  const [siteForm, setSiteForm] = useState<Partial<Site>>({});
  const [siteModal, setSiteModal] = useState(false);
  const [ledgerModal, setLedgerModal] = useState(false);
  const [ledgerForm, setLedgerForm] = useState({ type: 'debit', amount: '', description: '', referenceNo: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  function load() { api.get<Client[]>('/clients').then(setClients); }
  useEffect(load, []);

  function openCreate() { setForm({}); setEditing(null); setModal('create'); setError(''); }
  function openEdit(c: Client) { setForm({ ...c }); setEditing(c); setModal('edit'); setError(''); }

  async function openDrawer(c: Client) {
    setDrawer(c); setTab('overview');
    const [s, l] = await Promise.all([
      api.get<Site[]>(`/clients/${c.id}/sites`),
      api.get<{ entries: LedgerEntry[]; outstanding: number }>(`/clients/${c.id}/ledger`),
    ]);
    setSites(s); setLedger(l);
  }

  async function save() {
    setSaving(true); setError('');
    try {
      if (modal === 'create') await api.post('/clients', form);
      else await api.put(`/clients/${editing!.id}`, form);
      load(); setModal(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setSaving(false); }
  }

  async function remove(c: Client) {
    const linked = c.linkedUsers ?? [];
    let message = `Delete ${c.name}?`;
    if (linked.length) {
      const accounts = linked.map(u => `• ${u.name} (${u.email})`).join('\n');
      message = `${c.name} still has ${linked.length} linked login account${linked.length > 1 ? 's' : ''}:\n\n${accounts}\n\nDeletion will be blocked until you unlink or remove ${linked.length > 1 ? 'these accounts' : 'this account'}. Continue anyway?`;
    }
    if (!confirm(message)) return;
    try {
      await api.delete(`/clients/${c.id}`); load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to delete client', 'error');
    }
  }

  async function addSite() {
    await api.post(`/clients/${drawer!.id}/sites`, siteForm);
    setSites(await api.get<Site[]>(`/clients/${drawer!.id}/sites`));
    setSiteModal(false); setSiteForm({});
  }

  async function addLedger() {
    await api.post(`/clients/${drawer!.id}/ledger`, ledgerForm);
    const [l, updated] = await Promise.all([
      api.get<{ entries: LedgerEntry[]; outstanding: number }>(`/clients/${drawer!.id}/ledger`),
      api.get<Client[]>('/clients'),
    ]);
    setLedger(l); setClients(updated);
    setDrawer(updated.find(c => c.id === drawer!.id) || null);
    setLedgerModal(false);
    setLedgerForm({ type: 'debit', amount: '', description: '', referenceNo: '' });
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contactPerson || '').toLowerCase().includes(search.toLowerCase())
  );
  const fmtRs = (n: number | string) => `₹${Number(n).toLocaleString('en-IN')}`;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    background: 'var(--chip-bg)', border: '1px solid var(--line)',
    borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none',
  };

  return (
    <div>
      <div className="page-hd">
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Clients</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>{clients.length} registered clients</p>
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
          background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
          color: '#111827', fontWeight: 800, fontSize: 13, borderRadius: 10, border: 'none', cursor: 'pointer',
        }}><Plus size={15} /> Add Client</button>
      </div>

      <div style={{ position: 'relative', marginBottom: 16, maxWidth: 360 }}>
        <Search size={14} style={{ color: 'var(--muted)', position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
          style={{ ...inputStyle, paddingLeft: 36 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(300px, 100%), 1fr))', gap: 14 }}>
        {filtered.map(c => (
          <div key={c.id} className="glass-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{c.contactPerson}</div>
                {!!c.linkedUsers?.length && (
                  <span
                    title={`Linked login account${c.linkedUsers.length > 1 ? 's' : ''}: ${c.linkedUsers.map(u => `${u.name} (${u.email})`).join(', ')}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10, fontWeight: 700, color: 'var(--blue)', background: 'rgba(56,189,248,.12)', border: '1px solid rgba(56,189,248,.25)', borderRadius: 20, padding: '2px 8px' }}
                  >
                    <Link2 size={10} /> {c.linkedUsers.length} linked login{c.linkedUsers.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => openEdit(c)} style={{ padding: 5, background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)', borderRadius: 7, cursor: 'pointer', color: 'var(--blue)' }}><Edit2 size={12} /></button>
                <button onClick={() => remove(c)} style={{ padding: 5, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 7, cursor: 'pointer', color: 'var(--red)' }}><Trash2 size={12} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}><Phone size={11} /> {c.phone}</div>
              {c.city && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}><MapPin size={11} /> {c.city}</div>}
              {c.gstNo && <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>GST: {c.gstNo}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>Outstanding</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: Number(c.outstandingAmount) > 0 ? 'var(--red)' : 'var(--green)' }}>{fmtRs(c.outstandingAmount)}</div>
              </div>
              <button onClick={() => openDrawer(c)} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                background: 'color-mix(in srgb, var(--gold) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 20%, transparent)',
                borderRadius: 8, cursor: 'pointer', color: 'var(--gold)', fontSize: 12, fontWeight: 700,
              }}>View <ChevronRight size={12} /></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No clients found</div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{modal === 'create' ? 'New Client' : 'Edit Client'}</h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <div className="modal-grid">
              {[
                { key: 'name', label: 'Company Name *', full: true },
                { key: 'contactPerson', label: 'Contact Person *' },
                { key: 'phone', label: 'Phone *' },
                { key: 'email', label: 'Email' },
                { key: 'gstNo', label: 'GST Number' },
                { key: 'address', label: 'Address', full: true },
                { key: 'city', label: 'City' },
                { key: 'creditLimit', label: 'Credit Limit (₹)' },
              ].map(({ key, label, full }) => (
                <div key={key} style={{ gridColumn: full ? '1/-1' : 'auto' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>{label}</label>
                  <input type={key === 'creditLimit' ? 'number' : 'text'}
                    value={(form as Record<string, string | undefined>)[key] || ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={inputStyle} />
                </div>
              ))}
            </div>
            {error && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: 10, background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex: 2, padding: 10, background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))', color: '#111827', fontWeight: 800, borderRadius: 10, border: 'none', cursor: 'pointer' }}>
                {saving ? 'Saving…' : modal === 'create' ? 'Add Client' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(var(--shadow-rgb),.6)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setDrawer(null)}>
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{drawer.name}</h3>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{drawer.contactPerson} · {drawer.phone}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
              {(['overview', 'sites', 'ledger'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  flex: 1, padding: '11px', background: 'none', border: 'none',
                  borderBottom: `2px solid ${tab === t ? 'var(--gold)' : 'transparent'}`,
                  color: tab === t ? 'var(--gold)' : 'var(--muted)', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, textTransform: 'capitalize',
                }}>{t}</button>
              ))}
            </div>
            <div style={{ flex: 1, padding: '18px 20px', overflowY: 'auto' }}>
              {tab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[['Contact', drawer.contactPerson], ['Phone', drawer.phone], ['Email', drawer.email || '—'], ['GST No', drawer.gstNo || '—'], ['City', drawer.city || '—'], ['Credit Limit', fmtRs(drawer.creditLimit)], ['Outstanding', fmtRs(drawer.outstandingAmount)]].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
                      <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{k}</span>
                      <span style={{ fontWeight: 700, color: k === 'Outstanding' && Number(drawer.outstandingAmount) > 0 ? 'var(--red)' : 'var(--text)' }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
              {tab === 'sites' && (
                <div>
                  <button onClick={() => setSiteModal(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'color-mix(in srgb, var(--gold) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 20%, transparent)', borderRadius: 8, color: 'var(--gold)', cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
                    <Plus size={13} /> Add Site
                  </button>
                  {siteModal && (
                    <div style={{ padding: 14, background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 10, marginBottom: 12 }}>
                      {[['name', 'Site Name'], ['address', 'Address'], ['city', 'City']].map(([k, l]) => (
                        <div key={k} style={{ marginBottom: 8 }}>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>{l}</label>
                          <input value={(siteForm as Record<string, string>)[k] || ''} onChange={e => setSiteForm(f => ({ ...f, [k]: e.target.value }))} style={inputStyle} />
                        </div>
                      ))}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                        {([['latitude', 'Latitude'], ['longitude', 'Longitude']] as const).map(([k, l]) => (
                          <div key={k}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>{l}</label>
                            <input
                              type="number" step="any" inputMode="decimal"
                              placeholder={k === 'latitude' ? 'e.g. 23.0225' : 'e.g. 72.5714'}
                              value={(siteForm as Record<string, string>)[k] || ''}
                              onChange={e => setSiteForm(f => ({ ...f, [k]: e.target.value }))}
                              style={inputStyle}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.4 }}>
                        Optional GPS pin for the delivery site. When set, driver trips auto-complete on arrival within {150} m.
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => setSiteModal(false)} style={{ flex: 1, padding: '7px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--muted)', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={addSite} style={{ flex: 1, padding: '7px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                      </div>
                    </div>
                  )}
                  {sites.map(s => (
                    <div key={s.id} style={{ padding: '10px 12px', background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</span>
                        {s.latitude != null && s.longitude != null && (
                          <span title={`${s.latitude}, ${s.longitude}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--green)', background: 'rgba(34,197,94,.12)', border: '1px solid color-mix(in srgb, var(--green) 26%, transparent)', borderRadius: 20, padding: '1px 7px' }}>
                            <MapPin size={9} /> GPS pinned
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{[s.address, s.city].filter(Boolean).join(', ')}</div>
                    </div>
                  ))}
                  {!sites.length && !siteModal && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>No sites added</div>}
                </div>
              )}
              {tab === 'ledger' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Balance: </span>
                      <span style={{ fontWeight: 800, fontSize: 16, color: ledger.outstanding > 0 ? 'var(--red)' : 'var(--green)' }}>{fmtRs(ledger.outstanding)}</span>
                    </div>
                    <button onClick={() => setLedgerModal(l => !l)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', background: 'color-mix(in srgb, var(--gold) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 20%, transparent)', borderRadius: 8, color: 'var(--gold)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                      <Plus size={12} /> Entry
                    </button>
                  </div>
                  {ledgerModal && (
                    <div style={{ padding: 14, background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 10, marginBottom: 12 }}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>Type</label>
                        <select value={ledgerForm.type} onChange={e => setLedgerForm(f => ({ ...f, type: e.target.value }))}
                          style={{ ...inputStyle, padding: '8px 10px' }}>
                          <option value="debit">Debit (Invoice)</option>
                          <option value="credit">Credit (Payment)</option>
                        </select>
                      </div>
                      {[['amount', 'Amount (₹)'], ['description', 'Description'], ['referenceNo', 'Reference No']].map(([k, l]) => (
                        <div key={k} style={{ marginBottom: 8 }}>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>{l}</label>
                          <input type={k === 'amount' ? 'number' : 'text'} value={(ledgerForm as Record<string, string>)[k]} onChange={e => setLedgerForm(f => ({ ...f, [k]: e.target.value }))} style={inputStyle} />
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button onClick={() => setLedgerModal(false)} style={{ flex: 1, padding: '7px', background: 'transparent', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--muted)', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={addLedger} style={{ flex: 1, padding: '7px', background: 'var(--gold)', border: 'none', borderRadius: 8, color: '#111', fontWeight: 700, cursor: 'pointer' }}>Add</button>
                      </div>
                    </div>
                  )}
                  {ledger.entries.map(e => (
                    <div key={e.id} style={{ padding: '9px 11px', background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{e.description}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{e.referenceNo || '—'} · {new Date(e.createdAt).toLocaleDateString('en-IN')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: e.type === 'debit' ? 'var(--red)' : 'var(--green)' }}>{e.type === 'debit' ? '+' : '−'}{fmtRs(e.amount)}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>Bal: {fmtRs(e.runningBalance || 0)}</div>
                      </div>
                    </div>
                  ))}
                  {!ledger.entries.length && !ledgerModal && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>No entries</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
