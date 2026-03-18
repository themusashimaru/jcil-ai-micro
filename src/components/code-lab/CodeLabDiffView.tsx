'use client';

/**
 * CODE LAB DIFF VIEW
 *
 * Shows code changes with +green/-red lines like Claude Code.
 * Supports:
 * - Unified diff format parsing
 * - Side-by-side or inline view
 * - Line numbers
 * - Syntax highlighting awareness
 * - Collapsible unchanged sections
 */

import { useMemo, useState } from 'react';
import './code-lab-diff-view.css';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'header';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface CodeLabDiffViewProps {
  oldCode?: string;
  newCode?: string;
  unifiedDiff?: string; // Pre-computed unified diff
  filename?: string;
  language?: string;
  maxUnchangedLines?: number; // Collapse if more unchanged lines than this
}

export function CodeLabDiffView({
  oldCode,
  newCode,
  unifiedDiff,
  filename,
  language,
  maxUnchangedLines = 5,
}: CodeLabDiffViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  // Parse or compute diff
  const diffLines = useMemo(() => {
    if (unifiedDiff) {
      return parseUnifiedDiff(unifiedDiff);
    }
    if (oldCode !== undefined && newCode !== undefined) {
      return computeSimpleDiff(oldCode, newCode);
    }
    return [];
  }, [oldCode, newCode, unifiedDiff]);

  // Group lines for collapsing unchanged sections
  const groupedLines = useMemo(() => {
    const groups: Array<{
      type: 'collapsed' | 'expanded';
      lines: DiffLine[];
      startIndex: number;
    }> = [];

    let currentUnchanged: DiffLine[] = [];
    let startIndex = 0;

    diffLines.forEach((line, index) => {
      if (line.type === 'unchanged') {
        currentUnchanged.push(line);
      } else {
        // Flush unchanged lines
        if (currentUnchanged.length > 0) {
          if (currentUnchanged.length > maxUnchangedLines) {
            // Show first 2, collapse middle, show last 2
            if (currentUnchanged.length > 4) {
              groups.push({
                type: 'expanded',
                lines: currentUnchanged.slice(0, 2),
                startIndex,
              });
              groups.push({
                type: 'collapsed',
                lines: currentUnchanged.slice(2, -2),
                startIndex: startIndex + 2,
              });
              groups.push({
                type: 'expanded',
                lines: currentUnchanged.slice(-2),
                startIndex: startIndex + currentUnchanged.length - 2,
              });
            } else {
              groups.push({
                type: 'expanded',
                lines: currentUnchanged,
                startIndex,
              });
            }
          } else {
            groups.push({
              type: 'expanded',
              lines: currentUnchanged,
              startIndex,
            });
          }
          startIndex += currentUnchanged.length;
          currentUnchanged = [];
        }

        // Add the changed line
        groups.push({
          type: 'expanded',
          lines: [line],
          startIndex: index,
        });
        startIndex = index + 1;
      }
    });

    // Flush remaining unchanged
    if (currentUnchanged.length > 0) {
      if (currentUnchanged.length > maxUnchangedLines && currentUnchanged.length > 4) {
        groups.push({
          type: 'expanded',
          lines: currentUnchanged.slice(0, 2),
          startIndex,
        });
        groups.push({
          type: 'collapsed',
          lines: currentUnchanged.slice(2),
          startIndex: startIndex + 2,
        });
      } else {
        groups.push({
          type: 'expanded',
          lines: currentUnchanged,
          startIndex,
        });
      }
    }

    return groups;
  }, [diffLines, maxUnchangedLines]);

  // Calculate stats
  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    diffLines.forEach((line) => {
      if (line.type === 'added') added++;
      if (line.type === 'removed') removed++;
    });
    return { added, removed };
  }, [diffLines]);

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (diffLines.length === 0) {
    return (
      <div className="diff-empty">
        <span>No changes to display</span>
      </div>
    );
  }

  return (
    <div className="diff-view">
      {/* Header */}
      <div className="diff-header">
        <div className="diff-filename">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <span>{filename || 'Changes'}</span>
          {language && <span className="diff-lang">{language}</span>}
        </div>
        <div className="diff-stats">
          <span className="stat-added">+{stats.added}</span>
          <span className="stat-removed">-{stats.removed}</span>
        </div>
      </div>

      {/* Diff content */}
      <div className="diff-content">
        {groupedLines.map((group, groupIndex) => {
          if (group.type === 'collapsed' && !expandedSections.has(group.startIndex)) {
            return (
              <button
                key={`collapsed-${groupIndex}`}
                className="diff-collapsed-indicator"
                onClick={() => toggleSection(group.startIndex)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                </svg>
                <span>{group.lines.length} unchanged lines</span>
              </button>
            );
          }

          return group.lines.map((line, lineIndex) => (
            <div key={`${groupIndex}-${lineIndex}`} className={`diff-line diff-line-${line.type}`}>
              <span className="diff-line-numbers">
                <span className="old-num">{line.oldLineNumber || ''}</span>
                <span className="new-num">{line.newLineNumber || ''}</span>
              </span>
              <span className="diff-line-indicator">
                {line.type === 'added' && '+'}
                {line.type === 'removed' && '-'}
                {line.type === 'unchanged' && ' '}
              </span>
              <span className="diff-line-content">
                <code>{line.content}</code>
              </span>
            </div>
          ));
        })}
      </div>

    </div>
  );
}

