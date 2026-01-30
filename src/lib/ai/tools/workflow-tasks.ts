/**
 * WORKFLOW TASKS - Claude Code Style Todo List
 *
 * Simple, clean task tracking for multi-step workflows.
 * No emojis, no fancy Unicode checkboxes - just clean ASCII.
 *
 * Format with borders:
 * ┌─────────────────────────────────────────┐
 * │            Task Progress                │
 * ├─────────────────────────────────────────┤
 * │ [x] Completed task                      │
 * │ [>] In-progress task...                 │
 * │ [ ] Pending task                        │
 * └─────────────────────────────────────────┘
 */

import { logger } from '@/lib/logger';

const log = logger('WorkflowTasks');

// ============================================================================
// TYPES
// ============================================================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface WorkflowTask {
  id: string;
  content: string;
  status: TaskStatus;
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface Workflow {
  id: string;
  name: string;
  tasks: WorkflowTask[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
}

// ============================================================================
// STATUS SYMBOLS - Clean ASCII, no emojis
// ============================================================================

const STATUS_SYMBOLS: Record<TaskStatus, string> = {
  pending: '[ ]',
  in_progress: '[>]',
  completed: '[x]',
  skipped: '[-]',
};

// ============================================================================
// WORKFLOW MANAGER
// ============================================================================

const activeWorkflows = new Map<string, Workflow>();
const WORKFLOW_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Create a new workflow with tasks
 */
export function createWorkflow(
  sessionId: string,
  name: string,
  taskDescriptions: string[]
): Workflow {
  // Cleanup old workflows
  cleanupOldWorkflows();

  const workflow: Workflow = {
    id: `wf_${sessionId}_${Date.now()}`,
    name,
    tasks: taskDescriptions.map((content, index) => ({
      id: `task_${index + 1}`,
      content,
      status: 'pending',
    })),
    status: 'planning',
    createdAt: Date.now(),
  };

  activeWorkflows.set(workflow.id, workflow);
  log.debug('Workflow created', { id: workflow.id, taskCount: workflow.tasks.length });

  return workflow;
}

/**
 * Get an existing workflow
 */
export function getWorkflow(workflowId: string): Workflow | undefined {
  return activeWorkflows.get(workflowId);
}

/**
 * Update a task's status
 */
export function updateTaskStatus(
  workflowId: string,
  taskId: string,
  status: TaskStatus,
  result?: string,
  error?: string
): Workflow | undefined {
  const workflow = activeWorkflows.get(workflowId);
  if (!workflow) return undefined;

  const task = workflow.tasks.find((t) => t.id === taskId);
  if (!task) return undefined;

  task.status = status;
  if (status === 'in_progress') {
    task.startedAt = Date.now();
  }
  if (status === 'completed' || status === 'skipped') {
    task.completedAt = Date.now();
  }
  if (result) task.result = result;
  if (error) task.error = error;

  // Update workflow status
  const allCompleted = workflow.tasks.every(
    (t) => t.status === 'completed' || t.status === 'skipped'
  );
  const anyInProgress = workflow.tasks.some((t) => t.status === 'in_progress');
  const anyFailed = workflow.tasks.some((t) => t.error);

  if (allCompleted) {
    workflow.status = anyFailed ? 'failed' : 'completed';
    workflow.completedAt = Date.now();
  } else if (anyInProgress) {
    workflow.status = 'executing';
  }

  log.debug('Task updated', { workflowId, taskId, status });
  return workflow;
}

/**
 * Start the next pending task
 */
export function startNextTask(
  workflowId: string
): { workflow: Workflow; task: WorkflowTask } | undefined {
  const workflow = activeWorkflows.get(workflowId);
  if (!workflow) return undefined;

  const nextTask = workflow.tasks.find((t) => t.status === 'pending');
  if (!nextTask) return undefined;

  nextTask.status = 'in_progress';
  nextTask.startedAt = Date.now();
  workflow.status = 'executing';

  return { workflow, task: nextTask };
}

/**
 * Complete the current task and optionally start the next
 */
export function completeCurrentTask(
  workflowId: string,
  result?: string,
  startNext: boolean = true
): Workflow | undefined {
  const workflow = activeWorkflows.get(workflowId);
  if (!workflow) return undefined;

  const currentTask = workflow.tasks.find((t) => t.status === 'in_progress');
  if (currentTask) {
    currentTask.status = 'completed';
    currentTask.completedAt = Date.now();
    if (result) currentTask.result = result;
  }

  if (startNext) {
    const nextTask = workflow.tasks.find((t) => t.status === 'pending');
    if (nextTask) {
      nextTask.status = 'in_progress';
      nextTask.startedAt = Date.now();
    }
  }

  // Check if all done
  const allDone = workflow.tasks.every((t) => t.status === 'completed' || t.status === 'skipped');
  if (allDone) {
    workflow.status = 'completed';
    workflow.completedAt = Date.now();
  }

  return workflow;
}

// ============================================================================
// FORMATTING - Claude Code Style with Borders
// ============================================================================

/**
 * Box drawing characters for clean borders
 */
const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  leftT: '├',
  rightT: '┤',
};

