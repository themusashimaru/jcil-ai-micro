/**
 * Task Executor - Phase 2: Sequential Execution with Progress Tracking
 *
 * Executes subtasks one at a time, showing progress with checkmarks.
 * Each step's result feeds into the next step for context.
 *
 * Key principles:
 * - Sequential execution (reliable, debuggable)
 * - Real-time progress updates
 * - Result chaining between steps
 * - Graceful error handling
 */

import { createGeminiCompletion } from '@/lib/gemini/client';
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
}

export interface ExecutionContext {
  originalRequest: string;
  completedSteps: StepResult[];
  currentStepIndex: number;
}

export interface ExecutionStreamCallbacks {
  onPlanStart: (plan: TaskPlan) => void;
  onStepStart: (step: SubTask) => void;
  onStepComplete: (step: SubTask, result: StepResult) => void;
  onStepError: (step: SubTask, error: string) => void;
  onSynthesisStart: () => void;
  onComplete: (finalOutput: string) => void;
}

// ============================================================================
// Step Execution Prompts
// ============================================================================

function getStepPrompt(step: SubTask, context: ExecutionContext): string {
  const previousResults = context.completedSteps
    .map(r => `Step ${r.taskId} result: ${r.output.slice(0, 500)}${r.output.length > 500 ? '...' : ''}`)
    .join('\n\n');

  const contextSection = previousResults
    ? `\n\nPrevious steps completed:\n${previousResults}\n\n`
    : '';

  switch (step.type) {
    case 'research':
      return `You are helping with a multi-step task. The user's original request was: "${context.originalRequest}"
${contextSection}
Your current task (Step ${step.id}): ${step.description}

Instructions:
- Search for relevant, current information
- Provide factual, well-sourced findings
- Be concise but comprehensive
- Focus only on this specific step

Provide your research findings:`;

    case 'analysis':
      return `You are helping with a multi-step task. The user's original request was: "${context.originalRequest}"
${contextSection}
Your current task (Step ${step.id}): ${step.description}

Instructions:
- Analyze the information from previous steps
- Identify patterns, trends, or insights
- Use code execution if calculations are needed
- Be specific and data-driven

Provide your analysis:`;

    case 'generation':
      return `You are helping with a multi-step task. The user's original request was: "${context.originalRequest}"
${contextSection}
Your current task (Step ${step.id}): ${step.description}

Instructions:
- Generate the requested content/document
- Use information from previous steps
- Make it professional and well-structured
- Focus on quality and completeness

Generate the content:`;

    case 'creative':
      return `You are helping with a multi-step task. The user's original request was: "${context.originalRequest}"
${contextSection}
Your current task (Step ${step.id}): ${step.description}

Instructions:
- Be creative and engaging
- Build on insights from previous steps
- Make it compelling and well-written

Create the content:`;

    case 'calculation':
      return `You are helping with a multi-step task. The user's original request was: "${context.originalRequest}"
${contextSection}
Your current task (Step ${step.id}): ${step.description}

Instructions:
- Perform the required calculations
- Use code execution for accuracy
- Show your work clearly
- Verify results

Perform the calculation:`;

    default:
      return `You are helping with a multi-step task. The user's original request was: "${context.originalRequest}"
${contextSection}
Your current task (Step ${step.id}): ${step.description}

Complete this step:`;
  }
}

// ============================================================================
// Step Executor
// ============================================================================

