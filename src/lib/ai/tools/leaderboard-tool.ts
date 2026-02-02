/**
 * LEADERBOARD TOOL
 * Score tracking, rankings, and competitive statistics
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface LeaderboardEntry { rank: number; playerId: string; playerName: string; score: number; timestamp: number; metadata?: Record<string, unknown>; }
interface Leaderboard { id: string; name: string; type: 'global' | 'daily' | 'weekly' | 'monthly' | 'alltime'; entries: LeaderboardEntry[]; maxEntries: number; }
interface PlayerStats { playerId: string; totalGames: number; wins: number; losses: number; highScore: number; averageScore: number; rank: number; }

function createLeaderboard(name: string, type: Leaderboard['type'] = 'global', maxEntries: number = 100): Leaderboard {
  return { id: `lb_${Date.now()}`, name, type, entries: [], maxEntries };
}

function addScore(leaderboard: Leaderboard, playerId: string, playerName: string, score: number, metadata?: Record<string, unknown>): { added: boolean; rank: number; isHighScore: boolean } {
  const existingIndex = leaderboard.entries.findIndex(e => e.playerId === playerId);
  const isHighScore = existingIndex === -1 || leaderboard.entries[existingIndex].score < score;

  if (existingIndex !== -1 && !isHighScore) {
    return { added: false, rank: existingIndex + 1, isHighScore: false };
  }

  if (existingIndex !== -1) {
    leaderboard.entries.splice(existingIndex, 1);
  }

  const newEntry: LeaderboardEntry = { rank: 0, playerId, playerName, score, timestamp: Date.now(), metadata };
  leaderboard.entries.push(newEntry);
  leaderboard.entries.sort((a, b) => b.score - a.score);

  if (leaderboard.entries.length > leaderboard.maxEntries) {
    leaderboard.entries = leaderboard.entries.slice(0, leaderboard.maxEntries);
  }

  leaderboard.entries.forEach((e, i) => e.rank = i + 1);

  const finalRank = leaderboard.entries.findIndex(e => e.playerId === playerId) + 1;
  return { added: finalRank > 0, rank: finalRank, isHighScore };
}

function getTopN(leaderboard: Leaderboard, n: number = 10): LeaderboardEntry[] {
  return leaderboard.entries.slice(0, n);
}

function getPlayerRank(leaderboard: Leaderboard, playerId: string): LeaderboardEntry | null {
  return leaderboard.entries.find(e => e.playerId === playerId) || null;
}

function getAroundPlayer(leaderboard: Leaderboard, playerId: string, range: number = 2): LeaderboardEntry[] {
  const index = leaderboard.entries.findIndex(e => e.playerId === playerId);
  if (index === -1) return [];

  const start = Math.max(0, index - range);
  const end = Math.min(leaderboard.entries.length, index + range + 1);
  return leaderboard.entries.slice(start, end);
}

function createSampleLeaderboard(): Leaderboard {
  const lb = createLeaderboard('High Scores', 'global', 100);
  const names = ['DragonSlayer', 'NightHawk', 'StarKnight', 'ShadowBlade', 'ThunderFist', 'IronWill', 'SwiftArrow', 'MysticMage', 'BraveHeart', 'SilentStorm', 'GoldenEagle', 'DarkPhoenix', 'BlazeFury', 'IceQueen', 'StormRider'];

  for (let i = 0; i < 50; i++) {
    const name = names[i % names.length] + (i >= names.length ? `_${Math.floor(i / names.length)}` : '');
    const score = Math.floor(10000 + Math.random() * 90000);
    addScore(lb, `player_${i}`, name, score, { level: Math.floor(score / 1000), time: Math.floor(Math.random() * 3600) });
  }

  return lb;
}

function leaderboardToAscii(entries: LeaderboardEntry[]): string {
  const lines: string[] = [];
  lines.push('╔════╤════════════════╤══════════╤═══════════╗');
  lines.push('║Rank│     Player     │  Score   │   Time    ║');
  lines.push('╠════╪════════════════╪══════════╪═══════════╣');

  for (const entry of entries) {
    const rank = entry.rank.toString().padStart(3);
    const name = entry.playerName.slice(0, 14).padEnd(14);
    const score = entry.score.toLocaleString().padStart(8);
    const time = new Date(entry.timestamp).toLocaleDateString().padStart(9);
    lines.push(`║${rank} │ ${name} │ ${score} │ ${time} ║`);
  }

  lines.push('╚════╧════════════════╧══════════╧═══════════╝');
  return lines.join('\n');
}

function calculatePlayerStats(leaderboard: Leaderboard, playerId: string, games: number[] = []): PlayerStats {
  const entry = leaderboard.entries.find(e => e.playerId === playerId);
  const scores = games.length > 0 ? games : [entry?.score || 0];

  return {
    playerId,
    totalGames: scores.length,
    wins: Math.floor(scores.length * 0.6),
    losses: Math.floor(scores.length * 0.4),
    highScore: Math.max(...scores),
    averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    rank: entry?.rank || 0
  };
}

function getPercentile(leaderboard: Leaderboard, playerId: string): number {
  const index = leaderboard.entries.findIndex(e => e.playerId === playerId);
  if (index === -1) return 0;
  return ((leaderboard.entries.length - index) / leaderboard.entries.length) * 100;
}

export const leaderboardTool: UnifiedTool = {
  name: 'leaderboard',
  description: 'Leaderboard: top_scores, add_score, player_rank, around_player, stats, percentile',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['top_scores', 'add_score', 'player_rank', 'around_player', 'stats', 'percentile', 'create', 'ascii', 'info'] },
      playerId: { type: 'string' },
      playerName: { type: 'string' },
      score: { type: 'number' },
      count: { type: 'number' },
      range: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeLeaderboard(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    const leaderboard = createSampleLeaderboard();

    switch (args.operation) {
      case 'top_scores':
        const top = getTopN(leaderboard, args.count || 10);
        result = { leaderboard: leaderboard.name, type: leaderboard.type, entries: top };
        break;
      case 'add_score':
        const addResult = addScore(
          leaderboard,
          args.playerId || 'new_player',
          args.playerName || 'NewPlayer',
          args.score || 50000
        );
        result = { ...addResult, totalEntries: leaderboard.entries.length };
        break;
      case 'player_rank':
        const playerEntry = getPlayerRank(leaderboard, args.playerId || 'player_0');
        result = playerEntry ? { entry: playerEntry, totalPlayers: leaderboard.entries.length } : { error: 'Player not found' };
        break;
      case 'around_player':
        const nearby = getAroundPlayer(leaderboard, args.playerId || 'player_25', args.range || 2);
        result = { playerId: args.playerId || 'player_25', nearbyEntries: nearby };
        break;
      case 'stats':
        const stats = calculatePlayerStats(leaderboard, args.playerId || 'player_0', [45000, 52000, 38000, 61000, 47000]);
        result = { stats };
        break;
      case 'percentile':
        const pct = getPercentile(leaderboard, args.playerId || 'player_10');
        result = { playerId: args.playerId || 'player_10', percentile: pct.toFixed(1) + '%', topPercent: (100 - pct).toFixed(1) + '%' };
        break;
      case 'create':
        const newLb = createLeaderboard(args.name || 'Custom Leaderboard', args.type || 'global');
        result = { leaderboard: { id: newLb.id, name: newLb.name, type: newLb.type, maxEntries: newLb.maxEntries } };
        break;
      case 'ascii':
        const asciiTop = getTopN(leaderboard, args.count || 10);
        result = { display: leaderboardToAscii(asciiTop) };
        break;
      case 'info':
        result = {
          description: 'Leaderboard and ranking system',
          types: ['global', 'daily', 'weekly', 'monthly', 'alltime'],
          features: ['Automatic ranking', 'Personal best tracking', 'Percentile calculation', 'Nearby players view'],
          maxEntries: 100
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

export function isLeaderboardAvailable(): boolean { return true; }
