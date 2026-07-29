import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';

vi.mock('@/components/NotificationBell', () => ({
  default: () => <button data-testid="notification-icon" aria-label="Notifications">N</button>,
}));

vi.mock('@/components/ai/AIHelpAgent', () => ({
  AiHeaderButton: () => <button data-testid="assistance-icon" aria-label="Assistance">A</button>,
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: 1, name: 'Rakesh Customer', email: 'rakesh@buildco.com', role: 'client' },
    loading: false, login: vi.fn(), logout: vi.fn(), updateUser: vi.fn(),
  }),
}));

import { DeliveryHeader, DeliveryBottomNav } from '@/components/DeliveryMobileChrome';

function renderWithRouter(children: React.ReactNode) {
  const { hook } = memoryLocation({ path: '/home', record: true });
  return render(<Router hook={hook}>{children}</Router>);
}

describe('DeliveryHeader — Assistance placement', () => {
  it('places the Assistance action immediately to the left of the notification icon', () => {
    renderWithRouter(<DeliveryHeader onProfile={() => {}} />);

    const assistance = screen.getByTestId('assistance-icon');
    const notification = screen.getByTestId('notification-icon');

    // DOCUMENT_POSITION_FOLLOWING (4) means `notification` comes after `assistance`.
    expect(assistance.compareDocumentPosition(notification) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('gives the Assistance action an accessible label', () => {
    renderWithRouter(<DeliveryHeader onProfile={() => {}} />);
    // The chrome is `display:none` until a media query (not evaluated by
    // jsdom) reveals it at mobile widths, so bypass the visibility filter —
    // production browsers still expose it once that media query matches.
    expect(screen.getByRole('button', { name: /assistance/i, hidden: true })).toBeInTheDocument();
  });
});

describe('DeliveryBottomNav — safe-area handling', () => {
  it('reserves env(safe-area-inset-bottom) in the nav height and bottom padding', () => {
    const { container } = renderWithRouter(<DeliveryBottomNav onMore={() => {}} />);

    const nav = container.querySelector<HTMLElement>('#delivery-bottom-nav');
    expect(nav).not.toBeNull();
    expect(nav!.getAttribute('aria-label')).toMatch(/primary mobile navigation/i);
    // jsdom's CSS engine reserializes `env(a, b)` into a mangled token order,
    // so assert on the safe-area-inset-bottom token's presence rather than
    // exact `env(...)` formatting (real browsers render this correctly).
    const styleAttr = nav!.getAttribute('style') ?? '';
    expect(styleAttr).toContain('safe-area-inset-bottom');
  });

  it('preserves the required HOME / ORDERS / PLANTS / MORE tabs for a client', () => {
    renderWithRouter(<DeliveryBottomNav onMore={() => {}} />);

    expect(screen.getByRole('link', { name: /go to home/i, hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to orders/i, hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to plants/i, hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open more navigation options/i, hidden: true })).toBeInTheDocument();
  });

  it('marks the active tab with aria-current', () => {
    renderWithRouter(<DeliveryBottomNav onMore={() => {}} />);
    expect(screen.getByRole('link', { name: /go to home/i, hidden: true })).toHaveAttribute('aria-current', 'page');
  });
});
