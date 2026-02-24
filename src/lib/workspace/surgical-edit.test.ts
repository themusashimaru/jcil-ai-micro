import { describe, it, expect, vi } from 'vitest';
import {
  surgicalEdit,
  createLineEdit,
  createInsertAfter,
  createDeleteLines,
  createReplaceRange,
  formatDiffForDisplay,
  generateUnifiedDiff,
} from './surgical-edit';

// Mock logger and backup-service
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./backup-service', () => ({
  storeBackup: vi.fn().mockResolvedValue({}),
}));

const sampleFile = `line 1
line 2
line 3
line 4
line 5`;

// -------------------------------------------------------------------
// surgicalEdit
// -------------------------------------------------------------------
describe('surgicalEdit', () => {
  it('should replace a single line', async () => {
    const readFile = vi.fn().mockResolvedValue(sampleFile);
    const writeFile = vi.fn();

    const result = await surgicalEdit(
      {
        filePath: 'test.ts',
        edits: [{ startLine: 2, endLine: 2, newContent: 'modified line 2' }],
        createBackup: false,
      },
      readFile,
      writeFile
    );

    expect(result.success).toBe(true);
    expect(result.newContent).toContain('modified line 2');
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it('should replace a range of lines', async () => {
    const readFile = vi.fn().mockResolvedValue(sampleFile);
    const writeFile = vi.fn();

    const result = await surgicalEdit(
      {
        filePath: 'test.ts',
        edits: [{ startLine: 2, endLine: 4, newContent: 'new combined line' }],
        createBackup: false,
      },
      readFile,
      writeFile
    );

    expect(result.success).toBe(true);
    const newLines = result.newContent!.split('\n');
    expect(newLines).toHaveLength(3); // 5 - 3 + 1 = 3
  });

  it('should handle multiple edits', async () => {
    const readFile = vi.fn().mockResolvedValue(sampleFile);
    const writeFile = vi.fn();

    const result = await surgicalEdit(
      {
        filePath: 'test.ts',
        edits: [
          { startLine: 1, endLine: 1, newContent: 'first' },
          { startLine: 5, endLine: 5, newContent: 'last' },
        ],
        createBackup: false,
      },
      readFile,
      writeFile
    );

    expect(result.success).toBe(true);
    expect(result.newContent).toContain('first');
    expect(result.newContent).toContain('last');
  });

  it('should support dry run', async () => {
    const readFile = vi.fn().mockResolvedValue(sampleFile);
    const writeFile = vi.fn();

    const result = await surgicalEdit(
      {
        filePath: 'test.ts',
        edits: [{ startLine: 1, endLine: 1, newContent: 'changed' }],
        dryRun: true,
        createBackup: false,
      },
      readFile,
      writeFile
    );

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('should reject invalid startLine', async () => {
    const readFile = vi.fn().mockResolvedValue(sampleFile);
    const writeFile = vi.fn();

    const result = await surgicalEdit(
      {
        filePath: 'test.ts',
        edits: [{ startLine: 0, endLine: 1, newContent: 'bad' }],
        createBackup: false,
      },
      readFile,
      writeFile
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid edits');
  });

  it('should reject startLine > endLine', async () => {
    const readFile = vi.fn().mockResolvedValue(sampleFile);
    const writeFile = vi.fn();

    const result = await surgicalEdit(
      {
        filePath: 'test.ts',
        edits: [{ startLine: 5, endLine: 3, newContent: 'bad' }],
        createBackup: false,
      },
      readFile,
      writeFile
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid edits');
  });

  it('should reject overlapping edits', async () => {
    const readFile = vi.fn().mockResolvedValue(sampleFile);
    const writeFile = vi.fn();

    const result = await surgicalEdit(
      {
        filePath: 'test.ts',
        edits: [
          { startLine: 1, endLine: 3, newContent: 'a' },
          { startLine: 2, endLine: 4, newContent: 'b' },
        ],
        createBackup: false,
      },
      readFile,
      writeFile
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Overlapping');
  });

  it('should handle empty file', async () => {
    const readFile = vi.fn().mockRejectedValue(new Error('ENOENT'));
    const writeFile = vi.fn();

    const result = await surgicalEdit(
      {
        filePath: 'new.ts',
        edits: [{ startLine: 1, endLine: 1, newContent: 'first line' }],
        createBackup: false,
      },
      readFile,
      writeFile
    );

    expect(result.success).toBe(true);
    expect(result.newContent).toContain('first line');
  });

  it('should delete lines with empty newContent', async () => {
    const readFile = vi.fn().mockResolvedValue(sampleFile);
    const writeFile = vi.fn();

    const result = await surgicalEdit(
      {
        filePath: 'test.ts',
        edits: [{ startLine: 2, endLine: 4, newContent: '' }],
        createBackup: false,
      },
      readFile,
      writeFile
    );

    expect(result.success).toBe(true);
    const newLines = result.newContent!.split('\n');
    expect(newLines).toHaveLength(2); // line 1 and line 5
  });

  it('should return diffs', async () => {
    const readFile = vi.fn().mockResolvedValue(sampleFile);
    const writeFile = vi.fn();

    const result = await surgicalEdit(
      {
        filePath: 'test.ts',
        edits: [{ startLine: 3, endLine: 3, newContent: 'CHANGED' }],
        createBackup: false,
      },
      readFile,
      writeFile
    );

    expect(result.success).toBe(true);
    expect(result.diffs.length).toBeGreaterThan(0);
  });

  it('should handle writeFile error', async () => {
    const readFile = vi.fn().mockResolvedValue(sampleFile);
    const writeFile = vi.fn().mockRejectedValue(new Error('disk full'));

    const result = await surgicalEdit(
      {
        filePath: 'test.ts',
        edits: [{ startLine: 1, endLine: 1, newContent: 'x' }],
        createBackup: false,
      },
      readFile,
      writeFile
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('disk full');
  });
});

// -------------------------------------------------------------------
// createLineEdit
// -------------------------------------------------------------------
describe('createLineEdit', () => {
  it('should create a single-line edit', () => {
    const edit = createLineEdit(5, 'new content', 'fix bug');
    expect(edit.startLine).toBe(5);
    expect(edit.endLine).toBe(5);
    expect(edit.newContent).toBe('new content');
    expect(edit.description).toBe('fix bug');
  });
});

// -------------------------------------------------------------------
// createInsertAfter
// -------------------------------------------------------------------
describe('createInsertAfter', () => {
  it('should create an insertion edit', () => {
    const edit = createInsertAfter(3, 'inserted line');
    expect(edit.startLine).toBe(4);
    expect(edit.endLine).toBe(3);
    expect(edit.newContent).toBe('inserted line');
  });
});

// -------------------------------------------------------------------
// createDeleteLines
// -------------------------------------------------------------------
describe('createDeleteLines', () => {
  it('should create a deletion edit', () => {
    const edit = createDeleteLines(2, 4, 'remove imports');
    expect(edit.startLine).toBe(2);
    expect(edit.endLine).toBe(4);
    expect(edit.newContent).toBe('');
    expect(edit.description).toBe('remove imports');
  });
});

// -------------------------------------------------------------------
// createReplaceRange
// -------------------------------------------------------------------
describe('createReplaceRange', () => {
  it('should create a range replacement edit', () => {
    const edit = createReplaceRange(1, 3, 'replaced\ncontent');
    expect(edit.startLine).toBe(1);
    expect(edit.endLine).toBe(3);
    expect(edit.newContent).toBe('replaced\ncontent');
  });
});

// -------------------------------------------------------------------
// formatDiffForDisplay
// -------------------------------------------------------------------
describe('formatDiffForDisplay', () => {
  it('should format add diffs', () => {
    const result = formatDiffForDisplay([{ lineNumber: 5, type: 'add', newContent: 'new' }]);
    expect(result).toContain('+ 5: new');
  });

  it('should format remove diffs', () => {
    const result = formatDiffForDisplay([{ lineNumber: 3, type: 'remove', oldContent: 'old' }]);
    expect(result).toContain('- 3: old');
  });

  it('should format modify diffs', () => {
    const result = formatDiffForDisplay([
      { lineNumber: 2, type: 'modify', oldContent: 'old', newContent: 'new' },
    ]);
    expect(result).toContain('- 2: old');
    expect(result).toContain('+ 2: new');
  });

  it('should handle empty diffs', () => {
    expect(formatDiffForDisplay([])).toBe('');
  });
});

// -------------------------------------------------------------------
// generateUnifiedDiff
// -------------------------------------------------------------------
describe('generateUnifiedDiff', () => {
  it('should generate diff header', () => {
    const result = generateUnifiedDiff('test.ts', 'a', 'b');
    expect(result).toContain('--- a/test.ts');
    expect(result).toContain('+++ b/test.ts');
  });

  it('should show unchanged lines with space prefix', () => {
    const result = generateUnifiedDiff('test.ts', 'same\nline', 'same\nline');
    expect(result).toContain(' same');
    expect(result).toContain(' line');
  });

  it('should show added lines with + prefix', () => {
    const result = generateUnifiedDiff('test.ts', 'a', 'a\nb');
    expect(result).toContain('+b');
  });

  it('should show removed lines with - prefix', () => {
    const result = generateUnifiedDiff('test.ts', 'a\nb', 'a');
    expect(result).toContain('-b');
  });

  it('should show modified lines', () => {
    const result = generateUnifiedDiff('test.ts', 'old', 'new');
    expect(result).toContain('-old');
    expect(result).toContain('+new');
  });
});
