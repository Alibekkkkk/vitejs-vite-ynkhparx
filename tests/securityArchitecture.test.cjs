const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const appSource = readFileSync(join(root, 'src', 'App.tsx'), 'utf8');
const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');
const firebaseConfig = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8'));

test('the web client has no callable Cloud Functions dependency', () => {
  assert.doesNotMatch(appSource, /httpsCallable|getFunctions\(/);
  assert.equal(Object.hasOwn(firebaseConfig, 'functions'), false);
});

test('student test access is constrained to published secured group assessments', () => {
  assert.match(appSource, /where\('answerKeysSecured', '==', true\)[\s\S]*?where\('published', '==', true\)[\s\S]*?where\('groupCode', 'in'/);
  assert.match(rules, /resource\.data\.get\('answerKeysSecured', false\) == true[\s\S]*?resource\.data\.get\('published', false\) == true/);
  assert.match(rules, /testGroup == 'all' \|\| \(studentGroup != '' && testGroup == studentGroup\)/);
});

test('answer keys are stored under a teacher-only document path', () => {
  assert.match(rules, /match \/artifacts\/\{appId\}\/teacher\/data\/answerKeys\/\{testId\}[\s\S]*?allow get, list, create, update, delete: if isAuthorizedTeacher\(\)/);
  assert.match(appSource, /sanitizePublicSections\(testToSave\.sections\)|publicSections/);
  assert.match(appSource, /teacherSections/);
  assert.match(appSource, /for \(const field of PRIVATE_QUESTION_FIELDS\) delete visible\[field\]/);
  assert.match(appSource, /for \(const field of PRIVATE_SECTION_FIELDS\) delete publicPart\[field\]/);
});

test('student-created result documents cannot include score fields or question reviews', () => {
  assert.match(rules, /function isUnscoredStudentSubmission\(\)[\s\S]*?request\.resource\.data\.get\('score', null\) == null[\s\S]*?request\.resource\.data\.get\('questionReviews', null\) == null/);
  assert.match(rules, /request\.resource\.data\.get\('gradingMode', ''\) == 'teacher-review-required'/);
});

test('approved teachers may submit practice attempts while scores remain server-protected', () => {
  assert.match(rules, /function accountCanSubmit\(appId, assessmentId, userId\)[\s\S]*?profile\.get\('role', ''\) == 'student'[\s\S]*?profile\.get\('role', ''\) == 'teacher' && isAuthorizedTeacher\(\)/);
  assert.match(rules, /allow create: if accountCanSubmit/);
  assert.match(rules, /request\.resource\.data\.get\('score', null\) == null/);
});

test('students can check only their own submission ID when the document does not exist', () => {
  assert.match(rules, /allow get: if isAuthorizedTeacher\(\)[\s\S]*?submissionId\.matches\(request\.auth\.uid \+ '_\.\*'\)[\s\S]*?resource == null/);
  assert.match(rules, /allow list: if isAuthorizedTeacher\(\)[\s\S]*?resource\.data\.get\('studentUid', ''\) == request\.auth\.uid/);
});

test('IELTS assessment writing accepts inline suggestions with Tab', () => {
  assert.match(appSource, /aria-hidden="true"[\s\S]*?inlineCompletion/);
  assert.match(appSource, /event\.key === 'Tab' && acceptInlineCompletion\(\)/);
  assert.match(appSource, /Faint text is a suggested continuation\. Press Tab to accept it/);
});

test('combined SAT records both source assessments and checks student access to the second section', () => {
  assert.match(appSource, /practiceSourceTestIds: practiceMetadata\.sourceTestIds \|\| \[test\.id\]/);
  assert.match(appSource, /sourceTestIds: \[readingWriting\.id, math\.id\]/);
  assert.match(rules, /request\.resource\.data\.get\('secondaryAssessmentId', ''\) == '' \|\| accountCanSubmit/);
  assert.match(rules, /function validSubmissionAssessmentIds\(\)[\s\S]*?ids\.size\(\) <= 2[\s\S]*?ids\[1\] == secondaryId/);
});
