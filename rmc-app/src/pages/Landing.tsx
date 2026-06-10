import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  MapPin, ArrowRight, Phone, Mail, MessageCircle,
  Truck, Factory, Gauge, Clock, Boxes, CheckCircle2, ShieldCheck,
} from 'lucide-react';
import bg from '@/assets/rmc-aerial-bg.png';

const WA = 'https://wa.me/919850612834';
const TEL = 'tel:+919850612834';
const MAIL = 'mailto:aakruti.infrarmc@gmail.com';
const PHONE = '+91 98506 12834';
const EMAIL = 'aakruti.infrarmc@gmail.com';
const ADDRESS = 'Karanjade, Panvel, Maharashtra 410206';
const GRADES = ['M20', 'M25', 'M30', 'M35', 'M40', 'M50'];

function useViewport() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const SHAPES: Record<string, { label: string; dims: [string, string, string] }> = {
  slab: { label: 'Slab / Raft', dims: ['Length', 'Width', 'Thickness'] },
  column: { label: 'Column', dims: ['Width', 'Depth', 'Height'] },
  beam: { label: 'Beam', dims: ['Length', 'Width', 'Depth'] },
  footing: { label: 'Footing', dims: ['Length', 'Width', 'Depth'] },
};

export default function Landing() {
  const [, setLoc] = useLocation();
  const w = useViewport();
  const isMobile = w < 760;
  const isNarrow = w < 1040;

  const [shape, setShape] = useState('slab');
  const [unit, setUnit] = useState<'ft' | 'm'>('ft');
  const [d1, setD1] = useState('');
  const [d2, setD2] = useState('');
  const [d3, setD3] = useState('');
  const [grade, setGrade] = useState('M25');

  const factor = unit === 'ft' ? 0.0283168 : 1;
  const raw = (parseFloat(d1) || 0) * (parseFloat(d2) || 0) * (parseFloat(d3) || 0);
  const net = raw * factor;
  const wastage = net * 0.05;
  const total = net + wastage;

  const card: React.CSSProperties = {
    background: 'linear-gradient(160deg, color-mix(in srgb, var(--panel) 92%, transparent), color-mix(in srgb, var(--panel2) 88%, transparent))',
    border: '1px solid var(--line)',
    borderRadius: 18,
    boxShadow: '0 18px 40px rgba(0,0,0,.28)',
  };
  const sectionPad: React.CSSProperties = {
    maxWidth: 1120, margin: '0 auto', padding: isMobile ? '64px 20px' : '92px 32px',
  };
  const kicker = (t: string) => (
    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>{t}</div>
  );
  const navLink = (label: string, id: string) => (
    <button key={id} onClick={() => scrollTo(id)} style={{
      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
      fontSize: 14, fontWeight: 600, fontFamily: 'inherit', padding: '6px 4px',
    }}>{label}</button>
  );

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-app)', minHeight: '100vh' }}>

      {/* Top navigation */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        backdropFilter: 'blur(12px)',
        background: 'color-mix(in srgb, var(--bg) 72%, transparent)',
        borderBottom: '1px solid var(--line)',
      }}>
        <div style={{
          maxWidth: 1120, margin: '0 auto', padding: isMobile ? '12px 18px' : '14px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <button onClick={() => scrollTo('top')} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(145deg,var(--gold-hi),var(--gold-mid) 45%,var(--gold-dark))',
              display: 'grid', placeItems: 'center', color: '#111827', fontWeight: 900, fontSize: 20,
              boxShadow: '0 10px 24px color-mix(in srgb, var(--gold) 26%, transparent)',
            }}>A</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '.3px', color: 'var(--text)', lineHeight: 1 }}>AAKRUTI INFRA</div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '2px', color: 'var(--muted)', marginTop: 3 }}>RMC PLANT · PANVEL</div>
            </div>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 22 }}>
            {!isNarrow && (
              <nav style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                {navLink('Services', 'services')}
                {navLink('Calculator', 'calculator')}
                {navLink('About', 'about')}
                {navLink('Contact', 'contact')}
              </nav>
            )}
            <button onClick={() => setLoc('/login')} style={{
              padding: isMobile ? '9px 16px' : '10px 22px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
              color: '#111827', fontWeight: 800, fontSize: 14, fontFamily: 'inherit',
              boxShadow: '0 10px 24px color-mix(in srgb, var(--gold) 24%, transparent)',
            }}>Login</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="top" style={{ position: 'relative', overflow: 'hidden', minHeight: isMobile ? 'auto' : 'calc(100vh - 70px)' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg) 70%, transparent) 0%, color-mix(in srgb, var(--bg) 52%, transparent) 38%, var(--bg) 100%)' }} />
        {!isMobile && (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, color-mix(in srgb, var(--bg) 80%, transparent) 0%, color-mix(in srgb, var(--bg) 35%, transparent) 45%, transparent 70%)' }} />
        )}

        {/* Watermark monogram */}
        {!isNarrow && (
          <div style={{
            position: 'absolute', right: '6%', top: '50%', transform: 'translateY(-50%)',
            fontSize: 360, fontWeight: 900, lineHeight: 1, color: 'transparent',
            WebkitTextStroke: '2px color-mix(in srgb, var(--gold) 22%, transparent)',
            opacity: 0.5, userSelect: 'none', pointerEvents: 'none',
          }}>A</div>
        )}

        <div style={{ position: 'relative', maxWidth: 1120, margin: '0 auto', padding: isMobile ? '56px 20px 64px' : '0 32px', minHeight: isMobile ? 'auto' : 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ maxWidth: 640 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 999,
              border: '1px solid color-mix(in srgb, var(--gold) 32%, transparent)',
              background: 'color-mix(in srgb, var(--gold) 10%, transparent)', marginBottom: 26,
            }}>
              <MapPin size={14} style={{ color: 'var(--gold)' }} />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '1.5px', color: 'var(--gold)' }}>KARANJADE, PANVEL · NAVI MUMBAI · JNPT CORRIDOR</span>
            </div>

            <h1 style={{ margin: 0, fontSize: isMobile ? 46 : 76, fontWeight: 900, lineHeight: 0.98, letterSpacing: '-1.5px', color: 'var(--text)' }}>
              Concrete,<br />
              <span style={{
                background: 'linear-gradient(100deg, var(--gold-hi), var(--gold) 55%, var(--gold-dark))',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>refined to a craft.</span>
            </h1>

            <p style={{ marginTop: 24, marginBottom: 0, fontSize: isMobile ? 16 : 18, lineHeight: 1.65, color: 'var(--muted)', maxWidth: 560 }}>
              Plant-precision ready-mix from Aakruti Infra — delivered on time with live GPS tracking, digital challans, and lab-grade quality control, from our batching plant to your pour.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 34 }}>
              <a href={WA} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 9, padding: '14px 26px', borderRadius: 999,
                background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
                color: '#111827', fontWeight: 800, fontSize: 15, textDecoration: 'none',
                boxShadow: '0 14px 32px color-mix(in srgb, var(--gold) 26%, transparent)',
              }}>Get a Quote <ArrowRight size={17} /></a>
              <button onClick={() => scrollTo('services')} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 26px', borderRadius: 999, cursor: 'pointer',
                background: 'color-mix(in srgb, var(--text) 6%, transparent)', border: '1px solid var(--line)',
                color: 'var(--text)', fontWeight: 700, fontSize: 15, fontFamily: 'inherit',
              }}>Our Services</button>
            </div>

            <button onClick={() => setLoc('/login')} style={{
              marginTop: 22, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: 'var(--muted)', fontSize: 14, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              Existing customer? <span style={{ color: 'var(--gold)', fontWeight: 700 }}>Login to your portal →</span>
            </button>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 28 : 48, marginTop: 44 }}>
              {[['15+', 'Concrete grades'], ['24/7', 'Live GPS tracking'], ['100%', 'Automated batching']].map(([n, l]) => (
                <div key={l}>
                  <div style={{ fontSize: isMobile ? 28 : 34, fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>{n}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.5px', color: 'var(--muted)', marginTop: 6, textTransform: 'uppercase' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" style={{ ...sectionPad, scrollMarginTop: 80 }}>
        {kicker('Ready-Mix Concrete Services')}
        <h2 style={{ margin: '0 0 14px', fontSize: isMobile ? 30 : 40, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--text)' }}>
          Premium concrete supply & pumping
        </h2>
        <p style={{ margin: '0 0 40px', color: 'var(--muted)', fontSize: 16, lineHeight: 1.6, maxWidth: 620 }}>
          Delivered from our fully automated plant in Panvel. Tap any service to enquire directly with our team.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 22 }}>
          {[
            { icon: Factory, title: 'Ready-Mix Concrete Supply', body: 'M20–M50 grades from our fully automated batching plant in Panvel. Consistent quality and timely delivery across Navi Mumbai and the JNPT Corridor.' },
            { icon: Truck, title: 'Concrete Pump Rental', body: 'Boom pumps, line pumps, and truck-mounted pumps available on daily or monthly rental for your project site.' },
          ].map(s => (
            <div key={s.title} style={{ ...card, padding: 28 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, display: 'grid', placeItems: 'center', marginBottom: 18,
                background: 'color-mix(in srgb, var(--gold) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 28%, transparent)',
              }}>
                <s.icon size={24} style={{ color: 'var(--gold)' }} />
              </div>
              <h3 style={{ margin: '0 0 10px', fontSize: 21, fontWeight: 800, color: 'var(--text)' }}>{s.title}</h3>
              <p style={{ margin: '0 0 22px', color: 'var(--muted)', fontSize: 15, lineHeight: 1.6 }}>{s.body}</p>
              <a href={WA} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--gold)', fontWeight: 800, fontSize: 14, textDecoration: 'none',
              }}>Enquire <ArrowRight size={15} /></a>
            </div>
          ))}
        </div>
      </section>

      {/* Calculator */}
      <section id="calculator" style={{ scrollMarginTop: 80, background: 'var(--bg-deep, var(--bg))', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ ...sectionPad }}>
          {kicker('Concrete Calculator')}
          <h2 style={{ margin: '0 0 14px', fontSize: isMobile ? 30 : 40, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--text)' }}>
            How much concrete do you need?
          </h2>
          <p style={{ margin: '0 0 40px', color: 'var(--muted)', fontSize: 16, lineHeight: 1.6, maxWidth: 620 }}>
            Enter your element dimensions to estimate the cubic metres required — then request that exact quantity from us in one tap.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1.15fr 1fr', gap: 22 }}>
            {/* Inputs */}
            <div style={{ ...card, padding: 26 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {Object.entries(SHAPES).map(([k, v]) => (
                  <button key={k} onClick={() => setShape(k)} style={{
                    padding: '9px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 13, fontWeight: 700,
                    border: shape === k ? '1px solid color-mix(in srgb, var(--gold) 50%, transparent)' : '1px solid var(--line)',
                    background: shape === k ? 'color-mix(in srgb, var(--gold) 16%, transparent)' : 'transparent',
                    color: shape === k ? 'var(--gold)' : 'var(--muted)',
                  }}>{v.label}</button>
                ))}
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, letterSpacing: '.4px' }}>MEASUREMENT UNIT</div>
                <div style={{ display: 'inline-flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
                  {(['ft', 'm'] as const).map(u => (
                    <button key={u} onClick={() => setUnit(u)} style={{
                      padding: '9px 22px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, border: 'none',
                      background: unit === u ? 'color-mix(in srgb, var(--gold) 18%, transparent)' : 'transparent',
                      color: unit === u ? 'var(--gold)' : 'var(--muted)',
                    }}>{u === 'ft' ? 'Feet' : 'Metres'}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
                {SHAPES[shape].dims.map((label, i) => (
                  <div key={label}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>{label} ({unit})</label>
                    <input
                      type="number" min="0" inputMode="decimal" placeholder="0"
                      value={[d1, d2, d3][i]}
                      onChange={e => [setD1, setD2, setD3][i](e.target.value)}
                      style={{
                        width: '100%', padding: '11px 12px', borderRadius: 10, boxSizing: 'border-box',
                        background: 'color-mix(in srgb, var(--text) 4%, transparent)', border: '1px solid var(--line)',
                        color: 'var(--text)', fontSize: 15, outline: 'none', fontFamily: 'inherit',
                      }}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Concrete Grade</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {GRADES.map(g => (
                    <button key={g} onClick={() => setGrade(g)} style={{
                      padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                      border: grade === g ? '1px solid color-mix(in srgb, var(--gold) 50%, transparent)' : '1px solid var(--line)',
                      background: grade === g ? 'color-mix(in srgb, var(--gold) 16%, transparent)' : 'transparent',
                      color: grade === g ? 'var(--gold)' : 'var(--muted)',
                    }}>{g}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Result */}
            <div style={{
              ...card, padding: 28, display: 'flex', flexDirection: 'column',
              background: 'linear-gradient(160deg, color-mix(in srgb, var(--gold) 12%, var(--panel)), color-mix(in srgb, var(--panel2) 90%, transparent))',
              border: '1px solid color-mix(in srgb, var(--gold) 26%, transparent)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.5px' }}>ESTIMATED CONCRETE</div>
              <div style={{ fontSize: 56, fontWeight: 900, color: 'var(--gold)', lineHeight: 1.05, margin: '6px 0 4px' }}>
                {total.toFixed(2)}<span style={{ fontSize: 24 }}>m³</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>Suggested order quantity ({grade})</div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                <Row k="Net volume" v={`${net.toFixed(2)} m³`} />
                <Row k="+ Wastage (5%)" v={`${wastage.toFixed(2)} m³`} />
                <Row k="Total required" v={`${total.toFixed(2)} m³`} bold />
              </div>

              <a
                href={`${WA}?text=${encodeURIComponent(`Hi Aakruti Infra, I'd like to order approximately ${total.toFixed(2)} m³ of ${grade} concrete.`)}`}
                target="_blank" rel="noreferrer"
                style={{
                  marginTop: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '13px', borderRadius: 12, textDecoration: 'none',
                  background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))',
                  color: '#111827', fontWeight: 800, fontSize: 15,
                  boxShadow: '0 12px 28px color-mix(in srgb, var(--gold) 22%, transparent)',
                }}>
                <MessageCircle size={17} /> Request this quantity
              </a>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, textAlign: 'center' }}>
                Estimate only. Final quantity is confirmed at the plant before dispatch.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" style={{ ...sectionPad, scrollMarginTop: 80 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1.1fr 1fr', gap: 44, alignItems: 'center' }}>
          <div>
            {kicker('About Us')}
            <h2 style={{ margin: '0 0 18px', fontSize: isMobile ? 28 : 38, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--text)' }}>
              Serving Panvel & Navi Mumbai
            </h2>
            <p style={{ margin: '0 0 26px', color: 'var(--muted)', fontSize: 16, lineHeight: 1.7 }}>
              Aakruti Infra Pvt. Ltd. operates a fully automated Ready-Mix Concrete batching plant in Karanjade, Panvel.
              We supply consistent, high-grade concrete — M20 through M50 — to construction projects across Panvel,
              Navi Mumbai, and the JNPT Corridor. Every batch is plant-tested; every delivery is GPS-tracked from our yard to your site.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                [MapPin, 'Location', ADDRESS],
                [Phone, 'Contact', PHONE],
                [Boxes, 'Grades Available', GRADES.join(', ')],
              ].map(([Icon, label, val]) => {
                const I = Icon as typeof MapPin;
                return (
                  <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--gold) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 24%, transparent)' }}>
                      <I size={18} style={{ color: 'var(--gold)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.8px', color: 'var(--muted)', textTransform: 'uppercase' }}>{label as string}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>{val as string}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { icon: Gauge, n: '24/7', l: 'Live GPS Tracking' },
              { icon: Factory, n: '100%', l: 'Automated Batching' },
              { icon: Boxes, n: '15+', l: 'Concrete Grades' },
              { icon: Clock, n: 'On-Time', l: 'Delivery' },
            ].map(s => (
              <div key={s.l} style={{ ...card, padding: 22 }}>
                <s.icon size={22} style={{ color: 'var(--gold)' }} />
                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', marginTop: 14 }}>{s.n}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 48, paddingTop: 32, borderTop: '1px solid var(--line)' }}>
          {[
            [ShieldCheck, 'Plant-tested every batch'],
            [CheckCircle2, 'Digital challans on dispatch'],
            [Truck, 'Modern transit-mixer fleet'],
          ].map(([Icon, t]) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <div key={t as string} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 14, fontWeight: 600 }}>
                <I size={18} style={{ color: 'var(--green)' }} /> {t as string}
              </div>
            );
          })}
        </div>
      </section>

      {/* Contact / Footer */}
      <section id="contact" style={{ scrollMarginTop: 80, borderTop: '1px solid var(--line)', background: 'linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--gold) 5%, var(--bg)))' }}>
        <div style={{ ...sectionPad, textAlign: 'center' }}>
          {kicker('Get In Touch')}
          <h2 style={{ margin: '0 auto 16px', fontSize: isMobile ? 30 : 42, fontWeight: 900, letterSpacing: '-0.5px', color: 'var(--text)', maxWidth: 640 }}>
            Ready to pour? Let’s talk concrete.
          </h2>
          <p style={{ margin: '0 auto 34px', color: 'var(--muted)', fontSize: 16, lineHeight: 1.6, maxWidth: 560 }}>
            Reach our Panvel plant directly for quotes, grades, scheduling, and pump rental.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginBottom: 40 }}>
            <a href={WA} target="_blank" rel="noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 9, padding: '14px 26px', borderRadius: 999, textDecoration: 'none',
              background: 'linear-gradient(135deg,var(--gold-hi),var(--gold-mid) 48%,var(--gold-dark))', color: '#111827', fontWeight: 800, fontSize: 15,
              boxShadow: '0 14px 32px color-mix(in srgb, var(--gold) 24%, transparent)',
            }}><MessageCircle size={17} /> Enquire on WhatsApp</a>
            <a href={TEL} style={{
              display: 'inline-flex', alignItems: 'center', gap: 9, padding: '14px 26px', borderRadius: 999, textDecoration: 'none',
              background: 'color-mix(in srgb, var(--text) 6%, transparent)', border: '1px solid var(--line)', color: 'var(--text)', fontWeight: 700, fontSize: 15,
            }}><Phone size={16} /> {PHONE}</a>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, justifyContent: 'center', color: 'var(--muted)', fontSize: 14 }}>
            <a href={MAIL} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--muted)', textDecoration: 'none' }}><Mail size={15} style={{ color: 'var(--gold)' }} /> {EMAIL}</a>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><MapPin size={15} style={{ color: 'var(--gold)' }} /> {ADDRESS}</span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--line)', padding: '22px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          © {new Date().getFullYear()} Aakruti Infra Pvt. Ltd. · Ready-Mix Concrete · Karanjade, Panvel, Navi Mumbai
        </div>
      </section>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <span style={{ color: bold ? 'var(--gold)' : 'var(--text)', fontWeight: bold ? 900 : 700, fontSize: bold ? 16 : 14 }}>{v}</span>
    </div>
  );
}
