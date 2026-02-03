/**
 * SHOR-ALGORITHM TOOL
 * Shor's quantum factoring algorithm - complete implementation
 * Simulates quantum period finding for integer factorization
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// MATHEMATICAL UTILITIES
// ============================================================================

/**
 * Greatest Common Divisor using Euclidean algorithm
 */
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

/**
 * Modular exponentiation: (base^exp) mod m
 */
function modPow(base: number, exp: number, m: number): number {
  if (m === 1) return 0;
  let result = 1;
  base = base % m;
  while (exp > 0) {
    if (exp % 2 === 1) {
      result = (result * base) % m;
    }
    exp = Math.floor(exp / 2);
    base = (base * base) % m;
  }
  return result;
}

/**
 * Check if n is prime using trial division
 */
function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i <= Math.sqrt(n); i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

/**
 * Check if n is a perfect power (n = a^k for some a, k > 1)
 */
function isPerfectPower(n: number): { base: number; power: number } | null {
  for (let k = 2; k <= Math.log2(n); k++) {
    const root = Math.round(Math.pow(n, 1 / k));
    // Check nearby integers due to floating point
    for (const candidate of [root - 1, root, root + 1]) {
      if (candidate > 1 && Math.pow(candidate, k) === n) {
        return { base: candidate, power: k };
      }
    }
  }
  return null;
}

/**
 * Find period r such that a^r ≡ 1 (mod N) using classical method
 * This is what the quantum part of Shor's algorithm finds efficiently
 */
function findPeriodClassical(a: number, N: number): number {
  let r = 1;
  let current = a % N;
  while (current !== 1 && r < N) {
    current = (current * a) % N;
    r++;
  }
  return current === 1 ? r : -1;
}

// ============================================================================
// COMPLEX NUMBER ARITHMETIC
// ============================================================================

interface Complex {
  re: number;
  im: number;
}

function complexMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function complexAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function complexScale(c: Complex, s: number): Complex {
  return { re: c.re * s, im: c.im * s };
}

function complexExp(theta: number): Complex {
  return { re: Math.cos(theta), im: Math.sin(theta) };
}

function complexMagnitudeSq(c: Complex): number {
  return c.re * c.re + c.im * c.im;
}

// ============================================================================
// QUANTUM FOURIER TRANSFORM
// ============================================================================

interface QuantumState {
  size: number; // Number of basis states
  amplitudes: Complex[];
}

/**
 * Apply Quantum Fourier Transform to the state
 * QFT: |j⟩ → (1/√N) Σₖ e^(2πijk/N) |k⟩
 */
function applyQFT(state: QuantumState): QuantumState {
  const N = state.size;
  const newAmplitudes: Complex[] = new Array(N);
  const normFactor = 1 / Math.sqrt(N);

  for (let k = 0; k < N; k++) {
    let sum: Complex = { re: 0, im: 0 };
    for (let j = 0; j < N; j++) {
      const phase = (2 * Math.PI * j * k) / N;
      const omega = complexExp(phase);
      const term = complexMul(state.amplitudes[j], omega);
      sum = complexAdd(sum, term);
    }
    newAmplitudes[k] = complexScale(sum, normFactor);
  }

  return { size: N, amplitudes: newAmplitudes };
}

// ============================================================================
// CONTINUED FRACTIONS
// ============================================================================

interface ContinuedFraction {
  coefficients: number[];
  convergents: Array<{ numerator: number; denominator: number }>;
}

/**
 * Expand a fraction p/q into continued fraction form
 */
function toContinuedFraction(p: number, q: number, maxTerms: number = 20): ContinuedFraction {
  const coefficients: number[] = [];
  const convergents: Array<{ numerator: number; denominator: number }> = [];

  let pPrev = 1,
    pCurr = 0;
  let qPrev = 0,
    qCurr = 1;

  let num = p,
    den = q;

  while (den !== 0 && coefficients.length < maxTerms) {
    const a = Math.floor(num / den);
    coefficients.push(a);

    const pNext = a * pCurr + pPrev;
    const qNext = a * qCurr + qPrev;

    convergents.push({ numerator: pNext, denominator: qNext });

    pPrev = pCurr;
    pCurr = pNext;
    qPrev = qCurr;
    qCurr = qNext;

    const temp = num - a * den;
    num = den;
    den = temp;
  }

  return { coefficients, convergents };
}

