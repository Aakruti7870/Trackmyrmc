const BASE = '/api';

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function getToken() {
  return localStorage.getItem('rmc_token') || '';
}

function clearSessionAndRedirect() {
  localStorage.removeItem('rmc_token');
  localStorage.removeItem('rmc_user');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    const err = await res.json().catch(() => ({ error: 'Unauthorized' }));
    // Only force a logout when the failed call was actually authenticated.
    // A 401 from an unauthenticated request (e.g. wrong password on /auth/login)
    // should surface its error so the caller can display it.
    if (token) {
      clearSessionAndRedirect();
    }
    throw new Error(err.error || 'Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(err.error || res.statusText, res.status, err);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, body === undefined
      ? { method: 'DELETE' }
      : { method: 'DELETE', body: JSON.stringify(body) }),
};

export type User = {
  id: number; name: string; email: string; role: string;
  linkedClientId?: number | null;
  linkedDriverId?: number | null;
};

export interface LinkedUser {
  id: number; name: string; email: string;
}

export interface Client {
  id: number; name: string; contactPerson: string; phone: string;
  email?: string; gstNo?: string; address?: string; city?: string;
  creditLimit: string; outstandingAmount: string; createdAt: string;
  linkedUsers?: LinkedUser[];
}

export interface Site {
  id: number; clientId: number; name: string; address?: string; city?: string;
  latitude?: string | null; longitude?: string | null; createdAt: string;
}

export interface Order {
  id: number; orderNo: string; clientId: number; siteId?: number;
  grade: string; quantity: string; pumpRequired: boolean;
  deliveryDate?: string; deliveryTime?: string; notes?: string;
  status: string; createdAt: string;
  clientName?: string; siteName?: string;
}

export interface RecurringOrder {
  id: number; clientId: number; siteId?: number | null;
  grade: string; quantity: string; pumpRequired: boolean;
  deliveryTime?: string | null; notes?: string | null;
  frequency: 'weekly' | 'monthly'; anchor: number;
  nextRunDate: string; active: boolean;
  lastRunAt?: string | null; createdAt: string;
  siteName?: string | null;
}

export interface Challan {
  id: number; challanNo: string; orderId?: number;
  clientId: number; siteId?: number; vehicleId?: number; driverId?: number;
  grade: string; quantity: string; deliveredQuantity?: string | null; pumpRequired: boolean;
  dispatchTime?: string; deliveryTime?: string;
  status: string; notes?: string; createdAt: string;
  clientName?: string; siteName?: string;
  siteLat?: string | null; siteLng?: string | null;
  vehicleNo?: string; driverName?: string; driverPhone?: string;
  proofPhotos?: string[]; hasProofPhoto?: boolean;
}

export interface Vehicle {
  id: number; vehicleNo: string; type: string; capacity: string;
  driverId?: number; insuranceExpiry?: string; lastService?: string;
  status: string; createdAt: string;
  driverName?: string; driverPhone?: string;
}

export interface Driver {
  id: number; name: string; phone: string;
  licenseNo?: string; licenseExpiry?: string; isActive: boolean; createdAt: string;
  linkedUsers?: LinkedUser[];
}

export interface BatchRecord {
  id: number; batchNo: string; grade: string; quantity: string;
  cementBags?: number; waterLiters?: number; sandKg?: number; aggregateKg?: number;
  operator?: string; remarks?: string; createdAt: string;
}

export interface LedgerEntry {
  id: number; clientId: number; type: string; amount: string;
  description: string; referenceNo?: string; createdAt: string;
  runningBalance?: number;
}

export interface DashboardKPIs {
  todayProduction: number; todayBatches: number;
  todayDispatch: number; todayChallans: number;
  activeOrders: number; pendingOrders: number; inProgressOrders: number;
  totalVehicles: number; activeVehicles: number; maintenanceVehicles: number;
  outstandingAmount: number; totalClients: number;
}

export interface LivePosition {
  challanId: number; challanNo: string | null;
  clientId: number | null;
  driverId: number | null; driverName: string | null;
  vehicleId: number | null; vehicleNo: string | null;
  siteId: number | null; siteName: string | null;
  lat: number; lng: number;
  accuracy: number | null; speed: number | null; heading: number | null;
  distanceM: number | null; status: string;
  inRadiusCount: number; updatedAt: string;
}

export interface PositionUpdateResult {
  ok: boolean; distanceM: number | null; delivered: boolean;
  withinRadius: boolean; inRadiusCount: number;
}

export type FreshnessLevel = 'fresh' | 'warning' | 'critical' | 'expired';

export interface FreshnessConfig {
  workingLifeMin: number;
  warnMin: number;
  avgSpeedKmh: number;
}

export interface FreshnessLoad {
  challanId: number; challanNo: string;
  clientId: number | null; clientName: string | null;
  siteId: number | null; siteName: string | null;
  vehicleNo: string | null; driverName: string | null;
  grade: string; quantity: string;
  dispatchTime: string | null;
  hasLivePosition: boolean;
  lat: number | null; lng: number | null;
  distanceM: number | null; speed: number | null;
  positionUpdatedAt: string | null;
  elapsedMin: number | null; remainingMin: number | null;
  pourByIso: string | null; etaMin: number | null;
  willMakeIt: boolean | null; level: FreshnessLevel;
}

export interface FreshnessResponse {
  config: FreshnessConfig;
  loads: FreshnessLoad[];
  generatedAt: string;
}

export interface FreshnessSettings extends FreshnessConfig {
  defaults: FreshnessConfig;
}

export type Confidence = 'low' | 'medium' | 'high';

export interface GradeForecast {
  grade: string;
  predictedQty: number;
  bookedQty: number;
  recurringQty: number;
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
