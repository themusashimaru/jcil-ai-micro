/**
 * PLAN MODE SYSTEM
 *
 * Implements structured planning before execution - Claude Code-compatible.
 * Features:
 * - /plan command for structured task breakdown
 * - Approval gates before execution
 * - Step-by-step progress tracking
 * - Auto-accept edits capability
 *
 * The plan mode allows users to:
 * 1. Request a plan before making changes
 * 2. Review and approve each step
 * 3. Track progress through multi-step tasks
 */

import { logger } from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';

const log = logger('PlanMode');

// ============================================================================
// TYPES
// ============================================================================

export type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

export interface PlanStep {
  /** Unique step ID */
  id: string;
  /** Step number (1-indexed) */
  number: number;
  /** Short title for the step */
  title: string;
  /** Detailed description of what will be done */
  description: string;
  /** Files that will be affected */
  files?: string[];
  /** Estimated complexity (low, medium, high) */
  complexity?: 'low' | 'medium' | 'high';
  /** Current status */
  status: PlanStepStatus;
  /** Reason for skipping or failure */
  reason?: string;
  /** Output/result from execution */
  output?: string;
}

export interface Plan {
  /** Unique plan ID */
  id: string;
  /** User's original request */
  request: string;
  /** Plan title/summary */
  title: string;
  /** Overall description */
  description: string;
  /** Individual steps */
  steps: PlanStep[];
  /** Plan status */
  status: 'draft' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  /** Total estimated complexity */
  estimatedComplexity: 'low' | 'medium' | 'high';
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** Current step index (0-based) */
  currentStepIndex: number;
  /** Auto-accept mode enabled */
  autoAccept: boolean;
}

export interface PlanModeSettings {
  /** Whether plan mode is enabled */
  enabled: boolean;
  /** Auto-accept all edits without confirmation */
  autoAccept: boolean;
  /** Show detailed step descriptions */
  showDetails: boolean;
  /** Require approval for high-complexity steps */
  requireApprovalForHigh: boolean;
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

export const DEFAULT_PLAN_SETTINGS: PlanModeSettings = {
  enabled: false,
  autoAccept: false,
  showDetails: true,
  requireApprovalForHigh: true,
};

// ============================================================================
// PLAN MANAGER
// ============================================================================

export class PlanManager {
  private currentPlan: Plan | null = null;
  private settings: PlanModeSettings;
  private onPlanUpdate?: (plan: Plan) => void;
  private onStepComplete?: (step: PlanStep) => void;

  constructor(
    settings: Partial<PlanModeSettings> = {},
    callbacks?: {
      onPlanUpdate?: (plan: Plan) => void;
      onStepComplete?: (step: PlanStep) => void;
    }
  ) {
    this.settings = { ...DEFAULT_PLAN_SETTINGS, ...settings };
    this.onPlanUpdate = callbacks?.onPlanUpdate;
    this.onStepComplete = callbacks?.onStepComplete;
  }

  /**
   * Generate a unique plan ID
   */
  private generateId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique step ID
   */
  private generateStepId(planId: string, index: number): string {
    return `${planId}_step_${index + 1}`;
  }

  /**
   * Create a new plan from a user request
   */
  createPlan(request: string, steps: Array<Omit<PlanStep, 'id' | 'number' | 'status'>>): Plan {
    const planId = this.generateId();

    const plan: Plan = {
      id: planId,
      request,
      title: this.extractTitle(request),
      description: `Plan to: ${request}`,
      steps: steps.map((step, index) => ({
        ...step,
        id: this.generateStepId(planId, index),
        number: index + 1,
        status: 'pending' as PlanStepStatus,
      })),
      status: 'draft',
      estimatedComplexity: this.calculateComplexity(steps.length),
      createdAt: new Date(),
      updatedAt: new Date(),
      currentStepIndex: 0,
      autoAccept: this.settings.autoAccept,
    };

    this.currentPlan = plan;
    log.info('Plan created', { planId, steps: plan.steps.length });
    this.onPlanUpdate?.(plan);

    return plan;
  }

  /**
   * Extract a short title from the request
   */
  private extractTitle(request: string): string {
    // Take first line or first 50 chars
    const firstLine = request.split('\n')[0];
    if (firstLine.length <= 50) return firstLine;
    return firstLine.slice(0, 47) + '...';
  }

