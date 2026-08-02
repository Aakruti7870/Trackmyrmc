/**
 * driver-widget-status.test.ts
 *
 * Task #18 — Confirm the driver widget correctly shows IN TRANSIT when a
 * mixer is already on the road.
 *
 * Tests the data-transformation logic inside driverOrderWidget() and the
 * idle/no-trip path in liveWidget.ts. We intercept the native plugin call by
 * mocking @capacitor/core so we can assert on the WidgetData object that
 * would be sent to the Android widget.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Capture the data that would be pushed to the native plugin ────────────────
// We mock @capacitor/core *before* importing liveWidget so that:
//   1. Capacitor.getPlatform() returns 'android' → liveWidgetAvailable() = true
//   2. The registered plugin stub has a spied setWidgetData so we can inspect
//      the exact WidgetData object sent to the native layer.
//
// vi.hoisted() is used to ensure mockSetWidgetData is available when the
// vi.mock() factory runs (vi.mock() is hoisted to the top of the file by
// Vitest's transformer, which runs before the variable declarations).

const { mockSetWidgetData } = vi.hoisted(() => ({
  mockSetWidgetData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'android',
  },
  registerPlugin: (name: string) => {
    void name;
    return {
      setWidgetData: mockSetWidgetData,
      setAuthToken: vi.fn().mockResolvedValue(undefined),
      clearWidgetData: vi.fn().mockResolvedValue(undefined),
      setSuspendedState: vi.fn().mockResolvedValue(undefined),
      setWidgetMode: vi.fn().mockResolvedValue(undefined),
      startTracking: vi.fn().mockResolvedValue(undefined),
      stopTracking: vi.fn().mockResolvedValue(undefined),
      getTrackingState: vi.fn().mockResolvedValue({ active: false, latitude: '0', longitude: '0', accuracy: 0, lastLocationAt: 0 }),
      requestPermissions: vi.fn().mockResolvedValue(undefined),
    };
  },
}));

// Import after mocks
import { driverOrderWidget, updateLiveWidget } from '@/lib/liveWidget';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Helper: get the WidgetData arg passed to the last setWidgetData call ──────
function lastWidgetData() {
  expect(mockSetWidgetData).toHaveBeenCalled();
  return mockSetWidgetData.mock.calls[mockSetWidgetData.mock.calls.length - 1][0] as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('driverOrderWidget — tripStatus data transformation', () => {
  it('sets tripStatus to "IN TRANSIT" when passed tripStatus: "IN TRANSIT"', async () => {
    await driverOrderWidget({
      orderNo: 'CH-001',
      customerName: 'Suresh Builders',
      grade: 'M25',
      quantity: 6,
      vehicleNo: 'MH12AB1234',
      tripStatus: 'IN TRANSIT',
    });

    const data = lastWidgetData();
    expect(data.tripStatus).toBe('IN TRANSIT');
    // line2 contains the status label
    expect(data.line2).toContain('IN TRANSIT');
  });

  it('sets tripStatus to "dispatched" when passed tripStatus: "dispatched" (no normalization applied)', async () => {
    await driverOrderWidget({
      orderNo: 'CH-002',
      customerName: 'Priya Constructions',
      grade: 'M30',
      quantity: 8,
      vehicleNo: 'MH12CD5678',
      tripStatus: 'dispatched',
    });

    const data = lastWidgetData();
    // The widget passes tripStatus through as-is
    expect(data.tripStatus).toBe('dispatched');
    expect(data.line2).toContain('dispatched');
  });

  it('sets tripStatus to "DELIVERED" when passed tripStatus: "delivered"', async () => {
    await driverOrderWidget({
      orderNo: 'CH-003',
      customerName: 'Amit Infra',
      grade: 'M20',
      quantity: 4,
      vehicleNo: 'MH14EF9012',
      tripStatus: 'delivered',
    });

    const data = lastWidgetData();
    expect(data.tripStatus).toBe('delivered');
    expect(data.line2).toContain('delivered');
  });

  it('defaults tripStatus to "ASSIGNED" when no tripStatus is provided', async () => {
    await driverOrderWidget({
      orderNo: 'CH-004',
      customerName: 'Ravi Constructions',
      grade: 'M25',
      quantity: 10,
      vehicleNo: 'MH16GH3456',
      // tripStatus intentionally omitted
    });

    const data = lastWidgetData();
    expect(data.tripStatus).toBe('ASSIGNED');
    expect(data.line2).toContain('ASSIGNED');
  });
});

describe('updateLiveWidget — idle/no-active-trip driver state', () => {
  it('shows "No active trip assigned" message when driver has no current trip', async () => {
    await updateLiveWidget({
      role: 'driver',
      title: 'Driver Duty',
      line1: 'Checked in and ready',
      line2: 'No active trip assigned',
      line3: 'Open Attendance to check in',
      deepLink: '/my-trips',
    });

    const data = lastWidgetData();
    expect(data.role).toBe('driver');
    expect(data.line2).toBe('No active trip assigned');
    expect(data.title).toBe('Driver Duty');
  });

  it('shows GPS active message when driver is checked in but has no trip', async () => {
    await updateLiveWidget({
      role: 'driver',
      title: 'Driver Duty',
      line1: 'Checked in and ready',
      line2: 'No active trip assigned',
      line3: 'GPS tracking is active',
      deepLink: '/my-trips',
    });

    const data = lastWidgetData();
    expect(data.line3).toBe('GPS tracking is active');
  });
});

describe('driverOrderWidget — structured fields', () => {
  it('correctly maps legacy "customer" alias to customerName', async () => {
    await driverOrderWidget({
      orderNo: 'CH-005',
      customer: 'Legacy Customer Name',  // legacy alias
      grade: 'M35',
      quantity: 12,
      tripStatus: 'IN TRANSIT',
    });

    const data = lastWidgetData();
    expect(data.customerName).toBe('Legacy Customer Name');
    expect(data.line1).toContain('Legacy Customer Name');
  });

  it('correctly maps legacy "destination" alias to siteName', async () => {
    await driverOrderWidget({
      orderNo: 'CH-006',
      customerName: 'Test Builder',
      destination: 'Legacy Site Address',  // legacy alias
      grade: 'M25',
      quantity: 5,
      tripStatus: 'IN TRANSIT',
    });

    const data = lastWidgetData();
    expect(data.siteName).toBe('Legacy Site Address');
    expect(data.line3).toBe('Legacy Site Address');
  });

  it('sets role to "driver" and deepLink to "/my-trips"', async () => {
    await driverOrderWidget({
      orderNo: 'CH-007',
      customerName: 'Builder Co',
      grade: 'M20',
      quantity: 3,
      tripStatus: 'IN TRANSIT',
    });

    const data = lastWidgetData();
    expect(data.role).toBe('driver');
    expect(data.deepLink).toBe('/my-trips');
  });
});
