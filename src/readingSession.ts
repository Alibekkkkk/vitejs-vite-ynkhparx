export type ReadingSessionViewModel = {
  passageIds: string[];
  activePassageId: string;
  questionIdsByPassage: Record<string, string[]>;
  activeQuestionId: string;
  answers: Record<string, unknown>;
  visitedQuestionIds: string[];
  leftScrollTopByPassage: Record<string, number>;
  rightScrollTopByPassage: Record<string, number>;
};

export function buildReadingSessionViewModel({
  configuredPassages,
  questions,
  activePassageId,
  activeQuestionId,
  answers,
  visitedQuestionIds,
  leftScrollTopByPassage,
  rightScrollTopByPassage,
}: {
  configuredPassages: Array<{ passageNumber?: number }>;
  questions: Array<{ id: string; passageNumber?: number }>;
  activePassageId: string;
  activeQuestionId: string;
  answers: Record<string, unknown>;
  visitedQuestionIds: string[];
  leftScrollTopByPassage: Record<string, number>;
  rightScrollTopByPassage: Record<string, number>;
}): ReadingSessionViewModel {
  const passageIds = [...new Set([
    ...configuredPassages.map(passage => Number(passage.passageNumber)).filter(number => Number.isInteger(number) && number > 0),
    ...questions.map(question => Number(question.passageNumber || 1)).filter(number => Number.isInteger(number) && number > 0),
  ])].sort((a, b) => a - b).map(String);
  const questionIdsByPassage = Object.fromEntries(passageIds.map(passageId => [
    passageId,
    questions.filter(question => String(Number(question.passageNumber || 1)) === passageId).map(question => question.id),
  ]));
  const questionPassage = questions.find(question => question.id === activeQuestionId)?.passageNumber || 1;
  const resolvedActivePassageId = passageIds.includes(activePassageId) ? activePassageId : String(questionPassage);
  return {
    passageIds,
    activePassageId: resolvedActivePassageId,
    questionIdsByPassage,
    activeQuestionId,
    answers,
    visitedQuestionIds,
    leftScrollTopByPassage,
    rightScrollTopByPassage,
  };
}
