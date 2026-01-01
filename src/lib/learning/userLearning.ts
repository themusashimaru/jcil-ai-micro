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
  | 'output_preference';  // code examples, step-by-step, etc.

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
    '## USER PREFERENCES (Style Only - Do Not Override Core Values)',
    '',
    'Based on past conversations, this user prefers:',
    '',
  ];

  // Group by type
  const byType = new Map<PreferenceType, string[]>();
  for (const pref of preferences) {
    const list = byType.get(pref.preference_type) || [];
    list.push(pref.preference_value);
    byType.set(pref.preference_type, list);
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
  parts.push('*Apply these style preferences where appropriate, but NEVER override core Christian values or faith content.*');
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
