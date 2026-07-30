import { useEffect, useRef } from 'react';
import { api, API_ORIGIN, type Challan, type DashboardKPIs, type Order } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  customerOrderWidget,
  driverOrderWidget,
  plantSummaryWidget,
  startCheckedInTracking,
  stopCheckedInTracking,
  updateLiveWidget,
  clearDriverWidget,
} from '@/lib/liveWidget';

type AttendanceStatus = { checkedIn: boolean };
type NativeRole = 'driver' | 'customer' | 'staff' | 'admin' | 'plant_owner' | 'authority';

const DRIVER_ROLES = new Set(['driver']);
const CUSTOMER_ROLES = new Set(['client', 'customer', 'user']);
const STAFF_ROLES = new Set([
  'authority', 'plant_owner', 'admin', 'supervisor', 'dispatcher',
  'plant_operator', 'fleet_manager', 'quality_engineer',
]);
const CLOSED = new Set(['delivered', 'completed', 'cancelled', 'rejected']);

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function nativeRole(role: string): NativeRole {
  if (role === 'driver') return 'driver';
  if (CUSTOMER_ROLES.has(role)) return 'customer';
  if (role === 'authority') return 'authority';
  if (role === 'plant_owner') return 'plant_owner';
  if (role === 'admin') return 'admin';
  return 'staff';
}

function activeChallan(rows: Challan[]): Challan | undefined {
  return rows.find(c => !CLOSED.has(c.status)) ?? rows[0];
}

function activeOrder(rows: Order[]): Order | undefined {
  return rows.find(o => !CLOSED.has(o.status)) ?? rows[0];
}

/**
 * Native-only runtime bridge. It is mounted once for every signed-in session so
 * widget and foreground-GPS state stay correct across page changes and lock/unlock.
 */
export default function NativeRuntimeSync() {
  const { user } = useAuth();
  const gpsStarted = useRef(false);
  // Track the last synced user ID to detect a device hand-off (Driver A → Driver B).
  const lastUserId = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function syncAttendance() {
      if (!user) return;
      try {
        const status = await api.get<AttendanceStatus>('/attendance/me');
        if (cancelled) return;
        if (status.checkedIn && !gpsStarted.current) {
          const token = localStorage.getItem('rmc_token') || '';
          await startCheckedInTracking({
            endpoint: `${API_ORIGIN}/api/attendance/location`,
            authToken: token,
            actorId: String(user.id),
            role: nativeRole(user.role),
          });
          gpsStarted.current = true;
        } else if (!status.checkedIn && gpsStarted.current) {
          await stopCheckedInTracking();
          gpsStarted.current = false;
        }
      } catch {
        // Customer-only roles may not use attendance. Widget sync still proceeds.
      }
    }

    async function syncDriver() {
      const rows = await api.get<Challan[]>('/me/trips');
      if (cancelled) return;
      const trip = activeChallan(rows);
      if (!trip) {
        await updateLiveWidget({
          role: 'driver',
          title: 'Driver Duty',
          line1: 'Checked in and ready',
          line2: 'No active trip assigned',
          line3: gpsStarted.current ? 'GPS tracking is active' : 'Open Attendance to check in',
          deepLink: '/my-trips',
        });
        return;
      }
      await driverOrderWidget({
        orderNo: trip.challanNo || String(trip.orderId ?? trip.id),
        customer: trip.clientName || trip.contactPerson || 'Customer',
        grade: trip.grade,
        quantity: trip.quantity,
        destination: trip.siteAddress || trip.siteName || 'Delivery site',
      });
    }

    async function syncCustomer() {
      const orders = await api.get<Order[]>('/me/orders');
      if (cancelled) return;
      const order = activeOrder(orders);
      if (!order) {
        await updateLiveWidget({
          role: 'customer',
          title: 'My Concrete Order',
          line1: 'No active order',
          line2: 'Place an order from TrackMyRMC',
          line3: 'Loading, dispatch and challan updates appear here',
          deepLink: '/my-orders',
        });
        return;
      }

      let challan: Challan | undefined;
      try {
        const challans = await api.get<Challan[]>('/me/challans');
        challan = challans.find(c => c.orderId === order.id) ?? activeChallan(challans);
      } catch {
        // A challan may not exist until dispatch, or the route may be unavailable.
      }

      await customerOrderWidget({
        orderNo: order.orderNo || String(order.id),
        grade: order.grade,
        quantity: order.quantity,
        status: challan?.tripStatus || challan?.status || order.status,
        challanNo: challan?.challanNo,
      });
    }

    async function syncStaff() {
      const [kpis, challans] = await Promise.all([
        api.get<DashboardKPIs>('/dashboard/kpis'),
        api.get<Challan[]>('/challans'),
      ]);
      if (cancelled) return;
      const onRoute = challans.filter(c => c.status === 'dispatched').length;
      await plantSummaryWidget({
        plantName: user?.plantId ? `Plant ${user.plantId}` : 'TrackMyRMC Plant',
        productionM3: num(kpis.todayProduction),
        tmOnRoute: onRoute,
        activeOrders: num(kpis.activeOrders),
      });
    }

    async function syncAll() {
      if (!user) return;

      // On a shared device, if a different user has logged in, clear the driver
      // widget before the first sync so the previous driver's trip is never shown.
      if (lastUserId.current !== null && lastUserId.current !== user.id) {
        try { await clearDriverWidget(); } catch { /* no-op on web */ }
      }
      lastUserId.current = user.id;

      await syncAttendance();
      try {
        if (DRIVER_ROLES.has(user.role)) await syncDriver();
        else if (CUSTOMER_ROLES.has(user.role)) await syncCustomer();
        else if (STAFF_ROLES.has(user.role)) await syncStaff();
      } catch {
        // The native widget is an enhancement; network problems must not block app use.
      }
    }

    if (user) {
      void syncAll();
      timer = setInterval(() => { void syncAll(); }, 30_000);
    } else {
      void stopCheckedInTracking();
      gpsStarted.current = false;
      lastUserId.current = null;
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [user]);

  return null;
}
