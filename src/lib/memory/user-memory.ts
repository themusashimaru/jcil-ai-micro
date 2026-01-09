/**
 * PERSISTENT MEMORY AGENT - User Memory Service
 *
 * Core service for managing user memory across conversations.
 * Provides personalized AI experiences by remembering user context.
 *
 * Features:
 * - Load user memory from database
 * - Format memory for system prompt injection
 * - Update memory with new facts
 * - Merge preferences intelligently
 *
 * @module memory/user-memory
 * @version 1.0.0
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import type {
  UserMemory,
  UserPreferences,
  MemoryContext,
  MemoryOptions,
  MemoryUpdateResult,
  MemoryExtraction,
} from './types';

const log = logger('UserMemory');

// Configuration
const DEFAULT_MAX_TOPICS = 10;
const DEFAULT_MAX_CONTEXT_LENGTH = 2000;
const MAX_CONVERSATION_SUMMARIES = 5;

/**
 * Get Supabase admin client for memory operations
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    log.warn('Supabase not configured for memory operations');
    return null;
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Load user memory from database
 *
 * @param userId - User ID to load memory for
 * @returns User memory or null if not found
 */
export async function loadUserMemory(userId: string): Promise<UserMemory | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('conversation_memory')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No memory exists yet - this is normal for new users
        log.debug('No memory found for user', { userId });
        return null;
      }
      log.error('Failed to load user memory', error);
      return null;
    }

    // Update last accessed timestamp
    await supabase
      .from('conversation_memory')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('user_id', userId);

    log.debug('Loaded user memory', { userId, topics: data.key_topics?.length || 0 });

    return {
      id: data.id,
      user_id: data.user_id,
      summary: data.summary || '',
      key_topics: data.key_topics || [],
      user_preferences: data.user_preferences || {},
      conversation_ids: data.conversation_ids || [],
      last_conversations: data.last_conversations || [],
      created_at: data.created_at,
      updated_at: data.updated_at,
      last_accessed_at: data.last_accessed_at,
    };
  } catch (error) {
    log.error('Error loading user memory', error as Error);
    return null;
  }
}

/**
 * Format user memory as context string for system prompt injection
 *
 * @param memory - User memory object
 * @param options - Formatting options
 * @returns Formatted memory context
 */
