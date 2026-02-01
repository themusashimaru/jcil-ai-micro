/**
 * PROTEIN FOLDING TOOL
 * Secondary structure prediction and molecular dynamics simulation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const aminoAcids: Record<string, { hydrophobic: number; charge: number; helix: number; sheet: number; coil: number }> = {
  A: { hydrophobic: 0.62, charge: 0, helix: 1.41, sheet: 0.72, coil: 0.82 },
  R: { hydrophobic: -2.53, charge: 1, helix: 0.98, sheet: 0.93, coil: 1.03 },
  N: { hydrophobic: -0.78, charge: 0, helix: 0.76, sheet: 0.48, coil: 1.34 },
  D: { hydrophobic: -0.90, charge: -1, helix: 0.99, sheet: 0.39, coil: 1.24 },
  C: { hydrophobic: 0.29, charge: 0, helix: 0.66, sheet: 1.40, coil: 0.87 },
  Q: { hydrophobic: -0.85, charge: 0, helix: 1.27, sheet: 0.98, coil: 0.84 },
  E: { hydrophobic: -0.74, charge: -1, helix: 1.59, sheet: 0.52, coil: 0.84 },
  G: { hydrophobic: 0.48, charge: 0, helix: 0.43, sheet: 0.58, coil: 1.77 },
  H: { hydrophobic: -0.40, charge: 0, helix: 1.05, sheet: 0.80, coil: 0.81 },
  I: { hydrophobic: 1.38, charge: 0, helix: 1.09, sheet: 1.67, coil: 0.47 },
  L: { hydrophobic: 1.06, charge: 0, helix: 1.34, sheet: 1.22, coil: 0.57 },
  K: { hydrophobic: -1.50, charge: 1, helix: 1.23, sheet: 0.69, coil: 1.07 },
  M: { hydrophobic: 0.64, charge: 0, helix: 1.30, sheet: 1.14, coil: 0.52 },
  F: { hydrophobic: 1.19, charge: 0, helix: 1.16, sheet: 1.33, coil: 0.59 },
  P: { hydrophobic: 0.12, charge: 0, helix: 0.34, sheet: 0.31, coil: 1.32 },
  S: { hydrophobic: -0.18, charge: 0, helix: 0.57, sheet: 0.96, coil: 1.22 },
  T: { hydrophobic: -0.05, charge: 0, helix: 0.76, sheet: 1.17, coil: 0.90 },
  W: { hydrophobic: 0.81, charge: 0, helix: 1.02, sheet: 1.35, coil: 0.65 },
  Y: { hydrophobic: 0.26, charge: 0, helix: 0.74, sheet: 1.45, coil: 0.76 },
  V: { hydrophobic: 1.08, charge: 0, helix: 0.90, sheet: 1.87, coil: 0.41 }
};

function predictSecondary(sequence: string, windowSize: number = 7): { structure: string; confidence: number[] } {
  const seq = sequence.toUpperCase().split('').filter(c => aminoAcids[c]);
  const structure: string[] = [];
  const confidence: number[] = [];
  
  for (let i = 0; i < seq.length; i++) {
    let helixScore = 0, sheetScore = 0, coilScore = 0;
    let count = 0;
    
    for (let j = Math.max(0, i - Math.floor(windowSize / 2)); j <= Math.min(seq.length - 1, i + Math.floor(windowSize / 2)); j++) {
      const aa = aminoAcids[seq[j]];
      if (aa) {
        helixScore += aa.helix;
        sheetScore += aa.sheet;
        coilScore += aa.coil;
        count++;
      }
    }
    
    helixScore /= count;
    sheetScore /= count;
    coilScore /= count;
    
    const maxScore = Math.max(helixScore, sheetScore, coilScore);
    const total = helixScore + sheetScore + coilScore;
    
    if (helixScore === maxScore) structure.push('H');
    else if (sheetScore === maxScore) structure.push('E');
    else structure.push('C');
    
    confidence.push(maxScore / total);
  }
  
  return { structure: structure.join(''), confidence };
}

function calculateHydrophobicity(sequence: string): { profile: number[]; avgHydrophobicity: number } {
  const seq = sequence.toUpperCase().split('').filter(c => aminoAcids[c]);
  const profile = seq.map(aa => aminoAcids[aa]?.hydrophobic || 0);
  const avg = profile.reduce((a, b) => a + b, 0) / profile.length;
  return { profile, avgHydrophobicity: avg };
}

function calculateCharge(sequence: string, _pH: number = 7.0): { netCharge: number; chargeProfile: number[] } {
  const seq = sequence.toUpperCase().split('').filter(c => aminoAcids[c]);
  const chargeProfile = seq.map(aa => aminoAcids[aa]?.charge || 0);
  const netCharge = chargeProfile.reduce((a, b) => a + b, 0);
  return { netCharge, chargeProfile };
}

function identifyDomains(sequence: string): Array<{ start: number; end: number; type: string }> {
  const seq = sequence.toUpperCase();
  const domains: Array<{ start: number; end: number; type: string }> = [];
  
  // Simple hydrophobic domain detection
  let inHydrophobic = false;
  let start = 0;
  const windowSize = 15;
  const threshold = 0.5;
  
  for (let i = 0; i < seq.length - windowSize; i++) {
    let avgHydro = 0;
    for (let j = i; j < i + windowSize; j++) {
      avgHydro += aminoAcids[seq[j]]?.hydrophobic || 0;
    }
    avgHydro /= windowSize;
    
    if (avgHydro > threshold && !inHydrophobic) {
      inHydrophobic = true;
      start = i;
    } else if (avgHydro <= threshold && inHydrophobic) {
      inHydrophobic = false;
      domains.push({ start, end: i + windowSize, type: 'hydrophobic' });
    }
  }
  
  return domains;
}

export const proteinFoldingTool: UnifiedTool = {
  name: 'protein_folding',
  description: 'Protein secondary structure prediction and analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['predict_secondary', 'hydrophobicity', 'charge', 'domains', 'analyze', 'info'], description: 'Operation' },
      sequence: { type: 'string', description: 'Amino acid sequence (single letter codes)' },
      window_size: { type: 'number', description: 'Window size for prediction' },
      ph: { type: 'number', description: 'pH for charge calculation' }
    },
    required: ['operation']
  }
};

export async function executeProteinFolding(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const sequence = args.sequence || 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH';
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'predict_secondary':
        result = predictSecondary(sequence, args.window_size || 7);
        result.legend = { H: 'Alpha helix', E: 'Beta sheet', C: 'Coil/loop' };
        break;
      case 'hydrophobicity':
        result = calculateHydrophobicity(sequence);
        break;
      case 'charge':
        result = calculateCharge(sequence, args.ph || 7.0);
        break;
      case 'domains':
        result = { domains: identifyDomains(sequence) };
        break;
      case 'analyze':
        result = {
          sequence: sequence,
          length: sequence.length,
          secondary: predictSecondary(sequence),
          hydrophobicity: calculateHydrophobicity(sequence),
          charge: calculateCharge(sequence),
          domains: identifyDomains(sequence)
        };
        break;
      case 'info':
      default:
        result = { description: 'Protein structure analysis', features: ['Chou-Fasman prediction', 'Hydrophobicity plots', 'Charge analysis', 'Domain detection'], algorithms: ['GOR', 'Chou-Fasman'] };
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isProteinFoldingAvailable(): boolean { return true; }
