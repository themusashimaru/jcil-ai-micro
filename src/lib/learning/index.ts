/**
 * USER LEARNING SERVICE
 *
 * Observes user behavior across conversations and learns style preferences.
 * Preferences are stored in the user_learning table with confidence scoring.
 *
 * Architecture:
 * - Observe: Analyze conversation patterns after each chat
 * - Record: Upsert preferences with increasing confidence
 * - Apply: Format learned preferences for system prompt injection
 *
 * IMPORTANT: Style preferences only — never overrides faith/belief content.
 *
 * @module learning
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const log = logger('UserLearning');

// ========================================
// TYPES
// ========================================

export type PreferenceType =
  | 'format_style'
  | 'response_length'
  | 'communication_tone'
  | 'domain_expertise'
  | 'topic_interest'
  | 'output_preference';

export interface LearnedPreference {
  id: string;
  user_id: string;
  preference_type: PreferenceType;
  preference_value: string;
  confidence: number;
  observation_count: number;
  created_at: string;
  updated_at: string;
}

export interface LearningContext {
  loaded: boolean;
  preferences: LearnedPreference[];
  contextString: string;
}

// ========================================
// DATABASE ACCESS
// ========================================

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}

// ========================================
// PREFERENCE DETECTION
// ========================================

/**
 * Signal patterns that indicate user style preferences.
 * Each pattern matches user messages and maps to a preference.
 */
const STYLE_SIGNALS: Array<{
  pattern: RegExp;
  type: PreferenceType;
  value: string;
}> = [
  // Format style signals
  { pattern: /\b(bullet|bulleted|list)\b/i, type: 'format_style', value: 'bullets' },
  { pattern: /\bstep[- ]by[- ]step\b/i, type: 'format_style', value: 'step-by-step' },
  { pattern: /\btable\s+format\b/i, type: 'format_style', value: 'tables' },

  // Response length signals
  {
    pattern: /\b(brief|briefly|short|concise|tl;?dr)\b/i,
    type: 'response_length',
    value: 'concise',
  },
  {
    pattern: /\b(detail|detailed|in[- ]depth|thorough|comprehensive)\b/i,
    type: 'response_length',
    value: 'detailed',
  },
  { pattern: /\b(explain\s+like|eli5|simple|simply)\b/i, type: 'response_length', value: 'simple' },

  // Communication tone signals
  { pattern: /\b(formal|formally|professionally)\b/i, type: 'communication_tone', value: 'formal' },
  { pattern: /\b(casual|casually|chill|relaxed)\b/i, type: 'communication_tone', value: 'casual' },
  { pattern: /\b(technical|technically)\b/i, type: 'communication_tone', value: 'technical' },

  // Output preference signals
  {
    pattern: /\b(show\s+me\s+code|code\s+example|snippet)\b/i,
    type: 'output_preference',
    value: 'code-examples',
  },
  { pattern: /\b(diagram|visual|chart|graph)\b/i, type: 'output_preference', value: 'visual' },
];

/**
 * Domain expertise detection from content patterns.
 */
const DOMAIN_PATTERNS: Array<{ pattern: RegExp; domain: string }> = [
  {
    pattern: /\b(react|nextjs|typescript|javascript|api|backend|frontend|css|html)\b/i,
    domain: 'software-engineering',
  },
  { pattern: /\b(roi|revenue|profit|market|startup|business\s+model)\b/i, domain: 'business' },
  { pattern: /\b(stock|invest|portfolio|dividend|crypto|bitcoin)\b/i, domain: 'finance' },
  { pattern: /\b(scripture|bible|prayer|faith|church|sermon)\b/i, domain: 'theology' },
  { pattern: /\b(machine\s+learning|neural|model\s+training|llm|ai\s+agent)\b/i, domain: 'ai-ml' },
];

/**
 * Detect style preferences from a user message.
 * Returns an array of detected signals.
 */
export function detectPreferences(
  userMessage: string
): Array<{ type: PreferenceType; value: string }> {
  const detected: Array<{ type: PreferenceType; value: string }> = [];

  // Check style signals
  for (const signal of STYLE_SIGNALS) {
    if (signal.pattern.test(userMessage)) {
      detected.push({ type: signal.type, value: signal.value });
    }
  }

  // Check domain patterns
  for (const dp of DOMAIN_PATTERNS) {
    if (dp.pattern.test(userMessage)) {
      detected.push({ type: 'domain_expertise', value: dp.domain });
    }
  }

  return detected;
}

// ========================================
// PREFERENCE PERSISTENCE
// ========================================

