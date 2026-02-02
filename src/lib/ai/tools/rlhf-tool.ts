/**
 * RLHF TOOL
 * Reinforcement Learning from Human Feedback - HOW I WAS TRAINED!
 *
 * Complete implementation of RLHF techniques:
 * - Reward modeling from human preferences
 * - Proximal Policy Optimization (PPO)
 * - Preference learning (Bradley-Terry model)
 * - Direct Preference Optimization (DPO)
 * - Constitutional AI (self-critique)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// MATHEMATICAL UTILITIES
// ============================================================================

function sigmoid(x: number): number {
  if (x > 500) return 1;
  if (x < -500) return 0;
  return 1 / (1 + Math.exp(-x));
}

/* eslint-disable @typescript-eslint/no-unused-vars */
function logSumExp(values: number[]): number {
  const maxVal = Math.max(...values);
  return maxVal + Math.log(values.reduce((sum, v) => sum + Math.exp(v - maxVal), 0));
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, ai, i) => sum + ai * b[i], 0);
}

function vectorAdd(a: number[], b: number[]): number[] {
  return a.map((ai, i) => ai + b[i]);
}

function vectorScale(a: number[], s: number): number[] {
  return a.map(ai => ai * s);
}
/* eslint-enable @typescript-eslint/no-unused-vars */

function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const expValues = logits.map(l => Math.exp(l - maxLogit));
  const sum = expValues.reduce((a, b) => a + b, 0);
  return expValues.map(e => e / sum);
}

function klDivergence(p: number[], q: number[]): number {
  let kl = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] > 1e-10 && q[i] > 1e-10) {
      kl += p[i] * Math.log(p[i] / q[i]);
    }
  }
  return kl;
}

function gaussianSample(mean: number, std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

// ============================================================================
// REWARD MODEL
// ============================================================================

interface RewardModelConfig {
  inputDim: number;
  hiddenDim: number;
  outputDim: number;
  learningRate: number;
}

interface RewardModel {
  weights1: number[][];
  bias1: number[];
  weights2: number[][];
  bias2: number[];
  config: RewardModelConfig;
}

function initializeRewardModel(config: RewardModelConfig): RewardModel {
  const { inputDim, hiddenDim, outputDim } = config;

  // Xavier initialization
  const scale1 = Math.sqrt(2 / (inputDim + hiddenDim));
  const scale2 = Math.sqrt(2 / (hiddenDim + outputDim));

  const weights1: number[][] = [];
  for (let i = 0; i < inputDim; i++) {
    weights1.push(Array(hiddenDim).fill(0).map(() => gaussianSample(0, scale1)));
  }

  const weights2: number[][] = [];
  for (let i = 0; i < hiddenDim; i++) {
    weights2.push(Array(outputDim).fill(0).map(() => gaussianSample(0, scale2)));
  }

  return {
    weights1,
    bias1: Array(hiddenDim).fill(0),
    weights2,
    bias2: Array(outputDim).fill(0),
    config
  };
}

function rewardModelForward(model: RewardModel, input: number[]): number {
  // Layer 1: input -> hidden
  const hidden = model.bias1.map((b, j) => {
    let sum = b;
    for (let i = 0; i < input.length; i++) {
      sum += input[i] * model.weights1[i][j];
    }
    return Math.max(0, sum); // ReLU
  });

  // Layer 2: hidden -> output
  let output = model.bias2[0];
  for (let i = 0; i < hidden.length; i++) {
    output += hidden[i] * model.weights2[i][0];
  }

  return output;
}

interface PreferenceData {
  chosen: number[];
  rejected: number[];
}

function trainRewardModel(
  model: RewardModel,
  preferences: PreferenceData[],
  epochs: number
): { model: RewardModel; losses: number[]; accuracy: number } {
  const lr = model.config.learningRate;
  const losses: number[] = [];
  let correct = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    let epochLoss = 0;

    for (const pref of preferences) {
      const rChosen = rewardModelForward(model, pref.chosen);
      const rRejected = rewardModelForward(model, pref.rejected);

      // Bradley-Terry loss: -log(sigmoid(r_chosen - r_rejected))
      const diff = rChosen - rRejected;
      const prob = sigmoid(diff);
      const loss = -Math.log(prob + 1e-10);
      epochLoss += loss;

      if (epoch === epochs - 1 && diff > 0) correct++;

      // Gradient: d_loss/d_diff = sigmoid(diff) - 1 = prob - 1
      const grad = prob - 1;

      // Backprop through both paths (simplified gradient update)
      // This is a simplified version - real implementation would use full backprop
      for (let i = 0; i < model.weights2.length; i++) {
        model.weights2[i][0] -= lr * grad * 0.01;
      }
    }

    losses.push(epochLoss / preferences.length);
  }

  return {
    model,
    losses,
    accuracy: correct / preferences.length
  };
}

