/**
 * PLUMBING TOOL
 * Plumbing engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function pipeFlow(d: number, v: number): number { return Math.PI * d * d / 4 * v; }
function headLoss(f: number, l: number, d: number, v: number): number { return f * l / d * v * v / (2 * 9.81); }
function fixtureUnits(fixtures: {type: string, count: number}[]): number { const values: Record<string, number> = { wc: 4, lav: 1, sink: 2, shower: 2 }; return fixtures.reduce((sum, f) => sum + (values[f.type] || 1) * f.count, 0); }
function hotWater(people: number, usage: number): number { return people * usage; }
function drainSlope(size: number): number { return size <= 3 ? 0.25 : 0.125; }
function ventSize(dfu: number): number { return dfu <= 24 ? 1.5 : dfu <= 84 ? 2 : dfu <= 256 ? 3 : 4; }
function waterPressure(height: number, rho: number): number { return rho * 9.81 * height / 1000; }

export const plumbingTool: UnifiedTool = {
  name: 'plumbing',
  description: 'Plumbing: pipe_flow, head_loss, fixture_units, hot_water, drain_slope, vent_size, pressure',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['pipe_flow', 'head_loss', 'fixture_units', 'hot_water', 'drain_slope', 'vent_size', 'pressure'] }, d: { type: 'number' }, v: { type: 'number' }, f: { type: 'number' }, l: { type: 'number' }, fixtures: { type: 'array' }, people: { type: 'number' }, usage: { type: 'number' }, size: { type: 'number' }, dfu: { type: 'number' }, height: { type: 'number' }, rho: { type: 'number' } }, required: ['operation'] },
};

export async function executePlumbing(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'pipe_flow': result = { L_s: pipeFlow(args.d || 0.05, args.v || 2) * 1000 }; break;
      case 'head_loss': result = { m: headLoss(args.f || 0.02, args.l || 30, args.d || 0.05, args.v || 2) }; break;
      case 'fixture_units': result = { DFU: fixtureUnits(args.fixtures || [{type: 'wc', count: 2}, {type: 'lav', count: 2}]) }; break;
      case 'hot_water': result = { L_day: hotWater(args.people || 4, args.usage || 50) }; break;
      case 'drain_slope': result = { in_ft: drainSlope(args.size || 4) }; break;
      case 'vent_size': result = { inches: ventSize(args.dfu || 50) }; break;
      case 'pressure': result = { kPa: waterPressure(args.height || 10, args.rho || 1000) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isPlumbingAvailable(): boolean { return true; }
