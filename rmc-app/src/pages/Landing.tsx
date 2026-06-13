import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Crown, Navigation, ShoppingCart, Eye, Truck, ShieldCheck,
  FileText, Bell, Headphones, Phone, Mail, ArrowRight, X, Menu,
  MapPin, Factory, Radio, ChevronRight,
} from 'lucide-react';
import './Landing.css';

const IMG = (n: string) => `/ck/images/${n}`;
const VID = (n: string) => `/ck/videos/${n}`;
const GRADES = ['M20', 'M25', 'M30', 'M35', 'M40', 'M50'];

const MAIL = 'support@goldetechapp.com';
const PHONE = '+91 74982 86760';

const FEATURES = [
  { icon: Navigation, color: 'var(--gold)', title: 'Live GPS Tracking',
    blurb: 'Real-time location of every order.',
    detail: 'Watch your concrete move on a live map — from batching to your site — with continuous GPS updates and a precise arrival ETA so your crew is ready the moment it lands.' },
  { icon: ShoppingCart, color: 'var(--blue)', title: 'Smart Ordering',
    blurb: 'Order the right mix in seconds.',
    detail: 'Pick your grade and volume with a built-in calculator that estimates exactly how many cubic metres you need — including wastage — then place the order in a couple of taps.' },
  { icon: Eye, color: 'var(--green)', title: 'Transparent Process',
    blurb: 'Nothing hidden, every step logged.',
    detail: 'Every stage — batch, dispatch, transit, arrival and pour — is recorded and visible to you in real time. No guesswork, no surprises, full accountability.' },
  { icon: Truck, color: 'var(--gold)', title: 'Fleet Management',
    blurb: 'Live status of every mixer.',
    detail: 'See the live status of every transit mixer and driver across the network — available, loading, in transit or delivering — for smarter dispatch and on-time pours.' },
  { icon: ShieldCheck, color: 'var(--blue)', title: 'Quality Assurance',
    blurb: 'Tested, certified, guaranteed.',
    detail: 'Approved mix designs with logged slump and cube-test results for every batch, so the strength and grade you ordered is exactly what arrives at your site.' },
  { icon: FileText, color: 'var(--green)', title: 'Digital Documents',
    blurb: 'Challans & receipts, instantly.',
    detail: 'Generate digital challans, delivery receipts and invoices automatically. Everything is stored and searchable — no lost paperwork, no manual reconciliation.' },
  { icon: Bell, color: 'var(--gold)', title: 'Instant Notifications',
    blurb: 'Alerts at every milestone.',
    detail: "Get real-time alerts the moment your order is dispatched, when the truck is near, and when the pour is complete — so you always know what's happening." },
  { icon: Headphones, color: 'var(--blue)', title: '24/7 Support',
    blurb: 'Real help, any time.',
    detail: 'A dedicated support team available around the clock by phone or email to help with orders, scheduling and anything else — whenever you need it.' },
];

const FEED = [
  { video: 'ck-plant.mp4' },
  { video: 'ck-batching.mp4' },
  { video: 'ck-transit.mp4' },
  { video: 'ck-arrival.mp4' },
  { video: 'ck-pouring.mp4' },
  { video: 'ck-quality.mp4' },
];

function Logo({ size = 1 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 * size }}>
      <div style={{
        width: 46 * size, height: 46 * size, borderRadius: 13 * size,
        display: 'grid', placeItems: 'center',
        background: 'linear-gradient(160deg, #1a2c46, #0c1828)',
        border: '1px solid rgba(247,201,72,.4)',
        boxShadow: '0 0 24px -8px rgba(247,201,72,.6), inset 0 1px 0 rgba(255,255,255,.06)',
      }}>
        <Crown size={26 * size} color="var(--gold)" strokeWidth={2.2} fill="rgba(247,201,72,.18)" />
      </div>
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontWeight: 800, letterSpacing: 0.5, fontSize: 19 * size }}>
          <span style={{ color: '#fff' }}>CONCRETE </span>
          <span style={{ color: 'var(--gold)' }}>KING</span>
        </div>
        <div style={{ fontSize: 9.5 * size, color: 'var(--muted)', letterSpacing: 2, marginTop: 4 * size, textTransform: 'uppercase' }}>
          Powered by GOLD-e Tech
        </div>
      </div>
    </div>
  );
}