export function formatMemoryForPrompt(
  memory: UserMemory | null,
  options: MemoryOptions = {}
): MemoryContext {
  if (!memory) {
    return {
      loaded: false,
      contextString: '',
      topicCount: 0,
      lastUpdated: null,
    };
  }

  const {
    includeConversationSummaries = true,
    maxTopics = DEFAULT_MAX_TOPICS,
    maxContextLength = DEFAULT_MAX_CONTEXT_LENGTH,
  } = options;

  const lines: string[] = [];
  lines.push('---');
  lines.push('USER MEMORY (Persistent Context):');
  lines.push('');

  // Add user preferences
  const prefs = memory.user_preferences;
  if (prefs && Object.keys(prefs).length > 0) {
    lines.push('**About This User:**');

    if (prefs.name || prefs.preferred_name) {
      lines.push(`- Name: ${prefs.preferred_name || prefs.name}`);
    }
    if (prefs.occupation) {
      lines.push(`- Occupation: ${prefs.occupation}`);
    }
    if (prefs.location) {
      lines.push(`- Location: ${prefs.location}`);
    }
    if (prefs.faith_context) {
      lines.push(`- Faith Background: ${prefs.faith_context}`);
    }
    if (prefs.communication_style) {
      lines.push(`- Prefers ${prefs.communication_style} communication style`);
    }

    // Family members
    if (prefs.family_members && prefs.family_members.length > 0) {
      lines.push('- Family:');
      for (const member of prefs.family_members.slice(0, 5)) {
        const name = member.name ? ` (${member.name})` : '';
        lines.push(`  - ${member.relation}${name}`);
      }
    }

    // Interests
    if (prefs.interests && prefs.interests.length > 0) {
      lines.push(`- Interests: ${prefs.interests.slice(0, 5).join(', ')}`);
    }

    // Goals
    if (prefs.goals && prefs.goals.length > 0) {
      lines.push('- Goals:');
      for (const goal of prefs.goals.slice(0, 3)) {
        lines.push(`  - ${goal}`);
      }
    }

    // Interaction preferences
    if (prefs.interaction_preferences && prefs.interaction_preferences.length > 0) {
      lines.push('- User Preferences:');
      for (const pref of prefs.interaction_preferences.slice(0, 3)) {
        lines.push(`  - ${pref}`);
      }
    }

    lines.push('');
  }

  // Add key topics
  if (memory.key_topics && memory.key_topics.length > 0) {
    const topics = memory.key_topics.slice(0, maxTopics);
    lines.push(`**Topics Previously Discussed:** ${topics.join(', ')}`);
    lines.push('');
  }

  // Add conversation summary
  if (memory.summary) {
    lines.push('**Context from Previous Conversations:**');
    lines.push(memory.summary.slice(0, 500));
    lines.push('');
  }

  // Add recent conversation summaries
  if (includeConversationSummaries && memory.last_conversations?.length > 0) {
    lines.push('**Recent Conversations:**');
    for (const conv of memory.last_conversations.slice(0, MAX_CONVERSATION_SUMMARIES)) {
      lines.push(`- ${conv}`);
    }
    lines.push('');
  }

  lines.push('Use this context to personalize responses. Reference previous conversations naturally when relevant.');
  lines.push('---');

  let contextString = lines.join('\n');

  // Truncate if too long
  if (contextString.length > maxContextLength) {
    contextString = contextString.slice(0, maxContextLength - 50) + '\n\n[Memory truncated for context limit]\n---';
  }

  return {
    loaded: true,
    contextString,
    topicCount: memory.key_topics?.length || 0,
    lastUpdated: memory.updated_at,
  };
}

/**
 * Create initial memory record for a new user
 *
 * @param userId - User ID
 * @returns Created memory or null on error
 */
export async function createUserMemory(userId: string): Promise<UserMemory | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    const newMemory = {
      user_id: userId,
      summary: '',
      key_topics: [],
      user_preferences: {},
      conversation_ids: [],
      last_conversations: [],
    };

    const { data, error } = await supabase
      .from('conversation_memory')
      .insert(newMemory)
      .select()
      .single();

    if (error) {
      log.error('Failed to create user memory', error);
      return null;
    }

    log.info('Created new user memory', { userId });

    return {
      id: data.id,
      user_id: data.user_id,
      summary: data.summary || '',
      key_topics: data.key_topics || [],
      user_preferences: data.user_preferences || {},
      conversation_ids: data.conversation_ids || [],
      last_conversations: data.last_conversations || [],
      created_at: data.created_at,
      updated_at: data.updated_at,
      last_accessed_at: data.last_accessed_at,
    };
  } catch (error) {
    log.error('Error creating user memory', error as Error);
    return null;
  }
}

/**
 * Update user memory with extracted information
 *
 * @param userId - User ID
 * @param extraction - Extracted memory from conversation
 * @param conversationId - ID of the conversation
 * @returns Update result
 */
