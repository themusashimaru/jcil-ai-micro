/**
 * AUTOMATA THEORY TOOL
 *
 * Finite automata, regular expressions, and formal languages.
 * DFA, NFA, regex to automaton conversion.
 *
 * Part of TIER ADVANCED SCIENCE - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// DFA (DETERMINISTIC FINITE AUTOMATON)
// ============================================================================

interface DFA {
  states: Set<string>;
  alphabet: Set<string>;
  transitions: Map<string, Map<string, string>>;
  startState: string;
  acceptStates: Set<string>;
}

function createDFA(
  states: string[],
  alphabet: string[],
  transitions: [string, string, string][],
  startState: string,
  acceptStates: string[]
): DFA {
  const dfa: DFA = {
    states: new Set(states),
    alphabet: new Set(alphabet),
    transitions: new Map(),
    startState,
    acceptStates: new Set(acceptStates),
  };

  for (const state of states) {
    dfa.transitions.set(state, new Map());
  }

  for (const [from, symbol, to] of transitions) {
    dfa.transitions.get(from)?.set(symbol, to);
  }

  return dfa;
}

function runDFA(dfa: DFA, input: string): { accepted: boolean; path: string[] } {
  let current = dfa.startState;
  const path = [current];

  for (const symbol of input) {
    const next = dfa.transitions.get(current)?.get(symbol);
    if (!next) {
      return { accepted: false, path };
    }
    current = next;
    path.push(current);
  }

  return { accepted: dfa.acceptStates.has(current), path };
}

// ============================================================================
// NFA (NONDETERMINISTIC FINITE AUTOMATON)
// ============================================================================

interface NFA {
  states: Set<string>;
  alphabet: Set<string>;
  transitions: Map<string, Map<string, Set<string>>>;
  startState: string;
  acceptStates: Set<string>;
}

function createNFA(
  states: string[],
  alphabet: string[],
  transitions: [string, string, string][],
  startState: string,
  acceptStates: string[]
): NFA {
  const nfa: NFA = {
    states: new Set(states),
    alphabet: new Set(alphabet),
    transitions: new Map(),
    startState,
    acceptStates: new Set(acceptStates),
  };

  for (const state of states) {
    nfa.transitions.set(state, new Map());
  }

  for (const [from, symbol, to] of transitions) {
    if (!nfa.transitions.get(from)?.has(symbol)) {
      nfa.transitions.get(from)?.set(symbol, new Set());
    }
    nfa.transitions.get(from)?.get(symbol)?.add(to);
  }

  return nfa;
}

function epsilonClosure(nfa: NFA, states: Set<string>): Set<string> {
  const closure = new Set(states);
  const stack = [...states];

  while (stack.length > 0) {
    const state = stack.pop()!;
    const epsilonTransitions = nfa.transitions.get(state)?.get('ε');
    if (epsilonTransitions) {
      for (const nextState of epsilonTransitions) {
        if (!closure.has(nextState)) {
          closure.add(nextState);
          stack.push(nextState);
        }
      }
    }
  }

  return closure;
}

function runNFA(nfa: NFA, input: string): { accepted: boolean; finalStates: string[] } {
  let currentStates = epsilonClosure(nfa, new Set([nfa.startState]));

  for (const symbol of input) {
    const nextStates = new Set<string>();
    for (const state of currentStates) {
      const transitions = nfa.transitions.get(state)?.get(symbol);
      if (transitions) {
        for (const nextState of transitions) {
          nextStates.add(nextState);
        }
      }
    }
    currentStates = epsilonClosure(nfa, nextStates);
  }

  const accepted = [...currentStates].some(state => nfa.acceptStates.has(state));
  return { accepted, finalStates: [...currentStates] };
}

// ============================================================================
// NFA TO DFA CONVERSION (SUBSET CONSTRUCTION)
// ============================================================================

function nfaToDFA(nfa: NFA): DFA {
  const startClosure = epsilonClosure(nfa, new Set([nfa.startState]));
  const startStateName = [...startClosure].sort().join(',');

  const dfaStates = new Set<string>([startStateName]);
  const dfaTransitions: [string, string, string][] = [];
  const dfaAcceptStates: string[] = [];
  const workList: Set<string>[] = [startClosure];
  const processed = new Map<string, Set<string>>();
  processed.set(startStateName, startClosure);

  while (workList.length > 0) {
    const currentSet = workList.shift()!;
    const currentName = [...currentSet].sort().join(',');

    // Check if accept state
    if ([...currentSet].some(s => nfa.acceptStates.has(s))) {
      dfaAcceptStates.push(currentName);
    }

    for (const symbol of nfa.alphabet) {
      if (symbol === 'ε') continue;

      const nextSet = new Set<string>();
      for (const state of currentSet) {
        const transitions = nfa.transitions.get(state)?.get(symbol);
        if (transitions) {
          for (const nextState of transitions) {
            nextSet.add(nextState);
          }
        }
      }

      const closureSet = epsilonClosure(nfa, nextSet);
      if (closureSet.size > 0) {
        const nextName = [...closureSet].sort().join(',');
        dfaTransitions.push([currentName, symbol, nextName]);

        if (!processed.has(nextName)) {
          processed.set(nextName, closureSet);
          dfaStates.add(nextName);
          workList.push(closureSet);
        }
      }
    }
  }

  return createDFA(
    [...dfaStates],
    [...nfa.alphabet].filter(s => s !== 'ε'),
    dfaTransitions,
    startStateName,
    dfaAcceptStates
  );
}

// ============================================================================
// SIMPLE REGEX TO NFA (THOMPSON'S CONSTRUCTION)
// ============================================================================

let stateCounter = 0;

function newState(): string {
  return `q${stateCounter++}`;
}

interface NFAFragment {
  start: string;
  accept: string;
  transitions: [string, string, string][];
  states: string[];
}

function regexToNFA(regex: string): NFA {
  stateCounter = 0;

  function parseAtom(i: number): { frag: NFAFragment; next: number } {
    if (i >= regex.length) throw new Error('Unexpected end');

    if (regex[i] === '(') {
      const { frag, next } = parseAlt(i + 1);
      if (regex[next] !== ')') throw new Error('Expected )');
      return { frag, next: next + 1 };
    }

    if (regex[i] === '\\' && i + 1 < regex.length) {
      const char = regex[i + 1];
      const start = newState();
      const accept = newState();
      return {
        frag: {
          start,
          accept,
          transitions: [[start, char, accept]],
          states: [start, accept],
        },
        next: i + 2,
      };
    }

    if (/[a-zA-Z0-9]/.test(regex[i])) {
      const start = newState();
      const accept = newState();
      return {
        frag: {
          start,
          accept,
          transitions: [[start, regex[i], accept]],
          states: [start, accept],
        },
        next: i + 1,
      };
    }

    // Epsilon
    const start = newState();
    const accept = newState();
    return {
      frag: {
        start,
        accept,
        transitions: [[start, 'ε', accept]],
        states: [start, accept],
      },
      next: i,
    };
  }

  function parseQuantified(i: number): { frag: NFAFragment; next: number } {
    let { frag, next } = parseAtom(i);

    while (next < regex.length && (regex[next] === '*' || regex[next] === '+' || regex[next] === '?')) {
      const op = regex[next];
      const newStart = newState();
      const newAccept = newState();

      if (op === '*') {
        frag = {
          start: newStart,
          accept: newAccept,
          transitions: [
            ...frag.transitions,
            [newStart, 'ε', frag.start],
            [newStart, 'ε', newAccept],
            [frag.accept, 'ε', frag.start],
            [frag.accept, 'ε', newAccept],
          ],
          states: [...frag.states, newStart, newAccept],
        };
      } else if (op === '+') {
        frag = {
          start: newStart,
          accept: newAccept,
          transitions: [
            ...frag.transitions,
            [newStart, 'ε', frag.start],
            [frag.accept, 'ε', frag.start],
            [frag.accept, 'ε', newAccept],
          ],
          states: [...frag.states, newStart, newAccept],
        };
      } else if (op === '?') {
        frag = {
          start: newStart,
          accept: newAccept,
          transitions: [
            ...frag.transitions,
            [newStart, 'ε', frag.start],
            [newStart, 'ε', newAccept],
            [frag.accept, 'ε', newAccept],
          ],
          states: [...frag.states, newStart, newAccept],
        };
      }

      next++;
    }

    return { frag, next };
  }

  function parseConcat(i: number): { frag: NFAFragment; next: number } {
    let result: NFAFragment | null = null;

    while (i < regex.length && regex[i] !== '|' && regex[i] !== ')') {
      const { frag, next } = parseQuantified(i);
      i = next;

      if (!result) {
        result = frag;
      } else {
        // Concatenate
        result = {
          start: result.start,
          accept: frag.accept,
          transitions: [...result.transitions, ...frag.transitions, [result.accept, 'ε', frag.start]],
          states: [...result.states, ...frag.states],
        };
      }
    }

    if (!result) {
      const start = newState();
      const accept = newState();
      result = { start, accept, transitions: [[start, 'ε', accept]], states: [start, accept] };
    }

    return { frag: result, next: i };
  }

  function parseAlt(i: number): { frag: NFAFragment; next: number } {
    let { frag: left, next } = parseConcat(i);

    while (next < regex.length && regex[next] === '|') {
      const { frag: right, next: nextNext } = parseConcat(next + 1);
      const newStart = newState();
      const newAccept = newState();

      left = {
        start: newStart,
        accept: newAccept,
        transitions: [
          ...left.transitions,
          ...right.transitions,
          [newStart, 'ε', left.start],
          [newStart, 'ε', right.start],
          [left.accept, 'ε', newAccept],
          [right.accept, 'ε', newAccept],
        ],
        states: [...left.states, ...right.states, newStart, newAccept],
      };

      next = nextNext;
    }

    return { frag: left, next };
  }

  const { frag } = parseAlt(0);

  // Extract alphabet
  const alphabet = new Set<string>();
  for (const [, symbol] of frag.transitions) {
    alphabet.add(symbol);
  }

  return createNFA(frag.states, [...alphabet], frag.transitions, frag.start, [frag.accept]);
}

// ============================================================================
// VISUALIZATION
// ============================================================================

function visualizeDFA(dfa: DFA): string {
  const lines: string[] = ['DFA Visualization:', `States: {${[...dfa.states].join(', ')}}`, `Alphabet: {${[...dfa.alphabet].join(', ')}}`, `Start: ${dfa.startState}`, `Accept: {${[...dfa.acceptStates].join(', ')}}`, '', 'Transitions:'];

  for (const [from, trans] of dfa.transitions) {
    for (const [symbol, to] of trans) {
      const fromLabel = dfa.acceptStates.has(from) ? `(${from})` : from;
      const toLabel = dfa.acceptStates.has(to) ? `(${to})` : to;
      lines.push(`  ${fromLabel} --${symbol}--> ${toLabel}`);
    }
  }

  return lines.join('\n');
}

function visualizeNFA(nfa: NFA): string {
  const lines: string[] = ['NFA Visualization:', `States: {${[...nfa.states].join(', ')}}`, `Alphabet: {${[...nfa.alphabet].join(', ')}}`, `Start: ${nfa.startState}`, `Accept: {${[...nfa.acceptStates].join(', ')}}`, '', 'Transitions:'];

  for (const [from, trans] of nfa.transitions) {
    for (const [symbol, toSet] of trans) {
      for (const to of toSet) {
        const fromLabel = nfa.acceptStates.has(from) ? `(${from})` : from;
        const toLabel = nfa.acceptStates.has(to) ? `(${to})` : to;
        lines.push(`  ${fromLabel} --${symbol}--> ${toLabel}`);
      }
    }
  }

  return lines.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const automataTheoryTool: UnifiedTool = {
  name: 'automata_theory',
  description: `Finite automata and regular expressions.

Operations:
- create_dfa: Create DFA from states/transitions
- create_nfa: Create NFA from states/transitions
- run_dfa: Run input through DFA
- run_nfa: Run input through NFA
- regex_to_nfa: Convert regex to NFA
- nfa_to_dfa: Convert NFA to DFA (subset construction)
- test_regex: Test if string matches regex via automaton`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create_dfa', 'create_nfa', 'run_dfa', 'run_nfa', 'regex_to_nfa', 'nfa_to_dfa', 'test_regex'],
        description: 'Automata operation',
      },
      states: { type: 'string', description: 'States as JSON array' },
      alphabet: { type: 'string', description: 'Alphabet as JSON array' },
      transitions: { type: 'string', description: 'Transitions as JSON [[from,symbol,to],...]' },
      start_state: { type: 'string', description: 'Start state' },
      accept_states: { type: 'string', description: 'Accept states as JSON array' },
      input: { type: 'string', description: 'Input string to process' },
      regex: { type: 'string', description: 'Regular expression' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeAutomataTheory(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'create_dfa': {
        const states: string[] = JSON.parse(args.states || '["q0", "q1", "q2"]');
        const alphabet: string[] = JSON.parse(args.alphabet || '["0", "1"]');
        const transitions: [string, string, string][] = JSON.parse(args.transitions || '[["q0","0","q0"],["q0","1","q1"],["q1","0","q2"],["q1","1","q0"],["q2","0","q1"],["q2","1","q2"]]');
        const startState = args.start_state || 'q0';
        const acceptStates: string[] = JSON.parse(args.accept_states || '["q0"]');

        const dfa = createDFA(states, alphabet, transitions, startState, acceptStates);

        result = {
          operation: 'create_dfa',
          states: [...dfa.states],
          alphabet: [...dfa.alphabet],
          start_state: dfa.startState,
          accept_states: [...dfa.acceptStates],
          transition_count: transitions.length,
          visualization: visualizeDFA(dfa),
        };
        break;
      }

      case 'create_nfa': {
        const states: string[] = JSON.parse(args.states || '["q0", "q1", "q2"]');
        const alphabet: string[] = JSON.parse(args.alphabet || '["a", "b", "ε"]');
        const transitions: [string, string, string][] = JSON.parse(args.transitions || '[["q0","a","q0"],["q0","a","q1"],["q0","ε","q2"],["q1","b","q2"]]');
        const startState = args.start_state || 'q0';
        const acceptStates: string[] = JSON.parse(args.accept_states || '["q2"]');

        const nfa = createNFA(states, alphabet, transitions, startState, acceptStates);

        result = {
          operation: 'create_nfa',
          states: [...nfa.states],
          alphabet: [...nfa.alphabet],
          start_state: nfa.startState,
          accept_states: [...nfa.acceptStates],
          is_nfa: true,
          has_epsilon: nfa.alphabet.has('ε'),
          visualization: visualizeNFA(nfa),
        };
        break;
      }

      case 'run_dfa': {
        const states: string[] = JSON.parse(args.states || '["q0", "q1"]');
        const alphabet: string[] = JSON.parse(args.alphabet || '["a", "b"]');
        const transitions: [string, string, string][] = JSON.parse(args.transitions || '[["q0","a","q1"],["q0","b","q0"],["q1","a","q1"],["q1","b","q0"]]');
        const startState = args.start_state || 'q0';
        const acceptStates: string[] = JSON.parse(args.accept_states || '["q1"]');
        const input = args.input || 'aab';

        const dfa = createDFA(states, alphabet, transitions, startState, acceptStates);
        const { accepted, path } = runDFA(dfa, input);

        result = {
          operation: 'run_dfa',
          input,
          accepted,
          path,
          final_state: path[path.length - 1],
          description: accepted ? `"${input}" is ACCEPTED by this DFA` : `"${input}" is REJECTED by this DFA`,
        };
        break;
      }

      case 'run_nfa': {
        const states: string[] = JSON.parse(args.states || '["q0", "q1", "q2"]');
        const alphabet: string[] = JSON.parse(args.alphabet || '["a", "b", "ε"]');
        const transitions: [string, string, string][] = JSON.parse(args.transitions || '[["q0","a","q0"],["q0","a","q1"],["q1","b","q2"]]');
        const startState = args.start_state || 'q0';
        const acceptStates: string[] = JSON.parse(args.accept_states || '["q2"]');
        const input = args.input || 'ab';

        const nfa = createNFA(states, alphabet, transitions, startState, acceptStates);
        const { accepted, finalStates } = runNFA(nfa, input);

        result = {
          operation: 'run_nfa',
          input,
          accepted,
          final_states: finalStates,
          description: accepted ? `"${input}" is ACCEPTED by this NFA` : `"${input}" is REJECTED by this NFA`,
        };
        break;
      }

      case 'regex_to_nfa': {
        const regex = args.regex || 'a(b|c)*';
        stateCounter = 0;

        const nfa = regexToNFA(regex);

        result = {
          operation: 'regex_to_nfa',
          regex,
          states: [...nfa.states],
          alphabet: [...nfa.alphabet].filter(s => s !== 'ε'),
          state_count: nfa.states.size,
          has_epsilon_transitions: nfa.alphabet.has('ε'),
          visualization: visualizeNFA(nfa),
        };
        break;
      }

      case 'nfa_to_dfa': {
        const states: string[] = JSON.parse(args.states || '["q0", "q1", "q2"]');
        const alphabet: string[] = JSON.parse(args.alphabet || '["a", "b", "ε"]');
        const transitions: [string, string, string][] = JSON.parse(args.transitions || '[["q0","a","q0"],["q0","a","q1"],["q0","ε","q2"],["q1","b","q2"]]');
        const startState = args.start_state || 'q0';
        const acceptStates: string[] = JSON.parse(args.accept_states || '["q2"]');

        const nfa = createNFA(states, alphabet, transitions, startState, acceptStates);
        const dfa = nfaToDFA(nfa);

        result = {
          operation: 'nfa_to_dfa',
          original_nfa_states: states.length,
          resulting_dfa_states: dfa.states.size,
          dfa_alphabet: [...dfa.alphabet],
          dfa_start: dfa.startState,
          dfa_accept: [...dfa.acceptStates],
          visualization: visualizeDFA(dfa),
        };
        break;
      }

      case 'test_regex': {
        const regex = args.regex || 'ab*';
        const input = args.input || 'abbb';
        stateCounter = 0;

        const nfa = regexToNFA(regex);
        const { accepted } = runNFA(nfa, input);

        result = {
          operation: 'test_regex',
          regex,
          input,
          matches: accepted,
          description: accepted ? `"${input}" MATCHES regex /${regex}/` : `"${input}" does NOT match regex /${regex}/`,
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Automata Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isAutomataTheoryAvailable(): boolean { return true; }
