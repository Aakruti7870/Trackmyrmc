import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Response } from 'express';

import {
  addSSEClient,
  removeSSEClient,
  getSSEClientCount,
  emitSSEEvent,
  KEEPALIVE_MS,
  SWEEP_MS,
  STALE_THRESHOLD_MS,
  type SSEIdentity,
} from '../lib/sseEmitter.js';

// A minimal stand-in for the Express Response object that the SSE emitter
// writes to. It records headers and writes, and lets a test simulate
// backpressure (write returns false) or a closed socket (writableEnded).
class MockResponse {
  headers: Record<string, string> = {};
  writes: string[] = [];
  writableEnded = false;
  destroyed = false;
  ended = false;
  // Controls what res.write() returns. false simulates a full kernel/proxy
  // buffer (backpressure) so the write is never treated as flushed.
  writeReturn = true;
  // When true, res.write() throws synchronously, simulating a socket that is
  // torn down mid-write (e.g. ERR_STREAM_DESTROYED) without writableEnded /
  // destroyed having been observed first.
  throwOnWrite = false;
  req: { httpVersionMajor: number };

  constructor(httpVersionMajor = 1) {
    this.req = { httpVersionMajor };
  }

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  flushHeaders() {}

  write(payload: string): boolean {
    if (this.throwOnWrite) throw new Error('write after end');
    this.writes.push(payload);
    return this.writeReturn;
  }

  end() {
    this.ended = true;
    this.writableEnded = true;
  }
}

function add(res: MockResponse): number {
  return addSSEClient(res as unknown as Response);
}

function addWithIdentity(res: MockResponse, identity: SSEIdentity): number {
  return addSSEClient(res as unknown as Response, identity);
}

// Returns the SSE event names a mock response actually received.
function eventsOf(res: MockResponse): string[] {
  return res.writes
    .map((chunk) => /^event: (.+)$/m.exec(chunk)?.[1])
    .filter((e): e is string => Boolean(e));
}

// The emitter keeps a module-level client map and a single pair of shared
// timers created lazily on the first connection. Enable the fake clock ONCE
// for the whole file: the keepalive/sweep intervals are a singleton, so
// resetting the clock between tests would orphan them and leave later tests
// without any firing timers. Clients are cleaned up after each test instead.
const created: number[] = [];

before(() => {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
});

after(() => {
  mock.timers.reset();
});

afterEach(() => {
  for (const id of created) removeSSEClient(id);
  created.length = 0;
  assert.equal(getSSEClientCount(), 0, 'all clients should be cleaned up between tests');
});

test('keepalive: a ping is written within the configured interval', () => {
  const res = new MockResponse(1);
  const id = add(res);
  created.push(id);

  // The opening ':ok' is written immediately; ignore it and watch for the ping.
  res.writes.length = 0;

  // Just before the interval elapses, no ping has been sent yet.
  mock.timers.tick(KEEPALIVE_MS - 1);
  assert.ok(
    !res.writes.includes(':ping\n\n'),
    'no keepalive ping should be sent before the interval elapses',
  );

  // Crossing the interval boundary triggers exactly one keepalive ping.
  mock.timers.tick(1);
  assert.ok(
    res.writes.includes(':ping\n\n'),
    'a keepalive ping must be sent once the interval elapses',
  );
});

test('keepalive cadence stays well under the common proxy idle timeout', () => {
  // Regression guard: nginx / Cloudflare / Replit proxies drop idle streams
  // after ~30s. Two pings must fit inside that window, so the interval must
  // stay at or below 15s. Bumping it back up would silently kill live updates.
  assert.ok(
    KEEPALIVE_MS * 2 <= 30_000,
    `KEEPALIVE_MS (${KEEPALIVE_MS}) must allow two pings inside a 30s proxy window`,
  );
});

test('keepalive: an idle connection keeps receiving pings across several intervals', () => {
  // The whole point of the keepalive is that a stream which never emits an
  // application event still gets periodic ':ping' writes so proxies don't drop
  // it. Drive the clock across many KEEPALIVE_MS intervals with NO events
  // emitted and confirm one ping lands per interval.
  const res = new MockResponse(1);
  const id = add(res);
  created.push(id);

  // The opening ':ok' is written immediately; ignore it and count only pings.
  res.writes.length = 0;

  const intervals = 5;
  for (let i = 0; i < intervals; i++) {
    mock.timers.tick(KEEPALIVE_MS);
  }

  const pings = res.writes.filter((w) => w === ':ping\n\n').length;
  assert.equal(
    pings,
    intervals,
    `an idle connection must receive exactly one keepalive ping per interval (expected ${intervals})`,
  );
});

