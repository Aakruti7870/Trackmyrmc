// Optional absolute backend origin. Empty in the normal web build (and dev),
// where requests stay relative to `/api` and rely on the Vite proxy / same-origin
// server. The native (Capacitor) build sets VITE_API_BASE_URL to the deployed
// backend so the wrapped app reaches the live API over the internet.
export const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const BASE = `${API_ORIGIN}/api`;

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
  // Authenticated file download. Unlike window.open(), this attaches the Bearer
  // token and resolves against API_ORIGIN, so it works in the native (Capacitor)
  // build where the WebView origin is not the backend.
  download: async (path: string, filename: string): Promise<void> => {
    const token = getToken();
    const res = await fetch(`${BASE}${path}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (res.status === 401) {
      if (token) clearSessionAndRedirect();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(err.error || res.statusText, res.status, err as Record<string, unknown>);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export interface SocialLinks {
  youtube: string;
  instagram: string;
  facebook: string;
  whatsapp: string;
  playStore: string;
}

export interface AppConfig {
  appVersion: string;
  rolePermissionOverrides: Partial<Record<string, string[]>>;
  socialLinks?: SocialLinks;
  /** Browser key for Google Maps; absent = free OpenStreetMap maps. */
  googleMapsKey?: string;
  googleMapsMapId?: string;
}

export type User = {
  id: number; name: string; email: string; role: string;
  phone?: string | null;
  plantId?: number | null;
  linkedClientId?: number | null;
  linkedDriverId?: number | null;
  // Driver-only: the truck assigned to this driver (from the login response).
  // Present right after a driver signs in; not re-fetched by /auth/me.
  truckId?: number | null;
  truckNo?: string | null;
  // Customer order-gating fields. Optional/backend-driven — the backend
  // remains authoritative; the frontend only reads and reflects these, it
  // never derives KYC/order-eligibility itself. Absent on roles the gate
  // doesn't apply to (staff, plant, driver, etc).
  canPlaceOrder?: boolean;
  isKycVerified?: boolean;
  kycStatus?: string;
  displayName?: string | null;
  verifiedName?: string | null;
};

export interface LinkedUser {
  id: number; name: string; email: string;
}

export interface Client {
  id: number; name: string; contactPerson: string; phone: string;
  email?: string; gstNo?: string; address?: string; city?: string;
  creditLimit: string; outstandingAmount: string; createdAt: string;
  linkedUsers?: LinkedUser[];
  // True when a linked login account has completed KYC (Aadhaar eKYC or an
  // approved KYC profile) — drives the E-KYC trust badge.
  kycVerified?: boolean;
}

export interface Site {
  id: number; clientId: number; name: string; address?: string; city?: string;
  latitude?: string | null; longitude?: string | null; createdAt: string;
}

export interface Order {
  id: number; orderNo: string; clientId: number; siteId?: number;
  grade: string; quantity: string; pumpRequired: boolean;
  pumpLineLength?: string | null;
  deliveryDate?: string; deliveryTime?: string; notes?: string;
  status: string; createdAt: string;
  clientName?: string; siteName?: string;
  // True when the ordering customer's account is KYC-verified — shown to the
  // plant as an anti-fraud trust signal.
  customerKycVerified?: boolean;
  // Customer-supplied delivery details captured at order placement.
  contactPerson?: string | null; contactNumber?: string | null;
  siteAddress?: string | null;
  latitude?: string | null; longitude?: string | null;
  // Google Place ID for the confirmed delivery pin (when picked via Places).
  placeId?: string | null;
  paymentType?: string | null; poNumber?: string | null;
  sitePhoto?: string | null; rejectionReason?: string | null;
  cancellationReason?: string | null;
  // The plant fulfilling this order (a customer can have orders across plants).
  plantId?: number | null; plantName?: string | null; plantCode?: string | null;
}

export interface PlantDirectoryEntry {
  id: number; plantCode: string | null; name: string; city?: string | null;
  grades?: string[] | null; openTime?: string | null; closeTime?: string | null;
}

/** Full plant row returned by the admin GET /plants endpoint (Authority MAPPING PLANT). */
export interface AdminPlant {
  id: number;
  name: string;
  plantCode?: string | null;
  ownerName?: string | null;
  email?: string | null;
  contactNumber?: string | null;
  whatsappNumber?: string | null;
  address?: string | null;
  city?: string | null;
  latitude: string;
  longitude: string;
  networkStatus: 'pending' | 'invited' | 'verified' | 'active';
  showOnNetwork: boolean;
  verified?: boolean;
  isActive?: boolean;
  plantStatus?: string | null;
  inviteStatus?: string | null;
  inviteSentAt?: string | null;
  ownerCount?: number;
}

/** Response of POST /plants/:id/send-invite. */
export interface SendInviteResult {
  inviteUrl: string;
  emailSent: boolean;
  invited: boolean;
  networkStatus?: string | null;
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
  siteArrivalTime?: string | null; siteReleaseTime?: string | null;
  status: string; notes?: string; createdAt: string;
  tripStatus?: string | null;
  clientName?: string; siteName?: string;
  // Delivery site contact + address the customer supplied on the order. Surfaced
  // only in the driver trip view for delivery coordination (call / navigate).
  siteAddress?: string | null; contactPerson?: string | null; contactNumber?: string | null;
  siteLat?: string | null; siteLng?: string | null;
  vehicleNo?: string; driverName?: string; driverPhone?: string;
  proofPhotos?: string[]; hasProofPhoto?: boolean;
  // Staff/driver-only odometer readings (never returned to clients).
  odometerStart?: number | null; odometerEnd?: number | null;
  // Issuing-plant identity. Challan documents are branded by the plant that
  // fulfilled the order, never a hardcoded company. List rows carry only
  // plantName/plantCode; the detail endpoint adds the full identity block.
  plantCode?: string | null; plantName?: string | null; plantLegalName?: string | null;
  plantAddress?: string | null; plantCity?: string | null; plantContact?: string | null;
  plantGstNo?: string | null; plantEmail?: string | null;
  // Per-plant anonymous customer code (the only customer identifier a plant knows).
  customerCode?: string | null;
}

export interface IdleConfig {
  freeMin: number;
  ratePerHour: number | null;
}

export interface IdleSettings extends IdleConfig {
  defaults: { freeMin: number; ratePerHour: number | null };
}

export interface StuckProofPhoto {
  id: number;
  challanId: number;
}

export interface StuckProofPhotosResponse {
  count: number;
  photos: StuckProofPhoto[];
}

export interface ProofPhotoRetryFailure {
  id: number;
  challanId: number;
  error: string;
}

export interface ProofPhotoRetryResult {
  migrated: number;
  skipped: number;
  failed: number;
  failures: ProofPhotoRetryFailure[];
}

// A WhatsApp customer notification whose first send failed transiently and is
// waiting in the background retry queue.
export interface WhatsAppRetry {
  id: number;
  toPhone: string;
  event: string | null;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string;
  createdAt: string;
}

export interface WhatsAppRetriesResponse {
  count: number;
  retries: WhatsAppRetry[];
}

export type WhatsAppForceRetryOutcome = 'sent' | 'retried' | 'gaveUp';

export interface WhatsAppForceRetryResult {
  ok: boolean;
  outcome: WhatsAppForceRetryOutcome;
}

export interface Vehicle {
  id: number; vehicleNo: string; type: string; capacity: string;
  driverId?: number; insuranceExpiry?: string; lastService?: string;
  status: string; createdAt: string;
  driverName?: string; driverPhone?: string;
  // Diesel-reconciliation baselines (staff/owner only).
  mileageKmpl?: string | null; idleBurnLph?: string | null;
}

export interface FuelLog {
  id: number; vehicleId: number; litres: string; amount?: string | null;
  odometer?: number | null; filledAt: string; notes?: string | null;
  recordedBy?: number | null; recordedByName?: string | null; createdAt: string;
  vehicleNo?: string | null; hasBillPhoto?: boolean; billPhotoUrl?: string | null;
}

export interface FuelConfig {
  reconVariancePct: number;
  idleBurnLph: number;
  unscheduledStopMin: number;
  routeDeviationM: number;
  plantLat: number | null;
  plantLng: number | null;
}

export interface FuelSettings extends FuelConfig {
  defaults: FuelConfig;
}

export interface FuelReconRow {
  vehicleId: number; vehicleNo: string | null;
  km: number; idleHours: number; trips: number; tripsWithOdometer: number;
  mileageKmpl: number | null; idleBurnLph: number;
  expectedDrivingLitres: number | null; expectedIdleLitres: number;
  expectedLitres: number | null; actualLitres: number;
  amount: number; fills: number;
  variancePct: number | null; flagged: boolean;
}

export interface FuelReconResponse {
  config: FuelConfig;
  rows: FuelReconRow[];
}

export interface VehicleAlert {
  id: number; type: 'unscheduled_stop' | 'route_deviation';
  challanId: number | null; vehicleId: number | null; driverId: number | null;
  lat: string | null; lng: string | null; distanceM: number | null;
  detail: string | null; acknowledgedAt: string | null; createdAt: string;
  challanNo?: string | null; vehicleNo?: string | null; driverName?: string | null;
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
  released?: boolean; arrived?: boolean;
  siteArrivalTime?: string | null; siteReleaseTime?: string | null;
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

// ---- AI Help Agent ---------------------------------------------------------

export interface AiPlantOption { id: number; name: string; plantCode: string | null }

export interface AiConfig {
  enabled: boolean;
  greeting: string;
  requiresPlantSelection: boolean;
  // True when the server speech-to-text path is available (one consistent
  // recogniser on every browser). When false the client uses the browser-native
  // SpeechRecognition, which is hidden on browsers that lack it.
  voiceInput?: boolean;
  plants?: AiPlantOption[];
}

export interface AiChatResponse {
  reply: string;
  refused: boolean;
  source: 'gemini' | 'fallback' | 'policy';
  functionsUsed?: string[];
  outputType: string;
}

export interface AiSettings {
  enabled: boolean;
  persona: string;
  greeting: string;
  defaults: { persona: string; greeting: string };
}

export interface AiChatBody {
  message: string; sessionId: string;
  inputType?: 'text' | 'voice'; outputType?: 'text' | 'audio';
  selectedPlantId?: number | null;
}

export interface AiStreamHandlers {
  onMeta?: (meta: { refused: boolean; source?: string; functionsUsed?: string[]; outputType: string }) => void;
  onDelta: (text: string) => void;
  onDone?: (done: { reply: string; source?: string }) => void;
}

// Stream a chat reply over Server-Sent Events. Resolves once the stream ends.
// Falls back to throwing on HTTP/network errors so the caller can surface them.
async function aiChatStream(body: AiChatBody, handlers: AiStreamHandlers, signal?: AbortSignal): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE}/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (res.status === 401) {
    if (token) clearSessionAndRedirect();
    throw new Error('Unauthorized');
  }
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(err.error || res.statusText, res.status, err);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleFrame = (frame: string) => {
    let event = 'message';
    let data = '';
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return;
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(data); } catch { return; }
    if (event === 'meta') handlers.onMeta?.(parsed as never);
    else if (event === 'delta') handlers.onDelta(String((parsed as { text?: string }).text ?? ''));
    else if (event === 'done') handlers.onDone?.(parsed as never);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) handleFrame(frame);
  }
  if (buffer.trim()) handleFrame(buffer);
}

export const aiApi = {
  config: () => api.get<AiConfig>('/ai/config'),
  chat: (body: AiChatBody) => api.post<AiChatResponse>('/ai/chat', body),
  chatStream: aiChatStream,
  // Transcribe a recorded voice clip server-side (base64 + its mime type).
  transcribe: (audio: string, mimeType: string) =>
    api.post<{ text: string }>('/ai/stt', { audio, mimeType }),
  supportTicket: (body: {
    subject?: string; message: string; contactInfo?: string; selectedPlantId?: number | null;
  }) => api.post<{ id: number; status: string }>('/ai/support-ticket', body),
  getSettings: () => api.get<AiSettings>('/admin/ai-settings'),
  saveSettings: (body: { enabled?: boolean; persona?: string; greeting?: string }) =>
    api.post<AiSettings>('/admin/ai-settings', body),
};
