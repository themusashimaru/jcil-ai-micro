/**
 * BLAST TOOL
 * Basic Local Alignment Search Tool - Sequence similarity search
 * Implements local alignment algorithms for DNA and protein sequences
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const blastTool: UnifiedTool = {
  name: 'blast',
  description: 'BLAST sequence database search',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['blastn', 'blastp', 'blastx', 'tblastn', 'align', 'info'], description: 'Operation' },
      query: { type: 'string', description: 'Query sequence' },
      subject: { type: 'string', description: 'Subject sequence to search against' },
      database: { type: 'string', description: 'Database name (for info)' },
      word_size: { type: 'number', description: 'Word size for seeding (default: 11 for nucleotide, 3 for protein)' },
      gap_open: { type: 'number', description: 'Gap opening penalty' },
      gap_extend: { type: 'number', description: 'Gap extension penalty' },
      e_value: { type: 'number', description: 'E-value threshold' }
    },
    required: ['operation']
  }
};

// Scoring matrices
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

// Nucleotide scoring
function nucleotideScore(a: string, b: string, match: number = 2, mismatch: number = -3): number {
  return a.toUpperCase() === b.toUpperCase() ? match : mismatch;
}

// Protein scoring using BLOSUM62
function proteinScore(a: string, b: string): number {
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  if (BLOSUM62[A] && BLOSUM62[A][B] !== undefined) {
    return BLOSUM62[A][B];
  }
  return A === B ? 1 : -1;  // Fallback for unknown residues
}

// Smith-Waterman local alignment
interface AlignmentResult {
  score: number;
  queryStart: number;
  queryEnd: number;
  subjectStart: number;
  subjectEnd: number;
  queryAligned: string;
  subjectAligned: string;
  midline: string;
  identity: number;
  positives: number;
  gaps: number;
}

function smithWaterman(
  query: string,
  subject: string,
  scoreFn: (a: string, b: string) => number,
  gapOpen: number = -11,
  gapExtend: number = -1
): AlignmentResult {
  const m = query.length;
  const n = subject.length;

  // Score matrix with affine gap penalties
  const H: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  const E: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(-Infinity));  // Gap in query
  const F: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(-Infinity));  // Gap in subject

  let maxScore = 0;
  let maxI = 0;
  let maxJ = 0;

  // Fill matrices
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      // Gap in query (horizontal)
      E[i][j] = Math.max(
        H[i][j - 1] + gapOpen + gapExtend,
        E[i][j - 1] + gapExtend
      );

      // Gap in subject (vertical)
      F[i][j] = Math.max(
        H[i - 1][j] + gapOpen + gapExtend,
        F[i - 1][j] + gapExtend
      );

      // Match/mismatch
      const matchScore = H[i - 1][j - 1] + scoreFn(query[i - 1], subject[j - 1]);

      H[i][j] = Math.max(0, matchScore, E[i][j], F[i][j]);

      if (H[i][j] > maxScore) {
        maxScore = H[i][j];
        maxI = i;
        maxJ = j;
      }
    }
  }

  // Traceback
  let queryAligned = '';
  let subjectAligned = '';
  let midline = '';
  let i = maxI;
  let j = maxJ;
  let identity = 0;
  let positives = 0;
  let gaps = 0;

  while (i > 0 && j > 0 && H[i][j] > 0) {
    const score = scoreFn(query[i - 1], subject[j - 1]);
    const diag = H[i - 1][j - 1] + score;

    if (H[i][j] === diag) {
      queryAligned = query[i - 1] + queryAligned;
      subjectAligned = subject[j - 1] + subjectAligned;
      if (query[i - 1].toUpperCase() === subject[j - 1].toUpperCase()) {
        midline = '|' + midline;
        identity++;
        positives++;
      } else if (score > 0) {
        midline = '+' + midline;
        positives++;
      } else {
        midline = ' ' + midline;
      }
      i--;
      j--;
    } else if (H[i][j] === E[i][j]) {
      queryAligned = '-' + queryAligned;
      subjectAligned = subject[j - 1] + subjectAligned;
      midline = ' ' + midline;
      gaps++;
      j--;
    } else {
      queryAligned = query[i - 1] + queryAligned;
      subjectAligned = '-' + subjectAligned;
      midline = ' ' + midline;
      gaps++;
      i--;
    }
  }

  const alignLen = queryAligned.length;

  return {
    score: maxScore,
    queryStart: i + 1,
    queryEnd: maxI,
    subjectStart: j + 1,
    subjectEnd: maxJ,
    queryAligned,
    subjectAligned,
    midline,
    identity: alignLen > 0 ? identity / alignLen : 0,
    positives: alignLen > 0 ? positives / alignLen : 0,
    gaps
  };
}

// Build word index for BLAST-style seeding
function buildWordIndex(sequence: string, wordSize: number): Map<string, number[]> {
  const index = new Map<string, number[]>();
  for (let i = 0; i <= sequence.length - wordSize; i++) {
    const word = sequence.substring(i, i + wordSize).toUpperCase();
    if (!index.has(word)) {
      index.set(word, []);
    }
    index.get(word)!.push(i);
  }
  return index;
}

// Find high-scoring segment pairs (HSPs)
function findHSPs(
  query: string,
  subject: string,
  isProtein: boolean,
  wordSize: number,
  gapOpen: number,
  gapExtend: number
): AlignmentResult[] {
  const scoreFn = isProtein ? proteinScore : nucleotideScore;
  const subjectIndex = buildWordIndex(subject, wordSize);

  const hits: { queryPos: number; subjectPos: number }[] = [];

  // Find seed matches
  for (let i = 0; i <= query.length - wordSize; i++) {
    const word = query.substring(i, i + wordSize).toUpperCase();
    const positions = subjectIndex.get(word);
    if (positions) {
      for (const pos of positions) {
        hits.push({ queryPos: i, subjectPos: pos });
      }
    }
  }

  // Extend hits and filter
  const hsps: AlignmentResult[] = [];
  const processedRegions = new Set<string>();

  for (const hit of hits) {
    // Skip if we've already processed this region
    const regionKey = `${Math.floor(hit.queryPos / 20)}-${Math.floor(hit.subjectPos / 20)}`;
    if (processedRegions.has(regionKey)) continue;
    processedRegions.add(regionKey);

    // Extract local region for alignment
    const queryStart = Math.max(0, hit.queryPos - 50);
    const queryEnd = Math.min(query.length, hit.queryPos + wordSize + 50);
    const subjectStart = Math.max(0, hit.subjectPos - 50);
    const subjectEnd = Math.min(subject.length, hit.subjectPos + wordSize + 50);

    const queryRegion = query.substring(queryStart, queryEnd);
    const subjectRegion = subject.substring(subjectStart, subjectEnd);

    const alignment = smithWaterman(queryRegion, subjectRegion, scoreFn, gapOpen, gapExtend);

    if (alignment.score > 20) {
      // Adjust positions to full sequence coordinates
      alignment.queryStart += queryStart;
      alignment.queryEnd += queryStart;
      alignment.subjectStart += subjectStart;
      alignment.subjectEnd += subjectStart;
      hsps.push(alignment);
    }
  }

  // Sort by score and return top results
  return hsps.sort((a, b) => b.score - a.score).slice(0, 5);
}

// Calculate E-value
function calculateEValue(score: number, queryLen: number, dbLen: number, K: number = 0.041, lambda: number = 0.267): number {
  return K * queryLen * dbLen * Math.exp(-lambda * score);
}

// Calculate bit score
function calculateBitScore(rawScore: number, K: number = 0.041, lambda: number = 0.267): number {
  return (lambda * rawScore - Math.log(K)) / Math.log(2);
}

export async function executeblast(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'blast',
        name: 'Basic Local Alignment Search Tool',
        description: 'Finds regions of local similarity between sequences',

        programs: {
          blastn: {
            description: 'Nucleotide vs nucleotide',
            wordSize: 11,
            scoring: '+2/-3 (match/mismatch)',
            gapPenalties: '-5/-2 (open/extend)'
          },
          blastp: {
            description: 'Protein vs protein',
            wordSize: 3,
            scoring: 'BLOSUM62 matrix',
            gapPenalties: '-11/-1 (open/extend)'
          },
          blastx: {
            description: 'Translated nucleotide vs protein',
            note: 'Query is translated in 6 reading frames'
          },
          tblastn: {
            description: 'Protein vs translated nucleotide',
            note: 'Database is translated in 6 reading frames'
          }
        },

        algorithm: {
          steps: [
            '1. Build word index from database sequences',
            '2. Scan query for matching words (seeds)',
            '3. Extend seed matches in both directions',
            '4. Filter high-scoring segment pairs (HSPs)',
            '5. Apply gapped alignment to promising regions',
            '6. Calculate statistical significance (E-value)'
          ],
          complexity: 'O(mn) worst case, but much faster in practice due to seeding'
        },

        statistics: {
          eValue: {
            description: 'Expected number of chance alignments with same or better score',
            formula: 'E = K × m × n × e^(-λS)',
            interpretation: 'Lower is better; E < 1e-5 is highly significant'
          },
          bitScore: {
            description: 'Normalized score for comparison across searches',
            formula: 'S\' = (λS - ln(K)) / ln(2)'
          },
          identity: 'Percentage of identical residues in alignment',
          positives: 'Percentage of similar residues (for protein)'
        },

        scoringMatrices: {
          BLOSUM62: 'Blocks Substitution Matrix, 62% identity clusters',
          BLOSUM80: 'For more closely related sequences',
          BLOSUM45: 'For more distantly related sequences',
          PAM250: 'Point Accepted Mutation matrix'
        },

        usage: {
          query: 'Your sequence to search with',
          subject: 'Sequence or database to search against',
          word_size: 'Seed length (affects sensitivity/speed tradeoff)',
          e_value: 'E-value threshold for reporting'
        }
      };

      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Default sequences for demonstration
    const defaultQuery = operation === 'blastn' || operation === 'blastx'
      ? 'ATGCGATCGATCGATCGTAGCTAGCTGATCGATCGATCG'
      : 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH';

    const defaultSubject = operation === 'blastn' || operation === 'tblastn'
      ? 'NNNATGCGATCGATCGATCGTAGCTAGCTGATCGATCGATCGNNNGATCGATCGNNN'
      : 'MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH';

    const query = args.query || defaultQuery;
    const subject = args.subject || defaultSubject;

    const isProtein = operation === 'blastp' || operation === 'tblastn';
    const wordSize = args.word_size || (isProtein ? 3 : 11);
    const gapOpen = args.gap_open || (isProtein ? -11 : -5);
    const gapExtend = args.gap_extend || (isProtein ? -1 : -2);
    const eThreshold = args.e_value || 10;

    if (operation === 'align') {
      // Direct pairwise alignment
      const scoreFn = isProtein ? proteinScore : nucleotideScore;
      const alignment = smithWaterman(query, subject, scoreFn, gapOpen, gapExtend);

      const eValue = calculateEValue(alignment.score, query.length, subject.length);
      const bitScore = calculateBitScore(alignment.score);

      // Format alignment display
      const lineWidth = 60;
      const alignmentLines: string[] = [];
      for (let i = 0; i < alignment.queryAligned.length; i += lineWidth) {
        const qLine = alignment.queryAligned.substring(i, i + lineWidth);
        const mLine = alignment.midline.substring(i, i + lineWidth);
        const sLine = alignment.subjectAligned.substring(i, i + lineWidth);
        alignmentLines.push(`Query   ${(alignment.queryStart + i).toString().padStart(4)}  ${qLine}`);
        alignmentLines.push(`             ${mLine}`);
        alignmentLines.push(`Sbjct   ${(alignment.subjectStart + i).toString().padStart(4)}  ${sLine}`);
        alignmentLines.push('');
      }

      const output = {
        operation: 'pairwise_alignment',
        algorithm: 'Smith-Waterman (local alignment)',

        query: {
          length: query.length,
          preview: query.substring(0, 50) + (query.length > 50 ? '...' : '')
        },
        subject: {
          length: subject.length,
          preview: subject.substring(0, 50) + (subject.length > 50 ? '...' : '')
        },

        alignment: {
          score: alignment.score,
          bitScore: Number(bitScore.toFixed(1)),
          eValue: eValue.toExponential(2),

          queryRange: `${alignment.queryStart}-${alignment.queryEnd}`,
          subjectRange: `${alignment.subjectStart}-${alignment.subjectEnd}`,
          alignmentLength: alignment.queryAligned.length,

          identity: `${Math.round(alignment.identity * 100)}%`,
          positives: isProtein ? `${Math.round(alignment.positives * 100)}%` : undefined,
          gaps: alignment.gaps,

          display: alignmentLines.join('\n')
        },

        parameters: {
          gapOpen,
          gapExtend,
          matrix: isProtein ? 'BLOSUM62' : 'nucleotide (+2/-3)'
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    // BLAST search (blastn, blastp, etc.)
    const hsps = findHSPs(query, subject, isProtein, Math.min(wordSize, query.length), gapOpen, gapExtend);

    const results = hsps.map((hsp, index) => {
      const eValue = calculateEValue(hsp.score, query.length, subject.length);
      const bitScore = calculateBitScore(hsp.score);

      return {
        hspNumber: index + 1,
        score: hsp.score,
        bitScore: Number(bitScore.toFixed(1)),
        eValue: eValue.toExponential(2),

        queryRange: `${hsp.queryStart}-${hsp.queryEnd}`,
        subjectRange: `${hsp.subjectStart}-${hsp.subjectEnd}`,

        identity: `${Math.round(hsp.identity * 100)}%`,
        positives: isProtein ? `${Math.round(hsp.positives * 100)}%` : undefined,
        gaps: hsp.gaps,

        alignment: {
          query: hsp.queryAligned.substring(0, 60) + (hsp.queryAligned.length > 60 ? '...' : ''),
          match: hsp.midline.substring(0, 60) + (hsp.midline.length > 60 ? '...' : ''),
          sbjct: hsp.subjectAligned.substring(0, 60) + (hsp.subjectAligned.length > 60 ? '...' : '')
        }
      };
    }).filter(r => parseFloat(r.eValue) <= eThreshold);

    const output = {
      program: operation.toUpperCase(),

      query: {
        length: query.length,
        type: isProtein ? 'protein' : 'nucleotide'
      },
      database: {
        name: args.database || 'user_provided',
        sequences: 1,
        totalLength: subject.length
      },

      parameters: {
        wordSize,
        gapOpen,
        gapExtend,
        matrix: isProtein ? 'BLOSUM62' : 'nucleotide',
        eValueThreshold: eThreshold
      },

      statistics: {
        dbLength: subject.length,
        effectiveSearchSpace: query.length * subject.length,
        lambda: 0.267,
        kappa: 0.041
      },

      hspsFound: results.length,
      results: results.length > 0 ? results : [{
        message: 'No significant alignments found',
        suggestion: 'Try adjusting word_size or e_value threshold'
      }],

      interpretation: results.length > 0
        ? results[0].eValue < '1e-10'
          ? 'Highly significant match found'
          : results[0].eValue < '1e-3'
          ? 'Significant match found'
          : 'Weak match found'
        : 'No significant similarity detected'
    };

    return { toolCallId: id, content: JSON.stringify(output, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isblastAvailable(): boolean { return true; }
