import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeGroupCodes,
  getAssessmentGroupCodes,
  isAssessmentAssignedToGroup,
  mergeAssessmentsById,
  normalizeGroupCodes,
  parseGroupCodeInput,
  planGroupCodeMigration,
  toGroupFields,
} from '../src/groupCodes.ts';

test('group codes are trimmed, lower-cased, deduplicated and "all" wins', () => {
  assert.deepEqual(normalizeGroupCodes([' Group A ', 'group a', 'B', '']), ['group a', 'b']);
  assert.deepEqual(normalizeGroupCodes(['a', 'ALL', 'b']), ['all']);
  assert.deepEqual(normalizeGroupCodes(undefined), []);
});

test('pasted group lists use commas or new lines and keep spaces inside a code', () => {
  assert.deepEqual(parseGroupCodeInput('nuet - ayaulym and ayana, nuet-b\nielts-1;nuet-b'), ['nuet - ayaulym and ayana', 'nuet-b', 'ielts-1']);
});

test('legacy single groupCode is read as a one item list', () => {
  assert.deepEqual(getAssessmentGroupCodes({ groupCode: 'Yerkebulan01' }), ['yerkebulan01']);
  assert.deepEqual(getAssessmentGroupCodes({ groupCode: '' }), []);
  assert.deepEqual(getAssessmentGroupCodes({ groupCode: 'old', groupCodes: ['a', 'b'] }), ['a', 'b']);
  assert.deepEqual(getAssessmentGroupCodes({ groupCode: 'old', groupCodes: [] }), []);
});

test('saved fields keep groupCode as the first group for older readers', () => {
  assert.deepEqual(toGroupFields(['B', 'a']), { groupCode: 'b', groupCodes: ['b', 'a'] });
  assert.deepEqual(toGroupFields([]), { groupCode: '', groupCodes: [] });
  assert.deepEqual(toGroupFields(['x', 'all']), { groupCode: 'all', groupCodes: ['all'] });
});

test('students see an assessment when any assigned group matches or it is for all', () => {
  assert.equal(isAssessmentAssignedToGroup({ groupCodes: ['a', 'b'] }, 'B'), true);
  assert.equal(isAssessmentAssignedToGroup({ groupCodes: ['a', 'b'] }, 'c'), false);
  assert.equal(isAssessmentAssignedToGroup({ groupCodes: ['all'] }, ''), true);
  assert.equal(isAssessmentAssignedToGroup({ groupCode: 'a' }, 'a'), true);
  assert.equal(isAssessmentAssignedToGroup({ groupCode: 'a' }, ''), false);
  assert.equal(isAssessmentAssignedToGroup({}, 'a'), false);
});

test('group descriptions are readable', () => {
  assert.equal(describeGroupCodes({ groupCodes: ['a', 'b'] }), 'a, b');
  assert.equal(describeGroupCodes({ groupCode: 'all' }), 'All students');
  assert.equal(describeGroupCodes({}), 'Not assigned');
});

test('migration only touches assigned assessments that lack groupCodes', () => {
  const plan = planGroupCodeMigration([
    { id: '1', groupCode: 'Group-A' },
    { id: '2', groupCode: '' },
    { id: '3', groupCode: 'x', groupCodes: ['x', 'y'] },
    { id: '4', groupCode: 'all' },
    { groupCode: 'no-id' },
  ]);
  assert.deepEqual(plan, [
    { id: '1', groupCode: 'group-a', groupCodes: ['group-a'] },
    { id: '4', groupCode: 'all', groupCodes: ['all'] },
  ]);
});

test('assessments returned by several queries are merged once', () => {
  assert.deepEqual(mergeAssessmentsById([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]).map(item => item.id), ['a', 'b', 'c']);
});
