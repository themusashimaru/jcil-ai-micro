/**
 * REFACTOR SUGGESTER TOOL
 * Automated refactoring suggestions and transformations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface RefactorSuggestion {
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  location?: string;
  before?: string;
  after?: string;
}

function detectLongFunctions(code: string): RefactorSuggestion[] {
  const suggestions: RefactorSuggestion[] = [];
  const funcPattern = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*(?:=>|{))/g;
  let match;

  while ((match = funcPattern.exec(code)) !== null) {
    const funcName = match[1] || match[2];
    const startIdx = match.index;
    let braceCount = 0;
    let started = false;
    let endIdx = startIdx;

    for (let i = startIdx; i < code.length && i < startIdx + 5000; i++) {
      if (code[i] === '{') { braceCount++; started = true; }
      if (code[i] === '}') braceCount--;
      if (started && braceCount === 0) { endIdx = i; break; }
    }

    const funcBody = code.substring(startIdx, endIdx);
    const lines = funcBody.split('\n').length;

    if (lines > 30) {
      suggestions.push({
        type: 'extract_method',
        severity: lines > 50 ? 'high' : 'medium',
        description: `Function '${funcName}' has ${lines} lines. Consider extracting smaller functions.`,
        location: `Line ~${code.substring(0, startIdx).split('\n').length}`
      });
    }
  }

  return suggestions;
}

function detectDuplicateCode(code: string): RefactorSuggestion[] {
  const suggestions: RefactorSuggestion[] = [];
  const lines = code.split('\n').map(l => l.trim()).filter(l => l.length > 20);
  const seen = new Map<string, number[]>();

  lines.forEach((line, idx) => {
    if (seen.has(line)) {
      seen.get(line)!.push(idx + 1);
    } else {
      seen.set(line, [idx + 1]);
    }
  });

  for (const [line, occurrences] of seen) {
    if (occurrences.length >= 3) {
      suggestions.push({
        type: 'extract_variable',
        severity: 'medium',
        description: `Duplicate code found ${occurrences.length} times. Consider extracting to a variable or function.`,
        location: `Lines: ${occurrences.slice(0, 5).join(', ')}`,
        before: line.substring(0, 60) + '...'
      });
    }
  }

  return suggestions;
}

function detectDeepNesting(code: string): RefactorSuggestion[] {
  const suggestions: RefactorSuggestion[] = [];
  const lines = code.split('\n');
  let maxNesting = 0;
  let currentNesting = 0;
  const deepLines: number[] = [];

  lines.forEach((line, idx) => {
    const opens = (line.match(/{/g) || []).length;
    const closes = (line.match(/}/g) || []).length;
    currentNesting += opens - closes;

    if (currentNesting > 3) {
      deepLines.push(idx + 1);
    }
    maxNesting = Math.max(maxNesting, currentNesting);
  });

  if (maxNesting > 3) {
    suggestions.push({
      type: 'reduce_nesting',
      severity: maxNesting > 5 ? 'high' : 'medium',
      description: `Maximum nesting depth of ${maxNesting}. Consider early returns, guard clauses, or extracting methods.`,
      location: `Deep nesting at lines: ${deepLines.slice(0, 5).join(', ')}`
    });
  }

  return suggestions;
}

function detectLongParameterList(code: string): RefactorSuggestion[] {
  const suggestions: RefactorSuggestion[] = [];
  const funcPattern = /(?:function\s+\w+|\w+\s*=\s*(?:async\s*)?)\(([^)]*)\)/g;
  let match;

  while ((match = funcPattern.exec(code)) !== null) {
    const params = match[1].split(',').filter(p => p.trim());
    if (params.length > 4) {
      suggestions.push({
        type: 'introduce_parameter_object',
        severity: params.length > 6 ? 'high' : 'medium',
        description: `Function has ${params.length} parameters. Consider using a parameter object.`,
        before: `function(${params.slice(0, 3).join(', ')}, ...)`,
        after: `function(options: { ${params.slice(0, 3).map(p => p.trim().split(':')[0] || p.trim()).join(', ')} })`
      });
    }
  }

  return suggestions;
}

function detectPrimitiveObsession(code: string): RefactorSuggestion[] {
  const suggestions: RefactorSuggestion[] = [];

  // Detect string comparisons that could be enums
  const stringComparisons = code.match(/===?\s*['"][^'"]+['"]/g) || [];
  const uniqueStrings = new Set(stringComparisons.map(s => s.replace(/===?\s*/, '')));

  if (uniqueStrings.size > 5) {
    suggestions.push({
      type: 'replace_primitive_with_object',
      severity: 'medium',
      description: 'Multiple string literals used in comparisons. Consider using enums or constants.',
      before: Array.from(uniqueStrings).slice(0, 3).join(', '),
      after: 'enum Status { Active = "active", Pending = "pending", ... }'
    });
  }

  // Detect repeated type checks
  const typeChecks = (code.match(/typeof\s+\w+\s*===?\s*['"][^'"]+['"]/g) || []).length;
  if (typeChecks > 3) {
    suggestions.push({
      type: 'introduce_type_guard',
      severity: 'low',
      description: `${typeChecks} typeof checks found. Consider using TypeScript type guards.`,
      after: 'function isString(value: unknown): value is string { return typeof value === "string"; }'
    });
  }

  return suggestions;
}

