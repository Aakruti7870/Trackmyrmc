import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Clock, Truck, Radio } from 'lucide-react';
import { api, type Challan } from '@/lib/api';

interface VehiclePos {
  id: string;
  challanNo: string;
  vehicleNo: string;
  driver: string;
  clientName: string;
  site: string;
  grade: string;
  qty: number;
  status: string;
  x: number;
  y: number;
  eta: number;
  speed: number;
  heading: number;
  trail: { x: number; y: number }[];
}

function seededRand(seed: string, offset = 0) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  h ^= offset;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) / 0xFFFFFFFF;
}

function buildVehicles(challans: Challan[]): VehiclePos[] {
  const active = challans.filter(c => c.status === 'dispatched');
  return active.map((ch) => {
    const id = String(ch.id);
    return {
      id,
      challanNo: ch.challanNo,
      vehicleNo: ch.vehicleNo || 'TM-00',
      driver: ch.driverName || 'Unassigned',
      clientName: ch.clientName || '',
      site: ch.siteName || ch.clientName || '',
      grade: ch.grade,
      qty: Number(ch.quantity),
      status: ch.status,
      x: 15 + seededRand(id, 1) * 70,
      y: 15 + seededRand(id, 2) * 70,
      eta: Math.floor(8 + seededRand(id, 3) * 28),
      speed: Math.floor(28 + seededRand(id, 4) * 24),
      heading: seededRand(id, 5) * 360,
      trail: [],
    };
  });
}

