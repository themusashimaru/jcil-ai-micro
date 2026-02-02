/**
 * SHOR-ALGORITHM TOOL
 * Shor's quantum factoring algorithm simulation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const shoralgorithmTool: UnifiedTool = {
  name: 'shor_algorithm',
  description: "Shor's quantum factoring algorithm simulation",
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['factor', 'find_period', 'simulate', 'analyze', 'info'], description: 'Operation' },
      number: { type: 'number', description: 'Number to factor (for demo, use small numbers < 100)' },
      base: { type: 'number', description: 'Base for period finding (auto-selected if not provided)' }
    },
    required: ['operation']
  }
};

// Greatest common divisor
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b > 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

// Modular exponentiation
function modPow(base: number, exp: number, mod: number): number {
  let result = 1;
  base = base % mod;
  while (exp > 0) {
    if (exp % 2 === 1) {
      result = (result * base) % mod;
    }
    exp = Math.floor(exp / 2);
    base = (base * base) % mod;
  }
  return result;
}

// Check if number is prime
function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

// Check if n = a^k for some a, k
function isPerfectPower(n: number): { base: number; power: number } | null {
  for (let k = 2; k <= Math.log2(n); k++) {
    const a = Math.round(Math.pow(n, 1 / k));
    for (let base = a - 1; base <= a + 1; base++) {
      if (base > 1 && Math.pow(base, k) === n) {
        return { base, power: k };
      }
    }
  }
  return null;
}

// Classical period finding (for simulation)
function findPeriodClassical(a: number, N: number): number {
  let x = 1;
  for (let r = 1; r < N; r++) {
    x = (x * a) % N;
    if (x === 1) return r;
  }
  return -1;
}

// Continued fractions for approximating s/r
function continuedFractionConvergents(x: number, maxDenom: number): { num: number; denom: number }[] {
  const convergents: { num: number; denom: number }[] = [];
  let [p0, p1] = [0, 1];
  let [q0, q1] = [1, 0];

  let val = x;
  for (let i = 0; i < 20 && q1 < maxDenom; i++) {
    const a = Math.floor(val);
    const pNew = a * p1 + p0;
    const qNew = a * q1 + q0;

    if (qNew > maxDenom) break;

    convergents.push({ num: pNew, denom: qNew });

    [p0, p1] = [p1, pNew];
    [q0, q1] = [q1, qNew];

    if (Math.abs(val - a) < 1e-10) break;
    val = 1 / (val - a);
  }

  return convergents;
}

export async function executeshoralgorithm(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'shor-algorithm',
        description: "Shor's algorithm factors integers in polynomial time on a quantum computer",
        significance: {
          cryptographicImpact: 'Breaks RSA, DSA, and other factoring-based cryptography',
          speedup: 'Exponential speedup over best known classical algorithms',
          practicalStatus: 'Requires error-corrected quantum computer with many qubits'
        },
        complexity: {
          classical: 'Best known: O(exp(n^(1/3))) - Number Field Sieve',
          quantum: 'O((log N)³) - Polynomial time!',
          example: 'RSA-2048: Classical ~10^23 operations, Quantum ~10^9 operations'
        },
        algorithm: {
          '1_checkTrivial': 'Check if N is even, prime, or perfect power',
          '2_pickRandom': 'Pick random a where 1 < a < N',
          '3_checkGCD': 'If gcd(a, N) > 1, we found a factor!',
          '4_quantumPeriod': 'Use quantum computer to find period r of f(x) = a^x mod N',
          '5_extractFactors': 'If r is even and a^(r/2) ≢ -1 (mod N), compute gcd(a^(r/2) ± 1, N)'
        },
        quantumPart: {
          registers: 'Two quantum registers: first for superposition, second for f(x)',
          qft: 'Quantum Fourier Transform extracts period from phase',
          measurement: 'Measure first register, use continued fractions to find r'
        },
        circuit: `
        Shor's Algorithm Circuit:

        |0⟩⊗n ─H⊗n──┌────────────┐──QFT†──M───┐
                    │            │           │ → period r
        |0⟩⊗m ──────│ U_a^(2^j) │────────────┘
                    └────────────┘

        Where U_a|x⟩ = |ax mod N⟩
        `
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'factor') {
      const N = args.number || 15;

      // Input validation
      if (N < 2) {
        return { toolCallId: id, content: JSON.stringify({ error: 'N must be >= 2' }), isError: true };
      }

      if (N > 10000) {
        return { toolCallId: id, content: JSON.stringify({
          error: 'For demonstration, use N < 10000',
          note: 'Real Shor\'s algorithm can factor much larger numbers with sufficient qubits'
        }), isError: true };
      }

      const steps: object[] = [];

      // Step 1: Check if N is even
      if (N % 2 === 0) {
        const result = {
          operation: 'factor',
          N,
          method: 'trivial_even',
          factors: [2, N / 2],
          steps: ['N is even, trivially factor out 2'],
          note: 'No quantum computation needed for even numbers'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      // Step 2: Check if N is prime
      if (isPrime(N)) {
        const result = {
          operation: 'factor',
          N,
          isPrime: true,
          factors: [N],
          steps: ['N is prime, cannot be factored'],
          note: 'Shor\'s algorithm only factors composite numbers'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      // Step 3: Check if N is a perfect power
      const perfectPower = isPerfectPower(N);
      if (perfectPower) {
        const result = {
          operation: 'factor',
          N,
          method: 'perfect_power',
          factors: [perfectPower.base, perfectPower.base],
          decomposition: `${N} = ${perfectPower.base}^${perfectPower.power}`,
          steps: ['N is a perfect power, factor classically'],
          note: 'No quantum computation needed for perfect powers'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      steps.push({ step: 1, action: 'Verified N is odd, composite, and not a perfect power' });

      // Step 4: Try random bases
      let factors: number[] | null = null;
      let successfulAttempt: object | null = null;

      for (let attempt = 0; attempt < 10 && !factors; attempt++) {
        // Pick random a
        const a = 2 + Math.floor(Math.random() * (N - 3));

        const attemptSteps: object[] = [];
        attemptSteps.push({ action: `Pick random base a = ${a}` });

        // Check gcd
        const g = gcd(a, N);
        if (g > 1) {
          factors = [g, N / g];
          attemptSteps.push({ action: `Lucky! gcd(${a}, ${N}) = ${g}` });
          successfulAttempt = { attempt: attempt + 1, base: a, steps: attemptSteps };
          break;
        }

        attemptSteps.push({ action: `gcd(${a}, ${N}) = 1, proceed to period finding` });

        // Find period (simulated quantum)
        const r = findPeriodClassical(a, N);
        attemptSteps.push({
          action: `[QUANTUM] Find period r of f(x) = ${a}^x mod ${N}`,
          result: `r = ${r}`
        });

        if (r === -1 || r % 2 !== 0) {
          attemptSteps.push({ action: `Period ${r} is odd or not found, try new base` });
          continue;
        }

        // Check a^(r/2) ≢ -1 (mod N)
        const aHalfR = modPow(a, r / 2, N);
        if (aHalfR === N - 1) {
          attemptSteps.push({ action: `a^(r/2) = ${aHalfR} ≡ -1 (mod ${N}), try new base` });
          continue;
        }

        attemptSteps.push({ action: `a^(r/2) = ${aHalfR} ≢ -1 (mod ${N}), computing factors` });

        // Compute factors
        const factor1 = gcd(aHalfR - 1, N);
        const factor2 = gcd(aHalfR + 1, N);

        if (factor1 > 1 && factor1 < N) {
          factors = [factor1, N / factor1];
          attemptSteps.push({
            action: `gcd(${aHalfR} - 1, ${N}) = ${factor1}`,
            factors: [factor1, N / factor1]
          });
          successfulAttempt = { attempt: attempt + 1, base: a, period: r, steps: attemptSteps };
        } else if (factor2 > 1 && factor2 < N) {
          factors = [factor2, N / factor2];
          attemptSteps.push({
            action: `gcd(${aHalfR} + 1, ${N}) = ${factor2}`,
            factors: [factor2, N / factor2]
          });
          successfulAttempt = { attempt: attempt + 1, base: a, period: r, steps: attemptSteps };
        }
      }

      if (!factors) {
        // Fallback to trial division for demo
        for (let i = 3; i * i <= N; i += 2) {
          if (N % i === 0) {
            factors = [i, N / i];
            break;
          }
        }
      }

      const result = {
        operation: 'factor',
        N,
        factors: factors || ['Unable to factor'],
        successfulAttempt,
        verification: factors ? `${factors[0]} × ${factors[1]} = ${factors[0] * factors[1]}` : null,
        quantumAdvantage: {
          keyStep: 'Period finding via Quantum Fourier Transform',
          classicalComplexity: 'Exponential in number of bits',
          quantumComplexity: 'Polynomial in number of bits'
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'find_period') {
      const N = args.number || 15;
      const a = args.base || 7;

      if (gcd(a, N) !== 1) {
        return { toolCallId: id, content: JSON.stringify({
          error: `gcd(${a}, ${N}) = ${gcd(a, N)} ≠ 1`,
          note: 'Base a must be coprime to N for period finding'
        }), isError: true };
      }

      // Generate sequence a^x mod N
      const sequence: { x: number; value: number }[] = [];
      let x = 1;
      for (let i = 0; i <= N && i < 30; i++) {
        sequence.push({ x: i, value: i === 0 ? 1 : x });
        x = (x * a) % N;
      }

      const period = findPeriodClassical(a, N);

      // Simulate quantum measurement
      const Q = 1 << Math.ceil(2 * Math.log2(N)); // Size of first register
      const simulatedPhase = Math.floor(Math.random() * period) / period;
      const convergents = continuedFractionConvergents(simulatedPhase, N);

      const result = {
        operation: 'find_period',
        N,
        base: a,
        function: `f(x) = ${a}^x mod ${N}`,
        sequence: sequence.slice(0, Math.min(period + 5, 20)),
        period,
        verification: `${a}^${period} mod ${N} = ${modPow(a, period, N)}`,
        quantumSimulation: {
          registerSize: Q,
          simulatedPhase: simulatedPhase.toFixed(6),
          explanation: 'QFT measures phase ≈ s/r where r is the period',
          continuedFractions: convergents.slice(0, 5).map(c => ({
            convergent: `${c.num}/${c.denom}`,
            possiblePeriod: c.denom
          }))
        },
        periodProperties: {
          isEven: period % 2 === 0,
          halfPower: period % 2 === 0 ? modPow(a, period / 2, N) : 'N/A (period is odd)',
          usableForFactoring: period % 2 === 0 && modPow(a, period / 2, N) !== N - 1
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'simulate') {
      const N = args.number || 15;
      const a = args.base || 7;

      if (gcd(a, N) !== 1) {
        const g = gcd(a, N);
        return { toolCallId: id, content: JSON.stringify({
          simulation: 'Lucky case!',
          N,
          base: a,
          gcd: g,
          factors: [g, N / g],
          note: 'No quantum computation needed when gcd(a,N) > 1'
        }, null, 2) };
      }

      const period = findPeriodClassical(a, N);
      const numQubitsFirst = Math.ceil(2 * Math.log2(N));
      const numQubitsSecond = Math.ceil(Math.log2(N));
      const Q = 1 << numQubitsFirst;

      const simulation = {
        operation: 'simulate',
        problem: {
          N,
          base: a,
          goal: `Find period r such that ${a}^r ≡ 1 (mod ${N})`
        },
        quantumCircuit: {
          firstRegister: {
            qubits: numQubitsFirst,
            dimension: Q,
            initial: '|0⟩⊗' + numQubitsFirst,
            afterHadamard: 'Uniform superposition of all x from 0 to Q-1'
          },
          secondRegister: {
            qubits: numQubitsSecond,
            initial: '|0⟩⊗' + numQubitsSecond,
            afterModExp: `Entangled: Σ|x⟩|${a}^x mod ${N}⟩`
          }
        },
        steps: [
          {
            step: 1,
            name: 'Hadamard on first register',
            state: `|ψ₁⟩ = (1/√Q) Σ|x⟩|0⟩ for x = 0 to ${Q - 1}`
          },
          {
            step: 2,
            name: 'Modular exponentiation',
            state: `|ψ₂⟩ = (1/√Q) Σ|x⟩|${a}^x mod ${N}⟩`,
            note: 'This is the expensive classical part implemented quantumly'
          },
          {
            step: 3,
            name: 'Measure second register',
            result: `Some value ${a}^k mod ${N}`,
            collapseEffect: `First register collapses to superposition of x where ${a}^x ≡ ${a}^k (mod ${N})`
          },
          {
            step: 4,
            name: 'Quantum Fourier Transform',
            effect: 'Transforms periodicity in x-values to peaks at multiples of Q/r',
            state: 'Peaks at j where j ≈ kQ/r for some integer k'
          },
          {
            step: 5,
            name: 'Measure first register',
            result: 'Get value j close to kQ/r',
            continuedFractions: 'Use continued fractions on j/Q to find r'
          }
        ],
        actualPeriod: period,
        qftOutput: {
          peakLocations: Array.from({ length: period }, (_, k) =>
            Math.round(k * Q / period)
          ).slice(0, 5),
          explanation: 'QFT produces peaks at multiples of Q/r'
        },
        factorizationResult: period % 2 === 0 && modPow(a, period / 2, N) !== N - 1 ? {
          halfPeriod: period / 2,
          aHalfR: modPow(a, period / 2, N),
          factor1: gcd(modPow(a, period / 2, N) - 1, N),
          factor2: gcd(modPow(a, period / 2, N) + 1, N)
        } : {
          issue: period % 2 !== 0 ? 'Period is odd' : 'a^(r/2) ≡ -1 (mod N)',
          action: 'Try different base a'
        }
      };

      return { toolCallId: id, content: JSON.stringify(simulation, null, 2) };
    }

    if (operation === 'analyze') {
      const N = args.number || 2048;

      const numBits = Math.ceil(Math.log2(N));
      const qubitsNeeded = 2 * numBits + 3; // Approximate
      const tGatesNeeded = 12 * numBits ** 3; // Very rough estimate

      const analysis = {
        operation: 'analyze',
        numberToFactor: N,
        bitLength: numBits,
        resourceEstimates: {
          logicalQubits: qubitsNeeded,
          tGates: tGatesNeeded,
          circuitDepth: `O(n³) ≈ ${numBits ** 3}`,
          note: 'Actual resources depend on implementation and error correction'
        },
        complexityComparison: {
          classicalBest: {
            algorithm: 'General Number Field Sieve',
            complexity: `O(exp(1.9 * n^(1/3) * (log n)^(2/3)))`,
            estimatedOperations: Math.exp(1.9 * Math.pow(numBits, 1 / 3) * Math.pow(Math.log(numBits), 2 / 3)).toExponential(2)
          },
          quantum: {
            algorithm: "Shor's Algorithm",
            complexity: 'O(n³)',
            estimatedOperations: numBits ** 3
          },
          speedup: 'Exponential'
        },
        cryptographicImplications: {
          RSA: numBits >= 2048 ?
            'Current RSA-2048 keys would be broken in hours/days with sufficient qubits' :
            'Smaller keys already vulnerable',
          affectedSystems: [
            'RSA encryption',
            'Digital signatures (RSA, DSA)',
            'Diffie-Hellman key exchange',
            'Elliptic Curve Cryptography (via different algorithm)'
          ],
          quantumSafe: [
            'Lattice-based cryptography',
            'Hash-based signatures',
            'Code-based cryptography',
            'Multivariate cryptography'
          ]
        },
        currentStatus: {
          largestFactored: '21 (on actual quantum hardware)',
          year: 2012,
          limitation: 'Noise and limited qubits prevent larger factorizations',
          outlook: 'Fault-tolerant quantum computers needed for cryptographic sizes'
        }
      };

      return { toolCallId: id, content: JSON.stringify(analysis, null, 2) };
    }

    return { toolCallId: id, content: JSON.stringify({ error: 'Unknown operation', operation }, null, 2), isError: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isshoralgorithmAvailable(): boolean { return true; }
