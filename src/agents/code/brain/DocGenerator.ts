/**
 * DOCUMENTATION GENERATOR
 *
 * Automatically generates comprehensive documentation.
 *
 * Generates:
 * - README.md with badges, installation, usage
 * - API documentation
 * - JSDoc/TSDoc comments
 * - Architecture diagrams (mermaid)
 * - Change logs
 * - Contributing guidelines
 *
 * This is what makes code maintainable.
 */

import { agentChat, ProviderId } from '@/lib/ai/providers';
import { GeneratedFile, CodeIntent, ProjectPlan } from '../../core/types';
import { AgentStreamCallback } from '../../core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface DocumentationResult {
  files: GeneratedFile[];
  readme: string;
  apiDocs?: string;
  architecture?: string;
  changelog?: string;
  contributing?: string;
}

export interface DocConfig {
  includeReadme: boolean;
  includeApiDocs: boolean;
  includeArchitecture: boolean;
  includeChangelog: boolean;
  includeContributing: boolean;
  includeBadges: boolean;
  projectName: string;
  description: string;
  author?: string;
  license?: string;
  repoUrl?: string;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export class DocGenerator {
  private provider: ProviderId = 'claude';
  setProvider(provider: ProviderId): void {
    this.provider = provider;
  }

  /**
   * Generate all documentation
   */
  async generate(
    files: GeneratedFile[],
    intent: CodeIntent,
    plan: ProjectPlan,
    config?: Partial<DocConfig>,
    onStream?: AgentStreamCallback
  ): Promise<DocumentationResult> {
    const docConfig = this.buildConfig(intent, plan, config);
    const docFiles: GeneratedFile[] = [];

    onStream?.({
      type: 'synthesizing',
      message: '📝 Generating documentation...',
      timestamp: Date.now(),
      progress: 0,
    });

    // Generate README
    const readme = await this.generateReadme(files, intent, plan, docConfig, onStream);
    docFiles.push({
      path: 'README.md',
      content: readme,
      language: 'markdown',
      purpose: 'Project documentation and setup guide',
      description: 'Project documentation',
      linesOfCode: readme.split('\n').length,
      generatedAt: Date.now(),
      version: 1,
    });

    onStream?.({
      type: 'synthesizing',
      message: '✓ README.md generated',
      timestamp: Date.now(),
      progress: 30,
    });

    // Generate API docs if applicable
    let apiDocs: string | undefined;
    if (docConfig.includeApiDocs && this.hasApiEndpoints(files)) {
      apiDocs = await this.generateApiDocs(files, intent, onStream);
      docFiles.push({
        path: 'docs/API.md',
        content: apiDocs,
        language: 'markdown',
        purpose: 'API endpoint documentation',
        description: 'API documentation',
        linesOfCode: apiDocs.split('\n').length,
        generatedAt: Date.now(),
        version: 1,
      });

      onStream?.({
        type: 'synthesizing',
        message: '✓ API documentation generated',
        timestamp: Date.now(),
        progress: 50,
      });
    }

    // Generate architecture diagram
    let architecture: string | undefined;
    if (docConfig.includeArchitecture) {
      architecture = await this.generateArchitectureDocs(files, plan, onStream);
      docFiles.push({
        path: 'docs/ARCHITECTURE.md',
        content: architecture,
        language: 'markdown',
        purpose: 'System architecture and design',
        description: 'Architecture documentation',
        linesOfCode: architecture.split('\n').length,
        generatedAt: Date.now(),
        version: 1,
      });

      onStream?.({
        type: 'synthesizing',
        message: '✓ Architecture docs generated',
        timestamp: Date.now(),
        progress: 70,
      });
    }

    // Generate CONTRIBUTING.md
    let contributing: string | undefined;
    if (docConfig.includeContributing) {
      contributing = this.generateContributing(docConfig);
      docFiles.push({
        path: 'CONTRIBUTING.md',
        content: contributing,
        language: 'markdown',
        purpose: 'Contributing guidelines for developers',
        description: 'Contributing guidelines',
        linesOfCode: contributing.split('\n').length,
        generatedAt: Date.now(),
        version: 1,
      });

      onStream?.({
        type: 'synthesizing',
        message: '✓ Contributing guide generated',
        timestamp: Date.now(),
        progress: 85,
      });
    }

    // Generate CHANGELOG.md
    let changelog: string | undefined;
    if (docConfig.includeChangelog) {
      changelog = this.generateChangelog(docConfig);
      docFiles.push({
        path: 'CHANGELOG.md',
        content: changelog,
        language: 'markdown',
        purpose: 'Version history and changes',
        description: 'Changelog',
        linesOfCode: changelog.split('\n').length,
        generatedAt: Date.now(),
        version: 1,
      });

      onStream?.({
        type: 'synthesizing',
        message: '✓ Changelog generated',
        timestamp: Date.now(),
        progress: 95,
      });
    }

    onStream?.({
      type: 'complete',
      message: `📝 Generated ${docFiles.length} documentation files`,
      timestamp: Date.now(),
      progress: 100,
    });

    return {
      files: docFiles,
      readme,
      apiDocs,
      architecture,
      changelog,
      contributing,
    };
  }

  /**
   * Generate README.md
   */
  private async generateReadme(
    files: GeneratedFile[],
    intent: CodeIntent,
    plan: ProjectPlan,
    config: DocConfig,
    _onStream?: AgentStreamCallback
  ): Promise<string> {
    const prompt = `Generate a professional README.md for this project.

PROJECT INFO:
- Name: ${config.projectName}
- Description: ${config.description}
- Type: ${intent.projectType}
- Technologies: ${intent.technologies.primary}, ${intent.technologies.secondary.join(', ')}
- Runtime: ${intent.technologies.runtime}
- Package Manager: ${intent.technologies.packageManager}

FILE STRUCTURE:
${files.map((f) => f.path).join('\n')}

FEATURES:
${intent.requirements.functional.join('\n')}

The README should include:
1. Project title with badges (build status, version, license)
2. Brief description
3. Features list
4. Prerequisites
5. Installation instructions
6. Usage examples with code
7. API reference (if applicable)
8. Configuration options
9. Contributing section
10. License

Use professional formatting with emojis, tables, and code blocks.
Make it look like a top GitHub project.

OUTPUT ONLY THE MARKDOWN.`;

    try {
      const response = await agentChat(
        [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        { provider: this.provider, maxTokens: 4000 }
      );

      return response.text.trim();
    } catch (error) {
      console.error('[DocGenerator] README error:', error);
      return this.generateDefaultReadme(config, intent, plan);
    }
  }

  /**
   * Generate API documentation
   */
  private async generateApiDocs(
    files: GeneratedFile[],
    _intent: CodeIntent,
    _onStream?: AgentStreamCallback
  ): Promise<string> {
    const apiFiles = files.filter(
      (f) =>
        f.path.includes('/api/') ||
        f.path.includes('/routes/') ||
        f.content.includes('app.get') ||
        f.content.includes('app.post')
    );

    const apiCode = apiFiles.map((f) => `// ${f.path}\n${f.content}`).join('\n\n');

    const prompt = `Generate comprehensive API documentation in Markdown.

API CODE:
${apiCode.substring(0, 8000)}

Generate documentation including:
1. Overview
2. Authentication (if applicable)
3. Endpoints list with:
   - Method and path
   - Description
   - Request body/parameters
   - Response format
   - Example request/response
4. Error codes
5. Rate limiting (if applicable)

Use tables, code blocks, and clear formatting.
OUTPUT ONLY MARKDOWN.`;

    try {
      const response = await agentChat(
        [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        { provider: this.provider, maxTokens: 4000 }
      );

      return response.text.trim();
    } catch (error) {
      console.error('[DocGenerator] API docs error:', error);
      return '# API Documentation\n\nAPI documentation will be added soon.';
    }
  }

  /**
   * Generate architecture documentation with diagrams
   */
  private async generateArchitectureDocs(
    files: GeneratedFile[],
    plan: ProjectPlan,
    _onStream?: AgentStreamCallback
  ): Promise<string> {
    const fileList = files.map((f) => f.path).join('\n');

    const prompt = `Generate architecture documentation with Mermaid diagrams.

PROJECT STRUCTURE:
${fileList}

ARCHITECTURE:
- Pattern: ${plan.architecture.pattern}
- Layers: ${plan.architecture.layers.join(', ')}
- Data flow: ${plan.architecture.dataFlow}

Generate documentation including:
1. Overview
2. System architecture diagram (Mermaid)
3. Component diagram (Mermaid)
4. Data flow diagram (Mermaid)
5. Directory structure explanation
6. Key decisions and trade-offs

Make diagrams clear and professional.
OUTPUT ONLY MARKDOWN.`;

    try {
      const response = await agentChat(
        [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        { provider: this.provider, maxTokens: 3000 }
      );

      return response.text.trim();
    } catch (error) {
      console.error('[DocGenerator] Architecture docs error:', error);
      return this.generateDefaultArchitecture(plan);
    }
  }

  /**
   * Generate CONTRIBUTING.md
   */
  private generateContributing(config: DocConfig): string {
    return `# Contributing to ${config.projectName}

Thank you for your interest in contributing! 🎉

## Getting Started

1. Fork the repository
2. Clone your fork: \`git clone ${config.repoUrl || 'your-fork-url'}\`
3. Create a branch: \`git checkout -b feature/your-feature\`
4. Make your changes
5. Run tests: \`npm test\`
6. Commit: \`git commit -m 'Add your feature'\`
7. Push: \`git push origin feature/your-feature\`
8. Open a Pull Request

## Code Style

- Follow the existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## Pull Request Guidelines

- Keep PRs focused and small
- Reference related issues
- Include screenshots for UI changes
- Ensure CI passes

## Reporting Issues

- Check existing issues first
- Provide reproduction steps
- Include environment details

## Code of Conduct

Be respectful and inclusive. We're all here to build something great together.

## Questions?

Feel free to open an issue or reach out to the maintainers.
`;
  }

  /**
   * Generate CHANGELOG.md
   */
  private generateChangelog(config: DocConfig): string {
    const today = new Date().toISOString().split('T')[0];

    return `# Changelog

All notable changes to ${config.projectName} will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - ${today}

### Added
- Initial release
- ${config.description}

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A
`;
  }

  /**
   * Add JSDoc comments to code
   */
  async addJsDocComments(file: GeneratedFile): Promise<GeneratedFile> {
    if (!['typescript', 'javascript'].includes(file.language)) {
      return file;
    }

    const prompt = `Add comprehensive JSDoc/TSDoc comments to this code.

\`\`\`${file.language}
${file.content}
\`\`\`

Add comments for:
- Functions (params, returns, throws, examples)
- Classes (description, examples)
- Interfaces/types (property descriptions)
- Complex logic (explanations)

Keep existing code exactly the same, only add comments.
OUTPUT ONLY THE CODE.`;

    try {
      const response = await agentChat(
        [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        { provider: this.provider, maxTokens: 8000 }
      );

      const text = response.text.trim();
      const code = text.replace(/^```\w*\n?/, '').replace(/```$/, '');

      return {
        ...file,
        content: code,
        linesOfCode: code.split('\n').length,
      };
    } catch (error) {
      console.error('[DocGenerator] JSDoc error:', error);
      return file;
    }
  }

  /**
   * Build configuration
   */
  private buildConfig(
    _intent: CodeIntent,
    plan: ProjectPlan,
    config?: Partial<DocConfig>
  ): DocConfig {
    return {
      includeReadme: config?.includeReadme ?? true,
      includeApiDocs: config?.includeApiDocs ?? true,
      includeArchitecture: config?.includeArchitecture ?? true,
      includeChangelog: config?.includeChangelog ?? true,
      includeContributing: config?.includeContributing ?? true,
      includeBadges: config?.includeBadges ?? true,
      projectName: config?.projectName || plan.name,
      description: config?.description || plan.description,
      author: config?.author,
      license: config?.license || 'MIT',
      repoUrl: config?.repoUrl,
    };
  }

  /**
   * Check if project has API endpoints
   */
  private hasApiEndpoints(files: GeneratedFile[]): boolean {
    return files.some(
      (f) =>
        f.content.includes('app.get') ||
        f.content.includes('app.post') ||
        f.content.includes('router.') ||
        f.path.includes('/api/')
    );
  }

  /**
   * Generate default README
   */
  private generateDefaultReadme(config: DocConfig, intent: CodeIntent, _plan: ProjectPlan): string {
    return `# ${config.projectName}

${config.description}

## 🚀 Features

${intent.requirements.functional.map((f) => `- ${f}`).join('\n')}

## 📦 Installation

\`\`\`bash
${intent.technologies.packageManager} install
\`\`\`

## 🔧 Usage

\`\`\`bash
${intent.technologies.packageManager} run dev
\`\`\`

## 🛠️ Built With

- ${intent.technologies.primary}
${intent.technologies.secondary.map((t) => `- ${t}`).join('\n')}

## 📝 License

${config.license}

---

Built with ❤️ by JCIL Code Agent
`;
  }

  /**
   * Generate default architecture docs
   */
  private generateDefaultArchitecture(plan: ProjectPlan): string {
    return `# Architecture

## Overview

${plan.description}

## Pattern

This project follows the **${plan.architecture.pattern}** pattern.

## Layers

${plan.architecture.layers.map((l) => `- ${l}`).join('\n')}

## Data Flow

\`\`\`
${plan.architecture.dataFlow}
\`\`\`

## Directory Structure

\`\`\`
${plan.fileTree.map((f) => f.path).join('\n')}
\`\`\`
`;
  }
}

export const docGenerator = new DocGenerator();
