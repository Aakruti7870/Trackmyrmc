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
} from '@/lib/liveWidget';

type AttendanceStatus = { checkedIn: boolean };

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

function activeChallan(rows: Challan[]): Challan | undefined {
  return rows.find(c => !CLOSED.has(c.status)) ?? rows[0];
}

function activeOrder(rows: Order[]): Order | undefined {
  return rows.find(o => !CLOSED.has(o.status)) ?? rows[0];
}

/**
 * Native-only runtime bridge. It is intentionally mounted once for every signed-in
 * session so widget/GPS state stays correct even when the user changes pages or
 * locks the phone.
 */
export default function NativeRuntimeSync() {
  const { user } = useAuth();
  const gpsStarted = useRef(false);

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
            actorId: user.id,
            role: user.role,
          });
          gpsStarted.current = true;
        } else if (!status.checkedIn && gpsStarted.current) {
          await stopCheckedInTracking();
          gpsStarted.current = false;
        }
      } catch {
        // Some customer-only roles cannot use attendance. Widget sync still works.
      }
    }

    async function syncDriver() {
      const rows = await api.get<Challan[]>('/me/trips');
      if (cancelled) return;
      const trip = activeChallan(rows);
      if (!trip) {
        await updateLiveWidget({
          role: 'driver', title: 'Driver Duty', status: 'No active trip',
          primary: 'Checked in and ready', secondary: 'Waiting for dispatch',
          actionLabel: 'Open Trips', actionPath: '/my-trips', gpsActive: gpsStarted.current,
        });
        return;
      }
      await driverOrderWidget({
        orderId: trip.orderId ?? trip.id,
        customerName: trip.clientName || trip.contactPerson || 'Customer',
        grade: trip.grade,
        quantity: trip.quantity,
        destination: trip.siteAddress || trip.siteName || 'Delivery site',
        status: trip.tripStatus || trip.status,
        latitude: trip.siteLat == null ? undefined : Number(trip.siteLat),
        longitude: trip.siteLng == null ? undefined : Number(trip.siteLng),
      });
    }

    async function syncCustomer() {
      const orders = await api.get<Order[]>('/me/orders');
      if (cancelled) return;
      const order = activeOrder(orders);
      if (!order) {
        await updateLiveWidget({
          role: 'customer', title: 'My Concrete Order', status: 'No active order',
          primary: 'Place an order from TrackMyRMC', secondary: 'Updates will appear here',
          actionLabel: 'Open Orders', actionPath: '/my-orders', gpsActive: false,
        });
        return;
      }

      let challan: Challan | undefined;
      try {
        const challans = await api.get<Challan[]>('/me/challans');
        challan = challans.find(c => c.orderId === order.id) ?? activeChallan(challans);
      } catch {
        // Challan may not exist until dispatch.
      }

      await customerOrderWidget({
        orderId: order.id,
        grade: order.grade,
        quantity: order.quantity,
        status: challan?.tripStatus || challan?.status || order.status,
        challanNumber: challan?.challanNo,
        truckNumber: challan?.vehicleNo,
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
        todayProduction: num(kpis.todayProduction),
        tmOnRoute: onRoute,
        activeOrders: num(kpis.activeOrders),
      });
    }

    async function syncAll() {
      if (!user) return;
      await syncAttendance();
      try {
        if (DRIVER_ROLES.has(user.role)) await syncDriver();
        else if (CUSTOMER_ROLES.has(user.role)) await syncCustomer();
        else if (STAFF_ROLES.has(user.role)) await syncStaff();
      } catch {
        // Native widget is an enhancement; an API/network problem must never block app use.
      }
    }

    if (user) {
      void syncAll();
      timer = setInterval(() => { void syncAll(); }, 30_000);
    } else {
      void stopCheckedInTracking();
      gpsStarted.current = false;
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [user]);

  return null;
}