/**
 * Find period from QFT measurement using continued fractions
 */
function periodFromMeasurement(measurement: number, Q: number, N: number): number[] {
  // measurement/Q ≈ s/r for some integer s
  const cf = toContinuedFraction(measurement, Q);
  const candidates: number[] = [];

  for (const conv of cf.convergents) {
    const r = conv.denominator;
    if (r > 0 && r < N) {
      candidates.push(r);
    }
  }

  return candidates;
}

// ============================================================================
// SHOR'S ALGORITHM CORE
// ============================================================================

interface FactorizationResult {
  N: number;
  factors: number[];
  success: boolean;
  method: string;
  details: Record<string, unknown>;
}

interface PeriodFindingResult {
  a: number;
  N: number;
  period: number | null;
  measurements: number[];
  candidatePeriods: number[];
  success: boolean;
}

interface SimulationResult {
  N: number;
  numQubits: number;
  registerSize: number;
  a: number;
  stateEvolution: Array<{
    step: string;
    description: string;
    sampleAmplitudes?: Array<{ state: number; amplitude: Complex; probability: number }>;
  }>;
  measurements: number[];
  extractedPeriod: number | null;
}

/**
 * Classical preprocessing checks before quantum algorithm
 */
function classicalPreprocessing(N: number): FactorizationResult | null {
  // Check if N is even
  if (N % 2 === 0) {
    return {
      N,
      factors: [2, N / 2],
      success: true,
      method: 'trivial_even',
      details: { reason: 'N is even, trivially divisible by 2' },
    };
  }

  // Check if N is prime
  if (isPrime(N)) {
    return {
      N,
      factors: [N],
      success: true,
      method: 'prime',
      details: { reason: 'N is prime, cannot be factored' },
    };
  }

  // Check if N is a perfect power
  const powerCheck = isPerfectPower(N);
  if (powerCheck) {
    return {
      N,
      factors: Array(powerCheck.power).fill(powerCheck.base),
      success: true,
      method: 'perfect_power',
      details: { base: powerCheck.base, power: powerCheck.power },
    };
  }

  return null;
}

/**
 * Choose random base a coprime to N
 */
