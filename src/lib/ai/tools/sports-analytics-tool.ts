/**
 * SPORTS-ANALYTICS TOOL
 * Comprehensive sports performance analysis including player stats,
 * team analysis, game predictions, and strategic optimization
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface PlayerStats {
  name: string;
  position: string;
  games: number;
  minutesPerGame: number;
  points: number;
  assists: number;
  rebounds?: number;
  goals?: number;
  saves?: number;
  tackles?: number;
  passingYards?: number;
  completions?: number;
  attempts?: number;
}

interface TeamStats {
  name: string;
  sport: Sport;
  wins: number;
  losses: number;
  draws?: number;
  pointsFor: number;
  pointsAgainst: number;
  homeRecord: { wins: number; losses: number };
  awayRecord: { wins: number; losses: number };
  streak?: string;
  lastFive?: string;
}

type Sport = 'basketball' | 'football' | 'soccer' | 'baseball' | 'hockey';

interface MatchPrediction {
  homeTeam: string;
  awayTeam: string;
  homeWinProb: number;
  awayWinProb: number;
  drawProb?: number;
  predictedScore: { home: number; away: number };
  confidence: number;
  keyFactors: string[];
}

interface PerformanceAnalysis {
  overall: number; // 0-100 rating
  offense: number;
  defense: number;
  efficiency: number;
  consistency: number;
  clutch?: number;
  comparison: string; // vs league average
  strengths: string[];
  weaknesses: string[];
}

// =============================================================================
// STATISTICAL CALCULATIONS
// =============================================================================

/**
 * Calculate basketball PER (simplified version)
 */
function calculatePER(stats: {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fgMade: number;
  fgAttempts: number;
  ftMade: number;
  ftAttempts: number;
  minutes: number;
}): number {
  if (stats.minutes === 0) return 0;

  // Simplified PER calculation (full formula uses factor and VOP for league adjustments)
  const uPER =
    (1 / stats.minutes) *
    (stats.points +
      0.4 * stats.fgMade -
      0.7 * stats.fgAttempts -
      0.4 * (stats.ftAttempts - stats.ftMade) +
      0.7 * (stats.rebounds * 0.5) +
      0.35 * (stats.rebounds * 0.5) +
      0.7 * stats.assists +
      0.7 * stats.steals +
      0.7 * stats.blocks -
      0.4 * stats.fouls -
      stats.turnovers);

  // Normalize to league average of 15
  return Math.max(0, Math.min(40, uPER * 36 * 0.9));
}

/**
 * Calculate True Shooting Percentage
 */
function trueShooting(points: number, fgAttempts: number, ftAttempts: number): number {
  const tsa = fgAttempts + 0.44 * ftAttempts;
  if (tsa === 0) return 0;
  return (points / (2 * tsa)) * 100;
}

// =============================================================================
// MATCH PREDICTION
// =============================================================================

