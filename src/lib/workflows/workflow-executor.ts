/**
 * AGENTIC CODE WORKFLOWS (Enhancement #8)
 *
 * User-defined automation workflows for common coding tasks.
 * Trigger phrases like "ship it", "test everything", etc.
 *
 * Features:
 * - Default workflow templates
 * - Custom user workflows
 * - Trigger phrase detection
 * - Progress tracking
 * - Conditional execution
 */

import { logger } from '@/lib/logger';

const log = logger('WorkflowExecutor');

// ============================================================================
// TYPES
// ============================================================================

export interface WorkflowStep {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  description: string;
  condition?: WorkflowCondition;
  onError?: 'stop' | 'continue' | 'retry';
  retryCount?: number;
}

export interface WorkflowCondition {
  type: 'previousSuccess' | 'fileExists' | 'envVar' | 'custom';
  value: string | boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  triggerPhrases: string[];
  steps: WorkflowStep[];
  createdBy?: string; // 'system' or userId
  isDefault?: boolean;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  results: WorkflowStepResult[];
  startTime: Date;
  endTime?: Date;
  error?: string;
}

export interface WorkflowStepResult {
  stepId: string;
  stepDescription: string;
  success: boolean;
  output: string;
  executionTimeMs: number;
  error?: string;
}

// ============================================================================
// DEFAULT WORKFLOWS
// ============================================================================

export const DEFAULT_WORKFLOWS: Workflow[] = [
  {
    id: 'ship-it',
    name: 'Ship It',
    description: 'Run tests, build, lint, and prepare for deployment',
    triggerPhrases: ['ship it', 'deploy', 'release', 'push to production', 'ready to ship'],
    steps: [
      {
        id: 'lint',
        tool: 'workspace',
        arguments: { operation: 'bash', command: 'npm run lint' },
        description: 'Running linter',
        onError: 'continue',
      },
      {
        id: 'test',
        tool: 'workspace',
        arguments: { operation: 'bash', command: 'npm test' },
        description: 'Running tests',
        onError: 'stop',
      },
      {
        id: 'build',
        tool: 'workspace',
        arguments: { operation: 'bash', command: 'npm run build' },
        description: 'Building project',
        condition: { type: 'previousSuccess', value: true },
        onError: 'stop',
      },
      {
        id: 'commit',
        tool: 'workspace',
        arguments: { operation: 'git_status' },
        description: 'Checking git status',
      },
    ],
    isDefault: true,
  },
  {
    id: 'test-everything',
    name: 'Test Everything',
    description: 'Run all tests with coverage',
    triggerPhrases: ['test everything', 'run all tests', 'full test suite', 'coverage'],
    steps: [
      {
        id: 'install',
        tool: 'workspace',
        arguments: { operation: 'bash', command: 'npm ci' },
        description: 'Installing dependencies',
      },
      {
        id: 'unit-tests',
        tool: 'workspace',
        arguments: { operation: 'bash', command: 'npm test -- --coverage' },
        description: 'Running unit tests with coverage',
      },
      {
        id: 'e2e-tests',
        tool: 'workspace',
        arguments: { operation: 'bash', command: 'npm run test:e2e || echo "No e2e tests found"' },
        description: 'Running E2E tests',
        onError: 'continue',
      },
    ],
    isDefault: true,
  },
  {
    id: 'clean-start',
    name: 'Clean Start',
    description: 'Remove node_modules, reinstall, and rebuild',
    triggerPhrases: ['clean start', 'fresh install', 'nuke and rebuild', 'start fresh'],
    steps: [
      {
        id: 'clean',
        tool: 'workspace',
        arguments: { operation: 'bash', command: 'rm -rf node_modules .next dist' },
        description: 'Cleaning build artifacts',
      },
      {
        id: 'install',
        tool: 'workspace',
        arguments: { operation: 'bash', command: 'npm ci' },
        description: 'Installing fresh dependencies',
      },
      {
        id: 'build',
        tool: 'workspace',
        arguments: { operation: 'bash', command: 'npm run build' },
        description: 'Building project',
      },
    ],
    isDefault: true,
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Analyze code quality, security, and performance',
    triggerPhrases: ['review my code', 'code review', 'check my code', 'analyze code'],
    steps: [
      {
        id: 'security',
        tool: 'analyze_code',
        arguments: { analysisType: 'security' },
        description: 'Security analysis',
      },
      {
        id: 'performance',
        tool: 'analyze_code',
        arguments: { analysisType: 'performance' },
        description: 'Performance analysis',
      },
      {
        id: 'quality',
        tool: 'analyze_code',
        arguments: { analysisType: 'quality' },
        description: 'Code quality analysis',
      },
    ],
    isDefault: true,
  },
  {
    id: 'document-project',
    name: 'Document Project',
    description: 'Generate comprehensive documentation',
    triggerPhrases: ['document this', 'generate docs', 'write documentation', 'add docs'],
    steps: [
      {
        id: 'readme',
        tool: 'generate_docs',
        arguments: { docType: 'readme' },
        description: 'Generating README',
      },
      {
        id: 'api',
        tool: 'generate_docs',
        arguments: { docType: 'api' },
        description: 'Generating API documentation',
      },
    ],
    isDefault: true,
  },
  {
    id: 'fix-and-commit',
    name: 'Fix and Commit',
    description: 'Fix errors, format code, and commit changes',
    triggerPhrases: ['fix and commit', 'clean up and save', 'fix it up'],
    steps: [
      {
        id: 'fix',
        tool: 'fix_error',
        arguments: {},
        description: 'Fixing errors',
      },
      {
        id: 'format',
        tool: 'workspace',
        arguments: { operation: 'bash', command: 'npm run format || npx prettier --write .' },
        description: 'Formatting code',
        onError: 'continue',
      },
      {
        id: 'commit',
        tool: 'workspace',
        arguments: { operation: 'git_commit', message: 'fix: auto-fix and format code' },
        description: 'Committing changes',
      },
    ],
    isDefault: true,
  },
];

