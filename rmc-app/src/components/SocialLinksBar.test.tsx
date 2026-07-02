import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfigContext, DEFAULT_SOCIAL_LINKS } from '@/lib/config';
import SocialLinksBar from './SocialLinksBar';

function renderWithLinks(overrides: Partial<typeof DEFAULT_SOCIAL_LINKS> = {}) {
  return render(
    <ConfigContext.Provider value={{ appVersion: '', socialLinks: { ...DEFAULT_SOCIAL_LINKS, ...overrides }, loaded: true }}>
      <SocialLinksBar />
    </ConfigContext.Provider>,
  );
}

describe('SocialLinksBar', () => {
  it('renders configured platforms as new-tab links', () => {
    renderWithLinks();
    const yt = screen.getByRole('link', { name: 'YouTube' });
    expect(yt).toHaveAttribute('href', DEFAULT_SOCIAL_LINKS.youtube);
    expect(yt).toHaveAttribute('target', '_blank');
    expect(yt.getAttribute('rel')).toContain('noopener');
    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute('href', DEFAULT_SOCIAL_LINKS.instagram);
    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', DEFAULT_SOCIAL_LINKS.facebook);
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', DEFAULT_SOCIAL_LINKS.whatsapp);
  });

  it('shows an empty-link platform as a non-clickable "coming soon" badge', () => {
    renderWithLinks({ playStore: '' });
    expect(screen.queryByRole('link', { name: /Google Play/ })).toBeNull();
    expect(screen.getByLabelText('Google Play — coming soon')).toBeInTheDocument();
  });

  it('renders Google Play as a link once its URL is set', () => {
    const url = 'https://play.google.com/store/apps/details?id=com.trackmyrmc';
    renderWithLinks({ playStore: url });
    expect(screen.getByRole('link', { name: 'Google Play' })).toHaveAttribute('href', url);
  });
});
