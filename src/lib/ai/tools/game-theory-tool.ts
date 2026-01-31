/**
 * GAME THEORY SOLVER
 *
 * Strategic game analysis and equilibrium computation.
 * Essential for economics, AI, and decision theory.
 *
 * Features:
 * - Nash equilibrium (pure and mixed)
 * - Minimax algorithm with alpha-beta pruning
 * - Dominant strategy analysis
 * - Payoff matrix analysis
 * - Evolutionary game dynamics
 * - Prisoner's dilemma variants
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// GAME REPRESENTATIONS
// ============================================================================

interface PayoffMatrix {
  players: number;
  strategies: number[];
  payoffs: number[][][]; // payoffs[player][row][col]
}

// ============================================================================
// EQUILIBRIUM FINDING
// ============================================================================

// Find pure strategy Nash equilibria
function findPureNashEquilibria(matrix: PayoffMatrix): number[][] {
  const equilibria: number[][] = [];
  const [rows, cols] = matrix.strategies;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      // Check if (i, j) is a Nash equilibrium
      let isNash = true;

      // Check if player 1 can improve by deviating
      for (let i2 = 0; i2 < rows; i2++) {
        if (matrix.payoffs[0][i2][j] > matrix.payoffs[0][i][j]) {
          isNash = false;
          break;
        }
      }

      // Check if player 2 can improve by deviating
      if (isNash) {
        for (let j2 = 0; j2 < cols; j2++) {
          if (matrix.payoffs[1][i][j2] > matrix.payoffs[1][i][j]) {
            isNash = false;
            break;
          }
        }
      }

      if (isNash) {
        equilibria.push([i, j]);
      }
    }
  }

  return equilibria;
}

// Find mixed strategy Nash equilibrium for 2x2 games
function findMixedNashEquilibrium2x2(matrix: PayoffMatrix): {
  p1_strategy: number[];
  p2_strategy: number[];
  expected_payoffs: number[];
} | null {
  const [rows, cols] = matrix.strategies;
  if (rows !== 2 || cols !== 2) return null;

  const a = matrix.payoffs[0][0][0],
    b = matrix.payoffs[0][0][1];
  const c = matrix.payoffs[0][1][0],
    d = matrix.payoffs[0][1][1];

  const e = matrix.payoffs[1][0][0],
    f = matrix.payoffs[1][0][1];
  const g = matrix.payoffs[1][1][0],
    h = matrix.payoffs[1][1][1];

  // Player 2's mixed strategy makes player 1 indifferent
  // p*a + (1-p)*b = p*c + (1-p)*d
  const denom1 = a - b - c + d;
  const q = denom1 !== 0 ? (d - b) / denom1 : 0.5;

  // Player 1's mixed strategy makes player 2 indifferent
  // q*e + (1-q)*f = q*g + (1-q)*h
  const denom2 = e - f - g + h;
  const p = denom2 !== 0 ? (h - f) / denom2 : 0.5;

  // Clamp to valid probabilities
  const p_clamped = Math.max(0, Math.min(1, p));
  const q_clamped = Math.max(0, Math.min(1, q));

  // Expected payoffs
  const u1 =
    p_clamped * (q_clamped * a + (1 - q_clamped) * b) +
    (1 - p_clamped) * (q_clamped * c + (1 - q_clamped) * d);
  const u2 =
    q_clamped * (p_clamped * e + (1 - p_clamped) * g) +
    (1 - q_clamped) * (p_clamped * f + (1 - p_clamped) * h);

  return {
    p1_strategy: [p_clamped, 1 - p_clamped],
    p2_strategy: [q_clamped, 1 - q_clamped],
    expected_payoffs: [u1, u2],
  };
}

// Find dominant strategies
function findDominantStrategies(matrix: PayoffMatrix): {
  player1: number | null;
  player2: number | null;
  type: { player1: string; player2: string };
} {
  const [rows, cols] = matrix.strategies;

  // Check for dominant strategy for player 1
  let p1Dominant: number | null = null;
  let p1Type = 'none';
  for (let i = 0; i < rows; i++) {
    let isStrictlyDominant = true;
    let isWeaklyDominant = true;

    for (let i2 = 0; i2 < rows; i2++) {
      if (i === i2) continue;

      let strictBetter = true;
      let weakBetter = true;

      for (let j = 0; j < cols; j++) {
        if (matrix.payoffs[0][i][j] <= matrix.payoffs[0][i2][j]) {
          strictBetter = false;
        }
        if (matrix.payoffs[0][i][j] < matrix.payoffs[0][i2][j]) {
          weakBetter = false;
        }
      }

      if (!strictBetter) isStrictlyDominant = false;
      if (!weakBetter) isWeaklyDominant = false;
    }

    if (isStrictlyDominant) {
      p1Dominant = i;
      p1Type = 'strictly_dominant';
      break;
    } else if (isWeaklyDominant && p1Dominant === null) {
      p1Dominant = i;
      p1Type = 'weakly_dominant';
    }
  }

  // Check for dominant strategy for player 2
  let p2Dominant: number | null = null;
  let p2Type = 'none';
  for (let j = 0; j < cols; j++) {
    let isStrictlyDominant = true;
    let isWeaklyDominant = true;

    for (let j2 = 0; j2 < cols; j2++) {
      if (j === j2) continue;

      let strictBetter = true;
      let weakBetter = true;

      for (let i = 0; i < rows; i++) {
        if (matrix.payoffs[1][i][j] <= matrix.payoffs[1][i][j2]) {
          strictBetter = false;
        }
        if (matrix.payoffs[1][i][j] < matrix.payoffs[1][i][j2]) {
          weakBetter = false;
        }
      }

      if (!strictBetter) isStrictlyDominant = false;
      if (!weakBetter) isWeaklyDominant = false;
    }

    if (isStrictlyDominant) {
      p2Dominant = j;
      p2Type = 'strictly_dominant';
      break;
    } else if (isWeaklyDominant && p2Dominant === null) {
      p2Dominant = j;
      p2Type = 'weakly_dominant';
    }
  }

  return {
    player1: p1Dominant,
    player2: p2Dominant,
    type: { player1: p1Type, player2: p2Type },
  };
}

// Minimax algorithm with alpha-beta pruning
function minimax(
  node: number[],
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  evaluate: (state: number[]) => number,
  getChildren: (state: number[]) => number[][]
): { value: number; path: number[][] } {
  const children = getChildren(node);

  if (depth === 0 || children.length === 0) {
    return { value: evaluate(node), path: [node] };
  }

  if (maximizingPlayer) {
    let maxValue = -Infinity;
    let bestPath: number[][] = [];

    for (const child of children) {
      const result = minimax(child, depth - 1, alpha, beta, false, evaluate, getChildren);
      if (result.value > maxValue) {
        maxValue = result.value;
        bestPath = [node, ...result.path];
      }
      alpha = Math.max(alpha, result.value);
      if (beta <= alpha) break; // Alpha-beta pruning
    }

    return { value: maxValue, path: bestPath };
  } else {
    let minValue = Infinity;
    let bestPath: number[][] = [];

    for (const child of children) {
      const result = minimax(child, depth - 1, alpha, beta, true, evaluate, getChildren);
      if (result.value < minValue) {
        minValue = result.value;
        bestPath = [node, ...result.path];
      }
      beta = Math.min(beta, result.value);
      if (beta <= alpha) break;
    }

    return { value: minValue, path: bestPath };
  }
}

// Evolutionary game dynamics (replicator dynamics)
function replicatorDynamics(
  payoffMatrix: number[][],
  initialFrequencies: number[],
  generations: number,
  dt: number = 0.01
): { generation: number; frequencies: number[] }[] {
  const n = initialFrequencies.length;
  let frequencies = [...initialFrequencies];
  const history: { generation: number; frequencies: number[] }[] = [
    { generation: 0, frequencies: [...frequencies] },
  ];

  for (let gen = 1; gen <= generations; gen++) {
    // Calculate fitness for each strategy
    const fitness: number[] = [];
    for (let i = 0; i < n; i++) {
      let fi = 0;
      for (let j = 0; j < n; j++) {
        fi += payoffMatrix[i][j] * frequencies[j];
      }
      fitness.push(fi);
    }

    // Average fitness
    const avgFitness = fitness.reduce((sum, f, i) => sum + f * frequencies[i], 0);

    // Update frequencies using replicator equation
    const newFrequencies: number[] = [];
    for (let i = 0; i < n; i++) {
      const df = frequencies[i] * (fitness[i] - avgFitness) * dt;
      newFrequencies.push(Math.max(0, frequencies[i] + df));
    }

    // Normalize
    const sum = newFrequencies.reduce((a, b) => a + b, 0);
    frequencies = newFrequencies.map((f) => f / sum);

    if (gen % 10 === 0) {
      history.push({ generation: gen, frequencies: [...frequencies] });
    }
  }

  return history;
}

// ============================================================================
// CLASSIC GAMES
// ============================================================================

const CLASSIC_GAMES: Record<string, PayoffMatrix> = {
  prisoners_dilemma: {
    players: 2,
    strategies: [2, 2],
    payoffs: [
      [
        [-1, -3],
        [0, -2],
      ], // Player 1: (Cooperate, Defect) x (Cooperate, Defect)
      [
        [-1, 0],
        [-3, -2],
      ], // Player 2
    ],
  },
  chicken: {
    players: 2,
    strategies: [2, 2],
    payoffs: [
      [
        [0, -1],
        [1, -10],
      ], // Player 1
      [
        [0, 1],
        [-1, -10],
      ], // Player 2
    ],
  },
  battle_of_sexes: {
    players: 2,
    strategies: [2, 2],
    payoffs: [
      [
        [3, 0],
        [0, 2],
      ], // Player 1 prefers Opera
      [
        [2, 0],
        [0, 3],
      ], // Player 2 prefers Football
    ],
  },
  matching_pennies: {
    players: 2,
    strategies: [2, 2],
    payoffs: [
      [
        [1, -1],
        [-1, 1],
      ], // Player 1
      [
        [-1, 1],
        [1, -1],
      ], // Player 2 (zero-sum)
    ],
  },
  stag_hunt: {
    players: 2,
    strategies: [2, 2],
    payoffs: [
      [
        [4, 0],
        [3, 3],
      ], // Player 1
      [
        [4, 3],
        [0, 3],
      ], // Player 2
    ],
  },
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const gameTheoryTool: UnifiedTool = {
  name: 'game_solver',
  description: `Game theory solver for strategic analysis and equilibrium computation.

Available operations:
- nash_equilibrium: Find pure and mixed Nash equilibria
- dominant_strategy: Find dominant strategies
- minimax: Minimax algorithm for zero-sum games
- replicator: Evolutionary dynamics simulation
- analyze_game: Full analysis of a game
- classic_game: Analyze classic games (prisoners_dilemma, chicken, battle_of_sexes, matching_pennies, stag_hunt)

Payoff matrix format: {payoffs: [[[p1_payoffs]], [[p2_payoffs]]]}
Example: Prisoner's Dilemma payoffs[0][i][j] = Player 1's payoff when P1 plays i, P2 plays j`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'nash_equilibrium',
          'dominant_strategy',
          'minimax',
          'replicator',
          'analyze_game',
          'classic_game',
        ],
        description: 'Game theory operation',
      },
      payoffs: {
        type: 'array',
        description: 'Payoff matrices: [[[p1 payoffs]], [[p2 payoffs]]]',
      },
      classic_game_name: {
        type: 'string',
        enum: ['prisoners_dilemma', 'chicken', 'battle_of_sexes', 'matching_pennies', 'stag_hunt'],
        description: 'Name of classic game to analyze',
      },
      initial_frequencies: {
        type: 'array',
        items: { type: 'number' },
        description: 'Initial strategy frequencies for replicator dynamics',
      },
      generations: {
        type: 'number',
        description: 'Number of generations for evolution',
      },
      depth: {
        type: 'number',
        description: 'Search depth for minimax',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isGameTheoryAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeGameTheory(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    payoffs?: number[][][];
    classic_game_name?: string;
    initial_frequencies?: number[];
    generations?: number;
    depth?: number;
  };

  const {
    operation,
    payoffs,
    classic_game_name = 'prisoners_dilemma',
    initial_frequencies,
    generations = 100,
    depth = 4,
  } = args;

  try {
    const result: Record<string, unknown> = { operation };

    // Get payoff matrix from input or classic game
    let matrix: PayoffMatrix;
    if (payoffs && payoffs.length >= 2) {
      matrix = {
        players: 2,
        strategies: [payoffs[0].length, payoffs[0][0].length],
        payoffs,
      };
    } else if (classic_game_name && CLASSIC_GAMES[classic_game_name]) {
      matrix = CLASSIC_GAMES[classic_game_name];
    } else {
      matrix = CLASSIC_GAMES.prisoners_dilemma;
    }

    switch (operation) {
      case 'nash_equilibrium': {
        const pureNash = findPureNashEquilibria(matrix);
        const mixedNash = findMixedNashEquilibrium2x2(matrix);

        result.pure_nash_equilibria = pureNash.map((eq) => ({
          strategies: eq,
          payoffs: [matrix.payoffs[0][eq[0]][eq[1]], matrix.payoffs[1][eq[0]][eq[1]]],
        }));

        if (mixedNash) {
          result.mixed_nash_equilibrium = {
            player1_strategy: mixedNash.p1_strategy,
            player2_strategy: mixedNash.p2_strategy,
            expected_payoffs: mixedNash.expected_payoffs,
          };
        }

        result.payoff_matrix = {
          player1: matrix.payoffs[0],
          player2: matrix.payoffs[1],
        };
        break;
      }

      case 'dominant_strategy': {
        const dominant = findDominantStrategies(matrix);

        result.player1 =
          dominant.player1 !== null
            ? {
                strategy: dominant.player1,
                type: dominant.type.player1,
              }
            : null;

        result.player2 =
          dominant.player2 !== null
            ? {
                strategy: dominant.player2,
                type: dominant.type.player2,
              }
            : null;

        result.has_dominant_strategy_equilibrium =
          dominant.player1 !== null && dominant.player2 !== null;
        break;
      }

      case 'minimax': {
        // Simple example: Tic-tac-toe style evaluation
        const evaluate = (state: number[]) => state.reduce((a, b) => a + b, 0);
        const getChildren = (state: number[]) => {
          if (state.length >= 5) return [];
          return [
            [...state, 1],
            [...state, -1],
          ];
        };

        const minimaxResult = minimax([0], depth, -Infinity, Infinity, true, evaluate, getChildren);

        result.optimal_value = minimaxResult.value;
        result.optimal_path = minimaxResult.path;
        result.search_depth = depth;
        result.note = 'Minimax finds optimal play assuming both players play optimally';
        break;
      }

      case 'replicator': {
        const initFreq = initial_frequencies || [0.5, 0.5];
        const symmetricPayoff = matrix.payoffs[0]; // Use player 1's payoff matrix

        const evolution = replicatorDynamics(symmetricPayoff, initFreq, generations);

        result.initial_frequencies = initFreq;
        result.generations = generations;
        result.evolution_history = evolution;
        result.final_frequencies = evolution[evolution.length - 1].frequencies;
        result.interpretation =
          'Frequencies represent population proportions playing each strategy';
        break;
      }

      case 'analyze_game': {
        const pureNash = findPureNashEquilibria(matrix);
        const mixedNash = findMixedNashEquilibrium2x2(matrix);
        const dominant = findDominantStrategies(matrix);

        result.game_type = payoffs ? 'custom' : classic_game_name;
        result.payoff_matrix = {
          player1: matrix.payoffs[0],
          player2: matrix.payoffs[1],
        };

        result.analysis = {
          pure_nash_equilibria: pureNash,
          mixed_nash_equilibrium: mixedNash,
          dominant_strategies: dominant,
          pareto_optimal: findParetoOptimal(matrix),
          is_zero_sum: isZeroSum(matrix),
        };

        result.game_classification = classifyGame(matrix);
        break;
      }

      case 'classic_game': {
        const game = CLASSIC_GAMES[classic_game_name] || CLASSIC_GAMES.prisoners_dilemma;
        const pureNash = findPureNashEquilibria(game);
        const mixedNash = findMixedNashEquilibrium2x2(game);

        result.game_name = classic_game_name;
        result.description = getGameDescription(classic_game_name);
        result.payoff_matrix = {
          player1: game.payoffs[0],
          player2: game.payoffs[1],
        };
        result.strategy_labels = getStrategyLabels(classic_game_name);
        result.pure_nash = pureNash;
        result.mixed_nash = mixedNash;
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}

// Helper functions
function findParetoOptimal(matrix: PayoffMatrix): number[][] {
  const pareto: number[][] = [];
  const [rows, cols] = matrix.strategies;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let isPareto = true;
      const p1 = matrix.payoffs[0][i][j];
      const p2 = matrix.payoffs[1][i][j];

      for (let i2 = 0; i2 < rows && isPareto; i2++) {
        for (let j2 = 0; j2 < cols && isPareto; j2++) {
          const p1_other = matrix.payoffs[0][i2][j2];
          const p2_other = matrix.payoffs[1][i2][j2];

          if ((p1_other > p1 && p2_other >= p2) || (p1_other >= p1 && p2_other > p2)) {
            isPareto = false;
          }
        }
      }

      if (isPareto) pareto.push([i, j]);
    }
  }

  return pareto;
}

function isZeroSum(matrix: PayoffMatrix): boolean {
  const [rows, cols] = matrix.strategies;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (Math.abs(matrix.payoffs[0][i][j] + matrix.payoffs[1][i][j]) > 1e-10) {
        return false;
      }
    }
  }
  return true;
}

function classifyGame(matrix: PayoffMatrix): string {
  if (isZeroSum(matrix)) return 'zero_sum';
  // More classification logic could be added
  return 'general_sum';
}

function getGameDescription(name: string): string {
  const descriptions: Record<string, string> = {
    prisoners_dilemma:
      'Two prisoners must decide to cooperate or defect. Mutual cooperation is better than mutual defection, but defecting is individually rational.',
    chicken:
      'Two drivers head toward each other. Swerving is embarrassing but crashing is catastrophic.',
    battle_of_sexes: 'Two players want to coordinate but have different preferences over outcomes.',
    matching_pennies: 'Zero-sum game where one player wants to match, the other wants to mismatch.',
    stag_hunt:
      'Cooperation game where hunting stag together yields more than hunting rabbit alone.',
  };
  return descriptions[name] || 'Unknown game';
}

function getStrategyLabels(name: string): { player1: string[]; player2: string[] } {
  const labels: Record<string, { player1: string[]; player2: string[] }> = {
    prisoners_dilemma: { player1: ['Cooperate', 'Defect'], player2: ['Cooperate', 'Defect'] },
    chicken: { player1: ['Swerve', 'Straight'], player2: ['Swerve', 'Straight'] },
    battle_of_sexes: { player1: ['Opera', 'Football'], player2: ['Opera', 'Football'] },
    matching_pennies: { player1: ['Heads', 'Tails'], player2: ['Heads', 'Tails'] },
    stag_hunt: { player1: ['Stag', 'Rabbit'], player2: ['Stag', 'Rabbit'] },
  };
  return (
    labels[name] || { player1: ['Strategy 1', 'Strategy 2'], player2: ['Strategy 1', 'Strategy 2'] }
  );
}
