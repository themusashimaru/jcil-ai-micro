/**
 * EXECUTION QUEUE - Rate Limiting & Cascading Requests
 *
 * Prevents API blitzing by managing concurrent requests and batching.
 * Critical for avoiding rate limits and managing costs.
 */

import type {
  QueuedTask,
  QueueProgress,
  StrategyLimits,
  CostTracker,
  StrategyStreamCallback,
} from './types';
import { DEFAULT_LIMITS } from './constants';
import { logger } from '@/lib/logger';

const log = logger('ExecutionQueue');

// =============================================================================
// QUEUE CONFIGURATION
// =============================================================================

interface QueueConfig {
  maxConcurrent: number;
  batchDelayMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 10,
  batchDelayMs: 500,
  retryAttempts: 3,
  retryDelayMs: 1000,
  timeoutMs: 60000,
};

// =============================================================================
// EXECUTION QUEUE CLASS
// =============================================================================

export class ExecutionQueue {
  private queue: QueuedTask[] = [];
  private activeCount = 0;
  private config: QueueConfig;
  private limits: StrategyLimits;
  private costTracker: CostTracker;
  private isPaused = false;
  private isKilled = false;
  private onStream?: StrategyStreamCallback;
  private startTime: number;

  // Metrics
  private completedCount = 0;
  private failedCount = 0;
  private totalBatches = 0;
  private currentBatch = 0;

  constructor(limits: StrategyLimits = DEFAULT_LIMITS, onStream?: StrategyStreamCallback) {
    this.config = {
      ...DEFAULT_CONFIG,
      maxConcurrent: limits.maxConcurrentCalls,
      batchDelayMs: limits.batchDelayMs,
    };
    this.limits = limits;
    this.costTracker = this.initCostTracker();
    this.onStream = onStream;
    this.startTime = Date.now();
  }

