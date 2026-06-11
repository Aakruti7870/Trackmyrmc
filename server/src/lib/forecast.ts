// Lightweight, transparent demand forecasting for the plant. There is no
// external "AI" service or API key involved: the prediction is a deterministic
// statistical model anyone can audit — a recency-weighted blend of same-weekday
// history and the overall daily average, floored by what is already on the books
// (placed orders + recurring templates that fall due on the target day).

export interface DailyHistory {
  /** YYYY-MM-DD */
  date: string;
  grade: string;
  qty: number;
}

export interface GradeQty {
  grade: string;
  qty: number;
}

export type Confidence = 'low' | 'medium' | 'high';

export interface GradeForecast {
  grade: string;
  predictedQty: number;
  bookedQty: number;
  recurringQty: number;
  /** The raw statistical estimate before flooring by booked+recurring. */
  modelQty: number;
  confidence: Confidence;
  sampleDays: number;
}

export interface ForecastResult {
  date: string;
  weekday: string;
  grades: GradeForecast[];
  totalPredicted: number;
  totalBooked: number;
  totalRecurring: number;
  avgTruckCapacity: number;
  recommendedTruckLoads: number;
  recommendedBatches: number;
  assumptions: string[];
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

// Recency-weighted mean: the most recent sample gets the highest weight,
// decaying geometrically into the past. Keeps the forecast responsive to recent
// demand without ignoring older history entirely.
function weightedMean(values: number[]): number {
  if (values.length === 0) return 0;
  let wsum = 0;
  let vsum = 0;
  // `values` is expected oldest→newest; weight grows toward the end.
  for (let i = 0; i < values.length; i++) {
    const w = Math.pow(1.15, i);
    wsum += w;
    vsum += w * values[i];
  }
  return vsum / wsum;
}

function confidenceFor(sampleDays: number): Confidence {
  if (sampleDays >= 8) return 'high';
  if (sampleDays >= 3) return 'medium';
  return 'low';
}

export interface ComputeForecastArgs {
  history: DailyHistory[];
  targetDate: string;
  booked: GradeQty[];
  recurring: GradeQty[];
  avgTruckCapacity: number;
}

// Build a per-grade demand forecast for `targetDate`. History should contain
// only days strictly before the target so the model never trains on the day it
// predicts.
export function computeForecast(args: ComputeForecastArgs): ForecastResult {
  const { history, targetDate, booked, recurring } = args;
  const avgTruckCapacity = args.avgTruckCapacity > 0 ? args.avgTruckCapacity : 6;
  const targetDow = weekdayOf(targetDate);

  const bookedByGrade = new Map<string, number>();
  for (const b of booked) bookedByGrade.set(b.grade, (bookedByGrade.get(b.grade) ?? 0) + b.qty);
  const recurringByGrade = new Map<string, number>();
  for (const r of recurring) recurringByGrade.set(r.grade, (recurringByGrade.get(r.grade) ?? 0) + r.qty);

  // Per-grade history grouped by date so we can build same-weekday series and an
  // overall daily-average series.
  const grades = new Set<string>();
  const histByGrade = new Map<string, DailyHistory[]>();
  for (const h of history) {
    grades.add(h.grade);
    const arr = histByGrade.get(h.grade) ?? [];
    arr.push(h);
    histByGrade.set(h.grade, arr);
  }
  for (const g of bookedByGrade.keys()) grades.add(g);
  for (const g of recurringByGrade.keys()) grades.add(g);

  const gradeForecasts: GradeForecast[] = [];
  for (const grade of grades) {
    const rows = (histByGrade.get(grade) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const allDaily = rows.map(r => r.qty);
    const sameWeekday = rows.filter(r => weekdayOf(r.date) === targetDow).map(r => r.qty);

    const overallAvg = weightedMean(allDaily);
    const weekdayAvg = weightedMean(sameWeekday);

    // Blend toward the same-weekday signal once we have at least two matching
    // samples; otherwise lean on the overall average.
    const modelQty = sameWeekday.length >= 2 ? 0.6 * weekdayAvg + 0.4 * overallAvg : overallAvg;

    const booked = bookedByGrade.get(grade) ?? 0;
    const recurringQty = recurringByGrade.get(grade) ?? 0;
    // Whatever is already committed (placed orders + due recurring templates) is
    // a hard floor — predicted demand can never be less than that.
    const predictedQty = Math.max(modelQty, booked + recurringQty);

    gradeForecasts.push({
      grade,
      predictedQty: round1(predictedQty),
      bookedQty: round1(booked),
      recurringQty: round1(recurringQty),
      modelQty: round1(modelQty),
      confidence: confidenceFor(rows.length),
      sampleDays: rows.length,
    });
  }

  gradeForecasts.sort((a, b) => b.predictedQty - a.predictedQty);

  const totalPredicted = round1(gradeForecasts.reduce((s, g) => s + g.predictedQty, 0));
  const totalBooked = round1(gradeForecasts.reduce((s, g) => s + g.bookedQty, 0));
  const totalRecurring = round1(gradeForecasts.reduce((s, g) => s + g.recurringQty, 0));
  const recommendedTruckLoads = Math.ceil(totalPredicted / avgTruckCapacity) || 0;

  const assumptions = [
    `Predictions blend recency-weighted ${WEEKDAYS[targetDow]} history with the overall daily average.`,
    `Already-placed orders and recurring schedules for the day are treated as a guaranteed minimum.`,
    `Truck loads assume an average mixer capacity of ${round1(avgTruckCapacity)} m³.`,
  ];

  return {
    date: targetDate,
    weekday: WEEKDAYS[targetDow],
    grades: gradeForecasts,
    totalPredicted,
    totalBooked,
    totalRecurring,
    avgTruckCapacity: round1(avgTruckCapacity),
    recommendedTruckLoads,
    // One batch per mixer load is the working assumption for the plant.
    recommendedBatches: recommendedTruckLoads,
    assumptions,
  };
}
