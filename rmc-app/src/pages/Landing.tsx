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

const MAIL = 'support@goldetech.com';
const PHONE = '+91 74982 86760';
const ONBOARD_MAIL = 'support@goldetech.com';

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
  { video: 'ck-plant.mp4',    label: 'Concrete Plant',   desc: 'Modern RMC batching plant' },
  { video: 'ck-batching.mp4', label: 'Batching Process',  desc: 'Precision mix batching' },
  { video: 'ck-transit.mp4',  label: 'Transit Mixer',     desc: 'En-route to your site' },
  { video: 'ck-arrival.mp4',  label: 'Site Arrival',      desc: 'On-time delivery' },
  { video: 'ck-pouring.mp4',  label: 'Concrete Pouring',  desc: 'Pour in progress' },
  { video: 'ck-quality.mp4',  label: 'Quality Testing',   desc: 'Slump & cube tests' },
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
          <span style={{ color: 'var(--text)' }}>CONCRETE </span>
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
      background: 'radial-gradient(120% 120% at 70% 10%, #f4f7fc 0%, #e8eef7 55%, #dde6f2 100%)',
      boxShadow: '0 30px 70px -30px rgba(30,41,90,.28)',
    }}>
      {/* moving grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.5,
        backgroundImage:
          'linear-gradient(rgba(30,41,90,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,90,.08) 1px, transparent 1px)',
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
      {/* moving mixer truck along the route */}
      <div style={{
        position: 'absolute', inset: 0, width: 58, height: 38,
        offsetPath: "path('M 95 300 C 200 250, 180 140, 300 150 S 470 120, 510 70')",
        offsetRotate: 'auto',
        animation: 'ck-move 7s cubic-bezier(.65,0,.35,1) infinite',
        filter: 'drop-shadow(0 6px 10px rgba(10,19,34,.35))',
      } as React.CSSProperties}>
        <MixerTruck />
      </div>
      {/* plant marker */}
      <PinMarker x={70} y={282} color="var(--blue)" label="Plant" icon={<Factory size={14} />} />
      {/* site marker */}
      <PinMarker x={492} y={52} color="var(--green)" label="Your Site" icon={<MapPin size={14} />} />
      {/* live tracking card */}
      <div style={{
        position: 'absolute', left: 18, top: 18, padding: '12px 14px', borderRadius: 14,
        background: 'rgba(255,255,255,.82)', backdropFilter: 'blur(8px)',
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

function MixerTruck() {
  return (
    <svg viewBox="0 0 64 40" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="ck-drum-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbd36b" />
          <stop offset="0.5" stopColor="#f0b429" />
          <stop offset="1" stopColor="#d68a0a" />
        </linearGradient>
        <linearGradient id="ck-cab-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#27344a" />
          <stop offset="1" stopColor="#141d2b" />
        </linearGradient>
        <clipPath id="ck-drum-clip"><rect x="11" y="6" width="36" height="22" rx="11" /></clipPath>
      </defs>

      {/* chassis */}
      <rect x="5" y="25" width="52" height="5" rx="2.5" fill="#16202e" />
      {/* rear chute */}
      <path d="M11 19 L3 25 L6 28 L13 22 Z" fill="#1a232f" />

      {/* mixer drum, tilted */}
      <g transform="rotate(-9 27 17)">
        <rect x="11" y="6" width="36" height="22" rx="11" fill="url(#ck-drum-grad)" />
        <g clipPath="url(#ck-drum-clip)">
          <g style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'ck-drum-spin 2.6s linear infinite' } as React.CSSProperties}>
            {[-12, -4, 4, 12].map((dx) => (
              <line key={dx} x1={22 + dx} y1="2" x2={34 + dx} y2="32"
                stroke="rgba(120,78,8,.55)" strokeWidth="2.2" strokeLinecap="round" />
            ))}
          </g>
        </g>
        {/* drum sheen + rim */}
        <rect x="14" y="9" width="30" height="5" rx="2.5" fill="rgba(255,255,255,.35)" />
        <rect x="11" y="6" width="36" height="22" rx="11" fill="none" stroke="#a9760c" strokeWidth="1.3" />
      </g>

      {/* cab */}
      <path d="M48 13 h6 a3.5 3.5 0 0 1 3.5 3.5 V27 H44 V17 a4 4 0 0 1 4 -4 z" fill="url(#ck-cab-grad)" />
      <path d="M48.5 16 H55 a1.5 1.5 0 0 1 1.5 1.5 V22 H47.5 V17.5 A1.5 1.5 0 0 1 48.5 16 z" fill="#bcd6f5" />
      <rect x="44" y="24" width="14" height="3" rx="1.5" fill="#0e1726" />
      {/* headlight */}
      <circle cx="56.5" cy="25" r="1.1" fill="#ffe08a" />

      {/* wheels */}
      {[17, 26, 51].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="31" r="5" fill="#0c1320" />
          <circle cx={cx} cy="31" r="2.1" fill="#5a6b85" />
        </g>
      ))}
    </svg>
  );
}

