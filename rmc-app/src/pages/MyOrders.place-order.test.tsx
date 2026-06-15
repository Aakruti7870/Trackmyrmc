import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// The order modal has two <select> comboboxes (concrete grade + delivery site),
// so target the grade one by the "Select grade…" placeholder option it contains.
function gradeSelect(): HTMLElement {
  const el = screen.getAllByRole('combobox').find(
    c => within(c).queryByRole('option', { name: /select grade/i }),
  );
  if (!el) throw new Error('grade <select> not found');
  return el;
}

// The plant <select> is the one carrying the "Select a plant…" placeholder.
function plantSelect(): HTMLElement {
  const el = screen.getAllByRole('combobox').find(
    c => within(c).queryByRole('option', { name: /select a plant/i }),
  );
  if (!el) throw new Error('plant <select> not found');
  return el;
}

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn() } };
});

import MyOrders from '@/pages/MyOrders';
import { api, type Order } from '@/lib/api';

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: 1,
    orderNo: 'ORD-001',
    clientId: 5,
    grade: 'M25',
    quantity: '12.00',
    pumpRequired: false,
    status: 'pending',
    createdAt: '2026-06-10T06:00:00.000Z',
    ...over,
  } as Order;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((path: string) => {
    // Only the ledger/config endpoints return objects; every other endpoint
    // MyOrders loads (orders, challans, sites, recurring, positions/mine) is an
    // array, so default unhandled paths to [] or the page's `.filter`/`for…of`
    // loops throw.
    if (path === '/me/ledger') return Promise.resolve({ entries: [], outstanding: 0, creditLimit: 0 } as never);
    if (path === '/positions/freshness-config' || path === '/me/idle-config') return Promise.resolve({} as never);
    // A single available plant so the modal auto-selects it (the customer
    // doesn't have to pick the only option they can order from).
    if (path === '/plants/directory') return Promise.resolve([{ id: 3, plantCode: 'P3', name: 'Acme RMC', city: 'Pune' }] as never);
    return Promise.resolve([] as never);
  });
});

