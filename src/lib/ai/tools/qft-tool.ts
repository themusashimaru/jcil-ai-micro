/**
 * QFT TOOL
 * Quantum Fourier Transform - The quantum analog of the discrete Fourier transform
 *
 * Features:
 * - Forward and inverse QFT
 * - Controlled rotations
 * - Swap gate networks
 * - Phase estimation applications
 * - Circuit visualization
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

function cScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

function cConj(a: Complex): Complex {
  return { re: a.re, im: -a.im };
}

function cAbs(a: Complex): number {
  return Math.sqrt(a.re * a.re + a.im * a.im);
}

function cExp(theta: number): Complex {
  return { re: Math.cos(theta), im: Math.sin(theta) };
}

function cToString(a: Complex, precision: number = 4): string {
  const re = a.re.toFixed(precision);
  const im = Math.abs(a.im).toFixed(precision);
  if (Math.abs(a.im) < 1e-10) return re;
  if (Math.abs(a.re) < 1e-10) return a.im >= 0 ? `${im}i` : `-${im}i`;
  return a.im >= 0 ? `${re}+${im}i` : `${re}-${im}i`;
}

// ============================================================================
// QUANTUM STATE VECTOR
// ============================================================================

type StateVector = Complex[];

function createZeroState(n: number): StateVector {
  const size = 1 << n;
  const state: StateVector = new Array(size).fill(null).map(() => complex(0));
  state[0] = complex(1);
  return state;
}

function createBasisState(n: number, value: number): StateVector {
  const size = 1 << n;
  const state: StateVector = new Array(size).fill(null).map(() => complex(0));
  state[value % size] = complex(1);
  return state;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normalize(state: StateVector): StateVector {
  const norm = Math.sqrt(state.reduce((sum, a) => sum + cAbs(a) ** 2, 0));
  return state.map(a => cScale(a, 1 / norm));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function innerProduct(a: StateVector, b: StateVector): Complex {
  let result = complex(0);
  for (let i = 0; i < a.length; i++) {
    result = cAdd(result, cMul(cConj(a[i]), b[i]));
  }
  return result;
}

function measureProbabilities(state: StateVector): number[] {
  return state.map(a => cAbs(a) ** 2);
}

// ============================================================================
// QUANTUM GATES
// ============================================================================

// Single qubit gates
function applyHadamard(state: StateVector, target: number, nQubits: number): StateVector {
  const result: StateVector = new Array(state.length).fill(null).map(() => complex(0));
  const mask = 1 << (nQubits - 1 - target);
  const factor = 1 / Math.sqrt(2);

  for (let i = 0; i < state.length; i++) {
    const i0 = i & ~mask;
    const i1 = i | mask;
    const bit = (i >> (nQubits - 1 - target)) & 1;

    if (bit === 0) {
      result[i0] = cAdd(result[i0], cScale(state[i], factor));
      result[i1] = cAdd(result[i1], cScale(state[i], factor));
    } else {
      result[i0] = cAdd(result[i0], cScale(state[i], factor));
      result[i1] = cAdd(result[i1], cScale(state[i], -factor));
    }
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function applyPhaseRotation(state: StateVector, target: number, theta: number, nQubits: number): StateVector {
  const result: StateVector = state.map(c => ({ ...c }));
  const mask = 1 << (nQubits - 1 - target);

  for (let i = 0; i < state.length; i++) {
    if (i & mask) {
      result[i] = cMul(result[i], cExp(theta));
    }
  }

  return result;
}

function applyControlledPhase(state: StateVector, control: number, target: number, theta: number, nQubits: number): StateVector {
  const result: StateVector = state.map(c => ({ ...c }));
  const controlMask = 1 << (nQubits - 1 - control);
  const targetMask = 1 << (nQubits - 1 - target);

  for (let i = 0; i < state.length; i++) {
    if ((i & controlMask) && (i & targetMask)) {
      result[i] = cMul(result[i], cExp(theta));
    }
  }

  return result;
}

function applySwap(state: StateVector, qubit1: number, qubit2: number, nQubits: number): StateVector {
  const result: StateVector = state.map(c => ({ ...c }));
  const mask1 = 1 << (nQubits - 1 - qubit1);
  const mask2 = 1 << (nQubits - 1 - qubit2);

  for (let i = 0; i < state.length; i++) {
    const bit1 = (i & mask1) ? 1 : 0;
    const bit2 = (i & mask2) ? 1 : 0;

    if (bit1 !== bit2) {
      const j = i ^ mask1 ^ mask2;
      if (i < j) {
        const temp = result[i];
        result[i] = result[j];
        result[j] = temp;
      }
    }
  }

  return result;
}

// ============================================================================
// QUANTUM FOURIER TRANSFORM
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface QFTResult {
  inputState: string[];
  outputState: string[];
  probabilities: number[];
  circuit: string[];
  nQubits: number;
  inverse: boolean;
}

function performQFT(inputState: StateVector, nQubits: number, inverse: boolean = false): {
  outputState: StateVector;
  circuit: string[];
} {
  let state = inputState.map(c => ({ ...c }));
  const circuit: string[] = [];

  if (!inverse) {
    // Forward QFT
    for (let j = 0; j < nQubits; j++) {
      // Apply Hadamard to qubit j
      state = applyHadamard(state, j, nQubits);
      circuit.push(`H(q${j})`);

      // Apply controlled rotations
      for (let k = j + 1; k < nQubits; k++) {
        const angle = Math.PI / (1 << (k - j));
        state = applyControlledPhase(state, k, j, angle, nQubits);
        circuit.push(`CP(q${k}->q${j}, π/${1 << (k - j)})`);
      }
    }

    // Swap qubits to reverse order
    for (let i = 0; i < Math.floor(nQubits / 2); i++) {
      state = applySwap(state, i, nQubits - 1 - i, nQubits);
      circuit.push(`SWAP(q${i}, q${nQubits - 1 - i})`);
    }
  } else {
    // Inverse QFT
    // First swap qubits
    for (let i = 0; i < Math.floor(nQubits / 2); i++) {
      state = applySwap(state, i, nQubits - 1 - i, nQubits);
      circuit.push(`SWAP(q${i}, q${nQubits - 1 - i})`);
    }

    // Then apply inverse rotations in reverse order
    for (let j = nQubits - 1; j >= 0; j--) {
      // Apply inverse controlled rotations
      for (let k = nQubits - 1; k > j; k--) {
        const angle = -Math.PI / (1 << (k - j));
        state = applyControlledPhase(state, k, j, angle, nQubits);
        circuit.push(`CP†(q${k}->q${j}, -π/${1 << (k - j)})`);
      }

      // Apply Hadamard (self-inverse)
      state = applyHadamard(state, j, nQubits);
      circuit.push(`H(q${j})`);
    }
  }

  return { outputState: state, circuit };
}

// ============================================================================
// PHASE ESTIMATION
// ============================================================================

interface PhaseEstimationResult {
  estimatedPhase: number;
  estimatedEigenvalue: Complex;
  probabilities: number[];
  nPrecisionQubits: number;
  circuit: string[];
}

function performPhaseEstimation(
  eigenphase: number,
  nPrecisionQubits: number
): PhaseEstimationResult {
  // Simulate quantum phase estimation
  // The circuit applies controlled-U^(2^k) operations followed by inverse QFT

  const circuit: string[] = [];

  // Initialize precision register in superposition
  circuit.push('Initialize precision register:');
  for (let i = 0; i < nPrecisionQubits; i++) {
    circuit.push(`  H(q${i})`);
  }

  // Apply controlled powers of U
  circuit.push('Apply controlled phase rotations:');
  for (let k = 0; k < nPrecisionQubits; k++) {
    const power = 1 << k;
    const angle = 2 * Math.PI * eigenphase * power;
    circuit.push(`  CU^${power}(q${k}) = CP(${(angle / Math.PI).toFixed(4)}π)`);
  }

  // Apply inverse QFT
  circuit.push('Apply inverse QFT to precision register');

  // Calculate measurement probabilities
  // The measured value should be close to φ * 2^n where φ is the phase
  const size = 1 << nPrecisionQubits;
  const probabilities: number[] = new Array(size).fill(0);

  for (let k = 0; k < size; k++) {
    const measuredPhase = k / size;
    const diff = Math.abs(measuredPhase - (eigenphase % 1));
    const diff2 = Math.min(diff, 1 - diff);
    // Approximate probability distribution
    if (diff2 < 0.5 / size) {
      probabilities[k] = 1 - diff2 * size * 2;
    }
  }

  // Normalize
  const total = probabilities.reduce((a, b) => a + b, 0);
  if (total > 0) {
    for (let i = 0; i < probabilities.length; i++) {
      probabilities[i] /= total;
    }
  }

  // Find most likely measurement
  let maxProb = 0;
  let maxIdx = 0;
  for (let i = 0; i < probabilities.length; i++) {
    if (probabilities[i] > maxProb) {
      maxProb = probabilities[i];
      maxIdx = i;
    }
  }

  const estimatedPhase = maxIdx / size;
  const estimatedEigenvalue = cExp(2 * Math.PI * estimatedPhase);

  return {
    estimatedPhase,
    estimatedEigenvalue,
    probabilities,
    nPrecisionQubits,
    circuit
  };
}

// ============================================================================
// PERIOD FINDING (SHOR'S ALGORITHM COMPONENT)
// ============================================================================

interface PeriodFindingResult {
  a: number;
  N: number;
  period: number | null;
  probablePeriods: number[];
  nQubits: number;
  convergents: { numerator: number; denominator: number }[];
}

function findPeriod(a: number, N: number): PeriodFindingResult {
  // Simulate quantum period finding for f(x) = a^x mod N
  // This is a key component of Shor's algorithm

  const nQubits = Math.ceil(2 * Math.log2(N));

  // Classically compute the period for validation
  let classicalPeriod: number | null = null;
  let val = 1;
  for (let r = 1; r <= N; r++) {
    val = (val * a) % N;
    if (val === 1) {
      classicalPeriod = r;
      break;
    }
  }

  // Simulate QFT measurement outcomes
  const probablePeriods: number[] = [];
  if (classicalPeriod !== null) {
    // The quantum measurement gives s/r where r is the period
    for (let s = 0; s < classicalPeriod; s++) {
      const measurement = Math.round((s / classicalPeriod) * (1 << nQubits));
      if (!probablePeriods.includes(measurement)) {
        probablePeriods.push(measurement);
      }
    }
  }

  // Compute continued fraction convergents
  const convergents: { numerator: number; denominator: number }[] = [];
  if (probablePeriods.length > 0) {
    const Q = 1 << nQubits;
    const measuredPhase = probablePeriods[1] || probablePeriods[0];
    const fraction = measuredPhase / Q;

    // Simple continued fraction expansion
    let h1 = 1, h2 = 0;
    let k1 = 0, k2 = 1;
    let x = fraction;

    for (let i = 0; i < 10 && x !== 0; i++) {
      const a_i = Math.floor(x);
      const h = a_i * h1 + h2;
      const k = a_i * k1 + k2;

      if (k <= N) {
        convergents.push({ numerator: h, denominator: k });
      }

      h2 = h1; h1 = h;
      k2 = k1; k1 = k;

      if (x - a_i === 0) break;
      x = 1 / (x - a_i);
    }
  }

  return {
    a,
    N,
    period: classicalPeriod,
    probablePeriods,
    nQubits,
    convergents
  };
}

// ============================================================================
// TOOL DEFINITION AND EXECUTOR
// ============================================================================

export const qftTool: UnifiedTool = {
  name: 'qft',
  description: `Quantum Fourier Transform (QFT) - The quantum analog of the discrete Fourier transform.
The QFT is a fundamental quantum algorithm component used in phase estimation, Shor's algorithm,
and many quantum machine learning applications.

Features:
- Forward and inverse QFT on arbitrary qubit counts
- Controlled phase rotation implementation
- Swap gate networks for bit reversal
- Phase estimation applications
- Period finding for Shor's algorithm
- Circuit visualization and gate decomposition

Operations:
- forward: Apply forward QFT to a quantum state
- inverse: Apply inverse QFT to a quantum state
- phase_estimation: Estimate eigenphase of a unitary
- period_finding: Find period of modular exponentiation (Shor's component)
- info: Tool documentation
- examples: Usage examples`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['forward', 'inverse', 'phase_estimation', 'period_finding', 'info', 'examples'],
        description: 'Operation to perform'
      },
      num_qubits: {
        type: 'number',
        description: 'Number of qubits (1-10)'
      },
      input_state: {
        type: 'string',
        description: 'Input computational basis state (e.g., "0101" or decimal number)'
      },
      eigenphase: {
        type: 'number',
        description: 'Eigenphase for phase estimation (0-1)'
      },
      a: {
        type: 'number',
        description: 'Base for period finding (a^x mod N)'
      },
      N: {
        type: 'number',
        description: 'Modulus for period finding'
      }
    },
    required: ['operation']
  }
};

export async function executeqft(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    switch (operation) {
      case 'forward':
      case 'inverse': {
        const nQubits = Math.min(Math.max(args.num_qubits || 3, 1), 10);
        const inverse = operation === 'inverse';

        // Parse input state
        let inputState: StateVector;
        if (args.input_state) {
          const inputStr = String(args.input_state);
          let basisIndex: number;
          if (/^[01]+$/.test(inputStr)) {
            basisIndex = parseInt(inputStr, 2);
          } else {
            basisIndex = parseInt(inputStr, 10);
          }
          inputState = createBasisState(nQubits, basisIndex);
        } else {
          inputState = createZeroState(nQubits);
        }

        const { outputState, circuit } = performQFT(inputState, nQubits, inverse);
        const probs = measureProbabilities(outputState);

        // Format state vectors
        const formatState = (state: StateVector): string[] => {
          const result: string[] = [];
          for (let i = 0; i < state.length; i++) {
            if (cAbs(state[i]) > 1e-10) {
              const binaryStr = i.toString(2).padStart(nQubits, '0');
              result.push(`|${binaryStr}⟩: ${cToString(state[i], 4)}`);
            }
          }
          return result;
        };

        // Find significant probabilities
        const significantProbs: { state: string; probability: number }[] = [];
        for (let i = 0; i < probs.length; i++) {
          if (probs[i] > 0.001) {
            const binaryStr = i.toString(2).padStart(nQubits, '0');
            significantProbs.push({ state: `|${binaryStr}⟩`, probability: probs[i] });
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: inverse ? 'inverse_qft' : 'forward_qft',
            nQubits,
            inputState: formatState(inputState),
            outputState: formatState(outputState),
            measurementProbabilities: significantProbs.map(p => ({
              state: p.state,
              probability: (p.probability * 100).toFixed(2) + '%'
            })),
            circuit: circuit,
            gateCount: circuit.length,
            complexity: `O(n²) = O(${nQubits}²) = ${nQubits * nQubits} gates`
          }, null, 2)
        };
      }

      case 'phase_estimation': {
        const eigenphase = args.eigenphase !== undefined ? args.eigenphase : 0.25;
        const nPrecisionQubits = Math.min(Math.max(args.num_qubits || 4, 2), 10);

        if (eigenphase < 0 || eigenphase > 1) {
          return { toolCallId: id, content: 'Error: eigenphase must be between 0 and 1', isError: true };
        }

        const result = performPhaseEstimation(eigenphase, nPrecisionQubits);

        // Find top probable measurements
        const topMeasurements: { value: number; binary: string; phase: number; probability: number }[] = [];
        for (let i = 0; i < result.probabilities.length; i++) {
          if (result.probabilities[i] > 0.01) {
            topMeasurements.push({
              value: i,
              binary: i.toString(2).padStart(nPrecisionQubits, '0'),
              phase: i / (1 << nPrecisionQubits),
              probability: result.probabilities[i]
            });
          }
        }
        topMeasurements.sort((a, b) => b.probability - a.probability);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'phase_estimation',
            truePhase: eigenphase,
            trueEigenvalue: `e^(2πi × ${eigenphase}) = ${cToString(cExp(2 * Math.PI * eigenphase))}`,
            nPrecisionQubits,
            estimatedPhase: result.estimatedPhase,
            estimatedEigenvalue: cToString(result.estimatedEigenvalue),
            phaseError: Math.abs(eigenphase - result.estimatedPhase).toFixed(6),
            precision: `±${(1 / (1 << nPrecisionQubits)).toFixed(6)}`,
            topMeasurements: topMeasurements.slice(0, 5).map(m => ({
              measurement: m.binary,
              decimalValue: m.value,
              estimatedPhase: m.phase.toFixed(6),
              probability: (m.probability * 100).toFixed(2) + '%'
            })),
            circuit: result.circuit
          }, null, 2)
        };
      }

      case 'period_finding': {
        const a = args.a || 2;
        const N = args.N || 15;

        if (a <= 1 || a >= N) {
          return { toolCallId: id, content: 'Error: a must satisfy 1 < a < N', isError: true };
        }

        if (N < 3 || N > 100) {
          return { toolCallId: id, content: 'Error: N must be between 3 and 100', isError: true };
        }

        // Check if gcd(a,N) = 1
        const gcd = (x: number, y: number): number => y === 0 ? x : gcd(y, x % y);
        if (gcd(a, N) !== 1) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'period_finding',
              a,
              N,
              note: `gcd(${a}, ${N}) = ${gcd(a, N)} ≠ 1`,
              trivialFactor: gcd(a, N),
              message: 'Non-trivial factor found without quantum computation!'
            }, null, 2)
          };
        }

        const result = findPeriod(a, N);

        // Verify period
        let verification = 'Not verified';
        if (result.period !== null) {
          const check = Math.pow(a, result.period) % N;
          verification = check === 1 ? 'Verified' : 'Failed';
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'period_finding',
            function: `f(x) = ${a}^x mod ${N}`,
            a,
            N,
            nQubitsRequired: result.nQubits,
            period: result.period,
            verification,
            firstFewValues: Array.from({ length: Math.min(result.period || 10, 10) }, (_, i) =>
              ({ x: i, value: Math.pow(a, i) % N })
            ),
            quantumMeasurements: result.probablePeriods.slice(0, 5),
            continuedFractionConvergents: result.convergents.slice(0, 5),
            application: result.period !== null && result.period % 2 === 0 ? {
              note: 'Period is even - can attempt factorization',
              attempt: `gcd(${a}^(${result.period}/2) ± 1, ${N})`,
              factor1: gcd(Math.pow(a, result.period / 2) - 1, N),
              factor2: gcd(Math.pow(a, result.period / 2) + 1, N)
            } : {
              note: 'Period is odd - try different value of a'
            }
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'qft',
            name: 'Quantum Fourier Transform',
            description: 'The QFT transforms a quantum state into its frequency domain representation',
            mathematicalDefinition: {
              forward: 'QFT|j⟩ = (1/√N) Σₖ e^(2πijk/N) |k⟩',
              inverse: 'QFT†|k⟩ = (1/√N) Σⱼ e^(-2πijk/N) |j⟩'
            },
            gateDecomposition: {
              Hadamard: 'Creates superposition',
              controlledPhase: 'CR_k applies e^(2πi/2^k) phase when control is |1⟩',
              swap: 'Reverses qubit order at the end'
            },
            complexity: {
              gates: 'O(n²) where n is number of qubits',
              depth: 'O(n) with parallelization'
            },
            applications: [
              'Quantum phase estimation',
              "Shor's factoring algorithm",
              'Quantum simulation',
              'Quantum machine learning',
              'Hidden subgroup problems'
            ],
            comparisonToClassical: {
              classicalFFT: 'O(N log N) where N = 2^n',
              quantumQFT: 'O(n²) gates on n qubits',
              advantage: 'Exponential speedup in certain applications'
            }
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Forward QFT on |000⟩',
                call: { operation: 'forward', num_qubits: 3, input_state: '000' },
                description: 'Creates uniform superposition of all basis states'
              },
              {
                name: 'Forward QFT on |101⟩',
                call: { operation: 'forward', num_qubits: 3, input_state: '101' },
                description: 'Transform basis state to frequency domain'
              },
              {
                name: 'Inverse QFT',
                call: { operation: 'inverse', num_qubits: 4, input_state: '0000' },
                description: 'Apply inverse QFT'
              },
              {
                name: 'Phase estimation',
                call: { operation: 'phase_estimation', eigenphase: 0.125, num_qubits: 5 },
                description: 'Estimate phase φ = 1/8 = 0.125'
              },
              {
                name: 'Period finding for factoring 15',
                call: { operation: 'period_finding', a: 7, N: 15 },
                description: "Find period of 7^x mod 15 (Shor's algorithm component)"
              }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Error: Unknown operation '${operation}'. Valid: forward, inverse, phase_estimation, period_finding, info, examples`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isqftAvailable(): boolean {
  return true;
}
