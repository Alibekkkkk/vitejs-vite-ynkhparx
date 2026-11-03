export const ALL_GROUPS = 'all';

type GroupAssignable = {
  groupCode?: unknown;
  groupCodes?: unknown;
} | null | undefined;

export function normalizeGroupCode(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

// Codes may contain spaces (for example "nuet - ayaulym and ayana"), so only commas,
// semicolons and new lines separate codes.
export function parseGroupCodeInput(value: string): string[] {
  return normalizeGroupCodes(String(value ?? '').split(/[,;\r\n]+/));
}

// "all" already covers every student, so it replaces any other group in the list.
export function normalizeGroupCodes(values: unknown): string[] {
  const list = Array.isArray(values) ? values : [];
  const unique = [...new Set(list.map(normalizeGroupCode).filter(Boolean))];
  return unique.includes(ALL_GROUPS) ? [ALL_GROUPS] : unique;
}

// Older assessments only have the single `groupCode` string.
export function getAssessmentGroupCodes(assessment: GroupAssignable): string[] {
  if (Array.isArray(assessment?.groupCodes)) return normalizeGroupCodes(assessment.groupCodes);
  return normalizeGroupCodes([assessment?.groupCode]);
}

// `groupCode` mirrors the first group so older queries and rules keep working.
export function toGroupFields(values: unknown): { groupCode: string; groupCodes: string[] } {
  const groupCodes = normalizeGroupCodes(values);
  return { groupCode: groupCodes[0] || '', groupCodes };
}

export function isAssessmentAssignedToGroup(assessment: GroupAssignable, studentGroup: unknown): boolean {
  const groups = getAssessmentGroupCodes(assessment);
  const student = normalizeGroupCode(studentGroup);
  return groups.includes(ALL_GROUPS) || (student !== '' && groups.includes(student));
}

export function describeGroupCodes(assessment: GroupAssignable): string {
  const groups = getAssessmentGroupCodes(assessment);
  if (!groups.length) return 'Not assigned';
  return groups.includes(ALL_GROUPS) ? 'All students' : groups.join(', ');
}

// Assessments assigned through the legacy single field that still need `groupCodes`.
export function planGroupCodeMigration<T extends { id?: string; groupCode?: unknown; groupCodes?: unknown }>(assessments: T[]) {
  return assessments
    .filter(assessment => assessment.id && !Array.isArray(assessment.groupCodes) && normalizeGroupCode(assessment.groupCode) !== '')
    .map(assessment => ({ id: String(assessment.id), ...toGroupFields([assessment.groupCode]) }));
}

export function mergeAssessmentsById<T extends { id?: string }>(...lists: T[][]): T[] {
  const byId = new Map<string, T>();
  for (const list of lists) for (const item of list) if (item.id && !byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()];
}
