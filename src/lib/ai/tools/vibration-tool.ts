/**
 * VIBRATION ANALYSIS TOOL
 * Mechanical vibrations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function naturalFreq(k: number, m: number): number { return Math.sqrt(k / m) / (2 * Math.PI); }
function dampingRatio(c: number, cc: number): number { return c / cc; }
function criticalDamping(k: number, m: number): number { return 2 * Math.sqrt(k * m); }
function transmissibility(r: number, zeta: number): number { return Math.sqrt((1 + Math.pow(2*zeta*r, 2)) / (Math.pow(1 - r*r, 2) + Math.pow(2*zeta*r, 2))); }
function phaseAngle(r: number, zeta: number): number { return Math.atan2(2*zeta*r, 1 - r*r) * 180 / Math.PI; }
function logDecrement(x1: number, xn: number, n: number): number { return Math.log(x1 / xn) / n; }
function modalMass(phi: number[], m: number[]): number { return phi.reduce((sum, p, i) => sum + p*p*m[i], 0); }

export const vibrationTool: UnifiedTool = {
  name: 'vibration',
  description: 'Vibration: natural_freq, damping_ratio, critical_damping, transmissibility, phase, log_decrement, modal_mass',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['natural_freq', 'damping_ratio', 'critical_damping', 'transmissibility', 'phase', 'log_decrement', 'modal_mass'] }, k: { type: 'number' }, m: { type: 'number' }, c: { type: 'number' }, cc: { type: 'number' }, r: { type: 'number' }, zeta: { type: 'number' }, x1: { type: 'number' }, xn: { type: 'number' }, n: { type: 'number' }, phi: { type: 'array' }, masses: { type: 'array' } }, required: ['operation'] },
};

export async function executeVibration(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'natural_freq': result = { Hz: naturalFreq(args.k || 10000, args.m || 1) }; break;
      case 'damping_ratio': result = { zeta: dampingRatio(args.c || 10, args.cc || 200) }; break;
      case 'critical_damping': result = { Ns_m: criticalDamping(args.k || 10000, args.m || 1) }; break;
      case 'transmissibility': result = { TR: transmissibility(args.r || 0.5, args.zeta || 0.1) }; break;
      case 'phase': result = { degrees: phaseAngle(args.r || 0.5, args.zeta || 0.1) }; break;
      case 'log_decrement': result = { delta: logDecrement(args.x1 || 10, args.xn || 1, args.n || 5) }; break;
      case 'modal_mass': result = { kg: modalMass(args.phi || [1, 0.5, 0.25], args.masses || [1, 1, 1]) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isVibrationAvailable(): boolean { return true; }
