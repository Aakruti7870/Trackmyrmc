import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wouter', () => ({ useRoute: () => [true, { plantId: '21' }] }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn() } };
});

import PlantAbout from '@/pages/PlantAbout';
import { api } from '@/lib/api';

const response = {
  plant: { id: 21, name: 'AAKRUTI INFRA RMC PLANT', address: 'Karanjade, Panvel' },
  profile: {
    profileStatus: 'verified',
    productionCapacityM3PerHour: '53.00',
    maximumDailySupplyCapacityM3: '450.00',
    numberOfTransitMixers: 21,
    numberOfPumps: 2,
    laboratoryAvailable: true,
    inhouseConcretePumpAvailable: true,
    works24Hours: false,
    workingHoursStart: '07:00',
    workingHoursEnd: '22:00',
    creditPaymentAvailable: true,
    creditDaysMin: 7,
    creditDaysMax: 30,
  },
  certificates: [{
    id: 1,
    certificateName: 'Batching Plant Calibration Certificate With A Long Descriptive Name',
    certificateStatus: 'available',
    verificationStatus: 'verified',
    expiryDate: '2027-03-31',
    documentUrl: null,
  }],
  pendingChanges: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue(response as never);
});

describe('About Plant', () => {
  it('renders verified capability information and the payment disclaimer', async () => {
    render(<PlantAbout />);
    expect(await screen.findByText('AAKRUTI INFRA RMC PLANT')).toBeInTheDocument();
    expect(screen.getByText('53.00 m³/hr')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
    expect(screen.getByText(/credit terms are subject to plant owner approval/i)).toBeInTheDocument();
  });

  it('does not render a broken View Document button when certificate upload is omitted', async () => {
    render(<PlantAbout />);
    await screen.findByText(/batching plant calibration certificate/i);
    expect(screen.queryByRole('link', { name: /view document/i })).not.toBeInTheDocument();
  });

  it('renders View Document only when a customer-visible URL exists', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ...response,
      certificates: [{ ...response.certificates[0], documentUrl: 'https://example.com/certificate.pdf' }],
    } as never);
    render(<PlantAbout />);
    expect(await screen.findByRole('link', { name: /view document/i })).toHaveAttribute('href', 'https://example.com/certificate.pdf');
  });
});
