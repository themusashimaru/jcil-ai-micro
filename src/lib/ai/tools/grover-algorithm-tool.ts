/**
 * GROVER-ALGORITHM TOOL
 * Grover's quantum search algorithm simulation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const groveralgorithmTool: UnifiedTool = {
  name: 'grover_algorithm',
  description: "Grover's quantum search algorithm simulation",
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['search', 'simulate', 'analyze', 'visualize', 'info'], description: 'Operation' },
      search_space_size: { type: 'number', description: 'Size of search space N (will use log2(N) qubits)' },
      marked_items: { type: 'array', items: { type: 'number' }, description: 'Indices of marked/target items' },
      num_iterations: { type: 'number', description: 'Number of Grover iterations (auto-calculated if not provided)' }
    },
    required: ['operation']
  }
};

// Complex number operations
interface Complex {
  re: number;
  im: number;
}

function cAbs2(c: Complex): number {
  return c.re * c.re + c.im * c.im;
}

function formatComplex(c: Complex): string {
  if (Math.abs(c.im) < 1e-10) return c.re.toFixed(6);
  if (Math.abs(c.re) < 1e-10) return `${c.im.toFixed(6)}i`;
  const sign = c.im >= 0 ? '+' : '-';
  return `${c.re.toFixed(6)}${sign}${Math.abs(c.im).toFixed(6)}i`;
}

// Quantum state for Grover's algorithm
class GroverState {
  amplitudes: Complex[];
  numQubits: number;
  N: number;

  constructor(numQubits: number) {
    this.numQubits = numQubits;
    this.N = 1 << numQubits;
    // Initialize to uniform superposition
    const amp = 1 / Math.sqrt(this.N);
    this.amplitudes = Array(this.N).fill(null).map(() => ({ re: amp, im: 0 }));
  }

  // Oracle: flip sign of marked items
  applyOracle(markedItems: number[]): void {
    for (const item of markedItems) {
      if (item >= 0 && item < this.N) {
        this.amplitudes[item].re *= -1;
        this.amplitudes[item].im *= -1;
      }
    }
  }

  // Diffusion operator: 2|s⟩⟨s| - I
  applyDiffusion(): void {
    // Calculate mean amplitude
    let sumRe = 0, sumIm = 0;
    for (const amp of this.amplitudes) {
      sumRe += amp.re;
      sumIm += amp.im;
    }
    const meanRe = sumRe / this.N;
    const meanIm = sumIm / this.N;

    // Apply: 2*mean - amplitude
    for (let i = 0; i < this.N; i++) {
      this.amplitudes[i].re = 2 * meanRe - this.amplitudes[i].re;
      this.amplitudes[i].im = 2 * meanIm - this.amplitudes[i].im;
    }
  }

  // Get probability of measuring each state
  getProbabilities(): number[] {
    return this.amplitudes.map(amp => cAbs2(amp));
  }

  // Get probability of marked items
  getMarkedProbability(markedItems: number[]): number {
    return markedItems.reduce((sum, item) => {
      if (item >= 0 && item < this.N) {
        return sum + cAbs2(this.amplitudes[item]);
      }
      return sum;
    }, 0);
  }

  // Simulate measurement
  measure(): number {
    const probs = this.getProbabilities();
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < probs.length; i++) {
      cumulative += probs[i];
      if (rand < cumulative) return i;
    }
    return this.N - 1;
  }
}

// Calculate optimal number of Grover iterations
function optimalIterations(N: number, M: number): number {
  // Optimal: (π/4) * √(N/M)
  return Math.round(Math.PI / 4 * Math.sqrt(N / M));
}

export async function executegroveralgorithm(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'grover-algorithm',
        description: "Grover's algorithm provides quadratic speedup for unstructured search",
        complexity: {
          classical: 'O(N) - must check each item',
          quantum: 'O(√N) - quadratic speedup',
          example: 'N=1,000,000: Classical ~1M steps, Quantum ~1000 steps'
        },
        algorithm: {
          '1_initialize': 'Start with |0⟩⊗n state',
          '2_superposition': 'Apply H⊗n to create uniform superposition',
          '3_oracle': 'Apply oracle Uf that flips sign of marked states',
          '4_diffusion': 'Apply diffusion operator 2|s⟩⟨s| - I',
          '5_repeat': 'Repeat steps 3-4 approximately √N times',
          '6_measure': 'Measure to get marked item with high probability'
        },
        geometricInterpretation: {
          description: 'Grover iterations rotate state vector in 2D subspace',
          angle: 'Each iteration rotates by θ ≈ 2 arcsin(√(M/N))',
          optimal: 'Stop when angle reaches π/2 (maximum amplitude)'
        },
        circuit: `
        Grover's Algorithm Circuit:

        |0⟩ ─H─┌─────┐┌─────────┐─ ... ─M
        |0⟩ ─H─│     ││         │
        ...    │  Uf ││ 2|s⟩⟨s|-I │  × √N times
        |0⟩ ─H─│     ││         │
        |0⟩ ─H─└─────┘└─────────┘─ ... ─M
              Oracle  Diffusion
        `,
        applications: [
          'Database search',
          'Collision finding',
          'SAT solving',
          'Cryptographic key search',
          'Optimization problems'
        ]
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'search') {
      const searchSpaceSize = Math.min(args.search_space_size || 16, 1024);
      const numQubits = Math.ceil(Math.log2(searchSpaceSize));
      const N = 1 << numQubits;
      const markedItems = args.marked_items || [Math.floor(Math.random() * N)];
      const M = markedItems.length;
      const iterations = args.num_iterations ?? optimalIterations(N, M);

      const state = new GroverState(numQubits);
      const probabilityHistory: { iteration: number; markedProb: number }[] = [];

      // Initial probability
      probabilityHistory.push({
        iteration: 0,
        markedProb: state.getMarkedProbability(markedItems)
      });

      // Run Grover iterations
      for (let i = 0; i < iterations; i++) {
        state.applyOracle(markedItems);
        state.applyDiffusion();
        probabilityHistory.push({
          iteration: i + 1,
          markedProb: state.getMarkedProbability(markedItems)
        });
      }

      // Final measurement
      const measured = state.measure();
      const success = markedItems.includes(measured);

      const result = {
        operation: 'search',
        searchSpace: {
          N,
          numQubits,
          markedItems,
          numMarked: M
        },
        iterations,
        optimalIterations: optimalIterations(N, M),
        probabilityEvolution: probabilityHistory.map(p => ({
          iteration: p.iteration,
          successProbability: (p.markedProb * 100).toFixed(2) + '%'
        })),
        finalProbability: (state.getMarkedProbability(markedItems) * 100).toFixed(2) + '%',
        measurement: {
          result: measured,
          binary: measured.toString(2).padStart(numQubits, '0'),
          isMarked: success,
          wasCorrect: success ? 'YES - Found marked item!' : 'NO - Try again or use more iterations'
        },
        classicalComparison: {
          classicalSteps: `O(${N}) ≈ ${N} steps average`,
          quantumSteps: `O(√${N}) ≈ ${Math.round(Math.sqrt(N))} steps`,
          speedup: `${(N / Math.sqrt(N)).toFixed(1)}x`
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'simulate') {
      const searchSpaceSize = Math.min(args.search_space_size || 8, 64);
      const numQubits = Math.ceil(Math.log2(searchSpaceSize));
      const N = 1 << numQubits;
      const markedItems = args.marked_items || [3];
      const M = markedItems.length;
      const iterations = args.num_iterations ?? optimalIterations(N, M);

      const state = new GroverState(numQubits);

      const steps: object[] = [];

      // Initial state
      steps.push({
        step: 'Initial (after H⊗n)',
        description: 'Uniform superposition',
        amplitudes: state.amplitudes.slice(0, Math.min(8, N)).map((a, i) => ({
          state: `|${i.toString(2).padStart(numQubits, '0')}⟩`,
          amplitude: formatComplex(a),
          isMarked: markedItems.includes(i)
        })),
        markedProbability: (state.getMarkedProbability(markedItems) * 100).toFixed(4) + '%'
      });

      for (let iter = 0; iter < Math.min(iterations, 5); iter++) {
        // Oracle
        state.applyOracle(markedItems);
        steps.push({
          step: `Iteration ${iter + 1}: Oracle`,
          description: 'Flip sign of marked states',
          amplitudes: state.amplitudes.slice(0, Math.min(8, N)).map((a, i) => ({
            state: `|${i.toString(2).padStart(numQubits, '0')}⟩`,
            amplitude: formatComplex(a),
            isMarked: markedItems.includes(i)
          }))
        });

        // Diffusion
        state.applyDiffusion();
        steps.push({
          step: `Iteration ${iter + 1}: Diffusion`,
          description: 'Inversion about mean (amplify marked states)',
          amplitudes: state.amplitudes.slice(0, Math.min(8, N)).map((a, i) => ({
            state: `|${i.toString(2).padStart(numQubits, '0')}⟩`,
            amplitude: formatComplex(a),
            isMarked: markedItems.includes(i)
          })),
          markedProbability: (state.getMarkedProbability(markedItems) * 100).toFixed(4) + '%'
        });
      }

      const result = {
        operation: 'simulate',
        searchSpaceSize: N,
        numQubits,
        markedItems,
        totalIterations: iterations,
        detailedSteps: steps,
        explanation: {
          oracle: 'The oracle Uf recognizes solutions and flips their amplitudes: Uf|x⟩ = (-1)^f(x)|x⟩',
          diffusion: 'The diffusion operator reflects about the mean, amplifying marked states',
          geometry: 'Each iteration rotates the state vector by 2θ where sin(θ) = √(M/N)'
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'analyze') {
      const searchSpaceSize = args.search_space_size || 1000000;
      const numQubits = Math.ceil(Math.log2(searchSpaceSize));
      const N = 1 << numQubits;
      const M = (args.marked_items || [0]).length || 1;

      const optIter = optimalIterations(N, M);
      const theta = Math.asin(Math.sqrt(M / N));
      const maxProb = Math.sin((2 * optIter + 1) * theta) ** 2;

      const result = {
        operation: 'analyze',
        problemSize: {
          N,
          numQubits,
          markedItems: M
        },
        analysis: {
          theta: `arcsin(√(${M}/${N})) = ${theta.toFixed(6)} radians`,
          optimalIterations: optIter,
          rotationPerIteration: `2θ = ${(2 * theta).toFixed(6)} radians`,
          totalRotation: `${(2 * optIter + 1) * theta / Math.PI * 180}° (ideally 90°)`
        },
        successProbability: {
          afterOptimalIterations: (maxProb * 100).toFixed(4) + '%',
          formula: 'sin²((2k+1)θ) where k = optimal iterations'
        },
        complexityComparison: {
          classical: {
            algorithm: 'Linear search',
            expectedQueries: N / (2 * M),
            bigO: `O(N/M) = O(${Math.round(N / M)})`
          },
          quantum: {
            algorithm: "Grover's search",
            expectedQueries: optIter,
            bigO: `O(√(N/M)) = O(${Math.round(Math.sqrt(N / M))})`
          },
          speedup: {
            factor: `${(N / (2 * M) / optIter).toFixed(1)}x`,
            type: 'Quadratic speedup'
          }
        },
        practicalConsiderations: {
          tooFewIterations: 'Insufficient amplitude amplification',
          tooManyIterations: 'Amplitude starts decreasing (overshooting)',
          multipleMarked: 'More marked items → fewer iterations needed',
          unknownM: 'Can use quantum counting to estimate M first'
        },
        visualization: createAmplitudeVisualization(N, M, Math.min(optIter, 10))
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'visualize') {
      const N = Math.min(args.search_space_size || 16, 256);
      const numQubits = Math.ceil(Math.log2(N));
      const actualN = 1 << numQubits;
      const markedItems = args.marked_items || [0];
      const M = markedItems.length;
      const iterations = args.num_iterations ?? optimalIterations(actualN, M);

      const state = new GroverState(numQubits);
      const frames: string[] = [];

      // Create ASCII visualization
      frames.push(createStateVisualization(state, markedItems, 0, 'Initial: Uniform superposition'));

      for (let i = 0; i < Math.min(iterations, 6); i++) {
        state.applyOracle(markedItems);
        state.applyDiffusion();
        frames.push(createStateVisualization(state, markedItems, i + 1, `After iteration ${i + 1}`));
      }

      const result = {
        operation: 'visualize',
        searchSpaceSize: actualN,
        markedItems,
        iterations: Math.min(iterations, 6),
        visualization: frames.join('\n\n'),
        legend: {
          '▓': 'Amplitude magnitude',
          '*': 'Marked item',
          'Bar length': 'Proportional to probability'
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

function createStateVisualization(state: GroverState, markedItems: number[], iteration: number, label: string): string {
  const lines: string[] = [label];
  const probs = state.getProbabilities();
  const maxWidth = 40;

  const displayCount = Math.min(state.N, 16);
  for (let i = 0; i < displayCount; i++) {
    const isMarked = markedItems.includes(i) ? '*' : ' ';
    const barWidth = Math.round(Math.sqrt(probs[i]) * maxWidth);
    const bar = '▓'.repeat(barWidth) + '░'.repeat(maxWidth - barWidth);
    const binary = i.toString(2).padStart(state.numQubits, '0');
    lines.push(`${isMarked}|${binary}⟩ ${bar} ${(probs[i] * 100).toFixed(1)}%`);
  }

  if (state.N > 16) {
    lines.push(`  ... and ${state.N - 16} more states`);
  }

  return lines.join('\n');
}

function createAmplitudeVisualization(N: number, M: number, iterations: number): string {
  const lines: string[] = ['Probability Evolution:'];
  const theta = Math.asin(Math.sqrt(M / N));

  for (let k = 0; k <= iterations; k++) {
    const prob = Math.sin((2 * k + 1) * theta) ** 2;
    const barWidth = Math.round(prob * 50);
    const bar = '█'.repeat(barWidth);
    lines.push(`k=${k.toString().padStart(2)}: ${bar} ${(prob * 100).toFixed(1)}%`);
  }

  return lines.join('\n');
}

export function isgroveralgorithmAvailable(): boolean { return true; }
