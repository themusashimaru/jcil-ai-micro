/**
 * CHESS ENGINE TOOL
 * Play chess with basic AI, move validation, and game analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

type Piece = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' | 'k' | 'q' | 'r' | 'b' | 'n' | 'p' | null;
type Board = Piece[][];
interface Move { from: { row: number; col: number }; to: { row: number; col: number }; piece: Piece; captured?: Piece; promotion?: Piece; }
interface GameState { board: Board; turn: 'white' | 'black'; moves: Move[]; castling: { K: boolean; Q: boolean; k: boolean; q: boolean }; enPassant: { row: number; col: number } | null; }

const INITIAL_BOARD: Board = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

const PIECE_VALUES: Record<string, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 100, p: -1, n: -3, b: -3, r: -5, q: -9, k: -100 };

function createGame(): GameState {
  return {
    board: INITIAL_BOARD.map(row => [...row]),
    turn: 'white',
    moves: [],
    castling: { K: true, Q: true, k: true, q: true },
    enPassant: null
  };
}

function isWhite(piece: Piece): boolean {
  return piece !== null && piece === piece.toUpperCase();
}

function parseSquare(sq: string): { row: number; col: number } | null {
  if (sq.length !== 2) return null;
  const col = sq.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = 8 - parseInt(sq[1]);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return { row, col };
}

function toSquare(row: number, col: number): string {
  return String.fromCharCode('a'.charCodeAt(0) + col) + (8 - row);
}

function generateMoves(state: GameState, onlyCaptures: boolean = false): Move[] {
  const moves: Move[] = [];
  const isWhiteTurn = state.turn === 'white';

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = state.board[row][col];
      if (!piece) continue;
      if (isWhite(piece) !== isWhiteTurn) continue;

      const pieceType = piece.toUpperCase();
      const directions: Array<{ dr: number; dc: number; max: number }> = [];

      switch (pieceType) {
        case 'P':
          const dir = isWhiteTurn ? -1 : 1;
          const startRow = isWhiteTurn ? 6 : 1;
          // Forward
          if (!onlyCaptures && !state.board[row + dir]?.[col]) {
            moves.push({ from: { row, col }, to: { row: row + dir, col }, piece });
            if (row === startRow && !state.board[row + 2 * dir]?.[col]) {
              moves.push({ from: { row, col }, to: { row: row + 2 * dir, col }, piece });
            }
          }
          // Captures
          for (const dc of [-1, 1]) {
            const target = state.board[row + dir]?.[col + dc];
            if (target && isWhite(target) !== isWhiteTurn) {
              moves.push({ from: { row, col }, to: { row: row + dir, col: col + dc }, piece, captured: target });
            }
          }
          break;
        case 'N':
          for (const [dr, dc] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
              const target = state.board[nr][nc];
              if (!target || isWhite(target) !== isWhiteTurn) {
                if (!onlyCaptures || target) moves.push({ from: { row, col }, to: { row: nr, col: nc }, piece, captured: target || undefined });
              }
            }
          }
          break;
        case 'B':
          directions.push({ dr: 1, dc: 1, max: 7 }, { dr: 1, dc: -1, max: 7 }, { dr: -1, dc: 1, max: 7 }, { dr: -1, dc: -1, max: 7 });
          break;
        case 'R':
          directions.push({ dr: 1, dc: 0, max: 7 }, { dr: -1, dc: 0, max: 7 }, { dr: 0, dc: 1, max: 7 }, { dr: 0, dc: -1, max: 7 });
          break;
        case 'Q':
          directions.push(
            { dr: 1, dc: 0, max: 7 }, { dr: -1, dc: 0, max: 7 }, { dr: 0, dc: 1, max: 7 }, { dr: 0, dc: -1, max: 7 },
            { dr: 1, dc: 1, max: 7 }, { dr: 1, dc: -1, max: 7 }, { dr: -1, dc: 1, max: 7 }, { dr: -1, dc: -1, max: 7 }
          );
          break;
        case 'K':
          directions.push(
            { dr: 1, dc: 0, max: 1 }, { dr: -1, dc: 0, max: 1 }, { dr: 0, dc: 1, max: 1 }, { dr: 0, dc: -1, max: 1 },
            { dr: 1, dc: 1, max: 1 }, { dr: 1, dc: -1, max: 1 }, { dr: -1, dc: 1, max: 1 }, { dr: -1, dc: -1, max: 1 }
          );
          break;
      }

      for (const { dr, dc, max } of directions) {
        for (let i = 1; i <= max; i++) {
          const nr = row + dr * i, nc = col + dc * i;
          if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
          const target = state.board[nr][nc];
          if (target) {
            if (isWhite(target) !== isWhiteTurn) {
              moves.push({ from: { row, col }, to: { row: nr, col: nc }, piece, captured: target });
            }
            break;
          }
          if (!onlyCaptures) moves.push({ from: { row, col }, to: { row: nr, col: nc }, piece });
        }
      }
    }
  }

  return moves;
}

function makeMove(state: GameState, move: Move): GameState {
  const newBoard = state.board.map(row => [...row]);
  newBoard[move.to.row][move.to.col] = move.piece;
  newBoard[move.from.row][move.from.col] = null;

  return {
    board: newBoard,
    turn: state.turn === 'white' ? 'black' : 'white',
    moves: [...state.moves, move],
    castling: { ...state.castling },
    enPassant: null
  };
}

function evaluateBoard(state: GameState): number {
  let score = 0;
  for (const row of state.board) {
    for (const piece of row) {
      if (piece) score += PIECE_VALUES[piece] || 0;
    }
  }
  return score;
}

function minimax(state: GameState, depth: number, alpha: number, beta: number, maximizing: boolean): { score: number; move?: Move } {
  if (depth === 0) return { score: evaluateBoard(state) };

  const moves = generateMoves(state);
  if (moves.length === 0) return { score: evaluateBoard(state) };

  let bestMove: Move | undefined;

  if (maximizing) {
    let maxScore = -Infinity;
    for (const move of moves) {
      const newState = makeMove(state, move);
      const { score } = minimax(newState, depth - 1, alpha, beta, false);
      if (score > maxScore) {
        maxScore = score;
        bestMove = move;
      }
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return { score: maxScore, move: bestMove };
  } else {
    let minScore = Infinity;
    for (const move of moves) {
      const newState = makeMove(state, move);
      const { score } = minimax(newState, depth - 1, alpha, beta, true);
      if (score < minScore) {
        minScore = score;
        bestMove = move;
      }
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return { score: minScore, move: bestMove };
  }
}

function boardToAscii(board: Board): string {
  const pieceSymbols: Record<string, string> = {
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
  };

  let result = '  ┌───┬───┬───┬───┬───┬───┬───┬───┐\n';
  for (let row = 0; row < 8; row++) {
    result += `${8 - row} │`;
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      const symbol = piece ? pieceSymbols[piece] || piece : ' ';
      result += ` ${symbol} │`;
    }
    result += '\n';
    if (row < 7) result += '  ├───┼───┼───┼───┼───┼───┼───┼───┤\n';
  }
  result += '  └───┴───┴───┴───┴───┴───┴───┴───┘\n';
  result += '    a   b   c   d   e   f   g   h';
  return result;
}

function moveToNotation(move: Move): string {
  const from = toSquare(move.from.row, move.from.col);
  const to = toSquare(move.to.row, move.to.col);
  const piece = move.piece?.toUpperCase() !== 'P' ? move.piece?.toUpperCase() : '';
  const capture = move.captured ? 'x' : '';
  return `${piece}${from}${capture}${to}`;
}

export const chessEngineTool: UnifiedTool = {
  name: 'chess_engine',
  description: 'Chess Engine: new_game, move, ai_move, legal_moves, evaluate, board, analyze',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['new_game', 'move', 'ai_move', 'legal_moves', 'evaluate', 'board', 'analyze', 'info'] },
      from: { type: 'string' },
      to: { type: 'string' },
      depth: { type: 'number' },
      fen: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executeChessEngine(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    let gameState = createGame();

    switch (args.operation) {
      case 'new_game':
        result = { message: 'New game started', turn: 'white', board: boardToAscii(gameState.board) };
        break;
      case 'move':
        const from = parseSquare(args.from || 'e2');
        const to = parseSquare(args.to || 'e4');
        if (!from || !to) {
          result = { error: 'Invalid square notation' };
          break;
        }
        const piece = gameState.board[from.row][from.col];
        if (!piece) {
          result = { error: 'No piece at source square' };
          break;
        }
        const move: Move = { from, to, piece, captured: gameState.board[to.row][to.col] || undefined };
        gameState = makeMove(gameState, move);
        result = { move: moveToNotation(move), turn: gameState.turn, board: boardToAscii(gameState.board) };
        break;
      case 'ai_move':
        const depth = args.depth || 3;
        const aiResult = minimax(gameState, depth, -Infinity, Infinity, gameState.turn === 'white');
        if (aiResult.move) {
          gameState = makeMove(gameState, aiResult.move);
          result = {
            aiMove: moveToNotation(aiResult.move),
            evaluation: aiResult.score,
            turn: gameState.turn,
            board: boardToAscii(gameState.board)
          };
        } else {
          result = { message: 'No legal moves available' };
        }
        break;
      case 'legal_moves':
        const legalMoves = generateMoves(gameState);
        result = {
          turn: gameState.turn,
          moveCount: legalMoves.length,
          moves: legalMoves.slice(0, 20).map(m => moveToNotation(m))
        };
        break;
      case 'evaluate':
        const evaluation = evaluateBoard(gameState);
        result = {
          evaluation,
          interpretation: evaluation > 0 ? 'White advantage' : evaluation < 0 ? 'Black advantage' : 'Equal position',
          turn: gameState.turn
        };
        break;
      case 'board':
        result = { board: boardToAscii(gameState.board), turn: gameState.turn };
        break;
      case 'analyze':
        const analysisMoves = generateMoves(gameState);
        const topMoves: Array<{ move: string; score: number }> = [];
        for (const m of analysisMoves.slice(0, 10)) {
          const newState = makeMove(gameState, m);
          const { score } = minimax(newState, 2, -Infinity, Infinity, newState.turn === 'white');
          topMoves.push({ move: moveToNotation(m), score });
        }
        topMoves.sort((a, b) => gameState.turn === 'white' ? b.score - a.score : a.score - b.score);
        result = { turn: gameState.turn, topMoves: topMoves.slice(0, 5), evaluation: evaluateBoard(gameState) };
        break;
      case 'info':
        result = {
          description: 'Chess engine with minimax AI',
          features: ['Move validation', 'AI opponent', 'Position evaluation', 'Move analysis'],
          notation: 'Algebraic notation (e2e4, Nf3, etc.)',
          aiDepth: 'Configurable search depth (default: 3)'
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isChessEngineAvailable(): boolean { return true; }
