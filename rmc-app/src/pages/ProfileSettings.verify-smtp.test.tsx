import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the api module but keep the real ApiError class so the component's
// error-message surfacing behaves exactly as in production.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

import ProfileSettings from '@/pages/ProfileSettings';
import { api, ApiError } from '@/lib/api';
import { AuthContext, type AuthCtx } from '@/lib/auth';
import { ToastProvider } from '@/lib/toast-provider';
import { ThemeProvider } from '@/lib/theme-providers';
import type { User } from '@/lib/api';

const ADMIN: User = {
  id: 1,
  name: 'Priya Admin',
  email: 'priya@aakruti.com',
  role: 'admin',
} as User;

const SMTP_SETTINGS = {
  host: 'smtp.example.com',
  port: '587',
  user: 'ma•••@example.com',
  from: 'no•••@example.com',
  configured: true,
};

function mockReads() {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/admin/smtp-settings') return SMTP_SETTINGS as never;
    if (path === '/admin/email-test/history') return [] as never;
    if (path === '/admin/lockouts') return [] as never;
    return [] as never;
  });
}

function renderPage() {
  const ctx: AuthCtx = {
    user: ADMIN,
    loading: false,
    login: async () => ({} as User),
    logout: () => {},
    updateUser: () => {},
  };
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProfileSettings — Test connection (verify SMTP)', () => {
  it('verifies the in-form values and shows the success banner + toast on ok', async () => {
    const user = userEvent.setup();
    mockReads();
    vi.mocked(api.post).mockResolvedValue({ ok: true } as never);

    renderPage();

    const button = await screen.findByRole('button', { name: /Test connection/i });
    await user.click(button);

    // It posts the in-form values to the verify endpoint.
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/smtp-settings/verify', expect.any(Object)),
    );

    // Success banner appears...
    expect(
      await screen.findByText(/Connection successful — these settings can reach the mail server\./i),
    ).toBeInTheDocument();
    // ...and a success toast.
    expect(await screen.findByText('SMTP connection verified.')).toBeInTheDocument();
  });

  it('shows the failure banner + toast carrying the server error message on failure', async () => {
    const user = userEvent.setup();
    mockReads();
    vi.mocked(api.post).mockRejectedValue(
      new ApiError('getaddrinfo ENOTFOUND smtp.bogus.example', 502, { ok: false }),
    );

    renderPage();

    const button = await screen.findByRole('button', { name: /Test connection/i });
    await user.click(button);

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/smtp-settings/verify', expect.any(Object)),
    );

    // The server's error message is surfaced in both the banner and the toast.
    const messages = await screen.findAllByText(/getaddrinfo ENOTFOUND smtp\.bogus\.example/i);
    expect(messages.length).toBeGreaterThanOrEqual(2);
  });

  it('renders "Connection test" for smtp_verify rows and "Test email" for smtp_test rows', async () => {
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === '/admin/smtp-settings') return SMTP_SETTINGS as never;
      if (path === '/admin/email-test/history') {
        return [
          {
            id: 2, action: 'smtp_verify', status: 'failure',
            detail: 'getaddrinfo ENOTFOUND smtp.bogus.example',
            actorId: 1, actorName: 'Priya Admin', targetUserEmail: null,
            emailSent: null, createdAt: '2026-01-01T11:00:00Z',
          },
          {
            id: 1, action: 'smtp_test', status: 'success',
            detail: 'Test email sent', actorId: 1, actorName: 'Priya Admin',
            targetUserEmail: 'priya@aakruti.com', emailSent: true,
            createdAt: '2026-01-01T10:00:00Z',
          },
        ] as never;
      }
      if (path === '/admin/lockouts') return [] as never;
      return [] as never;
    });

    renderPage();

    // Both kind labels render, distinguishing connection tests from test emails.
    expect(await screen.findByText('Connection test')).toBeInTheDocument();
    expect(await screen.findByText('Test email')).toBeInTheDocument();
  });

  it('blocks an invalid port locally without calling the verify endpoint', async () => {
    const user = userEvent.setup();
    mockReads();
    vi.mocked(api.post).mockResolvedValue({ ok: true } as never);

    renderPage();

    // Type a non-numeric port into the Port field.
    const portInput = await screen.findByPlaceholderText('587');
    await user.clear(portInput);
    await user.type(portInput, 'abc');

    await user.click(screen.getByRole('button', { name: /Test connection/i }));

    expect(await screen.findByText('Port must be a number.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