function PinMarker({ x, y, color, label, icon }: { x: number; y: number; color: string; label: string; icon: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', left: `${(x / 600) * 100}%`, top: `${(y / 380) * 100}%`, transform: 'translate(-50%,-50%)', textAlign: 'center' }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto',
        background: 'rgba(255,255,255,.85)', color, border: `1.5px solid ${color}`,
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
  const [openOnboard, setOpenOnboard] = useState(false);

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
    background: 'linear-gradient(160deg,#f5b942,#d68a0a)', color: '#fff',
    boxShadow: '0 14px 30px -12px rgba(214,138,10,.6)', fontFamily: 'inherit',
  };
  const btnGhost: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 22px',
    borderRadius: 12, fontWeight: 600, fontSize: 15, cursor: 'pointer',
    background: 'rgba(255,255,255,.6)', color: 'var(--text)', border: '1px solid var(--line)', fontFamily: 'inherit',
  };
  const navLink: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
    fontWeight: 600, fontSize: 14.5, fontFamily: 'inherit',
  };
  const section: React.CSSProperties = { maxWidth: 1180, margin: '0 auto', padding: '0 24px' };
  const kicker: React.CSSProperties = { color: 'var(--gold)', fontWeight: 700, letterSpacing: 3, fontSize: 12.5, textTransform: 'uppercase' };
  const h2: React.CSSProperties = { fontSize: 34, fontWeight: 800, margin: '10px 0 0', letterSpacing: -0.5 };
  const panel: React.CSSProperties = {
    background: 'linear-gradient(160deg, rgba(255,255,255,.82), rgba(255,255,255,.6))',
    border: '1px solid rgba(255,255,255,.85)', borderRadius: 18,
    boxShadow: '0 18px 44px -22px rgba(30,41,90,.18)',
  };

  return (
    <div className="ck" id="top" style={{ minHeight: '100vh', background: 'var(--bg)', overflowX: 'hidden' }}>
      {/* NAV */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(255,255,255,.72)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)' }}>
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
              background: 'rgba(255,255,255,.6)', border: '1px solid var(--line)', color: 'var(--text)',
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

      <main id="main-content">

      {/* HERO */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <picture>
            <source srcSet={IMG('hero-truck.webp')} type="image/webp" />
            <img src={IMG('hero-truck.png')} alt="" fetchPriority="high"
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.32 }} />
          </picture>
          <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(238,242,249,.55) 0%, rgba(238,242,249,.82) 55%, var(--bg) 100%)' }} />
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
              <span style={{ color: 'var(--text)' }}>CONCRETE</span><br />
              <span style={{ color: 'var(--gold)' }}>KING</span>
              <span style={{ display: 'block', fontSize: 22, fontWeight: 600, letterSpacing: 0, color: 'var(--muted)', marginTop: 10 }}>
                Ready-Mix Concrete Tracking &amp; RMC Plant Discovery
              </span>
            </h1>
            <p style={{ fontSize: 18.5, color: 'var(--muted)', lineHeight: 1.55, margin: '18px 0 0', maxWidth: 520 }}>
              Track every cubic metre — from plant to pour, in real time. Find approved RMC plants
              near you, order the right grade, and watch it arrive live.
            </p>
            <div className="ck-hero-cta" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 28 }}>
              <button onClick={() => setLoc('/register')} style={btnGold}>Get Started <ArrowRight size={16} /></button>
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
                background: 'rgba(255,255,255,.55)', border: '1px solid var(--line)', marginBottom: 14 }}>
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
          <h2 style={h2}>Live Feed</h2>
          <p style={{ color: 'var(--muted)', fontSize: 15, marginTop: 8, lineHeight: 1.55 }}>
            Watch our plants in action — concrete plant, batching, transit, arrival, pouring, and quality testing.
          </p>
        </div>
        <div className="ck-no-scrollbar ck-feed-grid" style={{ ...section, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {FEED.map((f, i) => (
            <button key={f.video} onClick={() => setOpenFeed(i)} className="ck-feed ck-card-hover"
              style={{ position: 'relative', height: 220, borderRadius: 18, overflow: 'hidden', cursor: 'pointer',
                border: '1px solid var(--line)', padding: 0, background: '#e8eef7' }}>
              {/* Always-live autoplay loop */}
              <video src={VID(f.video)} autoPlay muted loop playsInline preload="auto"
                aria-label={f.label}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              {/* LIVE badge */}
              <div style={{ position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 999, background: 'rgba(15,23,42,.55)', backdropFilter: 'blur(6px)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', animation: 'ck-pulse-red 1.6s ease infinite' }} />
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.5, color: '#fff' }}>LIVE</span>
              </div>
              {/* Caption overlay */}
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'left', padding: '28px 16px 14px',
                background: 'linear-gradient(to top, rgba(15,23,42,.78) 0%, rgba(15,23,42,.4) 55%, transparent 100%)' }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: '#fff' }}>{f.label}</div>
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.82)', marginTop: 3 }}>{f.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* CONTACT / ONBOARDING */}
      <section id="contact" style={{ ...section, padding: '64px 24px 28px', scrollMarginTop: 84 }}>
        <div style={{ ...panel, padding: 36, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32, alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(255,255,255,.85), rgba(255,255,255,.65))',
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
            <button onClick={() => setOpenOnboard(true)} style={{ ...btnGold, marginTop: 22 }}>
              Onboard Your Plant <ArrowRight size={16} />
            </button>
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

      </main>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--line)', marginTop: 24 }}>
        <div style={{ ...section, padding: '28px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <Logo size={0.85} />
          <div style={{ color: 'var(--muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <a href="/privacy" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Privacy Policy</a>
            <span>© {new Date().getFullYear()} Concrete King · Powered by GOLD-e Tech</span>
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
                  background: 'rgba(255,255,255,.55)', border: '1px solid var(--line)', marginBottom: 16 }}>
                  <f.icon size={28} color={f.color} strokeWidth={2.1} />
                </div>
                <h3 style={{ fontSize: 23, fontWeight: 800, margin: 0 }}>{f.title}</h3>
                <p style={{ color: 'var(--muted)', fontSize: 15.5, lineHeight: 1.6, marginTop: 12 }}>{f.detail}</p>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* ONBOARD MODAL */}
      {openOnboard && (
        <Modal onClose={() => setOpenOnboard(false)} wide>
          <OnboardForm onClose={() => setOpenOnboard(false)} />
        </Modal>
      )}

      {/* FEED MODAL — video loads on demand only when the modal opens */}
      {openFeed !== null && (
        <Modal onClose={() => setOpenFeed(null)} wide>
          {(() => {
            const f = FEED[openFeed];
            return (
              <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', aspectRatio: '16/9', background: '#e8eef7' }}>
                <video src={VID(f.video)} autoPlay muted loop playsInline preload="none"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

function OnboardForm({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ plant: '', name: '', phone: '', email: '', city: '', gst: '', message: '' });
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, margin: '0 0 7px' };
  const opt: React.CSSProperties = { color: 'var(--muted)', fontWeight: 500 };
  const req: React.CSSProperties = { color: 'var(--gold)' };
  const field: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,.7)', border: '1px solid var(--line)',
    color: 'var(--text)', borderRadius: 11, padding: '12px 13px', fontSize: 14,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.plant.trim() || !form.name.trim() || !form.phone.trim() || !form.city.trim()) {
      setError('Please fill in the required fields marked with *.');
      return;
    }
    setError('');
    const body = [
      `Plant name: ${form.plant.trim()}`,
      `Owner / contact: ${form.name.trim()}`,
      `Mobile: ${form.phone.trim()}`,
      form.email.trim() && `Email: ${form.email.trim()}`,
      `City / location: ${form.city.trim()}`,
      form.gst.trim() && `GST number: ${form.gst.trim()}`,
      form.message.trim() && `\nMessage:\n${form.message.trim()}`,
    ].filter(Boolean).join('\n');
    const subject = `New Plant Onboarding Inquiry — ${form.plant.trim()}`;
    window.location.href =
      `mailto:${ONBOARD_MAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  if (sent) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 4px 4px' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', display: 'grid', placeItems: 'center',
          margin: '0 auto 16px', background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.35)' }}>
          <ShieldCheck size={30} color="var(--green)" />
        </div>
        <h3 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Inquiry ready to send</h3>
        <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.6, marginTop: 12 }}>
          Your email app should have opened with your plant details pre-filled. Just hit send and our team
          will reach out to help you get listed. If nothing opened, email us directly at{' '}
          <a href={`mailto:${ONBOARD_MAIL}`} style={{ color: 'var(--gold)' }}>{ONBOARD_MAIL}</a>.
        </p>
        <button onClick={onClose} style={{
          marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 22px',
          borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', border: 'none',
          background: 'linear-gradient(160deg,#f5b942,#d68a0a)', color: '#fff', fontFamily: 'inherit',
        }}>Done</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <span style={{ color: 'var(--gold)', fontWeight: 700, letterSpacing: 3, fontSize: 12.5, textTransform: 'uppercase' }}>
        Onboarding &amp; Support
      </span>
      <h3 style={{ fontSize: 24, fontWeight: 800, margin: '8px 0 4px' }}>Onboard your plant</h3>
      <p style={{ color: 'var(--muted)', fontSize: 14.5, lineHeight: 1.5, margin: '0 0 20px' }}>
        Tell us about your RMC plant and our team will help you verify and go live.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={label}>Plant name <span style={req}>*</span></label>
          <input style={field} value={form.plant} onChange={set('plant')} placeholder="e.g. Shree RMC Plant" />
        </div>
        <div>
          <label style={label}>Owner / contact name <span style={req}>*</span></label>
          <input style={field} value={form.name} onChange={set('name')} placeholder="e.g. Krushna Bade" />
        </div>
        <div>
          <label style={label}>Mobile number <span style={req}>*</span></label>
          <input style={field} value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" inputMode="tel" />
        </div>
        <div>
          <label style={label}>City / location <span style={req}>*</span></label>
          <input style={field} value={form.city} onChange={set('city')} placeholder="e.g. Pune" />
        </div>
        <div>
          <label style={label}>GST number <span style={opt}>· optional</span></label>
          <input style={field} value={form.gst} onChange={set('gst')} placeholder="22AAAAA0000A1Z5" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={label}>Email <span style={opt}>· optional</span></label>
          <input style={field} value={form.email} onChange={set('email')} placeholder="you@company.com" inputMode="email" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={label}>Message <span style={opt}>· optional</span></label>
          <textarea style={{ ...field, minHeight: 84, resize: 'vertical' }} value={form.message} onChange={set('message')}
            placeholder="Plant capacity, location details, anything else…" />
        </div>
      </div>

      {error && (
        <p style={{ color: 'var(--red)', fontSize: 13.5, margin: '14px 0 0' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
        <button type="submit" style={{
          flex: 1, minWidth: 160, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '14px 22px', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', border: 'none',
          background: 'linear-gradient(160deg,#f5b942,#d68a0a)', color: '#fff', fontFamily: 'inherit',
        }}>Submit inquiry <ArrowRight size={16} /></button>
        <button type="button" onClick={onClose} style={{
          padding: '14px 22px', borderRadius: 12, fontWeight: 600, fontSize: 15, cursor: 'pointer',
          background: 'rgba(255,255,255,.6)', color: 'var(--text)', border: '1px solid var(--line)', fontFamily: 'inherit',
        }}>Cancel</button>
      </div>
    </form>
  );
}

function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center',
      background: 'rgba(15,23,42,.35)', backdropFilter: 'blur(6px)', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} className="ck ck-fade ck-no-scrollbar" style={{
        position: 'relative', width: '100%', maxWidth: wide ? 640 : 460,
        maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
        background: 'linear-gradient(160deg, rgba(255,255,255,.96), rgba(255,255,255,.86))', border: '1px solid rgba(255,255,255,.85)',
        borderRadius: 20, padding: 28, boxShadow: '0 40px 90px -30px rgba(30,41,90,.4)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 34, height: 34, borderRadius: 10,
          display: 'grid', placeItems: 'center', cursor: 'pointer', background: 'rgba(30,41,90,.05)',
          border: '1px solid var(--line)', color: 'var(--muted)' }}>
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}
