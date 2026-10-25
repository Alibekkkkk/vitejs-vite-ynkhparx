import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseQuestionBank } from '../src/questionBank.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(join(root, 'sample-data', 'nuet-regression-pilot.json'))) {
  console.log('Skipped private-bank validation: sample-data is Git-ignored to keep answer keys out of the public repository.');
  process.exit(0);
}
const readJson = async name => JSON.parse(await readFile(join(root, 'sample-data', name), 'utf8'));
const loadBank = async name => parseQuestionBank(await readJson(name));
const assertModuleSplit = (bank, questionCount, moduleSize, moduleDuration, duration) => {
  assert.equal(bank.questions.length, questionCount, `${bank.title} question count`);
  assert.equal(bank.durationSeconds, duration, `${bank.title} total time`);
  assert.deepEqual(bank.sections.sat.modules.map(item => [item.lastQuestion - item.firstQuestion + 1, item.durationSeconds]), [
    [moduleSize, moduleDuration], [moduleSize, moduleDuration],
  ]);
  for (const moduleNumber of [1, 2]) assert.equal(bank.questions.filter(question => question.satModule === moduleNumber).length, moduleSize);
  assert.ok(bank.questions.every(question => question.correctAnswer !== undefined && question.explanation));
};

for (const name of ['ielts-academic-reading-full.json', 'ielts-general-reading-full.json']) {
  const bank = await loadBank(name);
  assert.equal(bank.questions.length, 40, `${name} has exactly 40 questions`);
  assert.equal(bank.durationSeconds, 3600, `${name} is 60 minutes`);
  assert.equal(bank.sections.reading.passages.length, 3, `${name} has three passages`);
  let linkedQuestions = 0;
  for (const passage of bank.sections.reading.passages) {
    assert.ok(passage.content.trim().length > 100, `${name} passage ${passage.passageNumber} has original reading content`);
    const count = bank.questions.filter(question => question.passageNumber === passage.passageNumber).length;
    assert.ok(count >= 13 && count <= 14, `${name} passage ${passage.passageNumber} has a balanced question set`);
    linkedQuestions += count;
  }
  assert.equal(linkedQuestions, 40);
  assert.ok(bank.questions.every(question => question.correctAnswer !== undefined || question.answerSlots?.every(slot => slot.correctAnswers?.length)));
  assert.deepEqual(parseQuestionBank(JSON.parse(JSON.stringify(bank))).questions.map(question => question.id), bank.questions.map(question => question.id));
}

const listening = await loadBank('ielts-listening-full.json');
assert.equal(listening.questions.length, 40);
assert.equal(listening.durationSeconds, 1800);
assert.equal(listening.sections.listening.parts.length, 4);
for (const part of listening.sections.listening.parts) {
  assert.equal(listening.questions.filter(question => question.listeningSectionNumber === part.sectionNumber).length, 10);
  assert.ok(part.recordingScript.trim().length > 250);
  assert.ok(part.recordingNotes.trim());
  assert.equal(part.audioUrl, '');
  assert.equal(part.audioVerified, false);
}

for (const name of ['ielts-academic-writing-full.json', 'ielts-general-writing-full.json']) {
  const bank = await loadBank(name);
  assert.deepEqual(bank.questions.map(question => question.writingTaskType).sort(), [1, 2]);
  assert.ok(bank.questions.every(question => question.manualReview && question.minimumWords >= 150 && question.evaluationCriteria?.length >= 3));
}

const satRw = await loadBank('sat-reading-writing-full.json');
assertModuleSplit(satRw, 54, 27, 1920, 3840);
assert.equal(new Set(satRw.questions.map(question => question.text)).size, 54, 'SAT Reading and Writing items have distinct prompts.');
assert.deepEqual([...new Set(satRw.questions.map(question => question.satDomain))].sort(), [
  'Craft and Structure', 'Expression of Ideas', 'Information and Ideas', 'Standard English Conventions',
].sort());
const satMath = await loadBank('sat-math-full.json');
assertModuleSplit(satMath, 44, 22, 2100, 4200);
assert.equal(new Set(satMath.questions.map(question => question.text)).size, 44, 'SAT Math items have distinct prompts.');

const manifest = await readJson('sat-combined-full.json');
assert.equal(manifest.manifestVersion, 1);
assert.equal(manifest.questionCount, 98);
assert.equal(manifest.testingDurationSeconds, 3840 + 4200);
assert.equal(manifest.optionalBreakSeconds, 600);
const rwBank = await loadBank(manifest.sections[0].bankFile);
const mathBank = await loadBank(manifest.sections[1].bankFile);
for (const [section, bank] of [[manifest.sections[0], rwBank], [manifest.sections[1], mathBank]]) {
  assert.equal(section.questionCount, bank.questions.length);
  assert.equal(section.durationSeconds, bank.durationSeconds);
  assert.equal(new Set(bank.questions.map(question => question.id)).size, bank.questions.length);
}
assert.equal(new Set([...rwBank.questions, ...mathBank.questions].map(question => question.id)).size, 98, 'Combined SAT source IDs are unique.');

const nuet = await loadBank('nuet-regression-pilot.json');
assert.equal(nuet.type, 'NUET');
console.log('Validated full IELTS reading/listening/writing banks, SAT sections and manifest, question-bank round trips, and NUET regression bank.');
