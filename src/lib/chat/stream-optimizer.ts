/**
 * STREAM OPTIMIZER
 *
 * Optimizes response streaming by:
 * - Batching small chunks to reduce TCP overhead
 * - Adding keepalive heartbeats to prevent timeouts
 * - Providing consistent encoding/decoding
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Minimum characters to accumulate before flushing */
const CHUNK_FLUSH_THRESHOLD = 50;

/** Maximum time to wait before flushing (ms) */
const CHUNK_FLUSH_TIMEOUT_MS = 100;

/** Interval for keepalive heartbeats (ms) */
const KEEPALIVE_INTERVAL_MS = 15000;

/** Timeout for no activity before considering connection dead (ms) */
const ACTIVITY_TIMEOUT_MS = 60000;

// ============================================================================
// TYPES
// ============================================================================

export interface StreamOptimizerOptions {
  /** Minimum characters before flush (default: 50) */
  flushThreshold?: number;
  /** Max time before flush in ms (default: 100) */
  flushTimeout?: number;
  /** Enable keepalive heartbeats (default: true) */
  enableKeepalive?: boolean;
  /** Keepalive interval in ms (default: 15000) */
  keepaliveInterval?: number;
  /** Callback when keepalive is sent */
  onKeepalive?: () => void;
  /** Callback when activity timeout occurs */
  onActivityTimeout?: () => void;
}

export interface StreamController {
  /** Write a chunk to the stream */
  write: (text: string) => void;
  /** Flush any buffered content immediately */
  flush: () => void;
  /** Close the stream */
  close: () => void;
  /** Signal an error */
  error: (err: Error) => void;
  /** Mark activity (resets timeout) */
  markActivity: () => void;
}

// ============================================================================
// OPTIMIZED STREAM CREATOR
// ============================================================================

/**
 * Create an optimized ReadableStream with batching and keepalive
 */
export function createOptimizedStream(
  generator: (controller: StreamController) => Promise<void>,
  options: StreamOptimizerOptions = {}
): ReadableStream<Uint8Array> {
  const {
    flushThreshold = CHUNK_FLUSH_THRESHOLD,
    flushTimeout = CHUNK_FLUSH_TIMEOUT_MS,
    enableKeepalive = true,
    keepaliveInterval = KEEPALIVE_INTERVAL_MS,
    onKeepalive,
    onActivityTimeout,
  } = options;

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = '';
      let flushTimer: NodeJS.Timeout | null = null;
      let keepaliveTimer: NodeJS.Timeout | null = null;
      let activityTimer: NodeJS.Timeout | null = null;
      let lastActivity = Date.now();
      let isClosed = false;

      // Flush buffer to stream
      const flushBuffer = () => {
        if (buffer && !isClosed) {
          try {
            controller.enqueue(encoder.encode(buffer));
          } catch {
            // Controller might be closed
          }
          buffer = '';
        }
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
      };

      // Schedule a flush after timeout
      const scheduleFlush = () => {
        if (!flushTimer && !isClosed) {
          flushTimer = setTimeout(flushBuffer, flushTimeout);
        }
      };

      // Keepalive heartbeat
      const startKeepalive = () => {
        if (!enableKeepalive || isClosed) return;

        keepaliveTimer = setInterval(() => {
          const timeSinceActivity = Date.now() - lastActivity;
          if (timeSinceActivity > keepaliveInterval - 1000) {
            try {
              // Send invisible space as heartbeat
              controller.enqueue(encoder.encode(' '));
              onKeepalive?.();
            } catch {
              // Controller might be closed
            }
          }
        }, keepaliveInterval);
      };

      // Activity timeout check
      const startActivityTimeout = () => {
        activityTimer = setInterval(() => {
          if (Date.now() - lastActivity > ACTIVITY_TIMEOUT_MS) {
            onActivityTimeout?.();
            cleanup();
          }
        }, 10000); // Check every 10 seconds
      };

      // Cleanup timers
      const cleanup = () => {
        isClosed = true;
        flushBuffer(); // Flush remaining content

        if (flushTimer) clearTimeout(flushTimer);
        if (keepaliveTimer) clearInterval(keepaliveTimer);
        if (activityTimer) clearInterval(activityTimer);

        flushTimer = null;
        keepaliveTimer = null;
        activityTimer = null;
      };

      // Stream controller interface for the generator
      const streamController: StreamController = {
        write: (text: string) => {
          if (isClosed) return;
          lastActivity = Date.now();

          buffer += text;

          // Flush if buffer exceeds threshold
          if (buffer.length >= flushThreshold) {
            flushBuffer();
          } else {
            scheduleFlush();
          }
        },

        flush: () => {
          flushBuffer();
        },

        close: () => {
          cleanup();
          try {
            controller.close();
          } catch {
            // Already closed
          }
        },

        error: (err: Error) => {
          cleanup();
          try {
            controller.error(err);
          } catch {
            // Already closed
          }
        },

        markActivity: () => {
          lastActivity = Date.now();
        },
      };

      // Start timers
      startKeepalive();
      startActivityTimeout();

      // Run the generator
      try {
        await generator(streamController);
        streamController.close();
      } catch (err) {
        streamController.error(err instanceof Error ? err : new Error(String(err)));
      }
    },
  });
}

// ============================================================================
// STREAM TRANSFORMER
// ============================================================================

/**
 * Create a TransformStream that optimizes an existing stream
 * Useful for wrapping streams from external APIs
 */
export function createStreamOptimizer(
  options: StreamOptimizerOptions = {}
): TransformStream<Uint8Array, Uint8Array> {
  const { flushThreshold = CHUNK_FLUSH_THRESHOLD, flushTimeout = CHUNK_FLUSH_TIMEOUT_MS } = options;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = '';
  let flushTimer: NodeJS.Timeout | null = null;

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      buffer += text;

      // Flush if buffer exceeds threshold
      if (buffer.length >= flushThreshold) {
        controller.enqueue(encoder.encode(buffer));
        buffer = '';
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
      } else if (!flushTimer) {
        // Schedule flush after timeout
        flushTimer = setTimeout(() => {
          if (buffer) {
            controller.enqueue(encoder.encode(buffer));
            buffer = '';
          }
          flushTimer = null;
        }, flushTimeout);
      }
    },

    flush(controller) {
      // Flush any remaining content
      if (flushTimer) clearTimeout(flushTimer);
      if (buffer) {
        controller.enqueue(encoder.encode(buffer));
        buffer = '';
      }
    },
  });
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Simple stream from async generator with optimization
 */
export async function* optimizedChunks(
  source: AsyncIterable<string>,
  threshold: number = CHUNK_FLUSH_THRESHOLD
): AsyncGenerator<string> {
  let buffer = '';

  for await (const chunk of source) {
    buffer += chunk;

    if (buffer.length >= threshold) {
      yield buffer;
      buffer = '';
    }
  }

  // Yield remaining content
  if (buffer) {
    yield buffer;
  }
}
