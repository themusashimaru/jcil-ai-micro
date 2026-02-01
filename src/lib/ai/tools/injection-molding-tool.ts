/**
 * INJECTION MOLDING TOOL
 * Plastic injection molding calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function clampForce(area: number, pressure: number): number { return area * pressure / 1000; }
function shotSize(part: number, runner: number): number { return part + runner; }
function cycleTime(inject: number, cool: number, open: number): number { return inject + cool + open; }
function shrinkage(mold: number, part: number): number { return (mold - part) / mold * 100; }
function flowLength(thickness: number, mfi: number): number { return thickness * mfi * 10; }
function packPressure(fill: number, ratio: number): number { return fill * ratio; }
function coolingTime(t: number, k: number, rho: number, cp: number, dT: number): number { return rho * cp * t * t / (Math.PI * Math.PI * k) * Math.log(8 / (Math.PI * Math.PI) * dT / 10); }

export const injectionMoldingTool: UnifiedTool = {
  name: 'injection_molding',
  description: 'Injection: clamp_force, shot_size, cycle_time, shrinkage, flow_length, pack_pressure, cooling_time',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['clamp_force', 'shot_size', 'cycle_time', 'shrinkage', 'flow_length', 'pack_pressure', 'cooling_time'] }, area: { type: 'number' }, pressure: { type: 'number' }, part: { type: 'number' }, runner: { type: 'number' }, inject: { type: 'number' }, cool: { type: 'number' }, open: { type: 'number' }, mold: { type: 'number' }, thickness: { type: 'number' }, mfi: { type: 'number' }, fill: { type: 'number' }, ratio: { type: 'number' }, t: { type: 'number' }, k: { type: 'number' }, rho: { type: 'number' }, cp: { type: 'number' }, dT: { type: 'number' } }, required: ['operation'] },
};

export async function executeInjectionMolding(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'clamp_force': result = { tonnes: clampForce(args.area || 200, args.pressure || 50) }; break;
      case 'shot_size': result = { cm3: shotSize(args.part || 50, args.runner || 10) }; break;
      case 'cycle_time': result = { seconds: cycleTime(args.inject || 2, args.cool || 15, args.open || 3) }; break;
      case 'shrinkage': result = { percent: shrinkage(args.mold || 100, args.part || 98) }; break;
      case 'flow_length': result = { mm: flowLength(args.thickness || 2, args.mfi || 10) }; break;
      case 'pack_pressure': result = { MPa: packPressure(args.fill || 80, args.ratio || 0.8) }; break;
      case 'cooling_time': result = { seconds: coolingTime(args.t || 0.003, args.k || 0.2, args.rho || 1000, args.cp || 2000, args.dT || 100) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isInjectionMoldingAvailable(): boolean { return true; }