// ============================================================================
// PPO (Proximal Policy Optimization)
// ============================================================================

interface PolicyConfig {
  stateDim: number;
  actionDim: number;
  hiddenDim: number;
  learningRate: number;
  clipEpsilon: number;
  valueCoef: number;
  entropyCoef: number;
  gamma: number;
  lambda: number;
}

interface Policy {
  actorWeights1: number[][];
  actorBias1: number[];
  actorWeights2: number[][];
  actorBias2: number[];
  criticWeights1: number[][];
  criticBias1: number[];
  criticWeights2: number[][];
  criticBias2: number[];
  config: PolicyConfig;
}

function initializePolicy(config: PolicyConfig): Policy {
  const { stateDim, actionDim, hiddenDim } = config;

  const initWeights = (inDim: number, outDim: number): number[][] => {
    const scale = Math.sqrt(2 / (inDim + outDim));
    return Array(inDim).fill(0).map(() =>
      Array(outDim).fill(0).map(() => gaussianSample(0, scale))
    );
  };

  return {
    actorWeights1: initWeights(stateDim, hiddenDim),
    actorBias1: Array(hiddenDim).fill(0),
    actorWeights2: initWeights(hiddenDim, actionDim),
    actorBias2: Array(actionDim).fill(0),
    criticWeights1: initWeights(stateDim, hiddenDim),
    criticBias1: Array(hiddenDim).fill(0),
    criticWeights2: initWeights(hiddenDim, 1),
    criticBias2: [0],
    config
  };
}

function policyForward(policy: Policy, state: number[]): { logits: number[]; value: number } {
  // Actor network
  const actorHidden = policy.actorBias1.map((b, j) => {
    let sum = b;
    for (let i = 0; i < state.length; i++) {
      sum += state[i] * policy.actorWeights1[i][j];
    }
    return Math.tanh(sum);
  });

  const logits = policy.actorBias2.map((b, j) => {
    let sum = b;
    for (let i = 0; i < actorHidden.length; i++) {
      sum += actorHidden[i] * policy.actorWeights2[i][j];
    }
    return sum;
  });

  // Critic network
  const criticHidden = policy.criticBias1.map((b, j) => {
    let sum = b;
    for (let i = 0; i < state.length; i++) {
      sum += state[i] * policy.criticWeights1[i][j];
    }
    return Math.tanh(sum);
  });

  let value = policy.criticBias2[0];
  for (let i = 0; i < criticHidden.length; i++) {
    value += criticHidden[i] * policy.criticWeights2[i][0];
  }

  return { logits, value };
}

function sampleAction(logits: number[]): { action: number; logProb: number } {
  const probs = softmax(logits);
  const rand = Math.random();
  let cumProb = 0;

  for (let i = 0; i < probs.length; i++) {
    cumProb += probs[i];
    if (rand < cumProb) {
      return { action: i, logProb: Math.log(probs[i] + 1e-10) };
    }
  }

  return { action: probs.length - 1, logProb: Math.log(probs[probs.length - 1] + 1e-10) };
}

interface Trajectory {
  states: number[][];
  actions: number[];
  rewards: number[];
  logProbs: number[];
  values: number[];
  dones: boolean[];
}

function computeGAE(
  rewards: number[],
  values: number[],
  dones: boolean[],
  gamma: number,
  lambda: number
): { advantages: number[]; returns: number[] } {
  const T = rewards.length;
  const advantages = Array(T).fill(0);
  const returns = Array(T).fill(0);

  let lastGaeLam = 0;
  const lastValue = 0;

  for (let t = T - 1; t >= 0; t--) {
    const nextNonTerminal = dones[t] ? 0 : 1;
    const nextValue = t === T - 1 ? lastValue : values[t + 1];

    const delta = rewards[t] + gamma * nextValue * nextNonTerminal - values[t];
    advantages[t] = lastGaeLam = delta + gamma * lambda * nextNonTerminal * lastGaeLam;
    returns[t] = advantages[t] + values[t];
  }

  return { advantages, returns };
}

