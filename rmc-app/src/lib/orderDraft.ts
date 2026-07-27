// Preserves an in-progress order form across a KYC-verification detour so a
// customer who gets interrupted by the verification gate doesn't lose what
// they typed. Only non-sensitive delivery fields are stored — no KYC/identity
// data ever passes through this key. Versioned so a future shape change can't
// crash on an old, incompatible draft left in localStorage.
const DRAFT_KEY = 'trackmyrmc.orderDraft.v1';

export interface OrderDraft {
  grade: string;
  quantity: string;
  deliveryDate: string;
  deliveryTime: string;
  pumpRequired: boolean;
  pumpLineLength: string;
  notes: string;
  siteId: string;
  contactPerson: string;
  contactNumber: string;
  siteName: string;
  siteAddress: string;
  latitude: string;
  longitude: string;
  placeId: string;
  paymentType: string;
  poNumber: string;
  selectedPlantId: number | null;
  selectedPlant: string | null;
  savedAt: number;
}

function isOrderDraft(value: unknown): value is OrderDraft {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  return typeof d.savedAt === 'number'
    && typeof d.grade === 'string'
    && typeof d.quantity === 'string';
}

export function saveOrderDraft(draft: Omit<OrderDraft, 'savedAt'>): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // Draft preservation is best-effort — never block the KYC-required flow.
  }
}

export function readOrderDraft(): OrderDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isOrderDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearOrderDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
