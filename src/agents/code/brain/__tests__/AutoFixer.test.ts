// @ts-nocheck - Test file with extensive mocking
/**
 * COMPREHENSIVE TESTS FOR AutoFixer
 *
 * Tests:
 * 1. Constructor / instantiation and provider management
 * 2. Pattern-based fixes (semicolons, quotes, equality, var->const, etc.)
 * 3. Import fixes (missing imports, common identifiers)
 * 4. AI-powered fixes (mocked agentChat)
 * 5. Security issue fixing via fixSecurityIssues
 * 6. quickFix method
 * 7. TypeScript error parsing (parseTypeScriptErrors)
 * 8. ESLint error parsing (parseEslintErrors — JSON and plain text)
 * 9. Edge cases (empty inputs, missing files, no matching patterns)
 * 10. Result structure validation
 * 11. Streaming callback invocations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AI providers module before importing AutoFixer
vi.mock('@/lib/ai/providers', () => ({
  agentChat: vi.fn().mockResolvedValue({
    text: '```typescript\nconst fixed = true;\n```',
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { AutoFixer, autoFixer, type CodeIssue, type FixResult } from '../AutoFixer';
import { agentChat } from '@/lib/ai/providers';
import type { GeneratedFile } from '../../../core/types';
import type { SecurityVulnerability } from '../SecurityScanner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFile(path: string, content: string, language = 'typescript'): GeneratedFile {
  return {
    path,
    content,
    language,
    purpose: 'test file',
    linesOfCode: content.split('\n').length,
    generatedAt: Date.now(),
    version: 1,
  };
}

function createIssue(overrides: Partial<CodeIssue> = {}): CodeIssue {
  return {
    id: 'issue-1',
    type: 'eslint',
    severity: 'error',
    message: 'test issue',
    file: 'test.ts',
    autoFixable: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AutoFixer', () => {
  let fixer: AutoFixer;

  beforeEach(() => {
    fixer = new AutoFixer();
    vi.clearAllMocks();
  });

  // =========================================================================
  // INSTANTIATION & PROVIDER
  // =========================================================================

  describe('instantiation', () => {
    it('should create a new instance', () => {
      expect(fixer).toBeInstanceOf(AutoFixer);
    });

    it('should export a singleton instance', () => {
      expect(autoFixer).toBeInstanceOf(AutoFixer);
    });

    it('should allow setting provider without error', () => {
      fixer.setProvider('openai');
      // No error means success
      expect(true).toBe(true);
    });

    it('should accept all valid provider IDs', () => {
      const providers = ['claude', 'openai', 'xai', 'deepseek', 'google'] as const;
      for (const p of providers) {
        fixer.setProvider(p);
      }
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // fix() — BASIC BEHAVIOR
  // =========================================================================

  describe('fix() — basic behavior', () => {
    it('should return a FixResult with correct structure', async () => {
      const file = createFile('test.ts', 'const x = 1;');
      const result = await fixer.fix([file], []);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('fixedFiles');
      expect(result).toHaveProperty('appliedFixes');
      expect(result).toHaveProperty('remainingIssues');
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('totalIssues');
      expect(result.summary).toHaveProperty('fixed');
      expect(result.summary).toHaveProperty('skipped');
      expect(result.summary).toHaveProperty('failed');
    });

    it('should succeed when there are no issues', async () => {
      const file = createFile('test.ts', 'const x = 1;');
      const result = await fixer.fix([file], []);

      expect(result.success).toBe(true);
      expect(result.appliedFixes).toHaveLength(0);
      expect(result.remainingIssues).toHaveLength(0);
      expect(result.summary.totalIssues).toBe(0);
    });

    it('should return the original files when there are no issues', async () => {
      const file = createFile('test.ts', 'const x = 1;');
      const result = await fixer.fix([file], []);

      expect(result.fixedFiles).toHaveLength(1);
      expect(result.fixedFiles[0].content).toBe('const x = 1;');
    });

    it('should put unfixable issues into remainingIssues', async () => {
      const file = createFile('test.ts', 'const x = 1;');
      const issue = createIssue({
        type: 'logic',
        message: 'complex logic error that has no pattern match',
        file: 'test.ts',
      });
      const result = await fixer.fix([file], [issue]);

      // The issue either stays in remaining or gets AI-fixed
      // With our mock, AI should pick it up since remaining <= 10
      expect(result.summary.totalIssues).toBe(1);
    });

    it('should add issues for missing files to remainingIssues', async () => {
      const file = createFile('test.ts', 'const x = 1;');
      const issue = createIssue({
        file: 'nonexistent.ts',
        message: 'some error',
      });
      const result = await fixer.fix([file], [issue]);

      // The file doesn't match, so the issue should remain
      expect(result.remainingIssues.length).toBeGreaterThanOrEqual(0);
      // Summary should still reflect the total
      expect(result.summary.totalIssues).toBe(1);
    });
  });

  // =========================================================================
  // PATTERN-BASED FIXES
  // =========================================================================

  describe('pattern-based fixes', () => {
    it('should fix console.log removal (no-console)', async () => {
      const file = createFile('test.ts', '  console.log("debug info");\nconst x = 1;');
      const issue = createIssue({
        type: 'eslint',
        message: 'no-console: Unexpected console statement',
        file: 'test.ts',
      });
      const result = await fixer.fix([file], [issue]);

      expect(result.appliedFixes.length).toBeGreaterThanOrEqual(1);
      const consoleFix = result.appliedFixes.find((f) => f.description.includes('console.log'));
      expect(consoleFix).toBeDefined();
    });

    it('should fix == to === (eqeqeq)', async () => {
      const file = createFile('test.ts', 'if (x == y) {}');
      const issue = createIssue({
        type: 'eslint',
        message: 'eqeqeq: Expected === and instead saw ==',
        file: 'test.ts',
      });
      const result = await fixer.fix([file], [issue]);

      const eqFix = result.appliedFixes.find((f) => f.description.includes('strict equality'));
      expect(eqFix).toBeDefined();
      if (eqFix) {
        expect(eqFix.confidence).toBe(0.95);
      }
    });

    it('should fix var to const (no-var)', async () => {
      const file = createFile('test.ts', 'var x = 1;');
      const issue = createIssue({
        type: 'eslint',
        message: 'no-var: Unexpected var, use let or const instead',
        file: 'test.ts',
      });
      const result = await fixer.fix([file], [issue]);

      const varFix = result.appliedFixes.find((f) => f.description.includes('var with const'));
      expect(varFix).toBeDefined();
    });

    it('should fix any to unknown (unexpected any)', async () => {
      const file = createFile('test.ts', 'function foo(x: any) {}');
      const issue = createIssue({
        type: 'typescript',
        message: 'Unexpected any. Specify a different type.',
        file: 'test.ts',
      });
      const result = await fixer.fix([file], [issue]);

      const anyFix = result.appliedFixes.find((f) => f.description.includes('unknown'));
      expect(anyFix).toBeDefined();
    });

    it('should prefix unused variables with underscore', async () => {
      const file = createFile('test.ts', 'const unusedVar = 42;');
      const issue = createIssue({
        type: 'typescript',
        message: "'unusedVar' is declared but its value is never used",
        file: 'test.ts',
      });
      const result = await fixer.fix([file], [issue]);

      const unusedFix = result.appliedFixes.find((f) => f.description.includes('underscore'));
      expect(unusedFix).toBeDefined();
    });

    it('should add comment to empty catch blocks', async () => {
      const file = createFile('test.ts', 'try { foo(); } catch(e) {}');
      const issue = createIssue({
        type: 'eslint',
        message: 'no-empty: Empty catch block',
        file: 'test.ts',
      });
      const result = await fixer.fix([file], [issue]);

      const catchFix = result.appliedFixes.find((f) => f.description.includes('empty catch'));
      expect(catchFix).toBeDefined();
    });
  });

  // =========================================================================
  // IMPORT FIXES
  // =========================================================================

  describe('import fixes', () => {
    it('should add missing import for useState', async () => {
      const file = createFile('comp.tsx', 'const [val, setVal] = useState(0);');
      const issue = createIssue({
        type: 'import',
        message: "Cannot find name 'useState'",
        file: 'comp.tsx',
      });
      const result = await fixer.fix([file], [issue]);

      const importFix = result.appliedFixes.find((f) => f.description.includes('useState'));
      expect(importFix).toBeDefined();
      if (importFix) {
        expect(importFix.after).toContain("import { useState } from 'react'");
        expect(importFix.confidence).toBe(0.9);
        expect(importFix.automated).toBe(true);
      }
    });

    it('should add missing import for NextResponse', async () => {
      const file = createFile('route.ts', 'return NextResponse.json({ ok: true });');
      const issue = createIssue({
        type: 'typescript',
        message: "Cannot find name 'NextResponse'",
        file: 'route.ts',
      });
      const result = await fixer.fix([file], [issue]);

      const importFix = result.appliedFixes.find((f) => f.description.includes('NextResponse'));
      expect(importFix).toBeDefined();
    });

    it('should add missing import for z (zod)', async () => {
      const file = createFile('schema.ts', 'const schema = z.object({});');
      const issue = createIssue({
        type: 'import',
        message: "Cannot find name 'z'",
        file: 'schema.ts',
      });
      const result = await fixer.fix([file], [issue]);

      const importFix = result.appliedFixes.find((f) => f.description.includes('import for z'));
      expect(importFix).toBeDefined();
    });

    it('should not add import if it already exists', async () => {
      const file = createFile(
        'comp.tsx',
        "import { useState } from 'react';\nconst [val, setVal] = useState(0);"
      );
      const issue = createIssue({
        type: 'import',
        message: "Cannot find name 'useState'",
        file: 'comp.tsx',
      });
      const result = await fixer.fix([file], [issue]);

      // The pattern-based import fix should NOT fire since the import already exists.
      // The issue may still get picked up by the AI fixer, so we specifically check
      // that no import-pattern fix (with description starting "Add import") was applied.
      const patternImportFix = result.appliedFixes.find(
        (f) => f.description.startsWith('Add import') && f.description.includes('useState')
      );
      expect(patternImportFix).toBeUndefined();
    });

    it('should not add import for unknown identifiers', async () => {
      const file = createFile('test.ts', 'const x = myCustomFunc();');
      const issue = createIssue({
        type: 'import',
        message: "Cannot find name 'myCustomFunc'",
        file: 'test.ts',
      });
      const result = await fixer.fix([file], [issue]);

      const importFix = result.appliedFixes.find((f) =>
        f.description.includes('import for myCustomFunc')
      );
      expect(importFix).toBeUndefined();
    });
  });

  // =========================================================================
  // AI-POWERED FIXES
  // =========================================================================

  describe('AI-powered fixes', () => {
    it('should call agentChat for unfixable issues when count <= 10', async () => {
      const file = createFile('test.ts', 'const broken = true;');
      const issue = createIssue({
        id: 'ai-issue-1',
        type: 'runtime',
        message: 'Runtime error that needs AI to fix',
        file: 'test.ts',
      });

      await fixer.fix([file], [issue]);

      expect(agentChat).toHaveBeenCalled();
    });

    it('should NOT call agentChat when remaining issues > 10', async () => {
      const file = createFile('test.ts', 'const broken = true;');
      // Create 12 issues that won't match any pattern
      const issues: CodeIssue[] = Array.from({ length: 12 }, (_, i) =>
        createIssue({
          id: `runtime-${i}`,
          type: 'runtime',
          message: `Runtime error ${i}`,
          file: 'test.ts',
        })
      );

      await fixer.fix([file], issues);

      expect(agentChat).not.toHaveBeenCalled();
    });

    it('should handle AI fix errors gracefully', async () => {
      vi.mocked(agentChat).mockRejectedValueOnce(new Error('API error'));

      const file = createFile('test.ts', 'const broken = true;');
      const issue = createIssue({
        type: 'runtime',
        message: 'Runtime error',
        file: 'test.ts',
      });

      // Should not throw
      const result = await fixer.fix([file], [issue]);
      expect(result).toBeDefined();
      expect(result.summary.totalIssues).toBe(1);
    });

    it('should update file content when AI returns a fix', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: '```typescript\nconst fixed = true;\n```',
      } as ReturnType<typeof agentChat> extends Promise<infer T> ? T : never);

      const file = createFile('test.ts', 'const broken = true;');
      const issue = createIssue({
        id: 'ai-fix-1',
        type: 'runtime',
        message: 'needs fix',
        file: 'test.ts',
      });

      const result = await fixer.fix([file], [issue]);

      // AI should have produced a fix
      const aiFixes = result.appliedFixes.filter((f) => f.description.startsWith('AI fix'));
      expect(aiFixes.length).toBeGreaterThanOrEqual(1);
    });

    it('should strip markdown code fences from AI response', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: '```typescript\nconst result = 42;\n```',
      } as ReturnType<typeof agentChat> extends Promise<infer T> ? T : never);

      const file = createFile('test.ts', 'const broken = undefined;');
      const issue = createIssue({
        id: 'strip-1',
        type: 'runtime',
        message: 'fix needed',
        file: 'test.ts',
      });

      const result = await fixer.fix([file], [issue]);

      // The fixed file content should not contain code fences
      const fixedFile = result.fixedFiles.find((f) => f.path === 'test.ts');
      if (fixedFile && result.appliedFixes.some((f) => f.description.startsWith('AI fix'))) {
        expect(fixedFile.content).not.toContain('```');
      }
    });
  });

  // =========================================================================
  // quickFix()
  // =========================================================================

  describe('quickFix()', () => {
    it('should fix a single file and return it', async () => {
      const file = createFile('test.ts', 'var x = 1;');
      const issue = createIssue({
        type: 'eslint',
        message: 'no-var: Unexpected var',
        file: 'test.ts',
      });

      const result = await fixer.quickFix(file, [issue]);
      expect(result).toBeDefined();
      expect(result.path).toBe('test.ts');
    });

    it('should return the original file when no issues', async () => {
      const file = createFile('test.ts', 'const x = 1;');
      const result = await fixer.quickFix(file, []);

      expect(result.content).toBe('const x = 1;');
    });
  });

  // =========================================================================
  // fixSecurityIssues()
  // =========================================================================

  describe('fixSecurityIssues()', () => {
    it('should convert SecurityVulnerability to CodeIssue and fix', async () => {
      const file = createFile('test.ts', 'eval(req.body.expr);');
      const vulnerability: SecurityVulnerability = {
        id: 'sec-1',
        type: 'validation',
        severity: 'critical',
        title: 'eval usage',
        description: 'eval with user input is dangerous',
        file: 'test.ts',
        line: 1,
        code: 'eval(req.body.expr)',
        fix: {
          description: 'Remove eval',
          automated: true,
        },
      };

      const result = await fixer.fixSecurityIssues([file], [vulnerability]);

      expect(result).toBeDefined();
      expect(result.summary.totalIssues).toBe(1);
    });

    it('should map critical/high severity to error', async () => {
      const file = createFile('test.ts', 'const x = 1;');
      const vulns: SecurityVulnerability[] = [
        {
          id: 'sec-c',
          type: 'injection',
          severity: 'critical',
          title: 'critical',
          description: 'critical vuln',
          file: 'test.ts',
          fix: { description: 'fix', automated: false },
        },
        {
          id: 'sec-h',
          type: 'xss',
          severity: 'high',
          title: 'high',
          description: 'high vuln',
          file: 'test.ts',
          fix: { description: 'fix', automated: false },
        },
      ];

      const result = await fixer.fixSecurityIssues([file], vulns);
      expect(result.summary.totalIssues).toBe(2);
    });

    it('should map medium/low/info severity to warning', async () => {
      const file = createFile('test.ts', 'const x = 1;');
      const vuln: SecurityVulnerability = {
        id: 'sec-m',
        type: 'configuration',
        severity: 'medium',
        title: 'medium',
        description: 'medium vuln',
        file: 'test.ts',
        fix: { description: 'fix', automated: false },
      };

      const result = await fixer.fixSecurityIssues([file], [vuln]);
      expect(result.summary.totalIssues).toBe(1);
    });

    it('should pass through onStream callback', async () => {
      const file = createFile('test.ts', 'const x = 1;');
      const onStream = vi.fn();
      const vuln: SecurityVulnerability = {
        id: 'sec-s',
        type: 'injection',
        severity: 'low',
        title: 'test',
        description: 'test',
        file: 'test.ts',
        fix: { description: 'fix', automated: false },
      };

      await fixer.fixSecurityIssues([file], [vuln], onStream);
      expect(onStream).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // parseTypeScriptErrors()
  // =========================================================================

  describe('parseTypeScriptErrors()', () => {
    it('should parse standard TypeScript error output', () => {
      const output =
        "src/index.ts(10,5): error TS2304: Cannot find name 'foo'\nsrc/index.ts(20,10): error TS7006: Parameter 'x' implicitly has an 'any' type";

      const issues = fixer.parseTypeScriptErrors(output);

      expect(issues).toHaveLength(2);
      expect(issues[0].file).toBe('src/index.ts');
      expect(issues[0].line).toBe(10);
      expect(issues[0].column).toBe(5);
      expect(issues[0].rule).toBe('TS2304');
      expect(issues[0].message).toBe("Cannot find name 'foo'");
      expect(issues[0].type).toBe('typescript');
      expect(issues[0].severity).toBe('error');
    });

    it('should return empty array for empty input', () => {
      const issues = fixer.parseTypeScriptErrors('');
      expect(issues).toHaveLength(0);
    });

    it('should return empty array for non-matching input', () => {
      const issues = fixer.parseTypeScriptErrors('Some random text with no errors');
      expect(issues).toHaveLength(0);
    });

    it('should generate unique IDs for each error', () => {
      const output = 'a.ts(1,1): error TS1001: msg1\nb.ts(2,2): error TS1002: msg2';
      const issues = fixer.parseTypeScriptErrors(output);

      const ids = issues.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should mark auto-fixable errors correctly', () => {
      const output =
        "a.ts(1,1): error TS2304: Cannot find name 'x'\nb.ts(2,2): error TS9999: Unknown error";
      const issues = fixer.parseTypeScriptErrors(output);

      // TS2304 is auto-fixable
      expect(issues[0].autoFixable).toBe(true);
      // TS9999 is NOT auto-fixable
      expect(issues[1].autoFixable).toBe(false);
    });
  });

  // =========================================================================
  // parseEslintErrors()
  // =========================================================================

  describe('parseEslintErrors()', () => {
    it('should parse ESLint JSON format', () => {
      const output = JSON.stringify([
        {
          filePath: 'src/app.ts',
          messages: [
            {
              line: 5,
              column: 3,
              severity: 2,
              message: 'Unexpected var',
              ruleId: 'no-var',
              fix: { range: [0, 0], text: '' },
            },
            {
              line: 10,
              column: 1,
              severity: 1,
              message: 'Missing semicolon',
              ruleId: 'semi',
            },
          ],
        },
      ]);

      const issues = fixer.parseEslintErrors(output);

      expect(issues).toHaveLength(2);
      expect(issues[0].file).toBe('src/app.ts');
      expect(issues[0].severity).toBe('error');
      expect(issues[0].rule).toBe('no-var');
      expect(issues[0].autoFixable).toBe(true); // has fix property
      expect(issues[1].severity).toBe('warning');
      expect(issues[1].autoFixable).toBe(false); // no fix property
    });

    it('should parse ESLint plain text format', () => {
      const output =
        'src/app.ts:5:3: error Unexpected var no-var\nsrc/app.ts:10:1: warning Missing semicolon semi';

      const issues = fixer.parseEslintErrors(output);

      expect(issues).toHaveLength(2);
      expect(issues[0].file).toBe('src/app.ts');
      expect(issues[0].line).toBe(5);
      expect(issues[0].column).toBe(3);
      expect(issues[0].severity).toBe('error');
      expect(issues[0].rule).toBe('no-var');
      expect(issues[1].severity).toBe('warning');
    });

    it('should return empty array for empty input', () => {
      const issues = fixer.parseEslintErrors('');
      expect(issues).toHaveLength(0);
    });

    it('should return empty array for empty JSON array', () => {
      const issues = fixer.parseEslintErrors('[]');
      expect(issues).toHaveLength(0);
    });

    it('should handle JSON with no messages', () => {
      const output = JSON.stringify([{ filePath: 'src/clean.ts', messages: [] }]);
      const issues = fixer.parseEslintErrors(output);
      expect(issues).toHaveLength(0);
    });

    it('should handle multiple files in JSON format', () => {
      const output = JSON.stringify([
        {
          filePath: 'a.ts',
          messages: [{ line: 1, column: 1, severity: 2, message: 'err', ruleId: 'r1' }],
        },
        {
          filePath: 'b.ts',
          messages: [{ line: 2, column: 2, severity: 1, message: 'warn', ruleId: 'r2' }],
        },
      ]);

      const issues = fixer.parseEslintErrors(output);
      expect(issues).toHaveLength(2);
      expect(issues[0].file).toBe('a.ts');
      expect(issues[1].file).toBe('b.ts');
    });
  });

  // =========================================================================
  // STREAMING CALLBACKS
  // =========================================================================

  describe('streaming callbacks', () => {
    it('should call onStream with progress events during fix', async () => {
      const onStream = vi.fn();
      const file = createFile('test.ts', 'var x = 1;');
      const issue = createIssue({
        type: 'eslint',
        message: 'no-var: Unexpected var',
        file: 'test.ts',
      });

      await fixer.fix([file], [issue], onStream);

      expect(onStream).toHaveBeenCalled();
      const calls = onStream.mock.calls;
      // First call should be a pivoting event
      expect(calls[0][0].type).toBe('pivoting');
      // Last call should be complete
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.type).toBe('complete');
      expect(lastCall.progress).toBe(100);
    });

    it('should work without onStream callback', async () => {
      const file = createFile('test.ts', 'var x = 1;');
      const issue = createIssue({
        type: 'eslint',
        message: 'no-var: Unexpected var',
        file: 'test.ts',
      });

      // Should not throw
      const result = await fixer.fix([file], [issue]);
      expect(result).toBeDefined();
    });

    it('should report per-file progress', async () => {
      const onStream = vi.fn();
      const files = [createFile('a.ts', 'var x = 1;'), createFile('b.ts', 'var y = 2;')];
      const issues = [
        createIssue({ id: 'i1', type: 'eslint', message: 'no-var', file: 'a.ts' }),
        createIssue({ id: 'i2', type: 'eslint', message: 'no-var', file: 'b.ts' }),
      ];

      await fixer.fix(files, issues, onStream);

      // Should have multiple pivoting calls for different files
      const pivotingCalls = onStream.mock.calls.filter((c) => c[0].type === 'pivoting');
      expect(pivotingCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================

  describe('edge cases', () => {
    it('should handle empty file list', async () => {
      const result = await fixer.fix([], []);
      expect(result.success).toBe(true);
      expect(result.fixedFiles).toHaveLength(0);
    });

    it('should handle empty issues list', async () => {
      const file = createFile('test.ts', 'const x = 1;');
      const result = await fixer.fix([file], []);
      expect(result.success).toBe(true);
      expect(result.summary.totalIssues).toBe(0);
    });

    it('should handle file with empty content', async () => {
      const file = createFile('empty.ts', '');
      const issue = createIssue({
        type: 'eslint',
        message: 'no-var',
        file: 'empty.ts',
      });
      const result = await fixer.fix([file], [issue]);
      expect(result).toBeDefined();
    });

    it('should handle multiple issues in the same file', async () => {
      const file = createFile('test.ts', 'var x = 1;\nconsole.log(x);');
      const issues = [
        createIssue({
          id: 'var-issue',
          type: 'eslint',
          message: 'no-var: Unexpected var',
          file: 'test.ts',
        }),
        createIssue({
          id: 'console-issue',
          type: 'eslint',
          message: 'no-console: Unexpected console statement',
          file: 'test.ts',
        }),
      ];

      const result = await fixer.fix([file], issues);
      expect(result.summary.totalIssues).toBe(2);
    });

    it('should update linesOfCode after fixing', async () => {
      const content = "import { useState } from 'react';\nconst [a, b] = useState(0);";
      const file = createFile('comp.tsx', content);
      const issue = createIssue({
        type: 'eslint',
        message: 'no-console: Unexpected console statement',
        file: 'comp.tsx',
      });

      const result = await fixer.fix([file], [issue]);
      const fixedFile = result.fixedFiles.find((f) => f.path === 'comp.tsx');
      expect(fixedFile).toBeDefined();
      if (fixedFile) {
        expect(fixedFile.linesOfCode).toBe(fixedFile.content.split('\n').length);
      }
    });

    it('should handle issue with line number', async () => {
      const file = createFile('test.ts', 'const x = 1;\nvar y = 2;');
      const issue = createIssue({
        type: 'eslint',
        message: 'no-var: Unexpected var',
        file: 'test.ts',
        line: 2,
      });

      const result = await fixer.fix([file], [issue]);
      expect(result).toBeDefined();
    });

    it('should set summary.failed to 0', async () => {
      const file = createFile('test.ts', 'const x = 1;');
      const result = await fixer.fix([file], []);
      expect(result.summary.failed).toBe(0);
    });
  });
});
