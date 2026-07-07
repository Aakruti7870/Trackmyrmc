// Client-side types + API wrappers for the Mix Design master and the Batch
// Report Generator. Mirrors server/src/lib/batchSheet.ts and the
// /api/mix-designs + /api/batch-reports routes.
import { api } from './api';

// ——— shared shapes (mirror the server) ———
export interface RecipeMaterial {
  key: string;
  label: string;
  perCumKg: number;
  tolerancePct: number;
}

export interface BatchRow {
  size: number;
  actuals: Record<string, number>;
}

export interface SheetTotals {
  perMaterial: {
    key: string;
    label: string;
    totalSet: number;
    totalActual: number;
    diffPct: number;
  }[];
  totalSetMass: number;
  totalActualMass: number;
  totalMassDiffPct: number;
}

export const MIX_GRADES = ['M10', 'M15', 'M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50'] as const;

// Starting material set for a new mix design (typical M25-ish proportions);
// fully editable — rows can be renamed, added or removed per design.
export const DEFAULT_MATERIALS: RecipeMaterial[] = [
  { key: 'agg_20mm', label: '20mm Aggregate', perCumKg: 640, tolerancePct: 2 },
  { key: 'agg_10mm', label: '10mm Aggregate', perCumKg: 430, tolerancePct: 2 },
  { key: 'crush_sand', label: 'Crush Sand', perCumKg: 850, tolerancePct: 2 },
  { key: 'cement', label: 'Cement', perCumKg: 340, tolerancePct: 1 },
  { key: 'flyash', label: 'Flyash', perCumKg: 80, tolerancePct: 1 },
  { key: 'water', label: 'Water', perCumKg: 160, tolerancePct: 1 },
  { key: 'admixture', label: 'Admixture', perCumKg: 3.4, tolerancePct: 3 },
];

// Weigh-scale style rounding (matches the server): tiny loads keep 2 decimals.
export const roundWeight = (v: number) => {
  const f = v < 10 ? 100 : 10;
  return Math.round(v * f) / f;
};

// Per-batch target weight for a material — mix design per-cum weight × batch size.
export const targetFor = (m: RecipeMaterial, size: number) => roundWeight(m.perCumKg * size);

// ——— Mix design master ———
export interface MixDesignRow {
  id: number;
  plantId: number | null;
  grade: string;
  recipeName: string;
  recipeCode: string | null;
  materials: RecipeMaterial[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MixDesignBody {
  grade: string;
  recipeName: string;
  recipeCode?: string | null;
  notes?: string | null;
  materials: { key?: string; label: string; perCumKg: number; tolerancePct: number }[];
}

export const mixDesignApi = {
  list: () => api.get<MixDesignRow[]>('/mix-designs'),
  create: (body: MixDesignBody) => api.post<MixDesignRow>('/mix-designs', body),
  update: (id: number, body: MixDesignBody) => api.put<MixDesignRow>(`/mix-designs/${id}`, body),
  remove: (id: number) => api.delete<{ ok: boolean }>(`/mix-designs/${id}`),
};

// ——— Batch reports ———
export interface BatchSettings {
  plantType: string;
  mixerCapacityCum: number;
  batchSizeCum: number;
}

export interface BatchReportListItem {
  id: number;
  reportNo: string;
  grade: string;
  recipeName: string;
  recipeCode: string | null;
  productionQty: string;
  batchSize: string;
  customer: string | null;
  site: string | null;
  truckNo: string | null;
  batchDate: string | null;
  challanId: number | null;
  challanNo: string | null;
  createdAt: string;
  batchCount: number;
}

export interface BatchReportDetail {
  id: number;
  plantId: number | null;
  reportNo: string;
  challanId: number | null;
  challanNo: string | null;
  grade: string;
  recipeName: string;
  recipeCode: string | null;
  plantType: string | null;
  mixerCapacity: string | null;
  batchSize: string;
  productionQty: string;
  orderedQty: string | null;
  withThisLoad: string | null;
  truckNo: string | null;
  truckDriver: string | null;
  customer: string | null;
  site: string | null;
  batchDate: string | null;
  startTime: string | null;
  endTime: string | null;
  materials: RecipeMaterial[];
  batches: BatchRow[];
  totals: SheetTotals;
  createdAt: string;
  updatedAt: string;
}

export interface BatchReportCreateBody {
  mixDesignId: number;
  challanId?: number | null;
  productionQty: number;
  batchSize: number;
  mixerCapacity?: number | null;
  plantType?: string;
  orderedQty?: number | null;
  withThisLoad?: number | null;
  truckNo?: string;
  truckDriver?: string;
  customer?: string;
  site?: string;
  batchDate?: string;
  startTime?: string;
  endTime?: string;
}

export interface BatchReportUpdateBody {
  regenerate?: boolean;
  batches?: BatchRow[];
  plantType?: string | null;
  truckNo?: string | null;
  truckDriver?: string | null;
  customer?: string | null;
  site?: string | null;
  orderedQty?: number | null;
  withThisLoad?: number | null;
  batchDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

export const batchReportApi = {
  list: () => api.get<BatchReportListItem[]>('/batch-reports'),
  get: (id: number | string) => api.get<BatchReportDetail>(`/batch-reports/${id}`),
  create: (body: BatchReportCreateBody) => api.post<BatchReportDetail>('/batch-reports', body),
  update: (id: number, body: BatchReportUpdateBody) => api.put<BatchReportDetail>(`/batch-reports/${id}`, body),
  remove: (id: number) => api.delete<{ ok: boolean }>(`/batch-reports/${id}`),
  settings: () => api.get<BatchSettings>('/batch-reports/settings'),
  saveSettings: (body: BatchSettings) => api.put<BatchSettings>('/batch-reports/settings', body),
};
