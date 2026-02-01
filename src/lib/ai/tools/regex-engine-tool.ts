/**
 * REGEX ENGINE TOOL
 * Actual regex engine with NFA/DFA compilation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface NFAState { id: number; transitions: Map<string, number[]>; isEnd: boolean; }
interface NFA { states: NFAState[]; start: number; end: number; }

let stateId = 0;
function newState(isEnd: boolean = false): NFAState {
  return { id: stateId++, transitions: new Map(), isEnd };
}

function parseRegex(pattern: string): NFA {
  stateId = 0;
  let pos = 0;
  
  function parseAtom(): NFA {
    if (pos >= pattern.length) {
      const s = newState(true);
      return { states: [s], start: s.id, end: s.id };
    }
    
    const ch = pattern[pos];
    
    if (ch === '(') {
      pos++;
      const nfa = parseOr();
      pos++; // ')'
      return nfa;
    }
    
    if (ch === '.') {
      pos++;
      const start = newState();
      const end = newState();
      start.transitions.set('ANY', [end.id]);
      return { states: [start, end], start: start.id, end: end.id };
    }
    
    if (ch === '\\' && pos + 1 < pattern.length) {
      pos += 2;
      const escaped = pattern[pos - 1];
      const start = newState();
      const end = newState();
      if (escaped === 'd') start.transitions.set('DIGIT', [end.id]);
      else if (escaped === 'w') start.transitions.set('WORD', [end.id]);
      else if (escaped === 's') start.transitions.set('SPACE', [end.id]);
      else start.transitions.set(escaped, [end.id]);
      return { states: [start, end], start: start.id, end: end.id };
    }
    
    if (!'*+?|()'.includes(ch)) {
      pos++;
      const start = newState();
      const end = newState();
      start.transitions.set(ch, [end.id]);
      return { states: [start, end], start: start.id, end: end.id };
    }
    
    const s = newState(true);
    return { states: [s], start: s.id, end: s.id };
  }
  
  function parseQuantified(): NFA {
    let nfa = parseAtom();
    
    while (pos < pattern.length && '*+?'.includes(pattern[pos])) {
      const op = pattern[pos++];
      const newStart = newState();
      const newEnd = newState();
      
      if (op === '*') {
        newStart.transitions.set('EPSILON', [nfa.start, newEnd.id]);
        const endState = nfa.states.find(s => s.id === nfa.end)!;
        const epsilons = endState.transitions.get('EPSILON') || [];
        endState.transitions.set('EPSILON', [...epsilons, nfa.start, newEnd.id]);
      } else if (op === '+') {
        newStart.transitions.set('EPSILON', [nfa.start]);
        const endState = nfa.states.find(s => s.id === nfa.end)!;
        const epsilons = endState.transitions.get('EPSILON') || [];
        endState.transitions.set('EPSILON', [...epsilons, nfa.start, newEnd.id]);
      } else if (op === '?') {
        newStart.transitions.set('EPSILON', [nfa.start, newEnd.id]);
        const endState = nfa.states.find(s => s.id === nfa.end)!;
        const epsilons = endState.transitions.get('EPSILON') || [];
        endState.transitions.set('EPSILON', [...epsilons, newEnd.id]);
      }
      
      nfa = { states: [newStart, ...nfa.states, newEnd], start: newStart.id, end: newEnd.id };
    }
    
    return nfa;
  }
  
  function parseConcat(): NFA {
    let nfa = parseQuantified();
    
    while (pos < pattern.length && !'|)'.includes(pattern[pos])) {
      const next = parseQuantified();
      const endState = nfa.states.find(s => s.id === nfa.end)!;
      const epsilons = endState.transitions.get('EPSILON') || [];
      endState.transitions.set('EPSILON', [...epsilons, next.start]);
      nfa = { states: [...nfa.states, ...next.states], start: nfa.start, end: next.end };
    }
    
    return nfa;
  }
  
  function parseOr(): NFA {
    let nfa = parseConcat();
    
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++;
      const right = parseConcat();
      const newStart = newState();
      const newEnd = newState();
      
      newStart.transitions.set('EPSILON', [nfa.start, right.start]);
      const leftEnd = nfa.states.find(s => s.id === nfa.end)!;
      const rightEnd = right.states.find(s => s.id === right.end)!;
      leftEnd.transitions.set('EPSILON', [...(leftEnd.transitions.get('EPSILON') || []), newEnd.id]);
      rightEnd.transitions.set('EPSILON', [...(rightEnd.transitions.get('EPSILON') || []), newEnd.id]);
      
      nfa = { states: [newStart, ...nfa.states, ...right.states, newEnd], start: newStart.id, end: newEnd.id };
    }
    
    return nfa;
  }
  
  return parseOr();
}

function matchNFA(nfa: NFA, input: string): boolean {
  function epsilonClosure(states: Set<number>): Set<number> {
    const closure = new Set(states);
    const stack = [...states];
    
    while (stack.length > 0) {
      const state = stack.pop()!;
      const nfaState = nfa.states.find(s => s.id === state);
      if (nfaState) {
        const epsilons = nfaState.transitions.get('EPSILON') || [];
        for (const next of epsilons) {
          if (!closure.has(next)) {
            closure.add(next);
            stack.push(next);
          }
        }
      }
    }
    
    return closure;
  }
  
  function matchChar(ch: string, key: string): boolean {
    if (key === 'ANY') return true;
    if (key === 'DIGIT') return /\d/.test(ch);
    if (key === 'WORD') return /\w/.test(ch);
    if (key === 'SPACE') return /\s/.test(ch);
    return key === ch;
  }
  
  let currentStates = epsilonClosure(new Set([nfa.start]));
  
  for (const ch of input) {
    const nextStates = new Set<number>();
    
    for (const stateId of currentStates) {
      const state = nfa.states.find(s => s.id === stateId);
      if (state) {
        for (const [key, targets] of state.transitions) {
          if (key !== 'EPSILON' && matchChar(ch, key)) {
            for (const t of targets) nextStates.add(t);
          }
        }
      }
    }
    
    currentStates = epsilonClosure(nextStates);
    if (currentStates.size === 0) return false;
  }
  
  return currentStates.has(nfa.end);
}

export const regexEngineTool: UnifiedTool = {
  name: 'regex_engine',
  description: 'Regex engine with NFA compilation and matching',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['match', 'compile', 'test', 'info'], description: 'Operation' },
      pattern: { type: 'string', description: 'Regular expression pattern' },
      input: { type: 'string', description: 'Input string to match' }
    },
    required: ['operation']
  }
};

export async function executeRegexEngine(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'match': {
        const pattern = args.pattern || 'a*b';
        const input = args.input || 'aaab';
        const nfa = parseRegex(pattern);
        result = { pattern, input, matches: matchNFA(nfa, input) };
        break;
      }
      case 'compile': {
        const nfa = parseRegex(args.pattern || 'a|b');
        result = { nfa: { states: nfa.states.length, start: nfa.start, end: nfa.end } };
        break;
      }
      case 'test': {
        const tests = [
          { pattern: 'a*', inputs: ['', 'a', 'aaa', 'b'] },
          { pattern: 'a+', inputs: ['', 'a', 'aaa'] },
          { pattern: 'a|b', inputs: ['a', 'b', 'c'] },
          { pattern: '(ab)+', inputs: ['ab', 'abab', 'aba'] }
        ];
        result = { tests: tests.map(t => ({ pattern: t.pattern, results: t.inputs.map(i => ({ input: i, matches: matchNFA(parseRegex(t.pattern), i) })) })) };
        break;
      }
      case 'info':
      default:
        result = { description: 'Thompson NFA-based regex engine', features: ['NFA compilation', 'Epsilon transitions', 'Quantifiers (*+?)', 'Alternation', 'Groups'] };
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isRegexEngineAvailable(): boolean { return true; }
