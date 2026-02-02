/**
 * PAYOFF-MATRIX TOOL
 * Game theory payoff matrix analysis and equilibrium computation
 * Implements: Nash Equilibrium, Dominant Strategies, Pareto Optimality, Mixed Strategies
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const payoffmatrixTool: UnifiedTool = {
  name: 'payoff_matrix',
  description: 'Payoff matrix creation and game theory analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'create', 'analyze', 'nash_equilibrium', 'dominant_strategy', 'pareto_optimal', 'mixed_strategy', 'best_response', 'demonstrate'],
        description: 'Operation to perform'
      },
      matrix: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'array', items: { type: 'number' } }
        },
        description: 'Payoff matrix [row][col] = [player1_payoff, player2_payoff]'
      },
      player1_strategies: { type: 'array', items: { type: 'string' }, description: 'Player 1 strategy names' },
      player2_strategies: { type: 'array', items: { type: 'string' }, description: 'Player 2 strategy names' },
      game_name: { type: 'string', description: 'Name of the game' }
    },
    required: ['operation']
  }
};

// Types
type PayoffMatrix = [number, number][][]; // [row][col] = [p1_payoff, p2_payoff]

interface NashEquilibrium {
  row: number;
  col: number;
  payoffs: [number, number];
  isPure: boolean;
}

interface DominantStrategy {
  player: number;
  strategy: number;
  type: 'strictly' | 'weakly';
  dominates: number[];
}

interface ParetoOptimal {
  row: number;
  col: number;
  payoffs: [number, number];
}

interface MixedStrategyEquilibrium {
  player1Probabilities: number[];
  player2Probabilities: number[];
  expectedPayoffs: [number, number];
}

// Find best response for a player given opponent's strategy
function bestResponse(matrix: PayoffMatrix, player: number, opponentStrategy: number): number[] {
  const responses: number[] = [];
  let maxPayoff = -Infinity;

  if (player === 1) {
    // Player 1 chooses row, opponent chose column
    for (let row = 0; row < matrix.length; row++) {
      const payoff = matrix[row][opponentStrategy][0];
      if (payoff > maxPayoff) {
        maxPayoff = payoff;
        responses.length = 0;
        responses.push(row);
      } else if (payoff === maxPayoff) {
        responses.push(row);
      }
    }
  } else {
    // Player 2 chooses column, opponent chose row
    for (let col = 0; col < matrix[0].length; col++) {
      const payoff = matrix[opponentStrategy][col][1];
      if (payoff > maxPayoff) {
        maxPayoff = payoff;
        responses.length = 0;
        responses.push(col);
      } else if (payoff === maxPayoff) {
        responses.push(col);
      }
    }
  }

  return responses;
}

// Find pure strategy Nash equilibria
function findPureNashEquilibria(matrix: PayoffMatrix): NashEquilibrium[] {
  const equilibria: NashEquilibrium[] = [];

  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[0].length; col++) {
      // Check if row is best response to col
      const p1BestResponses = bestResponse(matrix, 1, col);
      // Check if col is best response to row
      const p2BestResponses = bestResponse(matrix, 2, row);

      if (p1BestResponses.includes(row) && p2BestResponses.includes(col)) {
        equilibria.push({
          row,
          col,
          payoffs: matrix[row][col] as [number, number],
          isPure: true
        });
      }
    }
  }

  return equilibria;
}

// Find dominant strategies
function findDominantStrategies(matrix: PayoffMatrix): DominantStrategy[] {
  const dominantStrategies: DominantStrategy[] = [];

  // Check Player 1's strategies
  for (let row1 = 0; row1 < matrix.length; row1++) {
    const dominates: number[] = [];
    let isStrictlyDominant = true;
    let isWeaklyDominant = true;

    for (let row2 = 0; row2 < matrix.length; row2++) {
      if (row1 === row2) continue;

      let allBetterOrEqual = true;
      let allStrictlyBetter = true;
      let atLeastOneBetter = false;

      for (let col = 0; col < matrix[0].length; col++) {
        if (matrix[row1][col][0] < matrix[row2][col][0]) {
          allBetterOrEqual = false;
          allStrictlyBetter = false;
        }
        if (matrix[row1][col][0] === matrix[row2][col][0]) {
          allStrictlyBetter = false;
        }
        if (matrix[row1][col][0] > matrix[row2][col][0]) {
          atLeastOneBetter = true;
        }
      }

      if (!allStrictlyBetter) isStrictlyDominant = false;
      if (!allBetterOrEqual || !atLeastOneBetter) isWeaklyDominant = false;

      if (allStrictlyBetter || (allBetterOrEqual && atLeastOneBetter)) {
        dominates.push(row2);
      }
    }

    if (dominates.length === matrix.length - 1) {
      dominantStrategies.push({
        player: 1,
        strategy: row1,
        type: isStrictlyDominant ? 'strictly' : 'weakly',
        dominates
      });
    }
  }

  // Check Player 2's strategies
  for (let col1 = 0; col1 < matrix[0].length; col1++) {
    const dominates: number[] = [];
    let isStrictlyDominant = true;
    let isWeaklyDominant = true;

    for (let col2 = 0; col2 < matrix[0].length; col2++) {
      if (col1 === col2) continue;

      let allBetterOrEqual = true;
      let allStrictlyBetter = true;
      let atLeastOneBetter = false;

      for (let row = 0; row < matrix.length; row++) {
        if (matrix[row][col1][1] < matrix[row][col2][1]) {
          allBetterOrEqual = false;
          allStrictlyBetter = false;
        }
        if (matrix[row][col1][1] === matrix[row][col2][1]) {
          allStrictlyBetter = false;
        }
        if (matrix[row][col1][1] > matrix[row][col2][1]) {
          atLeastOneBetter = true;
        }
      }

      if (!allStrictlyBetter) isStrictlyDominant = false;
      if (!allBetterOrEqual || !atLeastOneBetter) isWeaklyDominant = false;

      if (allStrictlyBetter || (allBetterOrEqual && atLeastOneBetter)) {
        dominates.push(col2);
      }
    }

    if (dominates.length === matrix[0].length - 1) {
      dominantStrategies.push({
        player: 2,
        strategy: col1,
        type: isStrictlyDominant ? 'strictly' : 'weakly',
        dominates
      });
    }
  }

  return dominantStrategies;
}

// Find Pareto optimal outcomes
function findParetoOptimal(matrix: PayoffMatrix): ParetoOptimal[] {
  const outcomes: ParetoOptimal[] = [];

  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix[0].length; col++) {
      const [p1, p2] = matrix[row][col];
      let isParetoOptimal = true;

      // Check if any other outcome Pareto dominates this one
      for (let r2 = 0; r2 < matrix.length && isParetoOptimal; r2++) {
        for (let c2 = 0; c2 < matrix[0].length && isParetoOptimal; c2++) {
          if (r2 === row && c2 === col) continue;

          const [q1, q2] = matrix[r2][c2];
          // Pareto dominated if other is weakly better for both and strictly better for at least one
          if (q1 >= p1 && q2 >= p2 && (q1 > p1 || q2 > p2)) {
            isParetoOptimal = false;
          }
        }
      }

      if (isParetoOptimal) {
        outcomes.push({
          row,
          col,
          payoffs: [p1, p2]
        });
      }
    }
  }

  return outcomes;
}

// Calculate mixed strategy equilibrium for 2x2 games
function findMixedStrategyEquilibrium(matrix: PayoffMatrix): MixedStrategyEquilibrium | null {
  if (matrix.length !== 2 || matrix[0].length !== 2) {
    return null; // Only handle 2x2 games for now
  }

  // For player 2 to be indifferent, player 1 mixes such that:
  // p * a + (1-p) * c = p * b + (1-p) * d
  // where a,b,c,d are player 2's payoffs
  const a = matrix[0][0][1];
  const b = matrix[0][1][1];
  const c = matrix[1][0][1];
  const d = matrix[1][1][1];

  // p * (a - c) = (1-p) * (d - b)
  // p * (a - c) = d - b - p * (d - b)
  // p * (a - c + d - b) = d - b
  // p = (d - b) / (a - c + d - b)

  const denomP = (a - c + d - b);
  if (Math.abs(denomP) < 1e-10) return null;

  const p = (d - b) / denomP;

  // For player 1 to be indifferent, player 2 mixes:
  const e = matrix[0][0][0];
  const f = matrix[0][1][0];
  const g = matrix[1][0][0];
  const h = matrix[1][1][0];

  // q * e + (1-q) * f = q * g + (1-q) * h
  const denomQ = (e - g + h - f);
  if (Math.abs(denomQ) < 1e-10) return null;

  const q = (h - f) / denomQ;

  // Check if probabilities are valid
  if (p < 0 || p > 1 || q < 0 || q > 1) {
    return null;
  }

  // Calculate expected payoffs
  const expectedP1 = p * (q * e + (1-q) * f) + (1-p) * (q * g + (1-q) * h);
  const expectedP2 = q * (p * a + (1-p) * c) + (1-q) * (p * b + (1-p) * d);

  return {
    player1Probabilities: [p, 1 - p],
    player2Probabilities: [q, 1 - q],
    expectedPayoffs: [expectedP1, expectedP2]
  };
}

// Classic games
function getClassicGame(name: string): { matrix: PayoffMatrix; p1Strategies: string[]; p2Strategies: string[] } {
  const games: { [key: string]: { matrix: PayoffMatrix; p1Strategies: string[]; p2Strategies: string[] } } = {
    'prisoners_dilemma': {
      matrix: [
        [[-1, -1], [-3, 0]],
        [[0, -3], [-2, -2]]
      ],
      p1Strategies: ['Cooperate', 'Defect'],
      p2Strategies: ['Cooperate', 'Defect']
    },
    'battle_of_sexes': {
      matrix: [
        [[3, 2], [0, 0]],
        [[0, 0], [2, 3]]
      ],
      p1Strategies: ['Opera', 'Football'],
      p2Strategies: ['Opera', 'Football']
    },
    'matching_pennies': {
      matrix: [
        [[1, -1], [-1, 1]],
        [[-1, 1], [1, -1]]
      ],
      p1Strategies: ['Heads', 'Tails'],
      p2Strategies: ['Heads', 'Tails']
    },
    'chicken': {
      matrix: [
        [[0, 0], [-1, 1]],
        [[1, -1], [-5, -5]]
      ],
      p1Strategies: ['Swerve', 'Straight'],
      p2Strategies: ['Swerve', 'Straight']
    },
    'stag_hunt': {
      matrix: [
        [[4, 4], [0, 3]],
        [[3, 0], [2, 2]]
      ],
      p1Strategies: ['Stag', 'Hare'],
      p2Strategies: ['Stag', 'Hare']
    },
    'rock_paper_scissors': {
      matrix: [
        [[0, 0], [-1, 1], [1, -1]],
        [[1, -1], [0, 0], [-1, 1]],
        [[-1, 1], [1, -1], [0, 0]]
      ],
      p1Strategies: ['Rock', 'Paper', 'Scissors'],
      p2Strategies: ['Rock', 'Paper', 'Scissors']
    }
  };

  return games[name] || games['prisoners_dilemma'];
}

// Format matrix for display
function formatMatrix(
  matrix: PayoffMatrix,
  p1Strategies: string[],
  p2Strategies: string[]
): string {
  const colWidth = 12;

  let output = '\n' + ' '.repeat(colWidth);
  for (const s of p2Strategies) {
    output += s.padStart(colWidth);
  }
  output += '\n' + '─'.repeat(colWidth * (p2Strategies.length + 1)) + '\n';

  for (let row = 0; row < matrix.length; row++) {
    output += p1Strategies[row].padEnd(colWidth);
    for (let col = 0; col < matrix[0].length; col++) {
      const [p1, p2] = matrix[row][col];
      output += `(${p1},${p2})`.padStart(colWidth);
    }
    output += '\n';
  }

  return output;
}

// Comprehensive game analysis
function analyzeGame(
  matrix: PayoffMatrix,
  p1Strategies: string[],
  p2Strategies: string[]
): {
  nashEquilibria: NashEquilibrium[];
  dominantStrategies: DominantStrategy[];
  paretoOptimal: ParetoOptimal[];
  mixedEquilibrium: MixedStrategyEquilibrium | null;
  gameType: string;
  socialOptimum: { row: number; col: number; welfare: number };
} {
  const nashEquilibria = findPureNashEquilibria(matrix);
  const dominantStrategies = findDominantStrategies(matrix);
  const paretoOptimal = findParetoOptimal(matrix);
  const mixedEquilibrium = findMixedStrategyEquilibrium(matrix);

  // Determine game type
  let gameType = 'General form game';
  if (nashEquilibria.length === 1) {
    if (dominantStrategies.length === 2) {
      gameType = 'Dominance-solvable game';
    }
  } else if (nashEquilibria.length === 0 && mixedEquilibrium) {
    gameType = 'Zero-sum or purely mixed strategy game';
  } else if (nashEquilibria.length >= 2) {
    gameType = 'Coordination game';
  }

  // Find social optimum
  let maxWelfare = -Infinity;
  let socialOptimum = { row: 0, col: 0, welfare: 0 };
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[0].length; c++) {
      const welfare = matrix[r][c][0] + matrix[r][c][1];
      if (welfare > maxWelfare) {
        maxWelfare = welfare;
        socialOptimum = { row: r, col: c, welfare: maxWelfare };
      }
    }
  }

  return {
    nashEquilibria,
    dominantStrategies,
    paretoOptimal,
    mixedEquilibrium,
    gameType,
    socialOptimum
  };
}

export async function executepayoffmatrix(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    let result: any;

    switch (operation) {
      case 'info':
        result = {
          tool: 'payoff-matrix',
          description: 'Game theory payoff matrix analysis',
          operations: [
            'info - Tool information',
            'create - Create a payoff matrix',
            'analyze - Full game analysis',
            'nash_equilibrium - Find Nash equilibria',
            'dominant_strategy - Find dominant strategies',
            'pareto_optimal - Find Pareto optimal outcomes',
            'mixed_strategy - Calculate mixed strategy equilibrium',
            'best_response - Find best responses',
            'demonstrate - Show game theory examples'
          ],
          classicGames: [
            'prisoners_dilemma', 'battle_of_sexes', 'matching_pennies',
            'chicken', 'stag_hunt', 'rock_paper_scissors'
          ],
          concepts: {
            nashEquilibrium: 'No player can improve by unilateral deviation',
            dominantStrategy: 'Best response regardless of opponent action',
            paretoOptimal: 'No outcome makes all players better off',
            mixedStrategy: 'Probabilistic strategy making opponents indifferent'
          }
        };
        break;

      case 'create': {
        const gameName = args.game_name || 'prisoners_dilemma';
        const game = getClassicGame(gameName);

        const matrix = args.matrix || game.matrix;
        const p1Strategies = args.player1_strategies || game.p1Strategies;
        const p2Strategies = args.player2_strategies || game.p2Strategies;

        const formatted = formatMatrix(matrix, p1Strategies, p2Strategies);

        result = {
          gameName,
          player1Strategies: p1Strategies,
          player2Strategies: p2Strategies,
          matrix,
          display: formatted,
          note: 'Payoffs shown as (Player1, Player2)'
        };
        break;
      }

      case 'analyze': {
        const gameName = args.game_name || 'prisoners_dilemma';
        const game = getClassicGame(gameName);

        const matrix = args.matrix || game.matrix;
        const p1Strategies = args.player1_strategies || game.p1Strategies;
        const p2Strategies = args.player2_strategies || game.p2Strategies;

        const analysis = analyzeGame(matrix, p1Strategies, p2Strategies);
        const formatted = formatMatrix(matrix, p1Strategies, p2Strategies);

        result = {
          gameName,
          matrixDisplay: formatted,
          analysis: {
            gameType: analysis.gameType,
            nashEquilibria: analysis.nashEquilibria.map(ne => ({
              strategies: `(${p1Strategies[ne.row]}, ${p2Strategies[ne.col]})`,
              payoffs: ne.payoffs
            })),
            dominantStrategies: analysis.dominantStrategies.map(ds => ({
              player: ds.player,
              strategy: ds.player === 1 ? p1Strategies[ds.strategy] : p2Strategies[ds.strategy],
              type: ds.type
            })),
            paretoOptimal: analysis.paretoOptimal.map(po => ({
              strategies: `(${p1Strategies[po.row]}, ${p2Strategies[po.col]})`,
              payoffs: po.payoffs
            })),
            mixedEquilibrium: analysis.mixedEquilibrium,
            socialOptimum: {
              strategies: `(${p1Strategies[analysis.socialOptimum.row]}, ${p2Strategies[analysis.socialOptimum.col]})`,
              totalWelfare: analysis.socialOptimum.welfare
            }
          }
        };
        break;
      }

      case 'nash_equilibrium': {
        const gameName = args.game_name || 'prisoners_dilemma';
        const game = getClassicGame(gameName);

        const matrix = args.matrix || game.matrix;
        const p1Strategies = args.player1_strategies || game.p1Strategies;
        const p2Strategies = args.player2_strategies || game.p2Strategies;

        const pureNE = findPureNashEquilibria(matrix);
        const mixedNE = findMixedStrategyEquilibrium(matrix);

        result = {
          gameName,
          pureNashEquilibria: pureNE.map(ne => ({
            player1Strategy: p1Strategies[ne.row],
            player2Strategy: p2Strategies[ne.col],
            payoffs: { player1: ne.payoffs[0], player2: ne.payoffs[1] }
          })),
          mixedNashEquilibrium: mixedNE ? {
            player1Probabilities: p1Strategies.map((s, i) => ({
              strategy: s,
              probability: mixedNE.player1Probabilities[i]?.toFixed(4) || 'N/A'
            })),
            player2Probabilities: p2Strategies.map((s, i) => ({
              strategy: s,
              probability: mixedNE.player2Probabilities[i]?.toFixed(4) || 'N/A'
            })),
            expectedPayoffs: mixedNE.expectedPayoffs
          } : 'No 2x2 mixed equilibrium (game is not 2x2 or no mixed equilibrium exists)',
          explanation: 'Nash equilibrium: No player can improve by unilaterally changing strategy'
        };
        break;
      }

      case 'dominant_strategy': {
        const gameName = args.game_name || 'prisoners_dilemma';
        const game = getClassicGame(gameName);

        const matrix = args.matrix || game.matrix;
        const p1Strategies = args.player1_strategies || game.p1Strategies;
        const p2Strategies = args.player2_strategies || game.p2Strategies;

        const dominant = findDominantStrategies(matrix);

        result = {
          gameName,
          dominantStrategies: dominant.map(ds => ({
            player: `Player ${ds.player}`,
            dominantStrategy: ds.player === 1 ? p1Strategies[ds.strategy] : p2Strategies[ds.strategy],
            type: `${ds.type} dominant`,
            dominatesStrategies: ds.dominates.map(d =>
              ds.player === 1 ? p1Strategies[d] : p2Strategies[d]
            )
          })),
          hasDominantStrategyEquilibrium: dominant.length === 2,
          explanation: dominant.length === 2
            ? 'Game is dominance-solvable: each player has a dominant strategy'
            : `Found ${dominant.length} dominant strateg${dominant.length === 1 ? 'y' : 'ies'}`
        };
        break;
      }

      case 'pareto_optimal': {
        const gameName = args.game_name || 'prisoners_dilemma';
        const game = getClassicGame(gameName);

        const matrix = args.matrix || game.matrix;
        const p1Strategies = args.player1_strategies || game.p1Strategies;
        const p2Strategies = args.player2_strategies || game.p2Strategies;

        const pareto = findParetoOptimal(matrix);
        const nash = findPureNashEquilibria(matrix);

        // Check if Nash is Pareto optimal
        const nashIsPareto = nash.every(ne =>
          pareto.some(po => po.row === ne.row && po.col === ne.col)
        );

        result = {
          gameName,
          paretoOptimalOutcomes: pareto.map(po => ({
            strategies: `(${p1Strategies[po.row]}, ${p2Strategies[po.col]})`,
            payoffs: { player1: po.payoffs[0], player2: po.payoffs[1] },
            totalWelfare: po.payoffs[0] + po.payoffs[1]
          })),
          nashEquilibria: nash.map(ne => ({
            strategies: `(${p1Strategies[ne.row]}, ${p2Strategies[ne.col]})`,
            payoffs: { player1: ne.payoffs[0], player2: ne.payoffs[1] }
          })),
          nashIsParetoOptimal: nashIsPareto,
          socialDilemma: !nashIsPareto ? 'Yes - Nash equilibrium is not Pareto optimal' : 'No',
          explanation: 'Pareto optimal: No outcome exists that makes everyone better off'
        };
        break;
      }

      case 'mixed_strategy': {
        const gameName = args.game_name || 'matching_pennies';
        const game = getClassicGame(gameName);

        const matrix = args.matrix || game.matrix;
        const p1Strategies = args.player1_strategies || game.p1Strategies;
        const p2Strategies = args.player2_strategies || game.p2Strategies;

        const mixed = findMixedStrategyEquilibrium(matrix);

        if (mixed) {
          result = {
            gameName,
            equilibrium: {
              player1: p1Strategies.map((s, i) => ({
                strategy: s,
                probability: (mixed.player1Probabilities[i] * 100).toFixed(2) + '%'
              })),
              player2: p2Strategies.map((s, i) => ({
                strategy: s,
                probability: (mixed.player2Probabilities[i] * 100).toFixed(2) + '%'
              }))
            },
            expectedPayoffs: {
              player1: mixed.expectedPayoffs[0].toFixed(4),
              player2: mixed.expectedPayoffs[1].toFixed(4)
            },
            interpretation: 'Each player randomizes to make the opponent indifferent between strategies'
          };
        } else {
          result = {
            gameName,
            error: 'Could not find mixed strategy equilibrium',
            note: 'Mixed equilibrium calculation currently only supports 2x2 games'
          };
        }
        break;
      }

      case 'best_response': {
        const gameName = args.game_name || 'prisoners_dilemma';
        const game = getClassicGame(gameName);

        const matrix = args.matrix || game.matrix;
        const p1Strategies = args.player1_strategies || game.p1Strategies;
        const p2Strategies = args.player2_strategies || game.p2Strategies;

        // Calculate best responses for all opponent strategies
        const p1BestResponses: { [key: string]: string[] } = {};
        const p2BestResponses: { [key: string]: string[] } = {};

        for (let col = 0; col < p2Strategies.length; col++) {
          const br = bestResponse(matrix, 1, col);
          p1BestResponses[p2Strategies[col]] = br.map(r => p1Strategies[r]);
        }

        for (let row = 0; row < p1Strategies.length; row++) {
          const br = bestResponse(matrix, 2, row);
          p2BestResponses[p1Strategies[row]] = br.map(c => p2Strategies[c]);
        }

        result = {
          gameName,
          player1BestResponses: p1BestResponses,
          player2BestResponses: p2BestResponses,
          explanation: 'Best response: optimal strategy given opponent\'s choice'
        };
        break;
      }

      case 'demonstrate': {
        let demo = `
╔═══════════════════════════════════════════════════════════════════════╗
║                  GAME THEORY: PAYOFF MATRIX ANALYSIS                  ║
╚═══════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════
                     1. PRISONER'S DILEMMA
═══════════════════════════════════════════════════════════════════════

Two suspects are arrested. Each can either COOPERATE (stay silent)
or DEFECT (testify against the other).

                     Player 2
                 Cooperate    Defect
           ┌───────────────┬───────────────┐
Cooperate  │   (-1, -1)    │   (-3,  0)    │
Player 1   ├───────────────┼───────────────┤
Defect     │   ( 0, -3)    │   (-2, -2)    │
           └───────────────┴───────────────┘

ANALYSIS:
• Dominant Strategy: Defect for both players
  - No matter what opponent does, Defect is better

• Nash Equilibrium: (Defect, Defect) → payoffs (-2, -2)

• Pareto Optimal: (Cooperate, Cooperate) → payoffs (-1, -1)

• DILEMMA: The rational outcome (Nash) is NOT socially optimal!
  Individual rationality leads to collective irrationality.

═══════════════════════════════════════════════════════════════════════
                     2. BATTLE OF THE SEXES
═══════════════════════════════════════════════════════════════════════

A couple wants to go out. He prefers football, she prefers opera.
Both prefer being together to being apart.

                     Player 2 (She)
                   Opera     Football
           ┌───────────────┬───────────────┐
Opera      │    (3, 2)     │    (0, 0)     │
Player 1   ├───────────────┼───────────────┤
(He)       │    (0, 0)     │    (2, 3)     │
Football   └───────────────┴───────────────┘

ANALYSIS:
• TWO Nash Equilibria:
  - (Opera, Opera) → (3, 2) - He sacrifices, she benefits more
  - (Football, Football) → (2, 3) - She sacrifices, he benefits more

• Coordination Problem: Which equilibrium to select?

• Mixed Strategy Equilibrium:
  - He: 60% Opera, 40% Football
  - She: 40% Opera, 60% Football
  - Expected payoff: 1.2 each (worse than either pure equilibrium!)

═══════════════════════════════════════════════════════════════════════
                     3. MATCHING PENNIES
═══════════════════════════════════════════════════════════════════════

Zero-sum game: Players simultaneously show heads or tails.
Matcher wins if same, Mismatcher wins if different.

                     Player 2
                  Heads      Tails
           ┌───────────────┬───────────────┐
Heads      │   (+1, -1)    │   (-1, +1)    │
Player 1   ├───────────────┼───────────────┤
Tails      │   (-1, +1)    │   (+1, -1)    │
           └───────────────┴───────────────┘

ANALYSIS:
• NO Pure Strategy Nash Equilibrium!
  - Every pure strategy has a profitable deviation

• Mixed Strategy Equilibrium:
  - Both players: 50% Heads, 50% Tails
  - Expected payoff: 0 for both

• This is a zero-sum game: Σ payoffs = 0 always

═══════════════════════════════════════════════════════════════════════
                     4. CHICKEN (HAWK-DOVE)
═══════════════════════════════════════════════════════════════════════

Two drivers head toward each other. First to swerve is "chicken."

                     Player 2
                  Swerve     Straight
           ┌───────────────┬───────────────┐
Swerve     │    (0, 0)     │   (-1, +1)    │
Player 1   ├───────────────┼───────────────┤
Straight   │   (+1, -1)    │   (-5, -5)    │
           └───────────────┴───────────────┘

ANALYSIS:
• TWO Nash Equilibria (asymmetric):
  - (Swerve, Straight) → (-1, +1)
  - (Straight, Swerve) → (+1, -1)

• Disaster at (Straight, Straight) → (-5, -5)

• Mixed Strategy:
  - Each plays Straight with probability 1/6 ≈ 16.7%
  - Risk of mutual destruction: 1/36 ≈ 2.8%

═══════════════════════════════════════════════════════════════════════
                     5. STAG HUNT
═══════════════════════════════════════════════════════════════════════

Two hunters can cooperate for a stag or individually hunt hares.

                     Player 2
                   Stag       Hare
           ┌───────────────┬───────────────┐
Stag       │    (4, 4)     │    (0, 3)     │
Player 1   ├───────────────┼───────────────┤
Hare       │    (3, 0)     │    (2, 2)     │
           └───────────────┴───────────────┘

ANALYSIS:
• TWO Nash Equilibria:
  - (Stag, Stag) → (4, 4) - Pareto optimal, risk-dominant
  - (Hare, Hare) → (2, 2) - Safe, payoff-dominated

• TRUST is key: Stag hunting requires coordination

• Unlike Prisoner's Dilemma: Cooperation IS an equilibrium!

═══════════════════════════════════════════════════════════════════════
                        KEY CONCEPTS
═══════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────┐
│ NASH EQUILIBRIUM                                                    │
│ • No player can improve by unilaterally deviating                  │
│ • May be in pure or mixed strategies                               │
│ • May not be unique or efficient                                   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ DOMINANT STRATEGY                                                   │
│ • Best response regardless of opponent's action                    │
│ • Strictly dominant: always strictly better                        │
│ • Weakly dominant: at least as good, sometimes strictly better     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ PARETO OPTIMALITY                                                   │
│ • No outcome makes everyone strictly better off                    │
│ • Efficiency concept (not fairness)                                │
│ • Nash ≠ Pareto optimal (Prisoner's Dilemma)                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ MIXED STRATEGY                                                      │
│ • Randomize to make opponent indifferent                           │
│ • For 2×2: p = (d-b)/(a-c+d-b)                                     │
│ • Always exists (Nash's theorem)                                   │
└─────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════
                     FINDING NASH EQUILIBRIA
═══════════════════════════════════════════════════════════════════════

Step 1: Find best responses
   • For each opponent strategy, find your best reply
   • Mark these cells with underlines

Step 2: Identify mutual best responses
   • Nash equilibrium = cell where BOTH have best response
   • If row is underlined AND column is underlined → Nash

Step 3: Check for mixed equilibria
   • Especially if no pure Nash exists
   • Set expected payoffs equal across strategies

Example with Prisoner's Dilemma:

   P2 plays Cooperate → P1's best: Defect (0 > -1)  ✓
   P2 plays Defect    → P1's best: Defect (-2 > -3) ✓

   P1 plays Cooperate → P2's best: Defect (0 > -1)  ✓
   P1 plays Defect    → P2's best: Defect (-2 > -3) ✓

   → (Defect, Defect) is the unique Nash equilibrium

═══════════════════════════════════════════════════════════════════════
`;

        result = {
          demonstration: demo,
          summary: {
            classicGames: ['Prisoner\'s Dilemma', 'Battle of Sexes', 'Matching Pennies', 'Chicken', 'Stag Hunt'],
            keyConcepts: ['Nash Equilibrium', 'Dominant Strategy', 'Pareto Optimality', 'Mixed Strategy'],
            applications: ['Economics', 'Political Science', 'Biology', 'Computer Science', 'Business Strategy']
          }
        };
        break;
      }

      default:
        result = { error: `Unknown operation: ${operation}`, availableOperations: ['info', 'create', 'analyze', 'nash_equilibrium', 'dominant_strategy', 'pareto_optimal', 'mixed_strategy', 'best_response', 'demonstrate'] };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function ispayoffmatrixAvailable(): boolean { return true; }
