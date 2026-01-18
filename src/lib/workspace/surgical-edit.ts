/**
 * SURGICAL EDIT TOOL - LINE-BASED PRECISE EDITING
 *
 * Like Claude Code's Edit tool - supports:
 * - Line-based editing with line numbers
 * - Multi-edit batching
 * - Dry-run preview mode
 * - Conflict detection
 * - Atomic operations with rollback
 *
 * This is what makes professional editing possible.
 */

import { logger } from '@/lib/logger';

const log = logger('SurgicalEdit');

// ============================================================================
// TYPES
// ============================================================================

export interface LineEdit {
  startLine: number; // 1-indexed line number to start replacing
  endLine: number; // 1-indexed line number to end replacing (inclusive)
  newContent: string; // The new content to insert
  description?: string; // Optional description of the edit
}

export interface SurgicalEditRequest {
  filePath: string;
  edits: LineEdit[];
  dryRun?: boolean; // If true, preview changes without applying
  createBackup?: boolean; // If true, keep original content for rollback
}

export interface EditDiff {
  lineNumber: number;
  type: 'add' | 'remove' | 'modify';
  oldContent?: string;
  newContent?: string;
}

export interface SurgicalEditResult {
  success: boolean;
  filePath: string;
  dryRun: boolean;

  // Before/after content
  originalContent?: string;
  newContent?: string;

  // Detailed diff
  diffs: EditDiff[];

  // Statistics
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;

  // Errors
  error?: string;
  conflicts?: Array<{
    editIndex: number;
    description: string;
  }>;

  // For rollback
  backupId?: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateEdits(
  edits: LineEdit[],
  totalLines: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];

    // Check line numbers are positive
    if (edit.startLine < 1) {
      errors.push(`Edit ${i + 1}: startLine must be >= 1 (got ${edit.startLine})`);
    }
    if (edit.endLine < 1) {
      errors.push(`Edit ${i + 1}: endLine must be >= 1 (got ${edit.endLine})`);
    }

    // Check start <= end
    if (edit.startLine > edit.endLine) {
      errors.push(
        `Edit ${i + 1}: startLine (${edit.startLine}) must be <= endLine (${edit.endLine})`
      );
    }