export async function updateUserMemory(
  userId: string,
  extraction: MemoryExtraction,
  conversationId?: string
): Promise<MemoryUpdateResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { success: false, updated: false, factsAdded: 0, topicsAdded: 0, error: 'Database not configured' };
  }

  try {
    // Load existing memory or create new
    let memory = await loadUserMemory(userId);
    if (!memory) {
      memory = await createUserMemory(userId);
      if (!memory) {
        return { success: false, updated: false, factsAdded: 0, topicsAdded: 0, error: 'Failed to create memory' };
      }
    }

    // Merge preferences from extracted facts
    const updatedPrefs = mergePreferences(memory.user_preferences, extraction.facts);

    // Merge topics (deduplicate)
    const existingTopics = new Set(memory.key_topics);
    const newTopics: string[] = [];
    for (const topic of extraction.topics) {
      const normalizedTopic = topic.toLowerCase().trim();
      if (!existingTopics.has(normalizedTopic)) {
        newTopics.push(normalizedTopic);
        existingTopics.add(normalizedTopic);
      }
    }
    const mergedTopics = [...memory.key_topics, ...newTopics].slice(0, 50); // Cap at 50 topics

    // Update conversation summaries (keep last 10)
    const updatedSummaries = [extraction.summary, ...memory.last_conversations].slice(0, 10);

    // Update conversation IDs
    const updatedConvIds = conversationId
      ? [...new Set([conversationId, ...memory.conversation_ids])].slice(0, 100)
      : memory.conversation_ids;

    // Generate new overall summary if we have enough data
    let updatedSummary = memory.summary;
    if (updatedSummaries.length >= 3 && extraction.summary) {
      updatedSummary = generateOverallSummary(updatedSummaries, updatedPrefs);
    }

    // Update database
    const { error } = await supabase
      .from('conversation_memory')
      .update({
        summary: updatedSummary,
        key_topics: mergedTopics,
        user_preferences: updatedPrefs,
        conversation_ids: updatedConvIds,
        last_conversations: updatedSummaries,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      log.error('Failed to update user memory', error);
      return { success: false, updated: false, factsAdded: 0, topicsAdded: 0, error: error.message };
    }

    log.info('Updated user memory', {
      userId,
      factsAdded: extraction.facts.length,
      topicsAdded: newTopics.length,
    });

    return {
      success: true,
      updated: true,
      factsAdded: extraction.facts.length,
      topicsAdded: newTopics.length,
    };
  } catch (error) {
    log.error('Error updating user memory', error as Error);
    return {
      success: false,
      updated: false,
      factsAdded: 0,
      topicsAdded: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Merge extracted facts into existing preferences
 */
function mergePreferences(
  existing: UserPreferences,
  facts: MemoryExtraction['facts']
): UserPreferences {
  const updated = { ...existing };

  for (const fact of facts) {
    if (fact.confidence < 0.6) continue; // Skip low-confidence facts

    switch (fact.category) {
      case 'personal':
        if (fact.key === 'name' && typeof fact.value === 'string') {
          updated.name = fact.value;
        } else if (fact.key === 'preferred_name' && typeof fact.value === 'string') {
          updated.preferred_name = fact.value;
        } else if (fact.key === 'occupation' && typeof fact.value === 'string') {
          updated.occupation = fact.value;
        } else if (fact.key === 'location' && typeof fact.value === 'string') {
          updated.location = fact.value;
        }
        break;

      case 'preference':
        if (fact.key === 'communication_style' && typeof fact.value === 'string') {
          const style = fact.value.toLowerCase();
          if (['formal', 'casual', 'technical', 'simple'].includes(style)) {
            updated.communication_style = style as UserPreferences['communication_style'];
          }
        } else if (fact.key === 'interaction_preference' && typeof fact.value === 'string') {
          updated.interaction_preferences = [
            ...(updated.interaction_preferences || []),
            fact.value,
          ].slice(0, 10);
        }
        break;

      case 'family':
        if (fact.key === 'family_member' && typeof fact.value === 'string') {
          const [relation, name] = fact.value.split(':').map(s => s.trim());
          const existingMembers = updated.family_members || [];
          const exists = existingMembers.some(m => m.relation === relation);
          if (!exists) {
            updated.family_members = [...existingMembers, { relation, name: name || undefined }].slice(0, 20);
          }
        }
        break;

      case 'interest':
        if (typeof fact.value === 'string') {
          const interests = updated.interests || [];
          if (!interests.includes(fact.value)) {
            updated.interests = [...interests, fact.value].slice(0, 20);
          }
        }
        break;

      case 'goal':
        if (typeof fact.value === 'string') {
          const goals = updated.goals || [];
          if (!goals.includes(fact.value)) {
            updated.goals = [...goals, fact.value].slice(0, 10);
          }
        }
        break;

      case 'work':
        if (fact.key === 'occupation' && typeof fact.value === 'string') {
          updated.occupation = fact.value;
        }
        break;

      default:
        // Store in custom field
        if (fact.key && fact.value && typeof fact.value === 'string') {
          updated.custom = updated.custom || {};
          updated.custom[fact.key] = fact.value;
        }
    }
  }

  return updated;
}

/**
 * Generate overall summary from recent conversation summaries
 */
function generateOverallSummary(summaries: string[], prefs: UserPreferences): string {
  const parts: string[] = [];

  // Add identity summary if available
  if (prefs.name) {
    let identity = prefs.name;
    if (prefs.occupation) identity += `, ${prefs.occupation}`;
    if (prefs.location) identity += ` from ${prefs.location}`;
    parts.push(identity);
  }

  // Add recent context
  if (summaries.length > 0) {
    parts.push(`Recent topics: ${summaries.slice(0, 3).join('; ')}`);
  }

  return parts.join('. ');
}

/**
 * Delete user memory (for GDPR compliance)
 *
 * @param userId - User ID
 * @returns Success status
 */
export async function deleteUserMemory(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('conversation_memory')
      .delete()
      .eq('user_id', userId);

    if (error) {
      log.error('Failed to delete user memory', error);
      return false;
    }

    log.info('Deleted user memory', { userId });
    return true;
  } catch (error) {
    log.error('Error deleting user memory', error as Error);
    return false;
  }
}

/**
 * Check if user has existing memory
 *
 * @param userId - User ID
 * @returns Whether memory exists
 */
export async function hasUserMemory(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  try {
    const { count, error } = await supabase
      .from('conversation_memory')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) return false;
    return (count || 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Forget specific facts or topics from user memory (GDPR targeted deletion)
 *
 * @param userId - User ID
 * @param options - What to forget
 * @returns Success status and what was removed
 */
export async function forgetFromMemory(
  userId: string,
  options: {
    topics?: string[];
    preferenceKeys?: string[];
    clearSummary?: boolean;
  }
): Promise<{ success: boolean; removed: string[]; error?: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { success: false, removed: [], error: 'Database not configured' };
  }

  try {
    const memory = await loadUserMemory(userId);
    if (!memory) {
      return { success: true, removed: [], error: 'No memory to forget' };
    }

    const removed: string[] = [];

    // Remove specified topics
    let updatedTopics = memory.key_topics;
    if (options.topics && options.topics.length > 0) {
      const topicsToRemove = new Set(options.topics.map(t => t.toLowerCase()));
      const originalCount = updatedTopics.length;
      updatedTopics = updatedTopics.filter(t => !topicsToRemove.has(t.toLowerCase()));
      if (originalCount !== updatedTopics.length) {
        removed.push(`topics: ${options.topics.join(', ')}`);
      }
    }

    // Remove specified preference keys
    let updatedPrefs = { ...memory.user_preferences };
    if (options.preferenceKeys && options.preferenceKeys.length > 0) {
      for (const key of options.preferenceKeys) {
        if (key in updatedPrefs) {
          delete (updatedPrefs as Record<string, unknown>)[key];
          removed.push(`preference: ${key}`);
        }
        // Also check custom preferences
        if (updatedPrefs.custom && key in updatedPrefs.custom) {
          delete updatedPrefs.custom[key];
          removed.push(`custom preference: ${key}`);
        }
      }
    }

    // Clear summary if requested
    let updatedSummary = memory.summary;
    let updatedConversations = memory.last_conversations;
    if (options.clearSummary) {
      updatedSummary = '';
      updatedConversations = [];
      removed.push('summary and conversation history');
    }

    // Update database
    const { error } = await supabase
      .from('conversation_memory')
      .update({
        key_topics: updatedTopics,
        user_preferences: updatedPrefs,
        summary: updatedSummary,
        last_conversations: updatedConversations,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      log.error('Failed to forget from memory', error);
      return { success: false, removed: [], error: error.message };
    }

    log.info('Forgot from user memory', { userId, removed });
    return { success: true, removed };
  } catch (error) {
    log.error('Error forgetting from memory', error as Error);
    return {
      success: false,
      removed: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
