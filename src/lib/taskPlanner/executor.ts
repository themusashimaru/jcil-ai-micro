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
 * - Retry logic with self-correction for resilience
 * - Professional, clean output formatting
 * - AUTONOMOUS MODE: Runs all steps without checkpoints, self-corrects on errors
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
  maxTokensSynthesis: 4096, // Token limit for final synthesis
  // Autonomous mode settings
  adaptiveRetry: true,     // Try different approach on retry
  selfCorrectOnError: true // Attempt to fix errors automatically
};

// ============================================================================
// Step Executor with Retry Logic (Uses Tool Registry)
// ============================================================================

async function executeStepWithRetry(
  step: SubTask,
  context: ExecutionContext,
  model: string,
  userId?: string,
  userTier?: string,
  githubToken?: string,
  selectedRepo?: SelectedRepoContext,
  autonomousMode?: boolean
): Promise<StepResult> {
  const startTime = Date.now();
  let lastError = '';
  let adaptedQuery = step.description;

  // Build context from previous successful steps
  const previousContext = context.completedSteps
    .filter(r => r.success)
    .map(r => r.output)
    .join('\n\n---\n\n');

  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
    if (attempt > 0) {
      console.log(`[TaskExecutor] Retry ${attempt}/${CONFIG.maxRetries} for step ${step.id}`);
      await sleep(CONFIG.retryDelayMs * attempt); // Exponential backoff

      // ADAPTIVE RETRY: Modify the approach based on the error
      if (CONFIG.adaptiveRetry && lastError) {
        adaptedQuery = buildAdaptiveQuery(step.description, lastError, attempt);
        console.log(`[TaskExecutor] Adaptive retry with modified query`);
      }
    }

    try {
      // Use Tool Registry to execute the step
      const toolResult = await executeForTaskType(
        step.type,
        {
          query: adaptedQuery,
          context: previousContext || undefined,
          originalRequest: context.originalRequest,
        },
        {
          model,
          userId,
          userTier,
          maxTokens: CONFIG.maxTokensPerStep,
          temperature: step.type === 'creative' ? 0.8 : 0.5,
          githubToken,
          selectedRepo,
        }
      );

      const durationMs = Date.now() - startTime;

      if (toolResult.success) {
        const retryNote = attempt > 0 ? ` (succeeded on retry ${attempt})` : '';
        console.log(`[TaskExecutor] Step ${step.id} completed in ${durationMs}ms${retryNote}`);
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

  // All retries exhausted - in autonomous mode, try self-correction
  if (autonomousMode && CONFIG.selfCorrectOnError) {
    const correctionResult = await attemptSelfCorrection(step, lastError, context, model, userId);
    if (correctionResult) {
      return correctionResult;
    }
  }

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

/**
 * Build an adaptive query based on the previous error
 */
function buildAdaptiveQuery(originalQuery: string, error: string, attempt: number): string {
  // Add context about the error and ask for alternative approach
  if (attempt === 1) {
    return `${originalQuery}

Note: A previous attempt failed with this error: "${error}"
Please try a different approach or work around this issue.`;
  } else {
    return `${originalQuery}

Important: Multiple attempts have failed. The last error was: "${error}"
Please use a simpler, more reliable approach. Focus on what CAN be done.`;
  }
}

/**
 * Attempt self-correction when all retries fail (autonomous mode only)
 */
async function attemptSelfCorrection(
  step: SubTask,
  error: string,
  context: ExecutionContext,
  model: string,
  userId?: string
): Promise<StepResult | null> {
  console.log(`[TaskExecutor] Attempting self-correction for step ${step.id}`);

  try {
    // Ask the AI to analyze and correct the issue
    const correctionPrompt = `A task step failed and needs your help to recover.

**Original Task:** ${step.description}
**Error Encountered:** ${error}
**Context:** This is step ${step.id} of a larger task: "${context.originalRequest}"

Please:
1. Analyze why this might have failed
2. Provide an alternative solution or workaround
3. If the step cannot be completed, explain what partial progress can be made

Focus on delivering value despite the error.`;

    const messages: CoreMessage[] = [{ role: 'user', content: correctionPrompt }];
    const result = await createGeminiCompletion({
      messages,
      model,
      userId,
      maxTokens: CONFIG.maxTokensPerStep,
      temperature: 0.5,
    });

    if (result.text && result.text.length > 50) {
      console.log(`[TaskExecutor] Self-correction succeeded for step ${step.id}`);
      return {
        taskId: step.id,
        success: true,
        output: `*[Auto-recovered from error]*\n\n${result.text}`,
        durationMs: 0,
        retryCount: CONFIG.maxRetries + 1, // Indicates self-correction was used
      };
    }
  } catch (correctionError) {
    console.error(`[TaskExecutor] Self-correction failed:`, correctionError);
  }

  return null;
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

export interface SelectedRepoContext {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
}

export interface ExecutionOptions {
  autonomousMode?: boolean;  // Run without checkpoints, with self-correction
  skipCheckpoints?: boolean; // Just skip checkpoints without full autonomous features
}

export async function executeTaskPlan(
  plan: TaskPlan,
  originalRequest: string,
  model: string,
  userId?: string,
  userTier?: string,
  resumeFrom?: CheckpointState, // Optional: resume from a checkpoint
  githubToken?: string, // For code review tasks
  selectedRepo?: SelectedRepoContext, // User-selected repo from dropdown
  options?: ExecutionOptions // Execution options including autonomous mode
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const autonomousMode = options?.autonomousMode ?? false;
  const skipCheckpoints = options?.skipCheckpoints ?? autonomousMode;

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
          const planHeader = formatPlanHeader(plan, autonomousMode);
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
          const stepStartText = formatStepStart(step, i + 1, plan.subtasks.length, autonomousMode);
          controller.enqueue(encoder.encode(stepStartText));

          // Execute the step with retry (and self-correction in autonomous mode)
          const result = await executeStepWithRetry(
            step, context, model, userId, userTier, githubToken, selectedRepo, autonomousMode
          );

          if (result.success) {
            // Show success with timing and preview
            const wasRecovered = result.retryCount > CONFIG.maxRetries;
            const stepCompleteText = formatStepComplete(step, result, wasRecovered);
            controller.enqueue(encoder.encode(stepCompleteText));
            context.completedSteps.push(result);
          } else {
            // Show error
            const stepErrorText = formatStepError(step, result, autonomousMode);
            controller.enqueue(encoder.encode(stepErrorText));
            context.completedSteps.push(result);

            // In autonomous mode, continue despite errors
            if (autonomousMode) {
              const continueMsg = `\n*Continuing to next step...*\n\n`;
              controller.enqueue(encoder.encode(continueMsg));
            }
          }

          // Check for checkpoint AFTER step completes (not on last step)
          // SKIP checkpoints in autonomous mode - run all the way through
          const isLastStep = i === plan.subtasks.length - 1;
          if (step.requiresCheckpoint && !isLastStep && result.success && !skipCheckpoints) {
            // Pause at checkpoint (only in non-autonomous mode)
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

        // Add completion footer with proactive suggestions
        const totalDuration = Date.now() - executionStartTime;
        const taskTypes = plan.subtasks.map(s => s.type);
        const footer = formatCompletionFooter(successCount, plan.subtasks.length, totalDuration, taskTypes);
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

function formatPlanHeader(plan: TaskPlan, autonomousMode?: boolean): string {
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
    gitWorkflow: '🔧',
  };

  const modeIndicator = autonomousMode
    ? '## 🤖 Autonomous Mode - Working...\n\n*Running all steps automatically with self-correction.*\n\n'
    : '';

  const lines = [
    modeIndicator + '## 📋 Task Plan',
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

function formatStepStart(step: SubTask, current: number, total: number, autonomousMode?: boolean): string {
  const progressBar = createProgressBar(current - 1, total);
  const modeHint = autonomousMode ? ' 🤖' : '';
  return `${progressBar} **Step ${current}/${total}:**${modeHint} ${step.description}\n\n`;
}

function formatStepComplete(_step: SubTask, result: StepResult, wasRecovered?: boolean): string {
  const duration = formatDuration(result.durationMs);
  const retryNote = result.retryCount > 0
    ? wasRecovered
      ? ' *(auto-recovered)*'
      : ` *(${result.retryCount} retry)*`
    : '';

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

function formatStepError(_step: SubTask, result: StepResult, autonomousMode?: boolean): string {
  const duration = formatDuration(result.durationMs);
  const continueNote = autonomousMode
    ? '*Auto-recovering and continuing...*'
    : '*Continuing with available information...*';
  return `⚠️ **Issue encountered** (${duration}, ${result.retryCount + 1} attempts)\n> ${result.error}\n> ${continueNote}\n\n`;
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

function formatCompletionFooter(successCount: number, totalCount: number, durationMs: number, taskTypes?: string[]): string {
  const duration = formatDuration(durationMs);
  let footer = `\n\n---\n*✓ Task completed in ${duration} (${successCount}/${totalCount} steps successful)*`;

  // Add proactive suggestions based on task types
  if (successCount === totalCount && taskTypes && taskTypes.length > 0) {
    const suggestions = getProactiveSuggestions(taskTypes);
    if (suggestions.length > 0) {
      footer += '\n\n**What else can I help with?**\n';
      suggestions.forEach(s => {
        footer += `- ${s}\n`;
      });
    }
  }

  return footer;
}

/**
 * Get proactive suggestions based on completed task types
 */
function getProactiveSuggestions(taskTypes: string[]): string[] {
  const suggestions: string[] = [];
  const seen = new Set<string>();

  for (const type of taskTypes) {
    let typeSuggestions: string[] = [];

    switch (type) {
      case 'research':
      case 'deep-research':
        typeSuggestions = [
          'Create a summary document or presentation',
          'Dive deeper into a specific area',
          'Compare this with alternative approaches',
        ];
        break;
      case 'analysis':
        typeSuggestions = [
          'Generate a report with visualizations',
          'Explore related data or trends',
          'Create an action plan based on findings',
        ];
        break;
      case 'generation':
        typeSuggestions = [
          'Refine or adjust the content',
          'Create additional versions for different audiences',
          'Export to a different format',
        ];
        break;
      case 'code-review':
        typeSuggestions = [
          'Fix the issues I identified',
          'Add tests for the code',
          'Refactor for better performance',
          'Create a PR with the improvements',
        ];
        break;
      case 'creative':
        typeSuggestions = [
          'Explore alternative creative directions',
          'Expand on a specific element',
          'Create variations of this concept',
        ];
        break;
      default:
        typeSuggestions = [
          'Refine or adjust this output',
          'Create a related document',
        ];
    }

    // Add unique suggestions
    for (const s of typeSuggestions) {
      if (!seen.has(s)) {
        seen.add(s);
        suggestions.push(s);
      }
    }
  }

  // Limit to top 3 suggestions
  return suggestions.slice(0, 3);
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
