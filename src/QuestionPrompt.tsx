import { FormattedQuestionText } from './FormattedQuestionText';

type Props = {
  question: {
    text?: string;
    responseType?: string;
    questionType?: string;
    answerInstruction?: string;
    answerSlots?: Array<{ id: string; label?: string; prompt?: string }>;
  };
  value?: unknown;
  onChange?: (value: unknown) => void;
  disabled?: boolean;
};

const INLINE_ANSWER_PATTERN = /\{\{(\d+)\}\}/g;

export function hasInlineAnswerSlots(question: Props['question']): boolean {
  const isMultiBlank = question.responseType === 'multi-blank'
    || ['completion', 'map-labeling'].includes(question.questionType || '');
  if (!isMultiBlank || !question.answerSlots?.length) return false;
  return [...(question.text || '').matchAll(INLINE_ANSWER_PATTERN)]
    .some(match => Number(match[1]) > 0 && Number(match[1]) <= question.answerSlots!.length);
}

export function QuestionPrompt({ question, value, onChange = () => {}, disabled = false }: Props) {
  const text = question.text || 'Question prompt';
  if (!hasInlineAnswerSlots(question)) return <FormattedQuestionText text={text} />;
  const answers = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const parts = text.split(INLINE_ANSWER_PATTERN);

  return <span className="question-prompt">
    {question.answerInstruction && <span className="question-prompt__instructions">{question.answerInstruction}</span>}
    {parts.map((part, index) => {
      if (index % 2 === 0) return <FormattedQuestionText key={`prompt-${index}`} text={part} />;
      const slotNumber = Number(part);
      const slot = question.answerSlots?.[slotNumber - 1];
      if (!slot) return <span key={`unknown-slot-${index}`}>{`{{${part}}}`}</span>;
      const ariaLabel = [slot.label || `Answer ${slotNumber}`, slot.prompt].filter(Boolean).join(': ');
      return <label key={`answer-slot-${index}`} className="question-prompt__blank">
        <span className="sr-only">{ariaLabel}</span>
        <span className="question-prompt__number" aria-hidden="true">{slotNumber}</span>
        <input
          type="text"
          value={String(answers[slot.id] ?? '')}
          onChange={event => onChange({ ...answers, [slot.id]: event.target.value })}
          disabled={disabled}
          aria-label={ariaLabel}
          placeholder={slot.prompt || 'Your answer'}
          className="question-prompt__input"
        />
      </label>;
    })}
  </span>;
}