  private initCostTracker(): CostTracker {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      searchCost: 0,
      breakdown: {
        opus: { tokens: 0, cost: 0 },
        sonnet: { tokens: 0, cost: 0 },
        haiku: { tokens: 0, cost: 0 },
        brave: { queries: 0, cost: 0 },
      },
    };
  }

  // ===========================================================================
  // QUEUE OPERATIONS
  // ===========================================================================

  /**
   * Add a task to the queue
   */
  enqueue(task: Omit<QueuedTask, 'id' | 'status' | 'attempts' | 'createdAt'>): string {
    if (this.isKilled) {
      throw new Error('Queue has been killed');
    }

    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const queuedTask: QueuedTask = {
      ...task,
      id,
      status: 'queued',
      attempts: 0,
      maxAttempts: this.config.retryAttempts,
      createdAt: Date.now(),
    };

    // Insert by priority (higher priority first)
    const insertIndex = this.queue.findIndex((t) => t.priority < task.priority);
    if (insertIndex === -1) {
      this.queue.push(queuedTask);
    } else {
      this.queue.splice(insertIndex, 0, queuedTask);
    }

    log.debug('Task enqueued', {
      id,
      type: task.type,
      priority: task.priority,
      queueLength: this.queue.length,
    });

    return id;
  }

  /**
   * Add multiple tasks at once
   */
  enqueueBatch(
    tasks: Array<Omit<QueuedTask, 'id' | 'status' | 'attempts' | 'createdAt'>>
  ): string[] {
    return tasks.map((task) => this.enqueue(task));
  }

  /**
   * Get a task by ID
   */
  getTask(id: string): QueuedTask | undefined {
    return this.queue.find((t) => t.id === id);
  }

  /**
   * Cancel a specific task
   */
  cancelTask(id: string): boolean {
    const task = this.queue.find((t) => t.id === id);
    if (task && task.status === 'queued') {
      task.status = 'cancelled';
      return true;
    }
    return false;
  }

  // ===========================================================================
  // EXECUTION CONTROL
  // ===========================================================================

  /**
   * Process the queue with cascading execution
   */
  async *processQueue<T>(
    executor: (task: QueuedTask) => Promise<T>
  ): AsyncGenerator<{ task: QueuedTask; result?: T; error?: Error }> {
    this.totalBatches = Math.ceil(this.queue.length / this.config.maxConcurrent);
    this.currentBatch = 0;

    while (this.hasWork() && !this.isKilled) {
      // Check limits
      if (this.isOverBudget()) {
        log.warn('Budget limit reached, stopping queue');
        this.emitEvent('kill_switch', 'Budget limit exceeded', { killReason: 'budget_exceeded' });
        break;
      }

      if (this.isOverTime()) {
        log.warn('Time limit reached, stopping queue');
        this.emitEvent('kill_switch', 'Time limit exceeded', { killReason: 'time_exceeded' });
        break;
      }

      if (this.isPaused) {
        await this.sleep(100);
        continue;
      }

      // Get next batch
      const batch = this.getNextBatch();
      if (batch.length === 0) {
        await this.sleep(100);
        continue;
      }

      this.currentBatch++;
      log.debug('Processing batch', { batch: this.currentBatch, size: batch.length });

      // Execute batch concurrently
      const promises = batch.map(async (task) => {
        task.status = 'executing';
        task.startedAt = Date.now();
        this.activeCount++;

        try {
          // Execute with timeout
          const result = await this.withTimeout(executor(task), this.config.timeoutMs);

          task.status = 'completed';
          task.completedAt = Date.now();
          task.result = result;
          this.completedCount++;

          return { task, result };
        } catch (error) {
          task.attempts++;
          const err = error instanceof Error ? error : new Error(String(error));
          task.error = err.message;

          // Retry logic
          if (task.attempts < task.maxAttempts) {
            task.status = 'queued';
            log.warn('Task failed, will retry', {
              id: task.id,
              attempt: task.attempts,
              error: err.message,
            });
            await this.sleep(this.config.retryDelayMs * task.attempts);
          } else {
            task.status = 'failed';
            task.completedAt = Date.now();
            this.failedCount++;
            log.error('Task failed permanently', { id: task.id, error: err.message });
          }

          return { task, error: err };
        } finally {
          this.activeCount--;
        }
      });

      // Yield results as they complete
      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === 'fulfilled') {
          yield result.value;
        }
      }

      // Delay between batches (cascading)
      if (this.hasWork() && !this.isKilled) {
        await this.sleep(this.config.batchDelayMs);
      }
    }

    // Yield any remaining failed tasks
    for (const task of this.queue.filter((t) => t.status === 'failed')) {
      yield { task, error: new Error(task.error || 'Unknown error') };
    }
  }

  /**
   * Get next batch of tasks to execute
   */
  private getNextBatch(): QueuedTask[] {
    const available = this.config.maxConcurrent - this.activeCount;
    if (available <= 0) return [];

    const tasks: QueuedTask[] = [];
    for (const task of this.queue) {
      if (task.status === 'queued' && tasks.length < available) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  /**
   * Check if there's work remaining
   */
  private hasWork(): boolean {
    return this.queue.some((t) => t.status === 'queued' || t.status === 'executing');
  }

  // ===========================================================================
  // CONTROL METHODS
  // ===========================================================================

  /**
   * Pause queue processing
   */
  pause(): void {
    this.isPaused = true;
    log.info('Queue paused');
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.isPaused = false;
    log.info('Queue resumed');
  }

  /**
   * Kill the queue (stop all processing)
   */
  kill(reason: string): void {
    this.isKilled = true;
    log.warn('Queue killed', { reason });
    this.emitEvent('kill_switch', `Queue killed: ${reason}`, { killReason: 'manual_kill' });

    // Mark all queued tasks as cancelled
    for (const task of this.queue) {
      if (task.status === 'queued') {
        task.status = 'cancelled';
      }
    }
  }

  /**
   * Check if queue is killed
   */
  isQueueKilled(): boolean {
    return this.isKilled;
  }

  // ===========================================================================
  // COST & TIME TRACKING
  // ===========================================================================

  /**
   * Update cost tracker
   */
  updateCost(
    tier: 'opus' | 'sonnet' | 'haiku' | 'brave',
    inputTokens?: number,
    outputTokens?: number,
    queries?: number
  ): void {
    if (tier === 'brave' && queries) {
      this.costTracker.breakdown.brave.queries += queries;
      this.costTracker.breakdown.brave.cost = this.costTracker.breakdown.brave.queries * 0.005;
      this.costTracker.searchCost = this.costTracker.breakdown.brave.cost;
    } else if (inputTokens !== undefined && outputTokens !== undefined) {
      const pricing = {
        opus: { input: 15.0 / 1_000_000, output: 75.0 / 1_000_000 },
        sonnet: { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
        haiku: { input: 1.0 / 1_000_000, output: 5.0 / 1_000_000 },
      };

      if (tier !== 'brave') {
        const p = pricing[tier];
        const cost = inputTokens * p.input + outputTokens * p.output;

        this.costTracker.breakdown[tier].tokens += inputTokens + outputTokens;
        this.costTracker.breakdown[tier].cost += cost;
        this.costTracker.inputTokens += inputTokens;
        this.costTracker.outputTokens += outputTokens;
      }
    }

    // Update total cost
    this.costTracker.totalCost =
      this.costTracker.breakdown.opus.cost +
      this.costTracker.breakdown.sonnet.cost +
      this.costTracker.breakdown.haiku.cost +
      this.costTracker.breakdown.brave.cost;
  }

  /**
   * Get current cost
   */
  getCost(): CostTracker {
    return { ...this.costTracker };
  }

  /**
   * Check if over budget
   */
  isOverBudget(): boolean {
    return this.costTracker.totalCost >= this.limits.maxBudget * 0.95;
  }

  /**
   * Check if over time
   */
  isOverTime(): boolean {
    const elapsed = (Date.now() - this.startTime) / 1000 / 60;
    return elapsed >= this.limits.maxTimeMinutes * 0.95;
  }

  /**
   * Get elapsed time in seconds
   */
  getElapsedTime(): number {
    return (Date.now() - this.startTime) / 1000;
  }

  // ===========================================================================
  // PROGRESS & STATUS
  // ===========================================================================

  /**
   * Get queue progress
   */
  getProgress(): QueueProgress {
    const total = this.queue.length;
    const completed = this.completedCount;
    const failed = this.failedCount;
    const inProgress = this.activeCount;
    const queued = this.queue.filter((t) => t.status === 'queued').length;

    // Estimate time remaining
    const elapsedMs = Date.now() - this.startTime;
    const avgTimePerTask = completed > 0 ? elapsedMs / completed : 5000;
    const remaining = queued + inProgress;
    const estimatedTimeRemaining = (remaining * avgTimePerTask) / 1000;

    return {
      total,
      completed,
      failed,
      inProgress,
      queued,
      estimatedTimeRemaining,
      currentBatch: this.currentBatch,
      totalBatches: this.totalBatches,
    };
  }

  /**
   * Get error rate
   */
  getErrorRate(): number {
    const processed = this.completedCount + this.failedCount;
    if (processed === 0) return 0;
    return this.failedCount / processed;
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Task timeout')), ms);
    });
    return Promise.race([promise, timeout]);
  }

  private emitEvent(
    type: 'kill_switch' | 'error',
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (this.onStream) {
      this.onStream({
        type,
        message,
        timestamp: Date.now(),
        data: data as Parameters<StrategyStreamCallback>[0]['data'],
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createExecutionQueue(
  limits?: StrategyLimits,
  onStream?: StrategyStreamCallback
): ExecutionQueue {
  return new ExecutionQueue(limits, onStream);
}
