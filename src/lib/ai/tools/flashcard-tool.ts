/**
 * FLASHCARD TOOL
 *
 * Study material generator. Creates structured flashcard sets for learning.
 * Supports Markdown, JSON, CSV, and Anki-compatible CSV export formats.
 *
 * No external dependencies.
 *
 * Created: 2026-03-19
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface FlashcardInput {
  front: string;
  back: string;
  hint?: string;
  tags?: string[];
}

type FlashcardFormat = 'json' | 'csv' | 'markdown' | 'anki_csv';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';

// ============================================================================
// HELPERS
// ============================================================================

/** Escape a value for CSV (RFC 4180) */
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function getStudyTips(): string {
  return [
    '## Study Tips',
    '',
    '### Spaced Repetition',
    'Review cards at increasing intervals: 1 day, 3 days, 7 days, 14 days, 30 days.',
    'Cards you get wrong go back to the 1-day interval.',
    '',
    '### The Leitner System',
    'Use 5 boxes. New cards start in Box 1 (review daily).',
    '- **Correct answer:** Move card to the next box (less frequent review).',
    '- **Wrong answer:** Move card back to Box 1.',
    '- Box 1: Every day | Box 2: Every 2 days | Box 3: Every 4 days | Box 4: Every 8 days | Box 5: Every 14 days',
    '',
    '### Active Recall',
    'Always try to recall the answer BEFORE flipping the card.',
    'Struggling to recall strengthens memory more than passively reading.',
    '',
    '### Best Practices',
    '- Keep sessions short (15-20 minutes).',
    '- Study at the same time each day for consistency.',
    '- Shuffle the deck to avoid order-dependent memorization.',
    '- Say answers out loud when possible.',
  ].join('\n');
}

// ============================================================================
// FORMAT FUNCTIONS
// ============================================================================

