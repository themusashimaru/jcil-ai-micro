/**
 * REGEX BUILDER TOOL
 * Build, test, and explain regular expressions
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface RegexPart { type: string; value: string; explanation: string; }

const COMMON_PATTERNS: Record<string, { pattern: string; description: string; examples: string[] }> = {
  email: { pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', description: 'Email address', examples: ['user@example.com', 'name.last@domain.co.uk'] },
  phone_us: { pattern: '^\\(?\\d{3}\\)?[-. ]?\\d{3}[-. ]?\\d{4}$', description: 'US phone number', examples: ['(123) 456-7890', '123-456-7890', '1234567890'] },
  url: { pattern: '^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)$', description: 'URL', examples: ['https://example.com', 'http://www.test.org/path?query=1'] },
  ip_v4: { pattern: '^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$', description: 'IPv4 address', examples: ['192.168.1.1', '10.0.0.255'] },
  date_iso: { pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'ISO date (YYYY-MM-DD)', examples: ['2024-01-15', '2023-12-31'] },
  time_24h: { pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$', description: '24-hour time', examples: ['14:30', '09:05', '23:59'] },
  hex_color: { pattern: '^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$', description: 'Hex color code', examples: ['#ff5733', '#FFF', 'aabbcc'] },
  uuid: { pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', description: 'UUID', examples: ['123e4567-e89b-12d3-a456-426614174000'] },
  slug: { pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', description: 'URL slug', examples: ['my-blog-post', 'hello-world-123'] },
  username: { pattern: '^[a-zA-Z0-9_]{3,16}$', description: 'Username (3-16 chars, alphanumeric + underscore)', examples: ['john_doe', 'User123'] },
  password_strong: { pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$', description: 'Strong password', examples: ['MyP@ssw0rd!'] },
  credit_card: { pattern: '^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$', description: 'Credit card number', examples: ['4111111111111111'] },
  zip_us: { pattern: '^\\d{5}(-\\d{4})?$', description: 'US ZIP code', examples: ['12345', '12345-6789'] },
  ssn: { pattern: '^\\d{3}-\\d{2}-\\d{4}$', description: 'Social Security Number', examples: ['123-45-6789'] },
  mac_address: { pattern: '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$', description: 'MAC address', examples: ['00:1B:44:11:3A:B7'] },
  html_tag: { pattern: '<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*>(.*?)<\\/\\1>', description: 'HTML tag with content', examples: ['<div>content</div>', '<span class="x">text</span>'] },
  whitespace: { pattern: '^\\s+$', description: 'Whitespace only', examples: ['   ', '\t\n'] },
  alphanumeric: { pattern: '^[a-zA-Z0-9]+$', description: 'Alphanumeric only', examples: ['abc123', 'Test456'] },
  integer: { pattern: '^-?\\d+$', description: 'Integer', examples: ['123', '-456', '0'] },
  decimal: { pattern: '^-?\\d*\\.?\\d+$', description: 'Decimal number', examples: ['3.14', '-0.5', '42'] },
  json_string: { pattern: '"(?:[^"\\\\]|\\\\.)*"', description: 'JSON string', examples: ['"hello"', '"escaped\\"quote"'] }
};

function explainRegex(pattern: string): RegexPart[] {
  const parts: RegexPart[] = [];
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];

    if (char === '^') {
      parts.push({ type: 'anchor', value: '^', explanation: 'Start of string' });
    } else if (char === '$') {
      parts.push({ type: 'anchor', value: '$', explanation: 'End of string' });
    } else if (char === '.') {
      parts.push({ type: 'metachar', value: '.', explanation: 'Any single character (except newline)' });
    } else if (char === '*') {
      parts.push({ type: 'quantifier', value: '*', explanation: 'Zero or more of the previous' });
    } else if (char === '+') {
      parts.push({ type: 'quantifier', value: '+', explanation: 'One or more of the previous' });
    } else if (char === '?') {
      parts.push({ type: 'quantifier', value: '?', explanation: 'Zero or one of the previous (optional)' });
    } else if (char === '\\') {
      i++;
      const escaped = pattern[i];
      const escapeMap: Record<string, string> = {
        'd': 'Any digit (0-9)', 'D': 'Any non-digit',
        'w': 'Any word character (a-z, A-Z, 0-9, _)', 'W': 'Any non-word character',
        's': 'Any whitespace', 'S': 'Any non-whitespace',
        'b': 'Word boundary', 'B': 'Non-word boundary',
        'n': 'Newline', 't': 'Tab', 'r': 'Carriage return'
      };
      parts.push({ type: 'escape', value: '\\' + escaped, explanation: escapeMap[escaped] || `Escaped character: ${escaped}` });
    } else if (char === '[') {
      let charClass = '[';
      i++;
      while (i < pattern.length && pattern[i] !== ']') {
        charClass += pattern[i];
        i++;
      }
      charClass += ']';
      parts.push({ type: 'charclass', value: charClass, explanation: `Character class: match any of ${charClass}` });
    } else if (char === '(') {
      let group = '(';
      let depth = 1;
      i++;
      while (i < pattern.length && depth > 0) {
        if (pattern[i] === '(') depth++;
        if (pattern[i] === ')') depth--;
        group += pattern[i];
        i++;
      }
      i--;
      const isNonCapturing = group.startsWith('(?:');
      const isLookahead = group.startsWith('(?=') || group.startsWith('(?!');
      const isLookbehind = group.startsWith('(?<=') || group.startsWith('(?<!');
      let desc = 'Capturing group';
      if (isNonCapturing) desc = 'Non-capturing group';
      if (isLookahead) desc = group.startsWith('(?=') ? 'Positive lookahead' : 'Negative lookahead';
      if (isLookbehind) desc = group.startsWith('(?<=') ? 'Positive lookbehind' : 'Negative lookbehind';
      parts.push({ type: 'group', value: group, explanation: desc });
    } else if (char === '{') {
      let quantifier = '{';
      i++;
      while (i < pattern.length && pattern[i] !== '}') {
        quantifier += pattern[i];
        i++;
      }
      quantifier += '}';
      parts.push({ type: 'quantifier', value: quantifier, explanation: `Repeat ${quantifier.slice(1, -1)} times` });
    } else if (char === '|') {
      parts.push({ type: 'alternation', value: '|', explanation: 'OR - match either side' });
    } else {
      parts.push({ type: 'literal', value: char, explanation: `Literal character: ${char}` });
    }

    i++;
  }

  return parts;
}

function testRegex(pattern: string, testStrings: string[], flags: string = ''): Array<{ input: string; matches: boolean; captures: string[] | null }> {
  try {
    const regex = new RegExp(pattern, flags);
    return testStrings.map(input => {
      const match = input.match(regex);
      return {
        input,
        matches: match !== null,
        captures: match ? match.slice(1) : null
      };
    });
  } catch {
    return testStrings.map(input => ({ input, matches: false, captures: null }));
  }
}

function buildRegex(parts: Array<{ type: string; value: string; options?: Record<string, unknown> }>): string {
  return parts.map(part => {
    switch (part.type) {
      case 'literal': return part.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      case 'digit': return '\\d';
      case 'word': return '\\w';
      case 'space': return '\\s';
      case 'any': return '.';
      case 'start': return '^';
      case 'end': return '$';
      case 'group': return `(${part.value})`;
      case 'optional': return `${part.value}?`;
      case 'oneOrMore': return `${part.value}+`;
      case 'zeroOrMore': return `${part.value}*`;
      case 'range': return `[${part.value}]`;
      case 'repeat': return `{${part.options?.min || 0},${part.options?.max || ''}}`;
      case 'or': return '|';
      default: return part.value;
    }
  }).join('');
}

export const regexBuilderTool: UnifiedTool = {
  name: 'regex_builder',
  description: 'Regex Builder: patterns, build, test, explain, validate, escape, common',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['patterns', 'build', 'test', 'explain', 'validate', 'escape', 'common'] },
      pattern: { type: 'string' },
      parts: { type: 'array' },
      testStrings: { type: 'array' },
      flags: { type: 'string' },
      text: { type: 'string' },
      patternName: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executeRegexBuilder(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'patterns':
        result = { patterns: Object.keys(COMMON_PATTERNS), catalog: COMMON_PATTERNS };
        break;
      case 'build':
        const parts = args.parts || [{ type: 'start' }, { type: 'word' }, { type: 'oneOrMore', value: '\\w' }, { type: 'end' }];
        result = { regex: buildRegex(parts), parts };
        break;
      case 'test':
        const pattern = args.pattern || '^\\d+$';
        const testStrings = args.testStrings || ['123', 'abc', '456'];
        result = { pattern, results: testRegex(pattern, testStrings, args.flags || '') };
        break;
      case 'explain':
        const explainPattern = args.pattern || '^[a-zA-Z]+@[a-z]+\\.[a-z]{2,}$';
        result = { pattern: explainPattern, explanation: explainRegex(explainPattern) };
        break;
      case 'validate':
        try {
          new RegExp(args.pattern || '');
          result = { valid: true, pattern: args.pattern };
        } catch (e) {
          result = { valid: false, error: e instanceof Error ? e.message : 'Invalid regex' };
        }
        break;
      case 'escape':
        const text = args.text || 'Hello. How are you? (I\'m fine!)';
        result = { original: text, escaped: text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
        break;
      case 'common':
        const patternName = args.patternName || 'email';
        const commonPattern = COMMON_PATTERNS[patternName];
        result = commonPattern ? { name: patternName, ...commonPattern } : { error: 'Pattern not found', available: Object.keys(COMMON_PATTERNS) };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isRegexBuilderAvailable(): boolean { return true; }
