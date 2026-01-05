/**
 * CODEBASE ANALYZER
 *
 * Deep understanding of existing codebases.
 * Extracts patterns, conventions, architecture, and insights.
 *
 * Features:
 * - Framework/library detection
 * - Coding style analysis
 * - Architecture pattern recognition
 * - Dependency mapping
 * - Entry point detection
 * - Test coverage understanding
 *
 * This allows the agent to work WITH existing code, not just generate new.
 */

// Tools - kept for future enhanced analysis
// import { searchTool } from '../tools/SearchTool';
import { readTool } from '../tools/ReadTool';
import { AgentStreamCallback } from '../../core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface CodebaseProfile {
  // Basic info
  name: string;
  description: string;
  language: string;
  languages: LanguageBreakdown[];

  // Framework detection
  framework: FrameworkInfo;
  runtime: RuntimeInfo;

  // Architecture
  architecture: ArchitectureInfo;
  patterns: string[];

  // Conventions
  conventions: CodingConventions;

  // Structure
  structure: DirectoryStructure;
  entryPoints: string[];

  // Dependencies
  dependencies: DependencyInfo;

  // Quality
  hasTests: boolean;
  testFramework?: string;
  hasCi: boolean;
  ciPlatform?: string;

  // Insights
  insights: CodebaseInsight[];
  suggestedImprovements: string[];
}

export interface LanguageBreakdown {
  language: string;
  percentage: number;
  fileCount: number;
}

export interface FrameworkInfo {
  name: string;
  version?: string;
  type: 'frontend' | 'backend' | 'fullstack' | 'library' | 'cli' | 'other';
  confidence: number;
}

export interface RuntimeInfo {
  name: string;
  version?: string;
  packageManager: string;
}

export interface ArchitectureInfo {
  pattern: string;  // MVC, Clean, Hexagonal, etc.
  layers: string[];
  entryPoints: string[];
  dataFlow: string;
}

export interface CodingConventions {
  namingStyle: 'camelCase' | 'snake_case' | 'PascalCase' | 'kebab-case' | 'mixed';
  indentation: 'tabs' | 'spaces';
  indentSize?: number;
  quotes: 'single' | 'double' | 'mixed';
  semicolons: boolean;
  trailingComma: boolean;
  maxLineLength?: number;
  componentStyle?: 'functional' | 'class' | 'mixed';
  exportStyle: 'named' | 'default' | 'mixed';
}

export interface DirectoryStructure {
  root: DirectoryNode;
  keyDirectories: KeyDirectory[];
}

export interface DirectoryNode {
  name: string;
  type: 'file' | 'directory';
  children?: DirectoryNode[];
  purpose?: string;
}

export interface KeyDirectory {
  path: string;
  purpose: string;
  contains: string[];
}

export interface DependencyInfo {
  runtime: DependencyEntry[];
  dev: DependencyEntry[];
  hasCriticalVulnerabilities: boolean;
  outdatedCount: number;
}

export interface DependencyEntry {
  name: string;
  version: string;
  purpose?: string;
  isOutdated?: boolean;
}

export interface CodebaseInsight {
  type: 'strength' | 'weakness' | 'opportunity' | 'threat';
  title: string;
  description: string;
  affectedFiles?: string[];
  severity?: 'low' | 'medium' | 'high';
}

// ============================================================================
// MAIN ANALYZER
// ============================================================================

export class CodebaseAnalyzer {
  // Model available for future AI-powered analysis
  // private model = 'claude-opus-4-5-20251101';