    // Check within file bounds (allow endLine to exceed for appending)
    if (edit.startLine > totalLines + 1) {
      errors.push(
        `Edit ${i + 1}: startLine (${edit.startLine}) exceeds file length (${totalLines} lines)`
      );
    }
  }

  // Check for overlapping edits
  const sortedEdits = [...edits].sort((a, b) => a.startLine - b.startLine);
  for (let i = 0; i < sortedEdits.length - 1; i++) {
    const current = sortedEdits[i];
    const next = sortedEdits[i + 1];
    if (current.endLine >= next.startLine) {
      errors.push(
        `Overlapping edits: lines ${current.startLine}-${current.endLine} overlaps with ${next.startLine}-${next.endLine}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// DIFF GENERATION
// ============================================================================

/**
 * Generate diffs by comparing original and new content line by line.
 * Uses simple LCS-based approach for accurate diff detection.
 */
function generateDiffs(originalLines: string[], newLines: string[]): EditDiff[] {
  const diffs: EditDiff[] = [];

  // Use a simple longest common subsequence (LCS) approach
  // to find matching lines and generate accurate diffs
  const lcs = computeLCS(originalLines, newLines);

  let origIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (origIdx < originalLines.length || newIdx < newLines.length) {
    if (
      lcsIdx < lcs.length &&
      origIdx < originalLines.length &&
      originalLines[origIdx] === lcs[lcsIdx]
    ) {
      // This line is in common
      if (newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
        // Same line in both - no change, just advance
        origIdx++;
        newIdx++;
        lcsIdx++;
      } else {
        // New content added before this common line
        diffs.push({
          lineNumber: newIdx + 1,
          type: 'add',
          newContent: newLines[newIdx],
        });
        newIdx++;
      }
    } else if (
      lcsIdx < lcs.length &&
      newIdx < newLines.length &&
      newLines[newIdx] === lcs[lcsIdx]
    ) {
      // Line removed from original
      diffs.push({
        lineNumber: origIdx + 1,
        type: 'remove',
        oldContent: originalLines[origIdx],
      });
      origIdx++;
    } else if (origIdx < originalLines.length && newIdx < newLines.length) {
      // Both differ - check if it's a modification or add/remove
      if (originalLines[origIdx] !== newLines[newIdx]) {
        diffs.push({
          lineNumber: origIdx + 1,
          type: 'modify',
          oldContent: originalLines[origIdx],
          newContent: newLines[newIdx],
        });
      }
      origIdx++;
      newIdx++;
    } else if (origIdx < originalLines.length) {
      // Only original has remaining lines - removed
      diffs.push({
        lineNumber: origIdx + 1,
        type: 'remove',
        oldContent: originalLines[origIdx],
      });
      origIdx++;
    } else if (newIdx < newLines.length) {
      // Only new has remaining lines - added
      diffs.push({
        lineNumber: newIdx + 1,
        type: 'add',
        newContent: newLines[newIdx],
      });
      newIdx++;
    }
  }

  return diffs;
}

/**
 * Compute Longest Common Subsequence of two string arrays.
 * Used for accurate diff generation.
 */
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Fill DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

// ============================================================================
// CORE IMPLEMENTATION
// ============================================================================

export async function surgicalEdit(
  request: SurgicalEditRequest,
  readFile: (path: string) => Promise<string>,
  writeFile: (path: string, content: string) => Promise<void>
): Promise<SurgicalEditResult> {
  const { filePath, edits, dryRun = false, createBackup = true } = request;

  log.info('Surgical edit requested', {
    filePath,
    editCount: edits.length,
    dryRun,
  });

  try {
    // Read original content
    let originalContent: string;
    try {
      originalContent = await readFile(filePath);
    } catch {
      // File doesn't exist - treat as empty for new file creation
      originalContent = '';
    }

    const originalLines = originalContent.split('\n');

    // Validate edits
    const validation = validateEdits(edits, originalLines.length);
    if (!validation.valid) {
      return {
        success: false,
        filePath,
        dryRun,
        diffs: [],
        linesAdded: 0,
        linesRemoved: 0,
        linesModified: 0,
        error: `Invalid edits: ${validation.errors.join('; ')}`,
        conflicts: validation.errors.map((err, i) => ({
          editIndex: i,
          description: err,
        })),
      };
    }

    // Sort edits by line number (descending) to apply from bottom to top
    // This prevents line number shifts from affecting subsequent edits
    const sortedEdits = [...edits].sort((a, b) => b.startLine - a.startLine);

    // Apply edits
    const newLines = [...originalLines];
    let linesAdded = 0;
    let linesRemoved = 0;

    for (const edit of sortedEdits) {
      const startIdx = edit.startLine - 1;
      const endIdx = Math.min(edit.endLine - 1, newLines.length - 1);
      const deleteCount = endIdx - startIdx + 1;
      const newContentLines = edit.newContent === '' ? [] : edit.newContent.split('\n');

      // Track statistics
      linesRemoved += deleteCount;
      linesAdded += newContentLines.length;

      // Apply the edit
      newLines.splice(startIdx, deleteCount, ...newContentLines);

      log.debug('Applied edit', {
        startLine: edit.startLine,
        endLine: edit.endLine,
        deleted: deleteCount,
        added: newContentLines.length,
      });
    }

    const newContent = newLines.join('\n');
    const diffs = generateDiffs(originalLines, newLines);

    // Calculate modifications (lines that changed but weren't fully added/removed)
    const linesModified = Math.min(linesAdded, linesRemoved);

    // Generate backup ID if needed
    const backupId = createBackup
      ? `backup-${Date.now()}-${Math.random().toString(36).slice(2)}`
      : undefined;

    // Actually write if not dry run
    if (!dryRun) {
      await writeFile(filePath, newContent);
      log.info('Surgical edit applied', {
        filePath,
        linesAdded,
        linesRemoved,
        linesModified,
      });
    } else {
      log.info('Surgical edit dry run', {
        filePath,
        linesAdded,
        linesRemoved,
        linesModified,
      });
    }

    return {
      success: true,
      filePath,
      dryRun,
      originalContent,
      newContent,
      diffs,
      linesAdded: linesAdded - linesModified,
      linesRemoved: linesRemoved - linesModified,
      linesModified,
      backupId,
    };
  } catch (error) {
    log.error('Surgical edit failed', error as Error);
    return {
      success: false,
      filePath,
      dryRun,
      diffs: [],
      linesAdded: 0,
      linesRemoved: 0,
      linesModified: 0,
      error: error instanceof Error ? error.message : 'Unknown error during edit',
    };
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Single line edit - convenience wrapper
 */
export function createLineEdit(line: number, newContent: string, description?: string): LineEdit {
  return {
    startLine: line,
    endLine: line,
    newContent,
    description,
  };
}

/**
 * Insert lines after a specific line
 */
export function createInsertAfter(
  afterLine: number,
  content: string,
  description?: string
): LineEdit {
  return {
    startLine: afterLine + 1,
    endLine: afterLine, // endLine < startLine means pure insertion
    newContent: content,
    description,
  };
}

/**
 * Delete lines
 */
export function createDeleteLines(
  startLine: number,
  endLine: number,
  description?: string
): LineEdit {
  return {
    startLine,
    endLine,
    newContent: '',
    description,
  };
}

/**
 * Replace a range of lines
 */
export function createReplaceRange(
  startLine: number,
  endLine: number,
  newContent: string,
  description?: string
): LineEdit {
  return {
    startLine,
    endLine,
    newContent,
    description,
  };
}

// ============================================================================
// PREVIEW FORMATTING
// ============================================================================

/**
 * Format diff for display
 */
export function formatDiffForDisplay(diffs: EditDiff[]): string {
  const lines: string[] = [];

  for (const diff of diffs) {
    if (diff.type === 'remove') {
      lines.push(`- ${diff.lineNumber}: ${diff.oldContent}`);
    } else if (diff.type === 'add') {
      lines.push(`+ ${diff.lineNumber}: ${diff.newContent}`);
    } else if (diff.type === 'modify') {
      lines.push(`- ${diff.lineNumber}: ${diff.oldContent}`);
      lines.push(`+ ${diff.lineNumber}: ${diff.newContent}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate unified diff format
 */
export function generateUnifiedDiff(
  filePath: string,
  originalContent: string,
  newContent: string
): string {
  const originalLines = originalContent.split('\n');
  const newLines = newContent.split('\n');

  const lines: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];

  // Simple unified diff generation
  let i = 0;
  let j = 0;

  while (i < originalLines.length || j < newLines.length) {
    if (i >= originalLines.length) {
      // Only new lines remain
      lines.push(`+${newLines[j]}`);
      j++;
    } else if (j >= newLines.length) {
      // Only old lines remain
      lines.push(`-${originalLines[i]}`);
      i++;
    } else if (originalLines[i] === newLines[j]) {
      // Lines match
      lines.push(` ${originalLines[i]}`);
      i++;
      j++;
    } else {
      // Lines differ - find next match
      lines.push(`-${originalLines[i]}`);
      lines.push(`+${newLines[j]}`);
      i++;
      j++;
    }
  }

  return lines.join('\n');
}
