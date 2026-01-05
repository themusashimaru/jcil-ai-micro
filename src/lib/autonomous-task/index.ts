/**
 * AUTONOMOUS TASK SYSTEM
 *
 * Enables AI to work autonomously on complex multi-step tasks.
 * Tasks are planned, executed in background, and results stored.
 *
 * Features:
 * - AI-powered task planning
 * - Step-by-step execution with progress tracking
 * - Multi-agent collaboration for complex tasks
 * - Background execution with status updates
 * - Task cancellation and error handling
 */

export * from './types';
export {
  createTask,
  executeTask,
  cancelTask,
  getTaskStatus,
  getUserTasks,
  planTask,
} from './executor';
