/**
 * QUBIT-SIMULATOR TOOL
 * Quantum bit simulation with state vectors and measurement
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const qubitsimulatorTool: UnifiedTool = {
  name: 'qubit_simulator',
  description: 'Quantum bit state simulation and measurement',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'measure', 'apply_gate', 'get_state', 'probability', 'info'], description: 'Operation' },
      num_qubits: { type: 'number', description: 'Number of qubits (1-10)' },
      initial_state: { type: 'string', description: 'Initial state: "zero", "one", "plus", "minus", or custom amplitudes' },
      gate: { type: 'string', description: 'Gate to apply: H, X, Y, Z, S, T, CNOT, SWAP' },
      target_qubit: { type: 'number', description: 'Target qubit index for gate' },
      control_qubit: { type: 'number', description: 'Control qubit for two-qubit gates' },
      measurement_basis: { type: 'string', description: 'Measurement basis: computational, hadamard, or angle' }
    },
    required: ['operation']
  }
};

// Complex number type
interface Complex {
  re: number;
  im: number;
}

// Complex arithmetic
function complexAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function complexSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

function complexMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function complexConj(a: Complex): Complex {
  return { re: a.re, im: -a.im };
}

function complexAbs2(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

function complexScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

// Quantum state vector class
class QuantumState {
  amplitudes: Complex[];
  numQubits: number;

  constructor(numQubits: number, initialState: string = 'zero') {
    this.numQubits = numQubits;
    const dim = 1 << numQubits;
    this.amplitudes = new Array(dim).fill(null).map(() => ({ re: 0, im: 0 }));

    if (initialState === 'zero') {
      this.amplitudes[0] = { re: 1, im: 0 };
    } else if (initialState === 'one') {
      this.amplitudes[dim - 1] = { re: 1, im: 0 };
    } else if (initialState === 'plus') {
      // |+⟩^n - equal superposition
      const amp = 1 / Math.sqrt(dim);
      for (let i = 0; i < dim; i++) {
        this.amplitudes[i] = { re: amp, im: 0 };
      }
    } else if (initialState === 'minus') {
      // |−⟩ for single qubit, alternating signs for multi-qubit
      const amp = 1 / Math.sqrt(dim);
      for (let i = 0; i < dim; i++) {
        const sign = this.countOnes(i) % 2 === 0 ? 1 : -1;
        this.amplitudes[i] = { re: sign * amp, im: 0 };
      }
    }
  }

  countOnes(n: number): number {
    let count = 0;
    while (n > 0) {
      count += n & 1;
      n >>= 1;
    }
    return count;
  }

  // Apply single-qubit gate
  applySingleQubitGate(gate: Complex[][], targetQubit: number): void {
    const dim = 1 << this.numQubits;
    const targetMask = 1 << targetQubit;
    const newAmplitudes = this.amplitudes.map(a => ({ ...a }));

    for (let i = 0; i < dim; i++) {
      if ((i & targetMask) === 0) {
        const j = i | targetMask;
        const a0 = this.amplitudes[i];
        const a1 = this.amplitudes[j];

        newAmplitudes[i] = complexAdd(
          complexMul(gate[0][0], a0),
          complexMul(gate[0][1], a1)
        );
        newAmplitudes[j] = complexAdd(
          complexMul(gate[1][0], a0),
          complexMul(gate[1][1], a1)
        );
      }
    }

    this.amplitudes = newAmplitudes;
  }

  // Apply CNOT gate
  applyCNOT(controlQubit: number, targetQubit: number): void {
    const dim = 1 << this.numQubits;
    const controlMask = 1 << controlQubit;
    const targetMask = 1 << targetQubit;
    const newAmplitudes = this.amplitudes.map(a => ({ ...a }));

    for (let i = 0; i < dim; i++) {
      if ((i & controlMask) !== 0) {
        const j = i ^ targetMask;
        newAmplitudes[i] = this.amplitudes[j];
        newAmplitudes[j] = this.amplitudes[i];
      }
    }

    this.amplitudes = newAmplitudes;
  }

  // Apply SWAP gate
  applySWAP(qubit1: number, qubit2: number): void {
    const dim = 1 << this.numQubits;
    const mask1 = 1 << qubit1;
    const mask2 = 1 << qubit2;
    const newAmplitudes = this.amplitudes.map(a => ({ ...a }));

    for (let i = 0; i < dim; i++) {
      const bit1 = (i & mask1) !== 0;
      const bit2 = (i & mask2) !== 0;
      if (bit1 !== bit2) {
        const j = i ^ mask1 ^ mask2;
        if (i < j) {
          newAmplitudes[i] = this.amplitudes[j];
          newAmplitudes[j] = this.amplitudes[i];
        }
      }
    }

    this.amplitudes = newAmplitudes;
  }

  // Get probability of measuring a specific outcome
  probability(outcome: number): number {
    return complexAbs2(this.amplitudes[outcome]);
  }

  // Get all probabilities
  getProbabilities(): number[] {
    return this.amplitudes.map(a => complexAbs2(a));
  }

  // Simulate measurement (collapses state)
  measure(): { outcome: number; binary: string; probability: number } {
    const probs = this.getProbabilities();
    const rand = Math.random();
    let cumulative = 0;
    let outcome = 0;

    for (let i = 0; i < probs.length; i++) {
      cumulative += probs[i];
      if (rand < cumulative) {
        outcome = i;
        break;
      }
    }

    const probability = probs[outcome];

    // Collapse state
    this.amplitudes = this.amplitudes.map((_, i) =>
      i === outcome ? { re: 1, im: 0 } : { re: 0, im: 0 }
    );

    const binary = outcome.toString(2).padStart(this.numQubits, '0');

    return { outcome, binary, probability };
  }

  // Get state vector representation
  getStateVector(): { index: number; binary: string; amplitude: Complex; probability: number }[] {
    return this.amplitudes
      .map((amp, i) => ({
        index: i,
        binary: i.toString(2).padStart(this.numQubits, '0'),
        amplitude: amp,
        probability: complexAbs2(amp)
      }))
      .filter(s => s.probability > 1e-10);
  }
}

// Standard quantum gates
const GATES: Record<string, Complex[][]> = {
  // Hadamard gate
  H: [
    [{ re: 1 / Math.sqrt(2), im: 0 }, { re: 1 / Math.sqrt(2), im: 0 }],
    [{ re: 1 / Math.sqrt(2), im: 0 }, { re: -1 / Math.sqrt(2), im: 0 }]
  ],
  // Pauli-X (NOT) gate
  X: [
    [{ re: 0, im: 0 }, { re: 1, im: 0 }],
    [{ re: 1, im: 0 }, { re: 0, im: 0 }]
  ],
  // Pauli-Y gate
  Y: [
    [{ re: 0, im: 0 }, { re: 0, im: -1 }],
    [{ re: 0, im: 1 }, { re: 0, im: 0 }]
  ],
  // Pauli-Z gate
  Z: [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: -1, im: 0 }]
  ],
  // S gate (π/2 phase)
  S: [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 0, im: 1 }]
  ],
  // T gate (π/4 phase)
  T: [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: Math.cos(Math.PI / 4), im: Math.sin(Math.PI / 4) }]
  ]
};

function formatComplex(c: Complex): string {
  if (Math.abs(c.im) < 1e-10) {
    return c.re.toFixed(4);
  } else if (Math.abs(c.re) < 1e-10) {
    return `${c.im.toFixed(4)}i`;
  } else {
    const sign = c.im >= 0 ? '+' : '-';
    return `${c.re.toFixed(4)}${sign}${Math.abs(c.im).toFixed(4)}i`;
  }
}

export async function executequbitsimulator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'qubit-simulator',
        description: 'Simulates quantum bits (qubits) with state vectors',
        concepts: {
          qubit: 'A quantum bit exists in superposition of |0⟩ and |1⟩: |ψ⟩ = α|0⟩ + β|1⟩',
          superposition: 'Qubits can be in multiple states simultaneously',
          measurement: 'Measuring collapses the superposition with probability |α|² or |β|²',
          entanglement: 'Multiple qubits can be correlated in ways impossible classically'
        },
        operations: ['create', 'measure', 'apply_gate', 'get_state', 'probability'],
        gates: Object.keys(GATES).concat(['CNOT', 'SWAP']),
        diracNotation: {
          '|0⟩': 'Computational basis state zero',
          '|1⟩': 'Computational basis state one',
          '|+⟩': '(|0⟩ + |1⟩)/√2 - Hadamard of |0⟩',
          '|−⟩': '(|0⟩ - |1⟩)/√2 - Hadamard of |1⟩'
        },
        blochSphere: `
        Bloch Sphere Representation:

              |0⟩ (north pole)
                ●
               /|\\
              / | \\
             /  |  \\
        |−⟩ ●--|--● |+⟩ (equator)
             \\  |  /
              \\ | /
               \\|/
                ●
              |1⟩ (south pole)

        Any pure qubit state can be represented
        as a point on this sphere.
        `
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'create') {
      const numQubits = Math.min(Math.max(args.num_qubits || 1, 1), 10);
      const initialState = args.initial_state || 'zero';

      const state = new QuantumState(numQubits, initialState);
      const stateVector = state.getStateVector();

      const result = {
        operation: 'create',
        numQubits,
        initialState,
        dimension: 1 << numQubits,
        stateVector: stateVector.map(s => ({
          basis: `|${s.binary}⟩`,
          amplitude: formatComplex(s.amplitude),
          probability: (s.probability * 100).toFixed(2) + '%'
        })),
        visualization: numQubits <= 3 ? createStateVisualization(stateVector) : 'State too large for visualization',
        notation: `|ψ⟩ = ${stateVector.map(s =>
          `${formatComplex(s.amplitude)}|${s.binary}⟩`
        ).join(' + ')}`
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'apply_gate') {
      const numQubits = Math.min(Math.max(args.num_qubits || 1, 1), 10);
      const gate = args.gate || 'H';
      const targetQubit = args.target_qubit ?? 0;
      const controlQubit = args.control_qubit ?? 0;
      const initialState = args.initial_state || 'zero';

      const state = new QuantumState(numQubits, initialState);
      const beforeState = state.getStateVector();

      // Apply gate
      if (gate === 'CNOT' && numQubits >= 2) {
        state.applyCNOT(controlQubit, targetQubit);
      } else if (gate === 'SWAP' && numQubits >= 2) {
        state.applySWAP(controlQubit, targetQubit);
      } else if (GATES[gate]) {
        state.applySingleQubitGate(GATES[gate], targetQubit);
      }

      const afterState = state.getStateVector();

      const result = {
        operation: 'apply_gate',
        gate,
        targetQubit,
        controlQubit: ['CNOT', 'SWAP'].includes(gate) ? controlQubit : undefined,
        gateMatrix: GATES[gate] ? GATES[gate].map(row =>
          row.map(c => formatComplex(c))
        ) : 'Two-qubit gate',
        beforeState: beforeState.map(s => ({
          basis: `|${s.binary}⟩`,
          amplitude: formatComplex(s.amplitude)
        })),
        afterState: afterState.map(s => ({
          basis: `|${s.binary}⟩`,
          amplitude: formatComplex(s.amplitude),
          probability: (s.probability * 100).toFixed(2) + '%'
        })),
        transformation: `${gate}|ψ⟩ → |ψ'⟩`
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'measure') {
      const numQubits = Math.min(Math.max(args.num_qubits || 1, 1), 10);
      const initialState = args.initial_state || 'plus';

      const state = new QuantumState(numQubits, initialState);
      const beforeState = state.getStateVector();
      const probabilities = state.getProbabilities();

      const measurement = state.measure();

      const result = {
        operation: 'measure',
        beforeMeasurement: beforeState.map(s => ({
          basis: `|${s.binary}⟩`,
          amplitude: formatComplex(s.amplitude),
          probability: (s.probability * 100).toFixed(2) + '%'
        })),
        measurement: {
          outcome: measurement.outcome,
          binary: measurement.binary,
          ket: `|${measurement.binary}⟩`,
          probability: (measurement.probability * 100).toFixed(2) + '%'
        },
        afterMeasurement: `State collapsed to |${measurement.binary}⟩`,
        allProbabilities: probabilities.map((p, i) => ({
          state: `|${i.toString(2).padStart(numQubits, '0')}⟩`,
          probability: (p * 100).toFixed(2) + '%'
        })).filter(p => parseFloat(p.probability) > 0),
        explanation: 'Quantum measurement collapses the superposition. The probability of each outcome is |amplitude|².'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'get_state') {
      const numQubits = Math.min(Math.max(args.num_qubits || 2, 1), 10);
      const initialState = args.initial_state || 'zero';

      const state = new QuantumState(numQubits, initialState);

      // Apply some gates if specified
      if (args.gate) {
        const gate = args.gate;
        const target = args.target_qubit ?? 0;
        if (GATES[gate]) {
          state.applySingleQubitGate(GATES[gate], target);
        }
      }

      const stateVector = state.getStateVector();
      const probs = state.getProbabilities();

      const result = {
        operation: 'get_state',
        numQubits,
        dimension: 1 << numQubits,
        stateVector: stateVector.map(s => ({
          basisState: `|${s.binary}⟩`,
          amplitude: formatComplex(s.amplitude),
          probability: (s.probability * 100).toFixed(4) + '%'
        })),
        normalization: probs.reduce((a, b) => a + b, 0).toFixed(10),
        purity: 'Pure state (ρ² = ρ)',
        visualization: numQubits <= 3 ? createProbabilityBar(probs, numQubits) : 'Too many qubits for visualization'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'probability') {
      const numQubits = Math.min(Math.max(args.num_qubits || 2, 1), 10);

      // Create Bell state as example
      const state = new QuantumState(numQubits, 'zero');

      // Apply H to first qubit
      state.applySingleQubitGate(GATES['H'], 0);

      // Apply CNOT if multi-qubit
      if (numQubits >= 2) {
        state.applyCNOT(0, 1);
      }

      const probs = state.getProbabilities();
      const stateVector = state.getStateVector();

      const result = {
        operation: 'probability',
        description: numQubits >= 2 ? 'Bell State |Φ+⟩' : 'Hadamard state |+⟩',
        stateVector: stateVector.map(s => ({
          state: `|${s.binary}⟩`,
          amplitude: formatComplex(s.amplitude),
          probability: s.probability
        })),
        probabilityDistribution: probs.map((p, i) => ({
          outcome: i.toString(2).padStart(numQubits, '0'),
          probability: p,
          percentage: (p * 100).toFixed(2) + '%'
        })).filter(p => p.probability > 1e-10),
        totalProbability: probs.reduce((a, b) => a + b, 0),
        expectedMeasurements: numQubits >= 2
          ? 'Measuring first qubit instantly determines second (entanglement)'
          : '50% chance of |0⟩, 50% chance of |1⟩',
        visualization: createProbabilityBar(probs, numQubits)
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    return { toolCallId: id, content: JSON.stringify({ error: 'Unknown operation', operation }, null, 2), isError: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

function createStateVisualization(stateVector: { binary: string; probability: number }[]): string {
  const lines = ['Probability Distribution:'];
  const maxWidth = 40;

  for (const s of stateVector) {
    const barWidth = Math.round(s.probability * maxWidth);
    const bar = '█'.repeat(barWidth) + '░'.repeat(maxWidth - barWidth);
    lines.push(`|${s.binary}⟩ ${bar} ${(s.probability * 100).toFixed(1)}%`);
  }

  return lines.join('\n');
}

function createProbabilityBar(probs: number[], numQubits: number): string {
  const lines = ['Measurement Probability:'];
  const maxWidth = 30;

  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > 1e-10) {
      const binary = i.toString(2).padStart(numQubits, '0');
      const barWidth = Math.round(probs[i] * maxWidth);
      const bar = '▓'.repeat(barWidth) + '░'.repeat(maxWidth - barWidth);
      lines.push(`|${binary}⟩ ${bar} ${(probs[i] * 100).toFixed(1)}%`);
    }
  }

  return lines.join('\n');
}

export function isqubitsimulatorAvailable(): boolean { return true; }
