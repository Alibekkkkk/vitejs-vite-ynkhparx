function normalizeText(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function present(value) {
  if (Array.isArray(value)) return value.some(present);
  if (value && typeof value === 'object') return Object.values(value).some(present);
  return String(value ?? '').trim().length > 0;
}

function responseType(question) {
  if (['single-choice', 'multiple-select', 'short-text', 'multi-blank', 'numeric', 'matching', 'ordering', 'long-text'].includes(question.responseType)) return question.responseType;
  if (question.questionType === 'writing-task' || question.manualReview || question.ungraded) return 'long-text';
  if (question.questionType === 'sat-student-produced-response' || question.type === 'number') return 'numeric';
  if (['matching-headings', 'matching-information', 'matching-features', 'sentence-endings'].includes(question.questionType)) return 'matching';
  if (question.questionType === 'completion' || question.questionType === 'map-labeling') return 'multi-blank';
  if (question.type === 'mcq' || question.type === 'select') return 'single-choice';
  return 'short-text';
}

function answerKeys(question, type) {
  const accepted = Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [];
  if (type === 'multi-blank' || type === 'matching') return [];
  if (type === 'multiple-select') return [...(Array.isArray(question.correctAnswer) ? question.correctAnswer : []), ...accepted];
  if (type === 'ordering') return question.correctOrder || [];
  return [question.correctAnswer, ...accepted].filter(value => value !== null && value !== undefined && String(value).trim() !== '');
}

function grade(question, answer) {
  const type = responseType(question);
  const points = Math.max(0, Number(question.points ?? 1) || 0);
  if (!present(answer)) return { status: 'unanswered', earnedPoints: 0, possiblePoints: points, isCorrect: null };
  if (question.ungraded) return { status: 'ungraded', earnedPoints: 0, possiblePoints: 0, isCorrect: null };
  if (question.manualReview || type === 'long-text') return { status: 'manual-review', earnedPoints: 0, possiblePoints: points, isCorrect: null };
  const keys = answerKeys(question, type);
  let ratio = 0;
  if (type === 'single-choice') ratio = keys.some(key => normalizeText(key) === normalizeText(answer)) ? 1 : 0;
  if (type === 'short-text') ratio = keys.some(key => normalizeText(key) === normalizeText(answer)) ? 1 : 0;
  if (type === 'numeric') {
    const actual = Number(String(answer).trim().replace(',', '.'));
    ratio = Number.isFinite(actual) && keys.some(key => {
      const expected = Number(String(key).trim().replace(',', '.'));
      return Number.isFinite(expected) && Math.abs(actual - expected) <= Math.max(0, Number(question.numericTolerance || 0));
    }) ? 1 : 0;
  }
  if (type === 'multiple-select') {
    const correct = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
    if (correct.length) {
      const expected = new Set(correct.map(normalizeText));
      const selected = new Set((Array.isArray(answer) ? answer : [answer]).map(normalizeText).filter(Boolean));
      const matches = [...selected].filter(value => expected.has(value)).length;
      const wrong = [...selected].filter(value => !expected.has(value)).length;
      ratio = Math.max(0, (matches - wrong) / expected.size);
    }
  }
  if (type === 'multi-blank' || type === 'matching') {
    const slots = Array.isArray(question.answerSlots) ? question.answerSlots : [];
    const values = Array.isArray(answer) ? answer : answer && typeof answer === 'object' ? slots.map(slot => answer[slot.id]) : slots.length === 1 ? [answer] : [];
    const used = new Set();
    let earned = 0;
    for (const [index, slot] of slots.entries()) {
      const value = values[index];
      if (!present(value)) continue;
      const normalized = normalizeText(value);
      const repeated = type === 'matching' && !question.allowChoiceReuse && used.has(normalized);
      if (type === 'matching' && normalized) used.add(normalized);
      if (!repeated && (slot.correctAnswers || []).some(key => normalizeText(key) === normalized)) earned += points / Math.max(1, slots.length);
    }
    const earnedPoints = Math.min(points, earned);
    return { status: 'graded', earnedPoints, possiblePoints: points, isCorrect: slots.length > 0 && earnedPoints >= points };
  }
  if (type === 'ordering') {
    const expected = question.correctOrder || [];
    const actual = Array.isArray(answer) ? answer : [];
    if (expected.length) ratio = actual.reduce((count, item, index) => count + (normalizeText(item) === normalizeText(expected[index]) ? 1 : 0), 0) / expected.length;
  }
  const earnedPoints = points * ratio;
  return { status: 'graded', earnedPoints, possiblePoints: points, isCorrect: ratio === 1 };
}

function gradeAssessment(questions, answers) {
  let score = 0;
  let maxAutoScore = 0;
  let manualReviewCount = 0;
  let ungradedCount = 0;
  const questionReviews = questions.map(question => {
    const studentAnswer = answers[question.id] ?? '';
    const result = grade(question, studentAnswer);
    if (result.status === 'graded') { score += result.earnedPoints; maxAutoScore += result.possiblePoints; }
    if (result.status === 'manual-review') manualReviewCount++;
    if (result.status === 'ungraded') ungradedCount++;
    return {
      questionId: question.id,
      questionText: question.text || '',
      studentAnswer,
      correctAnswer: question.correctAnswer ?? '',
      answerKey: { responseType: responseType(question), correctAnswer: question.correctAnswer ?? null, acceptedAnswers: question.acceptedAnswers || [], answerSlots: question.answerSlots || [], correctOrder: question.correctOrder || [] },
      acceptedAnswers: question.acceptedAnswers || [],
      explanation: question.explanation || '',
      section: question.section || '', satDomain: question.satDomain || '', satSkill: question.satSkill || '',
      passageNumber: question.passageNumber || null,
      listeningSectionNumber: question.listeningSectionNumber || null,
      writingTaskType: question.writingTaskType || null,
      points: result.possiblePoints,
      ...result,
    };
  });
  return { score, maxPossibleScore: maxAutoScore, manualReviewCount, ungradedCount, questionReviews };
}

module.exports = { gradeAssessment };
