import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: vi.fn(), put: vi.fn(), post: vi.fn() } };
});

import MyTrips from '@/pages/MyTrips';
import { api, type Challan } from '@/lib/api';

const COMPRESSED_DATA_URL = 'data:image/jpeg;base64,Q09NUFJFU1NFRA==';

function makeChallan(over: Partial<Challan> = {}): Challan {
  return {
    id: 1,
    challanNo: 'CH-001',
    clientId: 5,
    grade: 'M25',
    quantity: '8.00',
    pumpRequired: false,
    status: 'dispatched',
    createdAt: '2026-06-10T06:00:00.000Z',
    dispatchTime: '2026-06-10T07:00:00.000Z',
    clientName: 'Skyline Builders',
    vehicleNo: 'GJ01AB1234',
    ...over,
  };
}

function mockTrips(rows: Challan[]) {
  vi.mocked(api.get).mockResolvedValue(rows as never);
}

// jsdom has no real image decoding or canvas raster backend, so the
// compressImage() pipeline (FileReader -> Image.onload -> canvas.toDataURL)
// never resolves. Stub those primitives so handlePhotoPick produces a
// deterministic data URL the way a real browser would.
let OriginalImage: typeof Image;
let getContextSpy: ReturnType<typeof vi.spyOn>;
let toDataURLSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();

  OriginalImage = globalThis.Image;
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = 1600;
    height = 900;
    set src(_v: string) {
      // Mimic the async decode callback a real browser fires.
      queueMicrotask(() => this.onload?.());
    }
  }
  globalThis.Image = FakeImage as unknown as typeof Image;

  getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  toDataURLSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockReturnValue(COMPRESSED_DATA_URL);
});

afterEach(() => {
  globalThis.Image = OriginalImage;
  getContextSpy.mockRestore();
  toDataURLSpy.mockRestore();
});

async function openProofForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Mark as Delivered/i }));
}

function fileInput(): HTMLInputElement {
  const el = document.querySelector('input[type="file"]') as HTMLInputElement | null;
  if (!el) throw new Error('file input not found');
  return el;
}

function makePhoto(name = 'site.jpg') {
  return new File(['raw-bytes'], name, { type: 'image/jpeg' });
}

describe('MyTrips proof-of-delivery photo capture', () => {
  it('shows a preview after a photo is picked and sends it on confirmation', async () => {
    mockTrips([makeChallan({ id: 7, quantity: '8.00' })]);
    vi.mocked(api.put).mockResolvedValue(
      makeChallan({ id: 7, status: 'delivered', hasProofPhoto: true }) as never,
    );
    const user = userEvent.setup();
    render(<MyTrips />);

    await openProofForm(user);
    await user.upload(fileInput(), makePhoto());

    const preview = await screen.findByAltText(/Proof of delivery 1/i);
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute('src', COMPRESSED_DATA_URL);

    await user.click(screen.getByRole('button', { name: /Confirm Delivery/i }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/challans/7',
        expect.objectContaining({ status: 'delivered', proofPhotos: [COMPRESSED_DATA_URL] }),
      );
    });
  });

  it('omits proofPhotos from the payload after the chosen photo is removed', async () => {
    mockTrips([makeChallan({ id: 9, quantity: '8.00' })]);
    vi.mocked(api.put).mockResolvedValue(
      makeChallan({ id: 9, status: 'delivered' }) as never,
    );
    const user = userEvent.setup();
    render(<MyTrips />);

    await openProofForm(user);
    await user.upload(fileInput(), makePhoto());

    expect(await screen.findByAltText(/Proof of delivery 1/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Remove photo 1/i }));
    await waitFor(() => {
      expect(screen.queryByAltText(/Proof of delivery 1/i)).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Confirm Delivery/i }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledTimes(1);
    });
    const payload = vi.mocked(api.put).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('proofPhotos');
  });
});
