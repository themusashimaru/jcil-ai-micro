/**
 * PASSWORD STRENGTH TOOL
 *
 * Password strength analysis using Dropbox's zxcvbn library.
 * The most realistic password strength estimator available.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Realistic strength scoring (0-4)
 * - Crack time estimation
 * - Pattern detection (dictionary, keyboard, dates, etc.)
 * - Specific feedback and suggestions
 * - Entropy calculation
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let zxcvbn: any = null;

async function initZxcvbn(): Promise<boolean> {
  if (zxcvbn) return true;
  try {
    const mod = await import('zxcvbn');
    zxcvbn = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const passwordStrengthTool: UnifiedTool = {
  name: 'analyze_password',
  description: `Analyze password strength using Dropbox's zxcvbn algorithm.

This tool provides:
- Realistic strength score (0-4)
- Estimated crack times (online/offline attacks)
- Pattern detection (dictionary words, keyboard patterns, dates, etc.)
- Specific feedback and improvement suggestions
- Entropy calculation

Score meanings:
- 0: Too guessable (risky password)
- 1: Very guessable (protection from throttled attacks)
- 2: Somewhat guessable (protection from unthrottled attacks)
- 3: Safely unguessable (moderate protection from offline attacks)
- 4: Very unguessable (strong protection from offline attacks)

User inputs (like username, email) can be provided to detect if password contains personal info.

Use cases:
- Registration form validation
- Password policy enforcement
- Security audits
- User education on password strength`,
  parameters: {
    type: 'object',
    properties: {
      password: {
        type: 'string',
        description: 'The password to analyze',
      },
      user_inputs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional user-specific strings to check against (username, email, name)',
      },
    },
    required: ['password'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isPasswordStrengthAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executePasswordStrength(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const args =
    typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;

  const { password, user_inputs = [] } = args;

  if (!password) {
    return {
      toolCallId: toolCall.id,
      content: 'Password is required for analysis',
      isError: true,
    };
  }

  // Initialize library
  const initialized = await initZxcvbn();
  if (!initialized) {
    return {
      toolCallId: toolCall.id,
      content: 'Password analysis library failed to load. Please try again.',
      isError: true,
    };
  }

  try {
    // Analyze the password
    const result = zxcvbn(password, user_inputs);

    // Format crack time estimates
    const crackTimes = {
      onlineThrottled: {
        seconds: result.crack_times_seconds.online_throttling_100_per_hour,
        display: result.crack_times_display.online_throttling_100_per_hour,
        description: 'Online attack with rate limiting (100 attempts/hour)',
      },
      onlineNoThrottling: {
        seconds: result.crack_times_seconds.online_no_throttling_10_per_second,
        display: result.crack_times_display.online_no_throttling_10_per_second,
        description: 'Online attack without throttling (10 attempts/second)',
      },
      offlineSlow: {
        seconds: result.crack_times_seconds.offline_slow_hashing_1e4_per_second,
        display: result.crack_times_display.offline_slow_hashing_1e4_per_second,
        description: 'Offline attack with slow hashing (10k attempts/second)',
      },
      offlineFast: {
        seconds: result.crack_times_seconds.offline_fast_hashing_1e10_per_second,
        display: result.crack_times_display.offline_fast_hashing_1e10_per_second,
        description: 'Offline attack with fast hashing (10B attempts/second)',
      },
    };

    // Get strength description
    const strengthDescriptions = [
      'Too guessable - risky password',
      'Very guessable - protection from throttled online attacks only',
      'Somewhat guessable - protection from unthrottled online attacks',
      'Safely unguessable - moderate protection from offline slow-hash attacks',
      'Very unguessable - strong protection from offline fast-hash attacks',
    ];

    // Format pattern matches
    const patterns = result.sequence.map(
      (match: {
        pattern: string;
        token: string;
        dictionary_name?: string;
        reversed?: boolean;
        l33t?: boolean;
        graph?: string;
        turns?: number;
        regex_name?: string;
      }) => ({
        pattern: match.pattern,
        token: match.token.length > 20 ? match.token.slice(0, 20) + '...' : match.token,
        details: getPatternDetails(match),
      })
    );

    const output = {
      password:
        password.length > 3
          ? password[0] + '*'.repeat(password.length - 2) + password[password.length - 1]
          : '***',
      length: password.length,
      score: result.score,
      scoreDescription: strengthDescriptions[result.score],
      strengthBar: '█'.repeat(result.score + 1) + '░'.repeat(4 - result.score),
      guesses: result.guesses,
      guessesLog10: result.guesses_log10.toFixed(2),
      crackTimes,
      patterns,
      feedback: {
        warning: result.feedback.warning || null,
        suggestions: result.feedback.suggestions || [],
      },
      recommendation: getRecommendation(result.score, password.length),
      calculationTime: `${result.calc_time}ms`,
    };

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(output, null, 2),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Password analysis error: ${(error as Error).message}`,
      isError: true,
    };
  }
}

// Helper function to get pattern details
function getPatternDetails(match: {
  pattern: string;
  dictionary_name?: string;
  reversed?: boolean;
  l33t?: boolean;
  graph?: string;
  turns?: number;
  regex_name?: string;
}): string {
  switch (match.pattern) {
    case 'dictionary':
      return `Found in ${match.dictionary_name} dictionary${match.reversed ? ' (reversed)' : ''}${match.l33t ? ' (with l33t substitutions)' : ''}`;
    case 'spatial':
      return `Keyboard pattern on ${match.graph} layout (${match.turns} turns)`;
    case 'repeat':
      return 'Repeated character pattern';
    case 'sequence':
      return 'Sequential pattern (abc, 123, etc.)';
    case 'regex':
      return `Matches ${match.regex_name} pattern`;
    case 'date':
      return 'Date pattern detected';
    case 'bruteforce':
      return 'Random characters (good!)';
    default:
      return match.pattern;
  }
}

// Helper function to get recommendation
function getRecommendation(score: number, length: number): string {
  if (score >= 4) {
    return 'Excellent password! This should be very secure.';
  }
  if (score >= 3) {
    return 'Good password. Consider adding more unique characters for maximum security.';
  }
  if (score >= 2) {
    return 'Moderate password. Add length, mix cases, and avoid common patterns.';
  }
  if (length < 8) {
    return 'Password is too short. Use at least 12 characters.';
  }
  if (score === 1) {
    return 'Weak password. Avoid dictionary words and common patterns. Use a passphrase.';
  }
  return 'Very weak password. Consider using a password manager to generate a strong random password.';
}
