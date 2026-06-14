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
import { api } from '@/lib/api';
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

// Default reads for every endpoint ProfileSettings loads on mount. The
// plant-invite-notify endpoint can be overridden per-test via `notify`.
function mockReads(notify: { emailEnabled: boolean; recipients: string[] } = { emailEnabled: true, recipients: [] }) {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/admin/plant-invite-notify') return notify as never;
    if (path === '/admin/smtp-settings') return { configured: false } as never;
    if (path === '/admin/variance-tolerance') return { abs: 0, pct: 0 } as never;
    if (path === '/admin/idle-settings') {
      return { freeMin: 0, ratePerHour: null, defaults: { freeMin: 0, ratePerHour: null } } as never;
    }
    // email-test/history, lockouts, fuel-settings, proof-photos/stuck, plants/mine, etc.
    return [] as never;
  });
}

function renderPage() {
  const ctx: AuthCtx = {
    user: ADMIN,
    loading: false,
    login: async () => {},
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

describe('ProfileSettings — New Plant-Request Notifications', () => {
  it('loads the current settings from /admin/plant-invite-notify', async () => {
    mockReads({ emailEnabled: true, recipients: ['ops@aakruti.com', 'dispatch@aakruti.com'] });

    renderPage();

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/admin/plant-invite-notify'),
    );

    const toggle = await screen.findByRole('checkbox', {
      name: /Send an email when a new plant is requested/i,
    });
    expect(toggle).toBeChecked();

    const recipients = await screen.findByLabelText(/Recipients/i);
    expect(recipients).toHaveValue('ops@aakruti.com, dispatch@aakruti.com');
    expect(recipients).toBeEnabled();
  });

  it('disables the recipients field when the email toggle is turned off', async () => {
    const user = userEvent.setup();
    mockReads({ emailEnabled: true, recipients: [] });

    renderPage();

    const toggle = await screen.findByRole('checkbox', {
      name: /Send an email when a new plant is requested/i,
    });
    expect(toggle).toBeChecked();

    await user.click(toggle);
    expect(toggle).not.toBeChecked();

    const recipients = screen.getByLabelText(/Recipients/i);
    expect(recipients).toBeDisabled();
  });

  it('blocks an invalid recipient email locally without posting', async () => {
    const user = userEvent.setup();
    mockReads({ emailEnabled: true, recipients: [] });

    renderPage();

    const recipients = await screen.findByLabelText(/Recipients/i);
    await user.type(recipients, 'not-an-email');

    await user.click(screen.getByRole('button', { name: /Save notifications/i }));

    expect(await screen.findByText(/Not a valid email: not-an-email/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('posts the toggle + recipients on save and shows the success toast', async () => {
    const user = userEvent.setup();
    mockReads({ emailEnabled: true, recipients: [] });
    vi.mocked(api.post).mockResolvedValue({
      emailEnabled: true,
      recipients: ['ops@aakruti.com', 'dispatch@aakruti.com'],
    } as never);

    renderPage();

    const recipients = await screen.findByLabelText(/Recipients/i);
    await user.type(recipients, 'ops@aakruti.com, dispatch@aakruti.com');

    await user.click(screen.getByRole('button', { name: /Save notifications/i }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/plant-invite-notify', {
        emailEnabled: true,
        recipients: 'ops@aakruti.com, dispatch@aakruti.com',
      }),
    );

    expect(await screen.findByText('Notification settings saved.')).toBeInTheDocument();
    // The form reflects the server's normalized recipients after save.
    expect(screen.getByLabelText(/Recipients/i)).toHaveValue('ops@aakruti.com, dispatch@aakruti.com');
  });

  it('posts emailEnabled=false when saving with the email turned off', async () => {
    const user = userEvent.setup();
    mockReads({ emailEnabled: true, recipients: [] });
    vi.mocked(api.post).mockResolvedValue({ emailEnabled: false, recipients: [] } as never);

    renderPage();

    const toggle = await screen.findByRole('checkbox', {
      name: /Send an email when a new plant is requested/i,
    });
    await user.click(toggle);

    await user.click(screen.getByRole('button', { name: /Save notifications/i }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/plant-invite-notify', {
        emailEnabled: false,
        recipients: '',
      }),
    );
  });
});