test('keepalive: a flushing idle connection refreshes lastActive and is never swept past the stale threshold', () => {
  // Each flushed ping advances the connection's lastActive. If that refresh
  // ever stopped, the first sweep after STALE_THRESHOLD_MS would reclaim the
  // (still perfectly healthy) idle connection. Run the keepalive for several
  // multiples of STALE_THRESHOLD_MS and assert the connection both survives
  // every sweep and keeps accruing one fresh ping per interval.
  const res = new MockResponse(1);
  const id = add(res);
  created.push(id);

  // Drop the opening ':ok'; from here the stream is fully idle.
  res.writes.length = 0;

  const cycles = Math.ceil((STALE_THRESHOLD_MS * 3) / KEEPALIVE_MS);
  let lastPingCount = 0;
  for (let i = 0; i < cycles; i++) {
    mock.timers.tick(KEEPALIVE_MS);
    assert.equal(
      getSSEClientCount(),
      1,
      'a flushing idle connection must never be swept while its pings keep flushing',
    );
    const pings = res.writes.filter((w) => w === ':ping\n\n').length;
    assert.ok(
      pings > lastPingCount,
      'each elapsed interval must add a fresh keepalive ping (proof lastActive is refreshing)',
    );
    lastPingCount = pings;
  }

  assert.ok(
    lastPingCount >= cycles,
    'the idle connection should have received a ping for every elapsed interval',
  );
});

test('sweep: a closed connection is removed from the client map', () => {
  const res = new MockResponse(1);
  const id = add(res);
  created.push(id);
  assert.equal(getSSEClientCount(), 1);

  // Simulate the socket closing without a 'close' event reaching the route.
  res.writableEnded = true;

  // Advancing past one sweep interval reclaims the dead connection.
  mock.timers.tick(SWEEP_MS);
  assert.equal(getSSEClientCount(), 0, 'a closed connection should be swept out');
});

test('sweep: a stalled (backpressured) connection ages out after the stale threshold', () => {
  const res = new MockResponse(1);
  const id = add(res);
  created.push(id);
  assert.equal(getSSEClientCount(), 1);

  // The proxy died mid-stream: writes never flush, so lastActive never advances.
  // The socket is not "ended", so only the TTL sweep can reclaim it.
  res.writeReturn = false;

  // Before the stale threshold elapses the connection is still considered live
  // even though every keepalive write is backpressured.
  mock.timers.tick(STALE_THRESHOLD_MS);
  assert.equal(
    getSSEClientCount(),
    1,
    'a backpressured connection should survive until it crosses the stale threshold',
  );

  // One more sweep after the threshold has been exceeded reclaims it.
  mock.timers.tick(SWEEP_MS);
  assert.equal(getSSEClientCount(), 0, 'a stalled connection must be swept once it goes stale');
});

test('sweep: a destroyed socket (no close event) is reclaimed', () => {
  const res = new MockResponse(1);
  const id = add(res);
  created.push(id);
  assert.equal(getSSEClientCount(), 1);

  // The underlying socket was torn down (e.g. the proxy vanished) so the
  // response is marked destroyed, but no 'close' event ever reached the route
  // to call removeSSEClient. The sweep is the only thing that can reclaim it.
  res.destroyed = true;

  mock.timers.tick(SWEEP_MS);
  assert.equal(getSSEClientCount(), 0, 'a destroyed socket must be swept out');
});

test('sweep: a healthy connection survives the sweep', () => {
  const res = new MockResponse(1);
  const id = add(res);
  created.push(id);
  assert.equal(getSSEClientCount(), 1);

  // The socket is open and every keepalive ping flushes (writeReturn stays
  // true), so lastActive keeps advancing and the connection never goes stale.
  // Drive several sweep cycles well past the stale threshold; the keepalive
  // must refresh lastActive between sweeps so the connection is always live.
  // (Ticked one sweep window at a time so the singleton keepalive interval
  // gets to fire between sweeps, exactly as it would against a real clock.)
  const cycles = Math.ceil(STALE_THRESHOLD_MS / SWEEP_MS) + 3;
  for (let i = 0; i < cycles; i++) {
    mock.timers.tick(SWEEP_MS);
    assert.equal(
      getSSEClientCount(),
      1,
      'a live, flushing connection must never be swept out',
    );
  }

  assert.ok(
    res.writes.includes(':ping\n\n'),
    'the surviving connection should still be receiving keepalive pings',
  );
});