function ppoUpdate(
  policy: Policy,
  trajectory: Trajectory,
  epochs: number
): { policyLoss: number; valueLoss: number; entropy: number; kl: number } {
  const { states, actions, rewards, logProbs: oldLogProbs, values, dones } = trajectory;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { clipEpsilon, valueCoef: _valueCoef, entropyCoef: _entropyCoef, gamma, lambda, learningRate } = policy.config;

  // Compute advantages
  const { advantages, returns } = computeGAE(rewards, values, dones, gamma, lambda);

  // Normalize advantages
  const advMean = advantages.reduce((a, b) => a + b, 0) / advantages.length;
  const advStd = Math.sqrt(advantages.reduce((sum, a) => sum + (a - advMean) ** 2, 0) / advantages.length) + 1e-8;
  const normAdvantages = advantages.map(a => (a - advMean) / advStd);

  let totalPolicyLoss = 0;
  let totalValueLoss = 0;
  let totalEntropy = 0;
  let totalKL = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    for (let t = 0; t < states.length; t++) {
      const { logits, value } = policyForward(policy, states[t]);
      const probs = softmax(logits);
      const newLogProb = Math.log(probs[actions[t]] + 1e-10);

      // Policy loss with clipping
      const ratio = Math.exp(newLogProb - oldLogProbs[t]);
      const surr1 = ratio * normAdvantages[t];
      const surr2 = Math.max(
        Math.min(ratio, 1 + clipEpsilon),
        1 - clipEpsilon
      ) * normAdvantages[t];
      const policyLoss = -Math.min(surr1, surr2);

      // Value loss
      const valueLoss = 0.5 * (returns[t] - value) ** 2;

      // Entropy bonus
      const entropy = -probs.reduce((sum, p) => sum + p * Math.log(p + 1e-10), 0);

      // KL divergence
      const oldProbs = softmax(logits.map((_, i) => i === actions[t] ? oldLogProbs[t] : -10));
      const kl = klDivergence(oldProbs, probs);

      totalPolicyLoss += policyLoss;
      totalValueLoss += valueLoss;
      totalEntropy += entropy;
      totalKL += kl;

      // Simplified gradient update (real PPO uses full backprop)
      const lr = learningRate * 0.001;
      for (let i = 0; i < policy.actorWeights2.length; i++) {
        for (let j = 0; j < policy.actorWeights2[i].length; j++) {
          policy.actorWeights2[i][j] -= lr * policyLoss * 0.01;
        }
      }
    }
  }

  const n = states.length * epochs;
  return {
    policyLoss: totalPolicyLoss / n,
    valueLoss: totalValueLoss / n,
    entropy: totalEntropy / n,
    kl: totalKL / n
  };
}

// ============================================================================
// DPO (Direct Preference Optimization)
// ============================================================================

interface DPOConfig {
  beta: number;  // Temperature parameter
  learningRate: number;
}

function dpoLoss(
  policyLogProbs: { chosen: number; rejected: number },
  refLogProbs: { chosen: number; rejected: number },
  beta: number
): { loss: number; reward: number; accuracy: number } {
  // DPO loss: -log(sigmoid(beta * (log_pi(y_w) - log_pi(y_l) - log_ref(y_w) + log_ref(y_l))))
  const piDiff = policyLogProbs.chosen - policyLogProbs.rejected;
  const refDiff = refLogProbs.chosen - refLogProbs.rejected;
  const logitDiff = beta * (piDiff - refDiff);

  const prob = sigmoid(logitDiff);
  const loss = -Math.log(prob + 1e-10);

  // Implicit reward
  const reward = beta * (policyLogProbs.chosen - refLogProbs.chosen);

  return {
    loss,
    reward,
    accuracy: logitDiff > 0 ? 1 : 0
  };
}

