/**
 * GROVER-ALGORITHM TOOL
 * Grover's quantum search algorithm - Quadratic speedup for unstructured search
 *
 * Complete implementation of Grover's algorithm:
 * - Oracle construction for marked states
 * - Diffusion operator (Grover diffusion)
 * - Optimal iteration count calculation
 * - Success probability analysis
 * - Multi-solution search
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

export function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function cScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

function cAbsSq(a: Complex): number {
  return a.re * a.re + a.im * a.im;
}

// ============================================================================
// QUANTUM STATE OPERATIONS
// ============================================================================

interface QuantumState {
  numQubits: number;
  amplitudes: Complex[];
}

function createUniformSuperposition(numQubits: number): QuantumState {
  const dim = 1 << numQubits;
  const amp = 1 / Math.sqrt(dim);
  return {
    numQubits,
    amplitudes: Array(dim)
      .fill(null)
      .map(() => complex(amp)),
  };
}

function getProbabilities(state: QuantumState): number[] {
  return state.amplitudes.map((a) => cAbsSq(a));
}

function measureState(state: QuantumState): number {
  const probs = getProbabilities(state);
  const rand = Math.random();
  let cumProb = 0;

  for (let i = 0; i < probs.length; i++) {
    cumProb += probs[i];
    if (rand < cumProb) return i;
  }

  return probs.length - 1;
}

// ============================================================================
// GROVER'S ALGORITHM COMPONENTS
// ============================================================================

/**
 * Apply Oracle - flips sign of marked states
 */
function applyOracle(state: QuantumState, markedStates: number[]): QuantumState {
  const newAmplitudes = state.amplitudes.map((amp, idx) => {
    if (markedStates.includes(idx)) {
      return cScale(amp, -1); // Flip sign
    }
    return amp;
  });

  return { numQubits: state.numQubits, amplitudes: newAmplitudes };
}

/**
 * Apply Grover Diffusion Operator (inversion about mean)
 * D = 2|s⟩⟨s| - I where |s⟩ is uniform superposition
 */
function applyDiffusion(state: QuantumState): QuantumState {
  const dim = state.amplitudes.length;

  // Calculate mean amplitude
  let mean = complex(0, 0);
  for (const amp of state.amplitudes) {
    mean = cAdd(mean, amp);
  }
  mean = cScale(mean, 1 / dim);

  // Apply inversion about mean: 2*mean - amplitude
  const newAmplitudes = state.amplitudes.map((amp) => {
    return cAdd(cScale(mean, 2), cScale(amp, -1));
  });

  return { numQubits: state.numQubits, amplitudes: newAmplitudes };
}

/**
 * Single Grover iteration: Oracle followed by Diffusion
 */
function groverIteration(state: QuantumState, markedStates: number[]): QuantumState {
  state = applyOracle(state, markedStates);
  state = applyDiffusion(state);
  return state;
}

/**
 * Calculate optimal number of iterations
 * k ≈ π/4 * √(N/M) where N = search space, M = number of solutions
 */
function optimalIterations(searchSpaceSize: number, numSolutions: number): number {
  if (numSolutions === 0 || numSolutions >= searchSpaceSize) return 0;
  const theta = Math.asin(Math.sqrt(numSolutions / searchSpaceSize));
  return Math.round((Math.PI / 4 - theta / 2) / theta);
}

/**
 * Calculate success probability after k iterations
 */
function successProbability(
  searchSpaceSize: number,
  numSolutions: number,
  iterations: number
): number {
  if (numSolutions === 0) return 0;
  if (numSolutions >= searchSpaceSize) return 1;

  const theta = Math.asin(Math.sqrt(numSolutions / searchSpaceSize));
  return Math.sin((2 * iterations + 1) * theta) ** 2;
}

/**
 * Run full Grover's algorithm simulation
 */
