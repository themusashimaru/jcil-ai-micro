/**
 * QUEUE SYSTEM EXPORTS
 *
 * Unified exports for the queue system.
 * Supports:
 * - Simple Redis queue (fallback)
 * - BullMQ (requires worker host)
 * - QStash (serverless-native, recommended for Vercel)
 */

// Simple queue (fallback implementation)
export {
  acquireSlot,
  releaseSlot,
  getQueueStatus,
  generateRequestId,
  cleanupStaleRequests,
  withQueue,
  QueueFullError,
} from '../queue';

// BullMQ queue (requires persistent worker)
export {
  // Queue management
  getChatQueue,
  getCodeLabQueue,
  getChatQueueEvents,
  isBullMQAvailable,
  closeAllQueues,
  pauseAllQueues,
  resumeAllQueues,
  cleanAllQueues,

  // Job operations
  addChatJob,
  getChatJob,
  getChatQueueStats,
  getPriorityFromPlan,

  // Types
  type ChatJobData,
  type ChatJobResult,
  type CodeLabJobData,
  type CodeLabJobResult,
} from './bull-queue';

// Workers (for BullMQ - requires separate host)
export {
  createChatWorker,
  createCodeLabWorker,
  startAllWorkers,
  shutdownAllWorkers,
  getWorkerStats,
} from './workers';

// QStash queue (serverless-native - recommended for Vercel)
export {
  getQStashClient,
  isQStashAvailable,
  publishChatJob,
  publishCodeLabJob,
  scheduleJob,
  getPriorityDelay,
  verifyWebhookSignature,

  // Types
  type ChatJobPayload,
  type CodeLabJobPayload,
  type JobPayload,
} from './qstash';
