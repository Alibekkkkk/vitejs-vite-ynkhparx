// Runs against the Firestore emulator: npm run test:rules (needs Java 11+ and network access
// the first time so firebase-tools can download the emulator).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

const APP = 'exam-portal-71a9b';
const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');
let env;

const teacherToken = { email: 'alibek.alpysbayev@gmail.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } };
const student = uid => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
const teacher = () => env.authenticatedContext('teacher1', teacherToken).firestore();
const testsPath = id => `artifacts/${APP}/public/data/tests/${id}`;
const profilePath = uid => `artifacts/${APP}/users/${uid}/profile/info`;
const resultPath = (uid, id) => `artifacts/${APP}/users/${uid}/results/${id}`;
const submissionPath = id => `artifacts/${APP}/public/data/submissions/${id}`;
const markerPath = (uid, id) => `artifacts/${APP}/users/${uid}/completedAssessments/${id}`;
const keyPath = id => `artifacts/${APP}/teacher/data/answerKeys/${id}`;

const base = { published: true, status: 'published', answerKeysSecured: true, questions: [], title: 'T' };

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-rules', firestore: { rules } });
});
after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, profilePath('s1')), { role: 'student', groupCode: 'g1', name: 'S1' });
    await setDoc(doc(db, profilePath('s2')), { role: 'student', groupCode: 'g2', name: 'S2' });
    await setDoc(doc(db, profilePath('s3')), { role: 'student', groupCode: '', name: 'S3' });
    await setDoc(doc(db, profilePath('s9')), { role: 'student', groupCode: 'g9', name: 'S9' });
    await setDoc(doc(db, profilePath('teacher1')), { role: 'teacher', name: 'T' });
    await setDoc(doc(db, testsPath('multi')), { ...base, groupCode: 'g1', groupCodes: ['g1', 'g2'] });
    await setDoc(doc(db, testsPath('legacy')), { ...base, groupCode: 'g2' });
    await setDoc(doc(db, testsPath('everyone')), { ...base, groupCode: 'all', groupCodes: ['all'] });
    await setDoc(doc(db, testsPath('other')), { ...base, groupCode: 'g9', groupCodes: ['g9'] });
    await setDoc(doc(db, testsPath('draft')), { ...base, published: false, status: 'draft', answerKeysSecured: false, groupCode: '', groupCodes: [] });
    await setDoc(doc(db, keyPath('multi')), { questions: [{ id: 'q1', correctAnswer: 'A' }] });
    await setDoc(doc(db, keyPath('other')), { questions: [{ id: 'q1', correctAnswer: 'A' }] });
  });
});

const secured = [where('answerKeysSecured', '==', true), where('published', '==', true)];

test('students see tests through every group path and only theirs', async () => {
  const s2 = student('s2');
  const tests = collection(s2, `artifacts/${APP}/public/data/tests`);
  await assertSucceeds(getDocs(query(tests, ...secured, where('groupCodes', 'array-contains', 'g2'))));
  await assertSucceeds(getDocs(query(tests, ...secured, where('groupCodes', 'array-contains', 'all'))));
  await assertSucceeds(getDocs(query(tests, ...secured, where('groupCode', 'in', ['g2', 'all']))));
  const viaArray = await getDocs(query(tests, ...secured, where('groupCodes', 'array-contains', 'g2')));
  assert.deepEqual(viaArray.docs.map(item => item.id), ['multi']);
  const viaLegacy = await getDocs(query(tests, ...secured, where('groupCode', 'in', ['g2', 'all'])));
  assert.deepEqual(viaLegacy.docs.map(item => item.id).sort(), ['everyone', 'legacy']);
  await assertFails(getDocs(query(tests, ...secured, where('groupCodes', 'array-contains', 'g9'))));
  await assertSucceeds(getDoc(doc(s2, testsPath('multi'))));
  await assertSucceeds(getDoc(doc(s2, testsPath('legacy'))));
  await assertFails(getDoc(doc(s2, testsPath('other'))));
  await assertFails(getDoc(doc(student('s3'), testsPath('multi'))));
  await assertSucceeds(getDoc(doc(student('s3'), testsPath('everyone'))));
});

