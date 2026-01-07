/**
 * CODE GENERATOR
 *
 * The third stage of the Code Agent brain.
 * Actually writes the code files based on the plan.
 *
 * Uses Opus 4.5 for maximum code quality.
 * Generates each file with full context awareness.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  CodeIntent,
  ProjectPlan,
  PlannedFile,
  GeneratedFile,
} from '../../core/types';
import type { AgentStreamCallback } from '../../core/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export class CodeGenerator {
  // Claude Opus 4.5 for high-quality code generation
  private model = 'claude-opus-4-5-20251101';

  // Already generated files (for context)
  private generatedFiles: Map<string, GeneratedFile> = new Map();

  /**
   * Generate all files for a project
   */
  async generateAll(
    intent: CodeIntent,
    plan: ProjectPlan,
    onStream?: AgentStreamCallback
  ): Promise<GeneratedFile[]> {
    this.generatedFiles.clear();
    const files: GeneratedFile[] = [];

    // Sort files by priority (config first, then source)
    const sortedFiles = [...plan.fileTree].sort((a, b) => a.priority - b.priority);

    for (const plannedFile of sortedFiles) {
      onStream?.({
        type: 'thinking',
        message: `Generating: ${plannedFile.path}`,
        progress: Math.round((files.length / sortedFiles.length) * 100),
        phase: 'Code Generation',
        timestamp: Date.now(),
      });

      const generated = await this.generateFile(plannedFile, intent, plan);
      files.push(generated);
      this.generatedFiles.set(generated.path, generated);
    }

    return files;
  }

  /**
   * Generate a single file with full context
   */
  async generateFile(
    file: PlannedFile,
    intent: CodeIntent,
    plan: ProjectPlan
  ): Promise<GeneratedFile> {
    // Get context from already-generated dependencies
    const dependencyContext = file.dependencies
      .map(dep => {
        const depFile = this.generatedFiles.get(dep);
        if (depFile) {
          return `// ${dep}\n${depFile.content.substring(0, 2000)}${depFile.content.length > 2000 ? '\n// ... (truncated)' : ''}`;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n\n');

    // Detect language from file extension
    const language = this.detectLanguage(file.path);

    // Special handling for config files
    if (file.isConfig) {
      return this.generateConfigFile(file, intent, plan, language);
    }

    const prompt = `You are a senior software engineer writing production-quality code. Generate the complete file content.

PROJECT: ${plan.name}
DESCRIPTION: ${intent.refinedDescription}

FILE TO GENERATE:
- Path: ${file.path}
- Purpose: ${file.purpose}
- Language: ${language}
- Estimated lines: ${file.estimatedLines}

TECHNOLOGY STACK:
- Primary: ${intent.technologies.primary}
- Secondary: ${intent.technologies.secondary.join(', ')}
- Package Manager: ${intent.technologies.packageManager}

${dependencyContext ? `DEPENDENCY FILES (already generated):\n${dependencyContext}\n` : ''}

PROJECT STRUCTURE:
${plan.fileTree.map(f => `- ${f.path}: ${f.purpose}`).join('\n')}

DEPENDENCIES AVAILABLE:
${Object.entries(plan.dependencies.production).map(([k, v]) => `- ${k}@${v}`).join('\n')}

REQUIREMENTS:
${intent.requirements.functional.map(r => `- ${r}`).join('\n')}

Generate the COMPLETE file content. Follow these rules:
1. Write PRODUCTION-QUALITY code - no placeholders, no "TODO" comments
2. Include proper error handling
3. Use TypeScript best practices (if applicable)
4. Add JSDoc comments for public functions/classes
5. Use modern syntax (ES2020+, async/await, etc.)
6. Import only from declared dependencies
7. Make the code actually work - not a skeleton
8. If this is an entry point, make it runnable

OUTPUT ONLY THE FILE CONTENT - no markdown code blocks, no explanations.
START WITH THE FIRST LINE OF THE FILE.`;

    try {
      const response = await anthropic.messages.create({
        model: this.model,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });

      let content = response.content[0].type === 'text' ? response.content[0].text : '';

      // Clean up any markdown code blocks that might have slipped through
      content = this.cleanCodeContent(content, language);

      return {
        path: file.path,
        content,
        language,
        purpose: file.purpose,
        linesOfCode: content.split('\n').length,
        generatedAt: Date.now(),
        version: 1,
      };
    } catch (error) {
      console.error(`[CodeGenerator] Error generating ${file.path}:`, error);
      return this.createPlaceholderFile(file, language);
    }
  }

  /**
   * Generate configuration files (package.json, tsconfig, etc.)
   */
  private async generateConfigFile(
    file: PlannedFile,
    intent: CodeIntent,
    plan: ProjectPlan,
    language: string
  ): Promise<GeneratedFile> {
    const filename = file.path.split('/').pop() || file.path;

    // Handle specific config files directly
    if (filename === 'package.json') {
      return this.generatePackageJson(file, intent, plan);
    }

    if (filename === 'tsconfig.json') {
      return this.generateTsConfig(file);
    }

    if (filename === '.gitignore') {
      return this.generateGitignore(file, intent);
    }

    // For other config files, use the LLM
    const prompt = `Generate the ${filename} configuration file for a ${intent.technologies.primary} project.

PROJECT: ${plan.name}
DESCRIPTION: ${intent.refinedDescription}
DEPENDENCIES: ${Object.keys(plan.dependencies.production).join(', ')}

Generate a standard, well-configured ${filename} file.
OUTPUT ONLY THE FILE CONTENT - no markdown, no explanations.`;

    try {
      const response = await anthropic.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      let content = response.content[0].type === 'text' ? response.content[0].text : '';
      content = this.cleanCodeContent(content, language);

      return {
        path: file.path,
        content,
        language,
        purpose: file.purpose,
        linesOfCode: content.split('\n').length,
        generatedAt: Date.now(),
        version: 1,
      };
    } catch (error) {
      console.error(`[CodeGenerator] Error generating ${file.path}:`, error);
      return this.createPlaceholderFile(file, language);
    }
  }

  /**
   * Generate package.json
   */
  private generatePackageJson(
    file: PlannedFile,
    intent: CodeIntent,
    plan: ProjectPlan
  ): GeneratedFile {
    const isTypescript = intent.technologies.primary.toLowerCase().includes('typescript');

    const packageJson = {
      name: plan.name,
      version: '1.0.0',
      description: plan.description,
      main: isTypescript ? 'dist/index.js' : 'src/index.js',
      type: 'module',
      scripts: {
        ...(isTypescript ? {
          build: 'tsc',
          dev: 'tsx watch src/index.ts',
          start: 'node dist/index.js',
        } : {
          start: 'node src/index.js',
          dev: 'node --watch src/index.js',
        }),
        test: intent.technologies.testFramework ? `${intent.technologies.testFramework}` : 'echo "No tests specified"',
      },
      keywords: [],
      author: '',
      license: 'MIT',
      dependencies: plan.dependencies.production,
      devDependencies: {
        ...plan.dependencies.development,
        ...(isTypescript && !plan.dependencies.development['typescript'] ? {
          typescript: '^5.0.0',
          '@types/node': '^20.0.0',
          tsx: '^4.0.0',
        } : {}),
      },
    };

    const content = JSON.stringify(packageJson, null, 2);

    return {
      path: file.path,
      content,
      language: 'json',
      purpose: file.purpose,
      linesOfCode: content.split('\n').length,
      generatedAt: Date.now(),
      version: 1,
    };
  }

  /**
   * Generate tsconfig.json
   */
  private generateTsConfig(file: PlannedFile): GeneratedFile {
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        lib: ['ES2022'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    };

    const content = JSON.stringify(tsconfig, null, 2);

    return {
      path: file.path,
      content,
      language: 'json',
      purpose: file.purpose,
      linesOfCode: content.split('\n').length,
      generatedAt: Date.now(),
      version: 1,
    };
  }

  /**
   * Generate .gitignore
   */
  private generateGitignore(file: PlannedFile, intent: CodeIntent): GeneratedFile {
    const isNode = intent.technologies.runtime === 'node';
    const isPython = intent.technologies.runtime === 'python';

    const lines = [
      '# Dependencies',
      isNode ? 'node_modules/' : '',
      isPython ? 'venv/' : '',
      isPython ? '__pycache__/' : '',
      isPython ? '*.pyc' : '',
      '',
      '# Build outputs',
      'dist/',
      'build/',
      '.next/',
      'out/',
      '',
      '# Environment',
      '.env',
      '.env.local',
      '.env*.local',
      '',
      '# IDE',
      '.idea/',
      '.vscode/',
      '*.swp',
      '*.swo',
      '.DS_Store',
      '',
      '# Logs',
      'logs/',
      '*.log',
      'npm-debug.log*',
      '',
      '# Test coverage',
      'coverage/',
      '.nyc_output/',
      '',
      '# Misc',
      '*.tmp',
      '*.temp',
    ].filter(line => line !== '').join('\n');

    return {
      path: file.path,
      content: lines,
      language: 'gitignore',
      purpose: file.purpose,
      linesOfCode: lines.split('\n').length,
      generatedAt: Date.now(),
      version: 1,
    };
  }

  /**
   * Regenerate a single file (for error fixing)
   */
  async regenerateFile(
    file: GeneratedFile,
    error: string,
    intent: CodeIntent
  ): Promise<GeneratedFile> {
    const prompt = `You are a senior software engineer fixing a code error.

ORIGINAL FILE: ${file.path}
\`\`\`${file.language}
${file.content}
\`\`\`

ERROR:
${error}

PROJECT CONTEXT:
- ${intent.refinedDescription}
- Technologies: ${intent.technologies.primary}

Fix the error and regenerate the COMPLETE file.
OUTPUT ONLY THE FIXED FILE CONTENT - no markdown code blocks, no explanations.`;

    try {
      const response = await anthropic.messages.create({
        model: this.model,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });

      let content = response.content[0].type === 'text' ? response.content[0].text : '';
      content = this.cleanCodeContent(content, file.language);

      return {
        ...file,
        content,
        linesOfCode: content.split('\n').length,
        generatedAt: Date.now(),
        version: file.version + 1,
      };
    } catch (err) {
      console.error(`[CodeGenerator] Error regenerating ${file.path}:`, err);
      return file; // Return original if regeneration fails
    }
  }

  /**
   * Detect language from file path
   */
  private detectLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      json: 'json',
      md: 'markdown',
      yaml: 'yaml',
      yml: 'yaml',
      sh: 'bash',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sql: 'sql',
    };
    return langMap[ext] || 'text';
  }

  /**
   * Clean up code content (remove markdown code blocks, etc.)
   */
  private cleanCodeContent(content: string, language: string): string {
    // Remove markdown code blocks if present
    const codeBlockPattern = new RegExp(`\`\`\`(?:${language}|\\w+)?\\n?([\\s\\S]*?)\\n?\`\`\``, 'i');
    const match = content.match(codeBlockPattern);
    if (match) {
      content = match[1];
    }

    // Remove leading/trailing whitespace
    content = content.trim();

    // Ensure file ends with newline
    if (!content.endsWith('\n')) {
      content += '\n';
    }

    return content;
  }

  /**
   * Create placeholder file if generation fails
   */
  private createPlaceholderFile(file: PlannedFile, language: string): GeneratedFile {
    const comment = language === 'python' ? '#' : '//';
    const content = `${comment} ${file.path}\n${comment} Purpose: ${file.purpose}\n${comment} TODO: Implementation failed, needs manual creation\n`;

    return {
      path: file.path,
      content,
      language,
      purpose: file.purpose,
      linesOfCode: 4,
      generatedAt: Date.now(),
      version: 1,
    };
  }

  /**
   * Clear generated files cache
   */
  clearCache(): void {
    this.generatedFiles.clear();
  }
}

export const codeGenerator = new CodeGenerator();
