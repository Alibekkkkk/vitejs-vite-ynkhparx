export type WritingSuggestion = {
  phrase: string;
  why: string;
};

export type WritingSuggestionContext = {
  taskType: 1 | 2;
  draft: string;
  format?: string;
  promptText?: string;
  cursorPosition?: number;
  figure?: {
    url?: string;
    alt?: string;
    caption?: string;
    description?: string;
    units?: string;
    categories?: string[];
    years?: Array<string | number>;
    isValid?: boolean;
  };
};

const safePlaceholder = (token: string) => `[${token}]`;

const normalizeDraft = (draft: string) => draft.replace(/\s+/g, ' ').trim();

const detectStage = (draft: string, taskType: 1 | 2) => {
  const normalized = normalizeDraft(draft).toLowerCase();
  if (!normalized) return 'opening';
  if (taskType === 1) {
    if (/\b(overall|in general|the main feature|the most notable)/.test(normalized)) return 'overview';
    if (/\b(by contrast|whereas|while|compared with|respectively)/.test(normalized)) return 'comparison';
    if (/\b(rose|fell|increased|decreased|peaked|remained|fluctuated)/.test(normalized)) return 'detail';
    return 'introduction';
  }
  if (/\b(in conclusion|overall|therefore|ultimately)/.test(normalized)) return 'conclusion';
  if (/\b(for example|for instance|such as|one reason|however)/.test(normalized)) return 'body';
  if (/\b(although|however|while|on the other hand)/.test(normalized)) return 'counterargument';
  return 'introduction';
};

export function getLocalWritingSuggestions(context: WritingSuggestionContext): WritingSuggestion[] {
  const taskType = context.taskType;
  const draft = context.draft ?? '';
  const stage = detectStage(draft, taskType);
  const format = (context.format || '').toLowerCase();
  const hasFigure = Boolean(context.figure?.url || context.figure?.caption || context.figure?.description || context.figure?.alt);
  const figureLabel = context.figure?.caption || context.figure?.description || context.figure?.alt || 'the figure';
  const figurePhrase = hasFigure ? `refer to ${figureLabel}` : 'refer to the visual';

  const phraseTemplates: Record<1 | 2, Record<string, string[]>> = {
    1: {
      opening: [
        `The chart illustrates changes in ${safePlaceholder('category')} over ${safePlaceholder('period')}.`,
        `The ${format.includes('map') ? 'map' : format.includes('process') ? 'diagram' : format.includes('table') ? 'table' : format.includes('graph') ? 'graph' : 'figure'} shows ${safePlaceholder('main trend')} in ${safePlaceholder('unit')}.`,
      ],
      overview: [
        'Overall, the most noticeable trend was a rise in the leading category, while the remaining categories showed more limited change.',
        'Overall, the data indicate a clear contrast between the highest and lowest values, with the main movement concentrated in the early period.',
      ],
      comparison: [
        'By contrast, [category] remained relatively stable, whereas [other category] experienced a sharper rise.',
        'Meanwhile, [category] increased steadily before falling slightly at the end of the period.',
      ],
      detail: [
        'At the start of the period, [category] stood at [value] [unit], before rising to [value] [unit] by the end.',
        'The figure peaked in [year], before declining gradually in the following years.',
      ],
      conclusion: [
        'In conclusion, the visual demonstrates that [category] experienced the strongest overall change across the period.',
        'Overall, the data suggest that [category] remained the dominant trend, while the others showed more limited movement.',
      ]
    },
    2: {
      introduction: [
        'This essay will argue that [main idea] because [reason].',
        'Although [counterpoint] may seem convincing, I believe [position] is more persuasive.',
      ],
      body: [
        'One reason for this is that [point], which helps explain why [effect].',
        'For example, [specific example] clearly demonstrates that [conclusion].',
      ],
      counterargument: [
        'However, it is important to consider [alternative view], because [reason].',
        'Although some people believe [opposition], the stronger argument is that [position].',
      ],
      conclusion: [
        'In conclusion, [summary of argument] shows that [final point].',
        'Overall, the evidence suggests that [position] is the most convincing option.',
      ]
    }
  };

  const baseSuggestions = phraseTemplates[taskType][stage] || phraseTemplates[taskType].introduction || [];
  const contextualTips = [
    `Use ${figurePhrase} without inventing actual values or categories.`,
    'Keep the sentence focused on an observable pattern, trend, or comparison.',
    'Add a short example or evidence point before moving to the next idea.',
  ];

  const suggestions = baseSuggestions.map((phrase, index) => ({
    phrase,
    why: contextualTips[index % contextualTips.length],
  }));

  if (!draft.trim()) {
    return suggestions.slice(0, 3);
  }

  return suggestions.slice(0, 3);
}

export async function getOptionalAISuggestions(_context: WritingSuggestionContext): Promise<WritingSuggestion[]> {
  return getLocalWritingSuggestions(_context).slice(0, 3);
}
