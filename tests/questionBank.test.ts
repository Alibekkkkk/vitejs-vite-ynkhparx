import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parseQuestionBank } from '../src/questionBank.ts';

const banksDirectory = join(process.cwd(), 'sample-data');

test('every sample bank parses through the application question validator', () => {
  const files = readdirSync(banksDirectory).filter(name => name.endsWith('.json'));
  assert.equal(files.length, 6);
  for (const file of files) {
    const bank = parseQuestionBank(JSON.parse(readFileSync(join(banksDirectory, file), 'utf8')));
    assert.ok(bank.title, file);
    assert.ok(bank.questions.length > 0, file);
  }
});

test('question-bank parser reports duplicate IDs and unsupported schema versions', () => {
  const base = JSON.parse(readFileSync(join(banksDirectory, 'nuet-regression-pilot.json'), 'utf8'));
  const duplicate = structuredClone(base);
  duplicate.questions[1].id = duplicate.questions[0].id;
  assert.throws(() => parseQuestionBank(duplicate), /duplicates/);
  assert.throws(() => parseQuestionBank({ ...base, schemaVersion: 2 }), /schemaVersion/);
  const brokenReference = JSON.parse(readFileSync(join(banksDirectory, 'ielts-reading-pilot.json'), 'utf8'));
  brokenReference.questions[0].passageNumber = 4;
  assert.throws(() => parseQuestionBank(brokenReference), /passageNumber/);
});
