/**
 * EDM TOOL
 * Electrical discharge machining
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function mrr(i: number, ton: number): number { return 0.1 * i * ton; }
function surfaceRoughness(i: number, ton: number): number { return 2.3 * Math.pow(i, 0.3) * Math.pow(ton, 0.2); }
function electrodeWear(mrr: number, ratio: number): number { return mrr / ratio; }
function gapVoltage(breakdown: number, servo: number): number { return breakdown * servo; }
function sparkEnergy(v: number, i: number, ton: number): number { return v * i * ton * 1e-6; }
function dutyCycle(ton: number, toff: number): number { return ton / (ton + toff) * 100; }
function flushingRate(gap: number, area: number, velocity: number): number { return gap * area * velocity; }

export const edmTool: UnifiedTool = {
  name: 'edm',
  description: 'EDM: mrr, roughness, electrode_wear, gap_voltage, spark_energy, duty_cycle, flushing',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['mrr', 'roughness', 'electrode_wear', 'gap_voltage', 'spark_energy', 'duty_cycle', 'flushing'] }, i: { type: 'number' }, ton: { type: 'number' }, mrr: { type: 'number' }, ratio: { type: 'number' }, breakdown: { type: 'number' }, servo: { type: 'number' }, v: { type: 'number' }, toff: { type: 'number' }, gap: { type: 'number' }, area: { type: 'number' }, velocity: { type: 'number' } }, required: ['operation'] },
};

export async function executeEdm(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'mrr': result = { mm3_min: mrr(args.i || 10, args.ton || 100) }; break;
      case 'roughness': result = { Ra_um: surfaceRoughness(args.i || 10, args.ton || 100) }; break;
      case 'electrode_wear': result = { mm3_min: electrodeWear(args.mrr || 100, args.ratio || 10) }; break;
      case 'gap_voltage': result = { V: gapVoltage(args.breakdown || 200, args.servo || 0.4) }; break;
      case 'spark_energy': result = { mJ: sparkEnergy(args.v || 80, args.i || 10, args.ton || 100) }; break;
      case 'duty_cycle': result = { percent: dutyCycle(args.ton || 100, args.toff || 50) }; break;
      case 'flushing': result = { L_min: flushingRate(args.gap || 0.1, args.area || 100, args.velocity || 1) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isEdmAvailable(): boolean { return true; }
