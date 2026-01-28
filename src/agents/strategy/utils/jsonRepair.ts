/**
 * JSON REPAIR UTILITY
 *
 * Robust JSON extraction and repair for LLM outputs that may contain:
 * - Malformed JSON (trailing commas, missing quotes)
 * - Multiple JSON blocks
 * - JSON wrapped in markdown code blocks
 * - Truncated JSON
 */

import { logger } from '@/lib/logger';

const log = logger('JSONRepair');

/**
 * Extract and parse JSON from LLM response text
 * Tries multiple strategies to extract valid JSON
 */
export function extractJSON<T = unknown>(text: string, fallback?: T): T | null {
  // Strategy 1: Try to extract from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    const result = tryParseWithRepair<T>(codeBlockMatch[1]);
    if (result !== null) {
      return result;
    }
  }

  // Strategy 2: Try to find JSON object directly
  const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    const result = tryParseWithRepair<T>(jsonObjectMatch[0]);
    if (result !== null) {
      return result;
    }
  }

  // Strategy 3: Try to find JSON array directly
  const jsonArrayMatch = text.match(/\[[\s\S]*\]/);
  if (jsonArrayMatch) {
    const result = tryParseWithRepair<T>(jsonArrayMatch[0]);
    if (result !== null) {
      return result;
    }
  }

  // Strategy 4: Try the entire text
  const fullResult = tryParseWithRepair<T>(text);
  if (fullResult !== null) {
    return fullResult;
  }

  log.warn('Failed to extract JSON from response', {
    textPreview: text.slice(0, 200),
    textLength: text.length,
  });

  return fallback ?? null;
}

/**
 * Try to parse JSON with various repair strategies
 */
function tryParseWithRepair<T>(text: string): T | null {
  // Try direct parse first
  try {
    return JSON.parse(text) as T;
  } catch {
    // Continue to repair strategies
  }

  // Apply repair strategies in order of likelihood
  const repaired = repairJSON(text);
  try {
    return JSON.parse(repaired) as T;
  } catch (error) {
    log.debug('JSON repair failed', { error, textPreview: text.slice(0, 100) });
    return null;
  }
}

/**
 * Apply common JSON repair strategies
 */
function repairJSON(text: string): string {
  let json = text.trim();

  // Remove any leading/trailing non-JSON characters
  const startIdx = json.search(/[\[{]/);
  const endIdx = Math.max(json.lastIndexOf('}'), json.lastIndexOf(']'));
  if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
    json = json.slice(startIdx, endIdx + 1);
  }

  // Fix trailing commas before closing brackets (common LLM error)
  json = json.replace(/,\s*([}\]])/g, '$1');

  // Fix missing commas between array elements or object properties
  // e.g., "value1" "value2" -> "value1", "value2"
  json = json.replace(/"\s+"/g, '", "');

  // Fix unquoted property names (common in some LLM outputs)
  // e.g., {name: "value"} -> {"name": "value"}
  json = json.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // Fix single quotes used instead of double quotes
  // Be careful not to change quotes inside strings
  json = replaceSingleQuotes(json);

  // Fix unclosed strings at the end (truncated output)
  const openQuotes = (json.match(/"/g) || []).length;
  if (openQuotes % 2 !== 0) {
    json += '"';
  }

  // Fix unclosed brackets (truncated output)
  const openBraces = (json.match(/{/g) || []).length;
  const closeBraces = (json.match(/}/g) || []).length;
  for (let i = 0; i < openBraces - closeBraces; i++) {
    json += '}';
  }

  const openBrackets = (json.match(/\[/g) || []).length;
  const closeBrackets = (json.match(/]/g) || []).length;
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    json += ']';
  }

  // Remove JavaScript-style comments
  json = json.replace(/\/\/[^\n]*\n/g, '\n');
  json = json.replace(/\/\*[\s\S]*?\*\//g, '');

  // Fix "undefined" and "NaN" values (not valid JSON)
  json = json.replace(/:\s*undefined\s*([,}\]])/g, ': null$1');
  json = json.replace(/:\s*NaN\s*([,}\]])/g, ': null$1');

  return json;
}

/**
 * Replace single quotes with double quotes, but not inside already double-quoted strings
 */
function replaceSingleQuotes(text: string): string {
  let result = '';
  let inDoubleQuote = false;
  let inSingleQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';

    if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      result += char;
    } else if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
      // Replace single quote with double quote
      if (inSingleQuote) {
        inSingleQuote = false;
        result += '"';
      } else {
        inSingleQuote = true;
        result += '"';
      }
    } else {
      result += char;
    }
  }

  return result;
}

/**
 * Extract multiple JSON objects from text (for cases where LLM outputs multiple)
 */
export function extractAllJSON<T = unknown>(text: string): T[] {
  const results: T[] = [];

  // Find all code blocks
  const codeBlocks = text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/g);
  for (const match of codeBlocks) {
    const result = tryParseWithRepair<T>(match[1]);
    if (result !== null) {
      results.push(result);
    }
  }

  // If we found JSON in code blocks, return those
  if (results.length > 0) {
    return results;
  }

  // Otherwise, try to find inline JSON objects
  const jsonMatches = text.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
  for (const match of jsonMatches) {
    const result = tryParseWithRepair<T>(match[0]);
    if (result !== null) {
      results.push(result);
    }
  }

  return results;
}
