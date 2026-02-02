/**
 * STATE MACHINE TOOL
 * Finite state machines, transitions, guards, and actions
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Transition { from: string; to: string; event: string; guard?: string; action?: string; }
interface State { name: string; onEnter?: string; onExit?: string; data?: Record<string, unknown>; }
interface StateMachine { id: string; name: string; states: Record<string, State>; transitions: Transition[]; initialState: string; currentState: string; history: string[]; }

function createStateMachine(name: string, states: string[], initialState: string): StateMachine {
  return {
    id: 'sm_' + Math.random().toString(36).substr(2, 9),
    name,
    states: Object.fromEntries(states.map(s => [s, { name: s }])),
    transitions: [],
    initialState,
    currentState: initialState,
    history: [initialState]
  };
}

function addTransition(sm: StateMachine, from: string, to: string, event: string, guard?: string, action?: string): StateMachine {
  if (!sm.states[from] || !sm.states[to]) {
    throw new Error(`Invalid state: ${!sm.states[from] ? from : to}`);
  }

  sm.transitions.push({ from, to, event, guard, action });
  return sm;
}

function canTransition(sm: StateMachine, event: string): { canTransition: boolean; transition?: Transition; reason?: string } {
  const validTransitions = sm.transitions.filter(t => t.from === sm.currentState && t.event === event);

  if (validTransitions.length === 0) {
    return { canTransition: false, reason: `No transition for event '${event}' from state '${sm.currentState}'` };
  }

  const transition = validTransitions[0];
  return { canTransition: true, transition };
}

function transition(sm: StateMachine, event: string): { success: boolean; sm: StateMachine; message: string } {
  const check = canTransition(sm, event);

  if (!check.canTransition || !check.transition) {
    return { success: false, sm, message: check.reason || 'Cannot transition' };
  }

  const t = check.transition;
  const previousState = sm.currentState;
  sm.currentState = t.to;
  sm.history.push(t.to);

  return {
    success: true,
    sm,
    message: `Transitioned from '${previousState}' to '${t.to}' on event '${event}'`
  };
}

function getAvailableEvents(sm: StateMachine): string[] {
  return [...new Set(sm.transitions.filter(t => t.from === sm.currentState).map(t => t.event))];
}

function visualize(sm: StateMachine): string {
  let output = `State Machine: ${sm.name}\n`;
  output += `Current State: [${sm.currentState}]\n\n`;
  output += 'States:\n';

  for (const state of Object.values(sm.states)) {
    const marker = state.name === sm.currentState ? '→ ' : '  ';
    output += `${marker}(${state.name})\n`;
  }

  output += '\nTransitions:\n';
  for (const t of sm.transitions) {
    const active = t.from === sm.currentState ? '→ ' : '  ';
    let line = `${active}${t.from} --[${t.event}]--> ${t.to}`;
    if (t.guard) line += ` [guard: ${t.guard}]`;
    if (t.action) line += ` {action: ${t.action}}`;
    output += line + '\n';
  }

  return output;
}

function toDot(sm: StateMachine): string {
  let dot = `digraph ${sm.name.replace(/\s/g, '_')} {\n`;
  dot += '  rankdir=LR;\n';
  dot += '  node [shape=ellipse];\n';
  dot += `  ${sm.currentState} [style=filled, fillcolor=lightblue];\n`;

  for (const t of sm.transitions) {
    dot += `  ${t.from} -> ${t.to} [label="${t.event}"];\n`;
  }

  dot += '}\n';
  return dot;
}

function toMermaid(sm: StateMachine): string {
  let mermaid = 'stateDiagram-v2\n';
  mermaid += `  [*] --> ${sm.initialState}\n`;

  for (const t of sm.transitions) {
    mermaid += `  ${t.from} --> ${t.to}: ${t.event}\n`;
  }

  return mermaid;
}

function analyze(sm: StateMachine): Record<string, unknown> {
  const unreachableStates = Object.keys(sm.states).filter(s => {
    if (s === sm.initialState) return false;
    return !sm.transitions.some(t => t.to === s);
  });

  const terminalStates = Object.keys(sm.states).filter(s => {
    return !sm.transitions.some(t => t.from === s);
  });

  const transitionsPerState: Record<string, number> = {};
  for (const s of Object.keys(sm.states)) {
    transitionsPerState[s] = sm.transitions.filter(t => t.from === s).length;
  }

  return {
    name: sm.name,
    stateCount: Object.keys(sm.states).length,
    transitionCount: sm.transitions.length,
    currentState: sm.currentState,
    initialState: sm.initialState,
    unreachableStates,
    terminalStates,
    transitionsPerState,
    historyLength: sm.history.length,
    availableEvents: getAvailableEvents(sm)
  };
}

// Preset state machines
function createTrafficLight(): StateMachine {
  const sm = createStateMachine('Traffic Light', ['red', 'yellow', 'green'], 'red');
  addTransition(sm, 'red', 'green', 'timer');
  addTransition(sm, 'green', 'yellow', 'timer');
  addTransition(sm, 'yellow', 'red', 'timer');
  return sm;
}

function createDoor(): StateMachine {
  const sm = createStateMachine('Door', ['closed', 'open', 'locked'], 'closed');
  addTransition(sm, 'closed', 'open', 'open');
  addTransition(sm, 'open', 'closed', 'close');
  addTransition(sm, 'closed', 'locked', 'lock');
  addTransition(sm, 'locked', 'closed', 'unlock');
  return sm;
}

function createVendingMachine(): StateMachine {
  const sm = createStateMachine('Vending Machine', ['idle', 'selecting', 'dispensing', 'refunding'], 'idle');
  addTransition(sm, 'idle', 'selecting', 'insert_coin');
  addTransition(sm, 'selecting', 'dispensing', 'select_item');
  addTransition(sm, 'selecting', 'refunding', 'cancel');
  addTransition(sm, 'dispensing', 'idle', 'item_dispensed');
  addTransition(sm, 'refunding', 'idle', 'refund_complete');
  return sm;
}

export const stateMachineTool: UnifiedTool = {
  name: 'state_machine',
  description: 'State Machine: create, transition, visualize, dot, mermaid, analyze, presets',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'add_transition', 'transition', 'can_transition', 'visualize', 'dot', 'mermaid', 'analyze', 'available_events', 'presets', 'preset'] },
      name: { type: 'string' },
      states: { type: 'array' },
      initialState: { type: 'string' },
      sm: { type: 'object' },
      from: { type: 'string' },
      to: { type: 'string' },
      event: { type: 'string' },
      guard: { type: 'string' },
      action: { type: 'string' },
      preset: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executeStateMachine(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'create':
        const states = args.states || ['idle', 'active', 'complete'];
        const initial = args.initialState || states[0];
        result = { sm: createStateMachine(args.name || 'New State Machine', states, initial) };
        break;
      case 'add_transition':
        if (!args.sm || !args.from || !args.to || !args.event) throw new Error('sm, from, to, event required');
        result = { sm: addTransition(args.sm, args.from, args.to, args.event, args.guard, args.action) };
        break;
      case 'transition':
        if (!args.sm || !args.event) throw new Error('sm and event required');
        result = transition(args.sm, args.event);
        break;
      case 'can_transition':
        if (!args.sm || !args.event) throw new Error('sm and event required');
        result = canTransition(args.sm, args.event);
        break;
      case 'visualize':
        const vizSm = args.sm || createTrafficLight();
        result = { visualization: visualize(vizSm) };
        break;
      case 'dot':
        const dotSm = args.sm || createTrafficLight();
        result = { dot: toDot(dotSm) };
        break;
      case 'mermaid':
        const mermaidSm = args.sm || createTrafficLight();
        result = { mermaid: toMermaid(mermaidSm) };
        break;
      case 'analyze':
        const analyzeSm = args.sm || createTrafficLight();
        result = analyze(analyzeSm);
        break;
      case 'available_events':
        if (!args.sm) throw new Error('sm required');
        result = { events: getAvailableEvents(args.sm), currentState: args.sm.currentState };
        break;
      case 'presets':
        result = {
          presets: ['traffic_light', 'door', 'vending_machine'],
          descriptions: {
            traffic_light: 'Simple traffic light with red, yellow, green states',
            door: 'Door with open, closed, locked states',
            vending_machine: 'Vending machine with item selection and refund'
          }
        };
        break;
      case 'preset':
        const presetName = args.preset || 'traffic_light';
        let presetSm: StateMachine;
        switch (presetName) {
          case 'traffic_light': presetSm = createTrafficLight(); break;
          case 'door': presetSm = createDoor(); break;
          case 'vending_machine': presetSm = createVendingMachine(); break;
          default: presetSm = createTrafficLight();
        }
        result = { sm: presetSm, visualization: visualize(presetSm) };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isStateMachineAvailable(): boolean { return true; }