  /**
   * Calculate overall complexity based on step count
   */
  private calculateComplexity(stepCount: number): 'low' | 'medium' | 'high' {
    if (stepCount <= 3) return 'low';
    if (stepCount <= 7) return 'medium';
    return 'high';
  }

  /**
   * Get the current plan
   */
  getCurrentPlan(): Plan | null {
    return this.currentPlan;
  }

  /**
   * Approve the current plan
   */
  approvePlan(): boolean {
    if (!this.currentPlan || this.currentPlan.status !== 'draft') {
      return false;
    }

    this.currentPlan.status = 'approved';
    this.currentPlan.updatedAt = new Date();
    log.info('Plan approved', { planId: this.currentPlan.id });
    this.onPlanUpdate?.(this.currentPlan);

    return true;
  }

  /**
   * Start executing the plan
   */
  startPlan(): boolean {
    if (!this.currentPlan || this.currentPlan.status !== 'approved') {
      return false;
    }

    this.currentPlan.status = 'in_progress';
    this.currentPlan.updatedAt = new Date();

    // Mark first step as in progress
    if (this.currentPlan.steps.length > 0) {
      this.currentPlan.steps[0].status = 'in_progress';
    }

    log.info('Plan started', { planId: this.currentPlan.id });
    this.onPlanUpdate?.(this.currentPlan);

    return true;
  }

  /**
   * Complete the current step and move to next
   */
  completeCurrentStep(output?: string): PlanStep | null {
    if (!this.currentPlan || this.currentPlan.status !== 'in_progress') {
      return null;
    }

    const currentStep = this.currentPlan.steps[this.currentPlan.currentStepIndex];
    if (!currentStep) return null;

    // Mark current step as completed
    currentStep.status = 'completed';
    currentStep.output = output;

    this.onStepComplete?.(currentStep);

    // Move to next step
    this.currentPlan.currentStepIndex++;

    if (this.currentPlan.currentStepIndex < this.currentPlan.steps.length) {
      // Mark next step as in progress
      this.currentPlan.steps[this.currentPlan.currentStepIndex].status = 'in_progress';
    } else {
      // All steps completed
      this.currentPlan.status = 'completed';
      log.info('Plan completed', { planId: this.currentPlan.id });
    }

    this.currentPlan.updatedAt = new Date();
    this.onPlanUpdate?.(this.currentPlan);

    return currentStep;
  }

  /**
   * Skip the current step
   */
  skipCurrentStep(reason?: string): PlanStep | null {
    if (!this.currentPlan || this.currentPlan.status !== 'in_progress') {
      return null;
    }

    const currentStep = this.currentPlan.steps[this.currentPlan.currentStepIndex];
    if (!currentStep) return null;

    currentStep.status = 'skipped';
    currentStep.reason = reason || 'Skipped by user';

    // Move to next step
    this.currentPlan.currentStepIndex++;

    if (this.currentPlan.currentStepIndex < this.currentPlan.steps.length) {
      this.currentPlan.steps[this.currentPlan.currentStepIndex].status = 'in_progress';
    } else {
      this.currentPlan.status = 'completed';
    }

    this.currentPlan.updatedAt = new Date();
    this.onPlanUpdate?.(this.currentPlan);

    return currentStep;
  }

  /**
   * Fail the current step
   */
  failCurrentStep(reason: string): PlanStep | null {
    if (!this.currentPlan || this.currentPlan.status !== 'in_progress') {
      return null;
    }

    const currentStep = this.currentPlan.steps[this.currentPlan.currentStepIndex];
    if (!currentStep) return null;

    currentStep.status = 'failed';
    currentStep.reason = reason;

    this.currentPlan.updatedAt = new Date();
    this.onPlanUpdate?.(this.currentPlan);

    return currentStep;
  }

  /**
   * Cancel the plan
   */
  cancelPlan(): boolean {
    if (!this.currentPlan) return false;

    this.currentPlan.status = 'cancelled';
    this.currentPlan.updatedAt = new Date();
    log.info('Plan cancelled', { planId: this.currentPlan.id });
    this.onPlanUpdate?.(this.currentPlan);

    return true;
  }

