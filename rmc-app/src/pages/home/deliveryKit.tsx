import type { ReactNode, CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Delivery-style design kit — the approved "Delivery Style" mockup language.
// Shared by all 8 mobile role-home screens and the mobile app chrome (header +
// bottom tab bar). Now THEME-DRIVEN: the accent/ink/paper/tint constants read
// live CSS variables, so it re-skins with the active theme (Simple = teal,
// Daylight = terracotta). Semantic status colors stay stable across themes.
// ---------------------------------------------------------------------------

export const TEAL = 'var(--gold)';
export const TEAL_HI = 'var(--gold-hi)';
export const TEAL_DEEP = 'var(--gold-dark)';
export const INK = 'var(--text)';
export const MUTED = 'var(--muted)';
export const BG = 'var(--bg)';
export const LINE = 'var(--line)';
export const GREEN = '#15803d';
export const BLUE = '#0284c7';
export const RED = '#ef4444';
export const TEAL_SOFT = 'var(--gold-soft)';
export const TEAL_TINT = 'var(--gold-tint)';
export const PROMPT_BG = 'var(--prompt-bg)';
export const PROMPT_BORDER = 'var(--prompt-border)';

// Full-bleed beige page wrapper. Sits inside Layout <main> (padding stripped on
// the /home route) so the delivery surface runs edge-to-edge under the fixed
// chrome. pb clears the bottom tab bar.
export function Screen({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: BG, minHeight: '100%' }}>
      <div
        className="mx-auto w-full max-w-[420px] px-4 pt-4 pb-28"
        style={{ color: INK }}
      >
        {children}
      </div>
    </div>
  );
}

export function Card({
  children,
  onClick,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  return (
    <div
      onClick={onClick}
      className="rounded-2xl border bg-white"
      style={{ borderColor: LINE, cursor: onClick ? 'pointer' : undefined, ...style }}
    >
      {children}
    </div>
  );
}

export function SectionHead({
  title,
  actionLabel,
  onAction,
  right,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="mt-6 mb-3 flex items-center justify-between">
      <h2 className="text-[16px] font-bold" style={{ color: INK }}>
        {title}
      </h2>
      {right}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-0.5 text-[12.5px] font-semibold"
          style={{ color: TEAL }}
        >
          {actionLabel} <ChevronRightGlyph />
        </button>
      )}
    </div>
  );
}

function ChevronRightGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function StatusPill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

export function StatCard({
  value,
  label,
  color,
  icon,
}: {
  value: string | number;
  label: string;
  color: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-2xl border bg-white p-3" style={{ borderColor: LINE }}>
      <div className="flex items-center gap-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-[20px] font-extrabold leading-none" style={{ color: INK }}>
          {value}
        </span>
      </div>
      <span className="text-[11px] font-medium" style={{ color: MUTED }}>
        {label}
      </span>
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <div className="flex gap-2.5">{children}</div>;
}

export function QuickAction({
  icon,
  label,
  tint = TEAL,
  bg = '#fff',
  badge,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  tint?: string;
  bg?: string;
  badge?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <div
        className="relative flex h-14 w-14 items-center justify-center rounded-2xl border"
        style={{ borderColor: LINE, background: bg }}
      >
        <span style={{ color: tint }}>{icon}</span>
        {badge}
      </div>
      <span className="text-[11px] font-medium leading-tight text-center" style={{ color: INK }}>
        {label}
      </span>
    </button>
  );
}

export function QuickGrid({ cols = 4, children }: { cols?: number; children: ReactNode }) {
  return (
    <div className="mt-3 grid gap-y-4 gap-x-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {children}
    </div>
  );
}

export function InfoPrompt({
  icon,
  title,
  sub,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  actionLabel: string;
  onAction?: () => void;
}) {
  return (
    <div
      className="mt-4 flex items-center gap-3 rounded-xl border px-3.5 py-3"
      style={{ background: PROMPT_BG, borderColor: PROMPT_BORDER }}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--prompt-icon-bg)' }}>
        <span style={{ color: TEAL }}>{icon}</span>
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-semibold leading-tight" style={{ color: INK }}>
          {title}
        </p>
        <p className="text-[11.5px]" style={{ color: MUTED }}>
          {sub}
        </p>
      </div>
      <button onClick={onAction} className="flex items-center gap-0.5 text-[12px] font-bold" style={{ color: TEAL }}>
        {actionLabel} <ChevronRightGlyph />
      </button>
    </div>
  );
}

