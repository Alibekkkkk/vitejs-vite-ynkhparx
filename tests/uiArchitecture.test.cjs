const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const globalStyles = readFileSync(join(root, 'src', 'index.css'), 'utf8');
const splitPane = readFileSync(join(root, 'src', 'ResizableSplitPane.tsx'), 'utf8');
const app = readFileSync(join(root, 'src', 'App.tsx'), 'utf8');
const questionTextEditor = readFileSync(join(root, 'src', 'QuestionTextEditor.tsx'), 'utf8');
const readingAnnotations = readFileSync(join(root, 'src', 'ReadingAnnotations.tsx'), 'utf8');
const questionPrompt = readFileSync(join(root, 'src', 'QuestionPrompt.tsx'), 'utf8');

test('form-control theme rules explicitly style light/dark text, focus, disabled, errors, autofill, and selects', () => {
  for (const token of ['background-color', 'color:', 'border-color', 'caret-color', '::placeholder', ':focus-visible', ':disabled', '[aria-invalid="true"]', ':-webkit-autofill', 'select option', '::selection']) {
    assert.ok(globalStyles.includes(token), `Missing form-control style: ${token}`);
  }
  assert.match(globalStyles, /\.dark #root :is\(input[\s\S]*?color: #f8fafc !important/);
  assert.match(globalStyles, /\.dark #root :is\(input[\s\S]*?background-color: #334155 !important/);
});

test('split pane exposes keyboard and pointer resizing with mobile tabs and bounded ARIA values', () => {
  assert.match(splitPane, /role="separator"/);
  assert.match(splitPane, /aria-valuenow=\{Math\.round\(leftPercent\)\}/);
  assert.match(splitPane, /aria-valuemin=\{minLeftPercent\}/);
  assert.match(splitPane, /aria-valuemax=\{maxLeftPercent\}/);
  assert.match(splitPane, /onPointerMove/);
  assert.match(splitPane, /ArrowLeft/);
  assert.match(splitPane, /ArrowRight/);
  assert.match(splitPane, /Reset pane width/);
  assert.match(splitPane, /role="tablist"/);
  assert.match(globalStyles, /@media \(max-width: 767px\)[\s\S]*?\.split-pane__mobile-tabs/);
});

test('reading practice retains a one-passage pane with independent scroll positions', () => {
  assert.match(app, /buildReadingSessionViewModel\(/);
  assert.match(app, /Passage \{activePassageNumber\}/);
  assert.match(app, /passagePaneRef[\s\S]*?passageScroll\.current/);
  assert.match(app, /questionPaneRef[\s\S]*?questionScroll\.current/);
  assert.match(app, /No questions are assigned to Passage/);
});

test('assigned writing exams show the matching published resource beside the writing response', () => {
  assert.match(app, /writingResources=\{writingResources\} writingResourcesError=\{writingResourcesError\}[\s\S]*?onComplete=\{completeTest\}/);
  assert.match(app, /isWritingQuestion \? <ResizableSplitPane/);
  assert.match(app, /leftLabel="Writing task and response"[\s\S]*?rightLabel="Vocabulary resource"/);
  assert.match(app, /<WritingResourceTable[\s\S]*?assessmentId=\{test\?\.practiceSourceTestId \|\| test\?\.id\}[\s\S]*?questionId=\{currentQuestion\.id\}/);
  assert.match(app, /Writing task and response[\s\S]*?renderAnswerInput\(\)/);
  assert.match(app, /currentQuestion\.section === 'writing'[\s\S]*?currentQuestion\.questionType === 'writing-task'[\s\S]*?currentQuestion\.writingTaskType/);
  assert.match(globalStyles, /html\.dark,[\s\S]*?html\.dark body,[\s\S]*?html\.dark #root[\s\S]*?background-color: #0f172a/);
  assert.match(app, /workspaceKey=\{`exam-writing-v2:[\s\S]*?defaultLeftPercent=\{50\}/);
  assert.match(globalStyles, /\.exam-interface--writing[\s\S]*?width: 100%;[\s\S]*?height: 100vh;[\s\S]*?overflow: hidden/);
  assert.match(globalStyles, /\.exam-interface--writing \.exam-writing-workspace > \.split-pane__panel[\s\S]*?height: 100%;[\s\S]*?overflow: auto/);
});

test('teacher question editor offers safe bold, italic, and underline formatting', () => {
  assert.match(app, /<QuestionTextEditor[\s\S]*?value=\{q\.text \|\| ''\}/);
  assert.match(questionTextEditor, /label: 'Bold', marker: '\*\*'/);
  assert.match(questionTextEditor, /label: 'Italic', marker: '\*'/);
  assert.match(questionTextEditor, /label: 'Underline', marker: '\+\+'/);
  assert.match(questionTextEditor, /Align selected text \$\{alignment\}/);
  assert.match(questionTextEditor, /\[\[size:\$\{size\}\]\]/);
  assert.match(app, /ariaLabel="Assessment description and instructions"/);
  assert.match(app, /ariaLabel=\{`Reading Passage \$\{activeReadingPassage\} text`\}/);
  assert.match(app, /ariaLabel="Candidate instructions"/);
  assert.match(app, /ariaLabel="Answer explanation"/);
  assert.match(app, /<FormattedQuestionText text=\{currentQuestion\.text \|\| 'Question prompt'\}/);
  assert.match(app, /<FormattedQuestionText text=\{selectedPrompt\.question\.text\}/);
});

test('exam theme control is in the header and the floating toggle is hidden during exams', () => {
  assert.match(app, /className="exam-interface__header[\s\S]*?aria-label=\{`Switch to \$\{isDark \? 'light' : 'dark'\} mode`\}/);
  assert.match(app, /\{currentView === 'exam' \? null : \([\s\S]*?className="fixed bottom-24 sm:bottom-6 right-6/);
  assert.match(app, /onToggleTheme=\{\(\) => setIsDark\(previous => !previous\)\}/);
});

test('teacher review supports phrase comments and publishes them with student results', () => {
  assert.match(app, /aria-label="Student response; select text to comment"/);
  assert.match(app, /const start = prefix\.toString\(\)\.length \+ leadingWhitespace/);
  assert.match(app, /Comment on selected text/);
  assert.match(app, /Phrase comments \(\{annotations\.length\}\)/);
  assert.match(app, /reviewData\.annotations/);
  assert.match(app, /responseText\.slice\(start, end\) !== quote/);
  assert.match(app, /question\.teacherReview = \{[\s\S]*?annotations: safeAnnotations/);
  assert.match(app, /await updateDoc\(submissionRef, reviewSummary\);[\s\S]*?await updateDoc\(studentResultRef, reviewSummary\)/);
  assert.match(app, /renderTeacherAnnotatedAnswer\(review\.studentAnswer, review\.teacherReview\?\.annotations\)/);
  assert.match(app, /student-feedback-layout/);
  assert.match(app, /Teacher feedback notes/);
  assert.match(app, /onReplyTeacherComment/);
  assert.match(app, /arrayUnion\(reply\)/);
  assert.match(app, /Marking guide/);
});

test('reading exams use full-screen independent panes with selectable annotations', () => {
  assert.match(app, /const isReadingWorkspace = isReadingPractice \|\| Boolean\(currentQuestion && \([\s\S]*?currentQuestion\.section === 'reading'[\s\S]*?currentQuestion\.passageNumber/);
  assert.match(app, /exam-interface--reading/);
  assert.match(app, /<ReadingAnnotations[\s\S]*?storageKey=\{`reading-annotations:/);
  assert.match(globalStyles, /\.exam-interface--reading[\s\S]*?height: 100dvh/);
  assert.match(globalStyles, /\.exam-interface--reading \.reading-workspace > \.split-pane[\s\S]*?flex: 1 1 auto/);
  assert.match(readingAnnotations, /Select passage text to highlight, underline, or add a note/);
  assert.match(readingAnnotations, /const HIGHLIGHT_COLORS = \[/);
  assert.equal((readingAnnotations.match(/\{ name: '(?:Yellow|Orange|Coral|Pink|Purple|Blue|Cyan|Green|Lime|Gray)'/g) || []).length, 10);
  assert.match(readingAnnotations, /role="group" aria-label="Choose highlight color"/);
  assert.match(readingAnnotations, /Drag sticky note/);
  assert.match(readingAnnotations, /onClick=\{\(\) => setVisibleNotes/);
  assert.match(readingAnnotations, /setNotes\(current => current\.filter\(item => item\.id !== note\.id\)\)/);
  assert.match(readingAnnotations, /localStorage\.setItem\(storageKey, JSON\.stringify\(\{ marks, notes \}\)\)/);
});

test('teacher question formats configure matching answer controls and candidate instructions', () => {
  assert.match(app, /handleQuestionFormatChange\(qIndex, event\.target\.value\)/);
  assert.match(app, /question\.responseType = responseType/);
  assert.match(app, /question\.answerSlots = \[1, 2, 3\]/);
  assert.match(app, /Candidate instructions \(optional\)/);
  assert.match(app, /Suggested maximum word count/);
  assert.match(app, /return <QuestionResponse[\s\S]*?disabled=\{timeExpired \|\| isSubmitting\}/);
  assert.match(app, /question\.responseType === 'matching' \? <select/);
  assert.match(app, /question\.responseType === 'ordering'/);
  assert.match(app, /words\{wordCount > answerWordLimit \? ' · over the suggested limit' : ''\}/);
  assert.match(app, /insertions=\{resolveResponseType\(q\) === 'multi-blank'/);
  assert.match(app, /token: `\{\{\$\{index \+ 1\}\}\}`/);
  assert.match(app, /<QuestionPrompt question=\{currentQuestion\} value=\{answers\[currentQuestion\.id\]\}/);
  assert.match(app, /if \(hasInlineAnswerSlots\(currentQuestion\)\) return null/);
  assert.match(app, /!hasInlineAnswerSlots\(q\) && <QuestionResponse/);
  assert.ok(questionPrompt.includes(String.raw`const INLINE_ANSWER_PATTERN = /\{\{(\d+)\}\}/g;`));
  assert.match(questionPrompt, /question\.answerSlots\?\.\[slotNumber - 1\]/);
  assert.match(questionPrompt, /question-prompt__number/);
  assert.match(questionTextEditor, /insertions\.map/);
});