function runGrover(
  numQubits: number,
  markedStates: number[],
  iterations?: number
): {
  initialState: QuantumState;
  finalState: QuantumState;
  stateHistory: Array<{ iteration: number; probabilities: Record<string, number> }>;
  measurements: number[];
  successCount: number;
} {
  const searchSpaceSize = 1 << numQubits;
  const numSolutions = markedStates.length;

  // Calculate optimal iterations if not specified
  const numIterations = iterations ?? optimalIterations(searchSpaceSize, numSolutions);

  // Initialize in uniform superposition (after H^⊗n on |0⟩^⊗n)
  const initialState = createUniformSuperposition(numQubits);
  let state = { ...initialState, amplitudes: [...initialState.amplitudes] };

  const stateHistory: Array<{ iteration: number; probabilities: Record<string, number> }> = [];

  // Record initial state
  const initialProbs: Record<string, number> = {};
  const probs = getProbabilities(state);
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > 1e-10) {
      initialProbs[i.toString(2).padStart(numQubits, '0')] = probs[i];
    }
  }
  stateHistory.push({ iteration: 0, probabilities: initialProbs });

  // Apply Grover iterations
  for (let k = 1; k <= numIterations; k++) {
    state = groverIteration(state, markedStates);

    // Record state after each iteration
    const iterProbs: Record<string, number> = {};
    const currentProbs = getProbabilities(state);
    for (let i = 0; i < currentProbs.length; i++) {
      if (currentProbs[i] > 1e-6) {
        iterProbs[i.toString(2).padStart(numQubits, '0')] = currentProbs[i];
      }
    }
    stateHistory.push({ iteration: k, probabilities: iterProbs });
  }

  // Perform multiple measurements to estimate success rate
  const numMeasurements = 100;
  const measurements: number[] = [];
  let successCount = 0;

  for (let m = 0; m < numMeasurements; m++) {
    const outcome = measureState(state);
    measurements.push(outcome);
    if (markedStates.includes(outcome)) {
      successCount++;
    }
  }

  return {
    initialState,
    finalState: state,
    stateHistory,
    measurements,
    successCount,
  };
}

// ============================================================================
// ORACLE CONSTRUCTION HELPERS
// ============================================================================

/**
 * Create oracle for single marked state
 */
function createSingleOracle(
  numQubits: number,
  target: number
): {
  description: string;
  circuit: string[];
} {
  const targetBits = target.toString(2).padStart(numQubits, '0');

  // Build circuit description
  const circuit: string[] = [];

  // Apply X gates where target bit is 0
  for (let i = 0; i < numQubits; i++) {
    if (targetBits[i] === '0') {
      circuit.push(`X on qubit ${numQubits - 1 - i}`);
    }
  }

  // Multi-controlled Z (or Toffoli with ancilla)
  circuit.push(`Multi-controlled Z on all qubits`);

  // Undo X gates
  for (let i = 0; i < numQubits; i++) {
    if (targetBits[i] === '0') {
      circuit.push(`X on qubit ${numQubits - 1 - i}`);
    }
  }

  return {
    description: `Oracle marks state |${targetBits}⟩`,
    circuit,
  };
}

/**
 * Create diffusion operator circuit
 */
function createDiffusionCircuit(numQubits: number): string[] {
  return [
    `H on all ${numQubits} qubits`,
    `X on all ${numQubits} qubits`,
    `Multi-controlled Z`,
    `X on all ${numQubits} qubits`,
    `H on all ${numQubits} qubits`,
  ];
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

function analyzeGrover(
  searchSpaceSize: number,
  numSolutions: number
): {
  classicalComplexity: string;
  quantumComplexity: string;
  speedup: number;
  optimalIterations: number;
  expectedSuccessProbability: number;
  iterations: Array<{ k: number; probability: number }>;
} {
  const N = searchSpaceSize;
  const M = numSolutions || 1;

  const optIter = optimalIterations(N, M);

  // Calculate probability for various iteration counts
  const iterations: Array<{ k: number; probability: number }> = [];
  const maxK = Math.min(optIter * 2, 20);

  for (let k = 0; k <= maxK; k++) {
    iterations.push({
      k,
      probability: successProbability(N, M, k),
    });
  }

  return {
    classicalComplexity: `O(N/M) = O(${Math.ceil(N / M)})`,
    quantumComplexity: `O(√(N/M)) = O(${Math.ceil(Math.sqrt(N / M))})`,
    speedup: Math.sqrt(N / M),
    optimalIterations: optIter,
    expectedSuccessProbability: successProbability(N, M, optIter),
    iterations,
  };
}

// ============================================================================
// TOOL DEFINITION AND EXECUTION
// ============================================================================

export const groveralgorithmTool: UnifiedTool = {
  name: 'grover_algorithm',
  description: "Grover's quantum search algorithm simulation",
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['search', 'simulate', 'analyze', 'circuit', 'info'],
        description: 'Operation to perform',
      },
      search_space_size: { type: 'number', description: 'Size of search space (power of 2)' },
      num_qubits: { type: 'number', description: 'Number of qubits' },
      marked_states: {
        type: 'array',
        items: { type: 'number' },
        description: 'Indices of marked/target states',
      },
      iterations: { type: 'number', description: 'Number of Grover iterations (default: optimal)' },
      show_history: { type: 'boolean', description: 'Show state evolution history' },
    },
    required: ['operation'],
  },
};

