// Non-component shared tokens/helpers for the Command Center. Kept in a
// separate module so ui.tsx can export only components (react-refresh rule).

export const AUTHORITY_ACCENT = '#e879f9';

// Section accent ramp — each command-center tab owns a signature colour so the
// dashboard reads as a colourful, sectioned control room rather than one flat hue.
export const ACCENTS = {
  overview: 'var(--gold)',
  map: 'var(--blue)',
  plants: '#a78bfa',
  fleet: 'var(--orange)',
  copilot: '#e879f9',
  analytics: 'var(--green)',
  security: 'var(--red)',
  notifications: '#f59e0b',
  actions: '#22d3ee',
} as const;

export function mix(color: string, pct: number, base = 'transparent'): string {
  return `color-mix(in srgb, ${color} ${pct}%, ${base})`;
}
