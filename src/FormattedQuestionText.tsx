import { parseQuestionTextFormatting } from './questionTextFormatting';

type Props = {
  text: string;
  className?: string;
  minFontSize?: number;
};

export function FormattedQuestionText({ text, className = '', minFontSize }: Props) {
  return (
    <span className={className}>
      <FormattedParts parts={parseQuestionTextFormatting(text)} minFontSize={minFontSize} />
    </span>
  );
}

function FormattedParts({ parts, minFontSize }: { parts: ReturnType<typeof parseQuestionTextFormatting>; minFontSize?: number }) {
  return parts.map((part, index) => {
    const key = `${part.style}-${index}`;
    if (part.style === 'bold') return <strong key={key}>{part.children ? <FormattedParts parts={part.children} minFontSize={minFontSize} /> : part.text}</strong>;
    if (part.style === 'italic') return <em key={key}>{part.children ? <FormattedParts parts={part.children} minFontSize={minFontSize} /> : part.text}</em>;
    if (part.style === 'underline') return <u key={key}>{part.children ? <FormattedParts parts={part.children} minFontSize={minFontSize} /> : part.text}</u>;
    if (part.style === 'align') return <span key={key} style={{ display: 'block', textAlign: part.align }}>{part.children ? <FormattedParts parts={part.children} minFontSize={minFontSize} /> : part.text}</span>;
    if (part.style === 'size') return <span key={key} style={{ fontSize: `${Math.max(part.fontSize || 0, minFontSize || 0)}px` }}>{part.children ? <FormattedParts parts={part.children} minFontSize={minFontSize} /> : part.text}</span>;
    return <span key={key}>{part.text}</span>;
  });
}
