/**
 * METROLOGY TOOL
 * Measurement science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function uncertainty(a: number, b: number): number { return Math.sqrt(a * a + b * b); }
function resolution(range: number, bits: number): number { return range / Math.pow(2, bits); }
function accuracy(measured: number, actual: number): number { return Math.abs(measured - actual) / actual * 100; }
function precision(sigma: number, mean: number): number { return sigma / mean * 100; }
function calibrationInterval(drift: number, tolerance: number): number { return tolerance / drift; }
function thermalExpansion(l: number, alpha: number, dT: number): number { return l * alpha * dT; }
function gageRr(ev: number, av: number, pv: number): number { return Math.sqrt(ev * ev + av * av) / pv * 100; }

export const metrologyTool: UnifiedTool = {
  name: 'metrology',
  description: 'Metrology: uncertainty, resolution, accuracy, precision, cal_interval, thermal_exp, gage_rr',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['uncertainty', 'resolution', 'accuracy', 'precision', 'cal_interval', 'thermal_exp', 'gage_rr'] }, a: { type: 'number' }, b: { type: 'number' }, range: { type: 'number' }, bits: { type: 'number' }, measured: { type: 'number' }, actual: { type: 'number' }, sigma: { type: 'number' }, mean: { type: 'number' }, drift: { type: 'number' }, tolerance: { type: 'number' }, l: { type: 'number' }, alpha: { type: 'number' }, dT: { type: 'number' }, ev: { type: 'number' }, av: { type: 'number' }, pv: { type: 'number' } }, required: ['operation'] },
};

export async function executeMetrology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'uncertainty': result = { combined: uncertainty(args.a || 0.01, args.b || 0.02) }; break;
      case 'resolution': result = { units: resolution(args.range || 10, args.bits || 12) }; break;
      case 'accuracy': result = { percent: accuracy(args.measured || 10.1, args.actual || 10) }; break;
      case 'precision': result = { percent: precision(args.sigma || 0.05, args.mean || 10) }; break;
      case 'cal_interval': result = { months: calibrationInterval(args.drift || 0.01, args.tolerance || 0.1) }; break;
      case 'thermal_exp': result = { um: thermalExpansion(args.l || 100, args.alpha || 12e-6, args.dT || 10) * 1e6 }; break;
      case 'gage_rr': result = { percent: gageRr(args.ev || 0.5, args.av || 0.3, args.pv || 5) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isMetrologyAvailable(): boolean { return true; }
