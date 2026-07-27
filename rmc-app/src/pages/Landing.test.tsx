import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import Landing from '@/pages/Landing';
import { markOnboardingComplete } from '@/lib/onboarding';

function renderAt(path = '/') {
  const { hook } = memoryLocation({ path, record: true });
  render(
    <Router hook={hook}>
      <Landing />
    </Router>,
  );
}

describe('Landing home page', () => {
  // These tests exercise the returning-visitor view (the one-time feature
  // carousel already completed) — the carousel itself is covered separately
  // in FeatureCarousel.test.tsx.
  beforeEach(() => {
    markOnboardingComplete();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders the brand and the four feature cards', () => {
    renderAt();
    expect(screen.getAllByText(/concrete king/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/live tracking/i)).toBeInTheDocument();
    expect(screen.getByText(/easy to use/i)).toBeInTheDocument();
    expect(screen.getByText(/kyc verified users/i)).toBeInTheDocument();
    expect(screen.getByText(/verified plants/i)).toBeInTheDocument();
  });

  it('exposes a Login entry point in the top navigation', () => {
    renderAt();
    expect(screen.getAllByRole('button', { name: /^login$/i }).length).toBeGreaterThan(0);
  });

  it('shows a next-page navigation card into the login flow', () => {
    renderAt();
    expect(screen.getByText(/sign in to continue/i)).toBeInTheDocument();
    expect(screen.getByText(/go to login/i)).toBeInTheDocument();
  });

  it('routes the navigation card into the app login flow', async () => {
    const user = userEvent.setup();
    // openLogin() SPA-navigates via window.history rather than the wouter hook.
    const pushSpy = vi.spyOn(window.history, 'pushState');
    renderAt();

    await user.click(screen.getByText(/go to login/i));
    expect(pushSpy).toHaveBeenCalledWith({}, '', '/login');
  });
});
