import type { MaharashtraRmcMarketSeed } from '../db/maharashtraRmcMarkets.js';

export const ACTIVE_OPERATIONAL_STATUSES = ['ACCEPTING_ORDERS', 'BUSY', 'LIMITED_CAPACITY'] as const;

export interface ConfidenceReason {
  rule: string;
  points: number;
}

export interface ConfidenceResult {
  score: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  discoveryStatus: 'NEEDS_REVIEW' | 'REJECTED';
  reasons: ConfidenceReason[];
}

const BUSINESS_SUFFIXES = /\b(?:private limited|pvt\.?\s*ltd\.?|limited|ltd\.?|llp)\b/gi;

export function normalizeRmcName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ready\s*-?\s*mix(?:ed)?\s+concrete/g, ' rmc ')
    .replace(/\br\.?m\.?c\.?\b/g, ' rmc ')
    .replace(BUSINESS_SUFFIXES, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeGstin(value?: string | null): string | null {
  const v = value?.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return v || null;
}

export function normalizeIndianMobile(value?: string | null): string | null {
  const digits = value?.replace(/\D/g, '') ?? '';
  if (!digits) return null;
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  return last10.length === 10 ? last10 : null;
}

export function generateRmcSearchQueries(market: Pick<MaharashtraRmcMarketSeed, 'locality' | 'marketName' | 'industrial'>): string[] {
  const locality = market.locality.trim();
  const base = [
    `RMC plant in ${locality}, Maharashtra`,
    `ready mix concrete plant in ${locality}, Maharashtra`,
    `ready mixed concrete supplier in ${locality}, Maharashtra`,
    `concrete batching plant in ${locality}, Maharashtra`,
    `commercial RMC plant in ${locality}, Maharashtra`,
    `RMC supplier in ${locality}, Maharashtra`,
  ];
  if (market.industrial || /\bmidc\b/i.test(locality) || /\bmidc\b/i.test(market.marketName)) {
    base.push(`RMC plant near ${locality}`, `concrete plant near ${locality}`);
  }
  return [...new Set(base)];
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some(n => haystack.includes(n));
}

export function scoreRmcCandidate(input: {
  name: string;
  address?: string | null;
  types?: string[] | null;
  minimumScore?: number;
}): ConfidenceResult {
  const name = input.name.toLowerCase();
  const address = (input.address ?? '').toLowerCase();
  const types = (input.types ?? []).map(t => t.toLowerCase());
  const reasons: ConfidenceReason[] = [];
  const add = (rule: string, points: number) => reasons.push({ rule, points });

  if (/\br\.?m\.?c\.?\b/i.test(input.name)) add('name contains RMC', 40);
  if (name.includes('ready mix concrete')) add('name contains Ready Mix Concrete', 45);
  if (name.includes('ready mixed concrete')) add('name contains Ready Mixed Concrete', 45);
  if (name.includes('concrete plant')) add('name contains Concrete Plant', 30);
  if (name.includes('batching plant')) add('name contains Batching Plant', 25);
  if (types.some(t => includesAny(t, ['concrete', 'ready_mix', 'building_material']))) add('Google type suggests concrete supplier', 20);
  if (includesAny(address, ['midc', 'industrial area', 'industrial estate'])) add('address contains industrial area', 10);

  if (name.includes('equipment')) add('name contains equipment', -35);
  if (name.includes('machine manufacturer')) add('name contains machine manufacturer', -40);
  if (name.includes('spare parts')) add('name contains spare parts', -35);
  if (name.includes('cement dealer')) add('name contains cement dealer', -35);
  if (name.includes('hardware')) add('name contains hardware', -30);
  if (name.includes('consultant')) add('name contains consultant', -30);

  const hasStrongPlantTerm = /\br\.?m\.?c\.?\b/i.test(input.name) ||
    includesAny(name, ['ready mix concrete', 'ready mixed concrete', 'concrete plant', 'batching plant']);
  if (name.includes('contractor') && !hasStrongPlantTerm) add('contractor without RMC term', -25);
  if (name.includes('laboratory') && !hasStrongPlantTerm) add('laboratory without RMC term', -25);
  if (name.includes('office') && !hasStrongPlantTerm) add('office without plant term', -20);

  const score = Math.max(0, Math.min(100, reasons.reduce((sum, r) => sum + r.points, 0)));
  const threshold = input.minimumScore ?? 45;
  return {
    score,
    level: score >= 70 ? 'HIGH' : score >= threshold ? 'MEDIUM' : 'LOW',
    discoveryStatus: score >= threshold ? 'NEEDS_REVIEW' : 'REJECTED',
    reasons,
  };
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nameSimilarity(a: string, b: string): number {
  const left = new Set(normalizeRmcName(a).split(' ').filter(Boolean));
  const right = new Set(normalizeRmcName(b).split(' ').filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection++;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

export function isLikelyDuplicate(a: {
  name: string;
  latitude: number;
  longitude: number;
  locality?: string | null;
}, b: {
  name: string;
  latitude: number;
  longitude: number;
  locality?: string | null;
}, radiusMeters = 200): boolean {
  const similarity = nameSimilarity(a.name, b.name);
  const distance = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
  if (distance <= radiusMeters && similarity >= 0.45) return true;
  const sameLocality = Boolean(a.locality && b.locality && a.locality.toLowerCase() === b.locality.toLowerCase());
  return sameLocality && similarity >= 0.8;
}
