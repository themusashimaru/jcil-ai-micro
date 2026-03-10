/**
 * BULLMQ QUEUE SYSTEM
 *
 * Enterprise-grade job queue for 100K+ concurrent users.
 * Provides reliable async processing with:
 * - Priority queuing (premium users first)
 * - Automatic retries with exponential backoff
 * - Job persistence across failures
 * - Real-time progress tracking
 * - Dashboard support (Bull Board)
 *
 * ARCHITECTURE:
 * ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
 * │   Request   │────▶│  Bull Queue │────▶│   Workers   │
 * │   Handler   │     │  (Redis)    │     │  (Process)  │
 * └─────────────┘     └─────────────┘     └─────────────┘
 */

import { Queue, QueueEvents, Job, JobsOptions, ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '@/lib/logger';

const log = logger('BullQueue');

// Redis connection for BullMQ
// Note: BullMQ requires standard Redis connection, not REST API
let redisConnection: IORedis | null = null;

/**
 * Get or create Redis connection for BullMQ
 */
export function getRedisConnection(): IORedis | null {
  if (redisConnection) {
    return redisConnection;
  }

  const host = process.env.REDIS_HOST;
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD;
  const tls = process.env.REDIS_TLS === 'true';

  if (!host) {
    log.warn('REDIS_HOST not configured - BullMQ disabled');
    return null;
  }

  try {
    redisConnection = new IORedis({
      host,
      port,
      password,
      tls: tls ? {} : undefined,
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      retryStrategy: (times) => {
        if (times > 10) {
          log.error('Redis connection failed after 10 retries');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000); // Exponential backoff, max 3s
      },
    });

    redisConnection.on('connect', () => {
      log.info('BullMQ Redis connected');
    });

    redisConnection.on('error', (error) => {
      log.error('BullMQ Redis error', error);
    });

    return redisConnection;
  } catch (error) {
    log.error('Failed to create Redis connection', error as Error);
    return null;
  }
}

// ============================================
// CHAT QUEUE
// ============================================

export interface ChatJobData {
  conversationId: string;
  userId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  model?: string;
  systemPrompt?: string;
  planKey?: string;
  webSearchEnabled?: boolean;
  priority?: number;
}

export interface ChatJobResult {
  text: string;
  model: string;
  citations?: Array<{ title: string; url: string }>;
  tokensUsed?: number;
}

let chatQueue: Queue<ChatJobData, ChatJobResult> | null = null;
let chatQueueEvents: QueueEvents | null = null;

/**
 * Get or create the chat queue
 */
export function getChatQueue(): Queue<ChatJobData, ChatJobResult> | null {
  if (chatQueue) {
    return chatQueue;
  }

  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }

  chatQueue = new Queue<ChatJobData, ChatJobResult>('chat-requests', {
    connection: connection as ConnectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    },
  });

  log.info('Chat queue initialized');
  return chatQueue;
}

/**
 * Get chat queue events for real-time updates
 */
export function getChatQueueEvents(): QueueEvents | null {
  if (chatQueueEvents) {
    return chatQueueEvents;
  }

  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }

  chatQueueEvents = new QueueEvents('chat-requests', {
    connection: connection as ConnectionOptions,
  });
  return chatQueueEvents;
}

/**
 * Add a chat job to the queue
 */
export async function addChatJob(
  data: ChatJobData,
  options?: Partial<JobsOptions>
): Promise<Job<ChatJobData, ChatJobResult> | null> {
  const queue = getChatQueue();
  if (!queue) {
    log.warn('Chat queue not available');
    return null;
  }

  const priority = data.priority ?? getPriorityFromPlan(data.planKey);

  const job = await queue.add('process-chat', data, {
    priority,
    ...options,
  });

  log.debug('Chat job added', {
    jobId: job.id,
    conversationId: data.conversationId,
    priority,
  });

  return job;
}

/**
 * Get job by ID
 */
export async function getChatJob(jobId: string): Promise<Job<ChatJobData, ChatJobResult> | null> {
  const queue = getChatQueue();
  if (!queue) {
    return null;
  }

  const job = await queue.getJob(jobId);
  return job || null;
}

/**
 * Get queue statistics
 */
export async function getChatQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
} | null> {
  const queue = getChatQueue();
  if (!queue) {
    return null;
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

// ============================================
// CODE LAB QUEUE
// ============================================

export interface CodeLabJobData {
  sessionId: string;
  userId: string;
  prompt: string;
  context?: string;
  sandboxId?: string;
  planKey?: string;
}

export interface CodeLabJobResult {
  response: string;
  filesChanged?: string[];
  commandsRun?: string[];
}

let codeLabQueue: Queue<CodeLabJobData, CodeLabJobResult> | null = null;

/**
 * Get or create the code lab queue
 */
export function getCodeLabQueue(): Queue<CodeLabJobData, CodeLabJobResult> | null {
  if (codeLabQueue) {
    return codeLabQueue;
  }

  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }

  codeLabQueue = new Queue<CodeLabJobData, CodeLabJobResult>('codelab-requests', {
    connection: connection as ConnectionOptions,
    defaultJobOptions: {
      attempts: 2, // Fewer retries for code operations
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 7200, // Keep for 2 hours
        count: 500,
      },
      removeOnFail: {
        age: 86400,
      },
    },
  });

  log.info('Code lab queue initialized');
  return codeLabQueue;
}

// ============================================
// PRIORITY SYSTEM
// ============================================

/**
 * Get job priority based on subscription plan
 * Lower number = higher priority
 */
export function getPriorityFromPlan(planKey?: string): number {
  switch (planKey) {
    case 'executive':
      return 1; // Highest priority
    case 'pro':
      return 2;
    case 'plus':
      return 3;
    case 'free':
      return 5;
    default:
      return 4; // Unknown plans get medium priority
  }
}

// ============================================
// QUEUE MANAGEMENT
// ============================================

/**
 * Pause all queues (for maintenance)
 */
export async function pauseAllQueues(): Promise<void> {
  const queues = [getChatQueue(), getCodeLabQueue()].filter(Boolean);
  await Promise.all(queues.map((q) => q?.pause()));
  log.info('All queues paused');
}

/**
 * Resume all queues
 */
export async function resumeAllQueues(): Promise<void> {
  const queues = [getChatQueue(), getCodeLabQueue()].filter(Boolean);
  await Promise.all(queues.map((q) => q?.resume()));
  log.info('All queues resumed');
}

/**
 * Clean old jobs from all queues
 */
export async function cleanAllQueues(): Promise<void> {
  const queues = [getChatQueue(), getCodeLabQueue()].filter(Boolean);

  for (const queue of queues) {
    if (queue) {
      await queue.clean(3600000, 1000, 'completed'); // 1 hour old completed jobs
      await queue.clean(86400000, 500, 'failed'); // 24 hour old failed jobs
    }
  }

  log.info('All queues cleaned');
}

/**
 * Check if BullMQ is available
 */
export function isBullMQAvailable(): boolean {
  return getRedisConnection() !== null;
}

/**
 * Close all connections (for graceful shutdown)
 */
export async function closeAllQueues(): Promise<void> {
  const queues = [chatQueue, codeLabQueue].filter(Boolean);

  for (const queue of queues) {
    if (queue) {
      await queue.close();
    }
  }

  if (chatQueueEvents) {
    await chatQueueEvents.close();
  }

  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }

  chatQueue = null;
  codeLabQueue = null;
  chatQueueEvents = null;

  log.info('All queues closed');
}