function chooseBase(N: number, excludeList: number[] = []): number {
  const candidates: number[] = [];
  for (let a = 2; a < N; a++) {
    if (!excludeList.includes(a) && gcd(a, N) === 1) {
      candidates.push(a);
    }
  }

  if (candidates.length === 0) {
    throw new Error('No valid base found');
  }

  // Return a pseudo-random choice
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Simulate quantum period finding
 * In real quantum hardware, this would use exponential speedup
 */
function simulatePeriodFinding(a: number, N: number): PeriodFindingResult {
  // Q should be the smallest power of 2 >= N^2
  const Q = Math.pow(2, Math.ceil(2 * Math.log2(N)));

  // Create state: superposition over x values
  // |ψ⟩ = (1/√Q) Σₓ |x⟩ |a^x mod N⟩

  // After measuring the second register, we collapse to states where a^x mod N = some value
  // The first register then contains multiples of Q/r (plus noise)

  // Simulate measurements
  const measurements: number[] = [];
  const candidatePeriods: number[] = [];
  const numMeasurements = 5;

  // Find actual period classically (this is what quantum does efficiently)
  const actualPeriod = findPeriodClassical(a, N);

  if (actualPeriod === -1) {
    return {
      a,
      N,
      period: null,
      measurements: [],
      candidatePeriods: [],
      success: false,
    };
  }

  // Simulate QFT measurements
  // In actual quantum computation, we'd measure s*Q/r for random s
  for (let i = 0; i < numMeasurements; i++) {
    const s = Math.floor(Math.random() * actualPeriod);
    const measurement = Math.round((s * Q) / actualPeriod) % Q;
    measurements.push(measurement);

    // Extract period candidates using continued fractions
    const candidates = periodFromMeasurement(measurement, Q, N);
    for (const c of candidates) {
      if (!candidatePeriods.includes(c)) {
        candidatePeriods.push(c);
      }
    }
  }

  // Verify candidates
  let foundPeriod: number | null = null;
  for (const r of candidatePeriods) {
    if (modPow(a, r, N) === 1) {
      foundPeriod = r;
      break;
    }
  }

  return {
    a,
    N,
    period: foundPeriod,
    measurements,
    candidatePeriods,
    success: foundPeriod !== null,
  };
}

/**
 * Full Shor's algorithm for factoring N
 */
function factorWithShor(N: number): FactorizationResult {
  // Classical preprocessing
  const preprocessResult = classicalPreprocessing(N);
  if (preprocessResult) {
    return preprocessResult;
  }

  const maxAttempts = 10;
  const triedBases: number[] = [];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Step 1: Choose random a
    let a: number;
    try {
      a = chooseBase(N, triedBases);
      triedBases.push(a);
    } catch {
      break;
    }

    // Check if a already shares a factor with N (lucky case)
    const g = gcd(a, N);
    if (g > 1) {
      return {
        N,
        factors: [g, N / g],
        success: true,
        method: 'lucky_gcd',
        details: { a, gcd: g, attempt },
      };
    }

    // Step 2: Quantum period finding
    const periodResult = simulatePeriodFinding(a, N);

    if (!periodResult.success || periodResult.period === null) {
      continue;
    }

    const r = periodResult.period;

    // Step 3: Check if r is even
    if (r % 2 !== 0) {
      continue; // Try another a
    }

    // Step 4: Check if a^(r/2) ≡ -1 (mod N)
    const aToRHalf = modPow(a, r / 2, N);
    if (aToRHalf === N - 1) {
      continue; // Try another a
    }

    // Step 5: Compute factors
    const factor1 = gcd(aToRHalf - 1, N);
    const factor2 = gcd(aToRHalf + 1, N);

    const factors: number[] = [];
    if (factor1 > 1 && factor1 < N) factors.push(factor1);
    if (factor2 > 1 && factor2 < N && factor2 !== factor1) factors.push(factor2);

    if (factors.length > 0) {
      // Verify
      if (factors.length === 2 && factors[0] * factors[1] === N) {
        return {
          N,
          factors: factors.sort((a, b) => a - b),
          success: true,
          method: 'shor_quantum',
          details: {
            a,
            period: r,
            aToRHalf,
            factor1,
            factor2,
            attempt,
            periodFindingDetails: periodResult,
          },
        };
      } else if (factors.length === 1) {
        const otherFactor = N / factors[0];
        if (Number.isInteger(otherFactor)) {
          return {
            N,
            factors: [factors[0], otherFactor].sort((a, b) => a - b),
            success: true,
            method: 'shor_quantum',
            details: { a, period: r, attempt },
          };
        }
      }
    }
  }

  return {
    N,
    factors: [],
    success: false,
    method: 'shor_failed',
    details: { maxAttempts, triedBases },
  };
}

/**
 * Detailed simulation showing quantum state evolution
 */