test('emit: a broken connection is dropped during a broadcast while the healthy one survives', () => {
  // Two observers are listening. One socket has already closed (writableEnded)
  // without a 'close' event reaching the route, so it must be reclaimed the
  // moment we try to write to it — not 20s later on the next sweep.
  const broken = new MockResponse(2);
  const healthy = new MockResponse(2);
  const brokenId = add(broken);
  const healthyId = add(healthy);
  created.push(brokenId, healthyId);
  assert.equal(getSSEClientCount(), 2);

  broken.writableEnded = true;

  // A real event broadcast: writeToClient fails for the dead socket and
  // emitSSEEvent drops it inline.
  emitSSEEvent('system.notice', { message: 'hello' });

  assert.equal(
    getSSEClientCount(),
    1,
    'the broken connection must be dropped during emit, not left for the sweep',
  );
  assert.ok(broken.ended, 'the dropped connection should have been ended');
  assert.ok(
    eventsOf(healthy).includes('system.notice'),
    'the healthy connection must still receive the broadcast event',
  );
  // The healthy connection is the survivor; remove the (already gone) broken id
  // from the cleanup list so afterEach does not assert on a missing client.
  created.length = 0;
  created.push(healthyId);
});

test('emit: a connection whose write() throws synchronously is dropped mid-broadcast', () => {
  // Exercises the try/catch in writeToClient: the socket is not flagged as
  // ended/destroyed, but write() throws (e.g. ERR_STREAM_DESTROYED) the instant
  // we push the payload. That throwing client must be reclaimed during emit.
  const throwing = new MockResponse(2);
  const healthy = new MockResponse(2);
  const throwingId = add(throwing);
  const healthyId = add(healthy);
  created.push(throwingId, healthyId);
  assert.equal(getSSEClientCount(), 2);

  throwing.throwOnWrite = true;

  emitSSEEvent('system.notice', { message: 'hello' });

  assert.equal(
    getSSEClientCount(),
    1,
    'a connection whose write throws must be dropped during emit',
  );
  assert.ok(
    eventsOf(healthy).includes('system.notice'),
    'the healthy connection must still receive the broadcast event',
  );
  created.length = 0;
  created.push(healthyId);
});

test('proxy headers: HTTP/1.x stream is unbuffered, no-transform, and chunked', () => {
  const res = new MockResponse(1);
  const id = add(res);
  created.push(id);

  assert.match(res.headers['content-type'], /text\/event-stream/);
  assert.match(res.headers['cache-control'], /no-transform/);
  assert.match(res.headers['cache-control'], /no-cache/);
  assert.equal(res.headers['x-accel-buffering'], 'no');
  assert.equal(res.headers['connection'], 'keep-alive');
  assert.equal(
    res.headers['transfer-encoding'],
    'chunked',
    'HTTP/1.x must force chunked streaming so proxies do not buffer the response',
  );
});

test('proxy headers: HTTP/2 omits the (illegal) Transfer-Encoding header', () => {
  const res = new MockResponse(2);
  const id = add(res);
  created.push(id);

  // Transfer-Encoding is invalid under HTTP/2 framing, so it must not be set.
  assert.equal(res.headers['transfer-encoding'], undefined);
  // The other streaming headers still apply regardless of protocol version.
  assert.match(res.headers['content-type'], /text\/event-stream/);
  assert.equal(res.headers['x-accel-buffering'], 'no');
});

test('targeted event: a client only receives events for their own company', () => {
  const ownClient = new MockResponse(2);
  const otherClient = new MockResponse(2);
  created.push(addWithIdentity(ownClient, { role: 'client', clientId: 7 }));
  created.push(addWithIdentity(otherClient, { role: 'client', clientId: 99 }));

  emitSSEEvent('order.updated', { orderNo: 'ORD-001' }, { clientId: 7 });

  assert.ok(eventsOf(ownClient).includes('order.updated'), 'the owning client receives the toast');
  assert.ok(
    !eventsOf(otherClient).includes('order.updated'),
    "another company's client must NOT receive the toast",
  );
});

test('targeted event: a driver only receives events for trips assigned to them', () => {
  const ownDriver = new MockResponse(2);
  const otherDriver = new MockResponse(2);
  created.push(addWithIdentity(ownDriver, { role: 'driver', driverId: 3 }));
  created.push(addWithIdentity(otherDriver, { role: 'driver', driverId: 5 }));

  emitSSEEvent('challan.updated', { challanNo: 'CH-0001', status: 'delivered' }, { clientId: 7, driverId: 3 });

  assert.ok(eventsOf(ownDriver).includes('challan.updated'), 'the assigned driver receives the toast');
  assert.ok(
    !eventsOf(otherDriver).includes('challan.updated'),
    'an unassigned driver must NOT receive the toast',
  );
});

