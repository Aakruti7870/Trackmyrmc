// Illustrative sample data for Command Center panels that have no live API yet.
// Every consumer of these must render a <SampleTag/> so the Authority always
// knows what is real vs. representative.

export const CITIES = ['Mumbai', 'Navi Mumbai', 'Panvel', 'Pune', 'Thane', 'Nashik'];
export const GRADES = ['M20', 'M25', 'M30', 'M35', 'M40'];

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Deterministic pseudo-random so charts look stable across renders.
function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export const WEEKLY_DISPATCH = (() => {
  const r = seeded(42);
  return WEEKDAYS.map(label => ({ label, value: Math.round(120 + r() * 240) }));
})();

export const GMV_TREND = (() => {
  const r = seeded(7);
  return WEEKDAYS.map(label => ({ label, value: Math.round(8 + r() * 22) })); // ₹ lakh
})();

export const CITY_VOLUME = (() => {
  const r = seeded(99);
  return CITIES.map(name => ({ name, value: Math.round(300 + r() * 1400) }));
})();

export const GRADE_MIX = (() => {
  const r = seeded(13);
  const colors = ['#22c55e', '#38bdf8', '#a78bfa', '#f59e0b', '#e879f9'];
  return GRADES.map((g, i) => ({ label: g, value: Math.round(40 + r() * 160), color: colors[i] }));
})();

export const CUSTOMER_GROWTH = (() => {
  const r = seeded(55);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return months.map(label => ({ label, value: Math.round(20 + r() * 90) }));
})();

export interface Complaint {
  id: number; customer: string; plant: string; subject: string;
  priority: 'high' | 'medium' | 'low'; status: 'open' | 'resolved'; ageHrs: number;
}
export const COMPLAINTS: Complaint[] = [
  { id: 4821, customer: 'Customer #A19', plant: 'Panvel Hub', subject: 'Late delivery — 45 min', priority: 'high', status: 'open', ageHrs: 2 },
  { id: 4820, customer: 'Customer #C07', plant: 'Thane West', subject: 'Slump lower than ordered', priority: 'high', status: 'open', ageHrs: 5 },
  { id: 4817, customer: 'Customer #M32', plant: 'Pune East', subject: 'Challan quantity mismatch', priority: 'medium', status: 'open', ageHrs: 9 },
  { id: 4809, customer: 'Customer #B11', plant: 'Mumbai Central', subject: 'Driver behaviour', priority: 'low', status: 'resolved', ageHrs: 28 },
];

export interface SecurityEvent {
  id: number; type: 'login' | 'otp' | 'permission' | 'blocked'; actor: string; detail: string; when: string; ok: boolean;
}
export const SECURITY_EVENTS: SecurityEvent[] = [
  { id: 1, type: 'login', actor: 'krushnabade54@gmail.com', detail: 'Super Admin login • 2FA passed', when: '2 min ago', ok: true },
  { id: 2, type: 'otp', actor: '+91 ••• ••• 3421', detail: 'Customer OTP verified', when: '6 min ago', ok: true },
  { id: 3, type: 'blocked', actor: '103.•.•.•', detail: 'Blocked login — 5 wrong attempts', when: '22 min ago', ok: false },
  { id: 4, type: 'permission', actor: 'admin@panvel', detail: 'Role permissions updated', when: '1 hr ago', ok: true },
  { id: 5, type: 'otp', actor: '+91 ••• ••• 9080', detail: 'OTP expired (not used)', when: '2 hr ago', ok: false },
];

export interface DevicerRow { device: string; user: string; role: string; ip: string; active: string }
export const ACTIVE_SESSIONS: DevicerRow[] = [
  { device: 'Chrome • Windows', user: 'krushnabade54@gmail.com', role: 'authority', ip: '49.36.•.•', active: 'now' },
  { device: 'App • Android', user: 'Owner • Panvel Hub', role: 'plant_owner', ip: '106.51.•.•', active: '3 min' },
  { device: 'Safari • iPhone', user: 'Customer #A19', role: 'client', ip: '157.32.•.•', active: '12 min' },
  { device: 'App • Android', user: 'Driver • MH04 CT 8821', role: 'driver', ip: '223.190.•.•', active: '18 min' },
];

export interface PredictionCard { title: string; value: string; detail: string; confidence: 'high' | 'medium' | 'low' }
export const AI_PREDICTIONS: PredictionCard[] = [
  { title: 'Tomorrow demand', value: '~1,840 m³', detail: 'M25 & M30 lead; +12% vs today', confidence: 'high' },
  { title: 'Peak dispatch window', value: '9–11 AM', detail: 'Pre-stage 6 mixers at Panvel', confidence: 'medium' },
  { title: 'Churn risk', value: '3 customers', detail: 'No orders in 21 days', confidence: 'medium' },
  { title: 'Fuel anomaly', value: '2 vehicles', detail: 'Variance above threshold', confidence: 'low' },
];

export function confidenceColor(c: 'high' | 'medium' | 'low'): string {
  return c === 'high' ? 'var(--green)' : c === 'medium' ? 'var(--orange)' : 'var(--red)';
}

export function inr(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}
