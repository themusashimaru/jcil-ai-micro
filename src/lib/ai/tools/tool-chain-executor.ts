/**
 * SMART TOOL CHAINING (Enhancement #3)
 *
 * Enables automatic orchestration of multiple tools for complex tasks.
 * The AI can plan and execute multi-step workflows using connected tools.
 *
 * Features:
 * - Tool dependency resolution
 * - Automatic result passing between tools
 * - Progress tracking for multi-step operations
 * - Error recovery and retry logic
 * - Common workflow templates (build & test, refactor & document, etc.)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('ToolChainExecutor');

// ============================================================================
// TYPES
// ============================================================================

export interface ToolChainStep {
  toolName: string;
  arguments: Record<string, unknown>;
  // Optional: Use output from a previous step
  inputFromStep?: number;
  // Optional: Transform the input before passing to this step
  inputTransform?: (previousOutput: string) => Record<string, unknown>;
  // Optional: Condition to check before executing this step
  condition?: (previousResults: ToolChainResult[]) => boolean;
  // Optional: Continue on error (default: false)
  continueOnError?: boolean;
  // Description for progress tracking
  description?: string;
}

export interface ToolChainResult {
  stepIndex: number;
  toolName: string;
  success: boolean;
  output: string;
  error?: string;
  executionTimeMs: number;
}

export interface ToolChainPlan {
  name: string;
  description: string;
  steps: ToolChainStep[];
  // Optional: Rollback steps if the chain fails
  rollbackSteps?: ToolChainStep[];
}

export interface ToolChainProgress {
  planName: string;
  totalSteps: number;
  completedSteps: number;
  currentStep?: string;
  results: ToolChainResult[];
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
}

// ============================================================================
// PREDEFINED WORKFLOW TEMPLATES
// ============================================================================

export const WORKFLOW_TEMPLATES: Record<string, ToolChainPlan> = {
  'build-and-test': {
    name: 'Build and Test',
    description: 'Build the project and run all tests',
    steps: [
      {
        toolName: 'workspace',
        arguments: { operation: 'bash', command: 'npm install' },
        description: 'Installing dependencies',
      },
      {
        toolName: 'workspace',
        arguments: { operation: 'bash', command: 'npm run build' },
        description: 'Building project',
      },
      {
        toolName: 'workspace',
        arguments: { operation: 'bash', command: 'npm test' },
        description: 'Running tests',
        continueOnError: true,
      },
    ],
  },
  'code-review': {
    name: 'Code Review',
    description: 'Analyze code for security, performance, and quality',
    steps: [
      {
        toolName: 'analyze_code',
        arguments: { analysisType: 'security' },
        description: 'Security analysis',
      },
      {
        toolName: 'analyze_code',
        arguments: { analysisType: 'performance' },
        description: 'Performance analysis',
      },
      {
        toolName: 'analyze_code',
        arguments: { analysisType: 'quality' },
        description: 'Quality analysis',
      },
    ],
  },
  'refactor-and-document': {
    name: 'Refactor and Document',
    description: 'Refactor code and generate documentation',
    steps: [
      {
        toolName: 'refactor_code',
        arguments: { type: 'all' },
        description: 'Refactoring code',
      },
      {
        toolName: 'generate_docs',
        arguments: { docType: 'all' },
        description: 'Generating documentation',
        inputFromStep: 0,
      },
    ],
  },
  'generate-and-test': {
    name: 'Generate and Test',
    description: 'Generate code and its tests',
    steps: [
      {
        toolName: 'generate_code',
        arguments: {},
        description: 'Generating code',
      },
      {
        toolName: 'generate_tests',
        arguments: {},
        description: 'Generating tests',
        inputFromStep: 0,
      },
    ],
  },
  'git-commit-flow': {
    name: 'Git Commit Flow',
    description: 'Run tests, build, and commit if successful',
    steps: [
      {
        toolName: 'workspace',
        arguments: { operation: 'bash', command: 'npm test' },
        description: 'Running tests',
      },
      {
        toolName: 'workspace',
        arguments: { operation: 'bash', command: 'npm run build' },
        description: 'Building project',
        condition: (results) => results[0]?.success === true,
      },
      {
        toolName: 'workspace',
        arguments: { operation: 'git_commit', message: 'Auto-commit: tests passed, build successful' },
        description: 'Committing changes',
        condition: (results) => results[1]?.success === true,
      },
    ],
  },
  'full-project-setup': {
    name: 'Full Project Setup',
    description: 'Clone repo, install dependencies, build, and run tests',
    steps: [
      {
        toolName: 'workspace',
        arguments: { operation: 'git_clone' },
        description: 'Cloning repository',
      },
      {
        toolName: 'workspace',
        arguments: { operation: 'bash', command: 'npm install' },
        description: 'Installing dependencies',
      },
      {
        toolName: 'workspace',
        arguments: { operation: 'bash', command: 'npm run build' },
        description: 'Building project',
        continueOnError: true,
      },
      {
        toolName: 'workspace',
        arguments: { operation: 'bash', command: 'npm test' },
        description: 'Running tests',
        continueOnError: true,
      },
    ],
  },
};

// ============================================================================
// TOOL CHAIN EXECUTOR
// ============================================================================

export class ToolChainExecutor {
  private toolExecutors: Map<string, (call: UnifiedToolCall) => Promise<UnifiedToolResult>>;
  private activeChains: Map<string, ToolChainProgress> = new Map();

  constructor(
    toolExecutors: Map<string, (call: UnifiedToolCall) => Promise<UnifiedToolResult>>
  ) {
    this.toolExecutors = toolExecutors;
  }

  /**
   * Execute a tool chain plan
   */
  async execute(
    plan: ToolChainPlan,
    initialArguments?: Record<string, unknown>,
    onProgress?: (progress: ToolChainProgress) => void
  ): Promise<ToolChainProgress> {
    const chainId = `chain-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const progress: ToolChainProgress = {
      planName: plan.name,
      totalSteps: plan.steps.length,
      completedSteps: 0,
      results: [],
      status: 'running',
      startTime: Date.now(),
    };

    this.activeChains.set(chainId, progress);
    log.info('Starting tool chain', { chainId, plan: plan.name, steps: plan.steps.length });

    try {
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        progress.currentStep = step.description || `Step ${i + 1}: ${step.toolName}`;
        onProgress?.(progress);

        // Check condition if specified
        if (step.condition && !step.condition(progress.results)) {
          log.info('Skipping step due to condition', { step: i, toolName: step.toolName });
          progress.results.push({
            stepIndex: i,
            toolName: step.toolName,
            success: true,
            output: '(skipped due to condition)',
            executionTimeMs: 0,
          });
          progress.completedSteps++;
          continue;
        }

        // Prepare arguments
        let stepArgs = { ...step.arguments };

        // Merge initial arguments
        if (initialArguments && i === 0) {
          stepArgs = { ...stepArgs, ...initialArguments };
        }

        // Get input from previous step if specified
        if (step.inputFromStep !== undefined && progress.results[step.inputFromStep]) {
          const previousOutput = progress.results[step.inputFromStep].output;

          if (step.inputTransform) {
            stepArgs = { ...stepArgs, ...step.inputTransform(previousOutput) };
          } else {
            // Default: pass output as 'code' or 'input' parameter
            if (step.toolName.includes('code') || step.toolName.includes('refactor')) {
              stepArgs.code = previousOutput;
            } else {
              stepArgs.input = previousOutput;
            }
          }
        }

        // Execute the step
        const result = await this.executeStep(step.toolName, stepArgs, i);
        progress.results.push(result);
        progress.completedSteps++;

        // Check for failure
        if (!result.success && !step.continueOnError) {
          progress.status = 'failed';
          progress.endTime = Date.now();
          log.error('Tool chain failed at step', { step: i, toolName: step.toolName, error: result.error });

          // Execute rollback if available
          if (plan.rollbackSteps) {
            log.info('Executing rollback steps');
            for (const rollbackStep of plan.rollbackSteps) {
              await this.executeStep(rollbackStep.toolName, rollbackStep.arguments, -1);
            }
          }

          onProgress?.(progress);
          return progress;
        }

        onProgress?.(progress);
      }

      progress.status = 'completed';
      progress.endTime = Date.now();
      log.info('Tool chain completed', {
        chainId,
        plan: plan.name,
        totalTime: progress.endTime - progress.startTime,
      });

      onProgress?.(progress);
      return progress;
    } catch (error) {
      progress.status = 'failed';
      progress.endTime = Date.now();
      log.error('Tool chain error', { error: (error as Error).message });
      onProgress?.(progress);
      return progress;
    } finally {
      this.activeChains.delete(chainId);
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    toolName: string,
    arguments_: Record<string, unknown>,
    stepIndex: number
  ): Promise<ToolChainResult> {
    const startTime = Date.now();
    const executor = this.toolExecutors.get(toolName);

    if (!executor) {
      return {
        stepIndex,
        toolName,
        success: false,
        output: '',
        error: `Tool not found: ${toolName}`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      const toolCall: UnifiedToolCall = {
        id: `chain-step-${stepIndex}-${Date.now()}`,
        name: toolName,
        arguments: arguments_,
      };

      const result = await executor(toolCall);

      return {
        stepIndex,
        toolName,
        success: !result.isError,
        output: result.content,
        error: result.isError ? result.content : undefined,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        stepIndex,
        toolName,
        success: false,
        output: '',
        error: (error as Error).message,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get a workflow template by name
   */
  getTemplate(name: string): ToolChainPlan | undefined {
    return WORKFLOW_TEMPLATES[name];
  }

  /**
   * List available workflow templates
   */
  listTemplates(): Array<{ name: string; description: string }> {
    return Object.entries(WORKFLOW_TEMPLATES).map(([key, plan]) => ({
      name: key,
      description: plan.description,
    }));
  }

  /**
   * Create a custom chain from a list of tool calls
   */
  createChain(
    name: string,
    description: string,
    toolCalls: Array<{ tool: string; args: Record<string, unknown>; description?: string }>
  ): ToolChainPlan {
    return {
      name,
      description,
      steps: toolCalls.map((call) => ({
        toolName: call.tool,
        arguments: call.args,
        description: call.description,
      })),
    };
  }
}

// ============================================================================
// TOOL CHAIN TOOL (Unified Tool Interface)
// ============================================================================

export const toolChainTool: UnifiedTool = {
  name: 'run_workflow',
  description: `Execute a predefined workflow that chains multiple tools together.

Available workflows:
- build-and-test: Install, build, and test a project
- code-review: Analyze code for security, performance, and quality
- refactor-and-document: Refactor code and generate documentation
- generate-and-test: Generate code and its tests
- git-commit-flow: Run tests, build, and commit if successful
- full-project-setup: Clone, install, build, and test a repository

Use this for complex multi-step operations that benefit from automation.`,
  parameters: {
    type: 'object',
    properties: {
      workflow: {
        type: 'string',
        enum: Object.keys(WORKFLOW_TEMPLATES),
        description: 'The workflow to execute',
      },
      customSteps: {
        type: 'array',
        description: 'Optional: Custom steps to execute instead of a predefined workflow. Each step should have: tool (string), args (object), description (string)',
      },
      arguments: {
        type: 'object',
        description: 'Additional arguments to pass to the workflow',
      },
    },
    required: [],
  },
};

// The executor function will be created in the chat route where we have access to all tool executors
export function createToolChainExecutor(
  executors: Map<string, (call: UnifiedToolCall) => Promise<UnifiedToolResult>>
): (toolCall: UnifiedToolCall) => Promise<UnifiedToolResult> {
  const chainExecutor = new ToolChainExecutor(executors);

  return async (toolCall: UnifiedToolCall): Promise<UnifiedToolResult> => {
    const args = typeof toolCall.arguments === 'string'
      ? JSON.parse(toolCall.arguments)
      : toolCall.arguments;

    const { workflow, customSteps, arguments: extraArgs } = args;

    let plan: ToolChainPlan;

    if (customSteps && Array.isArray(customSteps)) {
      // Create custom chain
      plan = chainExecutor.createChain(
        'Custom Workflow',
        'User-defined workflow',
        customSteps
      );
    } else if (workflow) {
      // Use predefined template
      const template = chainExecutor.getTemplate(workflow);
      if (!template) {
        return {
          toolCallId: toolCall.id,
          content: `Unknown workflow: ${workflow}. Available: ${Object.keys(WORKFLOW_TEMPLATES).join(', ')}`,
          isError: true,
        };
      }
      plan = template;
    } else {
      return {
        toolCallId: toolCall.id,
        content: `Please specify a workflow or customSteps. Available workflows: ${Object.keys(WORKFLOW_TEMPLATES).join(', ')}`,
        isError: true,
      };
    }

    // Execute the chain
    const progress = await chainExecutor.execute(plan, extraArgs);

    // Format the result
    const output = formatChainResult(progress);

    return {
      toolCallId: toolCall.id,
      content: output,
      isError: progress.status === 'failed',
    };
  };
}

/**
 * Format chain execution result for display
 */
function formatChainResult(progress: ToolChainProgress): string {
  const lines: string[] = [
    `## Workflow: ${progress.planName}`,
    `Status: ${progress.status.toUpperCase()}`,
    `Steps: ${progress.completedSteps}/${progress.totalSteps}`,
    `Duration: ${progress.endTime ? progress.endTime - progress.startTime : 0}ms`,
    '',
    '### Results:',
  ];

  for (const result of progress.results) {
    const icon = result.success ? '✓' : '✗';
    lines.push(`${icon} **Step ${result.stepIndex + 1}**: ${result.toolName} (${result.executionTimeMs}ms)`);

    if (result.output && result.output !== '(skipped due to condition)') {
      // Truncate long outputs
      const output = result.output.length > 500
        ? result.output.slice(0, 500) + '...'
        : result.output;
      lines.push('```');
      lines.push(output);
      lines.push('```');
    }

    if (result.error) {
      lines.push(`  Error: ${result.error}`);
    }
  }

  return lines.join('\n');
}