function detailedSimulation(N: number, a?: number): SimulationResult {
  // Determine qubit requirements
  const nBits = Math.ceil(Math.log2(N));
  const numQubits = 2 * nBits; // For precision
  const Q = Math.pow(2, numQubits);

  // Choose or use provided base
  if (a === undefined || gcd(a, N) !== 1) {
    for (let candidate = 2; candidate < N; candidate++) {
      if (gcd(candidate, N) === 1) {
        a = candidate;
        break;
      }
    }
    if (a === undefined) a = 2;
  }

  const stateEvolution: SimulationResult['stateEvolution'] = [];

  // Step 1: Initialize
  stateEvolution.push({
    step: 'initialize',
    description: `Initialize ${numQubits}-qubit control register and ${nBits}-qubit target register to |0⟩`,
  });

  // Step 2: Apply Hadamard to control register
  stateEvolution.push({
    step: 'hadamard',
    description: `Apply Hadamard gates to create uniform superposition: (1/√${Q}) Σ|x⟩|0⟩`,
    sampleAmplitudes: [
      { state: 0, amplitude: { re: 1 / Math.sqrt(Q), im: 0 }, probability: 1 / Q },
      { state: 1, amplitude: { re: 1 / Math.sqrt(Q), im: 0 }, probability: 1 / Q },
      { state: Q - 1, amplitude: { re: 1 / Math.sqrt(Q), im: 0 }, probability: 1 / Q },
    ],
  });

  // Step 3: Apply controlled-U operations (modular exponentiation)
  stateEvolution.push({
    step: 'modular_exponentiation',
    description: `Apply controlled-U^(2^k) operations to compute |x⟩|${a}^x mod ${N}⟩`,
  });

  // Step 4: Measure target register
  const actualPeriod = findPeriodClassical(a, N);
  stateEvolution.push({
    step: 'measure_target',
    description: `Measure target register, collapsing to states where ${a}^x ≡ f (mod ${N}) for some f`,
    sampleAmplitudes:
      actualPeriod > 0
        ? [
            {
              state: 0,
              amplitude: { re: Math.sqrt(actualPeriod / Q), im: 0 },
              probability: actualPeriod / Q,
            },
            {
              state: actualPeriod,
              amplitude: { re: Math.sqrt(actualPeriod / Q), im: 0 },
              probability: actualPeriod / Q,
            },
          ]
        : undefined,
  });

  // Step 5: Apply inverse QFT
  stateEvolution.push({
    step: 'inverse_qft',
    description: 'Apply inverse Quantum Fourier Transform to control register',
  });

  // Step 6: Measure
  const measurements: number[] = [];
  for (let i = 0; i < 5; i++) {
    if (actualPeriod > 0) {
      const s = Math.floor(Math.random() * actualPeriod);
      measurements.push(Math.round((s * Q) / actualPeriod) % Q);
    }
  }

  stateEvolution.push({
    step: 'measure_control',
    description: `Measure control register, obtaining values close to multiples of Q/r = ${Q}/${actualPeriod}`,
  });

  // Extract period
  let extractedPeriod: number | null = null;
  for (const m of measurements) {
    const candidates = periodFromMeasurement(m, Q, N);
    for (const c of candidates) {
      if (modPow(a, c, N) === 1) {
        extractedPeriod = c;
        break;
      }
    }
    if (extractedPeriod) break;
  }

  return {
    N,
    numQubits,
    registerSize: Q,
    a,
    stateEvolution,
    measurements,
    extractedPeriod,
  };
}

/**
 * Analyze complexity and requirements for factoring N
 */
function analyzeComplexity(N: number): Record<string, unknown> {
  const nBits = Math.ceil(Math.log2(N));
  const controlQubits = 2 * nBits;
  const targetQubits = nBits;
  const totalQubits = controlQubits + targetQubits;

  // Gate complexity (roughly)
  const hadamardGates = controlQubits;
  const controlledUGates = controlQubits; // Each U^(2^k)
  const qftGates = (controlQubits * (controlQubits + 1)) / 2; // Hadamards + controlled phase

  // Classical post-processing
  const continuedFractionSteps = Math.ceil(Math.log2(N)) * 2;

  return {
    numberToFactor: N,
    bitLength: nBits,
    qubitRequirements: {
      controlRegister: controlQubits,
      targetRegister: targetQubits,
      total: totalQubits,
      note: 'Additional ancilla qubits may be needed for modular exponentiation',
    },
    gateComplexity: {
      hadamardGates,
      controlledModExpGates: controlQubits,
      qftGates,
      totalApproximate: hadamardGates + controlledUGates * nBits * nBits + qftGates,
      dominatingTerm: `O(n³) where n = ${nBits} (bit length)`,
      note: 'Modular exponentiation dominates with O(n³) gates',
    },
    classicalComplexity: {
      continuedFractionSteps,
      gcdOperations: 'O(n)',
      totalClassical: 'O(n² log n)',
    },
    quantumSpeedup: {
      classical: `O(exp(n^(1/3) * (log n)^(2/3))) - best known (Number Field Sieve)`,
      quantum: "O(n³) - Shor's algorithm",
      speedup: 'Exponential',
    },
    successProbability: {
      singleRun: 'O(1/log log N)',
      withRepetition: 'Approaches 1 with O(log N) repetitions',
    },
    currentHardwareLimitations: {
      largestFactored: 21,
      note: "As of 2023, largest number factored using Shor's on quantum hardware",
      requirement: `Factoring ${N} would require ~${totalQubits} logical qubits with error correction`,
    },
  };
}

// ============================================================================
// TOOL INTERFACE
// ============================================================================

