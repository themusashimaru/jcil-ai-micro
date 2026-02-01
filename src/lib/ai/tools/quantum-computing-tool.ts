/**
 * QUANTUM COMPUTING SIMULATOR TOOL
 *
 * Simulate quantum circuits, qubits, gates, and algorithms.
 * Educational quantum computing without external dependencies.
 *
 * Part of TIER SCIENCE SUPREME - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// COMPLEX NUMBER OPERATIONS
// ============================================================================

interface Complex {
  re: number;
  im: number;
}

const complex = (re: number, im: number = 0): Complex => ({ re, im });
const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const _cSub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const cScale = (a: Complex, s: number): Complex => ({ re: a.re * s, im: a.im * s });
const _cConj = (a: Complex): Complex => ({ re: a.re, im: -a.im });
const _cAbs = (a: Complex): number => Math.sqrt(a.re * a.re + a.im * a.im);
const cNorm = (a: Complex): number => a.re * a.re + a.im * a.im;
// Suppress unused lint: _cSub, _cConj, _cAbs are for future use
void _cSub; void _cConj; void _cAbs;

// ============================================================================
// QUANTUM STATE VECTOR
// ============================================================================

type StateVector = Complex[];

function createQubitState(numQubits: number): StateVector {
  const size = Math.pow(2, numQubits);
  const state: StateVector = Array(size).fill(null).map(() => complex(0));
  state[0] = complex(1); // |00...0⟩
  return state;
}

function _tensorProduct(a: StateVector, b: StateVector): StateVector {
  const result: StateVector = [];
  for (const ai of a) {
    for (const bi of b) {
      result.push(cMul(ai, bi));
    }
  }
  return result;
}

function _normalize(state: StateVector): StateVector {
  const norm = Math.sqrt(state.reduce((sum, c) => sum + cNorm(c), 0));
  return state.map(c => cScale(c, 1 / norm));
}
// Suppress unused lint: _tensorProduct, _normalize are for future use
void _tensorProduct; void _normalize;

// ============================================================================
// QUANTUM GATES
// ============================================================================

type Gate = Complex[][];

const SQRT2_INV = 1 / Math.sqrt(2);

const GATES: Record<string, Gate> = {
  // Pauli gates
  I: [[complex(1), complex(0)], [complex(0), complex(1)]],
  X: [[complex(0), complex(1)], [complex(1), complex(0)]],
  Y: [[complex(0), complex(0, -1)], [complex(0, 1), complex(0)]],
  Z: [[complex(1), complex(0)], [complex(0), complex(-1)]],

  // Hadamard
  H: [[complex(SQRT2_INV), complex(SQRT2_INV)], [complex(SQRT2_INV), complex(-SQRT2_INV)]],

  // Phase gates
  S: [[complex(1), complex(0)], [complex(0), complex(0, 1)]],
  T: [[complex(1), complex(0)], [complex(0), complex(Math.cos(Math.PI/4), Math.sin(Math.PI/4))]],

  // Square root of NOT
  SX: [[complex(0.5, 0.5), complex(0.5, -0.5)], [complex(0.5, -0.5), complex(0.5, 0.5)]],
};

function createRotationGate(axis: 'X' | 'Y' | 'Z', theta: number): Gate {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);

  switch (axis) {
    case 'X':
      return [[complex(c), complex(0, -s)], [complex(0, -s), complex(c)]];
    case 'Y':
      return [[complex(c), complex(-s)], [complex(s), complex(c)]];
    case 'Z':
      return [[complex(c, -s), complex(0)], [complex(0), complex(c, s)]];
  }
}

// ============================================================================
// GATE APPLICATION
// ============================================================================

function applySingleQubitGate(state: StateVector, gate: Gate, target: number, _numQubits: number): StateVector {
  const newState: StateVector = state.map(() => complex(0));
  const size = state.length;

  for (let i = 0; i < size; i++) {
    const bit = (i >> target) & 1;
    for (let j = 0; j < 2; j++) {
      const newIdx = (i & ~(1 << target)) | (j << target);
      newState[newIdx] = cAdd(newState[newIdx], cMul(gate[j][bit], state[i]));
    }
  }

  return newState;
}

function applyCNOT(state: StateVector, control: number, target: number): StateVector {
  const newState = [...state];
  const size = state.length;

  for (let i = 0; i < size; i++) {
    if ((i >> control) & 1) {
      const flipped = i ^ (1 << target);
      const temp = newState[i];
      newState[i] = newState[flipped];
      newState[flipped] = temp;
    }
  }

  return newState;
}

function applyCZ(state: StateVector, control: number, target: number): StateVector {
  const newState = [...state];
  const size = state.length;

  for (let i = 0; i < size; i++) {
    if (((i >> control) & 1) && ((i >> target) & 1)) {
      newState[i] = cScale(newState[i], -1);
    }
  }

  return newState;
}

function applyToffoli(state: StateVector, c1: number, c2: number, target: number): StateVector {
  const newState = [...state];
  const size = state.length;

  for (let i = 0; i < size; i++) {
    if (((i >> c1) & 1) && ((i >> c2) & 1)) {
      const flipped = i ^ (1 << target);
      const temp = newState[i];
      newState[i] = newState[flipped];
      newState[flipped] = temp;
    }
  }

  return newState;
}

// ============================================================================
// MEASUREMENT
// ============================================================================

function measure(state: StateVector, numQubits: number): { result: string; probabilities: Record<string, number> } {
  const probs: Record<string, number> = {};
  let cumulative = 0;
  const r = Math.random();

  for (let i = 0; i < state.length; i++) {
    const prob = cNorm(state[i]);
    const binaryStr = i.toString(2).padStart(numQubits, '0');
    probs[binaryStr] = Math.round(prob * 10000) / 10000;
    cumulative += prob;
  }

  // Simulate measurement
  cumulative = 0;
  for (let i = 0; i < state.length; i++) {
    cumulative += cNorm(state[i]);
    if (r < cumulative) {
      return { result: i.toString(2).padStart(numQubits, '0'), probabilities: probs };
    }
  }

  return { result: '0'.repeat(numQubits), probabilities: probs };
}

// ============================================================================
// QUANTUM ALGORITHMS
// ============================================================================

function bellState(type: '00' | '01' | '10' | '11' = '00'): { state: StateVector; circuit: string[] } {
  let state = createQubitState(2);
  const circuit: string[] = [];

  // Apply initial X gates based on type
  if (type[0] === '1') {
    state = applySingleQubitGate(state, GATES.X, 0, 2);
    circuit.push('X(0)');
  }
  if (type[1] === '1') {
    state = applySingleQubitGate(state, GATES.X, 1, 2);
    circuit.push('X(1)');
  }

  // Create Bell state
  state = applySingleQubitGate(state, GATES.H, 0, 2);
  circuit.push('H(0)');
  state = applyCNOT(state, 0, 1);
  circuit.push('CNOT(0,1)');

  return { state, circuit };
}

function ghzState(numQubits: number): { state: StateVector; circuit: string[] } {
  let state = createQubitState(numQubits);
  const circuit: string[] = [];

  state = applySingleQubitGate(state, GATES.H, 0, numQubits);
  circuit.push('H(0)');

  for (let i = 1; i < numQubits; i++) {
    state = applyCNOT(state, 0, i);
    circuit.push(`CNOT(0,${i})`);
  }

  return { state, circuit };
}

function deutschJozsa(oracle: 'constant' | 'balanced', numQubits: number = 2): { result: string; circuit: string[] } {
  let state = createQubitState(numQubits);
  const circuit: string[] = [];

  // Initialize ancilla to |1⟩
  state = applySingleQubitGate(state, GATES.X, numQubits - 1, numQubits);
  circuit.push(`X(${numQubits - 1})`);

  // Apply Hadamard to all qubits
  for (let i = 0; i < numQubits; i++) {
    state = applySingleQubitGate(state, GATES.H, i, numQubits);
    circuit.push(`H(${i})`);
  }

  // Apply oracle
  if (oracle === 'balanced') {
    state = applyCNOT(state, 0, numQubits - 1);
    circuit.push(`Oracle: CNOT(0,${numQubits - 1})`);
  } else {
    circuit.push('Oracle: I (constant)');
  }

  // Apply Hadamard to input qubits
  for (let i = 0; i < numQubits - 1; i++) {
    state = applySingleQubitGate(state, GATES.H, i, numQubits);
    circuit.push(`H(${i})`);
  }

  const { result } = measure(state, numQubits);
  const inputBits = result.slice(0, -1);
  const isConstant = inputBits === '0'.repeat(numQubits - 1);

  return {
    result: isConstant ? 'constant' : 'balanced',
    circuit,
  };
}

// ============================================================================
// VISUALIZATION
// ============================================================================

function visualizeState(state: StateVector, numQubits: number): string {
  const lines: string[] = ['Quantum State:'];

  for (let i = 0; i < state.length; i++) {
    const amp = state[i];
    if (cNorm(amp) > 0.0001) {
      const basis = i.toString(2).padStart(numQubits, '0');
      const prob = cNorm(amp);
      const phase = Math.atan2(amp.im, amp.re);
      const bar = '█'.repeat(Math.round(prob * 20));
      lines.push(`|${basis}⟩: ${bar} ${(prob * 100).toFixed(1)}% (phase: ${(phase * 180 / Math.PI).toFixed(0)}°)`);
    }
  }

  return lines.join('\n');
}

function visualizeCircuit(circuit: string[], numQubits: number): string {
  const lines: string[][] = [];
  for (let q = 0; q < numQubits; q++) {
    lines.push([`q${q}: ─`]);
  }

  for (const gate of circuit) {
    const match = gate.match(/(\w+)\((\d+)(?:,(\d+))?\)/);
    if (match) {
      const [, name, target, control] = match;
      for (let q = 0; q < numQubits; q++) {
        if (q === parseInt(target)) {
          lines[q].push(`[${name}]─`);
        } else if (control && q === parseInt(control)) {
          lines[q].push('─●──');
        } else {
          lines[q].push('────');
        }
      }
    }
  }

  return lines.map(l => l.join('')).join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const quantumComputingTool: UnifiedTool = {
  name: 'quantum_computing',
  description: `Quantum computing simulator for circuits and algorithms.

Operations:
- gate: Apply quantum gate (X, Y, Z, H, S, T, CNOT, CZ, Toffoli)
- circuit: Run a sequence of gates
- measure: Measure quantum state
- bell: Create Bell state
- ghz: Create GHZ state
- deutsch_jozsa: Run Deutsch-Jozsa algorithm
- superposition: Create superposition state
- entangle: Entangle qubits

Gates: I, X, Y, Z, H, S, T, SX, RX, RY, RZ, CNOT, CZ, Toffoli

Educational quantum computing simulation.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['gate', 'circuit', 'measure', 'bell', 'ghz', 'deutsch_jozsa', 'superposition', 'entangle'],
        description: 'Quantum operation',
      },
      num_qubits: { type: 'number', description: 'Number of qubits (1-8)' },
      gate_name: { type: 'string', description: 'Gate name (X, H, CNOT, etc.)' },
      target: { type: 'number', description: 'Target qubit' },
      control: { type: 'number', description: 'Control qubit for 2-qubit gates' },
      gates: { type: 'string', description: 'Gate sequence as JSON array' },
      angle: { type: 'number', description: 'Rotation angle in radians' },
      bell_type: { type: 'string', description: 'Bell state type (00, 01, 10, 11)' },
      oracle: { type: 'string', description: 'Oracle type for Deutsch-Jozsa' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeQuantumComputing(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, num_qubits = 2 } = args;
    const numQubits = Math.min(8, Math.max(1, num_qubits));

    let result: Record<string, unknown>;

    switch (operation) {
      case 'gate': {
        const { gate_name = 'H', target = 0, control, angle } = args;
        let state = createQubitState(numQubits);
        const circuit: string[] = [];

        let gate = GATES[gate_name];
        if (!gate && gate_name.startsWith('R')) {
          gate = createRotationGate(gate_name[1] as 'X' | 'Y' | 'Z', angle || Math.PI / 4);
        }

        if (gate_name === 'CNOT') {
          state = applyCNOT(state, control ?? 0, target);
          circuit.push(`CNOT(${control ?? 0},${target})`);
        } else if (gate_name === 'CZ') {
          state = applyCZ(state, control ?? 0, target);
          circuit.push(`CZ(${control ?? 0},${target})`);
        } else if (gate_name === 'Toffoli') {
          state = applyToffoli(state, args.control1 ?? 0, args.control2 ?? 1, target);
          circuit.push(`Toffoli(${args.control1 ?? 0},${args.control2 ?? 1},${target})`);
        } else if (gate) {
          state = applySingleQubitGate(state, gate, target, numQubits);
          circuit.push(`${gate_name}(${target})`);
        }

        result = {
          operation: 'gate',
          gate: gate_name,
          circuit: visualizeCircuit(circuit, numQubits),
          state: visualizeState(state, numQubits),
        };
        break;
      }

      case 'circuit': {
        const gatesStr = args.gates || '["H(0)", "CNOT(0,1)"]';
        const gates: string[] = JSON.parse(gatesStr);
        let state = createQubitState(numQubits);

        for (const g of gates) {
          const match = g.match(/(\w+)\(([^)]+)\)/);
          if (match) {
            const [, name, params] = match;
            const paramList = params.split(',').map(Number);

            if (name === 'CNOT') {
              state = applyCNOT(state, paramList[0], paramList[1]);
            } else if (name === 'CZ') {
              state = applyCZ(state, paramList[0], paramList[1]);
            } else if (GATES[name]) {
              state = applySingleQubitGate(state, GATES[name], paramList[0], numQubits);
            }
          }
        }

        result = {
          operation: 'circuit',
          gates,
          circuit: visualizeCircuit(gates, numQubits),
          state: visualizeState(state, numQubits),
          measurement: measure(state, numQubits),
        };
        break;
      }

      case 'bell': {
        const bellType = (args.bell_type || '00') as '00' | '01' | '10' | '11';
        const { state, circuit } = bellState(bellType);
        result = {
          operation: 'bell',
          type: bellType,
          name: { '00': 'Φ+', '01': 'Ψ+', '10': 'Φ-', '11': 'Ψ-' }[bellType],
          circuit: visualizeCircuit(circuit, 2),
          state: visualizeState(state, 2),
          entanglement: 'Maximally entangled',
        };
        break;
      }

      case 'ghz': {
        const n = Math.min(6, numQubits);
        const { state, circuit } = ghzState(n);
        result = {
          operation: 'ghz',
          num_qubits: n,
          circuit: visualizeCircuit(circuit, n),
          state: visualizeState(state, n),
          description: 'Greenberger–Horne–Zeilinger state: |00...0⟩ + |11...1⟩',
        };
        break;
      }

      case 'deutsch_jozsa': {
        const oracle = (args.oracle || 'balanced') as 'constant' | 'balanced';
        const { result: djResult, circuit } = deutschJozsa(oracle, 3);
        result = {
          operation: 'deutsch_jozsa',
          oracle_type: oracle,
          result: djResult,
          correct: djResult === oracle,
          circuit,
          explanation: 'Determines if oracle is constant or balanced in O(1) quantum queries vs O(2^(n-1)+1) classical',
        };
        break;
      }

      case 'superposition': {
        let state = createQubitState(numQubits);
        const circuit: string[] = [];
        for (let i = 0; i < numQubits; i++) {
          state = applySingleQubitGate(state, GATES.H, i, numQubits);
          circuit.push(`H(${i})`);
        }
        result = {
          operation: 'superposition',
          num_qubits: numQubits,
          circuit: visualizeCircuit(circuit, numQubits),
          state: visualizeState(state, numQubits),
          num_states: Math.pow(2, numQubits),
        };
        break;
      }

      case 'entangle': {
        let state = createQubitState(numQubits);
        const circuit: string[] = [];
        state = applySingleQubitGate(state, GATES.H, 0, numQubits);
        circuit.push('H(0)');
        for (let i = 1; i < numQubits; i++) {
          state = applyCNOT(state, 0, i);
          circuit.push(`CNOT(0,${i})`);
        }
        result = {
          operation: 'entangle',
          num_qubits: numQubits,
          circuit: visualizeCircuit(circuit, numQubits),
          state: visualizeState(state, numQubits),
          type: numQubits === 2 ? 'Bell state' : 'GHZ-like state',
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Quantum Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isQuantumComputingAvailable(): boolean { return true; }