const unscored = (uid, attemptId, testId, extra = {}) => ({
  testId, attemptId, answers: { q1: 'A' }, displayTitle: 'T', submittedAt: 'x', submittedAtMs: 1, isAutoSubmitted: false,
  durationSeconds: 5, score: null, maxPossibleScore: null, maxAutoScore: null, answeredCount: 1, unansweredCount: 0,
  pendingReviewCount: 0, reviewStatus: 'pending-review', gradingMode: 'teacher-review-required', isPractice: false,
  assessmentIds: [testId], secondaryAssessmentId: '', questionIds: ['q1'], ...extra,
});
const central = (uid, attemptId, testId, group) => ({
  ...unscored(uid, attemptId, testId), id: `${uid}_${attemptId}`, studentUid: uid, studentName: 'n', studentEmail: '', groupCode: group,
  assessmentId: testId, assessmentTitle: 'T', examType: 'IELTS',
});

async function submit(db, uid, attemptId, testId, group, withMarker = true) {
  const batch = writeBatch(db);
  batch.set(doc(db, submissionPath(`${uid}_${attemptId}`)), central(uid, attemptId, testId, group));
  batch.set(doc(db, resultPath(uid, attemptId)), unscored(uid, attemptId, testId));
  if (withMarker) batch.set(doc(db, markerPath(uid, testId)), { assessmentId: testId, attemptId, completedAt: 'now' });
  return batch.commit();
}

test('students in any assigned group can submit, others cannot', async () => {
  await assertSucceeds(submit(student('s2'), 's2', 'a1', 'multi', 'g2'));
  await assertSucceeds(submit(student('s1'), 's1', 'a1', 'multi', 'g1'));
  await assertFails(submit(student('s9'), 's9', 'a1', 'multi', 'g9'));
  await assertSucceeds(submit(student('s2'), 's2', 'a2', 'legacy', 'g2'));
  await assertSucceeds(submit(student('s3'), 's3', 'a3', 'everyone', ''));
});

test('auto-submitted attempts follow the same valid save rules', async () => {
  const db = student('s2');
  const submission = central('s2', 'auto1', 'multi', 'g2');
  submission.isAutoSubmitted = true;
  const result = unscored('s2', 'auto1', 'multi', { isAutoSubmitted: true });
  const batch = writeBatch(db);
  batch.set(doc(db, submissionPath('s2_auto1')), submission);
  batch.set(doc(db, resultPath('s2', 'auto1')), result);
  batch.set(doc(db, markerPath('s2', 'multi')), { assessmentId: 'multi', attemptId: 'auto1', completedAt: 'now' });
  await assertSucceeds(batch.commit());
});

test('an authorized teacher can preview and submit a draft assessment', async () => {
  const db = teacher();
  const attempt = 'preview1';
  const previewResult = unscored('teacher1', attempt, 'draft');
  const previewSubmission = {
    ...central('teacher1', attempt, 'draft', ''),
    assessmentTitle: 'Draft preview',
  };
  const batch = writeBatch(db);
  batch.set(doc(db, submissionPath('teacher1_preview1')), previewSubmission);
  batch.set(doc(db, resultPath('teacher1', attempt)), previewResult);
  batch.set(doc(db, markerPath('teacher1', 'draft')), { assessmentId: 'draft', attemptId: attempt, completedAt: 'now' });
  await assertSucceeds(batch.commit());
});

test('a result cannot claim a different assessment from its testId', async () => {
  const s2 = student('s2');
  await assertFails(setDoc(doc(s2, resultPath('s2', 'mismatch')), unscored('s2', 'mismatch', 'multi', { assessmentId: 'other' })));
});

test('the answer key opens only after a real attempt', async () => {
  const s2 = student('s2');
  await assertFails(getDoc(doc(s2, keyPath('multi'))));
  await assertSucceeds(submit(s2, 's2', 'a1', 'multi', 'g2'));
  const key = await assertSucceeds(getDoc(doc(s2, keyPath('multi'))));
  assert.equal(key.data().questions[0].correctAnswer, 'A');
  await assertFails(getDoc(doc(s2, keyPath('other'))));
  await assertFails(getDocs(collection(s2, `artifacts/${APP}/teacher/data/answerKeys`)));
});

