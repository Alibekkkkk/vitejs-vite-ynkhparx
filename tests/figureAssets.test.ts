import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { fetchFigureForAI, getFigureSource } from '../src/figureAssets.ts';

const originalFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = originalFetch;
});

test('figure source prefers a valid uploaded asset URL and falls back to legacy image URL', () => {
  assert.equal(getFigureSource({
    imageAsset: { downloadUrl: 'https://storage.example/figure.png' },
    imageUrl: 'https://legacy.example/figure.jpg',
  }), 'https://storage.example/figure.png');
  assert.equal(getFigureSource({
    imageAsset: { downloadUrl: 'not-a-url' },
    imageUrl: 'https://legacy.example/figure.jpg',
  }), 'https://legacy.example/figure.jpg');
});

test('AI figure loader returns bounded image bytes as base64 inline data', async () => {
  globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), {
    headers: { 'content-type': 'image/png', 'content-length': '3' },
  });

  assert.deepEqual(await fetchFigureForAI('https://storage.example/figure.png'), {
    mimeType: 'image/png',
    data: 'AQID',
  });
});

test('AI figure loader rejects non-image content and oversized files', async () => {
  globalThis.fetch = async () => new Response('not an image', {
    headers: { 'content-type': 'text/plain' },
  });
  await assert.rejects(fetchFigureForAI('https://storage.example/figure.png'), /support PNG, JPEG, or WebP/);

  globalThis.fetch = async () => new Response(null, {
    headers: { 'content-type': 'image/png', 'content-length': String(5 * 1024 * 1024 + 1) },
  });
  await assert.rejects(fetchFigureForAI('https://storage.example/figure.png'), /5 MB AI upload limit/);
});
