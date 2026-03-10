/**
 * BULLMQ WORKERS
 *
 * Background workers that process queued jobs.
 * Designed for high throughput at 100K+ concurrent users.
 *
 * FEATURES:
 * - Concurrent job processing
 * - Rate limiting per worker
 * - Progress reporting
 * - Graceful shutdown
 */

import { Worker, Job, ConnectionOptions } from 'bullmq';
import {
  getRedisConnection,
  ChatJobData,
  ChatJobResult,
  CodeLabJobData,
  CodeLabJobResult,
} from './bull-queue';
import {
  createAnthropicCompletion,
  createAnthropicCompletionWithSearch,
} from '@/lib/anthropic/client';
import { createServerClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

const log = logger('QueueWorkers');

// Track active workers for graceful shutdown
const activeWorkers: Worker[] = [];

// ============================================
// CHAT WORKER
// ============================================

/**
 * Create a chat request worker
 */
export function createChatWorker(): Worker<ChatJobData, ChatJobResult> | null {
  const connection = getRedisConnection();
  if (!connection) {
    log.warn('Cannot create chat worker - Redis not available');
    return null;
  }

  const worker = new Worker<ChatJobData, ChatJobResult>(
    'chat-requests',
    async (job: Job<ChatJobData, ChatJobResult>) => {
      const { conversationId, userId, messages, model, systemPrompt, webSearchEnabled } = job.data;

      log.info('Processing chat job', {
        jobId: job.id,
        conversationId,
        messageCount: messages.length,
      });

      try {
        // Report progress
        await job.updateProgress(10);

        // Convert messages to CoreMessage format
        const coreMessages = messages.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        }));

        await job.updateProgress(20);

        // Process with or without web search
        let result;
        if (webSearchEnabled) {
          // Import Perplexity search function dynamically to avoid circular deps
          const { searchWeb } = await import('@/lib/perplexity/client');
          result = await createAnthropicCompletionWithSearch({
            messages: coreMessages,
            model,
            systemPrompt,
            webSearchFn: async (query: string) => {
              const searchResult = await searchWeb(query);
              return {
                query,
                results: searchResult.sources.map(
                  (s: { title: string; url: string; snippet?: string }) => ({
                    title: s.title,
                    url: s.url,
                    description: s.snippet || '',
                    content: s.snippet,
                  })
                ),
              };
            },
          });
        } else {
          result = await createAnthropicCompletion({
            messages: coreMessages,
            model,
            systemPrompt,
          });
        }

        await job.updateProgress(80);

        // Save response to database
        const supabase = createServerClient();
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant' as const,
          content: result.text,
          model: result.model,
        } as never);

        await job.updateProgress(100);

        log.info('Chat job completed', {
          jobId: job.id,
          conversationId,
          textLength: result.text.length,
        });

        return {
          text: result.text,
          model: result.model,
          citations: result.citations,
        };
      } catch (error) {
        log.error('Chat job failed', error as Error, {
          jobId: job.id,
          conversationId,
        });
        throw error;
      }
    },
    {
      connection: connection as ConnectionOptions,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10', 10),
      limiter: {
        max: parseInt(process.env.WORKER_RATE_LIMIT || '100', 10),
        duration: 60000, // per minute
      },
      lockDuration: 300000, // 5 minute lock
      stalledInterval: 60000, // Check for stalled jobs every minute
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    log.debug('Job completed', { jobId: job.id });
  });

  worker.on('failed', (job, error) => {
    log.error('Job failed', error, { jobId: job?.id });
  });

  worker.on('stalled', (jobId) => {
    log.warn('Job stalled', { jobId });
  });

  worker.on('error', (error) => {
    log.error('Worker error', error);
  });

  activeWorkers.push(worker);
  log.info('Chat worker started', {
    concurrency: worker.opts.concurrency,
  });

  return worker;
}

// ============================================
// CODE LAB WORKER
// ============================================

/**
 * Create a code lab request worker
 */
export function createCodeLabWorker(): Worker<CodeLabJobData, CodeLabJobResult> | null {
  const connection = getRedisConnection();
  if (!connection) {
    log.warn('Cannot create code lab worker - Redis not available');
    return null;
  }

  const worker = new Worker<CodeLabJobData, CodeLabJobResult>(
    'codelab-requests',
    async (job: Job<CodeLabJobData, CodeLabJobResult>) => {
      const { sessionId } = job.data;

      log.info('Processing code lab job', {
        jobId: job.id,
        sessionId,
      });

      try {
        await job.updateProgress(10);

        // Code lab processing would go here
        // This is a placeholder - actual implementation would involve
        // the workspace system and sandbox execution

        await job.updateProgress(100);

        return {
          response: 'Code lab job processed',
          filesChanged: [],
          commandsRun: [],
        };
      } catch (error) {
        log.error('Code lab job failed', error as Error, {
          jobId: job.id,
          sessionId,
        });
        throw error;
      }
    },
    {
      connection: connection as ConnectionOptions,
      concurrency: parseInt(process.env.CODELAB_WORKER_CONCURRENCY || '5', 10),
      lockDuration: 600000, // 10 minute lock (code operations take longer)
    }
  );

  activeWorkers.push(worker);
  log.info('Code lab worker started');

  return worker;
}

// ============================================
// WORKER MANAGEMENT
// ============================================

/**
 * Start all workers
 */
export function startAllWorkers(): void {
  createChatWorker();
  createCodeLabWorker();
  log.info('All workers started');
}

/**
 * Gracefully shutdown all workers
 */
export async function shutdownAllWorkers(): Promise<void> {
  log.info('Shutting down workers...', { count: activeWorkers.length });

  await Promise.all(
    activeWorkers.map(async (worker) => {
      await worker.close();
    })
  );

  activeWorkers.length = 0;
  log.info('All workers shut down');
}

/**
 * Get worker statistics
 */
export function getWorkerStats(): {
  activeWorkers: number;
  workers: Array<{ name: string; running: boolean; concurrency: number }>;
} {
  return {
    activeWorkers: activeWorkers.length,
    workers: activeWorkers.map((w) => ({
      name: w.name,
      running: w.isRunning(),
      concurrency: w.opts.concurrency || 1,
    })),
  };
}
