import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parseQuestionBank } from '../src/questionBank.ts';

const banksDirectory = join(process.cwd(), 'sample-data');
const privateBanksSkip = !existsSync(join(banksDirectory, 'nuet-regression-pilot.json'))
  ? 'Teacher-only sample banks are local and Git-ignored; provide sample-data to run bank-content checks.'
  : false;

test('every sample bank parses through the application question validator', { skip: privateBanksSkip }, () => {
  const files = readdirSync(banksDirectory).filter(name => name.endsWith('.json') && name !== 'sat-combined-full.json');
  assert.ok(files.length >= 9);
  for (const file of files) {
    const bank = parseQuestionBank(JSON.parse(readFileSync(join(banksDirectory, file), 'utf8')));
    assert.ok(bank.title, file);
    assert.ok(bank.questions.length > 0, file);
  }
});

test('combined SAT manifest references both complete banks with distinct source IDs', { skip: privateBanksSkip }, () => {
  const manifest = JSON.parse(readFileSync(join(banksDirectory, 'sat-combined-full.json'), 'utf8'));
  const rw = parseQuestionBank(JSON.parse(readFileSync(join(banksDirectory, manifest.sections[0].bankFile), 'utf8')));
  const math = parseQuestionBank(JSON.parse(readFileSync(join(banksDirectory, manifest.sections[1].bankFile), 'utf8')));
  assert.equal(manifest.questionCount, 98);
  assert.equal(manifest.testingDurationSeconds, 134 * 60);
  assert.equal(manifest.optionalBreakSeconds, 10 * 60);
  assert.equal(rw.questions.length + math.questions.length, 98);
  assert.equal(new Set([...rw.questions, ...math.questions].map(question => question.id)).size, 98);
});

test('full SAT Reading and Writing bank has 54 keyed questions in two 27-question modules', { skip: privateBanksSkip }, () => {
  const bank = parseQuestionBank(JSON.parse(readFileSync(join(banksDirectory, 'sat-reading-writing-full.json'), 'utf8')));
  assert.equal(bank.questions.length, 54);
  assert.equal(bank.durationSeconds, 64 * 60);
  assert.equal(bank.questions.filter(question => question.satModule === 1).length, 27);
  assert.equal(bank.questions.filter(question => question.satModule === 2).length, 27);
  assert.ok(bank.questions.every(question => question.correctAnswer !== undefined && question.explanation));
});

test('full IELTS Listening is complete but cannot be published without four verified recordings', { skip: privateBanksSkip }, () => {
  const bank = parseQuestionBank(JSON.parse(readFileSync(join(banksDirectory, 'ielts-listening-full.json'), 'utf8')));
  assert.equal(bank.questions.length, 40);
  assert.equal(bank.sections?.listening?.parts?.length, 4);
  for (const part of bank.sections.listening.parts) {
    assert.equal(bank.questions.filter(question => question.listeningSectionNumber === part.sectionNumber).length, 10);
    assert.ok(part.recordingScript.length > 250);
    assert.equal(part.audioUrl, '');
    assert.equal(part.audioVerified, false);
  }
});

test('question-bank parser reports duplicate IDs and unsupported schema versions', { skip: privateBanksSkip }, () => {
  const base = JSON.parse(readFileSync(join(banksDirectory, 'nuet-regression-pilot.json'), 'utf8'));
  const duplicate = structuredClone(base);
  duplicate.questions[1].id = duplicate.questions[0].id;
  assert.throws(() => parseQuestionBank(duplicate), /duplicates/);
  assert.throws(() => parseQuestionBank({ ...base, schemaVersion: 2 }), /schemaVersion/);
  const brokenReference = JSON.parse(readFileSync(join(banksDirectory, 'ielts-reading-pilot.json'), 'utf8'));
  brokenReference.questions[0].passageNumber = 4;
  assert.throws(() => parseQuestionBank(brokenReference), /passageNumber/);
});

test('Digital SAT Math full bank has 44 keyed questions and two 22-question modules', { skip: privateBanksSkip }, () => {
  const raw = JSON.parse(readFileSync(join(banksDirectory, 'sat-math-full.json'), 'utf8'));
  const bank = parseQuestionBank(raw);
  assert.equal(bank.questions.length, 44);
  assert.equal(bank.durationSeconds, 70 * 60);
  assert.equal((bank.sections?.sat as any)?.modules?.length, 2);
  assert.equal(bank.questions.filter(question => question.satModule === 1).length, 22);
  assert.equal(bank.questions.filter(question => question.satModule === 2).length, 22);
  assert.ok(bank.questions.every(question => question.correctAnswer !== undefined && question.explanation));
});

test('combined SAT module plan totals 98 questions and preserves the optional break', { skip: privateBanksSkip }, () => {
  const manifest = JSON.parse(readFileSync(join(banksDirectory, 'sat-combined-full.json'), 'utf8'));
  const plan = [
    { start: 0, end: 27, durationSeconds: 32 * 60 },
    { start: 27, end: 54, durationSeconds: 32 * 60, breakAfter: true },
    { start: 54, end: 76, durationSeconds: 35 * 60 },
    { start: 76, end: 98, durationSeconds: 35 * 60 },
  ];
  assert.equal(plan.at(-1)?.end, manifest.questionCount);
  assert.equal(plan.reduce((sum, module) => sum + module.durationSeconds, 0), manifest.testingDurationSeconds);
  assert.equal(manifest.optionalBreakSeconds, 10 * 60);
  assert.equal(plan.filter(module => module.breakAfter).length, 1);
});
