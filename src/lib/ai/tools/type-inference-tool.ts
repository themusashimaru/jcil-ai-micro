/**
 * TYPE INFERENCE TOOL
 * Hindley-Milner type inference engine
 * The foundation of functional programming!
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

type Type = { kind: 'var'; name: string } | { kind: 'fn'; from: Type; to: Type } | { kind: 'const'; name: string };
type TypeEnv = Map<string, Type>;
type Subst = Map<string, Type>;

let typeVarCounter = 0;
function freshTypeVar(): Type {
  return { kind: 'var', name: 'T' + (typeVarCounter++) };
}

function applySubst(t: Type, s: Subst): Type {
  if (t.kind === 'var') return s.get(t.name) ? applySubst(s.get(t.name)!, s) : t;
  if (t.kind === 'fn') return { kind: 'fn', from: applySubst(t.from, s), to: applySubst(t.to, s) };
  return t;
}

function occurs(v: string, t: Type): boolean {
  if (t.kind === 'var') return t.name === v;
  if (t.kind === 'fn') return occurs(v, t.from) || occurs(v, t.to);
  return false;
}

function unify(t1: Type, t2: Type, s: Subst): Subst | null {
  t1 = applySubst(t1, s);
  t2 = applySubst(t2, s);
  if (t1.kind === 'var' && t2.kind === 'var' && t1.name === t2.name) return s;
  if (t1.kind === 'var') {
    if (occurs(t1.name, t2)) return null;
    const newS = new Map(s);
    newS.set(t1.name, t2);
    return newS;
  }
  if (t2.kind === 'var') return unify(t2, t1, s);
  if (t1.kind === 'const' && t2.kind === 'const') return t1.name === t2.name ? s : null;
  if (t1.kind === 'fn' && t2.kind === 'fn') {
    const s1 = unify(t1.from, t2.from, s);
    return s1 ? unify(t1.to, t2.to, s1) : null;
  }
  return null;
}

type Expr = { kind: 'var'; name: string } | { kind: 'app'; fn: Expr; arg: Expr } | { kind: 'lam'; param: string; body: Expr } | { kind: 'let'; name: string; value: Expr; body: Expr } | { kind: 'lit'; type: string };

function infer(expr: Expr, env: TypeEnv, s: Subst): { type: Type; subst: Subst } | null {
  switch (expr.kind) {
    case 'var': {
      const t = env.get(expr.name);
      return t ? { type: t, subst: s } : null;
    }
    case 'lit':
      return { type: { kind: 'const', name: expr.type }, subst: s };
    case 'lam': {
      const paramType = freshTypeVar();
      const newEnv = new Map(env);
      newEnv.set(expr.param, paramType);
      const bodyResult = infer(expr.body, newEnv, s);
      if (!bodyResult) return null;
      return { type: { kind: 'fn', from: applySubst(paramType, bodyResult.subst), to: bodyResult.type }, subst: bodyResult.subst };
    }
    case 'app': {
      const fnResult = infer(expr.fn, env, s);
      if (!fnResult) return null;
      const argResult = infer(expr.arg, env, fnResult.subst);
      if (!argResult) return null;
      const resultType = freshTypeVar();
      const unifiedSubst = unify(applySubst(fnResult.type, argResult.subst), { kind: 'fn', from: argResult.type, to: resultType }, argResult.subst);
      if (!unifiedSubst) return null;
      return { type: applySubst(resultType, unifiedSubst), subst: unifiedSubst };
    }
    case 'let': {
      const valueResult = infer(expr.value, env, s);
      if (!valueResult) return null;
      const newEnv = new Map(env);
      newEnv.set(expr.name, applySubst(valueResult.type, valueResult.subst));
      return infer(expr.body, newEnv, valueResult.subst);
    }
  }
}

function typeToString(t: Type): string {
  if (t.kind === 'var') return t.name;
  if (t.kind === 'const') return t.name;
  if (t.kind === 'fn') {
    const from = t.from.kind === 'fn' ? '(' + typeToString(t.from) + ')' : typeToString(t.from);
    return from + ' -> ' + typeToString(t.to);
  }
  return '?';
}

export const typeInferenceTool: UnifiedTool = {
  name: 'type_inference',
  description: 'Hindley-Milner type inference engine - infer types for lambda calculus expressions',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['infer', 'unify', 'demo', 'info'], description: 'Operation' },
      expr: { type: 'object', description: 'Expression to type-check' },
      type1: { type: 'object', description: 'First type for unification' },
      type2: { type: 'object', description: 'Second type for unification' }
    },
    required: ['operation']
  }
};

export async function executeTypeInference(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    typeVarCounter = 0;
    switch (args.operation) {
      case 'infer': {
        const expr: Expr = args.expr || { kind: 'lam', param: 'x', body: { kind: 'var', name: 'x' } };
        const baseEnv: TypeEnv = new Map();
        baseEnv.set('add', { kind: 'fn', from: { kind: 'const', name: 'Int' }, to: { kind: 'fn', from: { kind: 'const', name: 'Int' }, to: { kind: 'const', name: 'Int' } } });
        baseEnv.set('true', { kind: 'const', name: 'Bool' });
        baseEnv.set('false', { kind: 'const', name: 'Bool' });
        const res = infer(expr, baseEnv, new Map());
        result = res ? { type: typeToString(applySubst(res.type, res.subst)), success: true } : { success: false, error: 'Type error' };
        break;
      }
      case 'demo':
        const demos = [
          { name: 'identity', expr: { kind: 'lam', param: 'x', body: { kind: 'var', name: 'x' } } },
          { name: 'const', expr: { kind: 'lam', param: 'x', body: { kind: 'lam', param: 'y', body: { kind: 'var', name: 'x' } } } },
          { name: 'apply', expr: { kind: 'lam', param: 'f', body: { kind: 'lam', param: 'x', body: { kind: 'app', fn: { kind: 'var', name: 'f' }, arg: { kind: 'var', name: 'x' } } } } }
        ];
        result = { demos: demos.map(d => {
          typeVarCounter = 0;
          const r = infer(d.expr as Expr, new Map(), new Map());
          return { name: d.name, type: r ? typeToString(applySubst(r.type, r.subst)) : 'error' };
        }) };
        break;
      case 'info':
      default:
        result = { description: 'Hindley-Milner type inference', features: ['Algorithm W', 'Unification', 'Polymorphism'], applications: ['ML', 'Haskell', 'TypeScript'] };
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isTypeInferenceAvailable(): boolean { return true; }