// ============================================================================
// WORKFLOW EXECUTOR
// ============================================================================

export class AgenticWorkflowExecutor {
  private workflows: Map<string, Workflow> = new Map();
  private activeExecutions: Map<string, WorkflowExecution> = new Map();
  private toolExecutor: (tool: string, args: Record<string, unknown>) => Promise<{ success: boolean; output: string }>;

  constructor(
    toolExecutor: (tool: string, args: Record<string, unknown>) => Promise<{ success: boolean; output: string }>
  ) {
    this.toolExecutor = toolExecutor;

    // Load default workflows
    for (const workflow of DEFAULT_WORKFLOWS) {
      this.workflows.set(workflow.id, workflow);
    }
  }

  /**
   * Detect if user input matches a workflow trigger
   */
  detectTrigger(userInput: string): Workflow | null {
    const inputLower = userInput.toLowerCase().trim();

    for (const workflow of this.workflows.values()) {
      for (const trigger of workflow.triggerPhrases) {
        if (inputLower.includes(trigger.toLowerCase())) {
          log.info('Workflow trigger detected', { trigger, workflowId: workflow.id });
          return workflow;
        }
      }
    }

    return null;
  }

  /**
   * Execute a workflow
   */
  async execute(
    workflow: Workflow,
    onProgress?: (execution: WorkflowExecution) => void
  ): Promise<WorkflowExecution> {
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'running',
      currentStep: 0,
      totalSteps: workflow.steps.length,
      results: [],
      startTime: new Date(),
    };

    this.activeExecutions.set(executionId, execution);
    log.info('Starting workflow execution', { executionId, workflowId: workflow.id });

