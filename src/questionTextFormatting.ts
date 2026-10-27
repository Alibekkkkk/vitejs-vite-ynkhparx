export type FormattedTextPart = {
  style: 'plain' | 'bold' | 'italic' | 'underline';
  text: string;
};

const FORMAT_TOKEN = /\*\*([\s\S]+?)\*\*|\+\+([\s\S]+?)\+\+|(?<!\*)\*([^*\n]+?)\*(?!\*)/g;

export function parseQuestionTextFormatting(value: string): FormattedTextPart[] {
  const parts: FormattedTextPart[] = [];
  let cursor = 0;

  for (const match of value.matchAll(FORMAT_TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ style: 'plain', text: value.slice(cursor, index) });
    const bold = match[1];
    const underline = match[2];
    const italic = match[3];
    parts.push({
      style: bold !== undefined ? 'bold' : underline !== undefined ? 'underline' : 'italic',
      text: bold ?? underline ?? italic ?? '',
    });
    cursor = index + match[0].length;
  }

  if (cursor < value.length) parts.push({ style: 'plain', text: value.slice(cursor) });
  return parts;
}

export function stripQuestionTextFormatting(value: string): string {
  return parseQuestionTextFormatting(value).map(part => part.text).join('');
}
