import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { AuthContext, type AuthCtx } from '@/lib/auth';
import type { User } from '@/lib/api';
import Register from '@/pages/Register';

const ctx: AuthCtx = {
  user: null,
  loading: false,
  login: async () => ({} as User),
  logout: () => {},
  updateUser: () => {},
};

function renderRegister() {
  return render(
    <AuthContext.Provider value={ctx}>
      <Register />
    </AuthContext.Provider>,
  );
}

describe('Register privacy consent', () => {
  it('disables Create Account until the consent box is checked', async () => {
    const user = userEvent.setup();
    renderRegister();

    const submit = screen.getByRole('button', { name: /create account/i });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /terms of service and privacy policy/i }));
    expect(submit).toBeEnabled();

    // Unchecking disables it again.
    await user.click(screen.getByRole('checkbox', { name: /terms of service and privacy policy/i }));
    expect(submit).toBeDisabled();
  });

  it('links to the Terms and Privacy pages', () => {
    renderRegister();
    expect(screen.getAllByRole('button', { name: 'Terms of Service' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Privacy Policy' }).length).toBeGreaterThan(0);
  });
});
