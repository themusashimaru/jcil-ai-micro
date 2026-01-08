/**
 * AI ARCHITECT
 *
 * Auto-generate system diagrams, database schemas, and architecture visualizations.
 *
 * Features:
 * - System architecture diagrams (Mermaid)
 * - Database ER diagrams
 * - API flow diagrams
 * - Component dependency graphs
 * - Sequence diagrams
 * - Infrastructure diagrams
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('AIArchitect');

// ============================================
// TYPES
// ============================================

export type DiagramType =
  | 'system'
  | 'database'
  | 'api-flow'
  | 'component'
  | 'sequence'
  | 'infrastructure'
  | 'class'
  | 'flowchart';

export type DiagramFormat = 'mermaid' | 'plantuml' | 'ascii' | 'd2';

export interface DiagramRequest {
  type: DiagramType;
  format?: DiagramFormat;
  title?: string;
  description?: string;
  includeDetails?: boolean;
}

export interface GeneratedDiagram {
  type: DiagramType;
  format: DiagramFormat;
  title: string;
  code: string;
  description: string;
  svgUrl?: string;
  pngUrl?: string;
}

export interface ArchitectureAnalysis {
  overview: string;
  components: ComponentInfo[];
  dataFlows: DataFlow[];
  externalDependencies: string[];
  patterns: string[];
  recommendations: string[];
}

export interface ComponentInfo {
  name: string;
  type: 'frontend' | 'backend' | 'database' | 'service' | 'external' | 'library';
  description: string;
  dependencies: string[];
  exposedAPIs?: string[];
}

export interface DataFlow {
  from: string;
  to: string;
  description: string;
  protocol?: string;
  dataType?: string;
}

export interface ERDiagram {
  tables: ERTable[];
  relationships: ERRelationship[];
}

export interface ERTable {
  name: string;
  columns: ERColumn[];
}

export interface ERColumn {
  name: string;
  type: string;
  primaryKey?: boolean;
  foreignKey?: { table: string; column: string };
  nullable?: boolean;
}

export interface ERRelationship {
  from: string;
  to: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  label?: string;
}

// ============================================
// AI ARCHITECT CLASS
// ============================================

export class AIArchitect {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Analyze codebase and generate architecture documentation
   */
  async analyzeArchitecture(
    files: Array<{ path: string; content: string }>
  ): Promise<ArchitectureAnalysis> {
    log.info('Analyzing architecture', { fileCount: files.length });

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: `You are a software architect analyzing a codebase.

Analyze the code and provide:
1. High-level overview
2. Component breakdown
3. Data flows between components
4. External dependencies
5. Design patterns used
6. Recommendations for improvement

Return JSON:
{
  "overview": "High-level description of the system",
  "components": [
    {
      "name": "ComponentName",
      "type": "frontend|backend|database|service|external|library",
      "description": "What this component does",
      "dependencies": ["OtherComponent"],
      "exposedAPIs": ["/api/endpoint"]
    }
  ],
  "dataFlows": [
    {
      "from": "Component1",
      "to": "Component2",
      "description": "What data flows",
      "protocol": "HTTP|WebSocket|etc",
      "dataType": "JSON|binary|etc"
    }
  ],
  "externalDependencies": ["npm packages", "external services"],
  "patterns": ["MVC", "Repository", "etc"],
  "recommendations": ["Improvement suggestions"]
}`,
        messages: [
          {
            role: 'user',
            content: `Analyze this codebase architecture:

Files:
${files.map(f => f.path).join('\n')}

Sample code:
${files.slice(0, 15).map(f => `--- ${f.path} ---\n${f.content.substring(0, 1000)}`).join('\n\n')}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON in response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      log.error('Analysis error', error as Error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Generate a diagram from code
   */
  async generateDiagram(
    files: Array<{ path: string; content: string }>,
    request: DiagramRequest
  ): Promise<GeneratedDiagram> {
    const format = request.format || 'mermaid';

    const generators: Record<DiagramType, () => Promise<GeneratedDiagram>> = {
      system: () => this.generateSystemDiagram(files, request, format),
      database: () => this.generateERDiagram(files, request, format),
      'api-flow': () => this.generateAPIFlowDiagram(files, request, format),
      component: () => this.generateComponentDiagram(files, request, format),
      sequence: () => this.generateSequenceDiagram(files, request, format),
      infrastructure: () => this.generateInfraDiagram(files, request, format),
      class: () => this.generateClassDiagram(files, request, format),
      flowchart: () => this.generateFlowchart(files, request, format),
    };

    return generators[request.type]();
  }

  /**
   * Generate system architecture diagram
   */
  private async generateSystemDiagram(
    files: Array<{ path: string; content: string }>,
    request: DiagramRequest,
    format: DiagramFormat
  ): Promise<GeneratedDiagram> {
    const analysis = await this.analyzeArchitecture(files);

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are a diagram expert. Generate a ${format} system architecture diagram.

For Mermaid, use flowchart or graph TD syntax.
Include:
- All major components
- Data flows between components
- External services
- Databases

Make it clear  and professional.`,
        messages: [
          {
            role: 'user',
            content: `Generate a ${format} system diagram for:

${JSON.stringify(analysis, null, 2)}

Title: ${request.title || 'System Architecture'}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      // Extract diagram code
      const codeMatch = content.text.match(/```(?:mermaid|plantuml|d2)?\n([\s\S]*?)\n```/);
      const code = codeMatch ? codeMatch[1] : content.text;

      return {
        type: 'system',
        format,
        title: request.title || 'System Architecture',
        code: code.trim(),
        description: analysis.overview,
      };
    } catch (error) {
      log.error('System diagram error', error as Error);
      return this.getDefaultDiagram('system', format);
    }
  }

  /**
   * Generate ER diagram from database files
   */
  private async generateERDiagram(
    files: Array<{ path: string; content: string }>,
    request: DiagramRequest,
    format: DiagramFormat
  ): Promise<GeneratedDiagram> {
    // Find schema files
    const schemaFiles = files.filter(f =>
      f.path.includes('schema') ||
      f.path.includes('migration') ||
      f.path.includes('prisma') ||
      f.path.includes('model') ||
      f.path.endsWith('.sql')
    );

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are a database diagram expert. Generate a ${format} ER diagram.

For Mermaid, use erDiagram syntax:
\`\`\`mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        string id PK
        string name
        string email
    }
    ORDER {
        string id PK
        string customer_id FK
        date created_at
    }
\`\`\`

Include all tables, columns, types, and relationships.`,
        messages: [
          {
            role: 'user',
            content: `Generate an ER diagram from these schema files:

${schemaFiles.map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n')}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      const codeMatch = content.text.match(/```(?:mermaid|plantuml|d2)?\n([\s\S]*?)\n```/);
      const code = codeMatch ? codeMatch[1] : content.text;

      return {
        type: 'database',
        format,
        title: request.title || 'Database Schema',
        code: code.trim(),
        description: 'Entity-Relationship diagram showing database tables and their relationships',
      };
    } catch (error) {
      log.error('ER diagram error', error as Error);
      return this.getDefaultDiagram('database', format);
    }
  }

  /**
   * Generate API flow diagram
   */
  private async generateAPIFlowDiagram(
    files: Array<{ path: string; content: string }>,
    request: DiagramRequest,
    format: DiagramFormat
  ): Promise<GeneratedDiagram> {
    const apiFiles = files.filter(f =>
      f.path.includes('/api/') ||
      f.path.includes('route') ||
      f.path.includes('controller')
    );

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are an API documentation expert. Generate a ${format} API flow diagram.

Show:
- API endpoints grouped by resource
- HTTP methods
- Request/Response flow
- Authentication flow
- Error handling paths

Use flowchart or sequence diagram syntax.`,
        messages: [
          {
            role: 'user',
            content: `Generate an API flow diagram from:

${apiFiles.map(f => `--- ${f.path} ---\n${f.content.substring(0, 1500)}`).join('\n\n')}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      const codeMatch = content.text.match(/```(?:mermaid|plantuml|d2)?\n([\s\S]*?)\n```/);
      const code = codeMatch ? codeMatch[1] : content.text;

      return {
        type: 'api-flow',
        format,
        title: request.title || 'API Flow',
        code: code.trim(),
        description: 'API endpoint flow diagram showing request/response paths',
      };
    } catch (error) {
      log.error('API flow error', error as Error);
      return this.getDefaultDiagram('api-flow', format);
    }
  }

  /**
   * Generate component dependency diagram
   */
  private async generateComponentDiagram(
    files: Array<{ path: string; content: string }>,
    request: DiagramRequest,
    format: DiagramFormat
  ): Promise<GeneratedDiagram> {
    const componentFiles = files.filter(f =>
      f.path.includes('component') ||
      f.path.endsWith('.tsx') ||
      f.path.endsWith('.vue')
    );

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are a UI architecture expert. Generate a ${format} component dependency diagram.

Show:
- Component hierarchy
- Props passed between components
- Shared state/context usage
- Component groupings (pages, layouts, shared)

Use graph TD or flowchart syntax for clear visualization.`,
        messages: [
          {
            role: 'user',
            content: `Generate a component diagram from:

Files:
${componentFiles.map(f => f.path).join('\n')}

Sample components:
${componentFiles.slice(0, 10).map(f => `--- ${f.path} ---\n${f.content.substring(0, 800)}`).join('\n\n')}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      const codeMatch = content.text.match(/```(?:mermaid|plantuml|d2)?\n([\s\S]*?)\n```/);
      const code = codeMatch ? codeMatch[1] : content.text;

      return {
        type: 'component',
        format,
        title: request.title || 'Component Architecture',
        code: code.trim(),
        description: 'Component dependency graph showing UI component relationships',
      };
    } catch (error) {
      log.error('Component diagram error', error as Error);
      return this.getDefaultDiagram('component', format);
    }
  }

  /**
   * Generate sequence diagram
   */
  private async generateSequenceDiagram(
    files: Array<{ path: string; content: string }>,
    request: DiagramRequest,
    format: DiagramFormat
  ): Promise<GeneratedDiagram> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are a sequence diagram expert. Generate a ${format} sequence diagram.

For Mermaid:
\`\`\`mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API
    participant D as Database

    U->>F: Action
    F->>A: Request
    A->>D: Query
    D-->>A: Result
    A-->>F: Response
    F-->>U: Display
\`\`\`

Show the main user flow through the system.`,
        messages: [
          {
            role: 'user',
            content: `Generate a sequence diagram for: ${request.description || 'main user flow'}

Code context:
${files.slice(0, 10).map(f => `${f.path}`).join('\n')}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      const codeMatch = content.text.match(/```(?:mermaid|plantuml|d2)?\n([\s\S]*?)\n```/);
      const code = codeMatch ? codeMatch[1] : content.text;

      return {
        type: 'sequence',
        format,
        title: request.title || 'Sequence Diagram',
        code: code.trim(),
        description: request.description || 'User interaction sequence diagram',
      };
    } catch (error) {
      log.error('Sequence diagram error', error as Error);
      return this.getDefaultDiagram('sequence', format);
    }
  }

  /**
   * Generate infrastructure diagram
   */
  private async generateInfraDiagram(
    files: Array<{ path: string; content: string }>,
    request: DiagramRequest,
    format: DiagramFormat
  ): Promise<GeneratedDiagram> {
    // Look for infra config files
    const infraFiles = files.filter(f =>
      f.path.includes('docker') ||
      f.path.includes('k8s') ||
      f.path.includes('kubernetes') ||
      f.path.includes('terraform') ||
      f.path.includes('aws') ||
      f.path.includes('.yaml') ||
      f.path.includes('.yml') ||
      f.path.includes('vercel') ||
      f.path.includes('netlify')
    );

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are an infrastructure architect. Generate a ${format} infrastructure diagram.

Show:
- Cloud services used
- Containers/pods
- Load balancers
- Databases
- CDN/Edge
- CI/CD pipeline
- Networking/VPC

Use appropriate icons or labels for cloud services.`,
        messages: [
          {
            role: 'user',
            content: `Generate infrastructure diagram from:

${infraFiles.length > 0
  ? infraFiles.map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n')
  : 'No infrastructure files found. Generate a typical Next.js/Vercel deployment diagram.'}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      const codeMatch = content.text.match(/```(?:mermaid|plantuml|d2)?\n([\s\S]*?)\n```/);
      const code = codeMatch ? codeMatch[1] : content.text;

      return {
        type: 'infrastructure',
        format,
        title: request.title || 'Infrastructure',
        code: code.trim(),
        description: 'Infrastructure and deployment architecture diagram',
      };
    } catch (error) {
      log.error('Infra diagram error', error as Error);
      return this.getDefaultDiagram('infrastructure', format);
    }
  }

  /**
   * Generate class diagram
   */
  private async generateClassDiagram(
    files: Array<{ path: string; content: string }>,
    request: DiagramRequest,
    format: DiagramFormat
  ): Promise<GeneratedDiagram> {
    const classFiles = files.filter(f =>
      f.content.includes('class ') ||
      f.content.includes('interface ') ||
      f.content.includes('type ')
    );

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are a UML expert. Generate a ${format} class diagram.

For Mermaid:
\`\`\`mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +fetch()
    }
    Animal <|-- Dog
\`\`\`

Show:
- Classes and interfaces
- Properties and methods
- Inheritance relationships
- Associations`,
        messages: [
          {
            role: 'user',
            content: `Generate a class diagram from:

${classFiles.slice(0, 10).map(f => `--- ${f.path} ---\n${f.content.substring(0, 1000)}`).join('\n\n')}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      const codeMatch = content.text.match(/```(?:mermaid|plantuml|d2)?\n([\s\S]*?)\n```/);
      const code = codeMatch ? codeMatch[1] : content.text;

      return {
        type: 'class',
        format,
        title: request.title || 'Class Diagram',
        code: code.trim(),
        description: 'UML class diagram showing types and relationships',
      };
    } catch (error) {
      log.error('Class diagram error', error as Error);
      return this.getDefaultDiagram('class', format);
    }
  }

  /**
   * Generate flowchart
   */
  private async generateFlowchart(
    files: Array<{ path: string; content: string }>,
    request: DiagramRequest,
    format: DiagramFormat
  ): Promise<GeneratedDiagram> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are a flowchart expert. Generate a ${format} flowchart.

For Mermaid flowchart:
\`\`\`mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
\`\`\`

Create a clear, logical flow diagram.`,
        messages: [
          {
            role: 'user',
            content: `Generate a flowchart for: ${request.description || 'main application flow'}

Context:
${files.slice(0, 5).map(f => f.path).join('\n')}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      const codeMatch = content.text.match(/```(?:mermaid|plantuml|d2)?\n([\s\S]*?)\n```/);
      const code = codeMatch ? codeMatch[1] : content.text;

      return {
        type: 'flowchart',
        format,
        title: request.title || 'Flowchart',
        code: code.trim(),
        description: request.description || 'Application flow diagram',
      };
    } catch (error) {
      log.error('Flowchart error', error as Error);
      return this.getDefaultDiagram('flowchart', format);
    }
  }

  /**
   * Generate all diagrams for a project
   */
  async generateAllDiagrams(
    files: Array<{ path: string; content: string }>,
    projectName: string
  ): Promise<GeneratedDiagram[]> {
    const diagrams: GeneratedDiagram[] = [];

    const types: DiagramType[] = ['system', 'database', 'component', 'api-flow'];

    for (const type of types) {
      try {
        const diagram = await this.generateDiagram(files, {
          type,
          format: 'mermaid',
          title: `${projectName} - ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        });
        diagrams.push(diagram);
      } catch {
        // Skip failed diagrams
      }
    }

    return diagrams;
  }

  /**
   * Default analysis fallback
   */
  private getDefaultAnalysis(): ArchitectureAnalysis {
    return {
      overview: 'Architecture analysis failed',
      components: [],
      dataFlows: [],
      externalDependencies: [],
      patterns: [],
      recommendations: ['Manual architecture review recommended'],
    };
  }

  /**
   * Default diagram fallback
   */
  private getDefaultDiagram(type: DiagramType, format: DiagramFormat): GeneratedDiagram {
    return {
      type,
      format,
      title: `${type} Diagram`,
      code: `graph TD\n    A[Error generating diagram]`,
      description: 'Diagram generation failed',
    };
  }
}

// ============================================
// EXPORTS
// ============================================

export const aiArchitect = new AIArchitect();

/**
 * Quick function to generate a diagram
 */
export async function generateDiagram(
  files: Array<{ path: string; content: string }>,
  type: DiagramType,
  title?: string
): Promise<GeneratedDiagram> {
  return aiArchitect.generateDiagram(files, { type, title });
}

/**
 * Analyze project architecture
 */
export async function analyzeArchitecture(
  files: Array<{ path: string; content: string }>
): Promise<ArchitectureAnalysis> {
  return aiArchitect.analyzeArchitecture(files);
}
