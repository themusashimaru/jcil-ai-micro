/**
 * VACUUM TECHNOLOGY TOOL
 * Vacuum physics and engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function meanFreePath(kb: number, t: number, p: number, d: number): number { return kb * t / (Math.sqrt(2) * Math.PI * d * d * p); }
function pumpingSpeed(v: number, t: number): number { return v / t; }
function throughput(s: number, p: number): number { return s * p; }
function conductance(d: number, l: number): number { return 12.1 * Math.pow(d, 4) / l; }
function effectivePumpSpeed(s: number, c: number): number { return s * c / (s + c); }
function outgassing(q0: number, t: number, n: number): number { return q0 * Math.pow(t, -n); }
function knudsen(mfp: number, d: number): number { return mfp / d; }

export const vacuumTool: UnifiedTool = {
  name: 'vacuum',
  description: 'Vacuum: mean_free_path, pump_speed, throughput, conductance, effective_speed, outgassing, knudsen',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['mean_free_path', 'pump_speed', 'throughput', 'conductance', 'effective_speed', 'outgassing', 'knudsen'] }, kb: { type: 'number' }, t: { type: 'number' }, p: { type: 'number' }, d: { type: 'number' }, v: { type: 'number' }, s: { type: 'number' }, l: { type: 'number' }, c: { type: 'number' }, q0: { type: 'number' }, n: { type: 'number' }, mfp: { type: 'number' } }, required: ['operation'] },
};

export async function executeVacuum(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'mean_free_path': result = { m: meanFreePath(args.kb || 1.38e-23, args.t || 300, args.p || 0.001, args.d || 3.7e-10) }; break;
      case 'pump_speed': result = { L_s: pumpingSpeed(args.v || 1000, args.t || 10) }; break;
      case 'throughput': result = { Pa_L_s: throughput(args.s || 100, args.p || 0.01) }; break;
      case 'conductance': result = { L_s: conductance(args.d || 0.1, args.l || 1) }; break;
      case 'effective_speed': result = { L_s: effectivePumpSpeed(args.s || 100, args.c || 50) }; break;
      case 'outgassing': result = { Pa_L_s_cm2: outgassing(args.q0 || 1e-4, args.t || 3600, args.n || 1) }; break;
      case 'knudsen': result = { Kn: knudsen(args.mfp || 0.1, args.d || 0.01) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isVacuumAvailable(): boolean { return true; }