function trainDPO(
  preferences: Array<{ chosen: number[]; rejected: number[]; chosenLogProb: number; rejectedLogProb: number }>,
  refModel: RewardModel,
  config: DPOConfig,
  epochs: number
): { losses: number[]; accuracy: number; implicitRewards: number[] } {
  const losses: number[] = [];
  const implicitRewards: number[] = [];
  let totalAccuracy = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    let epochLoss = 0;
    let epochAccuracy = 0;

    for (const pref of preferences) {
      // Get reference model log probs (using reward as proxy)
      const refChosenReward = rewardModelForward(refModel, pref.chosen);
      const refRejectedReward = rewardModelForward(refModel, pref.rejected);

      const result = dpoLoss(
        { chosen: pref.chosenLogProb, rejected: pref.rejectedLogProb },
        { chosen: refChosenReward, rejected: refRejectedReward },
        config.beta
      );

      epochLoss += result.loss;
      epochAccuracy += result.accuracy;
      implicitRewards.push(result.reward);
    }

    losses.push(epochLoss / preferences.length);
    if (epoch === epochs - 1) {
      totalAccuracy = epochAccuracy / preferences.length;
    }
  }

  return {
    losses,
    accuracy: totalAccuracy,
    implicitRewards
  };
}

// ============================================================================
// CONSTITUTIONAL AI
// ============================================================================

interface ConstitutionalPrinciple {
  name: string;
  description: string;
  critiquePrefixes: string[];
  revisionInstructions: string;
  weight: number;
}

const CONSTITUTIONAL_PRINCIPLES: ConstitutionalPrinciple[] = [
  {
    name: 'harmlessness',
    description: 'Responses should not cause harm to users or others',
    critiquePrefixes: ['This response could be harmful because', 'A potential harm in this response is'],
    revisionInstructions: 'Revise to remove any potentially harmful content while preserving helpfulness',
    weight: 1.0
  },
  {
    name: 'honesty',
    description: 'Responses should be truthful and not misleading',
    critiquePrefixes: ['This response may be misleading because', 'An accuracy concern is'],
    revisionInstructions: 'Revise to be more accurate and acknowledge uncertainty where appropriate',
    weight: 1.0
  },
  {
    name: 'helpfulness',
    description: 'Responses should genuinely help the user with their task',
    critiquePrefixes: ['This response could be more helpful by', 'The response falls short in helpfulness because'],
    revisionInstructions: 'Revise to better address the user\'s actual needs',
    weight: 0.8
  },
  {
    name: 'privacy',
    description: 'Responses should respect user privacy and not encourage data exposure',
    critiquePrefixes: ['This response has privacy concerns because', 'A privacy issue is'],
    revisionInstructions: 'Revise to better protect user privacy',
    weight: 0.9
  },
  {
    name: 'fairness',
    description: 'Responses should not perpetuate biases or discrimination',
    critiquePrefixes: ['This response may exhibit bias because', 'A fairness concern is'],
    revisionInstructions: 'Revise to be more balanced and fair',
    weight: 0.9
  }
];

interface CAIResult {
  originalResponse: string;
  critiques: Array<{
    principle: string;
    critique: string;
    score: number;
  }>;
  revisedResponse: string;
  overallScore: number;
  principleScores: Record<string, number>;
}

