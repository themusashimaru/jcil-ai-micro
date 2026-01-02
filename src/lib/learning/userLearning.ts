/**
 * USER LEARNING SYSTEM
 * ====================
 *
 * Learns user STYLE preferences over time (not beliefs).
 * Injects learned preferences into prompts at LOWEST priority.
 *
 * HIERARCHY (unchanged):
 * 1. Core Christian Values (slimPrompt) - ALWAYS WINS
 * 2. Knowledge Base Content (faith topics)
 * 3. Learned User Preferences (this file) - style only, lowest priority
 *
 * WHAT WE LEARN:
 * - Format preferences (bullets vs paragraphs, concise vs detailed)
 * - Communication style (formal vs casual)
 * - Domain expertise (tech, finance, medical, etc.)
 * - Response length preferences
 * - Recurring topics/interests
 *
 * WHAT WE NEVER LEARN/OVERRIDE:
 * - Faith positions (always defer to core prompt)
 * - Moral stances (always defer to Christian worldview)
 * - Identity (always JCIL.ai)
 *
 * SUPABASE TABLE: user_learning
 * Columns: id, user_id, preference_type, preference_value, confidence, observation_count, created_at, updated_at
 */

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export type PreferenceType =
  | 'format_style'        // bullets, paragraphs, headers, etc.
  | 'response_length'     // concise, detailed, comprehensive
  | 'communication_tone'  // formal, casual, professional
  | 'domain_expertise'    // tech, finance, medical, legal, etc.
  | 'topic_interest'      // recurring topics they ask about
  | 'output_preference'   // code examples, step-by-step, etc.
  | 'explicit_memory'     // User explicitly asked to remember something
  | 'project_context'     // Current project/repo the user is working on
  | 'personal_info'       // Name, role, company, etc.
  | 'work_context';       // Current work/tasks they're doing

