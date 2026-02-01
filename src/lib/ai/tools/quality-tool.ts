/**
 * QUALITY TOOL
 * Statistical quality control
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function cpk(usl: number, lsl: number, mean: number, sigma: number): number { return Math.min((usl - mean), (mean - lsl)) / (3 * sigma); }
function sixSigma(defects: number, opportunities: number, units: number): number { return defects / (opportunities * units) * 1e6; }
function controlLimits(mean: number, sigma: number, n: number): {ucl: number, lcl: number} { const a = 3 * sigma / Math.sqrt(n); return { ucl: mean + a, lcl: mean - a }; }
function aql(lot: number, defects: number): number { return defects / lot * 100; }
function reliability(mtbf: number, t: number): number { return Math.exp(-t / mtbf); }
function availability(mtbf: number, mttr: number): number { return mtbf / (mtbf + mttr) * 100; }
function pareto(values: number[]): number[] { const total = values.reduce((a, b) => a + b, 0); let cum = 0; return values.map(v => { cum += v; return cum / total * 100; }); }

export const qualityTool: UnifiedTool = {
  name: 'quality',
  description: 'Quality: cpk, dpmo, control_limits, aql, reliability, availability, pareto',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['cpk', 'dpmo', 'control_limits', 'aql', 'reliability', 'availability', 'pareto'] }, usl: { type: 'number' }, lsl: { type: 'number' }, mean: { type: 'number' }, sigma: { type: 'number' }, defects: { type: 'number' }, opportunities: { type: 'number' }, units: { type: 'number' }, n: { type: 'number' }, lot: { type: 'number' }, mtbf: { type: 'number' }, t: { type: 'number' }, mttr: { type: 'number' }, values: { type: 'array' } }, required: ['operation'] },
};

export async function executeQuality(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'cpk': result = { Cpk: cpk(args.usl || 10.5, args.lsl || 9.5, args.mean || 10, args.sigma || 0.1) }; break;
      case 'dpmo': result = { dpmo: sixSigma(args.defects || 5, args.opportunities || 10, args.units || 1000) }; break;
      case 'control_limits': result = controlLimits(args.mean || 10, args.sigma || 0.1, args.n || 5); break;
      case 'aql': result = { percent: aql(args.lot || 1000, args.defects || 10) }; break;
      case 'reliability': result = { R: reliability(args.mtbf || 10000, args.t || 1000) }; break;
      case 'availability': result = { percent: availability(args.mtbf || 1000, args.mttr || 10) }; break;
      case 'pareto': result = { cumulative_percent: pareto(args.values || [40, 30, 20, 10]) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isQualityAvailable(): boolean { return true; }
