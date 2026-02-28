// @ts-nocheck - Test file with extensive mocking
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

// Make React available globally for components using JSX without explicit import
globalThis.React = React;

import { CodeLabDiffViewer, parseDiff } from './CodeLabDiffViewer';
import type { DiffHunk, FileDiff } from './CodeLabDiffViewer';

// ─── Mock external dependencies ────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ─── Test fixtures ─────────────────────────────────────────────────────────

function makeFileDiff(overrides: Partial<FileDiff> = {}): FileDiff {
  return {
    oldPath: 'src/old-file.ts',
    newPath: 'src/new-file.ts',
    status: 'modified',
    hunks: [],
    additions: 0,
    deletions: 0,
    ...overrides,
  };
}

function makeHunk(overrides: Partial<DiffHunk> = {}): DiffHunk {
  return {
    oldStart: 1,
    oldLines: 3,
    newStart: 1,
    newLines: 4,
    lines: [
      { type: 'unchanged', content: 'const a = 1;', oldLineNum: 1, newLineNum: 1 },
      { type: 'removed', content: 'const b = 2;', oldLineNum: 2 },
      { type: 'added', content: 'const b = 3;', newLineNum: 2 },
      { type: 'unchanged', content: 'export { a, b };', oldLineNum: 3, newLineNum: 3 },
    ],
    ...overrides,
  };
}

// ─── parseDiff() unit tests ────────────────────────────────────────────────

