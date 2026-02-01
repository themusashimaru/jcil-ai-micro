/**
 * MANUFACTURING TOOL
 * Manufacturing and production calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function machiningTime(length: number, feed: number, rpm: number): number { return length / (feed * rpm); }
function cuttingSpeed(d: number, n: number): number { return Math.PI * d * n / 1000; }
function materialRemovalRate(d: number, f: number, v: number): number { return d * f * v; }
function oee(availability: number, performance: number, quality: number): number { return availability * performance * quality; }
function cycleTime(units: number, time: number): number { return time / units; }
function taktTime(available: number, demand: number): number { return available / demand; }
function defectRate(defects: number, total: number): number { return (defects / total) * 1e6; }

export const manufacturingTool: UnifiedTool = {
  name: 'manufacturing',
  description: 'Manufacturing: machining_time, cutting_speed, mrr, oee, cycle_time, takt_time, ppm',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['machining_time', 'cutting_speed', 'mrr', 'oee', 'cycle_time', 'takt_time', 'ppm'] }, length: { type: 'number' }, feed: { type: 'number' }, rpm: { type: 'number' }, d: { type: 'number' }, n: { type: 'number' }, f: { type: 'number' }, v: { type: 'number' }, availability: { type: 'number' }, performance: { type: 'number' }, quality: { type: 'number' }, units: { type: 'number' }, time: { type: 'number' }, available: { type: 'number' }, demand: { type: 'number' }, defects: { type: 'number' }, total: { type: 'number' } }, required: ['operation'] },
};

export async function executeManufacturing(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'machining_time': result = { time_min: machiningTime(args.length || 100, args.feed || 0.2, args.rpm || 1000) }; break;
      case 'cutting_speed': result = { Vc_m_min: cuttingSpeed(args.d || 50, args.n || 1000) }; break;
      case 'mrr': result = { mrr_mm3_min: materialRemovalRate(args.d || 2, args.f || 0.2, args.v || 100) }; break;
      case 'oee': result = { oee_percent: oee(args.availability || 0.9, args.performance || 0.85, args.quality || 0.99) * 100 }; break;
      case 'cycle_time': result = { cycle_sec: cycleTime(args.units || 100, args.time || 3600) }; break;
      case 'takt_time': result = { takt_sec: taktTime(args.available || 28800, args.demand || 500) }; break;
      case 'ppm': result = { ppm: defectRate(args.defects || 5, args.total || 10000) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isManufacturingAvailable(): boolean { return true; }
