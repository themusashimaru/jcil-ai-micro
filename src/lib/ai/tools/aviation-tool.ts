/**
 * AVIATION TOOL
 * Aviation and flight calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function lift(cl: number, rho: number, v: number, s: number): number { return 0.5 * cl * rho * v * v * s; }
function drag(cd: number, rho: number, v: number, s: number): number { return 0.5 * cd * rho * v * v * s; }
function stallSpeed(w: number, rho: number, s: number, clmax: number): number { return Math.sqrt(2 * w / (rho * s * clmax)); }
function range(eff: number, fuel: number, weight: number): number { return eff * fuel / weight * 3.6; }
function endurance(fuel: number, consumption: number): number { return fuel / consumption; }
function densityAltitude(pa: number, oat: number): number { return pa + 120 * (oat - (15 - 0.002 * pa)); }
function trueAirspeed(cas: number, alt: number): number { return cas * Math.pow(1 + alt / 44330, 0.5); }

export const aviationTool: UnifiedTool = {
  name: 'aviation',
  description: 'Aviation: lift, drag, stall_speed, range, endurance, density_altitude, true_airspeed',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['lift', 'drag', 'stall_speed', 'range', 'endurance', 'density_altitude', 'true_airspeed'] }, cl: { type: 'number' }, cd: { type: 'number' }, rho: { type: 'number' }, v: { type: 'number' }, s: { type: 'number' }, w: { type: 'number' }, clmax: { type: 'number' }, eff: { type: 'number' }, fuel: { type: 'number' }, weight: { type: 'number' }, consumption: { type: 'number' }, pa: { type: 'number' }, oat: { type: 'number' }, cas: { type: 'number' }, alt: { type: 'number' } }, required: ['operation'] },
};

export async function executeAviation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'lift': result = { force_N: lift(args.cl || 1.5, args.rho || 1.225, args.v || 70, args.s || 20) }; break;
      case 'drag': result = { force_N: drag(args.cd || 0.03, args.rho || 1.225, args.v || 70, args.s || 20) }; break;
      case 'stall_speed': result = { speed_m_s: stallSpeed(args.w || 10000, args.rho || 1.225, args.s || 20, args.clmax || 2.0) }; break;
      case 'range': result = { range_km: range(args.eff || 0.4, args.fuel || 200, args.weight || 1000) }; break;
      case 'endurance': result = { hours: endurance(args.fuel || 200, args.consumption || 40) }; break;
      case 'density_altitude': result = { ft: densityAltitude(args.pa || 5000, args.oat || 30) }; break;
      case 'true_airspeed': result = { kts: trueAirspeed(args.cas || 150, args.alt || 10000) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isAviationAvailable(): boolean { return true; }
