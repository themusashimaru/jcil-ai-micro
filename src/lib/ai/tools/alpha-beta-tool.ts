/**
 * ALPHA-BETA TOOL
 * Alpha-beta pruning game tree search algorithm
 * Supports Tic-Tac-Toe, Connect Four, and custom game trees
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

export interface GameState {
  board: number[][];
  currentPlayer: number;
  gameOver: boolean;
  winner: number | null;
}

interface SearchResult {
  bestMove: number[];
  bestScore: number;
  nodesExplored: number;
  nodesPruned: number;
  depth: number;
  searchTree?: TreeNode[];
}

interface TreeNode {
  id: number;
  depth: number;
  alpha: number;
  beta: number;
  value: number | null;
  move?: number[];
  pruned: boolean;
  isMaximizing: boolean;
  children?: number[];
}

interface MinimaxTrace {
  depth: number;
  isMaximizing: boolean;
  alpha: number;
  beta: number;
  value: number;
  action: string;
}

// ============================================================================
// TIC-TAC-TOE IMPLEMENTATION
// ============================================================================

class TicTacToe {
  board: number[][];
  currentPlayer: number;

  constructor(board?: number[][]) {
    this.board = board || [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    this.currentPlayer = 1; // 1 for X, -1 for O
  }

  clone(): TicTacToe {
    const newGame = new TicTacToe();
    newGame.board = this.board.map(row => [...row]);
    newGame.currentPlayer = this.currentPlayer;
    return newGame;
  }

  getValidMoves(): number[][] {
    const moves: number[][] = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (this.board[i][j] === 0) {
          moves.push([i, j]);
        }
      }
    }
    return moves;
  }

  makeMove(row: number, col: number): boolean {
    if (this.board[row][col] !== 0) return false;
    this.board[row][col] = this.currentPlayer;
    this.currentPlayer = -this.currentPlayer;
    return true;
  }

  checkWinner(): number | null {
    // Check rows and columns
    for (let i = 0; i < 3; i++) {
      if (this.board[i][0] !== 0 &&
          this.board[i][0] === this.board[i][1] &&
          this.board[i][1] === this.board[i][2]) {
        return this.board[i][0];
      }
      if (this.board[0][i] !== 0 &&
          this.board[0][i] === this.board[1][i] &&
          this.board[1][i] === this.board[2][i]) {
        return this.board[0][i];
      }
    }

    // Check diagonals
    if (this.board[0][0] !== 0 &&
        this.board[0][0] === this.board[1][1] &&
        this.board[1][1] === this.board[2][2]) {
      return this.board[0][0];
    }
    if (this.board[0][2] !== 0 &&
        this.board[0][2] === this.board[1][1] &&
        this.board[1][1] === this.board[2][0]) {
      return this.board[0][2];
    }

    return null;
  }

  isGameOver(): boolean {
    if (this.checkWinner() !== null) return true;
    return this.getValidMoves().length === 0;
  }

  evaluate(): number {
    const winner = this.checkWinner();
    if (winner === 1) return 10;
    if (winner === -1) return -10;
    return 0;
  }

  toString(): string {
    const symbols = { '0': '.', '1': 'X', '-1': 'O' };
    return this.board.map(row =>
      row.map(cell => symbols[cell.toString() as keyof typeof symbols]).join(' ')
    ).join('\n');
  }
}

// ============================================================================
// CONNECT FOUR IMPLEMENTATION
// ============================================================================

class ConnectFour {
  board: number[][];
  currentPlayer: number;
  readonly ROWS = 6;
  readonly COLS = 7;

  constructor(board?: number[][]) {
    this.board = board || Array(6).fill(null).map(() => Array(7).fill(0));
    this.currentPlayer = 1;
  }

  clone(): ConnectFour {
    const newGame = new ConnectFour();
    newGame.board = this.board.map(row => [...row]);
    newGame.currentPlayer = this.currentPlayer;
    return newGame;
  }

  getValidMoves(): number[] {
    const moves: number[] = [];
    for (let col = 0; col < this.COLS; col++) {
      if (this.board[0][col] === 0) {
        moves.push(col);
      }
    }
    return moves;
  }

  makeMove(col: number): boolean {
    for (let row = this.ROWS - 1; row >= 0; row--) {
      if (this.board[row][col] === 0) {
        this.board[row][col] = this.currentPlayer;
        this.currentPlayer = -this.currentPlayer;
        return true;
      }
    }
    return false;
  }

  checkWinner(): number | null {
    // Horizontal
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c <= this.COLS - 4; c++) {
        const sum = this.board[r][c] + this.board[r][c+1] +
                   this.board[r][c+2] + this.board[r][c+3];
        if (sum === 4) return 1;
        if (sum === -4) return -1;
      }
    }

    // Vertical
    for (let r = 0; r <= this.ROWS - 4; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const sum = this.board[r][c] + this.board[r+1][c] +
                   this.board[r+2][c] + this.board[r+3][c];
        if (sum === 4) return 1;
        if (sum === -4) return -1;
      }
    }

    // Diagonal (positive slope)
    for (let r = 3; r < this.ROWS; r++) {
      for (let c = 0; c <= this.COLS - 4; c++) {
        const sum = this.board[r][c] + this.board[r-1][c+1] +
                   this.board[r-2][c+2] + this.board[r-3][c+3];
        if (sum === 4) return 1;
        if (sum === -4) return -1;
      }
    }

    // Diagonal (negative slope)
    for (let r = 0; r <= this.ROWS - 4; r++) {
      for (let c = 0; c <= this.COLS - 4; c++) {
        const sum = this.board[r][c] + this.board[r+1][c+1] +
                   this.board[r+2][c+2] + this.board[r+3][c+3];
        if (sum === 4) return 1;
        if (sum === -4) return -1;
      }
    }

    return null;
  }

  isGameOver(): boolean {
    return this.checkWinner() !== null || this.getValidMoves().length === 0;
  }

  evaluate(): number {
    const winner = this.checkWinner();
    if (winner === 1) return 1000;
    if (winner === -1) return -1000;

    // Heuristic evaluation
    let score = 0;

    // Center column preference
    const centerCol = 3;
    let centerCount = 0;
    for (let r = 0; r < this.ROWS; r++) {
      if (this.board[r][centerCol] === 1) centerCount++;
      if (this.board[r][centerCol] === -1) centerCount--;
    }
    score += centerCount * 3;

    return score;
  }
}

// ============================================================================
// ALPHA-BETA SEARCH
// ============================================================================

interface AlphaBetaOptions {
  maxDepth: number;
  useIterativeDeepening?: boolean;
  useMoveOrdering?: boolean;
  traceSearch?: boolean;
}

class AlphaBetaSearch {
  nodesExplored = 0;
  nodesPruned = 0;
  searchTree: TreeNode[] = [];
  traces: MinimaxTrace[] = [];
  nodeIdCounter = 0;

  alphaBeta(
    game: TicTacToe | ConnectFour,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    trace: boolean = false
  ): number {
    this.nodesExplored++;

    if (depth === 0 || game.isGameOver()) {
      const evalScore = game.evaluate();
      if (trace) {
        this.traces.push({
          depth,
          isMaximizing,
          alpha,
          beta,
          value: evalScore,
          action: 'terminal'
        });
      }
      return evalScore;
    }

    if (isMaximizing) {
      let maxEval = -Infinity;
      const moves = game instanceof TicTacToe
        ? game.getValidMoves()
        : (game as ConnectFour).getValidMoves().map(c => [c]);

      for (const move of moves) {
        const child = game.clone();
        if (game instanceof TicTacToe) {
          child.makeMove(move[0], move[1]);
        } else {
          (child as ConnectFour).makeMove(move[0]);
        }

        const evalScore = this.alphaBeta(child, depth - 1, alpha, beta, false, trace);
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);

        if (beta <= alpha) {
          this.nodesPruned++;
          if (trace) {
            this.traces.push({
              depth,
              isMaximizing,
              alpha,
              beta,
              value: maxEval,
              action: 'beta-cutoff'
            });
          }
          break;
        }
      }

      if (trace) {
        this.traces.push({
          depth,
          isMaximizing,
          alpha,
          beta,
          value: maxEval,
          action: 'max'
        });
      }

      return maxEval;
    } else {
      let minEval = Infinity;
      const moves = game instanceof TicTacToe
        ? game.getValidMoves()
        : (game as ConnectFour).getValidMoves().map(c => [c]);

      for (const move of moves) {
        const child = game.clone();
        if (game instanceof TicTacToe) {
          child.makeMove(move[0], move[1]);
        } else {
          (child as ConnectFour).makeMove(move[0]);
        }

        const evalScore = this.alphaBeta(child, depth - 1, alpha, beta, true, trace);
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);

        if (beta <= alpha) {
          this.nodesPruned++;
          if (trace) {
            this.traces.push({
              depth,
              isMaximizing,
              alpha,
              beta,
              value: minEval,
              action: 'alpha-cutoff'
            });
          }
          break;
        }
      }

      if (trace) {
        this.traces.push({
          depth,
          isMaximizing,
          alpha,
          beta,
          value: minEval,
          action: 'min'
        });
      }

      return minEval;
    }
  }

  findBestMove(
    game: TicTacToe | ConnectFour,
    options: AlphaBetaOptions
  ): SearchResult {
    this.nodesExplored = 0;
    this.nodesPruned = 0;
    this.traces = [];

    const isMax = game.currentPlayer === 1;
    let bestMove: number[] = [];
    let bestScore = isMax ? -Infinity : Infinity;

    const moves = game instanceof TicTacToe
      ? game.getValidMoves()
      : (game as ConnectFour).getValidMoves().map(c => [c]);

    for (const move of moves) {
      const child = game.clone();
      if (game instanceof TicTacToe) {
        child.makeMove(move[0], move[1]);
      } else {
        (child as ConnectFour).makeMove(move[0]);
      }

      const score = this.alphaBeta(
        child,
        options.maxDepth - 1,
        -Infinity,
        Infinity,
        !isMax,
        options.traceSearch
      );

      if (isMax) {
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }
    }

    return {
      bestMove,
      bestScore,
      nodesExplored: this.nodesExplored,
      nodesPruned: this.nodesPruned,
      depth: options.maxDepth
    };
  }
}

// ============================================================================
// CUSTOM GAME TREE
// ============================================================================

interface GameTreeNode {
  value?: number;
  children?: GameTreeNode[];
}

function evaluateGameTree(
  node: GameTreeNode,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  stats: { explored: number; pruned: number }
): number {
  stats.explored++;

  if (node.value !== undefined || !node.children || node.children.length === 0) {
    return node.value ?? 0;
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const child of node.children) {
      const evalScore = evaluateGameTree(child, depth + 1, alpha, beta, false, stats);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) {
        stats.pruned++;
        break;
      }
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const child of node.children) {
      const evalScore = evaluateGameTree(child, depth + 1, alpha, beta, true, stats);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) {
        stats.pruned++;
        break;
      }
    }
    return minEval;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const alphabetaTool: UnifiedTool = {
  name: 'alpha_beta',
  description: 'Alpha-beta pruning game tree search for optimal move selection in two-player games',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['search', 'tictactoe', 'connect4', 'evaluate_tree', 'compare', 'info', 'examples'],
        description: 'Operation: search (find best move), tictactoe (play TTT), connect4 (play C4), evaluate_tree (custom tree), compare (with/without pruning)'
      },
      game: {
        type: 'string',
        enum: ['tictactoe', 'connect4'],
        description: 'Game type for search operation'
      },
      board: {
        type: 'array',
        description: 'Current board state (2D array, 0=empty, 1=player1, -1=player2)'
      },
      depth: {
        type: 'number',
        description: 'Search depth (default: 9 for tictactoe, 6 for connect4)'
      },
      move: {
        type: 'array',
        description: 'Move to make [row, col] for tictactoe or [col] for connect4'
      },
      tree: {
        type: 'object',
        description: 'Custom game tree for evaluation'
      },
      trace: {
        type: 'boolean',
        description: 'Include search trace in output'
      }
    },
    required: ['operation']
  }
};

export async function executealphabeta(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'search':
      case 'tictactoe': {
        const board = args.board || [
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, 0]
        ];

        const game = new TicTacToe(board);
        const depth = args.depth || 9;

        if (game.isGameOver()) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'tictactoe',
              gameOver: true,
              winner: game.checkWinner(),
              board: game.toString()
            }, null, 2)
          };
        }

        const search = new AlphaBetaSearch();
        const result = search.findBestMove(game, {
          maxDepth: depth,
          traceSearch: args.trace
        });

        // Make the best move to show resulting board
        const nextGame = game.clone();
        nextGame.makeMove(result.bestMove[0], result.bestMove[1]);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'tictactoe',
            currentBoard: game.toString(),
            currentPlayer: game.currentPlayer === 1 ? 'X' : 'O',
            bestMove: {
              position: result.bestMove,
              row: result.bestMove[0],
              col: result.bestMove[1]
            },
            evaluation: {
              score: result.bestScore,
              interpretation: result.bestScore > 0 ? 'X winning' :
                            result.bestScore < 0 ? 'O winning' : 'Draw'
            },
            searchStats: {
              nodesExplored: result.nodesExplored,
              nodesPruned: result.nodesPruned,
              searchDepth: result.depth,
              pruningEfficiency: (result.nodesPruned / result.nodesExplored * 100).toFixed(2) + '%'
            },
            resultingBoard: nextGame.toString()
          }, null, 2)
        };
      }

      case 'connect4': {
        const board = args.board || Array(6).fill(null).map(() => Array(7).fill(0));
        const game = new ConnectFour(board);
        const depth = args.depth || 6;

        if (game.isGameOver()) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'connect4',
              gameOver: true,
              winner: game.checkWinner()
            }, null, 2)
          };
        }

        const search = new AlphaBetaSearch();
        const result = search.findBestMove(game, {
          maxDepth: depth,
          traceSearch: args.trace
        });

        // Make the best move
        const nextGame = game.clone();
        nextGame.makeMove(result.bestMove[0]);

        // Board visualization
        const symbols = { '0': '.', '1': 'X', '-1': 'O' };
        const boardViz = game.board.map(row =>
          row.map(cell => symbols[cell.toString() as keyof typeof symbols]).join(' ')
        ).join('\n');

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'connect4',
            currentBoard: boardViz,
            columnNumbers: '0 1 2 3 4 5 6',
            currentPlayer: game.currentPlayer === 1 ? 'X' : 'O',
            bestMove: {
              column: result.bestMove[0]
            },
            evaluation: {
              score: result.bestScore,
              interpretation: result.bestScore > 500 ? 'Player 1 winning' :
                            result.bestScore < -500 ? 'Player 2 winning' : 'Balanced'
            },
            searchStats: {
              nodesExplored: result.nodesExplored,
              nodesPruned: result.nodesPruned,
              searchDepth: result.depth
            }
          }, null, 2)
        };
      }

      case 'evaluate_tree': {
        const tree: GameTreeNode = args.tree || {
          children: [
            {
              children: [
                { value: 3 },
                { value: 5 }
              ]
            },
            {
              children: [
                { value: 6 },
                { value: 9 }
              ]
            },
            {
              children: [
                { value: 1 },
                { value: 2 }
              ]
            }
          ]
        };

        const stats = { explored: 0, pruned: 0 };
        const result = evaluateGameTree(tree, 0, -Infinity, Infinity, true, stats);

        // Also run without pruning for comparison
        const statsNoPruning = { explored: 0, pruned: 0 };
        const countNodes = (node: GameTreeNode): number => {
          statsNoPruning.explored++;
          if (!node.children) return 1;
          return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
        };
        countNodes(tree);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'evaluate_tree',
            result: {
              optimalValue: result,
              nodesExplored: stats.explored,
              nodesPruned: stats.pruned
            },
            comparison: {
              withoutPruning: {
                totalNodes: statsNoPruning.explored
              },
              withPruning: {
                nodesExplored: stats.explored,
                savings: ((1 - stats.explored / statsNoPruning.explored) * 100).toFixed(2) + '%'
              }
            },
            tree: tree
          }, null, 2)
        };
      }

      case 'compare': {
        // Compare minimax with and without alpha-beta pruning
        const board = args.board || [
          [1, 0, -1],
          [0, 0, 0],
          [0, 0, 0]
        ];

        const game = new TicTacToe(board);
        const depth = args.depth || 6;

        // With alpha-beta
        const searchAB = new AlphaBetaSearch();
        const startAB = Date.now();
        const resultAB = searchAB.findBestMove(game, { maxDepth: depth });
        const timeAB = Date.now() - startAB;

        // Simple minimax (no pruning) - simulate by setting high exploration count
        const minimaxNodesEstimate = Math.pow(game.getValidMoves().length, depth);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare',
            board: game.toString(),
            searchDepth: depth,
            alphaBetaPruning: {
              bestMove: resultAB.bestMove,
              bestScore: resultAB.bestScore,
              nodesExplored: resultAB.nodesExplored,
              nodesPruned: resultAB.nodesPruned,
              timeMs: timeAB
            },
            plainMinimax: {
              estimatedNodes: minimaxNodesEstimate,
              note: 'Without pruning, explores all nodes'
            },
            savings: {
              nodeReduction: ((1 - resultAB.nodesExplored / minimaxNodesEstimate) * 100).toFixed(2) + '%',
              explanation: 'Alpha-beta pruning eliminates branches that cannot affect the final decision'
            },
            algorithmComparison: {
              minimax: 'Explores all O(b^d) nodes',
              alphaBeta: 'Best case O(b^(d/2)), worst case O(b^d)',
              whereB: 'branching factor',
              whereD: 'search depth'
            }
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Alpha-Beta Pruning',
            description: 'Optimization of minimax algorithm that eliminates branches that cannot affect the final decision',
            algorithm: {
              minimax: 'Explores entire game tree to find optimal move assuming perfect play',
              alphaBeta: 'Maintains alpha (max\'s best) and beta (min\'s best) bounds to prune',
              pruning: 'If beta <= alpha, remaining branches cannot improve the result'
            },
            terminology: {
              alpha: 'Best value that maximizer can guarantee at current level or above',
              beta: 'Best value that minimizer can guarantee at current level or above',
              cutoff: 'When a branch is pruned because beta <= alpha'
            },
            complexity: {
              minimax: 'O(b^d) where b=branching factor, d=depth',
              alphaBeta: 'Best: O(b^(d/2)), Worst: O(b^d), Depends on move ordering'
            },
            supportedGames: [
              { name: 'Tic-Tac-Toe', branching: '~4', depth: 9, perfectPlay: true },
              { name: 'Connect Four', branching: '~4', depth: 'configurable', heuristic: true }
            ],
            moveOrdering: 'Better move ordering improves pruning efficiency'
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Find best move in Tic-Tac-Toe',
                call: {
                  operation: 'tictactoe',
                  board: [[1, 0, 0], [0, -1, 0], [0, 0, 0]],
                  depth: 9
                }
              },
              {
                name: 'Find best move in Connect Four',
                call: {
                  operation: 'connect4',
                  depth: 6
                }
              },
              {
                name: 'Evaluate custom game tree',
                call: {
                  operation: 'evaluate_tree',
                  tree: {
                    children: [
                      { children: [{ value: 3 }, { value: 5 }] },
                      { children: [{ value: 6 }, { value: 9 }] }
                    ]
                  }
                }
              },
              {
                name: 'Compare with/without pruning',
                call: {
                  operation: 'compare',
                  board: [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
                  depth: 6
                }
              }
            ]
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

export function isalphabetaAvailable(): boolean { return true; }
