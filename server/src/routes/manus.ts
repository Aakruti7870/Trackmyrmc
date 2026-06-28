import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { rateLimit } from '../lib/rateLimit.js';
import {
  isManusConfigured, ManusError,
  createTask, listTasks, getTaskDetail, listTaskMessages, sendTaskMessage,
} from '../lib/manus.js';

// Manus AI "deep task" hub. Management-only (authority / admin / plant_owner):
// these tasks consume Manus credits and produce business-grade output
// (research, proposals, reports), so they sit behind the same surface as the
// other admin tools. The MANUS_API_KEY lives only on the server — the browser
// talks to these proxy routes, never to Manus directly.
const router = Router();
router.use(requireAuth);
router.use(requireRole('authority', 'admin', 'plant_owner'));

const MAX_PROMPT_LEN = 8000;

// Translate a ManusError into an HTTP response. A missing key is a 503 (the UI
// shows a "not configured" state); upstream 4xx/5xx are forwarded as-is.
function sendManusError(res: import('express').Response, err: unknown): void {
  if (err instanceof ManusError) {
    const status = err.code === 'not_configured' ? 503 : (err.status >= 400 ? err.status : 502);
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }
  console.error('[manus] unexpected error', err);
  res.status(500).json({ error: 'Something went wrong talking to Manus AI.' });
}

function readPrompt(body: unknown): string | null {
  const prompt = (body && typeof body === 'object') ? (body as Record<string, unknown>).prompt : undefined;
  if (typeof prompt !== 'string') return null;
  const trimmed = prompt.trim();
  if (!trimmed || trimmed.length > MAX_PROMPT_LEN) return null;
  return trimmed;
}

// Lightweight config the frontend uses to decide whether to show the hub.
router.get('/status', (_req, res) => {
  res.json({ configured: isManusConfigured() });
});

// Launch a new Manus task.
router.post(
  '/tasks',
  rateLimit({ windowMs: 60_000, max: 20, name: 'manus-create' }),
  async (req, res) => {
    const prompt = readPrompt(req.body);
    if (!prompt) {
      res.status(400).json({ error: `Provide a prompt (1–${MAX_PROMPT_LEN} characters).` });
      return;
    }
    try {
      const task = await createTask(prompt);
      res.status(201).json(task);
    } catch (err) {
      sendManusError(res, err);
    }
  },
);

// List / sync the account's Manus tasks (includes tasks made in the Manus app).
router.get('/tasks', async (req, res) => {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : 20;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  try {
    const list = await listTasks({ limit, cursor });
    res.json(list);
  } catch (err) {
    sendManusError(res, err);
  }
});

// Status + metadata for a single task.
router.get('/tasks/:id', async (req, res) => {
  try {
    const task = await getTaskDetail(req.params.id);
    res.json({ task });
  } catch (err) {
    sendManusError(res, err);
  }
});

// Normalized conversation/result view for a task (status, agent text, errors).
// The frontend polls this every few seconds while a task is running, so cap it
// to keep polling-induced upstream calls (and Manus spend) bounded per client.
router.get('/tasks/:id/messages', rateLimit({ windowMs: 60_000, max: 60, name: 'manus-messages' }), async (req, res) => {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : 50;
  const order = typeof req.query.order === 'string' ? req.query.order : 'desc';
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
  try {
    const view = await listTaskMessages(req.params.id, { limit, order, cursor });
    res.json(view);
  } catch (err) {
    sendManusError(res, err);
  }
});

// Send a follow-up message to an existing task (multi-turn).
router.post(
  '/tasks/:id/messages',
  rateLimit({ windowMs: 60_000, max: 30, name: 'manus-message' }),
  async (req, res) => {
    const prompt = readPrompt(req.body);
    if (!prompt) {
      res.status(400).json({ error: `Provide a message (1–${MAX_PROMPT_LEN} characters).` });
      return;
    }
    try {
      await sendTaskMessage(String(req.params.id), prompt);
      res.status(202).json({ ok: true });
    } catch (err) {
      sendManusError(res, err);
    }
  },
);

export default router;
