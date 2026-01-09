/**
 * PERSISTENT MEMORY AGENT
 *
 * Enterprise-grade user memory system for personalized AI experiences.
 * Remembers user context across conversations for natural, personalized interactions.
 *
 * Features:
 * - Long-term memory persistence in PostgreSQL
 * - Automatic fact extraction from conversations
 * - Intelligent preference learning
 * - GDPR-compliant memory management
 * - Seamless chat integration
 *
 * Architecture:
 * ```
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    PERSISTENT MEMORY AGENT                           │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │                                                                      │
 * │  CHAT REQUEST ──► LOAD MEMORY ──► INJECT CONTEXT ──► AI RESPONSE   │
 * │                                                                      │
 * │  AI RESPONSE ──► EXTRACT FACTS ──► UPDATE MEMORY ──► PERSIST       │
 * │                  (async background)                                  │
 * │                                                                      │
 * │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
 * │  │   Memory    │  │  Extractor  │  │   Types     │                 │
 * │  │   Service   │  │  (Haiku)    │  │  & Schemas  │                 │
 * │  └─────────────┘  └─────────────┘  └─────────────┘                 │
 * │                                                                      │
 * │  Database: conversation_memory table (Supabase PostgreSQL)          │
 * │                                                                      │
 * └─────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * Usage:
 * ```typescript
 * import { loadUserMemory, formatMemoryForPrompt, processConversationForMemory } from '@/lib/memory';
 *
 * // In chat API - load and inject memory
 * const memory = await loadUserMemory(userId);
 * const { contextString } = formatMemoryForPrompt(memory);
 * const systemPrompt = basePrompt + contextString;
 *
 * // After chat - extract and save (async)
 * processConversationForMemory(userId, messages, conversationId);
 * ```
 *
 * @module memory
 * @version 1.0.0
 */

// Core memory service
export {
  loadUserMemory,
  formatMemoryForPrompt,
  createUserMemory,
  updateUserMemory,
  deleteUserMemory,
  hasUserMemory,
  forgetFromMemory,
} from './user-memory';

// Memory extraction
export {
  extractMemoryFromConversation,
  shouldExtractMemory,
  extractTopicsLocally,
} from './memory-extractor';

// Types
export type {
  UserMemory,
  UserPreferences,
  MemoryContext,
  MemoryOptions,
  MemoryUpdateResult,
  MemoryExtraction,
  ExtractedFact,
  FamilyMember,
  ImportantDate,
} from './types';

// Re-export convenience function
import { loadUserMemory, formatMemoryForPrompt, updateUserMemory } from './user-memory';
import { extractMemoryFromConversation, shouldExtractMemory } from './memory-extractor';
import { logger } from '@/lib/logger';

const log = logger('Memory');

/**
 * High-level function to process a conversation for memory extraction
 * Designed to be called asynchronously after chat completes
 *
 * @param userId - User ID
 * @param messages - Conversation messages
 * @param conversationId - Optional conversation ID
 */
export async function processConversationForMemory(
  userId: string,
  messages: Array<{ role: string; content: string }>,
  conversationId?: string
): Promise<void> {
  try {
    // Quick check if extraction is worthwhile
    if (!shouldExtractMemory(messages)) {
      log.debug('Skipping memory extraction - no personal content detected');
      return;
    }

    // Extract memory from conversation
    const extraction = await extractMemoryFromConversation(messages);

    // Skip if nothing extracted
    if (extraction.facts.length === 0 && extraction.topics.length === 0) {
      log.debug('No memory extracted from conversation');
      return;
    }

    // Update user memory
    const result = await updateUserMemory(userId, extraction, conversationId);

    if (result.success) {
      log.info('Memory updated successfully', {
        userId,
        factsAdded: result.factsAdded,
        topicsAdded: result.topicsAdded,
      });
    }
  } catch (error) {
    // Don't throw - memory extraction should never break the main flow
    log.error('Error processing conversation for memory', error as Error);
  }
}

/**
 * Load and format user memory for chat context injection
 * Convenience function combining load + format
 *
 * @param userId - User ID
 * @returns Memory context ready for system prompt
 */
export async function getMemoryContext(userId: string): Promise<{
  loaded: boolean;
  contextString: string;
}> {
  try {
    const memory = await loadUserMemory(userId);
    const context = formatMemoryForPrompt(memory);
    return {
      loaded: context.loaded,
      contextString: context.contextString,
    };
  } catch (error) {
    log.error('Error getting memory context', error as Error);
    return {
      loaded: false,
      contextString: '',
    };
  }
}
