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
const LEGACY_FORMAT_SIZE_PATTERN = '10|12|14|16|18|20|24|28|32|36|40|48';
// Valid alignment/size markers that never found their partner (for example when bold
// markers cross them). They carry no meaning on their own and must never be shown.
const ORPHAN_FORMAT_TOKEN = new RegExp(`\\[\\[(?:align:(?:left|center|right)|size:(?:${LEGACY_FORMAT_SIZE_PATTERN})|/align|/size)\\]\\]`, 'g');

const withoutOrphanTokens = (text: string) => text.replace(ORPHAN_FORMAT_TOKEN, '');

function normalizeLegacyFormattingTags(value: string): string {
  return value
    .replace(/(?<!\[)\[align:(left|center|right)\](?!\])/gi, (_, align: string) => `[[align:${align.toLowerCase()}]]`)
    .replace(/(?<!\[)\[\/align\](?!\])/gi, '[[/align]]')
    .replace(new RegExp(`(?<!\\[)\\[size:(${LEGACY_FORMAT_SIZE_PATTERN})\\](?!\\])`, 'gi'), (_, size: string) => `[[size:${size}]]`)
    .replace(/(?<!\[)\[\/size\](?!\])/gi, '[[/size]]');
}

export function parseQuestionTextFormatting(value: string): FormattedTextPart[] {
  const normalizedValue = normalizeLegacyFormattingTags(value);
  const parts: FormattedTextPart[] = [];
  let cursor = 0;

  for (const match of normalizedValue.matchAll(FORMAT_TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ style: 'plain', text: withoutOrphanTokens(normalizedValue.slice(cursor, index)) });
    if (match[1] !== undefined) {
      parts.push({ style: 'align', align: match[1] as 'left' | 'center' | 'right', text: match[2], children: parseQuestionTextFormatting(match[2]) });
    } else if (match[3] !== undefined) {
      parts.push({ style: 'size', fontSize: Number(match[3]), text: match[4], children: parseQuestionTextFormatting(match[4]) });
    } else {
      const bold = match[5];
      const underline = match[6];
      const italic = match[7];
      const rawText = bold ?? underline ?? italic ?? '';
      const nestedParts = parseQuestionTextFormatting(rawText);
      const children = nestedParts.some(part => part.style !== 'plain') ? nestedParts : undefined;
      const text = children ? rawText : nestedParts.map(part => part.text).join('');
      parts.push({
        style: bold !== undefined ? 'bold' : underline !== undefined ? 'underline' : 'italic',
        text,
        ...(children ? { children } : {}),
      });
    }
    cursor = index + match[0].length;
  }

  if (cursor < normalizedValue.length) parts.push({ style: 'plain', text: withoutOrphanTokens(normalizedValue.slice(cursor)) });
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
        const nextParent = { ...parent, style: part.style === 'plain' ? parent.style : part.style };
        if (part.children) visit(part.children, nextParent);
        else {
          const end = offset + part.text.length;
          runs.push({ start: offset, end, ...nextParent });
          offset = end;
        }
      }
    }
  };
  visit(parseQuestionTextFormatting(value));
  return runs;
}
