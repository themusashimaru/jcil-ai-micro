'use client';

/**
 * CODE LAB DIFF VIEWER
 *
 * Beautiful side-by-side and unified diff visualization.
 * Features:
 * - Side-by-side view
 * - Unified view
 * - Syntax highlighting
 * - Line-by-line navigation
 * - Accept/reject hunks
 * - Copy changes
 */

import { useState, useMemo } from 'react';
import './code-lab-diff-viewer.css';

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'header';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface FileDiff {
  oldPath: string;
  newPath: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  binary?: boolean;
}

interface CodeLabDiffViewerProps {
  diff: FileDiff;
  viewMode?: 'split' | 'unified';
  onAcceptHunk?: (hunkIndex: number) => void;
  onRejectHunk?: (hunkIndex: number) => void;
  className?: string;
}

export function CodeLabDiffViewer({
  diff,
  viewMode = 'split',
  onAcceptHunk,
  onRejectHunk,
  className = '',
}: CodeLabDiffViewerProps) {
  const [mode, setMode] = useState<'split' | 'unified'>(viewMode);
  const [expandedHunks, setExpandedHunks] = useState<Set<number>>(new Set([0]));

  const toggleHunk = (index: number) => {
    setExpandedHunks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const statusColors = {
    added: { bg: '#dcfce7', text: '#166534', badge: '#22c55e' },
    modified: { bg: '#fef3c7', text: '#92400e', badge: '#f59e0b' },
    deleted: { bg: '#fee2e2', text: '#991b1b', badge: '#ef4444' },
    renamed: { bg: '#e0e7ff', text: '#3730a3', badge: '#1e3a5f' },
  };

  const colors = statusColors[diff.status];

  return (
    <div className={`diff-viewer ${className}`}>
      {/* Header */}
      <div className="diff-header" style={{ backgroundColor: colors.bg }}>
        <div className="diff-file-info">
          <span className="diff-status" style={{ backgroundColor: colors.badge }}>
            {diff.status.charAt(0).toUpperCase()}
          </span>
          <span className="diff-path" style={{ color: colors.text }}>
            {diff.status === 'renamed' ? (
              <>
                {diff.oldPath} → {diff.newPath}
              </>
            ) : (
              diff.newPath || diff.oldPath
            )}
          </span>
        </div>

        <div className="diff-stats">
          {diff.additions > 0 && <span className="stat additions">+{diff.additions}</span>}
          {diff.deletions > 0 && <span className="stat deletions">-{diff.deletions}</span>}
          <div className="view-toggle">
            <button className={mode === 'split' ? 'active' : ''} onClick={() => setMode('split')}>
              Split
            </button>
            <button
              className={mode === 'unified' ? 'active' : ''}
              onClick={() => setMode('unified')}
            >
              Unified
            </button>
          </div>
        </div>
      </div>

      {/* Binary file indicator */}
      {diff.binary && <div className="diff-binary">Binary file - cannot display diff</div>}

      {/* Hunks */}
      {!diff.binary && (
        <div className="diff-content">
          {diff.hunks.map((hunk, hunkIndex) => (
            <div key={hunkIndex} className="diff-hunk">
              {/* Hunk header */}
              <div className="hunk-header" onClick={() => toggleHunk(hunkIndex)}>
                <span className="hunk-toggle">{expandedHunks.has(hunkIndex) ? '▼' : '▶'}</span>
                <span className="hunk-info">
                  @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                </span>
                {(onAcceptHunk || onRejectHunk) && (
                  <div className="hunk-actions">
                    {onAcceptHunk && (
                      <button
                        className="hunk-btn accept"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAcceptHunk(hunkIndex);
                        }}
                      >
                        ✓ Accept
                      </button>
                    )}
                    {onRejectHunk && (
                      <button
                        className="hunk-btn reject"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRejectHunk(hunkIndex);
                        }}
                      >
                        ✗ Reject
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Hunk content */}
              {expandedHunks.has(hunkIndex) &&
                (mode === 'split' ? (
                  <SplitView lines={hunk.lines} />
                ) : (
                  <UnifiedView lines={hunk.lines} />
                ))}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// Split view component
function SplitView({ lines }: { lines: DiffLine[] }) {
  const { leftLines, rightLines } = useMemo(() => {
    const left: (DiffLine | null)[] = [];
    const right: (DiffLine | null)[] = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (line.type === 'unchanged') {
        left.push(line);
        right.push(line);
        i++;
      } else if (line.type === 'removed') {
        // Collect consecutive removed lines
        const removed: DiffLine[] = [];
        while (i < lines.length && lines[i].type === 'removed') {
          removed.push(lines[i]);
          i++;
        }

        // Collect consecutive added lines
        const added: DiffLine[] = [];
        while (i < lines.length && lines[i].type === 'added') {
          added.push(lines[i]);
          i++;
        }

        // Pair them up
        const maxLen = Math.max(removed.length, added.length);
        for (let j = 0; j < maxLen; j++) {
          left.push(removed[j] || null);
          right.push(added[j] || null);
        }
      } else if (line.type === 'added') {
        left.push(null);
        right.push(line);
        i++;
      } else {
        i++;
      }
    }

    return { leftLines: left, rightLines: right };
  }, [lines]);

  return (
    <div className="split-view">
      <div className="split-side left">
        {leftLines.map((line, idx) => (
          <div key={idx} className={`diff-line ${line?.type || 'empty'}`}>
            <span className="line-num">{line?.oldLineNum || ''}</span>
            <span className="line-content">{line?.content || ''}</span>
          </div>
        ))}
      </div>
      <div className="split-side right">
        {rightLines.map((line, idx) => (
          <div key={idx} className={`diff-line ${line?.type || 'empty'}`}>
            <span className="line-num">{line?.newLineNum || ''}</span>
            <span className="line-content">{line?.content || ''}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

// Unified view component
function UnifiedView({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="unified-view">
      {lines.map((line, idx) => (
        <div key={idx} className={`diff-line ${line.type}`}>
          <span className="line-num old">{line.oldLineNum || ''}</span>
          <span className="line-num new">{line.newLineNum || ''}</span>
          <span className="line-prefix">
            {line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' '}
          </span>
          <span className="line-content">{line.content}</span>
        </div>
      ))}

    </div>
  );
}

/**
 * Parse unified diff format into structured data
 */
export function parseDiff(diffText: string): FileDiff[] {
  const files: FileDiff[] = [];
  const lines = diffText.split('\n');

  let currentFile: FileDiff | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    // File header: diff --git a/path b/path
    if (line.startsWith('diff --git')) {
      if (currentFile) {
        if (currentHunk) currentFile.hunks.push(currentHunk);
        files.push(currentFile);
      }

      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      currentFile = {
        oldPath: match?.[1] || '',
        newPath: match?.[2] || '',
        status: 'modified',
        hunks: [],
        additions: 0,
        deletions: 0,
      };
      currentHunk = null;
      continue;
    }

    if (!currentFile) continue;

    // New file indicator
    if (line.startsWith('new file mode')) {
      currentFile.status = 'added';
      continue;
    }

    // Deleted file indicator
    if (line.startsWith('deleted file mode')) {
      currentFile.status = 'deleted';
      continue;
    }

    // Rename indicator
    if (line.startsWith('rename from') || line.startsWith('rename to')) {
      currentFile.status = 'renamed';
      continue;
    }

    // Binary file
    if (line.includes('Binary files')) {
      currentFile.binary = true;
      continue;
    }

    // Hunk header: @@ -1,5 +1,6 @@
    const hunkMatch = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
    if (hunkMatch) {
      if (currentHunk) {
        currentFile.hunks.push(currentHunk);
      }

      oldLineNum = parseInt(hunkMatch[1]);
      newLineNum = parseInt(hunkMatch[3]);

      currentHunk = {
        oldStart: oldLineNum,
        oldLines: parseInt(hunkMatch[2]) || 1,
        newStart: newLineNum,
        newLines: parseInt(hunkMatch[4]) || 1,
        lines: [],
      };
      continue;
    }

    if (!currentHunk) continue;

    // Content lines
    if (line.startsWith('-')) {
      currentHunk.lines.push({
        type: 'removed',
        content: line.substring(1),
        oldLineNum: oldLineNum++,
      });
      currentFile.deletions++;
    } else if (line.startsWith('+')) {
      currentHunk.lines.push({
        type: 'added',
        content: line.substring(1),
        newLineNum: newLineNum++,
      });
      currentFile.additions++;
    } else if (line.startsWith(' ')) {
      currentHunk.lines.push({
        type: 'unchanged',
        content: line.substring(1),
        oldLineNum: oldLineNum++,
        newLineNum: newLineNum++,
      });
    }
  }

  // Don't forget the last file/hunk
  if (currentFile) {
    if (currentHunk) currentFile.hunks.push(currentHunk);
    files.push(currentFile);
  }

  return files;
}