  /**
   * Perform complete codebase analysis
   */
  async analyze(
    repoFiles: string[],
    onStream: AgentStreamCallback
  ): Promise<CodebaseProfile> {
    onStream({
      type: 'thinking',
      message: '🔍 Analyzing codebase structure...',
      timestamp: Date.now(),
      progress: 10,
    });

    // Step 1: Analyze file structure
    const structure = this.analyzeStructure(repoFiles);

    onStream({
      type: 'thinking',
      message: `📁 Found ${repoFiles.length} files across ${structure.keyDirectories.length} key directories`,
      timestamp: Date.now(),
      progress: 20,
    });

    // Step 2: Detect languages
    const languages = this.detectLanguages(repoFiles);

    onStream({
      type: 'thinking',
      message: `💻 Primary language: ${languages[0]?.language || 'Unknown'}`,
      timestamp: Date.now(),
      progress: 30,
    });

    // Step 3: Read key files for analysis
    const keyFiles = await this.readKeyFiles(repoFiles);

    onStream({
      type: 'thinking',
      message: `📖 Read ${Object.keys(keyFiles).length} key configuration files`,
      timestamp: Date.now(),
      progress: 40,
    });

    // Step 4: Detect framework and runtime
    const framework = this.detectFramework(keyFiles, languages);
    const runtime = this.detectRuntime(keyFiles);

    onStream({
      type: 'thinking',
      message: `🚀 Detected: ${framework.name} (${framework.type})`,
      timestamp: Date.now(),
      progress: 50,
    });

    // Step 5: Analyze architecture
    const architecture = await this.analyzeArchitecture(repoFiles, keyFiles, onStream);

    onStream({
      type: 'thinking',
      message: `🏗️ Architecture: ${architecture.pattern}`,
      timestamp: Date.now(),
      progress: 60,
    });

    // Step 6: Detect conventions
    const conventions = await this.detectConventions(keyFiles, repoFiles);

    onStream({
      type: 'thinking',
      message: `📝 Style: ${conventions.namingStyle}, ${conventions.indentation}`,
      timestamp: Date.now(),
      progress: 70,
    });

    // Step 7: Analyze dependencies
    const dependencies = this.analyzeDependencies(keyFiles);

    onStream({
      type: 'thinking',
      message: `📦 Dependencies: ${dependencies.runtime.length} runtime, ${dependencies.dev.length} dev`,
      timestamp: Date.now(),
      progress: 80,
    });

    // Step 8: Detect testing setup
    const { hasTests, testFramework } = this.detectTestSetup(repoFiles, keyFiles);
    const { hasCi, ciPlatform } = this.detectCiSetup(repoFiles);

    // Step 9: Generate insights
    const insights = await this.generateInsights(
      structure,
      framework,
      architecture,
      dependencies,
      hasTests,
      onStream
    );

    onStream({
      type: 'thinking',
      message: `💡 Generated ${insights.length} insights`,
      timestamp: Date.now(),
      progress: 90,
    });

    // Build profile
    const profile: CodebaseProfile = {
      name: this.extractProjectName(keyFiles),
      description: this.extractDescription(keyFiles),
      language: languages[0]?.language || 'Unknown',
      languages,
      framework,
      runtime,
      architecture,
      patterns: this.detectPatterns(repoFiles),
      conventions,
      structure,
      entryPoints: architecture.entryPoints,
      dependencies,
      hasTests,
      testFramework,
      hasCi,
      ciPlatform,
      insights,
      suggestedImprovements: this.generateImprovements(insights),
    };

    onStream({
      type: 'complete',
      message: '✅ Codebase analysis complete',
      timestamp: Date.now(),
      progress: 100,
    });

    return profile;
  }

  /**
   * Quick analysis for smaller operations
   */
  async quickAnalysis(repoFiles: string[]): Promise<Partial<CodebaseProfile>> {
    const structure = this.analyzeStructure(repoFiles);
    const languages = this.detectLanguages(repoFiles);
    const keyFiles = await this.readKeyFiles(repoFiles);

    return {
      language: languages[0]?.language || 'Unknown',
      languages,
      framework: this.detectFramework(keyFiles, languages),
      runtime: this.detectRuntime(keyFiles),
      structure,
      conventions: await this.detectConventions(keyFiles, repoFiles),
    };
  }

  // ==========================================================================
  // ANALYSIS METHODS
  // ==========================================================================

