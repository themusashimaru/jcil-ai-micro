/**
 * Task Executor - Phase 2: Sequential Execution with Progress Tracking
 *
 * Executes subtasks one at a time, showing progress with checkmarks.
 * Each step's result feeds into the next step for context.
 *
 * Key principles:
 * - Sequential execution (reliable, debuggable)
 * - Real-time progress updates with timing
 * - Result chaining between steps
 * - Retry logic for resilience
 * - Professional, clean output formatting
 */

import { createGeminiCompletion } from '@/lib/gemini/client';
import { executeForTaskType } from './tools';
import type { CoreMessage } from 'ai';
import type { SubTask, TaskPlan } from './index';

// ============================================================================
// Types
// ============================================================================

export interface StepResult {
  taskId: number;
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
  retryCount: number;
}

export interface ExecutionContext {
  originalRequest: string;
  completedSteps: StepResult[];
  currentStepIndex: number;
  totalSteps: number;
  startTime: number;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  maxRetries: 2,           // Retry failed steps up to 2 times
  retryDelayMs: 1000,      // Wait 1 second between retries
  maxResultPreview: 300,   // Characters to show in step preview
  maxTokensPerStep: 2048,  // Token limit per step
  maxTokensSynthesis: 4096 // Token limit for final synthesis
};

// ============================================================================
// Step Executor with Retry Logic (Uses Tool Registry)
// ============================================================================

async function executeStepWithRetry(
  step: SubTask,
  context: ExecutionContext,
  model: string,
  userId?: string,
  userTier?: string
): Promise<StepResult> {
  const startTime = Date.now();
  let lastError = '';

  // Build context from previous successful steps
  const previousContext = context.completedSteps
    .filter(r => r.success)
    .map(r => r.output)
    .join('\n\n---\n\n');

  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      console.log(`[TaskExecutor] Retry ${attempt}/${CONFIG.maxRetries} for step ${step.id}`);
      await sleep(CONFIG.retryDelayMs * attempt); // Exponential backoff
    }

    try {
      // Use Tool Registry to execute the step
      const toolResult = await executeForTaskType(
        step.type,
        {
          query: step.description,
          context: previousContext || undefined,
          originalRequest: context.originalRequest,
        },
        {
          model,
          userId,
          userTier,
          maxTokens: CONFIG.maxTokensPerStep,
          temperature: step.type === 'creative' ? 0.8 : 0.5,
        }
      );

      const durationMs = Date.now() - startTime;

      if (toolResult.success) {
        console.log(`[TaskExecutor] Step ${step.id} completed in ${durationMs}ms using tool`);
        return {
          taskId: step.id,
          success: true,
          output: toolResult.content,
          durationMs,
          retryCount: attempt,
        };
      } else {
        lastError = toolResult.error || 'Tool execution failed';
        console.error(`[TaskExecutor] Step ${step.id} tool failed:`, lastError);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[TaskExecutor] Step ${step.id} attempt ${attempt + 1} failed:`, lastError);
    }
  }

  // All retries exhausted
  const durationMs = Date.now() - startTime;
  return {
    taskId: step.id,
    success: false,
    output: '',
    error: lastError,
    durationMs,
    retryCount: CONFIG.maxRetries,
  };
}

// ============================================================================
// Synthesis - Combine all results into final output (Improved)
// ============================================================================

async function synthesizeResults(
  context: ExecutionContext,
  plan: TaskPlan,
  model: string,
  userId?: string,
  userTier?: string
): Promise<string> {
  console.log('[TaskExecutor] Synthesizing final results');

  const successfulSteps = context.completedSteps.filter(r => r.success);
  const failedSteps = context.completedSteps.filter(r => !r.success);

  if (successfulSteps.length === 0) {
    return `I apologize, but I wasn't able to complete any of the steps successfully. Please try again or rephrase your request.`;
  }

  const stepResults = successfulSteps
    .map(r => {
      const step = plan.subtasks.find(s => s.id === r.taskId);
      return `## ${step?.description || `Step ${r.taskId}`}\n\n${r.output}`;
    })
    .join('\n\n---\n\n');

  const failureNote = failedSteps.length > 0
    ? `\n\nNote: ${failedSteps.length} step(s) encountered issues but we proceeded with available information.`
    : '';

  const synthesisPrompt = `You completed a multi-step task for the user. Here's what was accomplished:

## Original Request
"${context.originalRequest}"

## Completed Steps (${successfulSteps.length}/${context.totalSteps})
${stepResults}
${failureNote}

---

## Your Task
Create a **final, polished response** for the user that:

1. **Synthesizes** all information into a cohesive, professional output
2. **Directly addresses** their original request
3. **Highlights** key findings, insights, or deliverables
4. **Formats** appropriately (use headers, bullets, etc. for readability)
5. **Feels complete** - the user should have everything they asked for

If they requested a specific deliverable (report, analysis, summary), make sure it's clearly presented.

Do NOT mention the step-by-step process - just deliver the final result naturally.

Write your response:`;

  const messages: CoreMessage[] = [{ role: 'user', content: synthesisPrompt }];

  const result = await createGeminiCompletion({
    messages,
    model,
    maxTokens: CONFIG.maxTokensSynthesis,
    temperature: 0.6,
    enableSearch: false,
    userId,
    planKey: userTier,
  });

  return result.text;
}