describe('parseDiff', () => {
  it('should return empty array for empty string', () => {
    expect(parseDiff('')).toEqual([]);
  });

  it('should return empty array for non-diff text', () => {
    expect(parseDiff('hello world\nfoo bar')).toEqual([]);
  });

  it('should parse a single file diff with one hunk', () => {
    const diffText = [
      'diff --git a/file.ts b/file.ts',
      'index abc1234..def5678 100644',
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -1,3 +1,4 @@',
      ' const a = 1;',
      '-const b = 2;',
      '+const b = 3;',
      '+const c = 4;',
      ' export {};',
    ].join('\n');

    const result = parseDiff(diffText);
    expect(result).toHaveLength(1);
    expect(result[0].oldPath).toBe('file.ts');
    expect(result[0].newPath).toBe('file.ts');
    expect(result[0].status).toBe('modified');
    expect(result[0].additions).toBe(2);
    expect(result[0].deletions).toBe(1);
    expect(result[0].hunks).toHaveLength(1);
  });

  it('should parse multiple files', () => {
    const diffText = [
      'diff --git a/a.ts b/a.ts',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
      'diff --git a/b.ts b/b.ts',
      '@@ -1,1 +1,1 @@',
      '-old2',
      '+new2',
    ].join('\n');

    const result = parseDiff(diffText);
    expect(result).toHaveLength(2);
    expect(result[0].oldPath).toBe('a.ts');
    expect(result[1].oldPath).toBe('b.ts');
  });

  it('should detect added file status', () => {
    const diffText = [
      'diff --git a/new.ts b/new.ts',
      'new file mode 100644',
      '@@ -0,0 +1,2 @@',
      '+line1',
      '+line2',
    ].join('\n');

    const result = parseDiff(diffText);
    expect(result[0].status).toBe('added');
    expect(result[0].additions).toBe(2);
    expect(result[0].deletions).toBe(0);
  });

  it('should detect deleted file status', () => {
    const diffText = [
      'diff --git a/old.ts b/old.ts',
      'deleted file mode 100644',
      '@@ -1,2 +0,0 @@',
      '-line1',
      '-line2',
    ].join('\n');

    const result = parseDiff(diffText);
    expect(result[0].status).toBe('deleted');
    expect(result[0].deletions).toBe(2);
  });

  it('should detect renamed file status from "rename from"', () => {
    const diffText = [
      'diff --git a/old-name.ts b/new-name.ts',
      'rename from old-name.ts',
      'rename to new-name.ts',
    ].join('\n');

    const result = parseDiff(diffText);
    expect(result[0].status).toBe('renamed');
    expect(result[0].oldPath).toBe('old-name.ts');
    expect(result[0].newPath).toBe('new-name.ts');
  });

  it('should detect binary files', () => {
    const diffText = [
      'diff --git a/image.png b/image.png',
      'Binary files a/image.png and b/image.png differ',
    ].join('\n');

    const result = parseDiff(diffText);
    expect(result[0].binary).toBe(true);
  });

  it('should parse multiple hunks in one file', () => {
    const diffText = [
      'diff --git a/file.ts b/file.ts',
      '@@ -1,3 +1,3 @@',
      ' a',
      '-b',
      '+B',
      ' c',
      '@@ -10,3 +10,3 @@',
      ' x',
      '-y',
      '+Y',
      ' z',
    ].join('\n');

    const result = parseDiff(diffText);
    expect(result[0].hunks).toHaveLength(2);
    expect(result[0].hunks[0].oldStart).toBe(1);
    expect(result[0].hunks[1].oldStart).toBe(10);
  });

  it('should handle hunk header without comma counts', () => {
    const diffText = ['diff --git a/file.ts b/file.ts', '@@ -1 +1 @@', '-old', '+new'].join('\n');

    const result = parseDiff(diffText);
    expect(result[0].hunks[0].oldLines).toBe(1);
    expect(result[0].hunks[0].newLines).toBe(1);
  });

  it('should correctly track line numbers for unchanged lines', () => {
    const diffText = [
      'diff --git a/file.ts b/file.ts',
      '@@ -5,3 +5,3 @@',
      ' line5',
      '-line6old',
      '+line6new',
      ' line7',
    ].join('\n');

    const result = parseDiff(diffText);
    const lines = result[0].hunks[0].lines;
    expect(lines[0]).toEqual({
      type: 'unchanged',
      content: 'line5',
      oldLineNum: 5,
      newLineNum: 5,
    });
  });

  it('should correctly track line numbers for removed lines', () => {
    const diffText = [
      'diff --git a/file.ts b/file.ts',
      '@@ -5,2 +5,1 @@',
      '-removed',
      ' kept',
    ].join('\n');

    const result = parseDiff(diffText);
    const removedLine = result[0].hunks[0].lines[0];
    expect(removedLine.type).toBe('removed');
    expect(removedLine.oldLineNum).toBe(5);
    expect(removedLine.newLineNum).toBeUndefined();
  });

  it('should correctly track line numbers for added lines', () => {
    const diffText = ['diff --git a/file.ts b/file.ts', '@@ -5,1 +5,2 @@', '+added', ' kept'].join(
      '\n'
    );

    const result = parseDiff(diffText);
    const addedLine = result[0].hunks[0].lines[0];
    expect(addedLine.type).toBe('added');
    expect(addedLine.newLineNum).toBe(5);
    expect(addedLine.oldLineNum).toBeUndefined();
  });

  it('should handle empty hunk with no content lines', () => {
    const diffText = ['diff --git a/file.ts b/file.ts', '@@ -1,0 +1,0 @@'].join('\n');

    const result = parseDiff(diffText);
    expect(result[0].hunks).toHaveLength(1);
    expect(result[0].hunks[0].lines).toEqual([]);
  });

  it('should skip lines before a file header', () => {
    const diffText = [
      'some noise',
      'more noise',
      'diff --git a/file.ts b/file.ts',
      '@@ -1,1 +1,1 @@',
      '-a',
      '+b',
    ].join('\n');

    const result = parseDiff(diffText);
    expect(result).toHaveLength(1);
    expect(result[0].oldPath).toBe('file.ts');
  });

  it('should handle content lines before a hunk header gracefully', () => {
    const diffText = [
      'diff --git a/file.ts b/file.ts',
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
    ].join('\n');

    const result = parseDiff(diffText);
    expect(result[0].hunks[0].lines).toHaveLength(2);
  });

  it('should accumulate additions and deletions across hunks', () => {
    const diffText = [
      'diff --git a/file.ts b/file.ts',
      '@@ -1,2 +1,2 @@',
      '-a',
      '+A',
      ' unchanged',
      '@@ -10,2 +10,2 @@',
      '-x',
      '+X',
      ' unchanged2',
    ].join('\n');

    const result = parseDiff(diffText);
    expect(result[0].additions).toBe(2);
    expect(result[0].deletions).toBe(2);
  });

  it('should parse paths with directories', () => {
    const diffText = [
      'diff --git a/src/components/Button.tsx b/src/components/Button.tsx',
      '@@ -1,1 +1,1 @@',
      '-old',
      '+new',
    ].join('\n');

    const result = parseDiff(diffText);
    expect(result[0].oldPath).toBe('src/components/Button.tsx');
    expect(result[0].newPath).toBe('src/components/Button.tsx');
  });

  it('should handle only additions in a hunk', () => {
    const diffText = [
      'diff --git a/file.ts b/file.ts',
      '@@ -1,0 +1,3 @@',
      '+line1',
      '+line2',
      '+line3',
    ].join('\n');

    const result = parseDiff(diffText);
    expect(result[0].additions).toBe(3);
    expect(result[0].deletions).toBe(0);
    expect(result[0].hunks[0].lines).toHaveLength(3);
    expect(result[0].hunks[0].lines.every((l) => l.type === 'added')).toBe(true);
  });

  it('should handle only deletions in a hunk', () => {
    const diffText = [
      'diff --git a/file.ts b/file.ts',
      '@@ -1,3 +1,0 @@',
      '-line1',
      '-line2',
      '-line3',
    ].join('\n');

    const result = parseDiff(diffText);
    expect(result[0].additions).toBe(0);
    expect(result[0].deletions).toBe(3);
    expect(result[0].hunks[0].lines).toHaveLength(3);
    expect(result[0].hunks[0].lines.every((l) => l.type === 'removed')).toBe(true);
  });
});

