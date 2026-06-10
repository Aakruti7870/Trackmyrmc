import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Printer, Share2, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { api, type Challan } from '@/lib/api';

export default function ChallanPrint() {
  const [, params] = useRoute('/challans/:id/print');
  const [challan, setChallan] = useState<Challan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params?.id) {
      api.get<Challan>(`/challans/${params.id}`)
        .then(c => { setChallan(c); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [params?.id]);

  function shareWhatsApp() {
    if (!challan) return;
    const msg = encodeURIComponent(
      `🏗️ *Aakruti Infra RMC Plant*\n` +
      `Challan No: #${challan.challanNo}\n` +
      `Client: ${challan.clientName}\n` +
      `Site: ${challan.siteName || '—'}\n` +
      `Grade: ${challan.grade} | Qty: ${challan.quantity} m³\n` +
      `Vehicle: ${challan.vehicleNo || '—'}\n` +
      `Driver: ${challan.driverName || '—'}\n` +
      `Dispatch: ${challan.dispatchTime ? new Date(challan.dispatchTime).toLocaleString('en-IN') : '—'}\n` +
      `Status: ${challan.status.toUpperCase()}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08111f', color: '#9fb0c7' }}>
      Loading challan…
    </div>
  );

  if (!challan) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08111f', color: '#ef4444', flexDirection: 'column', gap: 12 }}>
      <div>Challan not found</div>
      <Link href="/dispatch"><span style={{ color: '#38bdf8', fontSize: 13 }}>← Back to Dispatch</span></Link>
    </div>
  );

  return (
    <>
      {/* Print controls — hidden on print */}
      <div className="no-print" style={{
        background: '#0d1930', borderBottom: '1px solid #263449', padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href="/dispatch">
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#9fb0c7', cursor: 'pointer', fontSize: 13 }}>
            <ArrowLeft size={14} /> Back
          </button>
        </Link>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>Challan #{challan.challanNo}</div>
        <button onClick={shareWhatsApp} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)',
          borderRadius: 8, color: '#22c55e', cursor: 'pointer', fontSize: 13, fontWeight: 700,
        }}><Share2 size={14} /> WhatsApp</button>
        <button onClick={() => window.print()} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          background: 'linear-gradient(135deg,#ffe08a,#f6b818)',
          borderRadius: 8, color: '#111827', cursor: 'pointer', fontSize: 13, fontWeight: 800, border: 'none',
        }}><Printer size={14} /> Print</button>
      </div>

      {/* A4 Challan */}
      <div className="challan-page" style={{
        background: '#fff', color: '#1a1a1a', fontFamily: 'Arial, sans-serif',
        maxWidth: 794, margin: '24px auto', padding: '40px', boxShadow: '0 4px 24px rgba(0,0,0,.15)',
        minHeight: 1123,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #d97706', paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#1a1a1a' }}>AAKRUTI INFRA RMC PLANT</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>Ready Mix Concrete Manufacturer</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>MIDC Industrial Area, Navi Mumbai — Maharashtra</div>
            <div style={{ fontSize: 11, color: '#888' }}>GST: 27AAACA1234B1Z5 | Ph: +91 9876543210</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#d97706', letterSpacing: '-1px' }}>CHALLAN</div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: '#1a1a1a' }}>#{challan.challanNo}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
              Date: {challan.dispatchTime ? new Date(challan.dispatchTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Client + Site */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div style={{ padding: 14, background: '#fafafa', border: '1px solid #eee', borderRadius: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Bill To</div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{challan.clientName}</div>
            {challan.siteName && <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Site: {challan.siteName}</div>}
          </div>
          <div style={{ padding: 14, background: '#fafafa', border: '1px solid #eee', borderRadius: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>Transport Details</div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{challan.vehicleNo || '—'}</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>Driver: {challan.driverName || '—'}</div>
            {challan.driverPhone && <div style={{ fontSize: 12, color: '#555' }}>Ph: {challan.driverPhone}</div>}
          </div>
        </div>

        {/* Material table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#d97706', color: '#fff' }}>
              {['Sr.', 'Description', 'Grade', 'Quantity (m³)', 'Pump Required'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: '#fffbf0', borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px' }}>1</td>
              <td style={{ padding: '12px', fontWeight: 600 }}>Ready Mix Concrete (RMC)</td>
              <td style={{ padding: '12px', fontWeight: 800, color: '#d97706' }}>{challan.grade}</td>
              <td style={{ padding: '12px', fontWeight: 800, fontSize: 16 }}>{challan.quantity}</td>
              <td style={{ padding: '12px', color: challan.pumpRequired ? '#16a34a' : '#555' }}>
                {challan.pumpRequired ? '✓ Yes' : 'No'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Dispatch info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
          {[
            ['Dispatch Time', challan.dispatchTime ? new Date(challan.dispatchTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'],
            ['Delivery Time', challan.deliveryTime ? new Date(challan.deliveryTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'],
            ['Status', challan.status.toUpperCase()],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: 12, background: '#fafafa', border: '1px solid #eee', borderRadius: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{v}</div>
            </div>
          ))}
        </div>

        {challan.notes && (
          <div style={{ padding: 12, background: '#fffbf0', border: '1px solid #f0e0a0', borderRadius: 6, marginBottom: 24, fontSize: 12 }}>
            <span style={{ fontWeight: 700 }}>Notes: </span>{challan.notes}
          </div>
        )}

        {/* Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginTop: 40 }}>
          {['Customer Signature', 'Driver Signature', 'Plant Supervisor'].map(sig => (
            <div key={sig} style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1.5px solid #ccc', paddingTop: 8, marginTop: 40 }}>
                <div style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>{sig}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 30, borderTop: '1px solid #eee', paddingTop: 12, textAlign: 'center', fontSize: 10, color: '#aaa' }}>
          This is a computer generated challan. For queries contact: admin@aakruti.com | This document is valid only with company stamp.
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .challan-page { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; }
        }
      `}</style>
    </>
  );
}
