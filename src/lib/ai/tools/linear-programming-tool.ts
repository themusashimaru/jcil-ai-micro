/**
 * LINEAR PROGRAMMING TOOL
 * Simplex method optimizer - solves optimization problems!
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface LPProblem {
  objective: number[];
  constraints: { coeffs: number[]; rhs: number; type: 'le' | 'ge' | 'eq' }[];
  maximize: boolean;
}
void (0 as unknown as LPProblem); // For typed problem input

function simplex(c: number[], A: number[][], b: number[], maximize: boolean = true): { optimal: number; solution: number[]; iterations: number } | null {
  const m = A.length;
  const n = c.length;
  const numSlack = m;
  
  // Build tableau: [A | I | b] and [-c | 0 | 0]
  const tableau: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row = [...A[i]];
    for (let j = 0; j < numSlack; j++) row.push(i === j ? 1 : 0);
    row.push(b[i]);
    tableau.push(row);
  }
  
  const objRow = c.map(x => maximize ? -x : x);
  for (let j = 0; j < numSlack + 1; j++) objRow.push(0);
  tableau.push(objRow);
  
  const width = tableau[0].length;
  let iterations = 0;
  const maxIter = 100;
  
  while (iterations < maxIter) {
    iterations++;
    
    // Find pivot column (most negative in objective row)
    let pivotCol = -1;
    let minVal = 0;
    for (let j = 0; j < width - 1; j++) {
      if (tableau[m][j] < minVal) {
        minVal = tableau[m][j];
        pivotCol = j;
      }
    }
    
    if (pivotCol === -1) break; // Optimal
    
    // Find pivot row (minimum ratio)
    let pivotRow = -1;
    let minRatio = Infinity;
    for (let i = 0; i < m; i++) {
      if (tableau[i][pivotCol] > 0) {
        const ratio = tableau[i][width - 1] / tableau[i][pivotCol];
        if (ratio < minRatio) {
          minRatio = ratio;
          pivotRow = i;
        }
      }
    }
    
    if (pivotRow === -1) return null; // Unbounded
    
    // Pivot
    const pivot = tableau[pivotRow][pivotCol];
    for (let j = 0; j < width; j++) tableau[pivotRow][j] /= pivot;
    
    for (let i = 0; i <= m; i++) {
      if (i !== pivotRow) {
        const factor = tableau[i][pivotCol];
        for (let j = 0; j < width; j++) {
          tableau[i][j] -= factor * tableau[pivotRow][j];
        }
      }
    }
  }
  
  // Extract solution
  const solution = new Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    let basicRow = -1;
    let isBasic = true;
    for (let i = 0; i < m; i++) {
      if (Math.abs(tableau[i][j] - 1) < 1e-10) {
        if (basicRow !== -1) { isBasic = false; break; }
        basicRow = i;
      } else if (Math.abs(tableau[i][j]) > 1e-10) {
        isBasic = false;
        break;
      }
    }
    if (isBasic && basicRow !== -1) {
      solution[j] = tableau[basicRow][width - 1];
    }
  }
  
  return { optimal: tableau[m][width - 1], solution, iterations };
}

export const linearProgrammingTool: UnifiedTool = {
  name: 'linear_programming',
  description: 'Linear programming solver using Simplex method - optimize objectives subject to constraints',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['solve', 'demo', 'info'], description: 'Operation' },
      objective: { type: 'array', description: 'Objective function coefficients' },
      constraints: { type: 'array', description: 'Constraint matrix A' },
      rhs: { type: 'array', description: 'Right-hand side vector b' },
      maximize: { type: 'boolean', description: 'True to maximize, false to minimize' }
    },
    required: ['operation']
  }
};

export async function executeLinearProgramming(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'solve': {
        // Example: maximize 3x + 2y subject to x + y <= 4, x <= 2, y <= 3
        const c = args.objective || [3, 2];
        const A = args.constraints || [[1, 1], [1, 0], [0, 1]];
        const b = args.rhs || [4, 2, 3];
        const res = simplex(c, A, b, args.maximize !== false);
        result = res || { error: 'Problem is infeasible or unbounded' };
        break;
      }
      case 'demo':
        result = {
          examples: [
            { name: 'Production', problem: 'max 5x + 4y, x + y <= 5, 2x + y <= 8', solution: simplex([5, 4], [[1, 1], [2, 1]], [5, 8], true) },
            { name: 'Diet', problem: 'min 2x + 3y, x + y >= 4 (as <= -4 negated)', solution: simplex([2, 3], [[1, 1], [1, 0]], [4, 2], false) }
          ]
        };
        break;
      case 'info':
      default:
        result = { description: 'Simplex method for LP', features: ['Maximize/minimize', 'Multiple constraints', 'Slack variables'], applications: ['Resource allocation', 'Scheduling', 'Portfolio optimization'] };
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isLinearProgrammingAvailable(): boolean { return true; }
