import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Route, Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import Landing from '@/pages/Landing';

// Mock SplashScreen to avoid animation timers and image loads.
// The mock exposes an onDone trigger via a "Continue" button.
vi.mock('@/components/SplashScreen', () => ({
  default: ({ onDone }: { onDone: () => void }) => (
    <div data-testid="splash-screen">
      <button onClick={onDone}>Continue</button>
    </div>
  ),
}));

function renderAt(path = '/') {
  const { hook } = memoryLocation({ path, record: true });
  render(
    <Router hook={hook}>
      <Route path="/"><Landing /></Route>
      <Route path="/login"><div data-testid="login-page" /></Route>
    </Router>,
  );
}

describe('Landing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('shows the SplashScreen when the splash has not yet been seen', () => {
    // sessionStorage is clear → hasSeenSplash() returns false
    renderAt();
    expect(screen.getByTestId('splash-screen')).toBeInTheDocument();
  });

  it('redirects straight to /login when splash was already seen this session', async () => {
    sessionStorage.setItem('trackmyrmc.splash.v1.seen', '1');
    renderAt();
    // Splash must not appear — we went straight to /login
    expect(screen.queryByTestId('splash-screen')).not.toBeInTheDocument();
    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
  });

  it('navigates to /login when SplashScreen signals it is done', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
  });
});
