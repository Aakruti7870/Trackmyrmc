import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import Landing from '@/pages/Landing';

function renderAt(path = '/') {
  const { hook, history } = memoryLocation({ path, record: true });
  render(
    <Router hook={hook}>
      <Landing />
    </Router>,
  );
  return history;
}

describe('Landing marketing page', () => {
  it('shows the three above-the-fold CTAs', () => {
    renderAt();
    expect(screen.getByRole('button', { name: /book concrete now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /find rmc plant near me/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /see live demo/i })).toBeInTheDocument();
  });

  it('shows the trust badges', () => {
    renderAt();
    for (const label of ['Verified Plants', 'GPS Tracking', 'Digital Challan', 'Quality Records']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('routes both customer CTAs to the register funnel', async () => {
    const user = userEvent.setup();
    const history = renderAt();

    await user.click(screen.getByRole('button', { name: /book concrete now/i }));
    expect(history.at(-1)).toBe('/register');

    await user.click(screen.getByRole('button', { name: /find rmc plant near me/i }));
    expect(history.at(-1)).toBe('/register');
  });
});
