import { useEffect, useState } from 'react';
import { Truck, Wrench, CircleCheck, IdCard } from 'lucide-react';
import { api, type Vehicle, type Driver } from '@/lib/api';
import { SectionHeading, GlassPanel, StatCard, Badge, } from '../ui';
import { mix } from '../tokens';

export default function Fleet({ accent }: { accent: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([api.get<Vehicle[]>('/vehicles'), api.get<Driver[]>('/drivers')])
      .then(([v, d]) => {
        if (!alive) return;
        if (v.status === 'fulfilled' && Array.isArray(v.value)) setVehicles(v.value);
        if (d.status === 'fulfilled' && Array.isArray(d.value)) setDrivers(d.value);
        setLoaded(true);
      });
    return () => { alive = false; };
  }, []);

  const norm = (s: string) => (s || '').toLowerCase();
  const active = vehicles.filter(v => norm(v.status) === 'active' || norm(v.status) === 'available').length;
  const maint = vehicles.filter(v => norm(v.status).includes('maintenance') || norm(v.status).includes('service')).length;
  const activeDrivers = drivers.filter(d => d.isActive).length;

  const statusColor = (s: string) => {
    const n = norm(s);
    if (n.includes('maintenance') || n.includes('service')) return 'var(--orange)';
    if (n.includes('trip') || n.includes('transit') || n.includes('busy')) return 'var(--blue)';
    if (n === 'active' || n === 'available') return 'var(--green)';
    return 'var(--muted)';
  };

  return (
    <div className="cc-in">
      <SectionHeading
        icon={<Truck size={20} />} accent={accent}
        title="Fleet &amp; Drivers"
        subtitle="Transit mixer fleet health and driver roster"
      />

      <div className="cc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 16 }}>
        <StatCard icon={<Truck size={17} />} label="Total vehicles" accent={accent} value={loaded ? vehicles.length : '…'} />
        <StatCard icon={<CircleCheck size={17} />} label="Available" accent="var(--green)" value={loaded ? active : '…'} />
        <StatCard icon={<Wrench size={17} />} label="In service" accent="var(--orange)" value={loaded ? maint : '…'} />
        <StatCard icon={<IdCard size={17} />} label="Active drivers" accent="var(--blue)" value={loaded ? activeDrivers : '…'} />
      </div>

      <GlassPanel accent={accent}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>Fleet roster</div>
        <div className="cc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {vehicles.map(v => {
            const col = statusColor(v.status);
            return (
              <div key={v.id} style={{
                padding: 13, borderRadius: 13, background: 'var(--surface)', border: `1px solid ${mix(col, 22)}`,
                display: 'flex', flexDirection: 'column', gap: 7,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{v.vehicleNo}</span>
                  <Badge color={col} dot>{v.status}</Badge>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  {v.type} • {v.capacity}
                </div>
                {v.driverName && (
                  <div style={{ fontSize: 11.5, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <IdCard size={12} color="var(--muted)" /> {v.driverName}
                  </div>
                )}
              </div>
            );
          })}
          {loaded && vehicles.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13, gridColumn: '1 / -1' }}>
              No vehicles registered yet.
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
