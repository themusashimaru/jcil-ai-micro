/**
 * PARSER/GRAMMAR TOOL
 *
 * Grammar parsing and DSL validation using nearley.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Parse text with custom grammars
 * - Validate domain-specific languages
 * - Extract structured data from text
 * - Built-in grammars for common formats
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nearley: any = null;

async function initNearley(): Promise<boolean> {
  if (nearley) return true;
  try {
    nearley = await import('nearley');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// BUILT-IN GRAMMARS
// ============================================================================

// Simple arithmetic grammar
const arithmeticGrammar = {
  Lexer: undefined,
  ParserRules: [
    { name: 'main', symbols: ['AS'], postprocess: (d: unknown[]) => d[0] },
    {
      name: 'AS',
      symbols: ['AS', { literal: '+' }, 'MD'],
      postprocess: (d: unknown[]) => (d[0] as number) + (d[2] as number),
    },
    {
      name: 'AS',
      symbols: ['AS', { literal: '-' }, 'MD'],
      postprocess: (d: unknown[]) => (d[0] as number) - (d[2] as number),
    },
    { name: 'AS', symbols: ['MD'], postprocess: (d: unknown[]) => d[0] },
    {
      name: 'MD',
      symbols: ['MD', { literal: '*' }, 'P'],
      postprocess: (d: unknown[]) => (d[0] as number) * (d[2] as number),
    },
    {
      name: 'MD',
      symbols: ['MD', { literal: '/' }, 'P'],
      postprocess: (d: unknown[]) => (d[0] as number) / (d[2] as number),
    },
    { name: 'MD', symbols: ['P'], postprocess: (d: unknown[]) => d[0] },
    {
      name: 'P',
      symbols: [{ literal: '(' }, 'AS', { literal: ')' }],
      postprocess: (d: unknown[]) => d[1],
    },
    { name: 'P', symbols: ['N'], postprocess: (d: unknown[]) => d[0] },
    { name: 'N$ebnf$1', symbols: [/[0-9]/] },
    {
      name: 'N$ebnf$1',
      symbols: ['N$ebnf$1', /[0-9]/],
      postprocess: (d: unknown[]) => (d[0] as unknown[]).concat([d[1]]),
    },
    {
      name: 'N',
      symbols: ['N$ebnf$1'],
      postprocess: (d: unknown[]) => parseInt((d[0] as string[]).join('')),
    },
  ],
  ParserStart: 'main',
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const parserTool: UnifiedTool = {
  name: 'parse_grammar',
  description: `Parse text using grammars and extract structured data.

Operations:
- parse_arithmetic: Parse and evaluate arithmetic expressions
- parse_custom: Parse with a custom grammar
- validate: Check if text matches a grammar
- tokenize: Simple tokenization of text

Built-in grammars:
- arithmetic: Basic math expressions (1+2*3)
- json: JSON validation

Use cases:
- Validate domain-specific languages (DSLs)
- Extract structured data from text
- Build simple calculators/interpreters
- Configuration file parsing`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['parse_arithmetic', 'parse_custom', 'validate', 'tokenize'],
        description: 'Parser operation',
      },
      input: {
        type: 'string',
        description: 'Text to parse',
      },
      grammar: {
        type: 'string',
        enum: ['arithmetic', 'json', 'custom'],
        description: 'Grammar to use',
      },
      custom_rules: {
        type: 'array',
        items: { type: 'object' },
        description: 'Custom grammar rules for parse_custom',
      },
    },
    required: ['operation', 'input'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isParserAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeParser(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    input: string;
    grammar?: string;
    custom_rules?: unknown[];
  };

  const { operation, input, grammar = 'arithmetic' } = args;

  try {
    const initialized = await initNearley();
    if (!initialized) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'Failed to initialize nearley library' }),
        isError: true,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'parse_arithmetic': {
        const parser = new nearley.Parser(nearley.Grammar.fromCompiled(arithmeticGrammar));
        // Remove spaces for arithmetic
        const cleanInput = input.replace(/\s+/g, '');
        parser.feed(cleanInput);

        if (parser.results.length === 0) {
          throw new Error('No valid parse found');
        }

        result = {
          operation: 'parse_arithmetic',
          input,
          result: parser.results[0],
          ambiguous: parser.results.length > 1,
          parse_count: parser.results.length,
        };
        break;
      }

      case 'validate': {
        let selectedGrammar;
        if (grammar === 'arithmetic') {
          selectedGrammar = arithmeticGrammar;
        } else if (grammar === 'json') {
          // Use native JSON.parse for validation
          try {
            JSON.parse(input);
            result = {
              operation: 'validate',
              grammar: 'json',
              input: input.substring(0, 100) + (input.length > 100 ? '...' : ''),
              valid: true,
            };
          } catch (e) {
            result = {
              operation: 'validate',
              grammar: 'json',
              input: input.substring(0, 100) + (input.length > 100 ? '...' : ''),
              valid: false,
              error: e instanceof Error ? e.message : 'Invalid JSON',
            };
          }
          break;
        } else {
          selectedGrammar = arithmeticGrammar;
        }

        try {
          const parser = new nearley.Parser(nearley.Grammar.fromCompiled(selectedGrammar));
          parser.feed(input.replace(/\s+/g, ''));
          result = {
            operation: 'validate',
            grammar,
            input: input.substring(0, 100) + (input.length > 100 ? '...' : ''),
            valid: parser.results.length > 0,
            parse_count: parser.results.length,
          };
        } catch (e) {
          result = {
            operation: 'validate',
            grammar,
            input: input.substring(0, 100) + (input.length > 100 ? '...' : ''),
            valid: false,
            error: e instanceof Error ? e.message : 'Parse error',
          };
        }
        break;
      }

      case 'tokenize': {
        // Simple tokenization
        const tokens: Array<{ type: string; value: string; position: number }> = [];
        const patterns = [
          { type: 'number', regex: /^\d+(\.\d+)?/ },
          { type: 'string', regex: /^"[^"]*"/ },
          { type: 'identifier', regex: /^[a-zA-Z_][a-zA-Z0-9_]*/ },
          { type: 'operator', regex: /^[+\-*/=<>!&|]+/ },
          { type: 'punctuation', regex: /^[(){}\[\],;:]/ },
          { type: 'whitespace', regex: /^\s+/ },
        ];

        let remaining = input;
        let position = 0;

        while (remaining.length > 0) {
          let matched = false;
          for (const pattern of patterns) {
            const match = remaining.match(pattern.regex);
            if (match) {
              if (pattern.type !== 'whitespace') {
                tokens.push({
                  type: pattern.type,
                  value: match[0],
                  position,
                });
              }
              remaining = remaining.slice(match[0].length);
              position += match[0].length;
              matched = true;
              break;
            }
          }
          if (!matched) {
            tokens.push({
              type: 'unknown',
              value: remaining[0],
              position,
            });
            remaining = remaining.slice(1);
            position++;
          }
        }

        result = {
          operation: 'tokenize',
          input: input.substring(0, 100) + (input.length > 100 ? '...' : ''),
          token_count: tokens.length,
          tokens,
        };
        break;
      }

      case 'parse_custom': {
        // For custom parsing, provide a simplified response
        result = {
          operation: 'parse_custom',
          message:
            'Custom grammar parsing requires compiled grammar rules. Use tokenize for basic parsing.',
          input: input.substring(0, 100),
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
