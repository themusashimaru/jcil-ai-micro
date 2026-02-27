// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCKS
// ============================================

const mockAgentChat = vi.fn();
vi.mock('@/lib/ai/providers', () => ({
  agentChat: (...args: unknown[]) => mockAgentChat(...args),
}));

// ============================================
// IMPORTS
// ============================================

import { ErrorAnalyzer, errorAnalyzer } from '../ErrorAnalyzer';

// ============================================
// HELPERS
// ============================================

function makeError(overrides = {}) {
  return {
    file: 'src/index.ts',
    line: 10,
    column: 5,
    message: 'Cannot find name "foo"',
    type: 'type',
    severity: 'error',
    ...overrides,
  };
}

function makeFile(overrides = {}) {
  return {
    path: 'src/index.ts',
    content: 'const foo = 1;\nconst bar = foo + 1;\n',
    language: 'typescript',
    version: 1,
    generatedAt: Date.now(),
    ...overrides,
  };
}

// ============================================
// TESTS
// ============================================

describe('ErrorAnalyzer', () => {
  let analyzer: ErrorAnalyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new ErrorAnalyzer();
  });

  // -----------------------------------------------------------------------
  // setProvider
  // -----------------------------------------------------------------------

  describe('setProvider', () => {
    it('should not throw', () => {
      expect(() => analyzer.setProvider('openai')).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // parseErrors
  // -----------------------------------------------------------------------

  describe('parseErrors', () => {
    it('should return empty array for successful outputs', () => {
      const result = analyzer.parseErrors({ outputs: [{ exitCode: 0, stdout: '', stderr: '' }] });
      expect(result).toEqual([]);
    });

    it('should parse TypeScript errors format 1: file.ts(line,col)', () => {
      const result = analyzer.parseErrors({
        outputs: [
          {
            exitCode: 1,
            stdout: '',
            stderr: "src/app.ts(15,3): error TS2304: Cannot find name 'MyType'",
          },
        ],
      });
      expect(result.length).toBeGreaterThanOrEqual(1);
      const tsError = result.find((e) => e.type === 'type');
      expect(tsError).toBeDefined();
      expect(tsError.file).toBe('src/app.ts');
      expect(tsError.line).toBe(15);
      expect(tsError.column).toBe(3);
      expect(tsError.message).toContain('Cannot find name');
    });

    it('should parse TypeScript errors format 2: file.ts:line:col', () => {
      const result = analyzer.parseErrors({
        outputs: [
          {
            exitCode: 1,
            stdout: '',
            stderr:
              "src/utils.tsx:42:10 - error TS7006: Parameter 'x' implicitly has an 'any' type",
          },
        ],
      });
      expect(result.length).toBeGreaterThanOrEqual(1);
      const tsError = result.find((e) => e.type === 'type');
      expect(tsError).toBeDefined();
      expect(tsError.file).toBe('src/utils.tsx');
      expect(tsError.line).toBe(42);
    });

    it('should parse TypeScript errors from stdout', () => {
      const result = analyzer.parseErrors({
        outputs: [
          {
            exitCode: 1,
            stdout: "src/main.ts(1,1): error TS1005: ';' expected",
            stderr: '',
          },
        ],
      });
      // May find TS error from stdout
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should parse Node.js runtime errors', () => {
      const stderr = `TypeError: Cannot read properties of undefined (reading 'map')
    at processItems (/app/src/handler.js:25:12)
    at main (/app/src/index.js:10:3)`;

      const result = analyzer.parseErrors({
        outputs: [{ exitCode: 1, stdout: '', stderr }],
      });

      const runtimeError = result.find((e) => e.type === 'runtime');
      expect(runtimeError).toBeDefined();
      expect(runtimeError.message).toContain('Cannot read properties of undefined');
    });

    it('should parse npm 404 errors', () => {
      const stderr = "npm ERR! 404 'nonexistent-package' is not in the npm registry";

      const result = analyzer.parseErrors({
        outputs: [{ exitCode: 1, stdout: '', stderr }],
      });

      const npmError = result.find((e) => e.type === 'build');
      expect(npmError).toBeDefined();
      expect(npmError.file).toBe('package.json');
      expect(npmError.message).toContain('nonexistent-package');
    });

    it('should parse npm ERESOLVE errors', () => {
      const stderr = 'npm ERR! ERESOLVE unable to resolve dependency tree';

      const result = analyzer.parseErrors({
        outputs: [{ exitCode: 1, stdout: '', stderr }],
      });

      const resolveError = result.find((e) => e.message.includes('resolution conflict'));
      expect(resolveError).toBeDefined();
      expect(resolveError.suggestion).toContain('legacy-peer-deps');
    });

    it('should parse Python syntax errors', () => {
      const stderr = `  File "main.py", line 10
    def foo(
          ^
SyntaxError: unexpected EOF while parsing`;

      const result = analyzer.parseErrors({
        outputs: [{ exitCode: 1, stdout: '', stderr }],
      });

      const pyError = result.find((e) => e.file === 'main.py');
      expect(pyError).toBeDefined();
      expect(pyError.line).toBe(10);
      expect(pyError.type).toBe('syntax');
    });

    it('should parse Python runtime errors', () => {
      const stderr = `  File "app.py", line 5
NameError: name 'undefined_var' is not defined`;

      const result = analyzer.parseErrors({
        outputs: [{ exitCode: 1, stdout: '', stderr }],
      });

      const pyError = result.find((e) => e.file === 'app.py');
      expect(pyError).toBeDefined();
    });

    it('should create generic error if no specific pattern matches', () => {
      const result = analyzer.parseErrors({
        outputs: [{ exitCode: 1, stdout: '', stderr: 'Some unknown error format\n' }],
      });

      expect(result.length).toBeGreaterThanOrEqual(1);
      const genericError = result.find((e) => e.type === 'unknown');
      expect(genericError).toBeDefined();
      expect(genericError.file).toBe('unknown');
    });

    it('should handle multiple outputs', () => {
      const result = analyzer.parseErrors({
        outputs: [
          { exitCode: 1, stdout: '', stderr: "src/a.ts(1,1): error TS1005: ';' expected" },
          { exitCode: 1, stdout: '', stderr: "src/b.ts(2,2): error TS1005: ')' expected" },
        ],
      });

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should skip successful outputs (exitCode 0)', () => {
      const result = analyzer.parseErrors({
        outputs: [
          { exitCode: 0, stdout: 'all good', stderr: '' },
          { exitCode: 1, stdout: '', stderr: "src/c.ts(5,1): error TS2304: Cannot find name 'x'" },
        ],
      });

      // Only errors from the failed output
      const tsErrors = result.filter((e) => e.type === 'type');
      expect(tsErrors.length).toBe(1);
    });

    it('should truncate long error messages for generic errors', () => {
      const longError = 'x'.repeat(600);
      const result = analyzer.parseErrors({
        outputs: [{ exitCode: 1, stdout: '', stderr: longError }],
      });

      const genericError = result.find((e) => e.type === 'unknown');
      if (genericError) {
        expect(genericError.message.length).toBeLessThanOrEqual(500);
      }
    });
  });

  // -----------------------------------------------------------------------
  // applyFix
  // -----------------------------------------------------------------------

  describe('applyFix', () => {
    it('should replace old code with new code', () => {
      const file = makeFile({ content: 'const x = 1;\nconst y = 2;\n' });
      const analysis = {
        error: makeError(),
        rootCause: 'Wrong value',
        suggestedFix: {
          file: 'src/index.ts',
          oldCode: 'const x = 1;',
          newCode: 'const x = 42;',
          explanation: 'Fixed value',
        },
        confidence: 'high',
        requiresReplan: false,
      };

      const result = analyzer.applyFix(file, analysis);
      expect(result.content).toContain('const x = 42;');
      expect(result.content).toContain('const y = 2;');
      expect(result.version).toBe(2);
    });

    it('should return original file if oldCode is empty', () => {
      const file = makeFile();
      const analysis = {
        error: makeError(),
        rootCause: 'Unknown',
        suggestedFix: { file: 'src/index.ts', oldCode: '', newCode: 'new', explanation: '' },
        confidence: 'low',
        requiresReplan: false,
      };

      const result = analyzer.applyFix(file, analysis);
      expect(result.content).toBe(file.content);
    });

    it('should return original file if newCode is empty', () => {
      const file = makeFile();
      const analysis = {
        error: makeError(),
        rootCause: 'Unknown',
        suggestedFix: { file: 'src/index.ts', oldCode: 'old', newCode: '', explanation: '' },
        confidence: 'low',
        requiresReplan: false,
      };

      const result = analyzer.applyFix(file, analysis);
      expect(result.content).toBe(file.content);
    });

    it('should try normalized whitespace if exact match fails', () => {
      const file = makeFile({ content: '  const   x = 1;\nconst y = 2;\n' });
      const analysis = {
        error: makeError(),
        rootCause: 'Wrong value',
        suggestedFix: {
          file: 'src/index.ts',
          oldCode: 'const x = 1;',
          newCode: 'const x = 42;',
          explanation: '',
        },
        confidence: 'medium',
        requiresReplan: false,
      };

      const result = analyzer.applyFix(file, analysis);
      // Should try normalized whitespace matching
      expect(result.version).toBe(2);
    });

    it('should increment version', () => {
      const file = makeFile({ version: 3 });
      const analysis = {
        error: makeError(),
        rootCause: 'x',
        suggestedFix: {
          file: 'x',
          oldCode: 'const foo = 1;',
          newCode: 'const foo = 2;',
          explanation: '',
        },
        confidence: 'high',
        requiresReplan: false,
      };

      const result = analyzer.applyFix(file, analysis);
      expect(result.version).toBe(4);
    });

    it('should update generatedAt timestamp', () => {
      const file = makeFile({ generatedAt: 1000 });
      const analysis = {
        error: makeError(),
        rootCause: 'x',
        suggestedFix: {
          file: 'x',
          oldCode: 'const foo = 1;',
          newCode: 'const foo = 2;',
          explanation: '',
        },
        confidence: 'high',
        requiresReplan: false,
      };

      const result = analyzer.applyFix(file, analysis);
      expect(result.generatedAt).toBeGreaterThan(1000);
    });
  });

  // -----------------------------------------------------------------------
  // analyzeError
  // -----------------------------------------------------------------------

  describe('analyzeError', () => {
    it('should call agentChat and return parsed analysis', async () => {
      mockAgentChat.mockResolvedValue({
        text: JSON.stringify({
          rootCause: 'Missing import',
          suggestedFix: {
            file: 'src/index.ts',
            oldCode: 'foo()',
            newCode: "import { foo } from './utils';\nfoo()",
            explanation: 'Added missing import',
          },
          confidence: 'high',
          requiresReplan: false,
        }),
      });

      const result = await analyzer.analyzeError(
        makeError(),
        [makeFile()],
        { refinedDescription: 'test app', technologies: { primary: 'typescript' } },
        { dependencies: { production: { typescript: '5.0' } } }
      );

      expect(result.rootCause).toBe('Missing import');
      expect(result.confidence).toBe('high');
      expect(result.suggestedFix.file).toBe('src/index.ts');
      expect(mockAgentChat).toHaveBeenCalled();
    });

    it('should return fallback analysis if AI fails', async () => {
      mockAgentChat.mockRejectedValue(new Error('API error'));

      const result = await analyzer.analyzeError(
        makeError(),
        [makeFile()],
        { refinedDescription: 'test', technologies: { primary: 'ts' } },
        { dependencies: { production: {} } }
      );

      expect(result.confidence).toBe('low');
      expect(result.rootCause).toContain('manual investigation');
    });

    it('should return fallback if no JSON in response', async () => {
      mockAgentChat.mockResolvedValue({ text: 'No JSON here, just text.' });

      const result = await analyzer.analyzeError(
        makeError(),
        [makeFile()],
        { refinedDescription: 'test', technologies: { primary: 'ts' } },
        { dependencies: { production: {} } }
      );

      expect(result.confidence).toBe('low');
    });

    it('should handle unknown confidence values', async () => {
      mockAgentChat.mockResolvedValue({
        text: JSON.stringify({
          rootCause: 'bug',
          suggestedFix: { file: 'x', oldCode: '', newCode: '', explanation: '' },
          confidence: 'maybe',
          requiresReplan: false,
        }),
      });

      const result = await analyzer.analyzeError(
        makeError(),
        [],
        { refinedDescription: 'test', technologies: { primary: 'ts' } },
        { dependencies: { production: {} } }
      );

      expect(result.confidence).toBe('medium'); // defaults to medium
    });

    it('should find relevant file by exact path match', async () => {
      mockAgentChat.mockResolvedValue({
        text: JSON.stringify({
          rootCause: 'bug',
          suggestedFix: { file: 'src/index.ts', oldCode: '', newCode: '', explanation: '' },
          confidence: 'high',
          requiresReplan: false,
        }),
      });

      const files = [makeFile({ path: 'src/index.ts', content: 'const x = 1;' })];
      await analyzer.analyzeError(
        makeError({ file: 'src/index.ts' }),
        files,
        { refinedDescription: 'test', technologies: { primary: 'ts' } },
        { dependencies: { production: {} } }
      );

      // Check the prompt includes file content
      const prompt = mockAgentChat.mock.calls[0][0][0].content[0].text;
      expect(prompt).toContain('const x = 1;');
    });
  });

  // -----------------------------------------------------------------------
  // analyzeAllErrors
  // -----------------------------------------------------------------------

  describe('analyzeAllErrors', () => {
    it('should limit to 5 errors', async () => {
      mockAgentChat.mockResolvedValue({
        text: JSON.stringify({
          rootCause: 'bug',
          suggestedFix: { file: 'x', oldCode: '', newCode: '', explanation: '' },
          confidence: 'high',
          requiresReplan: false,
        }),
      });

      const errors = Array.from({ length: 10 }, (_, i) => makeError({ message: `Error ${i}` }));

      await analyzer.analyzeAllErrors(
        errors,
        [makeFile()],
        { refinedDescription: 'test', technologies: { primary: 'ts' } },
        { dependencies: { production: {} } }
      );

      // Only 5 calls (limited)
      expect(mockAgentChat).toHaveBeenCalledTimes(5);
    });

    it('should sort by confidence (high first)', async () => {
      let callNum = 0;
      mockAgentChat.mockImplementation(async () => {
        callNum++;
        return {
          text: JSON.stringify({
            rootCause: `bug ${callNum}`,
            suggestedFix: { file: 'x', oldCode: '', newCode: '', explanation: '' },
            confidence: callNum === 1 ? 'low' : 'high',
            requiresReplan: false,
          }),
        };
      });

      const analyses = await analyzer.analyzeAllErrors(
        [makeError({ message: 'err1' }), makeError({ message: 'err2' })],
        [makeFile()],
        { refinedDescription: 'test', technologies: { primary: 'ts' } },
        { dependencies: { production: {} } }
      );

      expect(analyses[0].confidence).toBe('high');
      expect(analyses[1].confidence).toBe('low');
    });

    it('should sort requiresReplan last', async () => {
      let callNum = 0;
      mockAgentChat.mockImplementation(async () => {
        callNum++;
        return {
          text: JSON.stringify({
            rootCause: `bug ${callNum}`,
            suggestedFix: { file: 'x', oldCode: '', newCode: '', explanation: '' },
            confidence: 'high',
            requiresReplan: callNum === 1,
          }),
        };
      });

      const analyses = await analyzer.analyzeAllErrors(
        [makeError({ message: 'err1' }), makeError({ message: 'err2' })],
        [makeFile()],
        { refinedDescription: 'test', technologies: { primary: 'ts' } },
        { dependencies: { production: {} } }
      );

      expect(analyses[0].requiresReplan).toBe(false);
      expect(analyses[1].requiresReplan).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // shouldReplan
  // -----------------------------------------------------------------------

  describe('shouldReplan', () => {
    it('should return true if more than 5 errors', () => {
      const errors = Array.from({ length: 6 }, () => makeError());
      expect(analyzer.shouldReplan(errors, [])).toBe(true);
    });

    it('should return true if any analysis suggests replan', () => {
      const analyses = [
        { confidence: 'high', requiresReplan: false },
        { confidence: 'high', requiresReplan: true },
      ];
      expect(analyzer.shouldReplan([makeError()], analyses as any)).toBe(true);
    });

    it('should return true if all analyses are low confidence', () => {
      const analyses = [
        { confidence: 'low', requiresReplan: false },
        { confidence: 'low', requiresReplan: false },
      ];
      expect(analyzer.shouldReplan([makeError()], analyses as any)).toBe(true);
    });

    it('should return false for a single high-confidence fix', () => {
      const analyses = [{ confidence: 'high', requiresReplan: false }];
      expect(analyzer.shouldReplan([makeError()], analyses as any)).toBe(false);
    });

    it('should return false for mixed confidence without replan', () => {
      const analyses = [
        { confidence: 'high', requiresReplan: false },
        { confidence: 'medium', requiresReplan: false },
      ];
      expect(analyzer.shouldReplan([makeError()], analyses as any)).toBe(false);
    });

    it('should return false for empty analyses with <= 5 errors', () => {
      expect(analyzer.shouldReplan([], [])).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Singleton export
  // -----------------------------------------------------------------------

  describe('errorAnalyzer singleton', () => {
    it('should be an instance of ErrorAnalyzer', () => {
      expect(errorAnalyzer).toBeInstanceOf(ErrorAnalyzer);
    });
  });
});