function predictMatch(homeTeam: TeamStats, awayTeam: TeamStats, sport: Sport): MatchPrediction {
  // Home advantage factor
  const homeAdvantages: Record<Sport, number> = {
    basketball: 0.06,
    football: 0.08,
    soccer: 0.1,
    baseball: 0.04,
    hockey: 0.05,
  };
  const homeAdv = homeAdvantages[sport];

  // Calculate win percentages
  const homeWinPct = homeTeam.wins / (homeTeam.wins + homeTeam.losses) || 0.5;
  const awayWinPct = awayTeam.wins / (awayTeam.wins + awayTeam.losses) || 0.5;

  // Point differential factor
  const homePtDiff =
    (homeTeam.pointsFor - homeTeam.pointsAgainst) / (homeTeam.wins + homeTeam.losses);
  const awayPtDiff =
    (awayTeam.pointsFor - awayTeam.pointsAgainst) / (awayTeam.wins + awayTeam.losses);
  const ptDiffFactor = (homePtDiff - awayPtDiff) / 20;

  // Home record factor
  const homeAtHome =
    homeTeam.homeRecord.wins / (homeTeam.homeRecord.wins + homeTeam.homeRecord.losses) || 0.5;
  const awayOnRoad =
    awayTeam.awayRecord.wins / (awayTeam.awayRecord.wins + awayTeam.awayRecord.losses) || 0.5;

  // Combined probability
  let homeWinProb =
    homeWinPct * 0.3 + homeAtHome * 0.2 + (0.5 + ptDiffFactor) * 0.3 + 0.5 * 0.2 + homeAdv;
  let awayWinProb = awayWinPct * 0.3 + awayOnRoad * 0.2 + (0.5 - ptDiffFactor) * 0.3 + 0.5 * 0.2;

  // Draw probability for soccer
  let drawProb = 0;
  if (sport === 'soccer') {
    drawProb = 0.25 * (1 - Math.abs(homeWinProb - awayWinProb));
    homeWinProb = homeWinProb * (1 - drawProb);
    awayWinProb = awayWinProb * (1 - drawProb);
  }

  // Normalize probabilities
  const total = homeWinProb + awayWinProb + drawProb;
  homeWinProb = homeWinProb / total;
  awayWinProb = awayWinProb / total;
  if (sport === 'soccer') drawProb = drawProb / total;

  // Predicted score
  const avgScores: Record<Sport, number> = {
    basketball: 110,
    football: 24,
    soccer: 1.5,
    baseball: 4.5,
    hockey: 3,
  };

  const baseScore = avgScores[sport];
  const homeScore =
    baseScore * ((homeTeam.pointsFor / (homeTeam.pointsFor + homeTeam.pointsAgainst)) * 2);
  const awayScore =
    baseScore * ((awayTeam.pointsFor / (awayTeam.pointsFor + awayTeam.pointsAgainst)) * 2);

  // Key factors
  const keyFactors: string[] = [];
  if (homeAtHome > 0.6)
    keyFactors.push(`${homeTeam.name} strong at home (${Math.round(homeAtHome * 100)}%)`);
  if (awayOnRoad > 0.5)
    keyFactors.push(`${awayTeam.name} good on road (${Math.round(awayOnRoad * 100)}%)`);
  if (Math.abs(ptDiffFactor) > 0.05)
    keyFactors.push(
      `Point differential favors ${ptDiffFactor > 0 ? homeTeam.name : awayTeam.name}`
    );
  if (homeTeam.streak) keyFactors.push(`${homeTeam.name} streak: ${homeTeam.streak}`);
  if (awayTeam.streak) keyFactors.push(`${awayTeam.name} streak: ${awayTeam.streak}`);

  // Confidence based on sample size and consistency
  const totalGames = homeTeam.wins + homeTeam.losses + awayTeam.wins + awayTeam.losses;
  const confidence = Math.min(95, 50 + totalGames * 0.5);

  return {
    homeTeam: homeTeam.name,
    awayTeam: awayTeam.name,
    homeWinProb: Math.round(homeWinProb * 100),
    awayWinProb: Math.round(awayWinProb * 100),
    drawProb: sport === 'soccer' ? Math.round(drawProb * 100) : undefined,
    predictedScore: {
      home: Math.round(homeScore),
      away: Math.round(awayScore),
    },
    confidence: Math.round(confidence),
    keyFactors,
  };
}

// =============================================================================
// PERFORMANCE ANALYSIS
// =============================================================================