/**
 * Create a horizontal line of specified width
 */
function horizontalLine(width: number, left: string, right: string): string {
  return left + BOX.horizontal.repeat(width) + right;
}

/**
 * Pad and center text within a width
 */
function centerText(text: string, width: number): string {
  const padding = width - text.length;
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
}

/**
 * Pad text to fill width (left-aligned)
 */
function padText(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + ' '.repeat(width - text.length);
}

/**
 * Get intelligent status text for in-progress task
 * Makes it feel alive and aware of what it's doing
 */
function getInProgressText(task: WorkflowTask): string {
  const content = task.content.toLowerCase();

  // Detect action and add intelligent suffix
  if (content.includes('research') || content.includes('search')) {
    return `${task.content}... searching`;
  }
  if (content.includes('analyze') || content.includes('analysis')) {
    return `${task.content}... analyzing`;
  }
  if (content.includes('create') || content.includes('generate') || content.includes('build')) {
    return `${task.content}... generating`;
  }
  if (content.includes('fetch') || content.includes('get') || content.includes('retrieve')) {
    return `${task.content}... fetching`;
  }
  if (content.includes('calculate') || content.includes('compute')) {
    return `${task.content}... computing`;
  }
  if (content.includes('compare') || content.includes('evaluate')) {
    return `${task.content}... evaluating`;
  }
  if (content.includes('extract') || content.includes('parse')) {
    return `${task.content}... extracting`;
  }
  if (content.includes('summarize') || content.includes('synthesize')) {
    return `${task.content}... synthesizing`;
  }

  return `${task.content}...`;
}

/**
 * Format workflow as bordered box
 *
 * Output example:
 * ┌─────────────────────────────────────────┐
 * │            Task Progress                │
 * ├─────────────────────────────────────────┤
 * │ [x] Research competitor pricing         │
 * │ [>] Analyzing market data... analyzing  │
 * │ [ ] Create pricing model                │
 * │ [ ] Generate recommendations            │
 * └─────────────────────────────────────────┘
 */
export function formatWorkflow(workflow: Workflow, options?: { showHeader?: boolean }): string {
  const showHeader = options?.showHeader ?? true;

  // Calculate width based on longest task
  let maxTaskLength = 0;
  for (const task of workflow.tasks) {
    const text = task.status === 'in_progress' ? getInProgressText(task) : task.content;
    const fullLine = `${STATUS_SYMBOLS[task.status]} ${text}`;
    maxTaskLength = Math.max(maxTaskLength, fullLine.length);
  }

  const headerText = 'Task Progress';
  const minWidth = Math.max(maxTaskLength + 2, headerText.length + 4);
  const boxWidth = Math.min(minWidth, 50); // Cap at 50 chars

  const lines: string[] = [];

  // Top border
  lines.push(horizontalLine(boxWidth, BOX.topLeft, BOX.topRight));

  // Header (optional)
  if (showHeader) {
    lines.push(BOX.vertical + centerText(headerText, boxWidth) + BOX.vertical);
    lines.push(horizontalLine(boxWidth, BOX.leftT, BOX.rightT));
  }

  // Tasks
  for (const task of workflow.tasks) {
    const symbol = STATUS_SYMBOLS[task.status];
    const text = task.status === 'in_progress' ? getInProgressText(task) : task.content;
    const taskLine = `${symbol} ${text}`;
    lines.push(BOX.vertical + ' ' + padText(taskLine, boxWidth - 2) + ' ' + BOX.vertical);
  }

  // Bottom border
  lines.push(horizontalLine(boxWidth, BOX.bottomLeft, BOX.bottomRight));

  return lines.join('\n');
}