test('a marker cannot be forged without a result for that assessment', async () => {
  const s2 = student('s2');
  await assertFails(setDoc(doc(s2, markerPath('s2', 'multi')), { assessmentId: 'multi', attemptId: 'nope', completedAt: 'now' }));
  await assertSucceeds(submit(s2, 's2', 'a1', 'multi', 'g2'));
  await assertFails(setDoc(doc(s2, markerPath('s2', 'other')), { assessmentId: 'other', attemptId: 'a1', completedAt: 'now' }));
  await assertFails(setDoc(doc(student('s1'), markerPath('s2', 'multi')), { assessmentId: 'multi', attemptId: 'a1', completedAt: 'now' }));
  await assertFails(getDoc(doc(student('s1'), keyPath('multi'))));
});

test('practice results cannot create completion markers or unlock assessment keys', async () => {
  const s2 = student('s2');
  const practiceResult = unscored('s2', 'practice1', 'multi', {
    isPractice: true,
    practiceMetadata: { kind: 'reading', mode: 'passage' },
  });
  await assertSucceeds(setDoc(doc(s2, resultPath('s2', 'practice1')), practiceResult));
  await assertFails(setDoc(doc(s2, submissionPath('s2_practice1')), {
    ...central('s2', 'practice1', 'multi', 'g2'),
    ...practiceResult,
    id: 's2_practice1',
    studentUid: 's2',
  }));
  await assertFails(setDoc(doc(s2, markerPath('s2', 'multi')), { assessmentId: 'multi', attemptId: 'practice1', completedAt: 'now' }));
  await assertFails(getDoc(doc(s2, keyPath('multi'))));

  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, markerPath('s2', 'multi')), { assessmentId: 'multi', attemptId: 'practice1', completedAt: 'now' });
  });
  await assertFails(getDoc(doc(s2, keyPath('multi'))));
});

test('a second attempt can refresh the marker', async () => {
  const s2 = student('s2');
  await assertSucceeds(submit(s2, 's2', 'a1', 'multi', 'g2'));
  await assertSucceeds(submit(s2, 's2', 'a2', 'multi', 'g2'));
});

test('students can attach one self grade but never change trusted scores', async () => {
  const s2 = student('s2');
  await submit(s2, 's2', 'a1', 'multi', 'g2');
  await assertFails(updateDoc(doc(s2, resultPath('s2', 'a1')), { score: 5 }));
  await assertFails(updateDoc(doc(s2, resultPath('s2', 'a1')), { selfGrade: { score: 1 }, score: 5 }));
  await assertSucceeds(updateDoc(doc(s2, resultPath('s2', 'a1')), { selfGrade: { score: 1, questionReviews: [] } }));
  await assertFails(updateDoc(doc(s2, resultPath('s2', 'a1')), { selfGrade: { score: 99 } }));
  await assertFails(updateDoc(doc(s2, submissionPath('s2_a1')), { score: 5 }));
  await assertFails(updateDoc(doc(s2, submissionPath('s2_a1')), { selfGrade: { score: 5 } }));
});

test('an approved teacher writes the trusted grade, including autoGradedAt', async () => {
  await submit(student('s2'), 's2', 'a1', 'multi', 'g2');
  const payload = { score: 1, maxPossibleScore: 1, maxAutoScore: 1, correctCount: 1, incorrectCount: 0, answeredCount: 1, unansweredCount: 0, pendingReviewCount: 0, manualReviewCount: 0, ungradedCount: 0, reviewStatus: 'reviewed', questionReviews: [], autoGradedAt: 'now' };
  await assertSucceeds(updateDoc(doc(teacher(), submissionPath('s2_a1')), payload));
  await assertSucceeds(updateDoc(doc(teacher(), resultPath('s2', 'a1')), payload));
  await assertFails(updateDoc(doc(teacher(), submissionPath('s2_a1')), { studentUid: 'someone' }));
});

