/**
 * PROJECT PLANNER
 *
 * The second stage of the Code Agent brain.
 * Creates comprehensive project architecture:
 * - File structure
 * - Dependencies
 * - Build order
 * - Task breakdown
 *
 * This is where we do methodical planning like senior engineers.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  CodeIntent,
  ProjectPlan,
  PlannedFile,
  BuildStep,
  PlanTask,
  ArchitectureLayer,
} from '../../core/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export class ProjectPlanner {
  // Opus 4.5 for maximum reasoning power - crush Manus
  private model = 'claude-opus-4-5-20251101';

  /**
   * Create a comprehensive project plan
   */
  async plan(intent: CodeIntent): Promise<ProjectPlan> {
    const prompt = `You are a senior software architect creating a detailed project plan. Think methodically like a principal engineer.

PROJECT TO BUILD:
${intent.refinedDescription}

PROJECT TYPE: ${intent.projectType}
COMPLEXITY: ${intent.complexity}
ESTIMATED FILES: ${intent.estimatedFiles}

REQUIREMENTS:
- Functional: ${intent.requirements.functional.join('; ')}
- Technical: ${intent.requirements.technical.join('; ')}
- Constraints: ${intent.requirements.constraints.join('; ')}

TECHNOLOGY STACK:
- Primary: ${intent.technologies.primary}
- Secondary: ${intent.technologies.secondary.join(', ')}
- Runtime: ${intent.technologies.runtime}
- Package Manager: ${intent.technologies.packageManager}
${intent.technologies.testFramework ? `- Test Framework: ${intent.technologies.testFramework}` : ''}

Create a comprehensive project plan. Think about:
1. ARCHITECTURE - What pattern makes sense? Why?
2. FILE STRUCTURE - Every file needed, in order of creation
3. DEPENDENCIES - Exact packages with versions
4. BUILD STEPS - How to install, build, test
5. TASK BREAKDOWN - Actionable tasks for execution

Respond with this EXACT JSON structure:
{
  "name": "project-name-kebab-case",
  "description": "One line description",
  "architecture": {
    "pattern": "Pattern name (e.g., 'Modular Monolith', 'Clean Architecture')",
    "layers": [
      {
        "name": "Layer name",
        "purpose": "What this layer does",
        "files": ["file paths in this layer"]
      }
    ],
    "rationale": "Why this architecture was chosen"
  },
  "fileTree": [
    {
      "path": "relative/path/to/file.ts",
      "purpose": "What this file does",
      "dependencies": ["paths of files this depends on"],
      "priority": 1,
      "estimatedLines": 50,
      "isEntryPoint": false,
      "isConfig": false
    }
  ],
  "dependencies": {
    "production": {
      "package-name": "^version"
    },
    "development": {
      "package-name": "^version"
    }
  },
  "buildSteps": [
    {
      "order": 1,
      "command": "npm install",
      "description": "Install dependencies",
      "failureAction": "stop"
    }
  ],
  "testStrategy": {
    "approach": "How we'll test this",
    "testFiles": ["test file paths"]
  },
  "risks": ["Potential issues to watch for"],
  "taskBreakdown": [
    {
      "id": "task_1",
      "title": "Setup project structure",
      "description": "Create package.json, tsconfig, etc.",
      "status": "pending",
      "files": ["package.json", "tsconfig.json"],
      "estimatedTime": "2 minutes"
    }
  ]
}

PLANNING RULES:
1. fileTree MUST include: package.json, README.md, config files, source files, tests
2. Files must be ordered by dependency (config first, then shared, then main code)
3. Priority 1 = create first, higher numbers = create later
4. Include tsconfig.json for TypeScript projects
5. Include .gitignore with appropriate patterns
6. buildSteps should verify the project works
7. taskBreakdown should be 3-8 clear tasks
8. Use REALISTIC line estimates
9. Include at least one test file

OUTPUT ONLY THE JSON OBJECT.`;

    try {
      const response = await anthropic.messages.create({
        model: this.model,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Build the plan with proper typing
      const plan: ProjectPlan = {
        id: `plan_${Date.now()}`,
        name: this.sanitizeName(parsed.name || 'project'),
        description: String(parsed.description || intent.refinedDescription),
        architecture: {
          pattern: String(parsed.architecture?.pattern || 'Modular'),
          layers: this.buildLayers(parsed.architecture?.layers),
          rationale: String(parsed.architecture?.rationale || 'Standard modular architecture'),
        },
        fileTree: this.buildFileTree(parsed.fileTree),
        dependencies: {
          production: (parsed.dependencies?.production as Record<string, string>) || {},
          development: (parsed.dependencies?.development as Record<string, string>) || {},
        },
        buildSteps: this.buildBuildSteps(parsed.buildSteps),
        testStrategy: {
          approach: String(parsed.testStrategy?.approach || 'Unit tests'),
          testFiles: (parsed.testStrategy?.testFiles as string[]) || [],
        },
        risks: (parsed.risks as string[]) || [],
        taskBreakdown: this.buildTasks(parsed.taskBreakdown),
      };

      // Validate and fix the plan
      return this.validatePlan(plan, intent);
    } catch (error) {
      console.error('[ProjectPlanner] Error creating plan:', error);
      return this.createFallbackPlan(intent);
    }
  }

  /**
   * Sanitize project name
   */
  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Build architecture layers
   */
  private buildLayers(layers: unknown[]): ArchitectureLayer[] {
    if (!layers || !Array.isArray(layers)) return [];
    return layers.map((l: unknown) => {
      const layer = l as Record<string, unknown>;
      return {
        name: String(layer.name || 'Layer'),
        purpose: String(layer.purpose || ''),
        files: (layer.files as string[]) || [],
      };
    });
  }

  /**
   * Build file tree with proper ordering
   */
  private buildFileTree(files: unknown[]): PlannedFile[] {
    if (!files || !Array.isArray(files)) return [];

    return files.map((f: unknown, index: number) => {
      const file = f as Record<string, unknown>;
      return {
        path: String(file.path || `file_${index}.ts`),
        purpose: String(file.purpose || 'Source file'),
        dependencies: (file.dependencies as string[]) || [],
        priority: Number(file.priority) || index + 1,
        estimatedLines: Number(file.estimatedLines) || 20,
        isEntryPoint: Boolean(file.isEntryPoint),
        isConfig: Boolean(file.isConfig) || String(file.path).match(/\.(json|yml|yaml|config\.\w+)$/) !== null,
      };
    }).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Build build steps
   */
  private buildBuildSteps(steps: unknown[]): BuildStep[] {
    if (!steps || !Array.isArray(steps)) {
      return [
        { order: 1, command: 'npm install', description: 'Install dependencies', failureAction: 'stop' },
        { order: 2, command: 'npm run build', description: 'Build project', failureAction: 'stop' },
      ];
    }

    return steps.map((s: unknown, index: number) => {
      const step = s as Record<string, unknown>;
      return {
        order: Number(step.order) || index + 1,
        command: String(step.command || 'npm run build'),
        description: String(step.description || 'Build step'),
        failureAction: (['stop', 'continue', 'retry'].includes(String(step.failureAction))
          ? step.failureAction
          : 'stop') as BuildStep['failureAction'],
      };
    }).sort((a, b) => a.order - b.order);
  }

  /**
   * Build task breakdown
   */
  private buildTasks(tasks: unknown[]): PlanTask[] {
    if (!tasks || !Array.isArray(tasks)) return [];

    return tasks.map((t: unknown, index: number) => {
      const task = t as Record<string, unknown>;
      return {
        id: String(task.id || `task_${index}`),
        title: String(task.title || `Task ${index + 1}`),
        description: String(task.description || ''),
        status: 'pending' as const,
        files: (task.files as string[]) || [],
        estimatedTime: task.estimatedTime ? String(task.estimatedTime) : undefined,
      };
    });
  }

  /**
   * Validate and fix the plan
   */
  private validatePlan(plan: ProjectPlan, intent: CodeIntent): ProjectPlan {
    // Ensure package.json exists
    if (!plan.fileTree.some(f => f.path === 'package.json')) {
      plan.fileTree.unshift({
        path: 'package.json',
        purpose: 'Project manifest and dependencies',
        dependencies: [],
        priority: 1,
        estimatedLines: 30,
        isConfig: true,
      });
    }

    // Ensure README.md exists
    if (!plan.fileTree.some(f => f.path === 'README.md')) {
      plan.fileTree.push({
        path: 'README.md',
        purpose: 'Project documentation',
        dependencies: [],
        priority: 999,
        estimatedLines: 50,
        isConfig: false,
      });
    }

    // Ensure .gitignore exists
    if (!plan.fileTree.some(f => f.path === '.gitignore')) {
      plan.fileTree.splice(1, 0, {
        path: '.gitignore',
        purpose: 'Git ignore patterns',
        dependencies: [],
        priority: 2,
        estimatedLines: 20,
        isConfig: true,
      });
    }

    // Add tsconfig.json for TypeScript projects
    if (intent.technologies.primary.toLowerCase().includes('typescript')) {
      if (!plan.fileTree.some(f => f.path === 'tsconfig.json')) {
        plan.fileTree.splice(2, 0, {
          path: 'tsconfig.json',
          purpose: 'TypeScript configuration',
          dependencies: [],
          priority: 3,
          estimatedLines: 25,
          isConfig: true,
        });
      }
    }

    // Re-sort by priority
    plan.fileTree.sort((a, b) => a.priority - b.priority);

    return plan;
  }

  /**
   * Create fallback plan if planning fails
   */
  private createFallbackPlan(intent: CodeIntent): ProjectPlan {
    const isTypescript = intent.technologies.primary.toLowerCase().includes('typescript');
    const ext = isTypescript ? 'ts' : 'js';

    return {
      id: `plan_fallback_${Date.now()}`,
      name: 'project',
      description: intent.refinedDescription,
      architecture: {
        pattern: 'Simple',
        layers: [
          { name: 'Source', purpose: 'Application code', files: [`src/index.${ext}`] },
        ],
        rationale: 'Simple single-file structure for quick implementation',
      },
      fileTree: [
        { path: 'package.json', purpose: 'Dependencies', dependencies: [], priority: 1, estimatedLines: 25, isConfig: true },
        { path: '.gitignore', purpose: 'Git ignores', dependencies: [], priority: 2, estimatedLines: 15, isConfig: true },
        ...(isTypescript ? [{ path: 'tsconfig.json', purpose: 'TypeScript config', dependencies: [], priority: 3, estimatedLines: 20, isConfig: true }] : []),
        { path: `src/index.${ext}`, purpose: 'Main entry point', dependencies: [], priority: 4, estimatedLines: 50, isEntryPoint: true },
        { path: 'README.md', purpose: 'Documentation', dependencies: [], priority: 5, estimatedLines: 30 },
      ],
      dependencies: {
        production: {},
        development: isTypescript ? { typescript: '^5.0.0', '@types/node': '^20.0.0' } : {},
      },
      buildSteps: [
        { order: 1, command: 'npm install', description: 'Install dependencies', failureAction: 'stop' },
        ...(isTypescript ? [{ order: 2, command: 'npx tsc --noEmit', description: 'Type check', failureAction: 'stop' as const }] : []),
      ],
      testStrategy: {
        approach: 'Manual testing',
        testFiles: [],
      },
      risks: ['Basic fallback plan - may need manual adjustments'],
      taskBreakdown: [
        { id: 'task_1', title: 'Setup project', description: 'Create configuration files', status: 'pending', files: ['package.json'] },
        { id: 'task_2', title: 'Implement main logic', description: 'Write the core functionality', status: 'pending', files: [`src/index.${ext}`] },
        { id: 'task_3', title: 'Add documentation', description: 'Create README', status: 'pending', files: ['README.md'] },
      ],
    };
  }

  /**
   * Update a task's status
   */
  updateTaskStatus(plan: ProjectPlan, taskId: string, status: PlanTask['status']): ProjectPlan {
    return {
      ...plan,
      taskBreakdown: plan.taskBreakdown.map(task =>
        task.id === taskId ? { ...task, status } : task
      ),
    };
  }
}

export const projectPlanner = new ProjectPlanner();
