import type { CSSProperties } from 'react';

// Shared card surface for every mobile role-home tile (matches DriverHome).
export const cardStyle: CSSProperties = {
  background: 'var(--glass-1)',
  border: '1px solid var(--glass-border)',
  borderRadius: 16,
  padding: 16,
};

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstNameOf(name?: string | null, fallback = 'there'): string {
  return (name || fallback).split(' ')[0];
}

export const fmt = (n: number): string => (Number.isFinite(n) ? n.toLocaleString('en-IN') : '—');

export const fmtRs = (n: number): string =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--gold)',
  in_progress: 'var(--blue)',
  completed: 'var(--green)',
  cancelled: 'var(--red)',
  dispatched: 'var(--blue)',
  delivered: 'var(--green)',
  approved: 'var(--green)',
  rejected: 'var(--red)',
};

export const statusColor = (s: string): string => STATUS_COLORS[s] || 'var(--muted)';

export const statusBg = (s: string): string =>
  `color-mix(in srgb, ${statusColor(s)} 14%, transparent)`;

export const statusLabel = (s: string): string =>
  s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
