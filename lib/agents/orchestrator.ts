/**
 * MULTI-AGENT ORCHESTRATOR
 *
 * PURPOSE:
 * - Coordinate multiple specialized AI agents
 * - Route tasks to appropriate agents
 * - Combine outputs from multiple agents
 * - Enable complex multi-step workflows
 */

export type AgentType = 'researcher' | 'architect' | 'coder' | 'reviewer' | 'tester';

export interface AgentTask {
  id: string;
  type: AgentType;
  prompt: string;
  context?: string;
  dependencies?: string[]; // Task IDs that must complete first
}

export interface AgentResult {
  taskId: string;
  agentType: AgentType;
  success: boolean;
  output: string;
  artifacts?: Record<string, string>; // filename -> content
  suggestions?: string[];
  errors?: string[];
  duration: number;
}

export interface OrchestrationPlan {
  id: string;
  name: string;
  description: string;
  tasks: AgentTask[];
  createdAt: Date;
}

// Agent specializations and capabilities
export const AGENT_SPECS: Record<AgentType, {
  name: string;
  icon: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
}> = {
  researcher: {
    name: 'Research Agent',
    icon: '🔬',
    description: 'Gathers information, analyzes requirements, and provides context',
    capabilities: [
      'Web search and research',
      'Documentation analysis',
      'Requirement extraction',
      'Technology comparison',
      'Best practices research',
    ],
    systemPrompt: `You are a Research Agent. Your role is to:
1. Analyze the user's requirements thoroughly
2. Research relevant technologies, patterns, and best practices
3. Identify potential challenges and considerations
4. Provide comprehensive context for other agents
5. Cite sources and provide evidence for recommendations

Output your findings in a structured format with clear sections.`,
  },
  architect: {
    name: 'Architect Agent',
    icon: '📐',
    description: 'Designs system architecture, file structures, and technical approach',
    capabilities: [
      'System architecture design',
      'File structure planning',
      'Technology stack selection',
      'API design',
      'Database schema design',
    ],
    systemPrompt: `You are an Architect Agent. Your role is to:
1. Design the overall system architecture
2. Plan the file and folder structure
3. Select appropriate technologies and patterns
4. Design APIs and data models
5. Create technical specifications

Output a detailed architecture document with diagrams described in text.`,
  },
  coder: {
    name: 'Coder Agent',
    icon: '💻',
    description: 'Writes clean, production-ready code following best practices',
    capabilities: [
      'Code generation',
      'Implementation of features',
      'Bug fixes',
      'Code refactoring',
      'Documentation generation',
    ],
    systemPrompt: `You are a Coder Agent. Your role is to:
1. Write clean, maintainable, production-ready code
2. Follow the architecture and specifications provided
3. Implement features completely with error handling
4. Add appropriate comments and documentation
5. Follow best practices and coding standards

Output complete, runnable code files with proper structure.`,
  },
  reviewer: {
    name: 'Reviewer Agent',
    icon: '👁️',
    description: 'Reviews code for quality, security, and best practices',
    capabilities: [
      'Code review',
      'Security analysis',
      'Performance review',
      'Best practices enforcement',
      'Improvement suggestions',
    ],
    systemPrompt: `You are a Reviewer Agent. Your role is to:
1. Review code for quality and maintainability
2. Check for security vulnerabilities
3. Identify performance issues
4. Ensure best practices are followed
5. Suggest improvements and optimizations

Output a structured review with specific, actionable feedback.`,
  },
  tester: {
    name: 'Tester Agent',
    icon: '🧪',
    description: 'Creates and runs tests to ensure code quality',
    capabilities: [
      'Test case generation',
      'Unit test writing',
      'Integration test planning',
      'Edge case identification',
      'Test execution',
    ],
    systemPrompt: `You are a Tester Agent. Your role is to:
1. Analyze code and identify test cases
2. Write comprehensive unit tests
3. Plan integration tests
4. Identify edge cases and error scenarios
5. Verify functionality and report issues

Output test files and a testing report with coverage analysis.`,
  },
};

