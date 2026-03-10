/**
 * UPSTASH QSTASH QUEUE SYSTEM
 *
 * Serverless-native job queue for 100K+ concurrent users on Vercel.
 * Unlike BullMQ, QStash works with serverless functions because it uses
 * HTTP callbacks instead of persistent connections.
 *
 * ARCHITECTURE:
 * ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
 * │   Request   │────▶│   QStash    │────▶│  Webhook    │
 * │   Handler   │     │  (Upstash)  │     │  Endpoint   │
 * └─────────────┘     └─────────────┘     └─────────────┘
 *
 * FEATURES:
 * - Automatic retries with exponential backoff
 * - Deduplication to prevent duplicate processing
 * - Delayed/scheduled messages
 * - Dead letter queue for failed jobs
 * - Works perfectly with Vercel serverless
 */

import { Client } from '@upstash/qstash';
import { logger } from '@/lib/logger';

const log = logger('QStash');

// Singleton QStash client
let qstashClient: Client | null = null;

/**
 * Get or create QStash client
 */
export function getQStashClient(): Client | null {
  if (qstashClient) {
    return qstashClient;
  }

  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    log.warn('QSTASH_TOKEN not configured - QStash disabled');
    return null;
  }

  qstashClient = new Client({ token });
  log.info('QStash client initialized');
  return qstashClient;
}

/**
 * Check if QStash is available
 */
export function isQStashAvailable(): boolean {
  return !!process.env.QSTASH_TOKEN;
}

// ============================================
// JOB TYPES
// ============================================

export interface ChatJobPayload {
  type: 'chat';
  conversationId: string;
  userId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  model?: string;
  systemPrompt?: string;
  webSearchEnabled?: boolean;
  priority?: number;
}

export interface CodeLabJobPayload {
  type: 'codelab';
  sessionId: string;
  userId: string;
  prompt: string;
  context?: string;
}

export type JobPayload = ChatJobPayload | CodeLabJobPayload;

// ============================================
// QUEUE OPERATIONS
// ============================================

/**
 * Get the webhook URL for job processing
 */
function getWebhookUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL or VERCEL_URL must be set');
  }

  // Ensure https
  const url = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
  return `${url}/api/queue/webhook`;
}

/**
 * Publish a chat job to the queue
 */
export async function publishChatJob(
  payload: Omit<ChatJobPayload, 'type'>,
  options?: {
    delay?: number; // Delay in seconds
    deduplicationId?: string;
    retries?: number;
  }
): Promise<{ messageId: string } | null> {
  const client = getQStashClient();
  if (!client) {
    log.warn('QStash not available - falling back to sync processing');
    return null;
  }

  try {
    const jobPayload: ChatJobPayload = {
      type: 'chat',
      ...payload,
    };

    const result = await client.publishJSON({
      url: getWebhookUrl(),
      body: jobPayload,
      delay: options?.delay,
      deduplicationId: options?.deduplicationId,
      retries: options?.retries ?? 3,
      // Content-based deduplication for 1 hour
      contentBasedDeduplication: true,
    });

    log.info('Chat job published to QStash', {
      messageId: result.messageId,
      conversationId: payload.conversationId,
    });

    return { messageId: result.messageId };
  } catch (error) {
    log.error('Failed to publish chat job', error as Error);
    return null;
  }
}

/**
 * Publish a code lab job to the queue
 */
export async function publishCodeLabJob(
  payload: Omit<CodeLabJobPayload, 'type'>,
  options?: {
    delay?: number;
    deduplicationId?: string;
    retries?: number;
  }
): Promise<{ messageId: string } | null> {
  const client = getQStashClient();
  if (!client) {
    log.warn('QStash not available - falling back to sync processing');
    return null;
  }

  try {
    const jobPayload: CodeLabJobPayload = {
      type: 'codelab',
      ...payload,
    };

    const result = await client.publishJSON({
      url: getWebhookUrl(),
      body: jobPayload,
      delay: options?.delay,
      deduplicationId: options?.deduplicationId,
      retries: options?.retries ?? 2, // Fewer retries for code operations
    });

    log.info('Code lab job published to QStash', {
      messageId: result.messageId,
      sessionId: payload.sessionId,
    });

    return { messageId: result.messageId };
  } catch (error) {
    log.error('Failed to publish code lab job', error as Error);
    return null;
  }
}

/**
 * Schedule a job for later execution
 */
export async function scheduleJob(
  payload: JobPayload,
  executeAt: Date
): Promise<{ messageId: string } | null> {
  const client = getQStashClient();
  if (!client) {
    return null;
  }

  try {
    const delay = Math.max(0, Math.floor((executeAt.getTime() - Date.now()) / 1000));

    const result = await client.publishJSON({
      url: getWebhookUrl(),
      body: payload,
      delay,
    });

    log.info('Job scheduled', {
      messageId: result.messageId,
      executeAt: executeAt.toISOString(),
    });

    return { messageId: result.messageId };
  } catch (error) {
    log.error('Failed to schedule job', error as Error);
    return null;
  }
}

// ============================================
// PRIORITY SYSTEM
// ============================================

/**
 * Get priority delay based on subscription tier
 * Higher tier = processed sooner (lower delay)
 */
export function getPriorityDelay(planKey?: string): number {
  switch (planKey) {
    case 'executive':
      return 0; // Immediate
    case 'pro':
      return 1; // 1 second
    case 'plus':
      return 3; // 3 seconds
    case 'free':
      return 10; // 10 seconds
    default:
      return 5; // Unknown = 5 seconds
  }
}

// ============================================
// WEBHOOK VERIFICATION
// ============================================

/**
 * Verify QStash webhook signature
 */
export async function verifyWebhookSignature(signature: string, body: string): Promise<boolean> {
  const client = getQStashClient();
  if (!client) {
    return false;
  }

  try {
    // QStash signature verification
    const signingKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

    if (!signingKey) {
      log.warn('QSTASH_CURRENT_SIGNING_KEY not set - skipping verification');
      return true; // Allow in development
    }

    // Import the Receiver for verification
    const { Receiver } = await import('@upstash/qstash');
    const receiver = new Receiver({
      currentSigningKey: signingKey,
      nextSigningKey: nextSigningKey || signingKey,
    });

    const isValid = await receiver.verify({
      signature,
      body,
    });

    return isValid;
  } catch (error) {
    log.error('Webhook signature verification failed', error as Error);
    return false;
  }
}
