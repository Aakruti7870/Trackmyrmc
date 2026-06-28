// Manus AI v2 REST client. This runs SERVER-SIDE ONLY — the MANUS_API_KEY must
// never reach the browser. Manus is a separate, asynchronous "deep task" engine
// that complements the live in-app Gemini Help Agent: the user launches a task
// (research, long-form drafting, reports) and Manus works on it in the
// background. Because Manus itself stores every task, the same account key lets
// us PULL the full task history back (task.list) — that is the "Sync from Manus"
// view, and it also surfaces tasks the user created directly in the Manus app.
//
// API contract (https://open.manus.im/docs/v2): base https://api.manus.ai, auth
// header `x-manus-api-key`, every response wrapped as
//   { ok: true,  request_id, ... }              (success)
//   { ok: false, request_id, error: { code, message } }  (failure)

const MANUS_BASE = (process.env.MANUS_API_BASE || 'https://api.manus.ai').replace(/\/$/, '');

export class ManusError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ManusError';
    this.status = status;
    this.code = code;
  }
}

export function isManusConfigured(): boolean {
  return !!process.env.MANUS_API_KEY;
}

type QueryValue = string | number | undefined | null;

async function manusFetch<T>(
  path: string,
  init: { method?: string; query?: Record<string, QueryValue>; body?: unknown } = {},
): Promise<T> {
  const key = process.env.MANUS_API_KEY;
  if (!key) throw new ManusError('Manus AI is not configured.', 503, 'not_configured');

  const url = new URL(MANUS_BASE + path);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method || 'GET',
      headers: {
        'x-manus-api-key': key,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ManusError('Could not reach Manus AI. Please try again.', 502, 'network');
  }

  let json: unknown = null;
  try { json = await res.json(); } catch { /* non-JSON / empty body */ }

  const wrapper = (json && typeof json === 'object') ? json as Record<string, unknown> : null;
  if (!res.ok || (wrapper && wrapper.ok === false)) {
    const errObj = wrapper && typeof wrapper.error === 'object' && wrapper.error
      ? wrapper.error as Record<string, unknown>
      : null;
    const code = errObj && typeof errObj.code === 'string' ? errObj.code : undefined;
    const msg = (errObj && typeof errObj.message === 'string' && errObj.message)
      || `Manus request failed (${res.status}).`;
    throw new ManusError(msg, res.status || 502, code);
  }

  return json as T;
}

// ---- Public shapes (only the fields we consume) ----------------------------

export interface ManusCreatedTask {
  taskId: string;
  title: string | null;
  taskUrl: string | null;
  shareUrl: string | null;
}

export interface ManusTaskSummary {
  id: string;
  title: string | null;
  createdAt: number | null;
  updatedAt: number | null;
  creditUsage: number | null;
  taskUrl: string | null;
}

export interface ManusTaskList {
  tasks: ManusTaskSummary[];
  hasMore: boolean;
  nextCursor: string | null;
}

export type ManusStatus = 'running' | 'stopped' | 'waiting' | 'error' | 'unknown';

export interface ManusMessagesView {
  status: ManusStatus;
  // Concatenated agent text (best-effort across event shapes).
  resultText: string;
  // Most recent error detail, when status === 'error'.
  errorText: string | null;
  // What the agent is waiting on, when status === 'waiting'.
  waitingFor: string | null;
  // Raw events passed through for the client to render if it wants more detail.
  events: unknown[];
}

// ---- Helpers ---------------------------------------------------------------

