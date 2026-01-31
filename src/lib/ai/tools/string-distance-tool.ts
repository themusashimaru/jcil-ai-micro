/**
 * STRING DISTANCE / FUZZY MATCHING TOOL
 *
 * String similarity and distance calculations using fastest-levenshtein.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Levenshtein distance
 * - Fuzzy string matching
 * - Closest match finding
 * - Similarity scoring
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let levenshtein: any = null;

async function initLevenshtein(): Promise<boolean> {
  if (levenshtein) return true;
  try {
    levenshtein = await import('fastest-levenshtein');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const stringDistanceTool: UnifiedTool = {
  name: 'string_distance',
  description: `Calculate string distance and similarity for fuzzy matching.

Operations:
- distance: Levenshtein edit distance between two strings
- similarity: Similarity score (0-1) between two strings
- closest: Find closest match from a list
- rank: Rank candidates by similarity to a query
- batch: Calculate distances for multiple pairs

Use cases:
- Spell checking / correction
- Fuzzy search
- Deduplication
- Name matching
- Autocomplete suggestions`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['distance', 'similarity', 'closest', 'rank', 'batch'],
        description: 'String distance operation',
      },
      string1: {
        type: 'string',
        description: 'First string / query string',
      },
      string2: {
        type: 'string',
        description: 'Second string for comparison',
      },
      candidates: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of candidate strings for closest/rank operations',
      },
      pairs: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of {a, b} pairs for batch comparison',
      },
      threshold: {
        type: 'number',
        description: 'Minimum similarity threshold (0-1) for filtering results',
      },
      top_n: {
        type: 'number',
        description: 'Number of top results to return (default: 10)',
      },
      case_sensitive: {
        type: 'boolean',
        description: 'Whether to use case-sensitive comparison (default: false)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isStringDistanceAvailable(): boolean {
  return true;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateSimilarity(s1: string, s2: string, distance: number): number {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  return 1 - distance / maxLen;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeStringDistance(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    string1?: string;
    string2?: string;
    candidates?: string[];
    pairs?: Array<{ a: string; b: string }>;
    threshold?: number;
    top_n?: number;
    case_sensitive?: boolean;
  };

  const { operation, threshold = 0, top_n = 10, case_sensitive = false } = args;

  try {
    const initialized = await initLevenshtein();
    if (!initialized) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'Failed to initialize levenshtein library' }),
        isError: true,
      };
    }

    // Normalize strings if case-insensitive
    const normalize = (s: string): string => (case_sensitive ? s : s.toLowerCase());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'distance': {
        const { string1, string2 } = args;
        if (!string1 || !string2) {
          throw new Error('string1 and string2 required');
        }

        const s1 = normalize(string1);
        const s2 = normalize(string2);
        const distance = levenshtein.distance(s1, s2);

        result = {
          operation: 'distance',
          string1,
          string2,
          distance,
          similarity: calculateSimilarity(s1, s2, distance),
          operations_needed: distance,
          interpretation:
            distance === 0
              ? 'Exact match'
              : distance <= 2
                ? 'Very similar'
                : distance <= 5
                  ? 'Somewhat similar'
                  : 'Different',
        };
        break;
      }

      case 'similarity': {
        const { string1, string2 } = args;
        if (!string1 || !string2) {
          throw new Error('string1 and string2 required');
        }

        const s1 = normalize(string1);
        const s2 = normalize(string2);
        const distance = levenshtein.distance(s1, s2);
        const similarity = calculateSimilarity(s1, s2, distance);

        result = {
          operation: 'similarity',
          string1,
          string2,
          similarity,
          similarity_percent: (similarity * 100).toFixed(1) + '%',
          distance,
          is_match: similarity >= (threshold || 0.8),
        };
        break;
      }

      case 'closest': {
        const { string1, candidates } = args;
        if (!string1 || !candidates || candidates.length === 0) {
          throw new Error('string1 and candidates required');
        }

        const query = normalize(string1);
        const closest = levenshtein.closest(query, candidates.map(normalize));
        const closestOriginal = candidates[candidates.map(normalize).indexOf(closest)];
        const distance = levenshtein.distance(query, closest);

        result = {
          operation: 'closest',
          query: string1,
          candidates_count: candidates.length,
          closest_match: closestOriginal,
          distance,
          similarity: calculateSimilarity(query, closest, distance),
        };
        break;
      }

      case 'rank': {
        const { string1, candidates } = args;
        if (!string1 || !candidates || candidates.length === 0) {
          throw new Error('string1 and candidates required');
        }

        const query = normalize(string1);
        const ranked = candidates
          .map((c) => {
            const normalized = normalize(c);
            const distance = levenshtein.distance(query, normalized);
            const similarity = calculateSimilarity(query, normalized, distance);
            return { original: c, distance, similarity };
          })
          .filter((r) => r.similarity >= threshold)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, top_n);

        result = {
          operation: 'rank',
          query: string1,
          candidates_count: candidates.length,
          threshold,
          matches_found: ranked.length,
          ranked_matches: ranked.map((r, i) => ({
            rank: i + 1,
            match: r.original,
            distance: r.distance,
            similarity: r.similarity,
            similarity_percent: (r.similarity * 100).toFixed(1) + '%',
          })),
        };
        break;
      }

      case 'batch': {
        const { pairs } = args;
        if (!pairs || pairs.length === 0) {
          throw new Error('pairs array required');
        }

        const results = pairs.map((pair, i) => {
          const s1 = normalize(pair.a);
          const s2 = normalize(pair.b);
          const distance = levenshtein.distance(s1, s2);
          return {
            index: i,
            string1: pair.a,
            string2: pair.b,
            distance,
            similarity: calculateSimilarity(s1, s2, distance),
          };
        });

        const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;

        result = {
          operation: 'batch',
          pairs_count: pairs.length,
          average_similarity: avgSimilarity,
          results: results.slice(0, 50), // Limit output
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}
