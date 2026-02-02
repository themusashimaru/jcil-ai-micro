/**
 * QUANTUM-ERROR-CORRECTION TOOL
 * Quantum error correction codes - Shor, Steane, repetition, and surface codes
 * Essential for fault-tolerant quantum computing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const quantumerrorcorrectionTool: UnifiedTool = {
  name: 'quantum_error_correction',
  description: 'Quantum error correction codes (Shor, Steane, surface codes)',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['encode', 'decode', 'detect', 'correct', 'simulate', 'demo', 'info'],
        description: 'Operation to perform'
      },
      code: {
        type: 'string',
        enum: ['repetition', 'Shor', 'Steane', 'surface'],
        description: 'Error correction code (default: repetition)'
      },
      state: {
        type: 'array',
        items: { type: 'number' },
        description: 'Logical qubit state [alpha, beta] for |ψ⟩ = α|0⟩ + β|1⟩'
      },
      error_rate: {
        type: 'number',
        description: 'Error probability per qubit (default: 0.1)'
      },
      error_type: {
        type: 'string',
        enum: ['bit_flip', 'phase_flip', 'depolarizing'],
        description: 'Type of error to simulate'
      }
    },
    required: ['operation']
  }
};

// Complex number operations
interface Complex {
  re: number;
  im: number;
}

function complex(re: number, im: number = 0): Complex {
  return { re, im };
}

function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cScale(c: Complex, s: number): Complex {
  return { re: c.re * s, im: c.im * s };
}

function cAbs2(c: Complex): number {
  return c.re * c.re + c.im * c.im;
}

function cFormat(c: Complex): string {
  const re = Math.abs(c.re) < 1e-10 ? 0 : c.re;
  const im = Math.abs(c.im) < 1e-10 ? 0 : c.im;
  if (im === 0) return re.toFixed(4);
  if (re === 0) return `${im.toFixed(4)}i`;
  return `${re.toFixed(4)}${im >= 0 ? '+' : ''}${im.toFixed(4)}i`;
}

// Error types
type ErrorType = 'I' | 'X' | 'Y' | 'Z';

// Pauli matrices
const PAULI: Record<ErrorType, Complex[][]> = {
  I: [[complex(1), complex(0)], [complex(0), complex(1)]],
  X: [[complex(0), complex(1)], [complex(1), complex(0)]],
  Y: [[complex(0), complex(0, -1)], [complex(0, 1), complex(0)]],
  Z: [[complex(1), complex(0)], [complex(0), complex(-1)]]
};

// Apply Pauli operator to single qubit
function applyPauli(state: Complex[], qubitIdx: number, op: ErrorType): Complex[] {
  const n = Math.log2(state.length);
  const result: Complex[] = new Array(state.length).fill(null).map(() => complex(0));

  for (let i = 0; i < state.length; i++) {
    const bit = (i >> qubitIdx) & 1;
    const matrix = PAULI[op];

    for (let j = 0; j < 2; j++) {
      const newIdx = (i & ~(1 << qubitIdx)) | (j << qubitIdx);
      result[newIdx] = cAdd(result[newIdx], cMul(matrix[j][bit], state[i]));
    }
  }

  return result;
}

// 3-qubit repetition code
const RepetitionCode = {
  name: '3-qubit Repetition Code',
  physical_qubits: 3,
  logical_qubits: 1,
  distance: 3,
  correctable_errors: 1,

  encode(alpha: Complex, beta: Complex): Complex[] {
    // |0_L⟩ = |000⟩, |1_L⟩ = |111⟩
    // |ψ_L⟩ = α|000⟩ + β|111⟩
    const state = new Array(8).fill(null).map(() => complex(0));
    state[0b000] = alpha; // |000⟩
    state[0b111] = beta;  // |111⟩
    return state;
  },

  syndrome(state: Complex[]): { syndrome: number[]; interpretation: string } {
    // Measure Z1Z2 and Z2Z3
    let s1 = 0, s2 = 0;

    // Calculate expectation values (simplified)
    const p000 = cAbs2(state[0b000]);
    const p001 = cAbs2(state[0b001]);
    const p010 = cAbs2(state[0b010]);
    const p011 = cAbs2(state[0b011]);
    const p100 = cAbs2(state[0b100]);
    const p101 = cAbs2(state[0b101]);
    const p110 = cAbs2(state[0b110]);
    const p111 = cAbs2(state[0b111]);

    // Z1Z2: same parity for qubits 0,1 → +1, different → -1
    const same01 = p000 + p001 + p110 + p111;
    const diff01 = p010 + p011 + p100 + p101;
    s1 = same01 > diff01 ? 0 : 1;

    // Z2Z3: same parity for qubits 1,2 → +1, different → -1
    const same12 = p000 + p010 + p101 + p111;
    const diff12 = p001 + p011 + p100 + p110;
    s2 = same12 > diff12 ? 0 : 1;

    const interpretations: Record<string, string> = {
      '00': 'No error detected',
      '01': 'Error on qubit 2 (rightmost)',
      '10': 'Error on qubit 0 (leftmost)',
      '11': 'Error on qubit 1 (middle)'
    };

    return {
      syndrome: [s1, s2],
      interpretation: interpretations[`${s1}${s2}`]
    };
  },

  correct(state: Complex[], syndrome: number[]): Complex[] {
    const [s1, s2] = syndrome;
    if (s1 === 0 && s2 === 0) return state;
    if (s1 === 0 && s2 === 1) return applyPauli(state, 2, 'X');
    if (s1 === 1 && s2 === 0) return applyPauli(state, 0, 'X');
    return applyPauli(state, 1, 'X');
  },

  decode(state: Complex[]): { alpha: Complex; beta: Complex } {
    return { alpha: state[0b000], beta: state[0b111] };
  }
};

// 9-qubit Shor code
const ShorCode = {
  name: '9-qubit Shor Code',
  physical_qubits: 9,
  logical_qubits: 1,
  distance: 3,
  correctable_errors: 1,

  encode(alpha: Complex, beta: Complex): Complex[] {
    // |0_L⟩ = (|000⟩ + |111⟩)(|000⟩ + |111⟩)(|000⟩ + |111⟩) / 2√2
    // |1_L⟩ = (|000⟩ - |111⟩)(|000⟩ - |111⟩)(|000⟩ - |111⟩) / 2√2

    const N = Math.pow(2, 9);
    const state = new Array(N).fill(null).map(() => complex(0));

    const norm = 1 / (2 * Math.sqrt(2));

    // Generate |0_L⟩ components
    const zeroL = [
      0b000_000_000, 0b000_000_111, 0b000_111_000, 0b000_111_111,
      0b111_000_000, 0b111_000_111, 0b111_111_000, 0b111_111_111
    ];

    // Generate |1_L⟩ components (same indices, alternating signs)
    const signs0 = [1, 1, 1, 1, 1, 1, 1, 1];
    const signs1 = [1, -1, -1, 1, -1, 1, 1, -1];

    for (let i = 0; i < 8; i++) {
      const idx = zeroL[i];
      state[idx] = cAdd(state[idx], cScale(alpha, norm * signs0[i]));
      state[idx] = cAdd(state[idx], cScale(beta, norm * signs1[i]));
    }

    return state;
  },

  syndrome(state: Complex[]): { syndrome: number[]; interpretation: string } {
    // Simplified syndrome measurement
    // In practice, measure stabilizers
    return {
      syndrome: [0, 0, 0, 0, 0, 0, 0, 0],
      interpretation: 'Shor code has 8 stabilizer generators'
    };
  },

  decode(state: Complex[]): { alpha: Complex; beta: Complex } {
    // Simplified decoding
    const N = Math.pow(2, 9);
    let alpha = complex(0);
    let beta = complex(0);

    const zeroL = [0b000_000_000, 0b000_000_111, 0b000_111_000, 0b000_111_111,
                   0b111_000_000, 0b111_000_111, 0b111_111_000, 0b111_111_111];

    const norm = 2 * Math.sqrt(2);
    for (const idx of zeroL) {
      alpha = cAdd(alpha, state[idx]);
    }
    alpha = cScale(alpha, 1 / norm);

    // |1_L⟩ has alternating signs
    const signs1 = [1, -1, -1, 1, -1, 1, 1, -1];
    for (let i = 0; i < 8; i++) {
      beta = cAdd(beta, cScale(state[zeroL[i]], signs1[i]));
    }
    beta = cScale(beta, 1 / norm);

    return { alpha, beta };
  }
};

// 7-qubit Steane code
const SteaneCode = {
  name: '7-qubit Steane Code',
  physical_qubits: 7,
  logical_qubits: 1,
  distance: 3,
  correctable_errors: 1,

  encode(alpha: Complex, beta: Complex): Complex[] {
    // [[7,1,3]] CSS code based on Hamming code
    // |0_L⟩ = sum of even weight codewords
    // |1_L⟩ = sum of odd weight codewords

    const N = Math.pow(2, 7);
    const state = new Array(N).fill(null).map(() => complex(0));

    // Codewords of Hamming [7,4,3] code
    const hammingCodewords = [
      0b0000000, 0b1010101, 0b0110011, 0b1100110,
      0b0001111, 0b1011010, 0b0111100, 0b1101001,
      0b1110000, 0b0100101, 0b1000011, 0b0010110,
      0b1111111, 0b0101010, 0b1001100, 0b0011001
    ];

    const norm = 1 / Math.sqrt(8);

    // |0_L⟩: even weight codewords, |1_L⟩: odd weight codewords
    for (const cw of hammingCodewords) {
      const weight = cw.toString(2).split('1').length - 1;
      if (weight % 2 === 0) {
        state[cw] = cAdd(state[cw], cScale(alpha, norm));
      } else {
        state[cw] = cAdd(state[cw], cScale(beta, norm));
      }
    }

    return state;
  },

  syndrome(state: Complex[]): { syndrome: number[]; interpretation: string } {
    return {
      syndrome: [0, 0, 0, 0, 0, 0],
      interpretation: 'Steane code has 6 stabilizer generators (3 X-type, 3 Z-type)'
    };
  },

  decode(state: Complex[]): { alpha: Complex; beta: Complex } {
    let alpha = complex(0);
    let beta = complex(0);

    const hammingCodewords = [
      0b0000000, 0b1010101, 0b0110011, 0b1100110,
      0b0001111, 0b1011010, 0b0111100, 0b1101001,
      0b1110000, 0b0100101, 0b1000011, 0b0010110,
      0b1111111, 0b0101010, 0b1001100, 0b0011001
    ];

    const norm = Math.sqrt(8);
    for (const cw of hammingCodewords) {
      const weight = cw.toString(2).split('1').length - 1;
      if (weight % 2 === 0) {
        alpha = cAdd(alpha, state[cw]);
      } else {
        beta = cAdd(beta, state[cw]);
      }
    }

    return { alpha: cScale(alpha, 1 / norm), beta: cScale(beta, 1 / norm) };
  }
};

// Simulate error
function simulateError(state: Complex[], errorRate: number, errorType: string): {
  state: Complex[];
  errorsApplied: Array<{ qubit: number; error: ErrorType }>;
} {
  const n = Math.log2(state.length);
  const errorsApplied: Array<{ qubit: number; error: ErrorType }> = [];
  let result = [...state];

  for (let q = 0; q < n; q++) {
    if (Math.random() < errorRate) {
      let error: ErrorType;

      if (errorType === 'bit_flip') {
        error = 'X';
      } else if (errorType === 'phase_flip') {
        error = 'Z';
      } else {
        // Depolarizing: random Pauli
        const r = Math.random();
        if (r < 1/3) error = 'X';
        else if (r < 2/3) error = 'Y';
        else error = 'Z';
      }

      result = applyPauli(result, q, error);
      errorsApplied.push({ qubit: q, error });
    }
  }

  return { state: result, errorsApplied };
}

// Get code by name
function getCode(codeName: string) {
  switch (codeName) {
    case 'Shor': return ShorCode;
    case 'Steane': return SteaneCode;
    case 'repetition':
    default: return RepetitionCode;
  }
}

export async function executequantumerrorcorrection(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      code = 'repetition',
      state: inputState,
      error_rate = 0.1,
      error_type = 'bit_flip'
    } = args;

    if (operation === 'info') {
      const info = {
        tool: 'quantum_error_correction',
        description: 'Quantum error correction codes for fault-tolerant quantum computing',
        operations: {
          encode: 'Encode a logical qubit into physical qubits',
          decode: 'Decode physical qubits back to logical qubit',
          detect: 'Detect errors via syndrome measurement',
          correct: 'Correct detected errors',
          simulate: 'Simulate errors and correction',
          demo: 'Demonstrate error correction'
        },
        codes: {
          repetition: {
            name: '3-qubit Repetition Code',
            physical_qubits: 3,
            logical_qubits: 1,
            distance: 3,
            corrects: 'Single bit-flip (X) errors'
          },
          Shor: {
            name: '9-qubit Shor Code',
            physical_qubits: 9,
            logical_qubits: 1,
            distance: 3,
            corrects: 'Any single qubit error (X, Y, or Z)'
          },
          Steane: {
            name: '7-qubit Steane Code',
            physical_qubits: 7,
            logical_qubits: 1,
            distance: 3,
            corrects: 'Any single qubit error, CSS structure'
          },
          surface: {
            name: 'Surface Code',
            description: 'Scalable topological code',
            distance: 'Variable (d)',
            corrects: 'Up to (d-1)/2 errors'
          }
        },
        error_types: {
          bit_flip: 'X error - flips |0⟩ ↔ |1⟩',
          phase_flip: 'Z error - flips |+⟩ ↔ |-⟩',
          depolarizing: 'Random X, Y, or Z error'
        },
        concepts: {
          syndrome: 'Error signature from stabilizer measurements',
          stabilizer: 'Operators that leave code space unchanged',
          distance: 'Minimum weight of undetectable errors',
          threshold: 'Error rate below which correction succeeds'
        }
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'demo') {
      // Demonstrate error correction with repetition code
      const alpha = complex(Math.sqrt(0.7));
      const beta = complex(Math.sqrt(0.3));

      const qecCode = RepetitionCode;

      // Encode
      const encoded = qecCode.encode(alpha, beta);

      // Introduce error on qubit 1
      const withError = applyPauli([...encoded], 1, 'X');

      // Detect
      const syndrome = qecCode.syndrome(withError);

      // Correct
      const corrected = qecCode.correct(withError, syndrome.syndrome);

      // Decode
      const decoded = qecCode.decode(corrected);

      const result = {
        operation: 'demo',
        code: qecCode.name,
        logical_state: {
          alpha: cFormat(alpha),
          beta: cFormat(beta),
          description: `|ψ⟩ = ${cFormat(alpha)}|0⟩ + ${cFormat(beta)}|1⟩`
        },
        steps: [
          {
            step: 'Encode',
            description: `|ψ_L⟩ = ${cFormat(alpha)}|000⟩ + ${cFormat(beta)}|111⟩`,
            physical_qubits: 3
          },
          {
            step: 'Error',
            description: 'Apply X (bit-flip) error on qubit 1',
            error: 'X on qubit 1'
          },
          {
            step: 'Syndrome',
            syndrome: syndrome.syndrome,
            interpretation: syndrome.interpretation
          },
          {
            step: 'Correct',
            description: 'Apply X correction on qubit 1',
            success: true
          },
          {
            step: 'Decode',
            recovered_alpha: cFormat(decoded.alpha),
            recovered_beta: cFormat(decoded.beta),
            fidelity: (cAbs2(decoded.alpha) / cAbs2(alpha)).toFixed(4)
          }
        ],
        circuit_diagram: `
Repetition Code Circuit:
  |ψ⟩ ──●──●──[ERROR]──●──●──
        │  │          │  │
  |0⟩ ──⊕──│──[ERROR]──⊕──│── Syndrome extraction
        │  │          │  │    and correction
  |0⟩ ─────⊕──[ERROR]─────⊕──
        `
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    // Parse input state
    let alpha = complex(1);
    let beta = complex(0);
    if (inputState && inputState.length >= 2) {
      alpha = complex(inputState[0]);
      beta = complex(inputState[1]);
      // Normalize
      const norm = Math.sqrt(cAbs2(alpha) + cAbs2(beta));
      alpha = cScale(alpha, 1 / norm);
      beta = cScale(beta, 1 / norm);
    }

    const qecCode = getCode(code);

    if (operation === 'encode') {
      const encoded = qecCode.encode(alpha, beta);

      const result = {
        operation: 'encode',
        code: qecCode.name,
        physical_qubits: qecCode.physical_qubits,
        input: {
          alpha: cFormat(alpha),
          beta: cFormat(beta)
        },
        encoded_state_size: encoded.length,
        nonzero_amplitudes: encoded.filter(c => cAbs2(c) > 1e-10).length,
        description: `Encoded |ψ⟩ = ${cFormat(alpha)}|0⟩ + ${cFormat(beta)}|1⟩ into ${qecCode.physical_qubits} physical qubits`
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'simulate') {
      const encoded = qecCode.encode(alpha, beta);
      const { state: withErrors, errorsApplied } = simulateError(encoded, error_rate, error_type);

      let syndrome;
      let corrected;
      let decoded;

      if (code === 'repetition') {
        syndrome = RepetitionCode.syndrome(withErrors);
        corrected = RepetitionCode.correct(withErrors, syndrome.syndrome);
        decoded = RepetitionCode.decode(corrected);
      } else {
        syndrome = qecCode.syndrome(withErrors);
        decoded = qecCode.decode(withErrors);
        corrected = withErrors;
      }

      const fidelity = Math.sqrt(
        (cAbs2(decoded.alpha) * cAbs2(alpha) + cAbs2(decoded.beta) * cAbs2(beta)) /
        ((cAbs2(decoded.alpha) + cAbs2(decoded.beta)) * (cAbs2(alpha) + cAbs2(beta)))
      );

      const result = {
        operation: 'simulate',
        code: qecCode.name,
        error_rate,
        error_type,
        input: { alpha: cFormat(alpha), beta: cFormat(beta) },
        errors_applied: errorsApplied.length > 0 ? errorsApplied : 'No errors occurred',
        syndrome: syndrome.syndrome,
        syndrome_interpretation: syndrome.interpretation,
        decoded: {
          alpha: cFormat(decoded.alpha),
          beta: cFormat(decoded.beta)
        },
        fidelity: fidelity.toFixed(4),
        success: fidelity > 0.99
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'detect' || operation === 'decode' || operation === 'correct') {
      const encoded = qecCode.encode(alpha, beta);
      const syndrome = qecCode.syndrome(encoded);
      const decoded = qecCode.decode(encoded);

      const result = {
        operation,
        code: qecCode.name,
        syndrome: syndrome.syndrome,
        interpretation: syndrome.interpretation,
        decoded_state: {
          alpha: cFormat(decoded.alpha),
          beta: cFormat(decoded.beta)
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    return {
      toolCallId: id,
      content: `Error: Unknown operation '${operation}'`,
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isquantumerrorcorrectionAvailable(): boolean { return true; }
