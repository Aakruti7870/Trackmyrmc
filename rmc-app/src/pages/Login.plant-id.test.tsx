import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/clerk', () => ({
  clerkEnabled: false,
  CLERK_PUBLISHABLE_KEY: '',
  clerkSignOutIfEnabled: async () => {},
}));

const post = vi.fn();
vi.mock('@/lib/api', () => ({
  api: { post: (...args: unknown[]) => post(...args) },
}));

import { AuthContext, type AuthCtx } from '@/lib/auth';
import type { User } from '@/lib/api';
import Login from '@/pages/Login';

const ctx: AuthCtx = {
  user: null,
  loading: false,
  login: async () => ({} as User),
  logout: () => {},
  updateUser: () => {},
};

function renderLogin() {
  return render(
    <AuthContext.Provider value={ctx}>
      <Login />
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  post.mockReset();
});

describe('Login — portals and staff sign-in flow', () => {
  it('defaults to the customer phone entry and offers a staff email door', () => {
    renderLogin();
    // Phone-first, delivery-app style: customers land on the mobile-number entry.
    expect(screen.getByPlaceholderText(/98765 43210/i)).toBeInTheDocument();
    // Staff reach their email sign-in via an explicit door.
    expect(screen.getByRole('button', { name: /staff login with email/i })).toBeInTheDocument();
  });

  it('staff door is email-first and provisioned-only (no Plant ID, no sign-up)', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: /staff login with email/i }));

    expect(screen.getByPlaceholderText(/you@company\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/created by your administrator/i)).toBeInTheDocument();
    // The legacy optional Plant ID field is gone.
    expect(screen.queryByPlaceholderText(/RMC-001/i)).not.toBeInTheDocument();
  });

  it('an ordinary staff email advances to the one-time-code step', async () => {
    post.mockImplementation(async (url: string) => {
      if (url === '/auth/staff/login-method') return { method: 'otp' };
      if (url === '/auth/staff/otp/send') return { ok: true };
      throw new Error(`unexpected ${url}`);
    });
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /staff login with email/i }));
    await user.type(screen.getByPlaceholderText(/you@company\.com/i), 'disp@plant.com');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByText(/login code/i)).toBeInTheDocument());
    expect(post).toHaveBeenCalledWith('/auth/staff/login-method', { email: 'disp@plant.com' });
    expect(post).toHaveBeenCalledWith('/auth/staff/otp/send', { email: 'disp@plant.com' });
    // The shared single-box code input is shown.
    expect(screen.getByRole('textbox', { name: /one-time code/i })).toBeInTheDocument();
  });

  it('a recognized Super Admin email reveals the password field', async () => {
    post.mockImplementation(async (url: string) => {
      if (url === '/auth/staff/login-method') return { method: 'password' };
      throw new Error(`unexpected ${url}`);
    });
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /staff login with email/i }));
    await user.type(screen.getByPlaceholderText(/you@company\.com/i), 'krushnabade54@gmail.com');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument());
    // No code was sent — the password is the first factor.
    expect(post).not.toHaveBeenCalledWith('/auth/staff/otp/send', expect.anything());
  });
});