// Create an orchestration plan for a complex task
export function createOrchestrationPlan(
  taskDescription: string,
  taskType: 'project' | 'feature' | 'bugfix' | 'review'
): OrchestrationPlan {
  const planId = `plan_${Date.now()}`;

  const plans: Record<string, AgentTask[]> = {
    project: [
      {
        id: `${planId}_research`,
        type: 'researcher',
        prompt: `Research requirements and best practices for: ${taskDescription}`,
      },
      {
        id: `${planId}_architect`,
        type: 'architect',
        prompt: `Design the architecture and file structure for: ${taskDescription}`,
        dependencies: [`${planId}_research`],
      },
      {
        id: `${planId}_code`,
        type: 'coder',
        prompt: `Implement the project according to the architecture: ${taskDescription}`,
        dependencies: [`${planId}_architect`],
      },
      {
        id: `${planId}_review`,
        type: 'reviewer',
        prompt: `Review the implementation for quality and security`,
        dependencies: [`${planId}_code`],
      },
      {
        id: `${planId}_test`,
        type: 'tester',
        prompt: `Create tests for the implementation`,
        dependencies: [`${planId}_code`],
      },
    ],
    feature: [
      {
        id: `${planId}_research`,
        type: 'researcher',
        prompt: `Research implementation approach for feature: ${taskDescription}`,
      },
      {
        id: `${planId}_architect`,
        type: 'architect',
        prompt: `Plan the technical approach for feature: ${taskDescription}`,
        dependencies: [`${planId}_research`],
      },
      {
        id: `${planId}_code`,
        type: 'coder',
        prompt: `Implement the feature: ${taskDescription}`,
        dependencies: [`${planId}_architect`],
      },
      {
        id: `${planId}_test`,
        type: 'tester',
        prompt: `Test the feature implementation`,
        dependencies: [`${planId}_code`],
      },
    ],
    bugfix: [
      {
        id: `${planId}_research`,
        type: 'researcher',
        prompt: `Analyze the bug and identify root cause: ${taskDescription}`,
      },
      {
        id: `${planId}_code`,
        type: 'coder',
        prompt: `Fix the bug: ${taskDescription}`,
        dependencies: [`${planId}_research`],
      },
      {
        id: `${planId}_test`,
        type: 'tester',
        prompt: `Verify the bug fix and add regression tests`,
        dependencies: [`${planId}_code`],
      },
    ],
    review: [
      {
        id: `${planId}_review`,
        type: 'reviewer',
        prompt: `Perform a comprehensive code review: ${taskDescription}`,
      },
      {
        id: `${planId}_test`,
        type: 'tester',
        prompt: `Analyze test coverage and suggest improvements`,
        dependencies: [`${planId}_review`],
      },
    ],
  };

  return {
    id: planId,
    name: `${taskType.charAt(0).toUpperCase() + taskType.slice(1)} Plan`,
    description: taskDescription,
    tasks: plans[taskType] || plans.feature,
    createdAt: new Date(),
  };
}

// Execute a single agent task
export async function executeAgentTask(
  task: AgentTask,
  context: string,
  llmCall: (systemPrompt: string, userPrompt: string) => Promise<string>
): Promise<AgentResult> {
  const startTime = Date.now();
  const agentSpec = AGENT_SPECS[task.type];

  try {
    const fullPrompt = task.context
      ? `Context:\n${task.context}\n\nTask:\n${task.prompt}`
      : `Context:\n${context}\n\nTask:\n${task.prompt}`;

    const output = await llmCall(agentSpec.systemPrompt, fullPrompt);

    return {
      taskId: task.id,
      agentType: task.type,
      success: true,
      output,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      taskId: task.id,
      agentType: task.type,
      success: false,
      output: '',
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      duration: Date.now() - startTime,
    };
  }
}

// Execute an orchestration plan
export async function executeOrchestrationPlan(
  plan: OrchestrationPlan,
  initialContext: string,
  llmCall: (systemPrompt: string, userPrompt: string) => Promise<string>,
  onProgress?: (completed: number, total: number, currentTask: AgentTask) => void
): Promise<AgentResult[]> {
  const results: Map<string, AgentResult> = new Map();
  const completed = new Set<string>();
  let remaining = [...plan.tasks];

  while (remaining.length > 0) {
    // Find tasks whose dependencies are all completed
    const ready = remaining.filter((task) => {
      if (!task.dependencies) return true;
      return task.dependencies.every((dep) => completed.has(dep));
    });

    if (ready.length === 0 && remaining.length > 0) {
      throw new Error('Circular dependency detected in orchestration plan');
    }

    // Execute ready tasks in parallel
    const promises = ready.map(async (task) => {
      onProgress?.(completed.size, plan.tasks.length, task);

      // Build context from dependencies
      const depContext = task.dependencies
        ?.map((depId) => {
          const result = results.get(depId);
          return result ? `### ${AGENT_SPECS[result.agentType].name} Output:\n${result.output}` : '';
        })
        .join('\n\n') || initialContext;

      const result = await executeAgentTask(task, depContext, llmCall);
      return { task, result };
    });

    const taskResults = await Promise.all(promises);

    for (const { task, result } of taskResults) {
      results.set(task.id, result);
      completed.add(task.id);
      remaining = remaining.filter((t) => t.id !== task.id);
    }
  }

  return Array.from(results.values());
}

// Get agent by type
export function getAgentSpec(type: AgentType) {
  return AGENT_SPECS[type];
}

// List all agents
export function listAgents() {
  return Object.entries(AGENT_SPECS).map(([type, spec]) => ({
    type: type as AgentType,
    ...spec,
  }));
}
