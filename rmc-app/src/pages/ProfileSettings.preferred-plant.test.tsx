import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the api module but keep the real ApiError class so the component's
// error-message surfacing behaves exactly as in production.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

import ProfileSettings from '@/pages/ProfileSettings';
import { api } from '@/lib/api';
import { AuthContext, type AuthCtx } from '@/lib/auth';
import { ToastProvider } from '@/lib/toast-provider';
import { ThemeProvider } from '@/lib/theme-providers';
import type { User, PlantDirectoryEntry } from '@/lib/api';

const CLIENT: User = {
  id: 7,
  name: 'Rakesh Customer',
  email: 'rakesh@buildco.com',
  role: 'client',
} as User;

const ADMIN: User = {
  id: 1,
  name: 'Priya Admin',
  email: 'priya@aakruti.com',
  role: 'admin',
} as User;

const DIRECTORY: PlantDirectoryEntry[] = [
  { id: 11, plantCode: 'AAK', name: 'Aakruti RMC', city: 'Pune' },
  { id: 22, plantCode: 'SKY', name: 'Skyline Concrete', city: 'Mumbai' },
];

// The client load effect issues GET /plants/directory + GET /me/preferred-plant
// in parallel; everything else returns a neutral shape so any stray loader
// settles without throwing.
function mockReads(preferredPlantId: number | null) {
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/plants/directory') return DIRECTORY as never;
    if (path === '/me/preferred-plant') return { plantId: preferredPlantId } as never;
    return [] as never;
  });
}

function renderPage(user: User) {
  const ctx: AuthCtx = {
    user,
    loading: false,
    login: async () => ({} as User),
    logout: () => {},
    updateUser: () => {},
  };
  return render(
    <AuthContext.Provider value={ctx}>
      <ThemeProvider>
        <ToastProvider>
          <ProfileSettings />
        </ToastProvider>
      </ThemeProvider>
    </AuthContext.Provider>,
  );
}

// Scope queries to the "Default Plant" card so its select/button don't collide
// with controls in other settings cards.
async function findPlantCard(): Promise<HTMLElement> {
  const heading = await screen.findByText('Default Plant');
  // heading div → title/subtitle wrapper → header row → card root.
  return heading.parentElement?.parentElement?.parentElement as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProfileSettings — Default Plant', () => {
  it('loads the directory and pre-selects the saved default plant', async () => {
    mockReads(22);

    renderPage(CLIENT);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/plants/directory');
      expect(api.get).toHaveBeenCalledWith('/me/preferred-plant');
    });

    const card = await findPlantCard();
    const select = within(card).getByRole('combobox') as HTMLSelectElement;

    // The saved plant (id 22) is the active selection once both reads settle.
    await waitFor(() => expect(select.value).toBe('22'));
    expect((within(card).getByRole('option', { name: /Skyline Concrete/ }) as HTMLOptionElement).selected).toBe(true);
  });

  it('saves a newly chosen plant and shows the saved toast', async () => {
    const user = userEvent.setup();
    mockReads(null);
    vi.mocked(api.put).mockResolvedValue({ plantId: 11 } as never);

    renderPage(CLIENT);

    const card = await findPlantCard();
    const select = within(card).getByRole('combobox') as HTMLSelectElement;
    // Wait for the load to finish (No default plant pre-selected).
    await waitFor(() => expect(select.value).toBe(''));

    await user.selectOptions(select, '11');
    await user.click(within(card).getByRole('button', { name: /Save Default Plant/i }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/me/preferred-plant', { plantId: 11 }),
    );

    expect(await screen.findByText('Default plant saved.')).toBeInTheDocument();
    await waitFor(() => expect(select.value).toBe('11'));
  });

  it('clears the default plant (plantId:null) and shows the cleared toast', async () => {
    const user = userEvent.setup();
    mockReads(22);
    vi.mocked(api.put).mockResolvedValue({ plantId: null } as never);

    renderPage(CLIENT);

    const card = await findPlantCard();
    const select = within(card).getByRole('combobox') as HTMLSelectElement;
    // Starts on the saved plant.
    await waitFor(() => expect(select.value).toBe('22'));

    await user.selectOptions(select, '');
    await user.click(within(card).getByRole('button', { name: /Save Default Plant/i }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/me/preferred-plant', { plantId: null }),
    );

    expect(await screen.findByText('Default plant cleared.')).toBeInTheDocument();
    await waitFor(() => expect(select.value).toBe(''));
  });

  it('does not render the Default Plant card for a non-client (admin) user', async () => {
    mockReads(null);

    renderPage(ADMIN);

    // An admin-only loader settling is enough to know the page mounted.
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    expect(screen.queryByText('Default Plant')).not.toBeInTheDocument();
    // The customer-only reads must never fire for an admin.
    expect(api.get).not.toHaveBeenCalledWith('/plants/directory');
    expect(api.get).not.toHaveBeenCalledWith('/me/preferred-plant');
  });
});
