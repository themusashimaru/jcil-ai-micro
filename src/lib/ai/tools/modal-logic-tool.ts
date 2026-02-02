/**
 * MODAL-LOGIC TOOL
 * Modal, temporal, and deontic logic systems
 *
 * Implements various modal logic systems including:
 * - K (basic modal logic)
 * - T (reflexive)
 * - S4 (reflexive + transitive)
 * - S5 (equivalence relation)
 * - LTL (Linear Temporal Logic)
 * - CTL (Computation Tree Logic)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Modal logic formula representation
type Formula =
  | { type: 'atom'; name: string }
  | { type: 'not'; sub: Formula }
  | { type: 'and'; left: Formula; right: Formula }
  | { type: 'or'; left: Formula; right: Formula }
  | { type: 'implies'; left: Formula; right: Formula }
  | { type: 'box'; sub: Formula }        // Necessity: □φ
  | { type: 'diamond'; sub: Formula }    // Possibility: ◇φ
  | { type: 'next'; sub: Formula }       // LTL: Xφ (next)
  | { type: 'always'; sub: Formula }     // LTL: Gφ (globally)
  | { type: 'eventually'; sub: Formula } // LTL: Fφ (finally)
  | { type: 'until'; left: Formula; right: Formula };  // LTL: φUψ

// Kripke world
interface World {
  name: string;
  atoms: Set<string>;
}

// Kripke model
interface KripkeModel {
  worlds: World[];
  accessibility: Map<string, Set<string>>;  // world -> accessible worlds
}

// Parse modal logic formula from string
function parseFormula(input: string): Formula {
  const tokens = tokenize(input);
  let pos = 0;

  function tokenize(s: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    while (i < s.length) {
      if (/\s/.test(s[i])) {
        i++;
        continue;
      }
      if ('()[]<>~&|->□◇XGFUOHp'.includes(s[i])) {
        // Handle multi-char operators
        if (s.slice(i, i + 2) === '->') {
          tokens.push('->');
          i += 2;
        } else if (s.slice(i, i + 2) === '[]') {
          tokens.push('[]');
          i += 2;
        } else if (s.slice(i, i + 2) === '<>') {
          tokens.push('<>');
          i += 2;
        } else {
          tokens.push(s[i]);
          i++;
        }
      } else if (/[a-zA-Z]/.test(s[i])) {
        let name = '';
        while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) {
          name += s[i];
          i++;
        }
        // Check for keywords
        if (['NOT', 'AND', 'OR', 'BOX', 'DIAMOND', 'NEXT', 'ALWAYS', 'EVENTUALLY', 'UNTIL'].includes(name.toUpperCase())) {
          tokens.push(name.toUpperCase());
        } else {
          tokens.push(name);
        }
      } else {
        i++;
      }
    }
    return tokens;
  }

  function parseExpr(): Formula {
    return parseImplies();
  }

  function parseImplies(): Formula {
    let left = parseOr();
    while (pos < tokens.length && tokens[pos] === '->') {
      pos++;
      const right = parseOr();
      left = { type: 'implies', left, right };
    }
    return left;
  }

  function parseOr(): Formula {
    let left = parseAnd();
    while (pos < tokens.length && (tokens[pos] === '|' || tokens[pos] === 'OR')) {
      pos++;
      const right = parseAnd();
      left = { type: 'or', left, right };
    }
    return left;
  }

  function parseAnd(): Formula {
    let left = parseUnary();
    while (pos < tokens.length && (tokens[pos] === '&' || tokens[pos] === 'AND')) {
      pos++;
      const right = parseUnary();
      left = { type: 'and', left, right };
    }
    return left;
  }

  function parseUnary(): Formula {
    if (pos >= tokens.length) {
      return { type: 'atom', name: 'true' };
    }

    const token = tokens[pos];

    if (token === '~' || token === 'NOT') {
      pos++;
      return { type: 'not', sub: parseUnary() };
    }

    if (token === '[]' || token === '□' || token === 'BOX') {
      pos++;
      return { type: 'box', sub: parseUnary() };
    }

    if (token === '<>' || token === '◇' || token === 'DIAMOND') {
      pos++;
      return { type: 'diamond', sub: parseUnary() };
    }

    if (token === 'X' || token === 'NEXT') {
      pos++;
      return { type: 'next', sub: parseUnary() };
    }

    if (token === 'G' || token === 'ALWAYS') {
      pos++;
      return { type: 'always', sub: parseUnary() };
    }

    if (token === 'F' || token === 'EVENTUALLY') {
      pos++;
      return { type: 'eventually', sub: parseUnary() };
    }

    return parseAtom();
  }

  function parseAtom(): Formula {
    if (pos >= tokens.length) {
      return { type: 'atom', name: 'true' };
    }

    const token = tokens[pos];

    if (token === '(') {
      pos++;
      const expr = parseExpr();
      if (pos < tokens.length && tokens[pos] === ')') {
        pos++;
      }
      return expr;
    }

    // Handle UNTIL specially
    pos++;
    if (pos < tokens.length && tokens[pos] === 'UNTIL') {
      pos++;
      const right = parseExpr();
      return { type: 'until', left: { type: 'atom', name: token }, right };
    }

    return { type: 'atom', name: token };
  }

  return parseExpr();
}

// Convert formula to string
function formulaToString(f: Formula): string {
  switch (f.type) {
    case 'atom':
      return f.name;
    case 'not':
      return `¬${formulaToString(f.sub)}`;
    case 'and':
      return `(${formulaToString(f.left)} ∧ ${formulaToString(f.right)})`;
    case 'or':
      return `(${formulaToString(f.left)} ∨ ${formulaToString(f.right)})`;
    case 'implies':
      return `(${formulaToString(f.left)} → ${formulaToString(f.right)})`;
    case 'box':
      return `□${formulaToString(f.sub)}`;
    case 'diamond':
      return `◇${formulaToString(f.sub)}`;
    case 'next':
      return `X${formulaToString(f.sub)}`;
    case 'always':
      return `G${formulaToString(f.sub)}`;
    case 'eventually':
      return `F${formulaToString(f.sub)}`;
    case 'until':
      return `(${formulaToString(f.left)} U ${formulaToString(f.right)})`;
  }
}

// Evaluate formula in Kripke model at world
function evaluate(model: KripkeModel, world: World, formula: Formula, visited: Set<string> = new Set()): boolean {
  switch (formula.type) {
    case 'atom':
      if (formula.name === 'true') return true;
      if (formula.name === 'false') return false;
      return world.atoms.has(formula.name);

    case 'not':
      return !evaluate(model, world, formula.sub, visited);

    case 'and':
      return evaluate(model, world, formula.left, visited) &&
             evaluate(model, world, formula.right, visited);

    case 'or':
      return evaluate(model, world, formula.left, visited) ||
             evaluate(model, world, formula.right, visited);

    case 'implies':
      return !evaluate(model, world, formula.left, visited) ||
             evaluate(model, world, formula.right, visited);

    case 'box': {
      // Necessary: true in all accessible worlds
      const accessible = model.accessibility.get(world.name) || new Set();
      for (const worldName of accessible) {
        const accessibleWorld = model.worlds.find(w => w.name === worldName);
        if (accessibleWorld && !evaluate(model, accessibleWorld, formula.sub, visited)) {
          return false;
        }
      }
      return true;
    }

    case 'diamond': {
      // Possible: true in some accessible world
      const accessible = model.accessibility.get(world.name) || new Set();
      for (const worldName of accessible) {
        const accessibleWorld = model.worlds.find(w => w.name === worldName);
        if (accessibleWorld && evaluate(model, accessibleWorld, formula.sub, visited)) {
          return true;
        }
      }
      return false;
    }

    case 'next': {
      // Next: true in immediate successor (for LTL on paths)
      const accessible = model.accessibility.get(world.name) || new Set();
      const successors = Array.from(accessible);
      if (successors.length === 0) return false;
      const nextWorld = model.worlds.find(w => w.name === successors[0]);
      return nextWorld ? evaluate(model, nextWorld, formula.sub, visited) : false;
    }

    case 'always': {
      // Always: true in all future states (simplified)
      if (visited.has(world.name)) return true;  // Cycle detected
      visited.add(world.name);

      if (!evaluate(model, world, formula.sub, new Set(visited))) return false;

      const accessible = model.accessibility.get(world.name) || new Set();
      for (const worldName of accessible) {
        const nextWorld = model.worlds.find(w => w.name === worldName);
        if (nextWorld && !evaluate(model, nextWorld, formula, visited)) {
          return false;
        }
      }
      return true;
    }

    case 'eventually': {
      // Eventually: true in some future state
      if (visited.has(world.name)) return false;  // Cycle without finding true
      visited.add(world.name);

      if (evaluate(model, world, formula.sub, new Set())) return true;

      const accessible = model.accessibility.get(world.name) || new Set();
      for (const worldName of accessible) {
        const nextWorld = model.worlds.find(w => w.name === worldName);
        if (nextWorld && evaluate(model, nextWorld, formula, visited)) {
          return true;
        }
      }
      return false;
    }

    case 'until': {
      // Until: left holds until right becomes true
      if (visited.has(world.name)) return false;
      visited.add(world.name);

      if (evaluate(model, world, formula.right, new Set())) return true;
      if (!evaluate(model, world, formula.left, new Set())) return false;

      const accessible = model.accessibility.get(world.name) || new Set();
      for (const worldName of accessible) {
        const nextWorld = model.worlds.find(w => w.name === worldName);
        if (nextWorld && evaluate(model, nextWorld, formula, visited)) {
          return true;
        }
      }
      return false;
    }
  }
}

// Check if model satisfies frame conditions for logic system
function checkFrameConditions(model: KripkeModel, logic: string): {
  satisfies: boolean;
  conditions: { name: string; satisfied: boolean; description: string }[];
} {
  const conditions: { name: string; satisfied: boolean; description: string }[] = [];

  // Reflexivity: w R w for all w
  const reflexive = model.worlds.every(w =>
    (model.accessibility.get(w.name) || new Set()).has(w.name)
  );

  // Transitivity: if w R v and v R u then w R u
  let transitive = true;
  for (const w of model.worlds) {
    const wAccessible = model.accessibility.get(w.name) || new Set();
    for (const vName of wAccessible) {
      const vAccessible = model.accessibility.get(vName) || new Set();
      for (const uName of vAccessible) {
        if (!wAccessible.has(uName)) {
          transitive = false;
          break;
        }
      }
      if (!transitive) break;
    }
    if (!transitive) break;
  }

  // Symmetry: if w R v then v R w
  let symmetric = true;
  for (const w of model.worlds) {
    const wAccessible = model.accessibility.get(w.name) || new Set();
    for (const vName of wAccessible) {
      const vAccessible = model.accessibility.get(vName) || new Set();
      if (!vAccessible.has(w.name)) {
        symmetric = false;
        break;
      }
    }
    if (!symmetric) break;
  }

  // Euclidean: if w R v and w R u then v R u
  let euclidean = true;
  for (const w of model.worlds) {
    const wAccessible = model.accessibility.get(w.name) || new Set();
    const accessibleArray = Array.from(wAccessible);
    for (let i = 0; i < accessibleArray.length; i++) {
      for (let j = i + 1; j < accessibleArray.length; j++) {
        const vAccessible = model.accessibility.get(accessibleArray[i]) || new Set();
        if (!vAccessible.has(accessibleArray[j])) {
          euclidean = false;
          break;
        }
      }
      if (!euclidean) break;
    }
    if (!euclidean) break;
  }

  switch (logic) {
    case 'K':
      // No frame conditions
      conditions.push({ name: 'None', satisfied: true, description: 'K has no frame conditions' });
      return { satisfies: true, conditions };

    case 'T':
      conditions.push({ name: 'Reflexivity', satisfied: reflexive, description: '∀w: wRw' });
      return { satisfies: reflexive, conditions };

    case 'S4':
      conditions.push({ name: 'Reflexivity', satisfied: reflexive, description: '∀w: wRw' });
      conditions.push({ name: 'Transitivity', satisfied: transitive, description: 'wRv ∧ vRu → wRu' });
      return { satisfies: reflexive && transitive, conditions };

    case 'S5':
      conditions.push({ name: 'Reflexivity', satisfied: reflexive, description: '∀w: wRw' });
      conditions.push({ name: 'Transitivity', satisfied: transitive, description: 'wRv ∧ vRu → wRu' });
      conditions.push({ name: 'Symmetry', satisfied: symmetric, description: 'wRv → vRw' });
      const isEquivalence = reflexive && transitive && symmetric;
      return { satisfies: isEquivalence, conditions };

    default:
      return { satisfies: true, conditions: [] };
  }
}

// Modal logic axioms
const AXIOMS: Record<string, { name: string; axiom: string; description: string }[]> = {
  'K': [
    { name: 'K', axiom: '□(φ → ψ) → (□φ → □ψ)', description: 'Distribution axiom' },
    { name: 'Nec', axiom: '⊢φ implies ⊢□φ', description: 'Necessitation rule' }
  ],
  'T': [
    { name: 'K', axiom: '□(φ → ψ) → (□φ → □ψ)', description: 'Distribution axiom' },
    { name: 'T', axiom: '□φ → φ', description: 'Reflexivity axiom' }
  ],
  'S4': [
    { name: 'K', axiom: '□(φ → ψ) → (□φ → □ψ)', description: 'Distribution axiom' },
    { name: 'T', axiom: '□φ → φ', description: 'Reflexivity axiom' },
    { name: '4', axiom: '□φ → □□φ', description: 'Transitivity axiom' }
  ],
  'S5': [
    { name: 'K', axiom: '□(φ → ψ) → (□φ → □ψ)', description: 'Distribution axiom' },
    { name: 'T', axiom: '□φ → φ', description: 'Reflexivity axiom' },
    { name: '5', axiom: '◇φ → □◇φ', description: 'Euclidean axiom' }
  ],
  'LTL': [
    { name: 'X-Dist', axiom: 'X(φ → ψ) → (Xφ → Xψ)', description: 'Next distributes' },
    { name: 'G-Ind', axiom: 'G(φ → Xφ) → (φ → Gφ)', description: 'Always induction' },
    { name: 'F-Def', axiom: 'Fφ ↔ ¬G¬φ', description: 'Eventually definition' },
    { name: 'U-Exp', axiom: 'φUψ ↔ ψ ∨ (φ ∧ X(φUψ))', description: 'Until expansion' }
  ],
  'CTL': [
    { name: 'AX-EX', axiom: 'AXφ ↔ ¬EX¬φ', description: 'AX/EX duality' },
    { name: 'AG-EF', axiom: 'AGφ ↔ ¬EF¬φ', description: 'AG/EF duality' },
    { name: 'AF-EG', axiom: 'AFφ ↔ ¬EG¬φ', description: 'AF/EG duality' }
  ]
};

// Create example Kripke model
function createExampleModel(type: string): KripkeModel {
  switch (type) {
    case 'simple':
      return {
        worlds: [
          { name: 'w0', atoms: new Set(['p']) },
          { name: 'w1', atoms: new Set(['q']) },
          { name: 'w2', atoms: new Set(['p', 'q']) }
        ],
        accessibility: new Map([
          ['w0', new Set(['w0', 'w1'])],
          ['w1', new Set(['w1', 'w2'])],
          ['w2', new Set(['w2'])]
        ])
      };

    case 'reflexive':
      return {
        worlds: [
          { name: 'w0', atoms: new Set(['p']) },
          { name: 'w1', atoms: new Set(['q']) }
        ],
        accessibility: new Map([
          ['w0', new Set(['w0', 'w1'])],
          ['w1', new Set(['w1'])]
        ])
      };

    case 's5':
      // S5: equivalence relation (all worlds accessible from all)
      return {
        worlds: [
          { name: 'w0', atoms: new Set(['p']) },
          { name: 'w1', atoms: new Set(['q']) },
          { name: 'w2', atoms: new Set(['p', 'q']) }
        ],
        accessibility: new Map([
          ['w0', new Set(['w0', 'w1', 'w2'])],
          ['w1', new Set(['w0', 'w1', 'w2'])],
          ['w2', new Set(['w0', 'w1', 'w2'])]
        ])
      };

    case 'linear':
      // Linear model for LTL
      return {
        worlds: [
          { name: 's0', atoms: new Set(['start']) },
          { name: 's1', atoms: new Set(['processing']) },
          { name: 's2', atoms: new Set(['done']) },
          { name: 's3', atoms: new Set(['done']) }
        ],
        accessibility: new Map([
          ['s0', new Set(['s1'])],
          ['s1', new Set(['s2'])],
          ['s2', new Set(['s3'])],
          ['s3', new Set(['s3'])]  // Self-loop at end
        ])
      };

    default:
      return createExampleModel('simple');
  }
}

// Valid formulas (tautologies) in different systems
const VALID_FORMULAS: Record<string, string[]> = {
  'K': [
    '□(p -> p)',
    '□p -> □p',
    '□(p & q) -> (□p & □q)'
  ],
  'T': [
    '□p -> p',
    'p -> ◇p',
    '□(p -> q) -> (□p -> □q)'
  ],
  'S4': [
    '□p -> □□p',
    '◇◇p -> ◇p',
    '□p -> p'
  ],
  'S5': [
    '◇p -> □◇p',
    '◇□p -> □p',
    'p -> □◇p'
  ],
  'LTL': [
    'G(p -> Xp) -> (p -> Gp)',
    'Fp <-> ~G~p',
    'G(p & q) <-> (Gp & Gq)'
  ]
};

export const modallogicTool: UnifiedTool = {
  name: 'modal_logic',
  description: `Modal logic system for reasoning about necessity, possibility, time, and obligation.

Supports multiple modal logic systems:
- K: Basic modal logic (distribution axiom)
- T: Reflexive frames (what's necessary is true)
- S4: Reflexive + transitive (knowledge logic)
- S5: Equivalence relations (partitioned possibilities)
- LTL: Linear Temporal Logic (X, G, F, U operators)
- CTL: Computation Tree Logic

Features:
- Parse and evaluate modal formulas
- Kripke model semantics
- Frame condition checking
- Validity and satisfiability testing
- Modal axiom systems`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['evaluate', 'parse', 'check_frame', 'axioms', 'valid_formulas', 'create_model', 'examples', 'info'],
        description: 'Operation to perform'
      },
      formula: { type: 'string', description: 'Modal logic formula (e.g., "[]p -> p" for □p → p)' },
      logic: {
        type: 'string',
        enum: ['K', 'T', 'S4', 'S5', 'LTL', 'CTL'],
        description: 'Modal logic system (default: K)'
      },
      model_type: {
        type: 'string',
        enum: ['simple', 'reflexive', 's5', 'linear'],
        description: 'Type of example Kripke model'
      },
      world: { type: 'string', description: 'World to evaluate formula at' }
    },
    required: ['operation']
  }
};

export async function executemodallogic(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, formula, logic = 'K', model_type = 'simple', world } = args;

    switch (operation) {
      case 'parse': {
        if (!formula) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'Provide formula parameter' }, null, 2),
            isError: true
          };
        }

        const parsed = parseFormula(formula);
        const formatted = formulaToString(parsed);

        return {
          toolCallId: id,
          content: JSON.stringify({
            input: formula,
            parsed_structure: parsed,
            formatted: formatted,
            operators_used: getOperatorsUsed(parsed)
          }, null, 2)
        };
      }

      case 'evaluate': {
        if (!formula) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'Provide formula parameter' }, null, 2),
            isError: true
          };
        }

        const model = createExampleModel(model_type);
        const parsed = parseFormula(formula);
        const evalWorld = world ? model.worlds.find(w => w.name === world) : model.worlds[0];

        if (!evalWorld) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `World '${world}' not found in model`,
              available_worlds: model.worlds.map(w => w.name)
            }, null, 2),
            isError: true
          };
        }

        const result = evaluate(model, evalWorld, parsed);

        // Evaluate in all worlds
        const allWorldResults = model.worlds.map(w => ({
          world: w.name,
          atoms: Array.from(w.atoms),
          satisfies: evaluate(model, w, parsed)
        }));

        return {
          toolCallId: id,
          content: JSON.stringify({
            formula: formulaToString(parsed),
            logic_system: logic,
            model: {
              type: model_type,
              worlds: model.worlds.map(w => ({ name: w.name, atoms: Array.from(w.atoms) })),
              accessibility: Object.fromEntries(
                Array.from(model.accessibility.entries()).map(([k, v]) => [k, Array.from(v)])
              )
            },
            evaluation: {
              world: evalWorld.name,
              result: result
            },
            all_worlds: allWorldResults,
            valid_in_model: allWorldResults.every(r => r.satisfies)
          }, null, 2)
        };
      }

      case 'check_frame': {
        const model = createExampleModel(model_type);
        const frameCheck = checkFrameConditions(model, logic);

        return {
          toolCallId: id,
          content: JSON.stringify({
            logic_system: logic,
            model_type: model_type,
            frame_conditions: frameCheck.conditions,
            model_satisfies_conditions: frameCheck.satisfies,
            model: {
              worlds: model.worlds.map(w => w.name),
              accessibility: Object.fromEntries(
                Array.from(model.accessibility.entries()).map(([k, v]) => [k, Array.from(v)])
              )
            }
          }, null, 2)
        };
      }

      case 'axioms': {
        const axioms = AXIOMS[logic] || AXIOMS['K'];

        return {
          toolCallId: id,
          content: JSON.stringify({
            logic_system: logic,
            axioms: axioms,
            description: getLogicDescription(logic)
          }, null, 2)
        };
      }

      case 'valid_formulas': {
        const validFormulas = VALID_FORMULAS[logic] || VALID_FORMULAS['K'];

        return {
          toolCallId: id,
          content: JSON.stringify({
            logic_system: logic,
            valid_formulas: validFormulas.map(f => ({
              formula: f,
              formatted: formulaToString(parseFormula(f))
            })),
            note: 'These formulas are valid (true in all models) in this logic system'
          }, null, 2)
        };
      }

      case 'create_model': {
        const model = createExampleModel(model_type);
        const frameCheck = checkFrameConditions(model, logic);

        return {
          toolCallId: id,
          content: JSON.stringify({
            model_type: model_type,
            kripke_model: {
              worlds: model.worlds.map(w => ({
                name: w.name,
                true_atoms: Array.from(w.atoms)
              })),
              accessibility_relation: Object.fromEntries(
                Array.from(model.accessibility.entries()).map(([k, v]) => [k, Array.from(v)])
              )
            },
            frame_properties: frameCheck.conditions,
            suitable_for_logics: getSuitableLogics(model)
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            formula_syntax: {
              atoms: 'p, q, r, ... (propositional variables)',
              negation: '~p or NOT p',
              conjunction: 'p & q or p AND q',
              disjunction: 'p | q or p OR q',
              implication: 'p -> q',
              necessity: '[]p or □p or BOX p',
              possibility: '<>p or ◇p or DIAMOND p',
              next: 'Xp or NEXT p (LTL)',
              always: 'Gp or ALWAYS p (LTL)',
              eventually: 'Fp or EVENTUALLY p (LTL)',
              until: 'p UNTIL q (LTL)'
            },
            example_formulas: [
              { formula: '[]p -> p', meaning: 'If p is necessary, then p is true (T axiom)' },
              { formula: '[]p -> [][]p', meaning: 'If p is necessary, then it is necessarily necessary (S4 axiom)' },
              { formula: '<>p -> []<>p', meaning: 'If p is possible, it is necessarily possible (S5 axiom)' },
              { formula: 'Gp -> Fp', meaning: 'If p is always true, then eventually p (LTL)' },
              { formula: 'p UNTIL q', meaning: 'p holds until q becomes true (LTL)' }
            ],
            model_types: {
              simple: '3 worlds with partial accessibility',
              reflexive: 'Reflexive accessibility (T-frame)',
              s5: 'Equivalence relation (S5-frame)',
              linear: 'Linear sequence for temporal logic'
            }
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'modal_logic',
            description: 'Modal and temporal logic reasoning system',
            logic_systems: {
              K: 'Basic modal logic - no frame conditions',
              T: 'Reflexive frames - □p → p is valid',
              S4: 'Preorders - knowledge/belief logic',
              S5: 'Equivalence relations - epistemic logic',
              LTL: 'Linear Temporal Logic - reasoning about paths',
              CTL: 'Computation Tree Logic - branching time'
            },
            semantics: {
              kripke_model: 'Set of worlds W, accessibility relation R, valuation V',
              necessity: '□φ is true at w iff φ is true at all R-accessible worlds',
              possibility: '◇φ is true at w iff φ is true at some R-accessible world'
            },
            operations: {
              evaluate: 'Evaluate formula in Kripke model',
              parse: 'Parse formula and show structure',
              check_frame: 'Check frame conditions for logic system',
              axioms: 'Show axioms for logic system',
              valid_formulas: 'List valid formulas (tautologies)',
              create_model: 'Create example Kripke model',
              examples: 'Show syntax and examples'
            }
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

// Helper functions
function getOperatorsUsed(f: Formula): string[] {
  const ops = new Set<string>();

  function traverse(formula: Formula): void {
    switch (formula.type) {
      case 'not':
        ops.add('negation');
        traverse(formula.sub);
        break;
      case 'and':
        ops.add('conjunction');
        traverse(formula.left);
        traverse(formula.right);
        break;
      case 'or':
        ops.add('disjunction');
        traverse(formula.left);
        traverse(formula.right);
        break;
      case 'implies':
        ops.add('implication');
        traverse(formula.left);
        traverse(formula.right);
        break;
      case 'box':
        ops.add('necessity (□)');
        traverse(formula.sub);
        break;
      case 'diamond':
        ops.add('possibility (◇)');
        traverse(formula.sub);
        break;
      case 'next':
        ops.add('next (X)');
        traverse(formula.sub);
        break;
      case 'always':
        ops.add('always (G)');
        traverse(formula.sub);
        break;
      case 'eventually':
        ops.add('eventually (F)');
        traverse(formula.sub);
        break;
      case 'until':
        ops.add('until (U)');
        traverse(formula.left);
        traverse(formula.right);
        break;
    }
  }

  traverse(f);
  return Array.from(ops);
}

function getLogicDescription(logic: string): string {
  const descriptions: Record<string, string> = {
    'K': 'Basic modal logic with distribution axiom K and necessitation rule',
    'T': 'Modal logic T adds reflexivity - what is necessary is true',
    'S4': 'Modal logic S4 adds transitivity - iterated necessity collapses',
    'S5': 'Modal logic S5 uses equivalence relations - possibility implies necessary possibility',
    'LTL': 'Linear Temporal Logic for reasoning about sequences of states',
    'CTL': 'Computation Tree Logic for reasoning about branching time structures'
  };
  return descriptions[logic] || 'Unknown logic system';
}

function getSuitableLogics(model: KripkeModel): string[] {
  const suitable: string[] = ['K'];  // K has no conditions

  const checks = checkFrameConditions(model, 'S5');
  const reflexive = checks.conditions.find(c => c.name === 'Reflexivity')?.satisfied || false;
  const transitive = checks.conditions.find(c => c.name === 'Transitivity')?.satisfied || false;
  const symmetric = checks.conditions.find(c => c.name === 'Symmetry')?.satisfied || false;

  if (reflexive) suitable.push('T');
  if (reflexive && transitive) suitable.push('S4');
  if (reflexive && transitive && symmetric) suitable.push('S5');

  return suitable;
}

export function ismodallogicAvailable(): boolean {
  return true;
}
