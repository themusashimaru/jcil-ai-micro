/**
 * NASH-EQUILIBRIUM TOOL
 * Game theory Nash equilibrium computation
 * Pure and mixed strategy equilibria for normal-form games
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const nashequilibriumTool: UnifiedTool = {
  name: 'nash_equilibrium',
  description: `Nash equilibrium computation for game theory.

Operations:
- info: Game theory and Nash equilibrium overview
- find: Find Nash equilibria in a game
- pure: Find pure strategy Nash equilibria
- mixed: Compute mixed strategy equilibrium
- verify: Check if strategy profile is Nash equilibrium
- classic_games: Analyze classic games (prisoner's dilemma, etc.)
- dominance: Check for dominated strategies
- best_response: Calculate best response functions
- pareto: Find Pareto optimal outcomes

Parameters:
- operation: The operation to perform
- game: Predefined game name
- payoff_matrix_1: Player 1's payoff matrix
- payoff_matrix_2: Player 2's payoff matrix
- strategy_1: Player 1's strategy
- strategy_2: Player 2's strategy`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'find', 'pure', 'mixed', 'verify', 'classic_games', 'dominance', 'best_response', 'pareto'],
        description: 'Operation to perform'
      },
      game: {
        type: 'string',
        enum: ['prisoners_dilemma', 'battle_of_sexes', 'chicken', 'matching_pennies', 'stag_hunt', 'coordination'],
        description: 'Classic game name'
      },
      payoff_matrix_1: { type: 'array', description: 'Player 1 payoffs (2D array)' },
      payoff_matrix_2: { type: 'array', description: 'Player 2 payoffs (2D array)' },
      strategy_1: { type: 'array', description: 'Player 1 strategy (mixed or pure)' },
      strategy_2: { type: 'array', description: 'Player 2 strategy (mixed or pure)' }
    },
    required: ['operation']
  }
};

// ============================================================================
// CLASSIC GAMES
// ============================================================================

interface Game {
  name: string;
  players: string[];
  strategies: { player1: string[]; player2: string[] };
  payoffs1: number[][];
  payoffs2: number[][];
}

const CLASSIC_GAMES: Record<string, Game> = {
  prisoners_dilemma: {
    name: "Prisoner's Dilemma",
    players: ['Player 1', 'Player 2'],
    strategies: { player1: ['Cooperate', 'Defect'], player2: ['Cooperate', 'Defect'] },
    payoffs1: [[-1, -3], [0, -2]],
    payoffs2: [[-1, 0], [-3, -2]]
  },
  battle_of_sexes: {
    name: 'Battle of the Sexes',
    players: ['Player 1', 'Player 2'],
    strategies: { player1: ['Opera', 'Football'], player2: ['Opera', 'Football'] },
    payoffs1: [[3, 0], [0, 2]],
    payoffs2: [[2, 0], [0, 3]]
  },
  chicken: {
    name: 'Chicken (Hawk-Dove)',
    players: ['Player 1', 'Player 2'],
    strategies: { player1: ['Swerve', 'Straight'], player2: ['Swerve', 'Straight'] },
    payoffs1: [[0, -1], [1, -10]],
    payoffs2: [[0, 1], [-1, -10]]
  },
  matching_pennies: {
    name: 'Matching Pennies',
    players: ['Player 1', 'Player 2'],
    strategies: { player1: ['Heads', 'Tails'], player2: ['Heads', 'Tails'] },
    payoffs1: [[1, -1], [-1, 1]],
    payoffs2: [[-1, 1], [1, -1]]
  },
  stag_hunt: {
    name: 'Stag Hunt',
    players: ['Player 1', 'Player 2'],
    strategies: { player1: ['Stag', 'Hare'], player2: ['Stag', 'Hare'] },
    payoffs1: [[4, 0], [3, 3]],
    payoffs2: [[4, 3], [0, 3]]
  },
  coordination: {
    name: 'Coordination Game',
    players: ['Player 1', 'Player 2'],
    strategies: { player1: ['A', 'B'], player2: ['A', 'B'] },
    payoffs1: [[2, 0], [0, 1]],
    payoffs2: [[2, 0], [0, 1]]
  }
};

// ============================================================================
// NASH EQUILIBRIUM COMPUTATION
// ============================================================================

/**
 * Find pure strategy Nash equilibria
 */
