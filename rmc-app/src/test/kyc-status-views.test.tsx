/**
 * kyc-status-views.test.tsx
 *
 * Task #7 — Catch a broken KYC screen before it reaches customers.
 * Tests all 5 status views of KycProfile:
 *   1. not_started  — "Complete KYC" / Start Verification CTA
 *   2. pending      — "KYC Verification in Progress" + Check Status button, no Start CTA
 *   3. verified     — "KYC VERIFIED" badge / green checkmark
 *   4. failed       — failure notice + re-start CTA visible
 *   5. unconfigured — "temporarily unavailable" message shown
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock wouter (no real router needed) ──────────────────────────────────────
vi.mock('wouter', () => ({
  useLocation: () => ['/kyc', vi.fn()],
}));

// ── Mock the api module before importing the component ───────────────────────
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, get: vi.fn(), post: vi.fn(), put: vi.fn() },
  };
});

// ── Mock brand constant to avoid missing env var noise ───────────────────────
vi.mock('@/lib/brand', () => ({
  SUPPORT_WHATSAPP_URL: 'https://wa.me/test',
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
import KycProfile from '@/pages/KycProfile';
import { api } from '@/lib/api';
import { ToastProvider } from '@/lib/toast-provider';
import { ThemeProvider } from '@/lib/theme-providers';

// ── Helpers ───────────────────────────────────────────────────────────────────

type EkycStatus = 'not_started' | 'pending' | 'verified' | 'failed' | 'rejected';

interface KycState {
  configured: boolean;
  status: EkycStatus;
  isVerified: boolean;
  verifiedLegalName: string | null;
  verifiedAt: string | null;
  provider: string | null;
  maskedAadhaar: string | null;
}

function makeKycState(overrides: Partial<KycState>): KycState {
  return {
    configured: true,
    status: 'not_started',
    isVerified: false,
    verifiedLegalName: null,
    verifiedAt: null,
    provider: null,
    maskedAadhaar: null,
    ...overrides,
  };
}

function renderKycProfile() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <KycProfile />
      </ToastProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KycProfile status views', () => {
  it('not_started — shows "Complete KYC" start verification button', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      makeKycState({ status: 'not_started', configured: true }) as never,
    );

    renderKycProfile();

    // Wait for the loading state to resolve
    await waitFor(() =>
      expect(screen.queryByText(/checking your kyc status/i)).not.toBeInTheDocument(),
    );

    // The primary CTA for starting verification
    expect(screen.getByRole('button', { name: /complete kyc/i })).toBeInTheDocument();
    // Heading
    expect(screen.getByText(/complete kyc to place orders/i)).toBeInTheDocument();
    // "Check Status" or "KYC Verification in Progress" should NOT be visible
    expect(screen.queryByRole('button', { name: /check status/i })).not.toBeInTheDocument();
  });

  it('pending — shows waiting message and Check Status button, no Start button', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      makeKycState({ status: 'pending', configured: true }) as never,
    );

    renderKycProfile();

    await waitFor(() =>
      expect(screen.queryByText(/checking your kyc status/i)).not.toBeInTheDocument(),
    );

    // Heading shown for pending state
    expect(screen.getByText(/kyc verification in progress/i)).toBeInTheDocument();
    // Manual refresh button
    expect(screen.getByRole('button', { name: /check status/i })).toBeInTheDocument();
    // Start/Complete KYC button should NOT be shown for pending
    expect(screen.queryByRole('button', { name: /complete kyc/i })).not.toBeInTheDocument();
  });

  it('verified — shows "KYC VERIFIED" badge/text', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      makeKycState({
        status: 'verified',
        isVerified: true,
        verifiedLegalName: 'Rakesh Kumar',
        verifiedAt: '2024-06-01T10:00:00Z',
      }) as never,
    );

    renderKycProfile();

    await waitFor(() =>
      expect(screen.queryByText(/checking your kyc status/i)).not.toBeInTheDocument(),
    );

    // "KYC VERIFIED" uppercase label (may match multiple elements — badge + screen label)
    const kycVerifiedEls = screen.getAllByText(/kyc verified/i);
    expect(kycVerifiedEls.length).toBeGreaterThanOrEqual(1);
    // Verified legal name displayed
    expect(screen.getByText('Rakesh Kumar')).toBeInTheDocument();
    // No start button
    expect(screen.queryByRole('button', { name: /complete kyc/i })).not.toBeInTheDocument();
  });

  it('failed — shows failure notice and "Complete KYC" retry CTA', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      makeKycState({ status: 'failed', configured: true }) as never,
    );

    renderKycProfile();

    await waitFor(() =>
      expect(screen.queryByText(/checking your kyc status/i)).not.toBeInTheDocument(),
    );

    // The failure notice text
    expect(
      screen.getByText(/your previous attempt could not be completed/i),
    ).toBeInTheDocument();
    // The retry/start CTA is still the "Complete KYC" button (same screen as not_started)
    expect(screen.getByRole('button', { name: /complete kyc/i })).toBeInTheDocument();
    // No "Check Status" (that's for pending)
    expect(screen.queryByRole('button', { name: /check status/i })).not.toBeInTheDocument();
  });

  it('unconfigured — shows "temporarily unavailable" message and disables the start button', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      makeKycState({ status: 'not_started', configured: false }) as never,
    );

    renderKycProfile();

    await waitFor(() =>
      expect(screen.queryByText(/checking your kyc status/i)).not.toBeInTheDocument(),
    );

    // Unavailability notice
    expect(
      screen.getByText(/digilocker verification is temporarily unavailable/i),
    ).toBeInTheDocument();
    // Button should be rendered but disabled
    const btn = screen.getByRole('button', { name: /complete kyc/i });
    expect(btn).toBeDisabled();
  });
});
