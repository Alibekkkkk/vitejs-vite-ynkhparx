export const LEGACY_MIGRATION_VERSION = 1;
export const LEGACY_IMPORT_BATCH_SIZE = 200;

const LEGACY_HISTORICAL_FIELDS = [
  'answers',
  'submittedAt',
  'submittedAtMs',
  'durationSeconds',
  'isAutoSubmitted',
  'score',
  'maxPossibleScore',
  'maxAutoScore',
  'correctCount',
  'incorrectCount',
  'answeredCount',
  'unansweredCount',
  'pendingReviewCount',
  'reviewStatus',
  'gradingMode',
  'questionReviews',
  'practiceMetadata',
  'sectionOrSkill',
  'testId',
  'displayTitle',
  'examType',
  'groupCode',
  'attemptId',
] as const;

export function parseLegacyResultPath(path: string, appId: string): { studentUid: string; resultId: string } | null {
  const parts = path.split('/');
  if (
    parts.length !== 6
    || parts[0] !== 'artifacts'
    || parts[1] !== appId
    || parts[2] !== 'users'
    || !parts[3]
    || parts[4] !== 'results'
    || !parts[5]
    || parts.some(part => part === '.' || part === '..')
  ) return null;
  return { studentUid: parts[3], resultId: parts[5] };
}

export function mapLegacyResult(
  legacyData: Record<string, unknown>,
  sourcePath: string,
  appId: string,
  importedBy: string,
  importedAt: unknown,
) {
  const path = parseLegacyResultPath(sourcePath, appId);
  if (!path) throw new Error('Legacy result path does not match the expected private student results path.');
  const historicalData = Object.fromEntries(
    LEGACY_HISTORICAL_FIELDS
      .filter(field => Object.hasOwn(legacyData, field))
      .map(field => [field, legacyData[field]]),
  );
  const importedId = `legacy_${path.studentUid}_${path.resultId}`;
  return {
    id: importedId,
    attemptId: path.resultId,
    legacyResultId: path.resultId,
    legacySourcePath: sourcePath,
    studentUid: path.studentUid,
    studentName: typeof legacyData.studentName === 'string' && legacyData.studentName.trim() ? legacyData.studentName.trim() : 'Student',
    studentEmail: '',
    groupCode: typeof legacyData.groupCode === 'string' ? legacyData.groupCode : '',
    assessmentId: typeof legacyData.testId === 'string' ? legacyData.testId : '',
    assessmentTitle: typeof legacyData.displayTitle === 'string' ? legacyData.displayTitle : 'Legacy result',
    examType: typeof legacyData.examType === 'string' ? legacyData.examType : 'General',
    gradingMode: 'legacy-unverified',
    legacyImportedAt: importedAt,
    importedBy,
    migrationVersion: LEGACY_MIGRATION_VERSION,
    legacyHistoricalData: historicalData,
  };
}
