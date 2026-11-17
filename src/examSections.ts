// Groups assessments for the student dashboard by exam (NUET, SAT, IELTS, other) and, for NUET and
// SAT, by subject section (NUET Math / NUET Critical Thinking, SAT Math / SAT Verbal).

export type ExamFamily = 'NUET' | 'SAT' | 'IELTS' | 'General';

export type SectionOption = { id: string; label: string };

export const FAMILY_LABELS: Record<ExamFamily, string> = { NUET: 'NUET', SAT: 'SAT', IELTS: 'IELTS', General: 'Other tasks' };

export const SECTION_OPTIONS: Partial<Record<ExamFamily, SectionOption[]>> = {
  NUET: [{ id: 'math', label: 'NUET Math' }, { id: 'critical-thinking', label: 'NUET Critical Thinking' }],
  SAT: [{ id: 'math', label: 'SAT Math' }, { id: 'verbal', label: 'SAT Verbal' }],
};

const FAMILY_ORDER: ExamFamily[] = ['NUET', 'SAT', 'IELTS', 'General'];
const SAT_MATH_DOMAINS = ['algebra', 'advanced math', 'problem-solving and data analysis', 'geometry and trigonometry'];
const SAT_VERBAL_DOMAINS = ['craft and structure', 'information and ideas', 'standard english conventions', 'expression of ideas'];

type TestLike = { type?: unknown; title?: unknown; description?: unknown; examSection?: unknown; questions?: Array<{ satDomain?: unknown }> } | null | undefined;

export function getExamFamily(test: TestLike): ExamFamily {
  const type = String(test?.type ?? '').toUpperCase();
  if (type.startsWith('NUET')) return 'NUET';
  if (type.startsWith('SAT')) return 'SAT';
  if (type.startsWith('IELTS')) return 'IELTS';
  return 'General';
}

/** The section the teacher chose, or a best guess for older tests; '' when it cannot be told. */
export function getExamSection(test: TestLike): string {
  const family = getExamFamily(test);
  const options = SECTION_OPTIONS[family];
  if (!options) return '';
  const chosen = String(test?.examSection ?? '');
  if (options.some(option => option.id === chosen)) return chosen;
  const text = `${test?.title ?? ''} ${test?.description ?? ''}`.toLowerCase();
  if (family === 'SAT') {
    const domains = (test?.questions || []).map(question => String(question?.satDomain ?? '').toLowerCase()).filter(Boolean);
    if (domains.some(domain => SAT_MATH_DOMAINS.includes(domain))) return 'math';
    if (domains.some(domain => SAT_VERBAL_DOMAINS.includes(domain))) return 'verbal';
    if (/\bmath/.test(text)) return 'math';
    if (/reading|writing|verbal/.test(text)) return 'verbal';
    return '';
  }
  if (/\bmath|quantitative|problem[- ]solving/.test(text)) return 'math';
  if (/critical|thinking|tsa|reasoning|verbal|argument/.test(text)) return 'critical-thinking';
  return '';
}

export type DashboardGroup<T> = { key: string; title: string; family: ExamFamily; tests: T[] };

/** Tests split into dashboard groups in a fixed order: NUET, SAT, IELTS, then everything else. */
export function groupTestsForDashboard<T extends TestLike>(tests: T[]): DashboardGroup<T>[] {
  const groups = new Map<string, DashboardGroup<T>>();
  for (const test of tests) {
    const family = getExamFamily(test);
    const section = getExamSection(test);
    const option = SECTION_OPTIONS[family]?.find(item => item.id === section);
    const key = `${family}:${section || 'other'}`;
    const title = option ? option.label : SECTION_OPTIONS[family] ? `Other ${FAMILY_LABELS[family]} tasks` : FAMILY_LABELS[family];
    if (!groups.has(key)) groups.set(key, { key, title, family, tests: [] });
    groups.get(key)!.tests.push(test);
  }
  const sectionRank = (group: DashboardGroup<T>) => {
    const sectionId = group.key.split(':')[1];
    const index = (SECTION_OPTIONS[group.family] || []).findIndex(item => item.id === sectionId);
    return index === -1 ? 99 : index;
  };
  return [...groups.values()].sort((a, b) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family) || sectionRank(a) - sectionRank(b));
}
