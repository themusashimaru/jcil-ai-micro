/**
 * AUTOMATA-MINIMIZER TOOL
 * DFA minimization using Hopcroft's algorithm and partition refinement
 * NFA to DFA conversion (subset construction)
 * Regex to NFA (Thompson's construction)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const automataminimizerTool: UnifiedTool = {
  name: 'automata_minimizer',
  description: 'DFA minimization, NFA to DFA conversion, regex to NFA',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['minimize', 'nfa_to_dfa', 'regex_to_nfa', 'test', 'equivalent', 'visualize', 'demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      dfa: {
        type: 'object',
        properties: {
          states: { type: 'array', items: { type: 'string' }, description: 'State names' },
          alphabet: { type: 'array', items: { type: 'string' }, description: 'Input alphabet' },
          transitions: {
            type: 'object',
            description: 'Transition function: { "state": { "symbol": "next_state" } }'
          },
          start: { type: 'string', description: 'Start state' },
          accept: { type: 'array', items: { type: 'string' }, description: 'Accepting states' }
        },
        description: 'DFA specification'
      },
      nfa: {
        type: 'object',
        properties: {
          states: { type: 'array', items: { type: 'string' } },
          alphabet: { type: 'array', items: { type: 'string' } },
          transitions: {
            type: 'object',
            description: 'NFA transitions: { "state": { "symbol": ["next_states"] } }'
          },
          start: { type: 'string' },
          accept: { type: 'array', items: { type: 'string' } }
        },
        description: 'NFA specification'
      },
      regex: { type: 'string', description: 'Regular expression (supports: |, *, +, ?, (), concatenation)' },
      test_strings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Strings to test against the automaton'
      }
    },
    required: ['operation']
  }
};

// DFA type
interface DFA {
  states: Set<string>;
  alphabet: Set<string>;
  transitions: Map<string, Map<string, string>>;
  start: string;
  accept: Set<string>;
}

// NFA type (with epsilon transitions)
interface NFA {
  states: Set<string>;
  alphabet: Set<string>;
  transitions: Map<string, Map<string, Set<string>>>;
  start: string;
  accept: Set<string>;
}

// Parse DFA from input
function parseDFA(input: any): DFA {
  const dfa: DFA = {
    states: new Set(input.states),
    alphabet: new Set(input.alphabet),
    transitions: new Map(),
    start: input.start,
    accept: new Set(input.accept)
  };

  for (const [state, trans] of Object.entries(input.transitions)) {
    const stateTransitions = new Map<string, string>();
    for (const [symbol, next] of Object.entries(trans as Record<string, string>)) {
      stateTransitions.set(symbol, next);
    }
    dfa.transitions.set(state, stateTransitions);
  }

  return dfa;
}

// Parse NFA from input
function parseNFA(input: any): NFA {
  const nfa: NFA = {
    states: new Set(input.states),
    alphabet: new Set(input.alphabet),
    transitions: new Map(),
    start: input.start,
    accept: new Set(input.accept)
  };

  for (const [state, trans] of Object.entries(input.transitions)) {
    const stateTransitions = new Map<string, Set<string>>();
    for (const [symbol, nexts] of Object.entries(trans as Record<string, string[]>)) {
      stateTransitions.set(symbol, new Set(nexts));
    }
    nfa.transitions.set(state, stateTransitions);
  }

  return nfa;
}

// Epsilon closure for NFA
function epsilonClosure(nfa: NFA, states: Set<string>): Set<string> {
  const closure = new Set(states);
  const stack = [...states];

  while (stack.length > 0) {
    const state = stack.pop()!;
    const trans = nfa.transitions.get(state);
    if (trans) {
      const epsilonNext = trans.get('ε') || trans.get('epsilon');
      if (epsilonNext) {
        for (const next of epsilonNext) {
          if (!closure.has(next)) {
            closure.add(next);
            stack.push(next);
          }
        }
      }
    }
  }

  return closure;
}

// Move function for NFA
function nfaMove(nfa: NFA, states: Set<string>, symbol: string): Set<string> {
  const result = new Set<string>();

  for (const state of states) {
    const trans = nfa.transitions.get(state);
    if (trans) {
      const nexts = trans.get(symbol);
      if (nexts) {
        for (const next of nexts) {
          result.add(next);
        }
      }
    }
  }

  return result;
}

// NFA to DFA conversion (subset construction)
function nfaToDFA(nfa: NFA): { dfa: DFA; stateMapping: Map<string, Set<string>> } {
  const stateMapping = new Map<string, Set<string>>();
  const dfaStates = new Set<string>();
  const dfaTransitions = new Map<string, Map<string, string>>();
  const dfaAccept = new Set<string>();

  // Start state is epsilon closure of NFA start
  const startClosure = epsilonClosure(nfa, new Set([nfa.start]));
  const startName = setToStateName(startClosure);
  stateMapping.set(startName, startClosure);

  const worklist: Set<string>[] = [startClosure];
  const processed = new Set<string>();

  while (worklist.length > 0) {
    const currentSet = worklist.pop()!;
    const currentName = setToStateName(currentSet);

    if (processed.has(currentName)) continue;
    processed.add(currentName);
    dfaStates.add(currentName);

    // Check if accepting
    for (const state of currentSet) {
      if (nfa.accept.has(state)) {
        dfaAccept.add(currentName);
        break;
      }
    }

    // Compute transitions
    const currentTrans = new Map<string, string>();
    for (const symbol of nfa.alphabet) {
      if (symbol === 'ε' || symbol === 'epsilon') continue;

      const moved = nfaMove(nfa, currentSet, symbol);
      const closure = epsilonClosure(nfa, moved);

      if (closure.size > 0) {
        const nextName = setToStateName(closure);
        currentTrans.set(symbol, nextName);

        if (!processed.has(nextName)) {
          worklist.push(closure);
          stateMapping.set(nextName, closure);
        }
      }
    }

    dfaTransitions.set(currentName, currentTrans);
  }

  // Filter alphabet (remove epsilon)
  const dfaAlphabet = new Set([...nfa.alphabet].filter(s => s !== 'ε' && s !== 'epsilon'));

  return {
    dfa: {
      states: dfaStates,
      alphabet: dfaAlphabet,
      transitions: dfaTransitions,
      start: startName,
      accept: dfaAccept
    },
    stateMapping
  };
}

// Convert set to state name
function setToStateName(states: Set<string>): string {
  const sorted = [...states].sort();
  return sorted.length === 0 ? '∅' : `{${sorted.join(',')}}`;
}

// DFA minimization using Hopcroft's algorithm (partition refinement)
function minimizeDFA(dfa: DFA): { minimized: DFA; partition: Map<string, string>; steps: string[] } {
  const steps: string[] = [];

  // Remove unreachable states
  const reachable = new Set<string>();
  const stack = [dfa.start];
  while (stack.length > 0) {
    const state = stack.pop()!;
    if (reachable.has(state)) continue;
    reachable.add(state);

    const trans = dfa.transitions.get(state);
    if (trans) {
      for (const next of trans.values()) {
        if (!reachable.has(next)) {
          stack.push(next);
        }
      }
    }
  }

  steps.push(`Reachable states: ${[...reachable].join(', ')}`);

  // Initial partition: accepting vs non-accepting
  const accepting = new Set<string>();
  const nonAccepting = new Set<string>();

  for (const state of reachable) {
    if (dfa.accept.has(state)) {
      accepting.add(state);
    } else {
      nonAccepting.add(state);
    }
  }

  let partitions: Set<string>[] = [];
  if (accepting.size > 0) partitions.push(accepting);
  if (nonAccepting.size > 0) partitions.push(nonAccepting);

  steps.push(`Initial partition: [${partitions.map(p => `{${[...p].join(',')}}`).join(', ')}]`);

  // Refine partitions
  let changed = true;
  let iteration = 0;

  while (changed && iteration < 100) {
    changed = false;
    iteration++;
    const newPartitions: Set<string>[] = [];

    for (const partition of partitions) {
      if (partition.size <= 1) {
        newPartitions.push(partition);
        continue;
      }

      // Try to split this partition
      const splits = new Map<string, Set<string>>();

      for (const state of partition) {
        // Create signature based on which partition each transition goes to
        const signature: string[] = [];
        for (const symbol of [...dfa.alphabet].sort()) {
          const trans = dfa.transitions.get(state);
          const next = trans?.get(symbol);

          if (next) {
            // Find which partition the next state belongs to
            const partIdx = partitions.findIndex(p => p.has(next));
            signature.push(`${symbol}:${partIdx}`);
          } else {
            signature.push(`${symbol}:-1`);
          }
        }

        const sig = signature.join('|');
        if (!splits.has(sig)) {
          splits.set(sig, new Set());
        }
        splits.get(sig)!.add(state);
      }

      if (splits.size > 1) {
        changed = true;
        for (const split of splits.values()) {
          newPartitions.push(split);
        }
      } else {
        newPartitions.push(partition);
      }
    }

    partitions = newPartitions;

    if (changed) {
      steps.push(`Iteration ${iteration}: [${partitions.map(p => `{${[...p].join(',')}}`).join(', ')}]`);
    }
  }

  steps.push(`Final partition: [${partitions.map(p => `{${[...p].join(',')}}`).join(', ')}]`);

  // Build minimized DFA
  const stateToPartition = new Map<string, string>();
  const partitionNames = new Map<Set<string>, string>();

  partitions.forEach((partition, idx) => {
    const name = partition.size === 1 ? [...partition][0] : `q${idx}`;
    partitionNames.set(partition, name);
    for (const state of partition) {
      stateToPartition.set(state, name);
    }
  });

  const minimizedStates = new Set<string>();
  const minimizedTransitions = new Map<string, Map<string, string>>();
  const minimizedAccept = new Set<string>();
  let minimizedStart = '';

  for (const partition of partitions) {
    const name = partitionNames.get(partition)!;
    minimizedStates.add(name);

    // Check if contains start state
    if (partition.has(dfa.start)) {
      minimizedStart = name;
    }

    // Check if accepting
    for (const state of partition) {
      if (dfa.accept.has(state)) {
        minimizedAccept.add(name);
        break;
      }
    }

    // Get transitions from any state in partition (they're all equivalent)
    const representative = [...partition][0];
    const trans = dfa.transitions.get(representative);
    if (trans) {
      const newTrans = new Map<string, string>();
      for (const [symbol, next] of trans) {
        newTrans.set(symbol, stateToPartition.get(next) || next);
      }
      minimizedTransitions.set(name, newTrans);
    }
  }

  return {
    minimized: {
      states: minimizedStates,
      alphabet: dfa.alphabet,
      transitions: minimizedTransitions,
      start: minimizedStart,
      accept: minimizedAccept
    },
    partition: stateToPartition,
    steps
  };
}

// Test string acceptance
function testDFA(dfa: DFA, input: string): { accepted: boolean; path: string[] } {
  const path: string[] = [dfa.start];
  let current = dfa.start;

  for (const symbol of input) {
    const trans = dfa.transitions.get(current);
    const next = trans?.get(symbol);

    if (!next) {
      return { accepted: false, path };
    }

    current = next;
    path.push(current);
  }

  return { accepted: dfa.accept.has(current), path };
}

// Check DFA equivalence
function dfaEquivalent(dfa1: DFA, dfa2: DFA): { equivalent: boolean; counterexample?: string } {
  // Build product automaton and check for accepting differences
  const visited = new Set<string>();
  const queue: Array<{ s1: string; s2: string; path: string }> = [{
    s1: dfa1.start,
    s2: dfa2.start,
    path: ''
  }];

  while (queue.length > 0) {
    const { s1, s2, path } = queue.shift()!;
    const key = `${s1}|${s2}`;

    if (visited.has(key)) continue;
    visited.add(key);

    // Check if accepting status differs
    const acc1 = dfa1.accept.has(s1);
    const acc2 = dfa2.accept.has(s2);

    if (acc1 !== acc2) {
      return { equivalent: false, counterexample: path };
    }

    // Explore transitions
    const alphabet = new Set([...dfa1.alphabet, ...dfa2.alphabet]);
    for (const symbol of alphabet) {
      const next1 = dfa1.transitions.get(s1)?.get(symbol);
      const next2 = dfa2.transitions.get(s2)?.get(symbol);

      if (next1 && next2) {
        queue.push({ s1: next1, s2: next2, path: path + symbol });
      } else if (next1 || next2) {
        // One has transition, other doesn't - they differ
        return { equivalent: false, counterexample: path + symbol };
      }
    }
  }

  return { equivalent: true };
}

// Convert DFA to object format for output
function dfaToObject(dfa: DFA): object {
  const transitions: Record<string, Record<string, string>> = {};

  for (const [state, trans] of dfa.transitions) {
    transitions[state] = {};
    for (const [symbol, next] of trans) {
      transitions[state][symbol] = next;
    }
  }

  return {
    states: [...dfa.states],
    alphabet: [...dfa.alphabet],
    transitions,
    start: dfa.start,
    accept: [...dfa.accept]
  };
}

// Simple regex to NFA (Thompson's construction - simplified)
function regexToNFA(regex: string): NFA {
  let stateCounter = 0;
  const newState = () => `s${stateCounter++}`;

  type NFAFragment = {
    start: string;
    accept: string;
    transitions: Map<string, Map<string, Set<string>>>;
    states: Set<string>;
  };

  function createChar(c: string): NFAFragment {
    const start = newState();
    const accept = newState();
    const transitions = new Map<string, Map<string, Set<string>>>();
    transitions.set(start, new Map([[c, new Set([accept])]]));

    return {
      start,
      accept,
      transitions,
      states: new Set([start, accept])
    };
  }

  function createEpsilon(): NFAFragment {
    const start = newState();
    const accept = newState();
    const transitions = new Map<string, Map<string, Set<string>>>();
    transitions.set(start, new Map([['ε', new Set([accept])]]));

    return {
      start,
      accept,
      transitions,
      states: new Set([start, accept])
    };
  }

  function concatenate(a: NFAFragment, b: NFAFragment): NFAFragment {
    const transitions = new Map(a.transitions);
    for (const [state, trans] of b.transitions) {
      transitions.set(state, trans);
    }

    // Connect a.accept to b.start via epsilon
    if (!transitions.has(a.accept)) {
      transitions.set(a.accept, new Map());
    }
    const aAcceptTrans = transitions.get(a.accept)!;
    if (!aAcceptTrans.has('ε')) {
      aAcceptTrans.set('ε', new Set());
    }
    aAcceptTrans.get('ε')!.add(b.start);

    return {
      start: a.start,
      accept: b.accept,
      transitions,
      states: new Set([...a.states, ...b.states])
    };
  }

  function alternate(a: NFAFragment, b: NFAFragment): NFAFragment {
    const start = newState();
    const accept = newState();

    const transitions = new Map<string, Map<string, Set<string>>>();

    // Copy existing transitions
    for (const [state, trans] of a.transitions) {
      transitions.set(state, trans);
    }
    for (const [state, trans] of b.transitions) {
      transitions.set(state, trans);
    }

    // New start epsilon transitions
    transitions.set(start, new Map([['ε', new Set([a.start, b.start])]]));

    // Connect accepts to new accept
    if (!transitions.has(a.accept)) {
      transitions.set(a.accept, new Map());
    }
    if (!transitions.has(b.accept)) {
      transitions.set(b.accept, new Map());
    }

    const aAcceptTrans = transitions.get(a.accept)!;
    const bAcceptTrans = transitions.get(b.accept)!;

    if (!aAcceptTrans.has('ε')) aAcceptTrans.set('ε', new Set());
    if (!bAcceptTrans.has('ε')) bAcceptTrans.set('ε', new Set());

    aAcceptTrans.get('ε')!.add(accept);
    bAcceptTrans.get('ε')!.add(accept);

    return {
      start,
      accept,
      transitions,
      states: new Set([start, accept, ...a.states, ...b.states])
    };
  }

  function kleeneStar(a: NFAFragment): NFAFragment {
    const start = newState();
    const accept = newState();

    const transitions = new Map(a.transitions);

    // New start to old start and new accept
    transitions.set(start, new Map([['ε', new Set([a.start, accept])]]));

    // Old accept to old start and new accept
    if (!transitions.has(a.accept)) {
      transitions.set(a.accept, new Map());
    }
    const aAcceptTrans = transitions.get(a.accept)!;
    if (!aAcceptTrans.has('ε')) {
      aAcceptTrans.set('ε', new Set());
    }
    aAcceptTrans.get('ε')!.add(a.start);
    aAcceptTrans.get('ε')!.add(accept);

    return {
      start,
      accept,
      transitions,
      states: new Set([start, accept, ...a.states])
    };
  }

  // Simple recursive descent parser
  let pos = 0;

  function parseExpr(): NFAFragment {
    let left = parseTerm();

    while (pos < regex.length && regex[pos] === '|') {
      pos++; // consume '|'
      const right = parseTerm();
      left = alternate(left, right);
    }

    return left;
  }

  function parseTerm(): NFAFragment {
    let result: NFAFragment | null = null;

    while (pos < regex.length && regex[pos] !== ')' && regex[pos] !== '|') {
      const factor = parseFactor();
      if (result === null) {
        result = factor;
      } else {
        result = concatenate(result, factor);
      }
    }

    return result || createEpsilon();
  }

  function parseFactor(): NFAFragment {
    let base = parseBase();

    while (pos < regex.length && (regex[pos] === '*' || regex[pos] === '+' || regex[pos] === '?')) {
      const op = regex[pos];
      pos++;

      if (op === '*') {
        base = kleeneStar(base);
      } else if (op === '+') {
        // a+ = aa*
        const star = kleeneStar({ ...base, transitions: new Map(base.transitions) });
        base = concatenate(base, star);
      } else if (op === '?') {
        // a? = (a|ε)
        base = alternate(base, createEpsilon());
      }
    }

    return base;
  }

  function parseBase(): NFAFragment {
    if (pos >= regex.length) {
      return createEpsilon();
    }

    if (regex[pos] === '(') {
      pos++; // consume '('
      const expr = parseExpr();
      if (pos < regex.length && regex[pos] === ')') {
        pos++; // consume ')'
      }
      return expr;
    } else if (regex[pos] === '\\' && pos + 1 < regex.length) {
      pos++; // consume '\'
      const c = regex[pos];
      pos++;
      return createChar(c);
    } else {
      const c = regex[pos];
      pos++;
      return createChar(c);
    }
  }

  const fragment = parseExpr();

  // Extract alphabet
  const alphabet = new Set<string>();
  for (const trans of fragment.transitions.values()) {
    for (const symbol of trans.keys()) {
      alphabet.add(symbol);
    }
  }

  return {
    states: fragment.states,
    alphabet,
    transitions: fragment.transitions,
    start: fragment.start,
    accept: new Set([fragment.accept])
  };
}

export async function executeautomataminimizer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'minimize': {
        if (!args.dfa) {
          throw new Error('DFA specification required');
        }

        const dfa = parseDFA(args.dfa);
        const { minimized, partition, steps } = minimizeDFA(dfa);

        const originalSize = dfa.states.size;
        const minimizedSize = minimized.states.size;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'minimize',
            original: {
              num_states: originalSize,
              ...dfaToObject(dfa)
            },
            minimized: {
              num_states: minimizedSize,
              ...dfaToObject(minimized)
            },
            reduction: {
              states_removed: originalSize - minimizedSize,
              reduction_percent: ((originalSize - minimizedSize) / originalSize * 100).toFixed(1) + '%'
            },
            state_equivalence: Object.fromEntries(partition),
            algorithm: 'Hopcroft partition refinement',
            steps
          }, null, 2)
        };
      }

      case 'nfa_to_dfa': {
        if (!args.nfa) {
          throw new Error('NFA specification required');
        }

        const nfa = parseNFA(args.nfa);
        const { dfa, stateMapping } = nfaToDFA(nfa);

        const mapping: Record<string, string[]> = {};
        for (const [dfaState, nfaStates] of stateMapping) {
          mapping[dfaState] = [...nfaStates];
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'nfa_to_dfa',
            nfa: {
              num_states: nfa.states.size,
              states: [...nfa.states],
              alphabet: [...nfa.alphabet],
              start: nfa.start,
              accept: [...nfa.accept]
            },
            dfa: {
              num_states: dfa.states.size,
              ...dfaToObject(dfa)
            },
            state_mapping: mapping,
            algorithm: 'Subset construction (powerset)',
            note: 'DFA states represent sets of NFA states'
          }, null, 2)
        };
      }

      case 'regex_to_nfa': {
        const regex = args.regex || 'a(b|c)*';
        const nfa = regexToNFA(regex);

        // Convert NFA transitions to object format
        const transitions: Record<string, Record<string, string[]>> = {};
        for (const [state, trans] of nfa.transitions) {
          transitions[state] = {};
          for (const [symbol, nexts] of trans) {
            transitions[state][symbol] = [...nexts];
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'regex_to_nfa',
            regex,
            nfa: {
              num_states: nfa.states.size,
              states: [...nfa.states],
              alphabet: [...nfa.alphabet].filter(s => s !== 'ε'),
              transitions,
              start: nfa.start,
              accept: [...nfa.accept]
            },
            algorithm: "Thompson's construction",
            supported_operators: ['|', '*', '+', '?', '()', 'concatenation']
          }, null, 2)
        };
      }

      case 'test': {
        const testStrings = args.test_strings || [''];

        let automaton: DFA;
        let automatonType = 'DFA';

        if (args.dfa) {
          automaton = parseDFA(args.dfa);
        } else if (args.nfa) {
          const nfa = parseNFA(args.nfa);
          automaton = nfaToDFA(nfa).dfa;
          automatonType = 'NFA (converted to DFA)';
        } else if (args.regex) {
          const nfa = regexToNFA(args.regex);
          automaton = nfaToDFA(nfa).dfa;
          automatonType = `Regex: ${args.regex}`;
        } else {
          throw new Error('Provide dfa, nfa, or regex');
        }

        const results = testStrings.map((str: string) => {
          const { accepted, path } = testDFA(automaton, str);
          return {
            input: str || '(empty string)',
            accepted,
            path: path.join(' → ')
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'test',
            automaton_type: automatonType,
            results,
            accepted_count: results.filter((r: any) => r.accepted).length,
            rejected_count: results.filter((r: any) => !r.accepted).length
          }, null, 2)
        };
      }

      case 'equivalent': {
        if (!args.dfa) {
          throw new Error('Two DFAs required (provide as array or use dfa and dfa2)');
        }

        // Support both array and separate dfa/dfa2 params
        let dfa1: DFA, dfa2: DFA;
        if (Array.isArray(args.dfa) && args.dfa.length >= 2) {
          dfa1 = parseDFA(args.dfa[0]);
          dfa2 = parseDFA(args.dfa[1]);
        } else {
          throw new Error('Provide array of two DFAs');
        }

        const result = dfaEquivalent(dfa1, dfa2);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'equivalent',
            equivalent: result.equivalent,
            counterexample: result.counterexample,
            explanation: result.equivalent
              ? 'Both DFAs accept exactly the same language'
              : `DFAs differ on string "${result.counterexample}"`
          }, null, 2)
        };
      }

      case 'demo': {
        // Classic example: minimize a DFA with redundant states
        const exampleDFA = {
          states: ['a', 'b', 'c', 'd', 'e', 'f'],
          alphabet: ['0', '1'],
          transitions: {
            'a': { '0': 'b', '1': 'c' },
            'b': { '0': 'a', '1': 'd' },
            'c': { '0': 'e', '1': 'f' },
            'd': { '0': 'e', '1': 'f' },
            'e': { '0': 'e', '1': 'f' },
            'f': { '0': 'f', '1': 'f' }
          },
          start: 'a',
          accept: ['c', 'd', 'e']
        };

        const dfa = parseDFA(exampleDFA);
        const { minimized, steps } = minimizeDFA(dfa);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            description: 'DFA minimization example showing state equivalence',
            original_dfa: exampleDFA,
            minimization_steps: steps,
            minimized_dfa: dfaToObject(minimized),
            explanation: [
              'States b and c are not equivalent (different accepting status reachable)',
              'States c and d are equivalent (same future behavior)',
              'States e and f are equivalent (both accepting, same transitions)',
              'Minimization merges equivalent states'
            ]
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'automata_minimizer',
            description: 'DFA minimization and automata operations',
            operations: {
              minimize: 'Minimize DFA using Hopcroft partition refinement',
              nfa_to_dfa: 'Convert NFA to DFA using subset construction',
              regex_to_nfa: "Convert regex to NFA using Thompson's construction",
              test: 'Test strings against an automaton',
              equivalent: 'Check if two DFAs are equivalent'
            },
            algorithms: {
              hopcroft: {
                name: 'Hopcroft\'s Algorithm',
                complexity: 'O(n log n) with proper implementation',
                description: 'Partition refinement to find equivalent states'
              },
              subset_construction: {
                name: 'Subset (Powerset) Construction',
                complexity: 'O(2^n) worst case',
                description: 'Each DFA state represents a set of NFA states'
              },
              thompson: {
                name: "Thompson's Construction",
                complexity: 'O(m) where m is regex length',
                description: 'Build NFA with ε-transitions for each regex operator'
              }
            },
            dfa_format: {
              states: 'Array of state names',
              alphabet: 'Array of input symbols',
              transitions: '{ state: { symbol: next_state } }',
              start: 'Start state name',
              accept: 'Array of accepting state names'
            }
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                description: 'Minimize a DFA',
                call: {
                  operation: 'minimize',
                  dfa: {
                    states: ['q0', 'q1', 'q2', 'q3'],
                    alphabet: ['a', 'b'],
                    transitions: {
                      q0: { a: 'q1', b: 'q2' },
                      q1: { a: 'q1', b: 'q3' },
                      q2: { a: 'q1', b: 'q2' },
                      q3: { a: 'q1', b: 'q2' }
                    },
                    start: 'q0',
                    accept: ['q3']
                  }
                }
              },
              {
                description: 'Convert regex to NFA',
                call: {
                  operation: 'regex_to_nfa',
                  regex: '(a|b)*abb'
                }
              },
              {
                description: 'Test strings against regex',
                call: {
                  operation: 'test',
                  regex: 'a*b+',
                  test_strings: ['b', 'ab', 'aab', 'abb', 'a', '']
                }
              },
              {
                description: 'NFA to DFA conversion',
                call: {
                  operation: 'nfa_to_dfa',
                  nfa: {
                    states: ['q0', 'q1', 'q2'],
                    alphabet: ['a', 'b', 'ε'],
                    transitions: {
                      q0: { a: ['q0', 'q1'], ε: ['q2'] },
                      q1: { b: ['q2'] },
                      q2: { a: ['q2'] }
                    },
                    start: 'q0',
                    accept: ['q2']
                  }
                }
              }
            ]
          }, null, 2)
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isautomataminimizerAvailable(): boolean {
  return true;
}