function LiveTrackingMap() {
  return (
    <div style={{
      position: 'relative', borderRadius: 22, overflow: 'hidden',
      border: '1px solid var(--line)', height: '100%', minHeight: 360,
      background: 'radial-gradient(120% 120% at 70% 10%, #13243c 0%, #0a1525 55%, #070f1c 100%)',
      boxShadow: '0 30px 70px -30px rgba(0,0,0,.8)',
    }}>
      {/* moving grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.5,
        backgroundImage:
          'linear-gradient(rgba(120,160,220,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(120,160,220,.10) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        animation: 'ck-grid 6s linear infinite',
        maskImage: 'radial-gradient(120% 100% at 50% 30%, #000 40%, transparent 95%)',
      }} />
      {/* route */}
      <svg viewBox="0 0 600 380" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="ck-route" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f7c948" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <path id="ck-path" d="M 95 300 C 200 250, 180 140, 300 150 S 470 120, 510 70"
          fill="none" stroke="rgba(247,201,72,.18)" strokeWidth="10" strokeLinecap="round" />
        <path d="M 95 300 C 200 250, 180 140, 300 150 S 470 120, 510 70"
          fill="none" stroke="url(#ck-route)" strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray="14 16" style={{ animation: 'ck-dash 18s linear infinite' }} />
      </svg>
      {/* moving truck along the route */}
      <div style={{
        position: 'absolute', inset: 0, width: 36, height: 36,
        offsetPath: "path('M 95 300 C 200 250, 180 140, 300 150 S 470 120, 510 70')",
        offsetRotate: 'auto',
        animation: 'ck-move 7s cubic-bezier(.65,0,.35,1) infinite',
      } as React.CSSProperties}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center',
          background: 'linear-gradient(160deg,#f7c948,#e0a91f)', color: '#0a1322',
          boxShadow: '0 6px 18px -4px rgba(247,201,72,.8)',
        }}>
          <Truck size={18} strokeWidth={2.4} />
        </div>
      </div>
      {/* plant marker */}
      <PinMarker x={70} y={282} color="var(--blue)" label="Plant" icon={<Factory size={14} />} />
      {/* site marker */}
      <PinMarker x={492} y={52} color="var(--green)" label="Your Site" icon={<MapPin size={14} />} />
      {/* live tracking card */}
      <div style={{
        position: 'absolute', left: 18, top: 18, padding: '12px 14px', borderRadius: 14,
        background: 'rgba(8,17,31,.78)', backdropFilter: 'blur(8px)',
        border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--green)',
          animation: 'ck-pulse 1.8s ease infinite' }} />
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1 }}>LIVE TRACKING</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Mixer #MH-46 · ETA 18 min</div>
        </div>
      </div>
    </div>
  );
}

function PinMarker({ x, y, color, label, icon }: { x: number; y: number; color: string; label: string; icon: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', left: `${(x / 600) * 100}%`, top: `${(y / 380) * 100}%`, transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto',
        background: 'rgba(8,17,31,.85)', color, border: `1.5px solid ${color}`,
        animation: 'ck-pulse-red 2.4s ease infinite',
      }}>{icon}</div>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 5, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

