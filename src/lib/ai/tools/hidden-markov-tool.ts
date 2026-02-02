/**
 * HIDDEN-MARKOV TOOL
 * Hidden Markov Model implementation
 *
 * Implements real HMM algorithms:
 * - Viterbi algorithm (most likely state sequence)
 * - Forward algorithm (observation probability)
 * - Backward algorithm (smoothing)
 * - Forward-Backward (Baum-Welch) for training
 * - Sequence generation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const hiddenmarkovTool: UnifiedTool = {
  name: 'hidden_markov',
  description: 'Hidden Markov Model - Viterbi decoding, Forward-Backward algorithm, Baum-Welch training, sequence generation.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['viterbi', 'forward', 'backward', 'forward_backward', 'train', 'generate', 'predict', 'likelihood', 'info'],
        description: 'Operation: viterbi (decode), forward (probability), backward (smoothing), forward_backward (full), train (Baum-Welch), generate (sample), predict (next state), likelihood (sequence prob)'
      },
      states: { type: 'array', items: { type: 'string' }, description: 'Hidden state names' },
      observations: { type: 'array', items: { type: 'string' }, description: 'Observable symbol names' },
      transition_matrix: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'State transition probabilities A[i][j] = P(s_j | s_i)' },
      emission_matrix: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Emission probabilities B[i][k] = P(o_k | s_i)' },
      initial_probs: { type: 'array', items: { type: 'number' }, description: 'Initial state probabilities π[i] = P(s_i at t=0)' },
      observed_sequence: { type: 'array', items: { type: 'string' }, description: 'Sequence of observed symbols' },
      sequence_length: { type: 'integer', description: 'Length of sequence to generate' },
      num_iterations: { type: 'integer', description: 'Number of Baum-Welch iterations' },
      training_sequences: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Multiple sequences for training' }
    },
    required: ['operation']
  }
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface HMM {
  states: string[];
  observations: string[];
  A: number[][]; // Transition matrix
  B: number[][]; // Emission matrix
  pi: number[]; // Initial probabilities
  numStates: number;
  numObs: number;
}

interface ViterbiResult {
  path: string[];
  pathIndices: number[];
  probability: number;
  logProbability: number;
  trellis: number[][];
}

interface ForwardResult {
  alpha: number[][];
  probability: number;
  logProbability: number;
  scalingFactors: number[];
}

interface BackwardResult {
  beta: number[][];
  scalingFactors: number[];
}

interface ForwardBackwardResult {
  alpha: number[][];
  beta: number[][];
  gamma: number[][]; // P(state at t | observations)
  xi: number[][][]; // P(state_t, state_t+1 | observations)
  probability: number;
  stateProbs: { time: number; probs: { state: string; prob: number }[] }[];
}

// ============================================================================
// HMM CREATION AND VALIDATION
// ============================================================================

function createHMM(
  states: string[],
  observations: string[],
  A: number[][],
  B: number[][],
  pi: number[]
): HMM {
  return {
    states,
    observations,
    A,
    B,
    pi,
    numStates: states.length,
    numObs: observations.length
  };
}

function validateHMM(hmm: HMM): void {
  // Check dimensions
  if (hmm.A.length !== hmm.numStates || hmm.A[0].length !== hmm.numStates) {
    throw new Error('Transition matrix dimensions must match number of states');
  }
  if (hmm.B.length !== hmm.numStates || hmm.B[0].length !== hmm.numObs) {
    throw new Error('Emission matrix dimensions must be [numStates x numObs]');
  }
  if (hmm.pi.length !== hmm.numStates) {
    throw new Error('Initial probabilities length must match number of states');
  }

  // Check probability sums (with tolerance)
  const tolerance = 0.01;

  for (let i = 0; i < hmm.numStates; i++) {
    const rowSum = hmm.A[i].reduce((a, b) => a + b, 0);
    if (Math.abs(rowSum - 1) > tolerance) {
      throw new Error(`Transition matrix row ${i} sums to ${rowSum}, should be 1`);
    }
  }

  for (let i = 0; i < hmm.numStates; i++) {
    const rowSum = hmm.B[i].reduce((a, b) => a + b, 0);
    if (Math.abs(rowSum - 1) > tolerance) {
      throw new Error(`Emission matrix row ${i} sums to ${rowSum}, should be 1`);
    }
  }

  const piSum = hmm.pi.reduce((a, b) => a + b, 0);
  if (Math.abs(piSum - 1) > tolerance) {
    throw new Error(`Initial probabilities sum to ${piSum}, should be 1`);
  }
}

// ============================================================================
// VITERBI ALGORITHM
// Find most likely state sequence given observations
// ============================================================================

function viterbi(hmm: HMM, obsSequence: number[]): ViterbiResult {
  const T = obsSequence.length;
  const N = hmm.numStates;

  // Trellis: delta[t][i] = max probability of path ending in state i at time t
  const delta: number[][] = Array(T).fill(null).map(() => Array(N).fill(0));
  // Backpointers
  const psi: number[][] = Array(T).fill(null).map(() => Array(N).fill(0));

  // Initialization (t=0)
  for (let i = 0; i < N; i++) {
    delta[0][i] = Math.log(hmm.pi[i] + 1e-300) + Math.log(hmm.B[i][obsSequence[0]] + 1e-300);
    psi[0][i] = 0;
  }

  // Recursion
  for (let t = 1; t < T; t++) {
    for (let j = 0; j < N; j++) {
      let maxVal = -Infinity;
      let maxIdx = 0;

      for (let i = 0; i < N; i++) {
        const val = delta[t - 1][i] + Math.log(hmm.A[i][j] + 1e-300);
        if (val > maxVal) {
          maxVal = val;
          maxIdx = i;
        }
      }

      delta[t][j] = maxVal + Math.log(hmm.B[j][obsSequence[t]] + 1e-300);
      psi[t][j] = maxIdx;
    }
  }

  // Termination - find best final state
  let maxFinal = -Infinity;
  let lastState = 0;
  for (let i = 0; i < N; i++) {
    if (delta[T - 1][i] > maxFinal) {
      maxFinal = delta[T - 1][i];
      lastState = i;
    }
  }

  // Backtrack
  const pathIndices: number[] = Array(T).fill(0);
  pathIndices[T - 1] = lastState;
  for (let t = T - 2; t >= 0; t--) {
    pathIndices[t] = psi[t + 1][pathIndices[t + 1]];
  }

  const path = pathIndices.map(i => hmm.states[i]);

  return {
    path,
    pathIndices,
    probability: Math.exp(maxFinal),
    logProbability: maxFinal,
    trellis: delta
  };
}

// ============================================================================
// FORWARD ALGORITHM
// Compute P(observations | model) and forward probabilities
// ============================================================================

function forward(hmm: HMM, obsSequence: number[]): ForwardResult {
  const T = obsSequence.length;
  const N = hmm.numStates;

  // Alpha with scaling for numerical stability
  const alpha: number[][] = Array(T).fill(null).map(() => Array(N).fill(0));
  const scalingFactors: number[] = Array(T).fill(1);

  // Initialization (t=0)
  let scale = 0;
  for (let i = 0; i < N; i++) {
    alpha[0][i] = hmm.pi[i] * hmm.B[i][obsSequence[0]];
    scale += alpha[0][i];
  }
  scalingFactors[0] = scale;
  for (let i = 0; i < N; i++) {
    alpha[0][i] /= scale;
  }

  // Recursion
  for (let t = 1; t < T; t++) {
    scale = 0;
    for (let j = 0; j < N; j++) {
      let sum = 0;
      for (let i = 0; i < N; i++) {
        sum += alpha[t - 1][i] * hmm.A[i][j];
      }
      alpha[t][j] = sum * hmm.B[j][obsSequence[t]];
      scale += alpha[t][j];
    }
    scalingFactors[t] = scale;
    for (let j = 0; j < N; j++) {
      alpha[t][j] /= scale;
    }
  }

  // Compute log probability using scaling factors
  let logProb = 0;
  for (let t = 0; t < T; t++) {
    logProb += Math.log(scalingFactors[t] + 1e-300);
  }

  return {
    alpha,
    probability: Math.exp(logProb),
    logProbability: logProb,
    scalingFactors
  };
}

// ============================================================================
// BACKWARD ALGORITHM
// ============================================================================

function backward(hmm: HMM, obsSequence: number[], scalingFactors: number[]): BackwardResult {
  const T = obsSequence.length;
  const N = hmm.numStates;

  const beta: number[][] = Array(T).fill(null).map(() => Array(N).fill(0));

  // Initialization (t=T-1)
  for (let i = 0; i < N; i++) {
    beta[T - 1][i] = 1 / scalingFactors[T - 1];
  }

  // Recursion
  for (let t = T - 2; t >= 0; t--) {
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let j = 0; j < N; j++) {
        sum += hmm.A[i][j] * hmm.B[j][obsSequence[t + 1]] * beta[t + 1][j];
      }
      beta[t][i] = sum / scalingFactors[t];
    }
  }

  return { beta, scalingFactors };
}

// ============================================================================
// FORWARD-BACKWARD (E-step of Baum-Welch)
// Compute gamma and xi for parameter estimation
// ============================================================================

function forwardBackward(hmm: HMM, obsSequence: number[]): ForwardBackwardResult {
  const T = obsSequence.length;
  const N = hmm.numStates;

  // Forward pass
  const forwardResult = forward(hmm, obsSequence);
  const { alpha, scalingFactors, logProbability } = forwardResult;

  // Backward pass
  const { beta } = backward(hmm, obsSequence, scalingFactors);

  // Compute gamma: P(state_t = i | observations)
  const gamma: number[][] = Array(T).fill(null).map(() => Array(N).fill(0));
  for (let t = 0; t < T; t++) {
    let sum = 0;
    for (let i = 0; i < N; i++) {
      gamma[t][i] = alpha[t][i] * beta[t][i] * scalingFactors[t];
      sum += gamma[t][i];
    }
    // Normalize
    if (sum > 0) {
      for (let i = 0; i < N; i++) {
        gamma[t][i] /= sum;
      }
    }
  }

  // Compute xi: P(state_t = i, state_{t+1} = j | observations)
  const xi: number[][][] = Array(T - 1).fill(null).map(() =>
    Array(N).fill(null).map(() => Array(N).fill(0))
  );

  for (let t = 0; t < T - 1; t++) {
    let sum = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        xi[t][i][j] = alpha[t][i] * hmm.A[i][j] * hmm.B[j][obsSequence[t + 1]] * beta[t + 1][j];
        sum += xi[t][i][j];
      }
    }
    // Normalize
    if (sum > 0) {
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          xi[t][i][j] /= sum;
        }
      }
    }
  }

  // Format state probabilities for output
  const stateProbs = gamma.map((probs, t) => ({
    time: t,
    probs: probs.map((prob, i) => ({ state: hmm.states[i], prob }))
  }));

  return {
    alpha,
    beta,
    gamma,
    xi,
    probability: Math.exp(logProbability),
    stateProbs
  };
}

// ============================================================================
// BAUM-WELCH TRAINING
// ============================================================================

function baumWelch(
  hmm: HMM,
  trainingSequences: number[][],
  numIterations: number
): { hmm: HMM; logLikelihood: number[]; improvement: number } {
  const N = hmm.numStates;
  const M = hmm.numObs;

  // Copy HMM parameters
  const A = hmm.A.map(row => [...row]);
  const B = hmm.B.map(row => [...row]);
  const pi = [...hmm.pi];

  const logLikelihood: number[] = [];
  let prevLL = -Infinity;

  for (let iter = 0; iter < numIterations; iter++) {
    // Accumulators
    const A_num = Array(N).fill(null).map(() => Array(N).fill(0));
    const A_den = Array(N).fill(0);
    const B_num = Array(N).fill(null).map(() => Array(M).fill(0));
    const B_den = Array(N).fill(0);
    const pi_new = Array(N).fill(0);

    let totalLL = 0;

    // Process each sequence
    for (const obsSequence of trainingSequences) {
      const currentHMM = createHMM(hmm.states, hmm.observations, A, B, pi);
      const fb = forwardBackward(currentHMM, obsSequence);

      totalLL += Math.log(fb.probability + 1e-300);

      const T = obsSequence.length;

      // Accumulate initial state estimates
      for (let i = 0; i < N; i++) {
        pi_new[i] += fb.gamma[0][i];
      }

      // Accumulate transition estimates
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          for (let t = 0; t < T - 1; t++) {
            A_num[i][j] += fb.xi[t][i][j];
          }
        }
        for (let t = 0; t < T - 1; t++) {
          A_den[i] += fb.gamma[t][i];
        }
      }

      // Accumulate emission estimates
      for (let j = 0; j < N; j++) {
        for (let t = 0; t < T; t++) {
          B_num[j][obsSequence[t]] += fb.gamma[t][j];
          B_den[j] += fb.gamma[t][j];
        }
      }
    }

    // Update parameters
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _numSeq = trainingSequences.length;

    // Update pi
    const piSum = pi_new.reduce((a, b) => a + b, 0);
    for (let i = 0; i < N; i++) {
      pi[i] = piSum > 0 ? pi_new[i] / piSum : 1 / N;
    }

    // Update A
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        A[i][j] = A_den[i] > 0 ? A_num[i][j] / A_den[i] : 1 / N;
      }
    }

    // Update B
    for (let j = 0; j < N; j++) {
      for (let k = 0; k < M; k++) {
        B[j][k] = B_den[j] > 0 ? B_num[j][k] / B_den[j] : 1 / M;
      }
    }

    logLikelihood.push(totalLL);

    // Check convergence
    if (Math.abs(totalLL - prevLL) < 1e-6) {
      break;
    }
    prevLL = totalLL;
  }

  const trainedHMM = createHMM(hmm.states, hmm.observations, A, B, pi);
  const improvement = logLikelihood.length > 1
    ? logLikelihood[logLikelihood.length - 1] - logLikelihood[0]
    : 0;

  return { hmm: trainedHMM, logLikelihood, improvement };
}

// ============================================================================
// SEQUENCE GENERATION
// ============================================================================

function generateSequence(hmm: HMM, length: number): {
  states: string[];
  observations: string[];
  stateIndices: number[];
  obsIndices: number[];
} {
  const stateIndices: number[] = [];
  const obsIndices: number[] = [];

  // Sample initial state
  let currentState = sampleFromDistribution(hmm.pi);
  stateIndices.push(currentState);

  // Sample first observation
  let obs = sampleFromDistribution(hmm.B[currentState]);
  obsIndices.push(obs);

  // Generate remaining sequence
  for (let t = 1; t < length; t++) {
    // Transition
    currentState = sampleFromDistribution(hmm.A[currentState]);
    stateIndices.push(currentState);

    // Emit
    obs = sampleFromDistribution(hmm.B[currentState]);
    obsIndices.push(obs);
  }

  return {
    states: stateIndices.map(i => hmm.states[i]),
    observations: obsIndices.map(i => hmm.observations[i]),
    stateIndices,
    obsIndices
  };
}

function sampleFromDistribution(probs: number[]): number {
  const r = Math.random();
  let cumsum = 0;
  for (let i = 0; i < probs.length; i++) {
    cumsum += probs[i];
    if (r <= cumsum) return i;
  }
  return probs.length - 1;
}

// ============================================================================
// DEFAULT HMM EXAMPLE (Weather/Activity)
// ============================================================================

function getDefaultHMM(): HMM {
  // Classic weather/activity HMM example
  const states = ['Sunny', 'Rainy'];
  const observations = ['Walk', 'Shop', 'Clean'];

  // Transition probabilities
  const A = [
    [0.7, 0.3], // Sunny -> Sunny (0.7), Sunny -> Rainy (0.3)
    [0.4, 0.6]  // Rainy -> Sunny (0.4), Rainy -> Rainy (0.6)
  ];

  // Emission probabilities
  const B = [
    [0.6, 0.3, 0.1], // Sunny: Walk (0.6), Shop (0.3), Clean (0.1)
    [0.1, 0.4, 0.5]  // Rainy: Walk (0.1), Shop (0.4), Clean (0.5)
  ];

  // Initial probabilities
  const pi = [0.6, 0.4]; // Start Sunny (0.6), Rainy (0.4)

  return createHMM(states, observations, A, B, pi);
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executehiddenmarkov(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation = 'info',
      states,
      observations,
      transition_matrix,
      emission_matrix,
      initial_probs,
      observed_sequence,
      sequence_length = 10,
      num_iterations = 10,
      training_sequences
    } = args;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    // Create HMM (use provided or default)
    let hmm: HMM;
    if (states && observations && transition_matrix && emission_matrix && initial_probs) {
      hmm = createHMM(states, observations, transition_matrix, emission_matrix, initial_probs);
      validateHMM(hmm);
    } else {
      hmm = getDefaultHMM();
    }

    // Convert observation sequence to indices
    const getObsIndices = (seq: string[]): number[] =>
      seq.map(o => {
        const idx = hmm.observations.indexOf(o);
        if (idx === -1) throw new Error(`Unknown observation: ${o}`);
        return idx;
      });

    switch (operation) {
      case 'viterbi': {
        if (!observed_sequence || observed_sequence.length === 0) {
          throw new Error('observed_sequence required for Viterbi decoding');
        }

        const obsIndices = getObsIndices(observed_sequence);
        const viterbiResult = viterbi(hmm, obsIndices);

        result = {
          operation: 'viterbi',
          observed_sequence,
          most_likely_states: viterbiResult.path,
          path_probability: viterbiResult.probability,
          log_probability: viterbiResult.logProbability,
          state_by_time: viterbiResult.path.map((state, t) => ({
            time: t,
            observation: observed_sequence[t],
            inferred_state: state
          })),
          algorithm: 'Dynamic programming with backtracking to find argmax P(states|observations)',
          description: `Viterbi decoded ${observed_sequence.length} observations. ` +
            `Most likely path: ${viterbiResult.path.join(' → ')}`
        };
        break;
      }

      case 'forward': {
        if (!observed_sequence || observed_sequence.length === 0) {
          throw new Error('observed_sequence required for forward algorithm');
        }

        const obsIndices = getObsIndices(observed_sequence);
        const forwardResult = forward(hmm, obsIndices);

        result = {
          operation: 'forward',
          observed_sequence,
          sequence_probability: forwardResult.probability,
          log_probability: forwardResult.logProbability,
          forward_variables_final: forwardResult.alpha[forwardResult.alpha.length - 1].map((prob, i) => ({
            state: hmm.states[i],
            alpha: prob
          })),
          algorithm: 'Recursive computation of P(observations up to t, state at t)',
          description: `P(${observed_sequence.join(', ')}) = ${forwardResult.probability.toExponential(4)}`
        };
        break;
      }

      case 'backward': {
        if (!observed_sequence || observed_sequence.length === 0) {
          throw new Error('observed_sequence required for backward algorithm');
        }

        const obsIndices = getObsIndices(observed_sequence);
        const forwardResult = forward(hmm, obsIndices);
        const backwardResult = backward(hmm, obsIndices, forwardResult.scalingFactors);

        result = {
          operation: 'backward',
          observed_sequence,
          backward_variables_initial: backwardResult.beta[0].map((prob, i) => ({
            state: hmm.states[i],
            beta: prob
          })),
          algorithm: 'Recursive computation of P(future observations | state at t)',
          description: `Backward pass completed for ${observed_sequence.length} observations`
        };
        break;
      }

      case 'forward_backward': {
        if (!observed_sequence || observed_sequence.length === 0) {
          throw new Error('observed_sequence required for forward-backward algorithm');
        }

        const obsIndices = getObsIndices(observed_sequence);
        const fbResult = forwardBackward(hmm, obsIndices);

        // Find most likely state at each time
        const inferredStates = fbResult.gamma.map((probs, t) => {
          const maxIdx = probs.indexOf(Math.max(...probs));
          return {
            time: t,
            observation: observed_sequence[t],
            most_likely_state: hmm.states[maxIdx],
            probabilities: probs.map((p, i) => ({ state: hmm.states[i], prob: p }))
          };
        });

        result = {
          operation: 'forward_backward',
          observed_sequence,
          sequence_probability: fbResult.probability,
          state_posteriors: inferredStates.slice(0, 10), // First 10
          summary: {
            sequence_length: observed_sequence.length,
            inferred_states: inferredStates.map(s => s.most_likely_state).join(' → ')
          },
          algorithm: 'Combines forward and backward passes to compute P(state_t | all observations)',
          description: `Forward-backward analysis of ${observed_sequence.length} observations`
        };
        break;
      }

      case 'train': {
        const seqs = training_sequences || [observed_sequence || ['Walk', 'Shop', 'Clean', 'Walk', 'Walk']];
        const seqIndices = seqs.map(seq => getObsIndices(seq));

        const trainResult = baumWelch(hmm, seqIndices, num_iterations);

        result = {
          operation: 'train',
          training_sequences: seqs,
          num_iterations,
          iterations_run: trainResult.logLikelihood.length,
          log_likelihood_history: trainResult.logLikelihood,
          improvement: trainResult.improvement,
          learned_parameters: {
            transition_matrix: trainResult.hmm.A,
            emission_matrix: trainResult.hmm.B,
            initial_probs: trainResult.hmm.pi
          },
          algorithm: 'Baum-Welch (EM algorithm for HMMs)',
          description: `Trained on ${seqs.length} sequences for ${trainResult.logLikelihood.length} iterations. ` +
            `Log-likelihood improved by ${trainResult.improvement.toFixed(4)}`
        };
        break;
      }

      case 'generate': {
        const generated = generateSequence(hmm, sequence_length);

        result = {
          operation: 'generate',
          sequence_length,
          generated_states: generated.states,
          generated_observations: generated.observations,
          sequence_pairs: generated.states.map((state, t) => ({
            time: t,
            hidden_state: state,
            observation: generated.observations[t]
          })),
          description: `Generated sequence of ${sequence_length} observations from HMM`
        };
        break;
      }

      case 'predict': {
        if (!observed_sequence || observed_sequence.length === 0) {
          throw new Error('observed_sequence required for prediction');
        }

        const obsIndices = getObsIndices(observed_sequence);
        const fbResult = forwardBackward(hmm, obsIndices);

        // Get last state distribution
        const lastGamma = fbResult.gamma[fbResult.gamma.length - 1];

        // Predict next state distribution
        const nextStateProbs: number[] = Array(hmm.numStates).fill(0);
        for (let i = 0; i < hmm.numStates; i++) {
          for (let j = 0; j < hmm.numStates; j++) {
            nextStateProbs[j] += lastGamma[i] * hmm.A[i][j];
          }
        }

        // Predict next observation distribution
        const nextObsProbs: number[] = Array(hmm.numObs).fill(0);
        for (let j = 0; j < hmm.numStates; j++) {
          for (let k = 0; k < hmm.numObs; k++) {
            nextObsProbs[k] += nextStateProbs[j] * hmm.B[j][k];
          }
        }

        result = {
          operation: 'predict',
          observed_sequence,
          current_state_distribution: lastGamma.map((p, i) => ({ state: hmm.states[i], prob: p })),
          predicted_next_state: nextStateProbs.map((p, i) => ({ state: hmm.states[i], prob: p })),
          predicted_next_observation: nextObsProbs.map((p, k) => ({ observation: hmm.observations[k], prob: p })),
          most_likely_next_state: hmm.states[nextStateProbs.indexOf(Math.max(...nextStateProbs))],
          most_likely_next_observation: hmm.observations[nextObsProbs.indexOf(Math.max(...nextObsProbs))],
          description: `Predicted next state/observation from ${observed_sequence.length} observations`
        };
        break;
      }

      case 'likelihood': {
        if (!observed_sequence || observed_sequence.length === 0) {
          throw new Error('observed_sequence required for likelihood computation');
        }

        const obsIndices = getObsIndices(observed_sequence);
        const forwardResult = forward(hmm, obsIndices);

        result = {
          operation: 'likelihood',
          observed_sequence,
          probability: forwardResult.probability,
          log_probability: forwardResult.logProbability,
          perplexity: Math.exp(-forwardResult.logProbability / observed_sequence.length),
          bits_per_symbol: -forwardResult.logProbability / (observed_sequence.length * Math.log(2)),
          description: `P(sequence) = ${forwardResult.probability.toExponential(4)}, ` +
            `log P = ${forwardResult.logProbability.toFixed(4)}`
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'hidden_markov',
          description: 'Hidden Markov Model - probabilistic model for sequences with hidden states',
          current_model: {
            states: hmm.states,
            observations: hmm.observations,
            transition_matrix: hmm.A,
            emission_matrix: hmm.B,
            initial_probs: hmm.pi
          },
          algorithms: {
            viterbi: 'Find most likely state sequence (decoding)',
            forward: 'Compute P(observations) (evaluation)',
            backward: 'Compute backward variables (smoothing)',
            forward_backward: 'State posterior probabilities γ(t)',
            baum_welch: 'EM algorithm for parameter learning',
            generate: 'Sample sequences from the model'
          },
          applications: [
            'Speech recognition',
            'Part-of-speech tagging',
            'Gene finding in bioinformatics',
            'Financial time series',
            'Gesture recognition'
          ],
          mathematics: {
            transition: 'A[i][j] = P(state_j at t+1 | state_i at t)',
            emission: 'B[i][k] = P(observation_k | state_i)',
            forward: 'α_t(i) = P(o_1..o_t, s_t=i)',
            backward: 'β_t(i) = P(o_{t+1}..o_T | s_t=i)',
            gamma: 'γ_t(i) = P(s_t=i | O) = α_t(i)β_t(i) / P(O)'
          },
          operations: {
            viterbi: 'Decode most likely state sequence',
            forward: 'Compute observation probability',
            backward: 'Compute backward probabilities',
            forward_backward: 'Full posterior inference',
            train: 'Baum-Welch parameter estimation',
            generate: 'Sample from the model',
            predict: 'Predict next state/observation',
            likelihood: 'Compute sequence probability'
          }
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: JSON.stringify({
        error: errorMessage,
        tool: 'hidden_markov',
        hint: 'Use operation="info" for documentation'
      }, null, 2),
      isError: true
    };
  }
}

export function ishiddenmarkovAvailable(): boolean {
  return true;
}
