import assert from 'node:assert/strict';
import test from 'node:test';
import { getQuestionTextFormattingRuns, parseQuestionTextFormatting, stripQuestionTextFormatting } from '../src/questionTextFormatting.ts';
import { formatAssessmentTitle } from '../src/assessmentTitle.ts';

test('question formatting parser handles bold, italic, underline, and normal text', () => {
  assert.deepEqual(parseQuestionTextFormatting('Use **bold**, *italic*, and ++underline++.'), [
    { style: 'plain', text: 'Use ' },
    { style: 'bold', text: 'bold' },
    { style: 'plain', text: ', ' },
    { style: 'italic', text: 'italic' },
    { style: 'plain', text: ', and ' },
    { style: 'underline', text: 'underline' },
    { style: 'plain', text: '.' },
  ]);
});

test('question formatting is safe text and leaves unsupported HTML as plain text', () => {
  const text = '<img src=x onerror=alert(1)> **important**';
  const parts = parseQuestionTextFormatting(text);
  assert.equal(parts[0].text, '<img src=x onerror=alert(1)> ');
  assert.equal(parts[1].style, 'bold');
  assert.equal(stripQuestionTextFormatting(text), '<img src=x onerror=alert(1)> important');
});

test('question formatting preserves line breaks and unclosed markers literally', () => {
  assert.deepEqual(parseQuestionTextFormatting('Line one\n**unfinished'), [
    { style: 'plain', text: 'Line one\n**unfinished' },
  ]);
});

test('question formatting supports safe alignment and bounded font sizes, including nested emphasis', () => {
  const formatted = 'Before [[align:center]][[size:24]]**Important** text[[/size]][[/align]] after';
  const parts = parseQuestionTextFormatting(formatted);
  assert.equal(parts[1].style, 'align');
  assert.equal(parts[1].align, 'center');
  assert.equal(parts[1].children?.[0].style, 'size');
  assert.equal(parts[1].children?.[0].fontSize, 24);
  assert.equal(stripQuestionTextFormatting(formatted), 'Before Important text after');
  assert.deepEqual(getQuestionTextFormattingRuns(formatted).map(({ start, end, style, align, fontSize }) => ({ start, end, style, align, fontSize })), [
    { start: 0, end: 7, style: 'plain', align: undefined, fontSize: undefined },
    { start: 7, end: 16, style: 'bold', align: 'center', fontSize: 24 },
    { start: 16, end: 21, style: 'plain', align: 'center', fontSize: 24 },
    { start: 21, end: 27, style: 'plain', align: undefined, fontSize: undefined },
  ]);
  // An unsupported opening marker stays literal; a closing marker without a partner is never shown.
  assert.equal(stripQuestionTextFormatting('[[align:justify]]not a supported tag[[/align]]'), '[[align:justify]]not a supported tag');
  assert.equal(stripQuestionTextFormatting('[[size:100]]not a supported size[[/size]]'), '[[size:100]]not a supported size');
});

test('question formatting renders alignment and emphasis nested inside size and bold wrappers', () => {
  const formatted = '[[size:24]]**[[align:center]]Why we need to protect polar bears[[/align]]**[[/size]]';
  const parts = parseQuestionTextFormatting(formatted);

  assert.equal(parts[0].style, 'size');
  assert.equal(parts[0].fontSize, 24);
  assert.equal(parts[0].children?.[0].style, 'bold');
  assert.equal(parts[0].children?.[0].children?.[0].style, 'align');
  assert.equal(parts[0].children?.[0].children?.[0].align, 'center');
  assert.equal(stripQuestionTextFormatting(formatted), 'Why we need to protect polar bears');
  assert.deepEqual(getQuestionTextFormattingRuns(formatted).map(({ start, end, style, align, fontSize }) => ({ start, end, style, align, fontSize })), [
    { start: 0, end: 34, style: 'bold', align: 'center', fontSize: 24 },
  ]);
});

test('legacy title with bold wrapped around alignment becomes plain text', () => {
  assert.equal(formatAssessmentTitle('**[[align:center]]NUET Critical Thinking Mock Exam #2[[/align]]**'), 'NUET Critical Thinking Mock Exam #2');
});

test('markers that cross each other never leak into plain text', () => {
  assert.equal(stripQuestionTextFormatting('**[[align:center]]Crossed title**[[/align]]'), 'Crossed title');
  assert.equal(stripQuestionTextFormatting('[[size:24]]Only opening marker'), 'Only opening marker');
  assert.equal(stripQuestionTextFormatting('Only closing marker[[/size]]'), 'Only closing marker');
  assert.equal(stripQuestionTextFormatting('*[[align:right]]italic*[[/align]] tail'), 'italic tail');
});

test('partially styled titles keep unstyled words and drop every marker', () => {
  assert.equal(formatAssessmentTitle('Mock **Exam** [[size:20]]#[[/size]]3'), 'Mock Exam #3');
  assert.equal(formatAssessmentTitle('++Part++ [align:center]one[/align]'), 'Part one');
  assert.equal(formatAssessmentTitle('   '), 'Untitled assessment');
  assert.equal(formatAssessmentTitle(null, 'Assessment'), 'Assessment');
});

test('question formatting supports legacy single-bracket align and size tags', () => {
  const formatted = '**[align:center]NUET Critical Thinking Mock Exam #1[/align]**';
  assert.equal(stripQuestionTextFormatting(formatted), 'NUET Critical Thinking Mock Exam #1');

  const withSize = '[size:24]Title[/size]';
  assert.equal(stripQuestionTextFormatting(withSize), 'Title');
});