async function executeStep(
  step: SubTask,
  context: ExecutionContext,
  model: string,
  userId?: string,
  userTier?: string
): Promise<StepResult> {
  console.log(`[TaskExecutor] Executing step ${step.id}: ${step.description}`);

  try {
    const prompt = getStepPrompt(step, context);
    const messages: CoreMessage[] = [{ role: 'user', content: prompt }];

    // Use search for research tasks, code execution for analysis/calculation
    const enableSearch = step.type === 'research' || step.type === 'analysis' || step.type === 'calculation';

    const result = await createGeminiCompletion({
      messages,
      model,
      maxTokens: 2048,
      temperature: step.type === 'creative' ? 0.8 : 0.5,
      enableSearch,
      userId,
      planKey: userTier,
    });

    console.log(`[TaskExecutor] Step ${step.id} completed successfully`);

    return {
      taskId: step.id,
      success: true,
      output: result.text,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[TaskExecutor] Step ${step.id} failed:`, errorMessage);

    return {
      taskId: step.id,
      success: false,
      output: '',
      error: errorMessage,
    };
  }
}

// ============================================================================
// Synthesis - Combine all results into final output
// ============================================================================

async function synthesizeResults(
  context: ExecutionContext,
  plan: TaskPlan,
  model: string,
  userId?: string,
  userTier?: string
): Promise<string> {
  console.log('[TaskExecutor] Synthesizing final results');

  const stepResults = context.completedSteps
    .filter(r => r.success)
    .map(r => {
      const step = plan.subtasks.find(s => s.id === r.taskId);
      return `## Step ${r.taskId}: ${step?.description || 'Unknown'}\n\n${r.output}`;
    })
    .join('\n\n---\n\n');

  const synthesisPrompt = `You completed a multi-step task for the user. Here's what was accomplished:

Original request: "${context.originalRequest}"

${stepResults}

---

Now provide a final, cohesive response to the user that:
1. Synthesizes all the information gathered
2. Presents it in a clear, professional format
3. Directly addresses their original request
4. Includes any documents, reports, or outputs they requested

Write your final response:`;

  const messages: CoreMessage[] = [{ role: 'user', content: synthesisPrompt }];

  const result = await createGeminiCompletion({
    messages,
    model,
    maxTokens: 4096,
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

export async function executeTaskPlan(
  plan: TaskPlan,
  originalRequest: string,
  model: string,
  userId?: string,
  userTier?: string
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // Initialize context
        const context: ExecutionContext = {
          originalRequest,
          completedSteps: [],
          currentStepIndex: 0,
        };

        // Stream the task plan header
        const planHeader = formatPlanHeader(plan);
        controller.enqueue(encoder.encode(planHeader));

        // Execute each subtask sequentially
        for (const step of plan.subtasks) {
          context.currentStepIndex = step.id;

          // Show step starting
          const stepStartText = `\n⏳ **Step ${step.id}**: ${step.description}...\n`;
          controller.enqueue(encoder.encode(stepStartText));

          // Execute the step
          const result = await executeStep(step, context, model, userId, userTier);

          if (result.success) {
            // Show checkmark and brief result
            const resultPreview = result.output.length > 200
              ? result.output.slice(0, 200) + '...'
              : result.output;
            const stepCompleteText = `✅ **Step ${step.id} Complete**\n> ${resultPreview}\n`;
            controller.enqueue(encoder.encode(stepCompleteText));

            context.completedSteps.push(result);
          } else {
            // Show error but continue
            const stepErrorText = `⚠️ **Step ${step.id} had an issue**: ${result.error}\n`;
            controller.enqueue(encoder.encode(stepErrorText));

            // Still add to context so we can try to continue
            context.completedSteps.push(result);
          }
        }

        // Synthesize final results
        const synthesisHeader = '\n---\n\n**Putting it all together...**\n\n';
        controller.enqueue(encoder.encode(synthesisHeader));

        const finalOutput = await synthesizeResults(context, plan, model, userId, userTier);
        controller.enqueue(encoder.encode(finalOutput));

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[TaskExecutor] Fatal error:', errorMessage);

        const errorText = `\n\n❌ **Error**: Something went wrong during execution. ${errorMessage}\n`;
        controller.enqueue(encoder.encode(errorText));
        controller.close();
      }
    }
  });
}

// ============================================================================
// Helpers
// ============================================================================

function formatPlanHeader(plan: TaskPlan): string {
  const toolEmojis: Record<string, string> = {
    googleSearch: '🔍',
    codeExecution: '⚙️',
    documentGeneration: '📄',
    chat: '💬',
  };

  const lines = [
    '**Task Plan**\n',
    `*${plan.summary}*\n`,
  ];

  for (const task of plan.subtasks) {
    const emoji = toolEmojis[task.estimatedTool] || '📋';
    const dependency = task.dependsOn.length > 0
      ? ` *(after step ${task.dependsOn.join(', ')})*`
      : '';
    lines.push(`${task.id}. ${emoji} ${task.description}${dependency}`);
  }

  lines.push('\n---\n');

  return lines.join('\n');
}

/**
 * Check if sequential execution should be used
 * (Phase 2 feature flag)
 */
export function isSequentialExecutionEnabled(): boolean {
  return process.env.ENABLE_SEQUENTIAL_EXECUTION === 'true';
}