// ============================================================================
// DIFF UTILITIES
// ============================================================================

/**
 * Parse unified diff format (e.g., from git diff)
 */
function parseUnifiedDiff(diff: string): DiffLine[] {
  const lines = diff.split('\n');
  const result: DiffLine[] = [];

  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Parse hunk header: @@ -start,count +start,count @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLineNum = parseInt(match[1], 10);
        newLineNum = parseInt(match[2], 10);
      }
      result.push({ type: 'header', content: line });
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      result.push({
        type: 'added',
        content: line.slice(1),
        newLineNumber: newLineNum++,
      });
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      result.push({
        type: 'removed',
        content: line.slice(1),
        oldLineNumber: oldLineNum++,
      });
    } else if (line.startsWith(' ') || line === '') {
      result.push({
        type: 'unchanged',
        content: line.startsWith(' ') ? line.slice(1) : line,
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
      });
    }
  }

  return result;
}

/**
 * Compute a simple line-by-line diff between two strings
 * Uses a basic LCS-inspired approach for small files
 */
function computeSimpleDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');
  const result: DiffLine[] = [];

  // Use simple line-by-line comparison with LCS for alignment
  const lcs = computeLCS(oldLines, newLines);

  let oldIdx = 0;
  let newIdx = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const match of lcs) {
    // Add removed lines before this match
    while (oldIdx < match.oldIndex) {
      result.push({
        type: 'removed',
        content: oldLines[oldIdx],
        oldLineNumber: oldLineNum++,
      });
      oldIdx++;
    }

    // Add added lines before this match
    while (newIdx < match.newIndex) {
      result.push({
        type: 'added',
        content: newLines[newIdx],
        newLineNumber: newLineNum++,
      });
      newIdx++;
    }

    // Add the matched line
    result.push({
      type: 'unchanged',
      content: oldLines[oldIdx],
      oldLineNumber: oldLineNum++,
      newLineNumber: newLineNum++,
    });
    oldIdx++;
    newIdx++;
  }

  // Add remaining removed lines
  while (oldIdx < oldLines.length) {
    result.push({
      type: 'removed',
      content: oldLines[oldIdx],
      oldLineNumber: oldLineNum++,
    });
    oldIdx++;
  }

  // Add remaining added lines
  while (newIdx < newLines.length) {
    result.push({
      type: 'added',
      content: newLines[newIdx],
      newLineNumber: newLineNum++,
    });
    newIdx++;
  }

  return result;
}

interface LCSMatch {
  oldIndex: number;
  newIndex: number;
}

/**
 * Compute Longest Common Subsequence positions
 */
function computeLCS(oldLines: string[], newLines: string[]): LCSMatch[] {
  const m = oldLines.length;
  const n = newLines.length;

  // Build DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find matches
  const matches: LCSMatch[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      matches.unshift({ oldIndex: i - 1, newIndex: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return matches;
}

/**
 * Export diff stats calculation for use in other components
 */
export function calculateDiffStats(
  oldCode: string,
  newCode: string
): { added: number; removed: number } {
  const diff = computeSimpleDiff(oldCode, newCode);
  let added = 0;
  let removed = 0;

  diff.forEach((line) => {
    if (line.type === 'added') added++;
    if (line.type === 'removed') removed++;
  });

  return { added, removed };
}