    try {
      let previousSuccess = true;

      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        execution.currentStep = i + 1;
        onProgress?.(execution);

        // Check condition
        if (step.condition) {
          const shouldRun = this.evaluateCondition(step.condition, previousSuccess);
          if (!shouldRun) {
            execution.results.push({
              stepId: step.id,
              stepDescription: step.description,
              success: true,
              output: '(skipped due to condition)',
              executionTimeMs: 0,
            });
            continue;
          }
        }

        // Execute step
        const result = await this.executeStep(step);
        execution.results.push(result);
        previousSuccess = result.success;

        // Handle error
        if (!result.success) {
          const errorAction = step.onError || 'stop';

          if (errorAction === 'stop') {
            execution.status = 'failed';
            execution.error = `Step "${step.description}" failed: ${result.error}`;
            break;
          }

          if (errorAction === 'retry' && step.retryCount && step.retryCount > 0) {
            // Retry logic
            for (let retry = 0; retry < step.retryCount; retry++) {
              log.info('Retrying step', { stepId: step.id, attempt: retry + 1 });
              const retryResult = await this.executeStep(step);
              if (retryResult.success) {
                // Replace the failed result with successful retry
                execution.results[execution.results.length - 1] = retryResult;
                previousSuccess = true;
                break;
              }
            }
          }
        }

        onProgress?.(execution);
      }

      if (execution.status === 'running') {
        execution.status = 'completed';
      }

      execution.endTime = new Date();
      log.info('Workflow execution completed', {
        executionId,
        status: execution.status,
        duration: execution.endTime.getTime() - execution.startTime.getTime(),
      });

      onProgress?.(execution);
      return execution;
    } catch (error) {
      execution.status = 'failed';
      execution.error = (error as Error).message;
      execution.endTime = new Date();
      log.error('Workflow execution error', { executionId, error: (error as Error).message });
      onProgress?.(execution);
      return execution;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(step: WorkflowStep): Promise<WorkflowStepResult> {
    const startTime = Date.now();

    try {
      const result = await this.toolExecutor(step.tool, step.arguments);

      return {
        stepId: step.id,
        stepDescription: step.description,
        success: result.success,
        output: result.output,
        executionTimeMs: Date.now() - startTime,
        error: result.success ? undefined : result.output,
      };
    } catch (error) {
      return {
        stepId: step.id,
        stepDescription: step.description,
        success: false,
        output: '',
        executionTimeMs: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Evaluate a workflow condition
   */
  private evaluateCondition(condition: WorkflowCondition, previousSuccess: boolean): boolean {
    switch (condition.type) {
      case 'previousSuccess':
        return previousSuccess === condition.value;
      case 'envVar':
        return !!process.env[condition.value as string];
      default:
        return true;
    }
  }

  /**
   * Add a custom workflow
   */
  addWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
    log.info('Custom workflow added', { workflowId: workflow.id });
  }

  /**
   * Remove a workflow
   */
  removeWorkflow(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (workflow?.isDefault) {
      log.warn('Cannot remove default workflow', { workflowId });
      return false;
    }
    return this.workflows.delete(workflowId);
  }

  /**
   * List all workflows
   */
  listWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): WorkflowExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Cancel an execution
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.status = 'cancelled';
      execution.endTime = new Date();
      this.activeExecutions.delete(executionId);
      log.info('Workflow execution cancelled', { executionId });
      return true;
    }
    return false;
  }
}

/**
 * Format workflow execution for display
 */
export function formatWorkflowExecution(execution: WorkflowExecution): string {
  const lines: string[] = [
    `## Workflow: ${execution.workflowName}`,
    `**Status**: ${execution.status.toUpperCase()}`,
    `**Progress**: ${execution.currentStep}/${execution.totalSteps} steps`,
    '',
  ];

  if (execution.error) {
    lines.push(`**Error**: ${execution.error}`);
    lines.push('');
  }

  lines.push('### Step Results:');
  for (const result of execution.results) {
    const icon = result.success ? '\u2713' : '\u2717';
    lines.push(`${icon} **${result.stepDescription}** (${result.executionTimeMs}ms)`);
    if (result.output && result.output !== '(skipped due to condition)') {
      const shortOutput = result.output.length > 200
        ? result.output.slice(0, 200) + '...'
        : result.output;
      lines.push('```');
      lines.push(shortOutput);
      lines.push('```');
    }
  }

  if (execution.endTime) {
    const duration = execution.endTime.getTime() - execution.startTime.getTime();
    lines.push('');
    lines.push(`**Total Duration**: ${duration}ms`);
  }

  return lines.join('\n');
}
