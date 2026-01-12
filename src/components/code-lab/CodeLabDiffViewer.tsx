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

      <style jsx>{`
        .diff-viewer {
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 12px;
          overflow: hidden;
          background: var(--cl-bg-primary, white);
          font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
          font-size: 0.8125rem;
        }

        .diff-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .diff-file-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .diff-status {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.6875rem;
          font-weight: 700;
          color: white;
        }

        .diff-path {
          font-weight: 500;
        }

        .diff-stats {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .stat {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }

        .stat.additions {
          color: #166534;
          background: #dcfce7;
        }

        .stat.deletions {
          color: #991b1b;
          background: #fee2e2;
        }

        .view-toggle {
          display: flex;
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 6px;
          overflow: hidden;
        }

        .view-toggle button {
          padding: 0.375rem 0.75rem;
          border: none;
          background: transparent;
          font-size: 0.75rem;
          cursor: pointer;
          color: var(--cl-text-secondary, #4b5563);
        }

        .view-toggle button.active {
          background: var(--cl-accent-primary, #1e3a5f);
          color: white;
        }

        .diff-binary {
          padding: 2rem;
          text-align: center;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .diff-content {
          max-height: 600px;
          overflow-y: auto;
        }

        .diff-hunk {
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .diff-hunk:last-child {
          border-bottom: none;
        }

        .hunk-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: var(--cl-bg-secondary, #f9fafb);
          cursor: pointer;
          user-select: none;
        }

        .hunk-header:hover {
          background: var(--cl-bg-tertiary, #f3f4f6);
        }

        .hunk-toggle {
          color: var(--cl-text-tertiary, #6b7280);
          font-size: 0.625rem;
        }

        .hunk-info {
          color: var(--cl-text-tertiary, #6b7280);
          flex: 1;
        }

        .hunk-actions {
          display: flex;
          gap: 0.5rem;
        }

        .hunk-btn {
          padding: 0.25rem 0.5rem;
          border: none;
          border-radius: 4px;
          font-size: 0.6875rem;
          font-weight: 500;
          cursor: pointer;
        }

        .hunk-btn.accept {
          background: #dcfce7;
          color: #166534;
        }

        .hunk-btn.accept:hover {
          background: #bbf7d0;
        }

        .hunk-btn.reject {
          background: #fee2e2;
          color: #991b1b;
        }

        .hunk-btn.reject:hover {
          background: #fecaca;
        }
      `}</style>
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

      <style jsx>{`
        .split-view {
          display: flex;
        }

        .split-side {
          flex: 1;
          min-width: 0;
          overflow-x: auto;
        }

        .split-side.left {
          border-right: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .diff-line {
          display: flex;
          min-height: 1.5rem;
          line-height: 1.5rem;
        }

        .diff-line.unchanged {
          background: transparent;
        }

        .diff-line.removed {
          background: #fef2f2;
        }

        .diff-line.added {
          background: #f0fdf4;
        }

        .diff-line.empty {
          background: var(--cl-bg-tertiary, #f3f4f6);
        }

        .line-num {
          width: 50px;
          padding: 0 0.5rem;
          text-align: right;
          color: var(--cl-text-muted, #9ca3af);
          background: var(--cl-bg-secondary, #f9fafb);
          border-right: 1px solid var(--cl-border-primary, #e5e7eb);
          user-select: none;
          flex-shrink: 0;
        }

        .line-content {
          flex: 1;
          padding: 0 0.5rem;
          white-space: pre;
        }

        .diff-line.removed .line-content {
          color: #991b1b;
        }

        .diff-line.added .line-content {
          color: #166534;
        }
      `}</style>
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

      <style jsx>{`
        .unified-view {
          overflow-x: auto;
        }

        .diff-line {
          display: flex;
          min-height: 1.5rem;
          line-height: 1.5rem;
        }

        .diff-line.unchanged {
          background: transparent;
        }

        .diff-line.removed {
          background: #fef2f2;
        }

        .diff-line.added {
          background: #f0fdf4;
        }

        .diff-line.header {
          background: var(--cl-bg-secondary, #f9fafb);
          color: var(--cl-text-tertiary, #6b7280);
        }

        .line-num {
          width: 40px;
          padding: 0 0.25rem;
          text-align: right;
          color: var(--cl-text-muted, #9ca3af);
          background: var(--cl-bg-secondary, #f9fafb);
          user-select: none;
          flex-shrink: 0;
        }

        .line-num.old {
          border-right: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .line-num.new {
          border-right: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .line-prefix {
          width: 20px;
          text-align: center;
          color: var(--cl-text-tertiary, #6b7280);
          flex-shrink: 0;
        }

        .diff-line.removed .line-prefix {
          color: #991b1b;
        }

        .diff-line.added .line-prefix {
          color: #166534;
        }

        .line-content {
          flex: 1;
          padding: 0 0.5rem;
          white-space: pre;
        }

        .diff-line.removed .line-content {
          color: #991b1b;
        }

        .diff-line.added .line-content {
          color: #166534;
        }
      `}</style>
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
