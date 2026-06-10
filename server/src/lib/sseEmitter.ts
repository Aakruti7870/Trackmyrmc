import type { Response } from 'express';

type SSEClient = { id: number; res: Response; lastActive: number };

// Keepalive must stay well under the shortest common proxy idle timeout.
// nginx / Cloudflare / Replit's deployment proxy buffer or drop idle streams
// after ~30-60s, so 15s gives at least two pings inside a 30s window.
export const KEEPALIVE_MS = 15_000;
// How often the sweep checks for dead connections.
export const SWEEP_MS = 20_000;
// A connection whose socket has not accepted a flushed write for this long
// (e.g. the proxy died mid-stream and never fired a 'close' event, leaving
// the response in permanent backpressure) is reclaimed.
export const STALE_THRESHOLD_MS = 60_000;

let clientId = 0;
const clients: Map<number, SSEClient> = new Map();
let timers: { keepAlive: NodeJS.Timeout; sweep: NodeJS.Timeout } | null = null;

function writeToClient(client: SSEClient, payload: string): boolean {
  const { res } = client;
  if (res.writableEnded || res.destroyed) return false;
  try {
    // res.write returns false under backpressure (kernel/proxy buffer full).
    // Only treat a fully-flushed write as proof of liveness so a stalled
    // socket eventually ages past STALE_THRESHOLD_MS and gets swept.
    const flushed = res.write(payload);
    if (flushed) client.lastActive = Date.now();
    return true;
  } catch {
    return false;
  }
}

function dropClient(id: number): void {
  const client = clients.get(id);
  if (!client) return;
  clients.delete(id);
  try {
    client.res.end();
  } catch {
    /* socket already gone */
  }
}

function ensureTimers(): void {
  if (timers) return;
  const keepAlive = setInterval(() => {
    for (const client of clients.values()) {
      if (!writeToClient(client, ':ping\n\n')) dropClient(client.id);
    }
  }, KEEPALIVE_MS);
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const client of clients.values()) {
      const dead =
        client.res.writableEnded ||
        client.res.destroyed ||
        now - client.lastActive > STALE_THRESHOLD_MS;
      if (dead) dropClient(client.id);
    }
  }, SWEEP_MS);
  // Don't keep the process alive solely for these timers.
  keepAlive.unref?.();
  sweep.unref?.();
  timers = { keepAlive, sweep };
}

export function addSSEClient(res: Response): number {
  const id = ++clientId;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Disable proxy buffering (nginx) so events are forwarded immediately.
  res.setHeader('X-Accel-Buffering', 'no');
  // Force chunked streaming on HTTP/1.x. Without an explicit length some
  // proxies otherwise try to buffer the whole response. Invalid on HTTP/2,
  // where framing is implicit, so only set it on HTTP/1.x.
  if (res.req?.httpVersionMajor === 1) {
    res.setHeader('Transfer-Encoding', 'chunked');
  }
  res.flushHeaders();
  res.write(':ok\n\n');
  clients.set(id, { id, res, lastActive: Date.now() });
  ensureTimers();
  return id;
}

export function removeSSEClient(id: number): void {
  dropClient(id);
}

export function emitSSEEvent(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients.values()) {
    if (!writeToClient(client, payload)) dropClient(client.id);
  }
}

export function getSSEClientCount(): number {
  return clients.size;
}
