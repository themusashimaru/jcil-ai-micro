/**
 * LEXER-GENERATOR TOOL
 * Complete lexical analyzer generator
 *
 * This implementation provides:
 * - Token specification via regex patterns
 * - DFA-based tokenization
 * - Multiple lexer modes
 * - Token priority handling
 * - Error recovery
 * - Predefined language lexers (JSON, arithmetic, basic programming)
 *
 * Applications:
 * - Language implementation
 * - Syntax highlighting
 * - Data parsing
 * - Domain-specific languages
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TOKEN DEFINITIONS
// ============================================================================

interface TokenSpec {
  name: string;
  pattern: string | RegExp;
  priority?: number;
  skip?: boolean; // Skip this token (e.g., whitespace)
  value?: (match: string) => unknown; // Transform the matched value
  push?: string; // Push a new mode
  pop?: boolean; // Pop to previous mode
}

interface Token {
  type: string;
  value: string;
  transformed?: unknown;
  line: number;
  column: number;
  start: number;
  end: number;
}

interface LexerError {
  message: string;
  line: number;
  column: number;
  position: number;
  char: string;
}

// ============================================================================
// LEXER CLASS
// ============================================================================

class Lexer {
  private specs: Map<string, TokenSpec[]>;
  private currentMode: string;
  private modeStack: string[];

  constructor(specs: TokenSpec[] | Record<string, TokenSpec[]>) {
    this.modeStack = [];

    if (Array.isArray(specs)) {
      this.specs = new Map([['main', specs]]);
    } else {
      this.specs = new Map(Object.entries(specs));
    }

    this.currentMode = 'main';
  }

  tokenize(input: string): { tokens: Token[]; errors: LexerError[] } {
    const tokens: Token[] = [];
    const errors: LexerError[] = [];

    let pos = 0;
    let line = 1;
    let column = 1;

    this.currentMode = 'main';
    this.modeStack = [];

    while (pos < input.length) {
      const modeSpecs = this.specs.get(this.currentMode);
      if (!modeSpecs) {
        errors.push({
          message: `Unknown lexer mode: ${this.currentMode}`,
          line,
          column,
          position: pos,
          char: input[pos],
        });
        break;
      }

      let matched = false;
      let bestMatch: { spec: TokenSpec; match: RegExpExecArray } | null = null;
      let bestPriority = -Infinity;

      // Try all specs and find best match
      for (const spec of modeSpecs) {
        const pattern =
          typeof spec.pattern === 'string'
            ? new RegExp(`^${spec.pattern}`)
            : new RegExp(`^${spec.pattern.source}`, spec.pattern.flags.replace('g', ''));

        const match = pattern.exec(input.slice(pos));

        if (match && match[0].length > 0) {
          const priority = spec.priority ?? 0;

          // Prefer longer matches, then higher priority
          if (
            !bestMatch ||
            match[0].length > bestMatch.match[0].length ||
            (match[0].length === bestMatch.match[0].length && priority > bestPriority)
          ) {
            bestMatch = { spec, match };
            bestPriority = priority;
          }
        }
      }

      if (bestMatch) {
        const { spec, match } = bestMatch;
        const matchedText = match[0];

        if (!spec.skip) {
          const token: Token = {
            type: spec.name,
            value: matchedText,
            line,
            column,
            start: pos,
            end: pos + matchedText.length,
          };

          if (spec.value) {
            token.transformed = spec.value(matchedText);
          }

          tokens.push(token);
        }

        // Handle mode changes
        if (spec.push) {
          this.modeStack.push(this.currentMode);
          this.currentMode = spec.push;
        }
        if (spec.pop && this.modeStack.length > 0) {
          this.currentMode = this.modeStack.pop()!;
        }

        // Update position
        for (const char of matchedText) {
          if (char === '\n') {
            line++;
            column = 1;
          } else {
            column++;
          }
          pos++;
        }

        matched = true;
      }

      if (!matched) {
        errors.push({
          message: `Unexpected character '${input[pos]}'`,
          line,
          column,
          position: pos,
          char: input[pos],
        });

        // Skip the problematic character
        if (input[pos] === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
        pos++;
      }
    }

    return { tokens, errors };
  }
}

// ============================================================================
// PREDEFINED LEXER SPECIFICATIONS
// ============================================================================

const PREDEFINED_LEXERS: Record<string, TokenSpec[]> = {
  // JSON lexer
  json: [
    { name: 'WHITESPACE', pattern: /\s+/, skip: true },
    { name: 'STRING', pattern: /"(?:[^"\\]|\\.)*"/, value: (s) => JSON.parse(s) },
    {
      name: 'NUMBER',
      pattern: /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
      value: (s) => parseFloat(s),
    },
    { name: 'TRUE', pattern: /true/, value: () => true },
    { name: 'FALSE', pattern: /false/, value: () => false },
    { name: 'NULL', pattern: /null/, value: () => null },
    { name: 'LBRACE', pattern: /\{/ },
    { name: 'RBRACE', pattern: /\}/ },
    { name: 'LBRACKET', pattern: /\[/ },
    { name: 'RBRACKET', pattern: /\]/ },
    { name: 'COLON', pattern: /:/ },
    { name: 'COMMA', pattern: /,/ },
  ],

  // Arithmetic expression lexer
  arithmetic: [
    { name: 'WHITESPACE', pattern: /\s+/, skip: true },
    { name: 'NUMBER', pattern: /\d+(?:\.\d+)?/, value: (s) => parseFloat(s) },
    { name: 'PLUS', pattern: /\+/ },
    { name: 'MINUS', pattern: /-/ },
    { name: 'MULTIPLY', pattern: /\*/ },
    { name: 'DIVIDE', pattern: /\// },
    { name: 'POWER', pattern: /\^|\*\*/ },
    { name: 'MODULO', pattern: /%/ },
    { name: 'LPAREN', pattern: /\(/ },
    { name: 'RPAREN', pattern: /\)/ },
    { name: 'IDENTIFIER', pattern: /[a-zA-Z_][a-zA-Z0-9_]*/ },
  ],

  // Basic programming language lexer
  programming: [
    { name: 'COMMENT', pattern: /\/\/[^\n]*/, skip: true },
    { name: 'MULTILINE_COMMENT', pattern: /\/\*[\s\S]*?\*\//, skip: true },
    { name: 'WHITESPACE', pattern: /\s+/, skip: true },

    // Keywords
    { name: 'IF', pattern: /\bif\b/, priority: 10 },
    { name: 'ELSE', pattern: /\belse\b/, priority: 10 },
    { name: 'WHILE', pattern: /\bwhile\b/, priority: 10 },
    { name: 'FOR', pattern: /\bfor\b/, priority: 10 },
    { name: 'FUNCTION', pattern: /\b(?:function|fn|def)\b/, priority: 10 },
    { name: 'RETURN', pattern: /\breturn\b/, priority: 10 },
    { name: 'LET', pattern: /\b(?:let|var|const)\b/, priority: 10 },
    { name: 'TRUE', pattern: /\btrue\b/, priority: 10, value: () => true },
    { name: 'FALSE', pattern: /\bfalse\b/, priority: 10, value: () => false },
    { name: 'NULL', pattern: /\b(?:null|nil|none)\b/, priority: 10, value: () => null },

    // Literals
    {
      name: 'STRING',
      pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,
      value: (s) => s.slice(1, -1),
    },
    { name: 'NUMBER', pattern: /\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, value: (s) => parseFloat(s) },
    { name: 'HEX', pattern: /0x[0-9a-fA-F]+/, value: (s) => parseInt(s, 16) },

    // Identifiers
    { name: 'IDENTIFIER', pattern: /[a-zA-Z_][a-zA-Z0-9_]*/ },

    // Operators
    { name: 'ARROW', pattern: /=>/ },
    { name: 'EQ', pattern: /===?/ },
    { name: 'NE', pattern: /!==?/ },
    { name: 'LE', pattern: /<=/ },
    { name: 'GE', pattern: />=/ },
    { name: 'LT', pattern: /</ },
    { name: 'GT', pattern: />/ },
    { name: 'AND', pattern: /&&/ },
    { name: 'OR', pattern: /\|\|/ },
    { name: 'NOT', pattern: /!/ },
    { name: 'ASSIGN', pattern: /=/ },
    { name: 'PLUS_ASSIGN', pattern: /\+=/ },
    { name: 'MINUS_ASSIGN', pattern: /-=/ },
    { name: 'PLUS', pattern: /\+/ },
    { name: 'MINUS', pattern: /-/ },
    { name: 'MULTIPLY', pattern: /\*/ },
    { name: 'DIVIDE', pattern: /\// },
    { name: 'MODULO', pattern: /%/ },

    // Punctuation
    { name: 'LPAREN', pattern: /\(/ },
    { name: 'RPAREN', pattern: /\)/ },
    { name: 'LBRACE', pattern: /\{/ },
    { name: 'RBRACE', pattern: /\}/ },
    { name: 'LBRACKET', pattern: /\[/ },
    { name: 'RBRACKET', pattern: /\]/ },
    { name: 'SEMICOLON', pattern: /;/ },
    { name: 'COMMA', pattern: /,/ },
    { name: 'DOT', pattern: /\./ },
    { name: 'COLON', pattern: /:/ },
  ],

  // SQL lexer (simplified)
  sql: [
    { name: 'WHITESPACE', pattern: /\s+/, skip: true },
    { name: 'COMMENT', pattern: /--[^\n]*/, skip: true },

    // Keywords (case-insensitive via pattern)
    { name: 'SELECT', pattern: /\bSELECT\b/i, priority: 10 },
    { name: 'FROM', pattern: /\bFROM\b/i, priority: 10 },
    { name: 'WHERE', pattern: /\bWHERE\b/i, priority: 10 },
    { name: 'AND', pattern: /\bAND\b/i, priority: 10 },
    { name: 'OR', pattern: /\bOR\b/i, priority: 10 },
    { name: 'NOT', pattern: /\bNOT\b/i, priority: 10 },
    { name: 'INSERT', pattern: /\bINSERT\b/i, priority: 10 },
    { name: 'INTO', pattern: /\bINTO\b/i, priority: 10 },
    { name: 'VALUES', pattern: /\bVALUES\b/i, priority: 10 },
    { name: 'UPDATE', pattern: /\bUPDATE\b/i, priority: 10 },
    { name: 'SET', pattern: /\bSET\b/i, priority: 10 },
    { name: 'DELETE', pattern: /\bDELETE\b/i, priority: 10 },
    { name: 'CREATE', pattern: /\bCREATE\b/i, priority: 10 },
    { name: 'TABLE', pattern: /\bTABLE\b/i, priority: 10 },
    { name: 'JOIN', pattern: /\bJOIN\b/i, priority: 10 },
    { name: 'ON', pattern: /\bON\b/i, priority: 10 },
    { name: 'AS', pattern: /\bAS\b/i, priority: 10 },
    { name: 'ORDER', pattern: /\bORDER\b/i, priority: 10 },
    { name: 'BY', pattern: /\bBY\b/i, priority: 10 },
    { name: 'GROUP', pattern: /\bGROUP\b/i, priority: 10 },
    { name: 'HAVING', pattern: /\bHAVING\b/i, priority: 10 },
    { name: 'LIMIT', pattern: /\bLIMIT\b/i, priority: 10 },
    { name: 'NULL', pattern: /\bNULL\b/i, priority: 10 },

    // Literals
    { name: 'STRING', pattern: /'(?:[^'\\]|\\.)*'/, value: (s) => s.slice(1, -1) },
    { name: 'NUMBER', pattern: /\d+(?:\.\d+)?/, value: (s) => parseFloat(s) },

    // Identifier
    { name: 'IDENTIFIER', pattern: /[a-zA-Z_][a-zA-Z0-9_]*/ },
    { name: 'QUOTED_IDENTIFIER', pattern: /"[^"]*"|`[^`]*`/, value: (s) => s.slice(1, -1) },

    // Operators
    { name: 'EQ', pattern: /=/ },
    { name: 'NE', pattern: /<>|!=/ },
    { name: 'LE', pattern: /<=/ },
    { name: 'GE', pattern: />=/ },
    { name: 'LT', pattern: /</ },
    { name: 'GT', pattern: />/ },
    { name: 'STAR', pattern: /\*/ },

    // Punctuation
    { name: 'LPAREN', pattern: /\(/ },
    { name: 'RPAREN', pattern: /\)/ },
    { name: 'COMMA', pattern: /,/ },
    { name: 'SEMICOLON', pattern: /;/ },
    { name: 'DOT', pattern: /\./ },
  ],

  // Markdown lexer (simplified)
  markdown: [
    { name: 'HEADING', pattern: /^#{1,6}\s+[^\n]+/m },
    { name: 'CODE_BLOCK', pattern: /```[\s\S]*?```/ },
    { name: 'INLINE_CODE', pattern: /`[^`]+`/ },
    { name: 'BOLD', pattern: /\*\*[^*]+\*\*|__[^_]+__/ },
    { name: 'ITALIC', pattern: /\*[^*]+\*|_[^_]+_/ },
    { name: 'LINK', pattern: /\[[^\]]+\]\([^)]+\)/ },
    { name: 'IMAGE', pattern: /!\[[^\]]*\]\([^)]+\)/ },
    { name: 'LIST_ITEM', pattern: /^[\s]*[-*+]\s+/m },
    { name: 'NUMBERED_ITEM', pattern: /^[\s]*\d+\.\s+/m },
    { name: 'BLOCKQUOTE', pattern: /^>\s+[^\n]*/m },
    { name: 'HORIZONTAL_RULE', pattern: /^[-*_]{3,}$/m },
    { name: 'NEWLINE', pattern: /\n/ },
    { name: 'TEXT', pattern: /[^\n*_`#\[\]!>-]+/ },
  ],
};

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

function validateTokenSpec(spec: TokenSpec): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!spec.name || typeof spec.name !== 'string') {
    errors.push('Token spec must have a string name');
  }

  if (!spec.pattern) {
    errors.push('Token spec must have a pattern');
  } else {
    try {
      if (typeof spec.pattern === 'string') {
        new RegExp(spec.pattern);
      }
    } catch (e) {
      errors.push(`Invalid regex pattern: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function generateTokenStats(tokens: Token[]): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const token of tokens) {
    stats[token.type] = (stats[token.type] || 0) + 1;
  }
  return stats;
}

// ============================================================================
// TOOL INTERFACE
// ============================================================================

export const lexergeneratorTool: UnifiedTool = {
  name: 'lexer_generator',
  description: 'Generate and run lexical analyzers for tokenizing text',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['generate', 'tokenize', 'validate_spec', 'list_predefined', 'info'],
        description: 'Operation to perform',
      },
      input: {
        type: 'string',
        description: 'Input text to tokenize',
      },
      language: {
        type: 'string',
        enum: ['json', 'arithmetic', 'programming', 'sql', 'markdown', 'custom'],
        description: 'Predefined language lexer to use',
      },
      specs: {
        type: 'array',
        items: { type: 'object' },
        description:
          'Custom token specifications. Each spec has: name (string), pattern (string regex), skip (boolean, optional), priority (number, optional)',
      },
    },
    required: ['operation'],
  },
};

export async function executelexergenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, input, language = 'programming', specs: customSpecs } = args;

    // Info operation
    if (operation === 'info') {
      const info = {
        name: 'Lexer Generator Tool',
        description: 'Generate lexical analyzers for tokenizing text',
        operations: {
          generate: 'Generate a lexer from token specifications',
          tokenize: 'Tokenize input text using a lexer',
          validate_spec: 'Validate token specifications',
          list_predefined: 'List available predefined lexers',
        },
        predefinedLexers: Object.keys(PREDEFINED_LEXERS),
        tokenSpecFormat: {
          name: 'Token type name (e.g., IDENTIFIER, NUMBER)',
          pattern: 'Regex pattern to match (string or RegExp)',
          skip: 'If true, token is matched but not emitted',
          priority: 'Higher priority specs are preferred for ties',
          value: 'Optional transformation function',
        },
        examples: {
          tokenize: {
            operation: 'tokenize',
            language: 'arithmetic',
            input: '2 + 3 * (4 - 1)',
          },
          customLexer: {
            operation: 'tokenize',
            language: 'custom',
            specs: [
              { name: 'WORD', pattern: '\\w+' },
              { name: 'SPACE', pattern: '\\s+', skip: true },
            ],
            input: 'hello world',
          },
        },
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // List predefined lexers
    if (operation === 'list_predefined') {
      const lexers = Object.entries(PREDEFINED_LEXERS).map(([name, specs]) => ({
        name,
        tokenCount: specs.length,
        tokens: specs.map((s) => s.name),
      }));

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'list_predefined',
            lexers,
          },
          null,
          2
        ),
      };
    }

    // Validate specs
    if (operation === 'validate_spec') {
      if (!customSpecs || !Array.isArray(customSpecs)) {
        return {
          toolCallId: id,
          content: 'Error: specs array required for validate_spec',
          isError: true,
        };
      }

      const validations = customSpecs.map((spec, i) => ({
        index: i,
        spec: { name: spec.name, pattern: spec.pattern },
        ...validateTokenSpec(spec),
      }));

      const allValid = validations.every((v) => v.valid);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'validate_spec',
            valid: allValid,
            specCount: customSpecs.length,
            validations,
          },
          null,
          2
        ),
      };
    }

    // Generate lexer (just return the specs)
    if (operation === 'generate') {
      const specs =
        language === 'custom'
          ? customSpecs
          : PREDEFINED_LEXERS[language] || PREDEFINED_LEXERS.programming;

      const specSummary = (Array.isArray(specs) ? specs : []).map((s) => ({
        name: s.name,
        pattern: typeof s.pattern === 'string' ? s.pattern : s.pattern.source,
        skip: s.skip || false,
        priority: s.priority || 0,
      }));

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'generate',
            language: language === 'custom' ? 'custom' : language,
            specs: specSummary,
            tokenCount: specSummary.length,
          },
          null,
          2
        ),
      };
    }

    // Tokenize
    if (operation === 'tokenize') {
      if (!input) {
        return {
          toolCallId: id,
          content: 'Error: input text required for tokenize',
          isError: true,
        };
      }

      let specs: TokenSpec[];
      if (language === 'custom' && customSpecs) {
        specs = customSpecs.map((s: TokenSpec) => ({
          ...s,
          pattern: typeof s.pattern === 'string' ? new RegExp(s.pattern) : s.pattern,
        }));
      } else {
        specs = PREDEFINED_LEXERS[language] || PREDEFINED_LEXERS.programming;
      }

      const lexer = new Lexer(specs);
      const { tokens, errors } = lexer.tokenize(input);

      const stats = generateTokenStats(tokens);

      const result = {
        operation: 'tokenize',
        language: language === 'custom' ? 'custom' : language,
        input: {
          text: input.slice(0, 100) + (input.length > 100 ? '...' : ''),
          length: input.length,
        },
        output: {
          tokens: tokens.slice(0, 50).map((t) => ({
            type: t.type,
            value: t.value.length > 30 ? t.value.slice(0, 30) + '...' : t.value,
            ...(t.transformed !== undefined ? { transformed: t.transformed } : {}),
            line: t.line,
            column: t.column,
          })),
          tokenCount: tokens.length,
          ...(tokens.length > 50 ? { truncated: true } : {}),
        },
        stats: {
          byType: stats,
          uniqueTypes: Object.keys(stats).length,
        },
        ...(errors.length > 0
          ? {
              errors: errors.slice(0, 10),
              errorCount: errors.length,
            }
          : { errors: [], errorCount: 0 }),
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    return { toolCallId: id, content: `Error: Unknown operation '${operation}'`, isError: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function islexergeneratorAvailable(): boolean {
  return true;
}