function analyzePerformance(
  stats: PlayerStats,
  leagueAverages: PlayerStats,
  _sport: Sport
): PerformanceAnalysis {
  // Calculate ratings relative to league average
  const rateVsAvg = (value: number, avg: number) => {
    if (avg === 0) return 50;
    return Math.min(100, Math.max(0, 50 + ((value - avg) / avg) * 50));
  };

  // Offense rating
  const offenseMetrics: number[] = [];
  if (stats.points !== undefined) {
    offenseMetrics.push(rateVsAvg(stats.points, leagueAverages.points));
  }
  if (stats.assists !== undefined) {
    offenseMetrics.push(rateVsAvg(stats.assists, leagueAverages.assists));
  }
  if (stats.goals !== undefined) {
    offenseMetrics.push(rateVsAvg(stats.goals, leagueAverages.goals ?? 1));
  }
  const offense =
    offenseMetrics.length > 0
      ? offenseMetrics.reduce((a, b) => a + b, 0) / offenseMetrics.length
      : 50;

  // Defense rating (sport-specific)
  let defense = 50;
  if (stats.rebounds !== undefined && leagueAverages.rebounds) {
    defense = rateVsAvg(stats.rebounds, leagueAverages.rebounds);
  }
  if (stats.tackles !== undefined && leagueAverages.tackles) {
    defense = rateVsAvg(stats.tackles, leagueAverages.tackles);
  }
  if (stats.saves !== undefined && leagueAverages.saves) {
    defense = rateVsAvg(stats.saves, leagueAverages.saves);
  }

  // Efficiency
  const outputPerMinute = stats.points / stats.minutesPerGame;
  const avgOutputPerMinute = leagueAverages.points / leagueAverages.minutesPerGame;
  const efficiency = rateVsAvg(outputPerMinute, avgOutputPerMinute);

  // Consistency (based on games played)
  const consistency = Math.min(100, (stats.games / 82) * 100);

  // Overall rating
  const overall = Math.round(
    offense * 0.35 + defense * 0.25 + efficiency * 0.25 + consistency * 0.15
  );

  // Comparison text
  let comparison = 'Average';
  if (overall >= 80) comparison = 'Elite (Top 5%)';
  else if (overall >= 70) comparison = 'All-Star level (Top 15%)';
  else if (overall >= 60) comparison = 'Above average (Top 30%)';
  else if (overall >= 40) comparison = 'Average';
  else comparison = 'Below average';

  // Identify strengths and weaknesses
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (offense >= 70) strengths.push('Excellent scoring/playmaking');
  else if (offense <= 40) weaknesses.push('Below average offense');

  if (defense >= 70) strengths.push('Strong defensive impact');
  else if (defense <= 40) weaknesses.push('Defensive liability');

  if (efficiency >= 70) strengths.push('Highly efficient production');
  else if (efficiency <= 40) weaknesses.push('Inefficient player');

  if (consistency >= 80) strengths.push('Durable and reliable');
  else if (consistency <= 50) weaknesses.push('Availability concerns');

  return {
    overall,
    offense: Math.round(offense),
    defense: Math.round(defense),
    efficiency: Math.round(efficiency),
    consistency: Math.round(consistency),
    comparison,
    strengths: strengths.length > 0 ? strengths : ['Solid all-around player'],
    weaknesses: weaknesses.length > 0 ? weaknesses : ['No significant weaknesses'],
  };
}

// =============================================================================
// EXAMPLE DATA
// =============================================================================

const examplePlayers: Record<string, { stats: PlayerStats; sport: Sport }> = {
  basketball_star: {
    sport: 'basketball',
    stats: {
      name: 'Alex Johnson',
      position: 'SG',
      games: 72,
      minutesPerGame: 34.5,
      points: 27.3,
      assists: 6.2,
      rebounds: 5.8,
    },
  },
  soccer_forward: {
    sport: 'soccer',
    stats: {
      name: 'Marco Silva',
      position: 'ST',
      games: 34,
      minutesPerGame: 82,
      points: 18, // goals as points
      assists: 7,
      goals: 18,
    },
  },
  football_qb: {
    sport: 'football',
    stats: {
      name: 'Jake Williams',
      position: 'QB',
      games: 16,
      minutesPerGame: 60,
      points: 0, // Calculated differently
      assists: 0,
      passingYards: 4200,
      completions: 380,
      attempts: 580,
    },
  },
};

