export type PendingExamSubmission<T> = {
  userId: string;
  testId: string;
  payload: T;
  errorCode: string;
  queuedAt: number;
};

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const RETRYABLE_ERROR_CODES = new Set([
  'aborted',
  'deadline-exceeded',
  'internal',
  'network-request-failed',
  'resource-exhausted',
  'unavailable',
  'unknown',
]);

const STORAGE_PREFIX = 'pendingExamSubmission:';

export function getSubmissionErrorCode(error: unknown): string {
  let current = error;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && code.trim()) return code.split('/').pop() || code;
    current = (current as { cause?: unknown }).cause;
  }
  return 'unknown';
}

export function isRetryableSubmissionError(error: unknown): boolean {
  return RETRYABLE_ERROR_CODES.has(getSubmissionErrorCode(error));
}

export function getSubmissionErrorMessage(error: unknown): string {
  const code = getSubmissionErrorCode(error);
  if (code === 'permission-denied') {
    return `Firebase rejected this submission (${code}). Your answers are saved on this device. Ask your teacher to confirm the assessment is published, assigned to your group, and its answer key is secured, and that the latest Firestore rules are deployed. Then retry.`;
  }
  if (code === 'unauthenticated') {
    return `Your sign-in expired (${code}). Your answers are saved on this device. Sign in again, reopen the exam, and retry.`;
  }
  if (code === 'failed-precondition') {
    return `Firebase could not accept this submission (${code}). Your answers are saved on this device. Ask your teacher to check the assessment setup and deployed rules, then retry.`;
  }
  if (RETRYABLE_ERROR_CODES.has(code)) {
    return `Firebase could not be reached reliably (${code}). Your answers are saved on this device. They will retry when your connection returns; you can also choose Retry submission.`;
  }
  return `The submission could not be saved (${code}). Your answers are saved on this device. Retry, or contact your teacher and share this error code.`;
}

function storageKey(userId: string, testId: string): string {
  return `${STORAGE_PREFIX}${userId}:${testId}`;
}

export function savePendingExamSubmission<T>(
  storage: StorageLike,
  userId: string,
  testId: string,
  payload: T,
  error: unknown,
  queuedAt = Date.now(),
): PendingExamSubmission<T> {
  const pending = { userId, testId, payload, errorCode: getSubmissionErrorCode(error), queuedAt };
  storage.setItem(storageKey(userId, testId), JSON.stringify(pending));
  return pending;
}

export function loadPendingExamSubmission<T>(
  storage: StorageLike,
  userId: string,
  testId: string,
): PendingExamSubmission<T> | null {
  const key = storageKey(userId, testId);
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw);
    if (pending?.userId !== userId
      || pending?.testId !== testId
      || typeof pending?.errorCode !== 'string'
      || !Number.isFinite(pending?.queuedAt)
      || !Object.hasOwn(pending, 'payload')) {
      storage.removeItem(key);
      return null;
    }
    return pending as PendingExamSubmission<T>;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function clearPendingExamSubmission(storage: StorageLike, userId: string, testId: string): void {
  storage.removeItem(storageKey(userId, testId));
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; delayMs?: number; wait?: (milliseconds: number) => Promise<void> } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 400;
  const wait = options.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt + 1 >= attempts || !isRetryableSubmissionError(error)) throw error;
      await wait(delayMs * (2 ** attempt));
    }
  }
}
