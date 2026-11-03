export type BucketState = 'ready' | 'missing' | 'misconfigured' | 'unreachable';

// Asks the public Firebase Storage API whether the bucket exists. A project that never
// enabled Storage answers 404 for its default bucket, and the SDK would otherwise retry
// silently until it times out.
export async function probeStorageBucket(bucket: string, fetchImpl: typeof fetch = fetch, timeoutMs = 8000): Promise<{ state: BucketState; httpStatus?: number }> {
  if (!bucket) return { state: 'missing' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?maxResults=1`, {
      signal: controller.signal,
      credentials: 'omit',
    });
    if (response.status === 404) return { state: 'missing', httpStatus: 404 };
    if (response.status === 412) return { state: 'misconfigured', httpStatus: 412 };
    return { state: 'ready', httpStatus: response.status };
  } catch {
    return { state: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

export type UploadFailureKind = 'bucket-missing' | 'misconfigured' | 'permission' | 'unauthenticated' | 'timeout' | 'network' | 'canceled' | 'quota' | 'unknown';

export type UploadFailure = { kind: UploadFailureKind; message: string; retryable: boolean };

const URL_FALLBACK = ' You can still paste a direct HTTPS image link below.';

export function bucketProblemMessage(state: BucketState, bucket: string): string | null {
  if (state === 'missing') {
    return `Firebase Storage is not set up for this project (bucket "${bucket}" does not exist). In the Firebase Console open Build, then Storage, then Get started (this may require the Blaze plan), and run "firebase deploy --only storage".${URL_FALLBACK}`;
  }
  if (state === 'misconfigured') {
    return `Firebase Storage exists but is not linked correctly (bucket "${bucket}"). In the Firebase Console open Storage and re-link the bucket, then try again.${URL_FALLBACK}`;
  }
  return null;
}

export function describeUploadFailure(error: unknown, context: { email?: string | null; bucket: string; hasAppCheck: boolean }): UploadFailure {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
  const detail = error instanceof Error ? error.message : String(error || '');
  if (code === 'storage/canceled') return { kind: 'canceled', message: 'Upload canceled.', retryable: true };
  if (code === 'storage/bucket-not-found' || code === 'storage/project-not-found') {
    return { kind: 'bucket-missing', message: bucketProblemMessage('missing', context.bucket) || '', retryable: false };
  }
  if (code === 'storage/unauthorized') {
    return {
      kind: 'permission',
      message: `Permission denied by Firebase Storage for ${context.email || 'this account'}. Only an approved, verified Google teacher account can upload figures, and the latest storage.rules must be deployed ("firebase deploy --only storage").${context.hasAppCheck ? '' : ' If App Check enforcement is on for Storage, set VITE_RECAPTCHA_ENTERPRISE_SITE_KEY in the deployment.'}${URL_FALLBACK}`,
      retryable: true,
    };
  }
  if (code === 'storage/unauthenticated') {
    return { kind: 'unauthenticated', message: 'Your sign-in session is not active. Sign out, sign in again with your Google teacher account, then retry.', retryable: true };
  }
  if (code === 'storage/quota-exceeded') {
    return { kind: 'quota', message: 'The Firebase Storage quota for this project is used up. Free space or upgrade the plan, then retry.', retryable: false };
  }
  if (code === 'storage/retry-limit-exceeded' || /stalled|timed out/i.test(detail)) {
    return { kind: 'timeout', message: `The upload stopped making progress, so it was cancelled. Check your connection and retry. If this keeps happening, Storage may not be set up or reachable for this project.${URL_FALLBACK}`, retryable: true };
  }
  if (error instanceof TypeError || code === 'storage/network-request-failed') {
    return { kind: 'network', message: `The browser could not reach Firebase Storage. Check your internet connection, VPN or ad blocker, and that the bucket CORS settings allow this site (see cors.json).${URL_FALLBACK}`, retryable: true };
  }
  return { kind: 'unknown', message: `Figure upload failed${code ? ` (${code})` : ''}${detail ? `: ${detail}` : ''}.${URL_FALLBACK}`, retryable: true };
}

// Fires `onStall` when `poke` has not been called for `timeoutMs`. Progress events keep a
// large upload alive on a slow connection while a dead connection is still detected.
export function createStallWatchdog(timeoutMs: number, onStall: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  const poke = () => {
    stop();
    timer = setTimeout(onStall, timeoutMs);
  };
  return { poke, stop };
}