export default function Landing() {
  const [, setLoc] = useLocation();
  const [openFeature, setOpenFeature] = useState<number | null>(null);
  const [openFeed, setOpenFeed] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 84;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const btnGold: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 22px',
    borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', border: 'none',
    background: 'linear-gradient(160deg,#f7c948,#e0a91f)', color: '#0a1322',
    boxShadow: '0 14px 30px -12px rgba(247,201,72,.7)', fontFamily: 'inherit',
  };
  const btnGhost: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 22px',
    borderRadius: 12, fontWeight: 600, fontSize: 15, cursor: 'pointer',
    background: 'rgba(255,255,255,.04)', color: 'var(--text)', border: '1px solid var(--line)', fontFamily: 'inherit',
  };
  const navLink: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
    fontWeight: 600, fontSize: 14.5, fontFamily: 'inherit',
  };
  const section: React.CSSProperties = { maxWidth: 1180, margin: '0 auto', padding: '0 24px' };
  const kicker: React.CSSProperties = { color: 'var(--gold)', fontWeight: 700, letterSpacing: 3, fontSize: 12.5, textTransform: 'uppercase' };
  const h2: React.CSSProperties = { fontSize: 34, fontWeight: 800, margin: '10px 0 0', letterSpacing: -0.5 };
  const panel: React.CSSProperties = {
    background: 'linear-gradient(160deg, rgba(16,31,51,.92), rgba(12,24,40,.88))',
    border: '1px solid var(--line)', borderRadius: 18,
  };

  return (
    <div className="ck" id="top" style={{ minHeight: '100vh', background: 'var(--bg)', overflowX: 'hidden' }}>
      {/* NAV */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(8,17,31,.72)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ ...section, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 74 }}>
          <button onClick={() => { setMenuOpen(false); scrollTo('top'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Logo />
          </button>

          {/* Desktop nav */}
          <nav className="ck-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <button onClick={() => scrollTo('why')} style={navLink}>Why Us</button>
            <button onClick={() => scrollTo('feed')} style={navLink}>Live Feed</button>
            <button onClick={() => scrollTo('contact')} style={navLink}>Contact</button>
            <button onClick={() => setLoc('/login')} style={{ ...btnGhost, padding: '10px 18px', fontSize: 14 }}>Login</button>
            <button onClick={() => setLoc('/register')} style={{ ...btnGold, padding: '11px 20px', fontSize: 14 }}>Get Started <ArrowRight size={16} /></button>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="ck-nav-toggle"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            style={{
              width: 44, height: 44, borderRadius: 12, placeItems: 'center', cursor: 'pointer',
              background: 'rgba(255,255,255,.05)', border: '1px solid var(--line)', color: 'var(--text)',
            }}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <nav className="ck-mobile-menu" style={{ ...section, paddingTop: 6, paddingBottom: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => { setMenuOpen(false); scrollTo('why'); }} style={{ ...navLink, textAlign: 'left', padding: '13px 4px', fontSize: 16, borderBottom: '1px solid var(--line)' }}>Why Us</button>
            <button onClick={() => { setMenuOpen(false); scrollTo('feed'); }} style={{ ...navLink, textAlign: 'left', padding: '13px 4px', fontSize: 16, borderBottom: '1px solid var(--line)' }}>Live Feed</button>
            <button onClick={() => { setMenuOpen(false); scrollTo('contact'); }} style={{ ...navLink, textAlign: 'left', padding: '13px 4px', fontSize: 16, borderBottom: '1px solid var(--line)' }}>Contact</button>
            <button onClick={() => { setMenuOpen(false); setLoc('/login'); }} style={{ ...btnGhost, justifyContent: 'center', marginTop: 10 }}>Login</button>
            <button onClick={() => { setMenuOpen(false); setLoc('/register'); }} style={{ ...btnGold, justifyContent: 'center' }}>Get Started <ArrowRight size={16} /></button>
          </nav>
        )}
      </header>

      {/* HERO */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <img src={IMG('hero-truck.png')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.32 }} />
          <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(8,17,31,.65) 0%, rgba(8,17,31,.82) 55%, var(--bg) 100%)' }} />
          <div style={{ position: 'absolute', inset: 0,
            background: 'radial-gradient(80% 60% at 15% 30%, rgba(247,201,72,.12), transparent 60%)' }} />
        </div>
        <div style={{ ...section, position: 'relative', padding: '64px 24px 72px',
          display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 48, alignItems: 'center' }}
          className="ck-hero-grid">
          <div className="ck-fade">
            <span style={{ ...kicker, display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '7px 13px', borderRadius: 999, background: 'rgba(247,201,72,.1)', border: '1px solid rgba(247,201,72,.3)' }}>
              <Radio size={13} /> Real-time Ready-Mix Concrete
            </span>
            <h1 className="ck-h1" style={{ fontSize: 58, lineHeight: 1.03, fontWeight: 800, letterSpacing: -1.5, margin: '20px 0 0' }}>
              <span style={{ color: '#fff' }}>CONCRETE</span><br />
              <span style={{ color: 'var(--gold)' }}>KING</span>
            </h1>
            <p style={{ fontSize: 18.5, color: 'var(--muted)', lineHeight: 1.55, margin: '18px 0 0', maxWidth: 520 }}>
              Track every cubic metre — from plant to pour, in real time. Find approved RMC plants
              near you, order the right grade, and watch it arrive live.
            </p>
            <div className="ck-hero-cta" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 28 }}>
              <button onClick={() => setLoc('/nearby-plants')} style={btnGold}>Find Nearby Plants <ArrowRight size={16} /></button>
              <button onClick={() => scrollTo('why')} style={btnGhost}>See How It Works</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 26 }}>
              {GRADES.map((g) => (
                <span key={g} style={{ padding: '6px 13px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                  color: 'var(--blue)', background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.25)' }}>{g}</span>
              ))}
            </div>
          </div>
          <div className="ck-fade ck-hero-media" style={{ animationDelay: '.15s', height: 420 }}>
            <LiveTrackingMap />
          </div>
        </div>
      </section>

      {/* WHY */}
      <section id="why" style={{ ...section, padding: '20px 24px 12px', scrollMarginTop: 84 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <span style={kicker}>Why Concrete King?</span>
          <h2 style={h2}>Built for every pour, end to end</h2>
          <p style={{ color: 'var(--muted)', fontSize: 16, marginTop: 12 }}>
            Tap any card to learn more about what you get.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }} className="ck-feat-grid">
          {FEATURES.map((f, i) => (
            <button key={f.title} onClick={() => setOpenFeature(i)} className="ck-card-hover"
              style={{ ...panel, textAlign: 'left', cursor: 'pointer', padding: 20, color: 'var(--text)', fontFamily: 'inherit' }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, display: 'grid', placeItems: 'center',
                background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', marginBottom: 14 }}>
                <f.icon size={22} color={f.color} strokeWidth={2.1} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 16.5 }}>{f.title}</div>
              <div style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 6, lineHeight: 1.45 }}>{f.blurb}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: f.color,
                fontSize: 13, fontWeight: 600, marginTop: 12 }}>
                Learn more <ChevronRight size={14} />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* LIVE FEED */}
      <section id="feed" style={{ padding: '56px 0 12px', scrollMarginTop: 84 }}>
        <div style={{ ...section, marginBottom: 24 }}>
          <span style={{ ...kicker, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'ck-pulse-red 1.6s ease infinite' }} />
            Live Feed
          </span>
        </div>
        <div className="ck-no-scrollbar ck-feed-grid" style={{ ...section, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {FEED.map((f, i) => (
            <button key={f.video} onClick={() => setOpenFeed(i)} className="ck-feed ck-card-hover"
              style={{ position: 'relative', height: 220, borderRadius: 18, overflow: 'hidden', cursor: 'pointer',
                border: '1px solid var(--line)', padding: 0, background: '#0a1525' }}>
              <video className="ck-feed-img" src={VID(f.video)} autoPlay muted loop playsInline
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      </section>

      {/* CONTACT / ONBOARDING */}
      <section id="contact" style={{ ...section, padding: '64px 24px 28px', scrollMarginTop: 84 }}>
        <div style={{ ...panel, padding: 36, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32, alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(20,36,60,.95), rgba(10,21,37,.92))',
          overflow: 'hidden', position: 'relative' }} className="ck-contact-grid">
          <div style={{ position: 'absolute', right: -60, top: -60, width: 240, height: 240, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(247,201,72,.18), transparent 70%)' }} />
          <div style={{ position: 'relative' }}>
            <span style={kicker}>Onboarding & Support</span>
            <h2 style={{ ...h2, fontSize: 30 }}>Run a plant? Get listed on Concrete King.</h2>
            <p style={{ color: 'var(--muted)', fontSize: 15.5, marginTop: 12, lineHeight: 1.55, maxWidth: 460 }}>
              Join the network and reach customers searching for approved RMC plants nearby.
              Our team will help you onboard, verify and go live.
            </p>
            <a href={`mailto:${MAIL}?subject=Onboard%20my%20RMC%20plant`} style={{ ...btnGold, marginTop: 22, textDecoration: 'none' }}>
              Onboard Your Plant <ArrowRight size={16} />
            </a>
          </div>
          <div style={{ position: 'relative', display: 'grid', gap: 14 }}>
            <a href={`mailto:${MAIL}`} style={{ ...panel, padding: 18, display: 'flex', alignItems: 'center', gap: 14,
              textDecoration: 'none', color: 'var(--text)' }} className="ck-card-hover">
              <span style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center',
                background: 'rgba(247,201,72,.1)', border: '1px solid rgba(247,201,72,.25)' }}>
                <Mail size={20} color="var(--gold)" />
              </span>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: 1 }}>EMAIL</div>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{MAIL}</div>
              </div>
            </a>
            <a href={`tel:${PHONE.replace(/\s/g, '')}`} style={{ ...panel, padding: 18, display: 'flex', alignItems: 'center', gap: 14,
              textDecoration: 'none', color: 'var(--text)' }} className="ck-card-hover">
              <span style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center',
                background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)' }}>
                <Phone size={20} color="var(--green)" />
              </span>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: 1 }}>PHONE</div>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{PHONE}</div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--line)', marginTop: 24 }}>
        <div style={{ ...section, padding: '28px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <Logo size={0.85} />
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>
            © {new Date().getFullYear()} Concrete King · Powered by GOLD-e Tech
          </div>
        </div>
      </footer>

      {/* FEATURE MODAL */}
      {openFeature !== null && (
        <Modal onClose={() => setOpenFeature(null)}>
          {(() => {
            const f = FEATURES[openFeature];
            return (
              <div>
                <div style={{ width: 56, height: 56, borderRadius: 15, display: 'grid', placeItems: 'center',
                  background: 'rgba(255,255,255,.04)', border: '1px solid var(--line)', marginBottom: 16 }}>
                  <f.icon size={28} color={f.color} strokeWidth={2.1} />
                </div>
                <h3 style={{ fontSize: 23, fontWeight: 800, margin: 0 }}>{f.title}</h3>
                <p style={{ color: 'var(--muted)', fontSize: 15.5, lineHeight: 1.6, marginTop: 12 }}>{f.detail}</p>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* FEED MODAL */}
      {openFeed !== null && (
        <Modal onClose={() => setOpenFeed(null)} wide>
          {(() => {
            const f = FEED[openFeed];
            return (
              <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', aspectRatio: '16/9', background: '#0a1525' }}>
                <video src={VID(f.video)} autoPlay muted loop playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center',
      background: 'rgba(4,9,18,.72)', backdropFilter: 'blur(6px)', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} className="ck ck-fade" style={{
        position: 'relative', width: '100%', maxWidth: wide ? 640 : 460,
        background: 'linear-gradient(160deg, #122036, #0b1727)', border: '1px solid var(--line)',
        borderRadius: 20, padding: 28, boxShadow: '0 40px 90px -30px rgba(0,0,0,.9)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 34, height: 34, borderRadius: 10,
          display: 'grid', placeItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,.05)',
          border: '1px solid var(--line)', color: 'var(--muted)' }}>
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}
