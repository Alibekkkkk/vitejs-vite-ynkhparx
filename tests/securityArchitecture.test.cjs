const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const appSource = readFileSync(join(root, 'src', 'App.tsx'), 'utf8');
const legacyMigration = readFileSync(join(root, 'src', 'legacyMigration.ts'), 'utf8');
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

test('legacy imports are teacher-only, deterministic, and keep historical scores out of trusted fields', () => {
  assert.match(rules, /match \/artifacts\/\{appId\}\/users\/\{userId\}\/results\/\{resultId\}[\s\S]*?allow get, list: if isAuthorizedTeacher\(\) \|\|/);
  assert.match(rules, /request\.resource\.data\.get\('gradingMode', ''\) == 'legacy-unverified'[\s\S]*?request\.resource\.data\.keys\(\)\.hasOnly/);
  assert.match(rules, /request\.resource\.data\.get\('importedBy', ''\) == request\.auth\.uid/);
  assert.match(appSource, /mapLegacyResult\(/);
  assert.match(legacyMigration, /gradingMode: 'legacy-unverified'/);
  assert.match(legacyMigration, /legacyHistoricalData/);
  assert.match(appSource, /dryRun \? 'dry run' : 'import'/);
});

test('published writing resources are student-readable but writable only by authorized teachers', () => {
  assert.match(rules, /match \/artifacts\/\{appId\}\/public\/data\/writingResources\/\{resourceId\}[\s\S]*?resource\.data\.get\('status', ''\) == 'published'[\s\S]*?allow create, update, delete: if isAuthorizedTeacher\(\)/);
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

test('IELTS writing suggestions are visible locally and can be accepted or dismissed accessibly', () => {
  assert.match(appSource, /getLocalWritingSuggestions\(/);
  assert.match(appSource, /event\.key === 'Tab' && localSuggestions\[0\] && !localSuggestionDismissed/);
  assert.match(appSource, /insertPhrase\(localSuggestions\[0\]\.phrase\)/);
  assert.match(appSource, /event\.key === 'Escape' && localSuggestions\[0\] && !localSuggestionDismissed/);
  assert.match(appSource, /event\.key === 'Escape' && aiInlineSuggestion/);
  assert.match(appSource, /Offline suggestion:[\s\S]*?Press Tab to insert it when no AI suggestion is showing/);
  assert.match(appSource, /requestCoach\('inline'\)/);
  assert.match(appSource, /AI next-sentence suggestion/);
  assert.match(appSource, /requestParts\.push\(\{ inlineData: figureData \}\)/);
  assert.match(appSource, /writingCoachConsent:v2/);
  assert.match(appSource, /Task 1 coaching must be a factual visual report/);
  assert.match(appSource, /Task 2 coaching must address every part of the essay question/);
});

test('exam completion requires an in-app confirmation before submission', () => {
  assert.match(appSource, /title="Finish and submit exam\?"/);
  assert.match(appSource, /Are you sure you want to finish/);
  assert.match(appSource, /label: 'Keep working'/);
  assert.match(appSource, /label: isSubmitting \? 'Submitting…' : 'Submit answers'/);
  assert.match(appSource, /onClick=\{\(\) => setFinishConfirmationOpen\(true\)\}/);
});

test('timed exams show a countdown and submit automatically when time expires', () => {
  assert.match(appSource, /role="timer"/);
  assert.match(appSource, /deadlineMs\.current - Date\.now\(\)/);
  assert.match(appSource, /submitAttemptRef\.current\(true\)/);
  assert.match(appSource, /Time is up\. Your answers are being submitted\./);
});

test('active exam refreshes restore answers and the original deadline, with a five-minute return limit', () => {
  assert.match(appSource, /examAttempt:\$\{userId\}:\$\{test\?\.id\}/);
  assert.match(appSource, /attemptId,\s*answers,[\s\S]*?startedAtMs,/);
  assert.match(appSource, /answers, currentIndex, startedAtMs/);
  assert.match(appSource, /window\.addEventListener\('pagehide', markAttemptExit\)/);
  assert.match(appSource, /EXAM_RETURN_GRACE_MS/);
  assert.match(appSource, /Exam attempt closed/);
  assert.match(appSource, /restoreExamAttempt\(localStorage\.getItem\(attemptStorageKey\)/);
});

test('student dashboard distinguishes assigned assessments from coached practice', () => {
  assert.match(appSource, /Available Tasks are assessments assigned by your teacher/);
  assert.match(appSource, /Practice is self-directed skill work/);
  assert.match(appSource, /AI coaching is not available during assigned tasks/);
  assert.match(appSource, /Local suggestions are always available, including offline/);
});

test('teacher assessments separate archived items and allow restoring them as drafts', () => {
  assert.match(appSource, /Active assessments/);
  assert.match(appSource, /'archived', 'Archived'/);
  assert.match(appSource, /tests\.filter\(test => assessmentView === 'archived' \? test\.status === 'archived' : test\.status !== 'archived'\)/);
  assert.match(appSource, /Return archived assessment to drafts/);
  assert.match(appSource, /status: 'draft', updatedAt/);
});

test('student feedback replies are append-only and cannot modify grading data', () => {
  assert.match(rules, /function validStudentFeedbackReplyUpdate\(userId\)[\s\S]*?affectedKeys\(\)\.hasOnly\(\['teacherFeedbackReplies'\]\)[\s\S]*?updatedReplies\.size\(\) == existingReplies\.size\(\) \+ 1[\s\S]*?reply\.get\('studentUid', ''\) == userId[\s\S]*?reply\.get\('body', ''\)\.size\(\) <= 1000/);
  assert.match(rules, /allow update: if \([\s\S]*?validStudentFeedbackReplyUpdate\(userId\)/);
  assert.match(rules, /resource\.data\.get\('studentUid', ''\) == request\.auth\.uid && validStudentFeedbackReplyUpdate/);
  assert.match(appSource, /teacherFeedbackReplies: arrayUnion\(reply\)/);
  assert.match(appSource, /Student reply/);
});

test('students can delete only their own past result and matching submission records', () => {
  assert.match(rules, /match \/artifacts\/\{appId\}\/users\/\{userId\}\/results\/\{resultId\}[\s\S]*?allow delete: if signedIn\(\)[\s\S]*?request\.auth\.uid == userId[\s\S]*?resultId == resource\.data\.get\('attemptId', ''\)/);
  assert.match(rules, /match \/artifacts\/\{appId\}\/public\/data\/submissions\/\{submissionId\}[\s\S]*?allow delete: if signedIn\(\)[\s\S]*?resource\.data\.get\('studentUid', ''\) == request\.auth\.uid[\s\S]*?submissionId == request\.auth\.uid \+ '_' \+ resource\.data\.get\('attemptId', ''\)[\s\S]*?gradingMode', ''\) != 'legacy-unverified'/);
  assert.match(appSource, /batch\.delete\(studentResultRefs\[resultIndex\]\)/);
  assert.match(appSource, /batch\.delete\(centralSubmissionRefs\[resultIndex\]\)/);
  assert.match(appSource, /Delete all/);
  assert.match(appSource, /Delete selected/);
});

test('only archived assessments can be deleted and the UI preserves their historical results', () => {
  assert.match(rules, /allow delete: if isAuthorizedTeacher\(\) && resource\.data\.get\('status', ''\) == 'archived'/);
  assert.match(appSource, /batch\.delete\(doc\(db, 'artifacts', appId, 'public', 'data', 'tests', test\.id\)\)/);
  assert.match(appSource, /batch\.delete\(doc\(db, 'artifacts', appId, 'teacher', 'data', 'answerKeys', test\.id\)\)/);
  assert.match(appSource, /Student submissions and historical results will be preserved/);
});

test('combined SAT records both source assessments and checks student access to the second section', () => {
  assert.match(appSource, /practiceSourceTestIds: practiceMetadata\.sourceTestIds \|\| \[test\.id\]/);
  assert.match(appSource, /sourceTestIds: \[readingWriting\.id, math\.id\]/);
  assert.match(rules, /request\.resource\.data\.get\('secondaryAssessmentId', ''\) == '' \|\| accountCanSubmit/);
  assert.match(rules, /function validSubmissionAssessmentIds\(\)[\s\S]*?ids\.size\(\) <= 2[\s\S]*?ids\[1\] == secondaryId/);
});

test('assessments can be assigned to several groups while the single groupCode keeps working', () => {
  assert.match(rules, /function canReadTestForStudent\(appId\)[\s\S]*?'all' in testGroups[\s\S]*?studentGroup in testGroups/);
  assert.match(rules, /function accountCanSubmit[\s\S]*?assignedGroups[\s\S]*?group in assignedGroups/);
  assert.match(appSource, /where\('groupCodes', 'array-contains', ALL_GROUPS\)/);
  assert.match(appSource, /where\('groupCodes', 'array-contains', studentGroup\)/);
  assert.match(appSource, /planGroupCodeMigration\(testsData\)/);
  assert.match(appSource, /\.\.\.toGroupFields\(assignedGroups\)/);
  assert.match(appSource, /<GroupCodeInput /);
  const functions = readFileSync(join(root, 'functions', 'index.js'), 'utf8');
  assert.match(functions, /Array\.isArray\(assessment\.groupCodes\)/);
});

test('objective answers are graded automatically instead of waiting for a teacher to open each submission', () => {
  assert.match(appSource, /gradeSubmissionsAutomatically/);
  assert.match(appSource, /needsAutoGrading\(submission\)/);
  assert.match(appSource, /Regrade all submissions/);
  assert.doesNotMatch(appSource, /A teacher must review them before a score is available/);
  assert.match(rules, /'unansweredCount', 'reviewedAt', 'autoGradedAt'/);
});

test('answer keys are released only to a student who already has an attempt for that assessment', () => {
  assert.match(rules, /function hasCompletedAssessment\(appId, assessmentId\)[\s\S]*?completedAssessments\/\$\(assessmentId\)[\s\S]*?completedMarkerHasEligibleResult/);
  assert.match(rules, /function completedMarkerHasEligibleResult[\s\S]*?results\/\$\(attemptId\)[\s\S]*?isPractice[\s\S]*?assessmentId in get\(/);
  assert.match(rules, /match \/artifacts\/\{appId\}\/teacher\/data\/answerKeys\/\{testId\}[\s\S]*?allow get: if signedIn\(\)[\s\S]*?hasCompletedAssessment\(appId, testId\)/);
  assert.match(rules, /match \/artifacts\/\{appId\}\/users\/\{userId\}\/completedAssessments\/\{assessmentId\}[\s\S]*?existsAfter\([\s\S]*?results[\s\S]*?isPractice[\s\S]*?assessmentIds/);
  assert.match(rules, /allow list: if isAuthorizedTeacher\(\)/);
  assert.doesNotMatch(rules, /answerKeys\/\{testId\}[\s\S]{0,200}allow list: if signedIn\(\)/);
});

test('a student can attach one provisional grade to their own result but cannot change trusted scores', () => {
  assert.match(rules, /function validStudentSelfGradeUpdate\(userId\)[\s\S]*?resource\.data\.get\('selfGrade', null\) == null[\s\S]*?hasOnly\(\['selfGrade'\]\)/);
  assert.match(rules, /validStudentSelfGradeUpdate\(userId\)\s*\|\|\s*validStudentFeedbackReplyUpdate\(userId\)/);
  assert.doesNotMatch(rules, /submissions\/\{submissionId\}[\s\S]*?validStudentSelfGradeUpdate/);
});

test('an approved teacher can move a student to another group but cannot change anything else on the profile', () => {
  assert.match(rules, /isAuthorizedTeacher\(\)\s*&& profileId == 'info'\s*&& resource\.data\.get\('role', 'student'\) == 'student'\s*&& request\.resource\.data\.get\('role', 'student'\) == 'student'\s*&& request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\['groupCode'\]\)/);
  assert.match(appSource, /changeStudentGroup/);
  assert.match(appSource, /<StudentGroupControl /);
});

test('exam attempts warn before leaving, flag questions and report connection problems', () => {
  assert.match(appSource, /useLeaveWarning\(!isSubmitting\)/);
  assert.match(appSource, /<QuestionNavigator /);
  assert.match(appSource, /<ExamNotices /);
  const modalSource = appSource.match(/const Modal = [\s\S]*?\n};/)[0];
  assert.match(modalSource, /useFocusTrap\(/);
});

test('the interface never uses bullet or middle-dot characters as separators', () => {
  const { readdirSync } = require('node:fs');
  const sourceFiles = readdirSync(join(root, 'src')).filter(name => /\.(tsx|ts)$/.test(name));
  const offenders = [];
  for (const name of sourceFiles) {
    const lines = readFileSync(join(root, 'src', name), 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      const stripped = line.replace(/placeholder="•+"/g, '').replace(/\[-\*•\]/g, '');
      if (/[•·]/.test(stripped)) offenders.push(`${name}:${index + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});

test('dates, titles and results never expose raw formatting markers', () => {
  assert.match(appSource, /formatAssessmentTitle\(test\?\.title, 'this exam'\)/);
  assert.doesNotMatch(appSource, />\{test\.title\}</);
  assert.doesNotMatch(appSource, />\{attempt\.assessmentTitle\}</);
});
