import { describe, it, expect } from 'vitest';
import { resolveAutomaticTheme } from './autoTheme';

describe('resolveAutomaticTheme — hour-based fallback (no cached location)', () => {
  it('resolves Concrete Gold during daytime hours', () => {
    expect(resolveAutomaticTheme(new Date('2026-06-15T10:00:00'), null)).toBe('concrete-gold');
  });

  it('resolves Infra Green at night', () => {
    expect(resolveAutomaticTheme(new Date('2026-06-15T22:00:00'), null)).toBe('infra-green');
  });

  it('switches at the 06:00 day-start boundary', () => {
    expect(resolveAutomaticTheme(new Date('2026-06-15T05:59:00'), null)).toBe('infra-green');
    expect(resolveAutomaticTheme(new Date('2026-06-15T06:00:00'), null)).toBe('concrete-gold');
  });

  it('switches at the 18:00 night-start boundary', () => {
    expect(resolveAutomaticTheme(new Date('2026-06-15T17:59:00'), null)).toBe('concrete-gold');
    expect(resolveAutomaticTheme(new Date('2026-06-15T18:00:00'), null)).toBe('infra-green');
  });
});

describe('resolveAutomaticTheme — with cached coordinates', () => {
  it('resolves Concrete Gold well after sunrise in Pune (mid-morning, IST)', () => {
    // 10:00 IST in mid-June is well past sunrise (~05:55 IST) and before sunset.
    const noon = new Date('2026-06-15T04:30:00.000Z'); // 10:00 IST
    expect(resolveAutomaticTheme(noon, { latitude: 18.52, longitude: 73.85 })).toBe('concrete-gold');
  });

  it('resolves Infra Green well after sunset in Pune (late night, IST)', () => {
    const midnight = new Date('2026-06-15T18:30:00.000Z'); // 00:00 IST
    expect(resolveAutomaticTheme(midnight, { latitude: 18.52, longitude: 73.85 })).toBe('infra-green');
  });
});
