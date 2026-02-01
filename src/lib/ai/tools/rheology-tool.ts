/**
 * RHEOLOGY TOOL
 * Flow of matter
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function newtonianViscosity(tau: number, gamma: number): number { return tau / gamma; }
function powerLaw(k: number, gamma: number, n: number): number { return k * Math.pow(gamma, n); }
function binghamPlastic(tau0: number, eta: number, gamma: number): number { return tau0 + eta * gamma; }
function herschelBulkley(tau0: number, k: number, gamma: number, n: number): number { return tau0 + k * Math.pow(gamma, n); }
function relaxationTime(eta: number, g: number): number { return eta / g; }
function deborah(lambda: number, t: number): number { return lambda / t; }
function weissenberg(lambda: number, gamma: number): number { return lambda * gamma; }

export const rheologyTool: UnifiedTool = {
  name: 'rheology',
  description: 'Rheology: newtonian, power_law, bingham, herschel_bulkley, relaxation, deborah, weissenberg',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['newtonian', 'power_law', 'bingham', 'herschel_bulkley', 'relaxation', 'deborah', 'weissenberg'] }, tau: { type: 'number' }, gamma: { type: 'number' }, k: { type: 'number' }, n: { type: 'number' }, tau0: { type: 'number' }, eta: { type: 'number' }, g: { type: 'number' }, lambda: { type: 'number' }, t: { type: 'number' } }, required: ['operation'] },
};

export async function executeRheology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'newtonian': result = { Pa_s: newtonianViscosity(args.tau || 100, args.gamma || 10) }; break;
      case 'power_law': result = { Pa: powerLaw(args.k || 10, args.gamma || 10, args.n || 0.5) }; break;
      case 'bingham': result = { Pa: binghamPlastic(args.tau0 || 10, args.eta || 1, args.gamma || 100) }; break;
      case 'herschel_bulkley': result = { Pa: herschelBulkley(args.tau0 || 10, args.k || 5, args.gamma || 10, args.n || 0.5) }; break;
      case 'relaxation': result = { s: relaxationTime(args.eta || 1000, args.g || 1000) }; break;
      case 'deborah': result = { De: deborah(args.lambda || 0.1, args.t || 1) }; break;
      case 'weissenberg': result = { Wi: weissenberg(args.lambda || 0.1, args.gamma || 10) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isRheologyAvailable(): boolean { return true; }
