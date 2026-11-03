import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { gradeAttempt } from '../src/grading.ts';

let server;
let load;

before(async () => {
  server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true } });
  load = path => server.ssrLoadModule(path);
});

after(async () => {
  await server?.close();
});

const questions = [
  { id: 'q1', text: 'Which is **correct**?', responseType: 'single-choice', options: ['A', 'B', 'C'], correctAnswer: 'B', points: 1, explanation: 'B is right.' },
  { id: 'q2', text: 'Name the city', responseType: 'short-text', correctAnswer: 'Paris', points: 1 },
  { id: 'q3', text: 'Write an essay', responseType: 'long-text', manualReview: true, points: 9, section: 'writing' },
];
const selfGrade = gradeAttempt(questions, { q1: 'A', q2: 'paris', q3: 'An essay' });
const record = {
  displayTitle: '**[[align:center]]NUET Mock Exam #2[[/align]]**',
  submittedAt: '2026-11-03T10:00:00.000Z',
  durationSeconds: 754,
  isAutoSubmitted: true,
  answers: { q1: 'A', q2: 'paris', q3: 'An essay' },
  score: null,
  selfGrade,
};

const html = element => renderToStaticMarkup(element);

test('results page shows the summary table, score card and plain title', async () => {
  const { ResultReview } = await load('/src/ResultReview.tsx');
  const output = html(createElement(ResultReview, { record, test: { id: 't1', questions }, backLabel: 'Back to dashboard', onBack: () => {} }));
  assert.match(output, /NUET Mock Exam #2/);
  assert.doesNotMatch(output, /\[\[align|\*\*/);
  for (const heading of ['Question', 'Your answer', 'Correct answer', 'Result', 'Points']) assert.match(output, new RegExp(`>${heading}<`));
  assert.match(output, /Review question 1/);
  assert.match(output, /Incorrect/);
  assert.match(output, /Correct<|Correct\b/);
  assert.match(output, /Pending review/);
  assert.match(output, /Score so far/);
  assert.match(output, /1 question is<\/!-- -->\s*pending review|1 question is pending review|pending review/);
  assert.match(output, /Time spent/);
  assert.match(output, /12m 34s/);
  assert.match(output, /Submitted automatically when time ran out/);
  assert.doesNotMatch(output, /[•·]/);
  assert.match(output, /lg:grid-cols-\[minmax\(0,1fr\)_20rem\]/);
  assert.match(output, /order-first/);
});

test('results page explains when grading has not finished', async () => {
  const { ResultReview } = await load('/src/ResultReview.tsx');
  const output = html(createElement(ResultReview, { record: { displayTitle: 'Quiz', submittedAt: '2026-11-03T10:00:00.000Z', score: null }, onBack: () => {} }));
  assert.match(output, /Your answers are saved/);
  assert.doesNotMatch(output, /A teacher must review them before a score is available/);
});

test('practice results explain that assigned answer keys stay private', async () => {
  const { ResultReview } = await load('/src/ResultReview.tsx');
  const output = html(createElement(ResultReview, { record: { displayTitle: 'Practice', isPractice: true }, onBack: () => {} }));
  assert.match(output, /Practice answers are saved/);
  assert.match(output, /does not reveal or use an assigned assessment answer key/);
  assert.doesNotMatch(output, /as soon as grading finishes/);
});

test('teacher card separates labelled badges, group chips and the meta footer', async () => {
  const { TeacherAssessmentCard } = await load('/src/AssessmentCards.tsx');
  const actions = { onEdit() {}, onDuplicate() {}, onArchive() {}, onUnpublish() {}, onRestore() {}, onDelete() {} };
  const published = { id: 'a', title: '**[[align:center]]NUET Critical Thinking Mock Exam #1[[/align]]**', type: 'NUET', category: 'Exam', published: true, status: 'published', answerKeysSecured: true, teacherKeyComplete: true, groupCodes: ['nuet - ayaulym and ayana', 'b', 'c', 'd', 'e'], groupCode: 'nuet - ayaulym and ayana', durationSeconds: 3600, questions: Array.from({ length: 30 }, () => ({})) };
  const output = html(createElement(TeacherAssessmentCard, { test: published, archived: false, migrationFailed: false, actions }));
  assert.match(output, /NUET Critical Thinking Mock Exam #1/);
  assert.doesNotMatch(output, /\[\[align|\*\*/);
  assert.match(output, /Type:<\/span><span[^>]*>NUET/);
  assert.match(output, /Category:<\/span><span[^>]*>Exam/);
  assert.match(output, /Status:<\/span><span[^>]*>Published/);
  assert.match(output, /Answer key:<\/span><span[^>]*>Secure/);
  assert.match(output, /nuet - ayaulym and ayana/);
  assert.match(output, /\+1<!-- --> more|\+1 more/);
  assert.match(output, /Duration:/);
  assert.match(output, /60 min/);
  assert.match(output, /Questions:/);
  assert.match(output, /aria-label="Edit NUET Critical Thinking Mock Exam #1"/);
  assert.match(output, /aria-label="Unpublish NUET Critical Thinking Mock Exam #1 and hide it from students"/);
  assert.match(output, /title="Archive NUET Critical Thinking Mock Exam #1"/);
  assert.doesNotMatch(output, /[•·]/);

  const draft = html(createElement(TeacherAssessmentCard, { test: { id: 'd', title: 'Draft', type: 'IELTS', category: 'Exam', durationSeconds: 3000, questions: [] }, archived: false, migrationFailed: false, actions }));
  assert.match(draft, /Status:<\/span><span[^>]*>Draft/);
  assert.match(draft, /Not assigned, hidden from students/);
  assert.doesNotMatch(draft, /Unpublish/);

  const archived = html(createElement(TeacherAssessmentCard, { test: { ...published, status: 'archived' }, archived: true, migrationFailed: false, actions }));
  assert.match(archived, /Status:<\/span><span[^>]*>Archived/);
  assert.match(archived, /aria-label="Permanently delete /);
});

test('student card shows labelled badges and the start action', async () => {
  const { StudentAssessmentCard } = await load('/src/AssessmentCards.tsx');
  const test1 = { id: 's', title: '**IELTS Reading**', type: 'IELTS', category: 'Homework', durationSeconds: 1800, questions: [{}, {}], pin: '1234' };
  const open = html(createElement(StudentAssessmentCard, { test: test1, completed: false, onStart() {} }));
  assert.match(open, /Start Task/);
  assert.match(open, /IELTS Reading/);
  assert.doesNotMatch(open, /\*\*/);
  assert.match(open, /aria-label="PIN required"/);
  assert.match(open, /30 min/);
  const done = html(createElement(StudentAssessmentCard, { test: test1, completed: true, onStart() {} }));
  assert.match(done, /Completed/);
  assert.doesNotMatch(done, /Start Task/);
  assert.doesNotMatch(open + done, /[•·]/);
});

test('group input renders one chip per group and a labelled all students toggle', async () => {
  const { GroupCodeInput } = await load('/src/GroupCodeInput.tsx');
  const output = html(createElement(GroupCodeInput, { value: ['group a', 'group b'], onChange() {}, suggestions: ['group c'] }));
  assert.match(output, /group a/);
  assert.match(output, /aria-label="Remove group group b"/);
  assert.match(output, /Assign to all students/);
  assert.match(output, /<option value="group c"/);
  const all = html(createElement(GroupCodeInput, { value: ['all'], onChange() {} }));
  assert.match(all, /All students/);
  assert.match(all, /aria-pressed="true"/);
  assert.match(all, /disabled=""/);
});

test('exam navigator marks answered, unanswered, flagged and current questions', async () => {
  const { QuestionNavigator, ExamNotices } = await load('/src/ExamSafetyNets.tsx');
  const output = html(createElement(QuestionNavigator, {
    questions: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    answers: { a: 'x' },
    currentIndex: 1,
    flagged: ['c'],
    onGo() {},
    onToggleFlag() {},
  }));
  assert.match(output, /1 of 3 answered, 1 flagged/);
  assert.match(output, /aria-label="Question 1, answered"/);
  assert.match(output, /aria-label="Question 2, unanswered, current"/);
  assert.match(output, /aria-label="Question 3, unanswered, flagged"/);
  assert.match(output, /aria-current="step"/);
  assert.match(output, /Flag for review/);
  assert.equal(html(createElement(QuestionNavigator, { questions: [{ id: 'a' }], answers: {}, currentIndex: 0, flagged: [], onGo() {}, onToggleFlag() {} })), '');

  assert.match(html(createElement(ExamNotices, { online: false, secondsRemaining: 900 })), /You are offline/);
  assert.match(html(createElement(ExamNotices, { online: true, secondsRemaining: 250 })), /Less than 5 minutes remain/);
  assert.match(html(createElement(ExamNotices, { online: true, secondsRemaining: 40 })), /Less than 1 minute remains/);
  assert.equal(html(createElement(ExamNotices, { online: true, secondsRemaining: 900 })), '');
  assert.equal(html(createElement(ExamNotices, { online: true, secondsRemaining: null })), '');
});

test('analytics panel lists group averages and the hardest questions with an export', async () => {
  const { AnalyticsPanel } = await load('/src/AnalyticsPanel.tsx');
  const graded = (answers, group) => ({ groupCode: group, assessmentId: 't1', questionReviews: gradeAttempt(questions, answers).questionReviews });
  const submissions = [graded({ q1: 'B', q2: 'Paris' }, 'group a'), graded({ q1: 'A', q2: 'Paris' }, 'group b')];
  const output = html(createElement(AnalyticsPanel, { submissions, assessmentId: 't1', assessmentTitle: 'Mock' }));
  assert.match(output, /Average score by group/);
  assert.match(output, /group a/);
  assert.match(output, /Hardest questions/);
  assert.match(output, /Export CSV/);
  assert.match(output, /Which is correct\?/);
  const noSelection = html(createElement(AnalyticsPanel, { submissions, assessmentId: '', assessmentTitle: '' }));
  assert.match(noSelection, /Choose one assessment in the filter/);
  assert.equal(html(createElement(AnalyticsPanel, { submissions: [], assessmentId: '', assessmentTitle: '' })), '');
});

test('teacher group control and the error boundary render accessible content', async () => {
  const { StudentGroupControl } = await load('/src/StudentGroupControl.tsx');
  const output = html(createElement(StudentGroupControl, { studentUid: 'u1', studentName: 'Aigerim', submittedGroup: 'group a', onChange: async () => {} }));
  assert.match(output, /Group when submitted: group a/);
  assert.match(output, /aria-label="New group code for Aigerim"/);
  assert.match(output, /Change group/);
  const { ErrorBoundary } = await load('/src/ErrorBoundary.tsx');
  assert.match(html(createElement(ErrorBoundary, null, createElement('p', null, 'fine'))), /fine/);
});