function formatMarkdown(
  title: string,
  subject: string | undefined,
  cards: FlashcardInput[],
  difficulty: Difficulty | undefined,
  includeStudyTips: boolean,
): string {
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push('');
  if (subject) {
    lines.push(`**Subject:** ${subject}`);
  }
  if (difficulty) {
    lines.push(`**Difficulty:** ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`);
  }
  lines.push(`**Cards:** ${cards.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    lines.push(`### Card ${i + 1}`);
    lines.push('');
    lines.push(`**Q:** ${card.front}`);
    lines.push('');
    lines.push(`**A:** ${card.back}`);
    if (card.hint) {
      lines.push('');
      lines.push(`*Hint: ${card.hint}*`);
    }
    if (card.tags && card.tags.length > 0) {
      lines.push('');
      lines.push(`Tags: ${card.tags.map((t) => '`' + t + '`').join(' ')}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  if (includeStudyTips) {
    lines.push('');
    lines.push(getStudyTips());
  }

  return lines.join('\n');
}

function formatJson(
  title: string,
  subject: string | undefined,
  cards: FlashcardInput[],
  difficulty: Difficulty | undefined,
): string {
  const now = new Date().toISOString();
  const deck = {
    metadata: {
      title,
      subject: subject ?? null,
      card_count: cards.length,
      difficulty: difficulty ?? null,
      created_at: now,
    },
    cards: cards.map((card, i) => ({
      id: i + 1,
      front: card.front,
      back: card.back,
      hint: card.hint ?? null,
      tags: card.tags ?? [],
      created_at: now,
    })),
  };
  return JSON.stringify(deck, null, 2);
}

function formatCsv(cards: FlashcardInput[]): string {
  const lines: string[] = [];
  lines.push('front,back,hint,tags');
  for (const card of cards) {
    const tags = card.tags ? card.tags.join('; ') : '';
    lines.push(
      [
        csvEscape(card.front),
        csvEscape(card.back),
        csvEscape(card.hint ?? ''),
        csvEscape(tags),
      ].join(','),
    );
  }
  return lines.join('\n');
}

function formatAnkiCsv(cards: FlashcardInput[]): string {
  const lines: string[] = [];
  // Anki uses tab-separated values, no header row
  for (const card of cards) {
    const tags = card.tags ? card.tags.join(' ') : '';
    // Anki format: front\tback\ttags
    lines.push([card.front, card.back, tags].join('\t'));
  }
  return lines.join('\n');
}

function getAnkiInstructions(): string {
  return [
    '## Anki Import Instructions',
    '',
    '1. Open Anki and go to **File > Import**.',
    '2. Select the exported `.txt` file.',
    '3. Set **Type** to "Basic" (or "Basic and Reversed" for two-way cards).',
    '4. Set **Field separator** to "Tab".',
    '5. Map fields: Field 1 = Front, Field 2 = Back, Tags = Field 3.',
    '6. Click **Import**.',
    '',
    'The cards will appear in your default deck. You can move them to a specific deck after import.',
  ].join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const flashcardTool: UnifiedTool = {
  name: 'create_flashcards',
  description: `Create flashcard study sets in multiple formats including Anki-compatible CSV. Perfect for learning any subject.

Use this when:
- User wants to study or memorize material
- User asks for flashcards, study cards, or quiz questions
- User wants to create Anki decks
- User is preparing for an exam or test
- User wants to learn vocabulary, facts, or concepts

Returns flashcard sets in Markdown, JSON, CSV, or Anki-compatible format for import into study apps.`,
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Deck/set title',
      },
      subject: {
        type: 'string',
        description: 'Subject area (e.g., "Biology", "Spanish", "Bible")',
      },
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            front: { type: 'string', description: 'Front of the card (question)' },
            back: { type: 'string', description: 'Back of the card (answer)' },
            hint: { type: 'string', description: 'Optional hint' },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags for categorization',
            },
          },
          required: ['front', 'back'],
        },
        description: 'Array of flashcard entries',
      },
      format: {
        type: 'string',
        enum: ['json', 'csv', 'markdown', 'anki_csv'],
        description: 'Output format. Default: "markdown"',
      },
      difficulty: {
        type: 'string',
        enum: ['beginner', 'intermediate', 'advanced'],
        description: 'Difficulty level for metadata',
      },
      include_study_tips: {
        type: 'boolean',
        description: 'Whether to include study methodology tips. Default: false',
      },
    },
    required: ['title', 'cards'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isFlashcardAvailable(): boolean {
  // Pure formatting — always available
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeFlashcard(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    subject?: string;
    cards: FlashcardInput[];
    format?: FlashcardFormat;
    difficulty?: Difficulty;
    include_study_tips?: boolean;
  };

  // Validate required parameters
  if (!args.title || !args.title.trim()) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: title parameter is required',
      isError: true,
    };
  }

  if (!Array.isArray(args.cards) || args.cards.length === 0) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: cards array is required and must not be empty',
      isError: true,
    };
  }

  // Validate each card
  for (let i = 0; i < args.cards.length; i++) {
    const card = args.cards[i];
    if (!card.front || !card.back) {
      return {
        toolCallId: toolCall.id,
        content: `Error: card at index ${i} is missing required fields (front, back)`,
        isError: true,
      };
    }
  }

  const format = args.format ?? 'markdown';
  const includeStudyTips = args.include_study_tips ?? false;

  try {
    let formatted: string;
    let ankiInstructions: string | null = null;

    switch (format) {
      case 'json':
        formatted = formatJson(args.title, args.subject, args.cards, args.difficulty);
        break;
      case 'csv':
        formatted = formatCsv(args.cards);
        break;
      case 'anki_csv':
        formatted = formatAnkiCsv(args.cards);
        ankiInstructions = getAnkiInstructions();
        break;
      case 'markdown':
      default:
        formatted = formatMarkdown(
          args.title,
          args.subject,
          args.cards,
          args.difficulty,
          includeStudyTips,
        );
        break;
    }

    // For non-markdown formats, append study tips as separate content
    let studyTipsContent: string | null = null;
    if (includeStudyTips && format !== 'markdown') {
      studyTipsContent = getStudyTips();
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Flashcard deck created: "${args.title}" (${args.cards.length} cards, ${format} format)`,
        format,
        formatted_output: formatted,
        ...(ankiInstructions ? { anki_instructions: ankiInstructions } : {}),
        ...(studyTipsContent ? { study_tips: studyTipsContent } : {}),
        metadata: {
          title: args.title,
          subject: args.subject ?? null,
          card_count: args.cards.length,
          difficulty: args.difficulty ?? null,
          format,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating flashcards: ${(error as Error).message}`,
      isError: true,
    };
  }
}