export const shoralgorithmTool: UnifiedTool = {
  name: 'shor_algorithm',
  description:
    "Shor's quantum factoring algorithm - simulates quantum period finding for integer factorization with QFT, continued fractions, and complexity analysis",
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['factor', 'simulate', 'analyze', 'period_find', 'qft', 'info'],
        description:
          'Operation: factor (run full algorithm), simulate (detailed state evolution), analyze (complexity analysis), period_find (just period finding), qft (demonstrate QFT), info (algorithm explanation)',
      },
      number: {
        type: 'number',
        description: 'Number to factor (for factor/simulate/analyze/period_find)',
      },
      base: {
        type: 'number',
        description:
          'Base a for period finding (optional, will be chosen randomly if not provided)',
      },
      stateSize: {
        type: 'number',
        description: 'Size of quantum state for QFT demonstration (power of 2)',
      },
    },
    required: ['operation'],
  },
};

export async function executeshoralgorithm(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    switch (operation) {
      case 'factor': {
        const N = args.number;
        if (!N || N < 2 || !Number.isInteger(N)) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                error: 'Please provide a valid integer N >= 2 to factor',
                usage: 'shor_algorithm factor with number: 15',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        if (N > 10000) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                error: 'Number too large for simulation',
                note: 'This is a classical simulation. Real quantum hardware would be needed for large numbers.',
                maxRecommended: 10000,
              },
              null,
              2
            ),
            isError: true,
          };
        }

        const result = factorWithShor(N);
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'factor',
              result,
              verification:
                result.success && result.factors.length === 2
                  ? `${result.factors[0]} × ${result.factors[1]} = ${result.factors[0] * result.factors[1]}`
                  : null,
            },
            null,
            2
          ),
        };
      }

      case 'simulate': {
        const N = args.number || 15;
        const a = args.base;

        if (N < 2 || N > 1000) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                error: 'Number must be between 2 and 1000 for detailed simulation',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        const simulation = detailedSimulation(N, a);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'simulate',
              simulation,
              interpretation: {
                purpose: "Demonstrates quantum state evolution through Shor's algorithm",
                keyInsight: `The QFT extracts the period ${simulation.extractedPeriod} from interference patterns`,
                quantumAdvantage: 'Superposition allows testing all x values simultaneously',
              },
            },
            null,
            2
          ),
        };
      }

      case 'analyze': {
        const N = args.number || 15;
        const analysis = analyzeComplexity(N);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'analyze',
              analysis,
            },
            null,
            2
          ),
        };
      }

      case 'period_find': {
        const N = args.number;
        let a = args.base;

        if (!N || N < 2) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                error: 'Please provide valid N >= 2',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        if (!a || gcd(a, N) !== 1) {
          // Find valid base
          for (let candidate = 2; candidate < N; candidate++) {
            if (gcd(candidate, N) === 1) {
              a = candidate;
              break;
            }
          }
        }

        const periodResult = simulatePeriodFinding(a, N);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'period_find',
              result: periodResult,
              verification:
                periodResult.period !== null
                  ? `${a}^${periodResult.period} mod ${N} = ${modPow(a, periodResult.period, N)}`
                  : 'Period not found',
            },
            null,
            2
          ),
        };
      }

      case 'qft': {
        const size = args.stateSize || 8;

        if (size < 2 || size > 64 || (size & (size - 1)) !== 0) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                error: 'State size must be a power of 2 between 2 and 64',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        // Create computational basis state |1⟩
        const inputState: QuantumState = {
          size,
          amplitudes: new Array(size)
            .fill(null)
            .map((_, i) => (i === 1 ? { re: 1, im: 0 } : { re: 0, im: 0 })),
        };

        const outputState = applyQFT(inputState);

        // Format for display
        const inputAmplitudes = inputState.amplitudes
          .map((amp, i) => ({
            state: i,
            amplitude: amp,
            probability: complexMagnitudeSq(amp),
          }))
          .filter((a) => a.probability > 1e-10);

        const outputAmplitudes = outputState.amplitudes.map((amp, i) => ({
          state: i,
          amplitude: { re: Number(amp.re.toFixed(6)), im: Number(amp.im.toFixed(6)) },
          probability: Number(complexMagnitudeSq(amp).toFixed(6)),
        }));

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'qft',
              stateSize: size,
              inputState: {
                description: '|1⟩ - computational basis state',
                amplitudes: inputAmplitudes,
              },
              outputState: {
                description: 'QFT|1⟩ - uniform superposition with phase progression',
                amplitudes: outputAmplitudes,
              },
              formula: 'QFT|j⟩ = (1/√N) Σₖ e^(2πijk/N) |k⟩',
              verification: {
                totalProbability: outputAmplitudes.reduce((sum, a) => sum + a.probability, 0),
                note: 'QFT preserves total probability (unitary operation)',
              },
            },
            null,
            2
          ),
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              algorithm: "Shor's Algorithm",
              type: 'Quantum Integer Factorization',
              inventor: 'Peter Shor (1994)',

              overview: {
                purpose: 'Factor composite integers efficiently using quantum computing',
                significance:
                  'Demonstrates exponential quantum speedup over best known classical algorithms',
                securityImplication: 'Threatens RSA and other factoring-based cryptosystems',
              },

              algorithmSteps: [
                '1. Classical preprocessing: Check for trivial factors (even, prime, perfect power)',
                '2. Choose random base a coprime to N',
                '3. Quantum period finding: Find r where a^r ≡ 1 (mod N)',
                '   - Initialize: |0⟩|0⟩ (control and target registers)',
                '   - Hadamard on control: (1/√Q)Σ|x⟩|0⟩',
                '   - Modular exponentiation: (1/√Q)Σ|x⟩|a^x mod N⟩',
                '   - Inverse QFT on control register',
                '   - Measure to get s/r approximation',
                '4. Use continued fractions to extract period r from measurement',
                '5. If r is even and a^(r/2) ≢ -1 (mod N):',
                '   - Compute gcd(a^(r/2) ± 1, N) to find factors',
                '6. Repeat with different base if needed',
              ],

              keyComponents: {
                quantumFourierTransform: {
                  purpose: 'Extracts periodicity from quantum states',
                  action: '|j⟩ → (1/√N) Σₖ e^(2πijk/N) |k⟩',
                  efficiency: 'O(n²) gates vs O(n·2^n) classical FFT on superposition',
                },
                modularExponentiation: {
                  purpose: 'Computes a^x mod N for all x in superposition',
                  action: '|x⟩|0⟩ → |x⟩|a^x mod N⟩',
                  note: 'Most gate-intensive part of the algorithm',
                },
                continuedFractions: {
                  purpose: 'Extracts exact period r from measured fraction s/r',
                  classical: 'Efficient classical algorithm O(log N)',
                },
              },

              complexity: {
                quantum: 'O(n³) gates where n = log₂(N)',
                classical: 'O(exp(n^(1/3) × (log n)^(2/3))) - Number Field Sieve',
                speedup: 'Exponential',
              },

              operations: [
                'factor: Run complete factorization algorithm',
                'simulate: Show detailed quantum state evolution',
                'analyze: Analyze complexity and qubit requirements',
                'period_find: Run just the quantum period finding',
                'qft: Demonstrate Quantum Fourier Transform',
                'info: This documentation',
              ],

              examples: [
                { operation: 'factor', number: 15, expected: '[3, 5]' },
                { operation: 'factor', number: 21, expected: '[3, 7]' },
                { operation: 'factor', number: 35, expected: '[5, 7]' },
                { operation: 'simulate', number: 15, description: 'See quantum state evolution' },
                {
                  operation: 'analyze',
                  number: 2048,
                  description: 'Analyze RSA-2048 requirements',
                },
              ],

              historicalMilestones: [
                { year: 1994, event: 'Shor publishes algorithm' },
                { year: 2001, event: 'IBM factors 15 using 7 qubits' },
                { year: 2012, event: '21 factored using quantum optimization' },
                { year: 2019, event: 'Google achieves quantum supremacy (not factoring)' },
              ],

              note: 'This tool provides classical simulation of the quantum algorithm. True quantum advantage requires actual quantum hardware.',
            },
            null,
            2
          ),
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              error: `Unknown operation: ${operation}`,
              validOperations: ['factor', 'simulate', 'analyze', 'period_find', 'qft', 'info'],
            },
            null,
            2
          ),
          isError: true,
        };
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error in Shor's algorithm: ${errorMessage}`,
      isError: true,
    };
  }
}

export function isshoralgorithmAvailable(): boolean {
  return true;
}
