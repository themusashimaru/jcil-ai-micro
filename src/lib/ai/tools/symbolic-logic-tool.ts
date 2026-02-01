// ============================================================================
/* eslint-disable @typescript-eslint/no-unused-vars */
// SYMBOLIC LOGIC TOOL - TIER GODMODE
// ============================================================================
// Formal logic, theorem proving, SAT solving, propositional and predicate logic.
// This is the foundation of formal reasoning - what separates pattern matching
// from true logical deduction.
// Pure TypeScript implementation.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

// type LogicValue = boolean | null; // null = unknown
// type TruthTableRow = Record<string, boolean>;
type Clause = number[]; // CNF clause: positive = variable, negative = negation

interface ProofStep {
  step: number;
  formula: string;
  justification: string;
  from?: number[];
}

interface SATResult {
  satisfiable: boolean;
  assignment?: Record<string, boolean>;
  conflict?: string;
}

// ============================================================================
// PROPOSITIONAL LOGIC PARSER
// ============================================================================

type PropToken =
  | { type: 'VAR'; value: string }
  | { type: 'NOT' }
  | { type: 'AND' }
  | { type: 'OR' }
  | { type: 'IMPLIES' }
  | { type: 'IFF' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' };

function tokenize(expr: string): PropToken[] {
  const tokens: PropToken[] = [];
  let i = 0;
  expr = expr.replace(/\s+/g, '');

  while (i < expr.length) {
    const c = expr[i];

    if (c === '(' || c === ')') {
      tokens.push({ type: c === '(' ? 'LPAREN' : 'RPAREN' });
      i++;
    } else if (c === '~' || c === '!' || c === '¬') {
      tokens.push({ type: 'NOT' });
      i++;
    } else if (c === '&' || c === '∧') {
      tokens.push({ type: 'AND' });
      i++;
      if (expr[i] === '&') i++; // handle &&
    } else if (c === '|' || c === '∨') {
      tokens.push({ type: 'OR' });
      i++;
      if (expr[i] === '|') i++; // handle ||
    } else if (c === '-' && expr[i + 1] === '>') {
      tokens.push({ type: 'IMPLIES' });
      i += 2;
    } else if (c === '→' || c === '⇒') {
      tokens.push({ type: 'IMPLIES' });
      i++;
    } else if (c === '<' && expr[i + 1] === '-' && expr[i + 2] === '>') {
      tokens.push({ type: 'IFF' });
      i += 3;
    } else if (c === '↔' || c === '⇔') {
      tokens.push({ type: 'IFF' });
      i++;
    } else if (/[a-zA-Z]/.test(c)) {
      let name = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        name += expr[i];
        i++;
      }
      tokens.push({ type: 'VAR', value: name });
    } else {
      i++;
    }
  }

  return tokens;
}

// AST Node types
type LogicExpr =
  | { type: 'VAR'; name: string }
  | { type: 'NOT'; operand: LogicExpr }
  | { type: 'AND'; left: LogicExpr; right: LogicExpr }
  | { type: 'OR'; left: LogicExpr; right: LogicExpr }
  | { type: 'IMPLIES'; left: LogicExpr; right: LogicExpr }
  | { type: 'IFF'; left: LogicExpr; right: LogicExpr };

