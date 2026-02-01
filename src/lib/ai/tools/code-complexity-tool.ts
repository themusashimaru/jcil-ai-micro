/**
 * CODE COMPLEXITY TOOL
 * Calculate cyclomatic, cognitive, and other complexity metrics
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function calculateCyclomatic(code: string): number {
  const decisions = [
    /\bif\b/g, /\belse\s+if\b/g, /\bwhile\b/g, /\bfor\b/g,
    /\bcase\b/g, /\bcatch\b/g, /\b\?\s*:/g, /&&/g, /\|\|/g,
    /\?\./g // optional chaining
  ];
  let complexity = 1;
  for (const pattern of decisions) {
    complexity += (code.match(pattern) || []).length;
  }
  return complexity;
}

function calculateCognitive(code: string): { score: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {
    nesting: 0,
    conditionals: 0,
    loops: 0,
    recursion: 0,
    jumps: 0
  };

  const lines = code.split('\n');
  let nestingLevel = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track nesting
    if (trimmed.match(/{\s*$/)) nestingLevel++;
    if (trimmed.match(/^\s*}/)) nestingLevel = Math.max(0, nestingLevel - 1);

    // Conditionals with nesting penalty
    if (trimmed.match(/\bif\b|\belse\s+if\b|\bswitch\b|\?\s*:/)) {
      breakdown.conditionals += 1 + nestingLevel;
    }

    // Loops with nesting penalty
    if (trimmed.match(/\bfor\b|\bwhile\b|\bdo\b|\.forEach|\.map\(|\.filter\(/)) {
      breakdown.loops += 2 + nestingLevel;
    }

    // Recursion detection
    const funcMatch = code.match(/function\s+(\w+)/);
    if (funcMatch && trimmed.includes(funcMatch[1] + '(')) {
      breakdown.recursion += 3;
    }

    // Control flow jumps
    if (trimmed.match(/\bbreak\b|\bcontinue\b|\breturn\b.*\breturn\b|\bgoto\b/)) {
      breakdown.jumps += 1;
    }

    breakdown.nesting = Math.max(breakdown.nesting, nestingLevel);
  }

  return {
    score: Object.values(breakdown).reduce((a, b) => a + b, 0),
    breakdown
  };
}

function calculateHalstead(code: string): Record<string, number> {
  // Simplified Halstead metrics
  const operators = code.match(/[+\-*/%=<>!&|^~?:]+|\.|\[|\]|\(|\)|{|}|,|;/g) || [];
  const operands = code.match(/\b[a-zA-Z_]\w*\b|\b\d+\.?\d*\b|"[^"]*"|'[^']*'/g) || [];

  const uniqueOperators = new Set(operators).size;
  const uniqueOperands = new Set(operands).size;
  const totalOperators = operators.length;
  const totalOperands = operands.length;

  const vocabulary = uniqueOperators + uniqueOperands;
  const length = totalOperators + totalOperands;
  const volume = length * Math.log2(vocabulary || 1);
  const difficulty = (uniqueOperators / 2) * (totalOperands / (uniqueOperands || 1));
  const effort = difficulty * volume;
  const timeToProgram = effort / 18; // seconds
  const bugs = volume / 3000;

  return {
    vocabulary: Math.round(vocabulary),
    length: Math.round(length),
    volume: Math.round(volume * 100) / 100,
    difficulty: Math.round(difficulty * 100) / 100,
    effort: Math.round(effort),
    timeToProgram: Math.round(timeToProgram),
    estimatedBugs: Math.round(bugs * 1000) / 1000
  };
}

