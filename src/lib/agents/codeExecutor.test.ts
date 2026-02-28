// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockExecuteSandbox,
  mockQuickTest,
  mockBuildAndTest,
  mockGetSandboxConfig,
  mockIsSandboxConfigured,
} = vi.hoisted(() => ({
  mockExecuteSandbox: vi.fn(),
  mockQuickTest: vi.fn(),
  mockBuildAndTest: vi.fn(),
  mockGetSandboxConfig: vi.fn(),
  mockIsSandboxConfigured: vi.fn(),
}));

vi.mock('@/lib/connectors/vercel-sandbox', () => ({
  executeSandbox: (...args: unknown[]) => mockExecuteSandbox(...args),
  quickTest: (...args: unknown[]) => mockQuickTest(...args),
  buildAndTest: (...args: unknown[]) => mockBuildAndTest(...args),
  getSandboxConfig: () => mockGetSandboxConfig(),
  isSandboxConfigured: () => mockIsSandboxConfigured(),
}));

import { executeCode, shouldTestCode, extractCodeBlocks, ensurePackageJson } from './codeExecutor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSandboxResult(overrides = {}) {
  return {
    success: true,
    outputs: [
      {
        command: 'node index.js',
        stdout: 'Hello World',
        stderr: '',
        success: true,
        exitCode: 0,
      },
    ],
    executionTime: 123,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('codeExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSandboxConfigured.mockReturnValue(true);
    mockGetSandboxConfig.mockReturnValue({ apiKey: 'test', teamId: 't1' });
  });

  // =========================================================================
  // executeCode
  // =========================================================================

  describe('executeCode', () => {
    it('should return error when sandbox not configured', async () => {
      mockIsSandboxConfigured.mockReturnValue(false);
      const result = await executeCode({ type: 'snippet', code: 'console.log(1)' });
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('not configured');
    });

    it('should include suggestion when sandbox not configured', async () => {
      mockIsSandboxConfigured.mockReturnValue(false);
      const result = await executeCode({ type: 'snippet', code: 'x' });
      expect(result.suggestion).toContain('review manually');
    });

    // --- snippet type ---

    it('should execute snippet with quickTest', async () => {
      mockQuickTest.mockResolvedValue(makeSandboxResult());
      const result = await executeCode({ type: 'snippet', code: 'console.log(1)' });
      expect(result.success).toBe(true);
      expect(mockQuickTest).toHaveBeenCalled();
    });

    it('should return error when snippet has no code', async () => {
      const result = await executeCode({ type: 'snippet' });
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No code provided');
    });

    it('should default language to javascript for snippets', async () => {
      mockQuickTest.mockResolvedValue(makeSandboxResult());
      await executeCode({ type: 'snippet', code: 'x' });
      expect(mockQuickTest).toHaveBeenCalledWith(expect.anything(), 'x', 'javascript');
    });

    it('should pass custom language for snippets', async () => {
      mockQuickTest.mockResolvedValue(makeSandboxResult());
      await executeCode({ type: 'snippet', code: 'x', language: 'python' });
      expect(mockQuickTest).toHaveBeenCalledWith(expect.anything(), 'x', 'python');
    });

    // --- project type ---

    it('should execute project with buildAndTest', async () => {
      mockBuildAndTest.mockResolvedValue(makeSandboxResult());
      const result = await executeCode({
        type: 'project',
        files: [{ path: 'index.js', content: 'x' }],
      });
      expect(result.success).toBe(true);
      expect(mockBuildAndTest).toHaveBeenCalled();
    });

    it('should return error when project has no files', async () => {
      const result = await executeCode({ type: 'project', files: [] });
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No files provided');
    });

    it('should return error when project files is undefined', async () => {
      const result = await executeCode({ type: 'project' });
      expect(result.success).toBe(false);
    });

    // --- test type ---

    it('should execute test with executeSandbox', async () => {
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());
      const result = await executeCode({ type: 'test' });
      expect(result.success).toBe(true);
      expect(mockExecuteSandbox).toHaveBeenCalled();
    });

    it('should default commands to npm test for test type', async () => {
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());
      await executeCode({ type: 'test' });
      const opts = mockExecuteSandbox.mock.calls[0][1];
      expect(opts.commands).toContain('npm test');
    });

    // --- error handling ---

    it('should handle invalid type', async () => {
      const result = await executeCode({ type: 'invalid' as any });
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Invalid execution type');
    });

    it('should catch thrown errors', async () => {
      mockQuickTest.mockRejectedValue(new Error('Sandbox error'));
      const result = await executeCode({ type: 'snippet', code: 'x' });
      expect(result.success).toBe(false);
      expect(result.errors[0]).toBe('Sandbox error');
    });

    it('should catch non-Error throws', async () => {
      mockQuickTest.mockRejectedValue('string error');
      const result = await executeCode({ type: 'snippet', code: 'x' });
      expect(result.success).toBe(false);
      expect(result.errors[0]).toBe('Execution failed');
    });

    it('should include suggestion on error', async () => {
      mockQuickTest.mockRejectedValue(new Error('fail'));
      const result = await executeCode({ type: 'snippet', code: 'x' });
      expect(result.suggestion).toContain('try again');
    });

    // --- formatResultForAI suggestions ---

    it('should suggest missing dependency for module not found', async () => {
      mockQuickTest.mockResolvedValue(
        makeSandboxResult({
          success: false,
          outputs: [
            {
              command: 'node x.js',
              stdout: '',
              stderr: 'Cannot find module "lodash"',
              success: false,
              exitCode: 1,
            },
          ],
        })
      );
      const result = await executeCode({ type: 'snippet', code: 'x' });
      expect(result.suggestion).toContain('Missing dependency');
    });

    it('should suggest syntax fix for syntax errors', async () => {
      mockQuickTest.mockResolvedValue(
        makeSandboxResult({
          success: false,
          outputs: [
            {
              command: 'node x.js',
              stdout: '',
              stderr: 'SyntaxError: Unexpected token',
              success: false,
              exitCode: 1,
            },
          ],
        })
      );
      const result = await executeCode({ type: 'snippet', code: 'x' });
      expect(result.suggestion).toContain('Syntax error');
    });

    it('should suggest type fix for type errors', async () => {
      mockQuickTest.mockResolvedValue(
        makeSandboxResult({
          success: false,
          outputs: [
            {
              command: 'node x.js',
              stdout: '',
              stderr: 'TypeError: foo is not a function',
              success: false,
              exitCode: 1,
            },
          ],
        })
      );
      const result = await executeCode({ type: 'snippet', code: 'x' });
      expect(result.suggestion).toContain('Type error');
    });

    it('should suggest file fix for ENOENT errors', async () => {
      mockQuickTest.mockResolvedValue(
        makeSandboxResult({
          success: false,
          outputs: [
            {
              command: 'node x.js',
              stdout: '',
              stderr: 'ENOENT: no such file',
              success: false,
              exitCode: 1,
            },
          ],
        })
      );
      const result = await executeCode({ type: 'snippet', code: 'x' });
      expect(result.suggestion).toContain('File not found');
    });

    it('should format output with command prefix', async () => {
      mockQuickTest.mockResolvedValue(makeSandboxResult());
      const result = await executeCode({ type: 'snippet', code: 'x' });
      expect(result.output).toContain('$ node index.js');
      expect(result.output).toContain('Hello World');
    });
  });

  // =========================================================================
  // shouldTestCode
  // =========================================================================

  describe('shouldTestCode', () => {
    it('should return false for very short code', () => {
      expect(shouldTestCode('x', 'javascript')).toBe(false);
      expect(shouldTestCode('const x = 1', 'javascript')).toBe(false);
    });

    it('should return false for HTML', () => {
      expect(shouldTestCode('<div>hello</div>\n<p>test</p>\n<span>ok</span>', 'html')).toBe(false);
    });

    it('should return false for CSS', () => {
      expect(
        shouldTestCode('.foo { color: red; }\n.bar { color: blue; }\n.baz { color: green; }', 'css')
      ).toBe(false);
    });

    it('should return true for code with function definitions', () => {
      expect(
        shouldTestCode(
          'function add(a, b) {\n  return a + b;\n}\nconsole.log(add(1, 2));',
          'javascript'
        )
      ).toBe(true);
    });

    it('should return true for code with arrow functions', () => {
      expect(
        shouldTestCode(
          'const add = (a, b) => {\n  return a + b;\n}\nconsole.log(add(1, 2));',
          'javascript'
        )
      ).toBe(true);
    });

    it('should return true for code with class definitions', () => {
      expect(shouldTestCode('class Foo {\n  bar() {}\n}\nnew Foo().bar();', 'javascript')).toBe(
        true
      );
    });

    it('should return true for async code', () => {
      expect(
        shouldTestCode(
          'async function fetch() {\n  await doStuff();\n  return data;\n}',
          'javascript'
        )
      ).toBe(true);
    });

    it('should return true for code with imports', () => {
      expect(
        shouldTestCode(
          'import fs from "fs";\nconst data = fs.readFileSync("x");\nconsole.log(data);',
          'javascript'
        )
      ).toBe(true);
    });

    it('should return true for code with require', () => {
      expect(
        shouldTestCode(
          'const fs = require("fs");\nconst data = fs.readFileSync("x");\nconsole.log(data);',
          'javascript'
        )
      ).toBe(true);
    });

    it('should skip comment-only lines', () => {
      expect(shouldTestCode('// comment\n// another comment\nconst x = 1', 'javascript')).toBe(
        false
      );
    });
  });

  // =========================================================================
  // extractCodeBlocks
  // =========================================================================

  describe('extractCodeBlocks', () => {
    it('should extract a single code block', () => {
      const text = 'Here is code:\n```javascript\nconsole.log(1);\nconsole.log(2);\n```';
      const blocks = extractCodeBlocks(text);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('javascript');
      expect(blocks[0].code.length).toBeGreaterThan(0);
    });

    it('should extract multiple code blocks', () => {
      const text = '```js\ncode1\n```\ntext\n```python\ncode2\n```';
      const blocks = extractCodeBlocks(text);
      expect(blocks).toHaveLength(2);
    });

    it('should default language to text', () => {
      const text = '```\nplain code\n```';
      const blocks = extractCodeBlocks(text);
      expect(blocks[0].language).toBe('text');
    });

    it('should extract filename if present', () => {
      const text = '```typescript src/app.ts\nconst x = 1;\n```';
      const blocks = extractCodeBlocks(text);
      expect(blocks[0].filename).toBe('src/app.ts');
    });

    it('should return empty array for no code blocks', () => {
      expect(extractCodeBlocks('Just regular text')).toEqual([]);
    });

    it('should handle empty code blocks', () => {
      const blocks = extractCodeBlocks('```js\n\n```');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toBe('');
    });

    it('should handle multi-line code blocks', () => {
      const text = '```js\nline1\nline2\nline3\n```';
      const blocks = extractCodeBlocks(text);
      expect(blocks).toHaveLength(1);
      expect(blocks[0].code.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // ensurePackageJson
  // =========================================================================

  describe('ensurePackageJson', () => {
    it('should not add package.json if already present', () => {
      const files = [
        { path: 'package.json', content: '{}' },
        { path: 'index.js', content: 'x' },
      ];
      const result = ensurePackageJson(files);
      expect(result).toEqual(files);
    });

    it('should detect package.json in subdirectory', () => {
      const files = [
        { path: 'project/package.json', content: '{}' },
        { path: 'project/index.js', content: 'x' },
      ];
      const result = ensurePackageJson(files);
      expect(result).toEqual(files);
    });

    it('should add package.json when missing', () => {
      const files = [{ path: 'index.js', content: 'console.log(1)' }];
      const result = ensurePackageJson(files);
      expect(result.length).toBe(2);
      expect(result.some((f) => f.path === 'package.json')).toBe(true);
    });

    it('should extract dependencies from ES imports', () => {
      const files = [
        {
          path: 'index.js',
          content: 'import lodash from "lodash";\nimport express from "express";',
        },
      ];
      const result = ensurePackageJson(files);
      const pkg = JSON.parse(result.find((f) => f.path === 'package.json')!.content);
      expect(pkg.dependencies.lodash).toBe('latest');
      expect(pkg.dependencies.express).toBe('latest');
    });

    it('should extract dependencies from require calls', () => {
      const files = [
        {
          path: 'index.js',
          content: 'const fs = require("fs");\nconst chalk = require("chalk");',
        },
      ];
      const result = ensurePackageJson(files);
      const pkg = JSON.parse(result.find((f) => f.path === 'package.json')!.content);
      // fs is a node built-in but our simple parser doesn't exclude it
      expect(pkg.dependencies.chalk).toBe('latest');
    });

    it('should skip relative imports', () => {
      const files = [
        {
          path: 'index.js',
          content: 'import utils from "./utils";\nimport lodash from "lodash";',
        },
      ];
      const result = ensurePackageJson(files);
      const pkg = JSON.parse(result.find((f) => f.path === 'package.json')!.content);
      expect(pkg.dependencies['./utils']).toBeUndefined();
      expect(pkg.dependencies.lodash).toBe('latest');
    });

    it('should skip node: protocol imports', () => {
      const files = [
        {
          path: 'index.js',
          content: 'import fs from "node:fs";\nimport path from "node:path";',
        },
      ];
      const result = ensurePackageJson(files);
      const pkg = JSON.parse(result.find((f) => f.path === 'package.json')!.content);
      expect(pkg.dependencies['node:fs']).toBeUndefined();
    });

    it('should handle scoped packages', () => {
      const files = [
        {
          path: 'index.js',
          content: 'import sdk from "@anthropic-ai/sdk";',
        },
      ];
      const result = ensurePackageJson(files);
      const pkg = JSON.parse(result.find((f) => f.path === 'package.json')!.content);
      expect(pkg.dependencies['@anthropic-ai/sdk']).toBe('latest');
    });

    it('should add typescript devDependency for .ts files', () => {
      const files = [{ path: 'index.ts', content: 'const x: number = 1;' }];
      const result = ensurePackageJson(files);
      const pkg = JSON.parse(result.find((f) => f.path === 'package.json')!.content);
      expect(pkg.devDependencies.typescript).toBe('latest');
    });

    it('should add tsx devDependency for .tsx files', () => {
      const files = [{ path: 'App.tsx', content: 'export default () => <div/>;' }];
      const result = ensurePackageJson(files);
      const pkg = JSON.parse(result.find((f) => f.path === 'package.json')!.content);
      expect(pkg.devDependencies.tsx).toBe('latest');
    });

    it('should set type to module', () => {
      const files = [{ path: 'index.js', content: 'x' }];
      const result = ensurePackageJson(files);
      const pkg = JSON.parse(result.find((f) => f.path === 'package.json')!.content);
      expect(pkg.type).toBe('module');
    });

    it('should include default scripts', () => {
      const files = [{ path: 'index.js', content: 'x' }];
      const result = ensurePackageJson(files);
      const pkg = JSON.parse(result.find((f) => f.path === 'package.json')!.content);
      expect(pkg.scripts.start).toBeDefined();
      expect(pkg.scripts.build).toBeDefined();
      expect(pkg.scripts.test).toBeDefined();
    });

    it('should handle empty files array', () => {
      const result = ensurePackageJson([]);
      expect(result.some((f) => f.path === 'package.json')).toBe(true);
    });
  });
});
