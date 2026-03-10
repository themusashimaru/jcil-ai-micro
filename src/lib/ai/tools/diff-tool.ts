/**
 * TEXT DIFF COMPARISON TOOL
 *
 * Compare two texts and show differences.
 * Uses the 'diff' library for high-quality comparisons.
 *
 * Supported diff modes:
 * - Character-by-character
 * - Word-by-word
 * - Line-by-line
 * - Sentence-by-sentence
 * - JSON structure comparison
 *
 * Output formats:
 * - Unified diff (standard patch format)
 * - Side-by-side comparison
 * - Inline with markers
 * - Statistics only
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded diff library
let diff: typeof import('diff') | null = null;

async function initDiff(): Promise<boolean> {
  if (diff) return true;
  try {
    diff = await import('diff');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const diffTool: UnifiedTool = {
  name: 'diff_compare',
  description: `Compare two texts and show the differences between them.

Comparison modes:
- chars: Character-by-character comparison (detailed)
- words: Word-by-word comparison (balanced)
- lines: Line-by-line comparison (for code/documents)
- sentences: Sentence-by-sentence comparison
- json: Compare JSON structures (ignores formatting)

Output formats:
- unified: Standard unified diff format (like git diff)
- inline: Inline markers showing +additions and -deletions
- stats: Statistics only (counts of additions, deletions, unchanged)

Use cases:
- Compare code versions
- Track document changes
- Verify data modifications
- Review edits before/after
- Analyze text revisions`,
  parameters: {
    type: 'object',
    properties: {
      text1: {
        type: 'string',
        description: 'First text (original/old version)',
      },
      text2: {
        type: 'string',
        description: 'Second text (new/modified version)',
      },
      mode: {
        type: 'string',
        enum: ['chars', 'words', 'lines', 'sentences', 'json'],
        description: 'Comparison mode. Default: lines',
      },
      output_format: {
        type: 'string',
        enum: ['unified', 'inline', 'stats'],
        description: 'Output format. Default: unified',
      },
      context_lines: {
        type: 'number',
        description: 'Number of context lines around changes (for unified format). Default: 3',
      },
      ignore_whitespace: {
        type: 'boolean',
        description: 'Ignore whitespace differences. Default: false',
      },
      ignore_case: {
        type: 'boolean',
        description: 'Ignore case differences. Default: false',
      },
      label1: {
        type: 'string',
        description: 'Label for first text. Default: "Original"',
      },
      label2: {
        type: 'string',
        description: 'Label for second text. Default: "Modified"',
      },
    },
    required: ['text1', 'text2'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export async function isDiffAvailable(): Promise<boolean> {
  return await initDiff();
}

// ============================================================================
// HELPER TYPES
// ============================================================================

interface DiffChange {
  value: string;
  added?: boolean;
  removed?: boolean;
  count?: number;
}

interface DiffStats {
  additions: number;
  deletions: number;
  unchanged: number;
  totalChanges: number;
  similarityPercent: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function preprocess(text: string, ignoreWhitespace: boolean, ignoreCase: boolean): string {
  let result = text;
  if (ignoreCase) {
    result = result.toLowerCase();
  }
  if (ignoreWhitespace) {
    result = result.replace(/\s+/g, ' ').trim();
  }
  return result;
}

function calculateStats(changes: DiffChange[]): DiffStats {
  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const change of changes) {
    const count = change.count || change.value.length;
    if (change.added) {
      additions += count;
    } else if (change.removed) {
      deletions += count;
    } else {
      unchanged += count;
    }
  }

  const total = additions + deletions + unchanged;
  const similarityPercent = total > 0 ? Math.round((unchanged / total) * 100) : 100;

  return {
    additions,
    deletions,
    unchanged,
    totalChanges: additions + deletions,
    similarityPercent,
  };
}

function formatInline(changes: DiffChange[]): string {
  return changes
    .map((change) => {
      if (change.added) {
        return `[+${change.value}]`;
      } else if (change.removed) {
        return `[-${change.value}]`;
      } else {
        return change.value;
      }
    })
    .join('');
}

function formatUnified(
  text1: string,
  text2: string,
  label1: string,
  label2: string,
  contextLines: number,
  d: typeof import('diff')
): string {
  return d.createPatch(label1, text1, text2, label1, label2, { context: contextLines });
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeDiff(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    text1: string;
    text2: string;
    mode?: string;
    output_format?: string;
    context_lines?: number;
    ignore_whitespace?: boolean;
    ignore_case?: boolean;
    label1?: string;
    label2?: string;
  };

  // Validate required parameters
  if (args.text1 === undefined || args.text2 === undefined) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: Both text1 and text2 are required',
      isError: true,
    };
  }

  // Initialize diff library
  const loaded = await initDiff();
  if (!loaded || !diff) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: Diff library not available. Please install the diff package.',
      isError: true,
    };
  }

  try {
    // Apply preprocessing options
    const ignoreWhitespace = args.ignore_whitespace || false;
    const ignoreCase = args.ignore_case || false;

    let processedText1 = args.text1;
    let processedText2 = args.text2;

    if (ignoreWhitespace || ignoreCase) {
      processedText1 = preprocess(args.text1, ignoreWhitespace, ignoreCase);
      processedText2 = preprocess(args.text2, ignoreWhitespace, ignoreCase);
    }

    // Get comparison mode
    const mode = args.mode || 'lines';
    const outputFormat = args.output_format || 'unified';
    const contextLines = args.context_lines ?? 3;
    const label1 = args.label1 || 'Original';
    const label2 = args.label2 || 'Modified';

    // Perform diff based on mode
    let changes: DiffChange[];

    switch (mode) {
      case 'chars':
        changes = diff.diffChars(processedText1, processedText2);
        break;
      case 'words':
        changes = diff.diffWords(processedText1, processedText2);
        break;
      case 'lines':
        changes = diff.diffLines(processedText1, processedText2);
        break;
      case 'sentences':
        changes = diff.diffSentences(processedText1, processedText2);
        break;
      case 'json':
        try {
          const json1 = JSON.parse(processedText1);
          const json2 = JSON.parse(processedText2);
          changes = diff.diffJson(json1, json2);
        } catch {
          return {
            toolCallId: toolCall.id,
            content: 'Error: Invalid JSON in one or both texts for JSON comparison mode',
            isError: true,
          };
        }
        break;
      default:
        changes = diff.diffLines(processedText1, processedText2);
    }

    // Calculate statistics
    const stats = calculateStats(changes);

    // Format output based on requested format
    let formattedOutput: string;
    const hasChanges = stats.totalChanges > 0;

    switch (outputFormat) {
      case 'unified':
        formattedOutput = formatUnified(
          processedText1,
          processedText2,
          label1,
          label2,
          contextLines,
          diff
        );
        break;
      case 'inline':
        formattedOutput = formatInline(changes);
        break;
      case 'stats':
        formattedOutput = `Comparison Statistics:
- Additions: ${stats.additions}
- Deletions: ${stats.deletions}
- Unchanged: ${stats.unchanged}
- Total Changes: ${stats.totalChanges}
- Similarity: ${stats.similarityPercent}%`;
        break;
      default:
        formattedOutput = formatUnified(
          processedText1,
          processedText2,
          label1,
          label2,
          contextLines,
          diff
        );
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: hasChanges
          ? `Found ${stats.totalChanges} difference(s) between texts`
          : 'No differences found - texts are identical',
        mode,
        outputFormat,
        hasChanges,
        statistics: stats,
        labels: { original: label1, modified: label2 },
        options: {
          ignoreWhitespace,
          ignoreCase,
          contextLines,
        },
        // The formatted diff output
        diff: formattedOutput,
        // Raw changes for programmatic access
        changes: changes.map((c) => ({
          type: c.added ? 'added' : c.removed ? 'removed' : 'unchanged',
          value: c.value,
          count: c.count,
        })),
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error comparing texts: ${(error as Error).message}`,
      isError: true,
    };
  }
}