export async function executegroveralgorithm(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              tool: 'grover_algorithm',
              description:
                "Grover's quantum search algorithm - finds marked items in O(√N) queries",
              operations: {
                search: {
                  description: 'Run Grover search and return measurement results',
                  parameters: ['num_qubits', 'marked_states', 'iterations'],
                },
                simulate: {
                  description: 'Full simulation with state evolution tracking',
                  parameters: ['num_qubits', 'marked_states', 'show_history'],
                },
                analyze: {
                  description: 'Analyze complexity and optimal parameters',
                  parameters: ['search_space_size', 'marked_states.length'],
                },
                circuit: {
                  description: 'Generate circuit description',
                  parameters: ['num_qubits', 'marked_states'],
                },
              },
              algorithm: {
                steps: [
                  '1. Initialize: |ψ⟩ = H^⊗n|0⟩^⊗n = uniform superposition',
                  '2. Apply Oracle: O_f flips sign of marked states',
                  '3. Apply Diffusion: D = 2|s⟩⟨s| - I (inversion about mean)',
                  '4. Repeat steps 2-3 for O(√N/M) iterations',
                  '5. Measure to obtain marked state with high probability',
                ],
                complexity: {
                  classical: 'O(N) expected queries',
                  quantum: 'O(√N) queries',
                  speedup: 'Quadratic',
                },
              },
              formulas: {
                optimalIterations: 'k = floor(π/4 × √(N/M))',
                successProbability: 'P(success) = sin²((2k+1)θ) where θ = arcsin(√(M/N))',
                amplitudeEvolution: 'After k iterations: marked amplitude ≈ sin((2k+1)θ)',
              },
            },
            null,
            2
          ),
        };
      }

      case 'search': {
        const numQubits = args.num_qubits || Math.ceil(Math.log2(args.search_space_size || 16));
        const searchSpaceSize = 1 << numQubits;
        let markedStates = args.marked_states;

        // Default: mark a random state
        if (!markedStates || markedStates.length === 0) {
          markedStates = [Math.floor(Math.random() * searchSpaceSize)];
        }

        // Validate marked states
        markedStates = markedStates.filter((s: number) => s >= 0 && s < searchSpaceSize);
        if (markedStates.length === 0) {
          markedStates = [0];
        }

        const result = runGrover(numQubits, markedStates, args.iterations);

        // Count outcomes
        const outcomeCounts: Record<string, number> = {};
        for (const m of result.measurements) {
          const key = m.toString(2).padStart(numQubits, '0');
          outcomeCounts[key] = (outcomeCounts[key] || 0) + 1;
        }

        // Find most common outcome
        let mostLikely = result.measurements[0];
        let maxCount = 0;
        for (const m of result.measurements) {
          if ((outcomeCounts[m.toString(2).padStart(numQubits, '0')] || 0) > maxCount) {
            mostLikely = m;
            maxCount = outcomeCounts[mostLikely.toString(2).padStart(numQubits, '0')] || 0;
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'search',
              parameters: {
                numQubits,
                searchSpaceSize,
                markedStates: markedStates.map((s: number) =>
                  s.toString(2).padStart(numQubits, '0')
                ),
                iterations:
                  args.iterations ?? optimalIterations(searchSpaceSize, markedStates.length),
              },
              result: {
                mostLikelyOutcome: mostLikely.toString(2).padStart(numQubits, '0'),
                isCorrect: markedStates.includes(mostLikely),
                successRate: result.successCount / result.measurements.length,
                measurementDistribution: outcomeCounts,
              },
              theory: {
                expectedSuccessProbability: successProbability(
                  searchSpaceSize,
                  markedStates.length,
                  args.iterations ?? optimalIterations(searchSpaceSize, markedStates.length)
                ),
              },
            },
            null,
            2
          ),
        };
      }

      case 'simulate': {
        const numQubits = args.num_qubits || 4;
        const searchSpaceSize = 1 << numQubits;
        let markedStates = args.marked_states;

        if (!markedStates || markedStates.length === 0) {
          markedStates = [3]; // Mark |0011⟩ by default
        }

        markedStates = markedStates.filter((s: number) => s >= 0 && s < searchSpaceSize);
        if (markedStates.length === 0) markedStates = [0];

        const result = runGrover(numQubits, markedStates, args.iterations);
        const showHistory = args.show_history !== false;

        const finalProbs = getProbabilities(result.finalState);
        const markedProbability = markedStates.reduce(
          (sum: number, idx: number) => sum + finalProbs[idx],
          0
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response: any = {
          operation: 'simulate',
          configuration: {
            numQubits,
            searchSpaceSize,
            markedStates: markedStates.map((s: number) => ({
              decimal: s,
              binary: s.toString(2).padStart(numQubits, '0'),
            })),
            iterations: result.stateHistory.length - 1,
          },
          result: {
            markedStateProbability: markedProbability,
            finalProbabilities: Object.fromEntries(
              finalProbs
                .map((p, i) => [i.toString(2).padStart(numQubits, '0'), p])
                .filter(([_, p]) => (p as number) > 1e-6)
            ),
            amplification: markedProbability / (markedStates.length / searchSpaceSize),
          },
        };

        if (showHistory) {
          response.evolution = result.stateHistory.map((h) => ({
            iteration: h.iteration,
            markedProbability: Object.entries(h.probabilities)
              .filter(([key]) =>
                markedStates.some((s: number) => s.toString(2).padStart(numQubits, '0') === key)
              )
              .reduce((sum, [_, prob]) => sum + (prob as number), 0),
          }));
        }

        return {
          toolCallId: id,
          content: JSON.stringify(response, null, 2),
        };
      }

      case 'analyze': {
        const searchSpaceSize = args.search_space_size || 1024;
        const numSolutions = args.marked_states?.length || 1;

        const analysis = analyzeGrover(searchSpaceSize, numSolutions);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'analyze',
              parameters: {
                searchSpaceSize,
                numSolutions,
                numQubits: Math.ceil(Math.log2(searchSpaceSize)),
              },
              complexity: {
                classical: analysis.classicalComplexity,
                quantum: analysis.quantumComplexity,
                speedup: `${analysis.speedup.toFixed(2)}x (quadratic)`,
              },
              optimalParameters: {
                iterations: analysis.optimalIterations,
                successProbability: analysis.expectedSuccessProbability,
              },
              probabilityByIteration: analysis.iterations.map(({ k, probability }) => ({
                iteration: k,
                probability: probability,
                isOptimal: k === analysis.optimalIterations,
              })),
              insights: {
                tooFewIterations: 'Under-amplification: marked state not sufficiently amplified',
                tooManyIterations: 'Over-rotation: probability decreases past optimal point',
                multipleSolutions:
                  numSolutions > 1
                    ? `With ${numSolutions} solutions, fewer iterations needed (${analysis.optimalIterations} vs ${optimalIterations(searchSpaceSize, 1)} for single solution)`
                    : 'Single solution search',
              },
            },
            null,
            2
          ),
        };
      }

      case 'circuit': {
        const numQubits = args.num_qubits || 4;
        const searchSpaceSize = 1 << numQubits;
        let markedStates = args.marked_states || [5];

        markedStates = markedStates.filter((s: number) => s >= 0 && s < searchSpaceSize);
        if (markedStates.length === 0) markedStates = [0];

        const optIter = optimalIterations(searchSpaceSize, markedStates.length);
        const oracle = createSingleOracle(numQubits, markedStates[0]);
        const diffusion = createDiffusionCircuit(numQubits);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'circuit',
              parameters: {
                numQubits,
                markedState: markedStates[0].toString(2).padStart(numQubits, '0'),
                iterations: optIter,
              },
              circuit: {
                initialization: [
                  `Initialize ${numQubits} qubits to |0⟩`,
                  `Apply H gate to all qubits (create uniform superposition)`,
                ],
                groverIteration: {
                  oracle: oracle.circuit,
                  diffusion: diffusion,
                  note: `Repeat ${optIter} times`,
                },
                measurement: [`Measure all ${numQubits} qubits in computational basis`],
              },
              gateCount: {
                hadamard: numQubits + 2 * numQubits * optIter,
                pauliX:
                  2 * (numQubits - markedStates[0].toString(2).split('1').length + 1) * optIter,
                multiControlledZ: 2 * optIter,
                total: 'O(n × √N) gates',
              },
              circuitDiagram: generateCircuitDiagram(numQubits, optIter),
            },
            null,
            2
          ),
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            availableOperations: ['search', 'simulate', 'analyze', 'circuit', 'info'],
          }),
          isError: true,
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error in Grover's algorithm: ${err}`,
      isError: true,
    };
  }
}

function generateCircuitDiagram(numQubits: number, iterations: number): string[] {
  const diagram: string[] = [];
  diagram.push('Circuit Structure:');
  diagram.push('');

  const qLines = Array(numQubits)
    .fill(0)
    .map((_, i) => `q${i}: `);

  // Initial H gates
  for (let i = 0; i < numQubits; i++) {
    qLines[i] += '─[H]─';
  }

  // Grover iterations
  for (let iter = 0; iter < Math.min(iterations, 3); iter++) {
    for (let i = 0; i < numQubits; i++) {
      qLines[i] += '─[O]─[D]─';
    }
  }

  if (iterations > 3) {
    for (let i = 0; i < numQubits; i++) {
      qLines[i] += ' ... ';
    }
  }

  // Measurement
  for (let i = 0; i < numQubits; i++) {
    qLines[i] += '─[M]';
  }

  diagram.push(...qLines);
  diagram.push('');
  diagram.push('Legend: [H]=Hadamard, [O]=Oracle, [D]=Diffusion, [M]=Measure');

  return diagram;
}

export function isgroveralgorithmAvailable(): boolean {
  return true;
}
