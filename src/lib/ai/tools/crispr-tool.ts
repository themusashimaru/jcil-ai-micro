/**
 * CRISPR TOOL
 * CRISPR-Cas9 gene editing simulation and guide RNA design
 *
 * Provides guide RNA design, off-target prediction, editing efficiency
 * estimation, and visualization of CRISPR editing outcomes.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface GuideRNA {
  sequence: string;      // 20nt guide sequence
  pam: string;           // PAM sequence (NGG for SpCas9)
  position: number;      // Position in target sequence
  strand: '+' | '-';     // Target strand
  gcContent: number;     // GC content percentage
  efficiencyScore: number;
  specifityScore: number;
  offTargets: OffTarget[];
}

interface OffTarget {
  sequence: string;
  mismatches: number;
  mismatchPositions: number[];
  chromosome?: string;
  position?: number;
  gene?: string;
  score: number;  // Lower is worse (more likely off-target)
}

interface EditingOutcome {
  type: 'NHEJ' | 'HDR' | 'no_edit';
  probability: number;
  sequence?: string;
  description: string;
}

interface CRISPRSystem {
  name: string;
  pam: string;
  guideLength: number;
  cutPosition: number;  // Position relative to PAM (negative = upstream)
  description: string;
}

// ============================================================================
// CRISPR SYSTEMS
// ============================================================================

const CRISPR_SYSTEMS: Record<string, CRISPRSystem> = {
  SpCas9: {
    name: 'SpCas9',
    pam: 'NGG',
    guideLength: 20,
    cutPosition: -3,
    description: 'Streptococcus pyogenes Cas9 - most widely used'
  },
  SaCas9: {
    name: 'SaCas9',
    pam: 'NNGRRT',
    guideLength: 21,
    cutPosition: -3,
    description: 'Staphylococcus aureus Cas9 - smaller, good for AAV delivery'
  },
  Cas12a: {
    name: 'Cas12a (Cpf1)',
    pam: 'TTTV',
    guideLength: 23,
    cutPosition: 18,  // Downstream of PAM
    description: 'Cas12a creates staggered cuts, T-rich PAM'
  },
  CasX: {
    name: 'CasX',
    pam: 'TTCN',
    guideLength: 20,
    cutPosition: -3,
    description: 'Compact system, good for base editing'
  },
  Cas13: {
    name: 'Cas13',
    pam: '',  // RNA targeting, no PAM
    guideLength: 28,
    cutPosition: 0,
    description: 'RNA targeting - does not edit DNA'
  }
};

// ============================================================================
// SEQUENCE UTILITIES
// ============================================================================

function complement(base: string): string {
  const complements: Record<string, string> = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G', 'N': 'N' };
  return complements[base.toUpperCase()] || 'N';
}

function reverseComplement(sequence: string): string {
  return sequence.split('').reverse().map(complement).join('');
}

function gcContent(sequence: string): number {
  const gc = (sequence.match(/[GC]/gi) || []).length;
  return (gc / sequence.length) * 100;
}

function matchesPAM(sequence: string, pamPattern: string): boolean {
  if (sequence.length !== pamPattern.length) return false;

  for (let i = 0; i < pamPattern.length; i++) {
    const base = sequence[i].toUpperCase();
    const pattern = pamPattern[i].toUpperCase();

    if (pattern === 'N') continue;
    if (pattern === 'R' && (base === 'A' || base === 'G')) continue;
    if (pattern === 'Y' && (base === 'C' || base === 'T')) continue;
    if (pattern === 'V' && base !== 'T') continue;
    if (pattern === base) continue;

    return false;
  }

  return true;
}

function countMismatches(seq1: string, seq2: string): { count: number; positions: number[] } {
  const positions: number[] = [];
  let count = 0;

  for (let i = 0; i < Math.min(seq1.length, seq2.length); i++) {
    if (seq1[i].toUpperCase() !== seq2[i].toUpperCase()) {
      count++;
      positions.push(i);
    }
  }

  return { count, positions };
}

// ============================================================================
// GUIDE RNA DESIGN
// ============================================================================

function findGuideRNAs(
  sequence: string,
  system: CRISPRSystem = CRISPR_SYSTEMS.SpCas9,
  maxGuides: number = 10
): GuideRNA[] {
  const guides: GuideRNA[] = [];
  const pamLen = system.pam.length;
  const guideLen = system.guideLength;

  // Search forward strand
  for (let i = guideLen; i <= sequence.length - pamLen; i++) {
    const potentialPAM = sequence.slice(i, i + pamLen);

    if (matchesPAM(potentialPAM, system.pam)) {
      const guideSeq = sequence.slice(i - guideLen, i);

      if (isValidGuide(guideSeq)) {
        const guide = createGuideRNA(guideSeq, potentialPAM, i - guideLen, '+', system);
        guides.push(guide);
      }
    }
  }

  // Search reverse strand
  const revSeq = reverseComplement(sequence);
  for (let i = guideLen; i <= revSeq.length - pamLen; i++) {
    const potentialPAM = revSeq.slice(i, i + pamLen);

    if (matchesPAM(potentialPAM, system.pam)) {
      const guideSeq = revSeq.slice(i - guideLen, i);

      if (isValidGuide(guideSeq)) {
        const originalPos = sequence.length - i;
        const guide = createGuideRNA(guideSeq, potentialPAM, originalPos, '-', system);
        guides.push(guide);
      }
    }
  }

  // Sort by efficiency score
  guides.sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  return guides.slice(0, maxGuides);
}

function isValidGuide(sequence: string): boolean {
  // Check for valid nucleotides
  if (!/^[ATGC]+$/i.test(sequence)) return false;

  // Check GC content (30-70% is ideal)
  const gc = gcContent(sequence);
  if (gc < 20 || gc > 80) return false;

  // Check for poly-T stretches (problematic for U6 promoter)
  if (/TTTT/i.test(sequence)) return false;

  return true;
}

function createGuideRNA(
  sequence: string,
  pam: string,
  position: number,
  strand: '+' | '-',
  _system: CRISPRSystem
): GuideRNA {
  return {
    sequence: sequence.toUpperCase(),
    pam: pam.toUpperCase(),
    position,
    strand,
    gcContent: gcContent(sequence),
    efficiencyScore: calculateEfficiencyScore(sequence),
    specifityScore: calculateSpecificityScore(sequence),
    offTargets: []  // Filled in separately
  };
}

// ============================================================================
// SCORING ALGORITHMS
// ============================================================================

// Doench et al. 2016 rule set 2 (simplified)
function calculateEfficiencyScore(sequence: string): number {
  let score = 50;  // Base score

  // GC content contribution
  const gc = gcContent(sequence);
  if (gc >= 40 && gc <= 70) score += 15;
  else if (gc >= 30 && gc <= 80) score += 5;
  else score -= 10;

  // Position-specific nucleotide preferences (simplified)
  const seq = sequence.toUpperCase();

  // Position 20 (adjacent to PAM): G or A preferred
  if (seq[seq.length - 1] === 'G') score += 5;
  else if (seq[seq.length - 1] === 'A') score += 3;

  // Position 16: C preferred
  if (seq.length > 4 && seq[seq.length - 5] === 'C') score += 3;

  // Position 3: C preferred
  if (seq[2] === 'C') score += 3;

  // Avoid poly-G runs
  if (/GGG/i.test(seq)) score -= 10;

  // Avoid poly-C runs in seed region (last 12bp)
  if (/CCCC/i.test(seq.slice(-12))) score -= 8;

  // Seed region (positions 1-12 from PAM) - higher GC preferred
  const seedGC = gcContent(seq.slice(-12));
  if (seedGC >= 50 && seedGC <= 70) score += 5;

  return Math.max(0, Math.min(100, score));
}

// MIT specificity score (simplified)
function calculateSpecificityScore(sequence: string): number {
  let score = 100;

  const seq = sequence.toUpperCase();

  // Low complexity reduces specificity
  const uniqueBases = new Set(seq.split('')).size;
  if (uniqueBases < 3) score -= 30;
  else if (uniqueBases < 4) score -= 10;

  // Repetitive sequences reduce specificity
  if (/(.)\1{3,}/.test(seq)) score -= 20;

  // High GC in seed region increases potential off-targets
  const seedGC = gcContent(seq.slice(-12));
  if (seedGC > 75) score -= 15;

  return Math.max(0, Math.min(100, score));
}

// Off-target scoring (CFD score simplified)
function calculateOffTargetScore(
  guideSeq: string,
  offTargetSeq: string,
  mismatchPositions: number[]
): number {
  // Position-dependent mismatch penalties
  // Mismatches in seed region (positions 1-12 from PAM) are more tolerated
  const positionWeights: number[] = [
    0.0, 0.0, 0.014, 0.0, 0.0, 0.395, 0.317, 0.0, 0.389, 0.079,
    0.445, 0.508, 0.613, 0.851, 0.732, 0.828, 0.615, 0.804, 0.685, 0.583
  ];

  let score = 1.0;

  for (const pos of mismatchPositions) {
    if (pos < positionWeights.length) {
      score *= (1 - positionWeights[pos]);
    } else {
      score *= 0.5;
    }
  }

  // Penalty for multiple mismatches
  if (mismatchPositions.length >= 4) score *= 0.1;
  else if (mismatchPositions.length >= 3) score *= 0.3;

  return score * 100;
}

// ============================================================================
// OFF-TARGET ANALYSIS
// ============================================================================

function findOffTargets(
  guideSeq: string,
  genome: string,
  maxMismatches: number = 4
): OffTarget[] {
  const offTargets: OffTarget[] = [];
  const guideLen = guideSeq.length;

  // Search both strands
  const sequences = [
    { seq: genome, strand: '+' },
    { seq: reverseComplement(genome), strand: '-' }
  ];

  for (const { seq } of sequences) {
    for (let i = 0; i <= seq.length - guideLen - 3; i++) {
      const candidate = seq.slice(i, i + guideLen);
      const { count, positions } = countMismatches(guideSeq, candidate);

      if (count > 0 && count <= maxMismatches) {
        // Check for PAM
        const pamRegion = seq.slice(i + guideLen, i + guideLen + 3);
        if (matchesPAM(pamRegion, 'NGG')) {
          const score = calculateOffTargetScore(guideSeq, candidate, positions);

          offTargets.push({
            sequence: candidate,
            mismatches: count,
            mismatchPositions: positions,
            position: i,
            score
          });
        }
      }
    }
  }

  // Sort by score (higher score = higher risk)
  offTargets.sort((a, b) => b.score - a.score);

  return offTargets.slice(0, 20);
}

// ============================================================================
// EDITING SIMULATION
// ============================================================================

function simulateEditing(
  guide: GuideRNA,
  targetSequence: string,
  donorTemplate?: string
): {
  outcomes: EditingOutcome[];
  cutSite: number;
  editedSequences: { name: string; sequence: string }[];
} {
  // Calculate cut site
  const cutSite = guide.position + guide.sequence.length + CRISPR_SYSTEMS.SpCas9.cutPosition;

  // Predict outcomes
  const outcomes: EditingOutcome[] = [];
  const editedSequences: { name: string; sequence: string }[] = [];

  // No editing probability
  const noEditProb = Math.max(5, 100 - guide.efficiencyScore);
  outcomes.push({
    type: 'no_edit',
    probability: noEditProb,
    sequence: targetSequence,
    description: 'No editing occurs'
  });

  // NHEJ outcomes (small indels)
  const nhejProb = donorTemplate ? 30 : 70;

  // 1bp deletion
  const del1Seq = targetSequence.slice(0, cutSite - 1) + targetSequence.slice(cutSite);
  outcomes.push({
    type: 'NHEJ',
    probability: nhejProb * 0.4,
    sequence: del1Seq,
    description: '1bp deletion at cut site'
  });
  editedSequences.push({ name: '1bp_deletion', sequence: del1Seq });

  // 1bp insertion
  const bases = ['A', 'T', 'G', 'C'];
  const insertBase = bases[Math.floor(Math.random() * 4)];
  const ins1Seq = targetSequence.slice(0, cutSite) + insertBase + targetSequence.slice(cutSite);
  outcomes.push({
    type: 'NHEJ',
    probability: nhejProb * 0.3,
    sequence: ins1Seq,
    description: `1bp insertion (${insertBase})`
  });
  editedSequences.push({ name: '1bp_insertion', sequence: ins1Seq });

  // Larger deletion (5-15bp)
  const delSize = 5 + Math.floor(Math.random() * 10);
  const delStart = Math.max(0, cutSite - Math.floor(delSize / 2));
  const delSeq = targetSequence.slice(0, delStart) + targetSequence.slice(delStart + delSize);
  outcomes.push({
    type: 'NHEJ',
    probability: nhejProb * 0.3,
    sequence: delSeq,
    description: `${delSize}bp deletion`
  });
  editedSequences.push({ name: 'larger_deletion', sequence: delSeq });

  // HDR if donor provided
  if (donorTemplate) {
    const hdrProb = 25;
    // Simple HDR: replace sequence around cut site with donor
    const hdrSeq = targetSequence.slice(0, cutSite - 20) + donorTemplate + targetSequence.slice(cutSite + 20);
    outcomes.push({
      type: 'HDR',
      probability: hdrProb,
      sequence: hdrSeq,
      description: 'Homology-directed repair with donor template'
    });
    editedSequences.push({ name: 'HDR', sequence: hdrSeq });
  }

  // Normalize probabilities
  const total = outcomes.reduce((sum, o) => sum + o.probability, 0);
  outcomes.forEach(o => { o.probability = (o.probability / total) * 100; });

  return { outcomes, cutSite, editedSequences };
}

// ============================================================================
// PRIMER DESIGN
// ============================================================================

function designPrimers(targetSequence: string, cutSite: number): {
  forward: { sequence: string; tm: number; position: number };
  reverse: { sequence: string; tm: number; position: number };
  productSize: number;
} {
  // Design primers ~200bp flanking the cut site
  const primerLength = 20;
  const flankSize = 200;

  // Forward primer
  const fwdStart = Math.max(0, cutSite - flankSize);
  const fwdSeq = targetSequence.slice(fwdStart, fwdStart + primerLength);
  const fwdTm = calculateTm(fwdSeq);

  // Reverse primer (reverse complement)
  const revEnd = Math.min(targetSequence.length, cutSite + flankSize);
  const revSeq = reverseComplement(targetSequence.slice(revEnd - primerLength, revEnd));
  const revTm = calculateTm(revSeq);

  return {
    forward: { sequence: fwdSeq, tm: fwdTm, position: fwdStart },
    reverse: { sequence: revSeq, tm: revTm, position: revEnd - primerLength },
    productSize: revEnd - fwdStart
  };
}

function calculateTm(sequence: string): number {
  // Wallace rule for short primers
  const a = (sequence.match(/A/gi) || []).length;
  const t = (sequence.match(/T/gi) || []).length;
  const g = (sequence.match(/G/gi) || []).length;
  const c = (sequence.match(/C/gi) || []).length;

  if (sequence.length < 14) {
    return 2 * (a + t) + 4 * (g + c);
  }

  // Nearest-neighbor approximation for longer primers
  return 64.9 + 41 * (g + c - 16.4) / sequence.length;
}

// ============================================================================
// SAMPLE SEQUENCES
// ============================================================================

function getSampleSequence(gene: string): { name: string; sequence: string; description: string } {
  const samples: Record<string, { name: string; sequence: string; description: string }> = {
    EGFP: {
      name: 'EGFP',
      sequence: 'ATGGTGAGCAAGGGCGAGGAGCTGTTCACCGGGGTGGTGCCCATCCTGGTCGAGCTGGACGGCGACGTAAACGGCCACAAGTTCAGCGTGTCCGGCGAGGGCGAGGGCGATGCCACCTACGGCAAGCTGACCCTGAAGTTCATCTGCACCACCGGCAAGCTGCCCGTGCCCTGGCCCACCCTCGTGACCACCCTGACCTACGGCGTGCAGTGCTTCAGCCGCTACCCCGACCACATGAAGCAGCACGACTTCTTCAAGTCCGCCATGCCCGAAGGCTACGTCCAGGAGCGCACCATCTTCTTCAAGGACGACGGCAACTACAAGACCCGCGCCGAGGTGAAGTTCGAGGGCGACACCCTGGTGAACCGCATCGAGCTGAAGGGCATCGACTTCAAGGAGGACGGCAACATCCTGGGGCACAAGCTGGAGTACAACTACAACAGCCACAACGTCTATATCATGGCCGACAAGCAGAAGAACGGCATCAAGGTGAACTTCAAGATCCGCCACAACATCGAGGACGGCAGCGTGCAGCTCGCCGACCACTACCAGCAGAACACCCCCATCGGCGACGGCCCCGTGCTGCTGCCCGACAACCACTACCTGAGCACCCAGTCCGCCCTGAGCAAAGACCCCAACGAGAAGCGCGATCACATGGTCCTGCTGGAGTTCGTGACCGCCGCCGGGATCACTCTCGGCATGGACGAGCTGTACAAGTAA',
      description: 'Enhanced Green Fluorescent Protein - reporter gene'
    },
    TP53: {
      name: 'TP53 exon 5',
      sequence: 'TGTTCACTTGTGCCCTGACTTTCAACTCTGTCTCCTTCCTCTTCCTACAGTACTCCCCTGCCCTCAACAAGATGTTTTGCCAACTGGCCAAGACCTGCCCTGTGCAGCTGTGGGTTGATTCCACACCCCCGCCCGGCACCCGCGTCCGCGCCATGGCCATCTACAAGCAGTCACAGCACATGACGGAGGTTGTGAGGCGCTGCCCCCACCATGAGCGCTGCTCAGATAGCGATGGTCTGGCCCCTCCTCAGCATCTTATCCGAGTGGAAGGAAATTTGCGTGTGGAGTATTTGGATGACAGAAACACTTTTCGACATAGTGTGGTGGTGCCCTATGAGCCGCCTGAGGTTGGCTCTGACTGTACCACCATCCACTACAACTACATGTGTAACAGTTCCTGCATGGGCGGCATGAACCGGAGGCCCATCCTCACCATCATCACACTGGAAGACTCCAG',
      description: 'TP53 tumor suppressor gene exon 5'
    },
    CCR5: {
      name: 'CCR5',
      sequence: 'ATGGATTATCAAGTGTCAAGTCCAATCTATGACATCAATTATTATACATCGGAGCCCTGCCAAAAAATCAATGTGAAGCAAATCGCAGCCCGCCTCCTGCCTCCGCTCTACTCACTGGTGTTCATCTTTGGTTTTGTGGGCAACATGCTGGTCATCCTCATCCTGATAAACTGCAAAAGGCTGAAGAGCATGACTGACATCTACCTGCTCAACCTGGCCATCTCTGACCTGTTTTTCCTTCTTACTGTCCCCTTCTGGGCTCACTATGCTGCCGCCCAGTGGGACTTTGGAAATACAATGTGTCAACTCTTGACAGGGCTCTATTTTATAGGCTTCTTCTCTGGAATCTTCTTCATCATCCTCCTGACAATCGATAGGTACCTGGCTGTCGTCCATGCTGTGTTTGCTTTAAAAGCCAGGACGGTCACCTTTGGGGTGGTGACAAGTGTGATCACTTGGGTGGTGGCTGTGTTTGCGTCTCTCCCAGGAATCATCTTTACCAGATCTCAAAAAGAAGGTCTTCATTACACCTGCAGCTCTCATTTTCCATACAGTCAGTATCAATTCTGGAAGAATTTCCAGACATTAAAGATAGTCATCTTGGGGCTGGTCCTGCCGCTGCTTGTCATGGTCATCTGCTACTCGGGAATCCTAAAAACTCTGCTTCGGTGTCGAAATGAGAAGAAGAGGCACAGGGCTGTGAGGCTTATCTTCACCATCATGATTGTTTATTTTCTCTTCTGGGCTCCCTACAACATTGTCCTTCTCCTGAACACCTTCCAGGAATTCTTTGGCCTGAATAATTGCAGTAGCTCTAACAGGTTGGACCAAGCTATGCAGGTGACAGAGACTCTTGGGATGACGCACTGCTGCATCAACCCCATCATCTATGCCTTTGTCGGGGAGAAGTTCAGAAACTACCTCTTAGTCTTCTTCCAAAAGCACATTGCCAAACGCTTCTGCAAATGCTGTTCTATTTTCCAGCAAGAGGCTCCCGAGCGAGCAAGCTCAGTTTACACCCGATCCACTGGGGAGCAGGAAATATCTGTGGGCTTGTGA',
      description: 'CCR5 gene - HIV co-receptor, knockout confers HIV resistance'
    },
    default: {
      name: 'Sample target',
      sequence: 'ATGGCTGAGCTGCAGCGCGAGGACTTCGCGGGCGTGGGCGAGGTGCTGCAGCGCGCGGCGCTGCTGCAGCGCGAGCTGCAGCGCGAGGACTTCGCGGGCGTGGGCGAGGTGCTGCAGCGCGCGGCGCTGCTGCAGCGCGAGCTGCAGCGCGAGGACTTCGCGGGCGTGGGCGAGGTGCTGCAGCGCGCGGCGCTGCTGCAG',
      description: 'Sample DNA sequence for guide design'
    }
  };

  return samples[gene] || samples.default;
}

// ============================================================================
// TOOL DEFINITION AND EXECUTOR
// ============================================================================

export const crisprTool: UnifiedTool = {
  name: 'crispr',
  description: 'CRISPR-Cas9 gene editing - guide RNA design, off-target analysis, editing simulation',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['design_guide', 'off_target', 'edit_simulate', 'efficiency', 'primers', 'compare_systems', 'info'],
        description: 'CRISPR operation'
      },
      sequence: {
        type: 'string',
        description: 'Target DNA sequence'
      },
      gene: {
        type: 'string',
        enum: ['EGFP', 'TP53', 'CCR5'],
        description: 'Predefined gene for analysis'
      },
      guide_sequence: {
        type: 'string',
        description: 'Specific guide RNA sequence'
      },
      system: {
        type: 'string',
        enum: ['SpCas9', 'SaCas9', 'Cas12a', 'CasX', 'Cas13'],
        description: 'CRISPR system to use'
      },
      donor_template: {
        type: 'string',
        description: 'Donor DNA template for HDR'
      },
      max_guides: {
        type: 'number',
        description: 'Maximum number of guides to return'
      }
    },
    required: ['operation']
  }
};

export async function executecrispr(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    // Get target sequence
    let targetSequence: string;
    let targetName: string;

    if (args.sequence) {
      targetSequence = args.sequence.toUpperCase().replace(/[^ATGC]/g, '');
      targetName = 'Custom sequence';
    } else {
      const sample = getSampleSequence(args.gene || 'default');
      targetSequence = sample.sequence;
      targetName = sample.name;
    }

    const system = CRISPR_SYSTEMS[args.system || 'SpCas9'];

    switch (operation) {
      case 'design_guide': {
        const maxGuides = args.max_guides || 10;
        const guides = findGuideRNAs(targetSequence, system, maxGuides);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'design_guide',
            target: {
              name: targetName,
              length: targetSequence.length,
              gcContent: gcContent(targetSequence).toFixed(1) + '%'
            },
            system: system.name,
            pamPattern: system.pam,
            guidesFound: guides.length,
            guides: guides.map((g, i) => ({
              rank: i + 1,
              sequence: g.sequence,
              pam: g.pam,
              position: g.position,
              strand: g.strand,
              gcContent: g.gcContent.toFixed(1) + '%',
              efficiencyScore: g.efficiencyScore.toFixed(1),
              specificityScore: g.specifityScore.toFixed(1),
              overallScore: ((g.efficiencyScore + g.specifityScore) / 2).toFixed(1)
            })),
            bestGuide: guides[0] ? {
              sequence: guides[0].sequence,
              fullTarget: guides[0].sequence + guides[0].pam,
              why: 'Highest combined efficiency and specificity score'
            } : null
          }, null, 2)
        };
      }

      case 'off_target': {
        const guideSeq = args.guide_sequence || findGuideRNAs(targetSequence, system, 1)[0]?.sequence;

        if (!guideSeq) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'No guide sequence provided or found' }, null, 2),
            isError: true
          };
        }

        // Use target sequence as "genome" for demo
        const offTargets = findOffTargets(guideSeq, targetSequence);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'off_target',
            guide: guideSeq,
            offTargetsFound: offTargets.length,
            offTargets: offTargets.map(ot => ({
              sequence: ot.sequence,
              mismatches: ot.mismatches,
              positions: ot.mismatchPositions,
              riskScore: ot.score.toFixed(1),
              riskLevel: ot.score > 50 ? 'HIGH' : ot.score > 20 ? 'MEDIUM' : 'LOW'
            })),
            summary: {
              highRisk: offTargets.filter(ot => ot.score > 50).length,
              mediumRisk: offTargets.filter(ot => ot.score > 20 && ot.score <= 50).length,
              lowRisk: offTargets.filter(ot => ot.score <= 20).length
            },
            recommendation: offTargets.filter(ot => ot.score > 50).length > 0
              ? 'Consider choosing a different guide RNA with fewer high-risk off-targets'
              : 'Guide appears to have acceptable specificity'
          }, null, 2)
        };
      }

      case 'edit_simulate': {
        const guides = findGuideRNAs(targetSequence, system, 1);
        const guide = guides[0];

        if (!guide) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'No valid guide found in sequence' }, null, 2),
            isError: true
          };
        }

        const simulation = simulateEditing(guide, targetSequence, args.donor_template);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'edit_simulate',
            guide: {
              sequence: guide.sequence,
              position: guide.position,
              strand: guide.strand
            },
            cutSite: simulation.cutSite,
            donorProvided: !!args.donor_template,
            predictedOutcomes: simulation.outcomes.map(o => ({
              type: o.type,
              probability: o.probability.toFixed(1) + '%',
              description: o.description
            })),
            editedSequences: simulation.editedSequences.slice(0, 3).map(s => ({
              name: s.name,
              lengthChange: s.sequence.length - targetSequence.length,
              preview: s.sequence.slice(Math.max(0, simulation.cutSite - 30), simulation.cutSite + 30)
            })),
            recommendations: args.donor_template
              ? ['Use cell cycle synchronization to increase HDR efficiency',
                 'Consider using Cas9 nickase for reduced off-target effects']
              : ['Add donor template for precise editing via HDR',
                 'NHEJ creates variable indels - screen multiple clones']
          }, null, 2)
        };
      }

      case 'efficiency': {
        const guideSeq = args.guide_sequence || 'ATGCTGAGCTGCAGCGCGAG';
        const efficiency = calculateEfficiencyScore(guideSeq);
        const specificity = calculateSpecificityScore(guideSeq);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'efficiency',
            guide: guideSeq,
            scores: {
              efficiency: efficiency.toFixed(1),
              specificity: specificity.toFixed(1),
              overall: ((efficiency + specificity) / 2).toFixed(1)
            },
            analysis: {
              gcContent: gcContent(guideSeq).toFixed(1) + '%',
              gcOptimal: gcContent(guideSeq) >= 40 && gcContent(guideSeq) <= 70,
              hasPolyT: /TTTT/i.test(guideSeq),
              hasPolyG: /GGG/i.test(guideSeq),
              terminalG: guideSeq.slice(-1) === 'G'
            },
            interpretation: efficiency >= 70
              ? 'High efficiency guide - good candidate'
              : efficiency >= 50
                ? 'Moderate efficiency - may work but consider alternatives'
                : 'Low efficiency - likely to have poor editing rates',
            suggestions: [
              efficiency < 70 && gcContent(guideSeq) < 40 ? 'GC content is low - prefer guides with 40-70% GC' : null,
              efficiency < 70 && guideSeq.slice(-1) !== 'G' ? 'Consider guides ending in G (adjacent to PAM)' : null,
              /TTTT/i.test(guideSeq) ? 'Contains TTTT - may cause early termination with U6 promoter' : null
            ].filter(Boolean)
          }, null, 2)
        };
      }

      case 'primers': {
        const guides = findGuideRNAs(targetSequence, system, 1);
        const guide = guides[0];

        if (!guide) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'No valid guide found in sequence' }, null, 2),
            isError: true
          };
        }

        const cutSite = guide.position + guide.sequence.length + system.cutPosition;
        const primers = designPrimers(targetSequence, cutSite);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'primers',
            guide: guide.sequence,
            cutSite,
            primers: {
              forward: {
                sequence: primers.forward.sequence,
                tm: primers.forward.tm.toFixed(1) + '°C',
                position: primers.forward.position
              },
              reverse: {
                sequence: primers.reverse.sequence,
                tm: primers.reverse.tm.toFixed(1) + '°C',
                position: primers.reverse.position
              },
              productSize: primers.productSize + 'bp'
            },
            applications: {
              genotyping: 'Use for PCR to detect indels (T7E1 assay, sequencing)',
              hdpScreening: 'Product size change indicates successful large deletion/insertion',
              sequencing: 'Amplify region for Sanger or NGS analysis'
            }
          }, null, 2)
        };
      }

      case 'compare_systems': {
        const comparison = Object.values(CRISPR_SYSTEMS).map(sys => {
          const guides = findGuideRNAs(targetSequence, sys, 5);
          return {
            system: sys.name,
            pam: sys.pam,
            guideLength: sys.guideLength,
            description: sys.description,
            guidesFound: guides.length,
            bestEfficiency: guides[0]?.efficiencyScore.toFixed(1) || 'N/A',
            pamSitesInTarget: guides.length
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare_systems',
            targetLength: targetSequence.length,
            systems: comparison,
            recommendation: comparison.reduce((best, curr) =>
              (curr.guidesFound > best.guidesFound) ? curr : best
            ).system + ' has the most PAM sites in your target'
          }, null, 2)
        };
      }

      case 'info':
      default: {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'crispr',
            description: 'CRISPR-Cas9 gene editing design and analysis',
            systems: Object.values(CRISPR_SYSTEMS).map(s => ({
              name: s.name,
              pam: s.pam,
              guideLength: s.guideLength,
              description: s.description
            })),
            designConsiderations: {
              gcContent: '40-70% optimal for guide efficiency',
              avoidPolyT: 'TTTT causes early U6 promoter termination',
              seedRegion: 'Last 12bp (PAM-proximal) most critical for specificity',
              terminalG: 'G at position 20 improves efficiency'
            },
            editingOutcomes: {
              NHEJ: 'Non-homologous end joining - creates small indels (knockouts)',
              HDR: 'Homology-directed repair - precise edits with donor template',
              ratios: 'NHEJ dominates (~70-95%) without cell cycle manipulation'
            },
            scoringMethods: {
              efficiency: 'Based on Doench et al. 2016 Rule Set 2',
              specificity: 'MIT specificity score / CFD score'
            },
            operations: ['design_guide', 'off_target', 'edit_simulate', 'efficiency', 'primers', 'compare_systems'],
            sampleGenes: ['EGFP', 'TP53', 'CCR5']
          }, null, 2)
        };
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function iscrisprAvailable(): boolean {
  return true;
}
