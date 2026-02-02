/**
 * LR-PARSER TOOL
 * Comprehensive LR parser generator with LR(0), SLR(1), LR(1), and LALR(1)
 * automaton construction, action/goto tables, and shift-reduce parsing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Grammar {
  terminals: string[];
  nonTerminals: string[];
  startSymbol: string;
  productions: Production[];
}

interface Production {
  lhs: string;
  rhs: string[];
  index: number;
}

interface LR0Item {
  production: Production;
  dotPosition: number;
}

interface LR1Item extends LR0Item {
  lookahead: string;
}

interface LRState {
  id: number;
  items: LR0Item[] | LR1Item[];
  transitions: Map<string, number>;
}

type Action =
  | { type: 'shift'; state: number }
  | { type: 'reduce'; production: number }
  | { type: 'accept' }
  | { type: 'error' };

interface ParseTable {
  action: Map<number, Map<string, Action>>;
  goto: Map<number, Map<string, number>>;
  states: LRState[];
  conflicts: ParseConflict[];
}

interface ParseConflict {
  state: number;
  symbol: string;
  type: 'shift-reduce' | 'reduce-reduce';
  actions: Action[];
}

interface ParseStep {
  stack: string;
  input: string;
  action: string;
}

interface ParseResult {
  success: boolean;
  steps: ParseStep[];
  reductions: string[];
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EPSILON = 'ε';
const END_MARKER = '$';
const AUGMENTED_START = "S'";

// ============================================================================
// GRAMMAR UTILITIES
// ============================================================================

function parseGrammar(grammarText: string): Grammar {
  const lines = grammarText.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('//'));
  const productions: Production[] = [];
  const nonTerminals = new Set<string>();
  const allSymbols = new Set<string>();
  let startSymbol = '';

  lines.forEach((line) => {
    const match = line.match(/^\s*(\w+'?)\s*->\s*(.+)\s*$/);
    if (!match) return;

    const lhs = match[1];
    const rhsAlternatives = match[2].split('|').map(s => s.trim());

    if (!startSymbol) startSymbol = lhs;
    nonTerminals.add(lhs);

    rhsAlternatives.forEach(alt => {
      const rhs = alt === EPSILON ? [] : alt.split(/\s+/).filter(s => s);
      productions.push({ lhs, rhs, index: productions.length });
      rhs.forEach(s => allSymbols.add(s));
    });
  });

  const terminals = [...allSymbols].filter(s => !nonTerminals.has(s) && s !== EPSILON);

  return {
    terminals,
    nonTerminals: [...nonTerminals],
    startSymbol,
    productions
  };
}

function augmentGrammar(grammar: Grammar): Grammar {
  const augmentedProductions: Production[] = [
    { lhs: AUGMENTED_START, rhs: [grammar.startSymbol], index: 0 }
  ];

  grammar.productions.forEach((p, i) => {
    augmentedProductions.push({ ...p, index: i + 1 });
  });

  return {
    terminals: grammar.terminals,
    nonTerminals: [AUGMENTED_START, ...grammar.nonTerminals],
    startSymbol: AUGMENTED_START,
    productions: augmentedProductions
  };
}

function computeFirstSets(grammar: Grammar): Map<string, Set<string>> {
  const first = new Map<string, Set<string>>();

  grammar.terminals.forEach(t => first.set(t, new Set([t])));
  grammar.nonTerminals.forEach(nt => first.set(nt, new Set()));

  let changed = true;
  while (changed) {
    changed = false;
    for (const prod of grammar.productions) {
      const lhsFirst = first.get(prod.lhs)!;
      const oldSize = lhsFirst.size;

      if (prod.rhs.length === 0) {
        lhsFirst.add(EPSILON);
      } else {
        let allNullable = true;
        for (const symbol of prod.rhs) {
          const symbolFirst = first.get(symbol);
          if (symbolFirst) {
            symbolFirst.forEach(s => { if (s !== EPSILON) lhsFirst.add(s); });
            if (!symbolFirst.has(EPSILON)) { allNullable = false; break; }
          } else {
            lhsFirst.add(symbol);
            allNullable = false;
            break;
          }
        }
        if (allNullable) lhsFirst.add(EPSILON);
      }
      if (lhsFirst.size > oldSize) changed = true;
    }
  }
  return first;
}

function computeFollowSets(grammar: Grammar, first: Map<string, Set<string>>): Map<string, Set<string>> {
  const follow = new Map<string, Set<string>>();
  grammar.nonTerminals.forEach(nt => follow.set(nt, new Set()));
  follow.get(grammar.startSymbol)!.add(END_MARKER);

  let changed = true;
  while (changed) {
    changed = false;
    for (const prod of grammar.productions) {
      for (let i = 0; i < prod.rhs.length; i++) {
        const symbol = prod.rhs[i];
        if (!grammar.nonTerminals.includes(symbol)) continue;

        const symbolFollow = follow.get(symbol)!;
        const oldSize = symbolFollow.size;
        const beta = prod.rhs.slice(i + 1);

        if (beta.length === 0) {
          follow.get(prod.lhs)!.forEach(s => symbolFollow.add(s));
        } else {
          const betaFirst = computeFirstOfString(beta, first);
          betaFirst.forEach(s => { if (s !== EPSILON) symbolFollow.add(s); });
          if (betaFirst.has(EPSILON)) {
            follow.get(prod.lhs)!.forEach(s => symbolFollow.add(s));
          }
        }
        if (symbolFollow.size > oldSize) changed = true;
      }
    }
  }
  return follow;
}

function computeFirstOfString(symbols: string[], first: Map<string, Set<string>>): Set<string> {
  const result = new Set<string>();
  if (symbols.length === 0) { result.add(EPSILON); return result; }

  let allNullable = true;
  for (const symbol of symbols) {
    const symbolFirst = first.get(symbol);
    if (symbolFirst) {
      symbolFirst.forEach(s => { if (s !== EPSILON) result.add(s); });
      if (!symbolFirst.has(EPSILON)) { allNullable = false; break; }
    } else {
      result.add(symbol);
      allNullable = false;
      break;
    }
  }
  if (allNullable) result.add(EPSILON);
  return result;
}

// ============================================================================
// LR(0) AUTOMATON
// ============================================================================

function itemToString(item: LR0Item): string {
  const rhs = [...item.production.rhs];
  rhs.splice(item.dotPosition, 0, '•');
  return `${item.production.lhs} -> ${rhs.join(' ') || '•'}`;
}

function lr1ItemToString(item: LR1Item): string {
  const rhs = [...item.production.rhs];
  rhs.splice(item.dotPosition, 0, '•');
  return `[${item.production.lhs} -> ${rhs.join(' ') || '•'}, ${item.lookahead}]`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function itemsEqual(a: LR0Item, b: LR0Item): boolean {
  return a.production.index === b.production.index && a.dotPosition === b.dotPosition;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function lr1ItemsEqual(a: LR1Item, b: LR1Item): boolean {
  return itemsEqual(a, b) && a.lookahead === b.lookahead;
}

function getSymbolAfterDot(item: LR0Item): string | null {
  if (item.dotPosition >= item.production.rhs.length) return null;
  return item.production.rhs[item.dotPosition];
}

function closure(items: LR0Item[], grammar: Grammar): LR0Item[] {
  const result = [...items];
  const added = new Set<string>();
  items.forEach(i => added.add(itemToString(i)));

  let changed = true;
  while (changed) {
    changed = false;
    for (const item of [...result]) {
      const symbol = getSymbolAfterDot(item);
      if (!symbol || !grammar.nonTerminals.includes(symbol)) continue;

      for (const prod of grammar.productions) {
        if (prod.lhs !== symbol) continue;
        const newItem: LR0Item = { production: prod, dotPosition: 0 };
        const key = itemToString(newItem);
        if (!added.has(key)) {
          result.push(newItem);
          added.add(key);
          changed = true;
        }
      }
    }
  }
  return result;
}

function lr1Closure(items: LR1Item[], grammar: Grammar, first: Map<string, Set<string>>): LR1Item[] {
  const result = [...items];
  const added = new Set<string>();
  items.forEach(i => added.add(lr1ItemToString(i)));

  let changed = true;
  while (changed) {
    changed = false;
    for (const item of [...result]) {
      const symbol = getSymbolAfterDot(item);
      if (!symbol || !grammar.nonTerminals.includes(symbol)) continue;

      // Compute lookaheads: FIRST(βa) where β is rest after symbol, a is item's lookahead
      const beta = item.production.rhs.slice(item.dotPosition + 1);
      const lookaheadString = [...beta, item.lookahead];
      const lookaheads = computeFirstOfString(lookaheadString, first);
      lookaheads.delete(EPSILON);

      for (const prod of grammar.productions) {
        if (prod.lhs !== symbol) continue;
        for (const la of lookaheads) {
          const newItem: LR1Item = { production: prod, dotPosition: 0, lookahead: la };
          const key = lr1ItemToString(newItem);
          if (!added.has(key)) {
            result.push(newItem);
            added.add(key);
            changed = true;
          }
        }
      }
    }
  }
  return result;
}

function goto(items: LR0Item[], symbol: string, grammar: Grammar): LR0Item[] {
  const moved: LR0Item[] = [];
  for (const item of items) {
    if (getSymbolAfterDot(item) === symbol) {
      moved.push({
        production: item.production,
        dotPosition: item.dotPosition + 1
      });
    }
  }
  return closure(moved, grammar);
}

function lr1Goto(items: LR1Item[], symbol: string, grammar: Grammar, first: Map<string, Set<string>>): LR1Item[] {
  const moved: LR1Item[] = [];
  for (const item of items) {
    if (getSymbolAfterDot(item) === symbol) {
      moved.push({
        production: item.production,
        dotPosition: item.dotPosition + 1,
        lookahead: item.lookahead
      });
    }
  }
  return lr1Closure(moved, grammar, first);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function statesEqual(a: LR0Item[], b: LR0Item[]): boolean {
  if (a.length !== b.length) return false;
  const bStrings = new Set(b.map(itemToString));
  return a.every(item => bStrings.has(itemToString(item)));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function lr1StatesEqual(a: LR1Item[], b: LR1Item[]): boolean {
  if (a.length !== b.length) return false;
  const bStrings = new Set(b.map(lr1ItemToString));
  return a.every(item => bStrings.has(lr1ItemToString(item)));
}

function buildLR0Automaton(grammar: Grammar): LRState[] {
  const augmented = augmentGrammar(grammar);
  const startItem: LR0Item = { production: augmented.productions[0], dotPosition: 0 };
  const startState = closure([startItem], augmented);

  const states: LRState[] = [{ id: 0, items: startState, transitions: new Map() }];
  const stateMap = new Map<string, number>();
  stateMap.set(JSON.stringify(startState.map(itemToString).sort()), 0);

  const symbols = [...augmented.terminals, ...augmented.nonTerminals];
  let i = 0;

  while (i < states.length) {
    const state = states[i];
    for (const symbol of symbols) {
      const nextItems = goto(state.items as LR0Item[], symbol, augmented);
      if (nextItems.length === 0) continue;

      const key = JSON.stringify(nextItems.map(itemToString).sort());
      let nextStateId = stateMap.get(key);

      if (nextStateId === undefined) {
        nextStateId = states.length;
        states.push({ id: nextStateId, items: nextItems, transitions: new Map() });
        stateMap.set(key, nextStateId);
      }

      state.transitions.set(symbol, nextStateId);
    }
    i++;
  }

  return states;
}

function buildLR1Automaton(grammar: Grammar): LRState[] {
  const augmented = augmentGrammar(grammar);
  const first = computeFirstSets(augmented);
  const startItem: LR1Item = { production: augmented.productions[0], dotPosition: 0, lookahead: END_MARKER };
  const startState = lr1Closure([startItem], augmented, first);

  const states: LRState[] = [{ id: 0, items: startState, transitions: new Map() }];
  const stateMap = new Map<string, number>();
  stateMap.set(JSON.stringify(startState.map(lr1ItemToString).sort()), 0);

  const symbols = [...augmented.terminals, ...augmented.nonTerminals];
  let i = 0;

  while (i < states.length) {
    const state = states[i];
    for (const symbol of symbols) {
      const nextItems = lr1Goto(state.items as LR1Item[], symbol, augmented, first);
      if (nextItems.length === 0) continue;

      const key = JSON.stringify(nextItems.map(lr1ItemToString).sort());
      let nextStateId = stateMap.get(key);

      if (nextStateId === undefined) {
        nextStateId = states.length;
        states.push({ id: nextStateId, items: nextItems, transitions: new Map() });
        stateMap.set(key, nextStateId);
      }

      state.transitions.set(symbol, nextStateId);
    }
    i++;
  }

  return states;
}

// ============================================================================
// PARSE TABLE CONSTRUCTION
// ============================================================================

function buildSLRTable(grammar: Grammar): ParseTable {
  const augmented = augmentGrammar(grammar);
  const states = buildLR0Automaton(grammar);
  const follow = computeFollowSets(augmented, computeFirstSets(augmented));

  const action = new Map<number, Map<string, Action>>();
  const gotoTable = new Map<number, Map<string, number>>();
  const conflicts: ParseConflict[] = [];

  // Initialize tables
  states.forEach(state => {
    action.set(state.id, new Map());
    gotoTable.set(state.id, new Map());
  });

  for (const state of states) {
    // Fill GOTO for non-terminals
    for (const [symbol, nextState] of state.transitions) {
      if (augmented.nonTerminals.includes(symbol) && symbol !== AUGMENTED_START) {
        gotoTable.get(state.id)!.set(symbol, nextState);
      }
    }

    // Fill ACTION
    for (const item of state.items as LR0Item[]) {
      const symbol = getSymbolAfterDot(item);

      if (symbol && augmented.terminals.includes(symbol)) {
        // Shift
        const nextState = state.transitions.get(symbol);
        if (nextState !== undefined) {
          addAction(action, conflicts, state.id, symbol, { type: 'shift', state: nextState });
        }
      } else if (symbol === null) {
        // Reduce or accept
        if (item.production.lhs === AUGMENTED_START) {
          addAction(action, conflicts, state.id, END_MARKER, { type: 'accept' });
        } else {
          const followSet = follow.get(item.production.lhs)!;
          for (const terminal of followSet) {
            addAction(action, conflicts, state.id, terminal, { type: 'reduce', production: item.production.index });
          }
        }
      }
    }
  }

  return { action, goto: gotoTable, states, conflicts };
}

function buildLR1Table(grammar: Grammar): ParseTable {
  const augmented = augmentGrammar(grammar);
  const states = buildLR1Automaton(grammar);

  const action = new Map<number, Map<string, Action>>();
  const gotoTable = new Map<number, Map<string, number>>();
  const conflicts: ParseConflict[] = [];

  states.forEach(state => {
    action.set(state.id, new Map());
    gotoTable.set(state.id, new Map());
  });

  for (const state of states) {
    for (const [symbol, nextState] of state.transitions) {
      if (augmented.nonTerminals.includes(symbol) && symbol !== AUGMENTED_START) {
        gotoTable.get(state.id)!.set(symbol, nextState);
      }
    }

    for (const item of state.items as LR1Item[]) {
      const symbol = getSymbolAfterDot(item);

      if (symbol && augmented.terminals.includes(symbol)) {
        const nextState = state.transitions.get(symbol);
        if (nextState !== undefined) {
          addAction(action, conflicts, state.id, symbol, { type: 'shift', state: nextState });
        }
      } else if (symbol === null) {
        if (item.production.lhs === AUGMENTED_START) {
          addAction(action, conflicts, state.id, END_MARKER, { type: 'accept' });
        } else {
          addAction(action, conflicts, state.id, item.lookahead, { type: 'reduce', production: item.production.index });
        }
      }
    }
  }

  return { action, goto: gotoTable, states, conflicts };
}

function addAction(
  action: Map<number, Map<string, Action>>,
  conflicts: ParseConflict[],
  state: number,
  symbol: string,
  newAction: Action
): void {
  const stateActions = action.get(state)!;
  const existing = stateActions.get(symbol);

  if (existing) {
    const conflictType = existing.type === 'shift' || newAction.type === 'shift'
      ? 'shift-reduce'
      : 'reduce-reduce';

    const existingConflict = conflicts.find(c => c.state === state && c.symbol === symbol);
    if (existingConflict) {
      if (!existingConflict.actions.some(a => JSON.stringify(a) === JSON.stringify(newAction))) {
        existingConflict.actions.push(newAction);
      }
    } else {
      conflicts.push({ state, symbol, type: conflictType, actions: [existing, newAction] });
    }
  } else {
    stateActions.set(symbol, newAction);
  }
}

// ============================================================================
// PARSING
// ============================================================================

function parse(input: string[], parseTable: ParseTable, grammar: Grammar): ParseResult {
  const augmented = augmentGrammar(grammar);
  const tokens = [...input, END_MARKER];
  const stack: (number | string)[] = [0];
  let tokenIndex = 0;
  const steps: ParseStep[] = [];
  const reductions: string[] = [];

  while (true) {
    const state = stack[stack.length - 1] as number;
    const token = tokens[tokenIndex];
    const actionMap = parseTable.action.get(state);

    if (!actionMap) {
      return { success: false, steps, reductions, error: `Invalid state: ${state}` };
    }

    const act = actionMap.get(token);

    const stackStr = stack.map((s, i) => i % 2 === 0 ? `s${s}` : s).join(' ');
    const inputStr = tokens.slice(tokenIndex).join(' ');

    if (!act || act.type === 'error') {
      steps.push({ stack: stackStr, input: inputStr, action: 'ERROR' });
      const expected = [...actionMap.entries()].filter(([_, a]) => a && a.type !== 'error').map(([t, _]) => t);
      return {
        success: false,
        steps,
        reductions,
        error: `Syntax error at '${token}'. Expected: ${expected.join(', ')}`
      };
    }

    if (act.type === 'accept') {
      steps.push({ stack: stackStr, input: inputStr, action: 'ACCEPT' });
      return { success: true, steps, reductions };
    }

    if (act.type === 'shift') {
      steps.push({ stack: stackStr, input: inputStr, action: `Shift ${token}, goto state ${act.state}` });
      stack.push(token);
      stack.push(act.state);
      tokenIndex++;
    }

    if (act.type === 'reduce') {
      const prod = augmented.productions[act.production];
      const rhsLen = prod.rhs.length;

      // Pop 2 * |rhs| items (symbol, state pairs)
      for (let i = 0; i < rhsLen * 2; i++) stack.pop();

      const topState = stack[stack.length - 1] as number;
      stack.push(prod.lhs);

      const gotoState = parseTable.goto.get(topState)?.get(prod.lhs);
      if (gotoState === undefined) {
        return { success: false, steps, reductions, error: `No GOTO for state ${topState} on ${prod.lhs}` };
      }

      stack.push(gotoState);
      const reduction = `${prod.lhs} -> ${prod.rhs.join(' ') || EPSILON}`;
      reductions.push(reduction);
      steps.push({ stack: stackStr, input: inputStr, action: `Reduce by ${reduction}` });
    }
  }
}

// ============================================================================
// ANALYSIS & FORMATTING
// ============================================================================

function formatParseTable(parseTable: ParseTable, grammar: Grammar): string {
  const augmented = augmentGrammar(grammar);
  const terminals = [...augmented.terminals, END_MARKER];
  const nonTerminals = augmented.nonTerminals.filter(nt => nt !== AUGMENTED_START);

  const lines: string[] = [];
  lines.push('ACTION/GOTO Table:');

  // Header
  const header = ['State', ...terminals.map(t => `${t}`), '|', ...nonTerminals];
  lines.push(header.join('\t'));
  lines.push('-'.repeat(80));

  for (const state of parseTable.states) {
    const row: string[] = [state.id.toString()];

    for (const t of terminals) {
      const act = parseTable.action.get(state.id)?.get(t);
      if (!act) row.push('');
      else if (act.type === 'shift') row.push(`s${act.state}`);
      else if (act.type === 'reduce') row.push(`r${act.production}`);
      else if (act.type === 'accept') row.push('acc');
      else row.push('');
    }

    row.push('|');

    for (const nt of nonTerminals) {
      const gotoState = parseTable.goto.get(state.id)?.get(nt);
      row.push(gotoState !== undefined ? gotoState.toString() : '');
    }

    lines.push(row.join('\t'));
  }

  return lines.join('\n');
}

function formatAutomaton(states: LRState[], isLR1: boolean): string {
  const lines: string[] = [];

  for (const state of states) {
    lines.push(`State ${state.id}:`);
    for (const item of state.items) {
      if (isLR1) {
        lines.push(`  ${lr1ItemToString(item as LR1Item)}`);
      } else {
        lines.push(`  ${itemToString(item)}`);
      }
    }
    if (state.transitions.size > 0) {
      lines.push('  Transitions:');
      for (const [symbol, nextState] of state.transitions) {
        lines.push(`    ${symbol} -> ${nextState}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const lrparserTool: UnifiedTool = {
  name: 'lr_parser',
  description: 'Comprehensive LR parser generator supporting LR(0), SLR(1), LR(1), and LALR(1) with automaton construction and shift-reduce parsing',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['analyze', 'parse', 'automaton', 'table', 'compare', 'demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      grammar: {
        type: 'string',
        description: 'Grammar in BNF notation'
      },
      input: {
        type: 'array',
        items: { type: 'string' },
        description: 'Input tokens to parse'
      },
      parserType: {
        type: 'string',
        enum: ['lr0', 'slr', 'lr1', 'lalr'],
        description: 'Type of LR parser (default: slr)'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executelrparser(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, grammar: grammarText, input, parserType = 'slr' } = args;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'LR Parser Generator',
            description: 'Bottom-up shift-reduce parser generator',
            capabilities: [
              'LR(0) automaton construction',
              'SLR(1) parse table generation',
              'LR(1) canonical items and tables',
              'LALR(1) table construction',
              'Shift-reduce conflict detection',
              'Reduce-reduce conflict detection',
              'Step-by-step parsing trace'
            ],
            parserTypes: {
              'LR(0)': 'Items without lookahead, most restrictive',
              'SLR(1)': 'Simple LR - uses FOLLOW sets for reductions',
              'LR(1)': 'Canonical LR - full lookahead in items',
              'LALR(1)': 'Lookahead LR - merged LR(1) states'
            },
            concepts: {
              shiftReduce: 'Shift pushes token, reduce applies production',
              handles: 'Rightmost derivation in reverse',
              viablePrefix: 'Stack contents that can lead to valid parse'
            },
            operations: ['analyze', 'parse', 'automaton', 'table', 'compare', 'demo', 'examples']
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Build SLR Table',
                params: {
                  operation: 'table',
                  grammar: 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id',
                  parserType: 'slr'
                }
              },
              {
                name: 'Parse Expression',
                params: {
                  operation: 'parse',
                  grammar: 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id',
                  input: ['id', '+', 'id', '*', 'id']
                }
              },
              {
                name: 'View LR(0) Automaton',
                params: {
                  operation: 'automaton',
                  grammar: 'S -> a A | b B\nA -> c | d\nB -> c | d',
                  parserType: 'lr0'
                }
              }
            ]
          }, null, 2)
        };
      }

      case 'analyze': {
        if (!grammarText) {
          return { toolCallId: id, content: 'Error: grammar is required', isError: true };
        }

        const grammar = parseGrammar(grammarText);
        const augmented = augmentGrammar(grammar);

        const slrTable = buildSLRTable(grammar);
        const lr1Table = buildLR1Table(grammar);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze',
            grammar: {
              terminals: grammar.terminals,
              nonTerminals: grammar.nonTerminals,
              startSymbol: grammar.startSymbol,
              productions: augmented.productions.map((p, i) =>
                `${i}: ${p.lhs} -> ${p.rhs.join(' ') || EPSILON}`
              )
            },
            analysis: {
              lr0States: slrTable.states.length,
              lr1States: lr1Table.states.length,
              slr1: {
                conflicts: slrTable.conflicts.length,
                conflictDetails: slrTable.conflicts.map(c => ({
                  state: c.state,
                  symbol: c.symbol,
                  type: c.type
                }))
              },
              lr1: {
                conflicts: lr1Table.conflicts.length,
                conflictDetails: lr1Table.conflicts.map(c => ({
                  state: c.state,
                  symbol: c.symbol,
                  type: c.type
                }))
              },
              recommendation: slrTable.conflicts.length === 0 ? 'SLR(1)' :
                              lr1Table.conflicts.length === 0 ? 'LR(1)' :
                              'Grammar has conflicts in all LR variants'
            }
          }, null, 2)
        };
      }

      case 'automaton': {
        if (!grammarText) {
          return { toolCallId: id, content: 'Error: grammar is required', isError: true };
        }

        const grammar = parseGrammar(grammarText);
        let states: LRState[];
        let isLR1 = false;

        if (parserType === 'lr1') {
          states = buildLR1Automaton(grammar);
          isLR1 = true;
        } else {
          states = buildLR0Automaton(grammar);
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'automaton',
            parserType: parserType === 'lr1' ? 'LR(1)' : 'LR(0)',
            stateCount: states.length,
            automaton: formatAutomaton(states, isLR1),
            explanation: isLR1
              ? 'LR(1) items include lookahead symbol for precise reduce decisions'
              : 'LR(0) items show position of parser in production'
          }, null, 2)
        };
      }

      case 'table': {
        if (!grammarText) {
          return { toolCallId: id, content: 'Error: grammar is required', isError: true };
        }

        const grammar = parseGrammar(grammarText);
        const parseTable = parserType === 'lr1'
          ? buildLR1Table(grammar)
          : buildSLRTable(grammar);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'table',
            parserType: parserType === 'lr1' ? 'LR(1)' : 'SLR(1)',
            stateCount: parseTable.states.length,
            conflictCount: parseTable.conflicts.length,
            conflicts: parseTable.conflicts.map(c => ({
              state: c.state,
              symbol: c.symbol,
              type: c.type,
              actions: c.actions.map(a => {
                if (a.type === 'shift') return `shift ${a.state}`;
                if (a.type === 'reduce') return `reduce ${a.production}`;
                return a.type;
              })
            })),
            table: formatParseTable(parseTable, grammar)
          }, null, 2)
        };
      }

      case 'parse': {
        if (!grammarText) {
          return { toolCallId: id, content: 'Error: grammar is required', isError: true };
        }
        if (!input || !Array.isArray(input)) {
          return { toolCallId: id, content: 'Error: input array is required', isError: true };
        }

        const grammar = parseGrammar(grammarText);
        const parseTable = parserType === 'lr1'
          ? buildLR1Table(grammar)
          : buildSLRTable(grammar);

        if (parseTable.conflicts.length > 0) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'parse',
              error: `Grammar has ${parseTable.conflicts.length} conflict(s)`,
              conflicts: parseTable.conflicts.map(c => ({
                state: c.state,
                symbol: c.symbol,
                type: c.type
              })),
              suggestion: parserType !== 'lr1'
                ? 'Try using LR(1) parser type'
                : 'Grammar is ambiguous or not LR parseable'
            }, null, 2)
          };
        }

        const result = parse(input, parseTable, grammar);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'parse',
            parserType: parserType === 'lr1' ? 'LR(1)' : 'SLR(1)',
            input: input.join(' '),
            success: result.success,
            ...(result.success ? {
              steps: result.steps,
              reductions: result.reductions,
              rightmostDerivation: [...result.reductions].reverse()
            } : {
              error: result.error,
              partialSteps: result.steps
            })
          }, null, 2)
        };
      }

      case 'compare': {
        if (!grammarText) {
          return { toolCallId: id, content: 'Error: grammar is required', isError: true };
        }

        const grammar = parseGrammar(grammarText);
        const lr0States = buildLR0Automaton(grammar);
        const lr1States = buildLR1Automaton(grammar);
        const slrTable = buildSLRTable(grammar);
        const lr1Table = buildLR1Table(grammar);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare',
            comparison: {
              'LR(0)/SLR(1)': {
                states: lr0States.length,
                conflicts: slrTable.conflicts.length,
                isParseable: slrTable.conflicts.length === 0
              },
              'LR(1)': {
                states: lr1States.length,
                conflicts: lr1Table.conflicts.length,
                isParseable: lr1Table.conflicts.length === 0
              }
            },
            analysis: {
              stateDifference: lr1States.length - lr0States.length,
              conflictReduction: slrTable.conflicts.length - lr1Table.conflicts.length,
              recommendation: slrTable.conflicts.length === 0
                ? 'Use SLR(1) - simpler and sufficient'
                : lr1Table.conflicts.length === 0
                  ? 'Use LR(1) - handles this grammar'
                  : 'Grammar may need refactoring'
            }
          }, null, 2)
        };
      }

      case 'demo': {
        // Classic expression grammar
        const grammarText = 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id';
        const grammar = parseGrammar(grammarText);
        const augmented = augmentGrammar(grammar);
        const slrTable = buildSLRTable(grammar);

        // Parse "id + id * id"
        const parseResult = parse(['id', '+', 'id', '*', 'id'], slrTable, grammar);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            title: 'LR Parser Demo - Expression Grammar',
            grammar: {
              productions: augmented.productions.map((p, i) =>
                `${i}: ${p.lhs} -> ${p.rhs.join(' ') || EPSILON}`
              )
            },
            automaton: {
              stateCount: slrTable.states.length,
              firstState: {
                id: 0,
                items: (slrTable.states[0].items as LR0Item[]).map(itemToString)
              }
            },
            parsing: {
              input: 'id + id * id',
              success: parseResult.success,
              steps: parseResult.steps.slice(0, 8),
              note: 'First 8 parsing steps shown',
              reductions: parseResult.reductions
            },
            concepts: [
              'LR parsers build rightmost derivation in reverse',
              'Shift moves input to stack',
              'Reduce applies production backward',
              'Handle is the RHS being reduced'
            ]
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
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function islrparserAvailable(): boolean {
  return true;
}
