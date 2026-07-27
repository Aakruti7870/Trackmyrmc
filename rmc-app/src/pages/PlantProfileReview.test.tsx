import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), post: vi.fn() } };
});

import PlantProfileReview from '@/pages/PlantProfileReview';
import { api } from '@/lib/api';

const profile = {
  plantId: 21,
  profileStatus: 'submitted',
  completionPercentage: 90,
  numberOfTransitMixers: 21,
  productionCapacityM3PerHour: '53.00',
  laboratoryAvailable: true,
  dieselGeneratorAvailable: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/plants') return Promise.resolve([{ id: 21, name: 'AAKRUTI INFRA RMC PLANT', city: 'Panvel' }] as never);
    if (path === '/admin/plant-profiles/pending') return Promise.resolve([profile] as never);
    if (path === '/admin/plant-profiles/21') return Promise.resolve({
      profile,
      certificates: [{ id: 5, certificateName: 'Batching Plant Calibration', certificateStatus: 'available', verificationStatus: 'pending', documentUrl: null }],
    } as never);
    return Promise.resolve([] as never);
  });
  vi.mocked(api.post).mockResolvedValue({} as never);
});

describe('PlantProfileReview', () => {
  it('shows submitted profiles and critical capability fields', async () => {
    const user = userEvent.setup();
    render(<PlantProfileReview />);
    expect(await screen.findByText('AAKRUTI INFRA RMC PLANT')).toBeInTheDocument();
    expect(screen.getByText(/90% complete/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /review profile/i }));
    expect(await screen.findByText('53.00')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
    expect(screen.getByText('Batching Plant Calibration')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view document/i })).not.toBeInTheDocument();
  });

  it('lets Super Admin verify a submitted profile', async () => {
    const user = userEvent.setup();
    render(<PlantProfileReview />);
    await user.click(await screen.findByRole('button', { name: /review profile/i }));
    await user.click(await screen.findByRole('button', { name: /verify plant profile/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/plant-profiles/21/verify', {}));
  });

  it('requires a reason before requesting changes', async () => {
    const user = userEvent.setup();
    render(<PlantProfileReview />);
    await user.click(await screen.findByRole('button', { name: /review profile/i }));
    await user.click(await screen.findByRole('button', { name: /request changes/i }));
    expect(await screen.findByText(/at least 3 characters/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalledWith('/admin/plant-profiles/21/reject', expect.anything());
  });
});
