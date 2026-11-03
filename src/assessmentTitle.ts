import { stripQuestionTextFormatting } from './questionTextFormatting.ts';

// Titles are authored with the rich-text markers (bold, alignment, size) but must be
// shown as plain text in dialogs, option lists, exports, and the browser tab.
export function formatAssessmentTitle(value: unknown, fallback = 'Untitled assessment'): string {
  const plainText = stripQuestionTextFormatting(String(value ?? '')).replace(/\s+/g, ' ').trim();
  return plainText || fallback;
}