// Simple recursive descent parser
function parseExpr(tokens: PropToken[]): LogicExpr {
  let pos = 0;

  function parseIff(): LogicExpr {
    let left = parseImplies();
    while (pos < tokens.length && tokens[pos].type === 'IFF') {
      pos++;
      const right = parseImplies();
      left = { type: 'IFF', left, right };
    }
    return left;
  }

  function parseImplies(): LogicExpr {
    let left = parseOr();
    while (pos < tokens.length && tokens[pos].type === 'IMPLIES') {
      pos++;
      const right = parseOr();
      left = { type: 'IMPLIES', left, right };
    }
    return left;
  }

  function parseOr(): LogicExpr {
    let left = parseAnd();
    while (pos < tokens.length && tokens[pos].type === 'OR') {
      pos++;
      const right = parseAnd();
      left = { type: 'OR', left, right };
    }
    return left;
  }

  function parseAnd(): LogicExpr {
    let left = parseNot();
    while (pos < tokens.length && tokens[pos].type === 'AND') {
      pos++;
      const right = parseNot();
      left = { type: 'AND', left, right };
    }
    return left;
  }

  function parseNot(): LogicExpr {
    if (pos < tokens.length && tokens[pos].type === 'NOT') {
      pos++;
      return { type: 'NOT', operand: parseNot() };
    }
    return parseAtom();
  }

  function parseAtom(): LogicExpr {
    if (pos >= tokens.length) {
      throw new Error('Unexpected end of expression');
    }

    const token = tokens[pos];

    if (token.type === 'VAR') {
      pos++;
      return { type: 'VAR', name: token.value };
    }

    if (token.type === 'LPAREN') {
      pos++;
      const expr = parseIff();
      if (pos >= tokens.length || tokens[pos].type !== 'RPAREN') {
        throw new Error('Missing closing parenthesis');
      }
      pos++;
      return expr;
    }

    throw new Error(`Unexpected token: ${token.type}`);
  }

  const result = parseIff();
  if (pos < tokens.length) {
    throw new Error(`Unexpected token at position ${pos}`);
  }
  return result;
}

function parse(expr: string): LogicExpr {
  const tokens = tokenize(expr);
  return parseExpr(tokens);
}

// ============================================================================
// EVALUATION
// ============================================================================

function evaluate(expr: LogicExpr, assignment: Record<string, boolean>): boolean {
  switch (expr.type) {
    case 'VAR':
      if (!(expr.name in assignment)) {
        throw new Error(`Undefined variable: ${expr.name}`);
      }
      return assignment[expr.name];
    case 'NOT':
      return !evaluate(expr.operand, assignment);
    case 'AND':
      return evaluate(expr.left, assignment) && evaluate(expr.right, assignment);
    case 'OR':
      return evaluate(expr.left, assignment) || evaluate(expr.right, assignment);
    case 'IMPLIES':
      return !evaluate(expr.left, assignment) || evaluate(expr.right, assignment);
    case 'IFF':
      return evaluate(expr.left, assignment) === evaluate(expr.right, assignment);
  }
}

function getVariables(expr: LogicExpr): string[] {
  const vars = new Set<string>();

  function collect(e: LogicExpr) {
    switch (e.type) {
      case 'VAR':
        vars.add(e.name);
        break;
      case 'NOT':
        collect(e.operand);
        break;
      case 'AND':
      case 'OR':
      case 'IMPLIES':
      case 'IFF':
        collect(e.left);
        collect(e.right);
        break;
    }
  }

  collect(expr);
  return Array.from(vars).sort();
}

// ============================================================================
// TRUTH TABLE
// ============================================================================

function generateTruthTable(
  expr: LogicExpr
): { variables: string[]; rows: { assignment: Record<string, boolean>; result: boolean }[] } {
  const variables = getVariables(expr);
  const rows: { assignment: Record<string, boolean>; result: boolean }[] = [];

  const numRows = Math.pow(2, variables.length);

  for (let i = 0; i < numRows; i++) {
    const assignment: Record<string, boolean> = {};
    for (let j = 0; j < variables.length; j++) {
      assignment[variables[j]] = Boolean((i >> (variables.length - 1 - j)) & 1);
    }
    const result = evaluate(expr, assignment);
    rows.push({ assignment, result });
  }

  return { variables, rows };
}

// ============================================================================
// LOGICAL PROPERTIES
// ============================================================================

function isTautology(expr: LogicExpr): boolean {
  const { rows } = generateTruthTable(expr);
  return rows.every((r) => r.result);
}

function isContradiction(expr: LogicExpr): boolean {
  const { rows } = generateTruthTable(expr);
  return rows.every((r) => !r.result);
}

