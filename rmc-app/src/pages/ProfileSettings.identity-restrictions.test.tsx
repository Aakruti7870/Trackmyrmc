import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

import ProfileSettings from '@/pages/ProfileSettings';
import { api } from '@/lib/api';
import { AuthContext, type AuthCtx } from '@/lib/auth';
import { ToastProvider } from '@/lib/toast-provider';
import { ThemeProvider } from '@/lib/theme-providers';
import type { User } from '@/lib/api';

const CLIENT: User = { id: 7, name: 'Rakesh Customer', email: 'rakesh@buildco.com', role: 'client' } as User;
const DRIVER: User = { id: 9, name: 'Suresh Driver', email: 'suresh@fleet.com', role: 'driver' } as User;
const ADMIN: User = { id: 1, name: 'Priya Admin', email: 'priya@aakruti.com', role: 'admin' } as User;

function renderPage(user: User) {
  const ctx: AuthCtx = { user, loading: false, login: async () => ({} as User), logout: () => {}, updateUser: () => {} };
  return render(
    <AuthContext.Provider value={ctx}>
      <ThemeProvider>
        <ToastProvider>
          <ProfileSettings />
        </ToastProvider>
      </ThemeProvider>
    </AuthContext.Provider>,
  );
}

function mockGets(overrides: Record<string, unknown>) {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path in overrides) return overrides[path] as never;
    return [] as never;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProfileSettings — customer/driver identity restrictions', () => {
  it('hides the Role row and role badge for a Customer', async () => {
    mockGets({ '/kyc/status': { configured: true, status: 'unverified', verifiedAt: null, maskedAadhaar: null, fullName: null } });
    renderPage(CLIENT);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/kyc/status'));
    expect(screen.queryByText('Role')).not.toBeInTheDocument();
    expect(screen.queryByText('Client')).not.toBeInTheDocument();
  });

  it('hides the Role row and role badge for a Driver', async () => {
    mockGets({ '/kyc-verification/me': { profile: null, documents: [] } });
    renderPage(DRIVER);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/kyc-verification/me'));
    expect(screen.queryByText('Role')).not.toBeInTheDocument();
    expect(screen.queryByText('Driver')).not.toBeInTheDocument();
  });

  it('keeps the Role row visible for staff/admin roles', async () => {
    mockGets({});
    renderPage(ADMIN);

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(await screen.findByText('Role')).toBeInTheDocument();
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
  });

  it('renders the customer legal name read-only with an explanation once backend-verified', async () => {
    mockGets({
      '/kyc/status': {
        configured: true, status: 'verified', verifiedAt: '2026-06-01T00:00:00.000Z',
        maskedAadhaar: 'XXXX-XXXX-1234', fullName: 'Rakesh Kumar Sharma',
      },
    });
    renderPage(CLIENT);

    const nameInput = await screen.findByDisplayValue('Rakesh Kumar Sharma');
    expect(nameInput).toBeDisabled();
    expect(screen.getByText(/verified identity details can only be changed through identity re-verification/i)).toBeInTheDocument();
    // A verified badge appears (backend-driven), replacing the role badge.
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('does not show a verified badge or lock the name field for an unverified customer', async () => {
    mockGets({ '/kyc/status': { configured: true, status: 'pending', verifiedAt: null, maskedAadhaar: null, fullName: null } });
    renderPage(CLIENT);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/kyc/status'));
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    const nameInput = await screen.findByDisplayValue('Rakesh Customer');
    expect(nameInput).not.toBeDisabled();
  });
});
