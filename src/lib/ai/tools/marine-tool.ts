/**
 * MARINE TOOL
 * Marine and naval engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function buoyancy(rho: number, v: number, g: number): number { return rho * v * g; }
function displacement(l: number, b: number, t: number, cb: number): number { return l * b * t * cb * 1025; }
function waveSpeed(g: number, depth: number): number { return Math.sqrt(g * depth); }
function propellerThrust(rho: number, d: number, n: number, kt: number): number { return rho * Math.pow(n, 2) * Math.pow(d, 4) * kt; }
function stability(gm: number, disp: number, theta: number): number { return gm * disp * 9.81 * Math.sin(theta * Math.PI / 180); }
function fuelRange(capacity: number, consumption: number, speed: number): number { return capacity / consumption * speed; }
function hullResistance(cf: number, rho: number, v: number, ws: number): number { return 0.5 * cf * rho * v * v * ws; }

export const marineTool: UnifiedTool = {
  name: 'marine',
  description: 'Marine: buoyancy, displacement, wave_speed, propeller_thrust, stability, fuel_range, hull_resistance',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['buoyancy', 'displacement', 'wave_speed', 'propeller_thrust', 'stability', 'fuel_range', 'hull_resistance'] }, rho: { type: 'number' }, v: { type: 'number' }, g: { type: 'number' }, l: { type: 'number' }, b: { type: 'number' }, t: { type: 'number' }, cb: { type: 'number' }, depth: { type: 'number' }, d: { type: 'number' }, n: { type: 'number' }, kt: { type: 'number' }, gm: { type: 'number' }, disp: { type: 'number' }, theta: { type: 'number' }, capacity: { type: 'number' }, consumption: { type: 'number' }, speed: { type: 'number' }, cf: { type: 'number' }, ws: { type: 'number' } }, required: ['operation'] },
};

export async function executeMarine(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'buoyancy': result = { force_N: buoyancy(args.rho || 1025, args.v || 100, args.g || 9.81) }; break;
      case 'displacement': result = { tonnes: displacement(args.l || 100, args.b || 15, args.t || 5, args.cb || 0.7) / 1000 }; break;
      case 'wave_speed': result = { speed_m_s: waveSpeed(args.g || 9.81, args.depth || 100) }; break;
      case 'propeller_thrust': result = { thrust_N: propellerThrust(args.rho || 1025, args.d || 3, args.n || 2, args.kt || 0.2) }; break;
      case 'stability': result = { moment_Nm: stability(args.gm || 1, args.disp || 5000, args.theta || 10) }; break;
      case 'fuel_range': result = { range_nm: fuelRange(args.capacity || 500, args.consumption || 50, args.speed || 15) }; break;
      case 'hull_resistance': result = { resistance_N: hullResistance(args.cf || 0.002, args.rho || 1025, args.v || 8, args.ws || 1000) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isMarineAvailable(): boolean { return true; }
