/**
 * AUTONOMOUS TASK EXECUTOR
 *
 * Executes multi-step tasks autonomously in the background.
 * Uses AI to plan, execute, and verify each step.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { AutonomousTask, TaskContext, TaskPlan, TaskResult, TaskStep, TaskStatus } from './types';
import { executeAgent } from '@/lib/multi-agent/orchestrator';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Service client for database
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Generate unique ID
function generateId(): string {
  return 'task_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/**
 * Plan an autonomous task from a user request
 */
export async function planTask(
  request: string,
  context: TaskContext
): Promise<TaskPlan> {
  console.log('[AutonomousTask] Planning task:', request.substring(0, 50));

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are a task planner for an autonomous coding assistant.

Given a user request, break it down into concrete, executable steps.

For each step, specify:
- name: Short name (2-5 words)
- description: What this step accomplishes
- type: One of: analyze, generate, review, test, deploy
- agentType: Which specialized agent should handle it (frontend, backend, test, reviewer)

Return a JSON object with:
{
  "title": "Brief task title",
  "description": "What this task will accomplish",
  "steps": [...],
  "estimatedDuration": <seconds>
}

Be specific and actionable. Each step should be independently executable.`,
    messages: [
      {
        role: 'user',
        content: `Plan this task: "${request}"

${context.repo ? `Repository: ${context.repo.owner}/${context.repo.name} (${context.repo.branch})` : ''}

Return only valid JSON, no markdown.`,
      },
    ],
  });

  let content = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      content += block.text;
    }
  }

  try {
    // Parse JSON, removing any markdown
    const jsonStr = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(jsonStr) as TaskPlan;
  } catch {
    // Fallback to simple plan
    return {
      title: 'Execute Request',
      description: request,
      steps: [
        {
          name: 'Analyze',
          description: 'Analyze the request and determine approach',
          type: 'analyze',
        },
        {
          name: 'Execute',
          description: 'Execute the main task',
          type: 'generate',
        },
        {
          name: 'Review',
          description: 'Review and verify the result',
          type: 'review',
          agentType: 'reviewer',
        },
      ],
      estimatedDuration: 60,
    };
  }
}

/**
 * Create and queue a new autonomous task
 */
export async function createTask(
  request: string,
  context: TaskContext
): Promise<AutonomousTask> {
  const supabase = createServiceClient();

  // Plan the task
  const plan = await planTask(request, context);

  // Create task record
  const taskId = generateId();
  const steps: TaskStep[] = plan.steps.map((step, index) => ({
    id: `step_${index}_${Date.now()}`,
    name: step.name,
    description: step.description,
    status: 'queued' as TaskStatus,
  }));

  const task: AutonomousTask = {
    id: taskId,
    userId: context.userId,
    sessionId: context.sessionId,
    title: plan.title,
    description: plan.description,
    status: 'queued',
    steps,
    currentStep: 0,
    totalSteps: steps.length,
    progress: 0,
    repo: context.repo,
    createdAt: new Date(),
    estimatedDuration: plan.estimatedDuration,
  };

  // Save to database
  await supabase.from('autonomous_tasks').insert({
    id: task.id,
    user_id: task.userId,
    session_id: task.sessionId,
    title: task.title,
    description: task.description,
    status: task.status,
    steps: JSON.stringify(task.steps),
    current_step: task.currentStep,
    total_steps: task.totalSteps,
    progress: task.progress,
    repo: task.repo ? JSON.stringify(task.repo) : null,
    created_at: task.createdAt.toISOString(),
    estimated_duration: task.estimatedDuration,
  });

  console.log(`[AutonomousTask] Created task ${taskId} with ${steps.length} steps`);

  return task;
}

/**
 * Execute an autonomous task
 */
export async function executeTask(
  taskId: string,
  context: TaskContext
): Promise<TaskResult> {
  const supabase = createServiceClient();

  // Get task from database
  const { data: taskData, error: fetchError } = await supabase
    .from('autonomous_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (fetchError || !taskData) {
    return { success: false, output: 'Task not found' };
  }

  const task: AutonomousTask = {
    id: taskData.id,
    userId: taskData.user_id,
    sessionId: taskData.session_id,
    title: taskData.title,
    description: taskData.description,
    status: taskData.status,
    steps: JSON.parse(taskData.steps || '[]'),
    currentStep: taskData.current_step,
    totalSteps: taskData.total_steps,
    progress: taskData.progress,
    repo: taskData.repo ? JSON.parse(taskData.repo) : undefined,
    createdAt: new Date(taskData.created_at),
    startedAt: taskData.started_at ? new Date(taskData.started_at) : undefined,
    completedAt: taskData.completed_at ? new Date(taskData.completed_at) : undefined,
    estimatedDuration: taskData.estimated_duration,
  };

  // Update status to running
  await updateTaskStatus(taskId, 'running');
  await supabase
    .from('autonomous_tasks')
    .update({ started_at: new Date().toISOString() })
    .eq('id', taskId);

  console.log(`[AutonomousTask] Starting execution of task ${taskId}`);

  let fullOutput = '';
  const allFiles: Array<{ path: string; content: string; action: 'create' | 'update' | 'delete' }> = [];

  try {
    // Execute each step
    for (let i = 0; i < task.steps.length; i++) {
      const step = task.steps[i];

      // Update current step
      await updateTaskStep(taskId, i, 'running');

      console.log(`[AutonomousTask] Executing step ${i + 1}/${task.steps.length}: ${step.name}`);

      // Execute the step using the appropriate agent
      const agentType = getAgentForStepType(step);
      const instruction = buildStepInstruction(step, task, fullOutput);

      const agentContext = {
        userId: context.userId,
        sessionId: context.sessionId,
        repo: context.repo ? {
          owner: context.repo.owner,
          name: context.repo.name,
          branch: context.repo.branch,
          fullName: `${context.repo.owner}/${context.repo.name}`,
        } : undefined,
        previousMessages: context.conversationHistory,
      };

      const result = await executeAgent(agentType, instruction, agentContext);

      // Store step output
      step.output = result.content;
      step.status = 'completed';
      step.completedAt = new Date();

      fullOutput += `\n\n## ${step.name}\n\n${result.content}`;

      // Collect files
      if (result.files) {
        allFiles.push(...result.files.map(f => ({
          path: f.path,
          content: f.content,
          action: 'create' as const,
        })));
      }

      // Update step status
      await updateTaskStep(taskId, i, 'completed', result.content);

      // Update progress
      const progress = Math.round(((i + 1) / task.steps.length) * 100);
      await supabase
        .from('autonomous_tasks')
        .update({
          progress,
          current_step: i + 1,
          steps: JSON.stringify(task.steps),
        })
        .eq('id', taskId);
    }

    // Task completed successfully
    await updateTaskStatus(taskId, 'completed', fullOutput);
    await supabase
      .from('autonomous_tasks')
      .update({
        completed_at: new Date().toISOString(),
        result: fullOutput,
      })
      .eq('id', taskId);

    console.log(`[AutonomousTask] Task ${taskId} completed successfully`);

    return {
      success: true,
      output: fullOutput,
      files: allFiles.length > 0 ? allFiles : undefined,
      nextSteps: ['Review the generated output', 'Test the implementation', 'Deploy if ready'],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update task with error
    await updateTaskStatus(taskId, 'failed', undefined, errorMessage);

    console.error(`[AutonomousTask] Task ${taskId} failed:`, errorMessage);

    return {
      success: false,
      output: fullOutput || 'Task execution failed',
      suggestions: ['Try breaking down the task into smaller parts', 'Check for any missing dependencies'],
    };
  }
}

