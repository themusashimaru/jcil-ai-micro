/**
 * QUANTUM CIRCUIT SIMULATOR
 *
 * Simulate quantum circuits with qubits, gates, and measurements.
 * Educational tool for quantum computing concepts.
 *
 * Features:
 * - Qubit state initialization
 * - Quantum gates: H, X, Y, Z, CNOT, Toffoli, SWAP, Phase, T, S
 * - Measurement simulation
 * - Multi-qubit entanglement
 * - Grover's algorithm demonstration
 * - Bell state preparation
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Complex number representation
interface Complex {
  re: number;
  im: number;
}

function complex(re: number, im: number = 0): Complex {
  return { re, im };
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function cScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

function cNorm(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

// Quantum state as array of complex amplitudes
type QuantumState = Complex[];

// Initialize n-qubit state to |0...0⟩
function initState(nQubits: number): QuantumState {
  const size = 1 << nQubits; // 2^n
  const state: QuantumState = new Array(size).fill(null).map(() => complex(0));
  state[0] = complex(1); // |0...0⟩
  return state;
}

// Single qubit gates (2x2 matrices)
const GATES: Record<string, Complex[][]> = {
  // Pauli-X (NOT gate)
  X: [
    [complex(0), complex(1)],
    [complex(1), complex(0)],
  ],
  // Pauli-Y
  Y: [
    [complex(0), complex(0, -1)],
    [complex(0, 1), complex(0)],
  ],
  // Pauli-Z
  Z: [
    [complex(1), complex(0)],
    [complex(0), complex(-1)],
  ],
  // Hadamard
  H: [
    [cScale(complex(1), 1 / Math.sqrt(2)), cScale(complex(1), 1 / Math.sqrt(2))],
    [cScale(complex(1), 1 / Math.sqrt(2)), cScale(complex(-1), 1 / Math.sqrt(2))],
  ],
  // Phase gate (S)
  S: [
    [complex(1), complex(0)],
    [complex(0), complex(0, 1)],
  ],
  // T gate (π/8)
  T: [
    [complex(1), complex(0)],
    [complex(0), complex(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4))],
  ],
  // Identity
  I: [
    [complex(1), complex(0)],
    [complex(0), complex(1)],
  ],
};

// Apply single-qubit gate to state
function applySingleGate(
  state: QuantumState,
  gate: Complex[][],
  qubit: number,
  nQubits: number
): QuantumState {
  const newState: QuantumState = new Array(state.length).fill(null).map(() => complex(0));
  const size = 1 << nQubits;

  for (let i = 0; i < size; i++) {
    // Get the bit value of the target qubit
    const bit = (i >> qubit) & 1;
    // Get the index with the target qubit flipped
    const flipped = i ^ (1 << qubit);

    if (bit === 0) {
      // |0⟩ component
      newState[i] = cAdd(newState[i], cMul(gate[0][0], state[i]));
      newState[i] = cAdd(newState[i], cMul(gate[0][1], state[flipped]));
    } else {
      // |1⟩ component
      newState[i] = cAdd(newState[i], cMul(gate[1][0], state[flipped]));
      newState[i] = cAdd(newState[i], cMul(gate[1][1], state[i]));
    }
  }

  return newState;
}

// Apply CNOT gate (control, target)
function applyCNOT(
  state: QuantumState,
  control: number,
  target: number,
  _nQubits: number
): QuantumState {
  const newState = [...state];

  for (let i = 0; i < state.length; i++) {
    const controlBit = (i >> control) & 1;
    if (controlBit === 1) {
      // Flip target bit
      const flipped = i ^ (1 << target);
      if (i < flipped) {
        [newState[i], newState[flipped]] = [newState[flipped], newState[i]];
      }
    }
  }

  return newState;
}

// Apply SWAP gate
function applySWAP(
  state: QuantumState,
  qubit1: number,
  qubit2: number,
  _nQubits: number
): QuantumState {
  const newState = [...state];

  for (let i = 0; i < state.length; i++) {
    const bit1 = (i >> qubit1) & 1;
    const bit2 = (i >> qubit2) & 1;
    if (bit1 !== bit2) {
      const swapped = i ^ (1 << qubit1) ^ (1 << qubit2);
      if (i < swapped) {
        [newState[i], newState[swapped]] = [newState[swapped], newState[i]];
      }
    }
  }

  return newState;
}

// Apply Toffoli (CCNOT) gate
function applyToffoli(
  state: QuantumState,
  control1: number,
  control2: number,
  target: number
): QuantumState {
  const newState = [...state];

  for (let i = 0; i < state.length; i++) {
    const c1 = (i >> control1) & 1;
    const c2 = (i >> control2) & 1;
    if (c1 === 1 && c2 === 1) {
      const flipped = i ^ (1 << target);
      if (i < flipped) {
        [newState[i], newState[flipped]] = [newState[flipped], newState[i]];
      }
    }
  }

  return newState;
}

// Measure the quantum state
function measure(
  state: QuantumState,
  nQubits: number,
  shots: number = 1000
): Record<string, number> {
  const results: Record<string, number> = {};

  // Calculate probabilities
  const probs = state.map((amp) => cNorm(amp));

  for (let shot = 0; shot < shots; shot++) {
    const r = Math.random();
    let cumProb = 0;
    for (let i = 0; i < state.length; i++) {
      cumProb += probs[i];
      if (r < cumProb) {
        const bitString = i.toString(2).padStart(nQubits, '0');
        results[bitString] = (results[bitString] || 0) + 1;
        break;
      }
    }
  }

  return results;
}

// Get state vector representation
function getStateVector(
  state: QuantumState,
  nQubits: number
): { basis: string; amplitude: string; probability: number }[] {
  const result = [];
  for (let i = 0; i < state.length; i++) {
    const prob = cNorm(state[i]);
    if (prob > 1e-10) {
      const bitString = i.toString(2).padStart(nQubits, '0');
      const amp = state[i];
      const ampStr =
        amp.im === 0 ? amp.re.toFixed(4) : `${amp.re.toFixed(4)} + ${amp.im.toFixed(4)}i`;
      result.push({
        basis: `|${bitString}⟩`,
        amplitude: ampStr,
        probability: prob,
      });
    }
  }
  return result;
}

// ============================================================================
// PRE-BUILT CIRCUITS
// ============================================================================

// Create Bell state (|00⟩ + |11⟩)/√2
function createBellState(): { state: QuantumState; nQubits: number } {
  let state = initState(2);
  state = applySingleGate(state, GATES.H, 0, 2);
  state = applyCNOT(state, 0, 1, 2);
  return { state, nQubits: 2 };
}

// Create GHZ state (|000⟩ + |111⟩)/√2
function createGHZState(nQubits: number): { state: QuantumState; nQubits: number } {
  let state = initState(nQubits);
  state = applySingleGate(state, GATES.H, 0, nQubits);
  for (let i = 1; i < nQubits; i++) {
    state = applyCNOT(state, 0, i, nQubits);
  }
  return { state, nQubits };
}

// Grover's algorithm for 2 qubits (finds marked state)
function groversAlgorithm(markedState: number): {
  state: QuantumState;
  nQubits: number;
  iterations: number;
} {
  const nQubits = 2;
  let state = initState(nQubits);

  // Apply Hadamard to all qubits (superposition)
  for (let q = 0; q < nQubits; q++) {
    state = applySingleGate(state, GATES.H, q, nQubits);
  }

  // Optimal number of iterations
  const iterations = Math.floor((Math.PI / 4) * Math.sqrt(1 << nQubits));

  for (let iter = 0; iter < iterations; iter++) {
    // Oracle: flip phase of marked state
    state[markedState] = cScale(state[markedState], -1);

    // Diffusion operator
    // H⊗n
    for (let q = 0; q < nQubits; q++) {
      state = applySingleGate(state, GATES.H, q, nQubits);
    }
    // 2|0⟩⟨0| - I (flip all but |0⟩)
    for (let i = 1; i < state.length; i++) {
      state[i] = cScale(state[i], -1);
    }
    state[0] = cScale(state[0], -1);
    // H⊗n
    for (let q = 0; q < nQubits; q++) {
      state = applySingleGate(state, GATES.H, q, nQubits);
    }
  }

  return { state, nQubits, iterations };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const quantumCircuitTool: UnifiedTool = {
  name: 'quantum_circuit',
  description: `Quantum circuit simulator for quantum computing education and research.

Available operations:
- init: Initialize n-qubit state (all |0⟩)
- gate: Apply quantum gate (H, X, Y, Z, S, T) to qubit
- cnot: Apply CNOT (controlled-NOT) gate
- swap: Swap two qubits
- toffoli: Apply Toffoli (CCNOT) gate
- measure: Measure state with multiple shots
- bell_state: Create Bell state (entangled pair)
- ghz_state: Create GHZ state (n-qubit entanglement)
- grovers: Run Grover's search algorithm

Supports: superposition, entanglement, quantum gates, measurement`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'init',
          'gate',
          'cnot',
          'swap',
          'toffoli',
          'measure',
          'bell_state',
          'ghz_state',
          'grovers',
          'run_circuit',
        ],
        description: 'Quantum operation to perform',
      },
      n_qubits: {
        type: 'number',
        description: 'Number of qubits (max 10 for performance)',
      },
      gate_name: {
        type: 'string',
        enum: ['H', 'X', 'Y', 'Z', 'S', 'T', 'I'],
        description: 'Gate to apply',
      },
      target_qubit: {
        type: 'number',
        description: 'Target qubit index (0-based)',
      },
      control_qubit: {
        type: 'number',
        description: 'Control qubit for CNOT',
      },
      control_qubit2: {
        type: 'number',
        description: 'Second control qubit for Toffoli',
      },
      qubit1: {
        type: 'number',
        description: 'First qubit for SWAP',
      },
      qubit2: {
        type: 'number',
        description: 'Second qubit for SWAP',
      },
      shots: {
        type: 'number',
        description: 'Number of measurement shots (default: 1000)',
      },
      marked_state: {
        type: 'number',
        description: "Marked state for Grover's algorithm (0-3 for 2 qubits)",
      },
      circuit: {
        type: 'array',
        description:
          'Circuit as array of operations: [{gate: "H", qubit: 0}, {gate: "CNOT", control: 0, target: 1}]',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isQuantumCircuitAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeQuantumCircuit(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    n_qubits?: number;
    gate_name?: string;
    target_qubit?: number;
    control_qubit?: number;
    control_qubit2?: number;
    qubit1?: number;
    qubit2?: number;
    shots?: number;
    marked_state?: number;
    circuit?: Array<{
      gate: string;
      qubit?: number;
      control?: number;
      target?: number;
      control2?: number;
    }>;
  };

  const {
    operation,
    n_qubits = 2,
    gate_name,
    target_qubit = 0,
    control_qubit = 0,
    control_qubit2 = 1,
    qubit1 = 0,
    qubit2 = 1,
    shots = 1000,
    marked_state = 0,
    circuit,
  } = args;

  try {
    // Limit qubits for performance
    const maxQubits = Math.min(n_qubits, 10);
    const result: Record<string, unknown> = { operation };

    switch (operation) {
      case 'init': {
        const state = initState(maxQubits);
        result.n_qubits = maxQubits;
        result.state_size = state.length;
        result.state_vector = getStateVector(state, maxQubits);
        result.initial_state = `|${'0'.repeat(maxQubits)}⟩`;
        break;
      }

      case 'gate': {
        if (!gate_name || !GATES[gate_name]) {
          throw new Error(`Invalid gate: ${gate_name}. Available: H, X, Y, Z, S, T, I`);
        }

        let state = initState(maxQubits);
        state = applySingleGate(state, GATES[gate_name], target_qubit, maxQubits);

        result.gate = gate_name;
        result.target_qubit = target_qubit;
        result.n_qubits = maxQubits;
        result.state_vector = getStateVector(state, maxQubits);
        result.measurement = measure(state, maxQubits, shots);
        break;
      }

      case 'cnot': {
        let state = initState(maxQubits);
        // First put control in superposition
        state = applySingleGate(state, GATES.H, control_qubit, maxQubits);
        state = applyCNOT(state, control_qubit, target_qubit, maxQubits);

        result.control_qubit = control_qubit;
        result.target_qubit = target_qubit;
        result.n_qubits = maxQubits;
        result.state_vector = getStateVector(state, maxQubits);
        result.measurement = measure(state, maxQubits, shots);
        result.note = 'CNOT creates entanglement when control is in superposition';
        break;
      }

      case 'swap': {
        let state = initState(maxQubits);
        // Put first qubit in |1⟩
        state = applySingleGate(state, GATES.X, qubit1, maxQubits);
        state = applySWAP(state, qubit1, qubit2, maxQubits);

        result.qubit1 = qubit1;
        result.qubit2 = qubit2;
        result.n_qubits = maxQubits;
        result.state_vector = getStateVector(state, maxQubits);
        result.measurement = measure(state, maxQubits, shots);
        break;
      }

      case 'toffoli': {
        let state = initState(Math.max(maxQubits, 3));
        // Set both controls to |1⟩
        state = applySingleGate(state, GATES.X, control_qubit, Math.max(maxQubits, 3));
        state = applySingleGate(state, GATES.X, control_qubit2, Math.max(maxQubits, 3));
        state = applyToffoli(state, control_qubit, control_qubit2, target_qubit);

        result.control1 = control_qubit;
        result.control2 = control_qubit2;
        result.target = target_qubit;
        result.state_vector = getStateVector(state, Math.max(maxQubits, 3));
        result.measurement = measure(state, Math.max(maxQubits, 3), shots);
        result.note = 'Toffoli: target flips only when both controls are |1⟩';
        break;
      }

      case 'measure': {
        const state = initState(maxQubits);
        result.n_qubits = maxQubits;
        result.shots = shots;
        result.measurement = measure(state, maxQubits, shots);
        result.note = 'All qubits in |0⟩ state, measurement is deterministic';
        break;
      }

      case 'bell_state': {
        const bell = createBellState();
        result.name = 'Bell State (Φ+)';
        result.formula = '(|00⟩ + |11⟩) / √2';
        result.n_qubits = bell.nQubits;
        result.state_vector = getStateVector(bell.state, bell.nQubits);
        result.measurement = measure(bell.state, bell.nQubits, shots);
        result.entanglement = 'Maximum entanglement between 2 qubits';
        result.circuit = ['H(0)', 'CNOT(0,1)'];
        break;
      }

      case 'ghz_state': {
        const ghz = createGHZState(Math.min(maxQubits, 5));
        result.name = `GHZ State (${ghz.nQubits} qubits)`;
        result.formula = `(|${'0'.repeat(ghz.nQubits)}⟩ + |${'1'.repeat(ghz.nQubits)}⟩) / √2`;
        result.n_qubits = ghz.nQubits;
        result.state_vector = getStateVector(ghz.state, ghz.nQubits);
        result.measurement = measure(ghz.state, ghz.nQubits, shots);
        result.entanglement =
          'Greenberger-Horne-Zeilinger state - maximum multipartite entanglement';
        break;
      }

      case 'grovers': {
        const marked = marked_state % 4; // Ensure valid for 2 qubits
        const grover = groversAlgorithm(marked);

        result.algorithm = "Grover's Search";
        result.n_qubits = grover.nQubits;
        result.marked_state = marked.toString(2).padStart(2, '0');
        result.iterations = grover.iterations;
        result.state_vector = getStateVector(grover.state, grover.nQubits);
        result.measurement = measure(grover.state, grover.nQubits, shots);
        result.speedup = 'Quadratic speedup: O(√N) vs O(N) classical';
        result.note = `After ${grover.iterations} iterations, marked state |${marked.toString(2).padStart(2, '0')}⟩ has high probability`;
        break;
      }

      case 'run_circuit': {
        if (!circuit || circuit.length === 0) {
          throw new Error('circuit array is required');
        }

        let state = initState(maxQubits);
        const operations: string[] = [];

        for (const op of circuit) {
          switch (op.gate.toUpperCase()) {
            case 'H':
            case 'X':
            case 'Y':
            case 'Z':
            case 'S':
            case 'T':
              state = applySingleGate(
                state,
                GATES[op.gate.toUpperCase()],
                op.qubit || 0,
                maxQubits
              );
              operations.push(`${op.gate}(${op.qubit || 0})`);
              break;
            case 'CNOT':
            case 'CX':
              state = applyCNOT(state, op.control || 0, op.target || 1, maxQubits);
              operations.push(`CNOT(${op.control || 0},${op.target || 1})`);
              break;
            case 'SWAP':
              state = applySWAP(state, op.qubit || 0, op.target || 1, maxQubits);
              operations.push(`SWAP(${op.qubit || 0},${op.target || 1})`);
              break;
            case 'TOFFOLI':
            case 'CCX':
              state = applyToffoli(state, op.control || 0, op.control2 || 1, op.target || 2);
              operations.push(`TOFFOLI(${op.control || 0},${op.control2 || 1},${op.target || 2})`);
              break;
          }
        }

        result.n_qubits = maxQubits;
        result.circuit = operations;
        result.state_vector = getStateVector(state, maxQubits);
        result.measurement = measure(state, maxQubits, shots);
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}
