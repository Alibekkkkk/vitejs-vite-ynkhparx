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

test('combined SAT records both source assessments and checks student access to the second section', () => {
  assert.match(appSource, /practiceSourceTestIds: practiceMetadata\.sourceTestIds \|\| \[test\.id\]/);
  assert.match(appSource, /sourceTestIds: \[readingWriting\.id, math\.id\]/);
  assert.match(rules, /request\.resource\.data\.get\('secondaryAssessmentId', ''\) == '' \|\| studentCanSubmit/);
  assert.match(rules, /function validSubmissionAssessmentIds\(\)[\s\S]*?ids\.size\(\) <= 2[\s\S]*?ids\[1\] == secondaryId/);
});
