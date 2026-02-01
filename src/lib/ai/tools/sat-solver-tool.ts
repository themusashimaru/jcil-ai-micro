/**
 * SAT SOLVER TOOL
 * Boolean satisfiability solver with DPLL algorithm
 * This is ACTUAL computer science - NP-complete problem solving!
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

type Literal = number; // positive = true, negative = negated
type Clause = Literal[];
type Formula = Clause[];
type Assignment = Map<number, boolean>;

function parseDIMACS(input: string): { numVars: number; clauses: Formula } {
  const lines = input.trim().split('\n').filter(l => !l.startsWith('c'));
  let numVars = 0;
  const clauses: Formula = [];
  
  for (const line of lines) {
    if (line.startsWith('p cnf')) {
      const parts = line.split(/\s+/);
      numVars = parseInt(parts[2]);
    } else {
      const lits = line.split(/\s+/).map(Number).filter(n => n !== 0);
      if (lits.length > 0) clauses.push(lits);
    }
  }
  return { numVars, clauses };
}

function unitPropagate(formula: Formula, assignment: Assignment): { formula: Formula; assignment: Assignment } | 'conflict' {
  let changed = true;
  const newAssignment = new Map(assignment);
  let newFormula = formula.map(c => [...c]);
  
  while (changed) {
    changed = false;
    for (const clause of newFormula) {
      const unassigned = clause.filter(lit => !newAssignment.has(Math.abs(lit)));
      const satisfied = clause.some(lit => {
        const val = newAssignment.get(Math.abs(lit));
        return val !== undefined && (lit > 0 ? val : !val);
      });
      
      if (satisfied) continue;
      if (unassigned.length === 0) return 'conflict';
      if (unassigned.length === 1) {
        const lit = unassigned[0];
        newAssignment.set(Math.abs(lit), lit > 0);
        changed = true;
      }
    }
    
    newFormula = newFormula.filter(clause => {
      return !clause.some(lit => {
        const val = newAssignment.get(Math.abs(lit));
        return val !== undefined && (lit > 0 ? val : !val);
      });
    }).map(clause => clause.filter(lit => !newAssignment.has(Math.abs(lit))));
  }
  
  return { formula: newFormula, assignment: newAssignment };
}

function pureLiteralElim(formula: Formula, assignment: Assignment): { formula: Formula; assignment: Assignment } {
  const newAssignment = new Map(assignment);
  const literals = new Set<number>();
  
  for (const clause of formula) {
    for (const lit of clause) literals.add(lit);
  }
  
  for (const lit of literals) {
    if (!literals.has(-lit)) {
      newAssignment.set(Math.abs(lit), lit > 0);
    }
  }
  
  const newFormula = formula.filter(clause => {
    return !clause.some(lit => {
      const val = newAssignment.get(Math.abs(lit));
      return val !== undefined && (lit > 0 ? val : !val);
    });
  });
  
  return { formula: newFormula, assignment: newAssignment };
}

function dpll(formula: Formula, assignment: Assignment, numVars: number): Assignment | null {
  // Unit propagation
  const unitResult = unitPropagate(formula, assignment);
  if (unitResult === 'conflict') return null;
  
  let { formula: f, assignment: a } = unitResult;
  
  // Pure literal elimination
  const pureResult = pureLiteralElim(f, a);
  f = pureResult.formula;
  a = pureResult.assignment;
  
  // Check if satisfied
  if (f.length === 0) {
    // Assign remaining variables arbitrarily
    for (let v = 1; v <= numVars; v++) {
      if (!a.has(v)) a.set(v, true);
    }
    return a;
  }
  
  // Check for empty clause (conflict)
  if (f.some(c => c.length === 0)) return null;
  
  // Choose unassigned variable (VSIDS-lite: pick most frequent)
  const freq = new Map<number, number>();
  for (const clause of f) {
    for (const lit of clause) {
      const v = Math.abs(lit);
      freq.set(v, (freq.get(v) || 0) + 1);
    }
  }
  
  let chosenVar = 0;
  let maxFreq = 0;
  for (const [v, count] of freq) {
    if (!a.has(v) && count > maxFreq) {
      maxFreq = count;
      chosenVar = v;
    }
  }
  
  if (chosenVar === 0) return a;
  
  // Try true first
  const tryTrue = new Map(a);
  tryTrue.set(chosenVar, true);
  const resultTrue = dpll(f, tryTrue, numVars);
  if (resultTrue) return resultTrue;
  
  // Try false
  const tryFalse = new Map(a);
  tryFalse.set(chosenVar, false);
  return dpll(f, tryFalse, numVars);
}

function solve(formula: Formula, numVars: number): { satisfiable: boolean; assignment?: Record<number, boolean> } {
  const result = dpll(formula, new Map(), numVars);
  if (result) {
    const assignment: Record<number, boolean> = {};
    for (const [v, val] of result) assignment[v] = val;
    return { satisfiable: true, assignment };
  }
  return { satisfiable: false };
}

export const satSolverTool: UnifiedTool = {
  name: 'sat_solver',
  description: 'Boolean satisfiability (SAT) solver using DPLL algorithm - solves NP-complete problems',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['solve', 'solve_dimacs', 'generate', 'info'], description: 'Operation type' },
      clauses: { type: 'array', description: 'Array of clauses, each clause is array of literals (positive=true, negative=negated)' },
      dimacs: { type: 'string', description: 'DIMACS CNF format input' },
      num_vars: { type: 'number', description: 'Number of variables' },
      num_clauses: { type: 'number', description: 'Number of clauses to generate' }
    },
    required: ['operation']
  }
};

export async function executeSatSolver(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    
    switch (args.operation) {
      case 'solve':
        const clauses: Formula = args.clauses || [[1, 2], [-1, 3], [-2, -3]];
        const numVars = args.num_vars || Math.max(...clauses.flat().map(Math.abs));
        result = solve(clauses, numVars);
        break;
      case 'solve_dimacs':
        const { numVars: nv, clauses: cls } = parseDIMACS(args.dimacs || 'p cnf 3 3\n1 2 0\n-1 3 0\n-2 -3 0');
        result = solve(cls, nv);
        break;
      case 'generate':
        const genVars = args.num_vars || 5;
        const genClauses = args.num_clauses || 10;
        const generated: Formula = [];
        for (let i = 0; i < genClauses; i++) {
          const clauseSize = 2 + Math.floor(Math.random() * 2);
          const clause: Clause = [];
          for (let j = 0; j < clauseSize; j++) {
            const v = 1 + Math.floor(Math.random() * genVars);
            clause.push(Math.random() < 0.5 ? v : -v);
          }
          generated.push(clause);
        }
        result = { clauses: generated, numVars: genVars, ...solve(generated, genVars) };
        break;
      case 'info':
      default:
        result = {
          description: 'DPLL-based SAT solver for Boolean satisfiability',
          features: ['Unit propagation', 'Pure literal elimination', 'VSIDS-lite heuristic'],
          complexity: 'NP-complete',
          applications: ['Circuit verification', 'AI planning', 'Cryptanalysis', 'Scheduling']
        };
    }
    
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isSatSolverAvailable(): boolean { return true; }
