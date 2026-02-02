/**
 * QUANTUM-ENTANGLEMENT TOOL
 * Quantum entanglement simulation with Bell states, GHZ states, and more
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const quantumentanglementTool: UnifiedTool = {
  name: 'quantum_entanglement',
  description: 'Quantum entanglement creation and measurement',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create_bell_pair', 'create_ghz', 'create_w', 'measure', 'teleport', 'superdense', 'info'], description: 'Operation' },
      state_type: { type: 'string', enum: ['Bell', 'GHZ', 'W', 'Phi+', 'Phi-', 'Psi+', 'Psi-'], description: 'Entangled state type' },
      num_qubits: { type: 'number', description: 'Number of qubits for GHZ/W states' },
      qubit_to_measure: { type: 'number', description: 'Which qubit to measure' },
      message: { type: 'string', description: 'Two-bit message for superdense coding (00, 01, 10, 11)' }
    },
    required: ['operation']
  }
};

// Complex number type
interface Complex {
  re: number;
  im: number;
}

function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cAbs2(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

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

// Quantum state representation
interface QuantumState {
  numQubits: number;
  amplitudes: Complex[];
}

// Bell states (maximally entangled two-qubit states)
const BELL_STATES: Record<string, QuantumState> = {
  'Phi+': {
    numQubits: 2,
    amplitudes: [
      { re: 1 / Math.sqrt(2), im: 0 },  // |00⟩
      { re: 0, im: 0 },                  // |01⟩
      { re: 0, im: 0 },                  // |10⟩
      { re: 1 / Math.sqrt(2), im: 0 }   // |11⟩
    ]
  },
  'Phi-': {
    numQubits: 2,
    amplitudes: [
      { re: 1 / Math.sqrt(2), im: 0 },   // |00⟩
      { re: 0, im: 0 },                   // |01⟩
      { re: 0, im: 0 },                   // |10⟩
      { re: -1 / Math.sqrt(2), im: 0 }   // |11⟩
    ]
  },
  'Psi+': {
    numQubits: 2,
    amplitudes: [
      { re: 0, im: 0 },                  // |00⟩
      { re: 1 / Math.sqrt(2), im: 0 },  // |01⟩
      { re: 1 / Math.sqrt(2), im: 0 },  // |10⟩
      { re: 0, im: 0 }                   // |11⟩
    ]
  },
  'Psi-': {
    numQubits: 2,
    amplitudes: [
      { re: 0, im: 0 },                   // |00⟩
      { re: 1 / Math.sqrt(2), im: 0 },   // |01⟩
      { re: -1 / Math.sqrt(2), im: 0 },  // |10⟩
      { re: 0, im: 0 }                    // |11⟩
    ]
  }
};

// Create GHZ state: (|00...0⟩ + |11...1⟩)/√2
function createGHZState(numQubits: number): QuantumState {
  const dim = 1 << numQubits;
  const amplitudes: Complex[] = Array(dim).fill(null).map(() => ({ re: 0, im: 0 }));
  amplitudes[0] = { re: 1 / Math.sqrt(2), im: 0 };        // |00...0⟩
  amplitudes[dim - 1] = { re: 1 / Math.sqrt(2), im: 0 }; // |11...1⟩
  return { numQubits, amplitudes };
}

// Create W state: (|100...0⟩ + |010...0⟩ + ... + |000...1⟩)/√n
function createWState(numQubits: number): QuantumState {
  const dim = 1 << numQubits;
  const amplitudes: Complex[] = Array(dim).fill(null).map(() => ({ re: 0, im: 0 }));
  const amp = 1 / Math.sqrt(numQubits);

  for (let i = 0; i < numQubits; i++) {
    const index = 1 << i;
    amplitudes[index] = { re: amp, im: 0 };
  }

  return { numQubits, amplitudes };
}

function getStateVector(state: QuantumState): { basis: string; amplitude: Complex; probability: number }[] {
  return state.amplitudes
    .map((amp, i) => ({
      basis: `|${i.toString(2).padStart(state.numQubits, '0')}⟩`,
      amplitude: amp,
      probability: cAbs2(amp)
    }))
    .filter(s => s.probability > 1e-10);
}

function measureQubit(state: QuantumState, qubitIndex: number): { outcome: number; newState: QuantumState; probability: number } {
  const numQubits = state.numQubits;
  const qubitMask = 1 << (numQubits - 1 - qubitIndex);

  // Calculate probabilities for measuring 0 or 1
  let prob0 = 0, prob1 = 0;
  for (let i = 0; i < state.amplitudes.length; i++) {
    if ((i & qubitMask) === 0) {
      prob0 += cAbs2(state.amplitudes[i]);
    } else {
      prob1 += cAbs2(state.amplitudes[i]);
    }
  }

  // Randomly determine outcome
  const outcome = Math.random() < prob0 ? 0 : 1;
  const probability = outcome === 0 ? prob0 : prob1;

  // Collapse state
  const newAmplitudes: Complex[] = state.amplitudes.map((amp, i) => {
    const qubitValue = (i & qubitMask) === 0 ? 0 : 1;
    if (qubitValue === outcome) {
      // Renormalize
      return { re: amp.re / Math.sqrt(probability), im: amp.im / Math.sqrt(probability) };
    } else {
      return { re: 0, im: 0 };
    }
  });

  return {
    outcome,
    newState: { numQubits, amplitudes: newAmplitudes },
    probability
  };
}

export async function executequantumentanglement(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'quantum-entanglement',
        description: 'Creates and manipulates entangled quantum states',
        whatIsEntanglement: {
          definition: 'Entanglement is a quantum correlation where measuring one particle instantly affects another, regardless of distance',
          keyProperty: 'Entangled qubits cannot be described independently - they share a joint quantum state',
          bellInequality: 'Entanglement violates Bell inequalities, proving quantum mechanics is non-local'
        },
        bellStates: {
          'Φ+': '(|00⟩ + |11⟩)/√2 - Same parity, symmetric',
          'Φ-': '(|00⟩ - |11⟩)/√2 - Same parity, antisymmetric',
          'Ψ+': '(|01⟩ + |10⟩)/√2 - Opposite parity, symmetric',
          'Ψ-': '(|01⟩ - |10⟩)/√2 - Opposite parity, antisymmetric (singlet)'
        },
        multipartiteStates: {
          GHZ: '(|00...0⟩ + |11...1⟩)/√2 - Greenberger-Horne-Zeilinger state',
          W: '(|100⟩ + |010⟩ + |001⟩)/√3 - W state (more robust to qubit loss)'
        },
        applications: [
          'Quantum teleportation - Transfer quantum state using entanglement + classical bits',
          'Superdense coding - Send 2 classical bits using 1 qubit + entanglement',
          'Quantum key distribution (BB84, E91)',
          'Quantum error correction',
          'Quantum computing speedup'
        ],
        circuitForBellState: `
        Creating |Φ+⟩:

        |0⟩ ─H─●─  →  (|00⟩ + |11⟩)/√2
              │
        |0⟩ ───X─
        `
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'create_bell_pair') {
      const stateType = args.state_type || 'Phi+';
      const bellState = BELL_STATES[stateType] || BELL_STATES['Phi+'];
      const stateVector = getStateVector(bellState);

      const stateSymbols: Record<string, string> = {
        'Phi+': '|Φ⁺⟩ = (|00⟩ + |11⟩)/√2',
        'Phi-': '|Φ⁻⟩ = (|00⟩ - |11⟩)/√2',
        'Psi+': '|Ψ⁺⟩ = (|01⟩ + |10⟩)/√2',
        'Psi-': '|Ψ⁻⟩ = (|01⟩ - |10⟩)/√2'
      };

      const result = {
        operation: 'create_bell_pair',
        stateType,
        notation: stateSymbols[stateType] || stateSymbols['Phi+'],
        stateVector: stateVector.map(s => ({
          basis: s.basis,
          amplitude: formatComplex(s.amplitude),
          probability: (s.probability * 100).toFixed(2) + '%'
        })),
        properties: {
          maximally_entangled: true,
          schmidt_rank: 2,
          von_neumann_entropy: 'S = 1 bit (maximum for 2 qubits)'
        },
        correlations: stateType.includes('Phi')
          ? 'Qubits always measure the SAME value (00 or 11)'
          : 'Qubits always measure OPPOSITE values (01 or 10)',
        circuit: `
        Creating ${stateType}:

        |0⟩ ─${stateType.includes('-') ? 'X─' : '──'}H─●─
                   │
        |0⟩ ─${stateType.includes('Psi') ? 'X─' : '──'}───X─
        `
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'create_ghz') {
      const numQubits = Math.min(Math.max(args.num_qubits || 3, 2), 8);
      const ghzState = createGHZState(numQubits);
      const stateVector = getStateVector(ghzState);

      const result = {
        operation: 'create_ghz',
        numQubits,
        name: `GHZ${numQubits}`,
        notation: `|GHZ${numQubits}⟩ = (|${'0'.repeat(numQubits)}⟩ + |${'1'.repeat(numQubits)}⟩)/√2`,
        stateVector: stateVector.map(s => ({
          basis: s.basis,
          amplitude: formatComplex(s.amplitude),
          probability: (s.probability * 100).toFixed(2) + '%'
        })),
        properties: {
          maximally_entangled: true,
          genuine_multipartite_entanglement: true,
          fragile: 'Measuring ANY qubit destroys ALL entanglement'
        },
        correlations: `All ${numQubits} qubits measure the SAME value`,
        circuit: createGHZCircuit(numQubits),
        applications: [
          'Quantum secret sharing',
          'GHZ game (demonstrates quantum advantage)',
          'Quantum metrology'
        ]
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'create_w') {
      const numQubits = Math.min(Math.max(args.num_qubits || 3, 2), 8);
      const wState = createWState(numQubits);
      const stateVector = getStateVector(wState);

      const basisTerms = [];
      for (let i = 0; i < numQubits; i++) {
        const basis = '0'.repeat(numQubits - 1 - i) + '1' + '0'.repeat(i);
        basisTerms.push(`|${basis}⟩`);
      }

      const result = {
        operation: 'create_w',
        numQubits,
        name: `W${numQubits}`,
        notation: `|W${numQubits}⟩ = (${basisTerms.join(' + ')})/√${numQubits}`,
        stateVector: stateVector.map(s => ({
          basis: s.basis,
          amplitude: formatComplex(s.amplitude),
          probability: (s.probability * 100).toFixed(2) + '%'
        })),
        properties: {
          maximally_entangled: false,
          genuine_multipartite_entanglement: true,
          robust: 'Losing one qubit leaves remaining qubits partially entangled'
        },
        correlations: `Exactly ONE qubit measures |1⟩, all others measure |0⟩`,
        comparison_with_ghz: {
          robustness: 'W state: losing 1 qubit leaves n-1 entangled. GHZ: any loss destroys all entanglement',
          entanglement_type: 'W state has "distributed" entanglement, GHZ has "all-or-nothing"'
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'measure') {
      const stateType = args.state_type || 'Phi+';
      const qubitToMeasure = args.qubit_to_measure ?? 0;

      let state: QuantumState;
      if (stateType === 'GHZ') {
        state = createGHZState(args.num_qubits || 3);
      } else if (stateType === 'W') {
        state = createWState(args.num_qubits || 3);
      } else {
        state = BELL_STATES[stateType] || BELL_STATES['Phi+'];
      }

      const beforeVector = getStateVector(state);
      const measurement = measureQubit(state, qubitToMeasure);
      const afterVector = getStateVector(measurement.newState);

      const result = {
        operation: 'measure',
        stateType,
        qubitMeasured: qubitToMeasure,
        beforeMeasurement: beforeVector.map(s => ({
          basis: s.basis,
          amplitude: formatComplex(s.amplitude),
          probability: (s.probability * 100).toFixed(2) + '%'
        })),
        measurementResult: {
          outcome: measurement.outcome,
          probability: (measurement.probability * 100).toFixed(2) + '%'
        },
        afterMeasurement: afterVector.map(s => ({
          basis: s.basis,
          amplitude: formatComplex(s.amplitude),
          probability: (s.probability * 100).toFixed(2) + '%'
        })),
        explanation: stateType.includes('Phi') || stateType.includes('Psi')
          ? `Measuring qubit ${qubitToMeasure} as ${measurement.outcome} instantly determines the other qubit's value`
          : `Measurement collapsed the ${stateType} state`,
        spookyActionAtDistance: 'The correlation is instantaneous but cannot transmit information faster than light'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'teleport') {
      // Quantum teleportation protocol
      const result = {
        operation: 'teleport',
        protocol: 'Quantum Teleportation',
        description: 'Transfer a quantum state using entanglement and classical communication',
        steps: [
          '1. Alice and Bob share a Bell pair |Φ+⟩ = (|00⟩ + |11⟩)/√2',
          '2. Alice has qubit to teleport: |ψ⟩ = α|0⟩ + β|1⟩',
          '3. Alice performs Bell measurement on her two qubits',
          '4. Alice sends 2 classical bits to Bob (measurement result)',
          '5. Bob applies correction gates based on classical bits',
          '6. Bob now has |ψ⟩ = α|0⟩ + β|1⟩'
        ],
        circuit: `
        Quantum Teleportation Circuit:

        |ψ⟩ ──●──H──M══╗
              │       ║
        |Φ+⟩A─X─────M═╬═╗
                     ║ ║
        |Φ+⟩B────────X─Z── |ψ⟩

        M = Measurement
        X,Z = Conditional corrections based on measurement
        `,
        example: {
          initialState: '|ψ⟩ = 0.6|0⟩ + 0.8|1⟩',
          bellPairShared: '|Φ+⟩ = (|00⟩ + |11⟩)/√2',
          aliceMeasures: '00, 01, 10, or 11 (each with 25% probability)',
          bobCorrections: {
            '00': 'No correction needed (I)',
            '01': 'Apply X gate',
            '10': 'Apply Z gate',
            '11': 'Apply ZX gates'
          },
          finalState: '|ψ⟩ = 0.6|0⟩ + 0.8|1⟩ (teleported!)'
        },
        keyPoints: [
          'Original qubit is destroyed (no-cloning theorem)',
          'Requires classical communication (no FTL)',
          'Teleports quantum state, not physical matter'
        ]
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'superdense') {
      const message = args.message || '00';

      const encodingGates: Record<string, string> = {
        '00': 'I (Identity) - No change',
        '01': 'X (Bit flip)',
        '10': 'Z (Phase flip)',
        '11': 'iY = ZX (Both flips)'
      };

      const resultingStates: Record<string, string> = {
        '00': '|Φ+⟩ = (|00⟩ + |11⟩)/√2',
        '01': '|Ψ+⟩ = (|01⟩ + |10⟩)/√2',
        '10': '|Φ-⟩ = (|00⟩ - |11⟩)/√2',
        '11': '|Ψ-⟩ = (|01⟩ - |10⟩)/√2'
      };

      const result = {
        operation: 'superdense',
        protocol: 'Superdense Coding',
        description: 'Send 2 classical bits using 1 qubit (with pre-shared entanglement)',
        message,
        steps: [
          '1. Alice and Bob share Bell pair |Φ+⟩',
          `2. Alice wants to send message: ${message}`,
          `3. Alice applies gate: ${encodingGates[message]}`,
          `4. This transforms the Bell pair to: ${resultingStates[message]}`,
          '5. Alice sends her qubit to Bob',
          '6. Bob performs Bell measurement to decode both bits'
        ],
        circuit: `
        Superdense Coding for message "${message}":

        Alice                     Bob
        |Φ+⟩A ──${message[1] === '1' ? 'X' : '─'}──${message[0] === '1' ? 'Z' : '─'}──────●──H──M → bit ${message[0]}
                              │
        |Φ+⟩B ──────────────────X─────M → bit ${message[1]}

        Alice's encoding: ${encodingGates[message]}
        `,
        decodingTable: {
          'Measure |Φ+⟩': 'Message was 00',
          'Measure |Ψ+⟩': 'Message was 01',
          'Measure |Φ-⟩': 'Message was 10',
          'Measure |Ψ-⟩': 'Message was 11'
        },
        efficiency: {
          classical: '1 qubit can carry 1 classical bit',
          superdense: '1 qubit + pre-shared entanglement = 2 classical bits',
          note: 'The "extra" bit comes from the pre-shared entanglement resource'
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    return { toolCallId: id, content: JSON.stringify({ error: 'Unknown operation', operation }, null, 2), isError: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

function createGHZCircuit(n: number): string {
  const lines: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      let line = `|0⟩ ─H─●─${'──'.repeat(n - 1)}`;
      lines.push(line);
    } else {
      let line = `|0⟩ ${'───'.repeat(i)}X${'───'.repeat(n - i - 1)}`;
      lines.push(line);
    }
  }
  return lines.join('\n');
}

export function isquantumentanglementAvailable(): boolean { return true; }
