import { normalizeQuestion, RESPONSE_TYPE_LABELS, validateQuestion, type EngineQuestion } from './questionEngine.ts';

export type QuestionBank = {
  schemaVersion: 1;
  title: string;
  description?: string;
  type: string;
  category?: string;
  durationSeconds?: number;
  settings?: Record<string, unknown>;
  sections?: Record<string, unknown>;
  questions: EngineQuestion[];
};

export function parseQuestionBank(input: unknown): QuestionBank {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Root must be a JSON object.');
  const bank = input as Record<string, unknown>;
  if (bank.schemaVersion !== 1) throw new Error('schemaVersion must be 1.');
  if (typeof bank.title !== 'string' || !bank.title.trim()) throw new Error('title must be non-empty text.');
  if (!['IELTS', 'SAT', 'NUET', 'General'].includes(String(bank.type))) throw new Error('type must be IELTS, SAT, NUET, or General.');
  if (!Array.isArray(bank.questions) || bank.questions.length < 1 || bank.questions.length > 200) throw new Error('questions must contain 1–200 items.');
  if (bank.sections != null && (typeof bank.sections !== 'object' || Array.isArray(bank.sections))) throw new Error('sections must be an object when provided.');
  const sectionData = (bank.sections || {}) as Record<string, any>;
  const readingPassages = Array.isArray(sectionData.reading?.passages) ? sectionData.reading.passages.map((passage: any) => Number(passage.passageNumber)) : [];
  const listeningParts = Array.isArray(sectionData.listening?.parts) ? sectionData.listening.parts.map((part: any) => Number(part.sectionNumber)) : [];

  const ids = new Set<string>();
  const questions = bank.questions.map((raw, index) => {
    const prefix = `questions[${index}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${prefix} must be an object.`);
    const question = raw as Record<string, unknown>;
    if (typeof question.id !== 'string' || !question.id.trim()) throw new Error(`${prefix}.id is required.`);
    if (ids.has(question.id)) throw new Error(`${prefix}.id duplicates ${question.id}.`);
    ids.add(question.id);
    if (question.responseType && !RESPONSE_TYPE_LABELS.some(([type]) => type === question.responseType)) throw new Error(`${prefix}.responseType is unsupported.`);
    if (question.passageNumber != null && ![1, 2, 3].includes(Number(question.passageNumber))) throw new Error(`${prefix}.passageNumber must be 1, 2, or 3.`);
    if (question.listeningSectionNumber != null && ![1, 2, 3, 4].includes(Number(question.listeningSectionNumber))) throw new Error(`${prefix}.listeningSectionNumber must be 1–4.`);
    if (question.passageNumber != null && readingPassages.length && !readingPassages.includes(Number(question.passageNumber))) throw new Error(`${prefix}.passageNumber does not reference a passage in sections.reading.passages.`);
    if (question.listeningSectionNumber != null && listeningParts.length && !listeningParts.includes(Number(question.listeningSectionNumber))) throw new Error(`${prefix}.listeningSectionNumber does not reference a part in sections.listening.parts.`);
    if (bank.type === 'IELTS' && question.section === 'reading' && question.passageNumber == null) throw new Error(`${prefix}.passageNumber is required for an IELTS Reading question.`);
    if (bank.type === 'IELTS' && question.section === 'listening' && question.listeningSectionNumber == null) throw new Error(`${prefix}.listeningSectionNumber is required for an IELTS Listening question.`);
    if (bank.type === 'IELTS' && question.section === 'writing' && ![1, 2].includes(Number(question.writingTaskType))) throw new Error(`${prefix}.writingTaskType must be 1 or 2 for IELTS Writing.`);
    if (bank.type === 'SAT' && (typeof question.satDomain !== 'string' || !question.satDomain.trim() || typeof question.satSkill !== 'string' || !question.satSkill.trim())) throw new Error(`${prefix} needs SAT domain and skill tags.`);
    const normalized = normalizeQuestion(question as EngineQuestion);
    const errors = validateQuestion(normalized);
    if (errors.length) throw new Error(`${prefix}: ${errors.join(' ')}`);
    return normalized;
  });

  return { ...bank, schemaVersion: 1, questions } as QuestionBank;
}
