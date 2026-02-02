/**
 * PAYOFF-MATRIX TOOL
 * Game theory payoff matrix analysis
 *
 * Implements strategic game analysis including:
 * - Nash equilibrium finding
 * - Dominant/dominated strategy elimination
 * - Pareto optimality analysis
 * - Mixed strategy equilibria
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Game types
interface Strategy {
  name: string;
  index: number;
}

interface Payoff {
  player1: number;
  player2: number;
}

interface NormalFormGame {
  player1Strategies: Strategy[];
  player2Strategies: Strategy[];
  payoffMatrix: Payoff[][];  // [p1 strategy][p2 strategy]
  name?: string;
}

// Create payoff matrix from arrays
function createGame(
  p1Strategies: string[],
  p2Strategies: string[],
  payoffs: [number, number][][]
): NormalFormGame {
  return {
    player1Strategies: p1Strategies.map((name, index) => ({ name, index })),
    player2Strategies: p2Strategies.map((name, index) => ({ name, index })),
    payoffMatrix: payoffs.map(row => row.map(([p1, p2]) => ({ player1: p1, player2: p2 })))
  };
}

// Find best responses for player 1 given player 2's strategy
function bestResponsesP1(game: NormalFormGame, p2Strategy: number): number[] {
  let maxPayoff = -Infinity;
  const bestResponses: number[] = [];

  for (let i = 0; i < game.player1Strategies.length; i++) {
    const payoff = game.payoffMatrix[i][p2Strategy].player1;
    if (payoff > maxPayoff) {
      maxPayoff = payoff;
      bestResponses.length = 0;
      bestResponses.push(i);
    } else if (payoff === maxPayoff) {
      bestResponses.push(i);
    }
  }

  return bestResponses;
}

// Find best responses for player 2 given player 1's strategy
function bestResponsesP2(game: NormalFormGame, p1Strategy: number): number[] {
  let maxPayoff = -Infinity;
  const bestResponses: number[] = [];

  for (let j = 0; j < game.player2Strategies.length; j++) {
    const payoff = game.payoffMatrix[p1Strategy][j].player2;
    if (payoff > maxPayoff) {
      maxPayoff = payoff;
      bestResponses.length = 0;
      bestResponses.push(j);
    } else if (payoff === maxPayoff) {
      bestResponses.push(j);
    }
  }

  return bestResponses;
}

// Find pure strategy Nash equilibria
function findPureNashEquilibria(game: NormalFormGame): [number, number][] {
  const equilibria: [number, number][] = [];

  for (let i = 0; i < game.player1Strategies.length; i++) {
    for (let j = 0; j < game.player2Strategies.length; j++) {
      // Check if (i, j) is a Nash equilibrium
      const p1BestResponses = bestResponsesP1(game, j);
      const p2BestResponses = bestResponsesP2(game, i);

      if (p1BestResponses.includes(i) && p2BestResponses.includes(j)) {
        equilibria.push([i, j]);
      }
    }
  }

  return equilibria;
}

// Find mixed strategy Nash equilibrium for 2x2 games
function findMixedNashEquilibrium2x2(game: NormalFormGame): {
  p1Mix: number[];
  p2Mix: number[];
  expectedPayoffs: { player1: number; player2: number };
} | null {
  if (game.player1Strategies.length !== 2 || game.player2Strategies.length !== 2) {
    return null;
  }

  const a = game.payoffMatrix[0][0].player1;
  const b = game.payoffMatrix[0][1].player1;
  const c = game.payoffMatrix[1][0].player1;
  const d = game.payoffMatrix[1][1].player1;

  const e = game.payoffMatrix[0][0].player2;
  const f = game.payoffMatrix[0][1].player2;
  const g = game.payoffMatrix[1][0].player2;
  const h = game.payoffMatrix[1][1].player2;

  // For player 2 to be indifferent: p(a) + (1-p)(c) = p(b) + (1-p)(d)
  // p(a-c) + c = p(b-d) + d
  // p(a-c-b+d) = d - c
  // p = (d-c) / (a-c-b+d)

  const p1Denom = a - c - b + d;
  const p2Denom = e - f - g + h;

  if (Math.abs(p1Denom) < 1e-10 || Math.abs(p2Denom) < 1e-10) {
    return null;  // No interior mixed equilibrium
  }

  const q = (d - c) / p1Denom;  // P2's probability of playing strategy 0
  const p = (h - f) / p2Denom;  // P1's probability of playing strategy 0

  // Check if probabilities are valid (between 0 and 1)
  if (p < 0 || p > 1 || q < 0 || q > 1) {
    return null;
  }

  // Calculate expected payoffs
  const expectedP1 = p * q * a + p * (1-q) * b + (1-p) * q * c + (1-p) * (1-q) * d;
  const expectedP2 = p * q * e + p * (1-q) * f + (1-p) * q * g + (1-p) * (1-q) * h;

  return {
    p1Mix: [p, 1 - p],
    p2Mix: [q, 1 - q],
    expectedPayoffs: { player1: expectedP1, player2: expectedP2 }
  };
}

// Check for dominant strategies
function findDominantStrategies(game: NormalFormGame): {
  player1: { strategy: number; type: 'strict' | 'weak' } | null;
  player2: { strategy: number; type: 'strict' | 'weak' } | null;
} {
  // Check for P1 dominant strategy
  let p1Dominant: { strategy: number; type: 'strict' | 'weak' } | null = null;

  for (let i = 0; i < game.player1Strategies.length; i++) {
    let dominatesAll = true;
    let strictlyDominatesAll = true;

    for (let other = 0; other < game.player1Strategies.length; other++) {
      if (other === i) continue;

      let dominatesOther = true;
      let strictlyDominatesOther = false;

      for (let j = 0; j < game.player2Strategies.length; j++) {
        const myPayoff = game.payoffMatrix[i][j].player1;
        const otherPayoff = game.payoffMatrix[other][j].player1;

        if (myPayoff < otherPayoff) {
          dominatesOther = false;
          dominatesAll = false;
        }
        if (myPayoff > otherPayoff) {
          strictlyDominatesOther = true;
        }
      }

      if (!dominatesOther) dominatesAll = false;
      if (!strictlyDominatesOther) strictlyDominatesAll = false;
    }

    if (dominatesAll) {
      p1Dominant = { strategy: i, type: strictlyDominatesAll ? 'strict' : 'weak' };
      break;
    }
  }

  // Check for P2 dominant strategy
  let p2Dominant: { strategy: number; type: 'strict' | 'weak' } | null = null;

  for (let j = 0; j < game.player2Strategies.length; j++) {
    let dominatesAll = true;
    let strictlyDominatesAll = true;

    for (let other = 0; other < game.player2Strategies.length; other++) {
      if (other === j) continue;

      let dominatesOther = true;
      let strictlyDominatesOther = false;

      for (let i = 0; i < game.player1Strategies.length; i++) {
        const myPayoff = game.payoffMatrix[i][j].player2;
        const otherPayoff = game.payoffMatrix[i][other].player2;

        if (myPayoff < otherPayoff) {
          dominatesOther = false;
          dominatesAll = false;
        }
        if (myPayoff > otherPayoff) {
          strictlyDominatesOther = true;
        }
      }

      if (!dominatesOther) dominatesAll = false;
      if (!strictlyDominatesOther) strictlyDominatesAll = false;
    }

    if (dominatesAll) {
      p2Dominant = { strategy: j, type: strictlyDominatesAll ? 'strict' : 'weak' };
      break;
    }
  }

  return { player1: p1Dominant, player2: p2Dominant };
}

// Find dominated strategies
function findDominatedStrategies(game: NormalFormGame): {
  player1: number[];
  player2: number[];
} {
  const p1Dominated: number[] = [];
  const p2Dominated: number[] = [];

  // Check P1 strategies
  for (let i = 0; i < game.player1Strategies.length; i++) {
    for (let other = 0; other < game.player1Strategies.length; other++) {
      if (other === i) continue;

      let dominatedByOther = true;
      for (let j = 0; j < game.player2Strategies.length; j++) {
        if (game.payoffMatrix[i][j].player1 >= game.payoffMatrix[other][j].player1) {
          dominatedByOther = false;
          break;
        }
      }

      if (dominatedByOther) {
        p1Dominated.push(i);
        break;
      }
    }
  }

  // Check P2 strategies
  for (let j = 0; j < game.player2Strategies.length; j++) {
    for (let other = 0; other < game.player2Strategies.length; other++) {
      if (other === j) continue;

      let dominatedByOther = true;
      for (let i = 0; i < game.player1Strategies.length; i++) {
        if (game.payoffMatrix[i][j].player2 >= game.payoffMatrix[i][other].player2) {
          dominatedByOther = false;
          break;
        }
      }

      if (dominatedByOther) {
        p2Dominated.push(j);
        break;
      }
    }
  }

  return { player1: p1Dominated, player2: p2Dominated };
}

// Check Pareto optimality
function findParetoOptimalOutcomes(game: NormalFormGame): [number, number][] {
  const outcomes: { i: number; j: number; p1: number; p2: number }[] = [];

  for (let i = 0; i < game.player1Strategies.length; i++) {
    for (let j = 0; j < game.player2Strategies.length; j++) {
      outcomes.push({
        i, j,
        p1: game.payoffMatrix[i][j].player1,
        p2: game.payoffMatrix[i][j].player2
      });
    }
  }

  const paretoOptimal: [number, number][] = [];

  for (const outcome of outcomes) {
    let isDominated = false;

    for (const other of outcomes) {
      if (outcome === other) continue;

      // Check if other Pareto-dominates outcome
      if (other.p1 >= outcome.p1 && other.p2 >= outcome.p2 &&
          (other.p1 > outcome.p1 || other.p2 > outcome.p2)) {
        isDominated = true;
        break;
      }
    }

    if (!isDominated) {
      paretoOptimal.push([outcome.i, outcome.j]);
    }
  }

  return paretoOptimal;
}

// Format payoff matrix for display
function formatPayoffMatrix(game: NormalFormGame): string {
  const colWidth = 12;
  let result = '';

  // Header
  result += ' '.repeat(colWidth);
  for (const s2 of game.player2Strategies) {
    result += s2.name.padStart(colWidth);
  }
  result += '\n';

  // Rows
  for (let i = 0; i < game.player1Strategies.length; i++) {
    result += game.player1Strategies[i].name.padEnd(colWidth);
    for (let j = 0; j < game.player2Strategies.length; j++) {
      const p = game.payoffMatrix[i][j];
      result += `(${p.player1},${p.player2})`.padStart(colWidth);
    }
    result += '\n';
  }

  return result;
}

// Classic game examples
const CLASSIC_GAMES: Record<string, NormalFormGame> = {
  'prisoners_dilemma': {
    player1Strategies: [{ name: 'Cooperate', index: 0 }, { name: 'Defect', index: 1 }],
    player2Strategies: [{ name: 'Cooperate', index: 0 }, { name: 'Defect', index: 1 }],
    payoffMatrix: [
      [{ player1: -1, player2: -1 }, { player1: -3, player2: 0 }],
      [{ player1: 0, player2: -3 }, { player1: -2, player2: -2 }]
    ],
    name: "Prisoner's Dilemma"
  },
  'battle_of_sexes': {
    player1Strategies: [{ name: 'Opera', index: 0 }, { name: 'Football', index: 1 }],
    player2Strategies: [{ name: 'Opera', index: 0 }, { name: 'Football', index: 1 }],
    payoffMatrix: [
      [{ player1: 3, player2: 2 }, { player1: 0, player2: 0 }],
      [{ player1: 0, player2: 0 }, { player1: 2, player2: 3 }]
    ],
    name: 'Battle of the Sexes'
  },
  'chicken': {
    player1Strategies: [{ name: 'Swerve', index: 0 }, { name: 'Straight', index: 1 }],
    player2Strategies: [{ name: 'Swerve', index: 0 }, { name: 'Straight', index: 1 }],
    payoffMatrix: [
      [{ player1: 0, player2: 0 }, { player1: -1, player2: 1 }],
      [{ player1: 1, player2: -1 }, { player1: -10, player2: -10 }]
    ],
    name: 'Chicken (Game of Dare)'
  },
  'matching_pennies': {
    player1Strategies: [{ name: 'Heads', index: 0 }, { name: 'Tails', index: 1 }],
    player2Strategies: [{ name: 'Heads', index: 0 }, { name: 'Tails', index: 1 }],
    payoffMatrix: [
      [{ player1: 1, player2: -1 }, { player1: -1, player2: 1 }],
      [{ player1: -1, player2: 1 }, { player1: 1, player2: -1 }]
    ],
    name: 'Matching Pennies'
  },
  'stag_hunt': {
    player1Strategies: [{ name: 'Stag', index: 0 }, { name: 'Hare', index: 1 }],
    player2Strategies: [{ name: 'Stag', index: 0 }, { name: 'Hare', index: 1 }],
    payoffMatrix: [
      [{ player1: 4, player2: 4 }, { player1: 0, player2: 3 }],
      [{ player1: 3, player2: 0 }, { player1: 3, player2: 3 }]
    ],
    name: 'Stag Hunt'
  },
  'coordination': {
    player1Strategies: [{ name: 'A', index: 0 }, { name: 'B', index: 1 }],
    player2Strategies: [{ name: 'A', index: 0 }, { name: 'B', index: 1 }],
    payoffMatrix: [
      [{ player1: 2, player2: 2 }, { player1: 0, player2: 0 }],
      [{ player1: 0, player2: 0 }, { player1: 1, player2: 1 }]
    ],
    name: 'Coordination Game'
  }
};

export const payoffmatrixTool: UnifiedTool = {
  name: 'payoff_matrix',
  description: `Game theory payoff matrix analysis for strategic games.

Analyzes two-player normal form games to find:
- Nash equilibria (pure and mixed strategies)
- Dominant and dominated strategies
- Pareto optimal outcomes
- Best response correspondences

Includes classic games:
- Prisoner's Dilemma
- Battle of the Sexes
- Chicken
- Matching Pennies
- Stag Hunt
- Coordination Game`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'analyze', 'nash', 'dominant', 'dominated', 'pareto', 'best_response', 'mixed', 'examples', 'info'],
        description: 'Operation to perform'
      },
      game: {
        type: 'string',
        enum: ['prisoners_dilemma', 'battle_of_sexes', 'chicken', 'matching_pennies', 'stag_hunt', 'coordination'],
        description: 'Classic game to analyze'
      },
      player1_strategies: {
        type: 'array',
        items: { type: 'string' },
        description: 'Player 1 strategy names'
      },
      player2_strategies: {
        type: 'array',
        items: { type: 'string' },
        description: 'Player 2 strategy names'
      },
      payoffs: {
        type: 'array',
        items: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: 'number' }
          }
        },
        description: 'Payoff matrix as [[[p1,p2],...],...]'
      },
      p1_strategy: { type: 'integer', description: 'Player 1 strategy index for best response' },
      p2_strategy: { type: 'integer', description: 'Player 2 strategy index for best response' }
    },
    required: ['operation']
  }
};

export async function executepayoffmatrix(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, game: gameName, player1_strategies, player2_strategies, payoffs, p1_strategy, p2_strategy } = args;

    // Get or create game
    let game: NormalFormGame;

    if (gameName && CLASSIC_GAMES[gameName]) {
      game = CLASSIC_GAMES[gameName];
    } else if (player1_strategies && player2_strategies && payoffs) {
      game = createGame(player1_strategies, player2_strategies, payoffs);
    } else {
      game = CLASSIC_GAMES['prisoners_dilemma'];
    }

    switch (operation) {
      case 'create': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            game_name: game.name || 'Custom Game',
            player1_strategies: game.player1Strategies.map(s => s.name),
            player2_strategies: game.player2Strategies.map(s => s.name),
            payoff_matrix: game.payoffMatrix.map(row =>
              row.map(p => [p.player1, p.player2])
            ),
            formatted_matrix: formatPayoffMatrix(game),
            interpretation: 'Payoffs shown as (Player1, Player2)'
          }, null, 2)
        };
      }

      case 'analyze': {
        const nashPure = findPureNashEquilibria(game);
        const nashMixed = findMixedNashEquilibrium2x2(game);
        const dominant = findDominantStrategies(game);
        const dominated = findDominatedStrategies(game);
        const pareto = findParetoOptimalOutcomes(game);

        return {
          toolCallId: id,
          content: JSON.stringify({
            game_name: game.name || 'Custom Game',
            formatted_matrix: formatPayoffMatrix(game),
            analysis: {
              pure_nash_equilibria: nashPure.map(([i, j]) => ({
                strategies: [game.player1Strategies[i].name, game.player2Strategies[j].name],
                payoffs: game.payoffMatrix[i][j]
              })),
              mixed_nash_equilibrium: nashMixed ? {
                player1_mix: game.player1Strategies.map((s, i) => ({
                  strategy: s.name,
                  probability: nashMixed.p1Mix[i].toFixed(4)
                })),
                player2_mix: game.player2Strategies.map((s, i) => ({
                  strategy: s.name,
                  probability: nashMixed.p2Mix[i].toFixed(4)
                })),
                expected_payoffs: nashMixed.expectedPayoffs
              } : 'Not applicable (not 2x2) or no interior equilibrium',
              dominant_strategies: {
                player1: dominant.player1 ? {
                  strategy: game.player1Strategies[dominant.player1.strategy].name,
                  type: dominant.player1.type
                } : 'None',
                player2: dominant.player2 ? {
                  strategy: game.player2Strategies[dominant.player2.strategy].name,
                  type: dominant.player2.type
                } : 'None'
              },
              dominated_strategies: {
                player1: dominated.player1.map(i => game.player1Strategies[i].name),
                player2: dominated.player2.map(j => game.player2Strategies[j].name)
              },
              pareto_optimal_outcomes: pareto.map(([i, j]) => ({
                strategies: [game.player1Strategies[i].name, game.player2Strategies[j].name],
                payoffs: game.payoffMatrix[i][j]
              }))
            }
          }, null, 2)
        };
      }

      case 'nash': {
        const nashPure = findPureNashEquilibria(game);
        const nashMixed = findMixedNashEquilibrium2x2(game);

        return {
          toolCallId: id,
          content: JSON.stringify({
            game_name: game.name || 'Custom Game',
            pure_strategy_nash_equilibria: nashPure.length > 0 ? nashPure.map(([i, j]) => ({
              player1: game.player1Strategies[i].name,
              player2: game.player2Strategies[j].name,
              payoffs: { player1: game.payoffMatrix[i][j].player1, player2: game.payoffMatrix[i][j].player2 }
            })) : 'None found',
            mixed_strategy_nash_equilibrium: nashMixed ? {
              player1_probabilities: game.player1Strategies.map((s, i) => `${s.name}: ${(nashMixed.p1Mix[i] * 100).toFixed(1)}%`),
              player2_probabilities: game.player2Strategies.map((s, i) => `${s.name}: ${(nashMixed.p2Mix[i] * 100).toFixed(1)}%`),
              expected_payoffs: nashMixed.expectedPayoffs
            } : 'Not applicable or no interior equilibrium',
            definition: 'Nash equilibrium: No player can improve by unilaterally changing strategy'
          }, null, 2)
        };
      }

      case 'dominant': {
        const dominant = findDominantStrategies(game);

        return {
          toolCallId: id,
          content: JSON.stringify({
            game_name: game.name || 'Custom Game',
            dominant_strategies: {
              player1: dominant.player1 ? {
                strategy: game.player1Strategies[dominant.player1.strategy].name,
                type: dominant.player1.type,
                definition: dominant.player1.type === 'strict'
                  ? 'Always better regardless of opponent\'s choice'
                  : 'Never worse and sometimes better'
              } : 'No dominant strategy',
              player2: dominant.player2 ? {
                strategy: game.player2Strategies[dominant.player2.strategy].name,
                type: dominant.player2.type,
                definition: dominant.player2.type === 'strict'
                  ? 'Always better regardless of opponent\'s choice'
                  : 'Never worse and sometimes better'
              } : 'No dominant strategy'
            }
          }, null, 2)
        };
      }

      case 'dominated': {
        const dominated = findDominatedStrategies(game);

        return {
          toolCallId: id,
          content: JSON.stringify({
            game_name: game.name || 'Custom Game',
            dominated_strategies: {
              player1: dominated.player1.length > 0
                ? dominated.player1.map(i => ({
                    strategy: game.player1Strategies[i].name,
                    meaning: 'This strategy is always worse than some other strategy'
                  }))
                : 'No dominated strategies',
              player2: dominated.player2.length > 0
                ? dominated.player2.map(j => ({
                    strategy: game.player2Strategies[j].name,
                    meaning: 'This strategy is always worse than some other strategy'
                  }))
                : 'No dominated strategies'
            },
            note: 'Rational players never play dominated strategies'
          }, null, 2)
        };
      }

      case 'pareto': {
        const pareto = findParetoOptimalOutcomes(game);
        const nashPure = findPureNashEquilibria(game);

        // Check if Nash equilibria are Pareto optimal
        const nashPareto = nashPure.map(([i, j]) => ({
          nash: [game.player1Strategies[i].name, game.player2Strategies[j].name],
          is_pareto_optimal: pareto.some(([pi, pj]) => pi === i && pj === j)
        }));

        return {
          toolCallId: id,
          content: JSON.stringify({
            game_name: game.name || 'Custom Game',
            pareto_optimal_outcomes: pareto.map(([i, j]) => ({
              player1_strategy: game.player1Strategies[i].name,
              player2_strategy: game.player2Strategies[j].name,
              payoffs: game.payoffMatrix[i][j],
              is_nash: nashPure.some(([ni, nj]) => ni === i && nj === j)
            })),
            nash_pareto_comparison: nashPareto,
            definition: 'Pareto optimal: No outcome makes both players better off',
            social_dilemma: nashPareto.some(n => !n.is_pareto_optimal)
              ? 'Yes - Nash equilibrium is not Pareto optimal (social dilemma exists)'
              : 'No - Nash equilibrium is Pareto optimal'
          }, null, 2)
        };
      }

      case 'best_response': {
        const results: { scenario: string; best_responses: string[] }[] = [];

        if (p2_strategy !== undefined && p2_strategy < game.player2Strategies.length) {
          const br = bestResponsesP1(game, p2_strategy);
          results.push({
            scenario: `P2 plays ${game.player2Strategies[p2_strategy].name}`,
            best_responses: br.map(i => game.player1Strategies[i].name)
          });
        }

        if (p1_strategy !== undefined && p1_strategy < game.player1Strategies.length) {
          const br = bestResponsesP2(game, p1_strategy);
          results.push({
            scenario: `P1 plays ${game.player1Strategies[p1_strategy].name}`,
            best_responses: br.map(j => game.player2Strategies[j].name)
          });
        }

        // Full best response correspondence
        const p1Correspondence: { against: string; best_responses: string[] }[] = [];
        const p2Correspondence: { against: string; best_responses: string[] }[] = [];

        for (let j = 0; j < game.player2Strategies.length; j++) {
          const br = bestResponsesP1(game, j);
          p1Correspondence.push({
            against: game.player2Strategies[j].name,
            best_responses: br.map(i => game.player1Strategies[i].name)
          });
        }

        for (let i = 0; i < game.player1Strategies.length; i++) {
          const br = bestResponsesP2(game, i);
          p2Correspondence.push({
            against: game.player1Strategies[i].name,
            best_responses: br.map(j => game.player2Strategies[j].name)
          });
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            game_name: game.name || 'Custom Game',
            specific_queries: results.length > 0 ? results : 'Use p1_strategy or p2_strategy parameters',
            best_response_correspondence: {
              player1: p1Correspondence,
              player2: p2Correspondence
            },
            definition: 'Best response: Strategy that maximizes payoff given opponent\'s choice'
          }, null, 2)
        };
      }

      case 'mixed': {
        const mixed = findMixedNashEquilibrium2x2(game);

        if (!mixed) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              game_name: game.name || 'Custom Game',
              mixed_strategy_equilibrium: 'Not applicable (not 2x2 game or no interior equilibrium)',
              note: 'Mixed strategy equilibrium calculation is implemented for 2x2 games'
            }, null, 2)
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            game_name: game.name || 'Custom Game',
            mixed_strategy_equilibrium: {
              player1: {
                strategy_mix: game.player1Strategies.map((s, i) => ({
                  strategy: s.name,
                  probability: mixed.p1Mix[i],
                  percentage: `${(mixed.p1Mix[i] * 100).toFixed(1)}%`
                }))
              },
              player2: {
                strategy_mix: game.player2Strategies.map((s, i) => ({
                  strategy: s.name,
                  probability: mixed.p2Mix[i],
                  percentage: `${(mixed.p2Mix[i] * 100).toFixed(1)}%`
                }))
              },
              expected_payoffs: {
                player1: mixed.expectedPayoffs.player1.toFixed(4),
                player2: mixed.expectedPayoffs.player2.toFixed(4)
              }
            },
            interpretation: 'Each player randomizes to make opponent indifferent'
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            classic_games: Object.entries(CLASSIC_GAMES).map(([key, g]) => ({
              key,
              name: g.name,
              strategies: {
                player1: g.player1Strategies.map(s => s.name),
                player2: g.player2Strategies.map(s => s.name)
              },
              type: key === 'prisoners_dilemma' ? 'Social dilemma'
                : key === 'battle_of_sexes' ? 'Coordination with conflict'
                : key === 'chicken' ? 'Anti-coordination'
                : key === 'matching_pennies' ? 'Zero-sum'
                : key === 'stag_hunt' ? 'Coordination'
                : 'Pure coordination'
            })),
            usage: 'Use game parameter to analyze these classic games'
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'payoff_matrix',
            description: 'Game theory payoff matrix analysis',
            concepts: {
              nash_equilibrium: 'Strategy profile where no player benefits from unilateral deviation',
              dominant_strategy: 'Strategy that is best regardless of opponent\'s choice',
              dominated_strategy: 'Strategy that is never best (always worse than another)',
              pareto_optimal: 'No outcome makes everyone better off',
              mixed_strategy: 'Probability distribution over pure strategies'
            },
            operations: {
              create: 'Create and display payoff matrix',
              analyze: 'Complete game analysis',
              nash: 'Find Nash equilibria (pure and mixed)',
              dominant: 'Find dominant strategies',
              dominated: 'Find dominated strategies',
              pareto: 'Find Pareto optimal outcomes',
              best_response: 'Calculate best response correspondence',
              mixed: 'Calculate mixed strategy equilibrium',
              examples: 'List classic games'
            }
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ispayoffmatrixAvailable(): boolean {
  return true;
}
