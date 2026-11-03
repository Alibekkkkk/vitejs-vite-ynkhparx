import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { bucketProblemMessage, createStallWatchdog, describeUploadFailure, probeStorageBucket } from '../src/figureUpload.ts';

const context = { email: 'teacher@example.com', bucket: 'demo.firebasestorage.app', hasAppCheck: false };

test('a missing Storage bucket is detected before uploading', async () => {
  const missing = await probeStorageBucket('demo', async () => new Response('{}', { status: 404 }));
  assert.equal(missing.state, 'missing');
  assert.match(bucketProblemMessage(missing.state, 'demo') || '', /Get started/);
  assert.match(bucketProblemMessage(missing.state, 'demo') || '', /direct HTTPS image link/);
});

test('existing buckets are ready even when rules deny listing', async () => {
  for (const status of [200, 401, 403]) {
    assert.equal((await probeStorageBucket('demo', async () => new Response('{}', { status }))).state, 'ready');
  }
  assert.equal((await probeStorageBucket('demo', async () => new Response('{}', { status: 412 }))).state, 'misconfigured');
  assert.equal(bucketProblemMessage('ready', 'demo'), null);
});

test('network failures and slow probes report the bucket as unreachable', async () => {
  assert.equal((await probeStorageBucket('demo', async () => { throw new TypeError('Failed to fetch'); })).state, 'unreachable');
  const never = (_url: unknown, init?: { signal?: AbortSignal }) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  });
  assert.equal((await probeStorageBucket('demo', never as unknown as typeof fetch, 20)).state, 'unreachable');
});

test('upload errors are classified with actionable messages', () => {
  assert.equal(describeUploadFailure({ code: 'storage/unauthorized' }, context).kind, 'permission');
  assert.match(describeUploadFailure({ code: 'storage/unauthorized' }, context).message, /teacher@example\.com/);
  assert.equal(describeUploadFailure({ code: 'storage/unauthenticated' }, context).kind, 'unauthenticated');
  assert.equal(describeUploadFailure({ code: 'storage/canceled' }, context).kind, 'canceled');
  assert.equal(describeUploadFailure({ code: 'storage/quota-exceeded' }, context).retryable, false);
  assert.equal(describeUploadFailure({ code: 'storage/bucket-not-found' }, context).kind, 'bucket-missing');
  assert.equal(describeUploadFailure({ code: 'storage/retry-limit-exceeded' }, context).kind, 'timeout');
  assert.equal(describeUploadFailure(new Error('Upload stalled'), context).kind, 'timeout');
  assert.equal(describeUploadFailure(new TypeError('Failed to fetch'), context).kind, 'network');
  assert.equal(describeUploadFailure(new Error('boom'), context).kind, 'unknown');
  assert.match(describeUploadFailure({ code: 'storage/unauthorized' }, context).message, /VITE_RECAPTCHA_ENTERPRISE_SITE_KEY/);
  assert.doesNotMatch(describeUploadFailure({ code: 'storage/unauthorized' }, { ...context, hasAppCheck: true }).message, /VITE_RECAPTCHA/);
});

test('the stall watchdog only fires when progress stops', async () => {
  let stalls = 0;
  const watchdog = createStallWatchdog(40, () => { stalls++; });
  watchdog.poke();
  await new Promise(resolve => setTimeout(resolve, 25));
  watchdog.poke();
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(stalls, 0);
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(stalls, 1);
  watchdog.poke();
  watchdog.stop();
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(stalls, 1);
});

test('storage rules allow a draft folder for a teacher uploading before the first save', () => {
  const rules = readFileSync(join(process.cwd(), 'storage.rules'), 'utf8');
  assert.match(rules, /match \/assessment-assets\/\{teacherUid\}\/\{assessmentId\}\/\{questionId\}\/\{assetName\}/);
  assert.match(rules, /request\.auth\.uid == teacherUid/);
  const app = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');
  assert.match(app, /editingId \|\| 'draft'/);
});

test('a CORS configuration is shipped for the bucket', () => {
  const cors = JSON.parse(readFileSync(join(process.cwd(), 'cors.json'), 'utf8'));
  assert.ok(Array.isArray(cors) && cors.length > 0);
  assert.ok(cors[0].origin.includes('https://accomplish-exams.vercel.app'));
  assert.ok(cors[0].method.includes('GET'));
});