export default function LiveGPSTracker() {
  const [vehicles, setVehicles] = useState<VehiclePos[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    api.get<Challan[]>('/challans').then(challans => {
      const initial = buildVehicles(challans);
      if (initial.length > 0) setSelected(initial[0].id);
      setVehicles(initial);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
      setVehicles(prev => prev.map(v => {
        const rad = (v.heading * Math.PI) / 180;
        const step = 0.4 + Math.random() * 0.4;
        const newX = Math.max(5, Math.min(95, v.x + Math.cos(rad) * step));
        const newY = Math.max(5, Math.min(95, v.y + Math.sin(rad) * step));
        const headingDelta = (Math.random() - 0.5) * 18;
        const newEta = Math.max(1, v.eta - (Math.random() < 0.15 ? 1 : 0));
        const trail = [...v.trail.slice(-6), { x: v.x, y: v.y }];
        return { ...v, x: newX, y: newY, heading: (v.heading + headingDelta + 360) % 360, eta: newEta, trail, speed: Math.floor(22 + Math.random() * 30) };
      }));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(38,52,73,0.35)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += W / 8) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += H / 5) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    [[[0.1, 0.5], [0.9, 0.5]], [[0.5, 0.1], [0.5, 0.9]], [[0.1, 0.2], [0.8, 0.7]], [[0.2, 0.8], [0.9, 0.3]], [[0.15, 0.6], [0.6, 0.15]]].forEach(road => {
      ctx.beginPath(); ctx.strokeStyle = 'rgba(55,75,100,0.5)'; ctx.lineWidth = 2.5;
      ctx.moveTo(road[0][0] * W, road[0][1] * H); ctx.lineTo(road[1][0] * W, road[1][1] * H); ctx.stroke();
    });

    [{ label: 'PLANT', x: 0.5, y: 0.5, col: '#178a6e' }, { label: 'Panvel Site', x: 0.12, y: 0.2, col: '#22c55e' }, { label: 'Thane Tower', x: 0.82, y: 0.3, col: '#22c55e' }, { label: 'Kharghar', x: 0.75, y: 0.78, col: '#22c55e' }].forEach(s => {
      const r = s.col === '#178a6e' ? 8 : 5;
      ctx.beginPath(); ctx.arc(s.x * W, s.y * H, r, 0, Math.PI * 2); ctx.fillStyle = s.col + '30'; ctx.fill();
      ctx.beginPath(); ctx.arc(s.x * W, s.y * H, r, 0, Math.PI * 2); ctx.strokeStyle = s.col; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = s.col; ctx.font = `bold ${r === 8 ? 10 : 8}px Inter, sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(s.label, s.x * W, s.y * H - (r === 8 ? 14 : 11));
    });

    const colors = ['#178a6e', '#22c55e', '#38bdf8', '#a78bfa', '#f97316'];
    vehicles.forEach((v, i) => {
      const px = (v.x / 100) * W, py = (v.y / 100) * H;
      const isSel = selected === v.id;
      const col = colors[i % colors.length];
      if (v.trail.length > 1) {
        ctx.beginPath(); ctx.moveTo((v.trail[0].x / 100) * W, (v.trail[0].y / 100) * H);
        v.trail.forEach(pt => ctx.lineTo((pt.x / 100) * W, (pt.y / 100) * H));
        ctx.lineTo(px, py); ctx.strokeStyle = isSel ? 'rgba(23,138,110,0.4)' : 'rgba(56,189,248,0.25)';
        ctx.lineWidth = isSel ? 2 : 1.5; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
      }
      if (isSel) { ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2); ctx.fillStyle = 'rgba(23,138,110,0.12)'; ctx.fill(); }
      ctx.beginPath(); ctx.arc(px, py, isSel ? 10 : 7, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ctx.beginPath(); ctx.arc(px, py, isSel ? 10 : 7, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      const rad = (v.heading * Math.PI) / 180;
      ctx.beginPath(); ctx.moveTo(px + Math.cos(rad) * (isSel ? 12 : 9), py + Math.sin(rad) * (isSel ? 12 : 9));
      ctx.lineTo(px + Math.cos(rad - 2.4) * 5, py + Math.sin(rad - 2.4) * 5);
      ctx.lineTo(px + Math.cos(rad + 2.4) * 5, py + Math.sin(rad + 2.4) * 5);
      ctx.closePath(); ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 7px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((i + 1).toString(), px, py); ctx.textBaseline = 'alphabetic';
    });
  }, [vehicles, selected]);

  const selVehicle = vehicles.find(v => v.id === selected);

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Driver Live GPS</span>
          <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,.12)', color: '#22c55e' }}>{vehicles.length} ON ROAD</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Updated {lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>

      <div className="ck-gps-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 200px' }}>
        <div style={{ position: 'relative', background: 'radial-gradient(circle at 50% 50%, #0d1f38, #050d18)' }}>
          <canvas ref={canvasRef} width={460} height={220} style={{ width: '100%', height: 220, display: 'block' }} />
          {vehicles.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Navigation size={28} color="#263449" />
              <span style={{ color: '#263449', fontSize: 13, fontWeight: 600 }}>No vehicles dispatched</span>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 8, left: 10, display: 'flex', gap: 10, fontSize: 10, color: '#9fb0c7' }}>
            {vehicles.map((v, i) => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ['#178a6e','#22c55e','#38bdf8','#a78bfa','#f97316'][i % 5] }} />
                {v.vehicleNo.split(' ').slice(-1)[0]}
              </div>
            ))}
          </div>
        </div>

        <div className="ck-gps-list" style={{ borderLeft: '1px solid var(--line)', overflowY: 'auto', maxHeight: 220 }}>
          {vehicles.length === 0 && (
            <div style={{ padding: '20px 12px', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>Generate a challan to see live tracking</div>
          )}
          {vehicles.map((v, i) => {
            const isSel = selected === v.id;
            const col = ['#178a6e','#22c55e','#38bdf8','#a78bfa','#f97316'][i % 5];
            return (
              <div key={v.id} onClick={() => setSelected(v.id)} style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: isSel ? 'var(--menu-hover)' : 'transparent', transition: 'background .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 11, fontFamily: 'monospace' }}>{v.vehicleNo}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3, paddingLeft: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.driver}</div>
                <div style={{ display: 'flex', gap: 6, paddingLeft: 14 }}>
                  <span style={{ fontSize: 10, color: col, fontWeight: 700 }}><Clock size={9} style={{ display: 'inline', marginRight: 2 }} />{v.eta} min</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{v.speed} km/h</span>
                </div>
                <div style={{ paddingLeft: 14, marginTop: 3, fontSize: 9, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {v.site}</div>
              </div>
            );
          })}
        </div>
      </div>

      {selVehicle && (
        <div style={{ borderTop: '1px solid var(--line)', padding: '10px 16px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Truck size={14} color="#178a6e" /><span style={{ fontWeight: 800, fontSize: 13, fontFamily: 'monospace' }}>{selVehicle.vehicleNo}</span></div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}><span style={{ color: 'var(--text)', fontWeight: 600 }}>{selVehicle.driver}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}><MapPin size={12} color="#22c55e" /><span style={{ color: 'var(--muted)' }}>{selVehicle.site}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}><Clock size={12} color="#38bdf8" /><span style={{ color: 'var(--text)', fontWeight: 700 }}>ETA {selVehicle.eta} min</span></div>
          <div style={{ fontSize: 12 }}>
            <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(56,189,248,.12)', color: '#38bdf8' }}>{selVehicle.grade}</span>
            <span style={{ marginLeft: 6, color: 'var(--muted)', fontSize: 11 }}>{selVehicle.qty} m³</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
            <Radio size={11} color="#22c55e" />
            <span style={{ color: '#22c55e', fontWeight: 600 }}>{selVehicle.speed} km/h</span>
            <span>· Challan #{selVehicle.challanNo}</span>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(1.3); } }`}</style>
    </div>
  );
}
