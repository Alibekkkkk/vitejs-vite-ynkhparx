export type FormattedTextPart = {
  style: 'plain' | 'bold' | 'italic' | 'underline' | 'align' | 'size';
  text: string;
  align?: 'left' | 'center' | 'right';
  fontSize?: number;
  children?: FormattedTextPart[];
};

export type FormattedTextRun = {
  start: number;
  end: number;
  style: 'plain' | 'bold' | 'italic' | 'underline';
  align?: 'left' | 'center' | 'right';
  fontSize?: number;
};

const FORMAT_TOKEN = /\[\[align:(left|center|right)\]\]([\s\S]+?)\[\[\/align\]\]|\[\[size:(10|12|14|16|18|20|24|28|32|36|40|48)\]\]([\s\S]+?)\[\[\/size\]\]|\*\*([\s\S]+?)\*\*|\+\+([\s\S]+?)\+\+|(?<!\*)\*([^*\n]+?)\*(?!\*)/g;

export function parseQuestionTextFormatting(value: string): FormattedTextPart[] {
  const parts: FormattedTextPart[] = [];
  let cursor = 0;

  for (const match of value.matchAll(FORMAT_TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ style: 'plain', text: value.slice(cursor, index) });
    if (match[1] !== undefined) {
      parts.push({ style: 'align', align: match[1] as 'left' | 'center' | 'right', text: match[2], children: parseQuestionTextFormatting(match[2]) });
    } else if (match[3] !== undefined) {
      parts.push({ style: 'size', fontSize: Number(match[3]), text: match[4], children: parseQuestionTextFormatting(match[4]) });
    } else {
      const bold = match[5];
      const underline = match[6];
      const italic = match[7];
      parts.push({
        style: bold !== undefined ? 'bold' : underline !== undefined ? 'underline' : 'italic',
        text: bold ?? underline ?? italic ?? '',
      });
    }
    cursor = index + match[0].length;
  }

  if (cursor < value.length) parts.push({ style: 'plain', text: value.slice(cursor) });
  return parts;
}

export function stripQuestionTextFormatting(value: string): string {
  const stripParts = (parts: FormattedTextPart[]) => parts.map(part => part.children ? stripParts(part.children) : part.text).join('');
  return stripParts(parseQuestionTextFormatting(value));
}

export function getQuestionTextFormattingRuns(value: string): FormattedTextRun[] {
  const runs: FormattedTextRun[] = [];
  let offset = 0;
  const visit = (parts: FormattedTextPart[], parent: Omit<FormattedTextRun, 'start' | 'end'> = { style: 'plain' }) => {
    for (const part of parts) {
      if (part.style === 'align' || part.style === 'size') {
        const nextParent = {
          ...parent,
          ...(part.style === 'align' ? { align: part.align } : { fontSize: part.fontSize }),
        };
        if (part.children) visit(part.children, nextParent);
        else {
          const end = offset + part.text.length;
          runs.push({ start: offset, end, ...nextParent });
          offset = end;
        }
      } else {
        const end = offset + part.text.length;
        runs.push({ start: offset, end, ...parent, style: part.style === 'plain' ? parent.style : part.style });
        offset = end;
      }
    }
  };
  visit(parseQuestionTextFormatting(value));
  return runs;
}
