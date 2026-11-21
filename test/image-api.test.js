import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';

const samplePng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6foAAAAASUVORK5CYII=';
const providerImage = 'cHJvdmlkZXItaW1hZ2UtZGF0YQ==';

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  try { await run(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test('health reports provider configuration without exposing the key', async () => {
  const app = createApp({ apiKey: 'test-only-key', fetchImpl: async () => { throw new Error('must not call provider'); } });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.imageProviderConfigured, true);
    assert.equal(JSON.stringify(body).includes('test-only-key'), false);
  });
});

test('generation without reference calls the OpenAI generation endpoint', async () => {
  let captured;
  const app = createApp({
    apiKey: 'test-only-key',
    imageModel: 'test-image-model',
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return Response.json({ data: [{ b64_json: providerImage }] });
    },
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/images/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'A paper lantern at dusk' }) });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(captured.url, 'https://api.openai.com/v1/images/generations');
    assert.equal(captured.options.headers.Authorization, 'Bearer test-only-key');
    assert.equal(captured.body.model, 'test-image-model');
    assert.equal(captured.body.prompt, 'A paper lantern at dusk');
    assert.equal(body.imageDataUrl, `data:image/png;base64,${providerImage}`);
    assert.equal(JSON.stringify(body).includes('test-only-key'), false);
  });
});

test('generation with reference calls the OpenAI edit endpoint with server-side multipart data', async () => {
  let captured;
  const app = createApp({
    apiKey: 'test-only-key',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return Response.json({ data: [{ b64_json: providerImage }] });
    },
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/images/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Add warm sunset light', referenceImage: { name: 'reference.png', dataUrl: `data:image/png;base64,${samplePng}` } }) });
    assert.equal(response.status, 200);
    assert.equal(captured.url, 'https://api.openai.com/v1/images/edits');
    assert.equal(captured.options.headers.Authorization, 'Bearer test-only-key');
    assert.equal(captured.options.body.get('prompt'), 'Add warm sunset light');
    assert.equal(captured.options.body.get('model'), 'gpt-image-2.5-flare');
    assert.equal(captured.options.body.get('image').name, 'reference.png');
  });
});

test('generation is disabled cleanly when the backend has no API key', async () => {
  const app = createApp({ apiKey: '', fetchImpl: async () => { throw new Error('must not call provider'); } });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/images/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'A test' }) });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'IMAGE_PROVIDER_NOT_CONFIGURED');
  });
});

test('invalid reference and missing prompt are rejected before provider access', async () => {
  const app = createApp({ apiKey: 'test-only-key', fetchImpl: async () => { throw new Error('must not call provider'); } });
  await withServer(app, async (baseUrl) => {
    const missingPrompt = await fetch(`${baseUrl}/api/images/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: ' ' }) });
    assert.equal(missingPrompt.status, 400);
    const invalidReference = await fetch(`${baseUrl}/api/images/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'A test', referenceImage: { name: 'bad.svg', dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' } }) });
    assert.equal(invalidReference.status, 400);
  });
});

test('generation is rate-limited per client IP', async () => {
  let providerCalls = 0;
  const app = createApp({ apiKey: 'test-only-key', fetchImpl: async () => { providerCalls += 1; return Response.json({ data: [{ b64_json: providerImage }] }); } });
  await withServer(app, async (baseUrl) => {
    let finalResponse;
    for (let index = 0; index < 9; index += 1) {
      finalResponse = await fetch(`${baseUrl}/api/images/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: `A test frame ${index}` }) });
    }
    assert.equal(finalResponse.status, 429);
    assert.equal(providerCalls, 8);
  });
});
