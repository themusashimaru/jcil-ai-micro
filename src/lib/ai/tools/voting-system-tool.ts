/**
 * VOTING-SYSTEM TOOL
 * Electoral and voting system analysis
 *
 * Implements various voting methods with winner determination, strategic analysis,
 * and detection of voting paradoxes.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface Ballot {
  voter: string;
  ranking: string[]; // Ordered list of candidates (first = most preferred)
  approvals?: string[]; // For approval voting
  scores?: Record<string, number>; // For score voting
}

interface Election {
  candidates: string[];
  ballots: Ballot[];
  title?: string;
}

interface ElectionResult {
  method: string;
  winner: string | null;
  ranking: { candidate: string; score: number }[];
  details: Record<string, unknown>;
}

interface PairwiseMatrix {
  candidates: string[];
  matrix: number[][]; // matrix[i][j] = voters preferring candidate i over j
}

interface CondorcetAnalysis {
  condorcetWinner: string | null;
  condorcetLoser: string | null;
  smithSet: string[];
  schwartzSet: string[];
  pairwiseMatrix: PairwiseMatrix;
  beatPath: number[][];
}

interface ParadoxAnalysis {
  arrowParadox: boolean;
  condorcetCycle: boolean;
  alabamaParadox: boolean;
  noShowParadox: boolean;
  spoilerEffect: boolean;
  details: Record<string, unknown>;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createPairwiseMatrix(election: Election): PairwiseMatrix {
  const { candidates, ballots } = election;
  const n = candidates.length;
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (const ballot of ballots) {
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const candI = candidates[i];
        const candJ = candidates[j];

        const rankI = ballot.ranking.indexOf(candI);
        const rankJ = ballot.ranking.indexOf(candJ);

        // Lower rank index = higher preference
        // -1 means not ranked (treat as lowest)
        const prefI = rankI === -1 ? Infinity : rankI;
        const prefJ = rankJ === -1 ? Infinity : rankJ;

        if (prefI < prefJ) {
          matrix[i][j]++;
        } else if (prefJ < prefI) {
          matrix[j][i]++;
        }
        // Tie: no increment
      }
    }
  }

  return { candidates, matrix };
}

function floydWarshall(matrix: number[][], candidates: string[]): number[][] {
  const n = candidates.length;
  const dist: number[][] = matrix.map((row) => [...row]);

  // Initialize paths
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        dist[i][j] = 0;
      } else if (dist[i][j] === 0) {
        dist[i][j] = -Infinity;
      }
    }
  }

  // Beatpath strength: widest path (max-min)
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j && i !== k && j !== k) {
          const through = Math.min(dist[i][k], dist[k][j]);
          if (through > dist[i][j]) {
            dist[i][j] = through;
          }
        }
      }
    }
  }

  return dist;
}

// ============================================================================
// VOTING METHODS
// ============================================================================

// Plurality (First Past the Post)
function plurality(election: Election): ElectionResult {
  const counts: Record<string, number> = {};
  for (const cand of election.candidates) {
    counts[cand] = 0;
  }

  for (const ballot of election.ballots) {
    if (ballot.ranking.length > 0) {
      const firstChoice = ballot.ranking[0];
      if (firstChoice in counts) {
        counts[firstChoice]++;
      }
    }
  }

  const ranking = Object.entries(counts)
    .map(([candidate, score]) => ({ candidate, score }))
    .sort((a, b) => b.score - a.score);

  const winner = ranking.length > 0 ? ranking[0].candidate : null;
  const totalVotes = election.ballots.length;

  return {
    method: 'plurality',
    winner,
    ranking,
    details: {
      totalVotes,
      winnerVotes: counts[winner || ''] || 0,
      winnerPercentage:
        totalVotes > 0 ? (((counts[winner || ''] || 0) / totalVotes) * 100).toFixed(2) + '%' : '0%',
      description: 'Simple plurality: candidate with most first-choice votes wins',
    },
  };
}

// Ranked Choice Voting (Instant Runoff)
function rankedChoice(election: Election): ElectionResult {
  const rounds: { round: number; counts: Record<string, number>; eliminated?: string }[] = [];
  let remaining = [...election.candidates];
  const ballots = election.ballots.map((b) => ({ ...b, ranking: [...b.ranking] }));
  const majority = Math.floor(ballots.length / 2) + 1;

  while (remaining.length > 1) {
    const counts: Record<string, number> = {};
    for (const cand of remaining) {
      counts[cand] = 0;
    }

    // Count first choices among remaining candidates
    for (const ballot of ballots) {
      for (const choice of ballot.ranking) {
        if (remaining.includes(choice)) {
          counts[choice]++;
          break;
        }
      }
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    // Check for majority
    if (sorted[0][1] >= majority) {
      rounds.push({ round: rounds.length + 1, counts });
      break;
    }

    // Eliminate candidate with fewest votes
    const minVotes = sorted[sorted.length - 1][1];
    const toEliminate = sorted.filter(([, v]) => v === minVotes);
    const eliminated = toEliminate[toEliminate.length - 1][0]; // Alphabetically last among ties

    rounds.push({ round: rounds.length + 1, counts, eliminated });
    remaining = remaining.filter((c) => c !== eliminated);
  }

  const winner = remaining.length > 0 ? remaining[0] : null;
  const finalRanking =
    rounds.length > 0
      ? Object.entries(rounds[rounds.length - 1].counts)
          .filter(([c]) => remaining.includes(c))
          .map(([candidate, score]) => ({ candidate, score }))
          .sort((a, b) => b.score - a.score)
      : [];

  return {
    method: 'ranked_choice',
    winner,
    ranking: finalRanking,
    details: {
      rounds,
      totalRounds: rounds.length,
      majorityThreshold: majority,
      description: 'Instant runoff: eliminate lowest candidate until majority achieved',
    },
  };
}

// Borda Count
function bordaCount(election: Election): ElectionResult {
  const n = election.candidates.length;
  const scores: Record<string, number> = {};

  for (const cand of election.candidates) {
    scores[cand] = 0;
  }

  for (const ballot of election.ballots) {
    for (let i = 0; i < ballot.ranking.length; i++) {
      const candidate = ballot.ranking[i];
      if (candidate in scores) {
        // Standard Borda: n-1 points for first, n-2 for second, etc.
        scores[candidate] += n - 1 - i;
      }
    }

    // Candidates not ranked get 0 points (already initialized)
  }

  const ranking = Object.entries(scores)
    .map(([candidate, score]) => ({ candidate, score }))
    .sort((a, b) => b.score - a.score);

  const maxScore = (n - 1) * election.ballots.length;

  return {
    method: 'borda_count',
    winner: ranking[0]?.candidate || null,
    ranking,
    details: {
      pointsPerRank: Array.from({ length: n }, (_, i) => ({ rank: i + 1, points: n - 1 - i })),
      maxPossibleScore: maxScore,
      description: 'Borda count: points awarded based on ranking position',
    },
  };
}

// Approval Voting
function approvalVoting(election: Election): ElectionResult {
  const approvals: Record<string, number> = {};

  for (const cand of election.candidates) {
    approvals[cand] = 0;
  }

  for (const ballot of election.ballots) {
    // Use explicit approvals if provided, otherwise use top half of ranking
    const approved =
      ballot.approvals || ballot.ranking.slice(0, Math.ceil(ballot.ranking.length / 2));

    for (const candidate of approved) {
      if (candidate in approvals) {
        approvals[candidate]++;
      }
    }
  }

  const ranking = Object.entries(approvals)
    .map(([candidate, score]) => ({ candidate, score }))
    .sort((a, b) => b.score - a.score);

  return {
    method: 'approval',
    winner: ranking[0]?.candidate || null,
    ranking,
    details: {
      totalVoters: election.ballots.length,
      approvalRates: Object.fromEntries(
        Object.entries(approvals).map(([c, v]) => [
          c,
          ((v / election.ballots.length) * 100).toFixed(1) + '%',
        ])
      ),
      description: 'Approval voting: voters approve multiple candidates, most approvals wins',
    },
  };
}

// Score Voting (Range Voting)
function scoreVoting(election: Election, maxScore: number = 10): ElectionResult {
  const totals: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const cand of election.candidates) {
    totals[cand] = 0;
    counts[cand] = 0;
  }

  for (const ballot of election.ballots) {
    if (ballot.scores) {
      for (const [candidate, score] of Object.entries(ballot.scores)) {
        if (candidate in totals) {
          totals[candidate] += Math.min(score, maxScore);
          counts[candidate]++;
        }
      }
    } else {
      // Convert ranking to scores
      const n = ballot.ranking.length;
      for (let i = 0; i < n; i++) {
        const candidate = ballot.ranking[i];
        if (candidate in totals) {
          const score = Math.round((maxScore * (n - i)) / n);
          totals[candidate] += score;
          counts[candidate]++;
        }
      }
    }
  }

  const averages: Record<string, number> = {};
  for (const cand of election.candidates) {
    averages[cand] = counts[cand] > 0 ? totals[cand] / counts[cand] : 0;
  }

  const ranking = Object.entries(totals)
    .map(([candidate, score]) => ({ candidate, score }))
    .sort((a, b) => b.score - a.score);

  return {
    method: 'score',
    winner: ranking[0]?.candidate || null,
    ranking,
    details: {
      maxScore,
      totalScores: totals,
      averageScores: averages,
      description: 'Score/range voting: candidates rated on scale, highest total wins',
    },
  };
}

// Condorcet Methods
function condorcetAnalysis(election: Election): CondorcetAnalysis {
  const pairwise = createPairwiseMatrix(election);
  const { candidates, matrix } = pairwise;
  const n = candidates.length;

  // Find Condorcet winner (beats all others head-to-head)
  let condorcetWinner: string | null = null;
  let condorcetLoser: string | null = null;

  for (let i = 0; i < n; i++) {
    let winsAll = true;
    let losesAll = true;

    for (let j = 0; j < n; j++) {
      if (i !== j) {
        if (matrix[i][j] <= matrix[j][i]) winsAll = false;
        if (matrix[i][j] >= matrix[j][i]) losesAll = false;
      }
    }

    if (winsAll) condorcetWinner = candidates[i];
    if (losesAll) condorcetLoser = candidates[i];
  }

  // Compute beatpath strengths using Floyd-Warshall
  const beatPath = floydWarshall(matrix, candidates);

  // Smith set: smallest set where every member beats every non-member
  const smithSet = computeSmithSet(candidates, matrix);

  // Schwartz set: union of undominated sets
  const schwartzSet = computeSchwartzSet(candidates, matrix);

  return {
    condorcetWinner,
    condorcetLoser,
    smithSet,
    schwartzSet,
    pairwiseMatrix: pairwise,
    beatPath,
  };
}

function computeSmithSet(candidates: string[], matrix: number[][]): string[] {
  const n = candidates.length;

  // Check if candidate i beats candidate j
  const beats = (i: number, j: number) => matrix[i][j] > matrix[j][i];

  // Start with all candidates
  const smithSet = new Set(candidates.map((_, i) => i));

  // Iteratively remove dominated candidates
  let changed = true;
  while (changed) {
    changed = false;
    for (const i of smithSet) {
      // Check if i is beaten by someone outside set's reach
      for (let j = 0; j < n; j++) {
        if (!smithSet.has(j) && beats(j, i)) {
          // j beats i, so add j to set
          smithSet.add(j);
          changed = true;
        }
      }
    }

    // Remove candidates beaten by all others in set
    const toRemove: number[] = [];
    for (const i of smithSet) {
      let beatenByAll = true;
      for (const j of smithSet) {
        if (i !== j && !beats(j, i)) {
          beatenByAll = false;
          break;
        }
      }
      if (beatenByAll && smithSet.size > 1) {
        toRemove.push(i);
      }
    }

    for (const i of toRemove) {
      smithSet.delete(i);
      changed = true;
    }
  }

  return Array.from(smithSet).map((i) => candidates[i]);
}

function computeSchwartzSet(candidates: string[], matrix: number[][]): string[] {
  // Simplified: return candidates who are not beaten by majority pairwise
  const n = candidates.length;
  const dominated = new Set<number>();

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && matrix[j][i] > matrix[i][j]) {
        // j beats i - check if i beats anyone who j doesn't
        let isDominated = true;
        for (let k = 0; k < n; k++) {
          if (k !== i && k !== j) {
            if (matrix[i][k] > matrix[k][i] && matrix[j][k] <= matrix[k][j]) {
              isDominated = false;
              break;
            }
          }
        }
        if (isDominated) {
          dominated.add(i);
        }
      }
    }
  }

  return candidates.filter((_, i) => !dominated.has(i));
}

// Schulze Method (Beatpath)
function schulzeMethod(election: Election): ElectionResult {
  const analysis = condorcetAnalysis(election);
  const { candidates } = analysis.pairwiseMatrix;
  const beatPath = analysis.beatPath;
  const n = candidates.length;

  // Count wins via beatpath
  const wins: Record<string, number> = {};
  for (const cand of candidates) {
    wins[cand] = 0;
  }

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && beatPath[i][j] > beatPath[j][i]) {
        wins[candidates[i]]++;
      }
    }
  }

  const ranking = Object.entries(wins)
    .map(([candidate, score]) => ({ candidate, score }))
    .sort((a, b) => b.score - a.score);

  return {
    method: 'schulze',
    winner: ranking[0]?.candidate || null,
    ranking,
    details: {
      condorcetWinner: analysis.condorcetWinner,
      smithSet: analysis.smithSet,
      beatpathStrengths: candidates.map((c, i) => ({
        candidate: c,
        strengths: candidates.map((_, j) => beatPath[i][j]),
      })),
      description: 'Schulze method: beatpath/widest path winner determination',
    },
  };
}

// Copeland Method
function copelandMethod(election: Election): ElectionResult {
  const pairwise = createPairwiseMatrix(election);
  const { candidates, matrix } = pairwise;
  const n = candidates.length;

  const scores: Record<string, number> = {};

  for (let i = 0; i < n; i++) {
    let score = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        if (matrix[i][j] > matrix[j][i]) {
          score += 1; // Win
        } else if (matrix[i][j] === matrix[j][i]) {
          score += 0.5; // Tie
        }
        // Loss: 0 points
      }
    }
    scores[candidates[i]] = score;
  }

  const ranking = Object.entries(scores)
    .map(([candidate, score]) => ({ candidate, score }))
    .sort((a, b) => b.score - a.score);

  return {
    method: 'copeland',
    winner: ranking[0]?.candidate || null,
    ranking,
    details: {
      maxScore: n - 1,
      headToHead: candidates.map((c, i) => ({
        candidate: c,
        record: candidates.map((opp, j) =>
          i === j
            ? '-'
            : matrix[i][j] > matrix[j][i]
              ? 'W'
              : matrix[i][j] < matrix[j][i]
                ? 'L'
                : 'T'
        ),
      })),
      description: 'Copeland method: +1 for pairwise win, +0.5 for tie',
    },
  };
}

// Minimax (Simpson-Kramer)
function minimaxMethod(election: Election): ElectionResult {
  const pairwise = createPairwiseMatrix(election);
  const { candidates, matrix } = pairwise;
  const n = candidates.length;

  const worstDefeat: Record<string, number> = {};

  for (let i = 0; i < n; i++) {
    let worst = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const margin = matrix[j][i] - matrix[i][j]; // Opponent's margin
        if (margin > worst) {
          worst = margin;
        }
      }
    }
    worstDefeat[candidates[i]] = worst;
  }

  // Lower worst defeat is better
  const ranking = Object.entries(worstDefeat)
    .map(([candidate, score]) => ({ candidate, score: -score })) // Negate for sorting
    .sort((a, b) => b.score - a.score);

  return {
    method: 'minimax',
    winner: ranking[0]?.candidate || null,
    ranking: ranking.map((r) => ({ ...r, score: -r.score })), // Restore original scores
    details: {
      worstDefeats: worstDefeat,
      pairwiseMargins: candidates.map((c, i) => ({
        candidate: c,
        margins: candidates.map((_, j) => (i === j ? 0 : matrix[i][j] - matrix[j][i])),
      })),
      description: 'Minimax: winner is candidate with smallest worst pairwise defeat',
    },
  };
}

// Kemeny-Young (Optimal ranking)
function kemenyYoung(election: Election): ElectionResult {
  const pairwise = createPairwiseMatrix(election);
  const { candidates, matrix } = pairwise;
  const n = candidates.length;

  // For small elections, try all permutations
  if (n > 8) {
    // Too expensive - fall back to approximation
    return schulzeMethod(election);
  }

  const permutations = getPermutations(candidates.map((_, i) => i));
  let bestScore = -Infinity;
  let bestPerm: number[] = [];

  for (const perm of permutations) {
    let score = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        // Add pairwise votes consistent with this ranking
        score += matrix[perm[i]][perm[j]];
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestPerm = perm;
    }
  }

  const ranking = bestPerm.map((i, rank) => ({
    candidate: candidates[i],
    score: n - rank,
  }));

  return {
    method: 'kemeny_young',
    winner: ranking[0]?.candidate || null,
    ranking,
    details: {
      optimalScore: bestScore,
      optimalRanking: bestPerm.map((i) => candidates[i]),
      description: 'Kemeny-Young: find ranking maximizing pairwise agreement',
    },
  };
}

function* getPermutations<T>(arr: T[]): Generator<T[]> {
  if (arr.length <= 1) {
    yield arr;
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of getPermutations(rest)) {
      yield [arr[i], ...perm];
    }
  }
}

// STAR Voting (Score Then Automatic Runoff)
function starVoting(election: Election, maxScore: number = 5): ElectionResult {
  // First round: score voting to find top 2
  const scoreResult = scoreVoting(election, maxScore);
  const top2 = scoreResult.ranking.slice(0, 2).map((r) => r.candidate);

  if (top2.length < 2) {
    return {
      method: 'star',
      winner: top2[0] || null,
      ranking: scoreResult.ranking,
      details: {
        scoreRound: scoreResult.ranking,
        description: 'STAR voting: not enough candidates for runoff',
      },
    };
  }

  // Runoff: head-to-head between top 2
  const votes = { [top2[0]]: 0, [top2[1]]: 0 };

  for (const ballot of election.ballots) {
    let score0: number, score1: number;

    if (ballot.scores) {
      score0 = ballot.scores[top2[0]] || 0;
      score1 = ballot.scores[top2[1]] || 0;
    } else {
      const rank0 = ballot.ranking.indexOf(top2[0]);
      const rank1 = ballot.ranking.indexOf(top2[1]);
      score0 = rank0 === -1 ? -1 : -rank0;
      score1 = rank1 === -1 ? -1 : -rank1;
    }

    if (score0 > score1) {
      votes[top2[0]]++;
    } else if (score1 > score0) {
      votes[top2[1]]++;
    }
    // Tie: no vote in runoff
  }

  const winner = votes[top2[0]] >= votes[top2[1]] ? top2[0] : top2[1];

  return {
    method: 'star',
    winner,
    ranking: scoreResult.ranking,
    details: {
      scoreRound: scoreResult.ranking,
      runoffCandidates: top2,
      runoffVotes: votes,
      description: 'STAR: Score round to find top 2, then automatic runoff',
    },
  };
}

// ============================================================================
// PARADOX DETECTION
// ============================================================================

function detectParadoxes(election: Election): ParadoxAnalysis {
  const analysis = condorcetAnalysis(election);
  const details: Record<string, unknown> = {};

  // Condorcet cycle: no Condorcet winner despite pairwise comparisons
  const condorcetCycle = analysis.condorcetWinner === null && election.candidates.length >= 3;

  if (condorcetCycle) {
    details.cycle = 'No Condorcet winner exists - pairwise preferences form a cycle';
  }

  // Arrow's impossibility implications
  const pluralityResult = plurality(election);
  const bordaResult = bordaCount(election);
  const condorcetWinner = analysis.condorcetWinner;

  const arrowParadox =
    pluralityResult.winner !== bordaResult.winner ||
    (condorcetWinner && pluralityResult.winner !== condorcetWinner);

  if (arrowParadox) {
    details.arrowManifestation = {
      plurality: pluralityResult.winner,
      borda: bordaResult.winner,
      condorcet: condorcetWinner,
      explanation: 'Different methods produce different winners',
    };
  }

  // Spoiler effect check: would removing a losing candidate change winner?
  let spoilerEffect = false;
  const originalWinner = pluralityResult.winner;

  for (const candidate of election.candidates) {
    if (candidate === originalWinner) continue;

    const reducedElection: Election = {
      candidates: election.candidates.filter((c) => c !== candidate),
      ballots: election.ballots.map((b) => ({
        ...b,
        ranking: b.ranking.filter((c) => c !== candidate),
      })),
    };

    const reducedResult = plurality(reducedElection);
    if (reducedResult.winner !== originalWinner) {
      spoilerEffect = true;
      details.spoiler = {
        removedCandidate: candidate,
        originalWinner,
        newWinner: reducedResult.winner,
      };
      break;
    }
  }

  // No-show paradox: could a voter help their preference by not voting?
  // (Simplified check for RCV)
  const rcvResult = rankedChoice(election);
  let noShowParadox = false;

  // Check if removing a ballot could help that voter's top choice
  for (let i = 0; i < election.ballots.length && !noShowParadox; i++) {
    const voter = election.ballots[i];
    if (voter.ranking[0] === rcvResult.winner) continue;

    const reducedBallots = [...election.ballots];
    reducedBallots.splice(i, 1);

    const reducedElection: Election = {
      candidates: election.candidates,
      ballots: reducedBallots,
    };

    const reducedRCV = rankedChoice(reducedElection);
    const voterPrefOrig = voter.ranking.indexOf(rcvResult.winner || '');
    const voterPrefNew = voter.ranking.indexOf(reducedRCV.winner || '');

    if (voterPrefNew !== -1 && (voterPrefOrig === -1 || voterPrefNew < voterPrefOrig)) {
      noShowParadox = true;
      details.noShow = {
        voter: voter.voter,
        withVote: rcvResult.winner,
        withoutVote: reducedRCV.winner,
        explanation: 'Voter would get better outcome by not voting',
      };
    }
  }

  // Alabama paradox (for apportionment - simplified)
  const alabamaParadox = false; // Would need seat allocation data

  return {
    arrowParadox,
    condorcetCycle,
    alabamaParadox,
    noShowParadox,
    spoilerEffect,
    details,
  };
}

// ============================================================================
// COMPARISON AND ANALYSIS
// ============================================================================

function compareAllMethods(election: Election): Record<string, ElectionResult> {
  return {
    plurality: plurality(election),
    ranked_choice: rankedChoice(election),
    borda_count: bordaCount(election),
    approval: approvalVoting(election),
    score: scoreVoting(election),
    schulze: schulzeMethod(election),
    copeland: copelandMethod(election),
    minimax: minimaxMethod(election),
    kemeny_young: kemenyYoung(election),
    star: starVoting(election),
  };
}

function analyzeStrategicVoting(election: Election): {
  vulnerabilities: Record<string, string[]>;
  recommendations: string[];
} {
  const results = compareAllMethods(election);
  const vulnerabilities: Record<string, string[]> = {};

  // Plurality vulnerabilities
  vulnerabilities.plurality = [
    'Vote splitting among similar candidates',
    'Encourages insincere "lesser evil" voting',
    'Spoiler effect from third-party candidates',
  ];

  // RCV vulnerabilities
  vulnerabilities.ranked_choice = [
    'Center squeeze: moderate candidates eliminated early',
    'Non-monotonicity: ranking higher can hurt a candidate',
    'Potential no-show paradox',
  ];

  // Borda vulnerabilities
  vulnerabilities.borda_count = [
    'Vulnerable to cloning: adding similar candidates',
    'Rewards candidates with broad support over deep support',
    'Strategic burial of main competitor',
  ];

  // Approval vulnerabilities
  vulnerabilities.approval = [
    'Chicken dilemma between cooperating groups',
    'Unclear optimal approval threshold',
    'May elect candidates no one loves',
  ];

  // Determine consensus or divergence
  const winners = new Set(Object.values(results).map((r) => r.winner));
  const recommendations: string[] = [];

  if (winners.size === 1) {
    recommendations.push('All methods agree on winner - strong mandate');
  } else {
    recommendations.push('Methods disagree - consider Condorcet method for fairness');

    const analysis = condorcetAnalysis(election);
    if (analysis.condorcetWinner) {
      recommendations.push(`Condorcet winner exists: ${analysis.condorcetWinner}`);
    } else {
      recommendations.push('No Condorcet winner - consider Schulze or Ranked Pairs');
    }
  }

  return { vulnerabilities, recommendations };
}

// ============================================================================
// SAMPLE DATA GENERATORS
// ============================================================================

function generateSampleElection(scenario: string): Election {
  switch (scenario) {
    case 'condorcet_cycle':
      return {
        title: 'Condorcet Cycle Example',
        candidates: ['A', 'B', 'C'],
        ballots: [
          { voter: 'V1', ranking: ['A', 'B', 'C'] },
          { voter: 'V2', ranking: ['A', 'B', 'C'] },
          { voter: 'V3', ranking: ['A', 'B', 'C'] },
          { voter: 'V4', ranking: ['B', 'C', 'A'] },
          { voter: 'V5', ranking: ['B', 'C', 'A'] },
          { voter: 'V6', ranking: ['B', 'C', 'A'] },
          { voter: 'V7', ranking: ['C', 'A', 'B'] },
          { voter: 'V8', ranking: ['C', 'A', 'B'] },
          { voter: 'V9', ranking: ['C', 'A', 'B'] },
        ],
      };

    case 'spoiler':
      return {
        title: 'Spoiler Effect Example',
        candidates: ['Democrat', 'Republican', 'Green'],
        ballots: [
          ...Array(40).fill({ voter: 'D', ranking: ['Democrat', 'Green', 'Republican'] }),
          ...Array(35).fill({ voter: 'R', ranking: ['Republican', 'Democrat', 'Green'] }),
          ...Array(25).fill({ voter: 'G', ranking: ['Green', 'Democrat', 'Republican'] }),
        ].map((b, i) => ({ ...b, voter: `V${i}` })),
      };

    case 'center_squeeze':
      return {
        title: 'Center Squeeze Example',
        candidates: ['Left', 'Center', 'Right'],
        ballots: [
          ...Array(35).fill({ ranking: ['Left', 'Center', 'Right'] }),
          ...Array(30).fill({ ranking: ['Center', 'Left', 'Right'] }),
          ...Array(35).fill({ ranking: ['Right', 'Center', 'Left'] }),
        ].map((b, i) => ({ voter: `V${i}`, ...b })),
      };

    default:
      return {
        title: 'Sample Election',
        candidates: ['Alice', 'Bob', 'Carol', 'Dave'],
        ballots: [
          { voter: 'V1', ranking: ['Alice', 'Carol', 'Bob', 'Dave'] },
          { voter: 'V2', ranking: ['Bob', 'Alice', 'Dave', 'Carol'] },
          { voter: 'V3', ranking: ['Carol', 'Dave', 'Alice', 'Bob'] },
          { voter: 'V4', ranking: ['Alice', 'Bob', 'Carol', 'Dave'] },
          { voter: 'V5', ranking: ['Dave', 'Carol', 'Bob', 'Alice'] },
          { voter: 'V6', ranking: ['Bob', 'Carol', 'Alice', 'Dave'] },
          { voter: 'V7', ranking: ['Alice', 'Dave', 'Carol', 'Bob'] },
        ],
      };
  }
}

// ============================================================================
// TOOL DEFINITION AND EXECUTOR
// ============================================================================

export const votingsystemTool: UnifiedTool = {
  name: 'voting_system',
  description:
    'Voting systems - plurality, ranked choice, approval, Condorcet, Borda, Schulze, STAR',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'count',
          'compare',
          'analyze',
          'paradox',
          'condorcet_analysis',
          'strategic_analysis',
          'generate_sample',
          'info',
        ],
        description: 'Operation to perform',
      },
      method: {
        type: 'string',
        enum: [
          'plurality',
          'ranked_choice',
          'borda_count',
          'approval',
          'score',
          'condorcet',
          'schulze',
          'copeland',
          'minimax',
          'kemeny_young',
          'star',
        ],
        description: 'Voting method to use',
      },
      candidates: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of candidates',
      },
      ballots: {
        type: 'array',
        items: { type: 'object' },
        description:
          'Array of ballots with voter preferences. Each ballot has: voter (string), ranking (array of strings), approvals (optional array of strings), scores (optional object)',
      },
      scenario: {
        type: 'string',
        enum: ['condorcet_cycle', 'spoiler', 'center_squeeze', 'default'],
        description: 'Predefined scenario for sample generation',
      },
    },
    required: ['operation'],
  },
};

export async function executevotingsystem(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    // Build election from input or use sample
    let election: Election;

    if (args.candidates && args.ballots) {
      election = {
        candidates: args.candidates,
        ballots: args.ballots,
      };
    } else {
      election = generateSampleElection(args.scenario || 'default');
    }

    switch (operation) {
      case 'count': {
        const method = args.method || 'plurality';
        let result: ElectionResult;

        switch (method) {
          case 'plurality':
            result = plurality(election);
            break;
          case 'ranked_choice':
            result = rankedChoice(election);
            break;
          case 'borda_count':
            result = bordaCount(election);
            break;
          case 'approval':
            result = approvalVoting(election);
            break;
          case 'score':
            result = scoreVoting(election);
            break;
          case 'schulze':
            result = schulzeMethod(election);
            break;
          case 'copeland':
            result = copelandMethod(election);
            break;
          case 'minimax':
            result = minimaxMethod(election);
            break;
          case 'kemeny_young':
            result = kemenyYoung(election);
            break;
          case 'star':
            result = starVoting(election);
            break;
          default:
            result = plurality(election);
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'count',
              election: {
                candidates: election.candidates,
                numBallots: election.ballots.length,
              },
              result,
            },
            null,
            2
          ),
        };
      }

      case 'compare': {
        const results = compareAllMethods(election);
        const winners = Object.entries(results).map(([method, result]) => ({
          method,
          winner: result.winner,
        }));

        const winnerCounts: Record<string, number> = {};
        for (const { winner } of winners) {
          if (winner) {
            winnerCounts[winner] = (winnerCounts[winner] || 0) + 1;
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'compare',
              election: {
                candidates: election.candidates,
                numBallots: election.ballots.length,
              },
              winners,
              winnerConsensus: winnerCounts,
              methodAgreement:
                new Set(winners.map((w) => w.winner)).size === 1
                  ? 'All methods agree'
                  : 'Methods disagree on winner',
              fullResults: results,
            },
            null,
            2
          ),
        };
      }

      case 'condorcet_analysis': {
        const analysis = condorcetAnalysis(election);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'condorcet_analysis',
              condorcetWinner: analysis.condorcetWinner,
              condorcetLoser: analysis.condorcetLoser,
              smithSet: analysis.smithSet,
              schwartzSet: analysis.schwartzSet,
              pairwiseMatrix: {
                candidates: analysis.pairwiseMatrix.candidates,
                matrix: analysis.pairwiseMatrix.matrix,
              },
              interpretation: analysis.condorcetWinner
                ? `${analysis.condorcetWinner} beats all other candidates head-to-head`
                : 'No Condorcet winner - preferences form a cycle',
            },
            null,
            2
          ),
        };
      }

      case 'paradox': {
        const paradoxes = detectParadoxes(election);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'paradox',
              election: {
                candidates: election.candidates,
                numBallots: election.ballots.length,
              },
              paradoxesDetected: {
                condorcetCycle: paradoxes.condorcetCycle,
                arrowParadox: paradoxes.arrowParadox,
                spoilerEffect: paradoxes.spoilerEffect,
                noShowParadox: paradoxes.noShowParadox,
              },
              details: paradoxes.details,
              explanation: {
                condorcetCycle: 'No candidate beats all others pairwise',
                arrowParadox: 'Different methods produce different winners',
                spoilerEffect: 'Removing a losing candidate changes the winner',
                noShowParadox: 'A voter could improve outcome by not voting',
              },
            },
            null,
            2
          ),
        };
      }

      case 'strategic_analysis': {
        const strategic = analyzeStrategicVoting(election);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'strategic_analysis',
              vulnerabilities: strategic.vulnerabilities,
              recommendations: strategic.recommendations,
            },
            null,
            2
          ),
        };
      }

      case 'generate_sample': {
        const scenario = args.scenario || 'default';
        const sample = generateSampleElection(scenario);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'generate_sample',
              scenario,
              election: {
                title: sample.title,
                candidates: sample.candidates,
                ballots: sample.ballots.slice(0, 10),
                totalBallots: sample.ballots.length,
              },
              description: {
                condorcet_cycle: 'Three candidates with circular preferences (A>B>C>A)',
                spoiler: 'Third-party candidate splitting vote from major party',
                center_squeeze: 'Moderate candidate eliminated despite broad appeal',
                default: 'Standard four-candidate election',
              }[scenario],
            },
            null,
            2
          ),
        };
      }

      case 'analyze': {
        const allResults = compareAllMethods(election);
        const condorcet = condorcetAnalysis(election);
        const paradoxes = detectParadoxes(election);
        const strategic = analyzeStrategicVoting(election);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'analyze',
              election: {
                candidates: election.candidates,
                numBallots: election.ballots.length,
              },
              summary: {
                condorcetWinner: condorcet.condorcetWinner,
                pluralityWinner: allResults.plurality.winner,
                bordaWinner: allResults.borda_count.winner,
                schulzeWinner: allResults.schulze.winner,
              },
              paradoxes: {
                found: Object.entries(paradoxes)
                  .filter(([k, v]) => k !== 'details' && v === true)
                  .map(([k]) => k),
              },
              recommendations: strategic.recommendations,
            },
            null,
            2
          ),
        };
      }

      case 'info':
      default: {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              tool: 'voting_system',
              description: 'Comprehensive voting system analysis and comparison',
              methods: {
                plurality: {
                  description: 'Candidate with most first-choice votes wins',
                  pros: ['Simple', 'Easy to understand'],
                  cons: ['Spoiler effect', 'Vote splitting', 'Two-party dominance'],
                },
                ranked_choice: {
                  description: 'Instant runoff - eliminate last place until majority',
                  pros: ['No spoiler effect', 'Encourages sincere voting'],
                  cons: ['Non-monotonic', 'Center squeeze', 'Complex counting'],
                },
                borda_count: {
                  description: 'Points based on ranking position',
                  pros: ['Rewards consensus', 'Simple to count'],
                  cons: ['Vulnerable to clones', 'Strategic burial'],
                },
                approval: {
                  description: 'Vote for as many candidates as you approve',
                  pros: ['Simple', 'No spoiler effect'],
                  cons: ['Chicken dilemma', 'Unclear threshold'],
                },
                score: {
                  description: 'Rate each candidate on a scale',
                  pros: ['Expressive', 'Strategy-resistant'],
                  cons: ['More complex ballots', 'Normalization issues'],
                },
                schulze: {
                  description: 'Beatpath/widest path Condorcet method',
                  pros: ['Always picks Condorcet winner if exists', 'Clone-proof'],
                  cons: ['Complex to explain', 'Computational overhead'],
                },
                star: {
                  description: 'Score round then automatic runoff',
                  pros: ['Combines score and runoff benefits', 'Resists strategic voting'],
                  cons: ['Two-phase process', 'Novel method'],
                },
              },
              operations: [
                'count',
                'compare',
                'condorcet_analysis',
                'paradox',
                'strategic_analysis',
                'generate_sample',
                'analyze',
              ],
              paradoxes: [
                'Condorcet cycle',
                "Arrow's impossibility",
                'Spoiler effect',
                'No-show paradox',
              ],
            },
            null,
            2
          ),
        };
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isvotingsystemAvailable(): boolean {
  return true;
}
