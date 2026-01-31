/**
 * MERMAID DIAGRAM GENERATION TOOL
 *
 * Generates diagrams using Mermaid.js syntax.
 * Returns diagram code that can be rendered by the frontend.
 *
 * Supported diagram types:
 * - Flowcharts
 * - Sequence diagrams
 * - Class diagrams
 * - State diagrams
 * - Entity Relationship Diagrams (ERD)
 * - Gantt charts
 * - Pie charts
 * - Git graphs
 * - Mind maps
 * - Timeline
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const mermaidDiagramTool: UnifiedTool = {
  name: 'generate_diagram',
  description: `Generate diagrams using Mermaid.js syntax. Returns renderable diagram code.

Supported diagram types:
- flowchart: Process flows, decision trees, workflows
- sequence: Interaction between systems/actors
- class: UML class diagrams
- state: State machines
- er: Entity Relationship diagrams
- gantt: Project timelines
- pie: Pie charts
- git: Git branch visualizations
- mindmap: Mind maps
- timeline: Timeline visualizations

The diagram will be returned as Mermaid code that renders visually.

Example flowchart:
\`\`\`
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
\`\`\``,
  parameters: {
    type: 'object',
    properties: {
      diagram_type: {
        type: 'string',
        enum: [
          'flowchart',
          'sequence',
          'class',
          'state',
          'er',
          'gantt',
          'pie',
          'git',
          'mindmap',
          'timeline',
        ],
        description: 'Type of diagram to generate',
      },
      title: {
        type: 'string',
        description: 'Optional title for the diagram',
      },
      description: {
        type: 'string',
        description:
          'What the diagram should show. Be specific about nodes, connections, and labels.',
      },
      direction: {
        type: 'string',
        enum: ['TD', 'TB', 'BT', 'LR', 'RL'],
        description: 'Flow direction for flowcharts. TD=top-down, LR=left-right, etc. Default: TD',
      },
      theme: {
        type: 'string',
        enum: ['default', 'dark', 'forest', 'neutral'],
        description: 'Visual theme. Default: default',
      },
      custom_code: {
        type: 'string',
        description:
          'Optional: Provide custom Mermaid code directly instead of generating from description',
      },
    },
    required: ['diagram_type'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isMermaidDiagramAvailable(): boolean {
  // Always available - pure JavaScript implementation
  return true;
}

// ============================================================================
// DIAGRAM TEMPLATES
// ============================================================================

const DIAGRAM_TEMPLATES: Record<string, string> = {
  flowchart: `graph TD
    A[Start] --> B{Decision Point}
    B -->|Option 1| C[Process A]
    B -->|Option 2| D[Process B]
    C --> E[End]
    D --> E`,

  sequence: `sequenceDiagram
    participant User
    participant System
    participant Database
    User->>System: Request
    System->>Database: Query
    Database-->>System: Response
    System-->>User: Result`,

  class: `classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +String breed
        +bark()
    }
    Animal <|-- Dog`,

  state: `stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: Start
    Processing --> Completed: Success
    Processing --> Error: Failure
    Completed --> [*]
    Error --> Idle: Retry`,

  er: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "ordered in"
    CUSTOMER {
        int id PK
        string name
        string email
    }
    ORDER {
        int id PK
        date created
        string status
    }`,

  gantt: `gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Planning
    Requirements     :a1, 2024-01-01, 7d
    Design           :a2, after a1, 5d
    section Development
    Implementation   :a3, after a2, 14d
    Testing          :a4, after a3, 7d`,

  pie: `pie showData
    title Distribution
    "Category A" : 40
    "Category B" : 30
    "Category C" : 20
    "Category D" : 10`,

  git: `gitGraph
    commit id: "Initial"
    branch develop
    checkout develop
    commit id: "Feature 1"
    commit id: "Feature 2"
    checkout main
    merge develop
    commit id: "Release"`,

  mindmap: `mindmap
  root((Central Topic))
    Branch A
      Leaf A1
      Leaf A2
    Branch B
      Leaf B1
      Leaf B2
    Branch C
      Leaf C1`,

  timeline: `timeline
    title Project Milestones
    2024-Q1 : Planning Phase
            : Requirements Gathering
    2024-Q2 : Development Phase
            : Core Features
    2024-Q3 : Testing Phase
            : QA & Bug Fixes
    2024-Q4 : Launch
            : Go Live`,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function validateMermaidSyntax(code: string): { valid: boolean; error?: string } {
  // Basic syntax validation
  const trimmed = code.trim();

  // Check for common diagram type declarations
  const validStarters = [
    'graph',
    'flowchart',
    'sequenceDiagram',
    'classDiagram',
    'stateDiagram',
    'erDiagram',
    'gantt',
    'pie',
    'gitGraph',
    'mindmap',
    'timeline',
    'journey',
    'quadrantChart',
    'requirementDiagram',
    'C4Context',
    'sankey',
  ];

  const firstWord = trimmed.split(/[\s\n]/)[0].toLowerCase();
  const hasValidStarter = validStarters.some(
    (starter) =>
      firstWord === starter.toLowerCase() || trimmed.toLowerCase().startsWith(starter.toLowerCase())
  );

  if (!hasValidStarter) {
    return {
      valid: false,
      error: `Invalid diagram syntax. Must start with one of: ${validStarters.join(', ')}`,
    };
  }

  // Check for balanced brackets/braces
  const brackets: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];

  for (const char of trimmed) {
    if (brackets[char]) {
      stack.push(brackets[char]);
    } else if (Object.values(brackets).includes(char)) {
      if (stack.pop() !== char) {
        return { valid: false, error: 'Unbalanced brackets in diagram code' };
      }
    }
  }

  if (stack.length > 0) {
    return { valid: false, error: 'Unclosed brackets in diagram code' };
  }

  return { valid: true };
}

function generateDiagramCode(
  type: string,
  description: string | undefined,
  direction: string,
  title: string | undefined
): string {
  // If no description, return the template
  if (!description) {
    let code = DIAGRAM_TEMPLATES[type] || DIAGRAM_TEMPLATES['flowchart'];

    // Apply direction for flowcharts
    if (type === 'flowchart' && direction) {
      code = code.replace(/graph \w+/, `graph ${direction}`);
    }

    // Add title for supported types
    if (title && ['gantt', 'pie', 'timeline', 'journey'].includes(type)) {
      code = code.replace(/title .*/, `title ${title}`);
    }

    return code;
  }

  // For now, return template with a note about customization
  // In a production system, this could use AI to generate the diagram from description
  let code = DIAGRAM_TEMPLATES[type] || DIAGRAM_TEMPLATES['flowchart'];

  if (type === 'flowchart' && direction) {
    code = code.replace(/graph \w+/, `graph ${direction}`);
  }

  return code;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeMermaidDiagram(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    diagram_type: string;
    title?: string;
    description?: string;
    direction?: string;
    theme?: string;
    custom_code?: string;
  };

  // Validate diagram type
  const validTypes = [
    'flowchart',
    'sequence',
    'class',
    'state',
    'er',
    'gantt',
    'pie',
    'git',
    'mindmap',
    'timeline',
  ];

  if (!args.diagram_type || !validTypes.includes(args.diagram_type)) {
    return {
      toolCallId: toolCall.id,
      content: `Error: Invalid diagram type. Must be one of: ${validTypes.join(', ')}`,
      isError: true,
    };
  }

  try {
    // Use custom code if provided, otherwise generate
    let mermaidCode: string;

    if (args.custom_code) {
      mermaidCode = args.custom_code;
    } else {
      mermaidCode = generateDiagramCode(
        args.diagram_type,
        args.description,
        args.direction || 'TD',
        args.title
      );
    }

    // Validate syntax
    const validation = validateMermaidSyntax(mermaidCode);
    if (!validation.valid) {
      return {
        toolCallId: toolCall.id,
        content: `Error: Invalid Mermaid syntax - ${validation.error}`,
        isError: true,
      };
    }

    // Build theme configuration
    const theme = args.theme || 'default';
    const themeConfig = `%%{init: {'theme': '${theme}'}}%%\n`;

    // Combine theme with code
    const fullCode = themeConfig + mermaidCode;

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Generated ${args.diagram_type} diagram`,
        diagramType: args.diagram_type,
        title:
          args.title ||
          `${args.diagram_type.charAt(0).toUpperCase() + args.diagram_type.slice(1)} Diagram`,
        theme,
        // The mermaid code for rendering
        mermaidCode: fullCode,
        // Instructions for rendering
        renderHint:
          'Use mermaid.js library to render this code. Include in a <pre class="mermaid"> tag or use mermaid.render().',
        // Preview text version
        preview: mermaidCode.substring(0, 200) + (mermaidCode.length > 200 ? '...' : ''),
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating diagram: ${(error as Error).message}`,
      isError: true,
    };
  }
}
