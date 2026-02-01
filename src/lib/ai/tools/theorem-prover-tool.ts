/**
 * THEOREM PROVER TOOL
 * Automated theorem proving with resolution and unification
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

type Term = string | { fn: string; args: Term[] };
type Literal = { pred: string; args: Term[]; negated: boolean };
type Clause = Literal[];
type Substitution = Map<string, Term>;

function isVariable(t: Term): t is string {
  return typeof t === 'string' && t[0] >= 'a' && t[0] <= 'z';
}

function applySubst(term: Term, subst: Substitution): Term {
  if (typeof term === 'string') return subst.get(term) || term;
  return { fn: term.fn, args: term.args.map(a => applySubst(a, subst)) };
}

function applySubstLiteral(lit: Literal, subst: Substitution): Literal {
  return { pred: lit.pred, args: lit.args.map(a => applySubst(a, subst)), negated: lit.negated };
}

function occurs(v: string, term: Term): boolean {
  if (typeof term === 'string') return term === v;
  return term.args.some(a => occurs(v, a));
}

function unifyTerms(t1: Term, t2: Term, subst: Substitution): Substitution | null {
  t1 = applySubst(t1, subst);
  t2 = applySubst(t2, subst);
  if (typeof t1 === 'string' && typeof t2 === 'string' && t1 === t2) return subst;
  if (isVariable(t1)) {
    if (occurs(t1, t2)) return null;
    const newSubst = new Map(subst);
    newSubst.set(t1, t2);
    return newSubst;
  }
  if (isVariable(t2)) {
    if (occurs(t2, t1)) return null;
    const newSubst = new Map(subst);
    newSubst.set(t2, t1);
    return newSubst;
  }
  if (typeof t1 === 'object' && typeof t2 === 'object') {
    if (t1.fn !== t2.fn || t1.args.length !== t2.args.length) return null;
    let s: Substitution | null = subst;
    for (let i = 0; i < t1.args.length && s; i++) {
      s = unifyTerms(t1.args[i], t2.args[i], s);
    }
    return s;
  }
  return null;
}

function resolve(c1: Clause, c2: Clause): Clause[] {
  const resolvents: Clause[] = [];
  for (let i = 0; i < c1.length; i++) {
    for (let j = 0; j < c2.length; j++) {
      if (c1[i].pred === c2[j].pred && c1[i].negated !== c2[j].negated) {
        const subst = unifyTerms(c1[i].args[0] || 'x', c2[j].args[0] || 'x', new Map());
        if (subst) {
          const newClause: Clause = [];
          for (let k = 0; k < c1.length; k++) if (k !== i) newClause.push(applySubstLiteral(c1[k], subst));
          for (let k = 0; k < c2.length; k++) if (k !== j) newClause.push(applySubstLiteral(c2[k], subst));
          resolvents.push(newClause);
        }
      }
    }
  }
  return resolvents;
}

function prove(clauses: Clause[], maxSteps: number = 100): { proved: boolean; steps: string[] } {
  const steps: string[] = [];
  const known = new Set<string>();
  const queue = [...clauses];
  steps.push('Starting resolution proof...');
  
  for (let step = 0; step < maxSteps && queue.length > 0; step++) {
    const c1 = queue.shift()!;
    for (const c2 of [...clauses]) {
      const resolvents = resolve(c1, c2);
      for (const resolvent of resolvents) {
        const str = JSON.stringify(resolvent);
        if (!known.has(str)) {
          known.add(str);
          queue.push(resolvent);
          steps.push('Resolved: ' + resolvent.map(l => (l.negated ? 'NOT ' : '') + l.pred).join(' OR '));
          if (resolvent.length === 0) {
            steps.push('Derived empty clause - QED!');
            return { proved: true, steps };
          }
        }
      }
    }
  }
  return { proved: false, steps };
}

export const theoremProverTool: UnifiedTool = {
  name: 'theorem_prover',
  description: 'First-order logic theorem prover using resolution and unification',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['prove', 'unify', 'info'], description: 'Operation' },
      clauses: { type: 'array', description: 'Clauses in CNF' },
      max_steps: { type: 'number', description: 'Max resolution steps' }
    },
    required: ['operation']
  }
};

export async function executeTheoremProver(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'prove':
        const defaultClauses: Clause[] = [
          [{ pred: 'Man', args: ['x'], negated: true }, { pred: 'Mortal', args: ['x'], negated: false }],
          [{ pred: 'Man', args: ['Socrates'], negated: false }],
          [{ pred: 'Mortal', args: ['Socrates'], negated: true }]
        ];
        result = prove(args.clauses || defaultClauses, args.max_steps || 100);
        break;
      case 'info':
      default:
        result = {
          description: 'Resolution-based theorem prover for first-order logic',
          features: ['Unification', 'Resolution rule', 'Refutation proofs'],
          examples: ['Socrates syllogism', 'Mathematical proofs']
        };
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isTheoremProverAvailable(): boolean { return true; }
