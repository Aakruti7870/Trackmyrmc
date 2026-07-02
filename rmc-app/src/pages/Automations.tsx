import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Zap, Play, X, Clock, CheckCircle2, History, ChevronDown, ChevronUp } from 'lucide-react';

// Admin control panel for the scheduled automation suite. The server resolves
// the actor's scope from their token: plant-scoped staff edit their plant's
// overrides, platform staff (authority / global admin) edit the global defaults.

interface AutomationItem {
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

interface AutomationsResponse {
  scope: 'plant' | 'global';
  plantId: number | null;
  items: AutomationItem[];
}

interface SendItem {
  id: number;
  targetType: string;
  targetId: number;
  targetLabel: string | null;
  windowKey: string;
  detail: string | null;
  sentAt: string;
  plantId: number | null;
}

type FeedState = { loading: boolean; error: string; items: SendItem[] | null };

const TARGET_TYPE_LABELS: Record<string, string> = {
  order: 'Order',
  challan: 'Trip',
  plant: 'Plant',
  vehicle: 'Vehicle',
  client: 'Customer',
  user: 'Account',
};

function sendLine(s: SendItem): string {
  const type = TARGET_TYPE_LABELS[s.targetType] ?? s.targetType;
  const label = s.targetLabel ?? `#${s.targetId}`;
  return s.detail ? `${type} ${label} — ${s.detail}` : `${type} ${label}`;
}

const NUMBER_LABELS: Record<string, string> = {
  sendHour: 'Send after (IST hour, 0–23)',
  delayHours: 'Alert after (hours)',
  ttlHours: 'Link validity (hours)',
  thresholdPct: 'Variance threshold (%)',
  windowDays: 'Look-back window (days)',
  inactiveDays: 'Inactive after (days)',
  idleDays: 'Idle after (days)',
  retentionDays: 'Retention (days)',
  weekday: 'Day of week',
};

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  push: 'Push notification',
  whatsapp: 'WhatsApp',
};

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,rgba(15,28,54,.95),rgba(8,17,31,.95))',
      border: '1px solid var(--line)', borderRadius: 16, padding: 20,
      boxShadow: '0 8px 32px rgba(var(--shadow-rgb),.3)', ...style,
    }}>{children}</div>
  );
}

