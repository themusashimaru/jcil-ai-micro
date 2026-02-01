/**
 * TECH DEBT TOOL
 * Quantify and track technical debt
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface DebtItem {
  category: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  effort: 'hours' | 'days' | 'weeks';
  impact: string;
  score: number;
}

function analyzeCodeDebt(code: string): DebtItem[] {
  const debt: DebtItem[] = [];
  const lines = code.split('\n');

  // TODO/FIXME comments
  const todos = code.match(/\/\/\s*(TODO|FIXME|HACK|XXX|BUG)[:|\s].*$/gm) || [];
  if (todos.length > 0) {
    debt.push({
      category: 'Known Issues',
      description: `${todos.length} TODO/FIXME comments found`,
      severity: todos.some(t => t.includes('FIXME') || t.includes('BUG')) ? 'high' : 'medium',
      effort: 'days',
      impact: 'Code quality and maintainability',
      score: todos.length * 5
    });
  }

  // Deprecated APIs
  const deprecated = code.match(/@deprecated|\.deprecated\(|DEPRECATED/gi) || [];
  if (deprecated.length > 0) {
    debt.push({
      category: 'Deprecated Code',
      description: `${deprecated.length} deprecated references found`,
      severity: 'high',
      effort: 'days',
      impact: 'Security and compatibility risks',
      score: deprecated.length * 10
    });
  }

  // Console statements in production code
  const consoles = (code.match(/console\.(log|warn|error|debug|info)\(/g) || []).length;
  if (consoles > 5) {
    debt.push({
      category: 'Debug Code',
      description: `${consoles} console statements - should use proper logging`,
      severity: 'low',
      effort: 'hours',
      impact: 'Performance and security',
      score: consoles * 2
    });
  }

  // Type assertions / any usage
  const anyUsage = (code.match(/:\s*any\b|as\s+any\b/g) || []).length;
  if (anyUsage > 0) {
    debt.push({
      category: 'Type Safety',
      description: `${anyUsage} uses of 'any' type - reduces type safety`,
      severity: 'medium',
      effort: 'days',
      impact: 'Type safety and maintainability',
      score: anyUsage * 5
    });
  }

  // Complexity
  const conditionals = (code.match(/if\s*\(|switch\s*\(|\?\s*:/g) || []).length;
  const nestedIfs = (code.match(/if\s*\([^)]*\)\s*{\s*if\s*\(/g) || []).length;
  if (nestedIfs > 3 || conditionals > 20) {
    debt.push({
      category: 'Complexity',
      description: 'High cyclomatic complexity detected',
      severity: 'high',
      effort: 'weeks',
      impact: 'Maintainability and test coverage',
      score: nestedIfs * 10 + conditionals
    });
  }

  // Long files
  if (lines.length > 500) {
    debt.push({
      category: 'File Size',
      description: `File has ${lines.length} lines - consider splitting`,
      severity: 'medium',
      effort: 'days',
      impact: 'Maintainability and cognitive load',
      score: Math.floor(lines.length / 100) * 5
    });
  }

  // Magic strings/numbers
  const magicStrings = code.match(/===?\s*['"][a-zA-Z_]+['"]/g) || [];
  if (magicStrings.length > 10) {
    debt.push({
      category: 'Magic Values',
      description: `${magicStrings.length} magic strings - use constants/enums`,
      severity: 'low',
      effort: 'hours',
      impact: 'Maintainability',
      score: Math.floor(magicStrings.length / 2)
    });
  }

  return debt;
}

function calculateDebtScore(items: DebtItem[]): Record<string, unknown> {
  const totalScore = items.reduce((sum, item) => sum + item.score, 0);

  const severityWeights = { critical: 4, high: 3, medium: 2, low: 1 };
  const weightedScore = items.reduce((sum, item) =>
    sum + item.score * severityWeights[item.severity], 0);

  const effortMap = { hours: 1, days: 8, weeks: 40 };
  const estimatedHours = items.reduce((sum, item) =>
    sum + effortMap[item.effort], 0);

  let healthGrade: string;
  if (totalScore < 20) healthGrade = 'A';
  else if (totalScore < 50) healthGrade = 'B';
  else if (totalScore < 100) healthGrade = 'C';
  else if (totalScore < 200) healthGrade = 'D';
  else healthGrade = 'F';

  return {
    rawScore: totalScore,
    weightedScore,
    healthGrade,
    estimatedEffort: {
      hours: estimatedHours,
      days: Math.ceil(estimatedHours / 8),
      sprints: Math.ceil(estimatedHours / 40)
    },
    breakdown: {
      critical: items.filter(i => i.severity === 'critical').length,
      high: items.filter(i => i.severity === 'high').length,
      medium: items.filter(i => i.severity === 'medium').length,
      low: items.filter(i => i.severity === 'low').length
    }
  };
}

function prioritizeDebt(items: DebtItem[]): DebtItem[] {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const effortOrder = { hours: 0, days: 1, weeks: 2 };

  return [...items].sort((a, b) => {
    // First by severity
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // Then by effort (prefer quick wins)
    return effortOrder[a.effort] - effortOrder[b.effort];
  });
}

function generateReport(items: DebtItem[]): Record<string, unknown> {
  const score = calculateDebtScore(items);
  const prioritized = prioritizeDebt(items);

  return {
    summary: {
      totalItems: items.length,
      ...score
    },
    topPriorities: prioritized.slice(0, 5),
    byCategory: items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    recommendations: [
      prioritized.length > 0 ? `Start with: ${prioritized[0].description}` : 'No immediate debt found',
      score.healthGrade === 'D' || score.healthGrade === 'F'
        ? 'Consider dedicated tech debt sprint'
        : 'Address debt incrementally',
      items.some(i => i.severity === 'critical')
        ? 'CRITICAL: Address security/stability issues immediately'
        : 'No critical issues'
    ]
  };
}

function trackDebtOverTime(current: DebtItem[], previous?: DebtItem[]): Record<string, unknown> {
  const currentScore = calculateDebtScore(current);
  const previousScore = previous ? calculateDebtScore(previous) : null;

  return {
    current: currentScore,
    previous: previousScore,
    trend: previousScore
      ? {
        scoreDelta: (currentScore.rawScore as number) - (previousScore.rawScore as number),
        direction: (currentScore.rawScore as number) < (previousScore.rawScore as number) ? 'improving' : 'degrading',
        newItems: current.length - (previous?.length || 0)
      }
      : null,
    velocity: previousScore
      ? `${Math.abs((currentScore.rawScore as number) - (previousScore.rawScore as number))} points ${(currentScore.rawScore as number) < (previousScore.rawScore as number) ? 'reduced' : 'added'}`
      : 'No previous data'
  };
}

function suggestQuickWins(items: DebtItem[]): Record<string, unknown> {
  const quickWins = items
    .filter(i => i.effort === 'hours' && (i.severity === 'medium' || i.severity === 'high'))
    .slice(0, 5);

  const impactful = items
    .filter(i => i.severity === 'critical' || i.severity === 'high')
    .slice(0, 5);

  return {
    quickWins: {
      description: 'High impact, low effort items',
      items: quickWins,
      estimatedHours: quickWins.length * 2
    },
    mostImpactful: {
      description: 'Highest severity items',
      items: impactful
    },
    suggestedSprint: {
      items: [...quickWins.slice(0, 3), ...impactful.slice(0, 2)],
      rationale: 'Mix of quick wins and high-impact items'
    }
  };
}

export const techDebtTool: UnifiedTool = {
  name: 'tech_debt',
  description: 'Tech Debt: analyze_code, calculate_score, prioritize, generate_report, track_trend, quick_wins',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['analyze_code', 'calculate_score', 'prioritize', 'generate_report', 'track_trend', 'quick_wins'] },
      code: { type: 'string', description: 'Source code to analyze' },
      debtItems: { type: 'array', description: 'Array of debt items' },
      previousItems: { type: 'array', description: 'Previous debt items for comparison' }
    },
    required: ['operation']
  },
};

export async function executeTechDebt(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    const sampleCode = `
// TODO: Refactor this mess
// FIXME: Memory leak here
function processData(a: any, b: any, c: any) {
  console.log('debug', a);
  if (a === 'active') {
    if (b === 'ready') {
      if (c === 'valid') {
        return true;
      }
    }
  }
  return false;
}`;

    switch (args.operation) {
      case 'analyze_code':
        result = { items: analyzeCodeDebt(args.code || sampleCode) };
        break;
      case 'calculate_score':
        result = calculateDebtScore(args.debtItems || analyzeCodeDebt(args.code || sampleCode));
        break;
      case 'prioritize':
        result = { prioritized: prioritizeDebt(args.debtItems || analyzeCodeDebt(args.code || sampleCode)) };
        break;
      case 'generate_report':
        result = generateReport(args.debtItems || analyzeCodeDebt(args.code || sampleCode));
        break;
      case 'track_trend':
        result = trackDebtOverTime(
          args.debtItems || analyzeCodeDebt(args.code || sampleCode),
          args.previousItems
        );
        break;
      case 'quick_wins':
        result = suggestQuickWins(args.debtItems || analyzeCodeDebt(args.code || sampleCode));
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isTechDebtAvailable(): boolean { return true; }
