import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeForecast, type DailyHistory } from '../lib/forecast.js';

// 2025-06-09 is a Monday (UTC); use it as the target so same-weekday history is
// any prior Monday.
const TARGET = '2025-06-09';

test('predicted demand is floored by booked + recurring commitments', () => {
  const res = computeForecast({
    history: [],
    targetDate: TARGET,
    booked: [{ grade: 'M25', qty: 10 }],
    recurring: [{ grade: 'M25', qty: 5 }],
    avgTruckCapacity: 6,
  });
  const m25 = res.grades.find(g => g.grade === 'M25');
  assert.ok(m25);
  // No history → model estimate 0, but committed work is a hard floor.
  assert.equal(m25.modelQty, 0);
  assert.equal(m25.bookedQty, 10);
  assert.equal(m25.recurringQty, 5);
  assert.equal(m25.predictedQty, 15);
});

test('recommended truck loads ceil predicted volume over capacity', () => {
  const res = computeForecast({
    history: [],
    targetDate: TARGET,
    booked: [{ grade: 'M25', qty: 13 }],
    recurring: [],
    avgTruckCapacity: 6,
  });
  // 13 / 6 = 2.16 → 3 loads, one batch per load.
  assert.equal(res.recommendedTruckLoads, 3);
  assert.equal(res.recommendedBatches, 3);
});

test('same-weekday history drives the model estimate', () => {
  // Four prior Mondays at 20 m³ each, plus noisy non-Monday days.
  const history: DailyHistory[] = [
    { date: '2025-05-12', grade: 'M30', qty: 20 }, // Mon
    { date: '2025-05-19', grade: 'M30', qty: 20 }, // Mon
    { date: '2025-05-26', grade: 'M30', qty: 20 }, // Mon
    { date: '2025-06-02', grade: 'M30', qty: 20 }, // Mon
    { date: '2025-05-14', grade: 'M30', qty: 2 },  // Wed
    { date: '2025-05-15', grade: 'M30', qty: 2 },  // Thu
  ];
  const res = computeForecast({ history, targetDate: TARGET, booked: [], recurring: [], avgTruckCapacity: 8 });
  const m30 = res.grades.find(g => g.grade === 'M30');
  assert.ok(m30);
  // Weekday blend should sit well above the low non-Monday days.
  assert.ok(m30.modelQty > 12, `expected model > 12, got ${m30.modelQty}`);
  // 6 sample days → medium confidence (high requires ≥8).
  assert.equal(m30.confidence, 'medium');
  assert.equal(m30.sampleDays, 6);
});

test('confidence scales with the number of sample days', () => {
  const oneDay = computeForecast({
    history: [{ date: '2025-06-02', grade: 'M20', qty: 5 }],
    targetDate: TARGET, booked: [], recurring: [], avgTruckCapacity: 6,
  });
  assert.equal(oneDay.grades.find(g => g.grade === 'M20')?.confidence, 'low');
});

test('weekday label and zero-capacity fallback are reported', () => {
  const res = computeForecast({ history: [], targetDate: TARGET, booked: [], recurring: [], avgTruckCapacity: 0 });
  assert.equal(res.weekday, 'Monday');
  // Falls back to a sane default capacity (6) rather than dividing by zero.
  assert.equal(res.avgTruckCapacity, 6);
  assert.ok(res.assumptions.length >= 3);
});
