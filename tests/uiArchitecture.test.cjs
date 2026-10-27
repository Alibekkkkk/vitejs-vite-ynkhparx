const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const globalStyles = readFileSync(join(root, 'src', 'index.css'), 'utf8');
const splitPane = readFileSync(join(root, 'src', 'ResizableSplitPane.tsx'), 'utf8');
const app = readFileSync(join(root, 'src', 'App.tsx'), 'utf8');

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
  assert.match(app, /writingResources=\{writingResources\} writingResourcesError=\{writingResourcesError\} onComplete=\{completeTest\}/);
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
