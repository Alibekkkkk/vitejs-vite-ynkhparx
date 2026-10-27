import type { FigureAsset } from './figureAssets';

export type VocabularyRow = {
  original: string;
  definition: string;
  alternatives: string[];
};

export type VocabularySection = {
  id: string;
  title: string;
  columns: [string, string, string];
  rows: VocabularyRow[];
};

export type WritingResource = {
  schemaVersion: 1;
  id: string;
  title: string;
  description?: string;
  language: string;
  exam: string;
  skill: 'writing';
  taskType?: 1 | 2;
  linkedAssessmentId?: string;
  linkedQuestionId?: string;
  figureAsset?: FigureAsset;
  sections: VocabularySection[];
  status: 'draft' | 'published';
  createdBy: string;
  updatedAt?: string;
};

export const createEmptyWritingResource = (createdBy: string): WritingResource => ({
  schemaVersion: 1,
  id: crypto.randomUUID(),
  title: '',
  description: '',
  language: 'en',
  exam: 'IELTS',
  skill: 'writing',
  sections: [{
    id: 'nouns',
    title: 'Nouns',
    columns: ['Original Word/Phrase', 'Definition', 'Synonyms / Alternative Phrases'],
    rows: [{ original: '', definition: '', alternatives: [] }],
  }],
  status: 'draft',
  createdBy,
});

export function parseWritingResource(input: unknown): WritingResource {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Resource must be a JSON object.');
  const resource = input as Record<string, unknown>;
  if (resource.schemaVersion !== 1) throw new Error('schemaVersion must be 1.');
  if (typeof resource.id !== 'string' || !resource.id.trim()) throw new Error('id must be non-empty text.');
  if (typeof resource.title !== 'string' || !resource.title.trim()) throw new Error('title must be non-empty text.');
  if (!Array.isArray(resource.sections)) throw new Error('sections must be an array.');

  const sectionIds = new Set<string>();
  const sections = resource.sections.map((value, sectionIndex): VocabularySection => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`sections[${sectionIndex}] must be an object.`);
    const section = value as Record<string, unknown>;
    if (typeof section.id !== 'string' || !section.id.trim() || sectionIds.has(section.id)) throw new Error(`sections[${sectionIndex}].id must be unique non-empty text.`);
    sectionIds.add(section.id);
    if (typeof section.title !== 'string' || !section.title.trim()) throw new Error(`sections[${sectionIndex}].title must be non-empty text.`);
    if (!Array.isArray(section.columns) || section.columns.length !== 3 || section.columns.some(column => typeof column !== 'string' || !column.trim())) {
      throw new Error(`sections[${sectionIndex}].columns must contain three non-empty headings.`);
    }
    if (!Array.isArray(section.rows)) throw new Error(`sections[${sectionIndex}].rows must be an array.`);
    const rows = section.rows.map((rowValue, rowIndex): VocabularyRow => {
      if (!rowValue || typeof rowValue !== 'object' || Array.isArray(rowValue)) throw new Error(`sections[${sectionIndex}].rows[${rowIndex}] must be an object.`);
      const row = rowValue as Record<string, unknown>;
      if (typeof row.original !== 'string' || !row.original.trim()) throw new Error(`sections[${sectionIndex}].rows[${rowIndex}].original is required.`);
      if (typeof row.definition !== 'string' || !row.definition.trim()) throw new Error(`sections[${sectionIndex}].rows[${rowIndex}].definition is required.`);
      if (!Array.isArray(row.alternatives) || row.alternatives.some(item => typeof item !== 'string')) throw new Error(`sections[${sectionIndex}].rows[${rowIndex}].alternatives must be an array of strings.`);
      if (row.original.length > 300 || row.definition.length > 1000 || row.alternatives.some(item => item.length > 300)) {
        throw new Error(`sections[${sectionIndex}].rows[${rowIndex}] exceeds the allowed text length.`);
      }
      return { original: row.original, definition: row.definition, alternatives: [...row.alternatives] };
    });
    return {
      id: section.id,
      title: section.title,
      columns: [...section.columns] as [string, string, string],
      rows,
    };
  });

  if (!['draft', 'published'].includes(String(resource.status))) throw new Error('status must be draft or published.');
  if (resource.skill !== 'writing') throw new Error('skill must be writing.');
  if (resource.taskType != null && ![1, 2].includes(Number(resource.taskType))) throw new Error('taskType must be 1 or 2.');
  return {
    schemaVersion: 1,
    id: resource.id,
    title: resource.title,
    ...(typeof resource.description === 'string' ? { description: resource.description } : {}),
    language: typeof resource.language === 'string' ? resource.language : 'en',
    exam: typeof resource.exam === 'string' ? resource.exam : 'IELTS',
    skill: 'writing',
    ...(resource.taskType == null ? {} : { taskType: Number(resource.taskType) as 1 | 2 }),
    ...(typeof resource.linkedAssessmentId === 'string' ? { linkedAssessmentId: resource.linkedAssessmentId } : {}),
    ...(typeof resource.linkedQuestionId === 'string' ? { linkedQuestionId: resource.linkedQuestionId } : {}),
    ...(resource.figureAsset && typeof resource.figureAsset === 'object' ? { figureAsset: resource.figureAsset as FigureAsset } : {}),
    sections,
    status: resource.status as 'draft' | 'published',
    createdBy: typeof resource.createdBy === 'string' ? resource.createdBy : '',
    ...(typeof resource.updatedAt === 'string' ? { updatedAt: resource.updatedAt } : {}),
  };
}

export function validateWritingResource(resource: WritingResource): string[] {
  const errors: string[] = [];
  if (!resource.title.trim()) errors.push('Add a resource title.');
  if (!resource.sections.length) errors.push('Add at least one section.');
  resource.sections.forEach((section, sectionIndex) => {
    if (!section.title.trim()) errors.push(`Section ${sectionIndex + 1} needs a heading.`);
    section.rows.forEach((row, rowIndex) => {
      if (!row.original.trim() || !row.definition.trim() || !row.alternatives.some(value => value.trim())) {
        errors.push(`${section.title || `Section ${sectionIndex + 1}`} row ${rowIndex + 1} has an empty required cell.`);
      }
    });
  });
  return errors;
}

export function getMatchingWritingResources(
  resources: WritingResource[],
  taskType: 1 | 2,
  assessmentId?: string,
  questionId?: string,
): WritingResource[] {
  return resources.filter(resource => resource.status === 'published'
    && (!resource.taskType || resource.taskType === taskType)
    && (!resource.linkedAssessmentId || resource.linkedAssessmentId === assessmentId)
    && (!resource.linkedQuestionId || resource.linkedQuestionId === questionId));
}
