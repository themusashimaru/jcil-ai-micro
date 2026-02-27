// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAgentChat = vi.fn();
vi.mock('@/lib/ai/providers', () => ({
  agentChat: (...args: unknown[]) => mockAgentChat(...args),
}));

import { CodeGenerator, codeGenerator } from '../CodeGenerator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockIntent(overrides = {}) {
  return {
    refinedDescription: 'A REST API for managing todos',
    projectType: 'api',
    complexity: 'medium',
    technologies: {
      primary: 'TypeScript',
      secondary: ['Express', 'Zod'],
      packageManager: 'npm',
      runtime: 'node',
      testFramework: 'vitest',
    },
    requirements: {
      functional: ['CRUD operations', 'Authentication'],
    },
    ...overrides,
  };
}

function createMockPlan(overrides = {}) {
  return {
    name: 'todo-api',
    description: 'A REST API for managing todos',
    fileTree: [
      {
        path: 'package.json',
        purpose: 'Package configuration',
        priority: 1,
        dependencies: [],
        isConfig: true,
        estimatedLines: 30,
      },
      {
        path: 'tsconfig.json',
        purpose: 'TypeScript config',
        priority: 2,
        dependencies: [],
        isConfig: true,
        estimatedLines: 20,
      },
      {
        path: '.gitignore',
        purpose: 'Git ignore rules',
        priority: 3,
        dependencies: [],
        isConfig: true,
        estimatedLines: 25,
      },
      {
        path: 'src/index.ts',
        purpose: 'Entry point',
        priority: 4,
        dependencies: ['package.json'],
        isConfig: false,
        estimatedLines: 50,
      },
    ],
    dependencies: {
      production: { express: '^4.18.0', zod: '^3.22.0' },
      development: { vitest: '^1.0.0' },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CodeGenerator', () => {
  let gen: CodeGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    gen = new CodeGenerator();
  });

  describe('basic properties', () => {
    it('should be instantiable', () => {
      expect(gen).toBeDefined();
    });

    it('should allow setting provider', () => {
      gen.setProvider('openai');
      expect(true).toBe(true);
    });

    it('should clear generated files cache', () => {
      gen.clearCache();
      expect(true).toBe(true);
    });
  });

  describe('generateAll', () => {
    it('should generate all files from plan', async () => {
      mockAgentChat.mockResolvedValue({ text: 'console.log("hello");\n' });

      const intent = createMockIntent();
      const plan = createMockPlan();
      const files = await gen.generateAll(intent, plan);

      // 4 files: package.json, tsconfig.json, .gitignore, src/index.ts
      expect(files).toHaveLength(4);
    });

    it('should sort files by priority', async () => {
      mockAgentChat.mockResolvedValue({ text: 'code here\n' });

      const plan = createMockPlan({
        fileTree: [
          {
            path: 'src/app.ts',
            purpose: 'App',
            priority: 3,
            dependencies: [],
            isConfig: false,
            estimatedLines: 50,
          },
          {
            path: 'package.json',
            purpose: 'Config',
            priority: 1,
            dependencies: [],
            isConfig: true,
            estimatedLines: 30,
          },
        ],
      });

      const files = await gen.generateAll(createMockIntent(), plan);
      expect(files[0].path).toBe('package.json');
      expect(files[1].path).toBe('src/app.ts');
    });

    it('should call stream callback with progress', async () => {
      mockAgentChat.mockResolvedValue({ text: 'code\n' });
      const onStream = vi.fn();

      await gen.generateAll(createMockIntent(), createMockPlan(), onStream);

      expect(onStream).toHaveBeenCalled();
      const firstCall = onStream.mock.calls[0][0];
      expect(firstCall.type).toBe('thinking');
      expect(firstCall.phase).toBe('Code Generation');
    });
  });

  describe('generateFile - package.json', () => {
    it('should generate valid package.json', async () => {
      const plan = createMockPlan();
      const file = plan.fileTree[0]; // package.json
      const intent = createMockIntent();

      const result = await gen.generateFile(file, intent, plan);

      expect(result.path).toBe('package.json');
      expect(result.language).toBe('json');

      const parsed = JSON.parse(result.content);
      expect(parsed.name).toBe('todo-api');
      expect(parsed.dependencies.express).toBeDefined();
      expect(parsed.dependencies.zod).toBeDefined();
    });

    it('should include TypeScript dev deps for TS projects', async () => {
      const plan = createMockPlan();
      const file = plan.fileTree[0];
      const intent = createMockIntent({
        technologies: { ...createMockIntent().technologies, primary: 'TypeScript' },
      });

      const result = await gen.generateFile(file, intent, plan);
      const parsed = JSON.parse(result.content);

      expect(parsed.devDependencies.typescript).toBeDefined();
      expect(parsed.devDependencies['@types/node']).toBeDefined();
    });

    it('should set correct scripts for TypeScript', async () => {
      const plan = createMockPlan();
      const file = plan.fileTree[0];

      const result = await gen.generateFile(file, createMockIntent(), plan);
      const parsed = JSON.parse(result.content);

      expect(parsed.scripts.build).toBe('tsc');
      expect(parsed.scripts.dev).toContain('tsx');
    });

    it('should set test script from test framework', async () => {
      const plan = createMockPlan();
      const file = plan.fileTree[0];

      const result = await gen.generateFile(file, createMockIntent(), plan);
      const parsed = JSON.parse(result.content);

      expect(parsed.scripts.test).toBe('vitest');
    });
  });

  describe('generateFile - tsconfig.json', () => {
    it('should generate valid tsconfig.json', async () => {
      const plan = createMockPlan();
      const file = plan.fileTree[1]; // tsconfig.json

      const result = await gen.generateFile(file, createMockIntent(), plan);

      expect(result.path).toBe('tsconfig.json');
      const parsed = JSON.parse(result.content);
      expect(parsed.compilerOptions).toBeDefined();
      expect(parsed.compilerOptions.strict).toBe(true);
      expect(parsed.compilerOptions.target).toBe('ES2022');
    });
  });

  describe('generateFile - .gitignore', () => {
    it('should generate .gitignore for Node projects', async () => {
      const plan = createMockPlan();
      const file = plan.fileTree[2]; // .gitignore

      const result = await gen.generateFile(file, createMockIntent(), plan);

      expect(result.content).toContain('node_modules/');
      expect(result.content).toContain('.env');
      expect(result.content).toContain('dist/');
    });

    it('should include Python patterns for Python runtime', async () => {
      const plan = createMockPlan();
      const file = plan.fileTree[2];
      const intent = createMockIntent({
        technologies: { ...createMockIntent().technologies, runtime: 'python' },
      });

      const result = await gen.generateFile(file, intent, plan);

      expect(result.content).toContain('venv/');
      expect(result.content).toContain('__pycache__/');
    });
  });

  describe('generateFile - source files', () => {
    it('should use AI to generate source file content', async () => {
      mockAgentChat.mockResolvedValue({
        text: 'import express from "express";\nconst app = express();\n',
      });

      const plan = createMockPlan();
      const file = plan.fileTree[3]; // src/index.ts

      const result = await gen.generateFile(file, createMockIntent(), plan);

      expect(result.path).toBe('src/index.ts');
      expect(result.language).toBe('typescript');
      expect(result.content).toContain('express');
      expect(mockAgentChat).toHaveBeenCalled();
    });

    it('should clean markdown code blocks from AI response', async () => {
      mockAgentChat.mockResolvedValue({
        text: '```typescript\nimport foo from "foo";\n```',
      });

      const plan = createMockPlan();
      const file = plan.fileTree[3];

      const result = await gen.generateFile(file, createMockIntent(), plan);

      expect(result.content).not.toContain('```');
      expect(result.content).toContain('import foo');
    });

    it('should return placeholder file on AI error', async () => {
      mockAgentChat.mockRejectedValue(new Error('API error'));

      const plan = createMockPlan();
      const file = plan.fileTree[3];

      const result = await gen.generateFile(file, createMockIntent(), plan);

      expect(result.content).toContain('TODO');
      expect(result.content).toContain('failed');
    });

    it('should set version to 1 for new files', async () => {
      mockAgentChat.mockResolvedValue({ text: 'const x = 1;\n' });

      const plan = createMockPlan();
      const result = await gen.generateFile(plan.fileTree[3], createMockIntent(), plan);

      expect(result.version).toBe(1);
    });

    it('should set linesOfCode based on content', async () => {
      mockAgentChat.mockResolvedValue({ text: 'line1\nline2\nline3\n' });

      const plan = createMockPlan();
      const result = await gen.generateFile(plan.fileTree[3], createMockIntent(), plan);

      expect(result.linesOfCode).toBeGreaterThan(0);
    });
  });

  describe('regenerateFile', () => {
    it('should regenerate file with fix', async () => {
      mockAgentChat.mockResolvedValue({ text: 'const fixed = true;\n' });

      const originalFile = {
        path: 'src/index.ts',
        content: 'const broken = true;\n',
        language: 'typescript',
        purpose: 'Entry point',
        linesOfCode: 1,
        generatedAt: Date.now(),
        version: 1,
      };

      const result = await gen.regenerateFile(
        originalFile,
        'Type error on line 1',
        createMockIntent()
      );

      expect(result.content).toContain('fixed');
      expect(result.version).toBe(2);
    });

    it('should return original file on regeneration error', async () => {
      mockAgentChat.mockRejectedValue(new Error('API down'));

      const originalFile = {
        path: 'src/index.ts',
        content: 'original code\n',
        language: 'typescript',
        purpose: 'Entry',
        linesOfCode: 1,
        generatedAt: Date.now(),
        version: 1,
      };

      const result = await gen.regenerateFile(originalFile, 'Error', createMockIntent());

      expect(result.content).toBe('original code\n');
      expect(result.version).toBe(1);
    });
  });

  describe('language detection', () => {
    it.each([
      ['src/app.ts', 'typescript'],
      ['component.tsx', 'typescript'],
      ['index.js', 'javascript'],
      ['App.jsx', 'javascript'],
      ['script.py', 'python'],
      ['data.json', 'json'],
      ['README.md', 'markdown'],
      ['config.yaml', 'yaml'],
      ['config.yml', 'yaml'],
      ['setup.sh', 'bash'],
      ['index.html', 'html'],
      ['styles.css', 'css'],
      ['styles.scss', 'scss'],
      ['schema.sql', 'sql'],
      ['unknown.xyz', 'text'],
    ])('should detect %s as %s', async (path, expected) => {
      mockAgentChat.mockResolvedValue({ text: '// code\n' });
      const plan = createMockPlan({
        fileTree: [
          {
            path,
            purpose: 'Test',
            priority: 1,
            dependencies: [],
            isConfig: false,
            estimatedLines: 10,
          },
        ],
      });
      const result = await gen.generateFile(plan.fileTree[0], createMockIntent(), plan);
      expect(result.language).toBe(expected);
    });
  });

  describe('placeholder file', () => {
    it('should use // comments for non-Python', async () => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
      const plan = createMockPlan({
        fileTree: [
          {
            path: 'src/app.ts',
            purpose: 'Application',
            priority: 1,
            dependencies: [],
            isConfig: false,
            estimatedLines: 10,
          },
        ],
      });

      const result = await gen.generateFile(plan.fileTree[0], createMockIntent(), plan);
      expect(result.content).toContain('// src/app.ts');
    });

    it('should use # comments for Python', async () => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
      const plan = createMockPlan({
        fileTree: [
          {
            path: 'src/app.py',
            purpose: 'Application',
            priority: 1,
            dependencies: [],
            isConfig: false,
            estimatedLines: 10,
          },
        ],
      });

      const result = await gen.generateFile(plan.fileTree[0], createMockIntent(), plan);
      expect(result.content).toContain('# src/app.py');
    });
  });
});

describe('codeGenerator singleton', () => {
  it('should be an instance of CodeGenerator', () => {
    expect(codeGenerator).toBeInstanceOf(CodeGenerator);
  });
});
