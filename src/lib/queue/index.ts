/**
 * QUEUE SYSTEM EXPORTS
 *
 * Unified exports for the queue system.
 * Supports both the simple Redis queue (current) and
 * BullMQ (enterprise scaling).
 */

// Simple queue (current implementation)
export {
  acquireSlot,
  releaseSlot,
  getQueueStatus,
  generateRequestId,
  cleanupStaleRequests,
  withQueue,
  QueueFullError,
} from '../queue';

// BullMQ queue (enterprise scaling)
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

// Workers
export {
  createChatWorker,
  createCodeLabWorker,
  startAllWorkers,
  shutdownAllWorkers,
  getWorkerStats,
} from './workers';