/**
 * Record an observed preference. Upserts with increasing confidence.
 *
 * Confidence formula:
 * - First observation: 0.40
 * - Each additional: min(0.95, current + 0.05)
 *
 * @param userId - User ID
 * @param type - Preference type
 * @param value - Preference value
 */
export async function recordPreference(
  userId: string,
  type: PreferenceType,
  value: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    // Try to find existing preference
    const { data: existing } = await supabase
      .from('user_learning')
      .select('id, confidence, observation_count')
      .eq('user_id', userId)
      .eq('preference_type', type)
      .eq('preference_value', value)
      .maybeSingle();

    if (existing) {
      // Update with increased confidence
      const newConfidence = Math.min(0.95, existing.confidence + 0.05);
      await supabase
        .from('user_learning')
        .update({
          confidence: newConfidence,
          observation_count: existing.observation_count + 1,
        })
        .eq('id', existing.id);
    } else {
      // Insert new preference
      await supabase.from('user_learning').insert({
        user_id: userId,
        preference_type: type,
        preference_value: value,
        confidence: 0.4,
        observation_count: 1,
      });
    }
  } catch (error) {
    log.warn('Failed to record preference', { userId, type, value, error });
  }
}

/**
 * Process a conversation turn and record any detected preferences.
 * Designed to be called async (fire-and-forget) after each user message.
 *
 * @param userId - User ID
 * @param userMessage - The user's message text
 */
export async function observeAndLearn(userId: string, userMessage: string): Promise<void> {
  try {
    const detected = detectPreferences(userMessage);

    if (detected.length === 0) return;

    // Record all detected preferences in parallel
    await Promise.all(detected.map((pref) => recordPreference(userId, pref.type, pref.value)));

    log.debug('Learned from user message', {
      userId,
      preferences: detected.length,
    });
  } catch (error) {
    // Never block the main flow
    log.warn('Error in observeAndLearn', { error });
  }
}

// ========================================
// PREFERENCE RETRIEVAL
// ========================================

/**
 * Load user's learned preferences with confidence above threshold.
 *
 * @param userId - User ID
 * @param minConfidence - Minimum confidence threshold (default 0.5)
 * @returns Array of learned preferences
 */
export async function loadPreferences(
  userId: string,
  minConfidence = 0.5
): Promise<LearnedPreference[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('user_learning')
      .select('*')
      .eq('user_id', userId)
      .gte('confidence', minConfidence)
      .order('confidence', { ascending: false })
      .limit(20);

    if (error) {
      log.warn('Failed to load preferences', { error });
      return [];
    }

    return (data || []) as LearnedPreference[];
  } catch (error) {
    log.warn('Error loading preferences', { error });
    return [];
  }
}

/**
 * Format learned preferences for system prompt injection.
 * Only includes high-confidence preferences (>= 0.5).
 *
 * @param userId - User ID
 * @returns Learning context with formatted string
 */
export async function getLearningContext(userId: string): Promise<LearningContext> {
  try {
    const preferences = await loadPreferences(userId);

    if (preferences.length === 0) {
      return { loaded: false, preferences: [], contextString: '' };
    }

    // Group by type for clean formatting
    const grouped = new Map<PreferenceType, string[]>();
    for (const pref of preferences) {
      const existing = grouped.get(pref.preference_type) || [];
      existing.push(pref.preference_value);
      grouped.set(pref.preference_type, existing);
    }

    const lines: string[] = [];
    lines.push('<learned_user_style>');
    lines.push("The following style preferences were learned from this user's past behavior.");
    lines.push('Apply these naturally without mentioning them explicitly.');
    lines.push('');

    const typeLabels: Record<PreferenceType, string> = {
      format_style: 'Preferred format',
      response_length: 'Response length',
      communication_tone: 'Communication tone',
      domain_expertise: 'Domain expertise',
      topic_interest: 'Topics of interest',
      output_preference: 'Output style',
    };

    for (const [type, values] of grouped) {
      const label = typeLabels[type] || type;
      lines.push(`${label}: ${values.join(', ')}`);
    }

    lines.push('</learned_user_style>');

    return {
      loaded: true,
      preferences,
      contextString: lines.join('\n'),
    };
  } catch (error) {
    log.warn('Error getting learning context', { error });
    return { loaded: false, preferences: [], contextString: '' };
  }
}

/**
 * Delete all learned preferences for a user (GDPR compliance).
 *
 * @param userId - User ID
 * @returns Success status
 */
export async function deleteUserLearning(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('user_learning').delete().eq('user_id', userId);

    if (error) {
      log.error('Failed to delete user learning', { error });
      return false;
    }

    log.info('Deleted user learning data', { userId });
    return true;
  } catch (error) {
    log.error('Error deleting user learning', { error });
    return false;
  }
}
