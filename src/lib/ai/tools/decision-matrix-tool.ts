/**
 * DECISION MATRIX TOOL
 * Weighted scoring, Pugh matrix, AHP, multi-criteria decision analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Criterion { name: string; weight: number; }
interface Option { name: string; scores: Record<string, number>; }
interface DecisionMatrix { criteria: Criterion[]; options: Option[]; }

function weightedScore(matrix: DecisionMatrix): Array<{ option: string; score: number; breakdown: Record<string, number> }> {
  const totalWeight = matrix.criteria.reduce((sum, c) => sum + c.weight, 0);
  const normalizedWeights = matrix.criteria.map(c => ({ ...c, weight: c.weight / totalWeight }));

  return matrix.options.map(option => {
    const breakdown: Record<string, number> = {};
    let totalScore = 0;

    normalizedWeights.forEach(criterion => {
      const score = option.scores[criterion.name] || 0;
      const weighted = score * criterion.weight;
      breakdown[criterion.name] = weighted;
      totalScore += weighted;
    });

    return { option: option.name, score: Math.round(totalScore * 100) / 100, breakdown };
  }).sort((a, b) => b.score - a.score);
}

function pughMatrix(options: string[], criteria: string[], baseline: string, ratings: Record<string, Record<string, number>>): Record<string, unknown> {
  const results: Record<string, { plus: number; minus: number; same: number; total: number }> = {};

  options.forEach(option => {
    results[option] = { plus: 0, minus: 0, same: 0, total: 0 };

    criteria.forEach(criterion => {
      const optionScore = ratings[option]?.[criterion] || 0;
      const baselineScore = ratings[baseline]?.[criterion] || 0;
      const diff = optionScore - baselineScore;

      if (diff > 0) results[option].plus++;
      else if (diff < 0) results[option].minus++;
      else results[option].same++;
    });

    results[option].total = results[option].plus - results[option].minus;
  });

  return {
    baseline,
    results,
    ranking: Object.entries(results).sort((a, b) => b[1].total - a[1].total).map(([name, r]) => ({ name, ...r }))
  };
}

function ahpPairwise(criteria: string[], comparisons: Array<{ a: string; b: string; value: number }>): Record<string, number> {
  // Build comparison matrix
  const n = criteria.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(1));
  const indexMap: Record<string, number> = {};
  criteria.forEach((c, i) => indexMap[c] = i);

  comparisons.forEach(({ a, b, value }) => {
    const i = indexMap[a];
    const j = indexMap[b];
    if (i !== undefined && j !== undefined) {
      matrix[i][j] = value;
      matrix[j][i] = 1 / value;
    }
  });

  // Calculate priority vector (simplified - column normalization method)
  const colSums = matrix[0].map((_, j) => matrix.reduce((sum, row) => sum + row[j], 0));
  const normalized = matrix.map(row => row.map((val, j) => val / colSums[j]));
  const priorities: Record<string, number> = {};

  criteria.forEach((c, i) => {
    priorities[c] = normalized[i].reduce((sum, val) => sum + val, 0) / n;
  });

  return priorities;
}

function swotAnalysis(strengths: string[], weaknesses: string[], opportunities: string[], threats: string[]): Record<string, unknown> {
  return {
    swot: { strengths, weaknesses, opportunities, threats },
    strategies: {
      SO: 'Leverage strengths to capitalize on opportunities',
      WO: 'Address weaknesses to take advantage of opportunities',
      ST: 'Use strengths to mitigate threats',
      WT: 'Minimize weaknesses and avoid threats'
    },
    summary: {
      internalFactors: strengths.length + weaknesses.length,
      externalFactors: opportunities.length + threats.length,
      positiveFactors: strengths.length + opportunities.length,
      negativeFactors: weaknesses.length + threats.length
    }
  };
}

function eisenhowerMatrix(tasks: Array<{ name: string; urgent: boolean; important: boolean }>): Record<string, string[]> {
  return {
    doFirst: tasks.filter(t => t.urgent && t.important).map(t => t.name),
    schedule: tasks.filter(t => !t.urgent && t.important).map(t => t.name),
    delegate: tasks.filter(t => t.urgent && !t.important).map(t => t.name),
    eliminate: tasks.filter(t => !t.urgent && !t.important).map(t => t.name)
  };
}

function raciMatrix(tasks: string[], stakeholders: string[], assignments: Record<string, Record<string, string>>): Record<string, unknown> {
  const matrix: Record<string, Record<string, string>> = {};
  const summary: Record<string, { R: number; A: number; C: number; I: number }> = {};

  stakeholders.forEach(s => summary[s] = { R: 0, A: 0, C: 0, I: 0 });

  tasks.forEach(task => {
    matrix[task] = {};
    stakeholders.forEach(stakeholder => {
      const role = assignments[task]?.[stakeholder] || '';
      matrix[task][stakeholder] = role;
      if (role && summary[stakeholder][role as 'R' | 'A' | 'C' | 'I'] !== undefined) {
        summary[stakeholder][role as 'R' | 'A' | 'C' | 'I']++;
      }
    });
  });

  return { matrix, summary, legend: { R: 'Responsible', A: 'Accountable', C: 'Consulted', I: 'Informed' } };
}

function prosConsAnalysis(pros: string[], cons: string[], weights?: Record<string, number>): Record<string, unknown> {
  const weightedPros = pros.reduce((sum, p) => sum + (weights?.[p] || 1), 0);
  const weightedCons = cons.reduce((sum, c) => sum + (weights?.[c] || 1), 0);

  return {
    pros: pros.map(p => ({ item: p, weight: weights?.[p] || 1 })),
    cons: cons.map(c => ({ item: c, weight: weights?.[c] || 1 })),
    summary: {
      prosCount: pros.length,
      consCount: cons.length,
      weightedPros,
      weightedCons,
      netScore: weightedPros - weightedCons,
      recommendation: weightedPros > weightedCons ? 'Proceed' : 'Reconsider'
    }
  };
}

export const decisionMatrixTool: UnifiedTool = {
  name: 'decision_matrix',
  description: 'Decision Matrix: weighted, pugh, ahp, swot, eisenhower, raci, pros_cons',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['weighted', 'pugh', 'ahp', 'swot', 'eisenhower', 'raci', 'pros_cons'] },
      criteria: { type: 'array' },
      options: { type: 'array' },
      baseline: { type: 'string' },
      ratings: { type: 'object' },
      comparisons: { type: 'array' },
      strengths: { type: 'array' },
      weaknesses: { type: 'array' },
      opportunities: { type: 'array' },
      threats: { type: 'array' },
      tasks: { type: 'array' },
      stakeholders: { type: 'array' },
      assignments: { type: 'object' },
      pros: { type: 'array' },
      cons: { type: 'array' },
      weights: { type: 'object' }
    },
    required: ['operation']
  }
};

export async function executeDecisionMatrix(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'weighted':
        const matrix: DecisionMatrix = {
          criteria: args.criteria || [
            { name: 'Cost', weight: 3 },
            { name: 'Quality', weight: 5 },
            { name: 'Speed', weight: 2 }
          ],
          options: args.options || [
            { name: 'Option A', scores: { Cost: 8, Quality: 7, Speed: 6 } },
            { name: 'Option B', scores: { Cost: 6, Quality: 9, Speed: 5 } },
            { name: 'Option C', scores: { Cost: 9, Quality: 5, Speed: 8 } }
          ]
        };
        result = { matrix, results: weightedScore(matrix) };
        break;
      case 'pugh':
        result = pughMatrix(
          args.options || ['A', 'B', 'C'],
          args.criteria || ['Cost', 'Quality', 'Speed'],
          args.baseline || 'A',
          args.ratings || { A: { Cost: 5, Quality: 5, Speed: 5 }, B: { Cost: 4, Quality: 7, Speed: 3 }, C: { Cost: 6, Quality: 4, Speed: 8 } }
        );
        break;
      case 'ahp':
        result = {
          criteria: args.criteria || ['Cost', 'Quality', 'Speed'],
          weights: ahpPairwise(
            args.criteria || ['Cost', 'Quality', 'Speed'],
            args.comparisons || [
              { a: 'Quality', b: 'Cost', value: 3 },
              { a: 'Quality', b: 'Speed', value: 2 },
              { a: 'Cost', b: 'Speed', value: 0.5 }
            ]
          )
        };
        break;
      case 'swot':
        result = swotAnalysis(
          args.strengths || ['Strong brand', 'Skilled team'],
          args.weaknesses || ['Limited budget', 'Small market share'],
          args.opportunities || ['Growing market', 'New technology'],
          args.threats || ['Competition', 'Regulation']
        );
        break;
      case 'eisenhower':
        result = {
          matrix: eisenhowerMatrix(args.tasks || [
            { name: 'Crisis meeting', urgent: true, important: true },
            { name: 'Long-term planning', urgent: false, important: true },
            { name: 'Reply to emails', urgent: true, important: false },
            { name: 'Social media', urgent: false, important: false }
          ])
        };
        break;
      case 'raci':
        result = raciMatrix(
          args.tasks || ['Design', 'Develop', 'Test'],
          args.stakeholders || ['PM', 'Dev', 'QA'],
          args.assignments || {
            Design: { PM: 'A', Dev: 'R', QA: 'C' },
            Develop: { PM: 'I', Dev: 'R', QA: 'C' },
            Test: { PM: 'I', Dev: 'C', QA: 'R' }
          }
        );
        break;
      case 'pros_cons':
        result = prosConsAnalysis(
          args.pros || ['Lower cost', 'Faster delivery', 'Better quality'],
          args.cons || ['Higher risk', 'Team inexperience'],
          args.weights
        );
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isDecisionMatrixAvailable(): boolean { return true; }
