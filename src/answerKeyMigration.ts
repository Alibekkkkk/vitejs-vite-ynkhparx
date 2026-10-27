export const ANSWER_KEY_MIGRATION_VERSION = 2;

const BASE_KEY_FIELDS = ['correctAnswer', 'acceptedAnswers', 'correctOrder', 'explanation'];

export function buildAnswerKeyQuestions(publicQuestions: any[], existingQuestions: any[], privateFields: string[]) {
  const existingById = new Map((existingQuestions || []).filter(question => typeof question?.id === 'string').map(question => [question.id, question]));
  return publicQuestions.map(question => {
    const saved = existingById.get(question.id) || {};
    const merged: Record<string, unknown> = {
      id: question.id,
      correctAnswer: question.correctAnswer ?? null,
      acceptedAnswers: question.acceptedAnswers || [],
      answerSlots: (question.answerSlots || []).map((slot: any) => ({ id: slot.id, correctAnswers: slot.correctAnswers || [] })),
      correctOrder: question.correctOrder || [],
      explanation: question.explanation || '',
    };
    for (const field of privateFields) {
      if (!BASE_KEY_FIELDS.includes(field) && question[field] != null) merged[field] = question[field];
    }
    for (const [field, value] of Object.entries(saved)) {
      if (field === 'answerSlots' && Array.isArray(value)) {
        const savedSlots = new Map(value.filter((slot: any) => typeof slot?.id === 'string').map((slot: any) => [slot.id, slot]));
        merged.answerSlots = (merged.answerSlots as any[]).map(slot => ({
          ...slot,
          ...savedSlots.get(slot.id),
          id: slot.id,
        }));
      } else if (field !== 'id' && value !== undefined) {
        merged[field] = value;
      }
    }
    return merged;
  });
}

export function hasCompleteAnswerKey(publicQuestions: any[], keyQuestions: any[]) {
  if (!Array.isArray(publicQuestions) || !Array.isArray(keyQuestions) || publicQuestions.length !== keyQuestions.length) return false;
  const publicIds = publicQuestions.map(question => question?.id);
  const keyIds = keyQuestions.map(question => question?.id);
  if (publicIds.some(id => typeof id !== 'string' || !id) || new Set(publicIds).size !== publicIds.length) return false;
  if (new Set(keyIds).size !== keyIds.length || publicIds.some(id => !keyIds.includes(id))) return false;
  return publicQuestions.every(question => {
    const key = keyQuestions.find(item => item.id === question.id);
    if (!key || !['correctAnswer', 'acceptedAnswers', 'correctOrder', 'explanation', 'answerSlots'].every(field => Object.hasOwn(key, field))) return false;
    const expectedSlotIds = (question.answerSlots || []).map((slot: any) => slot.id);
    const actualSlots = Array.isArray(key.answerSlots) ? key.answerSlots : [];
    return expectedSlotIds.length === actualSlots.length
      && expectedSlotIds.every(id => actualSlots.some((slot: any) => slot.id === id && Array.isArray(slot.correctAnswers)));
  });
}

export function stripPublicAnswerFields(questions: any[], privateFields: string[]) {
  return questions.map(question => {
    const publicQuestion = { ...question };
    for (const field of privateFields) delete publicQuestion[field];
    if (Array.isArray(publicQuestion.answerSlots)) {
      publicQuestion.answerSlots = publicQuestion.answerSlots.map((slot: any) => {
        const visible = { ...slot };
        delete visible.correctAnswers;
        return visible;
      });
    }
    return publicQuestion;
  });
}