/**
 * Get the appropriate agent type for a step
 */
function getAgentForStepType(step: TaskStep & { type?: string; agentType?: string }): 'frontend' | 'backend' | 'test' | 'reviewer' {
  // Use explicit agent type if provided
  if (step.agentType) {
    return step.agentType as 'frontend' | 'backend' | 'test' | 'reviewer';
  }

  // Infer from step type
  switch (step.type) {
    case 'test':
      return 'test';
    case 'review':
      return 'reviewer';
    case 'deploy':
      return 'backend';
    default:
      return 'frontend';
  }
}

/**
 * Build instruction for a step
 */
function buildStepInstruction(step: TaskStep, task: AutonomousTask, previousOutput: string): string {
  let instruction = `Task: ${task.title}\n\n`;
  instruction += `Overall Goal: ${task.description}\n\n`;
  instruction += `Current Step: ${step.name}\n`;
  instruction += `Step Description: ${step.description}\n\n`;

  if (previousOutput) {
    instruction += `Previous Steps Output:\n${previousOutput.slice(-2000)}\n\n`;
  }

  instruction += `Execute this step and provide detailed output.`;

  return instruction;
}

/**
 * Update task status in database
 */
async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  result?: string,
  error?: string
) {
  const supabase = createServiceClient();

  const update: Record<string, unknown> = { status };
  if (result) update.result = result;
  if (error) update.error = error;

  await supabase.from('autonomous_tasks').update(update).eq('id', taskId);
}

/**
 * Update a specific step in the task
 */
async function updateTaskStep(
  taskId: string,
  stepIndex: number,
  status: TaskStatus,
  output?: string
) {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('autonomous_tasks')
    .select('steps')
    .eq('id', taskId)
    .single();

  if (data) {
    const steps = JSON.parse(data.steps || '[]');
    if (steps[stepIndex]) {
      steps[stepIndex].status = status;
      if (output) steps[stepIndex].output = output;
      if (status === 'running') steps[stepIndex].startedAt = new Date().toISOString();
      if (status === 'completed') steps[stepIndex].completedAt = new Date().toISOString();

      await supabase
        .from('autonomous_tasks')
        .update({ steps: JSON.stringify(steps) })
        .eq('id', taskId);
    }
  }
}

/**
 * Cancel a running task
 */
export async function cancelTask(taskId: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('autonomous_tasks')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', taskId);

  return !error;
}

/**
 * Get task status
 */
export async function getTaskStatus(taskId: string): Promise<AutonomousTask | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('autonomous_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    sessionId: data.session_id,
    title: data.title,
    description: data.description,
    status: data.status,
    steps: JSON.parse(data.steps || '[]'),
    currentStep: data.current_step,
    totalSteps: data.total_steps,
    progress: data.progress,
    result: data.result,
    error: data.error,
    repo: data.repo ? JSON.parse(data.repo) : undefined,
    createdAt: new Date(data.created_at),
    startedAt: data.started_at ? new Date(data.started_at) : undefined,
    completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    estimatedDuration: data.estimated_duration,
  };
}

/**
 * Get all tasks for a user
 */
export async function getUserTasks(userId: string, limit = 10): Promise<AutonomousTask[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('autonomous_tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map(task => ({
    id: task.id,
    userId: task.user_id,
    sessionId: task.session_id,
    title: task.title,
    description: task.description,
    status: task.status,
    steps: JSON.parse(task.steps || '[]'),
    currentStep: task.current_step,
    totalSteps: task.total_steps,
    progress: task.progress,
    result: task.result,
    error: task.error,
    repo: task.repo ? JSON.parse(task.repo) : undefined,
    createdAt: new Date(task.created_at),
    startedAt: task.started_at ? new Date(task.started_at) : undefined,
    completedAt: task.completed_at ? new Date(task.completed_at) : undefined,
    estimatedDuration: task.estimated_duration,
  }));
}
