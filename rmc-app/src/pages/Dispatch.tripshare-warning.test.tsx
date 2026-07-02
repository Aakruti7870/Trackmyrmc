import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), put: vi.fn(), post: vi.fn() } };
});

vi.mock('@/lib/useSSE', () => ({
  useSSE: () => ({
    status: 'connected' as const,
    reconnect: () => {},
    subscribe: () => () => {},
  }),
}));

import Dispatch from '@/pages/Dispatch';
import { ToastProvider } from '@/lib/toast-provider';
import { api } from '@/lib/api';

// Route the reference-data loads the page makes on mount; the challan list and
// order/vehicle/driver lists can stay empty — only clients matter here.
function mockApi() {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/clients') {
      return Promise.resolve([{ id: 5, name: 'No-Email Builders' }] as never);
    }
    if (path === '/clients/5/sites') return Promise.resolve([] as never);
    return Promise.resolve([] as never);
  });
}

// Fills the Create Challan modal with the minimum valid form and submits it.
async function dispatchChallan(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /create challan/i }));

  const selects = screen.getAllByRole('combobox');
  const clientSelect = selects.find(s => s.querySelector('option')?.textContent === 'Select client…');
  const gradeSelect = selects.find(s => s.querySelector('option')?.textContent === 'Select…');
  if (!clientSelect || !gradeSelect) throw new Error('modal selects not found');

  await user.selectOptions(clientSelect, '5');
  await user.selectOptions(gradeSelect, 'M25');
  await user.type(screen.getByRole('spinbutton'), '10');
  await user.click(screen.getByRole('button', { name: /dispatch challan/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi();
});

describe('Dispatch — trip-share unreachable-customer warning', () => {
  it('shows a warning toast when the server flags the customer as unreachable', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 1, challanNo: 'CH-001', tripShareWarning: 'no_email' } as never);
    const user = userEvent.setup();
    render(<ToastProvider><Dispatch /></ToastProvider>);

    await dispatchChallan(user);

    await waitFor(() =>
      expect(screen.getByText(/tracking link not sent/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/no email/i)).toBeInTheDocument();
  });

  it('shows no toast when the dispatch response carries no warning', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 1, challanNo: 'CH-001' } as never);
    const user = userEvent.setup();
    render(<ToastProvider><Dispatch /></ToastProvider>);

    await dispatchChallan(user);

    // The modal closes on success; no warning toast appears.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /dispatch challan/i })).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/tracking link not sent/i)).not.toBeInTheDocument();
  });
});
