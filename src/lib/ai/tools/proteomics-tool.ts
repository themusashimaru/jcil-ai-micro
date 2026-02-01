/**
 * PROTEOMICS TOOL
 * Protein science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function molecularWeight(sequence: string): number { const mw: Record<string, number> = {A:89,R:174,N:132,D:133,C:121,E:147,Q:146,G:75,H:155,I:131,L:131,K:146,M:149,F:165,P:115,S:105,T:119,W:204,Y:181,V:117}; return sequence.split('').reduce((sum, aa) => sum + (mw[aa] || 110), 0) - (sequence.length - 1) * 18; }
function isoelectricPoint(d: number, e: number, c: number, y: number, h: number, k: number, r: number): number { return (d*4 + e*4.3 + c*8.3 + y*10 + h*6 + k*10.5 + r*12) / (d+e+c+y+h+k+r+1); }
function extinctionCoeff(w: number, y: number, c: number): number { return w * 5500 + y * 1490 + c * 125; }
function proteinConcentration(a280: number, ec: number, mw: number): number { return a280 / ec * mw; }
function hydropathy(sequence: string): number { const kd: Record<string, number> = {A:1.8,R:-4.5,N:-3.5,D:-3.5,C:2.5,E:-3.5,Q:-3.5,G:-0.4,H:-3.2,I:4.5,L:3.8,K:-3.9,M:1.9,F:2.8,P:-1.6,S:-0.8,T:-0.7,W:-0.9,Y:-1.3,V:4.2}; return sequence.split('').reduce((sum, aa) => sum + (kd[aa] || 0), 0) / sequence.length; }
function massSpec(mz: number, z: number): number { return (mz - 1.008) * z; }
function coverage(peptides: number, total: number): number { return peptides / total * 100; }

export const proteomicsTool: UnifiedTool = {
  name: 'proteomics',
  description: 'Proteomics: molecular_weight, isoelectric, extinction, concentration, hydropathy, mass_spec, coverage',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['molecular_weight', 'isoelectric', 'extinction', 'concentration', 'hydropathy', 'mass_spec', 'coverage'] }, sequence: { type: 'string' }, d: { type: 'number' }, e: { type: 'number' }, c: { type: 'number' }, y: { type: 'number' }, h: { type: 'number' }, k: { type: 'number' }, r: { type: 'number' }, w: { type: 'number' }, a280: { type: 'number' }, ec: { type: 'number' }, mw: { type: 'number' }, mz: { type: 'number' }, z: { type: 'number' }, peptides: { type: 'number' }, total: { type: 'number' } }, required: ['operation'] },
};

export async function executeProteomics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'molecular_weight': result = { Da: molecularWeight(args.sequence || 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH') }; break;
      case 'isoelectric': result = { pI: isoelectricPoint(args.d || 5, args.e || 8, args.c || 2, args.y || 3, args.h || 10, args.k || 11, args.r || 3) }; break;
      case 'extinction': result = { M_cm: extinctionCoeff(args.w || 2, args.y || 4, args.c || 1) }; break;
      case 'concentration': result = { mg_mL: proteinConcentration(args.a280 || 0.5, args.ec || 20000, args.mw || 50000) }; break;
      case 'hydropathy': result = { GRAVY: hydropathy(args.sequence || 'ALIVFMYWKR') }; break;
      case 'mass_spec': result = { Da: massSpec(args.mz || 1000, args.z || 2) }; break;
      case 'coverage': result = { percent: coverage(args.peptides || 250, args.total || 400) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isProteomicsAvailable(): boolean { return true; }
