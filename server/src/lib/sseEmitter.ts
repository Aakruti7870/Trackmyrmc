import type { Response } from 'express';

// Identity of the authenticated user behind an SSE connection. Used to scope
// targeted events so a client/driver only receives notifications about their
// own orders/trips. A connection registered without an identity (e.g. internal
// test observers) acts as a wildcard receiver and gets every event.
export type SSEIdentity = {
  role: string;
  clientId?: number | null;
  driverId?: number | null;
  plantId?: number | null;
};

// Describes who an event pertains to. Staff roles always receive targeted
// events; a client receives one whose `clientId` matches their linked client,
// and a driver receives one whose `driverId` matches their linked driver.
// Omitting the audience entirely broadcasts to every connection.
//
// `roles` is an explicit allow-list: when present it overrides the default
// staff/client/driver routing and delivers ONLY to connections whose role is
// listed (e.g. `{ roles: ['admin', 'authority'] }` for admin-only alerts that
// must reach the `authority` super-admin, which is not part of STAFF_ROLES).
//
// `platformOnly` further restricts a role-targeted event to PLATFORM staff:
// connections whose identity has no plantId (plantId == null). Plant-bound
// users of an allowed role are excluded, mirroring the isPlatformStaff guard
// on the corresponding REST endpoints (e.g. the WhatsApp chat inbox).
export type SSEAudience = {
  clientId?: number | null;
  driverId?: number | null;
  roles?: string[];
  platformOnly?: boolean;
};

const STAFF_ROLES = new Set(['admin', 'dispatcher', 'plant_operator']);

type SSEClient = {
  id: number;
  res: Response;
  lastActive: number;
  identity?: SSEIdentity;
};

function clientMayReceive(client: SSEClient, audience?: SSEAudience): boolean {
  // No targeting → broadcast to everyone.
  if (!audience) return true;
  const identity = client.identity;
  // Identity-less observers (e.g. test capture clients) receive everything.
  if (!identity) return true;
  // An explicit role allow-list takes precedence over the default routing so
  // an alert can be scoped to exactly the named roles (including `authority`,
  // which STAFF_ROLES does not cover).
  if (audience.roles) {
    if (!audience.roles.includes(identity.role)) return false;
    // Platform-only events never reach plant-bound users, even of an allowed
    // role — same boundary as the isPlatformStaff REST guard.
    if (audience.platformOnly && identity.plantId != null) return false;
    return true;
  }
  // Staff see all order/trip activity.
  if (STAFF_ROLES.has(identity.role)) return true;
  if (identity.role === 'client') {
    return audience.clientId != null && identity.clientId === audience.clientId;
  }
  if (identity.role === 'driver') {
    return audience.driverId != null && identity.driverId === audience.driverId;
  }
  return false;
}

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

export function addSSEClient(res: Response, identity?: SSEIdentity): number {
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
  clients.set(id, { id, res, lastActive: Date.now(), identity });
  ensureTimers();
  return id;
}

export function removeSSEClient(id: number): void {
  dropClient(id);
}

export function emitSSEEvent(event: string, data: unknown, audience?: SSEAudience): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients.values()) {
    if (!clientMayReceive(client, audience)) continue;
    if (!writeToClient(client, payload)) dropClient(client.id);
  }
}

export function getSSEClientCount(): number {
  return clients.size;
}
