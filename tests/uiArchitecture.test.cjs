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
