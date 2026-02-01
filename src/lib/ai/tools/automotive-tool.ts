/**
 * AUTOMOTIVE TOOL
 * Vehicle engineering calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function enginePower(torque: number, rpm: number): number { return torque * rpm / 5252; }
function acceleration(force: number, mass: number): number { return force / mass; }
function brakingDistance(v: number, mu: number): number { return (v * v) / (2 * mu * 9.81); }
function fuelConsumption(distance: number, fuel: number): number { return distance / fuel; }
function dragForce(cd: number, a: number, rho: number, v: number): number { return 0.5 * cd * a * rho * v * v; }
function rollingResistance(crr: number, m: number, g: number): number { return crr * m * g; }
function gearRatio(driven: number, driving: number): number { return driven / driving; }

export const automotiveTool: UnifiedTool = {
  name: 'automotive',
  description: 'Automotive: engine_power, acceleration, braking_distance, mpg, drag_force, rolling_resistance, gear_ratio',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['engine_power', 'acceleration', 'braking_distance', 'mpg', 'drag_force', 'rolling_resistance', 'gear_ratio'] }, torque: { type: 'number' }, rpm: { type: 'number' }, force: { type: 'number' }, mass: { type: 'number' }, v: { type: 'number' }, mu: { type: 'number' }, distance: { type: 'number' }, fuel: { type: 'number' }, cd: { type: 'number' }, a: { type: 'number' }, rho: { type: 'number' }, crr: { type: 'number' }, m: { type: 'number' }, g: { type: 'number' }, driven: { type: 'number' }, driving: { type: 'number' } }, required: ['operation'] },
};

export async function executeAutomotive(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'engine_power': result = { hp: enginePower(args.torque || 300, args.rpm || 5000) }; break;
      case 'acceleration': result = { a_m_s2: acceleration(args.force || 5000, args.mass || 1500) }; break;
      case 'braking_distance': result = { distance_m: brakingDistance(args.v || 30, args.mu || 0.8) }; break;
      case 'mpg': result = { mpg: fuelConsumption(args.distance || 300, args.fuel || 10) }; break;
      case 'drag_force': result = { force_N: dragForce(args.cd || 0.3, args.a || 2.2, args.rho || 1.225, args.v || 30) }; break;
      case 'rolling_resistance': result = { force_N: rollingResistance(args.crr || 0.01, args.m || 1500, args.g || 9.81) }; break;
      case 'gear_ratio': result = { ratio: gearRatio(args.driven || 40, args.driving || 15) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isAutomotiveAvailable(): boolean { return true; }