/**
 * Format simple task list without borders (for inline updates)
 */
export function formatTaskList(workflow: Workflow): string {
  const lines: string[] = [];
  lines.push('Tasks:');

  for (const task of workflow.tasks) {
    const symbol = STATUS_SYMBOLS[task.status];
    const text = task.status === 'in_progress' ? getInProgressText(task) : task.content;
    lines.push(`${symbol} ${text}`);
  }

  return lines.join('\n');
}

/**
 * Format a single task update for streaming
 */
export function formatTaskUpdate(
  task: WorkflowTask,
  action: 'starting' | 'completed' | 'skipped'
): string {
  switch (action) {
    case 'starting':
      return `\n> Starting: ${task.content}\n`;
    case 'completed':
      return `> Done: ${task.content}\n`;
    case 'skipped':
      return `> Skipped: ${task.content}\n`;
  }
}

/**
 * Format workflow progress for streaming
 * This is what gets sent to the user during execution
 */
export function formatWorkflowProgress(workflow: Workflow): string {
  const completed = workflow.tasks.filter((t) => t.status === 'completed').length;
  const total = workflow.tasks.length;
  const current = workflow.tasks.find((t) => t.status === 'in_progress');

  let output = formatWorkflow(workflow);

  if (current) {
    output += `\n\nCurrently: ${getInProgressText(current)}`;
  } else if (workflow.status === 'completed') {
    output += `\n\nCompleted ${completed}/${total} tasks.`;
  }

  return output;
}

/**
 * Format a compact progress line
 * Example: "Progress: 2/5 tasks completed"
 */
export function formatProgressLine(workflow: Workflow): string {
  const completed = workflow.tasks.filter((t) => t.status === 'completed').length;
  const total = workflow.tasks.length;
  return `Progress: ${completed}/${total} tasks completed`;
}

/**
 * Format a minimal status update (for inline streaming)
 */
export function formatStatusUpdate(workflow: Workflow): string {
  const current = workflow.tasks.find((t) => t.status === 'in_progress');
  if (current) {
    return getInProgressText(current);
  }
  const completed = workflow.tasks.filter((t) => t.status === 'completed').length;
  const total = workflow.tasks.length;
  return `${completed}/${total} tasks done`;
}

// ============================================================================
// STREAMING HELPERS
// ============================================================================

/**
 * Create a workflow update chunk for streaming
 * Wraps the workflow state in a format that can be parsed by the client
 */
export function createWorkflowChunk(workflow: Workflow): string {
  // Use a simple delimiter format that's easy to parse
  // Client can look for these markers to extract workflow state
  return `\n---WORKFLOW---\n${formatWorkflow(workflow)}\n---END_WORKFLOW---\n`;
}

/**
 * Check if a string contains a workflow chunk
 */
export function containsWorkflowChunk(text: string): boolean {
  return text.includes('---WORKFLOW---');
}

/**
 * Extract workflow text from a chunk
 */
export function extractWorkflowFromChunk(text: string): string | null {
  const match = text.match(/---WORKFLOW---\n([\s\S]*?)\n---END_WORKFLOW---/);
  return match ? match[1] : null;
}

// ============================================================================
// CLEANUP
// ============================================================================

function cleanupOldWorkflows(): void {
  const now = Date.now();
  for (const [id, workflow] of activeWorkflows) {
    if (now - workflow.createdAt > WORKFLOW_TTL_MS) {
      activeWorkflows.delete(id);
      log.debug('Cleaned up old workflow', { id });
    }
  }
}

/**
 * Delete a specific workflow
 */
export function deleteWorkflow(workflowId: string): boolean {
  return activeWorkflows.delete(workflowId);
}

/**
 * Clear all workflows (for testing)
 */
export function clearAllWorkflows(): void {
  activeWorkflows.clear();
}