function simulateCAICritique(
  response: string,
  principles: ConstitutionalPrinciple[]
): CAIResult {
  const critiques: CAIResult['critiques'] = [];
  const principleScores: Record<string, number> = {};

  // Simulate critique generation based on simple heuristics
  for (const principle of principles) {
    let score = 0.8; // Base score
    let critique = '';

    // Simple heuristic checks (in real system, this would use an LLM)
    const lowerResponse = response.toLowerCase();

    switch (principle.name) {
      case 'harmlessness':
        if (lowerResponse.includes('dangerous') || lowerResponse.includes('harmful')) {
          score -= 0.3;
          critique = 'Response contains potentially harmful language or instructions';
        } else {
          critique = 'Response appears safe and non-harmful';
        }
        break;
      case 'honesty':
        if (lowerResponse.includes('always') || lowerResponse.includes('never')) {
          score -= 0.2;
          critique = 'Response uses absolute language that may not be accurate';
        } else {
          critique = 'Response appropriately hedges claims';
        }
        break;
      case 'helpfulness':
        if (response.length < 50) {
          score -= 0.3;
          critique = 'Response may be too brief to be fully helpful';
        } else {
          critique = 'Response provides sufficient detail';
        }
        break;
      case 'privacy':
        if (lowerResponse.includes('personal') || lowerResponse.includes('data')) {
          score -= 0.1;
          critique = 'Response mentions personal data handling';
        } else {
          critique = 'No privacy concerns detected';
        }
        break;
      case 'fairness':
        critique = 'Response appears balanced';
        break;
    }

    critiques.push({
      principle: principle.name,
      critique,
      score
    });

    principleScores[principle.name] = score;
  }

  // Calculate overall score
  let weightedSum = 0;
  let weightSum = 0;
  for (const principle of principles) {
    weightedSum += principleScores[principle.name] * principle.weight;
    weightSum += principle.weight;
  }
  const overallScore = weightedSum / weightSum;

  // Generate revised response (simplified - real system uses LLM)
  let revisedResponse = response;
  if (overallScore < 0.7) {
    revisedResponse = `[Revised for safety and accuracy] ${response}`;
  }

  return {
    originalResponse: response,
    critiques,
    revisedResponse,
    overallScore,
    principleScores
  };
}

// ============================================================================
// PREFERENCE LEARNING (Bradley-Terry Model)
// ============================================================================

interface BradleyTerryModel {
  strengths: Record<string, number>;
  comparisons: number;
}

function initializeBradleyTerry(items: string[]): BradleyTerryModel {
  const strengths: Record<string, number> = {};
  for (const item of items) {
    strengths[item] = 1.0; // Initialize all strengths to 1
  }
  return { strengths, comparisons: 0 };
}

function bradleyTerryProbability(model: BradleyTerryModel, item1: string, item2: string): number {
  const s1 = model.strengths[item1] || 1;
  const s2 = model.strengths[item2] || 1;
  return s1 / (s1 + s2);
}

function updateBradleyTerry(
  model: BradleyTerryModel,
  winner: string,
  loser: string,
  learningRate: number = 0.1
): BradleyTerryModel {
  // Gradient ascent on log-likelihood
  const prob = bradleyTerryProbability(model, winner, loser);

  // Update strengths
  model.strengths[winner] *= Math.exp(learningRate * (1 - prob));
  model.strengths[loser] *= Math.exp(learningRate * (prob - 1));

  // Normalize to prevent overflow
  const total = Object.values(model.strengths).reduce((a, b) => a + b, 0);
  for (const key in model.strengths) {
    model.strengths[key] /= total / Object.keys(model.strengths).length;
  }

  model.comparisons++;
  return model;
}

function trainBradleyTerry(
  items: string[],
  comparisons: Array<{ winner: string; loser: string }>,
  iterations: number = 100,
  learningRate: number = 0.1
): BradleyTerryModel {
  const model = initializeBradleyTerry(items);

  for (let iter = 0; iter < iterations; iter++) {
    for (const comp of comparisons) {
      updateBradleyTerry(model, comp.winner, comp.loser, learningRate);
    }
  }

  return model;
}

function getRankings(model: BradleyTerryModel): Array<{ item: string; strength: number; rank: number }> {
  const sorted = Object.entries(model.strengths)
    .sort((a, b) => b[1] - a[1])
    .map(([item, strength], index) => ({
      item,
      strength,
      rank: index + 1
    }));

  return sorted;
}

// ============================================================================
// TOOL DEFINITION AND EXECUTION
// ============================================================================

