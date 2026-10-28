export const EXAM_RETURN_GRACE_MS = 5 * 60 * 1000;

export type ExamAttemptSnapshot = {
  testId: string;
  attemptId: string;
  startedAtMs: number;
  answers: Record<string, unknown>;
  currentIndex: number;
  lastExitAtMs: number | null;
  lastSeenAtMs: number;
};

export type ExamAttemptRestore =
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'expired'; snapshot: ExamAttemptSnapshot }
  | { status: 'resumable'; snapshot: ExamAttemptSnapshot };

export function createExamAttemptSnapshot(testId: string, now = Date.now()): ExamAttemptSnapshot {
  return {
    testId,
    attemptId: crypto.randomUUID(),
    startedAtMs: now,
    answers: {},
    currentIndex: 0,
    lastExitAtMs: null,
    lastSeenAtMs: now,
  };
}

export function restoreExamAttempt(raw: string | null, testId: string, now = Date.now()): ExamAttemptRestore {
  if (raw === null) return { status: 'missing' };
  try {
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object'
      || saved.testId !== testId
      || typeof saved.attemptId !== 'string'
      || !saved.attemptId
      || !Number.isFinite(saved.startedAtMs)
      || !Number.isInteger(saved.currentIndex)
      || saved.currentIndex < 0
      || !saved.answers
      || typeof saved.answers !== 'object'
      || Array.isArray(saved.answers)
      || !Number.isFinite(saved.lastSeenAtMs)
      || (saved.lastExitAtMs !== null && !Number.isFinite(saved.lastExitAtMs))) {
      return { status: 'invalid' };
    }
    const snapshot: ExamAttemptSnapshot = {
      testId: saved.testId,
      attemptId: saved.attemptId,
      startedAtMs: saved.startedAtMs,
      answers: saved.answers,
      currentIndex: saved.currentIndex,
      lastExitAtMs: saved.lastExitAtMs,
      lastSeenAtMs: saved.lastSeenAtMs,
    };
    const lastActivityAtMs = snapshot.lastExitAtMs ?? snapshot.lastSeenAtMs;
    if (now - lastActivityAtMs > EXAM_RETURN_GRACE_MS || now < lastActivityAtMs) {
      return { status: 'expired', snapshot };
    }
    return { status: 'resumable', snapshot: { ...snapshot, lastExitAtMs: null, lastSeenAtMs: now } };
  } catch {
    return { status: 'invalid' };
  }
}
