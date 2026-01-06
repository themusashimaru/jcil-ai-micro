/**
 * CODE LAB BACKGROUND TASK MANAGEMENT
 *
 * Provides Claude Code-like background task capabilities:
 * - Run commands in the background
 * - Monitor running tasks
 * - Kill tasks
 * - Get task output
 */

export interface BackgroundTask {
  id: string;
  command: string;
  status: 'running' | 'completed' | 'failed' | 'killed';
  startedAt: string;
  completedAt?: string;
  exitCode?: number;
  output: string[];
  error?: string;
  pid?: number;
}

export interface TaskOutput {
  taskId: string;
  newOutput: string;
  isComplete: boolean;
  exitCode?: number;
}

/**
 * Background Task Manager
 */
export class BackgroundTaskManager {
  private tasks: Map<string, BackgroundTask> = new Map();
  private taskIdCounter = 0;

  /**
   * Generate a unique task ID
   */
  private generateTaskId(): string {
    this.taskIdCounter++;
    return `bg-${Date.now()}-${this.taskIdCounter}`;
  }

  /**
   * Start a background task
   */
  async startTask(
    command: string,
    executor: (cmd: string) => Promise<{ taskId: string; initialOutput?: string }>
  ): Promise<BackgroundTask> {
    const taskId = this.generateTaskId();

    const task: BackgroundTask = {
      id: taskId,
      command,
      status: 'running',
      startedAt: new Date().toISOString(),
      output: [],
    };

    this.tasks.set(taskId, task);

    try {
      // Execute the command - the executor should handle running it in the background
      const result = await executor(command);

      if (result.initialOutput) {
        task.output.push(result.initialOutput);
      }

      // Update the task ID if the executor provides one
      if (result.taskId) {
        task.pid = parseInt(result.taskId, 10) || undefined;
      }

      return task;
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Failed to start task';
      task.completedAt = new Date().toISOString();
      return task;
    }
  }

  /**
   * Get output from a running task
   */
  async getTaskOutput(
    taskId: string,
    outputFetcher?: (taskId: string) => Promise<{ output: string; isComplete: boolean; exitCode?: number }>
  ): Promise<TaskOutput | null> {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    if (outputFetcher) {
      try {
        const result = await outputFetcher(taskId);

        if (result.output) {
          task.output.push(result.output);
        }

        if (result.isComplete) {
          task.status = result.exitCode === 0 ? 'completed' : 'failed';
          task.exitCode = result.exitCode;
          task.completedAt = new Date().toISOString();
        }

        return {
          taskId,
          newOutput: result.output,
          isComplete: result.isComplete,
          exitCode: result.exitCode,
        };
      } catch (error) {
        return {
          taskId,
          newOutput: `Error fetching output: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isComplete: false,
        };
      }
    }

    // Return cached output if no fetcher provided
    return {
      taskId,
      newOutput: task.output.join('\n'),
      isComplete: task.status !== 'running',
      exitCode: task.exitCode,
    };
  }

  /**
   * Kill a running task
   */
  async killTask(
    taskId: string,
    killer?: (taskId: string) => Promise<boolean>
  ): Promise<{ success: boolean; message: string }> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, message: `Task ${taskId} not found` };
    }

    if (task.status !== 'running') {
      return { success: false, message: `Task ${taskId} is not running (status: ${task.status})` };
    }

    try {
      if (killer) {
        const killed = await killer(taskId);
        if (killed) {
          task.status = 'killed';
          task.completedAt = new Date().toISOString();
          return { success: true, message: `Task ${taskId} killed` };
        }
        return { success: false, message: `Failed to kill task ${taskId}` };
      }

      // Mark as killed without actually killing (for simulation)
      task.status = 'killed';
      task.completedAt = new Date().toISOString();
      return { success: true, message: `Task ${taskId} marked as killed` };
    } catch (error) {
      return {
        success: false,
        message: `Error killing task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * List all tasks
   */
  listTasks(filter?: 'running' | 'completed' | 'all'): BackgroundTask[] {
    const tasks = Array.from(this.tasks.values());

    if (filter === 'running') {
      return tasks.filter(t => t.status === 'running');
    }
    if (filter === 'completed') {
      return tasks.filter(t => t.status !== 'running');
    }

    return tasks;
  }

  /**
   * Get a specific task
   */
  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Clear completed tasks
   */
  clearCompleted(): number {
    let cleared = 0;
    for (const [id, task] of this.tasks) {
      if (task.status !== 'running') {
        this.tasks.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Get summary of all tasks
   */
  getSummary(): {
    total: number;
    running: number;
    completed: number;
    failed: number;
    killed: number;
  } {
    const tasks = Array.from(this.tasks.values());
    return {
      total: tasks.length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      killed: tasks.filter(t => t.status === 'killed').length,
    };
  }
}

// Singleton instance
let taskManager: BackgroundTaskManager | null = null;

export function getBackgroundTaskManager(): BackgroundTaskManager {
  if (!taskManager) {
    taskManager = new BackgroundTaskManager();
  }
  return taskManager;
}

/**
 * Background task tools for the workspace agent
 */
export function getBackgroundTaskTools() {
  return [
    {
      name: 'bg_run',
      description: 'Run a command in the background. Use for long-running operations like servers, builds, or watch processes. Returns a task ID for monitoring.',
      input_schema: {
        type: 'object' as const,
        properties: {
          command: {
            type: 'string',
            description: 'The command to run in the background',
          },
        },
        required: ['command'],
      },
    },
    {
      name: 'bg_output',
      description: 'Get the output from a background task.',
      input_schema: {
        type: 'object' as const,
        properties: {
          task_id: {
            type: 'string',
            description: 'The ID of the background task',
          },
        },
        required: ['task_id'],
      },
    },
    {
      name: 'bg_kill',
      description: 'Kill a running background task.',
      input_schema: {
        type: 'object' as const,
        properties: {
          task_id: {
            type: 'string',
            description: 'The ID of the background task to kill',
          },
        },
        required: ['task_id'],
      },
    },
    {
      name: 'bg_list',
      description: 'List all background tasks.',
      input_schema: {
        type: 'object' as const,
        properties: {
          filter: {
            type: 'string',
            enum: ['running', 'completed', 'all'],
            description: 'Filter tasks by status (default: all)',
          },
        },
        required: [],
      },
    },
  ];
}