function findPureNashEquilibria(payoffs1: number[][], payoffs2: number[][]): Array<[number, number]> {
  const equilibria: Array<[number, number]> = [];
  const rows = payoffs1.length;
  const cols = payoffs1[0].length;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      // Check if (i, j) is a Nash equilibrium

      // Player 1: Is row i best response to column j?
      let isBestForP1 = true;
      for (let k = 0; k < rows; k++) {
        if (payoffs1[k][j] > payoffs1[i][j]) {
          isBestForP1 = false;
          break;
        }
      }

      // Player 2: Is column j best response to row i?
      let isBestForP2 = true;
      for (let k = 0; k < cols; k++) {
        if (payoffs2[i][k] > payoffs2[i][j]) {
          isBestForP2 = false;
          break;
        }
      }

      if (isBestForP1 && isBestForP2) {
        equilibria.push([i, j]);
      }
    }
  }

  return equilibria;
}

/**
 * Find mixed strategy Nash equilibrium for 2x2 game
 * Uses indifference condition
 */
function findMixedNash2x2(payoffs1: number[][], payoffs2: number[][]): {
  p1Mix: number[];
  p2Mix: number[];
  p1ExpectedPayoff: number;
  p2ExpectedPayoff: number;
} | null {
  // For 2x2 games only
  if (payoffs1.length !== 2 || payoffs1[0].length !== 2) {
    return null;
  }

  // Player 1 mixes such that Player 2 is indifferent
  // P2 payoff from col 0: q*payoffs2[0][0] + (1-q)*payoffs2[1][0]
  // P2 payoff from col 1: q*payoffs2[0][1] + (1-q)*payoffs2[1][1]
  // Set equal and solve for q

  const a = payoffs2[0][0] - payoffs2[1][0];
  const b = payoffs2[0][1] - payoffs2[1][1];

  let q: number;
  if (Math.abs(a - b) < 1e-10) {
    // No interior mixed equilibrium
    return null;
  }
  q = (payoffs2[1][1] - payoffs2[1][0]) / (payoffs2[0][0] - payoffs2[0][1] - payoffs2[1][0] + payoffs2[1][1]);

  // Player 2 mixes such that Player 1 is indifferent
  const c = payoffs1[0][0] - payoffs1[0][1];
  const d = payoffs1[1][0] - payoffs1[1][1];

  let p: number;
  if (Math.abs(c - d) < 1e-10) {
    return null;
  }
  p = (payoffs1[1][1] - payoffs1[0][1]) / (payoffs1[0][0] - payoffs1[1][0] - payoffs1[0][1] + payoffs1[1][1]);

  // Check if probabilities are valid
  if (q < 0 || q > 1 || p < 0 || p > 1) {
    return null;
  }

  // Calculate expected payoffs
  const p1Expected = q * (p * payoffs1[0][0] + (1 - p) * payoffs1[0][1]) +
                     (1 - q) * (p * payoffs1[1][0] + (1 - p) * payoffs1[1][1]);
  const p2Expected = q * (p * payoffs2[0][0] + (1 - p) * payoffs2[0][1]) +
                     (1 - q) * (p * payoffs2[1][0] + (1 - p) * payoffs2[1][1]);

  return {
    p1Mix: [q, 1 - q],
    p2Mix: [p, 1 - p],
    p1ExpectedPayoff: p1Expected,
    p2ExpectedPayoff: p2Expected
  };
}

/**
 * Check for strictly dominated strategies
 */
function findDominatedStrategies(payoffs: number[][]): {
  dominated: number[];
  dominatingPairs: Array<{ dominated: number; dominates: number }>;
} {
  const rows = payoffs.length;
  const dominated: number[] = [];
  const dominatingPairs: Array<{ dominated: number; dominates: number }> = [];

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < rows; j++) {
      if (i !== j) {
        // Check if strategy j strictly dominates strategy i
        let dominates = true;
        for (let k = 0; k < payoffs[0].length; k++) {
          if (payoffs[j][k] <= payoffs[i][k]) {
            dominates = false;
            break;
          }
        }
        if (dominates && !dominated.includes(i)) {
          dominated.push(i);
          dominatingPairs.push({ dominated: i, dominates: j });
        }
      }
    }
  }

  return { dominated, dominatingPairs };
}

/**
 * Find best response for a player given opponent's strategy
 */
function bestResponse(payoffs: number[][], opponentStrategy: number[]): number[] {
  const numStrategies = payoffs.length;
  const expectedPayoffs: number[] = [];

  for (let i = 0; i < numStrategies; i++) {
    let expected = 0;
    for (let j = 0; j < opponentStrategy.length; j++) {
      expected += payoffs[i][j] * opponentStrategy[j];
    }
    expectedPayoffs.push(expected);
  }

  const maxPayoff = Math.max(...expectedPayoffs);
  const bestResponses: number[] = [];

  for (let i = 0; i < numStrategies; i++) {
    if (Math.abs(expectedPayoffs[i] - maxPayoff) < 1e-10) {
      bestResponses.push(i);
    }
  }

  return bestResponses;
}