export function GradientBanner({
  icon,
  eyebrow,
  title,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className="mt-3 flex items-center gap-3 rounded-2xl p-3.5 text-white"
      style={{ background: `linear-gradient(120deg, ${TEAL_DEEP}, ${TEAL_HI})` }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-white/80">{eyebrow}</p>
        <p className="text-[15px] font-bold leading-tight">{title}</p>
      </div>
      {actionLabel && (
        <button onClick={onAction} className="shrink-0 rounded-xl bg-white px-3 py-2 text-[12px] font-bold" style={{ color: TEAL_DEEP }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// Horizontal progress stepper (order / trip lifecycle). `steps` carries a state
// per node; the filled connector is derived from the last completed node.
export type StepState = 'done' | 'active' | 'todo';
export function Stepper({ steps }: { steps: { label: string; icon: ReactNode; state: StepState }[] }) {
  const n = steps.length;
  const lastActiveIdx = steps.reduce((acc, s, i) => (s.state === 'done' || s.state === 'active' ? i : acc), 0);
  const anyReached = steps.some(s => s.state === 'done' || s.state === 'active');
  const edge = 100 / (n * 2); // half a cell — centres of first/last dots
  const span = 100 - edge * 2;
  const fillPct = anyReached ? edge + (span * lastActiveIdx) / (n - 1) : 0;
  return (
    <div className="relative mt-4">
      <div className="absolute top-4 h-[3px]" style={{ left: `${edge}%`, right: `${edge}%`, background: '#eceae6' }} />
      <div className="absolute top-4 h-[3px]" style={{ left: `${edge}%`, width: `${Math.max(0, fillPct - edge)}%`, background: TEAL }} />
      <div className="relative flex justify-between">
        {steps.map((s, i) => (
          <div key={i} className="flex flex-1 flex-col items-center">
            <div
              className="z-10 flex h-8 w-8 items-center justify-center rounded-full"
              style={{
                background: s.state === 'done' ? TEAL : s.state === 'active' ? TEAL_SOFT : '#f0efec',
                border: s.state === 'active' ? `2px solid ${TEAL}` : 'none',
              }}
            >
              {s.state === 'done' ? (
                <CheckGlyph />
              ) : (
                <span style={{ color: s.state === 'active' ? TEAL : '#cbc9c4' }}>{s.icon}</span>
              )}
            </div>
            <span
              className="mt-1 text-center text-[9.5px] font-medium leading-tight"
              style={{ color: s.state === 'active' ? TEAL : s.state === 'done' ? INK : MUTED }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ListRow({
  icon,
  title,
  mono,
  badge,
  sub,
  onClick,
  right,
}: {
  icon: ReactNode;
  title: string;
  mono?: boolean;
  badge?: ReactNode;
  sub: string;
  onClick?: () => void;
  right?: ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border bg-white p-3"
      style={{ borderColor: LINE, cursor: onClick ? 'pointer' : undefined }}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: TEAL_TINT }}>
        <span style={{ color: TEAL }}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`${mono ? 'font-mono ' : ''}text-[13px] font-bold`} style={{ color: INK }}>
            {title}
          </span>
          {badge}
        </div>
        <p className="mt-0.5 truncate text-[11.5px]" style={{ color: MUTED }}>
          {sub}
        </p>
      </div>
      {right}
    </div>
  );
}

export function EmptyNote({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div
      className="mt-3 flex flex-col items-center gap-2 rounded-2xl border bg-white px-4 py-8 text-center"
      style={{ borderColor: LINE }}
    >
      <span style={{ color: '#cbc9c4' }}>{icon}</span>
      <p className="text-[12.5px]" style={{ color: MUTED }}>
        {text}
      </p>
    </div>
  );
}

// A small teal chip used in headers (e.g. "Complete KYC", role/status chips).
export function Chip({ icon, label, color = TEAL_DEEP, bg = TEAL_SOFT }: { icon?: ReactNode; label: string; color?: string; bg?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold"
      style={{ background: bg, color }}
    >
      {icon}
      {label}
    </span>
  );
}
