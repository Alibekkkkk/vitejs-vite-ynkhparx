import { parseQuestionTextFormatting } from './questionTextFormatting';

type Props = {
  text: string;
  className?: string;
};

export function FormattedQuestionText({ text, className = '' }: Props) {
  return (
    <span className={className}>
      {parseQuestionTextFormatting(text).map((part, index) => {
        const key = `${part.style}-${index}`;
        if (part.style === 'bold') return <strong key={key}>{part.text}</strong>;
        if (part.style === 'italic') return <em key={key}>{part.text}</em>;
        if (part.style === 'underline') return <u key={key}>{part.text}</u>;
        return <span key={key}>{part.text}</span>;
      })}
    </span>
  );
}