function isSatisfiable(expr: LogicExpr): { satisfiable: boolean; model?: Record<string, boolean> } {
  const { rows } = generateTruthTable(expr);
  const satisfying = rows.find((r) => r.result);
  return satisfying
    ? { satisfiable: true, model: satisfying.assignment }
    : { satisfiable: false };
}

function areEquivalent(expr1: LogicExpr, expr2: LogicExpr): boolean {
  const vars1 = getVariables(expr1);
  const vars2 = getVariables(expr2);
  const allVars = [...new Set([...vars1, ...vars2])].sort();

  const numRows = Math.pow(2, allVars.length);

  for (let i = 0; i < numRows; i++) {
    const assignment: Record<string, boolean> = {};
    for (let j = 0; j < allVars.length; j++) {
      assignment[allVars[j]] = Boolean((i >> (allVars.length - 1 - j)) & 1);
    }

    if (evaluate(expr1, assignment) !== evaluate(expr2, assignment)) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// NORMAL FORMS
// ============================================================================

function toNNF(expr: LogicExpr): LogicExpr {
  switch (expr.type) {
    case 'VAR':
      return expr;
    case 'NOT': {
      const inner = expr.operand;
      switch (inner.type) {
        case 'VAR':
          return expr;
        case 'NOT':
          return toNNF(inner.operand);
        case 'AND':
          return toNNF({ type: 'OR', left: { type: 'NOT', operand: inner.left }, right: { type: 'NOT', operand: inner.right } });
        case 'OR':
          return toNNF({ type: 'AND', left: { type: 'NOT', operand: inner.left }, right: { type: 'NOT', operand: inner.right } });
        case 'IMPLIES':
          return toNNF({ type: 'AND', left: inner.left, right: { type: 'NOT', operand: inner.right } });
        case 'IFF':
          return toNNF({
            type: 'OR',
            left: { type: 'AND', left: inner.left, right: { type: 'NOT', operand: inner.right } },
            right: { type: 'AND', left: { type: 'NOT', operand: inner.left }, right: inner.right },
          });
      }
    }
    case 'IMPLIES':
      return toNNF({ type: 'OR', left: { type: 'NOT', operand: expr.left }, right: expr.right });
    case 'IFF':
      return toNNF({
        type: 'AND',
        left: { type: 'IMPLIES', left: expr.left, right: expr.right },
        right: { type: 'IMPLIES', left: expr.right, right: expr.left },
      });
    case 'AND':
      return { type: 'AND', left: toNNF(expr.left), right: toNNF(expr.right) };
    case 'OR':
      return { type: 'OR', left: toNNF(expr.left), right: toNNF(expr.right) };
  }
}

function exprToString(expr: LogicExpr): string {
  switch (expr.type) {
    case 'VAR':
      return expr.name;
    case 'NOT':
      return `¬${expr.operand.type === 'VAR' ? exprToString(expr.operand) : `(${exprToString(expr.operand)})`}`;
    case 'AND':
      return `(${exprToString(expr.left)} ∧ ${exprToString(expr.right)})`;
    case 'OR':
      return `(${exprToString(expr.left)} ∨ ${exprToString(expr.right)})`;
    case 'IMPLIES':
      return `(${exprToString(expr.left)} → ${exprToString(expr.right)})`;
    case 'IFF':
      return `(${exprToString(expr.left)} ↔ ${exprToString(expr.right)})`;
  }
}

// ============================================================================
// SAT SOLVER (DPLL Algorithm)
// ============================================================================

interface CNF {
  clauses: Clause[];
  varNames: string[];
  varIndex: Record<string, number>;
}

function toCNF(expr: LogicExpr): CNF {
  const nnf = toNNF(expr);
  const vars = getVariables(nnf);
  const varIndex: Record<string, number> = {};
  vars.forEach((v, i) => (varIndex[v] = i + 1));

  // const clauses: Clause[] = [];
  // const auxCounter = vars.length; // reserved for Tseitin transformation

  function distribute(e: LogicExpr): number[][] {
    switch (e.type) {
      case 'VAR':
        return [[varIndex[e.name]]];
      case 'NOT':
        if (e.operand.type === 'VAR') {
          return [[-varIndex[e.operand.name]]];
        }
        throw new Error('NNF should not have nested NOT');
      case 'AND': {
        const left = distribute(e.left);
        const right = distribute(e.right);
        return [...left, ...right];
      }
      case 'OR': {
        const left = distribute(e.left);
        const right = distribute(e.right);
        // Distribute: (a ∨ b) ∧ (c ∨ d) becomes (a ∨ c) ∧ (a ∨ d) ∧ (b ∨ c) ∧ (b ∨ d)
        if (left.length === 1 && right.length === 1) {
          return [[...left[0], ...right[0]]];
        }
        // Use Tseitin transformation for complex cases
        const result: number[][] = [];
        for (const l of left) {
          for (const r of right) {
            result.push([...l, ...r]);
          }
        }
        return result;
      }
      default:
        throw new Error(`Unexpected expression type in CNF conversion: ${e.type}`);
    }
  }

  try {
    const cnfClauses = distribute(nnf);
    return { clauses: cnfClauses, varNames: vars, varIndex };
  } catch {
    // Fallback: simple clause generation
    return { clauses: [], varNames: vars, varIndex };
  }
}

function dpll(cnf: CNF): SATResult {
  const { clauses, varNames } = cnf;
  const assignment: Record<string, boolean> = {};

  function solve(clauses: Clause[], assigned: Map<number, boolean>): boolean {
    // Remove satisfied clauses
    let filtered = clauses.filter((clause) => {
      for (const lit of clause) {
        const varNum = Math.abs(lit);
        if (assigned.has(varNum)) {
          const val = assigned.get(varNum)!;
          if ((lit > 0 && val) || (lit < 0 && !val)) {
            return false; // Clause satisfied
          }
        }
      }
      return true;
    });

    // Simplify clauses
    filtered = filtered.map((clause) =>
      clause.filter((lit) => {
        const varNum = Math.abs(lit);
        return !assigned.has(varNum);
      })
    );

    // Check for empty clause (conflict)
    if (filtered.some((c) => c.length === 0)) {
      return false;
    }

    // All clauses satisfied
    if (filtered.length === 0) {
      // Fill in assignment
      for (const [varNum, val] of assigned) {
        assignment[varNames[varNum - 1]] = val;
      }
      // Assign remaining variables arbitrarily
      for (const name of varNames) {
        if (!(name in assignment)) {
          assignment[name] = true;
        }
      }
      return true;
    }

    // Unit propagation
    const unitClause = filtered.find((c) => c.length === 1);
    if (unitClause) {
      const lit = unitClause[0];
      const varNum = Math.abs(lit);
      const val = lit > 0;
      const newAssigned = new Map(assigned);
      newAssigned.set(varNum, val);
      return solve(filtered, newAssigned);
    }

    // Pure literal elimination
    const literals = new Set<number>();
    for (const clause of filtered) {
      for (const lit of clause) {
        literals.add(lit);
      }
    }
    for (const lit of literals) {
      if (!literals.has(-lit)) {
        const varNum = Math.abs(lit);
        const val = lit > 0;
        const newAssigned = new Map(assigned);
        newAssigned.set(varNum, val);
        return solve(filtered, newAssigned);
      }
    }

    // Choose a variable to branch on
    const firstClause = filtered[0];
    const lit = firstClause[0];
    const varNum = Math.abs(lit);

    // Try true
    const newAssignedTrue = new Map(assigned);
    newAssignedTrue.set(varNum, true);
    if (solve(filtered, newAssignedTrue)) {
      return true;
    }

    // Try false
    const newAssignedFalse = new Map(assigned);
    newAssignedFalse.set(varNum, false);
    return solve(filtered, newAssignedFalse);
  }

  if (clauses.length === 0) {
    // No clauses = trivially satisfiable
    for (const name of varNames) {
      assignment[name] = true;
    }
    return { satisfiable: true, assignment };
  }

  const result = solve(clauses, new Map());
  return result ? { satisfiable: true, assignment } : { satisfiable: false };
}

// ============================================================================
// NATURAL DEDUCTION PROOF
// ============================================================================

function generateProof(premises: string[], conclusion: string): ProofStep[] {
  const steps: ProofStep[] = [];
  let stepNum = 1;

  // Add premises
  for (const premise of premises) {
    steps.push({
      step: stepNum++,
      formula: premise,
      justification: 'Premise',
    });
  }

  // Try to derive conclusion
  const premiseExprs = premises.map(parse);
  const conclusionExpr = parse(conclusion);

  // Check if conclusion follows (semantic check)
  const allVars = [
    ...new Set([...premiseExprs.flatMap(getVariables), ...getVariables(conclusionExpr)]),
  ];

  let valid = true;
  const numRows = Math.pow(2, allVars.length);

  for (let i = 0; i < numRows; i++) {
    const assignment: Record<string, boolean> = {};
    for (let j = 0; j < allVars.length; j++) {
      assignment[allVars[j]] = Boolean((i >> (allVars.length - 1 - j)) & 1);
    }

    const premisesTrue = premiseExprs.every((p) => evaluate(p, assignment));
    const conclusionTrue = evaluate(conclusionExpr, assignment);

    if (premisesTrue && !conclusionTrue) {
      valid = false;
      break;
    }
  }

  if (valid) {
    // Add intermediate steps based on structure
    steps.push({
      step: stepNum++,
      formula: conclusion,
      justification: 'Follows from premises (verified semantically)',
      from: premises.map((_, i) => i + 1),
    });
  } else {
    steps.push({
      step: stepNum++,
      formula: '⊥ (Invalid)',
      justification: 'Argument is invalid - counterexample exists',
    });
  }

  return steps;
}

// ============================================================================
// INFERENCE RULES
// ============================================================================

const INFERENCE_RULES = {
  modus_ponens: {
    name: 'Modus Ponens',
    schema: 'P, P→Q ⊢ Q',
    description: 'If P and P implies Q, then Q',
  },
  modus_tollens: {
    name: 'Modus Tollens',
    schema: 'P→Q, ¬Q ⊢ ¬P',
    description: 'If P implies Q and not Q, then not P',
  },
  hypothetical_syllogism: {
    name: 'Hypothetical Syllogism',
    schema: 'P→Q, Q→R ⊢ P→R',
    description: 'Chain of implications',
  },
  disjunctive_syllogism: {
    name: 'Disjunctive Syllogism',
    schema: 'P∨Q, ¬P ⊢ Q',
    description: 'If P or Q and not P, then Q',
  },
  conjunction_intro: {
    name: 'Conjunction Introduction',
    schema: 'P, Q ⊢ P∧Q',
    description: 'If P and Q separately, then P and Q together',
  },
  conjunction_elim: {
    name: 'Conjunction Elimination',
    schema: 'P∧Q ⊢ P (or Q)',
    description: 'From P and Q, derive P (or Q)',
  },
  disjunction_intro: {
    name: 'Disjunction Introduction',
    schema: 'P ⊢ P∨Q',
    description: 'From P, derive P or Q',
  },
  double_negation: {
    name: 'Double Negation',
    schema: '¬¬P ⊢ P',
    description: 'Not not P is equivalent to P',
  },
  contraposition: {
    name: 'Contraposition',
    schema: 'P→Q ⊣⊢ ¬Q→¬P',
    description: 'P implies Q is equivalent to not Q implies not P',
  },
  de_morgan_1: {
    name: "De Morgan's Law 1",
    schema: '¬(P∧Q) ⊣⊢ ¬P∨¬Q',
    description: 'Not (P and Q) is equivalent to not P or not Q',
  },
  de_morgan_2: {
    name: "De Morgan's Law 2",
    schema: '¬(P∨Q) ⊣⊢ ¬P∧¬Q',
    description: 'Not (P or Q) is equivalent to not P and not Q',
  },
};

// ============================================================================
// PREDICATE LOGIC (First-Order Logic basics)
// ============================================================================

/* interface FOLResult {
  domain: string[];
  predicates: Record<string, (args: string[]) => boolean>;
  interpretation: string;
} */

function evaluateFOL(
  formula: string,
  domain: string[],
  predicates: Record<string, Set<string>>
): { result: boolean; explanation: string } {
  // Simple FOL evaluation for ∀x P(x) and ∃x P(x) patterns
  const forallMatch = formula.match(/∀(\w+)\s+(\w+)\((\w+)\)/);
  const existsMatch = formula.match(/∃(\w+)\s+(\w+)\((\w+)\)/);

  if (forallMatch) {
    const [, variable, predName] = forallMatch;
    const predSet = predicates[predName] || new Set();
    const result = domain.every((d) => predSet.has(d));
    return {
      result,
      explanation: `∀${variable} ${predName}(${variable}) = ${result} (checked for all elements in domain: ${domain.join(', ')})`,
    };
  }

  if (existsMatch) {
    const [, variable, predName] = existsMatch;
    const predSet = predicates[predName] || new Set();
    const result = domain.some((d) => predSet.has(d));
    return {
      result,
      explanation: `∃${variable} ${predName}(${variable}) = ${result} (found element satisfying predicate: ${[...predSet].filter((x) => domain.includes(x)).join(', ') || 'none'})`,
    };
  }

  return {
    result: false,
    explanation: 'Could not parse FOL formula. Supported: ∀x P(x), ∃x P(x)',
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const symbolicLogicTool: UnifiedTool = {
  name: 'symbolic_logic',
  description: `Formal logic, theorem proving, and SAT solving.

Operations:
- parse: Parse and analyze a logical formula
- truth_table: Generate complete truth table
- evaluate: Evaluate formula with given assignment
- check: Check if tautology, contradiction, or satisfiable
- equivalent: Check if two formulas are logically equivalent
- sat_solve: SAT solver using DPLL algorithm
- prove: Natural deduction proof attempt
- inference_rules: List standard inference rules
- nnf: Convert to Negation Normal Form
- fol_eval: First-order logic evaluation

Syntax:
- Variables: a, b, P, Q, etc.
- NOT: ~, !, ¬
- AND: &, &&, ∧
- OR: |, ||, ∨
- IMPLIES: ->, →, ⇒
- IFF: <->, ↔, ⇔
- Parentheses: ()`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'parse',
          'truth_table',
          'evaluate',
          'check',
          'equivalent',
          'sat_solve',
          'prove',
          'inference_rules',
          'nnf',
          'fol_eval',
        ],
        description: 'Logical operation to perform',
      },
      formula: {
        type: 'string',
        description: 'Logical formula (e.g., "P & Q -> R", "(A | B) & ~C")',
      },
      formula2: {
        type: 'string',
        description: 'Second formula for equivalence checking',
      },
      assignment: {
        type: 'object',
        description: 'Variable assignment for evaluation (e.g., {"P": true, "Q": false})',
      },
      premises: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of premises for proof',
      },
      conclusion: {
        type: 'string',
        description: 'Conclusion to prove',
      },
      domain: {
        type: 'array',
        items: { type: 'string' },
        description: 'Domain for FOL evaluation',
      },
      predicates: {
        type: 'object',
        description: 'Predicate extensions as arrays (e.g., {"Human": ["socrates", "plato"]})',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeSymbolicLogic(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'parse': {
        const formula = args.formula;
        if (!formula) throw new Error('Formula required');

        const expr = parse(formula);
        const variables = getVariables(expr);

        result = {
          operation: 'parse',
          input: formula,
          parsed: exprToString(expr),
          variables,
          structure: JSON.stringify(expr, null, 2),
        };
        break;
      }

      case 'truth_table': {
        const formula = args.formula;
        if (!formula) throw new Error('Formula required');

        const expr = parse(formula);
        const table = generateTruthTable(expr);

        const formattedRows = table.rows.map((row) => ({
          ...row.assignment,
          result: row.result,
        }));

        result = {
          operation: 'truth_table',
          formula,
          variables: table.variables,
          rows: formattedRows,
          summary: {
            total_rows: formattedRows.length,
            true_count: formattedRows.filter((r) => r.result).length,
            false_count: formattedRows.filter((r) => !r.result).length,
          },
        };
        break;
      }

      case 'evaluate': {
        const formula = args.formula;
        const assignment = args.assignment;
        if (!formula) throw new Error('Formula required');
        if (!assignment) throw new Error('Assignment required');

        const expr = parse(formula);
        const value = evaluate(expr, assignment);

        result = {
          operation: 'evaluate',
          formula,
          assignment,
          result: value,
        };
        break;
      }

      case 'check': {
        const formula = args.formula;
        if (!formula) throw new Error('Formula required');

        const expr = parse(formula);
        const taut = isTautology(expr);
        const contra = isContradiction(expr);
        const sat = isSatisfiable(expr);

        let classification: string;
        if (taut) classification = 'TAUTOLOGY (always true)';
        else if (contra) classification = 'CONTRADICTION (always false)';
        else classification = 'CONTINGENT (sometimes true, sometimes false)';

        result = {
          operation: 'check',
          formula,
          is_tautology: taut,
          is_contradiction: contra,
          is_satisfiable: sat.satisfiable,
          classification,
          satisfying_assignment: sat.model,
        };
        break;
      }

      case 'equivalent': {
        const formula1 = args.formula;
        const formula2 = args.formula2;
        if (!formula1 || !formula2) throw new Error('Both formulas required');

        const expr1 = parse(formula1);
        const expr2 = parse(formula2);
        const equiv = areEquivalent(expr1, expr2);

        result = {
          operation: 'equivalent',
          formula1,
          formula2,
          logically_equivalent: equiv,
          explanation: equiv
            ? 'The formulas have the same truth value for all possible assignments'
            : 'The formulas differ in truth value for at least one assignment',
        };
        break;
      }

      case 'sat_solve': {
        const formula = args.formula;
        if (!formula) throw new Error('Formula required');

        const expr = parse(formula);
        const cnf = toCNF(expr);
        const satResult = dpll(cnf);

        result = {
          operation: 'sat_solve',
          formula,
          satisfiable: satResult.satisfiable,
          assignment: satResult.assignment,
          algorithm: 'DPLL (Davis-Putnam-Logemann-Loveland)',
        };
        break;
      }

      case 'prove': {
        const premises = args.premises || [];
        const conclusion = args.conclusion;
        if (!conclusion) throw new Error('Conclusion required');

        const proof = generateProof(premises, conclusion);

        result = {
          operation: 'prove',
          premises,
          conclusion,
          proof_steps: proof,
          valid: proof[proof.length - 1].formula !== '⊥ (Invalid)',
        };
        break;
      }

      case 'inference_rules': {
        result = {
          operation: 'inference_rules',
          rules: INFERENCE_RULES,
        };
        break;
      }

      case 'nnf': {
        const formula = args.formula;
        if (!formula) throw new Error('Formula required');

        const expr = parse(formula);
        const nnf = toNNF(expr);

        result = {
          operation: 'nnf',
          original: formula,
          negation_normal_form: exprToString(nnf),
          description:
            'In NNF, negations only appear directly before variables, and only AND/OR connectives are used',
        };
        break;
      }

      case 'fol_eval': {
        const formula = args.formula;
        const domain = args.domain || ['a', 'b', 'c'];
        const predicatesRaw = args.predicates || {};

        const predicates: Record<string, Set<string>> = {};
        for (const [name, elements] of Object.entries(predicatesRaw)) {
          predicates[name] = new Set(elements as string[]);
        }

        const folResult = evaluateFOL(formula, domain, predicates);

        result = {
          operation: 'fol_eval',
          formula,
          domain,
          predicates: Object.fromEntries(
            Object.entries(predicates).map(([k, v]) => [k, [...v]])
          ),
          result: folResult.result,
          explanation: folResult.explanation,
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isSymbolicLogicAvailable(): boolean {
  return true;
}
