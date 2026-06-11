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
  it('uploads the photo straight to storage and sends only its object path on confirmation', async () => {
    mockTrips([makeChallan({ id: 7, quantity: '8.00' })]);
    vi.mocked(api.put).mockResolvedValue(
      makeChallan({ id: 7, status: 'delivered', hasProofPhoto: true }) as never,
    );
    // The presigned-URL request returns where to PUT the bytes and the entity
    // path to persist on the challan.
    const OBJECT_PATH = '/objects/uploads/abc-123';
    vi.mocked(api.post).mockResolvedValue(
      { uploadURL: 'https://storage.example/signed-put', objectPath: OBJECT_PATH } as never,
    );
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<MyTrips />);

    await openProofForm(user);
    await user.upload(fileInput(), makePhoto());

    const preview = await screen.findByAltText(/Proof of delivery 1/i);
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute('src', COMPRESSED_DATA_URL);

    await user.click(screen.getByRole('button', { name: /Confirm Delivery/i }));

    // A presigned upload URL is requested, the bytes are PUT directly to storage…
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/challans/proof-upload-url', expect.any(Object));
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://storage.example/signed-put',
      expect.objectContaining({ method: 'PUT' }),
    );

    // …and only the returned object path is sent on delivery, never the base64.
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/challans/7',
        expect.objectContaining({ status: 'delivered', proofPhotos: [OBJECT_PATH] }),
      );
    });
    const putPayload = vi.mocked(api.put).mock.calls[0][1] as { proofPhotos: string[] };
    expect(putPayload.proofPhotos).not.toContain(COMPRESSED_DATA_URL);

    vi.unstubAllGlobals();
  });

  it('surfaces an error and clears the busy state when compression fails', async () => {
    mockTrips([makeChallan({ id: 11, quantity: '8.00' })]);
    // Force compressImage() to reject: a null 2D context makes it throw
    // "Canvas not supported" the way an unsupported/locked-down browser would.
    getContextSpy.mockReturnValue(null);
    const user = userEvent.setup();
    render(<MyTrips />);

    await openProofForm(user);
    await user.upload(fileInput(), makePhoto());

    expect(await screen.findByText(/Canvas not supported/i)).toBeInTheDocument();
    // No preview is rendered because nothing was compressed.
    expect(screen.queryByAltText(/Proof of delivery 1/i)).not.toBeInTheDocument();
    // The busy state clears, so the capture button is interactive again.
    const captureBtn = screen.getByRole('button', { name: /Take \/ upload photos/i });
    expect(captureBtn).not.toBeDisabled();
    expect(screen.queryByText(/Processing…/i)).not.toBeInTheDocument();
  });

  it('still confirms delivery without proofPhotos after a failed photo upload', async () => {
    mockTrips([makeChallan({ id: 12, quantity: '8.00' })]);
    vi.mocked(api.put).mockResolvedValue(
      makeChallan({ id: 12, status: 'delivered' }) as never,
    );
    getContextSpy.mockReturnValue(null);
    const user = userEvent.setup();
    render(<MyTrips />);

    await openProofForm(user);
    await user.upload(fileInput(), makePhoto());

    expect(await screen.findByText(/Canvas not supported/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Confirm Delivery/i }));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledTimes(1);
    });
    expect(api.put).toHaveBeenCalledWith(
      '/challans/12',
      expect.objectContaining({ status: 'delivered' }),
    );
    const payload = vi.mocked(api.put).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('proofPhotos');
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

  it('caps previews at 8 and warns that extra photos were skipped', async () => {
    mockTrips([makeChallan({ id: 11, quantity: '8.00' })]);
    const user = userEvent.setup();
    render(<MyTrips />);

    await openProofForm(user);
    const tooMany = Array.from({ length: 10 }, (_, i) => makePhoto(`site-${i}.jpg`));
    await user.upload(fileInput(), tooMany);

    await waitFor(() => {
      expect(screen.getByAltText(/Proof of delivery 8/i)).toBeInTheDocument();
    });
    expect(screen.queryByAltText(/Proof of delivery 9/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Only 8 photos allowed — extra photos were skipped/i),
    ).toBeInTheDocument();
  });

  it('hides the add-photo button once the cap is reached', async () => {
    mockTrips([makeChallan({ id: 12, quantity: '8.00' })]);
    const user = userEvent.setup();
    render(<MyTrips />);

    await openProofForm(user);
    expect(
      screen.getByRole('button', { name: /Take \/ upload photos/i }),
    ).toBeInTheDocument();

    const eight = Array.from({ length: 8 }, (_, i) => makePhoto(`site-${i}.jpg`));
    await user.upload(fileInput(), eight);

    await waitFor(() => {
      expect(screen.getByAltText(/Proof of delivery 8/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /Add another photo|Take \/ upload photos/i }),
    ).not.toBeInTheDocument();
  });
});
