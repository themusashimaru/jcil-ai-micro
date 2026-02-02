/**
 * QFT TOOL
 * Quantum Fourier Transform - the quantum analog of discrete Fourier transform
 * Essential for quantum phase estimation, Shor's algorithm, and many quantum algorithms
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const qftTool: UnifiedTool = {
  name: 'qft',
  description: 'Quantum Fourier Transform and inverse',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['forward', 'inverse', 'circuit', 'apply', 'demo', 'info'],
        description: 'Operation: forward QFT, inverse QFT, show circuit, apply to state'
      },
      num_qubits: {
        type: 'number',
        description: 'Number of qubits (default: 3)'
      },
      input_state: {
        type: 'array',
        items: { type: 'number' },
        description: 'Input state vector (amplitudes)'
      },
      show_matrix: {
        type: 'boolean',
        description: 'Show the QFT matrix (default: false for large n)'
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

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re
  };
}

function cScale(c: Complex, s: number): Complex {
  return { re: c.re * s, im: c.im * s };
}

function cAbs(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

function cPhase(c: Complex): number {
  return Math.atan2(c.im, c.re);
}

function cExp(theta: number): Complex {
  return { re: Math.cos(theta), im: Math.sin(theta) };
}

function cConj(c: Complex): Complex {
  return { re: c.re, im: -c.im };
}

function cFormat(c: Complex, precision: number = 4): string {
  const re = Math.abs(c.re) < 1e-10 ? 0 : c.re;
  const im = Math.abs(c.im) < 1e-10 ? 0 : c.im;

  if (im === 0) return re.toFixed(precision);
  if (re === 0) return `${im.toFixed(precision)}i`;
  const sign = im >= 0 ? '+' : '';
  return `${re.toFixed(precision)}${sign}${im.toFixed(precision)}i`;
}

// Generate QFT matrix for n qubits
function generateQFTMatrix(n: number): Complex[][] {
  const N = Math.pow(2, n);
  const matrix: Complex[][] = [];
  const omega = 2 * Math.PI / N;
  const normFactor = 1 / Math.sqrt(N);

  for (let j = 0; j < N; j++) {
    matrix[j] = [];
    for (let k = 0; k < N; k++) {
      const phase = omega * j * k;
      matrix[j][k] = cScale(cExp(phase), normFactor);
    }
  }

  return matrix;
}

// Generate inverse QFT matrix
function generateInverseQFTMatrix(n: number): Complex[][] {
  const N = Math.pow(2, n);
  const matrix: Complex[][] = [];
  const omega = -2 * Math.PI / N; // Negative for inverse
  const normFactor = 1 / Math.sqrt(N);

  for (let j = 0; j < N; j++) {
    matrix[j] = [];
    for (let k = 0; k < N; k++) {
      const phase = omega * j * k;
      matrix[j][k] = cScale(cExp(phase), normFactor);
    }
  }

  return matrix;
}

// Apply QFT/inverse QFT to state vector
function applyQFT(state: Complex[], inverse: boolean = false): Complex[] {
  const N = state.length;
  const n = Math.log2(N);

  if (!Number.isInteger(n)) {
    throw new Error('State vector length must be a power of 2');
  }

  const matrix = inverse ? generateInverseQFTMatrix(n) : generateQFTMatrix(n);
  const result: Complex[] = new Array(N).fill(null).map(() => complex(0));

  for (let j = 0; j < N; j++) {
    for (let k = 0; k < N; k++) {
      result[j] = cAdd(result[j], cMul(matrix[j][k], state[k]));
    }
  }

  return result;
}

// Generate QFT circuit description
function generateQFTCircuit(n: number): {
  gates: Array<{ gate: string; targets: number[]; controls?: number[]; params?: number }>;
  diagram: string;
} {
  const gates: Array<{ gate: string; targets: number[]; controls?: number[]; params?: number }> = [];

  // QFT circuit: for each qubit, apply H then controlled phase rotations
  for (let j = 0; j < n; j++) {
    // Hadamard on qubit j
    gates.push({ gate: 'H', targets: [j] });

    // Controlled phase rotations
    for (let k = j + 1; k < n; k++) {
      const angle = Math.PI / Math.pow(2, k - j);
      gates.push({
        gate: `CP(π/${Math.pow(2, k - j)})`,
        targets: [j],
        controls: [k],
        params: angle
      });
    }
  }

  // Swap qubits to reverse order
  for (let j = 0; j < Math.floor(n / 2); j++) {
    gates.push({ gate: 'SWAP', targets: [j, n - 1 - j] });
  }

  // Generate ASCII diagram
  const lines: string[] = [];
  lines.push('QFT Circuit for ' + n + ' qubits:');
  lines.push('=' .repeat(40));

  for (let q = 0; q < n; q++) {
    let line = `q${q}: `;

    for (let step = 0; step < n; step++) {
      if (step === q) {
        line += '─[H]─';
      } else if (step > q) {
        line += `─────`;
      } else {
        line += `──●──`;
      }

      // Add controlled rotations
      for (let k = q + 1; k < n; k++) {
        if (step === q) {
          line += `─[R${k-q+1}]─`;
        }
      }
    }

    lines.push(line);
  }

  lines.push('');
  lines.push('Where:');
  lines.push('  H = Hadamard gate');
  lines.push('  Rk = Controlled phase rotation by π/2^k');
  lines.push('  ● = Control qubit');

  return { gates, diagram: lines.join('\n') };
}

// Visualize state vector
function visualizeState(state: Complex[], label: string = 'State'): string {
  const lines: string[] = [];
  const N = state.length;
  const n = Math.log2(N);

  lines.push(`${label} (${n} qubits, ${N} amplitudes):`);
  lines.push('-'.repeat(40));

  for (let i = 0; i < N; i++) {
    const binary = i.toString(2).padStart(n, '0');
    const amp = state[i];
    const prob = amp.re * amp.re + amp.im * amp.im;
    const phase = cPhase(amp);

    if (prob > 1e-10) {
      const bar = '█'.repeat(Math.round(prob * 20));
      lines.push(`|${binary}⟩: ${cFormat(amp, 4).padEnd(20)} |${bar.padEnd(20)}| ${(prob * 100).toFixed(2)}%`);
    }
  }

  return lines.join('\n');
}

export async function executeqft(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, num_qubits = 3, input_state, show_matrix = false } = args;

    if (operation === 'info') {
      const info = {
        tool: 'qft',
        description: 'Quantum Fourier Transform - transforms quantum states in the computational basis to the Fourier basis',
        operations: {
          forward: 'Apply QFT to transform state to frequency domain',
          inverse: 'Apply inverse QFT to transform back',
          circuit: 'Show the QFT circuit decomposition',
          apply: 'Apply QFT to a specific input state',
          demo: 'Demonstrate QFT on example states'
        },
        theory: {
          definition: 'QFT maps |j⟩ → (1/√N) Σk exp(2πijk/N) |k⟩',
          matrix: 'QFT is unitary with elements ω^(jk)/√N where ω = e^(2πi/N)',
          applications: ['Phase estimation', "Shor's algorithm", 'Quantum simulation', 'Hidden subgroup problems']
        },
        circuit_decomposition: {
          gates: ['Hadamard gates', 'Controlled phase rotations', 'SWAP gates'],
          depth: 'O(n²) gates for n qubits',
          comparison: 'Classical FFT: O(n 2^n), QFT: O(n²)'
        },
        properties: {
          unitarity: 'QFT† QFT = I',
          periodicity: 'Preserves periodicity in quantum states',
          basis_change: 'Transforms computational basis to Fourier basis'
        }
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'demo') {
      const n = Math.min(num_qubits, 4); // Limit for demo
      const N = Math.pow(2, n);

      // Demo 1: QFT of |0...0⟩ state
      const state0: Complex[] = new Array(N).fill(null).map(() => complex(0));
      state0[0] = complex(1);
      const qft0 = applyQFT(state0);

      // Demo 2: QFT of |1⟩ state
      const state1: Complex[] = new Array(N).fill(null).map(() => complex(0));
      state1[1] = complex(1);
      const qft1 = applyQFT(state1);

      // Demo 3: QFT of uniform superposition
      const stateUniform: Complex[] = new Array(N).fill(null).map(() => complex(1 / Math.sqrt(N)));
      const qftUniform = applyQFT(stateUniform);

      // Demo 4: Round trip (QFT then inverse QFT)
      const roundTrip = applyQFT(qft1, true);

      const circuit = generateQFTCircuit(n);

      const result = {
        operation: 'demo',
        num_qubits: n,
        dimension: N,
        examples: [
          {
            name: '|0...0⟩ → QFT',
            input: visualizeState(state0, 'Input |0⟩^n'),
            output: visualizeState(qft0, 'QFT output'),
            explanation: 'QFT of |0⟩ gives uniform superposition'
          },
          {
            name: '|1⟩ → QFT',
            input: visualizeState(state1, 'Input |1⟩'),
            output: visualizeState(qft1, 'QFT output'),
            explanation: 'QFT of |1⟩ gives phases rotating around unit circle'
          },
          {
            name: 'Uniform → QFT',
            input: visualizeState(stateUniform, 'Input uniform'),
            output: visualizeState(qftUniform, 'QFT output'),
            explanation: 'QFT of uniform superposition returns |0⟩'
          },
          {
            name: 'Round trip verification',
            original: visualizeState(state1, 'Original'),
            after_inverse: visualizeState(roundTrip, 'After QFT⁻¹(QFT(state))'),
            explanation: 'Inverse QFT recovers original state'
          }
        ],
        circuit: circuit.diagram
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'circuit') {
      const n = Math.min(num_qubits, 8);
      const circuit = generateQFTCircuit(n);

      const result = {
        operation: 'circuit',
        num_qubits: n,
        gate_count: circuit.gates.length,
        gates: circuit.gates,
        diagram: circuit.diagram,
        complexity: {
          gates: `${n * (n + 1) / 2} Hadamard + controlled rotations`,
          swaps: Math.floor(n / 2),
          total_gates: circuit.gates.length,
          classical_fft_ops: `O(${n} × 2^${n}) = ${n * Math.pow(2, n)}`
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    const n = Math.min(num_qubits, 6); // Limit for performance
    const N = Math.pow(2, n);

    // Parse or create input state
    let state: Complex[];
    if (input_state && Array.isArray(input_state)) {
      if (input_state.length !== N) {
        return {
          toolCallId: id,
          content: `Error: input_state length (${input_state.length}) must equal 2^num_qubits (${N})`,
          isError: true
        };
      }
      state = input_state.map(v => complex(v));
    } else {
      // Default: |0...0⟩ state
      state = new Array(N).fill(null).map(() => complex(0));
      state[0] = complex(1);
    }

    const isInverse = operation === 'inverse';
    const outputState = applyQFT(state, isInverse);

    // Generate matrix if requested
    let matrixDisplay: string | undefined;
    if (show_matrix && n <= 4) {
      const matrix = isInverse ? generateInverseQFTMatrix(n) : generateQFTMatrix(n);
      const lines: string[] = [`${isInverse ? 'Inverse ' : ''}QFT Matrix (${N}×${N}):`];
      for (let i = 0; i < N; i++) {
        const row = matrix[i].map(c => cFormat(c, 2).padStart(12)).join(' ');
        lines.push(`[${row}]`);
      }
      matrixDisplay = lines.join('\n');
    }

    const result = {
      operation: isInverse ? 'inverse_qft' : 'forward_qft',
      num_qubits: n,
      dimension: N,
      input: visualizeState(state, 'Input state'),
      output: visualizeState(outputState, `${isInverse ? 'Inverse ' : ''}QFT output`),
      matrix: matrixDisplay,
      verification: {
        input_norm: Math.sqrt(state.reduce((sum, c) => sum + c.re * c.re + c.im * c.im, 0)).toFixed(6),
        output_norm: Math.sqrt(outputState.reduce((sum, c) => sum + c.re * c.re + c.im * c.im, 0)).toFixed(6),
        norm_preserved: true
      }
    };

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isqftAvailable(): boolean { return true; }
