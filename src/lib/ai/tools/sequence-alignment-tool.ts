/**
 * SEQUENCE-ALIGNMENT TOOL
 * DNA/protein sequence alignment with real dynamic programming algorithms
 * Implements Needleman-Wunsch (global) and Smith-Waterman (local) alignment
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const sequencealignmentTool: UnifiedTool = {
  name: 'sequence_alignment',
  description: 'DNA and protein sequence alignment (Needleman-Wunsch, Smith-Waterman)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['global', 'local', 'multiple', 'score_only', 'info'], description: 'Operation' },
      algorithm: { type: 'string', enum: ['needleman_wunsch', 'smith_waterman'], description: 'Algorithm' },
      seq1: { type: 'string', description: 'First sequence' },
      seq2: { type: 'string', description: 'Second sequence' },
      sequences: { type: 'array', items: { type: 'string' }, description: 'Multiple sequences for MSA' },
      match: { type: 'number', description: 'Match score' },
      mismatch: { type: 'number', description: 'Mismatch penalty' },
      gap_open: { type: 'number', description: 'Gap opening penalty' },
      gap_extend: { type: 'number', description: 'Gap extension penalty' },
      is_protein: { type: 'boolean', description: 'Whether sequences are protein' }
    },
    required: ['operation']
  }
};

// BLOSUM62 scoring matrix (simplified subset)
const BLOSUM62: { [key: string]: { [key: string]: number } } = {
  'A': { 'A': 4, 'R': -1, 'N': -2, 'D': -2, 'C': 0, 'Q': -1, 'E': -1, 'G': 0, 'H': -2, 'I': -1, 'L': -1, 'K': -1, 'M': -1, 'F': -2, 'P': -1, 'S': 1, 'T': 0, 'W': -3, 'Y': -2, 'V': 0 },
  'R': { 'A': -1, 'R': 5, 'N': 0, 'D': -2, 'C': -3, 'Q': 1, 'E': 0, 'G': -2, 'H': 0, 'I': -3, 'L': -2, 'K': 2, 'M': -1, 'F': -3, 'P': -2, 'S': -1, 'T': -1, 'W': -3, 'Y': -2, 'V': -3 },
  'N': { 'A': -2, 'R': 0, 'N': 6, 'D': 1, 'C': -3, 'Q': 0, 'E': 0, 'G': 0, 'H': 1, 'I': -3, 'L': -3, 'K': 0, 'M': -2, 'F': -3, 'P': -2, 'S': 1, 'T': 0, 'W': -4, 'Y': -2, 'V': -3 },
  'D': { 'A': -2, 'R': -2, 'N': 1, 'D': 6, 'C': -3, 'Q': 0, 'E': 2, 'G': -1, 'H': -1, 'I': -3, 'L': -4, 'K': -1, 'M': -3, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -4, 'Y': -3, 'V': -3 },
  'C': { 'A': 0, 'R': -3, 'N': -3, 'D': -3, 'C': 9, 'Q': -3, 'E': -4, 'G': -3, 'H': -3, 'I': -1, 'L': -1, 'K': -3, 'M': -1, 'F': -2, 'P': -3, 'S': -1, 'T': -1, 'W': -2, 'Y': -2, 'V': -1 },
  'Q': { 'A': -1, 'R': 1, 'N': 0, 'D': 0, 'C': -3, 'Q': 5, 'E': 2, 'G': -2, 'H': 0, 'I': -3, 'L': -2, 'K': 1, 'M': 0, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -2, 'Y': -1, 'V': -2 },
  'E': { 'A': -1, 'R': 0, 'N': 0, 'D': 2, 'C': -4, 'Q': 2, 'E': 5, 'G': -2, 'H': 0, 'I': -3, 'L': -3, 'K': 1, 'M': -2, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -3, 'Y': -2, 'V': -2 },
  'G': { 'A': 0, 'R': -2, 'N': 0, 'D': -1, 'C': -3, 'Q': -2, 'E': -2, 'G': 6, 'H': -2, 'I': -4, 'L': -4, 'K': -2, 'M': -3, 'F': -3, 'P': -2, 'S': 0, 'T': -2, 'W': -2, 'Y': -3, 'V': -3 },
  'H': { 'A': -2, 'R': 0, 'N': 1, 'D': -1, 'C': -3, 'Q': 0, 'E': 0, 'G': -2, 'H': 8, 'I': -3, 'L': -3, 'K': -1, 'M': -2, 'F': -1, 'P': -2, 'S': -1, 'T': -2, 'W': -2, 'Y': 2, 'V': -3 },
  'I': { 'A': -1, 'R': -3, 'N': -3, 'D': -3, 'C': -1, 'Q': -3, 'E': -3, 'G': -4, 'H': -3, 'I': 4, 'L': 2, 'K': -3, 'M': 1, 'F': 0, 'P': -3, 'S': -2, 'T': -1, 'W': -3, 'Y': -1, 'V': 3 },
  'L': { 'A': -1, 'R': -2, 'N': -3, 'D': -4, 'C': -1, 'Q': -2, 'E': -3, 'G': -4, 'H': -3, 'I': 2, 'L': 4, 'K': -2, 'M': 2, 'F': 0, 'P': -3, 'S': -2, 'T': -1, 'W': -2, 'Y': -1, 'V': 1 },
  'K': { 'A': -1, 'R': 2, 'N': 0, 'D': -1, 'C': -3, 'Q': 1, 'E': 1, 'G': -2, 'H': -1, 'I': -3, 'L': -2, 'K': 5, 'M': -1, 'F': -3, 'P': -1, 'S': 0, 'T': -1, 'W': -3, 'Y': -2, 'V': -2 },
  'M': { 'A': -1, 'R': -1, 'N': -2, 'D': -3, 'C': -1, 'Q': 0, 'E': -2, 'G': -3, 'H': -2, 'I': 1, 'L': 2, 'K': -1, 'M': 5, 'F': 0, 'P': -2, 'S': -1, 'T': -1, 'W': -1, 'Y': -1, 'V': 1 },
  'F': { 'A': -2, 'R': -3, 'N': -3, 'D': -3, 'C': -2, 'Q': -3, 'E': -3, 'G': -3, 'H': -1, 'I': 0, 'L': 0, 'K': -3, 'M': 0, 'F': 6, 'P': -4, 'S': -2, 'T': -2, 'W': 1, 'Y': 3, 'V': -1 },
  'P': { 'A': -1, 'R': -2, 'N': -2, 'D': -1, 'C': -3, 'Q': -1, 'E': -1, 'G': -2, 'H': -2, 'I': -3, 'L': -3, 'K': -1, 'M': -2, 'F': -4, 'P': 7, 'S': -1, 'T': -1, 'W': -4, 'Y': -3, 'V': -2 },
  'S': { 'A': 1, 'R': -1, 'N': 1, 'D': 0, 'C': -1, 'Q': 0, 'E': 0, 'G': 0, 'H': -1, 'I': -2, 'L': -2, 'K': 0, 'M': -1, 'F': -2, 'P': -1, 'S': 4, 'T': 1, 'W': -3, 'Y': -2, 'V': -2 },
  'T': { 'A': 0, 'R': -1, 'N': 0, 'D': -1, 'C': -1, 'Q': -1, 'E': -1, 'G': -2, 'H': -2, 'I': -1, 'L': -1, 'K': -1, 'M': -1, 'F': -2, 'P': -1, 'S': 1, 'T': 5, 'W': -2, 'Y': -2, 'V': 0 },
  'W': { 'A': -3, 'R': -3, 'N': -4, 'D': -4, 'C': -2, 'Q': -2, 'E': -3, 'G': -2, 'H': -2, 'I': -3, 'L': -2, 'K': -3, 'M': -1, 'F': 1, 'P': -4, 'S': -3, 'T': -2, 'W': 11, 'Y': 2, 'V': -3 },
  'Y': { 'A': -2, 'R': -2, 'N': -2, 'D': -3, 'C': -2, 'Q': -1, 'E': -2, 'G': -3, 'H': 2, 'I': -1, 'L': -1, 'K': -2, 'M': -1, 'F': 3, 'P': -3, 'S': -2, 'T': -2, 'W': 2, 'Y': 7, 'V': -1 },
  'V': { 'A': 0, 'R': -3, 'N': -3, 'D': -3, 'C': -1, 'Q': -2, 'E': -2, 'G': -3, 'H': -3, 'I': 3, 'L': 1, 'K': -2, 'M': 1, 'F': -1, 'P': -2, 'S': -2, 'T': 0, 'W': -3, 'Y': -1, 'V': 4 }
};

// Scoring function
function score(a: string, b: string, isProtein: boolean, match: number, mismatch: number): number {
  const A = a.toUpperCase();
  const B = b.toUpperCase();

  if (isProtein && BLOSUM62[A] && BLOSUM62[A][B] !== undefined) {
    return BLOSUM62[A][B];
  }

  return A === B ? match : mismatch;
}

interface AlignmentResult {
  score: number;
  seq1Aligned: string;
  seq2Aligned: string;
  midline: string;
  startPos1: number;
  endPos1: number;
  startPos2: number;
  endPos2: number;
  identity: number;
  similarity: number;
  gaps: number;
}

// Needleman-Wunsch global alignment
function needlemanWunsch(
  seq1: string,
  seq2: string,
  isProtein: boolean,
  matchScore: number,
  mismatchPenalty: number,
  gapPenalty: number
): AlignmentResult {
  const m = seq1.length;
  const n = seq2.length;

  // Initialize score matrix
  const F: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Initialize first row and column with gap penalties
  for (let i = 0; i <= m; i++) F[i][0] = i * gapPenalty;
  for (let j = 0; j <= n; j++) F[0][j] = j * gapPenalty;

  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const matchMismatch = F[i - 1][j - 1] + score(seq1[i - 1], seq2[j - 1], isProtein, matchScore, mismatchPenalty);
      const delete_ = F[i - 1][j] + gapPenalty;
      const insert = F[i][j - 1] + gapPenalty;
      F[i][j] = Math.max(matchMismatch, delete_, insert);
    }
  }

  // Traceback
  let seq1Aligned = '';
  let seq2Aligned = '';
  let midline = '';
  let i = m;
  let j = n;
  let identity = 0;
  let similarity = 0;
  let gaps = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const s = score(seq1[i - 1], seq2[j - 1], isProtein, matchScore, mismatchPenalty);
      if (F[i][j] === F[i - 1][j - 1] + s) {
        seq1Aligned = seq1[i - 1] + seq1Aligned;
        seq2Aligned = seq2[j - 1] + seq2Aligned;
        if (seq1[i - 1].toUpperCase() === seq2[j - 1].toUpperCase()) {
          midline = '|' + midline;
          identity++;
          similarity++;
        } else if (s > 0) {
          midline = ':' + midline;
          similarity++;
        } else {
          midline = '.' + midline;
        }
        i--;
        j--;
        continue;
      }
    }

    if (i > 0 && F[i][j] === F[i - 1][j] + gapPenalty) {
      seq1Aligned = seq1[i - 1] + seq1Aligned;
      seq2Aligned = '-' + seq2Aligned;
      midline = ' ' + midline;
      gaps++;
      i--;
    } else {
      seq1Aligned = '-' + seq1Aligned;
      seq2Aligned = seq2[j - 1] + seq2Aligned;
      midline = ' ' + midline;
      gaps++;
      j--;
    }
  }

  const alignLen = seq1Aligned.length;

  return {
    score: F[m][n],
    seq1Aligned,
    seq2Aligned,
    midline,
    startPos1: 1,
    endPos1: m,
    startPos2: 1,
    endPos2: n,
    identity: alignLen > 0 ? identity / alignLen : 0,
    similarity: alignLen > 0 ? similarity / alignLen : 0,
    gaps
  };
}

// Smith-Waterman local alignment
function smithWaterman(
  seq1: string,
  seq2: string,
  isProtein: boolean,
  matchScore: number,
  mismatchPenalty: number,
  gapOpen: number,
  gapExtend: number
): AlignmentResult {
  const m = seq1.length;
  const n = seq2.length;

  // Initialize matrices for affine gap penalties
  const H: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  const E: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(-Infinity));
  const F_mat: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(-Infinity));

  let maxScore = 0;
  let maxI = 0;
  let maxJ = 0;

  // Fill matrices
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      // Gap in seq1 (horizontal)
      E[i][j] = Math.max(
        H[i][j - 1] + gapOpen + gapExtend,
        E[i][j - 1] + gapExtend
      );

      // Gap in seq2 (vertical)
      F_mat[i][j] = Math.max(
        H[i - 1][j] + gapOpen + gapExtend,
        F_mat[i - 1][j] + gapExtend
      );

      // Match/mismatch
      const s = score(seq1[i - 1], seq2[j - 1], isProtein, matchScore, mismatchPenalty);

      H[i][j] = Math.max(0, H[i - 1][j - 1] + s, E[i][j], F_mat[i][j]);

      if (H[i][j] > maxScore) {
        maxScore = H[i][j];
        maxI = i;
        maxJ = j;
      }
    }
  }

  // Traceback from maximum
  let seq1Aligned = '';
  let seq2Aligned = '';
  let midline = '';
  let i = maxI;
  let j = maxJ;
  let identity = 0;
  let similarity = 0;
  let gaps = 0;

  while (i > 0 && j > 0 && H[i][j] > 0) {
    const s = score(seq1[i - 1], seq2[j - 1], isProtein, matchScore, mismatchPenalty);

    if (H[i][j] === H[i - 1][j - 1] + s) {
      seq1Aligned = seq1[i - 1] + seq1Aligned;
      seq2Aligned = seq2[j - 1] + seq2Aligned;
      if (seq1[i - 1].toUpperCase() === seq2[j - 1].toUpperCase()) {
        midline = '|' + midline;
        identity++;
        similarity++;
      } else if (s > 0) {
        midline = ':' + midline;
        similarity++;
      } else {
        midline = '.' + midline;
      }
      i--;
      j--;
    } else if (H[i][j] === E[i][j]) {
      seq1Aligned = '-' + seq1Aligned;
      seq2Aligned = seq2[j - 1] + seq2Aligned;
      midline = ' ' + midline;
      gaps++;
      j--;
    } else {
      seq1Aligned = seq1[i - 1] + seq1Aligned;
      seq2Aligned = '-' + seq2Aligned;
      midline = ' ' + midline;
      gaps++;
      i--;
    }
  }

  const alignLen = seq1Aligned.length;

  return {
    score: maxScore,
    seq1Aligned,
    seq2Aligned,
    midline,
    startPos1: i + 1,
    endPos1: maxI,
    startPos2: j + 1,
    endPos2: maxJ,
    identity: alignLen > 0 ? identity / alignLen : 0,
    similarity: alignLen > 0 ? similarity / alignLen : 0,
    gaps
  };
}

// Simple progressive multiple sequence alignment
function multipleAlignment(sequences: string[], isProtein: boolean): {
  aligned: string[];
  consensus: string;
} {
  if (sequences.length === 0) return { aligned: [], consensus: '' };
  if (sequences.length === 1) return { aligned: sequences, consensus: sequences[0] };

  // Start with first sequence
  let profile = sequences[0];

  // Progressively add sequences
  const aligned: string[] = [sequences[0]];

  for (let i = 1; i < sequences.length; i++) {
    const result = needlemanWunsch(profile, sequences[i], isProtein, 2, -1, -2);

    // Update aligned sequences with new gaps
    const newAligned: string[] = [];
    let profileIdx = 0;

    for (const seq of aligned) {
      let newSeq = '';
      let seqIdx = 0;

      for (let j = 0; j < result.seq1Aligned.length; j++) {
        if (result.seq1Aligned[j] === '-') {
          newSeq += '-';
        } else {
          newSeq += seqIdx < seq.length ? seq[seqIdx] : '-';
          seqIdx++;
        }
      }
      newAligned.push(newSeq);
    }

    newAligned.push(result.seq2Aligned);
    aligned.length = 0;
    aligned.push(...newAligned);

    // Update profile (simple consensus)
    profile = result.seq1Aligned;
  }

  // Build consensus
  const consensus = Array(aligned[0].length).fill('').map((_, i) => {
    const counts: { [key: string]: number } = {};
    for (const seq of aligned) {
      const char = seq[i].toUpperCase();
      if (char !== '-') {
        counts[char] = (counts[char] || 0) + 1;
      }
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : '-';
  }).join('');

  return { aligned, consensus };
}

// Format alignment for display
function formatAlignment(result: AlignmentResult, name1: string = 'Seq1', name2: string = 'Seq2'): string {
  const lineWidth = 60;
  const lines: string[] = [];

  for (let i = 0; i < result.seq1Aligned.length; i += lineWidth) {
    const s1 = result.seq1Aligned.substring(i, i + lineWidth);
    const mid = result.midline.substring(i, i + lineWidth);
    const s2 = result.seq2Aligned.substring(i, i + lineWidth);

    const pos1 = result.startPos1 + i - (result.seq1Aligned.substring(0, i).match(/-/g) || []).length;
    const pos2 = result.startPos2 + i - (result.seq2Aligned.substring(0, i).match(/-/g) || []).length;

    lines.push(`${name1.substring(0, 8).padEnd(10)} ${pos1.toString().padStart(4)}  ${s1}`);
    lines.push(`${''.padEnd(16)}${mid}`);
    lines.push(`${name2.substring(0, 8).padEnd(10)} ${pos2.toString().padStart(4)}  ${s2}`);
    lines.push('');
  }

  return lines.join('\n');
}

export async function executesequencealignment(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'sequence-alignment',
        description: 'Align DNA or protein sequences to identify similarities',

        algorithms: {
          needleman_wunsch: {
            name: 'Needleman-Wunsch',
            type: 'Global alignment',
            complexity: 'O(mn)',
            description: 'Aligns entire length of both sequences',
            use: 'When sequences are similar length and expected to be related throughout'
          },
          smith_waterman: {
            name: 'Smith-Waterman',
            type: 'Local alignment',
            complexity: 'O(mn)',
            description: 'Finds highest-scoring local alignment',
            use: 'Finding conserved regions in otherwise dissimilar sequences'
          },
          clustal: {
            name: 'Clustal (progressive)',
            type: 'Multiple sequence alignment',
            description: 'Progressively aligns multiple sequences using guide tree'
          }
        },

        scoringSchemes: {
          dna: {
            typical: 'Match: +2, Mismatch: -1, Gap: -2',
            note: 'Simple match/mismatch scoring'
          },
          protein: {
            matrices: ['BLOSUM62', 'BLOSUM80', 'PAM250'],
            note: 'Substitution matrices encode evolutionary relationships'
          }
        },

        gapPenalties: {
          linear: 'g(n) = n × d (constant penalty per gap)',
          affine: 'g(n) = d + (n-1) × e (open + extend)',
          note: 'Affine penalties favor fewer, longer gaps'
        },

        notation: {
          '|': 'Identical residues',
          ':': 'Similar residues (positive score)',
          '.': 'Dissimilar residues',
          '-': 'Gap (insertion/deletion)'
        }
      };

      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Default sequences
    const defaultSeq1 = args.is_protein
      ? 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH'
      : 'ATGCGATCGATCGTAGCTAGCTGATCGATCGATCG';
    const defaultSeq2 = args.is_protein
      ? 'MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVK'
      : 'ATGCGATTGATCGTAGCTACCTGATCGATCGTTCG';

    const seq1 = (args.seq1 || defaultSeq1).toUpperCase().replace(/[^A-Z]/g, '');
    const seq2 = (args.seq2 || defaultSeq2).toUpperCase().replace(/[^A-Z]/g, '');
    const isProtein = args.is_protein !== undefined ? args.is_protein : (seq1.match(/[DEFHIKLMNPQRSTVWY]/g) !== null);

    const matchScore = args.match || (isProtein ? 0 : 2);  // 0 for protein (use BLOSUM)
    const mismatchPenalty = args.mismatch || (isProtein ? 0 : -1);
    const gapOpen = args.gap_open || (isProtein ? -11 : -5);
    const gapExtend = args.gap_extend || (isProtein ? -1 : -1);

    if (operation === 'global') {
      const result = needlemanWunsch(seq1, seq2, isProtein, matchScore, mismatchPenalty, gapOpen);
      const formattedAlignment = formatAlignment(result);

      const output = {
        algorithm: 'Needleman-Wunsch (Global Alignment)',
        sequenceType: isProtein ? 'protein' : 'nucleotide',

        sequences: {
          seq1: { length: seq1.length, preview: seq1.substring(0, 30) + (seq1.length > 30 ? '...' : '') },
          seq2: { length: seq2.length, preview: seq2.substring(0, 30) + (seq2.length > 30 ? '...' : '') }
        },

        parameters: {
          scoringMatrix: isProtein ? 'BLOSUM62' : 'simple match/mismatch',
          match: matchScore,
          mismatch: mismatchPenalty,
          gapPenalty: gapOpen
        },

        results: {
          score: result.score,
          alignmentLength: result.seq1Aligned.length,
          identity: `${(result.identity * 100).toFixed(1)}%`,
          similarity: isProtein ? `${(result.similarity * 100).toFixed(1)}%` : undefined,
          gaps: result.gaps,
          gapPercentage: `${((result.gaps / result.seq1Aligned.length) * 100).toFixed(1)}%`
        },

        alignment: formattedAlignment,

        interpretation: result.identity > 0.7
          ? 'High sequence identity - likely homologous'
          : result.identity > 0.3
          ? 'Moderate similarity - possible distant relationship'
          : 'Low similarity - may not be related'
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'local') {
      const result = smithWaterman(seq1, seq2, isProtein, matchScore, mismatchPenalty, gapOpen, gapExtend);
      const formattedAlignment = formatAlignment(result);

      const output = {
        algorithm: 'Smith-Waterman (Local Alignment)',
        sequenceType: isProtein ? 'protein' : 'nucleotide',

        sequences: {
          seq1: { length: seq1.length },
          seq2: { length: seq2.length }
        },

        parameters: {
          scoringMatrix: isProtein ? 'BLOSUM62' : 'simple match/mismatch',
          gapOpen,
          gapExtend
        },

        localRegion: {
          seq1Range: `${result.startPos1}-${result.endPos1}`,
          seq2Range: `${result.startPos2}-${result.endPos2}`,
          length: result.seq1Aligned.length
        },

        results: {
          score: result.score,
          identity: `${(result.identity * 100).toFixed(1)}%`,
          similarity: isProtein ? `${(result.similarity * 100).toFixed(1)}%` : undefined,
          gaps: result.gaps
        },

        alignment: formattedAlignment,

        interpretation: result.score > 50
          ? 'Strong local similarity found'
          : result.score > 20
          ? 'Moderate local similarity'
          : 'Weak or no significant local similarity'
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'multiple') {
      const sequences = args.sequences || [seq1, seq2, seq2.substring(0, 20) + 'XXX' + seq2.substring(23)];
      const { aligned, consensus } = multipleAlignment(sequences, isProtein);

      // Calculate conservation
      const conservation = Array(aligned[0].length).fill(0).map((_, i) => {
        const chars = aligned.map(s => s[i]);
        const unique = new Set(chars.filter(c => c !== '-'));
        return unique.size === 1 ? '*' : unique.size <= 2 ? ':' : ' ';
      }).join('');

      const output = {
        algorithm: 'Progressive Multiple Sequence Alignment',
        sequenceCount: sequences.length,

        alignedSequences: aligned.map((seq, i) => ({
          name: `Seq${i + 1}`,
          aligned: seq.substring(0, 60) + (seq.length > 60 ? '...' : ''),
          length: seq.length
        })),

        consensus: consensus.substring(0, 60) + (consensus.length > 60 ? '...' : ''),
        conservation: conservation.substring(0, 60) + (conservation.length > 60 ? '...' : ''),

        display: [
          'Multiple Sequence Alignment:',
          ...aligned.map((seq, i) => `Seq${i + 1}`.padEnd(8) + seq.substring(0, 60)),
          '        ' + conservation.substring(0, 60),
          'Cons    ' + consensus.substring(0, 60),
          '',
          'Legend: * = fully conserved, : = mostly conserved'
        ].join('\n'),

        statistics: {
          alignmentLength: aligned[0].length,
          conservedPositions: (conservation.match(/\*/g) || []).length,
          percentConserved: `${(((conservation.match(/\*/g) || []).length / aligned[0].length) * 100).toFixed(1)}%`
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'score_only') {
      const globalResult = needlemanWunsch(seq1, seq2, isProtein, matchScore, mismatchPenalty, gapOpen);
      const localResult = smithWaterman(seq1, seq2, isProtein, matchScore, mismatchPenalty, gapOpen, gapExtend);

      const output = {
        sequences: {
          seq1Length: seq1.length,
          seq2Length: seq2.length
        },

        globalAlignment: {
          score: globalResult.score,
          identity: `${(globalResult.identity * 100).toFixed(1)}%`
        },

        localAlignment: {
          score: localResult.score,
          identity: `${(localResult.identity * 100).toFixed(1)}%`,
          regionLength: localResult.seq1Aligned.length
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    return { toolCallId: id, content: `Unknown operation: ${operation}`, isError: true };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function issequencealignmentAvailable(): boolean { return true; }
