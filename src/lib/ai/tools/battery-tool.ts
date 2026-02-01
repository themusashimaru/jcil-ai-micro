/**
 * BATTERY TOOL
 * Battery and energy storage calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function capacity(current: number, time: number): number { return current * time; }
function energy(v: number, ah: number): number { return v * ah; }
function cRate(current: number, capacity: number): number { return current / capacity; }
function soc(remaining: number, total: number): number { return (remaining / total) * 100; }
function cycleLife(dod: number): number { return 1000 * Math.pow(0.8 / dod, 1.5); }
function internalResistance(ocv: number, v: number, i: number): number { return (ocv - v) / i; }
function peukert(i: number, c: number, k: number): number { return c / Math.pow(i, k - 1); }

export const batteryTool: UnifiedTool = {
  name: 'battery',
  description: 'Battery: capacity, energy, c_rate, soc, cycle_life, internal_r, peukert',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['capacity', 'energy', 'c_rate', 'soc', 'cycle_life', 'internal_r', 'peukert'] }, current: { type: 'number' }, time: { type: 'number' }, v: { type: 'number' }, ah: { type: 'number' }, remaining: { type: 'number' }, total: { type: 'number' }, dod: { type: 'number' }, ocv: { type: 'number' }, i: { type: 'number' }, c: { type: 'number' }, k: { type: 'number' } }, required: ['operation'] },
};

export async function executeBattery(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'capacity': result = { Ah: capacity(args.current || 2, args.time || 5) }; break;
      case 'energy': result = { Wh: energy(args.v || 3.7, args.ah || 2.5) }; break;
      case 'c_rate': result = { C: cRate(args.current || 5, args.capacity || 10) }; break;
      case 'soc': result = { percent: soc(args.remaining || 7, args.total || 10) }; break;
      case 'cycle_life': result = { cycles: cycleLife(args.dod || 0.8) }; break;
      case 'internal_r': result = { ohms: internalResistance(args.ocv || 4.2, args.v || 4.0, args.i || 2) }; break;
      case 'peukert': result = { hours: peukert(args.i || 5, args.c || 100, args.k || 1.2) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isBatteryAvailable(): boolean { return true; }