  /**
   * Clear the current plan
   */
  clearPlan(): void {
    this.currentPlan = null;
  }

  /**
   * Check if plan mode is active
   */
  isActive(): boolean {
    return this.currentPlan !== null && this.currentPlan.status !== 'cancelled';
  }

  /**
   * Check if we need approval for current step
   */
  needsApproval(): boolean {
    if (!this.currentPlan || this.settings.autoAccept) return false;

    if (this.currentPlan.status === 'draft') return true;

    if (this.settings.requireApprovalForHigh) {
      const currentStep = this.currentPlan.steps[this.currentPlan.currentStepIndex];
      if (currentStep?.complexity === 'high') return true;
    }

    return false;
  }

  /**
   * Get current step
   */
  getCurrentStep(): PlanStep | null {
    if (!this.currentPlan) return null;
    return this.currentPlan.steps[this.currentPlan.currentStepIndex] || null;
  }

  /**
   * Get plan progress percentage
   */
  getProgress(): number {
    if (!this.currentPlan || this.currentPlan.steps.length === 0) return 0;

    const completed = this.currentPlan.steps.filter(
      (s) => s.status === 'completed' || s.status === 'skipped'
    ).length;

    return Math.round((completed / this.currentPlan.steps.length) * 100);
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<PlanModeSettings>): void {
    this.settings = { ...this.settings, ...settings };
    if (this.currentPlan) {
      this.currentPlan.autoAccept = this.settings.autoAccept;
    }
  }

  /**
   * Get settings
   */
  getSettings(): PlanModeSettings {
    return { ...this.settings };
  }
}

// ============================================================================
// PLAN GENERATION PROMPT
// ============================================================================

/**
 * Generate a system prompt for plan generation
 */
export function getPlanGenerationPrompt(): string {
  return `You are a software architect helping to plan implementation tasks.

When the user asks you to plan something, respond with a structured plan in this JSON format:

{
  "title": "Brief title for the plan",
  "description": "Overall description of what will be accomplished",
  "steps": [
    {
      "title": "Step title",
      "description": "Detailed description of what this step does",
      "files": ["path/to/file1.ts", "path/to/file2.ts"],
      "complexity": "low" | "medium" | "high"
    }
  ]
}

Guidelines:
- Break down complex tasks into 3-10 steps
- Each step should be independently completable
- Order steps logically (dependencies first)
- Mark complexity based on risk and effort:
  - low: Simple changes, low risk
  - medium: Moderate changes, some complexity
  - high: Complex changes, architectural impact
- List all files that will be modified in each step
- Be specific about what each step accomplishes`;
}

// ============================================================================
// PLAN TOOLS
// ============================================================================

/**
 * Get plan mode tools for the workspace agent
 */
export function getPlanTools(): Anthropic.Tool[] {
  return [
    {
      name: 'plan_create',
      description:
        'Create a new implementation plan. Use this when the user asks to plan something or requests a structured approach.',
      input_schema: {
        type: 'object' as const,
        properties: {
          request: {
            type: 'string',
            description: "The user's request to plan",
          },
          title: {
            type: 'string',
            description: 'Short title for the plan',
          },
          description: {
            type: 'string',
            description: 'Overall description of the plan',
          },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                files: { type: 'array', items: { type: 'string' } },
                complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
              },
              required: ['title', 'description'],
            },
            description: 'List of steps in the plan',
          },
        },
        required: ['request', 'steps'],
      },
    },
    {
      name: 'plan_status',
      description: 'Get the current plan status and progress.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'plan_approve',
      description: 'Approve the current plan to start execution.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'plan_complete_step',
      description: 'Mark the current step as completed.',
      input_schema: {
        type: 'object' as const,
        properties: {
          output: {
            type: 'string',
            description: 'Summary of what was accomplished in this step',
          },
        },
        required: [],
      },
    },
    {
      name: 'plan_skip_step',
      description: 'Skip the current step.',
      input_schema: {
        type: 'object' as const,
        properties: {
          reason: {
            type: 'string',
            description: 'Reason for skipping this step',
          },
        },
        required: [],
      },
    },
    {
      name: 'plan_cancel',
      description: 'Cancel the current plan.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ];
}