// ============================================================================
// Main Executor - Creates a streaming response with progress updates
// ============================================================================

export interface CheckpointState {
  plan: TaskPlan;
  originalRequest: string;
  completedSteps: StepResult[];
  nextStepIndex: number;
}

export async function executeTaskPlan(
  plan: TaskPlan,
  originalRequest: string,
  model: string,
  userId?: string,
  userTier?: string,
  resumeFrom?: CheckpointState // Optional: resume from a checkpoint
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const executionStartTime = Date.now();

      try {
        // Initialize or restore context
        const startIndex = resumeFrom?.nextStepIndex || 0;
        const context: ExecutionContext = {
          originalRequest,
          completedSteps: resumeFrom?.completedSteps || [],
          currentStepIndex: startIndex,
          totalSteps: plan.subtasks.length,
          startTime: executionStartTime,
        };

        // Stream the task plan header (only if starting fresh)
        if (!resumeFrom) {
          const planHeader = formatPlanHeader(plan);
          controller.enqueue(encoder.encode(planHeader));
        } else {
          // Show resumption message
          const resumeMsg = `\n**Continuing from step ${startIndex + 1}...**\n\n`;
          controller.enqueue(encoder.encode(resumeMsg));
        }

        // Execute each subtask sequentially
        for (let i = startIndex; i < plan.subtasks.length; i++) {
          const step = plan.subtasks[i];
          context.currentStepIndex = step.id;

          // Show step starting with progress
          const stepStartText = formatStepStart(step, i + 1, plan.subtasks.length);
          controller.enqueue(encoder.encode(stepStartText));

          // Execute the step with retry
          const result = await executeStepWithRetry(step, context, model, userId, userTier);

          if (result.success) {
            // Show success with timing and preview
            const stepCompleteText = formatStepComplete(step, result);
            controller.enqueue(encoder.encode(stepCompleteText));
            context.completedSteps.push(result);
          } else {
            // Show error
            const stepErrorText = formatStepError(step, result);
            controller.enqueue(encoder.encode(stepErrorText));
            context.completedSteps.push(result);
          }

          // Check for checkpoint AFTER step completes (not on last step)
          const isLastStep = i === plan.subtasks.length - 1;
          if (step.requiresCheckpoint && !isLastStep && result.success) {
            // Pause at checkpoint
            const remainingSteps = plan.subtasks.slice(i + 1);
            const checkpointText = formatCheckpoint(step, remainingSteps, context, plan);
            controller.enqueue(encoder.encode(checkpointText));
            controller.close();
            return; // Exit - user will trigger continuation
          }
        }

        // Show synthesis starting
        const successCount = context.completedSteps.filter(s => s.success).length;
        const synthesisHeader = formatSynthesisStart(successCount, plan.subtasks.length);
        controller.enqueue(encoder.encode(synthesisHeader));

        // Generate final output
        const finalOutput = await synthesizeResults(context, plan, model, userId, userTier);
        controller.enqueue(encoder.encode(finalOutput));

        // Add completion footer
        const totalDuration = Date.now() - executionStartTime;
        const footer = formatCompletionFooter(successCount, plan.subtasks.length, totalDuration);
        controller.enqueue(encoder.encode(footer));

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[TaskExecutor] Fatal error:', errorMessage);

        const errorText = formatFatalError(errorMessage);
        controller.enqueue(encoder.encode(errorText));
        controller.close();
      }
    }
  });
}

// ============================================================================
// Formatting Helpers - Clean, Professional Output
// ============================================================================

