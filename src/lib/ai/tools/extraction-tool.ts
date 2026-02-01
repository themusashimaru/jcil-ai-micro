/**
 * EXTRACTION TOOL
 * Liquid-liquid extraction
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function distributionCoeff(y: number, x: number): number { return y / x; }
function extractionFactor(e: number, s: number, f: number): number { return e * s / f; }
function kremserEq(ef: number, n: number): number { return (Math.pow(ef, n + 1) - ef) / (Math.pow(ef, n + 1) - 1); }
function minSolventRatio(xf: number, xr: number, ys: number, kd: number): number { return (xf - xr) / (kd * xf - ys); }
function stageEfficiency(actual: number, ideal: number): number { return actual / ideal * 100; }
function massTransferCoeff(d: number, v: number, mu: number, rho: number): number { return 0.023 * Math.pow(rho * v * d / mu, 0.83) * Math.pow(mu / (rho * d), 0.44) * d / d; }
function interfacialArea(q: number, d: number): number { return 6 * q / d; }

export const extractionTool: UnifiedTool = {
  name: 'extraction',
  description: 'Extraction: distribution, factor, kremser, min_solvent, efficiency, mass_transfer, interfacial',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['distribution', 'factor', 'kremser', 'min_solvent', 'efficiency', 'mass_transfer', 'interfacial'] }, y: { type: 'number' }, x: { type: 'number' }, e: { type: 'number' }, s: { type: 'number' }, f: { type: 'number' }, ef: { type: 'number' }, n: { type: 'number' }, xf: { type: 'number' }, xr: { type: 'number' }, ys: { type: 'number' }, kd: { type: 'number' }, actual: { type: 'number' }, ideal: { type: 'number' }, d: { type: 'number' }, v: { type: 'number' }, mu: { type: 'number' }, rho: { type: 'number' }, q: { type: 'number' } }, required: ['operation'] },
};

export async function executeExtraction(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'distribution': result = { Kd: distributionCoeff(args.y || 0.8, args.x || 0.2) }; break;
      case 'factor': result = { E: extractionFactor(args.e || 4, args.s || 100, args.f || 200) }; break;
      case 'kremser': result = { recovery: kremserEq(args.ef || 2, args.n || 5) }; break;
      case 'min_solvent': result = { ratio: minSolventRatio(args.xf || 0.1, args.xr || 0.01, args.ys || 0, args.kd || 4) }; break;
      case 'efficiency': result = { percent: stageEfficiency(args.actual || 4, args.ideal || 5) }; break;
      case 'mass_transfer': result = { m_s: massTransferCoeff(args.d || 0.05, args.v || 1, args.mu || 0.001, args.rho || 1000) }; break;
      case 'interfacial': result = { m2_m3: interfacialArea(args.q || 0.1, args.d || 0.003) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isExtractionAvailable(): boolean { return true; }
