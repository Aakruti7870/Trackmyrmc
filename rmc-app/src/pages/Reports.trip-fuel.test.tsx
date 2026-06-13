import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), put: vi.fn(), post: vi.fn() } };
});

import Reports from '@/pages/Reports';
import { api, type FuelReconResponse, type VehicleAlert } from '@/lib/api';

interface TripTimingRow { date: string; tripsWithTravel: number; tripsWithSite: number; avgTravelMin: number; avgSiteMin: number; totalBillableIdleMin: number; idleTrips: number; totalIdleCharge: number }
interface TripTimingResponse { freeMin: number; ratePerHour: number | null; rows: TripTimingRow[] }

// Route the mock by report path so each test supplies only the trip-timing /
// fuel payloads it needs; every other endpoint falls back to empty.
function mockReports(opts: {
  tripTiming?: TripTimingResponse;
  fuel?: FuelReconResponse;
  alerts?: VehicleAlert[];
} = {}) {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path.startsWith('/reports/variance-tolerance')) return Promise.resolve({ abs: 0.1, pct: 0 } as never);
    if (path.startsWith('/reports/trip-timing')) return Promise.resolve((opts.tripTiming ?? { freeMin: 45, ratePerHour: null, rows: [] }) as never);
    if (path.startsWith('/reports/fuel-reconciliation')) return Promise.resolve((opts.fuel ?? { config: { reconVariancePct: 10, idleBurnLph: 2, unscheduledStopMin: 5, routeDeviationM: 300, plantLat: null, plantLng: null }, rows: [] }) as never);
    if (path.startsWith('/positions/alerts')) return Promise.resolve((opts.alerts ?? []) as never);
    return Promise.resolve([] as never);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Reports Trip Timing tab', () => {
  it('shows summary cards and the timing table when rows are present', async () => {
    mockReports({
      tripTiming: {
        freeMin: 45,
        ratePerHour: 200,
        rows: [
          { date: '2026-06-10', tripsWithTravel: 4, tripsWithSite: 4, avgTravelMin: 30, avgSiteMin: 60, totalBillableIdleMin: 90, idleTrips: 2, totalIdleCharge: 150 },
        ],
      },
    });
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    await user.click(screen.getByText('Trip Timing'));

    expect(await screen.findByText('Trip Timing & Idle Charges')).toBeInTheDocument();
    // Summary tiles
    expect(screen.getByText('AVG TRAVEL')).toBeInTheDocument();
    expect(screen.getByText('BILLABLE IDLE')).toBeInTheDocument();
    // The IDLE CHARGES tile only appears because ratePerHour is set.
    expect(screen.getByText('IDLE CHARGES')).toBeInTheDocument();
    // The populated table row.
    const table = screen.getByRole('table');
    expect(within(table).getByText('Idle Charge')).toBeInTheDocument();
    expect(within(table).getByText('2 / 4')).toBeInTheDocument();
    // Weighted-average travel (30m) surfaces in the AVG TRAVEL tile.
    expect(screen.getAllByText('30m').length).toBeGreaterThan(0);
    expect(screen.queryByText('No trip-timing data for this period')).not.toBeInTheDocument();
  });

  it('omits the idle-charge column when no rate is configured', async () => {
    mockReports({
      tripTiming: {
        freeMin: 45,
        ratePerHour: null,
        rows: [
          { date: '2026-06-10', tripsWithTravel: 2, tripsWithSite: 2, avgTravelMin: 20, avgSiteMin: 40, totalBillableIdleMin: 0, idleTrips: 0, totalIdleCharge: 0 },
        ],
      },
    });
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    await user.click(screen.getByText('Trip Timing'));

    expect(await screen.findByText('Trip Timing & Idle Charges')).toBeInTheDocument();
    expect(screen.queryByText('IDLE CHARGES')).not.toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).queryByText('Idle Charge')).not.toBeInTheDocument();
  });

  it('shows the empty state when no trip-timing rows are returned', async () => {
    mockReports();
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    await user.click(screen.getByText('Trip Timing'));

    expect(await screen.findByText('Trip Timing & Idle Charges')).toBeInTheDocument();
    expect(screen.getByText('No trip-timing data for this period')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('Reports Fuel tab', () => {
  it('shows open alerts and the reconciliation table when data is present', async () => {
    mockReports({
      alerts: [
        {
          id: 1, type: 'unscheduled_stop', challanId: null, vehicleId: 7, driverId: 3,
          lat: null, lng: null, distanceM: 250, detail: 'Stopped 12 min off-route',
          acknowledgedAt: null, createdAt: '2026-06-10T08:30:00.000Z',
          vehicleNo: 'MH12AB1234', driverName: 'Ramesh',
        },
      ],
      fuel: {
        config: { reconVariancePct: 10, idleBurnLph: 2, unscheduledStopMin: 5, routeDeviationM: 300, plantLat: null, plantLng: null },
        rows: [
          {
            vehicleId: 7, vehicleNo: 'MH12AB1234', km: 120, idleHours: 1.5, trips: 3, tripsWithOdometer: 3,
            mileageKmpl: 4, idleBurnLph: 2, expectedDrivingLitres: 30, expectedIdleLitres: 3,
            expectedLitres: 33, actualLitres: 40, amount: 4000, fills: 2, variancePct: 21.2, flagged: true,
          },
        ],
      },
    });
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    await user.click(screen.getByText('Fuel'));

    expect(await screen.findByText('Fuel Reconciliation & Theft Alerts')).toBeInTheDocument();
    // Open-alerts section with a count and the alert detail.
    expect(screen.getByText('(1)')).toBeInTheDocument();
    expect(screen.getByText('Unscheduled stop')).toBeInTheDocument();
    expect(screen.getByText('Stopped 12 min off-route', { exact: false })).toBeInTheDocument();
    // Reconciliation section and its flagged row.
    expect(screen.getByText('Per-vehicle Reconciliation')).toBeInTheDocument();
    expect(screen.getByText('variance threshold 10%')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('MH12AB1234')).toBeInTheDocument();
    expect(within(table).getByText('+21.2%')).toBeInTheDocument();
    expect(screen.queryByText('No fuel data for this period. Log diesel fills and set vehicle mileage to enable reconciliation.')).not.toBeInTheDocument();
  });

  it('shows both empty states when there are no alerts and no fuel rows', async () => {
    mockReports();
    const user = userEvent.setup();
    render(<Reports />);

    await waitFor(() => expect(screen.getByText('Client-wise Dispatch')).toBeInTheDocument());
    await user.click(screen.getByText('Fuel'));

    expect(await screen.findByText('Fuel Reconciliation & Theft Alerts')).toBeInTheDocument();
    expect(screen.getByText('No open alerts. Unscheduled stops & route deviations show up here.')).toBeInTheDocument();
    expect(screen.getByText('No fuel data for this period. Log diesel fills and set vehicle mileage to enable reconciliation.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
