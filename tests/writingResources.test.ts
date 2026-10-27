import test from 'node:test';
import assert from 'node:assert/strict';
import { getMatchingWritingResources, parseWritingResource, validateWritingResource, type WritingResource } from '../src/writingResources.ts';

const resource: WritingResource = {
  schemaVersion: 1,
  id: 'forests',
  title: "Vocabulary for the World's Forests",
  language: 'en',
  exam: 'IELTS',
  skill: 'writing',
  taskType: 1,
  sections: [{
    id: 'nouns',
    title: 'Nouns',
    columns: ['Original Word/Phrase', 'Definition', 'Synonyms / Alternative Phrases'],
    rows: [{ original: 'pie chart', definition: 'a circular graph', alternatives: ['pie graph', 'circular chart'] }],
  }],
  status: 'draft',
  createdBy: 'teacher',
};

test('writing resource JSON round trip preserves section and alternatives order', () => {
  const parsed = parseWritingResource(JSON.parse(JSON.stringify(resource)));
  assert.deepEqual(parsed.sections[0].rows[0].alternatives, ['pie graph', 'circular chart']);
  assert.deepEqual(parsed.sections.map(section => section.id), ['nouns']);
});

test('writing resource validation rejects missing headings and empty required cells', () => {
  const malformed = structuredClone(resource);
  malformed.sections[0].rows[0] = { original: '', definition: '', alternatives: [] };
  assert.throws(() => parseWritingResource(malformed), /original is required/);
  assert.deepEqual(validateWritingResource({ ...resource, title: '', sections: [] }), ['Add a resource title.', 'Add at least one section.']);
});

test('writing resource parser rejects unsafe oversized content but stores markup only as plain text', () => {
  const withMarkup = structuredClone(resource);
  withMarkup.sections[0].rows[0].original = '<script>alert(1)</script>';
  assert.equal(parseWritingResource(withMarkup).sections[0].rows[0].original, '<script>alert(1)</script>');
  const oversized = structuredClone(resource);
  oversized.sections[0].rows[0].definition = 'x'.repeat(1001);
  assert.throws(() => parseWritingResource(oversized), /allowed text length/);
});

test('published resources match the selected task and linked assessment during preview and practice', () => {
  const linked = {
    ...resource,
    status: 'published' as const,
    linkedAssessmentId: 'task-1',
    linkedQuestionId: 'prompt-1',
  };
  assert.deepEqual(getMatchingWritingResources([linked], 1, 'task-1', 'prompt-1'), [linked]);
  assert.deepEqual(getMatchingWritingResources([linked], 1), []);
  assert.deepEqual(getMatchingWritingResources([resource], 1), []);
});