test('teachers can move a student to another group but not change a role; students stay locked', async () => {
  await assertSucceeds(updateDoc(doc(teacher(), profilePath('s1')), { groupCode: 'g2' }));
  await assertFails(updateDoc(doc(teacher(), profilePath('s1')), { role: 'teacher' }));
  await assertFails(updateDoc(doc(teacher(), profilePath('s1')), { groupCode: 'g2', name: 'X' }));
  await assertFails(updateDoc(doc(student('s1'), profilePath('s1')), { groupCode: 'g9' }));
  await assertFails(updateDoc(doc(student('s2'), profilePath('s1')), { groupCode: 'g9' }));
  await assertSucceeds(updateDoc(doc(student('s3'), profilePath('s3')), { groupCode: 'g1' }));
});

test('teachers keep full access to tests and keys', async () => {
  await assertSucceeds(getDocs(collection(teacher(), `artifacts/${APP}/public/data/tests`)));
  await assertSucceeds(getDoc(doc(teacher(), keyPath('multi'))));
  await assertSucceeds(setDoc(doc(teacher(), testsPath('new')), { ...base, groupCode: 'g1', groupCodes: ['g1', 'g2'] }));
});

const progressPath = (uid, id) => `artifacts/${APP}/users/${uid}/trainingProgress/${id}`;
const progress = id => ({ assessmentId: id, attemptId: 'attempt-1', answers: { q1: 'A' }, revealedIds: ['q1'], currentIndex: 1, secondsLeft: 90, activeMs: 120000, updatedAtMs: 1 });

test('a student can save and resume their own training progress, nobody else can', async () => {
  await assertSucceeds(setDoc(doc(student('s1'), progressPath('s1', 'multi')), progress('multi')));
  await assertSucceeds(getDoc(doc(student('s1'), progressPath('s1', 'multi'))));
  await assertSucceeds(getDocs(collection(student('s1'), `artifacts/${APP}/users/s1/trainingProgress`)));
  await assertFails(getDoc(doc(student('s2'), progressPath('s1', 'multi'))));
  await assertFails(setDoc(doc(student('s2'), progressPath('s1', 'multi')), progress('multi')));
  await assertSucceeds(setDoc(doc(student('s1'), progressPath('s1', 'multi')), { ...progress('multi'), secondsLeft: null }));
  await assertSucceeds(updateDoc(doc(student('s1'), progressPath('s1', 'multi')), { currentIndex: 2 }));
  await assertSucceeds(env.authenticatedContext('s1').firestore().doc(progressPath('s1', 'multi')).delete());
});

test('training progress rejects extra fields, a wrong assessment id and oversized positions', async () => {
  await assertFails(setDoc(doc(student('s1'), progressPath('s1', 'multi')), { ...progress('multi'), score: 50 }));
  await assertFails(setDoc(doc(student('s1'), progressPath('s1', 'multi')), progress('other')));
  await assertFails(setDoc(doc(student('s1'), progressPath('s1', 'multi')), { ...progress('multi'), currentIndex: 5000 }));
  await assertFails(setDoc(doc(student('s1'), progressPath('s1', 'multi')), { ...progress('multi'), answers: 'x' }));
});

test('training tests release their answer key to assigned students; exams do not', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, testsPath('train')), { ...base, type: 'NUET Training', groupCode: 'g1', groupCodes: ['g1'] });
    await setDoc(doc(db, testsPath('satTrain')), { ...base, type: 'SAT Training', groupCode: 'g1', groupCodes: ['g1'] });
    await setDoc(doc(db, testsPath('exam')), { ...base, type: 'NUET', groupCode: 'g1', groupCodes: ['g1'] });
    for (const id of ['train', 'satTrain', 'exam']) await setDoc(doc(db, keyPath(id)), { questions: [{ id: 'q1', correctAnswer: 'A' }] });
  });
  await assertSucceeds(getDoc(doc(student('s1'), keyPath('train'))));
  await assertSucceeds(getDoc(doc(student('s1'), keyPath('satTrain'))));
  await assertFails(getDoc(doc(student('s1'), keyPath('exam'))));
  await assertFails(getDoc(doc(student('s2'), keyPath('train'))));
});