// ─── CodeLabDiffViewer component tests ─────────────────────────────────────

describe('CodeLabDiffViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header rendering', () => {
    it('should render with the given className', () => {
      const diff = makeFileDiff();
      const { container } = render(<CodeLabDiffViewer diff={diff} className="custom-class" />);
      expect(container.querySelector('.diff-viewer.custom-class')).toBeInTheDocument();
    });

    it('should display the newPath for modified files', () => {
      const diff = makeFileDiff({ newPath: 'src/modified.ts', status: 'modified' });
      render(<CodeLabDiffViewer diff={diff} />);
      expect(screen.getByText('src/modified.ts')).toBeInTheDocument();
    });

    it('should display oldPath when newPath is empty', () => {
      const diff = makeFileDiff({ oldPath: 'src/deleted.ts', newPath: '', status: 'deleted' });
      render(<CodeLabDiffViewer diff={diff} />);
      expect(screen.getByText('src/deleted.ts')).toBeInTheDocument();
    });

    it('should display renamed path with arrow notation', () => {
      const diff = makeFileDiff({
        oldPath: 'src/old.ts',
        newPath: 'src/new.ts',
        status: 'renamed',
      });
      render(<CodeLabDiffViewer diff={diff} />);
      const pathEl = screen.getByText((_, el) => {
        return (
          el?.classList?.contains('diff-path') && el?.textContent === 'src/old.ts \u2192 src/new.ts'
        );
      });
      expect(pathEl).toBeInTheDocument();
    });

    it('should display status badge with first letter uppercased for "added"', () => {
      const diff = makeFileDiff({ status: 'added' });
      render(<CodeLabDiffViewer diff={diff} />);
      const badge = screen.getByText('A');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('diff-status');
    });

    it('should display status badge "M" for modified', () => {
      const diff = makeFileDiff({ status: 'modified' });
      render(<CodeLabDiffViewer diff={diff} />);
      expect(screen.getByText('M')).toBeInTheDocument();
    });

    it('should display status badge "D" for deleted', () => {
      const diff = makeFileDiff({ status: 'deleted' });
      render(<CodeLabDiffViewer diff={diff} />);
      expect(screen.getByText('D')).toBeInTheDocument();
    });

    it('should display status badge "R" for renamed', () => {
      const diff = makeFileDiff({ status: 'renamed' });
      render(<CodeLabDiffViewer diff={diff} />);
      expect(screen.getByText('R')).toBeInTheDocument();
    });

    it('should show additions count when > 0', () => {
      const diff = makeFileDiff({ additions: 5 });
      render(<CodeLabDiffViewer diff={diff} />);
      expect(screen.getByText('+5')).toBeInTheDocument();
    });

    it('should show deletions count when > 0', () => {
      const diff = makeFileDiff({ deletions: 3 });
      render(<CodeLabDiffViewer diff={diff} />);
      expect(screen.getByText('-3')).toBeInTheDocument();
    });

    it('should not show additions when 0', () => {
      const diff = makeFileDiff({ additions: 0 });
      render(<CodeLabDiffViewer diff={diff} />);
      expect(screen.queryByText('+0')).not.toBeInTheDocument();
    });

    it('should not show deletions when 0', () => {
      const diff = makeFileDiff({ deletions: 0 });
      render(<CodeLabDiffViewer diff={diff} />);
      expect(screen.queryByText('-0')).not.toBeInTheDocument();
    });
  });

  describe('View mode toggle', () => {
    it('should default to split view mode', () => {
      const diff = makeFileDiff();
      render(<CodeLabDiffViewer diff={diff} />);
      const splitBtn = screen.getByText('Split');
      expect(splitBtn).toHaveClass('active');
    });

    it('should start in unified mode when viewMode="unified"', () => {
      const diff = makeFileDiff();
      render(<CodeLabDiffViewer diff={diff} viewMode="unified" />);
      const unifiedBtn = screen.getByText('Unified');
      expect(unifiedBtn).toHaveClass('active');
    });

    it('should switch to unified when clicking the Unified button', () => {
      const diff = makeFileDiff({ hunks: [makeHunk()] });
      render(<CodeLabDiffViewer diff={diff} />);

      fireEvent.click(screen.getByText('Unified'));

      expect(screen.getByText('Unified')).toHaveClass('active');
      expect(screen.getByText('Split')).not.toHaveClass('active');
    });

    it('should switch back to split when clicking the Split button', () => {
      const diff = makeFileDiff({ hunks: [makeHunk()] });
      render(<CodeLabDiffViewer diff={diff} viewMode="unified" />);

      fireEvent.click(screen.getByText('Split'));

      expect(screen.getByText('Split')).toHaveClass('active');
      expect(screen.getByText('Unified')).not.toHaveClass('active');
    });
  });

  describe('Binary files', () => {
    it('should show binary file message when binary is true', () => {
      const diff = makeFileDiff({ binary: true });
      render(<CodeLabDiffViewer diff={diff} />);
      expect(screen.getByText('Binary file - cannot display diff')).toBeInTheDocument();
    });

    it('should not render diff content for binary files', () => {
      const diff = makeFileDiff({ binary: true, hunks: [makeHunk()] });
      const { container } = render(<CodeLabDiffViewer diff={diff} />);
      expect(container.querySelector('.diff-content')).not.toBeInTheDocument();
    });
  });

  describe('Hunk rendering', () => {
    it('should render hunk headers with line info', () => {
      const hunk = makeHunk({ oldStart: 10, oldLines: 5, newStart: 10, newLines: 6 });
      const diff = makeFileDiff({ hunks: [hunk] });
      render(<CodeLabDiffViewer diff={diff} />);
      expect(screen.getByText('@@ -10,5 +10,6 @@')).toBeInTheDocument();
    });

    it('should expand the first hunk by default', () => {
      const hunk = makeHunk();
      const diff = makeFileDiff({ hunks: [hunk] });
      render(<CodeLabDiffViewer diff={diff} />);
      expect(screen.getByText('\u25BC')).toBeInTheDocument();
    });

    it('should not expand subsequent hunks by default', () => {
      const diff = makeFileDiff({
        hunks: [makeHunk(), makeHunk({ oldStart: 20, newStart: 20 })],
      });
      render(<CodeLabDiffViewer diff={diff} />);
      const collapsed = screen.getAllByText('\u25B6');
      expect(collapsed.length).toBeGreaterThanOrEqual(1);
    });

    it('should toggle hunk expansion when clicking the header', () => {
      const hunk = makeHunk({ oldStart: 1, oldLines: 3, newStart: 1, newLines: 4 });
      const diff = makeFileDiff({ hunks: [hunk] });
      render(<CodeLabDiffViewer diff={diff} />);

      // Initially expanded
      expect(screen.getByText('\u25BC')).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(screen.getByText('@@ -1,3 +1,4 @@').closest('.hunk-header'));
      expect(screen.getByText('\u25B6')).toBeInTheDocument();
    });

    it('should toggle a collapsed hunk to expanded', () => {
      const diff = makeFileDiff({
        hunks: [makeHunk(), makeHunk({ oldStart: 50, oldLines: 2, newStart: 50, newLines: 2 })],
      });
      render(<CodeLabDiffViewer diff={diff} />);

      const secondHeader = screen.getByText('@@ -50,2 +50,2 @@').closest('.hunk-header');
      fireEvent.click(secondHeader);

      const downArrows = screen.getAllByText('\u25BC');
      expect(downArrows).toHaveLength(2);
    });
  });

  describe('Accept/Reject hunk actions', () => {
    it('should not render action buttons when callbacks are not provided', () => {
      const diff = makeFileDiff({ hunks: [makeHunk()] });
      render(<CodeLabDiffViewer diff={diff} />);
      expect(screen.queryByText(/Accept/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Reject/)).not.toBeInTheDocument();
    });

    it('should render Accept button when onAcceptHunk is provided', () => {
      const onAcceptHunk = vi.fn();
      const diff = makeFileDiff({ hunks: [makeHunk()] });
      render(<CodeLabDiffViewer diff={diff} onAcceptHunk={onAcceptHunk} />);
      expect(screen.getByText(/Accept/)).toBeInTheDocument();
    });

    it('should render Reject button when onRejectHunk is provided', () => {
      const onRejectHunk = vi.fn();
      const diff = makeFileDiff({ hunks: [makeHunk()] });
      render(<CodeLabDiffViewer diff={diff} onRejectHunk={onRejectHunk} />);
      expect(screen.getByText(/Reject/)).toBeInTheDocument();
    });

    it('should call onAcceptHunk with the hunk index when Accept is clicked', () => {
      const onAcceptHunk = vi.fn();
      const diff = makeFileDiff({ hunks: [makeHunk()] });
      render(<CodeLabDiffViewer diff={diff} onAcceptHunk={onAcceptHunk} />);

      fireEvent.click(screen.getByText(/Accept/));
      expect(onAcceptHunk).toHaveBeenCalledWith(0);
    });

    it('should call onRejectHunk with the hunk index when Reject is clicked', () => {
      const onRejectHunk = vi.fn();
      const diff = makeFileDiff({ hunks: [makeHunk()] });
      render(<CodeLabDiffViewer diff={diff} onRejectHunk={onRejectHunk} />);

      fireEvent.click(screen.getByText(/Reject/));
      expect(onRejectHunk).toHaveBeenCalledWith(0);
    });

    it('should not toggle the hunk when clicking Accept (stopPropagation)', () => {
      const onAcceptHunk = vi.fn();
      const diff = makeFileDiff({ hunks: [makeHunk()] });
      render(<CodeLabDiffViewer diff={diff} onAcceptHunk={onAcceptHunk} />);

      expect(screen.getByText('\u25BC')).toBeInTheDocument();
      fireEvent.click(screen.getByText(/Accept/));
      expect(screen.getByText('\u25BC')).toBeInTheDocument();
    });

    it('should not toggle the hunk when clicking Reject (stopPropagation)', () => {
      const onRejectHunk = vi.fn();
      const diff = makeFileDiff({ hunks: [makeHunk()] });
      render(<CodeLabDiffViewer diff={diff} onRejectHunk={onRejectHunk} />);

      expect(screen.getByText('\u25BC')).toBeInTheDocument();
      fireEvent.click(screen.getByText(/Reject/));
      expect(screen.getByText('\u25BC')).toBeInTheDocument();
    });

    it('should pass the correct index for the second hunk', () => {
      const onAcceptHunk = vi.fn();
      const diff = makeFileDiff({
        hunks: [makeHunk(), makeHunk({ oldStart: 20, newStart: 20 })],
      });
      render(<CodeLabDiffViewer diff={diff} onAcceptHunk={onAcceptHunk} />);

      // Expand the second hunk first
      const secondHeader = screen.getByText('@@ -20,3 +20,4 @@').closest('.hunk-header');
      fireEvent.click(secondHeader);

      const acceptButtons = screen.getAllByText(/Accept/);
      fireEvent.click(acceptButtons[1]);
      expect(onAcceptHunk).toHaveBeenCalledWith(1);
    });
  });

  describe('Split view', () => {
    it('should render split view by default', () => {
      const hunk = makeHunk();
      const diff = makeFileDiff({ hunks: [hunk] });
      const { container } = render(<CodeLabDiffViewer diff={diff} />);
      expect(container.querySelector('.split-view')).toBeInTheDocument();
    });

    it('should render left and right sides in split view', () => {
      const hunk = makeHunk();
      const diff = makeFileDiff({ hunks: [hunk] });
      const { container } = render(<CodeLabDiffViewer diff={diff} />);
      expect(container.querySelector('.split-side.left')).toBeInTheDocument();
      expect(container.querySelector('.split-side.right')).toBeInTheDocument();
    });

    it('should display unchanged lines on both sides', () => {
      const hunk = makeHunk({
        lines: [{ type: 'unchanged', content: 'same line', oldLineNum: 1, newLineNum: 1 }],
      });
      const diff = makeFileDiff({ hunks: [hunk] });
      render(<CodeLabDiffViewer diff={diff} />);
      const matches = screen.getAllByText('same line');
      expect(matches).toHaveLength(2);
    });

    it('should display removed lines on the left side', () => {
      const hunk = makeHunk({
        lines: [{ type: 'removed', content: 'deleted content', oldLineNum: 1 }],
      });
      const diff = makeFileDiff({ hunks: [hunk] });
      const { container } = render(<CodeLabDiffViewer diff={diff} />);
      const leftSide = container.querySelector('.split-side.left');
      expect(within(leftSide).getByText('deleted content')).toBeInTheDocument();
    });

    it('should display added lines on the right side', () => {
      const hunk = makeHunk({
        lines: [{ type: 'added', content: 'new content', newLineNum: 1 }],
      });
      const diff = makeFileDiff({ hunks: [hunk] });
      const { container } = render(<CodeLabDiffViewer diff={diff} />);
      const rightSide = container.querySelector('.split-side.right');
      expect(within(rightSide).getByText('new content')).toBeInTheDocument();
    });

    it('should pair removed+added lines side by side', () => {
      const hunk = makeHunk({
        lines: [
          { type: 'removed', content: 'old val', oldLineNum: 1 },
          { type: 'added', content: 'new val', newLineNum: 1 },
        ],
      });
      const diff = makeFileDiff({ hunks: [hunk] });
      const { container } = render(<CodeLabDiffViewer diff={diff} />);
      const leftSide = container.querySelector('.split-side.left');
      const rightSide = container.querySelector('.split-side.right');
      expect(within(leftSide).getByText('old val')).toBeInTheDocument();
      expect(within(rightSide).getByText('new val')).toBeInTheDocument();
    });

    it('should pad with empty lines when more removed than added', () => {
      const hunk = makeHunk({
        lines: [
          { type: 'removed', content: 'line1', oldLineNum: 1 },
          { type: 'removed', content: 'line2', oldLineNum: 2 },
          { type: 'added', content: 'replacement', newLineNum: 1 },
        ],
      });
      const diff = makeFileDiff({ hunks: [hunk] });
      const { container } = render(<CodeLabDiffViewer diff={diff} />);
      const rightLines = container.querySelectorAll('.split-side.right .diff-line');
      expect(rightLines).toHaveLength(2);
      expect(rightLines[1]).toHaveClass('empty');
    });
  });

  describe('Unified view', () => {
    it('should render unified view when mode is unified', () => {
      const hunk = makeHunk();
      const diff = makeFileDiff({ hunks: [hunk] });
      const { container } = render(<CodeLabDiffViewer diff={diff} viewMode="unified" />);
      expect(container.querySelector('.unified-view')).toBeInTheDocument();
    });

    it('should show prefix "-" for removed lines in unified view', () => {
      const hunk = makeHunk({
        lines: [{ type: 'removed', content: 'gone', oldLineNum: 1 }],
      });
      const diff = makeFileDiff({ hunks: [hunk] });
      const { container } = render(<CodeLabDiffViewer diff={diff} viewMode="unified" />);
      const prefixes = container.querySelectorAll('.line-prefix');
      expect(prefixes[0].textContent).toBe('-');
    });

    it('should show prefix "+" for added lines in unified view', () => {
      const hunk = makeHunk({
        lines: [{ type: 'added', content: 'new', newLineNum: 1 }],
      });
      const diff = makeFileDiff({ hunks: [hunk] });
      const { container } = render(<CodeLabDiffViewer diff={diff} viewMode="unified" />);
      const prefixes = container.querySelectorAll('.line-prefix');
      expect(prefixes[0].textContent).toBe('+');
    });

    it('should show space prefix for unchanged lines in unified view', () => {
      const hunk = makeHunk({
        lines: [{ type: 'unchanged', content: 'same', oldLineNum: 1, newLineNum: 1 }],
      });
      const diff = makeFileDiff({ hunks: [hunk] });
      const { container } = render(<CodeLabDiffViewer diff={diff} viewMode="unified" />);
      const prefixes = container.querySelectorAll('.line-prefix');
      // The prefix for 'unchanged' is ' ' (a space character)
      expect(prefixes[0].textContent?.trim()).toBe('');
    });

    it('should display line content in unified view', () => {
      const hunk = makeHunk({
        lines: [
          { type: 'removed', content: 'old text', oldLineNum: 1 },
          { type: 'added', content: 'new text', newLineNum: 1 },
        ],
      });
      const diff = makeFileDiff({ hunks: [hunk] });
      render(<CodeLabDiffViewer diff={diff} viewMode="unified" />);
      expect(screen.getByText('old text')).toBeInTheDocument();
      expect(screen.getByText('new text')).toBeInTheDocument();
    });

    it('should render all lines sequentially in unified view', () => {
      const hunk = makeHunk({
        lines: [
          { type: 'unchanged', content: 'ctx1', oldLineNum: 1, newLineNum: 1 },
          { type: 'removed', content: 'rem', oldLineNum: 2 },
          { type: 'added', content: 'add', newLineNum: 2 },
          { type: 'unchanged', content: 'ctx2', oldLineNum: 3, newLineNum: 3 },
        ],
      });
      const diff = makeFileDiff({ hunks: [hunk] });
      const { container } = render(<CodeLabDiffViewer diff={diff} viewMode="unified" />);
      const diffLines = container.querySelectorAll('.unified-view .diff-line');
      expect(diffLines).toHaveLength(4);
    });
  });

  describe('Edge cases', () => {
    it('should render with no hunks without crashing', () => {
      const diff = makeFileDiff({ hunks: [] });
      const { container } = render(<CodeLabDiffViewer diff={diff} />);
      expect(container.querySelector('.diff-viewer')).toBeInTheDocument();
    });

    it('should render with empty className', () => {
      const diff = makeFileDiff();
      const { container } = render(<CodeLabDiffViewer diff={diff} className="" />);
      expect(container.querySelector('.diff-viewer')).toBeInTheDocument();
    });

    it('should handle hunk with only added lines in split view', () => {
      const hunk = makeHunk({
        lines: [
          { type: 'added', content: 'new1', newLineNum: 1 },
          { type: 'added', content: 'new2', newLineNum: 2 },
        ],
      });
      const diff = makeFileDiff({ hunks: [hunk] });
      const { container } = render(<CodeLabDiffViewer diff={diff} />);
      const leftLines = container.querySelectorAll('.split-side.left .diff-line');
      const rightLines = container.querySelectorAll('.split-side.right .diff-line');
      expect(leftLines).toHaveLength(2);
      expect(rightLines).toHaveLength(2);
      expect(leftLines[0]).toHaveClass('empty');
      expect(leftLines[1]).toHaveClass('empty');
    });

    it('should handle hunk with only removed lines in split view', () => {
      const hunk = makeHunk({
        lines: [
          { type: 'removed', content: 'old1', oldLineNum: 1 },
          { type: 'removed', content: 'old2', oldLineNum: 2 },
        ],
      });
      const diff = makeFileDiff({ hunks: [hunk] });
      const { container } = render(<CodeLabDiffViewer diff={diff} />);
      const leftLines = container.querySelectorAll('.split-side.left .diff-line');
      const rightLines = container.querySelectorAll('.split-side.right .diff-line');
      expect(leftLines).toHaveLength(2);
      expect(rightLines).toHaveLength(2);
      expect(rightLines[0]).toHaveClass('empty');
      expect(rightLines[1]).toHaveClass('empty');
    });

    it('should handle large addition and deletion counts', () => {
      const diff = makeFileDiff({ additions: 9999, deletions: 5555 });
      render(<CodeLabDiffViewer diff={diff} />);
      expect(screen.getByText('+9999')).toBeInTheDocument();
      expect(screen.getByText('-5555')).toBeInTheDocument();
    });
  });
});