  /**
   * Analyze directory structure
   */
  private analyzeStructure(files: string[]): DirectoryStructure {
    const root: DirectoryNode = { name: '/', type: 'directory', children: [] };
    const keyDirs: KeyDirectory[] = [];

    // Build tree
    for (const file of files) {
      const parts = file.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;

        if (!current.children) current.children = [];

        let child = current.children.find(c => c.name === part);
        if (!child) {
          child = {
            name: part,
            type: isFile ? 'file' : 'directory',
            children: isFile ? undefined : [],
          };
          current.children.push(child);
        }
        current = child;
      }
    }

    // Identify key directories
    const keyDirPatterns: Record<string, string> = {
      'src': 'Source code',
      'lib': 'Library code',
      'app': 'Application code (Next.js/Rails)',
      'pages': 'Page components',
      'components': 'UI components',
      'hooks': 'React hooks',
      'utils': 'Utility functions',
      'helpers': 'Helper functions',
      'services': 'Business logic services',
      'api': 'API routes/handlers',
      'models': 'Data models',
      'controllers': 'Request controllers',
      'views': 'View templates',
      'tests': 'Test files',
      '__tests__': 'Jest test files',
      'spec': 'Test specifications',
      'config': 'Configuration files',
      'public': 'Static assets',
      'assets': 'Asset files',
      'styles': 'Style files',
      'types': 'TypeScript types',
      'interfaces': 'Interface definitions',
      'constants': 'Constant values',
      'middleware': 'Middleware functions',
      'routes': 'Route definitions',
      'schemas': 'Data schemas',
      'migrations': 'Database migrations',
      'seeds': 'Database seeds',
    };

    const topLevelDirs = new Set<string>();
    files.forEach(f => {
      const firstDir = f.split('/')[0];
      if (!f.includes('/') || !firstDir.includes('.')) {
        topLevelDirs.add(firstDir);
      }
    });

    topLevelDirs.forEach(dir => {
      const purpose = keyDirPatterns[dir.toLowerCase()];
      if (purpose) {
        const dirFiles = files.filter(f => f.startsWith(dir + '/') || f === dir);
        keyDirs.push({
          path: dir,
          purpose,
          contains: dirFiles.slice(0, 5),
        });
      }
    });

