import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import Landing from '@/pages/Landing';

function renderAt(path = '/') {
  const { hook } = memoryLocation({ path, record: true });
  render(
    <Router hook={hook}>
      <Landing />
    </Router>,
  );
}

describe('Landing home page', () => {
  beforeEach(() => {
    // Mark the splash as already seen so we land directly on Screen 2.
    sessionStorage.setItem('trackmyrmc.splash.v1.seen', '1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('renders the brand name and tagline', () => {
    renderAt();
    expect(screen.getByText(/trackmy/i)).toBeInTheDocument();
    expect(screen.getByText(/moving concrete/i)).toBeInTheDocument();
  });

  it('shows the login headline copy', () => {
    renderAt();
    expect(screen.getByText(/ready mix concrete/i)).toBeInTheDocument();
    expect(screen.getByText(/on time, every time/i)).toBeInTheDocument();
  });

  it('shows the three role tabs', () => {
    renderAt();
    expect(screen.getByRole('button', { name: /^customer$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^staff$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^partner$/i })).toBeInTheDocument();
  });

  it('renders the phone OTP entry form by default (Customer tab)', () => {
    renderAt();
    expect(screen.getByPlaceholderText(/98765/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get otp/i })).toBeInTheDocument();
  });

  it('routes to /login on valid 10-digit phone submit', async () => {
    const user = userEvent.setup();
    const pushSpy = vi.spyOn(window.history, 'pushState');
    renderAt();

    await user.type(screen.getByPlaceholderText(/98765/), '9876543210');
    await user.click(screen.getByRole('button', { name: /get otp/i }));
    expect(pushSpy).toHaveBeenCalledWith({}, '', expect.stringContaining('/login'));
  });

  it('routes to /login?staff=1 from the Staff tab', async () => {
    const user = userEvent.setup();
    const pushSpy = vi.spyOn(window.history, 'pushState');
    renderAt();

    await user.click(screen.getByRole('button', { name: /^staff$/i }));
    await user.click(screen.getByRole('button', { name: /staff login with email/i }));
    expect(pushSpy).toHaveBeenCalledWith({}, '', '/login?staff=1');
  });
});