export interface UserPreference {
  id?: string;
  user_id: string;
  preference_type: PreferenceType;
  preference_value: string;
  confidence: number;      // 0.0 - 1.0, increases with observations
  observation_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationSignals {
  userMessages: string[];
  assistantMessages: string[];
  userId: string;
}

export interface LearnedContext {
  preferences: UserPreference[];
  promptInjection: string | null;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  minConfidenceForInjection: 0.6,  // Only inject preferences with 60%+ confidence
  maxPreferencesPerType: 3,         // Keep top 3 per category
  confidenceDecay: 0.95,            // Decay old preferences slowly
  confidenceBoost: 0.15,            // Boost when observed again
  cacheTtlMs: 60000,                // Cache user preferences for 1 minute
};

// Simple in-memory cache
const preferenceCache = new Map<string, { prefs: UserPreference[]; timestamp: number }>();

// ============================================================================
// Supabase Client
// ============================================================================

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[UserLearning] Supabase not configured');
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

// ============================================================================
// Preference Extraction (runs async after responses)
// ============================================================================

/**
 * Extract learnable signals from a conversation exchange.
 * This is called AFTER the response is sent (non-blocking).
 */
export async function extractAndLearn(signals: ConversationSignals): Promise<void> {
  if (!isLearningEnabled()) {
    return;
  }

  const { userMessages, assistantMessages, userId } = signals;

  if (!userId || userMessages.length === 0) {
    return;
  }

  try {
    const extractedPrefs = extractPreferencesFromMessages(userMessages, assistantMessages);

    if (extractedPrefs.length > 0) {
      await updateUserPreferences(userId, extractedPrefs);
      console.log(`[UserLearning] Learned ${extractedPrefs.length} preferences for user ${userId.slice(0, 8)}...`);
    }
  } catch (error) {
    // Learning failures should never break the app
    console.error('[UserLearning] Learning error (non-fatal):', error);
  }
}

/**
 * Extract preferences from message patterns
 */
function extractPreferencesFromMessages(
  userMessages: string[],
  _assistantMessages: string[]
): Partial<UserPreference>[] {
  const extracted: Partial<UserPreference>[] = [];
  const combinedUserText = userMessages.join(' ').toLowerCase();

  // FORMAT STYLE DETECTION
  if (combinedUserText.includes('bullet') || combinedUserText.includes('list')) {
    extracted.push({
      preference_type: 'format_style',
      preference_value: 'bullets_preferred',
    });
  }
  if (combinedUserText.includes('step by step') || combinedUserText.includes('step-by-step')) {
    extracted.push({
      preference_type: 'format_style',
      preference_value: 'step_by_step_preferred',
    });
  }

  // RESPONSE LENGTH DETECTION
  if (combinedUserText.includes('brief') || combinedUserText.includes('short') || combinedUserText.includes('concise')) {
    extracted.push({
      preference_type: 'response_length',
      preference_value: 'concise',
    });
  }
  if (combinedUserText.includes('detail') || combinedUserText.includes('thorough') || combinedUserText.includes('comprehensive')) {
    extracted.push({
      preference_type: 'response_length',
      preference_value: 'detailed',
    });
  }

  // DOMAIN EXPERTISE DETECTION
  const domainPatterns: [RegExp, string][] = [
    [/\b(code|coding|programming|javascript|python|react|api|software|developer|tech)\b/i, 'technology'],
    [/\b(finance|invest|stock|budget|money|accounting|roi|revenue)\b/i, 'finance'],
    [/\b(medical|health|patient|diagnosis|treatment|clinical|doctor|nurse)\b/i, 'medical'],
    [/\b(legal|law|contract|attorney|court|litigation|compliance)\b/i, 'legal'],
    [/\b(marketing|brand|campaign|audience|content|social media|seo)\b/i, 'marketing'],
    [/\b(education|student|learning|teach|curriculum|school)\b/i, 'education'],
  ];

  for (const [pattern, domain] of domainPatterns) {
    if (pattern.test(combinedUserText)) {
      extracted.push({
        preference_type: 'domain_expertise',
        preference_value: domain,
      });
    }
  }

  // COMMUNICATION TONE DETECTION
  if (combinedUserText.includes('formal') || combinedUserText.includes('professional')) {
    extracted.push({
      preference_type: 'communication_tone',
      preference_value: 'formal',
    });
  }
  if (combinedUserText.includes('casual') || combinedUserText.includes('friendly') || combinedUserText.includes('relaxed')) {
    extracted.push({
      preference_type: 'communication_tone',
      preference_value: 'casual',
    });
  }

  return extracted;
}

// ============================================================================
// Preference Storage
// ============================================================================

/**
 * Update or insert user preferences with confidence scoring
 */
async function updateUserPreferences(
  userId: string,
  newPrefs: Partial<UserPreference>[]
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  for (const pref of newPrefs) {
    if (!pref.preference_type || !pref.preference_value) continue;

    // Check if preference already exists
    const { data: existing } = await supabase
      .from('user_learning')
      .select('*')
      .eq('user_id', userId)
      .eq('preference_type', pref.preference_type)
      .eq('preference_value', pref.preference_value)
      .single();

    if (existing) {
      // Boost confidence on repeated observation
      const newConfidence = Math.min(1.0, existing.confidence + CONFIG.confidenceBoost);
      const newCount = existing.observation_count + 1;

      await supabase
        .from('user_learning')
        .update({
          confidence: newConfidence,
          observation_count: newCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Insert new preference with initial confidence
      await supabase
        .from('user_learning')
        .insert({
          user_id: userId,
          preference_type: pref.preference_type,
          preference_value: pref.preference_value,
          confidence: 0.4, // Start at 40% confidence
          observation_count: 1,
        });
    }
  }

  // Clear cache for this user
  preferenceCache.delete(userId);
}

// ============================================================================
// Preference Retrieval & Injection
// ============================================================================

/**
 * Get learned context for a user (cached)
 */
export async function getLearnedContext(userId: string): Promise<LearnedContext> {
  if (!isLearningEnabled() || !userId) {
    return { preferences: [], promptInjection: null };
  }

  // Check cache
  const cached = preferenceCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CONFIG.cacheTtlMs) {
    return {
      preferences: cached.prefs,
      promptInjection: buildPromptInjection(cached.prefs),
    };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return { preferences: [], promptInjection: null };
  }

  try {
    const { data, error } = await supabase
      .from('user_learning')
      .select('*')
      .eq('user_id', userId)
      .gte('confidence', CONFIG.minConfidenceForInjection)
      .order('confidence', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[UserLearning] Query error:', error);
      return { preferences: [], promptInjection: null };
    }

    const preferences = (data || []) as UserPreference[];

    // Cache results
    preferenceCache.set(userId, { prefs: preferences, timestamp: Date.now() });

    return {
      preferences,
      promptInjection: buildPromptInjection(preferences),
    };
  } catch (error) {
    console.error('[UserLearning] Retrieval error:', error);
    return { preferences: [], promptInjection: null };
  }
}

/**
 * Build the prompt injection string from learned preferences.
 *
 * IMPORTANT: This is STYLE ONLY. Never override faith content.
 */
function buildPromptInjection(preferences: UserPreference[]): string | null {
  if (preferences.length === 0) {
    return null;
  }

  const parts: string[] = [
    '',
    '## USER CONTEXT & PREFERENCES',
    '',
  ];

  // Group by type
  const byType = new Map<PreferenceType, string[]>();
  for (const pref of preferences) {
    const list = byType.get(pref.preference_type) || [];
    list.push(pref.preference_value);
    byType.set(pref.preference_type, list);
  }

  // =========================================================================
  // PERSISTENT MEMORY (user explicitly asked to remember)
  // =========================================================================

  const personalInfo = byType.get('personal_info');
  if (personalInfo) {
    parts.push('### About This User');
    for (const info of personalInfo) {
      parts.push(`- ${info}`);
    }
    parts.push('');
  }

  const workContext = byType.get('work_context');
  if (workContext) {
    parts.push('### Work Context');
    for (const ctx of workContext) {
      parts.push(`- ${ctx}`);
    }
    parts.push('');
  }

  const projectContext = byType.get('project_context');
  if (projectContext) {
    parts.push('### Current Projects');
    for (const proj of projectContext) {
      parts.push(`- ${proj}`);
    }
    parts.push('');
  }

  const explicitMemories = byType.get('explicit_memory');
  if (explicitMemories) {
    parts.push('### Things to Remember');
    for (const mem of explicitMemories) {
      parts.push(`- ${mem}`);
    }
    parts.push('');
  }

  // =========================================================================
  // STYLE PREFERENCES (learned from behavior)
  // =========================================================================

  const hasStylePrefs =
    byType.has('format_style') ||
    byType.has('response_length') ||
    byType.has('domain_expertise') ||
    byType.has('communication_tone');

  if (hasStylePrefs) {
    parts.push('### Style Preferences');
  }

  // Format style
  const formatPrefs = byType.get('format_style');
  if (formatPrefs) {
    const formatted = formatPrefs.map(p => {
      if (p === 'bullets_preferred') return 'bullet points over paragraphs';
      if (p === 'step_by_step_preferred') return 'step-by-step instructions';
      return p.replace(/_/g, ' ');
    });
    parts.push(`- **Format:** ${formatted.join(', ')}`);
  }

  // Response length
  const lengthPrefs = byType.get('response_length');
  if (lengthPrefs) {
    const pref = lengthPrefs[0];
    if (pref === 'concise') {
      parts.push('- **Length:** Prefers concise, to-the-point responses');
    } else if (pref === 'detailed') {
      parts.push('- **Length:** Prefers detailed, comprehensive responses');
    }
  }

  // Domain expertise
  const domainPrefs = byType.get('domain_expertise');
  if (domainPrefs) {
    parts.push(`- **Domain:** Has expertise in ${domainPrefs.join(', ')} - use appropriate terminology`);
  }

  // Communication tone
  const tonePrefs = byType.get('communication_tone');
  if (tonePrefs) {
    parts.push(`- **Tone:** Prefers ${tonePrefs[0]} communication style`);
  }

  parts.push('');
  parts.push('*Use this context to personalize responses. Never override core values or faith content.*');
  parts.push('');

  return parts.join('\n');
}

// ============================================================================
// Feature Flag
// ============================================================================

/**
 * Check if user learning is enabled
 */
export function isLearningEnabled(): boolean {
  return process.env.ENABLE_USER_LEARNING === 'true';
}

/**
 * Clear cache for a user (useful for testing)
 */
export function clearLearningCache(userId?: string): void {
  if (userId) {
    preferenceCache.delete(userId);
  } else {
    preferenceCache.clear();
  }
  console.log('[UserLearning] Cache cleared');
}

// ============================================================================
// EXPLICIT MEMORY SYSTEM
// ============================================================================

/**
 * Detect if user is asking to remember something explicitly
 */
export function detectMemoryCommand(message: string): {
  isRemember: boolean;
  isForget: boolean;
  isRecall: boolean;
  content: string | null;
} {
  const lower = message.toLowerCase();

  // Remember patterns
  const rememberPatterns = [
    /(?:please\s+)?remember\s+(?:that\s+)?(.+)/i,
    /(?:please\s+)?keep\s+in\s+mind\s+(?:that\s+)?(.+)/i,
    /(?:please\s+)?note\s+(?:that\s+)?(.+)/i,
    /(?:please\s+)?don'?t\s+forget\s+(?:that\s+)?(.+)/i,
    /my\s+name\s+is\s+(\w+)/i,
    /i(?:'m|\s+am)\s+(?:a\s+)?(\w+(?:\s+\w+)?)\s+(?:at|from|working\s+on)/i,
    /i\s+work\s+(?:at|for|on)\s+(.+)/i,
    /i(?:'m|\s+am)\s+working\s+on\s+(.+)/i,
    /i\s+prefer\s+(.+)/i,
    /call\s+me\s+(\w+)/i,
  ];

  for (const pattern of rememberPatterns) {
    const match = message.match(pattern);
    if (match) {
      return { isRemember: true, isForget: false, isRecall: false, content: match[1].trim() };
    }
  }

  // Forget patterns
  const forgetPatterns = [
    /(?:please\s+)?forget\s+(?:that\s+)?(.+)/i,
    /(?:please\s+)?don'?t\s+remember\s+(.+)/i,
    /(?:please\s+)?remove\s+(?:the\s+)?memory\s+(?:about\s+)?(.+)/i,
    /(?:please\s+)?clear\s+(?:my\s+)?(?:memories?|preferences?)/i,
  ];

  for (const pattern of forgetPatterns) {
    const match = message.match(pattern);
    if (match) {
      return { isRemember: false, isForget: true, isRecall: false, content: match[1]?.trim() || null };
    }
  }

  // Recall patterns
  if (
    lower.includes('what do you remember') ||
    lower.includes('what have you learned') ||
    lower.includes('show my memories') ||
    lower.includes('what do you know about me')
  ) {
    return { isRemember: false, isForget: false, isRecall: true, content: null };
  }

  return { isRemember: false, isForget: false, isRecall: false, content: null };
}

/**
 * Store an explicit memory for a user
 */
export async function storeExplicitMemory(
  userId: string,
  memory: string,
  memoryType: 'explicit_memory' | 'personal_info' | 'project_context' | 'work_context' = 'explicit_memory'
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !userId || !memory) {
    return false;
  }

  try {
    // Check if similar memory already exists
    const { data: existing } = await supabase
      .from('user_learning')
      .select('*')
      .eq('user_id', userId)
      .eq('preference_type', memoryType)
      .eq('preference_value', memory)
      .single();

    if (existing) {
      // Boost confidence if already exists
      await supabase
        .from('user_learning')
        .update({
          confidence: Math.min(1.0, existing.confidence + 0.2),
          observation_count: existing.observation_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Insert new memory with high confidence (user explicitly asked)
      await supabase
        .from('user_learning')
        .insert({
          user_id: userId,
          preference_type: memoryType,
          preference_value: memory,
          confidence: 0.9, // High confidence for explicit memories
          observation_count: 1,
        });
    }

    // Clear cache
    preferenceCache.delete(userId);
    console.log(`[UserLearning] Stored explicit memory for user ${userId.slice(0, 8)}...: "${memory.slice(0, 50)}..."`);

    return true;
  } catch (error) {
    console.error('[UserLearning] Failed to store memory:', error);
    return false;
  }
}

/**
 * Delete a specific memory or all memories of a type
 */
export async function forgetMemory(
  userId: string,
  memoryContent?: string,
  memoryType?: PreferenceType
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !userId) {
    return false;
  }

  try {
    let query = supabase
      .from('user_learning')
      .delete()
      .eq('user_id', userId);

    if (memoryType) {
      query = query.eq('preference_type', memoryType);
    }

    if (memoryContent) {
      query = query.ilike('preference_value', `%${memoryContent}%`);
    }

    await query;

    // Clear cache
    preferenceCache.delete(userId);
    console.log(`[UserLearning] Deleted memories for user ${userId.slice(0, 8)}...`);

    return true;
  } catch (error) {
    console.error('[UserLearning] Failed to forget memory:', error);
    return false;
  }
}

/**
 * Get all memories for a user (for "what do you remember" queries)
 */
export async function getAllMemories(userId: string): Promise<UserPreference[]> {
  const supabase = getSupabase();
  if (!supabase || !userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('user_learning')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[UserLearning] Failed to get memories:', error);
      return [];
    }

    return (data || []) as UserPreference[];
  } catch (error) {
    console.error('[UserLearning] Error getting memories:', error);
    return [];
  }
}

/**
 * Format memories for display to user
 */
export function formatMemoriesForDisplay(memories: UserPreference[]): string {
  if (memories.length === 0) {
    return "I don't have any memories stored for you yet. You can ask me to remember things by saying \"Remember that...\" or \"My name is...\"";
  }

  const grouped = new Map<PreferenceType, string[]>();
  for (const mem of memories) {
    const list = grouped.get(mem.preference_type) || [];
    list.push(mem.preference_value);
    grouped.set(mem.preference_type, list);
  }

  const lines: string[] = ['## What I Remember About You\n'];

  const typeLabels: Partial<Record<PreferenceType, string>> = {
    explicit_memory: '💭 Explicit Memories',
    personal_info: '👤 Personal Info',
    project_context: '📁 Projects',
    work_context: '💼 Work Context',
    format_style: '📝 Format Preferences',
    response_length: '📏 Response Length',
    communication_tone: '🎭 Tone',
    domain_expertise: '🧠 Expertise Areas',
    topic_interest: '🎯 Interests',
    output_preference: '⚙️ Output Preferences',
  };

  for (const [type, values] of grouped) {
    const label = typeLabels[type] || type;
    lines.push(`### ${label}`);
    for (const val of values) {
      lines.push(`- ${val}`);
    }
    lines.push('');
  }

  lines.push('\n*You can ask me to forget specific things or clear all memories.*');

  return lines.join('\n');
}

/**
 * Process a message for memory commands (call this from chat route)
 */
export async function processMemoryCommand(
  userId: string,
  message: string
): Promise<{ handled: boolean; response?: string }> {
  const command = detectMemoryCommand(message);

  if (command.isRecall) {
    const memories = await getAllMemories(userId);
    return {
      handled: true,
      response: formatMemoriesForDisplay(memories),
    };
  }

  if (command.isRemember && command.content) {
    // Detect memory type based on content
    let memoryType: 'explicit_memory' | 'personal_info' | 'project_context' | 'work_context' = 'explicit_memory';

    const content = command.content.toLowerCase();
    if (/^(my name|i'?m\s+called|call me)/i.test(content) || /name/i.test(message)) {
      memoryType = 'personal_info';
    } else if (/project|repo|codebase|working on/i.test(content)) {
      memoryType = 'project_context';
    } else if (/work|job|company|team|role/i.test(content)) {
      memoryType = 'work_context';
    }

    const success = await storeExplicitMemory(userId, command.content, memoryType);

    if (success) {
      return {
        handled: false, // Let the AI also respond naturally
        response: undefined,
      };
    }
  }

  if (command.isForget) {
    if (command.content) {
      await forgetMemory(userId, command.content);
      return {
        handled: true,
        response: `Got it, I've forgotten what you mentioned about "${command.content}".`,
      };
    } else {
      // Clear all memories
      await forgetMemory(userId);
      return {
        handled: true,
        response: "I've cleared all my memories about you. We're starting fresh!",
      };
    }
  }

  return { handled: false };
}
