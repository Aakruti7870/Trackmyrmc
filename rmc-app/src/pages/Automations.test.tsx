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

  it('plant scope hides Run now and locks the cleanup automation', async () => {
    mockList('plant', [REMINDER, CLEANUP]);
    render(<Automations />);

    expect(await screen.findByText('Auto-cleanup')).toBeInTheDocument();
    expect(screen.queryByTestId('button-run-now')).not.toBeInTheDocument();
    expect(screen.getByTestId('toggle-cleanup')).toBeDisabled();
    expect(screen.getByText('Auto-cleanup is managed platform-wide by the head office.')).toBeInTheDocument();
    // Ordinary automations stay editable for plant staff.
    expect(screen.getByTestId('toggle-orderReminders')).not.toBeDisabled();
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