function detectCodeSmells(code: string): RefactorSuggestion[] {
  const suggestions: RefactorSuggestion[] = [];

  // Magic numbers
  const magicNumbers = code.match(/[^a-zA-Z_]\d{2,}[^a-zA-Z_]/g) || [];
  if (magicNumbers.length > 3) {
    suggestions.push({
      type: 'extract_constant',
      severity: 'low',
      description: 'Magic numbers detected. Extract to named constants.',
      before: magicNumbers.slice(0, 3).join(', '),
      after: 'const MAX_RETRIES = 3; const TIMEOUT_MS = 5000;'
    });
  }

  // God class indicators
  const methodCount = (code.match(/(?:public|private|protected)?\s*(?:async\s+)?(?:\w+)\s*\([^)]*\)\s*[:{]/g) || []).length;
  if (methodCount > 15) {
    suggestions.push({
      type: 'split_class',
      severity: 'high',
      description: `Class has ${methodCount} methods. Consider splitting into smaller, focused classes.`
    });
  }

  // Dead code (commented out code)
  const commentedCode = (code.match(/\/\/\s*(?:const|let|var|function|class|if|for|while)/g) || []).length;
  if (commentedCode > 3) {
    suggestions.push({
      type: 'remove_dead_code',
      severity: 'low',
      description: 'Commented-out code detected. Remove if no longer needed.'
    });
  }

  return suggestions;
}

function suggestModernSyntax(code: string): RefactorSuggestion[] {
  const suggestions: RefactorSuggestion[] = [];

  // var to let/const
  if (code.includes('var ')) {
    suggestions.push({
      type: 'modernize_syntax',
      severity: 'low',
      description: 'Replace var with let/const for block scoping',
      before: 'var x = 1;',
      after: 'const x = 1; // or let if reassigned'
    });
  }

  // function to arrow
  const regularFunctions = (code.match(/function\s*\([^)]*\)\s*{/g) || []).length;
  if (regularFunctions > 0) {
    suggestions.push({
      type: 'modernize_syntax',
      severity: 'low',
      description: 'Consider arrow functions for callbacks',
      before: 'array.map(function(x) { return x * 2; })',
      after: 'array.map(x => x * 2)'
    });
  }

  // String concatenation to template literals
  if (code.match(/['"][^'"]*['"]\s*\+\s*\w+/)) {
    suggestions.push({
      type: 'modernize_syntax',
      severity: 'low',
      description: 'Use template literals instead of string concatenation',
      before: '"Hello " + name',
      after: '`Hello ${name}`'
    });
  }

  // Promise.then to async/await
  if (code.includes('.then(') && !code.includes('async ')) {
    suggestions.push({
      type: 'modernize_syntax',
      severity: 'medium',
      description: 'Consider async/await instead of Promise chains',
      before: 'fetch(url).then(r => r.json()).then(data => ...)',
      after: 'const response = await fetch(url); const data = await response.json();'
    });
  }

  return suggestions;
}

export const refactorSuggesterTool: UnifiedTool = {
  name: 'refactor_suggester',
  description: 'Refactor Suggester: analyze code for long_functions, duplicates, deep_nesting, parameter_lists, primitives, code_smells, modern_syntax',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['full_analysis', 'long_functions', 'duplicates', 'deep_nesting', 'parameter_lists', 'primitives', 'code_smells', 'modern_syntax'] },
      code: { type: 'string', description: 'Source code to analyze' }
    },
    required: ['operation']
  },
};

export async function executeRefactorSuggester(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const code = args.code || `
function processData(a, b, c, d, e, f, g) {
  var result = [];
  if (a > 0) {
    if (b > 0) {
      if (c > 0) {
        for (var i = 0; i < 100; i++) {
          result.push(i * 2);
        }
      }
    }
  }
  return result;
}`;

    let suggestions: RefactorSuggestion[] = [];

    switch (args.operation) {
      case 'long_functions':
        suggestions = detectLongFunctions(code);
        break;
      case 'duplicates':
        suggestions = detectDuplicateCode(code);
        break;
      case 'deep_nesting':
        suggestions = detectDeepNesting(code);
        break;
      case 'parameter_lists':
        suggestions = detectLongParameterList(code);
        break;
      case 'primitives':
        suggestions = detectPrimitiveObsession(code);
        break;
      case 'code_smells':
        suggestions = detectCodeSmells(code);
        break;
      case 'modern_syntax':
        suggestions = suggestModernSyntax(code);
        break;
      case 'full_analysis':
        suggestions = [
          ...detectLongFunctions(code),
          ...detectDuplicateCode(code),
          ...detectDeepNesting(code),
          ...detectLongParameterList(code),
          ...detectPrimitiveObsession(code),
          ...detectCodeSmells(code),
          ...suggestModernSyntax(code)
        ];
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    const result = {
      totalSuggestions: suggestions.length,
      byPriority: {
        high: suggestions.filter(s => s.severity === 'high').length,
        medium: suggestions.filter(s => s.severity === 'medium').length,
        low: suggestions.filter(s => s.severity === 'low').length
      },
      suggestions
    };

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isRefactorSuggesterAvailable(): boolean { return true; }
