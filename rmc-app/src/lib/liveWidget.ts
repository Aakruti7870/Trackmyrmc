/**
 * liveWidget.ts — JavaScript bridge for the native Android LiveWidget plugin.
 *
 * Registers the Capacitor "LiveWidget" plugin and exposes typed helpers that
 * map to the Java-side LiveWidgetPlugin methods. All functions no-op safely on
 * web (Capacitor.getPlatform() !== 'android') so they can be called from shared
 * code without platform guards at the call site.
 *
 * Auth token lifecycle:
 *   1. After successful login  → call setWidgetAuthToken(token, apiBase, role, userId)
 *   2. On account suspension   → call setWidgetSuspended(true)
 *   3. On logout               → call clearAllWidgetData()
 *
 * Widget data lifecycle (app in foreground):
 *   - Call the role-specific helper (driverOrderWidget / customerOrderWidget /
 *     plantSummaryWidget) after fetching fresh data; the native plugin stores
 *     the data in SharedPreferences and pushes it to all rendered widgets.
 *
 * Background data lifecycle (app closed / screen locked):
 *   - Android calls onUpdate() on each provider every 30 min (OS minimum).
 *   - Each provider reads the stored auth token, fetches /api/widget/{role},
 *     updates SharedPreferences, and re-renders the widget autonomously.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

// ── Plugin interface ─────────────────────────────────────────────────────────

type WidgetRole =
  | 'driver' | 'customer' | 'client'
  | 'staff' | 'admin' | 'plant_owner' | 'authority' | 'supervisor';

type WidgetData = {
  role: WidgetRole;
  title: string;
  line1: string;
  line2?: string;
  line3?: string;
  deepLink?: string;
  // Structured customer fields
  orderNo?: string;
  plantName?: string;
  grade?: string;
  quantity?: string;
  status?: string;
  loadingStatus?: string;
  dispatchStatus?: string;
  challanStatus?: string;
  vehicleNo?: string;
  deliveryProgress?: string;
  updatedAt?: string;
  // Structured driver fields
  challanNo?: string;
  customerName?: string;
  siteName?: string;
  tripStatus?: string;
  // Structured staff fields
  todayM3?: string;
  pendingOrders?: string;
  tmOnRoute?: string;
  activeDispatches?: string;
  plantStatus?: string;
};

type TrackingOptions = {
  endpoint: string;
  authToken: string;
  actorId: string;
  role: WidgetRole;
  intervalMs?: number;
};

type TrackingState = {
  active: boolean;
  latitude: string;
  longitude: string;
  accuracy: number;
  lastLocationAt: number;
};

interface LiveWidgetPlugin {
  setWidgetData(data: WidgetData): Promise<void>;
  setAuthToken(opts: {
    token: string;
    apiBase: string;
    role: string;
    userId: string;
  }): Promise<void>;
  clearWidgetData(): Promise<void>;
  setSuspendedState(opts: { suspended: boolean }): Promise<void>;
  setWidgetMode(opts: { mode: 'compact' | 'detailed' }): Promise<void>;
  startTracking(options: TrackingOptions): Promise<void>;
  stopTracking(): Promise<void>;
  getTrackingState(): Promise<TrackingState>;
  requestPermissions(options: {
    permissions: Array<'location' | 'backgroundLocation' | 'notifications'>;
  }): Promise<void>;
}

const NativeLiveWidget = registerPlugin<LiveWidgetPlugin>('LiveWidget');

// ── Guards ───────────────────────────────────────────────────────────────────

/** Returns true only on an Android Capacitor native build. */
export const liveWidgetAvailable = () => Capacitor.getPlatform() === 'android';

// ── Auth token management ─────────────────────────────────────────────────────

/**
 * Call immediately after a successful login on Android.
 * Stores the bearer token and API base URL in native SharedPreferences so widget
 * providers can fetch fresh data during background system-triggered updates.
 *
 * @param token   Short-lived JWT bearer token (re-call on token refresh)
 * @param apiBase Absolute API origin, e.g. "https://trackmyrmc.com"
 * @param role    User role string (client / driver / admin / …)
 * @param userId  User ID as a string (for audit purposes; no PII stored)
 */
export async function setWidgetAuthToken(
  token: string,
  apiBase: string,
  role: string,
  userId: string,
) {
  if (!liveWidgetAvailable()) return;
  await NativeLiveWidget.setAuthToken({ token, apiBase, role, userId });
}

/**
 * Call on logout. Clears all widget caches and shows "Login required" on every
 * active widget instance. The auth token is erased so no background API call can
 * occur after logout.
 */
export async function clearAllWidgetData() {
  if (!liveWidgetAvailable()) return;
  await NativeLiveWidget.clearWidgetData();
}

/**
 * Call when the server signals that the account is suspended.
 * Immediately stops serving live data; the widget shows the suspension banner.
 */
export async function setWidgetSuspended(suspended = true) {
  if (!liveWidgetAvailable()) return;
  await NativeLiveWidget.setSuspendedState({ suspended });
}

/**
 * Persist the user's preferred widget display mode.
 * Providers use this preference to select compact vs. detailed layout.
 */
export async function setWidgetMode(mode: 'compact' | 'detailed') {
  if (!liveWidgetAvailable()) return;
  await NativeLiveWidget.setWidgetMode({ mode });
}

// ── Live data push (app in foreground) ───────────────────────────────────────

/** Low-level push: send arbitrary widget data to the native layer. */
export async function updateLiveWidget(data: WidgetData) {
  if (!liveWidgetAvailable()) return;
  await NativeLiveWidget.setWidgetData(data);
}

