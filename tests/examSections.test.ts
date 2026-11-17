import test from 'node:test';
import assert from 'node:assert/strict';
import { getExamFamily, getExamSection, groupTestsForDashboard } from '../src/examSections.ts';

test('exam families follow the assessment type', () => {
  assert.equal(getExamFamily({ type: 'NUET Training' }), 'NUET');
  assert.equal(getExamFamily({ type: 'NUET' }), 'NUET');
  assert.equal(getExamFamily({ type: 'SAT Training' }), 'SAT');
  assert.equal(getExamFamily({ type: 'IELTS' }), 'IELTS');
  assert.equal(getExamFamily({ type: 'General' }), 'General');
});

test('a teacher-chosen section wins, older tests are guessed, unknown stays empty', () => {
  assert.equal(getExamSection({ type: 'NUET', examSection: 'math', title: 'Critical thinking' }), 'math');
  assert.equal(getExamSection({ type: 'NUET Training', title: 'TSA 2021 Section 1' }), 'critical-thinking');
  assert.equal(getExamSection({ type: 'NUET', title: 'Mock exam #1' }), '');
  assert.equal(getExamSection({ type: 'SAT', questions: [{ satDomain: 'Algebra' }] }), 'math');
  assert.equal(getExamSection({ type: 'SAT Training', questions: [{ satDomain: 'Craft and Structure' }] }), 'verbal');
  assert.equal(getExamSection({ type: 'SAT', examSection: 'critical-thinking', title: 'Reading practice' }), 'verbal');
  assert.equal(getExamSection({ type: 'IELTS' }), '');
});

test('dashboard groups come out in a fixed order with clear titles', () => {
  const tests = [
    { id: 'ielts', type: 'IELTS' },
    { id: 'satv', type: 'SAT Training', examSection: 'verbal' },
    { id: 'nuetct', type: 'NUET Training', examSection: 'critical-thinking' },
    { id: 'nuetm', type: 'NUET', examSection: 'math' },
    { id: 'nuetx', type: 'NUET', title: 'Mock exam' },
    { id: 'nuetct2', type: 'NUET', examSection: 'critical-thinking' },
  ];
  const groups = groupTestsForDashboard(tests);
  assert.deepEqual(groups.map(group => group.title), ['NUET Math', 'NUET Critical Thinking', 'Other NUET tasks', 'SAT Verbal', 'IELTS']);
  assert.deepEqual(groups[1].tests.map(item => item.id), ['nuetct', 'nuetct2']);
});