function formatPlanHeader(plan: TaskPlan): string {
  const toolEmojis: Record<string, string> = {
    googleSearch: '🔍',
    codeExecution: '⚙️',
    documentGeneration: '📄',
    chat: '💬',
    research: '🔍',
    analysis: '📊',
    generation: '📝',
    creative: '✨',
    calculation: '🔢',
  };

  const lines = [
    '## 📋 Task Plan',
    '',
    `> ${plan.summary}`,
    '',
  ];

  for (const task of plan.subtasks) {
    const emoji = toolEmojis[task.estimatedTool] || toolEmojis[task.type] || '📋';
    const dependency = task.dependsOn.length > 0
      ? ` → *depends on step ${task.dependsOn.join(', ')}*`
      : '';
    lines.push(`**${task.id}.** ${emoji} ${task.description}${dependency}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

function formatStepStart(step: SubTask, current: number, total: number): string {
  const progressBar = createProgressBar(current - 1, total);
  return `${progressBar} **Step ${current}/${total}:** ${step.description}\n\n`;
}

function formatStepComplete(_step: SubTask, result: StepResult): string {
  const duration = formatDuration(result.durationMs);
  const retryNote = result.retryCount > 0 ? ` *(${result.retryCount} retry)*` : '';

  // Smart preview - find a good break point
  let preview = result.output;
  if (preview.length > CONFIG.maxResultPreview) {
    // Try to break at a sentence or newline
    const truncated = preview.slice(0, CONFIG.maxResultPreview);
    const lastSentence = truncated.lastIndexOf('. ');
    const lastNewline = truncated.lastIndexOf('\n');
    const breakPoint = Math.max(lastSentence, lastNewline, CONFIG.maxResultPreview - 50);
    preview = preview.slice(0, breakPoint > 0 ? breakPoint + 1 : CONFIG.maxResultPreview) + '...';
  }

  return `✅ **Complete** (${duration}${retryNote})\n> ${preview.replace(/\n/g, '\n> ')}\n\n`;
}

function formatStepError(_step: SubTask, result: StepResult): string {
  const duration = formatDuration(result.durationMs);
  return `⚠️ **Issue encountered** (${duration}, ${result.retryCount + 1} attempts)\n> ${result.error}\n> *Continuing with available information...*\n\n`;
}

function formatCheckpoint(
  completedStep: SubTask,
  remainingSteps: SubTask[],
  context: ExecutionContext,
  plan: TaskPlan
): string {
  const completedCount = context.completedSteps.length;
  const totalCount = plan.subtasks.length;

  const remainingList = remainingSteps
    .map((s, idx) => `  ${completedCount + idx + 1}. ${s.description}`)
    .join('\n');

  // Encode checkpoint state for resumption (base64 JSON)
  const checkpointState: CheckpointState = {
    plan,
    originalRequest: context.originalRequest,
    completedSteps: context.completedSteps,
    nextStepIndex: completedCount,
  };
  const encodedState = Buffer.from(JSON.stringify(checkpointState)).toString('base64');

  // Hide checkpoint state at the end - will be filtered by frontend or ignored by users
  return `
---

⏸️ **Checkpoint - Step ${completedCount}/${totalCount} Complete**

I've completed the ${completedStep.description.toLowerCase()}. Before I continue, would you like to:

**Remaining steps:**
${remainingList}

---

👉 **Reply "continue" to proceed** with the remaining steps, or let me know if you'd like to adjust the plan.

[c:${encodedState}]
`;
}

function formatSynthesisStart(successCount: number, totalCount: number): string {
  if (successCount === totalCount) {
    return `---\n\n✨ **All ${totalCount} steps complete!** Preparing your results...\n\n`;
  } else {
    return `---\n\n📋 **${successCount}/${totalCount} steps complete.** Preparing results from available information...\n\n`;
  }
}

function formatCompletionFooter(successCount: number, totalCount: number, durationMs: number): string {
  const duration = formatDuration(durationMs);
  return `\n\n---\n*✓ Task completed in ${duration} (${successCount}/${totalCount} steps successful)*`;
}

function formatFatalError(errorMessage: string): string {
  return `\n\n---\n\n❌ **Something went wrong**\n\nI encountered an error while processing your request: ${errorMessage}\n\nPlease try again or rephrase your request.\n`;
}

function createProgressBar(completed: number, total: number): string {
  const filled = '●';
  const empty = '○';
  const current = '◉';

  let bar = '';
  for (let i = 0; i < total; i++) {
    if (i < completed) {
      bar += filled;
    } else if (i === completed) {
      bar += current;
    } else {
      bar += empty;
    }
  }
  return `[${bar}]`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Feature Flag
// ============================================================================

/**
 * Check if sequential execution should be used
 * (Phase 2 feature flag)
 */
export function isSequentialExecutionEnabled(): boolean {
  return process.env.ENABLE_SEQUENTIAL_EXECUTION === 'true';
}
