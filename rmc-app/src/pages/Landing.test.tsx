import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
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

describe('Landing marketing deck', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the brand and the two above-the-fold hero CTAs', () => {
    renderAt();
    // NavBar brand is always mounted, independent of the current slide.
    expect(screen.getAllByText(/concrete king/i).length).toBeGreaterThan(0);
    // Slide 1 (hero) is the initial slide.
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /watch demo/i })).toBeInTheDocument();
  });

  it('exposes a Login entry point in the top navigation', () => {
    renderAt();
    expect(screen.getAllByRole('button', { name: /^login$/i }).length).toBeGreaterThan(0);
  });

  it('routes the hero CTA into the app login flow', async () => {
    const user = userEvent.setup();
    // openLogin() SPA-navigates via window.history rather than the wouter hook.
    const pushSpy = vi.spyOn(window.history, 'pushState');
    renderAt();

    await user.click(screen.getByRole('button', { name: /get started/i }));
    expect(pushSpy).toHaveBeenCalledWith({}, '', '/login');
  });
});