    return { root, keyDirectories: keyDirs };
  }

  /**
   * Detect programming languages
   */
  private detectLanguages(files: string[]): LanguageBreakdown[] {
    const extMap: Record<string, string> = {
      ts: 'TypeScript', tsx: 'TypeScript',
      js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript',
      py: 'Python',
      rs: 'Rust',
      go: 'Go',
      java: 'Java',
      rb: 'Ruby',
      php: 'PHP',
      cs: 'C#',
      cpp: 'C++', cc: 'C++', cxx: 'C++',
      c: 'C', h: 'C',
      swift: 'Swift',
      kt: 'Kotlin',
      scala: 'Scala',
      sql: 'SQL',
      sh: 'Shell', bash: 'Shell',
      css: 'CSS', scss: 'CSS', sass: 'CSS', less: 'CSS',
      html: 'HTML', htm: 'HTML',
      json: 'JSON',
      yaml: 'YAML', yml: 'YAML',
      md: 'Markdown', mdx: 'Markdown',
    };

    const counts: Record<string, number> = {};

    files.forEach(file => {
      const ext = file.split('.').pop()?.toLowerCase() || '';
      const lang = extMap[ext];
      if (lang) {
        counts[lang] = (counts[lang] || 0) + 1;
      }
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([language, fileCount]) => ({
        language,
        fileCount,
        percentage: Math.round((fileCount / total) * 100),
      }));
  }

  /**
   * Read key configuration files
   */
  private async readKeyFiles(files: string[]): Promise<Record<string, string>> {
    const keyFilePatterns = [
      'package.json',
      'tsconfig.json',
      'next.config.js', 'next.config.mjs', 'next.config.ts',
      'vite.config.ts', 'vite.config.js',
      'webpack.config.js',
      'requirements.txt', 'pyproject.toml', 'setup.py',
      'Cargo.toml',
      'go.mod',
      'Gemfile',
      'composer.json',
      '.eslintrc', '.eslintrc.js', '.eslintrc.json',
      '.prettierrc', '.prettierrc.js', '.prettierrc.json',
      'jest.config.js', 'jest.config.ts',
      'vitest.config.ts',
      '.github/workflows/ci.yml', '.github/workflows/main.yml',
      '.gitlab-ci.yml',
      'Dockerfile', 'docker-compose.yml',
      'README.md',
    ];

    const result: Record<string, string> = {};

    for (const pattern of keyFilePatterns) {
      const match = files.find(f =>
        f === pattern ||
        f.endsWith('/' + pattern) ||
        f.toLowerCase() === pattern.toLowerCase()
      );

      if (match) {
        try {
          const readResult = await readTool.execute({ path: match });
          if (readResult.success && readResult.result) {
            result[pattern] = readResult.result.content;
          }
        } catch {
          // Ignore read errors
        }
      }
    }

    return result;
  }

  /**
   * Detect framework
   */
  private detectFramework(keyFiles: Record<string, string>, languages: LanguageBreakdown[]): FrameworkInfo {
    const pkg = this.parseJson(keyFiles['package.json']) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null;
    const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };

    // TypeScript/JavaScript frameworks
    if (deps) {
      if (deps['next']) return { name: 'Next.js', version: deps['next'], type: 'fullstack', confidence: 0.95 };
      if (deps['react'] && deps['vite']) return { name: 'React + Vite', type: 'frontend', confidence: 0.9 };
      if (deps['react']) return { name: 'React', version: deps['react'], type: 'frontend', confidence: 0.85 };
      if (deps['vue']) return { name: 'Vue.js', version: deps['vue'], type: 'frontend', confidence: 0.9 };
      if (deps['svelte']) return { name: 'Svelte', type: 'frontend', confidence: 0.9 };
      if (deps['express']) return { name: 'Express', version: deps['express'], type: 'backend', confidence: 0.9 };
      if (deps['hono']) return { name: 'Hono', type: 'backend', confidence: 0.9 };
      if (deps['fastify']) return { name: 'Fastify', type: 'backend', confidence: 0.9 };
      if (deps['koa']) return { name: 'Koa', type: 'backend', confidence: 0.9 };
      if (deps['nest']) return { name: 'NestJS', type: 'backend', confidence: 0.9 };
    }

    // Python frameworks
    if (keyFiles['requirements.txt'] || keyFiles['pyproject.toml']) {
      const reqs = keyFiles['requirements.txt'] || keyFiles['pyproject.toml'];
      if (reqs.includes('django')) return { name: 'Django', type: 'fullstack', confidence: 0.9 };
      if (reqs.includes('flask')) return { name: 'Flask', type: 'backend', confidence: 0.9 };
      if (reqs.includes('fastapi')) return { name: 'FastAPI', type: 'backend', confidence: 0.9 };
    }

    // Rust
    if (keyFiles['Cargo.toml']) {
      const cargo = keyFiles['Cargo.toml'];
      if (cargo.includes('actix')) return { name: 'Actix Web', type: 'backend', confidence: 0.9 };
      if (cargo.includes('axum')) return { name: 'Axum', type: 'backend', confidence: 0.9 };
      if (cargo.includes('rocket')) return { name: 'Rocket', type: 'backend', confidence: 0.9 };
    }

    // Go
    if (keyFiles['go.mod']) {
      const gomod = keyFiles['go.mod'];
      if (gomod.includes('gin-gonic')) return { name: 'Gin', type: 'backend', confidence: 0.9 };
      if (gomod.includes('echo')) return { name: 'Echo', type: 'backend', confidence: 0.9 };
      if (gomod.includes('fiber')) return { name: 'Fiber', type: 'backend', confidence: 0.9 };
    }

    // Default based on language
    const primaryLang = languages[0]?.language;
    return {
      name: primaryLang || 'Unknown',
      type: 'other',
      confidence: 0.3,
    };
  }

  /**
   * Detect runtime
   */
  private detectRuntime(keyFiles: Record<string, string>): RuntimeInfo {
    if (keyFiles['package.json']) {
      const pkg = this.parseJson(keyFiles['package.json']) as { engines?: { node?: string } } | null;
      const packageManager = keyFiles['yarn.lock'] ? 'yarn' :
                            keyFiles['pnpm-lock.yaml'] ? 'pnpm' :
                            keyFiles['bun.lockb'] ? 'bun' : 'npm';
      return {
        name: 'Node.js',
        version: pkg?.engines?.node,
        packageManager,
      };
    }

    if (keyFiles['requirements.txt'] || keyFiles['pyproject.toml']) {
      return { name: 'Python', packageManager: 'pip' };
    }

    if (keyFiles['Cargo.toml']) {
      return { name: 'Rust', packageManager: 'cargo' };
    }

    if (keyFiles['go.mod']) {
      return { name: 'Go', packageManager: 'go' };
    }

    return { name: 'Unknown', packageManager: 'unknown' };
  }

  /**
   * Analyze architecture
   */
  private async analyzeArchitecture(
    files: string[],
    _keyFiles: Record<string, string>,
    _onStream: AgentStreamCallback
  ): Promise<ArchitectureInfo> {
    // Detect common patterns
    const hasPages = files.some(f => f.includes('/pages/') || f.startsWith('pages/'));
    const hasApp = files.some(f => f.includes('/app/') || f.startsWith('app/'));
    const hasControllers = files.some(f => f.includes('/controllers/'));
    const hasModels = files.some(f => f.includes('/models/'));
    const hasServices = files.some(f => f.includes('/services/'));
    const hasRepositories = files.some(f => f.includes('/repositories/'));
    const hasUseCases = files.some(f => f.includes('/usecases/') || f.includes('/use-cases/'));
    const hasDomain = files.some(f => f.includes('/domain/'));

    // Detect entry points
    const entryPoints: string[] = [];
    const entryPatterns = ['index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js', 'server.ts', 'server.js'];
    files.forEach(f => {
      const filename = f.split('/').pop() || '';
      if (entryPatterns.includes(filename)) {
        entryPoints.push(f);
      }
    });

    // Determine pattern
    let pattern = 'Flat';
    let layers: string[] = [];
    let dataFlow = 'Simple';

    if (hasUseCases || hasDomain) {
      pattern = 'Clean Architecture';
      layers = ['Domain', 'Use Cases', 'Interface Adapters', 'Frameworks'];
      dataFlow = 'Request → Controller → Use Case → Entity → Response';
    } else if (hasRepositories && hasServices) {
      pattern = 'Repository Pattern';
      layers = ['Controllers', 'Services', 'Repositories', 'Models'];
      dataFlow = 'Request → Controller → Service → Repository → Database';
    } else if (hasControllers && hasModels) {
      pattern = 'MVC';
      layers = ['Controllers', 'Models', 'Views'];
      dataFlow = 'Request → Controller → Model → View → Response';
    } else if (hasApp && !hasPages) {
      pattern = 'Next.js App Router';
      layers = ['App Routes', 'Components', 'Server Actions'];
      dataFlow = 'Route → Server Component → Client Component';
    } else if (hasPages) {
      pattern = 'Next.js Pages Router';
      layers = ['Pages', 'Components', 'API Routes'];
      dataFlow = 'Page → getServerSideProps → Component';
    } else if (hasServices) {
      pattern = 'Service-Oriented';
      layers = ['Routes', 'Services', 'Data'];
      dataFlow = 'Request → Route → Service → Response';
    }

    return {
      pattern,
      layers,
      entryPoints,
      dataFlow,
    };
  }

  /**
   * Detect coding conventions
   */
  private async detectConventions(
    keyFiles: Record<string, string>,
    files: string[]
  ): Promise<CodingConventions> {
    // Check ESLint/Prettier configs
    // eslint config reserved for future enhanced style detection
    const prettier = keyFiles['.prettierrc'] || keyFiles['.prettierrc.js'] || keyFiles['.prettierrc.json'];

    let quotes: 'single' | 'double' | 'mixed' = 'single';
    let semicolons = true;
    let trailingComma = true;
    let indentation: 'tabs' | 'spaces' = 'spaces';
    let indentSize = 2;

    if (prettier) {
      const prettierConfig = this.parseJson(prettier);
      if (prettierConfig) {
        quotes = prettierConfig.singleQuote ? 'single' : 'double';
        semicolons = prettierConfig.semi !== false;
        trailingComma = prettierConfig.trailingComma !== 'none';
        indentation = prettierConfig.useTabs ? 'tabs' : 'spaces';
        indentSize = (prettierConfig.tabWidth as number) || 2;
      }
    }

    // Detect naming style from file names
    const srcFiles = files.filter(f => f.includes('/src/') || f.startsWith('src/'));
    let namingStyle: CodingConventions['namingStyle'] = 'camelCase';

    const fileNames = srcFiles.map(f => f.split('/').pop()?.replace(/\.[^.]+$/, '') || '');
    const hasSnakeCase = fileNames.some(f => f.includes('_'));
    const hasPascalCase = fileNames.some(f => /^[A-Z]/.test(f));
    const hasKebabCase = fileNames.some(f => f.includes('-'));

    if (hasSnakeCase && !hasPascalCase && !hasKebabCase) namingStyle = 'snake_case';
    else if (hasPascalCase && !hasSnakeCase && !hasKebabCase) namingStyle = 'PascalCase';
    else if (hasKebabCase && !hasSnakeCase && !hasPascalCase) namingStyle = 'kebab-case';
    else if ((hasSnakeCase || hasPascalCase || hasKebabCase)) namingStyle = 'mixed';

    // Detect component style (for React projects)
    let componentStyle: 'functional' | 'class' | 'mixed' | undefined;
    const componentFiles = files.filter(f =>
      f.includes('/components/') ||
      f.endsWith('.tsx') ||
      f.endsWith('.jsx')
    );

    if (componentFiles.length > 0) {
      componentStyle = 'functional'; // Default to functional (modern standard)
    }

    // Detect export style
    const exportStyle: 'named' | 'default' | 'mixed' = 'named';

    return {
      namingStyle,
      indentation,
      indentSize,
      quotes,
      semicolons,
      trailingComma,
      componentStyle,
      exportStyle,
    };
  }

  /**
   * Analyze dependencies
   */
  private analyzeDependencies(keyFiles: Record<string, string>): DependencyInfo {
    const pkg = this.parseJson(keyFiles['package.json']);

    const runtime: DependencyEntry[] = [];
    const dev: DependencyEntry[] = [];

    if (pkg?.dependencies) {
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        runtime.push({ name, version: String(version) });
      }
    }

    if (pkg?.devDependencies) {
      for (const [name, version] of Object.entries(pkg.devDependencies)) {
        dev.push({ name, version: String(version) });
      }
    }

    return {
      runtime,
      dev,
      hasCriticalVulnerabilities: false,  // Would need npm audit
      outdatedCount: 0,  // Would need npm outdated
    };
  }

  /**
   * Detect test setup
   */
  private detectTestSetup(files: string[], keyFiles: Record<string, string>): { hasTests: boolean; testFramework?: string } {
    const testFiles = files.filter(f =>
      f.includes('.test.') ||
      f.includes('.spec.') ||
      f.includes('__tests__/')
    );

    const hasTests = testFiles.length > 0;
    let testFramework: string | undefined;

    if (keyFiles['jest.config.js'] || keyFiles['jest.config.ts']) {
      testFramework = 'Jest';
    } else if (keyFiles['vitest.config.ts']) {
      testFramework = 'Vitest';
    } else {
      const pkg = this.parseJson(keyFiles['package.json']) as { devDependencies?: Record<string, string> } | null;
      if (pkg?.devDependencies?.jest) testFramework = 'Jest';
      else if (pkg?.devDependencies?.vitest) testFramework = 'Vitest';
      else if (pkg?.devDependencies?.mocha) testFramework = 'Mocha';
    }

    return { hasTests, testFramework };
  }

  /**
   * Detect CI setup
   */
  private detectCiSetup(files: string[]): { hasCi: boolean; ciPlatform?: string } {
    const hasGitHubActions = files.some(f => f.includes('.github/workflows/'));
    const hasGitLabCi = files.some(f => f === '.gitlab-ci.yml');
    const hasCircleCi = files.some(f => f.includes('.circleci/'));

    if (hasGitHubActions) return { hasCi: true, ciPlatform: 'GitHub Actions' };
    if (hasGitLabCi) return { hasCi: true, ciPlatform: 'GitLab CI' };
    if (hasCircleCi) return { hasCi: true, ciPlatform: 'CircleCI' };

    return { hasCi: false };
  }

  /**
   * Generate insights
   */
  private async generateInsights(
    _structure: DirectoryStructure,
    framework: FrameworkInfo,
    architecture: ArchitectureInfo,
    dependencies: DependencyInfo,
    hasTests: boolean,
    _onStream: AgentStreamCallback
  ): Promise<CodebaseInsight[]> {
    const insights: CodebaseInsight[] = [];

    // Test coverage
    if (!hasTests) {
      insights.push({
        type: 'weakness',
        title: 'No Tests Detected',
        description: 'No test files found. Consider adding unit and integration tests.',
        severity: 'high',
      });
    }

    // Dependency count
    if (dependencies.runtime.length > 50) {
      insights.push({
        type: 'threat',
        title: 'High Dependency Count',
        description: `${dependencies.runtime.length} runtime dependencies may increase bundle size and security risk.`,
        severity: 'medium',
      });
    }

    // Architecture
    if (architecture.pattern === 'Flat') {
      insights.push({
        type: 'opportunity',
        title: 'Architecture Improvement',
        description: 'Consider organizing code into layers (services, controllers, models) for better maintainability.',
        severity: 'low',
      });
    }

    // Framework confidence
    if (framework.confidence > 0.9) {
      insights.push({
        type: 'strength',
        title: 'Modern Framework',
        description: `Using ${framework.name} - a well-supported, modern framework.`,
      });
    }

    return insights;
  }

  /**
   * Generate improvement suggestions
   */
  private generateImprovements(insights: CodebaseInsight[]): string[] {
    return insights
      .filter(i => i.type === 'weakness' || i.type === 'opportunity')
      .map(i => i.description);
  }

  /**
   * Detect common patterns
   */
  private detectPatterns(files: string[]): string[] {
    const patterns: string[] = [];

    if (files.some(f => f.includes('/hooks/'))) patterns.push('Custom Hooks');
    if (files.some(f => f.includes('/context/'))) patterns.push('React Context');
    if (files.some(f => f.includes('/store/'))) patterns.push('State Management');
    if (files.some(f => f.includes('/hoc/') || f.includes('withAuth'))) patterns.push('Higher-Order Components');
    if (files.some(f => f.includes('/middleware/'))) patterns.push('Middleware Pattern');
    if (files.some(f => f.includes('/factories/'))) patterns.push('Factory Pattern');
    if (files.some(f => f.includes('/adapters/'))) patterns.push('Adapter Pattern');
    if (files.some(f => f.includes('/observers/'))) patterns.push('Observer Pattern');

    return patterns;
  }

  /**
   * Extract project name
   */
  private extractProjectName(keyFiles: Record<string, string>): string {
    const pkg = this.parseJson(keyFiles['package.json']) as { name?: string } | null;
    return pkg?.name || 'unknown';
  }

  /**
   * Extract description
   */
  private extractDescription(keyFiles: Record<string, string>): string {
    const pkg = this.parseJson(keyFiles['package.json']) as { description?: string } | null;
    return pkg?.description || '';
  }

  /**
   * Parse JSON safely
   */
  private parseJson(content?: string): Record<string, unknown> | null {
    if (!content) return null;
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

export const codebaseAnalyzer = new CodebaseAnalyzer();