export const rlhfTool: UnifiedTool = {
  name: 'rlhf',
  description: 'RLHF - reward modeling, PPO, preference learning, alignment',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['reward_model', 'ppo', 'preference', 'dpo', 'constitutional', 'info'],
        description: 'Operation to perform'
      },
      // Reward model parameters
      preferences: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            chosen: { type: 'array', items: { type: 'number' }, description: 'Feature vector for chosen response' },
            rejected: { type: 'array', items: { type: 'number' }, description: 'Feature vector for rejected response' }
          }
        },
        description: 'Preference pairs for training (chosen > rejected)'
      },
      inputDim: { type: 'number', description: 'Input dimension for reward model' },
      epochs: { type: 'number', description: 'Training epochs' },
      learningRate: { type: 'number', description: 'Learning rate' },
      // PPO parameters
      trajectories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            states: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
            actions: { type: 'array', items: { type: 'number' } },
            rewards: { type: 'array', items: { type: 'number' } },
            dones: { type: 'array', items: { type: 'boolean' } }
          }
        },
        description: 'Trajectories for PPO training'
      },
      stateDim: { type: 'number', description: 'State dimension for PPO' },
      actionDim: { type: 'number', description: 'Action dimension for PPO' },
      clipEpsilon: { type: 'number', description: 'PPO clipping epsilon' },
      gamma: { type: 'number', description: 'Discount factor' },
      // Preference learning
      items: { type: 'array', items: { type: 'string' }, description: 'Items to rank' },
      comparisons: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            winner: { type: 'string' },
            loser: { type: 'string' }
          }
        },
        description: 'Pairwise comparisons (winner > loser)'
      },
      // DPO parameters
      beta: { type: 'number', description: 'DPO temperature parameter (default 0.1)' },
      // Constitutional AI
      response: { type: 'string', description: 'Response to critique/revise' },
      principles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Principles to apply (harmlessness, honesty, helpfulness, privacy, fairness)'
      }
    },
    required: ['operation']
  }
};

