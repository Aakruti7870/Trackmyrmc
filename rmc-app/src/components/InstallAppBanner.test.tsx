import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import InstallAppBanner from '@/components/InstallAppBanner';

const realUA = navigator.userAgent;

function setUA(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

function fireInstallPrompt() {
  const evt = Object.assign(new Event('beforeinstallprompt'), {
    prompt: async () => {},
    userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
  });
  act(() => {
    window.dispatchEvent(evt);
  });
}

beforeEach(() => {
  localStorage.clear();
  setUA('Mozilla/5.0 (desktop)');
});

afterEach(() => {
  setUA(realUA);
});

describe('InstallAppBanner', () => {
  it('stays hidden on a desktop browser with no install prompt', () => {
    render(<InstallAppBanner />);
    expect(screen.queryByRole('region', { name: /install app/i })).not.toBeInTheDocument();
  });

  it('shows on iOS and can be dismissed (persisting to localStorage)', async () => {
    const user = userEvent.setup();
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    render(<InstallAppBanner />);

    expect(screen.getByRole('region', { name: /install app/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /dismiss install banner/i }));

    expect(screen.queryByRole('region', { name: /install app/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('ck-install-banner-dismissed')).toBe('1');
  });

  it('appears when the browser fires beforeinstallprompt', async () => {
    render(<InstallAppBanner />);
    expect(screen.queryByRole('region', { name: /install app/i })).not.toBeInTheDocument();

    fireInstallPrompt();
    await waitFor(() =>
      expect(screen.getByRole('region', { name: /install app/i })).toBeInTheDocument(),
    );
  });

  it('does not show if already dismissed', () => {
    localStorage.setItem('ck-install-banner-dismissed', '1');
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    render(<InstallAppBanner />);
    expect(screen.queryByRole('region', { name: /install app/i })).not.toBeInTheDocument();
  });
});