function fmtWhen(iso: string | null): string {
  if (!iso) return 'never';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

const inputStyle: React.CSSProperties = {
  width: 90, padding: '6px 9px', borderRadius: 8, boxSizing: 'border-box',
  background: 'var(--chip-bg)', border: '1px solid var(--line)', color: 'var(--text)', fontSize: 13,
};

export default function Automations() {
  const [data, setData] = useState<AutomationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, number | boolean | string>>>({});
  const [runBusy, setRunBusy] = useState(false);
  const [openFeeds, setOpenFeeds] = useState<Record<string, boolean>>({});
  const [feeds, setFeeds] = useState<Record<string, FeedState>>({});

  function toggleFeed(name: string) {
    const opening = !openFeeds[name];
    setOpenFeeds(prev => ({ ...prev, [name]: opening }));
    if (!opening || feeds[name]?.items || feeds[name]?.loading) return;
    setFeeds(prev => ({ ...prev, [name]: { loading: true, error: '', items: null } }));
    api.get<{ items: SendItem[] }>(`/automations/${name}/sends`)
      .then(res => setFeeds(prev => ({ ...prev, [name]: { loading: false, error: '', items: res.items } })))
      .catch(e => setFeeds(prev => ({
        ...prev,
        [name]: { loading: false, error: e instanceof Error ? e.message : 'Could not load the activity feed.', items: null },
      })));
  }

  useEffect(() => {
    api.get<AutomationsResponse>('/automations')
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load automations.'))
      .finally(() => setLoading(false));
  }, []);

  function draftOf(item: AutomationItem): Record<string, number | boolean | string> {
    return drafts[item.name] ?? item.config;
  }

  function setDraft(name: string, key: string, value: number | boolean | string) {
    setDrafts(prev => {
      const item = data?.items.find(i => i.name === name);
      const base = prev[name] ?? item?.config ?? {};
      return { ...prev, [name]: { ...base, [key]: value } };
    });
  }

  async function save(item: AutomationItem, enabled: boolean) {
    setBusy(item.name);
    setActionError('');
    try {
      const updated = await api.put<{ name: string; enabled: boolean; config: Record<string, number | boolean | string>; source: AutomationItem['source'] }>(
        `/automations/${item.name}`,
        { enabled, config: draftOf(item) },
      );
      setData(prev => prev ? {
        ...prev,
        items: prev.items.map(i => i.name === item.name ? { ...i, enabled: updated.enabled, config: updated.config, source: updated.source } : i),
      } : prev);
      setDrafts(prev => {
        const next = { ...prev };
        delete next[item.name];
        return next;
      });
      setSavedFlash(item.name);
      window.setTimeout(() => setSavedFlash(f => (f === item.name ? null : f)), 2000);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save the automation.');
    } finally {
      setBusy(null);
    }
  }

  async function runNow() {
    setRunBusy(true);
    setActionError('');
    try {
      await api.post('/automations/run', {});
      setSavedFlash('__run__');
      window.setTimeout(() => setSavedFlash(f => (f === '__run__' ? null : f)), 2500);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not trigger a run.');
    } finally {
      setRunBusy(false);
    }
  }

  const scopeNote = data?.scope === 'plant'
    ? 'Settings here apply to your plant and override the platform defaults.'
    : 'Settings here are the platform-wide defaults for every plant.';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-.3px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={24} style={{ color: 'var(--gold)' }} /> Automations
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '6px 0 0' }}>
            Scheduled reminders, alerts and housekeeping. All off by default except auto-cleanup. {scopeNote}
          </p>
        </div>
        {data?.scope === 'global' && (
        <button onClick={runNow} disabled={runBusy} data-testid="button-run-now" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, cursor: runBusy ? 'wait' : 'pointer',
          background: 'color-mix(in srgb, var(--gold) 14%, transparent)', color: 'var(--gold)',
          border: '1px solid color-mix(in srgb, var(--gold) 40%, transparent)',
          padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, opacity: runBusy ? 0.6 : 1,
        }}>
          <Play size={14} /> {runBusy ? 'Running…' : savedFlash === '__run__' ? 'Run started' : 'Run now'}
        </button>
        )}
      </div>

      {actionError && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.35)', color: 'var(--red)',
          padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600,
        }}>
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 2, display: 'inline-flex' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {loading ? (
        <Card><div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading…</div></Card>
      ) : error ? (
        <Card><div style={{ textAlign: 'center', padding: 40, color: 'var(--red)' }}>{error}</div></Card>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {data!.items.map(item => {
            const cfg = draftOf(item);
            const isBusy = busy === item.name;
            const cleanupLocked = item.name === 'cleanup' && data!.scope === 'plant';
            const channelKeys = Object.keys(item.defaultConfig).filter(k => k in CHANNEL_LABELS);
            const numberKeys = Object.keys(item.defaultConfig).filter(k => typeof item.defaultConfig[k] === 'number' && k !== 'weekday');
            const dirty = drafts[item.name] !== undefined;

            return (
              <Card key={item.name} style={{ opacity: item.enabled ? 1 : 0.85 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{item.label}</h2>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap',
                        color: item.enabled ? 'var(--green)' : 'var(--muted)',
                        background: item.enabled ? 'rgba(34,197,94,.13)' : 'rgba(159,176,199,.13)',
                      }}>{item.enabled ? 'On' : 'Off'}</span>
                      {item.source !== 'default' && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, color: 'var(--blue)', background: 'rgba(56,189,248,.12)', whiteSpace: 'nowrap' }}>
                          {item.source === 'plant' ? 'Plant override' : 'Platform setting'}
                        </span>
                      )}
                      {savedFlash === item.name && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--green)' }}>
                          <CheckCircle2 size={13} /> Saved
                        </span>
                      )}
                    </div>
                    <p style={{ color: 'var(--muted)', fontSize: 12.5, margin: '5px 0 0', lineHeight: 1.5 }}>{item.description}</p>
                    <p style={{ color: 'var(--muted)', fontSize: 11.5, margin: '6px 0 0', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={11} /> Last sent: {fmtWhen(item.lastSentAt)} · Last checked: {fmtWhen(item.lastRunAt)}
                    </p>
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: cleanupLocked || isBusy ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    <input
                      type="checkbox"
                      data-testid={`toggle-${item.name}`}
                      checked={item.enabled}
                      disabled={cleanupLocked || isBusy}
                      onChange={e => save(item, e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: 'var(--gold)' }}
                    />
                    Enabled
                  </label>
                </div>

                {cleanupLocked ? (
                  <p style={{ color: 'var(--muted)', fontSize: 12, margin: '12px 0 0', fontStyle: 'italic' }}>
                    Auto-cleanup is managed platform-wide by the head office.
                  </p>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                    {item.name === 'digest' && (
                      <>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>Frequency</div>
                          <select value={String(cfg.frequency ?? 'daily')} data-testid="select-digest-frequency"
                            onChange={e => setDraft(item.name, 'frequency', e.target.value)}
                            style={{ ...inputStyle, width: 110 }}>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                          </select>
                        </div>
                        {String(cfg.frequency ?? 'daily') === 'weekly' && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>{NUMBER_LABELS.weekday}</div>
                            <select value={Number(cfg.weekday ?? 1)} onChange={e => setDraft(item.name, 'weekday', Number(e.target.value))} style={{ ...inputStyle, width: 130 }}>
                              {DOW.map((d, i) => <option key={d} value={i}>{d}</option>)}
                            </select>
                          </div>
                        )}
                      </>
                    )}
                    {numberKeys.map(key => (
                      <div key={key}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>
                          {NUMBER_LABELS[key] ?? key}
                        </div>
                        <input
                          type="number"
                          data-testid={`input-${item.name}-${key}`}
                          value={Number(cfg[key] ?? item.defaultConfig[key])}
                          onChange={e => setDraft(item.name, key, Number(e.target.value))}
                          style={inputStyle}
                        />
                      </div>
                    ))}
                    {channelKeys.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>Channels</div>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          {channelKeys.map(key => (
                            <label key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
                              <input type="checkbox" checked={cfg[key] === true}
                                data-testid={`checkbox-${item.name}-${key}`}
                                onChange={e => setDraft(item.name, key, e.target.checked)}
                                style={{ width: 15, height: 15, accentColor: 'var(--gold)' }} />
                              {CHANNEL_LABELS[key]}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {'whatsappTemplate' in item.defaultConfig && cfg.whatsapp === true && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>WhatsApp template</div>
                        <input
                          value={String(cfg.whatsappTemplate ?? '')}
                          data-testid={`input-${item.name}-template`}
                          onChange={e => setDraft(item.name, 'whatsappTemplate', e.target.value)}
                          placeholder="Template name / SID"
                          style={{ ...inputStyle, width: 200 }}
                        />
                      </div>
                    )}
                    {dirty && (
                      <button onClick={() => save(item, item.enabled)} disabled={isBusy} data-testid={`button-save-${item.name}`} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, cursor: isBusy ? 'wait' : 'pointer',
                        background: 'color-mix(in srgb, var(--green) 12%, transparent)', color: 'var(--green)',
                        border: '1px solid color-mix(in srgb, var(--green) 35%, transparent)',
                        padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, opacity: isBusy ? 0.6 : 1,
                      }}>
                        {isBusy ? 'Saving…' : 'Save settings'}
                      </button>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => toggleFeed(item.name)}
                    data-testid={`button-activity-${item.name}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                      background: 'none', border: 'none', padding: 0,
                      color: 'var(--muted)', fontSize: 12, fontWeight: 700,
                    }}
                  >
                    <History size={12} /> Recent activity
                    {openFeeds[item.name] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  {openFeeds[item.name] && (
                    <div data-testid={`feed-${item.name}`} style={{ marginTop: 8, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                      {(() => {
                        const feed = feeds[item.name];
                        if (!feed || feed.loading) {
                          return <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }}>Loading…</p>;
                        }
                        if (feed.error) {
                          return <p style={{ color: 'var(--red)', fontSize: 12, margin: 0 }}>{feed.error}</p>;
                        }
                        if (!feed.items || feed.items.length === 0) {
                          return (
                            <p style={{ color: 'var(--muted)', fontSize: 12, margin: 0 }} data-testid={`feed-empty-${item.name}`}>
                              Nothing sent yet — activity will appear here once this automation runs.
                            </p>
                          );
                        }
                        return (
                          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
                            {feed.items.map(s => (
                              <li key={s.id} data-testid={`feed-row-${item.name}-${s.id}`} style={{
                                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
                                fontSize: 12.5, color: 'var(--text)',
                              }}>
                                <span style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {sendLine(s)}
                                </span>
                                <span style={{ color: 'var(--muted)', fontSize: 11.5, whiteSpace: 'nowrap' }}>{fmtWhen(s.sentAt)}</span>
                              </li>
                            ))}
                          </ul>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