test('targeted event: staff roles receive all order/trip toasts', () => {
  const admin = new MockResponse(2);
  const dispatcher = new MockResponse(2);
  const operator = new MockResponse(2);
  created.push(addWithIdentity(admin, { role: 'admin' }));
  created.push(addWithIdentity(dispatcher, { role: 'dispatcher' }));
  created.push(addWithIdentity(operator, { role: 'plant_operator' }));

  // An event scoped to a specific client/driver still reaches every staff member.
  emitSSEEvent('order.updated', { orderNo: 'ORD-001' }, { clientId: 42 });

  for (const [name, res] of [['admin', admin], ['dispatcher', dispatcher], ['operator', operator]] as const) {
    assert.ok(eventsOf(res).includes('order.updated'), `${name} must receive every order toast`);
  }
});

test('targeted event: a client does not receive driver-only trip events, and vice versa', () => {
  const client = new MockResponse(2);
  const driver = new MockResponse(2);
  created.push(addWithIdentity(client, { role: 'client', clientId: 7 }));
  created.push(addWithIdentity(driver, { role: 'driver', driverId: 3 }));

  // A challan for client 7 carried by driver 3: both should see it.
  emitSSEEvent('challan.created', { challanNo: 'CH-0001' }, { clientId: 7, driverId: 3 });
  assert.ok(eventsOf(client).includes('challan.created'), 'the owning client sees their challan');
  assert.ok(eventsOf(driver).includes('challan.created'), 'the assigned driver sees their challan');

  // A challan for a different client carried by a different driver: neither sees it.
  client.writes.length = 0;
  driver.writes.length = 0;
  emitSSEEvent('challan.created', { challanNo: 'CH-0002' }, { clientId: 99, driverId: 5 });
  assert.ok(!eventsOf(client).includes('challan.created'), 'client ignores another company challan');
  assert.ok(!eventsOf(driver).includes('challan.created'), 'driver ignores an unassigned challan');
});

test('untargeted event still broadcasts to every connection', () => {
  const client = new MockResponse(2);
  const driver = new MockResponse(2);
  created.push(addWithIdentity(client, { role: 'client', clientId: 7 }));
  created.push(addWithIdentity(driver, { role: 'driver', driverId: 3 }));

  // No audience → backward-compatible broadcast.
  emitSSEEvent('system.notice', { message: 'hello' });

  assert.ok(eventsOf(client).includes('system.notice'), 'broadcast reaches the client');
  assert.ok(eventsOf(driver).includes('system.notice'), 'broadcast reaches the driver');
});

test('live position: a client only receives positions for their own deliveries', () => {
  const ownClient = new MockResponse(2);
  const otherClient = new MockResponse(2);
  created.push(addWithIdentity(ownClient, { role: 'client', clientId: 7 }));
  created.push(addWithIdentity(otherClient, { role: 'client', clientId: 99 }));

  // A live GPS fix for a challan belonging to client 7, carried by driver 3.
  emitSSEEvent('vehicle.position', { challanId: 1, lat: 1, lng: 2 }, { clientId: 7, driverId: 3 });

  assert.ok(
    eventsOf(ownClient).includes('vehicle.position'),
    'the owning client sees their truck position',
  );
  assert.ok(
    !eventsOf(otherClient).includes('vehicle.position'),
    "another company's client must NOT see the live truck position",
  );
});

test('live position: a driver only receives positions for trips assigned to them', () => {
  const ownDriver = new MockResponse(2);
  const otherDriver = new MockResponse(2);
  created.push(addWithIdentity(ownDriver, { role: 'driver', driverId: 3 }));
  created.push(addWithIdentity(otherDriver, { role: 'driver', driverId: 5 }));

  emitSSEEvent('vehicle.position', { challanId: 1, lat: 1, lng: 2 }, { clientId: 7, driverId: 3 });

  assert.ok(
    eventsOf(ownDriver).includes('vehicle.position'),
    'the assigned driver sees their own truck position',
  );
  assert.ok(
    !eventsOf(otherDriver).includes('vehicle.position'),
    'an unassigned driver must NOT see the live truck position',
  );
});

test('live position: staff still receive every truck position for the control-room map', () => {
  const admin = new MockResponse(2);
  const dispatcher = new MockResponse(2);
  const operator = new MockResponse(2);
  created.push(addWithIdentity(admin, { role: 'admin' }));
  created.push(addWithIdentity(dispatcher, { role: 'dispatcher' }));
  created.push(addWithIdentity(operator, { role: 'plant_operator' }));

  // A position scoped to one client/driver must still reach every staff member.
  emitSSEEvent('vehicle.position', { challanId: 1, lat: 1, lng: 2 }, { clientId: 7, driverId: 3 });

  for (const [name, res] of [['admin', admin], ['dispatcher', dispatcher], ['operator', operator]] as const) {
    assert.ok(
      eventsOf(res).includes('vehicle.position'),
      `${name} must receive every truck position for the live map`,
    );
  }
});