function calculateMaintainability(code: string): Record<string, unknown> {
  const lines = code.split('\n');
  const loc = lines.length;
  const sloc = lines.filter(l => l.trim() && !l.trim().startsWith('//')).length;
  const comments = lines.filter(l => l.trim().startsWith('//')).length;

  const cyclomatic = calculateCyclomatic(code);
  const halstead = calculateHalstead(code);

  // Maintainability Index formula
  const mi = Math.max(0, (171 - 5.2 * Math.log(halstead.volume || 1)
    - 0.23 * cyclomatic
    - 16.2 * Math.log(sloc || 1)
    + 50 * Math.sin(Math.sqrt(2.4 * (comments / (sloc || 1))))) * 100 / 171);

  return {
    maintainabilityIndex: Math.round(mi),
    rating: mi >= 85 ? 'Excellent' : mi >= 65 ? 'Good' : mi >= 40 ? 'Moderate' : 'Poor',
    loc,
    sloc,
    commentRatio: Math.round((comments / (sloc || 1)) * 100) / 100,
    recommendations: mi < 65 ? [
      'Consider breaking down large functions',
      'Add more comments for complex logic',
      'Reduce cyclomatic complexity',
      'Simplify nested conditionals'
    ] : ['Code maintainability is acceptable']
  };
}

function analyzeFunction(code: string, funcName?: string): Record<string, unknown> {
  const functions: Record<string, unknown>[] = [];
  const funcPattern = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*:\s*(?:async\s*)?\()/g;
  let match;

  while ((match = funcPattern.exec(code)) !== null) {
    const name = match[1] || match[2] || match[3] || 'anonymous';
    if (funcName && name !== funcName) continue;

    // Find function body (simplified)
    const startIdx = match.index;
    let braceCount = 0;
    let endIdx = startIdx;
    let started = false;

    for (let i = startIdx; i < code.length; i++) {
      if (code[i] === '{') { braceCount++; started = true; }
      if (code[i] === '}') braceCount--;
      if (started && braceCount === 0) { endIdx = i + 1; break; }
    }

    const funcBody = code.substring(startIdx, endIdx);
    const lines = funcBody.split('\n').length;
    const params = (funcBody.match(/\(([^)]*)\)/)?.[1] || '').split(',').filter(p => p.trim()).length;

    functions.push({
      name,
      lines,
      parameters: params,
      cyclomatic: calculateCyclomatic(funcBody),
      cognitive: calculateCognitive(funcBody).score,
      issues: lines > 50 ? ['Function too long'] : params > 5 ? ['Too many parameters'] : []
    });
  }

  return {
    functionsAnalyzed: functions.length,
    functions: functions.slice(0, 20),
    summary: {
      avgLines: functions.length > 0 ? Math.round(functions.reduce((a, f) => a + (f.lines as number), 0) / functions.length) : 0,
      avgComplexity: functions.length > 0 ? Math.round(functions.reduce((a, f) => a + (f.cyclomatic as number), 0) / functions.length) : 0
    }
  };
}

export const codeComplexityTool: UnifiedTool = {
  name: 'code_complexity',
  description: 'Code Complexity: cyclomatic, cognitive, halstead, maintainability, function_analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['cyclomatic', 'cognitive', 'halstead', 'maintainability', 'function_analysis', 'full_report'] },
      code: { type: 'string', description: 'Source code to analyze' },
      functionName: { type: 'string', description: 'Specific function to analyze' }
    },
    required: ['operation']
  },
};

export async function executeCodeComplexity(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const code = args.code || 'function example(x) { if (x > 0) { return x * 2; } else { return 0; } }';
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'cyclomatic':
        result = {
          cyclomaticComplexity: calculateCyclomatic(code),
          interpretation: calculateCyclomatic(code) <= 10 ? 'Low risk' : calculateCyclomatic(code) <= 20 ? 'Moderate risk' : 'High risk'
        };
        break;
      case 'cognitive':
        result = calculateCognitive(code);
        break;
      case 'halstead':
        result = calculateHalstead(code);
        break;
      case 'maintainability':
        result = calculateMaintainability(code);
        break;
      case 'function_analysis':
        result = analyzeFunction(code, args.functionName);
        break;
      case 'full_report':
        result = {
          cyclomatic: calculateCyclomatic(code),
          cognitive: calculateCognitive(code),
          halstead: calculateHalstead(code),
          maintainability: calculateMaintainability(code),
          functions: analyzeFunction(code)
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isCodeComplexityAvailable(): boolean { return true; }