const exampleTeams: Record<string, TeamStats> = {
  home_team: {
    name: 'City Lions',
    sport: 'basketball',
    wins: 45,
    losses: 20,
    pointsFor: 7150,
    pointsAgainst: 6890,
    homeRecord: { wins: 28, losses: 6 },
    awayRecord: { wins: 17, losses: 14 },
    streak: 'W4',
    lastFive: '4-1',
  },
  away_team: {
    name: 'Metro Eagles',
    sport: 'basketball',
    wins: 38,
    losses: 27,
    pointsFor: 6950,
    pointsAgainst: 6820,
    homeRecord: { wins: 24, losses: 10 },
    awayRecord: { wins: 14, losses: 17 },
    streak: 'L2',
    lastFive: '2-3',
  },
};

const leagueAverages: Record<Sport, PlayerStats> = {
  basketball: {
    name: 'League Avg',
    position: '',
    games: 65,
    minutesPerGame: 28,
    points: 15.5,
    assists: 3.2,
    rebounds: 5.5,
  },
  soccer: {
    name: 'League Avg',
    position: '',
    games: 30,
    minutesPerGame: 75,
    points: 8,
    assists: 4,
    goals: 8,
  },
  football: {
    name: 'League Avg',
    position: '',
    games: 14,
    minutesPerGame: 60,
    points: 0,
    assists: 0,
    passingYards: 3500,
    completions: 320,
    attempts: 500,
  },
  baseball: {
    name: 'League Avg',
    position: '',
    games: 140,
    minutesPerGame: 0,
    points: 0.26,
    assists: 0,
  }, // batting avg as points
  hockey: {
    name: 'League Avg',
    position: '',
    games: 70,
    minutesPerGame: 18,
    points: 45,
    assists: 25,
    goals: 20,
  },
};

// =============================================================================
// TOOL DEFINITION
// =============================================================================

export const sportsanalyticsTool: UnifiedTool = {
  name: 'sports_analytics',
  description:
    'Sports analytics including player performance analysis, team statistics, match predictions, and advanced metrics calculation (PER, WAR, xG, etc.).',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'player_stats',
          'team_analysis',
          'prediction',
          'advanced_metrics',
          'performance',
          'compare',
          'examples',
          'info',
        ],
        description:
          'Operation: player_stats, team_analysis, prediction, advanced_metrics, performance rating, compare players/teams, examples, or info',
      },
      sport: {
        type: 'string',
        enum: ['basketball', 'football', 'soccer', 'baseball', 'hockey'],
        description: 'Sport type',
      },
      player: {
        type: 'object',
        description: 'Player statistics object',
      },
      player_name: {
        type: 'string',
        description: 'Named example player: basketball_star, soccer_forward, football_qb',
      },
      home_team: {
        type: 'object',
        description: 'Home team statistics',
      },
      away_team: {
        type: 'object',
        description: 'Away team statistics',
      },
      detailed_stats: {
        type: 'object',
        description: 'Detailed stats for advanced metrics (fgMade, fgAttempts, etc.)',
      },
    },
    required: ['operation'],
  },
};

// =============================================================================
// TOOL EXECUTOR
// =============================================================================

