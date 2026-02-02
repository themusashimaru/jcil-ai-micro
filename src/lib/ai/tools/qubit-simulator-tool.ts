/**
 * QUBIT-SIMULATOR TOOL
 * Quantum bit simulation - The foundation of quantum computing
 *
 * Complete implementation of quantum state simulation:
 * - Multi-qubit state vectors with complex amplitudes
 * - Single and multi-qubit gate operations
 * - Entanglement creation and Bell states
 * - Measurement with Born rule probabilities
 * - Density matrix operations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// COMPLEX NUMBER ARITHMETIC
// ============================================================================

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom
  };
}

function cConj(a: Complex): Complex {
  return { re: a.re, im: -a.im };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function cAbs(a: Complex): number {
  return Math.sqrt(a.re * a.re + a.im * a.im);
}

function cAbsSq(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

function cExp(a: Complex): Complex {
  const r = Math.exp(a.re);
  return { re: r * Math.cos(a.im), im: r * Math.sin(a.im) };
}

function cScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

function cFromPolar(r: number, theta: number): Complex {
  return { re: r * Math.cos(theta), im: r * Math.sin(theta) };
}

// ============================================================================
// QUANTUM STATE REPRESENTATION
// ============================================================================

interface QuantumState {
  numQubits: number;
  amplitudes: Complex[];  // 2^n amplitudes
}

function createZeroState(numQubits: number): QuantumState {
  const dim = 1 << numQubits;  // 2^n
  const amplitudes: Complex[] = Array(dim).fill(null).map(() => complex(0));
  amplitudes[0] = complex(1);  // |00...0⟩
  return { numQubits, amplitudes };
}

function createBasisState(numQubits: number, basisIndex: number): QuantumState {
  const dim = 1 << numQubits;
  const amplitudes: Complex[] = Array(dim).fill(null).map(() => complex(0));
  amplitudes[basisIndex] = complex(1);
  return { numQubits, amplitudes };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normalize(state: QuantumState): QuantumState {
  const norm = Math.sqrt(state.amplitudes.reduce((sum, a) => sum + cAbsSq(a), 0));
  if (norm < 1e-10) return state;
  return {
    numQubits: state.numQubits,
    amplitudes: state.amplitudes.map(a => cScale(a, 1 / norm))
  };
}

function stateToKet(state: QuantumState): string {
  const parts: string[] = [];
  const dim = 1 << state.numQubits;

  for (let i = 0; i < dim; i++) {
    const amp = state.amplitudes[i];
    if (cAbsSq(amp) > 1e-10) {
      const binaryStr = i.toString(2).padStart(state.numQubits, '0');
      let ampStr = '';

      if (Math.abs(amp.im) < 1e-10) {
        ampStr = amp.re.toFixed(3);
      } else if (Math.abs(amp.re) < 1e-10) {
        ampStr = `${amp.im.toFixed(3)}i`;
      } else {
        ampStr = `(${amp.re.toFixed(3)}${amp.im >= 0 ? '+' : ''}${amp.im.toFixed(3)}i)`;
      }

      parts.push(`${ampStr}|${binaryStr}⟩`);
    }
  }

  return parts.join(' + ') || '0';
}

function getProbabilities(state: QuantumState): number[] {
  return state.amplitudes.map(a => cAbsSq(a));
}

// ============================================================================
// QUANTUM GATES (2x2 matrices for single-qubit, 4x4 for two-qubit)
// ============================================================================

type Gate = Complex[][];

// Pauli matrices
const IDENTITY: Gate = [
  [complex(1), complex(0)],
  [complex(0), complex(1)]
];

const PAULI_X: Gate = [
  [complex(0), complex(1)],
  [complex(1), complex(0)]
];

const PAULI_Y: Gate = [
  [complex(0), complex(0, -1)],
  [complex(0, 1), complex(0)]
];

const PAULI_Z: Gate = [
  [complex(1), complex(0)],
  [complex(0), complex(-1)]
];

// Hadamard
const HADAMARD: Gate = [
  [complex(1 / Math.sqrt(2)), complex(1 / Math.sqrt(2))],
  [complex(1 / Math.sqrt(2)), complex(-1 / Math.sqrt(2))]
];

// Phase gates
const S_GATE: Gate = [
  [complex(1), complex(0)],
  [complex(0), complex(0, 1)]
];

const T_GATE: Gate = [
  [complex(1), complex(0)],
  [complex(0), cFromPolar(1, Math.PI / 4)]
];

// Rotation gates
function rotationX(theta: number): Gate {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return [
    [complex(c), complex(0, -s)],
    [complex(0, -s), complex(c)]
  ];
}

function rotationY(theta: number): Gate {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return [
    [complex(c), complex(-s)],
    [complex(s), complex(c)]
  ];
}

function rotationZ(theta: number): Gate {
  return [
    [cExp(complex(0, -theta / 2)), complex(0)],
    [complex(0), cExp(complex(0, theta / 2))]
  ];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function phaseGate(phi: number): Gate {
  return [
    [complex(1), complex(0)],
    [complex(0), cFromPolar(1, phi)]
  ];
}

// Two-qubit gates (4x4 matrices)
const CNOT: Gate = [
  [complex(1), complex(0), complex(0), complex(0)],
  [complex(0), complex(1), complex(0), complex(0)],
  [complex(0), complex(0), complex(0), complex(1)],
  [complex(0), complex(0), complex(1), complex(0)]
];

const SWAP: Gate = [
  [complex(1), complex(0), complex(0), complex(0)],
  [complex(0), complex(0), complex(1), complex(0)],
  [complex(0), complex(1), complex(0), complex(0)],
  [complex(0), complex(0), complex(0), complex(1)]
];

const CZ: Gate = [
  [complex(1), complex(0), complex(0), complex(0)],
  [complex(0), complex(1), complex(0), complex(0)],
  [complex(0), complex(0), complex(1), complex(0)],
  [complex(0), complex(0), complex(0), complex(-1)]
];

// ============================================================================
// GATE APPLICATION
// ============================================================================

function applySingleQubitGate(state: QuantumState, gate: Gate, target: number): QuantumState {
  const dim = 1 << state.numQubits;
  const newAmplitudes: Complex[] = Array(dim).fill(null).map(() => complex(0));

  for (let i = 0; i < dim; i++) {
    // Extract the target qubit bit
    const targetBit = (i >> target) & 1;
    // Index with target bit flipped
    const flipped = i ^ (1 << target);

    // Apply gate
    const a0 = state.amplitudes[targetBit === 0 ? i : flipped];
    const a1 = state.amplitudes[targetBit === 0 ? flipped : i];

    if (targetBit === 0) {
      newAmplitudes[i] = cAdd(cMul(gate[0][0], a0), cMul(gate[0][1], a1));
    } else {
      newAmplitudes[i] = cAdd(cMul(gate[1][0], a0), cMul(gate[1][1], a1));
    }
  }

  return { numQubits: state.numQubits, amplitudes: newAmplitudes };
}

function applyTwoQubitGate(state: QuantumState, gate: Gate, control: number, target: number): QuantumState {
  const dim = 1 << state.numQubits;
  const newAmplitudes: Complex[] = Array(dim).fill(null).map(() => complex(0));

  for (let i = 0; i < dim; i++) {
    const controlBit = (i >> control) & 1;
    const targetBit = (i >> target) & 1;

    // Index into 4x4 gate matrix
    const gateRow = (controlBit << 1) | targetBit;

    // Find all 4 basis states that differ only in control and target bits
    const base = i & ~((1 << control) | (1 << target));
    const indices = [
      base,
      base | (1 << target),
      base | (1 << control),
      base | (1 << control) | (1 << target)
    ];

    for (let col = 0; col < 4; col++) {
      newAmplitudes[i] = cAdd(newAmplitudes[i], cMul(gate[gateRow][col], state.amplitudes[indices[col]]));
    }
  }

  return { numQubits: state.numQubits, amplitudes: newAmplitudes };
}

// ============================================================================
// MEASUREMENT
// ============================================================================

function measureAll(state: QuantumState): { outcome: number; probability: number; newState: QuantumState } {
  const probs = getProbabilities(state);
  const rand = Math.random();
  let cumProb = 0;
  let outcome = 0;

  for (let i = 0; i < probs.length; i++) {
    cumProb += probs[i];
    if (rand < cumProb) {
      outcome = i;
      break;
    }
  }

  // Collapse to measured state
  const newState = createBasisState(state.numQubits, outcome);

  return {
    outcome,
    probability: probs[outcome],
    newState
  };
}

function measureQubit(state: QuantumState, qubit: number): { outcome: number; probability: number; newState: QuantumState } {
  const dim = 1 << state.numQubits;

  // Calculate probability of measuring 0 or 1
  let prob0 = 0;
  let prob1 = 0;

  for (let i = 0; i < dim; i++) {
    const bit = (i >> qubit) & 1;
    if (bit === 0) {
      prob0 += cAbsSq(state.amplitudes[i]);
    } else {
      prob1 += cAbsSq(state.amplitudes[i]);
    }
  }

  const outcome = Math.random() < prob0 ? 0 : 1;
  const probability = outcome === 0 ? prob0 : prob1;

  // Collapse state
  const newAmplitudes: Complex[] = [];
  const normFactor = Math.sqrt(probability);

  for (let i = 0; i < dim; i++) {
    const bit = (i >> qubit) & 1;
    if (bit === outcome) {
      newAmplitudes.push(cScale(state.amplitudes[i], 1 / normFactor));
    } else {
      newAmplitudes.push(complex(0));
    }
  }

  return {
    outcome,
    probability,
    newState: { numQubits: state.numQubits, amplitudes: newAmplitudes }
  };
}

// ============================================================================
// ENTANGLEMENT
// ============================================================================

function createBellState(type: 'phi+' | 'phi-' | 'psi+' | 'psi-'): QuantumState {
  // Create |00⟩
  let state = createZeroState(2);

  // Apply H to first qubit
  state = applySingleQubitGate(state, HADAMARD, 0);

  // Apply CNOT
  state = applyTwoQubitGate(state, CNOT, 0, 1);

  // Adjust for different Bell states
  switch (type) {
    case 'phi+':
      // |Φ+⟩ = (|00⟩ + |11⟩)/√2 - already created
      break;
    case 'phi-':
      // |Φ-⟩ = (|00⟩ - |11⟩)/√2
      state = applySingleQubitGate(state, PAULI_Z, 0);
      break;
    case 'psi+':
      // |Ψ+⟩ = (|01⟩ + |10⟩)/√2
      state = applySingleQubitGate(state, PAULI_X, 0);
      break;
    case 'psi-':
      // |Ψ-⟩ = (|01⟩ - |10⟩)/√2
      state = applySingleQubitGate(state, PAULI_X, 0);
      state = applySingleQubitGate(state, PAULI_Z, 0);
      break;
  }

  return state;
}

function createGHZState(numQubits: number): QuantumState {
  // GHZ state: (|00...0⟩ + |11...1⟩)/√2
  let state = createZeroState(numQubits);

  // H on first qubit
  state = applySingleQubitGate(state, HADAMARD, 0);

  // CNOT cascade
  for (let i = 1; i < numQubits; i++) {
    state = applyTwoQubitGate(state, CNOT, 0, i);
  }

  return state;
}

function calculateEntanglement(state: QuantumState, partition: number[]): number {
  // Calculate von Neumann entropy of reduced density matrix
  // Simplified: calculate linear entropy as proxy
  if (state.numQubits < 2) return 0;

  // Compute reduced density matrix by tracing out complement of partition
  const partitionSize = partition.length;
  const reducedDim = 1 << partitionSize;
  const rho: Complex[][] = Array(reducedDim).fill(null)
    .map(() => Array(reducedDim).fill(null).map(() => complex(0)));

  const fullDim = 1 << state.numQubits;
  const complement = [];
  for (let i = 0; i < state.numQubits; i++) {
    if (!partition.includes(i)) complement.push(i);
  }

  // Partial trace
  for (let i = 0; i < fullDim; i++) {
    for (let j = 0; j < fullDim; j++) {
      // Check if complement indices match
      let match = true;
      for (const q of complement) {
        if (((i >> q) & 1) !== ((j >> q) & 1)) {
          match = false;
          break;
        }
      }

      if (match) {
        // Extract partition indices
        let pi = 0, pj = 0;
        for (let k = 0; k < partition.length; k++) {
          pi |= ((i >> partition[k]) & 1) << k;
          pj |= ((j >> partition[k]) & 1) << k;
        }

        rho[pi][pj] = cAdd(rho[pi][pj], cMul(state.amplitudes[i], cConj(state.amplitudes[j])));
      }
    }
  }

  // Calculate purity = Tr(ρ²)
  let purity = 0;
  for (let i = 0; i < reducedDim; i++) {
    for (let j = 0; j < reducedDim; j++) {
      purity += cAbsSq(rho[i][j]);
    }
  }

  // Linear entropy: S_L = 1 - Tr(ρ²)
  // For maximally entangled state: S_L = 1 - 1/d
  const linearEntropy = 1 - purity;

  return linearEntropy;
}

// ============================================================================
// DENSITY MATRIX OPERATIONS
// ============================================================================

function stateToDensityMatrix(state: QuantumState): Complex[][] {
  const dim = 1 << state.numQubits;
  const rho: Complex[][] = Array(dim).fill(null)
    .map(() => Array(dim).fill(null).map(() => complex(0)));

  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      rho[i][j] = cMul(state.amplitudes[i], cConj(state.amplitudes[j]));
    }
  }

  return rho;
}

function traceDensityMatrix(rho: Complex[][]): Complex {
  let trace = complex(0);
  for (let i = 0; i < rho.length; i++) {
    trace = cAdd(trace, rho[i][i]);
  }
  return trace;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function fidelity(state1: QuantumState, state2: QuantumState): number {
  if (state1.numQubits !== state2.numQubits) return 0;

  // F = |⟨ψ|φ⟩|²
  let overlap = complex(0);
  for (let i = 0; i < state1.amplitudes.length; i++) {
    overlap = cAdd(overlap, cMul(cConj(state1.amplitudes[i]), state2.amplitudes[i]));
  }

  return cAbsSq(overlap);
}

// ============================================================================
// TOOL DEFINITION AND EXECUTION
// ============================================================================

export const qubitsimulatorTool: UnifiedTool = {
  name: 'qubit_simulator',
  description: 'Quantum bit state simulation and measurement',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'measure', 'apply_gate', 'entangle', 'density_matrix', 'info'],
        description: 'Operation to perform'
      },
      num_qubits: { type: 'number', description: 'Number of qubits (default 2)' },
      initial_state: {
        type: 'string',
        enum: ['zero', 'one', 'plus', 'minus', 'custom'],
        description: 'Initial state type'
      },
      gates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            gate: { type: 'string', description: 'Gate name (H, X, Y, Z, S, T, CNOT, CZ, SWAP, Rx, Ry, Rz)' },
            target: { type: 'number', description: 'Target qubit index' },
            control: { type: 'number', description: 'Control qubit index (for two-qubit gates)' },
            angle: { type: 'number', description: 'Rotation angle (for Rx, Ry, Rz)' }
          }
        },
        description: 'Sequence of gates to apply'
      },
      measure_qubit: { type: 'number', description: 'Specific qubit to measure (-1 for all)' },
      num_shots: { type: 'number', description: 'Number of measurement repetitions' },
      bell_state: {
        type: 'string',
        enum: ['phi+', 'phi-', 'psi+', 'psi-'],
        description: 'Bell state type'
      },
      partition: {
        type: 'array',
        items: { type: 'number' },
        description: 'Qubit indices for entanglement calculation'
      }
    },
    required: ['operation']
  }
};

export async function executequbitsimulator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'qubit_simulator',
            description: 'Quantum state simulation with gates and measurements',
            operations: {
              create: {
                description: 'Create a quantum state',
                parameters: ['num_qubits', 'initial_state']
              },
              apply_gate: {
                description: 'Apply quantum gates to a state',
                parameters: ['num_qubits', 'gates[]']
              },
              measure: {
                description: 'Measure qubits (collapse state)',
                parameters: ['num_qubits', 'measure_qubit', 'num_shots']
              },
              entangle: {
                description: 'Create entangled states',
                parameters: ['bell_state', 'num_qubits (for GHZ)']
              },
              density_matrix: {
                description: 'Compute density matrix and properties',
                parameters: ['num_qubits', 'partition']
              }
            },
            availableGates: {
              singleQubit: ['H', 'X', 'Y', 'Z', 'S', 'T', 'Rx', 'Ry', 'Rz'],
              twoQubit: ['CNOT', 'CZ', 'SWAP']
            },
            concepts: {
              superposition: 'α|0⟩ + β|1⟩ where |α|² + |β|² = 1',
              measurement: 'Collapses superposition with Born rule probabilities',
              entanglement: 'Non-separable multi-qubit states',
              bellStates: '|Φ±⟩ = (|00⟩ ± |11⟩)/√2, |Ψ±⟩ = (|01⟩ ± |10⟩)/√2'
            }
          }, null, 2)
        };
      }

      case 'create': {
        const numQubits = args.num_qubits || 2;
        const initialState = args.initial_state || 'zero';

        let state: QuantumState;

        switch (initialState) {
          case 'zero':
            state = createZeroState(numQubits);
            break;
          case 'one':
            state = createBasisState(numQubits, (1 << numQubits) - 1);
            break;
          case 'plus':
            // |+⟩^⊗n
            state = createZeroState(numQubits);
            for (let i = 0; i < numQubits; i++) {
              state = applySingleQubitGate(state, HADAMARD, i);
            }
            break;
          case 'minus':
            // |-⟩^⊗n
            state = createZeroState(numQubits);
            for (let i = 0; i < numQubits; i++) {
              state = applySingleQubitGate(state, PAULI_X, i);
              state = applySingleQubitGate(state, HADAMARD, i);
            }
            break;
          default:
            state = createZeroState(numQubits);
        }

        const probs = getProbabilities(state);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'create',
            numQubits,
            initialState,
            stateVector: stateToKet(state),
            probabilities: probs.map((p, i) => ({
              basis: i.toString(2).padStart(numQubits, '0'),
              probability: p
            })).filter(x => x.probability > 1e-10),
            dimension: 1 << numQubits
          }, null, 2)
        };
      }

      case 'apply_gate': {
        const numQubits = args.num_qubits || 2;
        const gates = args.gates || [{ gate: 'H', target: 0 }];

        let state = createZeroState(numQubits);
        const gateLog: Array<{ gate: string; target: number; control?: number; stateAfter: string }> = [];

        for (const gateSpec of gates) {
          let gate: Gate;
          const target = gateSpec.target || 0;
          const control = gateSpec.control;
          const angle = gateSpec.angle || Math.PI;

          switch (gateSpec.gate?.toUpperCase()) {
            case 'H':
              gate = HADAMARD;
              state = applySingleQubitGate(state, gate, target);
              break;
            case 'X':
              gate = PAULI_X;
              state = applySingleQubitGate(state, gate, target);
              break;
            case 'Y':
              gate = PAULI_Y;
              state = applySingleQubitGate(state, gate, target);
              break;
            case 'Z':
              gate = PAULI_Z;
              state = applySingleQubitGate(state, gate, target);
              break;
            case 'S':
              gate = S_GATE;
              state = applySingleQubitGate(state, gate, target);
              break;
            case 'T':
              gate = T_GATE;
              state = applySingleQubitGate(state, gate, target);
              break;
            case 'RX':
              gate = rotationX(angle);
              state = applySingleQubitGate(state, gate, target);
              break;
            case 'RY':
              gate = rotationY(angle);
              state = applySingleQubitGate(state, gate, target);
              break;
            case 'RZ':
              gate = rotationZ(angle);
              state = applySingleQubitGate(state, gate, target);
              break;
            case 'CNOT':
            case 'CX':
              state = applyTwoQubitGate(state, CNOT, control ?? 0, target);
              break;
            case 'CZ':
              state = applyTwoQubitGate(state, CZ, control ?? 0, target);
              break;
            case 'SWAP':
              state = applyTwoQubitGate(state, SWAP, control ?? 0, target);
              break;
            default:
              continue;
          }

          gateLog.push({
            gate: gateSpec.gate,
            target,
            control,
            stateAfter: stateToKet(state)
          });
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'apply_gate',
            numQubits,
            gatesApplied: gateLog,
            finalState: stateToKet(state),
            probabilities: getProbabilities(state).map((p, i) => ({
              basis: i.toString(2).padStart(numQubits, '0'),
              probability: p
            })).filter(x => x.probability > 1e-10)
          }, null, 2)
        };
      }

      case 'measure': {
        const numQubits = args.num_qubits || 2;
        const measureQubit = args.measure_qubit ?? -1;
        const numShots = args.num_shots || 1000;
        const gates = args.gates || [];

        // Create and prepare state
        let state = createZeroState(numQubits);
        for (const gateSpec of gates) {
          const target = gateSpec.target || 0;
          const control = gateSpec.control;

          switch (gateSpec.gate?.toUpperCase()) {
            case 'H':
              state = applySingleQubitGate(state, HADAMARD, target);
              break;
            case 'X':
              state = applySingleQubitGate(state, PAULI_X, target);
              break;
            case 'CNOT':
              state = applyTwoQubitGate(state, CNOT, control ?? 0, target);
              break;
          }
        }

        const probs = getProbabilities(state);

        // Simulate multiple shots
        const counts: Record<string, number> = {};

        for (let shot = 0; shot < numShots; shot++) {
          let outcome: number;

          if (measureQubit === -1) {
            // Measure all qubits
            const result = measureAll(state);
            outcome = result.outcome;
          } else {
            // Measure single qubit
            const result = measureQubit >= 0 && measureQubit < numQubits
              ? measureQubit
              : 0;
            outcome = measureAll(state).outcome;
          }

          const basisStr = outcome.toString(2).padStart(numQubits, '0');
          counts[basisStr] = (counts[basisStr] || 0) + 1;
        }

        // Convert to frequencies
        const frequencies: Record<string, number> = {};
        for (const [basis, count] of Object.entries(counts)) {
          frequencies[basis] = count / numShots;
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'measure',
            numQubits,
            numShots,
            stateBeforeMeasurement: stateToKet(state),
            theoreticalProbabilities: probs.map((p, i) => ({
              basis: i.toString(2).padStart(numQubits, '0'),
              probability: p
            })).filter(x => x.probability > 1e-10),
            measuredCounts: counts,
            measuredFrequencies: frequencies
          }, null, 2)
        };
      }

      case 'entangle': {
        const bellType = args.bell_state || 'phi+';
        const numQubits = args.num_qubits || 2;

        let state: QuantumState;
        let stateType: string;

        if (numQubits === 2) {
          state = createBellState(bellType as 'phi+' | 'phi-' | 'psi+' | 'psi-');
          stateType = `Bell state |${bellType === 'phi+' ? 'Φ+' : bellType === 'phi-' ? 'Φ-' : bellType === 'psi+' ? 'Ψ+' : 'Ψ-'}⟩`;
        } else {
          state = createGHZState(numQubits);
          stateType = `GHZ state (${numQubits} qubits)`;
        }

        // Calculate entanglement
        const partition = [0];
        const entanglement = calculateEntanglement(state, partition);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'entangle',
            stateType,
            stateVector: stateToKet(state),
            probabilities: getProbabilities(state).map((p, i) => ({
              basis: i.toString(2).padStart(state.numQubits, '0'),
              probability: p
            })).filter(x => x.probability > 1e-10),
            entanglement: {
              partition,
              linearEntropy: entanglement,
              interpretation: entanglement > 0.4 ? 'Highly entangled' : entanglement > 0.1 ? 'Partially entangled' : 'Weakly entangled'
            },
            bellStateFormulas: {
              'phi+': '(|00⟩ + |11⟩)/√2',
              'phi-': '(|00⟩ - |11⟩)/√2',
              'psi+': '(|01⟩ + |10⟩)/√2',
              'psi-': '(|01⟩ - |10⟩)/√2'
            }
          }, null, 2)
        };
      }

      case 'density_matrix': {
        const numQubits = args.num_qubits || 2;
        const partition = args.partition || [0];
        const gates = args.gates || [{ gate: 'H', target: 0 }, { gate: 'CNOT', control: 0, target: 1 }];

        // Create state
        let state = createZeroState(numQubits);
        for (const gateSpec of gates) {
          const target = gateSpec.target || 0;
          const control = gateSpec.control;

          switch (gateSpec.gate?.toUpperCase()) {
            case 'H':
              state = applySingleQubitGate(state, HADAMARD, target);
              break;
            case 'X':
              state = applySingleQubitGate(state, PAULI_X, target);
              break;
            case 'CNOT':
              state = applyTwoQubitGate(state, CNOT, control ?? 0, target);
              break;
          }
        }

        const rho = stateToDensityMatrix(state);
        const trace = traceDensityMatrix(rho);

        // Calculate purity
        let purity = 0;
        for (let i = 0; i < rho.length; i++) {
          for (let j = 0; j < rho.length; j++) {
            purity += cAbsSq(rho[i][j]);
          }
        }

        // Entanglement
        const entanglement = calculateEntanglement(state, partition);

        // Format density matrix (show only significant entries)
        const rhoFormatted: Array<{ row: number; col: number; value: string }> = [];
        for (let i = 0; i < Math.min(rho.length, 8); i++) {
          for (let j = 0; j < Math.min(rho[i].length, 8); j++) {
            if (cAbsSq(rho[i][j]) > 1e-10) {
              const val = rho[i][j];
              rhoFormatted.push({
                row: i,
                col: j,
                value: Math.abs(val.im) < 1e-10
                  ? val.re.toFixed(4)
                  : `${val.re.toFixed(4)}${val.im >= 0 ? '+' : ''}${val.im.toFixed(4)}i`
              });
            }
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'density_matrix',
            numQubits,
            stateVector: stateToKet(state),
            densityMatrix: {
              dimension: rho.length,
              significantEntries: rhoFormatted,
              trace: trace.re
            },
            properties: {
              purity,
              isPure: Math.abs(purity - 1) < 1e-6,
              linearEntropy: 1 - purity,
              entanglement: {
                partition,
                value: entanglement
              }
            }
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            availableOperations: ['create', 'apply_gate', 'measure', 'entangle', 'density_matrix', 'info']
          }),
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error in qubit simulator: ${err}`,
      isError: true
    };
  }
}

export function isqubitsimulatorAvailable(): boolean {
  return true;
}
