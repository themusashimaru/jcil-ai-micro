import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @anthropic-ai/sdk BEFORE importing the module under test
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                code: 'def hello():\n    print("hello")',
                confidence: 0.9,
                notes: ['Translated successfully'],
                manualReviewRequired: false,
              }),
            },
          ],
        }),
      },
    })),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { CodeTranslator, codeTranslator, translateProject, translateCode } from './index';
import type {
  Language,
  Framework,
  TranslationRequest,
  TranslatedFile,
  DependencyMapping,
  Dependency,
  ConfigFile,
} from './index';

describe('CodeTranslator', () => {
  let translator: CodeTranslator;

  beforeEach(() => {
    vi.clearAllMocks();
    translator = new CodeTranslator();
  });

  // ----- Type exports -----
  describe('Type exports', () => {
    it('should export Language type values', () => {
      const langs: Language[] = [
        'typescript',
        'javascript',
        'python',
        'go',
        'rust',
        'java',
        'csharp',
        'ruby',
        'php',
        'swift',
        'kotlin',
      ];
      expect(langs).toHaveLength(11);
    });

    it('should export Framework type values', () => {
      const frameworks: Framework[] = [
        'nextjs',
        'react',
        'vue',
        'angular',
        'express',
        'fastapi',
        'django',
        'flask',
        'gin',
        'actix',
        'spring',
      ];
      expect(frameworks).toHaveLength(11);
    });

    it('should allow constructing TranslationRequest', () => {
      const req: TranslationRequest = {
        sourceLanguage: 'typescript',
        targetLanguage: 'python',
        preserveComments: true,
        preserveTests: false,
        generateTypes: true,
      };
      expect(req.sourceLanguage).toBe('typescript');
    });

    it('should allow constructing TranslatedFile', () => {
      const file: TranslatedFile = {
        originalPath: 'src/app.ts',
        newPath: 'src/app.py',
        originalContent: 'const x = 1;',
        translatedContent: 'x = 1',
        language: 'python',
        confidence: 0.9,
        notes: [],
        manualReviewRequired: false,
      };
      expect(file.language).toBe('python');
    });

    it('should allow constructing DependencyMapping', () => {
      const mapping: DependencyMapping = {
        original: [{ name: 'axios', version: '1.0.0' }],
        translated: [{ name: 'httpx', version: 'latest' }],
        unmapped: ['custom-lib'],
      };
      expect(mapping.unmapped).toContain('custom-lib');
    });

    it('should allow constructing Dependency', () => {
      const dep: Dependency = {
        name: 'axios',
        version: '1.0.0',
        equivalent: 'httpx',
        notes: 'Python equivalent',
      };
      expect(dep.equivalent).toBe('httpx');
    });

    it('should allow constructing ConfigFile', () => {
      const config: ConfigFile = {
        path: 'requirements.txt',
        content: 'flask==2.0',
        description: 'Python deps',
      };
      expect(config.path).toBe('requirements.txt');
    });
  });

  // ----- Singleton export -----
  describe('codeTranslator singleton', () => {
    it('should export a CodeTranslator instance', () => {
      expect(codeTranslator).toBeInstanceOf(CodeTranslator);
    });
  });

  // ----- translateFile -----
  describe('translateFile', () => {
    it('should translate a file and return TranslatedFile', async () => {
      const result = await translator.translateFile(
        { path: 'src/utils.ts', content: 'export const add = (a: number, b: number) => a + b;' },
        { sourceLanguage: 'typescript', targetLanguage: 'python' }
      );
      expect(result.originalPath).toBe('src/utils.ts');
      expect(result.newPath).toBe('src/utils.py');
      expect(result.translatedContent).toContain('def hello');
      expect(result.confidence).toBe(0.9);
      expect(result.manualReviewRequired).toBe(false);
      expect(result.language).toBe('python');
    });

    it('should handle non-JSON responses by extracting code block', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const mockInstance = new Anthropic();
      vi.mocked(mockInstance.messages.create).mockResolvedValueOnce({
        content: [{ type: 'text', text: '```python\ndef greet():\n    pass\n```' }],
      } as never);

      // Create a new translator that uses this mocked instance
      new CodeTranslator();
      // Access internal anthropic via prototype workaround — but since the constructor
      // creates its own instance, we mock at the module level above.
      // The default mock returns JSON, so let's test with the fallback scenario
      // by mocking the module-level factory
      vi.mocked(Anthropic).mockImplementationOnce(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [{ type: 'text', text: '```python\ndef greet():\n    pass\n```' }],
              }),
            },
          }) as never
      );

      const t2 = new CodeTranslator();
      const result = await t2.translateFile(
        { path: 'src/hello.ts', content: 'function greet() {}' },
        { sourceLanguage: 'typescript', targetLanguage: 'python' }
      );
      expect(result.confidence).toBe(0.7);
      expect(result.manualReviewRequired).toBe(true);
      expect(result.notes).toContain('Confidence estimated - JSON parsing failed');
    });

    it('should throw on non-text response', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementationOnce(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [{ type: 'tool_use', id: 't1', name: 'x', input: {} }],
              }),
            },
          }) as never
      );

      const t = new CodeTranslator();
      await expect(
        t.translateFile(
          { path: 'src/a.ts', content: 'const a = 1;' },
          { sourceLanguage: 'typescript', targetLanguage: 'python' }
        )
      ).rejects.toThrow('Unexpected response');
    });

    it('should translate path for TypeScript source (tsx)', async () => {
      const result = await translator.translateFile(
        { path: 'src/App.tsx', content: '<div />' },
        { sourceLanguage: 'typescript', targetLanguage: 'python' }
      );
      expect(result.newPath).toBe('src/App.py');
    });

    it('should translate path for non-TypeScript source', async () => {
      const result = await translator.translateFile(
        { path: 'main.py', content: 'print("hi")' },
        { sourceLanguage: 'python', targetLanguage: 'go' }
      );
      expect(result.newPath).toBe('main.go');
    });
  });

  // ----- translateProject -----
  describe('translateProject', () => {
    it('should translate matching code files', async () => {
      const files = [
        { path: 'src/utils.ts', content: 'export const x = 1;' },
        { path: 'src/index.ts', content: 'import { x } from "./utils";' },
        { path: 'README.md', content: '# Readme' }, // non-code file
      ];

      const result = await translator.translateProject(files, {
        sourceLanguage: 'typescript',
        targetLanguage: 'python',
      });

      expect(result.success).toBe(true);
      expect(result.files.length).toBe(2);
      expect(result.warnings).toEqual([]);
      expect(result.dependencyMapping).toBeDefined();
      expect(result.configFiles).toBeDefined();
      expect(result.migrationGuide).toBeDefined();
      expect(result.estimatedEffort).toBeDefined();
    });

    it('should also include .tsx and .jsx files', async () => {
      const files = [
        { path: 'src/App.tsx', content: '<div />' },
        { path: 'src/Other.jsx', content: '<span />' },
      ];

      const result = await translator.translateProject(files, {
        sourceLanguage: 'typescript',
        targetLanguage: 'python',
      });

      expect(result.files.length).toBe(2);
    });

    it('should handle translation errors gracefully', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementationOnce(
        () =>
          ({
            messages: {
              create: vi.fn().mockRejectedValue(new Error('API down')),
            },
          }) as never
      );

      const t = new CodeTranslator();
      const result = await t.translateProject([{ path: 'src/a.ts', content: 'const a = 1;' }], {
        sourceLanguage: 'typescript',
        targetLanguage: 'python',
      });

      expect(result.success).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Translation failed');
    });

    it('should add warning for files needing manual review', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementationOnce(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      code: '# complex',
                      confidence: 0.5,
                      notes: ['Complex pattern'],
                      manualReviewRequired: true,
                    }),
                  },
                ],
              }),
            },
          }) as never
      );

      const t = new CodeTranslator();
      const result = await t.translateProject(
        [{ path: 'src/complex.ts', content: 'const x = 1;' }],
        { sourceLanguage: 'typescript', targetLanguage: 'python' }
      );

      expect(result.warnings.some((w) => w.includes('Manual review recommended'))).toBe(true);
    });

    it('should return success=false when no files match source language', async () => {
      const result = await translator.translateProject([{ path: 'main.py', content: 'print(1)' }], {
        sourceLanguage: 'typescript',
        targetLanguage: 'python',
      });
      expect(result.success).toBe(false);
    });
  });

  // ----- mapDependencies -----
  describe('dependency mapping', () => {
    it('should map known dependencies from package.json', async () => {
      const pkg = JSON.stringify({
        dependencies: { axios: '1.0.0', zod: '3.0.0' },
        devDependencies: { jest: '29.0.0' },
      });

      const result = await translator.translateProject(
        [
          { path: 'package.json', content: pkg },
          { path: 'src/index.ts', content: 'import axios from "axios";' },
        ],
        { sourceLanguage: 'typescript', targetLanguage: 'python' }
      );

      expect(result.dependencyMapping.translated.length).toBeGreaterThan(0);
      const httpxDep = result.dependencyMapping.translated.find((d) => d.name === 'httpx');
      expect(httpxDep).toBeDefined();
    });

    it('should track unmapped dependencies', async () => {
      const pkg = JSON.stringify({
        dependencies: { 'some-unique-lib': '1.0.0' },
      });

      const result = await translator.translateProject(
        [
          { path: 'package.json', content: pkg },
          { path: 'src/index.ts', content: 'import x from "x";' },
        ],
        { sourceLanguage: 'typescript', targetLanguage: 'python' }
      );

      expect(result.dependencyMapping.unmapped).toContain('some-unique-lib');
    });

    it('should handle invalid package.json gracefully', async () => {
      const result = await translator.translateProject(
        [
          { path: 'package.json', content: 'not-json{{{' },
          { path: 'src/index.ts', content: 'const x = 1;' },
        ],
        { sourceLanguage: 'typescript', targetLanguage: 'python' }
      );

      expect(result.dependencyMapping.original).toEqual([]);
    });
  });

  // ----- generateConfigFiles -----
  describe('config file generation', () => {
    it('should generate Python config files', async () => {
      const result = await translator.translateProject(
        [{ path: 'src/index.ts', content: 'const x = 1;' }],
        { sourceLanguage: 'typescript', targetLanguage: 'python' }
      );
      const paths = result.configFiles.map((c) => c.path);
      expect(paths).toContain('requirements.txt');
      expect(paths).toContain('pyproject.toml');
    });

    it('should generate Go config files', async () => {
      const result = await translator.translateProject(
        [{ path: 'src/index.ts', content: 'const x = 1;' }],
        { sourceLanguage: 'typescript', targetLanguage: 'go' }
      );
      const paths = result.configFiles.map((c) => c.path);
      expect(paths).toContain('go.mod');
    });

    it('should generate Rust config files', async () => {
      const result = await translator.translateProject(
        [{ path: 'src/index.ts', content: 'const x = 1;' }],
        { sourceLanguage: 'typescript', targetLanguage: 'rust' }
      );
      const paths = result.configFiles.map((c) => c.path);
      expect(paths).toContain('Cargo.toml');
    });

    it('should generate Java config files', async () => {
      const result = await translator.translateProject(
        [{ path: 'src/index.ts', content: 'const x = 1;' }],
        { sourceLanguage: 'typescript', targetLanguage: 'java' }
      );
      const paths = result.configFiles.map((c) => c.path);
      expect(paths).toContain('pom.xml');
    });

    it('should generate no config files for javascript target', async () => {
      const result = await translator.translateProject(
        [{ path: 'src/index.ts', content: 'const x = 1;' }],
        { sourceLanguage: 'typescript', targetLanguage: 'javascript' }
      );
      expect(result.configFiles).toEqual([]);
    });
  });

  // ----- estimateEffort -----
  describe('effort estimation', () => {
    it('should estimate 1-2 hours for small, high-confidence projects', async () => {
      const result = await translator.translateProject(
        [{ path: 'src/small.ts', content: 'const x = 1;' }],
        { sourceLanguage: 'typescript', targetLanguage: 'python' }
      );
      expect(result.estimatedEffort).toBe('1-2 hours');
    });
  });

  // ----- translateSnippet -----
  describe('translateSnippet', () => {
    it('should translate a code snippet', async () => {
      const result = await translator.translateSnippet(
        'const x: number = 1;',
        'typescript',
        'python'
      );
      expect(typeof result).toBe('string');
    });
  });

  // ----- Top-level convenience functions -----
  describe('translateProject convenience function', () => {
    it('should call codeTranslator.translateProject', async () => {
      const result = await translateProject(
        [{ path: 'src/app.ts', content: 'const x = 1;' }],
        'typescript',
        'python'
      );
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });

  describe('translateCode convenience function', () => {
    it('should call codeTranslator.translateSnippet', async () => {
      const result = await translateCode('const x = 1;', 'typescript', 'python');
      expect(typeof result).toBe('string');
    });
  });

  // ----- Migration guide -----
  describe('migration guide', () => {
    it('should contain migration guide header', async () => {
      const result = await translator.translateProject(
        [{ path: 'src/index.ts', content: 'const x = 1;' }],
        { sourceLanguage: 'typescript', targetLanguage: 'python' }
      );
      expect(result.migrationGuide).toContain('Migration Guide');
      expect(result.migrationGuide).toContain('typescript');
      expect(result.migrationGuide).toContain('python');
    });
  });
});
