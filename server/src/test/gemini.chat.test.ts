import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { chatComplete, chatCompleteStream, type ChatRequest } from '../lib/gemini.js';

// Unit tests for the NATIVE Gemini API plumbing (no DB, no app). They pin the
// request shape we send and the response shape we parse, so a regression back to
// the OpenAI-compat /chat/completions format (which the integration rejects) is
// caught here rather than only in production.

const realFetch = global.fetch;
let prevBase: string | undefined;
let prevKey: string | undefined;

before(() => {
  prevBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  prevKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  process.env.AI_INTEGRATIONS_GEMINI_BASE_URL = 'http://localhost:0/v1beta';
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY = 'test-key';
});

afterEach(() => { global.fetch = realFetch; });

after(() => {
  global.fetch = realFetch;
  if (prevBase === undefined) delete process.env.AI_INTEGRATIONS_GEMINI_BASE_URL; else process.env.AI_INTEGRATIONS_GEMINI_BASE_URL = prevBase;
  if (prevKey === undefined) delete process.env.AI_INTEGRATIONS_GEMINI_API_KEY; else process.env.AI_INTEGRATIONS_GEMINI_API_KEY = prevKey;
});

const REQ: ChatRequest = {
  system: 'You are a test assistant.',
  context: '(no matching data available for your account)',
  knowledge: 'Concrete grade M25 means 25 MPa.',
  history: [{ role: 'assistant', content: 'earlier reply' }],
  message: 'How much cement is in M25?',
};

test('chatComplete calls the native generateContent endpoint with the right shape', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit = {};
  global.fetch = (async (url: string, init: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: 'About 11 bags per cubic metre.' }] } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  const result = await chatComplete(REQ);
  assert.equal(result.source, 'gemini');
  assert.equal(result.text, 'About 11 bags per cubic metre.');

  // Native endpoint + auth header (NOT the OpenAI-compat /chat/completions form).
  assert.match(capturedUrl, /:generateContent$/);
  assert.doesNotMatch(capturedUrl, /chat\/completions/);
  const headers = capturedInit.headers as Record<string, string>;
  assert.equal(headers['x-goog-api-key'], 'test-key');

  // Body: systemInstruction carries persona + knowledge; history role mapped to
  // 'model'; thinking disabled so the model returns text, not just thoughts.
  const body = JSON.parse(capturedInit.body as string);
  assert.ok(body.systemInstruction?.parts?.[0]?.text.includes('M25'), 'knowledge in systemInstruction');
  assert.equal(body.contents.at(-1).role, 'user');
  assert.equal(body.contents.at(-1).parts[0].text, 'How much cement is in M25?');
  assert.ok(body.contents.some((c: { role: string }) => c.role === 'model'), 'assistant turn mapped to model');
  assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
});

test('chatComplete surfaces a GeminiError on non-2xx', async () => {
  global.fetch = (async () => new Response('nope', { status: 400 })) as typeof fetch;
  await assert.rejects(() => chatComplete(REQ), /error \(400\)/);
});

test('chatCompleteStream parses SSE candidate parts into deltas', async () => {
  const frames = [
    'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hello ' }] } }] }) + '\n\n',
    'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'world' }] } }] }) + '\n\n',
    'data: [DONE]\n\n',
  ];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const f of frames) controller.enqueue(enc.encode(f));
      controller.close();
    },
  });
  global.fetch = (async (url: string) => {
    assert.match(url, /:streamGenerateContent\?alt=sse$/);
    return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }) as typeof fetch;

  const gen = chatCompleteStream(REQ);
  const deltas: string[] = [];
  let next = await gen.next();
  while (!next.done) { deltas.push(next.value); next = await gen.next(); }
  assert.deepEqual(deltas, ['Hello ', 'world']);
  assert.equal(next.value.text, 'Hello world');
  assert.equal(next.value.source, 'gemini');
});

test('chat falls back deterministically when the integration is unconfigured', async () => {
  const savedBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const savedKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  delete process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  delete process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  try {
    const result = await chatComplete(REQ);
    assert.equal(result.source, 'fallback');
    assert.ok(result.text.trim().length > 0);
  } finally {
    process.env.AI_INTEGRATIONS_GEMINI_BASE_URL = savedBase;
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY = savedKey;
  }
});
