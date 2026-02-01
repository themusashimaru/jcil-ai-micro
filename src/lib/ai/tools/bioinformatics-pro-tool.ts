// ============================================================================
// BIOINFORMATICS PRO TOOL - TIER BEYOND
// ============================================================================
// Advanced bioinformatics: sequence alignment, phylogenetics, motif finding.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Needleman-Wunsch global alignment
function needlemanWunsch(
  seq1: string,
  seq2: string,
  match: number = 2,
  mismatch: number = -1,
  gap: number = -2
): { score: number; aligned1: string; aligned2: string } {
  const m = seq1.length,
    n = seq2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize
  for (let i = 0; i <= m; i++) dp[i][0] = i * gap;
  for (let j = 0; j <= n; j++) dp[0][j] = j * gap;

  // Fill
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const scoreDiag = dp[i - 1][j - 1] + (seq1[i - 1] === seq2[j - 1] ? match : mismatch);
      const scoreUp = dp[i - 1][j] + gap;
      const scoreLeft = dp[i][j - 1] + gap;
      dp[i][j] = Math.max(scoreDiag, scoreUp, scoreLeft);
    }
  }

  // Traceback
  let aligned1 = '',
    aligned2 = '';
  let i = m,
    j = n;
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      dp[i][j] === dp[i - 1][j - 1] + (seq1[i - 1] === seq2[j - 1] ? match : mismatch)
    ) {
      aligned1 = seq1[i - 1] + aligned1;
      aligned2 = seq2[j - 1] + aligned2;
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + gap) {
      aligned1 = seq1[i - 1] + aligned1;
      aligned2 = '-' + aligned2;
      i--;
    } else {
      aligned1 = '-' + aligned1;
      aligned2 = seq2[j - 1] + aligned2;
      j--;
    }
  }

  return { score: dp[m][n], aligned1, aligned2 };
}

// Smith-Waterman local alignment
function smithWaterman(
  seq1: string,
  seq2: string,
  match: number = 2,
  mismatch: number = -1,
  gap: number = -2
): { score: number; aligned1: string; aligned2: string; start1: number; start2: number } {
  const m = seq1.length,
    n = seq2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  let maxScore = 0,
    maxI = 0,
    maxJ = 0;

  // Fill
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const scoreDiag = dp[i - 1][j - 1] + (seq1[i - 1] === seq2[j - 1] ? match : mismatch);
      const scoreUp = dp[i - 1][j] + gap;
      const scoreLeft = dp[i][j - 1] + gap;
      dp[i][j] = Math.max(0, scoreDiag, scoreUp, scoreLeft);
      if (dp[i][j] > maxScore) {
        maxScore = dp[i][j];
        maxI = i;
        maxJ = j;
      }
    }
  }

  // Traceback from max
  let aligned1 = '',
    aligned2 = '';
  let i = maxI,
    j = maxJ;
  while (i > 0 && j > 0 && dp[i][j] > 0) {
    if (dp[i][j] === dp[i - 1][j - 1] + (seq1[i - 1] === seq2[j - 1] ? match : mismatch)) {
      aligned1 = seq1[i - 1] + aligned1;
      aligned2 = seq2[j - 1] + aligned2;
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j] + gap) {
      aligned1 = seq1[i - 1] + aligned1;
      aligned2 = '-' + aligned2;
      i--;
    } else {
      aligned1 = '-' + aligned1;
      aligned2 = seq2[j - 1] + aligned2;
      j--;
    }
  }

  return { score: maxScore, aligned1, aligned2, start1: i + 1, start2: j + 1 };
}

// Sequence identity
function sequenceIdentity(aligned1: string, aligned2: string): number {
  let matches = 0,
    total = 0;
  for (let i = 0; i < aligned1.length; i++) {
    if (aligned1[i] !== '-' && aligned2[i] !== '-') {
      total++;
      if (aligned1[i] === aligned2[i]) matches++;
    }
  }
  return total > 0 ? matches / total : 0;
}

// Simple distance matrix for phylogeny
function distanceMatrix(sequences: string[]): number[][] {
  const n = sequences.length;
  const dist: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const alignment = needlemanWunsch(sequences[i], sequences[j]);
      const identity = sequenceIdentity(alignment.aligned1, alignment.aligned2);
      const d = identity > 0 ? -Math.log(identity) : 5; // Jukes-Cantor simplified
      dist[i][j] = d;
      dist[j][i] = d;
    }
  }

  return dist;
}

// UPGMA clustering (simplified)
function upgma(names: string[], distances: number[][]): string {
  const clusters: { name: string; size: number }[] = names.map((name) => ({ name, size: 1 }));
  const dist = distances.map((row) => [...row]);

  while (clusters.length > 1) {
    // Find minimum distance
    let minD = Infinity,
      minI = 0,
      minJ = 1;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (dist[i][j] < minD) {
          minD = dist[i][j];
          minI = i;
          minJ = j;
        }
      }
    }

    // Merge clusters
    const newName = `(${clusters[minI].name},${clusters[minJ].name})`;
    const newSize = clusters[minI].size + clusters[minJ].size;

    // Update distances
    const newDist: number[] = [];
    for (let k = 0; k < clusters.length; k++) {
      if (k !== minI && k !== minJ) {
        const d =
          (dist[minI][k] * clusters[minI].size + dist[minJ][k] * clusters[minJ].size) / newSize;
        newDist.push(d);
      }
    }

    // Remove old clusters and add new
    const newClusters = clusters.filter((_, i) => i !== minI && i !== minJ);
    newClusters.push({ name: newName, size: newSize });

    // Rebuild distance matrix
    const newDistMatrix: number[][] = [];
    for (let i = 0; i < newClusters.length - 1; i++) {
      newDistMatrix.push([]);
      for (let j = 0; j < newClusters.length; j++) {
        if (j < newClusters.length - 1) {
          const oldI = clusters.indexOf(newClusters[i]);
          const oldJ = clusters.indexOf(newClusters[j]);
          newDistMatrix[i].push(dist[oldI][oldJ]);
        } else {
          newDistMatrix[i].push(newDist[i]);
        }
      }
    }
    newDistMatrix.push([...newDist, 0]);

    clusters.length = 0;
    clusters.push(...newClusters);
    dist.length = 0;
    dist.push(...newDistMatrix);
  }

  return clusters[0].name;
}