/**
 * Find Pareto optimal outcomes
 */
function findParetoOptimal(payoffs1: number[][], payoffs2: number[][]): Array<[number, number]> {
  const paretoOptimal: Array<[number, number]> = [];
  const rows = payoffs1.length;
  const cols = payoffs1[0].length;

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let isPareto = true;

      // Check if any other outcome Pareto dominates (i, j)
      for (let k = 0; k < rows && isPareto; k++) {
        for (let l = 0; l < cols && isPareto; l++) {
          if (k !== i || l !== j) {
            // (k, l) dominates (i, j) if both players at least as well off and one strictly better
            const p1Better = payoffs1[k][l] >= payoffs1[i][j];
            const p2Better = payoffs2[k][l] >= payoffs2[i][j];
            const p1Strict = payoffs1[k][l] > payoffs1[i][j];
            const p2Strict = payoffs2[k][l] > payoffs2[i][j];

            if (p1Better && p2Better && (p1Strict || p2Strict)) {
              isPareto = false;
            }
          }
        }
      }

      if (isPareto) {
        paretoOptimal.push([i, j]);
      }
    }
  }

  return paretoOptimal;
}

/**
 * Verify if a strategy profile is Nash equilibrium
 */
function verifyNash(
  payoffs1: number[][],
  payoffs2: number[][],
  strategy1: number[],
  strategy2: number[]
): { isNash: boolean; deviationPayoff1?: number; deviationPayoff2?: number } {
  // Calculate current expected payoffs
  let currentPayoff1 = 0;
  let currentPayoff2 = 0;

  for (let i = 0; i < strategy1.length; i++) {
    for (let j = 0; j < strategy2.length; j++) {
      currentPayoff1 += strategy1[i] * strategy2[j] * payoffs1[i][j];
      currentPayoff2 += strategy1[i] * strategy2[j] * payoffs2[i][j];
    }
  }

  // Check if Player 1 can improve
  let maxP1Deviation = currentPayoff1;
  for (let i = 0; i < strategy1.length; i++) {
    let deviationPayoff = 0;
    for (let j = 0; j < strategy2.length; j++) {
      deviationPayoff += strategy2[j] * payoffs1[i][j];
    }
    maxP1Deviation = Math.max(maxP1Deviation, deviationPayoff);
  }

  // Check if Player 2 can improve
  let maxP2Deviation = currentPayoff2;
  for (let j = 0; j < strategy2.length; j++) {
    let deviationPayoff = 0;
    for (let i = 0; i < strategy1.length; i++) {
      deviationPayoff += strategy1[i] * payoffs2[i][j];
    }
    maxP2Deviation = Math.max(maxP2Deviation, deviationPayoff);
  }

  const isNash = Math.abs(maxP1Deviation - currentPayoff1) < 1e-10 &&
                 Math.abs(maxP2Deviation - currentPayoff2) < 1e-10;

  return {
    isNash,
    deviationPayoff1: maxP1Deviation,
    deviationPayoff2: maxP2Deviation
  };
}

