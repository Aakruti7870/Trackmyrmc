import { test, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { addSSEClient, removeSSEClient, getSSEClientCount, KEEPALIVE_MS, SWEEP_MS, STALE_THRESHOLD_MS, } from '../lib/sseEmitter.js';
// A minimal stand-in for the Express Response object that the SSE emitter
// writes to. It records headers and writes, and lets a test simulate
// backpressure (write returns false) or a closed socket (writableEnded).
class MockResponse {
    headers = {};
    writes = [];
    writableEnded = false;
    destroyed = false;
    ended = false;
    // Controls what res.write() returns. false simulates a full kernel/proxy
    // buffer (backpressure) so the write is never treated as flushed.
    writeReturn = true;
    req;
    constructor(httpVersionMajor = 1) {
        this.req = { httpVersionMajor };
    }
    setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
    }
    flushHeaders() { }
    write(payload) {
        this.writes.push(payload);
        return this.writeReturn;
    }
    end() {
        this.ended = true;
        this.writableEnded = true;
    }
}
function add(res) {
    return addSSEClient(res);
}
// The emitter keeps a module-level client map and a single pair of shared
// timers created lazily on the first connection. Enable the fake clock ONCE
// for the whole file: the keepalive/sweep intervals are a singleton, so
// resetting the clock between tests would orphan them and leave later tests
// without any firing timers. Clients are cleaned up after each test instead.
const created = [];
before(() => {
    mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
});
after(() => {
    mock.timers.reset();
});
afterEach(() => {
    for (const id of created)
        removeSSEClient(id);
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
    assert.ok(!res.writes.includes(':ping\n\n'), 'no keepalive ping should be sent before the interval elapses');
    // Crossing the interval boundary triggers exactly one keepalive ping.
    mock.timers.tick(1);
    assert.ok(res.writes.includes(':ping\n\n'), 'a keepalive ping must be sent once the interval elapses');
});
test('keepalive cadence stays well under the common proxy idle timeout', () => {
    // Regression guard: nginx / Cloudflare / Replit proxies drop idle streams
    // after ~30s. Two pings must fit inside that window, so the interval must
    // stay at or below 15s. Bumping it back up would silently kill live updates.
    assert.ok(KEEPALIVE_MS * 2 <= 30_000, `KEEPALIVE_MS (${KEEPALIVE_MS}) must allow two pings inside a 30s proxy window`);
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
    assert.equal(getSSEClientCount(), 1, 'a backpressured connection should survive until it crosses the stale threshold');
    // One more sweep after the threshold has been exceeded reclaims it.
    mock.timers.tick(SWEEP_MS);
    assert.equal(getSSEClientCount(), 0, 'a stalled connection must be swept once it goes stale');
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
    assert.equal(res.headers['transfer-encoding'], 'chunked', 'HTTP/1.x must force chunked streaming so proxies do not buffer the response');
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
