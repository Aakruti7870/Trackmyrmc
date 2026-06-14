import { render, screen, waitFor, within } from '@testing-library/react';
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

type InviteNotify = { emailEnabled: boolean; roles: string[]; recipients: string[] };

function mockReads(invite: InviteNotify) {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/admin/plant-invite-notify') return invite as never;
    if (path === '/admin/smtp-settings') return { configured: false } as never;
    // Everything else (email-test history, lockouts, variance, idle, fuel, …)
    // is non-fatal — return empty/neutral shapes so their loaders settle.
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

// Scope queries to the "New Plant-Request Notifications" card so role
// checkboxes don't collide with checkboxes in other settings cards.
async function findInviteCard(): Promise<HTMLElement> {
  const heading = await screen.findByText('New Plant-Request Notifications');
  // heading div → title/subtitle wrapper → header row → card root (holds the form too).
  const card = heading.parentElement?.parentElement?.parentElement as HTMLElement;
  return card;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProfileSettings — New Plant-Request Notifications', () => {
  it('loads the saved roles and extra recipients from the API', async () => {
    mockReads({ emailEnabled: true, roles: ['admin', 'dispatcher'], recipients: ['ops@yourco.com'] });

    renderPage();

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/admin/plant-invite-notify'),
    );

    const card = await findInviteCard();

    // The two saved roles are checked; the unsaved ones are not.
    expect(within(card).getByRole('checkbox', { name: 'Admin' })).toBeChecked();
    expect(within(card).getByRole('checkbox', { name: 'Dispatcher' })).toBeChecked();
    expect(within(card).getByRole('checkbox', { name: 'Authority' })).not.toBeChecked();
    expect(within(card).getByRole('checkbox', { name: 'Plant Operator' })).not.toBeChecked();

    // Extra recipients are joined into the textarea.
    expect(within(card).getByLabelText(/Extra recipients/i)).toHaveValue('ops@yourco.com');
  });

  it('toggles a role and posts the chosen roles + recipients, then reflects the saved state', async () => {
    const user = userEvent.setup();
    mockReads({ emailEnabled: true, roles: ['admin'], recipients: [] });
    vi.mocked(api.post).mockResolvedValue({
      emailEnabled: true,
      roles: ['admin', 'authority'],
      recipients: ['ops@yourco.com'],
    } as never);

    renderPage();

    const card = await findInviteCard();
    await waitFor(() =>
      expect(within(card).getByRole('checkbox', { name: 'Admin' })).toBeChecked(),
    );

    // Add the Authority role and an extra recipient.
    await user.click(within(card).getByRole('checkbox', { name: 'Authority' }));
    await user.type(within(card).getByLabelText(/Extra recipients/i), 'ops@yourco.com');

    await user.click(within(card).getByRole('button', { name: /Save notifications/i }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/plant-invite-notify', {
        emailEnabled: true,
        roles: ['admin', 'authority'],
        recipients: 'ops@yourco.com',
      }),
    );

    // Server response is echoed back into the form + a success toast shows.
    expect(await screen.findByText('Notification settings saved.')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(card).getByLabelText(/Extra recipients/i)).toHaveValue('ops@yourco.com'),
    );
  });

  it('blocks an invalid extra recipient without calling the API', async () => {
    const user = userEvent.setup();
    mockReads({ emailEnabled: true, roles: ['admin'], recipients: [] });

    renderPage();

    const card = await findInviteCard();
    await waitFor(() =>
      expect(within(card).getByRole('checkbox', { name: 'Admin' })).toBeChecked(),
    );

    await user.type(within(card).getByLabelText(/Extra recipients/i), 'not-an-email');
    await user.click(within(card).getByRole('button', { name: /Save notifications/i }));

    expect(await screen.findByText('Not a valid email: not-an-email')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('surfaces the server error and re-enables Save when the save fails', async () => {
    const user = userEvent.setup();
    mockReads({ emailEnabled: true, roles: ['admin'], recipients: [] });
    vi.mocked(api.post).mockRejectedValue(
      new ApiError('Recipients could not be saved', 500, {}),
    );

    renderPage();

    const card = await findInviteCard();
    await waitFor(() =>
      expect(within(card).getByRole('checkbox', { name: 'Admin' })).toBeChecked(),
    );

    await user.type(within(card).getByLabelText(/Extra recipients/i), 'ops@aakruti.com');
    await user.click(within(card).getByRole('button', { name: /Save notifications/i }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/plant-invite-notify', {
        emailEnabled: true,
        roles: ['admin'],
        recipients: 'ops@aakruti.com',
      }),
    );

    // The rejected error's message is shown as an error toast.
    expect(await screen.findByText('Recipients could not be saved')).toBeInTheDocument();

    // The form is not cleared by the failure.
    expect(within(card).getByLabelText(/Extra recipients/i)).toHaveValue('ops@aakruti.com');

    // The Save button leaves the "Saving…" state and is interactive again.
    expect(within(card).getByRole('button', { name: /Save notifications/i })).toBeEnabled();
  });
});
