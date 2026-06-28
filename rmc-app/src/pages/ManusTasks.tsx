import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Send, RefreshCw, ExternalLink, BarChart3, FileText,
  Search, LineChart, PenLine, Loader2, AlertCircle, CheckCircle2, Clock, HelpCircle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';

// Manus AI "deep task" hub. Distinct from the live in-app Gemini Help Agent:
// the user launches a long-running task (research, drafting, reporting) and
// Manus works on it asynchronously. The list doubles as a "Sync from Manus"
// view — it shows every task on the account, including ones created directly in
// the Manus app. All calls go through the server proxy (/api/manus); the API
// key never reaches the browser.

interface ManusTaskSummary {
  id: string;
  title: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  creditUsage: number | null;
  taskUrl: string | null;
}
interface ManusTaskList {
  tasks: ManusTaskSummary[];
  hasMore: boolean;
  nextCursor: string | null;
}
type ManusStatus = 'running' | 'stopped' | 'waiting' | 'error' | 'unknown';
interface ManusMessagesView {
  status: ManusStatus;
  resultText: string;
  errorText: string | null;
  waitingFor: string | null;
  events: unknown[];
}
interface CreatedTask {
  taskId: string;
  title: string | null;
  taskUrl: string | null;
  shareUrl: string | null;
}

interface Template {
  key: string;
  label: string;
  icon: typeof Sparkles;
  blurb: string;
  prompt: string;
}

// Starter prompts for each task type the user asked for. They are editable —
// "Custom" covers any other ad-hoc request.
const TEMPLATES: Template[] = [
  {
    key: 'summary',
    label: 'Data summary & insights',
    icon: BarChart3,
    blurb: 'Turn raw numbers into a digestible briefing with takeaways.',
    prompt:
      'Act as a business analyst for a ready-mix concrete (RMC) operation. Summarize the following operational data into a concise briefing with 3–5 key insights, notable trends, and recommended actions. Data:\n\n[Paste your orders / dispatch / production figures here]',
  },
  {
    key: 'content',
    label: 'Draft long-form content',
    icon: PenLine,
    blurb: 'Proposals, quotations, and outreach emails, ready to send.',
    prompt:
      'Write a professional [proposal / quotation / outreach email] from a ready-mix concrete supplier to a prospective client. Tone: confident and helpful. Include pricing structure, delivery commitments, and quality assurance. Details:\n\n[Describe the client, project, grades, volume, and any pricing here]',
  },
  {
    key: 'supplier',
    label: 'Research a supplier',
    icon: Search,
    blurb: 'Deep background on a discovered plant or vendor.',
    prompt:
      'Research the following ready-mix concrete supplier and produce a profile covering: company background, plant capacity, grades offered, reputation/reviews, certifications, and any risks for partnering. Supplier:\n\n[Supplier name, location, website, or phone]',
  },
  {
    key: 'market',
    label: 'Business / market report',
    icon: LineChart,
    blurb: 'Deep dive on a market, region, or competitor.',
    prompt:
      'Produce a market report on the ready-mix concrete industry for the following region. Cover market size, demand drivers, key players, pricing trends, regulation, and opportunities for a new entrant. Region / scope:\n\n[City / state / segment]',
  },
  {
    key: 'custom',
    label: 'Something else',
    icon: Sparkles,
    blurb: 'Describe any task in your own words.',
    prompt: '',
  },
];

const STATUS_META: Record<ManusStatus, { label: string; color: string; icon: typeof Clock }> = {
  running: { label: 'Working…', color: 'var(--blue)', icon: Loader2 },
  stopped: { label: 'Completed', color: 'var(--green)', icon: CheckCircle2 },
  waiting: { label: 'Needs input', color: 'var(--gold)', icon: HelpCircle },
  error: { label: 'Failed', color: 'var(--red)', icon: AlertCircle },
  unknown: { label: 'Pending', color: 'var(--muted)', icon: Clock },
};

