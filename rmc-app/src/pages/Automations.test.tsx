import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the api module but keep the real ApiError class so error surfacing
// behaves exactly as in production.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

import Automations from '@/pages/Automations';
import { api, ApiError } from '@/lib/api';

interface Item {
  name: string;
  label: string;
  description: string;
  enabled: boolean;
  config: Record<string, number | boolean | string>;
  source: 'plant' | 'global' | 'default';
  defaultConfig: Record<string, number | boolean | string>;
  lastRunAt: string | null;
  lastSentAt: string | null;
}

function item(overrides: Partial<Item> & Pick<Item, 'name' | 'label'>): Item {
  return {
    description: 'What this automation does.',
    enabled: false,
    config: {},
    source: 'default',
    defaultConfig: {},
    lastRunAt: null,
    lastSentAt: null,
    ...overrides,
  };
}

const REMINDER = item({
  name: 'orderReminders',
  label: 'Order reminders',
  config: { sendHour: 7, email: true, push: false, whatsapp: false, whatsappTemplate: '' },
  defaultConfig: { sendHour: 7, email: true, push: false, whatsapp: false, whatsappTemplate: '' },
});

const DIGEST = item({
  name: 'digest',
  label: 'Daily/weekly digest',
  config: { frequency: 'daily', sendHour: 8, weekday: 1, email: true, whatsapp: false, whatsappTemplate: '' },
  defaultConfig: { frequency: 'daily', sendHour: 8, weekday: 1, email: true, whatsapp: false, whatsappTemplate: '' },
});

const CLEANUP = item({
  name: 'cleanup',
  label: 'Auto-cleanup',
  enabled: true,
  config: { retentionDays: 30 },
  defaultConfig: { retentionDays: 30 },
});

