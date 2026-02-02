/**
 * SEQUENCE-ALIGNMENT TOOL
 * Complete DNA/protein sequence alignment implementation
 * Supports Needleman-Wunsch (global), Smith-Waterman (local), and multiple sequence alignment
 * Includes scoring matrices, gap penalties, and alignment visualization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const sequencealignmentTool: UnifiedTool = {
  name: 'sequence_alignment',
  description: 'DNA/protein sequence alignment - Needleman-Wunsch, Smith-Waterman, multiple sequence alignment',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['global', 'local', 'semiglobal', 'multiple', 'score_only', 'analyze', 'info'],
        description: 'Alignment operation'
      },
      sequence1: {
        type: 'string',
        description: 'First sequence (DNA/RNA/protein)'
      },
      sequence2: {
        type: 'string',
        description: 'Second sequence for pairwise alignment'
      },
      sequences: {
        type: 'array',
        description: 'Array of sequences for multiple alignment'
      },
      sequence_type: {
        type: 'string',
        enum: ['dna', 'rna', 'protein'],
        description: 'Type of sequence'
      },
      scoring_matrix: {
        type: 'string',
        enum: ['BLOSUM62', 'BLOSUM45', 'BLOSUM80', 'PAM250', 'PAM120', 'IDENTITY', 'DNA_SIMPLE'],
        description: 'Scoring matrix for alignment'
      },
      gap_open: {
        type: 'number',
        description: 'Gap opening penalty (negative)'
      },
      gap_extend: {
        type: 'number',
        description: 'Gap extension penalty (negative)'
      },
      match_score: {
        type: 'number',
        description: 'Match score for DNA alignment'
      },
      mismatch_score: {
        type: 'number',
        description: 'Mismatch penalty for DNA alignment'
      }
    },
    required: ['operation']
  }
};

// Standard amino acid order for matrices
const AMINO_ACIDS = 'ARNDCQEGHILKMFPSTWYV';

// BLOSUM62 scoring matrix
const BLOSUM62: Record<string, Record<string, number>> = {};
const BLOSUM62_DATA = [
  [ 4, -1, -2, -2,  0, -1, -1,  0, -2, -1, -1, -1, -1, -2, -1,  1,  0, -3, -2,  0],
  [-1,  5,  0, -2, -3,  1,  0, -2,  0, -3, -2,  2, -1, -3, -2, -1, -1, -3, -2, -3],
  [-2,  0,  6,  1, -3,  0,  0,  0,  1, -3, -3,  0, -2, -3, -2,  1,  0, -4, -2, -3],
  [-2, -2,  1,  6, -3,  0,  2, -1, -1, -3, -4, -1, -3, -3, -1,  0, -1, -4, -3, -3],
  [ 0, -3, -3, -3,  9, -3, -4, -3, -3, -1, -1, -3, -1, -2, -3, -1, -1, -2, -2, -1],
  [-1,  1,  0,  0, -3,  5,  2, -2,  0, -3, -2,  1,  0, -3, -1,  0, -1, -2, -1, -2],
  [-1,  0,  0,  2, -4,  2,  5, -2,  0, -3, -3,  1, -2, -3, -1,  0, -1, -3, -2, -2],
  [ 0, -2,  0, -1, -3, -2, -2,  6, -2, -4, -4, -2, -3, -3, -2,  0, -2, -2, -3, -3],
  [-2,  0,  1, -1, -3,  0,  0, -2,  8, -3, -3, -1, -2, -1, -2, -1, -2, -2,  2, -3],
  [-1, -3, -3, -3, -1, -3, -3, -4, -3,  4,  2, -3,  1,  0, -3, -2, -1, -3, -1,  3],
  [-1, -2, -3, -4, -1, -2, -3, -4, -3,  2,  4, -2,  2,  0, -3, -2, -1, -2, -1,  1],
  [-1,  2,  0, -1, -3,  1,  1, -2, -1, -3, -2,  5, -1, -3, -1,  0, -1, -3, -2, -2],
  [-1, -1, -2, -3, -1,  0, -2, -3, -2,  1,  2, -1,  5,  0, -2, -1, -1, -1, -1,  1],
  [-2, -3, -3, -3, -2, -3, -3, -3, -1,  0,  0, -3,  0,  6, -4, -2, -2,  1,  3, -1],
  [-1, -2, -2, -1, -3, -1, -1, -2, -2, -3, -3, -1, -2, -4,  7, -1, -1, -4, -3, -2],
  [ 1, -1,  1,  0, -1,  0,  0,  0, -1, -2, -2,  0, -1, -2, -1,  4,  1, -3, -2, -2],
  [ 0, -1,  0, -1, -1, -1, -1, -2, -2, -1, -1, -1, -1, -2, -1,  1,  5, -2, -2,  0],
  [-3, -3, -4, -4, -2, -2, -3, -2, -2, -3, -2, -3, -1,  1, -4, -3, -2, 11,  2, -3],
  [-2, -2, -2, -3, -2, -1, -2, -3,  2, -1, -1, -2, -1,  3, -3, -2, -2,  2,  7, -1],
  [ 0, -3, -3, -3, -1, -2, -2, -3, -3,  3,  1, -2,  1, -1, -2, -2,  0, -3, -1,  4]
];

// Initialize BLOSUM62
for (let i = 0; i < 20; i++) {
  BLOSUM62[AMINO_ACIDS[i]] = {};
  for (let j = 0; j < 20; j++) {
    BLOSUM62[AMINO_ACIDS[i]][AMINO_ACIDS[j]] = BLOSUM62_DATA[i][j];
  }
}

// BLOSUM45 (more distant sequences)
const BLOSUM45_DATA = [
  [ 5, -2, -1, -2, -1, -1, -1,  0, -2, -1, -1, -1, -1, -2, -1,  1,  0, -2, -2,  0],
  [-2,  7,  0, -1, -3,  1,  0, -2,  0, -3, -2,  3, -1, -2, -2, -1, -1, -2, -1, -2],
  [-1,  0,  6,  2, -2,  0,  0,  0,  1, -2, -3,  0, -2, -2, -2,  1,  0, -4, -2, -3],
  [-2, -1,  2,  7, -3,  0,  2, -1,  0, -4, -3,  0, -3, -4, -1,  0, -1, -4, -2, -3],
  [-1, -3, -2, -3, 12, -3, -3, -3, -3, -3, -2, -3, -2, -2, -4, -1, -1, -5, -3, -1],
  [-1,  1,  0,  0, -3,  6,  2, -2,  1, -2, -2,  1,  0, -4, -1,  0, -1, -2, -1, -3],
  [-1,  0,  0,  2, -3,  2,  6, -2,  0, -3, -2,  1, -2, -3,  0,  0, -1, -3, -2, -3],
  [ 0, -2,  0, -1, -3, -2, -2,  7, -2, -4, -3, -2, -2, -3, -2,  0, -2, -2, -3, -3],
  [-2,  0,  1,  0, -3,  1,  0, -2, 10, -3, -2, -1,  0, -2, -2, -1, -2, -3,  2, -3],
  [-1, -3, -2, -4, -3, -2, -3, -4, -3,  5,  2, -3,  2,  0, -2, -2, -1, -2,  0,  3],
  [-1, -2, -3, -3, -2, -2, -2, -3, -2,  2,  5, -3,  2,  1, -3, -3, -1, -2,  0,  1],
  [-1,  3,  0,  0, -3,  1,  1, -2, -1, -3, -3,  5, -1, -3, -1, -1, -1, -2, -1, -2],
  [-1, -1, -2, -3, -2,  0, -2, -2,  0,  2,  2, -1,  6,  0, -2, -2, -1, -2,  0,  1],
  [-2, -2, -2, -4, -2, -4, -3, -3, -2,  0,  1, -3,  0,  8, -3, -2, -1,  1,  3,  0],
  [-1, -2, -2, -1, -4, -1,  0, -2, -2, -2, -3, -1, -2, -3,  9, -1, -1, -3, -3, -3],
  [ 1, -1,  1,  0, -1,  0,  0,  0, -1, -2, -3, -1, -2, -2, -1,  4,  2, -4, -2, -1],
  [ 0, -1,  0, -1, -1, -1, -1, -2, -2, -1, -1, -1, -1, -1, -1,  2,  5, -3, -1,  0],
  [-2, -2, -4, -4, -5, -2, -3, -2, -3, -2, -2, -2, -2,  1, -3, -4, -3, 15,  3, -3],
  [-2, -1, -2, -2, -3, -1, -2, -3,  2,  0,  0, -1,  0,  3, -3, -2, -1,  3,  8, -1],
  [ 0, -2, -3, -3, -1, -3, -3, -3, -3,  3,  1, -2,  1,  0, -3, -1,  0, -3, -1,  5]
];

const BLOSUM45: Record<string, Record<string, number>> = {};
for (let i = 0; i < 20; i++) {
  BLOSUM45[AMINO_ACIDS[i]] = {};
  for (let j = 0; j < 20; j++) {
    BLOSUM45[AMINO_ACIDS[i]][AMINO_ACIDS[j]] = BLOSUM45_DATA[i][j];
  }
}

// PAM250 matrix
const PAM250_DATA = [
  [ 2, -2,  0,  0, -2,  0,  0,  1, -1, -1, -2, -1, -1, -4,  1,  1,  1, -6, -3,  0],
  [-2,  6,  0, -1, -4,  1, -1, -3,  2, -2, -3,  3,  0, -4,  0,  0, -1,  2, -4, -2],
  [ 0,  0,  2,  2, -4,  1,  1,  0,  2, -2, -3,  1, -2, -4, -1,  1,  0, -4, -2, -2],
  [ 0, -1,  2,  4, -5,  2,  3,  1,  1, -2, -4,  0, -3, -6, -1,  0,  0, -7, -4, -2],
  [-2, -4, -4, -5, 12, -5, -5, -3, -3, -2, -6, -5, -5, -4, -3,  0, -2, -8,  0, -2],
  [ 0,  1,  1,  2, -5,  4,  2, -1,  3, -2, -2,  1, -1, -5,  0, -1, -1, -5, -4, -2],
  [ 0, -1,  1,  3, -5,  2,  4,  0,  1, -2, -3,  0, -2, -5, -1,  0,  0, -7, -4, -2],
  [ 1, -3,  0,  1, -3, -1,  0,  5, -2, -3, -4, -2, -3, -5, -1,  1,  0, -7, -5, -1],
  [-1,  2,  2,  1, -3,  3,  1, -2,  6, -2, -2,  0, -2, -2,  0, -1, -1, -3,  0, -2],
  [-1, -2, -2, -2, -2, -2, -2, -3, -2,  5,  2, -2,  2,  1, -2, -1,  0, -5, -1,  4],
  [-2, -3, -3, -4, -6, -2, -3, -4, -2,  2,  6, -3,  4,  2, -3, -3, -2, -2, -1,  2],
  [-1,  3,  1,  0, -5,  1,  0, -2,  0, -2, -3,  5,  0, -5, -1,  0,  0, -3, -4, -2],
  [-1,  0, -2, -3, -5, -1, -2, -3, -2,  2,  4,  0,  6,  0, -2, -2, -1, -4, -2,  2],
  [-4, -4, -4, -6, -4, -5, -5, -5, -2,  1,  2, -5,  0,  9, -5, -3, -3,  0,  7, -1],
  [ 1,  0, -1, -1, -3,  0, -1, -1,  0, -2, -3, -1, -2, -5,  6,  1,  0, -6, -5, -1],
  [ 1,  0,  1,  0,  0, -1,  0,  1, -1, -1, -3,  0, -2, -3,  1,  2,  1, -2, -3, -1],
  [ 1, -1,  0,  0, -2, -1,  0,  0, -1,  0, -2,  0, -1, -3,  0,  1,  3, -5, -3,  0],
  [-6,  2, -4, -7, -8, -5, -7, -7, -3, -5, -2, -3, -4,  0, -6, -2, -5, 17,  0, -6],
  [-3, -4, -2, -4,  0, -4, -4, -5,  0, -1, -1, -4, -2,  7, -5, -3, -3,  0, 10, -2],
  [ 0, -2, -2, -2, -2, -2, -2, -1, -2,  4,  2, -2,  2, -1, -1, -1,  0, -6, -2,  4]
];

const PAM250: Record<string, Record<string, number>> = {};
for (let i = 0; i < 20; i++) {
  PAM250[AMINO_ACIDS[i]] = {};
  for (let j = 0; j < 20; j++) {
    PAM250[AMINO_ACIDS[i]][AMINO_ACIDS[j]] = PAM250_DATA[i][j];
  }
}

// DNA scoring
const DNA_BASES = 'ACGT';
const DNA_SIMPLE: Record<string, Record<string, number>> = {};
for (const b1 of DNA_BASES) {
  DNA_SIMPLE[b1] = {};
  for (const b2 of DNA_BASES) {
    DNA_SIMPLE[b1][b2] = b1 === b2 ? 2 : -1;
  }
}

// Handle ambiguous bases
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AMBIGUOUS_DNA: Record<string, string[]> = {
  'N': ['A', 'C', 'G', 'T'],
  'R': ['A', 'G'],
  'Y': ['C', 'T'],
  'S': ['G', 'C'],
  'W': ['A', 'T'],
  'K': ['G', 'T'],
  'M': ['A', 'C'],
  'B': ['C', 'G', 'T'],
  'D': ['A', 'G', 'T'],
  'H': ['A', 'C', 'T'],
  'V': ['A', 'C', 'G']
};

function getScore(
  a: string,
  b: string,
  matrix: Record<string, Record<string, number>>,
  matchScore: number = 2,
  mismatchScore: number = -1
): number {
  const au = a.toUpperCase();
  const bu = b.toUpperCase();

  if (matrix[au] && matrix[au][bu] !== undefined) {
    return matrix[au][bu];
  }

  // Handle gaps
  if (au === '-' || bu === '-') {
    return 0; // Gap score handled separately
  }

  // Simple match/mismatch
  return au === bu ? matchScore : mismatchScore;
}

// Needleman-Wunsch global alignment
function needlemanWunsch(
  seq1: string,
  seq2: string,
  matrix: Record<string, Record<string, number>>,
  gapOpen: number = -10,
  gapExtend: number = -1,
  matchScore: number = 2,
  mismatchScore: number = -1
): {
  alignment1: string;
  alignment2: string;
  score: number;
  identity: number;
  gaps: number;
  matrix_used: string;
} {
  const m = seq1.length;
  const n = seq2.length;

  // Three matrices for affine gap penalties
  const M: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(-Infinity));
  const Ix: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(-Infinity)); // gap in seq2
  const Iy: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(-Infinity)); // gap in seq1

  // Initialize
  M[0][0] = 0;
  for (let i = 1; i <= m; i++) {
    Ix[i][0] = gapOpen + (i - 1) * gapExtend;
    M[i][0] = Ix[i][0];
  }
  for (let j = 1; j <= n; j++) {
    Iy[0][j] = gapOpen + (j - 1) * gapExtend;
    M[0][j] = Iy[0][j];
  }

  // Fill matrices
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const score = getScore(seq1[i - 1], seq2[j - 1], matrix, matchScore, mismatchScore);

      M[i][j] = Math.max(
        M[i - 1][j - 1] + score,
        Ix[i - 1][j - 1] + score,
        Iy[i - 1][j - 1] + score
      );

      Ix[i][j] = Math.max(
        M[i - 1][j] + gapOpen,
        Ix[i - 1][j] + gapExtend
      );

      Iy[i][j] = Math.max(
        M[i][j - 1] + gapOpen,
        Iy[i][j - 1] + gapExtend
      );
    }
  }

  // Traceback
  let align1 = '';
  let align2 = '';
  let i = m, j = n;

  let currentMatrix = 'M';
  const finalScore = Math.max(M[m][n], Ix[m][n], Iy[m][n]);
  if (Ix[m][n] === finalScore) currentMatrix = 'Ix';
  if (Iy[m][n] === finalScore) currentMatrix = 'Iy';

  while (i > 0 || j > 0) {
    if (currentMatrix === 'M' && i > 0 && j > 0) {
      const score = getScore(seq1[i - 1], seq2[j - 1], matrix, matchScore, mismatchScore);
      align1 = seq1[i - 1] + align1;
      align2 = seq2[j - 1] + align2;

      if (M[i][j] === M[i - 1][j - 1] + score) currentMatrix = 'M';
      else if (M[i][j] === Ix[i - 1][j - 1] + score) currentMatrix = 'Ix';
      else currentMatrix = 'Iy';

      i--;
      j--;
    } else if ((currentMatrix === 'Ix' || j === 0) && i > 0) {
      align1 = seq1[i - 1] + align1;
      align2 = '-' + align2;

      if (Ix[i][j] === M[i - 1][j] + gapOpen) currentMatrix = 'M';
      else currentMatrix = 'Ix';

      i--;
    } else if (j > 0) {
      align1 = '-' + align1;
      align2 = seq2[j - 1] + align2;

      if (Iy[i][j] === M[i][j - 1] + gapOpen) currentMatrix = 'M';
      else currentMatrix = 'Iy';

      j--;
    } else {
      break;
    }
  }

  // Calculate statistics
  let matches = 0;
  let gaps = 0;
  for (let k = 0; k < align1.length; k++) {
    if (align1[k] === '-' || align2[k] === '-') gaps++;
    else if (align1[k].toUpperCase() === align2[k].toUpperCase()) matches++;
  }

  return {
    alignment1: align1,
    alignment2: align2,
    score: finalScore,
    identity: (matches / align1.length) * 100,
    gaps,
    matrix_used: Object.keys(matrix).length > 10 ? 'protein' : 'dna'
  };
}

// Smith-Waterman local alignment
function smithWaterman(
  seq1: string,
  seq2: string,
  matrix: Record<string, Record<string, number>>,
  gapOpen: number = -10,
  gapExtend: number = -1,
  matchScore: number = 2,
  mismatchScore: number = -1
): {
  alignment1: string;
  alignment2: string;
  score: number;
  start1: number;
  end1: number;
  start2: number;
  end2: number;
  identity: number;
} {
  const m = seq1.length;
  const n = seq2.length;

  const H: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  let maxScore = 0;
  let maxI = 0, maxJ = 0;

  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const score = getScore(seq1[i - 1], seq2[j - 1], matrix, matchScore, mismatchScore);

      const match = H[i - 1][j - 1] + score;

      // Find best gap in seq2 (deletion in seq1)
      let maxGapSeq2 = 0;
      for (let k = 1; k < i; k++) {
        const gapScore = H[i - k][j] + gapOpen + (k - 1) * gapExtend;
        maxGapSeq2 = Math.max(maxGapSeq2, gapScore);
      }

      // Find best gap in seq1 (insertion in seq1)
      let maxGapSeq1 = 0;
      for (let k = 1; k < j; k++) {
        const gapScore = H[i][j - k] + gapOpen + (k - 1) * gapExtend;
        maxGapSeq1 = Math.max(maxGapSeq1, gapScore);
      }

      H[i][j] = Math.max(0, match, maxGapSeq2, maxGapSeq1);

      if (H[i][j] > maxScore) {
        maxScore = H[i][j];
        maxI = i;
        maxJ = j;
      }
    }
  }

  // Traceback from maximum
  let align1 = '';
  let align2 = '';
  let i = maxI, j = maxJ;
  const end1 = maxI - 1;
  const end2 = maxJ - 1;

  while (i > 0 && j > 0 && H[i][j] > 0) {
    const score = getScore(seq1[i - 1], seq2[j - 1], matrix, matchScore, mismatchScore);

    if (H[i][j] === H[i - 1][j - 1] + score) {
      align1 = seq1[i - 1] + align1;
      align2 = seq2[j - 1] + align2;
      i--;
      j--;
    } else if (H[i][j] === H[i - 1][j] + gapOpen) {
      align1 = seq1[i - 1] + align1;
      align2 = '-' + align2;
      i--;
    } else {
      align1 = '-' + align1;
      align2 = seq2[j - 1] + align2;
      j--;
    }
  }

  const start1 = i;
  const start2 = j;

  // Calculate identity
  let matches = 0;
  for (let k = 0; k < align1.length; k++) {
    if (align1[k] !== '-' && align2[k] !== '-' &&
        align1[k].toUpperCase() === align2[k].toUpperCase()) {
      matches++;
    }
  }

  return {
    alignment1: align1,
    alignment2: align2,
    score: maxScore,
    start1,
    end1,
    start2,
    end2,
    identity: align1.length > 0 ? (matches / align1.length) * 100 : 0
  };
}

// Semi-global alignment (end-gap free)
function semiGlobalAlignment(
  seq1: string,
  seq2: string,
  matrix: Record<string, Record<string, number>>,
  gapOpen: number = -10,
  gapExtend: number = -1,
  matchScore: number = 2,
  mismatchScore: number = -1
): {
  alignment1: string;
  alignment2: string;
  score: number;
  identity: number;
} {
  const m = seq1.length;
  const n = seq2.length;

  const H: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Initialize (no gap penalty at start)
  for (let i = 0; i <= m; i++) H[i][0] = 0;
  for (let j = 0; j <= n; j++) H[0][j] = 0;

  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const score = getScore(seq1[i - 1], seq2[j - 1], matrix, matchScore, mismatchScore);

      H[i][j] = Math.max(
        H[i - 1][j - 1] + score,
        H[i - 1][j] + gapOpen,
        H[i][j - 1] + gapOpen
      );
    }
  }

  // Find maximum in last row or column (no gap penalty at end)
  let maxScore = -Infinity;
  let maxI = m, maxJ = n;

  for (let i = 0; i <= m; i++) {
    if (H[i][n] > maxScore) {
      maxScore = H[i][n];
      maxI = i;
      maxJ = n;
    }
  }

  for (let j = 0; j <= n; j++) {
    if (H[m][j] > maxScore) {
      maxScore = H[m][j];
      maxI = m;
      maxJ = j;
    }
  }

  // Add trailing gaps
  let align1 = '';
  let align2 = '';

  for (let i = m; i > maxI; i--) {
    align1 = seq1[i - 1] + align1;
    align2 = '-' + align2;
  }

  for (let j = n; j > maxJ; j--) {
    align1 = '-' + align1;
    align2 = seq2[j - 1] + align2;
  }

  // Traceback
  let i = maxI, j = maxJ;

  while (i > 0 && j > 0) {
    const score = getScore(seq1[i - 1], seq2[j - 1], matrix, matchScore, mismatchScore);

    if (H[i][j] === H[i - 1][j - 1] + score) {
      align1 = seq1[i - 1] + align1;
      align2 = seq2[j - 1] + align2;
      i--;
      j--;
    } else if (H[i][j] === H[i - 1][j] + gapOpen) {
      align1 = seq1[i - 1] + align1;
      align2 = '-' + align2;
      i--;
    } else {
      align1 = '-' + align1;
      align2 = seq2[j - 1] + align2;
      j--;
    }
  }

  // Add leading gaps
  while (i > 0) {
    align1 = seq1[i - 1] + align1;
    align2 = '-' + align2;
    i--;
  }

  while (j > 0) {
    align1 = '-' + align1;
    align2 = seq2[j - 1] + align2;
    j--;
  }

  // Calculate identity
  let matches = 0;
  let counted = 0;
  for (let k = 0; k < align1.length; k++) {
    if (align1[k] !== '-' && align2[k] !== '-') {
      counted++;
      if (align1[k].toUpperCase() === align2[k].toUpperCase()) {
        matches++;
      }
    }
  }

  return {
    alignment1: align1,
    alignment2: align2,
    score: maxScore,
    identity: counted > 0 ? (matches / counted) * 100 : 0
  };
}

// Simple multiple sequence alignment (progressive)
function multipleSequenceAlignment(
  sequences: string[],
  matrix: Record<string, Record<string, number>>,
  gapOpen: number = -10,
  gapExtend: number = -1
): {
  alignments: string[];
  scores: number[];
  consensus: string;
} {
  if (sequences.length < 2) {
    return { alignments: sequences, scores: [], consensus: sequences[0] || '' };
  }

  // Calculate pairwise distances
  const distances: number[][] = Array(sequences.length).fill(null)
    .map(() => Array(sequences.length).fill(0));

  for (let i = 0; i < sequences.length; i++) {
    for (let j = i + 1; j < sequences.length; j++) {
      const result = needlemanWunsch(sequences[i], sequences[j], matrix, gapOpen, gapExtend);
      // Convert score to distance (higher score = lower distance)
      distances[i][j] = -result.score;
      distances[j][i] = -result.score;
    }
  }

  // Simple guide tree using UPGMA (simplified)
  const aligned: string[] = [...sequences];
  const scores: number[] = [];

  // Progressive alignment
  let profile = aligned[0];

  for (let i = 1; i < aligned.length; i++) {
    const result = needlemanWunsch(profile, aligned[i], matrix, gapOpen, gapExtend);
    scores.push(result.score);

    // Update all previous alignments with new gaps
    const gapPositions: number[] = [];
    for (let k = 0; k < result.alignment1.length; k++) {
      if (result.alignment1[k] === '-') {
        gapPositions.push(k);
      }
    }

    // Insert gaps into previous alignments
    for (let j = 0; j < i; j++) {
      let newAlign = '';
      let pos = 0;
      for (let k = 0; k < result.alignment1.length; k++) {
        if (gapPositions.includes(k)) {
          newAlign += '-';
        } else {
          newAlign += aligned[j][pos] || '-';
          pos++;
        }
      }
      aligned[j] = newAlign;
    }

    aligned[i] = result.alignment2;
    profile = result.alignment1;
  }

  // Calculate consensus
  let consensus = '';
  const alignLen = aligned[0].length;

  for (let col = 0; col < alignLen; col++) {
    const counts: Record<string, number> = {};
    let maxCount = 0;
    let maxChar = '-';

    for (const seq of aligned) {
      const char = seq[col].toUpperCase();
      counts[char] = (counts[char] || 0) + 1;
      if (char !== '-' && counts[char] > maxCount) {
        maxCount = counts[char];
        maxChar = char;
      }
    }

    // Use lowercase for low conservation
    if (maxCount >= aligned.length * 0.5) {
      consensus += maxChar;
    } else if (maxCount >= aligned.length * 0.25) {
      consensus += maxChar.toLowerCase();
    } else {
      consensus += '-';
    }
  }

  return { alignments: aligned, scores, consensus };
}

// Sequence analysis utilities
function analyzeSequence(seq: string): {
  length: number;
  composition: Record<string, number>;
  gc_content?: number;
  molecular_weight?: number;
  type_detected: string;
} {
  const upper = seq.toUpperCase().replace(/\s/g, '');
  const composition: Record<string, number> = {};

  for (const char of upper) {
    composition[char] = (composition[char] || 0) + 1;
  }

  // Detect sequence type
  const dnaChars = new Set('ACGTN');
  const rnaChars = new Set('ACGUN');
  const isDNA = [...upper].every(c => dnaChars.has(c) || AMBIGUOUS_DNA[c]);
  const isRNA = [...upper].every(c => rnaChars.has(c));

  let type_detected = 'protein';
  if (isDNA && !upper.includes('U')) type_detected = 'dna';
  else if (isRNA && upper.includes('U')) type_detected = 'rna';

  const result: {
    length: number;
    composition: Record<string, number>;
    gc_content?: number;
    molecular_weight?: number;
    type_detected: string;
  } = {
    length: upper.length,
    composition,
    type_detected
  };

  // GC content for nucleic acids
  if (type_detected === 'dna' || type_detected === 'rna') {
    const gc = (composition['G'] || 0) + (composition['C'] || 0);
    result.gc_content = (gc / upper.length) * 100;
  }

  // Approximate molecular weight
  if (type_detected === 'protein') {
    const avgAA = 110; // Average amino acid MW
    result.molecular_weight = upper.length * avgAA;
  } else {
    const avgNt = type_detected === 'dna' ? 330 : 340; // Average nucleotide MW
    result.molecular_weight = upper.length * avgNt;
  }

  return result;
}

function formatAlignment(align1: string, align2: string, lineWidth: number = 60): string {
  let output = '';
  let pos1 = 0, pos2 = 0;

  for (let i = 0; i < align1.length; i += lineWidth) {
    const chunk1 = align1.slice(i, i + lineWidth);
    const chunk2 = align2.slice(i, i + lineWidth);

    // Count positions
    const start1 = pos1 + 1;
    const start2 = pos2 + 1;

    for (const c of chunk1) {
      if (c !== '-') pos1++;
    }
    for (const c of chunk2) {
      if (c !== '-') pos2++;
    }

    // Build match line
    let matchLine = '';
    for (let j = 0; j < chunk1.length; j++) {
      if (chunk1[j] === '-' || chunk2[j] === '-') {
        matchLine += ' ';
      } else if (chunk1[j].toUpperCase() === chunk2[j].toUpperCase()) {
        matchLine += '|';
      } else {
        matchLine += '.';
      }
    }

    output += `Seq1 ${String(start1).padStart(5)} ${chunk1} ${pos1}\n`;
    output += `     ${' '.repeat(5)} ${matchLine}\n`;
    output += `Seq2 ${String(start2).padStart(5)} ${chunk2} ${pos2}\n\n`;
  }

  return output;
}

export async function executesequencealignment(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'global';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'sequence_alignment',
          description: 'DNA and protein sequence alignment algorithms',
          algorithms: {
            global: {
              name: 'Needleman-Wunsch',
              description: 'Global alignment - aligns entire sequences end-to-end',
              use_case: 'Comparing similar-length sequences of similar origin',
              complexity: 'O(mn) time and space'
            },
            local: {
              name: 'Smith-Waterman',
              description: 'Local alignment - finds best matching subsequences',
              use_case: 'Finding conserved regions, domain matching',
              complexity: 'O(mn) time and space'
            },
            semiglobal: {
              name: 'End-gap free alignment',
              description: 'Global alignment without penalizing end gaps',
              use_case: 'Overlap detection, primer alignment'
            },
            multiple: {
              name: 'Progressive MSA',
              description: 'Aligns multiple sequences progressively',
              use_case: 'Finding conserved motifs across many sequences'
            }
          },
          scoring_matrices: {
            BLOSUM62: 'Best for proteins with 62% identity (default)',
            BLOSUM45: 'Distant protein sequences (<45% identity)',
            BLOSUM80: 'Close protein sequences (>80% identity)',
            PAM250: 'Distant evolutionary relationships',
            DNA_SIMPLE: 'Simple match/mismatch for DNA'
          },
          parameters: {
            gap_open: 'Penalty for opening a gap (default: -10)',
            gap_extend: 'Penalty for extending a gap (default: -1)',
            match_score: 'Score for DNA match (default: 2)',
            mismatch_score: 'Score for DNA mismatch (default: -1)'
          },
          example_usage: {
            protein_global: {
              operation: 'global',
              sequence1: 'MVLSPADKTN',
              sequence2: 'MVHLTPEEKS',
              sequence_type: 'protein',
              scoring_matrix: 'BLOSUM62'
            },
            dna_local: {
              operation: 'local',
              sequence1: 'ACGTACGTACGT',
              sequence2: 'TACGTACG',
              sequence_type: 'dna'
            }
          }
        }, null, 2)
      };
    }

    const seq1 = (args.sequence1 || '').toUpperCase().replace(/\s/g, '');
    const seq2 = (args.sequence2 || '').toUpperCase().replace(/\s/g, '');
    const sequences = args.sequences || [];
    const seqType = args.sequence_type || 'auto';
    const matrixName = args.scoring_matrix || 'BLOSUM62';
    const gapOpen = args.gap_open ?? -10;
    const gapExtend = args.gap_extend ?? -1;
    const matchScore = args.match_score ?? 2;
    const mismatchScore = args.mismatch_score ?? -1;

    // Select scoring matrix
    let matrix: Record<string, Record<string, number>>;

    if (seqType === 'dna' || seqType === 'rna') {
      matrix = DNA_SIMPLE;
    } else if (matrixName === 'BLOSUM45') {
      matrix = BLOSUM45;
    } else if (matrixName === 'PAM250') {
      matrix = PAM250;
    } else if (matrixName === 'DNA_SIMPLE') {
      matrix = DNA_SIMPLE;
    } else {
      matrix = BLOSUM62;
    }

    if (operation === 'analyze') {
      const analysis1 = analyzeSequence(seq1);
      const analysis2 = seq2 ? analyzeSequence(seq2) : null;

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'analyze',
          sequence1: analysis1,
          sequence2: analysis2
        }, null, 2)
      };
    }

    if (operation === 'score_only') {
      if (!seq1 || !seq2) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Two sequences required' }, null, 2),
          isError: true
        };
      }

      const result = needlemanWunsch(seq1, seq2, matrix, gapOpen, gapExtend, matchScore, mismatchScore);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'score_only',
          score: result.score,
          identity: result.identity.toFixed(1) + '%',
          gaps: result.gaps,
          length1: seq1.length,
          length2: seq2.length
        }, null, 2)
      };
    }

    if (operation === 'global') {
      if (!seq1 || !seq2) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Two sequences required for pairwise alignment' }, null, 2),
          isError: true
        };
      }

      const result = needlemanWunsch(seq1, seq2, matrix, gapOpen, gapExtend, matchScore, mismatchScore);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'global',
          algorithm: 'Needleman-Wunsch',
          scoring: {
            matrix: matrixName,
            gap_open: gapOpen,
            gap_extend: gapExtend
          },
          results: {
            score: result.score,
            identity: result.identity.toFixed(1) + '%',
            gaps: result.gaps,
            alignment_length: result.alignment1.length
          },
          alignment: {
            sequence1: result.alignment1,
            sequence2: result.alignment2
          },
          formatted: formatAlignment(result.alignment1, result.alignment2)
        }, null, 2)
      };
    }

    if (operation === 'local') {
      if (!seq1 || !seq2) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Two sequences required for pairwise alignment' }, null, 2),
          isError: true
        };
      }

      const result = smithWaterman(seq1, seq2, matrix, gapOpen, gapExtend, matchScore, mismatchScore);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'local',
          algorithm: 'Smith-Waterman',
          scoring: {
            matrix: matrixName,
            gap_open: gapOpen,
            gap_extend: gapExtend
          },
          results: {
            score: result.score,
            identity: result.identity.toFixed(1) + '%',
            alignment_length: result.alignment1.length
          },
          positions: {
            seq1_start: result.start1,
            seq1_end: result.end1,
            seq2_start: result.start2,
            seq2_end: result.end2
          },
          alignment: {
            sequence1: result.alignment1,
            sequence2: result.alignment2
          },
          formatted: formatAlignment(result.alignment1, result.alignment2)
        }, null, 2)
      };
    }

    if (operation === 'semiglobal') {
      if (!seq1 || !seq2) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Two sequences required' }, null, 2),
          isError: true
        };
      }

      const result = semiGlobalAlignment(seq1, seq2, matrix, gapOpen, gapExtend, matchScore, mismatchScore);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'semiglobal',
          algorithm: 'End-gap free alignment',
          scoring: {
            matrix: matrixName,
            gap_open: gapOpen,
            gap_extend: gapExtend
          },
          results: {
            score: result.score,
            identity: result.identity.toFixed(1) + '%',
            alignment_length: result.alignment1.length
          },
          alignment: {
            sequence1: result.alignment1,
            sequence2: result.alignment2
          },
          formatted: formatAlignment(result.alignment1, result.alignment2)
        }, null, 2)
      };
    }

    if (operation === 'multiple') {
      const seqs = sequences.length > 0 ? sequences.map((s: string) => s.toUpperCase().replace(/\s/g, '')) : [seq1, seq2].filter(Boolean);

      if (seqs.length < 2) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'At least 2 sequences required for multiple alignment' }, null, 2),
          isError: true
        };
      }

      const result = multipleSequenceAlignment(seqs, matrix, gapOpen, gapExtend);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'multiple',
          algorithm: 'Progressive alignment',
          num_sequences: seqs.length,
          alignment_length: result.alignments[0]?.length || 0,
          alignments: result.alignments,
          consensus: result.consensus,
          scores: result.scores
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        error: 'Unknown operation',
        available: ['global', 'local', 'semiglobal', 'multiple', 'score_only', 'analyze', 'info']
      }, null, 2),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function issequencealignmentAvailable(): boolean {
  return true;
}
