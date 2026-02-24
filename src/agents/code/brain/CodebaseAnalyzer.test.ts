import { describe, it, expect, vi } from 'vitest';

vi.mock('../tools/ReadTool', () => ({
  readTool: vi.fn().mockResolvedValue(''),
}));

import {
  CodebaseAnalyzer,
  codebaseAnalyzer,
  type CodebaseProfile,
  type LanguageBreakdown,
  type FrameworkInfo,
  type RuntimeInfo,
  type ArchitectureInfo,
  type CodingConventions,
  type DirectoryStructure,
  type DirectoryNode,
  type KeyDirectory,
  type DependencyInfo,
  type DependencyEntry,
  type CodebaseInsight,
} from './CodebaseAnalyzer';

// -------------------------------------------------------------------
// Type Exports
// -------------------------------------------------------------------
describe('CodebaseAnalyzer type exports', () => {
  it('should export CodebaseProfile', () => {
    const profile: Partial<CodebaseProfile> = {
      name: 'test',
      language: 'typescript',
      hasTests: true,
    };
    expect(profile.name).toBe('test');
  });

  it('should export LanguageBreakdown', () => {
    const lb: LanguageBreakdown = { language: 'TypeScript', percentage: 80, fileCount: 100 };
    expect(lb.language).toBe('TypeScript');
  });

  it('should export FrameworkInfo', () => {
    const fi: FrameworkInfo = { name: 'Next.js', type: 'fullstack', confidence: 0.95 };
    expect(fi.name).toBe('Next.js');
  });

  it('should export RuntimeInfo', () => {
    const ri: RuntimeInfo = { name: 'Node.js', packageManager: 'npm' };
    expect(ri.packageManager).toBe('npm');
  });

  it('should export ArchitectureInfo', () => {
    const ai: ArchitectureInfo = {
      pattern: 'MVC',
      layers: ['controller', 'model', 'view'],
      entryPoints: ['src/index.ts'],
      dataFlow: 'unidirectional',
    };
    expect(ai.pattern).toBe('MVC');
  });

  it('should export CodingConventions', () => {
    const cc: CodingConventions = {
      namingStyle: 'camelCase',
      indentation: 'spaces',
      quotes: 'single',
      semicolons: true,
      trailingComma: true,
      exportStyle: 'named',
    };
    expect(cc.namingStyle).toBe('camelCase');
  });

  it('should export DirectoryStructure', () => {
    const ds: DirectoryStructure = {
      root: { name: 'root', type: 'directory', children: [] },
      keyDirectories: [],
    };
    expect(ds.root.name).toBe('root');
  });

  it('should export DirectoryNode', () => {
    const dn: DirectoryNode = { name: 'src', type: 'directory' };
    expect(dn.type).toBe('directory');
  });

  it('should export KeyDirectory', () => {
    const kd: KeyDirectory = { path: 'src/lib', purpose: 'shared library', contains: ['utils'] };
    expect(kd.path).toBe('src/lib');
  });

  it('should export DependencyInfo', () => {
    const di: DependencyInfo = {
      runtime: [],
      dev: [],
      hasCriticalVulnerabilities: false,
      outdatedCount: 0,
    };
    expect(di.outdatedCount).toBe(0);
  });

  it('should export DependencyEntry', () => {
    const de: DependencyEntry = { name: 'react', version: '18.2.0' };
    expect(de.name).toBe('react');
  });

  it('should export CodebaseInsight', () => {
    const ci: CodebaseInsight = {
      type: 'strength',
      title: 'Well tested',
      description: 'Good test coverage',
    };
    expect(ci.type).toBe('strength');
  });
});

// -------------------------------------------------------------------
// CodebaseAnalyzer class
// -------------------------------------------------------------------
describe('CodebaseAnalyzer', () => {
  it('should be exported as a class', () => {
    expect(CodebaseAnalyzer).toBeDefined();
    expect(typeof CodebaseAnalyzer).toBe('function');
  });

  it('should create an instance', () => {
    const analyzer = new CodebaseAnalyzer();
    expect(analyzer).toBeInstanceOf(CodebaseAnalyzer);
  });

  it('should have an analyze method', () => {
    const analyzer = new CodebaseAnalyzer();
    expect(typeof analyzer.analyze).toBe('function');
  });
});

// -------------------------------------------------------------------
// codebaseAnalyzer singleton
// -------------------------------------------------------------------
describe('codebaseAnalyzer singleton', () => {
  it('should be an instance of CodebaseAnalyzer', () => {
    expect(codebaseAnalyzer).toBeInstanceOf(CodebaseAnalyzer);
  });

  it('should have an analyze method', () => {
    expect(typeof codebaseAnalyzer.analyze).toBe('function');
  });
});

// -------------------------------------------------------------------
// CodebaseAnalyzer.analyze (integration)
// -------------------------------------------------------------------
describe('CodebaseAnalyzer.analyze', () => {
  it('should analyze a simple file list', async () => {
    const analyzer = new CodebaseAnalyzer();
    const onStream = vi.fn();

    const files = [
      'package.json',
      'tsconfig.json',
      'src/index.ts',
      'src/app/page.tsx',
      'src/lib/utils.ts',
      '.github/workflows/ci.yml',
      'src/__tests__/index.test.ts',
    ];

    const result = await analyzer.analyze(files, onStream);

    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('language');
    expect(result).toHaveProperty('framework');
    expect(result).toHaveProperty('runtime');
    expect(result).toHaveProperty('architecture');
    expect(result).toHaveProperty('conventions');
    expect(result).toHaveProperty('structure');
    expect(result).toHaveProperty('dependencies');
    expect(result).toHaveProperty('hasTests');
    expect(result).toHaveProperty('hasCi');
    expect(result).toHaveProperty('insights');
    expect(result).toHaveProperty('suggestedImprovements');
    expect(result).toHaveProperty('patterns');
    expect(result).toHaveProperty('entryPoints');
  });

  it('should call onStream with progress updates', async () => {
    const analyzer = new CodebaseAnalyzer();
    const onStream = vi.fn();

    await analyzer.analyze(['src/index.ts', 'package.json'], onStream);

    expect(onStream).toHaveBeenCalled();
    const calls = onStream.mock.calls;
    expect(calls.some((c: unknown[]) => (c[0] as { type: string }).type === 'thinking')).toBe(true);
  });

  it('should detect TypeScript as language for .ts files', async () => {
    const analyzer = new CodebaseAnalyzer();
    const onStream = vi.fn();

    const files = ['src/index.ts', 'src/app.ts', 'src/utils.ts', 'package.json'];
    const result = await analyzer.analyze(files, onStream);

    expect(result.languages.some((l) => l.language === 'TypeScript')).toBe(true);
  });

  it('should detect CI setup from GitHub Actions', async () => {
    const analyzer = new CodebaseAnalyzer();
    const onStream = vi.fn();

    const files = ['.github/workflows/ci.yml', 'src/index.ts'];
    const result = await analyzer.analyze(files, onStream);

    expect(result.hasCi).toBe(true);
  });

  it('should detect test setup from test files', async () => {
    const analyzer = new CodebaseAnalyzer();
    const onStream = vi.fn();

    const files = ['src/index.ts', 'src/__tests__/index.test.ts', 'package.json'];
    const result = await analyzer.analyze(files, onStream);

    expect(result.hasTests).toBe(true);
  });
});