function asString(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// Pulls text out of an event whatever the exact shape: a top-level `content`
// string, a `content[].text` array, or a nested `text` field.
function extractEventText(ev: Record<string, unknown>): string {
  const parts: string[] = [];
  const c = ev.content;
  if (typeof c === 'string') parts.push(c);
  else if (Array.isArray(c)) {
    for (const block of c) {
      if (block && typeof block === 'object') {
        const t = (block as Record<string, unknown>).text;
        if (typeof t === 'string') parts.push(t);
      } else if (typeof block === 'string') parts.push(block);
    }
  }
  const t = ev.text;
  if (typeof t === 'string') parts.push(t);
  return parts.join('').trim();
}

// ---- API surface -----------------------------------------------------------

export async function createTask(prompt: string): Promise<ManusCreatedTask> {
  const json = await manusFetch<Record<string, unknown>>('/v2/task.create', {
    method: 'POST',
    body: { message: { content: [{ type: 'text', text: prompt }] } },
  });
  return {
    taskId: asString(json.task_id) ?? '',
    title: asString(json.task_title),
    taskUrl: asString(json.task_url),
    shareUrl: asString(json.share_url),
  };
}

export async function listTasks(opts: { limit?: number; cursor?: string } = {}): Promise<ManusTaskList> {
  const json = await manusFetch<Record<string, unknown>>('/v2/task.list', {
    query: { limit: opts.limit, cursor: opts.cursor },
  });
  const data = Array.isArray(json.data) ? json.data : [];
  const tasks: ManusTaskSummary[] = data.map((raw) => {
    const t = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
    return {
      id: asString(t.id) ?? '',
      title: asString(t.title),
      createdAt: asNumber(t.created_at),
      updatedAt: asNumber(t.updated_at),
      creditUsage: asNumber(t.credit_usage),
      taskUrl: asString(t.task_url),
    };
  }).filter((t) => t.id);
  return {
    tasks,
    hasMore: json.has_more === true,
    nextCursor: asString(json.next_cursor),
  };
}

export async function getTaskDetail(taskId: string): Promise<unknown> {
  const json = await manusFetch<Record<string, unknown>>('/v2/task.detail', {
    query: { task_id: taskId },
  });
  return json.task ?? null;
}

export async function listTaskMessages(
  taskId: string,
  opts: { order?: string; limit?: number; cursor?: string } = {},
): Promise<ManusMessagesView> {
  const json = await manusFetch<Record<string, unknown>>('/v2/task.listMessages', {
    query: { task_id: taskId, order: opts.order, limit: opts.limit, cursor: opts.cursor },
  });

  const events: unknown[] = Array.isArray(json.messages)
    ? json.messages
    : Array.isArray(json.data)
      ? json.data
      : [];

  let status: ManusStatus = 'unknown';
  let errorText: string | null = null;
  let waitingFor: string | null = null;
  const textChunks: string[] = [];

  // Events may arrive newest-first or oldest-first; the latest status wins.
  // We scan in order and let later status_update events overwrite earlier ones,
  // then (if needed) fall back to the very first one we saw.
  let sawStatus = false;
  for (const raw of events) {
    if (!raw || typeof raw !== 'object') continue;
    const ev = raw as Record<string, unknown>;
    const type = asString(ev.type) ?? '';

    if (type === 'status_update' || ev.status_update) {
      const su = (ev.status_update && typeof ev.status_update === 'object')
        ? ev.status_update as Record<string, unknown>
        : ev;
      const agentStatus = asString(su.agent_status);
      if (agentStatus === 'running' || agentStatus === 'stopped' || agentStatus === 'waiting' || agentStatus === 'error') {
        status = agentStatus;
        sawStatus = true;
        const detail = (su.status_detail && typeof su.status_detail === 'object')
          ? su.status_detail as Record<string, unknown>
          : null;
        if (agentStatus === 'waiting' && detail) {
          waitingFor = asString(detail.waiting_description) ?? asString(detail.waiting_for_event_type);
        }
      }
      continue;
    }

    if (/error/i.test(type)) {
      const t = extractEventText(ev);
      if (t) errorText = t;
      continue;
    }

    // User echoes are ignored; everything else with text is treated as agent output.
    const role = asString(ev.role) ?? asString(ev.message_type) ?? '';
    if (/user/i.test(role) || type === 'user_message') continue;

    const t = extractEventText(ev);
    if (t) textChunks.push(t);
  }

  if (!sawStatus && errorText) status = 'error';

  return {
    status,
    resultText: textChunks.join('\n\n').trim(),
    errorText,
    waitingFor,
    events,
  };
}

export async function sendTaskMessage(taskId: string, prompt: string): Promise<void> {
  await manusFetch('/v2/task.sendMessage', {
    method: 'POST',
    body: { task_id: taskId, message: { content: [{ type: 'text', text: prompt }] } },
  });
}