/**
 * Execute a plan tool
 */
export function executePlanTool(
  toolName: string,
  input: Record<string, unknown>,
  manager: PlanManager
): string {
  try {
    switch (toolName) {
      case 'plan_create': {
        const request = input.request as string;
        const steps = input.steps as Array<{
          title: string;
          description: string;
          files?: string[];
          complexity?: 'low' | 'medium' | 'high';
        }>;

        if (!request || !steps || steps.length === 0) {
          return 'Error: request and steps are required';
        }

        const plan = manager.createPlan(request, steps);

        const stepList = plan.steps
          .map((s) => `  ${s.number}. ${s.title}${s.complexity ? ` [${s.complexity}]` : ''}`)
          .join('\n');

        return `Plan created: "${plan.title}"\n\nSteps:\n${stepList}\n\nUse plan_approve to start execution.`;
      }

      case 'plan_status': {
        const plan = manager.getCurrentPlan();
        if (!plan) {
          return 'No active plan. Use plan_create to create one.';
        }

        const progress = manager.getProgress();
        const currentStep = manager.getCurrentStep();

        let status = `Plan: ${plan.title}\nStatus: ${plan.status}\nProgress: ${progress}%\n`;

        if (currentStep && plan.status === 'in_progress') {
          status += `\nCurrent step ${currentStep.number}/${plan.steps.length}: ${currentStep.title}`;
        }

        status += '\n\nSteps:\n';
        for (const step of plan.steps) {
          const statusIcon =
            step.status === 'completed'
              ? '✓'
              : step.status === 'in_progress'
                ? '→'
                : step.status === 'skipped'
                  ? '○'
                  : step.status === 'failed'
                    ? '✕'
                    : ' ';
          status += `  ${statusIcon} ${step.number}. ${step.title}\n`;
        }

        return status;
      }

      case 'plan_approve': {
        if (manager.approvePlan()) {
          manager.startPlan();
          const step = manager.getCurrentStep();
          return `Plan approved and started.\nNow executing step 1: ${step?.title}`;
        }
        return 'Error: No plan to approve or plan already approved';
      }

      case 'plan_complete_step': {
        const output = input.output as string | undefined;
        const step = manager.completeCurrentStep(output);
        if (!step) {
          return 'Error: No step to complete';
        }

        const nextStep = manager.getCurrentStep();
        const plan = manager.getCurrentPlan();

        if (nextStep) {
          return `Step ${step.number} completed.\nNow on step ${nextStep.number}: ${nextStep.title}`;
        } else if (plan?.status === 'completed') {
          return `Step ${step.number} completed.\n\nPlan completed successfully!`;
        }

        return `Step ${step.number} completed.`;
      }

      case 'plan_skip_step': {
        const reason = input.reason as string | undefined;
        const step = manager.skipCurrentStep(reason);
        if (!step) {
          return 'Error: No step to skip';
        }

        const nextStep = manager.getCurrentStep();
        if (nextStep) {
          return `Step ${step.number} skipped.\nNow on step ${nextStep.number}: ${nextStep.title}`;
        }

        return `Step ${step.number} skipped.`;
      }

      case 'plan_cancel': {
        if (manager.cancelPlan()) {
          return 'Plan cancelled.';
        }
        return 'Error: No plan to cancel';
      }

      default:
        return `Unknown plan tool: ${toolName}`;
    }
  } catch (error) {
    log.error('Plan tool error', { toolName, error });
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Check if a tool name is a plan tool
 */
export function isPlanTool(toolName: string): boolean {
  return toolName.startsWith('plan_');
}

// ============================================================================
// SINGLETON
// ============================================================================

let managerInstance: PlanManager | null = null;

/**
 * Get the singleton plan manager
 */
export function getPlanManager(
  settings?: Partial<PlanModeSettings>,
  callbacks?: {
    onPlanUpdate?: (plan: Plan) => void;
    onStepComplete?: (step: PlanStep) => void;
  }
): PlanManager {
  if (!managerInstance) {
    managerInstance = new PlanManager(settings, callbacks);
  }
  return managerInstance;
}

/**
 * Clear the plan manager instance
 */
export function clearPlanManager(): void {
  managerInstance = null;
}
