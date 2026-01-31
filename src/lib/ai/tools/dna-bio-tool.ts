/**
 * DNA/BIO SEQUENCES TOOL
 *
 * DNA, RNA, and protein sequence analysis.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - DNA complement and reverse complement
 * - Transcription (DNA to RNA)
 * - Translation (RNA/DNA to protein)
 * - GC content calculation
 * - Sequence statistics
 * - Codon usage analysis
 * - Open reading frame detection
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const DNA_COMPLEMENT: Record<string, string> = {
  A: 'T',
  T: 'A',
  G: 'C',
  C: 'G',
  a: 't',
  t: 'a',
  g: 'c',
  c: 'g',
  N: 'N',
  n: 'n', // Unknown base
};

const RNA_COMPLEMENT: Record<string, string> = {
  A: 'U',
  U: 'A',
  G: 'C',
  C: 'G',
  a: 'u',
  u: 'a',
  g: 'c',
  c: 'g',
};

// Standard genetic code (RNA codon to amino acid)
const CODON_TABLE: Record<string, string> = {
  UUU: 'F',
  UUC: 'F',
  UUA: 'L',
  UUG: 'L',
  UCU: 'S',
  UCC: 'S',
  UCA: 'S',
  UCG: 'S',
  UAU: 'Y',
  UAC: 'Y',
  UAA: '*',
  UAG: '*',
  UGU: 'C',
  UGC: 'C',
  UGA: '*',
  UGG: 'W',
  CUU: 'L',
  CUC: 'L',
  CUA: 'L',
  CUG: 'L',
  CCU: 'P',
  CCC: 'P',
  CCA: 'P',
  CCG: 'P',
  CAU: 'H',
  CAC: 'H',
  CAA: 'Q',
  CAG: 'Q',
  CGU: 'R',
  CGC: 'R',
  CGA: 'R',
  CGG: 'R',
  AUU: 'I',
  AUC: 'I',
  AUA: 'I',
  AUG: 'M',
  ACU: 'T',
  ACC: 'T',
  ACA: 'T',
  ACG: 'T',
  AAU: 'N',
  AAC: 'N',
  AAA: 'K',
  AAG: 'K',
  AGU: 'S',
  AGC: 'S',
  AGA: 'R',
  AGG: 'R',
  GUU: 'V',
  GUC: 'V',
  GUA: 'V',
  GUG: 'V',
  GCU: 'A',
  GCC: 'A',
  GCA: 'A',
  GCG: 'A',
  GAU: 'D',
  GAC: 'D',
  GAA: 'E',
  GAG: 'E',
  GGU: 'G',
  GGC: 'G',
  GGA: 'G',
  GGG: 'G',
};

const AMINO_ACID_NAMES: Record<string, string> = {
  A: 'Alanine',
  R: 'Arginine',
  N: 'Asparagine',
  D: 'Aspartic acid',
  C: 'Cysteine',
  E: 'Glutamic acid',
  Q: 'Glutamine',
  G: 'Glycine',
  H: 'Histidine',
  I: 'Isoleucine',
  L: 'Leucine',
  K: 'Lysine',
  M: 'Methionine',
  F: 'Phenylalanine',
  P: 'Proline',
  S: 'Serine',
  T: 'Threonine',
  W: 'Tryptophan',
  Y: 'Tyrosine',
  V: 'Valine',
  '*': 'Stop codon',
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const dnaBioTool: UnifiedTool = {
  name: 'analyze_sequence',
  description: `Analyze DNA, RNA, and protein sequences.

Operations:
- complement: Get DNA complement (A↔T, G↔C)
- reverse_complement: Get reverse complement (for primer design)
- transcribe: DNA to RNA transcription (T→U)
- translate: Translate RNA/DNA to protein sequence
- gc_content: Calculate GC percentage
- stats: Full sequence statistics
- codon_usage: Analyze codon frequency
- find_orf: Find open reading frames

Sequence formats:
- DNA: ATGC
- RNA: AUGC
- Protein: Single letter amino acid codes

Use cases:
- Primer design
- Gene analysis
- Protein prediction
- Sequence validation
- Codon optimization`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'complement',
          'reverse_complement',
          'transcribe',
          'translate',
          'gc_content',
          'stats',
          'codon_usage',
          'find_orf',
        ],
        description: 'Sequence operation to perform',
      },
      sequence: {
        type: 'string',
        description: 'DNA, RNA, or protein sequence',
      },
      sequence_type: {
        type: 'string',
        enum: ['dna', 'rna', 'protein'],
        description: 'Type of sequence (auto-detected if not specified)',
      },
      reading_frame: {
        type: 'number',
        description: 'Reading frame for translation (1, 2, or 3). Default: 1',
      },
      min_orf_length: {
        type: 'number',
        description: 'Minimum ORF length in amino acids for find_orf. Default: 30',
      },
    },
    required: ['operation', 'sequence'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isDnaBioAvailable(): boolean {
  return true;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function detectSequenceType(sequence: string): 'dna' | 'rna' | 'protein' {
  const upper = sequence.toUpperCase();
  const hasU = upper.includes('U');
  const hasT = upper.includes('T');

  // Check for protein-specific amino acids
  const proteinOnly = /[EFILPQRWXY]/i;
  if (proteinOnly.test(upper) && !hasU && !hasT) {
    return 'protein';
  }

  if (hasU && !hasT) return 'rna';
  return 'dna';
}

function cleanSequence(sequence: string): string {
  return sequence.replace(/[\s\n\r0-9]/g, '').toUpperCase();
}

function getComplement(sequence: string, type: 'dna' | 'rna'): string {
  const table = type === 'rna' ? RNA_COMPLEMENT : DNA_COMPLEMENT;
  return sequence
    .split('')
    .map((base) => table[base] || base)
    .join('');
}

function transcribe(dna: string): string {
  return dna.toUpperCase().replace(/T/g, 'U');
}

function translate(rna: string, frame: number = 1): { protein: string; codons: string[] } {
  const seq = rna.toUpperCase().replace(/T/g, 'U');
  const start = frame - 1;
  const codons: string[] = [];
  let protein = '';

  for (let i = start; i < seq.length - 2; i += 3) {
    const codon = seq.substring(i, i + 3);
    codons.push(codon);
    const aa = CODON_TABLE[codon] || 'X';
    protein += aa;
  }

  return { protein, codons };
}

function calculateGCContent(sequence: string): number {
  const upper = sequence.toUpperCase();
  const gc = (upper.match(/[GC]/g) || []).length;
  return (gc / upper.length) * 100;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeDnaBio(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args =
    typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;

  const { operation, sequence, reading_frame = 1, min_orf_length = 30 } = args;

  if (!sequence) {
    return {
      toolCallId: toolCall.id,
      content: 'Sequence is required',
      isError: true,
    };
  }

  try {
    const cleanSeq = cleanSequence(sequence);
    const seqType = args.sequence_type || detectSequenceType(cleanSeq);
    let result: Record<string, unknown>;

    switch (operation) {
      case 'complement': {
        if (seqType === 'protein') {
          throw new Error('Complement operation not applicable to protein sequences');
        }
        const complement = getComplement(cleanSeq, seqType);
        result = {
          operation: 'complement',
          input: cleanSeq,
          complement,
          sequenceType: seqType,
          length: cleanSeq.length,
        };
        break;
      }

      case 'reverse_complement': {
        if (seqType === 'protein') {
          throw new Error('Reverse complement not applicable to protein sequences');
        }
        const complement = getComplement(cleanSeq, seqType);
        const reverseComplement = complement.split('').reverse().join('');
        result = {
          operation: 'reverse_complement',
          input: cleanSeq,
          reverseComplement,
          sequenceType: seqType,
          length: cleanSeq.length,
          note: "Useful for primer design - reads 5' to 3' on complementary strand",
        };
        break;
      }

      case 'transcribe': {
        if (seqType !== 'dna') {
          throw new Error('Transcription requires DNA sequence');
        }
        const rna = transcribe(cleanSeq);
        result = {
          operation: 'transcribe',
          input: cleanSeq,
          rna,
          length: cleanSeq.length,
          note: 'DNA → RNA (T replaced with U)',
        };
        break;
      }

      case 'translate': {
        let rnaSeq = cleanSeq;
        if (seqType === 'dna') {
          rnaSeq = transcribe(cleanSeq);
        } else if (seqType === 'protein') {
          throw new Error('Cannot translate protein sequence');
        }

        const { protein, codons } = translate(rnaSeq, reading_frame);
        const startIndex = protein.indexOf('M');
        const stopIndex = protein.indexOf('*');

        result = {
          operation: 'translate',
          input: cleanSeq,
          inputType: seqType,
          readingFrame: reading_frame,
          rna: rnaSeq,
          protein,
          proteinLength: protein.replace(/\*/g, '').length,
          codons: codons.slice(0, 20), // First 20 codons
          totalCodons: codons.length,
          startCodon: startIndex >= 0 ? `Found at position ${startIndex + 1}` : 'Not found',
          stopCodon: stopIndex >= 0 ? `Found at position ${stopIndex + 1}` : 'Not found',
        };
        break;
      }

      case 'gc_content': {
        if (seqType === 'protein') {
          throw new Error('GC content not applicable to protein sequences');
        }
        const gcContent = calculateGCContent(cleanSeq);
        const atContent = 100 - gcContent;

        // Calculate GC content in sliding windows
        const windowSize = Math.min(100, Math.floor(cleanSeq.length / 4));
        const windows: number[] = [];
        if (cleanSeq.length > windowSize) {
          for (let i = 0; i <= cleanSeq.length - windowSize; i += windowSize) {
            windows.push(calculateGCContent(cleanSeq.substring(i, i + windowSize)));
          }
        }

        result = {
          operation: 'gc_content',
          input: cleanSeq.length > 50 ? cleanSeq.substring(0, 50) + '...' : cleanSeq,
          length: cleanSeq.length,
          gcContent: gcContent.toFixed(2),
          atContent: atContent.toFixed(2),
          gcCount: (cleanSeq.match(/[GC]/gi) || []).length,
          atCount: (cleanSeq.match(/[AT]/gi) || []).length,
          gcWindows: windows.length > 0 ? windows.map((w) => w.toFixed(1)) : null,
          interpretation:
            gcContent > 60
              ? 'High GC content'
              : gcContent < 40
                ? 'Low GC content'
                : 'Normal GC content',
        };
        break;
      }

      case 'stats': {
        const baseCounts: Record<string, number> = {};
        for (const base of cleanSeq) {
          baseCounts[base] = (baseCounts[base] || 0) + 1;
        }

        const gcContent = seqType !== 'protein' ? calculateGCContent(cleanSeq) : null;

        result = {
          operation: 'stats',
          sequenceType: seqType,
          length: cleanSeq.length,
          composition: baseCounts,
          compositionPercent: Object.fromEntries(
            Object.entries(baseCounts).map(([k, v]) => [
              k,
              ((v / cleanSeq.length) * 100).toFixed(2) + '%',
            ])
          ),
          gcContent: gcContent !== null ? gcContent.toFixed(2) + '%' : 'N/A',
          molecularWeight:
            seqType === 'dna'
              ? (cleanSeq.length * 330).toFixed(0) + ' Da (approximate)'
              : seqType === 'protein'
                ? (cleanSeq.length * 110).toFixed(0) + ' Da (approximate)'
                : 'N/A',
          preview: cleanSeq.length > 60 ? cleanSeq.substring(0, 60) + '...' : cleanSeq,
        };
        break;
      }

      case 'codon_usage': {
        let rnaSeq = cleanSeq;
        if (seqType === 'dna') {
          rnaSeq = transcribe(cleanSeq);
        } else if (seqType === 'protein') {
          throw new Error('Codon usage requires DNA or RNA sequence');
        }

        const codonCounts: Record<string, number> = {};
        for (let i = 0; i < rnaSeq.length - 2; i += 3) {
          const codon = rnaSeq.substring(i, i + 3);
          codonCounts[codon] = (codonCounts[codon] || 0) + 1;
        }

        const totalCodons = Object.values(codonCounts).reduce((a, b) => a + b, 0);
        const codonUsage = Object.fromEntries(
          Object.entries(codonCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([codon, count]) => [
              codon,
              {
                count,
                percent: ((count / totalCodons) * 100).toFixed(1) + '%',
                aminoAcid: CODON_TABLE[codon] || 'X',
                aminoAcidName: AMINO_ACID_NAMES[CODON_TABLE[codon]] || 'Unknown',
              },
            ])
        );

        result = {
          operation: 'codon_usage',
          totalCodons,
          uniqueCodons: Object.keys(codonCounts).length,
          usage: codonUsage,
        };
        break;
      }

      case 'find_orf': {
        let rnaSeq = cleanSeq;
        if (seqType === 'dna') {
          rnaSeq = transcribe(cleanSeq);
        } else if (seqType === 'protein') {
          throw new Error('ORF finding requires DNA or RNA sequence');
        }

        const orfs: Array<{
          frame: number;
          start: number;
          end: number;
          length: number;
          protein: string;
        }> = [];

        // Search all 3 reading frames
        for (let frame = 0; frame < 3; frame++) {
          let inOrf = false;
          let orfStart = 0;
          let currentProtein = '';

          for (let i = frame; i < rnaSeq.length - 2; i += 3) {
            const codon = rnaSeq.substring(i, i + 3);
            const aa = CODON_TABLE[codon] || 'X';

            if (!inOrf && codon === 'AUG') {
              inOrf = true;
              orfStart = i;
              currentProtein = 'M';
            } else if (inOrf) {
              if (aa === '*') {
                if (currentProtein.length >= min_orf_length) {
                  orfs.push({
                    frame: frame + 1,
                    start: orfStart + 1,
                    end: i + 3,
                    length: currentProtein.length,
                    protein:
                      currentProtein.length > 50
                        ? currentProtein.substring(0, 50) + '...'
                        : currentProtein,
                  });
                }
                inOrf = false;
                currentProtein = '';
              } else {
                currentProtein += aa;
              }
            }
          }
        }

        result = {
          operation: 'find_orf',
          sequenceLength: cleanSeq.length,
          minOrfLength: min_orf_length,
          orfsFound: orfs.length,
          orfs: orfs.sort((a, b) => b.length - a.length),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result, null, 2),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Sequence analysis error: ${(error as Error).message}`,
      isError: true,
    };
  }
}
