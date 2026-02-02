/**
 * QUANTUM-ERROR-CORRECTION TOOL
 * Comprehensive quantum error correction codes implementation
 * Supports Repetition, Shor (9-qubit), Steane (7-qubit), and Surface codes
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// COMPLEX NUMBER OPERATIONS
// =============================================================================

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

function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re
  };
}

function cScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

function cMag(a: Complex): number {
  return Math.sqrt(a.re * a.re + a.im * a.im);
}

function cConj(a: Complex): Complex {
  return { re: a.re, im: -a.im };
}

// =============================================================================
// QUANTUM STATE OPERATIONS
// =============================================================================

type StateVector = Complex[];

function createZeroState(numQubits: number): StateVector {
  const size = 1 << numQubits;
  const state: StateVector = new Array(size).fill(null).map(() => complex(0));
  state[0] = complex(1);
  return state;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createBasisState(numQubits: number, basisIndex: number): StateVector {
  const size = 1 << numQubits;
  const state: StateVector = new Array(size).fill(null).map(() => complex(0));
  state[basisIndex] = complex(1);
  return state;
}

function copyState(state: StateVector): StateVector {
  return state.map(c => ({ ...c }));
}

function normalizeState(state: StateVector): StateVector {
  const norm = Math.sqrt(state.reduce((sum, c) => sum + c.re * c.re + c.im * c.im, 0));
  if (norm < 1e-10) return state;
  return state.map(c => cScale(c, 1 / norm));
}

// =============================================================================
// QUANTUM GATES
// =============================================================================

// Single qubit gates
function applyX(state: StateVector, qubit: number, numQubits: number): StateVector {
  const newState = copyState(state);
  const size = 1 << numQubits;
  const mask = 1 << (numQubits - 1 - qubit);

  for (let i = 0; i < size; i++) {
    if ((i & mask) === 0) {
      const j = i | mask;
      const temp = newState[i];
      newState[i] = newState[j];
      newState[j] = temp;
    }
  }
  return newState;
}

function applyZ(state: StateVector, qubit: number, numQubits: number): StateVector {
  const newState = copyState(state);
  const size = 1 << numQubits;
  const mask = 1 << (numQubits - 1 - qubit);

  for (let i = 0; i < size; i++) {
    if ((i & mask) !== 0) {
      newState[i] = cScale(newState[i], -1);
    }
  }
  return newState;
}

function applyY(state: StateVector, qubit: number, numQubits: number): StateVector {
  const newState = copyState(state);
  const size = 1 << numQubits;
  const mask = 1 << (numQubits - 1 - qubit);

  for (let i = 0; i < size; i++) {
    if ((i & mask) === 0) {
      const j = i | mask;
      // Y = i * |1><0| - i * |0><1|
      const temp = newState[i];
      newState[i] = cMul(newState[j], complex(0, -1));
      newState[j] = cMul(temp, complex(0, 1));
    }
  }
  return newState;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function applyH(state: StateVector, qubit: number, numQubits: number): StateVector {
  const newState = copyState(state);
  const size = 1 << numQubits;
  const mask = 1 << (numQubits - 1 - qubit);
  const factor = 1 / Math.sqrt(2);

  for (let i = 0; i < size; i++) {
    if ((i & mask) === 0) {
      const j = i | mask;
      const a = newState[i];
      const b = newState[j];
      newState[i] = cScale(cAdd(a, b), factor);
      newState[j] = cScale(cSub(a, b), factor);
    }
  }
  return newState;
}

// Two qubit gates
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function applyCNOT(state: StateVector, control: number, target: number, numQubits: number): StateVector {
  const newState = copyState(state);
  const size = 1 << numQubits;
  const controlMask = 1 << (numQubits - 1 - control);
  const targetMask = 1 << (numQubits - 1 - target);

  for (let i = 0; i < size; i++) {
    if ((i & controlMask) !== 0 && (i & targetMask) === 0) {
      const j = i | targetMask;
      const temp = newState[i];
      newState[i] = newState[j];
      newState[j] = temp;
    }
  }
  return newState;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function applyCZ(state: StateVector, qubit1: number, qubit2: number, numQubits: number): StateVector {
  const newState = copyState(state);
  const size = 1 << numQubits;
  const mask1 = 1 << (numQubits - 1 - qubit1);
  const mask2 = 1 << (numQubits - 1 - qubit2);

  for (let i = 0; i < size; i++) {
    if ((i & mask1) !== 0 && (i & mask2) !== 0) {
      newState[i] = cScale(newState[i], -1);
    }
  }
  return newState;
}

// Toffoli (CCX) gate
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function applyToffoli(state: StateVector, c1: number, c2: number, target: number, numQubits: number): StateVector {
  const newState = copyState(state);
  const size = 1 << numQubits;
  const c1Mask = 1 << (numQubits - 1 - c1);
  const c2Mask = 1 << (numQubits - 1 - c2);
  const tMask = 1 << (numQubits - 1 - target);

  for (let i = 0; i < size; i++) {
    if ((i & c1Mask) !== 0 && (i & c2Mask) !== 0 && (i & tMask) === 0) {
      const j = i | tMask;
      const temp = newState[i];
      newState[i] = newState[j];
      newState[j] = temp;
    }
  }
  return newState;
}

// =============================================================================
// ERROR INJECTION FOR TESTING
// =============================================================================

type ErrorType = 'bit_flip' | 'phase_flip' | 'bit_phase_flip' | 'none';

function injectError(state: StateVector, qubit: number, numQubits: number, errorType: ErrorType): StateVector {
  switch (errorType) {
    case 'bit_flip':
      return applyX(state, qubit, numQubits);
    case 'phase_flip':
      return applyZ(state, qubit, numQubits);
    case 'bit_phase_flip':
      return applyY(state, qubit, numQubits);
    case 'none':
    default:
      return state;
  }
}

// =============================================================================
// REPETITION CODE (3-bit majority voting)
// =============================================================================

interface RepetitionCodeResult {
  code: 'repetition';
  physicalQubits: number;
  logicalQubits: number;
  operation: string;
  syndrome?: number[];
  errorDetected?: boolean;
  errorLocation?: number | null;
  correctionApplied?: boolean;
  encodedState?: string;
  decodedState?: string;
  fidelity?: number;
}

function encodeRepetition(logicalState: StateVector): { state: StateVector; numQubits: number } {
  // |0⟩ → |000⟩, |1⟩ → |111⟩
  // Input is 1 qubit, output is 3 qubits
  const numQubits = 3;
  const state = createZeroState(numQubits);

  // Apply encoding based on logical state
  // Assumes logicalState is a superposition of |0⟩ and |1⟩
  const alpha = logicalState[0]; // coefficient of |0⟩
  const beta = logicalState[1];  // coefficient of |1⟩

  // Encoded state: alpha|000⟩ + beta|111⟩
  state[0b000] = alpha; // |000⟩
  state[0b111] = beta;  // |111⟩

  return { state, numQubits };
}

function measureRepetitionSyndrome(state: StateVector): { syndrome: number[]; errorLocation: number | null } {
  // Measure Z₀Z₁ and Z₁Z₂ stabilizers
  // For |000⟩ + |111⟩ basis, syndromes tell us which qubit flipped

  // Calculate probabilities for each basis state
  const probs = state.map(c => c.re * c.re + c.im * c.im);

  // Find dominant basis state (for syndrome calculation)
  let maxProb = 0;
  let dominantBasis = 0;
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > maxProb) {
      maxProb = probs[i];
      dominantBasis = i;
    }
  }

  // Check for errors - valid codewords are 000 and 111
  const q0 = (dominantBasis >> 2) & 1;
  const q1 = (dominantBasis >> 1) & 1;
  const q2 = dominantBasis & 1;

  // Z₀Z₁ syndrome: 1 if q0 ≠ q1
  const s1 = q0 !== q1 ? 1 : 0;
  // Z₁Z₂ syndrome: 1 if q1 ≠ q2
  const s2 = q1 !== q2 ? 1 : 0;

  // Determine error location from syndrome
  let errorLocation: number | null = null;
  if (s1 === 1 && s2 === 0) errorLocation = 0;      // Error on qubit 0
  else if (s1 === 1 && s2 === 1) errorLocation = 1; // Error on qubit 1
  else if (s1 === 0 && s2 === 1) errorLocation = 2; // Error on qubit 2

  return { syndrome: [s1, s2], errorLocation };
}

function correctRepetitionError(state: StateVector, errorLocation: number | null): StateVector {
  if (errorLocation === null) return state;
  return applyX(state, errorLocation, 3);
}

function decodeRepetition(state: StateVector): StateVector {
  // Decode 3-qubit state back to 1 qubit
  const decoded = createZeroState(1);

  // Project onto codeword subspace and extract logical amplitudes
  decoded[0] = state[0b000]; // |000⟩ → |0⟩
  decoded[1] = state[0b111]; // |111⟩ → |1⟩

  return normalizeState(decoded);
}

// =============================================================================
// SHOR CODE (9-qubit code)
// =============================================================================

interface ShorCodeResult {
  code: 'Shor';
  physicalQubits: number;
  logicalQubits: number;
  operation: string;
  bitFlipSyndrome?: number[];
  phaseFlipSyndrome?: number[];
  errorDetected?: boolean;
  errorType?: string;
  errorLocation?: number | null;
  correctionApplied?: boolean;
  encodedState?: string;
  decodedState?: string;
  fidelity?: number;
}

function encodeShor(logicalState: StateVector): { state: StateVector; numQubits: number } {
  // Shor code: |0⟩ → (|000⟩ + |111⟩)(|000⟩ + |111⟩)(|000⟩ + |111⟩) / 2√2
  //            |1⟩ → (|000⟩ - |111⟩)(|000⟩ - |111⟩)(|000⟩ - |111⟩) / 2√2
  const numQubits = 9;
  const state = createZeroState(numQubits);

  const alpha = logicalState[0];
  const beta = logicalState[1];

  const norm = 1 / (2 * Math.sqrt(2));

  // |0_L⟩ encoding: all combinations with even number of 111 blocks positive
  // 000-000-000, 000-000-111, 000-111-000, 000-111-111, etc. all positive
  const zeroBasis = [
    0b000000000, 0b000000111, 0b000111000, 0b000111111,
    0b111000000, 0b111000111, 0b111111000, 0b111111111
  ];

  // |1_L⟩ encoding: alternating signs based on parity of 111 blocks
  const oneCoeffs = [1, -1, -1, 1, -1, 1, 1, -1];

  for (let i = 0; i < zeroBasis.length; i++) {
    const idx = zeroBasis[i];
    state[idx] = cAdd(
      cScale(alpha, norm),
      cScale(beta, norm * oneCoeffs[i])
    );
  }

  return { state, numQubits };
}

function measureShorBitFlipSyndrome(state: StateVector, block: number): { syndrome: number[]; errorInBlock: number | null } {
  // Measure Z stabilizers within a 3-qubit block
  const offset = block * 3;

  // Calculate bit parities from dominant component
  const probs = state.map(c => c.re * c.re + c.im * c.im);
  let maxProb = 0;
  let dominantBasis = 0;
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > maxProb) {
      maxProb = probs[i];
      dominantBasis = i;
    }
  }

  const q0 = (dominantBasis >> (8 - offset)) & 1;
  const q1 = (dominantBasis >> (7 - offset)) & 1;
  const q2 = (dominantBasis >> (6 - offset)) & 1;

  const s1 = q0 !== q1 ? 1 : 0;
  const s2 = q1 !== q2 ? 1 : 0;

  let errorInBlock: number | null = null;
  if (s1 === 1 && s2 === 0) errorInBlock = 0;
  else if (s1 === 1 && s2 === 1) errorInBlock = 1;
  else if (s1 === 0 && s2 === 1) errorInBlock = 2;

  return { syndrome: [s1, s2], errorInBlock };
}

function measureShorPhaseFlipSyndrome(state: StateVector): { syndrome: number[]; errorBlock: number | null } {
  // Measure X⊗9 stabilizers across blocks
  // Simplified: detect phase flip between blocks

  // For phase detection, we look at interference patterns
  // A phase flip in block i changes the sign of that block's contribution

  // This is a simplified syndrome measurement
  const probs = state.map(c => c.re * c.re + c.im * c.im);

  // Check sign consistency between blocks (simplified)
  let hasPhaseError = false;
  let errorBlock: number | null = null;

  // In a full implementation, this would involve Hadamard-basis measurement
  // For now, detect anomalous sign patterns
  const signPattern: number[] = [];
  for (let i = 0; i < 8; i++) {
    const idx = [0, 7, 56, 63, 448, 455, 504, 511][i];
    if (probs[idx] > 0.001) {
      signPattern.push(state[idx].re >= 0 ? 1 : -1);
    }
  }

  // Simple phase error detection
  if (signPattern.length >= 4) {
    const expectedPattern = [1, 1, 1, 1, 1, 1, 1, 1];
    for (let block = 0; block < 3; block++) {
      const blockSigns = signPattern.slice(block * 2, (block + 1) * 2);
      if (blockSigns.some((s, i) => s !== expectedPattern[block * 2 + i])) {
        hasPhaseError = true;
        errorBlock = block;
        break;
      }
    }
  }

  const s1 = errorBlock === 0 || errorBlock === 1 ? 1 : 0;
  const s2 = errorBlock === 1 || errorBlock === 2 ? 1 : 0;

  return { syndrome: [s1, s2], errorBlock: hasPhaseError ? errorBlock : null };
}

function correctShorError(
  state: StateVector,
  bitFlipLocation: { block: number; qubit: number } | null,
  phaseFlipBlock: number | null
): StateVector {
  let corrected = state;

  // Correct bit flip first
  if (bitFlipLocation !== null) {
    const qubitIndex = bitFlipLocation.block * 3 + bitFlipLocation.qubit;
    corrected = applyX(corrected, qubitIndex, 9);
  }

  // Correct phase flip
  if (phaseFlipBlock !== null) {
    // Apply Z to any qubit in the affected block
    const qubitIndex = phaseFlipBlock * 3;
    corrected = applyZ(corrected, qubitIndex, 9);
  }

  return corrected;
}

// =============================================================================
// STEANE CODE (7-qubit code)
// =============================================================================

interface SteaneCodeResult {
  code: 'Steane';
  physicalQubits: number;
  logicalQubits: number;
  operation: string;
  xSyndrome?: number[];
  zSyndrome?: number[];
  errorDetected?: boolean;
  errorType?: string;
  errorLocation?: number | null;
  correctionApplied?: boolean;
  encodedState?: string;
  decodedState?: string;
  fidelity?: number;
}

// Steane code generator matrix (7,4,3 Hamming code based)
const STEANE_H_MATRIX = [
  [1, 0, 1, 0, 1, 0, 1], // H1
  [0, 1, 1, 0, 0, 1, 1], // H2
  [0, 0, 0, 1, 1, 1, 1]  // H3
];

// Codewords for Steane code
const STEANE_ZERO_CODEWORDS = [
  0b0000000, 0b1010101, 0b0110011, 0b1100110,
  0b0001111, 0b1011010, 0b0111100, 0b1101001
];

const STEANE_ONE_CODEWORDS = [
  0b1111111, 0b0101010, 0b1001100, 0b0011001,
  0b1110000, 0b0100101, 0b1000011, 0b0010110
];

function encodeSteane(logicalState: StateVector): { state: StateVector; numQubits: number } {
  // Steane [[7,1,3]] code
  const numQubits = 7;
  const state = createZeroState(numQubits);

  const alpha = logicalState[0];
  const beta = logicalState[1];

  const norm = 1 / Math.sqrt(8);

  // |0_L⟩ = (1/√8) Σ |codeword⟩ for all codewords in CSS code
  for (const cw of STEANE_ZERO_CODEWORDS) {
    state[cw] = cAdd(state[cw], cScale(alpha, norm));
  }

  // |1_L⟩ = (1/√8) Σ |codeword⟩ for all complemented codewords
  for (const cw of STEANE_ONE_CODEWORDS) {
    state[cw] = cAdd(state[cw], cScale(beta, norm));
  }

  return { state, numQubits };
}

function measureSteaneSyndrome(state: StateVector): {
  xSyndrome: number[];
  zSyndrome: number[];
  bitFlipLocation: number | null;
  phaseFlipLocation: number | null;
} {
  // Calculate dominant basis state for syndrome extraction
  const probs = state.map(c => c.re * c.re + c.im * c.im);
  let maxProb = 0;
  let dominantBasis = 0;
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > maxProb) {
      maxProb = probs[i];
      dominantBasis = i;
    }
  }

  // Z-syndrome (detects X errors / bit flips)
  const zSyndrome: number[] = [];
  for (let row = 0; row < 3; row++) {
    let parity = 0;
    for (let col = 0; col < 7; col++) {
      if (STEANE_H_MATRIX[row][col] === 1) {
        const bit = (dominantBasis >> (6 - col)) & 1;
        parity ^= bit;
      }
    }
    zSyndrome.push(parity);
  }

  // X-syndrome (detects Z errors / phase flips)
  // For phase errors, we need Hadamard-basis measurement
  // Simplified: check phase consistency
  const xSyndrome: number[] = [0, 0, 0];

  // In ideal case, all codewords should have same phase
  // Phase errors cause sign flips
  for (let i = 0; i < STEANE_ZERO_CODEWORDS.length; i++) {
    const cw = STEANE_ZERO_CODEWORDS[i];
    if (Math.abs(state[cw].re) > 0.01 || Math.abs(state[cw].im) > 0.01) {
      // Check sign consistency
      if (state[cw].re < 0 && state[0].re > 0) {
        // Determine which qubit has phase error based on Hamming weight difference
        const diff = cw ^ STEANE_ZERO_CODEWORDS[0];
        for (let bit = 0; bit < 7; bit++) {
          if ((diff >> (6 - bit)) & 1) {
            for (let row = 0; row < 3; row++) {
              xSyndrome[row] ^= STEANE_H_MATRIX[row][bit];
            }
          }
        }
        break;
      }
    }
  }

  // Decode syndrome to error location
  const zSyndromeVal = zSyndrome[0] + 2 * zSyndrome[1] + 4 * zSyndrome[2];
  const xSyndromeVal = xSyndrome[0] + 2 * xSyndrome[1] + 4 * xSyndrome[2];

  // Syndrome value directly gives error position (1-indexed), 0 means no error
  const bitFlipLocation = zSyndromeVal > 0 ? zSyndromeVal - 1 : null;
  const phaseFlipLocation = xSyndromeVal > 0 ? xSyndromeVal - 1 : null;

  return { xSyndrome, zSyndrome, bitFlipLocation, phaseFlipLocation };
}

function correctSteaneError(
  state: StateVector,
  bitFlipLocation: number | null,
  phaseFlipLocation: number | null
): StateVector {
  let corrected = state;

  if (bitFlipLocation !== null && bitFlipLocation < 7) {
    corrected = applyX(corrected, bitFlipLocation, 7);
  }

  if (phaseFlipLocation !== null && phaseFlipLocation < 7) {
    corrected = applyZ(corrected, phaseFlipLocation, 7);
  }

  return corrected;
}

// =============================================================================
// SURFACE CODE (2D grid stabilizer code)
// =============================================================================

interface SurfaceCodeResult {
  code: 'surface';
  physicalQubits: number;
  logicalQubits: number;
  distance: number;
  operation: string;
  xStabilizers?: { position: [number, number]; value: number }[];
  zStabilizers?: { position: [number, number]; value: number }[];
  errorChain?: { type: string; positions: [number, number][] };
  correctionApplied?: boolean;
  logicalErrorRate?: number;
  threshold?: number;
}

interface SurfaceCodeLattice {
  distance: number;
  dataQubits: Map<string, number>;
  xStabilizers: Map<string, number[]>; // Maps stabilizer position to data qubit indices
  zStabilizers: Map<string, number[]>;
}

function createSurfaceCodeLattice(distance: number): SurfaceCodeLattice {
  const dataQubits = new Map<string, number>();
  const xStabilizers = new Map<string, number[]>();
  const zStabilizers = new Map<string, number[]>();

  let qubitIndex = 0;

  // Place data qubits on vertices of the lattice
  for (let row = 0; row < distance; row++) {
    for (let col = 0; col < distance; col++) {
      dataQubits.set(`${row},${col}`, qubitIndex++);
    }
  }

  // X stabilizers (measure products of X operators on plaquettes)
  for (let row = 0; row < distance - 1; row++) {
    for (let col = (row % 2); col < distance - 1; col += 2) {
      const qubits: number[] = [];

      // Four corners of the plaquette
      const positions = [
        [row, col], [row, col + 1],
        [row + 1, col], [row + 1, col + 1]
      ];

      for (const [r, c] of positions) {
        const idx = dataQubits.get(`${r},${c}`);
        if (idx !== undefined) qubits.push(idx);
      }

      if (qubits.length > 0) {
        xStabilizers.set(`X_${row}_${col}`, qubits);
      }
    }
  }

  // Z stabilizers (measure products of Z operators on stars)
  for (let row = 0; row < distance - 1; row++) {
    for (let col = ((row + 1) % 2); col < distance - 1; col += 2) {
      const qubits: number[] = [];

      const positions = [
        [row, col], [row, col + 1],
        [row + 1, col], [row + 1, col + 1]
      ];

      for (const [r, c] of positions) {
        const idx = dataQubits.get(`${r},${c}`);
        if (idx !== undefined) qubits.push(idx);
      }

      if (qubits.length > 0) {
        zStabilizers.set(`Z_${row}_${col}`, qubits);
      }
    }
  }

  return { distance, dataQubits, xStabilizers, zStabilizers };
}

function measureSurfaceCodeStabilizers(
  state: StateVector,
  lattice: SurfaceCodeLattice
): { xSyndromes: Map<string, number>; zSyndromes: Map<string, number> } {
  const numQubits = lattice.dataQubits.size;
  const xSyndromes = new Map<string, number>();
  const zSyndromes = new Map<string, number>();

  // Get dominant basis state
  const probs = state.map(c => c.re * c.re + c.im * c.im);
  let maxProb = 0;
  let dominantBasis = 0;
  for (let i = 0; i < Math.min(probs.length, 1 << numQubits); i++) {
    if (probs[i] > maxProb) {
      maxProb = probs[i];
      dominantBasis = i;
    }
  }

  // Measure Z stabilizers (detect X errors)
  for (const [name, qubits] of lattice.zStabilizers) {
    let parity = 0;
    for (const q of qubits) {
      const bit = (dominantBasis >> (numQubits - 1 - q)) & 1;
      parity ^= bit;
    }
    zSyndromes.set(name, parity);
  }

  // X stabilizers would require Hadamard-basis measurement
  // Simplified for this implementation
  for (const [name] of lattice.xStabilizers) {
    xSyndromes.set(name, 0);
  }

  return { xSyndromes, zSyndromes };
}

function decodeSurfaceCodeError(
  xSyndromes: Map<string, number>,
  zSyndromes: Map<string, number>,
  lattice: SurfaceCodeLattice
): { xCorrections: number[]; zCorrections: number[] } {
  // Minimum Weight Perfect Matching (MWPM) decoder - simplified version
  const xCorrections: number[] = [];
  const zCorrections: number[] = [];

  // Find syndrome locations with -1 eigenvalue
  const xDefects: [number, number][] = [];
  const zDefects: [number, number][] = [];

  for (const [name, value] of zSyndromes) {
    if (value === 1) {
      const parts = name.split('_');
      zDefects.push([parseInt(parts[1]), parseInt(parts[2])]);
    }
  }

  for (const [name, value] of xSyndromes) {
    if (value === 1) {
      const parts = name.split('_');
      xDefects.push([parseInt(parts[1]), parseInt(parts[2])]);
    }
  }

  // Simple greedy matching for nearby defects
  // In production, this would use Blossom algorithm for MWPM
  const matchDefects = (defects: [number, number][]): [number, number][][] => {
    const matched: [number, number][][] = [];
    const used = new Set<number>();

    for (let i = 0; i < defects.length; i++) {
      if (used.has(i)) continue;

      let bestJ = -1;
      let bestDist = Infinity;

      for (let j = i + 1; j < defects.length; j++) {
        if (used.has(j)) continue;

        const dist = Math.abs(defects[i][0] - defects[j][0]) +
                     Math.abs(defects[i][1] - defects[j][1]);
        if (dist < bestDist) {
          bestDist = dist;
          bestJ = j;
        }
      }

      if (bestJ !== -1) {
        matched.push([defects[i], defects[bestJ]]);
        used.add(i);
        used.add(bestJ);
      }
    }

    return matched;
  };

  // Get correction chains from matched defects
  const zMatched = matchDefects(zDefects);
  for (const [d1, d2] of zMatched) {
    // Find qubits along path between defects
    const row = Math.min(d1[0], d2[0]);
    const col = Math.min(d1[1], d2[1]);
    const qubit = lattice.dataQubits.get(`${row},${col}`);
    if (qubit !== undefined) {
      xCorrections.push(qubit);
    }
  }

  return { xCorrections, zCorrections };
}

function calculateLogicalErrorRate(distance: number, physicalErrorRate: number): number {
  // Simplified threshold model: p_L ≈ (p/p_th)^((d+1)/2)
  const threshold = 0.01; // ~1% threshold for surface codes
  if (physicalErrorRate >= threshold) {
    return Math.min(1, physicalErrorRate);
  }

  const exponent = (distance + 1) / 2;
  return Math.pow(physicalErrorRate / threshold, exponent) * threshold;
}

// =============================================================================
// CODE INFORMATION
// =============================================================================

interface CodeInfo {
  name: string;
  notation: string;
  physicalQubits: number;
  logicalQubits: number;
  distance: number;
  correctableErrors: string[];
  stabilizers: string[];
  logicalOperators: { X: string; Z: string };
  threshold?: number;
  advantages: string[];
  disadvantages: string[];
}

function getCodeInfo(code: string): CodeInfo {
  switch (code) {
    case 'repetition':
      return {
        name: 'Repetition Code',
        notation: '[[3,1,1]]',
        physicalQubits: 3,
        logicalQubits: 1,
        distance: 1,
        correctableErrors: ['Single bit flip (X error)'],
        stabilizers: ['Z₀Z₁', 'Z₁Z₂'],
        logicalOperators: { X: 'X₀X₁X₂', Z: 'Z₀' },
        advantages: [
          'Simplest quantum error correction code',
          'Easy to understand and implement',
          'Good for correcting asymmetric noise'
        ],
        disadvantages: [
          'Only corrects bit flips, not phase flips',
          'Not a true quantum code (distance 1)',
          'Cannot correct general Pauli errors'
        ]
      };

    case 'Shor':
      return {
        name: 'Shor Code',
        notation: '[[9,1,3]]',
        physicalQubits: 9,
        logicalQubits: 1,
        distance: 3,
        correctableErrors: ['Any single-qubit error (X, Y, or Z)'],
        stabilizers: [
          'Z₀Z₁, Z₁Z₂ (block 1)',
          'Z₃Z₄, Z₄Z₅ (block 2)',
          'Z₆Z₇, Z₇Z₈ (block 3)',
          'X₀X₁X₂X₃X₄X₅',
          'X₃X₄X₅X₆X₇X₈'
        ],
        logicalOperators: {
          X: 'X₀X₃X₆',
          Z: 'Z₀Z₁Z₂Z₃Z₄Z₅Z₆Z₇Z₈'
        },
        advantages: [
          'First discovered quantum error correction code',
          'Corrects arbitrary single-qubit errors',
          'Concatenation of classical codes (3-bit + phase)'
        ],
        disadvantages: [
          'High overhead (9 physical qubits per logical qubit)',
          'Not fault-tolerant without modification',
          'Complex syndrome measurement'
        ]
      };

    case 'Steane':
      return {
        name: 'Steane Code',
        notation: '[[7,1,3]]',
        physicalQubits: 7,
        logicalQubits: 1,
        distance: 3,
        correctableErrors: ['Any single-qubit error (X, Y, or Z)'],
        stabilizers: [
          'X₀X₂X₄X₆', 'X₁X₂X₅X₆', 'X₃X₄X₅X₆',
          'Z₀Z₂Z₄Z₆', 'Z₁Z₂Z₅Z₆', 'Z₃Z₄Z₅Z₆'
        ],
        logicalOperators: {
          X: 'X₀X₁X₂X₃X₄X₅X₆',
          Z: 'Z₀Z₁Z₂Z₃Z₄Z₅Z₆'
        },
        advantages: [
          'CSS code structure enables transversal CNOT',
          'More efficient than Shor code (7 vs 9 qubits)',
          'Transversal Hadamard gate possible',
          'Based on classical Hamming code'
        ],
        disadvantages: [
          'Still requires ancilla qubits for measurement',
          'T-gate requires magic state distillation',
          'Lower threshold than surface codes'
        ]
      };

    case 'surface':
      return {
        name: 'Surface Code',
        notation: '[[d²,1,d]]',
        physicalQubits: 25, // For d=5
        logicalQubits: 1,
        distance: 5,
        correctableErrors: ['Up to ⌊(d-1)/2⌋ errors'],
        stabilizers: [
          'X-type plaquettes (4-body)',
          'Z-type stars (4-body)',
          'Boundary terms (2 or 3-body)'
        ],
        logicalOperators: {
          X: 'Chain of X operators across lattice',
          Z: 'Chain of Z operators across lattice'
        },
        threshold: 0.01,
        advantages: [
          'Highest known threshold (~1%)',
          'Only nearest-neighbor interactions needed',
          'Well-suited for 2D qubit architectures',
          'Efficient decoding algorithms (MWPM)'
        ],
        disadvantages: [
          'High qubit overhead (d² for distance d)',
          'No transversal non-Clifford gates',
          'Requires magic state distillation for T-gate'
        ]
      };

    default:
      return {
        name: 'Unknown',
        notation: 'N/A',
        physicalQubits: 0,
        logicalQubits: 0,
        distance: 0,
        correctableErrors: [],
        stabilizers: [],
        logicalOperators: { X: 'N/A', Z: 'N/A' },
        advantages: [],
        disadvantages: []
      };
  }
}

// =============================================================================
// FIDELITY CALCULATION
// =============================================================================

function calculateFidelity(state1: StateVector, state2: StateVector): number {
  // F = |⟨ψ|φ⟩|²
  let overlap = complex(0);
  const len = Math.min(state1.length, state2.length);

  for (let i = 0; i < len; i++) {
    overlap = cAdd(overlap, cMul(cConj(state1[i]), state2[i]));
  }

  return cMag(overlap) * cMag(overlap);
}

function stateToString(state: StateVector, numQubits: number): string {
  const terms: string[] = [];

  for (let i = 0; i < state.length; i++) {
    const mag = cMag(state[i]);
    if (mag > 0.01) {
      const basis = i.toString(2).padStart(numQubits, '0');
      const phase = Math.atan2(state[i].im, state[i].re);
      const phaseStr = Math.abs(phase) < 0.01 ? '' :
                       Math.abs(phase - Math.PI) < 0.01 ? '-' :
                       `e^(i${(phase / Math.PI).toFixed(2)}π)`;
      terms.push(`${phaseStr}${mag.toFixed(3)}|${basis}⟩`);
    }
  }

  return terms.length > 0 ? terms.slice(0, 5).join(' + ') + (terms.length > 5 ? ' + ...' : '') : '0';
}

// =============================================================================
// MAIN TOOL INTERFACE
// =============================================================================

export const quantumerrorcorrectionTool: UnifiedTool = {
  name: 'quantum_error_correction',
  description: 'Comprehensive quantum error correction codes simulator supporting Repetition, Shor (9-qubit), Steane (7-qubit), and Surface codes. Performs encoding, error injection, syndrome measurement, error correction, and decoding with fidelity analysis.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['encode', 'inject_error', 'measure_syndrome', 'correct', 'decode', 'full_cycle', 'info', 'compare'],
        description: 'Operation: encode logical qubit, inject error, measure syndrome, correct error, decode, run full cycle, get code info, or compare codes'
      },
      code: {
        type: 'string',
        enum: ['repetition', 'Shor', 'Steane', 'surface'],
        description: 'Error correction code type'
      },
      logicalState: {
        type: 'object',
        properties: {
          alpha: { type: 'array', items: { type: 'number' }, description: 'Coefficient of |0⟩ [re, im]' },
          beta: { type: 'array', items: { type: 'number' }, description: 'Coefficient of |1⟩ [re, im]' }
        },
        description: 'Logical qubit state to encode (default |0⟩)'
      },
      errorType: {
        type: 'string',
        enum: ['bit_flip', 'phase_flip', 'bit_phase_flip', 'none', 'random'],
        description: 'Type of error to inject'
      },
      errorQubit: {
        type: 'number',
        description: 'Which physical qubit to apply error to'
      },
      errorRate: {
        type: 'number',
        description: 'Physical error rate for analysis (0-1)'
      },
      distance: {
        type: 'number',
        description: 'Code distance for surface code (default 3)'
      }
    },
    required: ['operation']
  }
};

interface QECArgs {
  operation: 'encode' | 'inject_error' | 'measure_syndrome' | 'correct' | 'decode' | 'full_cycle' | 'info' | 'compare';
  code?: 'repetition' | 'Shor' | 'Steane' | 'surface';
  logicalState?: { alpha?: number[]; beta?: number[] };
  errorType?: 'bit_flip' | 'phase_flip' | 'bit_phase_flip' | 'none' | 'random';
  errorQubit?: number;
  errorRate?: number;
  distance?: number;
}

export async function executequantumerrorcorrection(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args: QECArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, code = 'Steane' } = args;

    // Parse logical state
    const alpha = args.logicalState?.alpha ?
      complex(args.logicalState.alpha[0], args.logicalState.alpha[1] || 0) :
      complex(1);
    const beta = args.logicalState?.beta ?
      complex(args.logicalState.beta[0], args.logicalState.beta[1] || 0) :
      complex(0);

    const logicalState: StateVector = [alpha, beta];
    const normalizedLogical = normalizeState(logicalState);

    // Determine error type
    let errorType = args.errorType || 'none';
    if (errorType === 'random') {
      const types: ErrorType[] = ['bit_flip', 'phase_flip', 'bit_phase_flip', 'none'];
      errorType = types[Math.floor(Math.random() * types.length)];
    }

    switch (operation) {
      case 'info': {
        const info = getCodeInfo(code);
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'info',
            code,
            ...info
          }, null, 2)
        };
      }

      case 'compare': {
        const codes = ['repetition', 'Shor', 'Steane', 'surface'] as const;
        const comparison = codes.map(c => {
          const info = getCodeInfo(c);
          const errorRate = args.errorRate || 0.001;
          const logicalRate = c === 'surface' ?
            calculateLogicalErrorRate(args.distance || 3, errorRate) :
            errorRate * (info.distance > 1 ? Math.pow(errorRate, Math.floor(info.distance / 2)) : 1);

          return {
            code: c,
            notation: info.notation,
            physicalQubits: info.physicalQubits,
            distance: info.distance,
            logicalErrorRate: logicalRate,
            overhead: info.physicalQubits / info.logicalQubits
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare',
            physicalErrorRate: args.errorRate || 0.001,
            comparison,
            recommendation: comparison.reduce((best, curr) =>
              curr.logicalErrorRate < best.logicalErrorRate ? curr : best
            ).code
          }, null, 2)
        };
      }

      case 'full_cycle': {
        // Run complete encode → error → syndrome → correct → decode cycle
        if (code === 'repetition') {
          const { state: encoded, numQubits } = encodeRepetition(normalizedLogical);
          const errorQubit = args.errorQubit ?? Math.floor(Math.random() * numQubits);
          const corrupted = injectError(encoded, errorQubit, numQubits, errorType as ErrorType);
          const { syndrome, errorLocation } = measureRepetitionSyndrome(corrupted);
          const corrected = correctRepetitionError(corrupted, errorLocation);
          const decoded = decodeRepetition(corrected);
          const fidelity = calculateFidelity(normalizedLogical, decoded);

          const result: RepetitionCodeResult = {
            code: 'repetition',
            physicalQubits: numQubits,
            logicalQubits: 1,
            operation: 'full_cycle',
            syndrome,
            errorDetected: errorLocation !== null,
            errorLocation,
            correctionApplied: errorLocation !== null,
            encodedState: stateToString(encoded, numQubits),
            decodedState: stateToString(decoded, 1),
            fidelity
          };

          return { toolCallId: id, content: JSON.stringify(result, null, 2) };
        }

        if (code === 'Shor') {
          const { state: encoded, numQubits } = encodeShor(normalizedLogical);
          const errorQubit = args.errorQubit ?? Math.floor(Math.random() * numQubits);
          const corrupted = injectError(encoded, errorQubit, numQubits, errorType as ErrorType);

          // Check all three blocks for bit flip errors
          let bitFlipLocation: { block: number; qubit: number } | null = null;
          const bitFlipSyndromes: number[] = [];

          for (let block = 0; block < 3; block++) {
            const { syndrome, errorInBlock } = measureShorBitFlipSyndrome(corrupted, block);
            bitFlipSyndromes.push(...syndrome);
            if (errorInBlock !== null) {
              bitFlipLocation = { block, qubit: errorInBlock };
            }
          }

          const { syndrome: phaseSyndrome, errorBlock } = measureShorPhaseFlipSyndrome(corrupted);
          const corrected = correctShorError(corrupted, bitFlipLocation, errorBlock);

          // Decode (simplified - extract logical amplitudes)
          const decoded = createZeroState(1);
          const norm = 2 * Math.sqrt(2);
          decoded[0] = cScale(corrected[0b000000000], norm);
          decoded[1] = cScale(corrected[0b111111111], norm);
          const normalizedDecoded = normalizeState(decoded);

          const fidelity = calculateFidelity(normalizedLogical, normalizedDecoded);

          const result: ShorCodeResult = {
            code: 'Shor',
            physicalQubits: numQubits,
            logicalQubits: 1,
            operation: 'full_cycle',
            bitFlipSyndrome: bitFlipSyndromes,
            phaseFlipSyndrome: phaseSyndrome,
            errorDetected: bitFlipLocation !== null || errorBlock !== null,
            errorType: bitFlipLocation !== null ? 'bit_flip' : (errorBlock !== null ? 'phase_flip' : 'none'),
            errorLocation: bitFlipLocation !== null ? bitFlipLocation.block * 3 + bitFlipLocation.qubit : errorBlock,
            correctionApplied: bitFlipLocation !== null || errorBlock !== null,
            fidelity
          };

          return { toolCallId: id, content: JSON.stringify(result, null, 2) };
        }

        if (code === 'Steane') {
          const { state: encoded, numQubits } = encodeSteane(normalizedLogical);
          const errorQubit = args.errorQubit ?? Math.floor(Math.random() * numQubits);
          const corrupted = injectError(encoded, errorQubit, numQubits, errorType as ErrorType);

          const { xSyndrome, zSyndrome, bitFlipLocation, phaseFlipLocation } = measureSteaneSyndrome(corrupted);
          const corrected = correctSteaneError(corrupted, bitFlipLocation, phaseFlipLocation);

          // Decode
          const decoded = createZeroState(1);
          let zeroAmp = complex(0);
          let oneAmp = complex(0);

          for (const cw of STEANE_ZERO_CODEWORDS) {
            zeroAmp = cAdd(zeroAmp, corrected[cw]);
          }
          for (const cw of STEANE_ONE_CODEWORDS) {
            oneAmp = cAdd(oneAmp, corrected[cw]);
          }

          decoded[0] = cScale(zeroAmp, 1 / Math.sqrt(8));
          decoded[1] = cScale(oneAmp, 1 / Math.sqrt(8));
          const normalizedDecoded = normalizeState(decoded);

          const fidelity = calculateFidelity(normalizedLogical, normalizedDecoded);

          const result: SteaneCodeResult = {
            code: 'Steane',
            physicalQubits: numQubits,
            logicalQubits: 1,
            operation: 'full_cycle',
            xSyndrome,
            zSyndrome,
            errorDetected: bitFlipLocation !== null || phaseFlipLocation !== null,
            errorType: bitFlipLocation !== null && phaseFlipLocation !== null ? 'Y' :
                       bitFlipLocation !== null ? 'X' :
                       phaseFlipLocation !== null ? 'Z' : 'none',
            errorLocation: bitFlipLocation ?? phaseFlipLocation,
            correctionApplied: bitFlipLocation !== null || phaseFlipLocation !== null,
            fidelity
          };

          return { toolCallId: id, content: JSON.stringify(result, null, 2) };
        }

        if (code === 'surface') {
          const distance = args.distance || 3;
          const lattice = createSurfaceCodeLattice(distance);
          const numQubits = lattice.dataQubits.size;

          // Create encoded state (|0_L⟩ + |1_L⟩)/√2 for testing
          const state = createZeroState(numQubits);
          state[0] = complex(1 / Math.sqrt(2));
          state[(1 << numQubits) - 1] = complex(1 / Math.sqrt(2));

          const errorQubit = args.errorQubit ?? Math.floor(Math.random() * numQubits);
          const corrupted = injectError(state, errorQubit, numQubits, errorType as ErrorType);

          const { xSyndromes, zSyndromes } = measureSurfaceCodeStabilizers(corrupted, lattice);
          const { xCorrections, zCorrections } = decodeSurfaceCodeError(xSyndromes, zSyndromes, lattice);

          let corrected = corrupted;
          for (const q of xCorrections) {
            corrected = applyX(corrected, q, numQubits);
          }
          for (const q of zCorrections) {
            corrected = applyZ(corrected, q, numQubits);
          }

          const errorRate = args.errorRate || 0.001;
          const logicalErrorRate = calculateLogicalErrorRate(distance, errorRate);

          const result: SurfaceCodeResult = {
            code: 'surface',
            physicalQubits: numQubits,
            logicalQubits: 1,
            distance,
            operation: 'full_cycle',
            xStabilizers: Array.from(xSyndromes.entries()).map(([name, value]) => ({
              position: [parseInt(name.split('_')[1]), parseInt(name.split('_')[2])] as [number, number],
              value
            })),
            zStabilizers: Array.from(zSyndromes.entries()).map(([name, value]) => ({
              position: [parseInt(name.split('_')[1]), parseInt(name.split('_')[2])] as [number, number],
              value
            })),
            correctionApplied: xCorrections.length > 0 || zCorrections.length > 0,
            logicalErrorRate,
            threshold: 0.01
          };

          return { toolCallId: id, content: JSON.stringify(result, null, 2) };
        }

        throw new Error(`Unknown code: ${code}`);
      }

      case 'encode': {
        if (code === 'repetition') {
          const { state, numQubits } = encodeRepetition(normalizedLogical);
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'encode',
              code: 'repetition',
              inputState: stateToString(normalizedLogical, 1),
              encodedState: stateToString(state, numQubits),
              physicalQubits: numQubits,
              codewords: { zero: '|000⟩', one: '|111⟩' }
            }, null, 2)
          };
        }

        if (code === 'Shor') {
          const { state, numQubits } = encodeShor(normalizedLogical);
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'encode',
              code: 'Shor',
              inputState: stateToString(normalizedLogical, 1),
              encodedState: stateToString(state, numQubits),
              physicalQubits: numQubits,
              codewords: {
                zero: '(|000⟩+|111⟩)(|000⟩+|111⟩)(|000⟩+|111⟩)/2√2',
                one: '(|000⟩-|111⟩)(|000⟩-|111⟩)(|000⟩-|111⟩)/2√2'
              }
            }, null, 2)
          };
        }

        if (code === 'Steane') {
          const { state, numQubits } = encodeSteane(normalizedLogical);
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'encode',
              code: 'Steane',
              inputState: stateToString(normalizedLogical, 1),
              encodedState: stateToString(state, numQubits),
              physicalQubits: numQubits,
              codewords: {
                zero: 'Superposition of 8 even-weight codewords',
                one: 'Superposition of 8 odd-weight codewords'
              }
            }, null, 2)
          };
        }

        if (code === 'surface') {
          const distance = args.distance || 3;
          const lattice = createSurfaceCodeLattice(distance);
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'encode',
              code: 'surface',
              distance,
              physicalQubits: lattice.dataQubits.size,
              xStabilizers: lattice.xStabilizers.size,
              zStabilizers: lattice.zStabilizers.size,
              logicalOperators: {
                X: 'Horizontal chain across lattice',
                Z: 'Vertical chain across lattice'
              }
            }, null, 2)
          };
        }

        throw new Error(`Unknown code: ${code}`);
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Operation '${operation}' not fully implemented. Use 'full_cycle' for complete error correction demonstration or 'info' for code details.`,
            supportedOperations: ['encode', 'full_cycle', 'info', 'compare']
          }, null, 2)
        };
    }

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isquantumerrorcorrectionAvailable(): boolean {
  return true;
}
