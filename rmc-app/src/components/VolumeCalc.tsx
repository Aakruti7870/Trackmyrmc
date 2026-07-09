import { useState } from 'react';

// Simple slab-volume concrete calculator. Shared between the customer Home
// "Free Concrete Calculator" sheet and the NEW-menu Concrete Calculator widget
// so both open the exact same tool.
const CREAM = '#F8F5EC';
const DGREEN = '#0B3D2E';
const TXT_MUTED = '#5c6f66';
const LINE_CREAM = '#e7e2d3';

export default function VolumeCalc() {
  const [len, setLen] = useState('');
  const [wid, setWid] = useState('');
  const [thk, setThk] = useState('');
  const l = parseFloat(len), w = parseFloat(wid), t = parseFloat(thk);
  const ok = l > 0 && w > 0 && t > 0;
  const vol = ok ? l * w * (t / 1000) : 0;
  const withWastage = vol * 1.05;
  const field = (label: string, value: string, set: (v: string) => void, unit: string) => (
    <label className="flex-1">
      <span className="text-[11px] font-semibold" style={{ color: TXT_MUTED }}>{label} ({unit})</span>
      <input
        type="number" inputMode="decimal" min="0" value={value}
        onChange={e => set(e.target.value)}
        placeholder="0"
        className="mt-1 w-full rounded-xl border px-3 py-2.5 text-[14px] font-bold outline-none"
        style={{ borderColor: LINE_CREAM, background: '#fbf8ef', color: DGREEN }}
      />
    </label>
  );
  return (
    <div className="mt-4">
      <div className="flex gap-2.5">
        {field('Length', len, setLen, 'm')}
        {field('Width', wid, setWid, 'm')}
        {field('Thickness', thk, setThk, 'mm')}
      </div>
      <div
        className="mt-3 rounded-2xl border p-3.5 text-center"
        style={{ borderColor: LINE_CREAM, background: CREAM }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: TXT_MUTED }}>
          Concrete needed
        </p>
        <p className="mt-0.5 text-[26px] font-extrabold leading-none" style={{ color: DGREEN }}>
          {ok ? withWastage.toFixed(2) : '—'} m³
        </p>
        <p className="mt-1 text-[11px]" style={{ color: TXT_MUTED }}>
          {ok ? `${vol.toFixed(2)} m³ + 5% wastage allowance` : 'Enter slab length, width and thickness'}
        </p>
      </div>
    </div>
  );
}
