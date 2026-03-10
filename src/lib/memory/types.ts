/**
 * PERSISTENT MEMORY AGENT - Type Definitions
 *
 * Enterprise-grade type definitions for the user memory system.
 * Supports long-term personalization across conversations.
 *
 * @module memory/types
 * @version 1.0.0
 */

/**
 * User memory record stored in database
 * Maps to `conversation_memory` table in Supabase
 */
export interface UserMemory {
  id: string;
  user_id: string;

  /** AI-generated summary of user's conversation history */
  summary: string;

  /** Key topics the user has discussed (e.g., ["theology", "programming", "family"]) */
  key_topics: string[];

  /** Maps topic name → ISO timestamp of when each topic was last discussed */
  topic_timestamps: Record<string, string>;

  /** Learned preferences in structured format */
  user_preferences: UserPreferences;

  /** IDs of conversations that contributed to this memory */
  conversation_ids: string[];

  /** Recent conversation summaries for context */
  last_conversations: string[];

  /** Timestamps */
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
}

/**
 * Structured user preferences learned over time
 */
export interface UserPreferences {
  /** User's name if shared */
  name?: string;

  /** How user prefers to be addressed */
  preferred_name?: string;

  /** User's occupation/role if mentioned */
  occupation?: string;

  /** User's location if shared */
  location?: string;

  /** Communication style preference */
  communication_style?: 'formal' | 'casual' | 'technical' | 'simple';

  /** Topics user is interested in */
  interests?: string[];

  /** User's faith background if relevant */
  faith_context?: string;

  /** Family members mentioned */
  family_members?: FamilyMember[];

  /** Goals or aspirations mentioned */
  goals?: string[];

  /** Important dates (birthdays, anniversaries) */
  important_dates?: ImportantDate[];

  /** Any specific requests for how AI should interact */
  interaction_preferences?: string[];

  /** Custom key-value pairs for additional context */
  custom?: Record<string, string>;
}

/**
 * Family member reference
 */
export interface FamilyMember {
  relation: string; // e.g., "wife", "son", "mother"
  name?: string;
  notes?: string;
}

/**
 * Important date reference
 */
export interface ImportantDate {
  label: string; // e.g., "wife's birthday", "anniversary"
  date?: string; // ISO date or partial like "March 15"
}

/**
 * Memory extraction result from conversation analysis
 */
export interface MemoryExtraction {
  /** New facts learned about the user */
  facts: ExtractedFact[];

  /** Topics discussed in this conversation */
  topics: string[];

  /** Brief summary of the conversation */
  summary: string;

  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Single fact extracted from conversation
 */
export interface ExtractedFact {
  /** Category of fact */
  category: 'personal' | 'preference' | 'family' | 'work' | 'interest' | 'goal' | 'other';

  /** The fact itself */
  fact: string;

  /** Structured key for preferences object */
  key?: string;

  /** Structured value for preferences object */
  value?: string | string[];

  /** Confidence (0-1) */
  confidence: number;
}

/**
 * Memory context formatted for injection into system prompt
 */
export interface MemoryContext {
  /** Whether memory was loaded successfully */
  loaded: boolean;

  /** Formatted string for system prompt injection */
  contextString: string;

  /** Number of topics in memory */
  topicCount: number;

  /** Last update timestamp */
  lastUpdated: string | null;
}

/**
 * Options for memory operations
 */
export interface MemoryOptions {
  /** Whether to include full conversation summaries */
  includeConversationSummaries?: boolean;

  /** Maximum topics to include in context */
  maxTopics?: number;

  /** Maximum length of context string */
  maxContextLength?: number;
}

/**
 * Result of memory update operation
 */
export interface MemoryUpdateResult {
  success: boolean;
  updated: boolean;
  factsAdded: number;
  topicsAdded: number;
  error?: string;
}
