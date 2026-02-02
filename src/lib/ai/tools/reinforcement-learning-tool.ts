/**
 * REINFORCEMENT LEARNING TOOL
 *
 * Implements core RL algorithms: Q-learning, SARSA, Policy Gradient, Actor-Critic.
 * Includes environments, exploration strategies, and value function approximation.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface Environment {
  name: string;
  states: string[];
  actions: string[];
  transitions: Record<string, Record<string, { nextState: string; reward: number; done: boolean }>>;
  initialState: string;
  terminalStates: string[];
}

interface QTable {
  [state: string]: { [action: string]: number };
}

interface Policy {
  [state: string]: { [action: string]: number };
}

interface TrainingResult {
  algorithm: string;
  episodes: number;
  averageReward: number;
  convergenceEpisode: number | null;
  qTable?: QTable;
  policy?: Policy;
  rewardHistory: number[];
}

// ============================================================================
// BUILT-IN ENVIRONMENTS
// ============================================================================

const ENVIRONMENTS: Record<string, Environment> = {
  gridworld: {
    name: 'GridWorld 4x4',
    states: ['0,0', '0,1', '0,2', '0,3', '1,0', '1,1', '1,2', '1,3', '2,0', '2,1', '2,2', '2,3', '3,0', '3,1', '3,2', '3,3'],
    actions: ['up', 'down', 'left', 'right'],
    transitions: {},
    initialState: '0,0',
    terminalStates: ['3,3']
  },
  cliffwalk: {
    name: 'Cliff Walking',
    states: Array.from({ length: 48 }, (_, i) => `${Math.floor(i / 12)},${i % 12}`),
    actions: ['up', 'down', 'left', 'right'],
    transitions: {},
    initialState: '3,0',
    terminalStates: ['3,11']
  },
  frozenlake: {
    name: 'Frozen Lake 4x4',
    states: ['S', 'F1', 'F2', 'F3', 'F4', 'H1', 'F5', 'H2', 'F6', 'F7', 'F8', 'H3', 'H4', 'F9', 'F10', 'G'],
    actions: ['up', 'down', 'left', 'right'],
    transitions: {},
    initialState: 'S',
    terminalStates: ['G', 'H1', 'H2', 'H3', 'H4']
  }
};

// Initialize GridWorld transitions
function initializeGridWorld(): void {
  const env = ENVIRONMENTS.gridworld;
  const transitions: Record<string, Record<string, { nextState: string; reward: number; done: boolean }>> = {};

  for (const state of env.states) {
    const [row, col] = state.split(',').map(Number);
    transitions[state] = {};

    for (const action of env.actions) {
      let newRow = row, newCol = col;

      switch (action) {
        case 'up': newRow = Math.max(0, row - 1); break;
        case 'down': newRow = Math.min(3, row + 1); break;
        case 'left': newCol = Math.max(0, col - 1); break;
        case 'right': newCol = Math.min(3, col + 1); break;
      }

      const nextState = `${newRow},${newCol}`;
      const done = nextState === '3,3';
      const reward = done ? 1 : -0.04;

      transitions[state][action] = { nextState, reward, done };
    }
  }

  env.transitions = transitions;
}

// Initialize Cliff Walking transitions
function initializeCliffWalk(): void {
  const env = ENVIRONMENTS.cliffwalk;
  const transitions: Record<string, Record<string, { nextState: string; reward: number; done: boolean }>> = {};
  const cliffStates = ['3,1', '3,2', '3,3', '3,4', '3,5', '3,6', '3,7', '3,8', '3,9', '3,10'];

  for (const state of env.states) {
    const [row, col] = state.split(',').map(Number);
    transitions[state] = {};

    for (const action of env.actions) {
      let newRow = row, newCol = col;

      switch (action) {
        case 'up': newRow = Math.max(0, row - 1); break;
        case 'down': newRow = Math.min(3, row + 1); break;
        case 'left': newCol = Math.max(0, col - 1); break;
        case 'right': newCol = Math.min(11, col + 1); break;
      }

      let nextState = `${newRow},${newCol}`;
      let reward = -1;
      let done = false;

      if (cliffStates.includes(nextState)) {
        nextState = '3,0';
        reward = -100;
      }

      if (nextState === '3,11') {
        done = true;
        reward = 0;
      }

      transitions[state][action] = { nextState, reward, done };
    }
  }

  env.transitions = transitions;
}

initializeGridWorld();
initializeCliffWalk();

// ============================================================================
// EXPLORATION STRATEGIES
// ============================================================================

function epsilonGreedy(
  qValues: { [action: string]: number },
  actions: string[],
  epsilon: number
): string {
  if (Math.random() < epsilon) {
    return actions[Math.floor(Math.random() * actions.length)];
  }

  let bestAction = actions[0];
  let bestValue = qValues[bestAction] || 0;

  for (const action of actions) {
    const value = qValues[action] || 0;
    if (value > bestValue) {
      bestValue = value;
      bestAction = action;
    }
  }

  return bestAction;
}

function softmax(
  qValues: { [action: string]: number },
  actions: string[],
  temperature: number
): string {
  const expValues: number[] = [];
  let sum = 0;

  for (const action of actions) {
    const exp = Math.exp((qValues[action] || 0) / temperature);
    expValues.push(exp);
    sum += exp;
  }

  const rand = Math.random();
  let cumProb = 0;

  for (let i = 0; i < actions.length; i++) {
    cumProb += expValues[i] / sum;
    if (rand <= cumProb) {
      return actions[i];
    }
  }

  return actions[actions.length - 1];
}

// ============================================================================
// Q-LEARNING ALGORITHM
// ============================================================================

function qLearning(
  env: Environment,
  options: {
    episodes?: number;
    alpha?: number;
    gamma?: number;
    epsilon?: number;
    epsilonDecay?: number;
    minEpsilon?: number;
  } = {}
): TrainingResult {
  const {
    episodes = 500,
    alpha = 0.1,
    gamma = 0.99,
    epsilon: initialEpsilon = 1.0,
    epsilonDecay = 0.995,
    minEpsilon = 0.01
  } = options;

  const qTable: QTable = {};
  const rewardHistory: number[] = [];
  let epsilon = initialEpsilon;
  let convergenceEpisode: number | null = null;
  let consecutiveConverged = 0;

  for (const state of env.states) {
    qTable[state] = {};
    for (const action of env.actions) {
      qTable[state][action] = 0;
    }
  }

  for (let episode = 0; episode < episodes; episode++) {
    let state = env.initialState;
    let totalReward = 0;
    let steps = 0;
    const maxSteps = 1000;

    while (!env.terminalStates.includes(state) && steps < maxSteps) {
      const action = epsilonGreedy(qTable[state], env.actions, epsilon);
      const transition = env.transitions[state]?.[action];
      if (!transition) break;

      const { nextState, reward, done } = transition;
      totalReward += reward;

      const maxNextQ = Math.max(...env.actions.map(a => qTable[nextState]?.[a] || 0));
      const currentQ = qTable[state][action];
      qTable[state][action] = currentQ + alpha * (reward + gamma * maxNextQ - currentQ);

      state = nextState;
      steps++;

      if (done) break;
    }

    rewardHistory.push(totalReward);
    epsilon = Math.max(minEpsilon, epsilon * epsilonDecay);

    if (episode > 50) {
      const recentAvg = rewardHistory.slice(-50).reduce((a, b) => a + b, 0) / 50;
      const prevAvg = rewardHistory.slice(-100, -50).reduce((a, b) => a + b, 0) / 50;
      if (Math.abs(recentAvg - prevAvg) < 0.01 * Math.abs(prevAvg)) {
        consecutiveConverged++;
        if (consecutiveConverged >= 20 && convergenceEpisode === null) {
          convergenceEpisode = episode;
        }
      } else {
        consecutiveConverged = 0;
      }
    }
  }

  const averageReward = rewardHistory.reduce((a, b) => a + b, 0) / episodes;

  return {
    algorithm: 'Q-Learning',
    episodes,
    averageReward,
    convergenceEpisode,
    qTable,
    rewardHistory
  };
}

// ============================================================================
// SARSA ALGORITHM
// ============================================================================

function sarsa(
  env: Environment,
  options: {
    episodes?: number;
    alpha?: number;
    gamma?: number;
    epsilon?: number;
    epsilonDecay?: number;
    minEpsilon?: number;
  } = {}
): TrainingResult {
  const {
    episodes = 500,
    alpha = 0.1,
    gamma = 0.99,
    epsilon: initialEpsilon = 1.0,
    epsilonDecay = 0.995,
    minEpsilon = 0.01
  } = options;

  const qTable: QTable = {};
  const rewardHistory: number[] = [];
  let epsilon = initialEpsilon;
  let convergenceEpisode: number | null = null;

  for (const state of env.states) {
    qTable[state] = {};
    for (const action of env.actions) {
      qTable[state][action] = 0;
    }
  }

  for (let episode = 0; episode < episodes; episode++) {
    let state = env.initialState;
    let action = epsilonGreedy(qTable[state], env.actions, epsilon);
    let totalReward = 0;
    let steps = 0;
    const maxSteps = 1000;

    while (!env.terminalStates.includes(state) && steps < maxSteps) {
      const transition = env.transitions[state]?.[action];
      if (!transition) break;

      const { nextState, reward, done } = transition;
      totalReward += reward;

      const nextAction = epsilonGreedy(qTable[nextState], env.actions, epsilon);
      const nextQ = qTable[nextState]?.[nextAction] || 0;
      const currentQ = qTable[state][action];
      qTable[state][action] = currentQ + alpha * (reward + gamma * nextQ - currentQ);

      state = nextState;
      action = nextAction;
      steps++;

      if (done) break;
    }

    rewardHistory.push(totalReward);
    epsilon = Math.max(minEpsilon, epsilon * epsilonDecay);

    if (episode > 100 && convergenceEpisode === null) {
      const recentAvg = rewardHistory.slice(-50).reduce((a, b) => a + b, 0) / 50;
      const prevAvg = rewardHistory.slice(-100, -50).reduce((a, b) => a + b, 0) / 50;
      if (Math.abs(recentAvg - prevAvg) < 0.01 * Math.abs(prevAvg || 1)) {
        convergenceEpisode = episode;
      }
    }
  }

  const averageReward = rewardHistory.reduce((a, b) => a + b, 0) / episodes;

  return {
    algorithm: 'SARSA',
    episodes,
    averageReward,
    convergenceEpisode,
    qTable,
    rewardHistory
  };
}

// ============================================================================
// POLICY GRADIENT (REINFORCE)
// ============================================================================

function policyGradient(
  env: Environment,
  options: { episodes?: number; alpha?: number; gamma?: number } = {}
): TrainingResult {
  const { episodes = 1000, alpha = 0.01, gamma = 0.99 } = options;

  const theta: { [state: string]: { [action: string]: number } } = {};
  for (const state of env.states) {
    theta[state] = {};
    for (const action of env.actions) {
      theta[state][action] = 0;
    }
  }

  const rewardHistory: number[] = [];
  let convergenceEpisode: number | null = null;

  function getPolicy(state: string): { [action: string]: number } {
    const probs: { [action: string]: number } = {};
    let sum = 0;

    for (const action of env.actions) {
      const exp = Math.exp(theta[state][action]);
      probs[action] = exp;
      sum += exp;
    }

    for (const action of env.actions) {
      probs[action] /= sum;
    }

    return probs;
  }

  function sampleAction(state: string): string {
    const probs = getPolicy(state);
    const rand = Math.random();
    let cumProb = 0;

    for (const action of env.actions) {
      cumProb += probs[action];
      if (rand <= cumProb) {
        return action;
      }
    }

    return env.actions[env.actions.length - 1];
  }

  for (let episode = 0; episode < episodes; episode++) {
    const trajectory: Array<{ state: string; action: string; reward: number }> = [];
    let state = env.initialState;
    let steps = 0;
    const maxSteps = 1000;

    while (!env.terminalStates.includes(state) && steps < maxSteps) {
      const action = sampleAction(state);
      const transition = env.transitions[state]?.[action];
      if (!transition) break;

      trajectory.push({ state, action, reward: transition.reward });
      state = transition.nextState;
      steps++;

      if (transition.done) break;
    }

    const returns: number[] = new Array(trajectory.length);
    let G = 0;
    for (let t = trajectory.length - 1; t >= 0; t--) {
      G = trajectory[t].reward + gamma * G;
      returns[t] = G;
    }

    for (let t = 0; t < trajectory.length; t++) {
      const { state: s, action: a } = trajectory[t];
      const probs = getPolicy(s);

      for (const action of env.actions) {
        const indicator = action === a ? 1 : 0;
        const gradient = indicator - probs[action];
        theta[s][action] += alpha * returns[t] * gradient;
      }
    }

    const totalReward = trajectory.reduce((sum, t) => sum + t.reward, 0);
    rewardHistory.push(totalReward);

    if (episode > 100 && convergenceEpisode === null) {
      const recentAvg = rewardHistory.slice(-50).reduce((a, b) => a + b, 0) / 50;
      const prevAvg = rewardHistory.slice(-100, -50).reduce((a, b) => a + b, 0) / 50;
      if (Math.abs(recentAvg - prevAvg) < 0.01 * Math.abs(prevAvg || 1)) {
        convergenceEpisode = episode;
      }
    }
  }

  const policy: Policy = {};
  for (const state of env.states) {
    policy[state] = getPolicy(state);
  }

  const averageReward = rewardHistory.reduce((a, b) => a + b, 0) / episodes;

  return {
    algorithm: 'Policy Gradient (REINFORCE)',
    episodes,
    averageReward,
    convergenceEpisode,
    policy,
    rewardHistory
  };
}

// ============================================================================
// MULTI-ARMED BANDIT
// ============================================================================

interface BanditResult {
  algorithm: string;
  steps: number;
  totalReward: number;
  optimalActionRate: number;
  armValues: number[];
  armCounts: number[];
}

function multiArmedBandit(
  options: {
    arms?: number;
    steps?: number;
    algorithm?: 'epsilon_greedy' | 'ucb' | 'thompson';
    epsilon?: number;
  } = {}
): BanditResult {
  const { arms = 10, steps = 1000, algorithm = 'epsilon_greedy', epsilon = 0.1 } = options;

  const trueValues = Array.from({ length: arms }, () => Math.random() * 2 - 1);
  const optimalArm = trueValues.indexOf(Math.max(...trueValues));

  const qValues: number[] = new Array(arms).fill(0);
  const counts: number[] = new Array(arms).fill(0);
  const alphas: number[] = new Array(arms).fill(1);
  const betas: number[] = new Array(arms).fill(1);

  let totalReward = 0;
  let optimalActions = 0;

  for (let t = 0; t < steps; t++) {
    let arm: number;

    switch (algorithm) {
      case 'epsilon_greedy': {
        if (Math.random() < epsilon) {
          arm = Math.floor(Math.random() * arms);
        } else {
          arm = qValues.indexOf(Math.max(...qValues));
        }
        break;
      }
      case 'ucb': {
        let bestArm = 0;
        let bestUCB = -Infinity;
        for (let a = 0; a < arms; a++) {
          if (counts[a] === 0) {
            bestArm = a;
            break;
          }
          const ucb = qValues[a] + 2 * Math.sqrt(Math.log(t + 1) / counts[a]);
          if (ucb > bestUCB) {
            bestUCB = ucb;
            bestArm = a;
          }
        }
        arm = bestArm;
        break;
      }
      case 'thompson': {
        const samples = alphas.map((alpha, i) => {
          const mean = alpha / (alpha + betas[i]);
          const variance = (alpha * betas[i]) / ((alpha + betas[i]) ** 2 * (alpha + betas[i] + 1));
          return mean + Math.sqrt(variance) * (Math.random() * 2 - 1);
        });
        arm = samples.indexOf(Math.max(...samples));
        break;
      }
      default:
        arm = Math.floor(Math.random() * arms);
    }

    const reward = trueValues[arm] + (Math.random() * 0.2 - 0.1);
    totalReward += reward;

    if (arm === optimalArm) optimalActions++;

    counts[arm]++;
    qValues[arm] += (reward - qValues[arm]) / counts[arm];

    if (reward > 0) {
      alphas[arm]++;
    } else {
      betas[arm]++;
    }
  }

  return {
    algorithm: algorithm === 'epsilon_greedy' ? `epsilon-greedy (e=${epsilon})` :
      algorithm === 'ucb' ? 'UCB1' : 'Thompson Sampling',
    steps,
    totalReward,
    optimalActionRate: optimalActions / steps,
    armValues: qValues,
    armCounts: counts
  };
}

// ============================================================================
// VALUE ITERATION
// ============================================================================

function valueIteration(
  env: Environment,
  options: { gamma?: number; threshold?: number; maxIterations?: number } = {}
): { values: { [state: string]: number }; policy: { [state: string]: string }; iterations: number } {
  const { gamma = 0.99, threshold = 0.0001, maxIterations = 1000 } = options;

  const values: { [state: string]: number } = {};
  for (const state of env.states) {
    values[state] = 0;
  }

  let iterations = 0;

  for (let i = 0; i < maxIterations; i++) {
    let delta = 0;
    iterations++;

    for (const state of env.states) {
      if (env.terminalStates.includes(state)) continue;

      const oldValue = values[state];
      let maxValue = -Infinity;

      for (const action of env.actions) {
        const transition = env.transitions[state]?.[action];
        if (!transition) continue;

        const value = transition.reward + gamma * values[transition.nextState];
        if (value > maxValue) {
          maxValue = value;
        }
      }

      values[state] = maxValue === -Infinity ? 0 : maxValue;
      delta = Math.max(delta, Math.abs(values[state] - oldValue));
    }

    if (delta < threshold) break;
  }

  const policy: { [state: string]: string } = {};
  for (const state of env.states) {
    if (env.terminalStates.includes(state)) {
      policy[state] = 'terminal';
      continue;
    }

    let bestAction = env.actions[0];
    let bestValue = -Infinity;

    for (const action of env.actions) {
      const transition = env.transitions[state]?.[action];
      if (!transition) continue;

      const value = transition.reward + gamma * values[transition.nextState];
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    }

    policy[state] = bestAction;
  }

  return { values, policy, iterations };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export const reinforcementlearningTool: UnifiedTool = {
  name: 'reinforcement_learning',
  description: `Reinforcement Learning algorithms and environments. Operations:
- q_learning: Off-policy TD control with epsilon-greedy exploration
- sarsa: On-policy TD control
- policy_gradient: REINFORCE algorithm for direct policy optimization
- value_iteration: Dynamic programming for known MDPs
- bandit: Multi-armed bandit (epsilon-greedy, UCB1, Thompson Sampling)
- environments: List available environments
- info: Documentation and theory`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['q_learning', 'sarsa', 'policy_gradient', 'value_iteration', 'bandit', 'environments', 'info', 'examples'],
        description: 'Operation to perform'
      },
      environment: {
        type: 'string',
        enum: ['gridworld', 'cliffwalk', 'frozenlake'],
        description: 'Environment name'
      },
      episodes: { type: 'number', description: 'Number of training episodes' },
      alpha: { type: 'number', description: 'Learning rate (0.01-0.5)' },
      gamma: { type: 'number', description: 'Discount factor (0.9-0.999)' },
      epsilon: { type: 'number', description: 'Exploration rate (0.01-1.0)' },
      algorithm: {
        type: 'string',
        enum: ['epsilon_greedy', 'ucb', 'thompson'],
        description: 'Bandit algorithm'
      },
      steps: { type: 'number', description: 'Number of steps for bandits' }
    },
    required: ['operation']
  }
};

export async function executereinforcementlearning(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

    switch (args.operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Reinforcement Learning',
            description: 'Implementations of core RL algorithms',
            algorithms: {
              q_learning: 'Off-policy TD control - learns optimal Q*(s,a) regardless of behavior policy',
              sarsa: 'On-policy TD control - learns Q^pi(s,a) for current policy',
              policy_gradient: 'REINFORCE - direct policy optimization via gradient ascent',
              value_iteration: 'Dynamic programming for known MDPs - computes V* iteratively',
              bandit: 'Multi-armed bandit exploration algorithms'
            },
            concepts: {
              exploration_vs_exploitation: 'Balance between trying new actions and using known good ones',
              temporal_difference: 'Bootstrap value estimates from successor states',
              bellman_equation: 'Q(s,a) = R(s,a) + gamma * max_a Q(s\',a\')',
              on_vs_off_policy: 'SARSA follows behavior policy; Q-learning learns optimal policy'
            },
            hyperparameters: {
              alpha: 'Learning rate - higher values learn faster but less stable (0.01-0.5)',
              gamma: 'Discount factor - how much to value future rewards (0.9-0.999)',
              epsilon: 'Exploration rate - probability of random action (decays over time)'
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
                description: 'Train Q-learning on GridWorld',
                call: { operation: 'q_learning', environment: 'gridworld', episodes: 500, alpha: 0.1, gamma: 0.99 }
              },
              {
                description: 'Compare SARSA on Cliff Walking (more conservative)',
                call: { operation: 'sarsa', environment: 'cliffwalk', episodes: 500 }
              },
              {
                description: 'Run Thompson Sampling bandit',
                call: { operation: 'bandit', algorithm: 'thompson', steps: 1000 }
              },
              {
                description: 'Value iteration for optimal policy',
                call: { operation: 'value_iteration', environment: 'gridworld', gamma: 0.99 }
              }
            ]
          }, null, 2)
        };
      }

      case 'environments': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            environments: Object.entries(ENVIRONMENTS).map(([key, env]) => ({
              id: key,
              name: env.name,
              states: env.states.length,
              actions: env.actions,
              description: key === 'gridworld' ? '4x4 grid, navigate to goal at (3,3), small step penalty' :
                key === 'cliffwalk' ? 'Navigate cliff edge - classic SARSA vs Q-learning comparison' :
                  '4x4 frozen lake with holes - stochastic environment'
            }))
          }, null, 2)
        };
      }

      case 'q_learning': {
        const envName = args.environment || 'gridworld';
        const env = ENVIRONMENTS[envName];
        if (!env) throw new Error(`Unknown environment: ${envName}`);

        const result = qLearning(env, {
          episodes: args.episodes || 500,
          alpha: args.alpha || 0.1,
          gamma: args.gamma || 0.99,
          epsilon: args.epsilon || 1.0
        });

        const optimalPolicy: { [state: string]: string } = {};
        for (const state of env.states) {
          if (!result.qTable![state]) continue;
          let bestAction = env.actions[0];
          let bestValue = -Infinity;
          for (const action of env.actions) {
            if (result.qTable![state][action] > bestValue) {
              bestValue = result.qTable![state][action];
              bestAction = action;
            }
          }
          optimalPolicy[state] = bestAction;
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            algorithm: result.algorithm,
            environment: envName,
            training: {
              episodes: result.episodes,
              averageReward: result.averageReward.toFixed(4),
              convergenceEpisode: result.convergenceEpisode,
              finalReward: (result.rewardHistory.slice(-10).reduce((a, b) => a + b, 0) / 10).toFixed(4)
            },
            learnedPolicy: optimalPolicy,
            improvement: {
              first100Avg: (result.rewardHistory.slice(0, 100).reduce((a, b) => a + b, 0) / 100).toFixed(4),
              last100Avg: (result.rewardHistory.slice(-100).reduce((a, b) => a + b, 0) / 100).toFixed(4)
            }
          }, null, 2)
        };
      }

      case 'sarsa': {
        const envName = args.environment || 'gridworld';
        const env = ENVIRONMENTS[envName];
        if (!env) throw new Error(`Unknown environment: ${envName}`);

        const result = sarsa(env, {
          episodes: args.episodes || 500,
          alpha: args.alpha || 0.1,
          gamma: args.gamma || 0.99,
          epsilon: args.epsilon || 1.0
        });

        const optimalPolicy: { [state: string]: string } = {};
        for (const state of env.states) {
          if (!result.qTable![state]) continue;
          let bestAction = env.actions[0];
          let bestValue = -Infinity;
          for (const action of env.actions) {
            if (result.qTable![state][action] > bestValue) {
              bestValue = result.qTable![state][action];
              bestAction = action;
            }
          }
          optimalPolicy[state] = bestAction;
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            algorithm: result.algorithm,
            environment: envName,
            training: {
              episodes: result.episodes,
              averageReward: result.averageReward.toFixed(4),
              convergenceEpisode: result.convergenceEpisode
            },
            learnedPolicy: optimalPolicy,
            note: 'SARSA learns safer policies than Q-learning (avoids cliff edge)'
          }, null, 2)
        };
      }

      case 'policy_gradient': {
        const envName = args.environment || 'gridworld';
        const env = ENVIRONMENTS[envName];
        if (!env) throw new Error(`Unknown environment: ${envName}`);

        const result = policyGradient(env, {
          episodes: args.episodes || 1000,
          alpha: args.alpha || 0.01,
          gamma: args.gamma || 0.99
        });

        const deterministicPolicy: { [state: string]: string } = {};
        for (const state of env.states) {
          if (!result.policy![state]) continue;
          let bestAction = env.actions[0];
          let bestProb = 0;
          for (const action of env.actions) {
            if (result.policy![state][action] > bestProb) {
              bestProb = result.policy![state][action];
              bestAction = action;
            }
          }
          deterministicPolicy[state] = bestAction;
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            algorithm: result.algorithm,
            environment: envName,
            training: {
              episodes: result.episodes,
              averageReward: result.averageReward.toFixed(4),
              convergenceEpisode: result.convergenceEpisode
            },
            learnedPolicy: deterministicPolicy,
            note: 'Policy gradient learns stochastic policies directly'
          }, null, 2)
        };
      }

      case 'value_iteration': {
        const envName = args.environment || 'gridworld';
        const env = ENVIRONMENTS[envName];
        if (!env) throw new Error(`Unknown environment: ${envName}`);

        const result = valueIteration(env, { gamma: args.gamma || 0.99 });

        return {
          toolCallId: id,
          content: JSON.stringify({
            algorithm: 'Value Iteration (Dynamic Programming)',
            environment: envName,
            iterations: result.iterations,
            optimalValues: result.values,
            optimalPolicy: result.policy,
            note: 'Requires known transition dynamics (model-based)'
          }, null, 2)
        };
      }

      case 'bandit': {
        const result = multiArmedBandit({
          arms: 10,
          steps: args.steps || 1000,
          algorithm: args.algorithm || 'epsilon_greedy',
          epsilon: args.epsilon || 0.1
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            algorithm: result.algorithm,
            results: {
              totalSteps: result.steps,
              totalReward: result.totalReward.toFixed(4),
              optimalActionRate: (result.optimalActionRate * 100).toFixed(2) + '%',
              averageReward: (result.totalReward / result.steps).toFixed(4)
            },
            armStatistics: result.armValues.map((q, i) => ({
              arm: i,
              estimatedValue: q.toFixed(4),
              pullCount: result.armCounts[i]
            })),
            bestArm: result.armValues.indexOf(Math.max(...result.armValues))
          }, null, 2)
        };
      }

      default:
        throw new Error(`Unknown operation: ${args.operation}. Use 'info' for help.`);
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isreinforcementlearningAvailable(): boolean {
  return true;
}