// Find motifs (simple k-mer counting)
function findMotifs(sequence: string, k: number): { motif: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (let i = 0; i <= sequence.length - k; i++) {
    const kmer = sequence.substring(i, i + k);
    counts[kmer] = (counts[kmer] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([motif, count]) => ({ motif, count }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const bioinformaticsProTool: UnifiedTool = {
  name: 'bioinformatics_pro',
  description: `Advanced bioinformatics: sequence alignment, phylogenetics, motifs.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['global_align', 'local_align', 'identity', 'phylogeny', 'motifs', 'distance_matrix'],
        description: 'Bioinformatics operation to perform',
      },
      seq1: { type: 'string', description: 'First sequence' },
      seq2: { type: 'string', description: 'Second sequence' },
      sequences: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of sequences',
      },
      names: {
        type: 'array',
        items: { type: 'string' },
        description: 'Names for sequences',
      },
      k: { type: 'number', description: 'k-mer length for motif finding' },
      match: { type: 'number', description: 'Match score' },
      mismatch: { type: 'number', description: 'Mismatch penalty' },
      gap: { type: 'number', description: 'Gap penalty' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeBioinformaticsPro(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;
    const match = args.match ?? 2;
    const mismatch = args.mismatch ?? -1;
    const gap = args.gap ?? -2;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'global_align': {
        const { seq1, seq2 } = args;
        if (!seq1 || !seq2) throw new Error('global_align requires seq1 and seq2');
        const alignResult = needlemanWunsch(
          seq1.toUpperCase(),
          seq2.toUpperCase(),
          match,
          mismatch,
          gap
        );
        const identity = sequenceIdentity(alignResult.aligned1, alignResult.aligned2);
        result = {
          operation: 'global_align',
          algorithm: 'Needleman-Wunsch',
          score: alignResult.score,
          identity_percent: +(identity * 100).toFixed(1),
          aligned_seq1: alignResult.aligned1,
          aligned_seq2: alignResult.aligned2,
          alignment_length: alignResult.aligned1.length,
        };
        break;
      }
      case 'local_align': {
        const { seq1, seq2 } = args;
        if (!seq1 || !seq2) throw new Error('local_align requires seq1 and seq2');
        const alignResult = smithWaterman(
          seq1.toUpperCase(),
          seq2.toUpperCase(),
          match,
          mismatch,
          gap
        );
        const identity = sequenceIdentity(alignResult.aligned1, alignResult.aligned2);
        result = {
          operation: 'local_align',
          algorithm: 'Smith-Waterman',
          score: alignResult.score,
          identity_percent: +(identity * 100).toFixed(1),
          aligned_seq1: alignResult.aligned1,
          aligned_seq2: alignResult.aligned2,
          start_positions: { seq1: alignResult.start1, seq2: alignResult.start2 },
        };
        break;
      }
      case 'identity': {
        const { seq1, seq2 } = args;
        if (!seq1 || !seq2) throw new Error('identity requires seq1 and seq2');
        const alignResult = needlemanWunsch(seq1.toUpperCase(), seq2.toUpperCase());
        const identity = sequenceIdentity(alignResult.aligned1, alignResult.aligned2);
        result = {
          operation: 'identity',
          identity_percent: +(identity * 100).toFixed(2),
          similar: identity > 0.7 ? 'high' : identity > 0.3 ? 'moderate' : 'low',
        };
        break;
      }
      case 'phylogeny': {
        const sequences = args.sequences || ['ATCG', 'ATGG', 'TTCG', 'TTGG'];
        const names = args.names || sequences.map((_: string, i: number) => `Seq${i + 1}`);
        const dist = distanceMatrix(sequences.map((s: string) => s.toUpperCase()));
        const tree = upgma(names, dist);
        result = {
          operation: 'phylogeny',
          algorithm: 'UPGMA',
          newick_tree: tree + ';',
          num_sequences: sequences.length,
        };
        break;
      }
      case 'motifs': {
        const seq = args.seq1 || 'ATCGATCGATCG';
        const k = args.k || 3;
        const motifs = findMotifs(seq.toUpperCase(), k);
        result = {
          operation: 'motifs',
          k_mer_length: k,
          sequence_length: seq.length,
          top_motifs: motifs.slice(0, 10),
          unique_motifs: motifs.length,
        };
        break;
      }
      case 'distance_matrix': {
        const sequences = args.sequences || ['ATCG', 'ATGG', 'TTCG'];
        const names = args.names || sequences.map((_: string, i: number) => `Seq${i + 1}`);
        const dist = distanceMatrix(sequences.map((s: string) => s.toUpperCase()));
        result = {
          operation: 'distance_matrix',
          names,
          distances: dist.map((row) => row.map((d) => +d.toFixed(3))),
        };
        break;
      }
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isBioinformaticsProAvailable(): boolean {
  return true;
}
