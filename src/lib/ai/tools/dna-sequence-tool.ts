/**
 * DNA SEQUENCE ANALYZER TOOL
 * Bioinformatics: sequence analysis, translation, alignment
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const CODON_TABLE: Record<string, string> = {
  'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
  'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
  'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*',
  'TGT': 'C', 'TGC': 'C', 'TGA': '*', 'TGG': 'W',
  'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
  'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
  'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
  'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
  'ATT': 'I', 'ATC': 'I', 'ATA': 'I', 'ATG': 'M',
  'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
  'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
  'AGT': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
  'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
  'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
  'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
  'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G',
};

const AMINO_ACIDS: Record<string, string> = {
  'A': 'Alanine', 'R': 'Arginine', 'N': 'Asparagine', 'D': 'Aspartic acid',
  'C': 'Cysteine', 'E': 'Glutamic acid', 'Q': 'Glutamine', 'G': 'Glycine',
  'H': 'Histidine', 'I': 'Isoleucine', 'L': 'Leucine', 'K': 'Lysine',
  'M': 'Methionine', 'F': 'Phenylalanine', 'P': 'Proline', 'S': 'Serine',
  'T': 'Threonine', 'W': 'Tryptophan', 'Y': 'Tyrosine', 'V': 'Valine',
  '*': 'Stop'
};

function complement(base: string): string {
  const complements: Record<string, string> = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G' };
  return complements[base.toUpperCase()] || base;
}

function reverseComplement(sequence: string): string {
  return sequence.split('').reverse().map(b => complement(b)).join('');
}

function transcribe(dna: string): string {
  return dna.toUpperCase().replace(/T/g, 'U');
}

function translate(sequence: string): { protein: string; codons: Array<{ codon: string; aminoAcid: string }> } {
  const dna = sequence.toUpperCase().replace(/U/g, 'T');
  const codons: Array<{ codon: string; aminoAcid: string }> = [];
  let protein = '';

  for (let i = 0; i < dna.length - 2; i += 3) {
    const codon = dna.slice(i, i + 3);
    const aa = CODON_TABLE[codon] || '?';
    codons.push({ codon, aminoAcid: aa });
    protein += aa;
  }

  return { protein, codons };
}

function gcContent(sequence: string): { gc: number; at: number; length: number } {
  const seq = sequence.toUpperCase();
  let gc = 0, at = 0;
  for (const base of seq) {
    if (base === 'G' || base === 'C') gc++;
    else if (base === 'A' || base === 'T') at++;
  }
  return {
    gc: Math.round((gc / seq.length) * 10000) / 100,
    at: Math.round((at / seq.length) * 10000) / 100,
    length: seq.length
  };
}

function findMotifs(sequence: string, motif: string): number[] {
  const positions: number[] = [];
  const seq = sequence.toUpperCase();
  const pattern = motif.toUpperCase();
  let pos = 0;
  while ((pos = seq.indexOf(pattern, pos)) !== -1) {
    positions.push(pos);
    pos++;
  }
  return positions;
}

function findORFs(sequence: string): Array<{ start: number; end: number; length: number; protein: string }> {
  const orfs: Array<{ start: number; end: number; length: number; protein: string }> = [];
  const seq = sequence.toUpperCase();

  for (let frame = 0; frame < 3; frame++) {
    let orfStart: number | null = null;

    for (let i = frame; i < seq.length - 2; i += 3) {
      const codon = seq.slice(i, i + 3);

      if (codon === 'ATG' && orfStart === null) {
        orfStart = i;
      } else if ((codon === 'TAA' || codon === 'TAG' || codon === 'TGA') && orfStart !== null) {
        const orfSeq = seq.slice(orfStart, i + 3);
        if (orfSeq.length >= 30) { // Minimum ORF length
          orfs.push({
            start: orfStart,
            end: i + 3,
            length: orfSeq.length,
            protein: translate(orfSeq).protein
          });
        }
        orfStart = null;
      }
    }
  }

  return orfs;
}

function needlemanWunsch(seq1: string, seq2: string): { alignment: string[]; score: number; identity: number } {
  const match = 1, mismatch = -1, gap = -2;
  const m = seq1.length, n = seq2.length;
  const score: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Initialize
  for (let i = 0; i <= m; i++) score[i][0] = i * gap;
  for (let j = 0; j <= n; j++) score[0][j] = j * gap;

  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const matchScore = score[i - 1][j - 1] + (seq1[i - 1] === seq2[j - 1] ? match : mismatch);
      const deleteScore = score[i - 1][j] + gap;
      const insertScore = score[i][j - 1] + gap;
      score[i][j] = Math.max(matchScore, deleteScore, insertScore);
    }
  }

  // Traceback
  let align1 = '', align2 = '', i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && score[i][j] === score[i - 1][j - 1] + (seq1[i - 1] === seq2[j - 1] ? match : mismatch)) {
      align1 = seq1[i - 1] + align1;
      align2 = seq2[j - 1] + align2;
      i--; j--;
    } else if (i > 0 && score[i][j] === score[i - 1][j] + gap) {
      align1 = seq1[i - 1] + align1;
      align2 = '-' + align2;
      i--;
    } else {
      align1 = '-' + align1;
      align2 = seq2[j - 1] + align2;
      j--;
    }
  }

  // Calculate identity
  let matches = 0;
  for (let k = 0; k < align1.length; k++) {
    if (align1[k] === align2[k] && align1[k] !== '-') matches++;
  }

  return {
    alignment: [align1, align2],
    score: score[m][n],
    identity: Math.round((matches / Math.max(align1.length, 1)) * 10000) / 100
  };
}

function generateRandomSequence(length: number): string {
  const bases = ['A', 'T', 'G', 'C'];
  return Array(length).fill(0).map(() => bases[Math.floor(Math.random() * 4)]).join('');
}

function sequenceToAscii(sequence: string): string {
  const lines: string[] = [];
  const seq = sequence.toUpperCase();

  for (let i = 0; i < seq.length; i += 60) {
    const chunk = seq.slice(i, i + 60);
    lines.push(`${(i + 1).toString().padStart(6)} ${chunk}`);
  }

  return lines.join('\n');
}

export const dnaSequenceTool: UnifiedTool = {
  name: 'dna_sequence',
  description: 'DNA Sequence: translate, transcribe, complement, gc_content, find_orfs, align, motifs',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['translate', 'transcribe', 'complement', 'gc_content', 'find_orfs', 'align', 'find_motifs', 'random', 'format', 'codons', 'info'] },
      sequence: { type: 'string' },
      sequence2: { type: 'string' },
      motif: { type: 'string' },
      length: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeDnaSequence(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    const defaultSeq = 'ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG';

    switch (args.operation) {
      case 'translate':
        const seq = args.sequence || defaultSeq;
        const translation = translate(seq);
        result = {
          dna: seq,
          protein: translation.protein,
          length: `${translation.protein.length} amino acids`,
          codons: translation.codons.slice(0, 10)
        };
        break;
      case 'transcribe':
        const dna = args.sequence || defaultSeq;
        const rna = transcribe(dna);
        result = { dna, rna, note: 'T → U conversion' };
        break;
      case 'complement':
        const compSeq = args.sequence || defaultSeq;
        result = {
          original: compSeq,
          complement: compSeq.split('').map((b: string) => complement(b)).join(''),
          reverseComplement: reverseComplement(compSeq)
        };
        break;
      case 'gc_content':
        const gcSeq = args.sequence || generateRandomSequence(100);
        const gc = gcContent(gcSeq);
        result = {
          sequence: gcSeq.slice(0, 50) + (gcSeq.length > 50 ? '...' : ''),
          gcContent: `${gc.gc}%`,
          atContent: `${gc.at}%`,
          length: gc.length
        };
        break;
      case 'find_orfs':
        const orfSeq = args.sequence || 'ATGAAATTTGGGCCCATGCCCAAATTTGGGTAATAG';
        const orfs = findORFs(orfSeq);
        result = {
          sequence: orfSeq,
          orfsFound: orfs.length,
          orfs: orfs.map(o => ({ ...o, protein: o.protein.slice(0, 20) + (o.protein.length > 20 ? '...' : '') }))
        };
        break;
      case 'align':
        const s1 = args.sequence || 'GATTACA';
        const s2 = args.sequence2 || 'GCATGCU';
        const alignment = needlemanWunsch(s1.toUpperCase(), s2.toUpperCase());
        result = {
          sequence1: s1,
          sequence2: s2,
          alignment: alignment.alignment,
          score: alignment.score,
          identity: `${alignment.identity}%`,
          algorithm: 'Needleman-Wunsch (global)'
        };
        break;
      case 'find_motifs':
        const motifSeq = args.sequence || 'ATGATGATGATG';
        const motif = args.motif || 'ATG';
        const positions = findMotifs(motifSeq, motif);
        result = {
          sequence: motifSeq,
          motif,
          occurrences: positions.length,
          positions
        };
        break;
      case 'random':
        const randSeq = generateRandomSequence(args.length || 100);
        const randGc = gcContent(randSeq);
        result = {
          sequence: randSeq,
          length: randSeq.length,
          gcContent: `${randGc.gc}%`
        };
        break;
      case 'format':
        const formatSeq = args.sequence || generateRandomSequence(200);
        result = { formatted: sequenceToAscii(formatSeq) };
        break;
      case 'codons':
        result = {
          codonTable: Object.entries(CODON_TABLE)
            .filter(([_, aa]) => aa !== '*')
            .reduce((acc, [codon, aa]) => {
              if (!acc[aa]) acc[aa] = [];
              acc[aa].push(codon);
              return acc;
            }, {} as Record<string, string[]>),
          stopCodons: ['TAA', 'TAG', 'TGA'],
          startCodon: 'ATG (Methionine)'
        };
        break;
      case 'info':
        result = {
          description: 'DNA sequence analysis and bioinformatics',
          features: ['Translation to protein', 'Transcription to RNA', 'GC content', 'ORF finding', 'Sequence alignment', 'Motif search'],
          bases: { A: 'Adenine', T: 'Thymine', G: 'Guanine', C: 'Cytosine' },
          aminoAcids: AMINO_ACIDS
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

export function isDnaSequenceAvailable(): boolean { return true; }