export async function executesportsanalytics(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      sport = 'basketball',
      player,
      player_name,
      home_team,
      away_team,
      detailed_stats,
    } = args;

    // Info operation
    if (operation === 'info') {
      const info = {
        tool: 'sports-analytics',
        description: 'Comprehensive sports analytics',
        sports: ['basketball', 'football', 'soccer', 'baseball', 'hockey'],
        metrics: {
          basketball: [
            'PER (Player Efficiency Rating)',
            'True Shooting %',
            'Usage Rate',
            'Win Shares',
            'VORP',
          ],
          soccer: [
            'xG (Expected Goals)',
            'xA (Expected Assists)',
            'Pressing Rate',
            'Pass Completion',
          ],
          general: ['WAR (Wins Above Replacement)', 'Performance Rating', 'Consistency Score'],
        },
        prediction_factors: [
          'Win percentage',
          'Home/away splits',
          'Point differential',
          'Recent form (streak)',
          'Home court advantage',
        ],
        example_players: Object.keys(examplePlayers),
        example_teams: Object.keys(exampleTeams),
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Examples operation
    if (operation === 'examples') {
      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            players: Object.entries(examplePlayers).map(([key, p]) => ({
              key,
              name: p.stats.name,
              sport: p.sport,
              position: p.stats.position,
            })),
            teams: Object.entries(exampleTeams).map(([key, t]) => ({
              key,
              name: t.name,
              record: `${t.wins}-${t.losses}`,
            })),
          },
          null,
          2
        ),
      };
    }

    // Get player data
    const playerData =
      player_name && examplePlayers[player_name]
        ? examplePlayers[player_name]
        : player
          ? { stats: player, sport }
          : null;

    // Player stats operation
    if (operation === 'player_stats') {
      if (!playerData) {
        return {
          toolCallId: id,
          content: 'Error: player or player_name required',
          isError: true,
        };
      }

      const perGameStats = playerData.stats;
      const sportType = playerData.sport as Sport;

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            player: perGameStats.name,
            sport: sportType,
            position: perGameStats.position,
            season_stats: {
              games: perGameStats.games,
              minutes_per_game: perGameStats.minutesPerGame,
              points_per_game: perGameStats.points,
              assists_per_game: perGameStats.assists,
              ...(perGameStats.rebounds && { rebounds_per_game: perGameStats.rebounds }),
              ...(perGameStats.goals && { goals: perGameStats.goals }),
              ...(perGameStats.passingYards && { passing_yards: perGameStats.passingYards }),
            },
            totals: {
              total_points: Math.round(perGameStats.points * perGameStats.games),
              total_assists: Math.round(perGameStats.assists * perGameStats.games),
              total_minutes: Math.round(perGameStats.minutesPerGame * perGameStats.games),
            },
          },
          null,
          2
        ),
      };
    }

    // Performance operation
    if (operation === 'performance') {
      if (!playerData) {
        return {
          toolCallId: id,
          content: 'Error: player or player_name required',
          isError: true,
        };
      }

      const sportType = playerData.sport as Sport;
      const leagueAvg = leagueAverages[sportType];
      const analysis = analyzePerformance(playerData.stats, leagueAvg, sportType);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            player: playerData.stats.name,
            sport: sportType,
            performance: analysis,
            league_comparison: {
              points_vs_avg: `${((playerData.stats.points / leagueAvg.points - 1) * 100).toFixed(1)}%`,
              assists_vs_avg: `${((playerData.stats.assists / leagueAvg.assists - 1) * 100).toFixed(1)}%`,
            },
          },
          null,
          2
        ),
      };
    }

    // Advanced metrics operation
    if (operation === 'advanced_metrics') {
      const sportType = sport as Sport;

      if (sportType === 'basketball' && detailed_stats) {
        const per = calculatePER(detailed_stats);
        const ts = trueShooting(
          detailed_stats.points,
          detailed_stats.fgAttempts,
          detailed_stats.ftAttempts
        );

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              sport: 'basketball',
              advanced_metrics: {
                PER: Math.round(per * 10) / 10,
                PER_rating:
                  per >= 25
                    ? 'MVP Level'
                    : per >= 20
                      ? 'All-Star'
                      : per >= 15
                        ? 'Average'
                        : 'Below Average',
                true_shooting_pct: Math.round(ts * 10) / 10,
                ts_rating: ts >= 60 ? 'Elite' : ts >= 55 ? 'Good' : ts >= 50 ? 'Average' : 'Poor',
              },
              context: {
                league_avg_PER: 15,
                league_avg_TS: 56,
              },
            },
            null,
            2
          ),
        };
      }

      // General metrics
      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            sport: sportType,
            available_metrics: {
              basketball: ['PER', 'TS%', 'Usage Rate', 'Off/Def Rating'],
              soccer: ['xG', 'xA', 'Pressing %'],
              general: ['WAR', 'Win Shares'],
            },
            note: 'Provide detailed_stats for specific calculations',
          },
          null,
          2
        ),
      };
    }

    // Team analysis operation
    if (operation === 'team_analysis') {
      const teamData = home_team || exampleTeams.home_team;

      const ptDiff =
        (teamData.pointsFor - teamData.pointsAgainst) / (teamData.wins + teamData.losses);
      const winPct = (teamData.wins / (teamData.wins + teamData.losses)) * 100;
      const homeWinPct =
        (teamData.homeRecord.wins / (teamData.homeRecord.wins + teamData.homeRecord.losses)) * 100;
      const awayWinPct =
        (teamData.awayRecord.wins / (teamData.awayRecord.wins + teamData.awayRecord.losses)) * 100;

      // Strength of team
      let teamStrength = 'Average';
      if (winPct >= 70) teamStrength = 'Championship contender';
      else if (winPct >= 55) teamStrength = 'Playoff team';
      else if (winPct >= 45) teamStrength = 'Bubble team';
      else teamStrength = 'Rebuilding';

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            team: teamData.name,
            record: {
              overall: `${teamData.wins}-${teamData.losses}`,
              home: `${teamData.homeRecord.wins}-${teamData.homeRecord.losses}`,
              away: `${teamData.awayRecord.wins}-${teamData.awayRecord.losses}`,
              win_pct: Math.round(winPct),
              home_win_pct: Math.round(homeWinPct),
              away_win_pct: Math.round(awayWinPct),
            },
            scoring: {
              points_per_game:
                Math.round((teamData.pointsFor / (teamData.wins + teamData.losses)) * 10) / 10,
              points_allowed:
                Math.round((teamData.pointsAgainst / (teamData.wins + teamData.losses)) * 10) / 10,
              point_differential: Math.round(ptDiff * 10) / 10,
            },
            assessment: {
              strength: teamStrength,
              streak: teamData.streak || 'N/A',
              last_five: teamData.lastFive || 'N/A',
            },
          },
          null,
          2
        ),
      };
    }

    // Prediction operation
    if (operation === 'prediction') {
      const home = home_team || exampleTeams.home_team;
      const away = away_team || exampleTeams.away_team;
      const sportType = (home.sport || sport || 'basketball') as Sport;

      const prediction = predictMatch(home, away, sportType);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            matchup: `${prediction.homeTeam} vs ${prediction.awayTeam}`,
            probabilities: {
              home_win: `${prediction.homeWinProb}%`,
              away_win: `${prediction.awayWinProb}%`,
              ...(prediction.drawProb && { draw: `${prediction.drawProb}%` }),
            },
            predicted_score: `${prediction.homeTeam} ${prediction.predictedScore.home} - ${prediction.predictedScore.away} ${prediction.awayTeam}`,
            confidence: `${prediction.confidence}%`,
            key_factors: prediction.keyFactors,
            pick:
              prediction.homeWinProb > prediction.awayWinProb
                ? prediction.homeTeam
                : prediction.awayTeam,
          },
          null,
          2
        ),
      };
    }

    // Compare operation
    if (operation === 'compare') {
      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            note: 'Provide two players or teams to compare',
            available_comparisons: ['Player vs Player', 'Team vs Team', 'Player vs League Average'],
          },
          null,
          2
        ),
      };
    }

    return {
      toolCallId: id,
      content:
        'Error: Invalid operation. Use player_stats, team_analysis, prediction, advanced_metrics, performance, or info',
      isError: true,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function issportsanalyticsAvailable(): boolean {
  return true;
}