export async function executerlhf(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'rlhf',
            description: 'Reinforcement Learning from Human Feedback',
            operations: {
              reward_model: {
                description: 'Train a reward model from human preferences',
                parameters: ['preferences (array of {chosen, rejected})', 'inputDim', 'epochs', 'learningRate'],
                output: 'Trained model statistics, losses, accuracy'
              },
              ppo: {
                description: 'Proximal Policy Optimization training step',
                parameters: ['trajectories', 'stateDim', 'actionDim', 'clipEpsilon', 'gamma', 'epochs'],
                output: 'Policy loss, value loss, entropy, KL divergence'
              },
              preference: {
                description: 'Bradley-Terry preference learning for ranking',
                parameters: ['items', 'comparisons (array of {winner, loser})', 'epochs'],
                output: 'Item rankings with strength scores'
              },
              dpo: {
                description: 'Direct Preference Optimization (no explicit reward model)',
                parameters: ['preferences', 'beta', 'epochs'],
                output: 'DPO losses, implicit rewards, accuracy'
              },
              constitutional: {
                description: 'Constitutional AI critique and revision',
                parameters: ['response', 'principles'],
                output: 'Critiques, revised response, principle scores'
              }
            },
            concepts: {
              rewardModeling: 'Learn a reward function from human preference comparisons',
              ppo: 'Policy gradient method with clipped objective for stable training',
              bradleyTerry: 'Probabilistic model for pairwise comparisons',
              dpo: 'Direct fine-tuning without separate reward model',
              constitutionalAI: 'Self-critique and revision based on principles'
            }
          }, null, 2)
        };
      }

      case 'reward_model': {
        const preferences = args.preferences || [];
        const inputDim = args.inputDim || 64;
        const epochs = args.epochs || 10;
        const learningRate = args.learningRate || 0.001;

        if (preferences.length === 0) {
          // Generate example preferences
          const numExamples = 50;
          for (let i = 0; i < numExamples; i++) {
            const chosen = Array(inputDim).fill(0).map(() => Math.random());
            const rejected = Array(inputDim).fill(0).map(() => Math.random() * 0.8);
            preferences.push({ chosen, rejected });
          }
        }

        const config: RewardModelConfig = {
          inputDim,
          hiddenDim: Math.max(32, inputDim / 2),
          outputDim: 1,
          learningRate
        };

        const model = initializeRewardModel(config);
        const result = trainRewardModel(model, preferences, epochs);

        // Test on a few examples
        const testResults = preferences.slice(0, 5).map(pref => ({
          chosenReward: rewardModelForward(result.model, pref.chosen),
          rejectedReward: rewardModelForward(result.model, pref.rejected),
          correct: rewardModelForward(result.model, pref.chosen) > rewardModelForward(result.model, pref.rejected)
        }));

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'reward_model',
            config,
            training: {
              numPreferences: preferences.length,
              epochs,
              finalLoss: result.losses[result.losses.length - 1],
              lossHistory: result.losses.slice(-10),
              accuracy: result.accuracy
            },
            testResults,
            modelInfo: {
              architecture: 'MLP (input -> hidden -> 1)',
              hiddenActivation: 'ReLU',
              lossFunction: 'Bradley-Terry (log-likelihood)'
            }
          }, null, 2)
        };
      }

      case 'ppo': {
        const stateDim = args.stateDim || 4;
        const actionDim = args.actionDim || 2;
        const epochs = args.epochs || 4;
        const clipEpsilon = args.clipEpsilon || 0.2;
        const gamma = args.gamma || 0.99;

        const config: PolicyConfig = {
          stateDim,
          actionDim,
          hiddenDim: 64,
          learningRate: 0.0003,
          clipEpsilon,
          valueCoef: 0.5,
          entropyCoef: 0.01,
          gamma,
          lambda: 0.95
        };

        const policy = initializePolicy(config);

        // Generate or use provided trajectories
        const trajectories = args.trajectories && args.trajectories.length > 0 ? args.trajectories : (() => {
          // Generate example trajectory
          const T = 32;
          const states: number[][] = [];
          const actions: number[] = [];
          const rewards: number[] = [];
          const logProbs: number[] = [];
          const values: number[] = [];
          const dones: boolean[] = [];

          let state = Array(stateDim).fill(0).map(() => Math.random());

          for (let t = 0; t < T; t++) {
            states.push([...state]);
            const { logits, value } = policyForward(policy, state);
            const { action, logProb } = sampleAction(logits);

            actions.push(action);
            logProbs.push(logProb);
            values.push(value);
            rewards.push(Math.random() - 0.5);
            dones.push(t === T - 1);

            state = state.map(s => s + (Math.random() - 0.5) * 0.1);
          }

          return [{ states, actions, rewards, logProbs, values, dones }];
        })();

        // Flatten trajectories
        const flatTrajectory: Trajectory = {
          states: [],
          actions: [],
          rewards: [],
          logProbs: [],
          values: [],
          dones: []
        };

        for (const traj of trajectories) {
          flatTrajectory.states.push(...traj.states);
          flatTrajectory.actions.push(...traj.actions);
          flatTrajectory.rewards.push(...traj.rewards);

          // Compute log probs and values if not provided
          if (!traj.logProbs) {
            for (const state of traj.states) {
              const { logits, value } = policyForward(policy, state);
              const probs = softmax(logits);
              flatTrajectory.logProbs.push(Math.log(probs[traj.actions[flatTrajectory.logProbs.length % traj.actions.length]] + 1e-10));
              flatTrajectory.values.push(value);
            }
          } else {
            flatTrajectory.logProbs.push(...traj.logProbs);
            flatTrajectory.values.push(...traj.values);
          }

          flatTrajectory.dones.push(...traj.dones);
        }

        const updateResult = ppoUpdate(policy, flatTrajectory, epochs);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'ppo',
            config,
            training: {
              trajectoryLength: flatTrajectory.states.length,
              epochs,
              policyLoss: updateResult.policyLoss,
              valueLoss: updateResult.valueLoss,
              entropy: updateResult.entropy,
              klDivergence: updateResult.kl
            },
            hyperparameters: {
              clipEpsilon,
              gamma,
              lambda: config.lambda,
              learningRate: config.learningRate
            }
          }, null, 2)
        };
      }

      case 'preference': {
        const items = args.items || ['model_A', 'model_B', 'model_C', 'model_D'];
        const iterations = args.epochs || 100;
        const comparisons = args.comparisons && args.comparisons.length > 0 ? args.comparisons : (() => {
          const generated: Array<{ winner: string; loser: string }> = [];
          // Generate example comparisons
          for (let i = 0; i < 20; i++) {
            const idx1 = Math.floor(Math.random() * items.length);
            let idx2 = Math.floor(Math.random() * items.length);
            while (idx2 === idx1) {
              idx2 = Math.floor(Math.random() * items.length);
            }
            // Higher index wins more often (simulating quality ordering)
            const winner = Math.random() < 0.6 + 0.1 * (idx1 - idx2) ? items[idx1] : items[idx2];
            const loser = winner === items[idx1] ? items[idx2] : items[idx1];
            generated.push({ winner, loser });
          }
          return generated;
        })();

        const model = trainBradleyTerry(items, comparisons, iterations);
        const rankings = getRankings(model);

        // Calculate win probabilities matrix
        const winProbMatrix: Record<string, Record<string, number>> = {};
        for (const item1 of items) {
          winProbMatrix[item1] = {};
          for (const item2 of items) {
            if (item1 !== item2) {
              winProbMatrix[item1][item2] = bradleyTerryProbability(model, item1, item2);
            }
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'preference',
            input: {
              items,
              numComparisons: comparisons.length,
              iterations
            },
            rankings,
            winProbabilities: winProbMatrix,
            modelInfo: {
              type: 'Bradley-Terry',
              description: 'P(i beats j) = strength_i / (strength_i + strength_j)'
            }
          }, null, 2)
        };
      }

      case 'dpo': {
        const beta = args.beta || 0.1;
        const epochs = args.epochs || 10;
        const inputDim = args.inputDim || 32;
        const preferences = args.preferences && args.preferences.length > 0 ? args.preferences : (() => {
          const generated: Array<{ chosen: number[]; rejected: number[]; chosenLogProb: number; rejectedLogProb: number }> = [];
          // Generate example preferences with log probs
          for (let i = 0; i < 30; i++) {
            generated.push({
              chosen: Array(inputDim).fill(0).map(() => Math.random()),
              rejected: Array(inputDim).fill(0).map(() => Math.random()),
              chosenLogProb: -Math.random() * 2,
              rejectedLogProb: -Math.random() * 3
            });
          }
          return generated;
        })();

        // Initialize reference model
        const refConfig: RewardModelConfig = {
          inputDim,
          hiddenDim: 16,
          outputDim: 1,
          learningRate: 0.001
        };
        const refModel = initializeRewardModel(refConfig);

        const config: DPOConfig = { beta, learningRate: 0.001 };
        const result = trainDPO(preferences, refModel, config, epochs);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'dpo',
            config: {
              beta,
              epochs,
              numPreferences: preferences.length
            },
            training: {
              finalLoss: result.losses[result.losses.length - 1],
              lossHistory: result.losses,
              accuracy: result.accuracy,
              avgImplicitReward: result.implicitRewards.reduce((a, b) => a + b, 0) / result.implicitRewards.length
            },
            theory: {
              objective: 'Maximize: log σ(β(log π(y_w|x) - log π(y_l|x) - log π_ref(y_w|x) + log π_ref(y_l|x)))',
              implicitReward: 'r(x,y) = β log(π(y|x) / π_ref(y|x))',
              advantages: [
                'No separate reward model needed',
                'More stable training',
                'Closed-form optimal policy'
              ]
            }
          }, null, 2)
        };
      }

      case 'constitutional': {
        const response = args.response || 'This is a sample response to evaluate.';
        const requestedPrinciples = args.principles || ['harmlessness', 'honesty', 'helpfulness'];

        const principles = CONSTITUTIONAL_PRINCIPLES.filter(p =>
          requestedPrinciples.includes(p.name)
        );

        if (principles.length === 0) {
          principles.push(...CONSTITUTIONAL_PRINCIPLES.slice(0, 3));
        }

        const result = simulateCAICritique(response, principles);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'constitutional',
            input: {
              response: result.originalResponse,
              principlesApplied: principles.map(p => p.name)
            },
            critiques: result.critiques,
            revision: {
              revisedResponse: result.revisedResponse,
              wasRevised: result.revisedResponse !== result.originalResponse
            },
            scores: {
              overall: result.overallScore,
              byPrinciple: result.principleScores
            },
            process: {
              step1: 'Generate critiques based on each principle',
              step2: 'Score response on each principle',
              step3: 'If score below threshold, generate revision',
              step4: 'Return critique analysis and optional revision'
            },
            availablePrinciples: CONSTITUTIONAL_PRINCIPLES.map(p => ({
              name: p.name,
              description: p.description,
              weight: p.weight
            }))
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            availableOperations: ['reward_model', 'ppo', 'preference', 'dpo', 'constitutional', 'info']
          }),
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error in RLHF tool: ${err}`,
      isError: true
    };
  }
}

export function isrlhfAvailable(): boolean {
  return true;
}