export async function executenashequilibrium(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    switch (operation) {
      case 'info': {
        const result = {
          tool: 'Nash Equilibrium',
          description: 'Game theory equilibrium computation',

          nashEquilibrium: {
            definition: 'Strategy profile where no player can improve by unilaterally changing strategy',
            formalDef: 'σ* is NE if ∀i, u_i(σ*_i, σ*_{-i}) ≥ u_i(s_i, σ*_{-i}) for all s_i',
            existence: 'Nash (1950): Every finite game has at least one Nash equilibrium (possibly mixed)'
          },

          types: {
            pureStrategy: 'Each player chooses single action with certainty',
            mixedStrategy: 'Players randomize over actions with specified probabilities'
          },

          concepts: {
            bestResponse: 'Strategy that maximizes payoff given opponents\' strategies',
            dominance: 'Strategy A dominates B if A gives higher payoff regardless of opponents',
            paretoOptimal: 'No outcome makes all players better off'
          },

          algorithms: {
            '2x2Games': 'Indifference condition for mixed equilibria',
            supportEnumeration: 'Enumerate possible supports and solve',
            lemkeHowson: 'Pivoting algorithm for bimatrix games'
          },

          usage: 'Use operation: find, pure, mixed, verify, classic_games, dominance, best_response, pareto'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'find':
      case 'pure': {
        let game: Game;
        let payoffs1: number[][];
        let payoffs2: number[][];

        if (args.game && CLASSIC_GAMES[args.game]) {
          game = CLASSIC_GAMES[args.game];
          payoffs1 = game.payoffs1;
          payoffs2 = game.payoffs2;
        } else if (args.payoff_matrix_1 && args.payoff_matrix_2) {
          payoffs1 = args.payoff_matrix_1;
          payoffs2 = args.payoff_matrix_2;
          game = {
            name: 'Custom Game',
            players: ['Player 1', 'Player 2'],
            strategies: {
              player1: payoffs1.map((_, i) => `S${i + 1}`),
              player2: payoffs1[0].map((_, i) => `S${i + 1}`)
            },
            payoffs1,
            payoffs2
          };
        } else {
          game = CLASSIC_GAMES.prisoners_dilemma;
          payoffs1 = game.payoffs1;
          payoffs2 = game.payoffs2;
        }

        const pureNE = findPureNashEquilibria(payoffs1, payoffs2);

        const result = {
          operation: 'find_pure_nash',
          game: game.name,

          payoffMatrix: {
            player1: payoffs1,
            player2: payoffs2,
            strategies: game.strategies
          },

          pureNashEquilibria: pureNE.map(eq => ({
            player1Strategy: game.strategies.player1[eq[0]],
            player2Strategy: game.strategies.player2[eq[1]],
            payoffs: [payoffs1[eq[0]][eq[1]], payoffs2[eq[0]][eq[1]]]
          })),

          count: pureNE.length,

          interpretation: pureNE.length === 0
            ? 'No pure strategy Nash equilibrium exists. Check for mixed equilibrium.'
            : pureNE.length === 1
              ? 'Unique pure strategy Nash equilibrium found.'
              : 'Multiple pure strategy Nash equilibria exist.'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'mixed': {
        let game: Game;

        if (args.game && CLASSIC_GAMES[args.game]) {
          game = CLASSIC_GAMES[args.game];
        } else if (args.payoff_matrix_1 && args.payoff_matrix_2) {
          game = {
            name: 'Custom Game',
            players: ['Player 1', 'Player 2'],
            strategies: { player1: ['S1', 'S2'], player2: ['S1', 'S2'] },
            payoffs1: args.payoff_matrix_1,
            payoffs2: args.payoff_matrix_2
          };
        } else {
          game = CLASSIC_GAMES.matching_pennies;
        }

        const mixedNE = findMixedNash2x2(game.payoffs1, game.payoffs2);
        const pureNE = findPureNashEquilibria(game.payoffs1, game.payoffs2);

        const result = {
          operation: 'mixed_nash',
          game: game.name,

          pureEquilibria: pureNE.map(eq => ({
            strategies: [game.strategies.player1[eq[0]], game.strategies.player2[eq[1]]],
            payoffs: [game.payoffs1[eq[0]][eq[1]], game.payoffs2[eq[0]][eq[1]]]
          })),

          mixedEquilibrium: mixedNE ? {
            player1: {
              strategy: game.strategies.player1.map((s, i) => `${s}: ${(mixedNE.p1Mix[i] * 100).toFixed(1)}%`)
            },
            player2: {
              strategy: game.strategies.player2.map((s, i) => `${s}: ${(mixedNE.p2Mix[i] * 100).toFixed(1)}%`)
            },
            expectedPayoffs: {
              player1: mixedNE.p1ExpectedPayoff.toFixed(4),
              player2: mixedNE.p2ExpectedPayoff.toFixed(4)
            }
          } : 'No interior mixed equilibrium (check pure equilibria)',

          method: 'Indifference condition: Each player mixes to make opponent indifferent'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'verify': {
        const game = args.game ? CLASSIC_GAMES[args.game] : CLASSIC_GAMES.prisoners_dilemma;
        const payoffs1 = args.payoff_matrix_1 || game.payoffs1;
        const payoffs2 = args.payoff_matrix_2 || game.payoffs2;
        const strategy1 = args.strategy_1 || [1, 0]; // Default: pure strategy 1
        const strategy2 = args.strategy_2 || [1, 0];

        const verification = verifyNash(payoffs1, payoffs2, strategy1, strategy2);

        const result = {
          operation: 'verify',

          strategyProfile: {
            player1: strategy1,
            player2: strategy2
          },

          verification: {
            isNashEquilibrium: verification.isNash,
            player1CanImprove: !verification.isNash && verification.deviationPayoff1,
            player2CanImprove: !verification.isNash && verification.deviationPayoff2
          },

          explanation: verification.isNash
            ? 'Neither player can improve by unilaterally changing strategy'
            : 'At least one player can achieve higher payoff by deviating'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'classic_games': {
        const analyses = Object.entries(CLASSIC_GAMES).map(([key, game]) => {
          const pureNE = findPureNashEquilibria(game.payoffs1, game.payoffs2);
          const mixedNE = findMixedNash2x2(game.payoffs1, game.payoffs2);
          const pareto = findParetoOptimal(game.payoffs1, game.payoffs2);

          return {
            name: game.name,
            strategies: game.strategies,
            pureNashCount: pureNE.length,
            pureNash: pureNE.map(eq => [game.strategies.player1[eq[0]], game.strategies.player2[eq[1]]]),
            hasMixedEquilibrium: mixedNE !== null,
            paretoOptimalOutcomes: pareto.length
          };
        });

        const result = {
          operation: 'classic_games',
          games: analyses,

          gameDescriptions: {
            prisoners_dilemma: 'Both players better off cooperating, but defection dominates',
            battle_of_sexes: 'Coordination game with conflicting preferences',
            chicken: 'Anti-coordination with disastrous mutual aggression',
            matching_pennies: 'Zero-sum with only mixed equilibrium',
            stag_hunt: 'Coordination with risk-dominated efficient equilibrium',
            coordination: 'Pure coordination, multiple equilibria'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'dominance': {
        const game = args.game ? CLASSIC_GAMES[args.game] : CLASSIC_GAMES.prisoners_dilemma;
        const payoffs1 = args.payoff_matrix_1 || game.payoffs1;
        const payoffs2 = args.payoff_matrix_2 || game.payoffs2;

        const dominated1 = findDominatedStrategies(payoffs1);
        const dominated2 = findDominatedStrategies(
          payoffs2[0].map((_, j) => payoffs2.map(row => row[j])) // Transpose for player 2
        );

        const result = {
          operation: 'dominance',
          game: args.game || 'custom',

          player1: {
            dominatedStrategies: dominated1.dominated.map(i => game.strategies.player1[i]),
            pairs: dominated1.dominatingPairs.map(p => ({
              dominated: game.strategies.player1[p.dominated],
              by: game.strategies.player1[p.dominates]
            }))
          },

          player2: {
            dominatedStrategies: dominated2.dominated.map(i => game.strategies.player2[i]),
            pairs: dominated2.dominatingPairs.map(p => ({
              dominated: game.strategies.player2[p.dominated],
              by: game.strategies.player2[p.dominates]
            }))
          },

          iteratedDominance: 'Remove dominated strategies and repeat until no more dominated'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'best_response': {
        const game = args.game ? CLASSIC_GAMES[args.game] : CLASSIC_GAMES.prisoners_dilemma;
        const opponentStrategy = args.strategy_2 || [0.5, 0.5];

        const br1 = bestResponse(game.payoffs1, opponentStrategy);

        const result = {
          operation: 'best_response',
          game: game.name,

          opponentStrategy: game.strategies.player2.map((s, i) =>
            `${s}: ${(opponentStrategy[i] * 100).toFixed(0)}%`
          ),

          bestResponses: br1.map(i => game.strategies.player1[i]),

          explanation: br1.length > 1
            ? 'Multiple best responses (player is indifferent)'
            : 'Unique best response to opponent\'s strategy'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'pareto': {
        const game = args.game ? CLASSIC_GAMES[args.game] : CLASSIC_GAMES.prisoners_dilemma;
        const payoffs1 = args.payoff_matrix_1 || game.payoffs1;
        const payoffs2 = args.payoff_matrix_2 || game.payoffs2;

        const paretoOptimal = findParetoOptimal(payoffs1, payoffs2);
        const nashEquilibria = findPureNashEquilibria(payoffs1, payoffs2);

        // Check if Nash equilibria are Pareto optimal
        const nashPareto = nashEquilibria.map(ne => ({
          equilibrium: [game.strategies.player1[ne[0]], game.strategies.player2[ne[1]]],
          isPareto: paretoOptimal.some(po => po[0] === ne[0] && po[1] === ne[1])
        }));

        const result = {
          operation: 'pareto',
          game: game.name,

          paretoOptimalOutcomes: paretoOptimal.map(po => ({
            strategies: [game.strategies.player1[po[0]], game.strategies.player2[po[1]]],
            payoffs: [payoffs1[po[0]][po[1]], payoffs2[po[0]][po[1]]]
          })),

          nashEquilibriaPareto: nashPareto,

          efficiency: nashPareto.every(np => np.isPareto)
            ? 'All Nash equilibria are Pareto optimal'
            : 'Some Nash equilibria are not Pareto optimal (inefficiency)'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use: info, find, pure, mixed, verify, classic_games, dominance, best_response, pareto`
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isnashequilibriumAvailable(): boolean { return true; }