/** Push structured customer order data to the customer widget. */
export async function customerOrderWidget(order: {
  orderNo: string;
  plantName?: string;
  grade: string;
  quantity: string | number;
  status: string;
  challanNo?: string;
  loadingStatus?: string;
  dispatchStatus?: string;
  challanStatus?: string;
  vehicleNo?: string;
  deliveryProgress?: string;
}) {
  return updateLiveWidget({
    role:            'client',
    title:           `Order ${order.orderNo}`,
    line1:           `${order.plantName ?? ''} · ${order.grade} · ${order.quantity} m³`.replace(/^ · /, ''),
    line2:           `Status: ${order.status}`,
    line3:           order.vehicleNo ? `Vehicle: ${order.vehicleNo}` : '',
    deepLink:        '/my-orders',
    orderNo:         order.orderNo,
    plantName:       order.plantName ?? '',
    grade:           order.grade,
    quantity:        `${order.quantity} m³`,
    status:          order.status,
    challanNo:       order.challanNo ?? '',
    loadingStatus:   order.loadingStatus ?? 'Pending',
    dispatchStatus:  order.dispatchStatus ?? 'Pending',
    challanStatus:   order.challanStatus ?? 'Pending',
    vehicleNo:       order.vehicleNo ?? '',
    deliveryProgress: order.deliveryProgress ?? '',
    updatedAt:        new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    }),
  });
}

/** Push structured driver assignment data to the driver widget. */
export async function driverOrderWidget(assignment: {
  orderNo: string;
  challanNo?: string;
  /** Preferred field; also accepts legacy alias `customer` */
  customerName?: string;
  /** @deprecated use customerName */
  customer?: string;
  /** Preferred field; also accepts legacy alias `destination` */
  siteName?: string;
  /** @deprecated use siteName */
  destination?: string;
  grade: string;
  quantity: string | number;
  vehicleNo?: string;
  tripStatus?: string;
}) {
  const customerName = assignment.customerName ?? assignment.customer ?? '—';
  const siteName     = assignment.siteName ?? assignment.destination ?? '—';
  return updateLiveWidget({
    role:         'driver',
    title:        `Order ${assignment.orderNo}`,
    line1:        `${customerName} · ${assignment.grade} · ${assignment.quantity} m³`,
    line2:        `Vehicle: ${assignment.vehicleNo ?? '—'} · ${assignment.tripStatus ?? 'ASSIGNED'}`,
    line3:        siteName,
    deepLink:     '/my-trips',
    orderNo:      assignment.orderNo,
    challanNo:    assignment.challanNo ?? '',
    customerName,
    siteName,
    grade:        assignment.grade,
    quantity:     `${assignment.quantity} m³`,
    vehicleNo:    assignment.vehicleNo ?? '—',
    tripStatus:   assignment.tripStatus ?? 'ASSIGNED',
    updatedAt:    new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    }),
  });
}

/** Push plant operations summary to the staff widget. */
export async function plantSummaryWidget(summary: {
  plantName: string;
  /** Preferred field; also accepts legacy alias `productionM3` */
  todayM3?: string | number;
  /** @deprecated use todayM3 */
  productionM3?: string | number;
  /** Preferred field; also accepts legacy alias `activeOrders` */
  pendingOrders?: string | number;
  /** @deprecated use pendingOrders */
  activeOrders?: string | number;
  tmOnRoute: string | number;
  /** Preferred field; also accepts legacy alias `activeOrders` */
  activeDispatches?: string | number;
  plantStatus?: string;
}) {
  const todayM3         = summary.todayM3 ?? summary.productionM3 ?? 0;
  const pendingOrders   = summary.pendingOrders ?? summary.activeOrders ?? 0;
  const activeDispatches = summary.activeDispatches ?? summary.activeOrders ?? 0;
  return updateLiveWidget({
    role:             'staff',
    title:            summary.plantName,
    line1:            `Today: ${todayM3} m³ production`,
    line2:            `${summary.tmOnRoute} TM on route · ${pendingOrders} pending`,
    line3:            `Plant: ${summary.plantStatus ?? 'ACTIVE'}`,
    deepLink:         '/',
    plantName:        summary.plantName,
    todayM3:          String(todayM3),
    pendingOrders:    String(pendingOrders),
    tmOnRoute:        String(summary.tmOnRoute),
    activeDispatches: String(activeDispatches),
    plantStatus:      summary.plantStatus ?? 'ACTIVE',
    updatedAt:        new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    }),
  });
}

// ── GPS tracking ─────────────────────────────────────────────────────────────

/** Call immediately after a successful driver check-in. Starts background GPS. */
export async function startCheckedInTracking(options: TrackingOptions) {
  if (!liveWidgetAvailable()) return;
  await NativeLiveWidget.requestPermissions({
    permissions: ['location', 'backgroundLocation', 'notifications'],
  });
  await NativeLiveWidget.startTracking({
    ...options,
    intervalMs: options.intervalMs ?? 30_000,
  });
}

/** Call on check-out, delivered, suspended session, or explicit stop. */
export async function stopCheckedInTracking() {
  if (!liveWidgetAvailable()) return;
  await NativeLiveWidget.stopTracking();
}

/** Returns the current GPS tracking state from SharedPreferences. */
export async function getCheckedInTrackingState(): Promise<TrackingState | null> {
  if (!liveWidgetAvailable()) return null;
  return NativeLiveWidget.getTrackingState();
}
