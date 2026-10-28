import { parseQuestionTextFormatting } from './questionTextFormatting';

type Props = {
  text: string;
  className?: string;
};

export function FormattedQuestionText({ text, className = '' }: Props) {
  return (
    <span className={className}>
      <FormattedParts parts={parseQuestionTextFormatting(text)} />
    </span>
  );
}

function FormattedParts({ parts }: { parts: ReturnType<typeof parseQuestionTextFormatting> }) {
  return parts.map((part, index) => {
    const key = `${part.style}-${index}`;
    if (part.style === 'bold') return <strong key={key}>{part.children ? <FormattedParts parts={part.children} /> : part.text}</strong>;
    if (part.style === 'italic') return <em key={key}>{part.children ? <FormattedParts parts={part.children} /> : part.text}</em>;
    if (part.style === 'underline') return <u key={key}>{part.children ? <FormattedParts parts={part.children} /> : part.text}</u>;
    if (part.style === 'align') return <span key={key} style={{ display: 'block', textAlign: part.align }}>{part.children ? <FormattedParts parts={part.children} /> : part.text}</span>;
    if (part.style === 'size') return <span key={key} style={{ fontSize: `${part.fontSize}px` }}>{part.children ? <FormattedParts parts={part.children} /> : part.text}</span>;
    return <span key={key}>{part.text}</span>;
  });
}
