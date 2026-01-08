/**
 * CODE TRANSLATOR
 *
 * Convert entire projects between programming languages.
 *
 * Features:
 * - Full project translation
 * - Preserve functionality and logic
 * - Idiomatic code generation
 * - Dependency mapping
 * - Type system translation
 * - Framework equivalents
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('CodeTranslator');

// ============================================
// TYPES
// ============================================

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin';

export type Framework =
  | 'nextjs'
  | 'react'
  | 'vue'
  | 'angular'
  | 'express'
  | 'fastapi'
  | 'django'
  | 'flask'
  | 'gin'
  | 'actix'
  | 'spring';

export interface TranslationRequest {
  sourceLanguage: Language;
  targetLanguage: Language;
  sourceFramework?: Framework;
  targetFramework?: Framework;
  preserveComments?: boolean;
  preserveTests?: boolean;
  generateTypes?: boolean;
}

export interface TranslatedFile {
  originalPath: string;
  newPath: string;
  originalContent: string;
  translatedContent: string;
  language: Language;
  confidence: number;
  notes: string[];
  manualReviewRequired: boolean;
}

export interface TranslationResult {
  success: boolean;
  files: TranslatedFile[];
  dependencyMapping: DependencyMapping;
  configFiles: ConfigFile[];
  migrationGuide: string;
  warnings: string[];
  estimatedEffort: string;
}

export interface DependencyMapping {
  original: Dependency[];
  translated: Dependency[];
  unmapped: string[];
}

export interface Dependency {
  name: string;
  version: string;
  equivalent?: string;
  notes?: string;
}

export interface ConfigFile {
  path: string;
  content: string;
  description: string;
}

// ============================================
// LANGUAGE MAPPINGS
// ============================================

const FILE_EXTENSIONS: Record<Language, string> = {
  typescript: '.ts',
  javascript: '.js',
  python: '.py',
  go: '.go',
  rust: '.rs',
  java: '.java',
  csharp: '.cs',
  ruby: '.rb',
  php: '.php',
  swift: '.swift',
  kotlin: '.kt',
};

const DEPENDENCY_EQUIVALENTS: Record<string, Record<Language, string>> = {
  // HTTP clients
  axios: {
    typescript: 'axios',
    javascript: 'axios',
    python: 'httpx',
    go: 'net/http',
    rust: 'reqwest',
    java: 'OkHttp',
    csharp: 'HttpClient',
    ruby: 'faraday',
    php: 'guzzle',
    swift: 'URLSession',
    kotlin: 'ktor-client',
  },
  // Testing
  jest: {
    typescript: 'jest',
    javascript: 'jest',
    python: 'pytest',
    go: 'testing',
    rust: 'cargo test',
    java: 'JUnit',
    csharp: 'xUnit',
    ruby: 'rspec',
    php: 'phpunit',
    swift: 'XCTest',
    kotlin: 'kotlin.test',
  },
  // Date handling
  dayjs: {
    typescript: 'dayjs',
    javascript: 'dayjs',
    python: 'pendulum',
    go: 'time',
    rust: 'chrono',
    java: 'java.time',
    csharp: 'NodaTime',
    ruby: 'activesupport',
    php: 'carbon',
    swift: 'Foundation.Date',
    kotlin: 'kotlinx-datetime',
  },
  // Validation
  zod: {
    typescript: 'zod',
    javascript: 'zod',
    python: 'pydantic',
    go: 'validator',
    rust: 'serde',
    java: 'Bean Validation',
    csharp: 'FluentValidation',
    ruby: 'dry-validation',
    php: 'symfony/validator',
    swift: 'Codable',
    kotlin: 'kotlinx.serialization',
  },
};

// ============================================
// CODE TRANSLATOR CLASS
// ============================================

export class CodeTranslator {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Translate an entire project
   */
  async translateProject(
    files: Array<{ path: string; content: string }>,
    request: TranslationRequest
  ): Promise<TranslationResult> {
    log.info('Translating files', { fileCount: files.length, from: request.sourceLanguage, to: request.targetLanguage });

    const translatedFiles: TranslatedFile[] = [];
    const warnings: string[] = [];

    // Filter translatable files
    const codeFiles = files.filter(f =>
      f.path.endsWith(FILE_EXTENSIONS[request.sourceLanguage]) ||
      f.path.endsWith('.tsx') ||
      f.path.endsWith('.jsx')
    );

    // Translate each file
    for (const file of codeFiles) {
      try {
        const translated = await this.translateFile(file, request);
        translatedFiles.push(translated);

        if (translated.manualReviewRequired) {
          warnings.push(`${file.path}: Manual review recommended - ${translated.notes.join(', ')}`);
        }
      } catch (error) {
        warnings.push(`${file.path}: Translation failed - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Map dependencies
    const dependencyMapping = await this.mapDependencies(files, request);

    // Generate config files
    const configFiles = this.generateConfigFiles(request);

    // Generate migration guide
    const migrationGuide = await this.generateMigrationGuide(
      request,
      translatedFiles,
      dependencyMapping
    );

    return {
      success: translatedFiles.length > 0,
      files: translatedFiles,
      dependencyMapping,
      configFiles,
      migrationGuide,
      warnings,
      estimatedEffort: this.estimateEffort(translatedFiles),
    };
  }

  /**
   * Translate a single file
   */
  async translateFile(
    file: { path: string; content: string },
    request: TranslationRequest
  ): Promise<TranslatedFile> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16384,
        system: `You are an expert polyglot programmer. Translate code from ${request.sourceLanguage} to ${request.targetLanguage}.

RULES:
1. Preserve ALL functionality and logic
2. Use IDIOMATIC ${request.targetLanguage} patterns
3. Translate types appropriately
4. Use equivalent standard library functions
5. Maintain code organization
6. ${request.preserveComments ? 'Preserve comments' : 'Remove unnecessary comments'}
7. ${request.generateTypes ? 'Add type annotations' : 'Use type inference where possible'}

For ${request.targetLanguage}:
${this.getLanguageGuide(request.targetLanguage)}

Return JSON:
{
  "code": "translated code",
  "confidence": 0.0-1.0,
  "notes": ["any translation notes"],
  "manualReviewRequired": true/false
}`,
        messages: [
          {
            role: 'user',
            content: `Translate this ${request.sourceLanguage} file to ${request.targetLanguage}:

File: ${file.path}

\`\`\`${request.sourceLanguage}
${file.content}
\`\`\``,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      // Try to parse JSON response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          originalPath: file.path,
          newPath: this.translatePath(file.path, request),
          originalContent: file.content,
          translatedContent: result.code,
          language: request.targetLanguage,
          confidence: result.confidence || 0.8,
          notes: result.notes || [],
          manualReviewRequired: result.manualReviewRequired || false,
        };
      }

      // Fallback: extract code block
      const codeMatch = content.text.match(/```[\w]*\n([\s\S]*?)\n```/);
      const code = codeMatch ? codeMatch[1] : content.text;

      return {
        originalPath: file.path,
        newPath: this.translatePath(file.path, request),
        originalContent: file.content,
        translatedContent: code,
        language: request.targetLanguage,
        confidence: 0.7,
        notes: ['Confidence estimated - JSON parsing failed'],
        manualReviewRequired: true,
      };
    } catch (error) {
      log.error('Translation error', error as Error, { filePath: file.path });
      throw error;
    }
  }

  /**
   * Translate file path to new extension
   */
  private translatePath(path: string, request: TranslationRequest): string {
    const sourceExt = FILE_EXTENSIONS[request.sourceLanguage];
    const targetExt = FILE_EXTENSIONS[request.targetLanguage];

    // Handle TypeScript -> other
    if (request.sourceLanguage === 'typescript') {
      return path
        .replace('.tsx', targetExt)
        .replace('.ts', targetExt);
    }

    return path.replace(new RegExp(`${sourceExt}$`), targetExt);
  }

  /**
   * Map dependencies to target language equivalents
   */
  private async mapDependencies(
    files: Array<{ path: string; content: string }>,
    request: TranslationRequest
  ): Promise<DependencyMapping> {
    // Find package.json or equivalent
    const packageJson = files.find(f => f.path.endsWith('package.json'));
    // Future: Add support for requirements.txt, Cargo.toml, go.mod

    const original: Dependency[] = [];
    const translated: Dependency[] = [];
    const unmapped: string[] = [];

    // Parse dependencies based on source language
    if (packageJson && (request.sourceLanguage === 'typescript' || request.sourceLanguage === 'javascript')) {
      try {
        const pkg = JSON.parse(packageJson.content);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        for (const [name, version] of Object.entries(deps)) {
          original.push({ name, version: version as string });

          // Find equivalent
          const equivalent = DEPENDENCY_EQUIVALENTS[name]?.[request.targetLanguage];
          if (equivalent) {
            translated.push({
              name: equivalent,
              version: 'latest',
              notes: `Equivalent of ${name}`,
            });
          } else {
            unmapped.push(name);
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    return { original, translated, unmapped };
  }

  /**
   * Generate configuration files for target language
   */
  private generateConfigFiles(request: TranslationRequest): ConfigFile[] {
    const configs: ConfigFile[] = [];

    switch (request.targetLanguage) {
      case 'python':
        configs.push({
          path: 'requirements.txt',
          content: '# Generated requirements\n# Add your dependencies here',
          description: 'Python dependencies',
        });
        configs.push({
          path: 'pyproject.toml',
          content: `[build-system]
requires = ["setuptools>=45", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "translated-project"
version = "0.1.0"
requires-python = ">=3.9"`,
          description: 'Python project configuration',
        });
        break;

      case 'go':
        configs.push({
          path: 'go.mod',
          content: `module translated-project

go 1.21`,
          description: 'Go module file',
        });
        break;

      case 'rust':
        configs.push({
          path: 'Cargo.toml',
          content: `[package]
name = "translated-project"
version = "0.1.0"
edition = "2021"

[dependencies]
# Add dependencies here`,
          description: 'Rust package configuration',
        });
        break;

      case 'java':
        configs.push({
          path: 'pom.xml',
          content: `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>translated-project</artifactId>
  <version>0.1.0</version>
</project>`,
          description: 'Maven configuration',
        });
        break;
    }

    return configs;
  }

  /**
   * Generate migration guide
   */
  private async generateMigrationGuide(
    request: TranslationRequest,
    files: TranslatedFile[],
    deps: DependencyMapping
  ): Promise<string> {
    const lowConfidence = files.filter(f => f.confidence < 0.8);
    const manualReview = files.filter(f => f.manualReviewRequired);

    let guide = `# Migration Guide: ${request.sourceLanguage} → ${request.targetLanguage}\n\n`;

    guide += `## Overview\n\n`;
    guide += `- **Files translated**: ${files.length}\n`;
    guide += `- **Average confidence**: ${(files.reduce((sum, f) => sum + f.confidence, 0) / files.length * 100).toFixed(1)}%\n`;
    guide += `- **Requires manual review**: ${manualReview.length}\n\n`;

    guide += `## Dependency Changes\n\n`;
    guide += `| Original | Replacement |\n`;
    guide += `|----------|-------------|\n`;
    for (const dep of deps.translated) {
      guide += `| ${dep.notes?.split(' ').pop()} | ${dep.name} |\n`;
    }
    if (deps.unmapped.length > 0) {
      guide += `\n**Unmapped dependencies** (need manual equivalents):\n`;
      deps.unmapped.forEach(d => guide += `- ${d}\n`);
    }

    if (lowConfidence.length > 0) {
      guide += `\n## Files Needing Review\n\n`;
      for (const file of lowConfidence) {
        guide += `### ${file.newPath}\n`;
        guide += `- Confidence: ${(file.confidence * 100).toFixed(0)}%\n`;
        guide += `- Notes: ${file.notes.join(', ')}\n\n`;
      }
    }

    guide += `\n## Next Steps\n\n`;
    guide += `1. Install ${request.targetLanguage} dependencies\n`;
    guide += `2. Review files flagged for manual review\n`;
    guide += `3. Run tests to verify functionality\n`;
    guide += `4. Update import paths as needed\n`;
    guide += `5. Fix any compiler/interpreter errors\n`;

    return guide;
  }

  /**
   * Get language-specific guide
   */
  private getLanguageGuide(lang: Language): string {
    const guides: Record<Language, string> = {
      typescript: 'Use proper type annotations. Prefer interfaces over types. Use async/await.',
      javascript: 'Use modern ES6+ syntax. Use const/let, arrow functions, destructuring.',
      python: 'Use type hints (Python 3.9+). Follow PEP 8. Use dataclasses for DTOs.',
      go: 'Use proper error handling (if err != nil). Use structs. Follow Go conventions.',
      rust: 'Use Result<T, E> for errors. Use ownership properly. Implement traits.',
      java: 'Use proper OOP patterns. Use Optional<T>. Use streams for collections.',
      csharp: 'Use async/await. Use LINQ. Follow .NET naming conventions.',
      ruby: 'Use blocks and iterators. Follow Ruby style guide. Use symbols.',
      php: 'Use PHP 8+ features. Use type declarations. Follow PSR standards.',
      swift: 'Use optionals properly. Use protocols. Follow Swift API design guidelines.',
      kotlin: 'Use null safety. Use data classes. Use coroutines for async.',
    };

    return guides[lang] || '';
  }

  /**
   * Estimate effort for manual review
   */
  private estimateEffort(files: TranslatedFile[]): string {
    const totalLines = files.reduce((sum, f) => sum + f.translatedContent.split('\n').length, 0);
    const lowConfidenceFiles = files.filter(f => f.confidence < 0.8).length;

    if (totalLines < 500 && lowConfidenceFiles < 3) return '1-2 hours';
    if (totalLines < 2000 && lowConfidenceFiles < 10) return '4-8 hours';
    if (totalLines < 10000) return '1-3 days';
    return '1-2 weeks';
  }

  /**
   * Translate a single code snippet (for quick translations)
   */
  async translateSnippet(
    code: string,
    sourceLanguage: Language,
    targetLanguage: Language
  ): Promise<string> {
    const result = await this.translateFile(
      { path: `snippet${FILE_EXTENSIONS[sourceLanguage]}`, content: code },
      { sourceLanguage, targetLanguage }
    );
    return result.translatedContent;
  }
}

// ============================================
// EXPORTS
// ============================================

export const codeTranslator = new CodeTranslator();

/**
 * Quick function to translate a project
 */
export async function translateProject(
  files: Array<{ path: string; content: string }>,
  from: Language,
  to: Language
): Promise<TranslationResult> {
  return codeTranslator.translateProject(files, {
    sourceLanguage: from,
    targetLanguage: to,
  });
}

/**
 * Quick function to translate a snippet
 */
export async function translateCode(
  code: string,
  from: Language,
  to: Language
): Promise<string> {
  return codeTranslator.translateSnippet(code, from, to);
}
