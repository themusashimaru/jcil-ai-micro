/**
 * AI DOCUMENTATION GENERATOR
 *
 * Automatically generate comprehensive documentation from code.
 *
 * Features:
 * - API documentation generation
 * - README generation
 * - JSDoc/TSDoc generation
 * - Architecture documentation
 * - Changelog generation
 * - User guide generation
 * - OpenAPI/Swagger spec generation
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('DocGenerator');

// ============================================
// TYPES
// ============================================

export type DocType =
  | 'readme'
  | 'api'
  | 'jsdoc'
  | 'architecture'
  | 'changelog'
  | 'guide'
  | 'openapi';

export interface DocGenerationOptions {
  type: DocType;
  format: 'markdown' | 'html' | 'json';
  style: 'minimal' | 'standard' | 'detailed';
  includeExamples?: boolean;
  includeTests?: boolean;
  audience?: 'developer' | 'user' | 'both';
}

export interface GeneratedDoc {
  type: DocType;
  title: string;
  content: string;
  format: string;
  sections: DocSection[];
  metadata: DocMetadata;
}

export interface DocSection {
  title: string;
  content: string;
  order: number;
  subsections?: DocSection[];
}

export interface DocMetadata {
  generatedAt: string;
  sourceFiles: number;
  totalFunctions: number;
  totalClasses: number;
  coverage: number;
}

export interface APIEndpoint {
  method: string;
  path: string;
  description: string;
  params: APIParam[];
  requestBody?: {
    type: string;
    schema: Record<string, unknown>;
    example?: unknown;
  };
  responses: APIResponse[];
  authentication?: string;
  rateLimit?: string;
}

export interface APIParam {
  name: string;
  in: 'path' | 'query' | 'header';
  type: string;
  required: boolean;
  description: string;
  example?: string;
}

export interface APIResponse {
  status: number;
  description: string;
  schema?: Record<string, unknown>;
  example?: unknown;
}

export interface FunctionDoc {
  name: string;
  description: string;
  params: ParamDoc[];
  returns: ReturnDoc;
  throws?: string[];
  examples?: string[];
  deprecated?: string;
  since?: string;
}

export interface ParamDoc {
  name: string;
  type: string;
  description: string;
  optional: boolean;
  defaultValue?: string;
}

export interface ReturnDoc {
  type: string;
  description: string;
}

// ============================================
// DOC GENERATOR CLASS
// ============================================

export class AIDocGenerator {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Generate documentation for a codebase
   */
  async generateDocs(
    files: Array<{ path: string; content: string }>,
    projectName: string,
    options: DocGenerationOptions
  ): Promise<GeneratedDoc> {
    log.info('Generating documentation', { type: options.type, projectName });

    const generators: Record<DocType, () => Promise<GeneratedDoc>> = {
      readme: () => this.generateReadme(files, projectName, options),
      api: () => this.generateAPIDocs(files, projectName, options),
      jsdoc: () => this.generateJSDocs(files, options),
      architecture: () => this.generateArchitectureDocs(files, projectName, options),
      changelog: () => this.generateChangelog(files, projectName),
      guide: () => this.generateUserGuide(files, projectName, options),
      openapi: () => this.generateOpenAPISpec(files, projectName),
    };

    return generators[options.type]();
  }

  /**
   * Generate a comprehensive README
   */
  private async generateReadme(
    files: Array<{ path: string; content: string }>,
    projectName: string,
    options: DocGenerationOptions
  ): Promise<GeneratedDoc> {
    // Find package.json for project info
    const packageJson = files.find((f) => f.path.endsWith('package.json'));
    let projectInfo: Record<string, unknown> = {};

    if (packageJson) {
      try {
        projectInfo = JSON.parse(packageJson.content);
      } catch {
        // Ignore
      }
    }

    // Get code summary
    const codeSummary = await this.summarizeCode(files);

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: `You are a technical writer creating a professional README.md file.

Style: ${options.style}
Include Examples: ${options.includeExamples}
Audience: ${options.audience || 'developer'}

Create a README with these sections:
1. Project title and badges
2. Brief description
3. Features (key highlights)
4. Installation
5. Quick Start / Usage
6. Configuration (if applicable)
7. API Reference (brief overview)
8. Contributing
9. License

Make it professional, clear, and engaging. Use emojis sparingly for visual appeal.
Include code examples where helpful.`,
        messages: [
          {
            role: 'user',
            content: `Generate a README for "${projectName}":

Project Info:
${JSON.stringify(projectInfo, null, 2)}

Code Summary:
${codeSummary}

Key Files:
${files
  .slice(0, 10)
  .map((f) => f.path)
  .join('\n')}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      return {
        type: 'readme',
        title: `${projectName} README`,
        content: content.text,
        format: 'markdown',
        sections: this.extractSections(content.text),
        metadata: {
          generatedAt: new Date().toISOString(),
          sourceFiles: files.length,
          totalFunctions: 0,
          totalClasses: 0,
          coverage: 100,
        },
      };
    } catch (error) {
      log.error('README generation error', error as Error);
      throw error;
    }
  }

  /**
   * Generate API documentation
   */
  private async generateAPIDocs(
    files: Array<{ path: string; content: string }>,
    projectName: string,
    options: DocGenerationOptions
  ): Promise<GeneratedDoc> {
    // Find API route files
    const apiFiles = files.filter(
      (f) =>
        f.path.includes('/api/') ||
        f.path.includes('route.ts') ||
        f.path.includes('routes.') ||
        f.path.includes('controller')
    );

    // Extract endpoints
    const endpoints = await this.extractAPIEndpoints(apiFiles);

    // Generate documentation
    let content = `# ${projectName} API Documentation\n\n`;
    content += `Generated: ${new Date().toISOString()}\n\n`;
    content += `## Base URL\n\n\`\`\`\nhttps://api.example.com\n\`\`\`\n\n`;
    content += `## Authentication\n\nAll API requests require authentication via Bearer token.\n\n`;
    content += `\`\`\`bash\nAuthorization: Bearer YOUR_TOKEN\n\`\`\`\n\n`;
    content += `## Endpoints\n\n`;

    // Group endpoints by path prefix
    const grouped = new Map<string, APIEndpoint[]>();
    for (const endpoint of endpoints) {
      const prefix = endpoint.path.split('/')[1] || 'root';
      if (!grouped.has(prefix)) grouped.set(prefix, []);
      grouped.get(prefix)!.push(endpoint);
    }

    for (const [group, eps] of grouped) {
      content += `### ${group.charAt(0).toUpperCase() + group.slice(1)}\n\n`;

      for (const ep of eps) {
        content += `#### ${ep.method.toUpperCase()} ${ep.path}\n\n`;
        content += `${ep.description}\n\n`;

        if (ep.params.length > 0) {
          content += `**Parameters:**\n\n`;
          content += `| Name | In | Type | Required | Description |\n`;
          content += `|------|-----|------|----------|-------------|\n`;
          for (const param of ep.params) {
            content += `| ${param.name} | ${param.in} | ${param.type} | ${param.required ? 'Yes' : 'No'} | ${param.description} |\n`;
          }
          content += `\n`;
        }

        if (ep.requestBody) {
          content += `**Request Body:**\n\n`;
          content += `\`\`\`json\n${JSON.stringify(ep.requestBody.example || ep.requestBody.schema, null, 2)}\n\`\`\`\n\n`;
        }

        content += `**Responses:**\n\n`;
        for (const res of ep.responses) {
          content += `- \`${res.status}\`: ${res.description}\n`;
          if (res.example && options.includeExamples) {
            content += `  \`\`\`json\n  ${JSON.stringify(res.example, null, 2)}\n  \`\`\`\n`;
          }
        }
        content += `\n---\n\n`;
      }
    }

    return {
      type: 'api',
      title: `${projectName} API Documentation`,
      content,
      format: 'markdown',
      sections: this.extractSections(content),
      metadata: {
        generatedAt: new Date().toISOString(),
        sourceFiles: apiFiles.length,
        totalFunctions: endpoints.length,
        totalClasses: 0,
        coverage: 100,
      },
    };
  }

  /**
   * Generate JSDoc/TSDoc comments for code
   */
  private async generateJSDocs(
    files: Array<{ path: string; content: string }>,
    _options: DocGenerationOptions
  ): Promise<GeneratedDoc> {
    const documentedFiles: string[] = [];

    for (const file of files) {
      if (!file.path.match(/\.(ts|js|tsx|jsx)$/)) continue;

      try {
        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          system: `You are a documentation expert. Add comprehensive JSDoc/TSDoc comments to code.

Rules:
1. Add @description for functions/classes
2. Add @param for each parameter with type and description
3. Add @returns for return values
4. Add @throws for exceptions
5. Add @example where helpful
6. Add @deprecated if applicable
7. Don't modify the actual code, only add comments
8. Use proper TSDoc syntax for TypeScript

Return the complete file with documentation added.`,
          messages: [
            {
              role: 'user',
              content: `Add documentation comments to this file:\n\n${file.content}`,
            },
          ],
        });

        const content = response.content[0];
        if (content.type === 'text') {
          documentedFiles.push(`// ${file.path}\n\n${content.text}`);
        }
      } catch {
        // Skip files that fail
      }
    }

    return {
      type: 'jsdoc',
      title: 'JSDoc Documentation',
      content: documentedFiles.join('\n\n---\n\n'),
      format: 'markdown',
      sections: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        sourceFiles: files.length,
        totalFunctions: 0,
        totalClasses: 0,
        coverage: Math.round((documentedFiles.length / files.length) * 100),
      },
    };
  }

  /**
   * Generate architecture documentation
   */
  private async generateArchitectureDocs(
    files: Array<{ path: string; content: string }>,
    projectName: string,
    options: DocGenerationOptions
  ): Promise<GeneratedDoc> {
    // Analyze project structure
    const structure = this.analyzeProjectStructure(files);

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: `You are a software architect creating architecture documentation.

Create comprehensive architecture documentation including:
1. System Overview
2. Component Diagram (as ASCII or Mermaid)
3. Data Flow
4. Technology Stack
5. Directory Structure explanation
6. Key Design Patterns used
7. Dependencies and integrations
8. Security considerations
9. Scalability notes
10. Deployment architecture

Style: ${options.style}
Format: Markdown with diagrams`,
        messages: [
          {
            role: 'user',
            content: `Create architecture documentation for "${projectName}":

Project Structure:
${structure}

Sample Files:
${files
  .slice(0, 20)
  .map((f) => `${f.path}:\n${f.content.substring(0, 500)}`)
  .join('\n\n---\n\n')}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      return {
        type: 'architecture',
        title: `${projectName} Architecture`,
        content: content.text,
        format: 'markdown',
        sections: this.extractSections(content.text),
        metadata: {
          generatedAt: new Date().toISOString(),
          sourceFiles: files.length,
          totalFunctions: 0,
          totalClasses: 0,
          coverage: 100,
        },
      };
    } catch (error) {
      log.error('Architecture doc error', error as Error);
      throw error;
    }
  }

  /**
   * Generate changelog from git history or code changes
   */
  private async generateChangelog(
    files: Array<{ path: string; content: string }>,
    projectName: string
  ): Promise<GeneratedDoc> {
    // Find existing changelog or generate from code analysis
    const existingChangelog = files.find(
      (f) => f.path.toLowerCase().includes('changelog') || f.path.toLowerCase().includes('history')
    );

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: `You are generating a CHANGELOG.md file following Keep a Changelog format.

Format:
## [Version] - Date
### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security

Be specific and user-friendly in descriptions.`,
        messages: [
          {
            role: 'user',
            content: existingChangelog
              ? `Update this changelog with any new changes:\n\n${existingChangelog.content}`
              : `Generate a changelog for "${projectName}" based on the project structure:\n\n${files.map((f) => f.path).join('\n')}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      return {
        type: 'changelog',
        title: 'Changelog',
        content: content.text,
        format: 'markdown',
        sections: this.extractSections(content.text),
        metadata: {
          generatedAt: new Date().toISOString(),
          sourceFiles: files.length,
          totalFunctions: 0,
          totalClasses: 0,
          coverage: 100,
        },
      };
    } catch (error) {
      log.error('Changelog error', error as Error);
      throw error;
    }
  }

  /**
   * Generate user guide
   */
  private async generateUserGuide(
    files: Array<{ path: string; content: string }>,
    projectName: string,
    options: DocGenerationOptions
  ): Promise<GeneratedDoc> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: `You are a technical writer creating a user guide.

Create a comprehensive user guide with:
1. Introduction
2. Getting Started
3. Core Concepts
4. Step-by-step Tutorials
5. Common Use Cases
6. Troubleshooting
7. FAQ
8. Glossary

Target audience: ${options.audience || 'user'}
Style: ${options.style}

Use clear, simple language. Include screenshots placeholders where helpful.`,
        messages: [
          {
            role: 'user',
            content: `Create a user guide for "${projectName}":\n\n${files
              .slice(0, 10)
              .map((f) => `${f.path}:\n${f.content.substring(0, 300)}`)
              .join('\n\n')}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      return {
        type: 'guide',
        title: `${projectName} User Guide`,
        content: content.text,
        format: 'markdown',
        sections: this.extractSections(content.text),
        metadata: {
          generatedAt: new Date().toISOString(),
          sourceFiles: files.length,
          totalFunctions: 0,
          totalClasses: 0,
          coverage: 100,
        },
      };
    } catch (error) {
      log.error('User guide error', error as Error);
      throw error;
    }
  }

  /**
   * Generate OpenAPI specification
   */
  private async generateOpenAPISpec(
    files: Array<{ path: string; content: string }>,
    projectName: string
  ): Promise<GeneratedDoc> {
    const apiFiles = files.filter((f) => f.path.includes('/api/') || f.path.includes('route.'));

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16384,
        system: `You are an API documentation expert. Generate an OpenAPI 3.0 specification.

Generate a complete, valid OpenAPI 3.0 YAML specification including:
- info (title, version, description)
- servers
- paths (all endpoints with operations)
- components (schemas, responses, parameters)
- security schemes
- tags

Ensure the YAML is valid and complete.`,
        messages: [
          {
            role: 'user',
            content: `Generate OpenAPI spec for "${projectName}":\n\n${apiFiles.map((f) => `${f.path}:\n${f.content}`).join('\n\n---\n\n')}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      // Extract YAML from response
      const yamlMatch =
        content.text.match(/```ya?ml\n([\s\S]*?)\n```/) ||
        content.text.match(/^(openapi:[\s\S]*)/m);
      const spec = yamlMatch ? yamlMatch[1] : content.text;

      return {
        type: 'openapi',
        title: `${projectName} OpenAPI Specification`,
        content: spec,
        format: 'json',
        sections: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          sourceFiles: apiFiles.length,
          totalFunctions: 0,
          totalClasses: 0,
          coverage: 100,
        },
      };
    } catch (error) {
      log.error('OpenAPI error', error as Error);
      throw error;
    }
  }

  /**
   * Summarize code for documentation
   */
  private async summarizeCode(files: Array<{ path: string; content: string }>): Promise<string> {
    const summary: string[] = [];

    summary.push(`Total files: ${files.length}`);
    summary.push(`Languages: ${this.detectLanguages(files).join(', ')}`);

    // Detect frameworks
    const packageJson = files.find((f) => f.path.endsWith('package.json'));
    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson.content);
        summary.push(`Project: ${pkg.name || 'Unknown'}`);
        summary.push(`Version: ${pkg.version || 'Unknown'}`);
        summary.push(`Description: ${pkg.description || 'N/A'}`);
      } catch {
        // Ignore
      }
    }

    return summary.join('\n');
  }

  /**
   * Extract API endpoints from files
   */
  private async extractAPIEndpoints(
    files: Array<{ path: string; content: string }>
  ): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];

    for (const file of files) {
      // Match Next.js route patterns
      const nextMatch = file.path.match(/app\/api\/(.+)\/route\.ts/);
      if (nextMatch) {
        const path = `/api/${nextMatch[1]}`;

        // Detect HTTP methods
        const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter(
          (m) =>
            file.content.includes(`export async function ${m}`) ||
            file.content.includes(`export function ${m}`)
        );

        for (const method of methods) {
          endpoints.push({
            method,
            path,
            description: `${method} ${path}`,
            params: this.extractParams(file.content),
            responses: [
              { status: 200, description: 'Success' },
              { status: 400, description: 'Bad Request' },
              { status: 500, description: 'Server Error' },
            ],
          });
        }
      }

      // Match Express-style routes
      const expressMatches = file.content.matchAll(
        /\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi
      );
      for (const match of expressMatches) {
        endpoints.push({
          method: match[1].toUpperCase(),
          path: match[2],
          description: `${match[1].toUpperCase()} ${match[2]}`,
          params: [],
          responses: [{ status: 200, description: 'Success' }],
        });
      }
    }

    return endpoints;
  }

  /**
   * Extract parameters from code
   */
  private extractParams(code: string): APIParam[] {
    const params: APIParam[] = [];

    // Match URL parameters
    const urlParams = code.matchAll(/params\.(\w+)/g);
    for (const match of urlParams) {
      params.push({
        name: match[1],
        in: 'path',
        type: 'string',
        required: true,
        description: `Path parameter: ${match[1]}`,
      });
    }

    // Match query parameters
    const queryParams = code.matchAll(/searchParams\.get\(['"](\w+)['"]\)/g);
    for (const match of queryParams) {
      params.push({
        name: match[1],
        in: 'query',
        type: 'string',
        required: false,
        description: `Query parameter: ${match[1]}`,
      });
    }

    return params;
  }

  /**
   * Analyze project structure
   */
  private analyzeProjectStructure(files: Array<{ path: string; content: string }>): string {
    const dirs = new Set<string>();

    for (const file of files) {
      const parts = file.path.split('/');
      let current = '';
      for (let i = 0; i < parts.length - 1; i++) {
        current += (current ? '/' : '') + parts[i];
        dirs.add(current);
      }
    }

    return Array.from(dirs).sort().join('\n');
  }

  /**
   * Detect languages in project
   */
  private detectLanguages(files: Array<{ path: string; content: string }>): string[] {
    const extensions = new Set<string>();

    for (const file of files) {
      const ext = file.path.split('.').pop()?.toLowerCase();
      if (ext) extensions.add(ext);
    }

    const langMap: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript/React',
      js: 'JavaScript',
      jsx: 'JavaScript/React',
      py: 'Python',
      go: 'Go',
      rs: 'Rust',
      java: 'Java',
      rb: 'Ruby',
      php: 'PHP',
      css: 'CSS',
      scss: 'SCSS',
      html: 'HTML',
      json: 'JSON',
      yaml: 'YAML',
      yml: 'YAML',
      md: 'Markdown',
    };

    return Array.from(extensions)
      .map((ext) => langMap[ext])
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
  }

  /**
   * Extract sections from markdown
   */
  private extractSections(content: string): DocSection[] {
    const sections: DocSection[] = [];
    const lines = content.split('\n');

    let currentSection: DocSection | null = null;
    let sectionContent: string[] = [];
    let order = 0;

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,3})\s+(.+)/);

      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = sectionContent.join('\n').trim();
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          title: headerMatch[2],
          content: '',
          order: order++,
        };
        sectionContent = [];
      } else if (currentSection) {
        sectionContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.content = sectionContent.join('\n').trim();
      sections.push(currentSection);
    }

    return sections;
  }
}

// ============================================
// EXPORTS
// ============================================

export const docGenerator = new AIDocGenerator();

/**
 * Quick function to generate documentation
 */
export async function generateDocs(
  files: Array<{ path: string; content: string }>,
  projectName: string,
  type: DocType = 'readme'
): Promise<GeneratedDoc> {
  return docGenerator.generateDocs(files, projectName, {
    type,
    format: 'markdown',
    style: 'standard',
    includeExamples: true,
    audience: 'developer',
  });
}

/**
 * Generate README specifically
 */
export async function generateReadme(
  files: Array<{ path: string; content: string }>,
  projectName: string
): Promise<string> {
  const doc = await docGenerator.generateDocs(files, projectName, {
    type: 'readme',
    format: 'markdown',
    style: 'detailed',
    includeExamples: true,
    audience: 'both',
  });
  return doc.content;
}

/**
 * Generate API docs specifically
 */
export async function generateAPIReference(
  files: Array<{ path: string; content: string }>,
  projectName: string
): Promise<string> {
  const doc = await docGenerator.generateDocs(files, projectName, {
    type: 'api',
    format: 'markdown',
    style: 'detailed',
    includeExamples: true,
    audience: 'developer',
  });
  return doc.content;
}
