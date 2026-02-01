/**
 * ACOUSTICS ADVANCED TOOL
 * Sound science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function soundPressure(p: number): number { return 20 * Math.log10(p / 2e-5); }
function soundIntensity(i: number): number { return 10 * Math.log10(i / 1e-12); }
function reverbTime(v: number, a: number): number { return 0.161 * v / a; }
function criticalDist(q: number, r: number): number { return Math.sqrt(q * r / (16 * Math.PI)); }
function absorption(alpha: number, area: number): number { return alpha * area; }
function transmission(tl: number): number { return Math.pow(10, -tl / 10); }
function roomModes(c: number, l: number, w: number, h: number, m: number, n: number, p: number): number { return c/2 * Math.sqrt(Math.pow(m/l,2) + Math.pow(n/w,2) + Math.pow(p/h,2)); }

export const acousticsAdvancedTool: UnifiedTool = {
  name: 'acoustics_advanced',
  description: 'Acoustics: spl, intensity_db, reverb_time, critical_dist, absorption, transmission, room_modes',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['spl', 'intensity_db', 'reverb_time', 'critical_dist', 'absorption', 'transmission', 'room_modes'] }, p: { type: 'number' }, i: { type: 'number' }, v: { type: 'number' }, a: { type: 'number' }, q: { type: 'number' }, r: { type: 'number' }, alpha: { type: 'number' }, area: { type: 'number' }, tl: { type: 'number' }, c: { type: 'number' }, l: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' }, m: { type: 'number' }, n: { type: 'number' } }, required: ['operation'] },
};

export async function executeAcousticsAdvanced(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'spl': result = { dB: soundPressure(args.p || 0.02) }; break;
      case 'intensity_db': result = { dB: soundIntensity(args.i || 1e-6) }; break;
      case 'reverb_time': result = { s: reverbTime(args.v || 500, args.a || 100) }; break;
      case 'critical_dist': result = { m: criticalDist(args.q || 2, args.r || 100) }; break;
      case 'absorption': result = { sabins: absorption(args.alpha || 0.3, args.area || 50) }; break;
      case 'transmission': result = { tau: transmission(args.tl || 40) }; break;
      case 'room_modes': result = { Hz: roomModes(args.c || 343, args.l || 10, args.w || 8, args.h || 3, args.m || 1, args.n || 0, args.p || 0) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isAcousticsAdvancedAvailable(): boolean { return true; }
