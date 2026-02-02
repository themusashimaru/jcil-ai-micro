/**
 * QUANTUM-GATE TOOL
 * Quantum gate operations with matrix representations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const quantumgateTool: UnifiedTool = {
  name: 'quantum_gate',
  description: 'Quantum gate operations (Hadamard, CNOT, Pauli, etc.)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['apply', 'compose', 'inverse', 'decompose', 'info'], description: 'Operation' },
      gate: { type: 'string', enum: ['H', 'X', 'Y', 'Z', 'CNOT', 'SWAP', 'T', 'S', 'Toffoli', 'CZ', 'Rx', 'Ry', 'Rz'], description: 'Gate type' },
      angle: { type: 'number', description: 'Rotation angle in radians for Rx, Ry, Rz gates' },
      gates: { type: 'array', items: { type: 'string' }, description: 'List of gates to compose' },
      input_state: { type: 'array', items: { type: 'number' }, description: 'Input state vector [real, imag, real, imag, ...]' }
    },
    required: ['operation']
  }
};

// Complex number type
interface Complex {
  re: number;
  im: number;
}

// Complex matrix type
type ComplexMatrix = Complex[][];

// Complex arithmetic
function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cConj(a: Complex): Complex {
  return { re: a.re, im: -a.im };
}

function cScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

function cAbs2(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

// Matrix operations
function matMul(A: ComplexMatrix, B: ComplexMatrix): ComplexMatrix {
  const m = A.length;
  const n = B[0].length;
  const p = B.length;
  const result: ComplexMatrix = Array(m).fill(null).map(() =>
    Array(n).fill(null).map(() => ({ re: 0, im: 0 }))
  );

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < p; k++) {
        result[i][j] = cAdd(result[i][j], cMul(A[i][k], B[k][j]));
      }
    }
  }

  return result;
}

function matDagger(A: ComplexMatrix): ComplexMatrix {
  const m = A.length;
  const n = A[0].length;
  const result: ComplexMatrix = Array(n).fill(null).map(() =>
    Array(m).fill(null).map(() => ({ re: 0, im: 0 }))
  );

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      result[j][i] = cConj(A[i][j]);
    }
  }

  return result;
}

function tensorProduct(A: ComplexMatrix, B: ComplexMatrix): ComplexMatrix {
  const am = A.length, an = A[0].length;
  const bm = B.length, bn = B[0].length;
  const result: ComplexMatrix = Array(am * bm).fill(null).map(() =>
    Array(an * bn).fill(null).map(() => ({ re: 0, im: 0 }))
  );

  for (let i = 0; i < am; i++) {
    for (let j = 0; j < an; j++) {
      for (let k = 0; k < bm; k++) {
        for (let l = 0; l < bn; l++) {
          result[i * bm + k][j * bn + l] = cMul(A[i][j], B[k][l]);
        }
      }
    }
  }

  return result;
}

// Standard quantum gates
const GATES: Record<string, ComplexMatrix> = {
  // Identity gate
  I: [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 1, im: 0 }]
  ],
  // Hadamard gate - creates superposition
  H: [
    [{ re: 1 / Math.sqrt(2), im: 0 }, { re: 1 / Math.sqrt(2), im: 0 }],
    [{ re: 1 / Math.sqrt(2), im: 0 }, { re: -1 / Math.sqrt(2), im: 0 }]
  ],
  // Pauli-X (NOT) gate - bit flip
  X: [
    [{ re: 0, im: 0 }, { re: 1, im: 0 }],
    [{ re: 1, im: 0 }, { re: 0, im: 0 }]
  ],
  // Pauli-Y gate - bit and phase flip
  Y: [
    [{ re: 0, im: 0 }, { re: 0, im: -1 }],
    [{ re: 0, im: 1 }, { re: 0, im: 0 }]
  ],
  // Pauli-Z gate - phase flip
  Z: [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: -1, im: 0 }]
  ],
  // S gate (√Z) - π/2 phase
  S: [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 0, im: 1 }]
  ],
  // T gate (√S) - π/4 phase
  T: [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: Math.cos(Math.PI / 4), im: Math.sin(Math.PI / 4) }]
  ],
  // CNOT gate - controlled NOT
  CNOT: [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }],
    [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 }]
  ],
  // CZ gate - controlled Z
  CZ: [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: -1, im: 0 }]
  ],
  // SWAP gate
  SWAP: [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }, { re: 1, im: 0 }]
  ],
  // Toffoli gate (CCNOT) - 8x8 matrix
  Toffoli: createToffoliGate()
};

function createToffoliGate(): ComplexMatrix {
  const dim = 8;
  const gate: ComplexMatrix = Array(dim).fill(null).map(() =>
    Array(dim).fill(null).map(() => ({ re: 0, im: 0 }))
  );

  // Toffoli: flips target if both controls are 1
  // |000⟩→|000⟩, |001⟩→|001⟩, ..., |110⟩→|111⟩, |111⟩→|110⟩
  for (let i = 0; i < dim; i++) {
    if (i === 6) {
      gate[7][6] = { re: 1, im: 0 };
    } else if (i === 7) {
      gate[6][7] = { re: 1, im: 0 };
    } else {
      gate[i][i] = { re: 1, im: 0 };
    }
  }

  return gate;
}

// Rotation gates
function rotationGate(axis: 'x' | 'y' | 'z', theta: number): ComplexMatrix {
  const cos = Math.cos(theta / 2);
  const sin = Math.sin(theta / 2);

  if (axis === 'x') {
    return [
      [{ re: cos, im: 0 }, { re: 0, im: -sin }],
      [{ re: 0, im: -sin }, { re: cos, im: 0 }]
    ];
  } else if (axis === 'y') {
    return [
      [{ re: cos, im: 0 }, { re: -sin, im: 0 }],
      [{ re: sin, im: 0 }, { re: cos, im: 0 }]
    ];
  } else {
    return [
      [{ re: cos, im: -sin }, { re: 0, im: 0 }],
      [{ re: 0, im: 0 }, { re: cos, im: sin }]
    ];
  }
}

function formatComplex(c: Complex, precision: number = 4): string {
  const re = Math.abs(c.re) < 1e-10 ? 0 : c.re;
  const im = Math.abs(c.im) < 1e-10 ? 0 : c.im;

  if (im === 0) return re.toFixed(precision);
  if (re === 0) return `${im.toFixed(precision)}i`;
  const sign = im >= 0 ? '+' : '-';
  return `${re.toFixed(precision)}${sign}${Math.abs(im).toFixed(precision)}i`;
}

function formatMatrix(m: ComplexMatrix): string[][] {
  return m.map(row => row.map(c => formatComplex(c, 3)));
}

function isUnitary(m: ComplexMatrix): boolean {
  const dagger = matDagger(m);
  const product = matMul(m, dagger);

  // Check if product is identity
  for (let i = 0; i < product.length; i++) {
    for (let j = 0; j < product[0].length; j++) {
      const expected = i === j ? 1 : 0;
      if (Math.abs(product[i][j].re - expected) > 1e-10 || Math.abs(product[i][j].im) > 1e-10) {
        return false;
      }
    }
  }
  return true;
}

export async function executequantumgate(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const gateInfo: Record<string, object> = {};

      for (const [name, matrix] of Object.entries(GATES)) {
        if (matrix.length <= 4) {
          gateInfo[name] = {
            dimension: `${matrix.length}×${matrix[0].length}`,
            matrix: formatMatrix(matrix),
            unitary: isUnitary(matrix)
          };
        } else {
          gateInfo[name] = {
            dimension: `${matrix.length}×${matrix[0].length}`,
            description: 'Matrix too large to display',
            unitary: isUnitary(matrix)
          };
        }
      }

      const info = {
        tool: 'quantum-gate',
        description: 'Quantum gates are unitary operators that transform qubit states',
        availableGates: Object.keys(GATES),
        rotationGates: ['Rx(θ)', 'Ry(θ)', 'Rz(θ)'],
        gateDetails: gateInfo,
        properties: {
          unitarity: 'All quantum gates are unitary: U†U = UU† = I',
          reversibility: 'Gates are reversible: U⁻¹ = U†',
          composition: 'Gates compose by matrix multiplication'
        },
        universalGateSets: [
          'H + T + CNOT (approximately universal)',
          'H + Toffoli (exactly universal)',
          'Any two-qubit entangling gate + arbitrary single-qubit gates'
        ],
        circuitNotation: `
        Quantum Circuit Example (Bell State):

        q0: ─H─●─
              │
        q1: ───X─

        This creates |Φ+⟩ = (|00⟩ + |11⟩)/√2
        `
      };

      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'apply') {
      const gateName = args.gate || 'H';
      const angle = args.angle || Math.PI / 2;

      let gate: ComplexMatrix;
      let gateDisplayName = gateName;

      if (gateName === 'Rx') {
        gate = rotationGate('x', angle);
        gateDisplayName = `Rx(${(angle / Math.PI).toFixed(3)}π)`;
      } else if (gateName === 'Ry') {
        gate = rotationGate('y', angle);
        gateDisplayName = `Ry(${(angle / Math.PI).toFixed(3)}π)`;
      } else if (gateName === 'Rz') {
        gate = rotationGate('z', angle);
        gateDisplayName = `Rz(${(angle / Math.PI).toFixed(3)}π)`;
      } else if (GATES[gateName]) {
        gate = GATES[gateName];
      } else {
        return { toolCallId: id, content: `Unknown gate: ${gateName}`, isError: true };
      }

      // Apply to input state or default |0⟩ state
      let inputState: Complex[];
      if (args.input_state && args.input_state.length >= 2) {
        inputState = [];
        for (let i = 0; i < args.input_state.length; i += 2) {
          inputState.push({ re: args.input_state[i] || 0, im: args.input_state[i + 1] || 0 });
        }
      } else {
        // Default: |0⟩ state for single qubit, |00⟩ for two-qubit gates
        const dim = gate.length;
        inputState = Array(dim).fill(null).map((_, i) => ({ re: i === 0 ? 1 : 0, im: 0 }));
      }

      // Ensure input state matches gate dimension
      while (inputState.length < gate.length) {
        inputState.push({ re: 0, im: 0 });
      }

      // Apply gate: |ψ'⟩ = U|ψ⟩
      const outputState: Complex[] = [];
      for (let i = 0; i < gate.length; i++) {
        let sum: Complex = { re: 0, im: 0 };
        for (let j = 0; j < gate[0].length; j++) {
          sum = cAdd(sum, cMul(gate[i][j], inputState[j]));
        }
        outputState.push(sum);
      }

      const result = {
        operation: 'apply',
        gate: gateDisplayName,
        matrix: formatMatrix(gate),
        inputState: inputState.map((c, i) => ({
          basis: `|${i.toString(2).padStart(Math.log2(gate.length), '0')}⟩`,
          amplitude: formatComplex(c)
        })).filter(s => cAbs2(inputState[parseInt(s.basis.slice(1, -1), 2)]) > 1e-10),
        outputState: outputState.map((c, i) => ({
          basis: `|${i.toString(2).padStart(Math.log2(gate.length), '0')}⟩`,
          amplitude: formatComplex(c),
          probability: (cAbs2(c) * 100).toFixed(2) + '%'
        })).filter(s => cAbs2(outputState[parseInt(s.basis.slice(1, -1), 2)]) > 1e-10),
        unitary: isUnitary(gate)
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'compose') {
      const gateNames = args.gates || ['H', 'T', 'H'];

      let composedGate: ComplexMatrix | null = null;
      const steps: { gate: string; matrix: string[][] }[] = [];

      for (const gateName of gateNames) {
        let gate = GATES[gateName];
        if (!gate) {
          return { toolCallId: id, content: `Unknown gate: ${gateName}`, isError: true };
        }

        steps.push({ gate: gateName, matrix: formatMatrix(gate) });

        if (composedGate === null) {
          composedGate = gate;
        } else {
          // Ensure compatible dimensions
          if (composedGate[0].length !== gate.length) {
            return { toolCallId: id, content: `Incompatible gate dimensions for composition`, isError: true };
          }
          composedGate = matMul(gate, composedGate);
        }
      }

      const result = {
        operation: 'compose',
        gates: gateNames,
        composition: `${gateNames.join(' × ')} (applied right to left)`,
        steps,
        resultMatrix: composedGate ? formatMatrix(composedGate) : null,
        unitary: composedGate ? isUnitary(composedGate) : false,
        note: 'Matrix multiplication order: U₃ × U₂ × U₁ means U₁ applied first, then U₂, then U₃'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'inverse') {
      const gateName = args.gate || 'H';
      const gate = GATES[gateName];

      if (!gate) {
        return { toolCallId: id, content: `Unknown gate: ${gateName}`, isError: true };
      }

      const inverse = matDagger(gate);
      const verification = matMul(gate, inverse);

      const result = {
        operation: 'inverse',
        gate: gateName,
        originalMatrix: formatMatrix(gate),
        inverseMatrix: formatMatrix(inverse),
        verification: {
          description: 'U × U† should equal Identity',
          product: formatMatrix(verification),
          isIdentity: isUnitary(gate)
        },
        property: 'For unitary matrices, U⁻¹ = U† (conjugate transpose)'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'decompose') {
      const gateName = args.gate || 'CNOT';

      const decompositions: Record<string, object> = {
        H: {
          description: 'Hadamard as rotation',
          decomposition: 'H = e^(iπ/2) Rz(π) Ry(π/2) = (X + Z)/√2',
          circuit: 'H = Rz(π/2) × Ry(π/2) × Rz(π/2)'
        },
        X: {
          description: 'Pauli-X as rotation',
          decomposition: 'X = iRx(π) = HZH',
          circuit: '─Z─H─ = ─X─'
        },
        Y: {
          description: 'Pauli-Y as rotation',
          decomposition: 'Y = iRy(π) = SXS†',
          circuit: '─S─X─S†─ = ─Y─'
        },
        Z: {
          description: 'Pauli-Z as rotation',
          decomposition: 'Z = iRz(π) = S²',
          circuit: '─S─S─ = ─Z─'
        },
        CNOT: {
          description: 'CNOT decomposition',
          decomposition: 'CNOT = (I⊗H) × CZ × (I⊗H)',
          circuit: `
          q0: ───●───
               │
          q1: ─H─●─H─
               CZ
          `
        },
        SWAP: {
          description: 'SWAP as three CNOTs',
          decomposition: 'SWAP = CNOT₁₂ × CNOT₂₁ × CNOT₁₂',
          circuit: `
          q0: ─●──X──●─
               │  │  │
          q1: ─X──●──X─
          `
        },
        Toffoli: {
          description: 'Toffoli decomposition',
          decomposition: 'Toffoli = Various decompositions using H, T, T†, and CNOT gates',
          circuit: `
          q0: ─────●─────●────●──T──●─
                   │     │    │     │
          q1: ──●──┼──●──┼────X──T†─X─
                │  │  │  │
          q2: ─H┼T†┼T─┼T†┼T─H─────────
                CNOT  CNOT
          `,
          gateCount: '6 CNOTs + 9 single-qubit gates'
        }
      };

      const decomposition = decompositions[gateName] || {
        description: `No decomposition available for ${gateName}`,
        note: 'Use compose operation to build from basic gates'
      };

      const result = {
        operation: 'decompose',
        gate: gateName,
        ...decomposition,
        universalGateSets: {
          cliffordT: 'H, S, CNOT, T',
          ionTrap: 'MS (Mølmer-Sørensen), single-qubit rotations',
          superconducting: 'CZ, single-qubit rotations'
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

export function isquantumgateAvailable(): boolean { return true; }
