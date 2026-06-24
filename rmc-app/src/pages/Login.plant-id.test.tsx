import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/clerk', () => ({
  clerkEnabled: false,
  CLERK_PUBLISHABLE_KEY: '',
  clerkSignOutIfEnabled: async () => {},
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

describe('Login Plant ID + role selector', () => {
  it('exposes Customer and Plant Staff sign-in tabs', () => {
    renderLogin();
    expect(screen.getByRole('tab', { name: /customer/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /plant staff/i })).toBeInTheDocument();
  });

  it('shows an optional Plant ID field on the Plant Staff tab', async () => {
    const user = userEvent.setup();
    renderLogin();

    // Default (Customer) tab has no Plant ID field.
    expect(screen.queryByPlaceholderText(/RMC-001/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /plant staff/i }));
    expect(screen.getByPlaceholderText(/RMC-001/i)).toBeInTheDocument();
  });
});