function fmtDate(ms: number | null): string {
  if (!ms) return '—';
  // Manus timestamps are epoch seconds; tolerate ms too.
  const d = new Date(ms < 1e12 ? ms * 1000 : ms);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function card(style?: React.CSSProperties): React.CSSProperties {
  return {
    background: 'var(--glass-1)', border: '1px solid var(--glass-border)',
    borderRadius: 16, padding: 18, ...style,
  };
}

function StatusBadge({ status }: { status: ManusStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      color: meta.color,
      background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${meta.color} 30%, transparent)`,
    }}>
      <Icon size={12} style={status === 'running' ? { animation: 'spin 1s linear infinite' } : undefined} />
      {meta.label}
    </span>
  );
}

export default function ManusTasks() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [tasks, setTasks] = useState<ManusTaskSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [templateKey, setTemplateKey] = useState<string>('summary');
  const [prompt, setPrompt] = useState<string>(TEMPLATES[0].prompt);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ManusMessagesView | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [sending, setSending] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The task whose view is currently being shown; guards against a stale
  // in-flight response applying after the user switched to another task.
  const activeIdRef = useRef<string | null>(null);

  const refreshList = useCallback(() => {
    setListError('');
    return api.get<ManusTaskList>('/manus/tasks?limit=30')
      .then((res) => { setTasks(res.tasks); })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 503) { setConfigured(false); return; }
        setListError(e instanceof Error ? e.message : 'Could not load tasks.');
      })
      .finally(() => setListLoading(false));
  }, []);

  // Bootstrap: confirm Manus is configured, then load the task list.
  useEffect(() => {
    let active = true;
    api.get<{ configured: boolean }>('/manus/status')
      .then((s) => {
        if (!active) return;
        setConfigured(s.configured);
        if (s.configured) return refreshList();
        setListLoading(false);
      })
      .catch(() => { if (active) { setConfigured(false); setListLoading(false); } });
    return () => { active = false; };
  }, [refreshList]);

  // Fetch + poll the selected task's messages while it is still running.
  // `reset` resets the panel state up front (used on the first load for a newly
  // selected task); poll ticks pass it falsey so the view doesn't flicker.
  const fetchView = useCallback((id: string, reset = false) => {
    // The reset runs in a microtask (not synchronously in the caller/effect
    // body) so every setState here lives inside a promise callback — required by
    // react-hooks/set-state-in-effect.
    const started = reset
      ? Promise.resolve().then(() => {
          if (activeIdRef.current !== id) return;
          setView(null); setViewError(''); setViewLoading(true);
        })
      : Promise.resolve();
    return started
      .then(() => api.get<ManusMessagesView>(`/manus/tasks/${encodeURIComponent(id)}/messages?limit=80`))
      .then((v) => {
        // Ignore responses for a task the user has since navigated away from.
        if (activeIdRef.current !== id) return;
        setView(v);
        setViewError('');
        if (pollRef.current && (v.status === 'stopped' || v.status === 'error')) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      })
      .catch((e) => {
        if (activeIdRef.current !== id) return;
        setViewError(e instanceof Error ? e.message : 'Could not load this task.');
      })
      .finally(() => { if (reset && activeIdRef.current === id) setViewLoading(false); });
  }, []);

  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    // No selection: the detail panel is gated on `selectedId` in render, so the
    // stale `view` is never shown — avoid a synchronous setState reset here.
    activeIdRef.current = selectedId;
    if (!selectedId) return;
    fetchView(selectedId, true);
    pollRef.current = setInterval(() => { fetchView(selectedId); }, 6000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [selectedId, fetchView]);

  function chooseTemplate(t: Template) {
    setTemplateKey(t.key);
    setLaunchError('');
    // Only overwrite the editor if it still holds the previous template's text
    // (don't clobber what the user has typed).
    setPrompt((cur) => {
      const prev = TEMPLATES.find((x) => x.key === templateKey);
      if (prev && cur === prev.prompt) return t.prompt;
      if (!cur.trim()) return t.prompt;
      return cur;
    });
  }

  async function launch() {
    const text = prompt.trim();
    if (!text) { setLaunchError('Write a prompt first.'); return; }
    setLaunching(true);
    setLaunchError('');
    try {
      const created = await api.post<CreatedTask>('/manus/tasks', { prompt: text });
      await refreshList();
      if (created.taskId) setSelectedId(created.taskId);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) { setConfigured(false); return; }
      setLaunchError(e instanceof Error ? e.message : 'Could not launch the task.');
    } finally {
      setLaunching(false);
    }
  }

  async function sendFollowUp() {
    const text = followUp.trim();
    if (!text || !selectedId) return;
    setSending(true);
    try {
      await api.post(`/manus/tasks/${encodeURIComponent(selectedId)}/messages`, { prompt: text });
      setFollowUp('');
      // Resume polling — the task goes back to running.
      setViewLoading(true);
      await fetchView(selectedId);
      setViewLoading(false);
      if (!pollRef.current) {
        pollRef.current = setInterval(() => { fetchView(selectedId); }, 6000);
      }
    } catch (e) {
      setViewError(e instanceof Error ? e.message : 'Could not send your message.');
    } finally {
      setSending(false);
    }
  }

  const selectedTask = tasks.find((t) => t.id === selectedId) || null;

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center',
          background: 'color-mix(in srgb, var(--gold) 14%, transparent)',
          border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)', color: 'var(--gold)',
        }}>
          <Sparkles size={20} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>Manus AI Tasks</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Launch deep, long-running AI work — research, drafting, and reports — and pull results back here.
          </p>
        </div>
      </div>

      {configured === false && (
        <div style={card({ marginTop: 16, borderColor: 'color-mix(in srgb, var(--red) 30%, transparent)' })}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--red)', fontWeight: 700, fontSize: 14 }}>
            <AlertCircle size={18} /> Manus AI is not configured
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            The MANUS_API_KEY is missing on the server. Add it and reload to enable AI tasks.
          </p>
        </div>
      )}

      {configured !== false && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)', gap: 16, marginTop: 16, alignItems: 'start' }}>
          {/* Left: launcher + task list */}
          <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
            {/* Launcher */}
            <div style={card()}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>New task</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {TEMPLATES.map((t) => {
                  const Icon = t.icon;
                  const active = t.key === templateKey;
                  return (
                    <button
                      key={t.key}
                      onClick={() => chooseTemplate(t)}
                      title={t.blurb}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                        padding: '7px 11px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                        color: active ? 'var(--gold)' : 'var(--muted)',
                        background: active ? 'color-mix(in srgb, var(--gold) 14%, transparent)' : 'var(--chip-bg)',
                        border: active ? '1px solid color-mix(in srgb, var(--gold) 45%, transparent)' : '1px solid var(--line)',
                      }}
                    >
                      <Icon size={13} /> {t.label}
                    </button>
                  );
                })}
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what you want Manus to do…"
                rows={8}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical',
                  background: 'var(--input-bg, var(--chip-bg))', color: 'var(--text)',
                  border: '1px solid var(--line)', borderRadius: 12, padding: 12,
                  fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit',
                }}
              />
              {launchError && (
                <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 8 }}>{launchError}</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 10 }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Runs asynchronously and uses Manus credits.</span>
                <button
                  onClick={launch}
                  disabled={launching}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    cursor: launching ? 'wait' : 'pointer', opacity: launching ? 0.65 : 1,
                    background: 'var(--gold)', color: '#06231d', fontWeight: 800, fontSize: 13,
                    border: 'none', borderRadius: 11, padding: '10px 16px',
                  }}
                >
                  {launching ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={15} />}
                  {launching ? 'Launching…' : 'Run with Manus'}
                </button>
              </div>
            </div>

            {/* Task list / sync */}
            <div style={card()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Your Manus tasks</div>
                <button
                  onClick={() => { setListLoading(true); refreshList(); }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    background: 'var(--chip-bg)', color: 'var(--muted)', border: '1px solid var(--line)',
                    borderRadius: 9, padding: '6px 10px', fontSize: 12, fontWeight: 700,
                  }}
                >
                  <RefreshCw size={13} style={listLoading ? { animation: 'spin 1s linear infinite' } : undefined} />
                  Sync
                </button>
              </div>
              {listError && <div style={{ color: 'var(--red)', fontSize: 12.5, marginBottom: 8 }}>{listError}</div>}
              {listLoading && tasks.length === 0 && (
                <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>Loading…</div>
              )}
              {!listLoading && tasks.length === 0 && !listError && (
                <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>
                  No tasks yet. Launch one above — tasks you create in the Manus app will also appear here.
                </div>
              )}
              <div style={{ display: 'grid', gap: 8 }}>
                {tasks.map((t) => {
                  const active = t.id === selectedId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      style={{
                        textAlign: 'left', cursor: 'pointer', width: '100%',
                        background: active ? 'color-mix(in srgb, var(--gold) 10%, transparent)' : 'var(--chip-bg)',
                        border: active ? '1px solid color-mix(in srgb, var(--gold) 40%, transparent)' : '1px solid var(--line)',
                        borderRadius: 12, padding: '11px 12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{
                          fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                        }}>
                          {t.title || 'Untitled task'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, fontSize: 11, color: 'var(--muted)' }}>
                        <span>{fmtDate(t.createdAt)}</span>
                        {t.creditUsage != null && <span>· {t.creditUsage} credits</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: selected task detail */}
          <div style={card({ position: 'sticky', top: 16, minWidth: 0 })}>
            {!selectedId && (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>
                <FileText size={26} style={{ opacity: 0.5, marginBottom: 8 }} />
                <div>Select a task to see its progress and results.</div>
              </div>
            )}

            {selectedId && (
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 320 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedTask?.title || 'Task'}
                    </div>
                    <div style={{ marginTop: 6 }}>{view && <StatusBadge status={view.status} />}</div>
                  </div>
                  {selectedTask?.taskUrl && (
                    <a
                      href={selectedTask.taskUrl} target="_blank" rel="noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                        color: 'var(--muted)', fontSize: 12, fontWeight: 700, textDecoration: 'none',
                        background: 'var(--chip-bg)', border: '1px solid var(--line)', borderRadius: 9, padding: '6px 10px',
                      }}
                    >
                      Open in Manus <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                {viewLoading && !view && (
                  <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Loading task…</div>
                )}
                {viewError && <div style={{ color: 'var(--red)', fontSize: 12.5, marginBottom: 8 }}>{viewError}</div>}

                {view?.status === 'waiting' && view.waitingFor && (
                  <div style={{
                    fontSize: 12.5, color: 'var(--gold)', background: 'color-mix(in srgb, var(--gold) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)', borderRadius: 10, padding: '8px 10px', marginBottom: 10,
                  }}>
                    Manus needs your input: {view.waitingFor}
                  </div>
                )}
                {view?.status === 'error' && view.errorText && (
                  <div style={{
                    fontSize: 12.5, color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)', borderRadius: 10, padding: '8px 10px', marginBottom: 10,
                  }}>
                    {view.errorText}
                  </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 460 }}>
                  {view && view.resultText ? (
                    <pre style={{
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                      fontSize: 13, lineHeight: 1.6, color: 'var(--text)', fontFamily: 'inherit',
                    }}>{view.resultText}</pre>
                  ) : view && view.status === 'running' ? (
                    <div style={{ color: 'var(--muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                      <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Manus is working on this…
                    </div>
                  ) : view && !view.resultText ? (
                    <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>
                      No text output yet. Open the task in Manus for full details.
                    </div>
                  ) : null}
                </div>

                {/* Follow-up */}
                <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <textarea
                      value={followUp}
                      onChange={(e) => setFollowUp(e.target.value)}
                      placeholder="Send a follow-up to Manus…"
                      rows={2}
                      style={{
                        flex: 1, boxSizing: 'border-box', resize: 'vertical',
                        background: 'var(--input-bg, var(--chip-bg))', color: 'var(--text)',
                        border: '1px solid var(--line)', borderRadius: 10, padding: 9,
                        fontSize: 13, fontFamily: 'inherit',
                      }}
                    />
                    <button
                      onClick={sendFollowUp}
                      disabled={sending || !followUp.trim()}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        cursor: sending || !followUp.trim() ? 'not-allowed' : 'pointer',
                        opacity: sending || !followUp.trim() ? 0.55 : 1,
                        background: 'var(--gold)', color: '#06231d', fontWeight: 800, fontSize: 13,
                        border: 'none', borderRadius: 10, padding: '10px 13px',
                      }}
                    >
                      {sending ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