describe('MyOrders place order', () => {
  it('submits the form to /me/orders and shows the new order in the list', async () => {
    const created = makeOrder({ id: 99, orderNo: 'ORD-007', grade: 'M30', quantity: '8.00' });
    vi.mocked(api.post).mockResolvedValue(created as never);

    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /place order/i }));

    const dialog = await screen.findByRole('heading', { name: /place new order/i });
    expect(dialog).toBeInTheDocument();

    // The only available plant is pre-selected for the customer, and the modal
    // header names the plant the order is for.
    await waitFor(() => expect(plantSelect()).toHaveValue('3'));
    expect(screen.getByText(/from acme rmc/i)).toBeInTheDocument();

    await user.selectOptions(gradeSelect(), 'M30');
    await user.type(screen.getByPlaceholderText(/e\.g\. 10/i), '8');

    const submitBtns = screen.getAllByRole("button", { name: /place order/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/me/orders', expect.objectContaining({
        plantId: 3,
        grade: 'M30',
        quantity: '8',
      }));
    });

    expect(await screen.findByText('ORD-007')).toBeInTheDocument();
  });

  // Mock the directory with a single grade-limited plant so the modal
  // auto-selects it and the grade/quantity guidance has data to work with.
  function mockGradeLimitedPlant(grades: string[], orders: Order[] = []) {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/me/ledger') return Promise.resolve({ entries: [], outstanding: 0, creditLimit: 0 } as never);
      if (path === '/positions/freshness-config' || path === '/me/idle-config') return Promise.resolve({} as never);
      if (path === '/plants/directory') return Promise.resolve([{ id: 3, plantCode: 'P3', name: 'Acme RMC', city: 'Pune', grades }] as never);
      if (path === '/me/orders') return Promise.resolve(orders as never);
      return Promise.resolve([] as never);
    });
  }

  it('limits the grade dropdown to the plant’s offered grades and lists them', async () => {
    mockGradeLimitedPlant(['M20', 'M25', 'M30']);
    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /place order/i }));
    await screen.findByRole('heading', { name: /place new order/i });
    await waitFor(() => expect(plantSelect()).toHaveValue('3'));

    const grade = gradeSelect();
    expect(within(grade).getByRole('option', { name: 'M20' })).toBeInTheDocument();
    expect(within(grade).getByRole('option', { name: 'M30' })).toBeInTheDocument();
    // A grade the plant does NOT offer is absent from the dropdown.
    expect(within(grade).queryByRole('option', { name: 'M40' })).not.toBeInTheDocument();
    // The offered grades are also spelled out as a hint under the field.
    expect(screen.getByText(/offered here: m20, m25, m30/i)).toBeInTheDocument();
  });

  it('softly warns when a pre-filled grade isn’t on the plant’s menu', async () => {
    // Reordering a past M40 order pre-fills a grade this plant doesn't list.
    mockGradeLimitedPlant(['M20', 'M25'], [makeOrder({ id: 7, orderNo: 'ORD-007', grade: 'M40', quantity: '10.00', plantId: 3, plantName: 'Acme RMC' })]);
    const user = userEvent.setup();
    render(<MyOrders />);

    // The reorder button lives in the Orders tab; switch to it first.
    await user.click(await screen.findByRole('button', { name: /^orders \(/i }));
    await user.click(await screen.findByRole('button', { name: /reorder/i }));
    await screen.findByRole('heading', { name: /place new order/i });

    expect(await screen.findByText(/may not offer m40/i)).toBeInTheDocument();
    // The pre-filled grade is still selectable (the order isn't blocked).
    expect(gradeSelect()).toHaveValue('M40');
  });

  it('softly warns when the quantity is far above a typical single order', async () => {
    mockGradeLimitedPlant(['M20', 'M25', 'M30']);
    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /place order/i }));
    await screen.findByRole('heading', { name: /place new order/i });

    await user.type(screen.getByPlaceholderText(/e\.g\. 10/i), '300');
    expect(await screen.findByText(/over 150 m³ is a large pour/i)).toBeInTheDocument();
  });

  it('softly warns when the quantity is a small partial truckload', async () => {
    mockGradeLimitedPlant(['M20']);
    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /place order/i }));
    await screen.findByRole('heading', { name: /place new order/i });

    await user.type(screen.getByPlaceholderText(/e\.g\. 10/i), '1');
    expect(await screen.findByText(/below 3 m³ is a partial truckload/i)).toBeInTheDocument();
  });

  it('pre-selects the plant from the most recent order when several are available', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/me/ledger') return Promise.resolve({ entries: [], outstanding: 0, creditLimit: 0 } as never);
      if (path === '/positions/freshness-config' || path === '/me/idle-config') return Promise.resolve({} as never);
      if (path === '/plants/directory') return Promise.resolve([
        { id: 3, plantCode: 'P3', name: 'Acme RMC', city: 'Pune' },
        { id: 7, plantCode: 'P7', name: 'Bharat Mix', city: 'Mumbai' },
      ] as never);
      // Newest-first: the customer last ordered from plant 7.
      if (path === '/me/orders') return Promise.resolve([
        makeOrder({ id: 20, orderNo: 'ORD-020', plantId: 7, createdAt: '2026-06-12T06:00:00.000Z' }),
        makeOrder({ id: 10, orderNo: 'ORD-010', plantId: 3, createdAt: '2026-06-09T06:00:00.000Z' }),
      ] as never);
      return Promise.resolve([] as never);
    });

    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /place order/i }));
    await screen.findByRole('heading', { name: /place new order/i });

    await waitFor(() => expect(plantSelect()).toHaveValue('7'));
  });

  it('leaves the plant blank when the last-ordered plant is no longer available', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/me/ledger') return Promise.resolve({ entries: [], outstanding: 0, creditLimit: 0 } as never);
      if (path === '/positions/freshness-config' || path === '/me/idle-config') return Promise.resolve({} as never);
      if (path === '/plants/directory') return Promise.resolve([
        { id: 3, plantCode: 'P3', name: 'Acme RMC', city: 'Pune' },
        { id: 7, plantCode: 'P7', name: 'Bharat Mix', city: 'Mumbai' },
      ] as never);
      // Last order was at plant 99, which is no longer in the directory.
      if (path === '/me/orders') return Promise.resolve([
        makeOrder({ id: 20, orderNo: 'ORD-020', plantId: 99, createdAt: '2026-06-12T06:00:00.000Z' }),
      ] as never);
      return Promise.resolve([] as never);
    });

    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /place order/i }));
    await screen.findByRole('heading', { name: /place new order/i });

    expect(plantSelect()).toHaveValue('');
  });

  it('lets a marketplace handoff override the remembered default plant', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/me/ledger') return Promise.resolve({ entries: [], outstanding: 0, creditLimit: 0 } as never);
      if (path === '/positions/freshness-config' || path === '/me/idle-config') return Promise.resolve({} as never);
      if (path === '/plants/directory') return Promise.resolve([
        { id: 3, plantCode: 'P3', name: 'Acme RMC', city: 'Pune' },
        { id: 7, plantCode: 'P7', name: 'Bharat Mix', city: 'Mumbai' },
      ] as never);
      // Remembered default would be plant 3 (the last order)…
      if (path === '/me/orders') return Promise.resolve([
        makeOrder({ id: 20, orderNo: 'ORD-020', plantId: 3, createdAt: '2026-06-12T06:00:00.000Z' }),
      ] as never);
      return Promise.resolve([] as never);
    });
    // …but the customer arrived from the marketplace having tapped plant 7.
    sessionStorage.setItem('rmc_selected_plant', JSON.stringify({ id: 7, name: 'Bharat Mix' }));

    render(<MyOrders />);

    // The handoff opens the modal automatically and pre-selects plant 7.
    await screen.findByRole('heading', { name: /place new order/i });
    await waitFor(() => expect(plantSelect()).toHaveValue('7'));
  });

  it('blocks submission and shows an error when grade is missing', async () => {
    const user = userEvent.setup();
    render(<MyOrders />);

    await user.click(await screen.findByRole('button', { name: /place order/i }));
    await screen.findByRole('heading', { name: /place new order/i });

    await user.type(screen.getByPlaceholderText(/e\.g\. 10/i), '5');
    const submitBtns = screen.getAllByRole("button", { name: /place order/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    expect(await screen.findByText(/select a concrete grade/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
