import assert from 'node:assert/strict';
import test from 'node:test';
import { parseQuestionTextFormatting, stripQuestionTextFormatting } from '../src/questionTextFormatting.ts';

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
