import assert from 'node:assert/strict';
import test from 'node:test';
import { getQuestionTextFormattingRuns, parseQuestionTextFormatting, stripQuestionTextFormatting } from '../src/questionTextFormatting.ts';

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
  assert.equal(stripQuestionTextFormatting('[[align:justify]]not a supported tag[[/align]]'), '[[align:justify]]not a supported tag[[/align]]');
  assert.equal(stripQuestionTextFormatting('[[size:100]]not a supported size[[/size]]'), '[[size:100]]not a supported size[[/size]]');
});
