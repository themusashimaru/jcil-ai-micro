/**
 * QUANTUM-GATE TOOL
 * Quantum gate operations - The building blocks of quantum circuits
 *
 * Complete implementation of quantum gate operations:
 * - Single-qubit gates (Pauli, Hadamard, Phase, T, rotations)
 * - Multi-qubit gates (CNOT, SWAP, Toffoli, Fredkin)
 * - Gate composition and decomposition
 * - Gate matrices and properties
 * - Universal gate sets
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

function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re
  };
}

function cConj(a: Complex): Complex {
  return { re: a.re, im: -a.im };
}

function cAbs(a: Complex): number {
  return Math.sqrt(a.re * a.re + a.im * a.im);
}

function cScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

function cFromPolar(r: number, theta: number): Complex {
  return { re: r * Math.cos(theta), im: r * Math.sin(theta) };
}

function cExp(a: Complex): Complex {
  const r = Math.exp(a.re);
  return { re: r * Math.cos(a.im), im: r * Math.sin(a.im) };
}

function formatComplex(c: Complex): string {
  if (Math.abs(c.im) < 1e-10) return c.re.toFixed(4);
  if (Math.abs(c.re) < 1e-10) return `${c.im.toFixed(4)}i`;
  return `${c.re.toFixed(4)}${c.im >= 0 ? '+' : ''}${c.im.toFixed(4)}i`;
}

// ============================================================================
// MATRIX OPERATIONS
// ============================================================================

type Matrix = Complex[][];

function matMul(A: Matrix, B: Matrix): Matrix {
  const m = A.length;
  const n = B[0].length;
  const k = B.length;
  const C: Matrix = Array(m).fill(null).map(() => Array(n).fill(null).map(() => complex(0)));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      for (let l = 0; l < k; l++) {
        C[i][j] = cAdd(C[i][j], cMul(A[i][l], B[l][j]));
      }
    }
  }

  return C;
}

function matDagger(A: Matrix): Matrix {
  const m = A.length;
  const n = A[0].length;
  const B: Matrix = Array(n).fill(null).map(() => Array(m).fill(null).map(() => complex(0)));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      B[j][i] = cConj(A[i][j]);
    }
  }

  return B;
}

function matIdentity(n: number): Matrix {
  const I: Matrix = Array(n).fill(null).map(() => Array(n).fill(null).map(() => complex(0)));
  for (let i = 0; i < n; i++) I[i][i] = complex(1);
  return I;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function tensorProduct(A: Matrix, B: Matrix): Matrix {
  const m1 = A.length, n1 = A[0].length;
  const m2 = B.length, n2 = B[0].length;
  const C: Matrix = Array(m1 * m2).fill(null).map(() => Array(n1 * n2).fill(null).map(() => complex(0)));

  for (let i1 = 0; i1 < m1; i1++) {
    for (let j1 = 0; j1 < n1; j1++) {
      for (let i2 = 0; i2 < m2; i2++) {
        for (let j2 = 0; j2 < n2; j2++) {
          C[i1 * m2 + i2][j1 * n2 + j2] = cMul(A[i1][j1], B[i2][j2]);
        }
      }
    }
  }

  return C;
}

function isUnitary(A: Matrix, tolerance: number = 1e-10): boolean {
  const n = A.length;
  const AH = matDagger(A);
  const product = matMul(A, AH);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const expected = i === j ? 1 : 0;
      if (Math.abs(product[i][j].re - expected) > tolerance || Math.abs(product[i][j].im) > tolerance) {
        return false;
      }
    }
  }

  return true;
}

function matrixTrace(A: Matrix): Complex {
  let trace = complex(0);
  for (let i = 0; i < Math.min(A.length, A[0]?.length || 0); i++) {
    trace = cAdd(trace, A[i][i]);
  }
  return trace;
}

function matrixDeterminant2x2(A: Matrix): Complex {
  if (A.length !== 2 || A[0].length !== 2) return complex(NaN);
  return cAdd(cMul(A[0][0], A[1][1]), cScale(cMul(A[0][1], A[1][0]), -1));
}

function formatMatrix(A: Matrix): string[][] {
  return A.map(row => row.map(formatComplex));
}

// ============================================================================
// QUANTUM GATES DEFINITIONS
// ============================================================================

interface GateDefinition {
  name: string;
  symbol: string;
  matrix: Matrix;
  qubits: number;
  description: string;
  properties: string[];
}

// Single-qubit gates
const GATES: Record<string, GateDefinition> = {
  // Pauli gates
  'I': {
    name: 'Identity',
    symbol: 'I',
    matrix: [[complex(1), complex(0)], [complex(0), complex(1)]],
    qubits: 1,
    description: 'Identity gate - leaves state unchanged',
    properties: ['Hermitian', 'Unitary', 'Self-inverse']
  },
  'X': {
    name: 'Pauli-X (NOT)',
    symbol: 'X',
    matrix: [[complex(0), complex(1)], [complex(1), complex(0)]],
    qubits: 1,
    description: 'Bit flip gate - |0⟩↔|1⟩',
    properties: ['Hermitian', 'Unitary', 'Self-inverse']
  },
  'Y': {
    name: 'Pauli-Y',
    symbol: 'Y',
    matrix: [[complex(0), complex(0, -1)], [complex(0, 1), complex(0)]],
    qubits: 1,
    description: 'Combined bit and phase flip',
    properties: ['Hermitian', 'Unitary', 'Self-inverse']
  },
  'Z': {
    name: 'Pauli-Z',
    symbol: 'Z',
    matrix: [[complex(1), complex(0)], [complex(0), complex(-1)]],
    qubits: 1,
    description: 'Phase flip gate - |1⟩→-|1⟩',
    properties: ['Hermitian', 'Unitary', 'Self-inverse']
  },
  // Hadamard
  'H': {
    name: 'Hadamard',
    symbol: 'H',
    matrix: [
      [complex(1 / Math.sqrt(2)), complex(1 / Math.sqrt(2))],
      [complex(1 / Math.sqrt(2)), complex(-1 / Math.sqrt(2))]
    ],
    qubits: 1,
    description: 'Creates superposition: |0⟩→|+⟩, |1⟩→|-⟩',
    properties: ['Hermitian', 'Unitary', 'Self-inverse']
  },
  // Phase gates
  'S': {
    name: 'Phase (√Z)',
    symbol: 'S',
    matrix: [[complex(1), complex(0)], [complex(0), complex(0, 1)]],
    qubits: 1,
    description: 'π/2 phase gate - S² = Z',
    properties: ['Unitary', 'S† = S⁻¹']
  },
  'T': {
    name: 'π/8 gate (√S)',
    symbol: 'T',
    matrix: [[complex(1), complex(0)], [complex(0), cFromPolar(1, Math.PI / 4)]],
    qubits: 1,
    description: 'π/4 phase gate - T² = S',
    properties: ['Unitary', 'T† = T⁻¹']
  },
  'Sdg': {
    name: 'S-dagger',
    symbol: 'S†',
    matrix: [[complex(1), complex(0)], [complex(0), complex(0, -1)]],
    qubits: 1,
    description: 'Inverse of S gate',
    properties: ['Unitary']
  },
  'Tdg': {
    name: 'T-dagger',
    symbol: 'T†',
    matrix: [[complex(1), complex(0)], [complex(0), cFromPolar(1, -Math.PI / 4)]],
    qubits: 1,
    description: 'Inverse of T gate',
    properties: ['Unitary']
  },
  // Two-qubit gates
  'CNOT': {
    name: 'Controlled-NOT',
    symbol: 'CNOT',
    matrix: [
      [complex(1), complex(0), complex(0), complex(0)],
      [complex(0), complex(1), complex(0), complex(0)],
      [complex(0), complex(0), complex(0), complex(1)],
      [complex(0), complex(0), complex(1), complex(0)]
    ],
    qubits: 2,
    description: 'Flips target qubit if control is |1⟩',
    properties: ['Hermitian', 'Unitary', 'Self-inverse', 'Entangling']
  },
  'CZ': {
    name: 'Controlled-Z',
    symbol: 'CZ',
    matrix: [
      [complex(1), complex(0), complex(0), complex(0)],
      [complex(0), complex(1), complex(0), complex(0)],
      [complex(0), complex(0), complex(1), complex(0)],
      [complex(0), complex(0), complex(0), complex(-1)]
    ],
    qubits: 2,
    description: 'Applies Z to target if control is |1⟩',
    properties: ['Hermitian', 'Unitary', 'Self-inverse', 'Symmetric']
  },
  'SWAP': {
    name: 'SWAP',
    symbol: 'SWAP',
    matrix: [
      [complex(1), complex(0), complex(0), complex(0)],
      [complex(0), complex(0), complex(1), complex(0)],
      [complex(0), complex(1), complex(0), complex(0)],
      [complex(0), complex(0), complex(0), complex(1)]
    ],
    qubits: 2,
    description: 'Swaps two qubits',
    properties: ['Hermitian', 'Unitary', 'Self-inverse']
  },
  'iSWAP': {
    name: 'iSWAP',
    symbol: 'iSWAP',
    matrix: [
      [complex(1), complex(0), complex(0), complex(0)],
      [complex(0), complex(0), complex(0, 1), complex(0)],
      [complex(0), complex(0, 1), complex(0), complex(0)],
      [complex(0), complex(0), complex(0), complex(1)]
    ],
    qubits: 2,
    description: 'SWAP with phase factor i',
    properties: ['Unitary', 'Entangling']
  },
  // Three-qubit gates
  'Toffoli': {
    name: 'Toffoli (CCNOT)',
    symbol: 'CCX',
    matrix: createToffoliMatrix(),
    qubits: 3,
    description: 'Controlled-controlled-NOT (AND gate)',
    properties: ['Hermitian', 'Unitary', 'Self-inverse', 'Universal for classical']
  },
  'Fredkin': {
    name: 'Fredkin (CSWAP)',
    symbol: 'CSWAP',
    matrix: createFredkinMatrix(),
    qubits: 3,
    description: 'Controlled-SWAP',
    properties: ['Hermitian', 'Unitary', 'Self-inverse']
  }
};

function createToffoliMatrix(): Matrix {
  const n = 8;
  const M: Matrix = Array(n).fill(null).map(() => Array(n).fill(null).map(() => complex(0)));
  for (let i = 0; i < n; i++) M[i][i] = complex(1);
  // Swap |110⟩ and |111⟩
  M[6][6] = complex(0);
  M[7][7] = complex(0);
  M[6][7] = complex(1);
  M[7][6] = complex(1);
  return M;
}

function createFredkinMatrix(): Matrix {
  const n = 8;
  const M: Matrix = Array(n).fill(null).map(() => Array(n).fill(null).map(() => complex(0)));
  for (let i = 0; i < n; i++) M[i][i] = complex(1);
  // Swap |101⟩ and |110⟩
  M[5][5] = complex(0);
  M[6][6] = complex(0);
  M[5][6] = complex(1);
  M[6][5] = complex(1);
  return M;
}

// Parametric gates
function rotationX(theta: number): GateDefinition {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return {
    name: `Rx(${(theta * 180 / Math.PI).toFixed(1)}°)`,
    symbol: 'Rx',
    matrix: [[complex(c), complex(0, -s)], [complex(0, -s), complex(c)]],
    qubits: 1,
    description: `Rotation around X-axis by ${(theta * 180 / Math.PI).toFixed(1)}°`,
    properties: ['Unitary', 'Rx(θ)† = Rx(-θ)']
  };
}

function rotationY(theta: number): GateDefinition {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return {
    name: `Ry(${(theta * 180 / Math.PI).toFixed(1)}°)`,
    symbol: 'Ry',
    matrix: [[complex(c), complex(-s)], [complex(s), complex(c)]],
    qubits: 1,
    description: `Rotation around Y-axis by ${(theta * 180 / Math.PI).toFixed(1)}°`,
    properties: ['Unitary', 'Ry(θ)† = Ry(-θ)']
  };
}

function rotationZ(theta: number): GateDefinition {
  return {
    name: `Rz(${(theta * 180 / Math.PI).toFixed(1)}°)`,
    symbol: 'Rz',
    matrix: [[cExp(complex(0, -theta / 2)), complex(0)], [complex(0), cExp(complex(0, theta / 2))]],
    qubits: 1,
    description: `Rotation around Z-axis by ${(theta * 180 / Math.PI).toFixed(1)}°`,
    properties: ['Unitary', 'Diagonal', 'Rz(θ)† = Rz(-θ)']
  };
}

function phaseGate(phi: number): GateDefinition {
  return {
    name: `P(${(phi * 180 / Math.PI).toFixed(1)}°)`,
    symbol: 'P',
    matrix: [[complex(1), complex(0)], [complex(0), cFromPolar(1, phi)]],
    qubits: 1,
    description: `Phase gate with angle ${(phi * 180 / Math.PI).toFixed(1)}°`,
    properties: ['Unitary', 'Diagonal']
  };
}

function controlledPhase(phi: number): GateDefinition {
  return {
    name: `CP(${(phi * 180 / Math.PI).toFixed(1)}°)`,
    symbol: 'CP',
    matrix: [
      [complex(1), complex(0), complex(0), complex(0)],
      [complex(0), complex(1), complex(0), complex(0)],
      [complex(0), complex(0), complex(1), complex(0)],
      [complex(0), complex(0), complex(0), cFromPolar(1, phi)]
    ],
    qubits: 2,
    description: `Controlled phase rotation by ${(phi * 180 / Math.PI).toFixed(1)}°`,
    properties: ['Unitary', 'Diagonal', 'Symmetric']
  };
}

// ============================================================================
// GATE OPERATIONS
// ============================================================================

function composeGates(gates: GateDefinition[]): Matrix {
  if (gates.length === 0) return matIdentity(2);
  let result = gates[0].matrix;
  for (let i = 1; i < gates.length; i++) {
    result = matMul(gates[i].matrix, result); // Right-to-left composition
  }
  return result;
}

function gateInverse(gate: GateDefinition): GateDefinition {
  return {
    name: `${gate.name}†`,
    symbol: `${gate.symbol}†`,
    matrix: matDagger(gate.matrix),
    qubits: gate.qubits,
    description: `Inverse of ${gate.name}`,
    properties: ['Unitary']
  };
}

function controlGate(gate: GateDefinition): GateDefinition {
  if (gate.qubits !== 1) {
    throw new Error('Can only create controlled version of single-qubit gates');
  }

  const n = 4; // 2^2
  const C: Matrix = Array(n).fill(null).map(() => Array(n).fill(null).map(() => complex(0)));

  // Identity on |0x⟩ states
  C[0][0] = complex(1);
  C[1][1] = complex(1);

  // Apply gate on |1x⟩ states
  C[2][2] = gate.matrix[0][0];
  C[2][3] = gate.matrix[0][1];
  C[3][2] = gate.matrix[1][0];
  C[3][3] = gate.matrix[1][1];

  return {
    name: `Controlled-${gate.name}`,
    symbol: `C${gate.symbol}`,
    matrix: C,
    qubits: 2,
    description: `Controlled version of ${gate.name}`,
    properties: ['Unitary']
  };
}

// ============================================================================
// GATE DECOMPOSITION
// ============================================================================

interface DecompositionResult {
  original: string;
  decomposition: Array<{ gate: string; params?: Record<string, number> }>;
  depth: number;
  gateCount: number;
}

function decomposeToUniversalSet(gateName: string): DecompositionResult {
  // Universal set: {H, T, CNOT}
  const decompositions: Record<string, Array<{ gate: string; params?: Record<string, number> }>> = {
    'X': [{ gate: 'H' }, { gate: 'Z' }, { gate: 'H' }],
    'Y': [{ gate: 'S' }, { gate: 'X' }, { gate: 'Sdg' }],
    'Z': [{ gate: 'S' }, { gate: 'S' }],
    'S': [{ gate: 'T' }, { gate: 'T' }],
    'Sdg': [{ gate: 'Tdg' }, { gate: 'Tdg' }],
    'SWAP': [{ gate: 'CNOT' }, { gate: 'CNOT', params: { swap_control_target: 1 } }, { gate: 'CNOT' }],
    'CZ': [{ gate: 'H', params: { target: 1 } }, { gate: 'CNOT' }, { gate: 'H', params: { target: 1 } }],
    'iSWAP': [
      { gate: 'S', params: { target: 0 } },
      { gate: 'S', params: { target: 1 } },
      { gate: 'H', params: { target: 0 } },
      { gate: 'CNOT' },
      { gate: 'CNOT', params: { swap_control_target: 1 } },
      { gate: 'H', params: { target: 1 } }
    ]
  };

  const decomp = decompositions[gateName] || [{ gate: gateName }];

  return {
    original: gateName,
    decomposition: decomp,
    depth: decomp.length,
    gateCount: decomp.length
  };
}

function zyzDecomposition(U: Matrix): { theta: number; phi: number; lambda: number; globalPhase: number } {
  // Decompose arbitrary single-qubit gate as Rz(φ)Ry(θ)Rz(λ) up to global phase
  // U = e^(iα) Rz(φ)Ry(θ)Rz(λ)

  const a = U[0][0];
  const b = U[0][1];
  const c = U[1][0];
  const d = U[1][1];

  // Extract parameters
  const theta = 2 * Math.acos(Math.min(1, cAbs(a)));
  const phiPlusLambda = Math.atan2(d.im, d.re) - Math.atan2(a.im, a.re);
  const phiMinusLambda = Math.atan2(c.im, c.re) - Math.atan2(-b.im, -b.re);

  const phi = (phiPlusLambda + phiMinusLambda) / 2;
  const lambda = (phiPlusLambda - phiMinusLambda) / 2;

  // Global phase
  const globalPhase = Math.atan2(a.im, a.re) + (phi + lambda) / 2;

  return { theta, phi, lambda, globalPhase };
}

// ============================================================================
// TOOL DEFINITION AND EXECUTION
// ============================================================================

export const quantumgateTool: UnifiedTool = {
  name: 'quantum_gate',
  description: 'Quantum gate operations (Hadamard, CNOT, Pauli, etc.)',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['apply', 'compose', 'inverse', 'matrix', 'decompose', 'controlled', 'info'],
        description: 'Operation to perform'
      },
      gate: {
        type: 'string',
        enum: ['I', 'H', 'X', 'Y', 'Z', 'S', 'T', 'Sdg', 'Tdg', 'CNOT', 'CZ', 'SWAP', 'iSWAP', 'Toffoli', 'Fredkin', 'Rx', 'Ry', 'Rz', 'P', 'CP'],
        description: 'Gate type'
      },
      gates: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of gates to compose'
      },
      angle: { type: 'number', description: 'Rotation angle in radians (for Rx, Ry, Rz, P, CP)' },
      show_matrix: { type: 'boolean', description: 'Include full matrix in output' }
    },
    required: ['operation']
  }
};

export async function executequantumgate(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'quantum_gate',
            description: 'Quantum gate definitions, composition, and decomposition',
            operations: {
              matrix: 'Get gate matrix and properties',
              compose: 'Multiply gates together',
              inverse: 'Get gate inverse (adjoint)',
              decompose: 'Decompose to universal gate set',
              controlled: 'Create controlled version of gate'
            },
            availableGates: {
              pauli: ['I', 'X', 'Y', 'Z'],
              clifford: ['H', 'S', 'Sdg'],
              nonClifford: ['T', 'Tdg'],
              parametric: ['Rx(θ)', 'Ry(θ)', 'Rz(θ)', 'P(φ)'],
              twoQubit: ['CNOT', 'CZ', 'SWAP', 'iSWAP', 'CP(φ)'],
              threeQubit: ['Toffoli (CCX)', 'Fredkin (CSWAP)']
            },
            universalSets: {
              discrete: '{H, T, CNOT} - universal for approximate synthesis',
              continuous: '{Rx, Ry, CNOT} - universal for exact synthesis',
              cliffordT: '{H, S, CNOT, T} - fault-tolerant universal'
            }
          }, null, 2)
        };
      }

      case 'matrix': {
        const gateName = args.gate || 'H';
        const angle = args.angle || Math.PI;
        const showMatrix = args.show_matrix !== false;

        let gateDef: GateDefinition;

        switch (gateName.toUpperCase()) {
          case 'RX':
            gateDef = rotationX(angle);
            break;
          case 'RY':
            gateDef = rotationY(angle);
            break;
          case 'RZ':
            gateDef = rotationZ(angle);
            break;
          case 'P':
            gateDef = phaseGate(angle);
            break;
          case 'CP':
            gateDef = controlledPhase(angle);
            break;
          default:
            gateDef = GATES[gateName.toUpperCase()];
        }

        if (!gateDef) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `Unknown gate: ${gateName}`,
              availableGates: Object.keys(GATES)
            }),
            isError: true
          };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: Record<string, any> = {
          operation: 'matrix',
          gate: {
            name: gateDef.name,
            symbol: gateDef.symbol,
            qubits: gateDef.qubits,
            description: gateDef.description,
            properties: gateDef.properties
          }
        };

        if (showMatrix) {
          result.matrix = formatMatrix(gateDef.matrix);
          result.matrixProperties = {
            isUnitary: isUnitary(gateDef.matrix),
            isHermitian: gateDef.properties.includes('Hermitian'),
            trace: formatComplex(matrixTrace(gateDef.matrix)),
            dimension: `${gateDef.matrix.length}×${gateDef.matrix[0].length}`
          };

          if (gateDef.qubits === 1) {
            result.matrixProperties.determinant = formatComplex(matrixDeterminant2x2(gateDef.matrix));
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify(result, null, 2)
        };
      }

      case 'compose': {
        const gateNames = args.gates || ['H', 'X'];
        const showMatrix = args.show_matrix !== false;

        const gateDefs: GateDefinition[] = [];
        for (const name of gateNames) {
          const gate = GATES[name.toUpperCase()];
          if (!gate) {
            return {
              toolCallId: id,
              content: JSON.stringify({
                error: `Unknown gate: ${name}`,
                availableGates: Object.keys(GATES)
              }),
              isError: true
            };
          }
          if (gate.qubits !== gateDefs[0]?.qubits && gateDefs.length > 0) {
            // For simplicity, only compose same-size gates
            if (gate.qubits !== 1 || (gateDefs[0] && gateDefs[0].qubits !== 1)) {
              return {
                toolCallId: id,
                content: JSON.stringify({
                  error: 'Can only compose gates of the same size',
                  hint: 'Use tensor product for different-sized gates'
                }),
                isError: true
              };
            }
          }
          gateDefs.push(gate);
        }

        const composed = composeGates(gateDefs);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: Record<string, any> = {
          operation: 'compose',
          gates: gateNames,
          compositionOrder: 'Right-to-left (matrix multiplication)',
          interpretation: `Apply ${gateNames[gateNames.length - 1]} first, then ${gateNames.slice(0, -1).reverse().join(', ')}`
        };

        if (showMatrix) {
          result.resultMatrix = formatMatrix(composed);
          result.properties = {
            isUnitary: isUnitary(composed),
            trace: formatComplex(matrixTrace(composed))
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify(result, null, 2)
        };
      }

      case 'inverse': {
        const gateName = args.gate || 'H';
        const angle = args.angle || Math.PI;
        const showMatrix = args.show_matrix !== false;

        let gateDef: GateDefinition;

        switch (gateName.toUpperCase()) {
          case 'RX':
            gateDef = rotationX(angle);
            break;
          case 'RY':
            gateDef = rotationY(angle);
            break;
          case 'RZ':
            gateDef = rotationZ(angle);
            break;
          case 'P':
            gateDef = phaseGate(angle);
            break;
          default:
            gateDef = GATES[gateName.toUpperCase()];
        }

        if (!gateDef) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: `Unknown gate: ${gateName}` }),
            isError: true
          };
        }

        const inverse = gateInverse(gateDef);
        const isSelfInverse = gateDef.properties.includes('Self-inverse');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: Record<string, any> = {
          operation: 'inverse',
          originalGate: gateDef.name,
          inverseGate: inverse.name,
          isSelfInverse,
          note: isSelfInverse ? 'Gate is its own inverse (Hermitian)' : 'Inverse is the adjoint (conjugate transpose)'
        };

        if (showMatrix) {
          result.originalMatrix = formatMatrix(gateDef.matrix);
          result.inverseMatrix = formatMatrix(inverse.matrix);
        }

        // For parametric gates, show the inverse formula
        if (['RX', 'RY', 'RZ', 'P'].includes(gateName.toUpperCase())) {
          result.inverseFormula = `${gateName}(-θ) where θ = ${(angle * 180 / Math.PI).toFixed(1)}°`;
        }

        return {
          toolCallId: id,
          content: JSON.stringify(result, null, 2)
        };
      }

      case 'decompose': {
        const gateName = args.gate || 'X';
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _showMatrix = args.show_matrix !== false;

        const gateDef = GATES[gateName.toUpperCase()];
        if (!gateDef && !['RX', 'RY', 'RZ', 'P'].includes(gateName.toUpperCase())) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: `Unknown gate: ${gateName}` }),
            isError: true
          };
        }

        const decomposition = decomposeToUniversalSet(gateName.toUpperCase());

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: Record<string, any> = {
          operation: 'decompose',
          ...decomposition,
          universalSet: '{H, T, CNOT}',
          note: 'Decomposition to universal gate set for fault-tolerant quantum computing'
        };

        // ZYZ decomposition for single-qubit gates
        if (gateDef && gateDef.qubits === 1) {
          const zyz = zyzDecomposition(gateDef.matrix);
          result.zyzDecomposition = {
            formula: 'U = e^(iα) Rz(φ)Ry(θ)Rz(λ)',
            theta: `${(zyz.theta * 180 / Math.PI).toFixed(2)}°`,
            phi: `${(zyz.phi * 180 / Math.PI).toFixed(2)}°`,
            lambda: `${(zyz.lambda * 180 / Math.PI).toFixed(2)}°`,
            globalPhase: `${(zyz.globalPhase * 180 / Math.PI).toFixed(2)}°`
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify(result, null, 2)
        };
      }

      case 'controlled': {
        const gateName = args.gate || 'X';
        const showMatrix = args.show_matrix !== false;

        let gateDef: GateDefinition;
        switch (gateName.toUpperCase()) {
          case 'RZ':
            gateDef = rotationZ(args.angle || Math.PI);
            break;
          case 'P':
            gateDef = phaseGate(args.angle || Math.PI);
            break;
          default:
            gateDef = GATES[gateName.toUpperCase()];
        }

        if (!gateDef) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: `Unknown gate: ${gateName}` }),
            isError: true
          };
        }

        if (gateDef.qubits !== 1) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'Can only create controlled version of single-qubit gates',
              hint: 'Multi-controlled gates require different construction'
            }),
            isError: true
          };
        }

        const controlled = controlGate(gateDef);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: Record<string, any> = {
          operation: 'controlled',
          originalGate: gateDef.name,
          controlledGate: controlled.name,
          qubits: controlled.qubits,
          description: controlled.description
        };

        if (showMatrix) {
          result.controlledMatrix = formatMatrix(controlled.matrix);
        }

        // Known equivalences
        const equivalences: Record<string, string> = {
          'X': 'CNOT',
          'Z': 'CZ',
          'P': 'CP'
        };

        if (equivalences[gateName.toUpperCase()]) {
          result.knownAs = equivalences[gateName.toUpperCase()];
        }

        return {
          toolCallId: id,
          content: JSON.stringify(result, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            availableOperations: ['matrix', 'compose', 'inverse', 'decompose', 'controlled', 'info']
          }),
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error in quantum gate tool: ${err}`,
      isError: true
    };
  }
}

export function isquantumgateAvailable(): boolean {
  return true;
}
