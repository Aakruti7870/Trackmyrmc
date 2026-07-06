import { BarChart3, PieChart, TrendingUp, MapPinned } from 'lucide-react';
import { SectionHeading, GlassPanel, Donut, BarRow, MiniBars, SampleTag, } from '../ui';
import { mix } from '../tokens';
import { GRADE_MIX, CITY_VOLUME, CUSTOMER_GROWTH } from '../data';

export default function Analytics({ accent }: { accent: string }) {
  const cityMax = Math.max(...CITY_VOLUME.map(c => c.value));

  return (
    <div className="cc-in">
      <SectionHeading
        icon={<BarChart3 size={20} />} accent={accent}
        title="Business Analytics"
        subtitle="Demand, mix and growth across the marketplace"
        right={<SampleTag text="Illustrative" />}
      />

      <div className="cc-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))' }}>
        <GlassPanel accent="#a78bfa">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <PieChart size={16} color="#a78bfa" />
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Grade mix</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <Donut slices={GRADE_MIX} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 120 }}>
              {GRADE_MIX.map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color }} />
                  <span style={{ color: 'var(--text)', fontWeight: 700 }}>{s.label}</span>
                  <span style={{ color: 'var(--muted)', marginLeft: 'auto', fontWeight: 700 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>

        <GlassPanel accent="var(--blue)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <MapPinned size={16} color="var(--blue)" />
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Volume by city (m³)</span>
          </div>
          {CITY_VOLUME.map(c => (
            <BarRow key={c.name} label={c.name} value={c.value} max={cityMax} accent="var(--blue)" />
          ))}
        </GlassPanel>

        <GlassPanel accent="var(--green)">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <TrendingUp size={16} color="var(--green)" />
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Customer growth</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', marginBottom: 12 }}>
            +{CUSTOMER_GROWTH.reduce((s, d) => s + d.value, 0)} <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>new / 6 mo</span>
          </div>
          <MiniBars data={CUSTOMER_GROWTH} accent="var(--green)" height={84} />
        </GlassPanel>

        <GlassPanel accent={accent}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <BarChart3 size={16} color={accent} />
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Marketplace snapshot</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { k: 'Order fill rate', v: '96.4%', c: 'var(--green)' },
              { k: 'Avg. delivery time', v: '38 min', c: 'var(--blue)' },
              { k: 'Repeat customers', v: '61%', c: '#a78bfa' },
              { k: 'On-time dispatch', v: '92%', c: 'var(--orange)' },
            ].map(m => (
              <div key={m.k} style={{ padding: 12, borderRadius: 12, background: mix(m.c, 10), border: `1px solid ${mix(m.c, 24)}` }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>{m.v}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{m.k}</div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