function mockList(scope: 'plant' | 'global', items: Item[]) {
  vi.mocked(api.get).mockResolvedValue({
    scope,
    plantId: scope === 'plant' ? 3 : null,
    items,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Automations admin page', () => {
  it('loads the list and renders each automation with its enabled state', async () => {
    mockList('global', [REMINDER, DIGEST, CLEANUP]);
    render(<Automations />);

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/automations'));
    expect(await screen.findByText('Order reminders')).toBeInTheDocument();
    expect(screen.getByText('Daily/weekly digest')).toBeInTheDocument();
    expect(screen.getByText('Auto-cleanup')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-orderReminders')).not.toBeChecked();
    expect(screen.getByTestId('toggle-cleanup')).toBeChecked();
  });

  it('toggling an automation PUTs the enabled flag with the current config', async () => {
    mockList('global', [REMINDER]);
    vi.mocked(api.put).mockResolvedValue({
      name: 'orderReminders', enabled: true, config: REMINDER.config, source: 'global',
    } as never);
    render(<Automations />);

    await userEvent.click(await screen.findByTestId('toggle-orderReminders'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/automations/orderReminders',
      { enabled: true, config: REMINDER.config },
    ));
    expect(screen.getByTestId('toggle-orderReminders')).toBeChecked();
    expect(screen.getByText('Platform setting')).toBeInTheDocument();
  });

  it('editing a number field shows Save and PUTs the edited config round-trip', async () => {
    mockList('global', [REMINDER]);
    render(<Automations />);

    const hourInput = await screen.findByTestId('input-orderReminders-sendHour');
    expect(screen.queryByTestId('button-save-orderReminders')).not.toBeInTheDocument();

    await userEvent.clear(hourInput);
    await userEvent.type(hourInput, '9');

    const saved = { ...REMINDER.config, sendHour: 9 };
    vi.mocked(api.put).mockResolvedValue({
      name: 'orderReminders', enabled: false, config: saved, source: 'global',
    } as never);
    await userEvent.click(screen.getByTestId('button-save-orderReminders'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/automations/orderReminders',
      { enabled: false, config: saved },
    ));
    // Save button disappears once the draft is committed; a Saved flash shows.
    await waitFor(() => expect(screen.queryByTestId('button-save-orderReminders')).not.toBeInTheDocument());
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('digest: enabling WhatsApp reveals the template field and both are saved', async () => {
    mockList('global', [DIGEST]);
    render(<Automations />);

    expect(await screen.findByTestId('checkbox-digest-email')).toBeChecked();
    expect(screen.queryByTestId('input-digest-template')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('checkbox-digest-whatsapp'));
    const tpl = await screen.findByTestId('input-digest-template');
    await userEvent.type(tpl, 'digest_daily_v1');

    const saved = { ...DIGEST.config, whatsapp: true, whatsappTemplate: 'digest_daily_v1' };
    vi.mocked(api.put).mockResolvedValue({
      name: 'digest', enabled: false, config: saved, source: 'global',
    } as never);
    await userEvent.click(screen.getByTestId('button-save-digest'));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith(
      '/automations/digest',
      { enabled: false, config: saved },
    ));
  });

  it('global scope shows Run now and posts the manual run', async () => {
    mockList('global', [CLEANUP]);
    vi.mocked(api.post).mockResolvedValue({ ok: true } as never);
    render(<Automations />);

    await userEvent.click(await screen.findByTestId('button-run-now'));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/automations/run', {}));
    expect(screen.getByText('Run started')).toBeInTheDocument();
  });

  it('plant scope shows Run now (scoped run) and locks the cleanup automation', async () => {
    mockList('plant', [REMINDER, CLEANUP]);
    vi.mocked(api.post).mockResolvedValue({ ok: true, scope: 'plant' } as never);
    render(<Automations />);

    expect(await screen.findByText('Auto-cleanup')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('button-run-now'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/automations/run', {}));
    expect(screen.getByTestId('toggle-cleanup')).toBeDisabled();
    expect(screen.getByText('Auto-cleanup is managed platform-wide by the head office.')).toBeInTheDocument();
    // Ordinary automations stay editable for plant staff.
    expect(screen.getByTestId('toggle-orderReminders')).not.toBeDisabled();
  });

  it('expanding Recent activity fetches the feed and renders labelled rows', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/automations') {
        return Promise.resolve({ scope: 'global', plantId: null, items: [REMINDER] } as never);
      }
      if (path === '/automations/orderReminders/sends') {
        return Promise.resolve({
          items: [
            { id: 12, targetType: 'order', targetId: 77, targetLabel: 'ORD-77', windowKey: 'd:2026-07-03', detail: null, sentAt: '2026-07-01T12:30:00.000Z', plantId: 3 },
            { id: 11, targetType: 'order', targetId: 60, targetLabel: null, windowKey: 'd:2026-06-28', detail: 'via WhatsApp', sentAt: '2026-06-27T09:00:00.000Z', plantId: 3 },
          ],
        } as never);
      }
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    render(<Automations />);

    await userEvent.click(await screen.findByTestId('button-activity-orderReminders'));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/automations/orderReminders/sends'));
    expect(await screen.findByText('Order ORD-77')).toBeInTheDocument();
    // A vanished target falls back to its id, and the detail is appended.
    expect(screen.getByText('Order #60 — via WhatsApp')).toBeInTheDocument();

    // Collapsing hides the feed without refetching on re-open.
    await userEvent.click(screen.getByTestId('button-activity-orderReminders'));
    expect(screen.queryByTestId('feed-orderReminders')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('button-activity-orderReminders'));
    expect(await screen.findByText('Order ORD-77')).toBeInTheDocument();
    const sendCalls = vi.mocked(api.get).mock.calls.filter(c => c[0] === '/automations/orderReminders/sends');
    expect(sendCalls).toHaveLength(1);
  });

  it('an automation that has never sent shows the empty-feed message', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/automations') {
        return Promise.resolve({ scope: 'plant', plantId: 3, items: [CLEANUP] } as never);
      }
      return Promise.resolve({ items: [] } as never);
    });
    render(<Automations />);

    await userEvent.click(await screen.findByTestId('button-activity-cleanup'));

    expect(await screen.findByTestId('feed-empty-cleanup')).toBeInTheDocument();
  });

  it('a failed feed fetch shows an inline error inside the feed panel', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/automations') {
        return Promise.resolve({ scope: 'global', plantId: null, items: [REMINDER] } as never);
      }
      return Promise.reject(new ApiError('Could not load the activity feed.', 500, {}));
    });
    render(<Automations />);

    await userEvent.click(await screen.findByTestId('button-activity-orderReminders'));

    expect(await screen.findByText('Could not load the activity feed.')).toBeInTheDocument();
    // The page itself is still healthy — only the feed panel shows the error.
    expect(screen.getByText('Order reminders')).toBeInTheDocument();
  });

  it('a failed save surfaces a dismissible error banner and keeps the toggle state', async () => {
    mockList('plant', [REMINDER]);
    vi.mocked(api.put).mockRejectedValue(new ApiError('The plant override could not be saved.', 500, {}));
    render(<Automations />);

    await userEvent.click(await screen.findByTestId('toggle-orderReminders'));

    expect(await screen.findByText('The plant override could not be saved.')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-orderReminders')).not.toBeChecked();
  });
});
