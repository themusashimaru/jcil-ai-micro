/**
 * CASTING TOOL
 * Metal casting calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function solidificationTime(v: number, a: number, b: number): number { return b * Math.pow(v / a, 2); }
/* eslint-disable @typescript-eslint/no-unused-vars */
function shrinkage(liquid: number, solid: number): number { return (liquid - solid) / solid * 100; }
function pouringTemp(melt: number, superheat: number): number { return melt + superheat; }
function riserSize(v: number): number { return Math.pow(6 * v / Math.PI, 1/3); }
function gatingRatio(sprue: number, _runner: number, gate: number): number { return sprue / gate; }
function fluidity(superheat: number, viscosity: number): number { return superheat / viscosity * 100; }
function feedingDistance(t: number, modulus: number): number { return 4.5 * t * Math.sqrt(modulus); }

export const castingTool: UnifiedTool = {
  name: 'casting',
  description: 'Casting: solidification, shrinkage, pouring_temp, riser_size, gating_ratio, fluidity, feeding_distance',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['solidification', 'shrinkage', 'pouring_temp', 'riser_size', 'gating_ratio', 'fluidity', 'feeding_distance'] }, v: { type: 'number' }, a: { type: 'number' }, b: { type: 'number' }, liquid: { type: 'number' }, solid: { type: 'number' }, melt: { type: 'number' }, superheat: { type: 'number' }, sprue: { type: 'number' }, runner: { type: 'number' }, gate: { type: 'number' }, viscosity: { type: 'number' }, t: { type: 'number' }, modulus: { type: 'number' } }, required: ['operation'] },
};

export async function executeCasting(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'solidification': result = { time_min: solidificationTime(args.v || 1000, args.a || 100, args.b || 3) }; break;
      case 'shrinkage': result = { percent: shrinkage(args.liquid || 7.0, args.solid || 7.87) }; break;
      case 'pouring_temp': result = { celsius: pouringTemp(args.melt || 1540, args.superheat || 100) }; break;
      case 'riser_size': result = { diameter_cm: riserSize(args.v || 500) }; break;
      case 'gating_ratio': result = { ratio: gatingRatio(args.sprue || 1, args.runner || 2, args.gate || 4) }; break;
      case 'fluidity': result = { index: fluidity(args.superheat || 100, args.viscosity || 5) }; break;
      case 'feeding_distance': result = { cm: feedingDistance(args.t || 5, args.modulus || 2) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isCastingAvailable(): boolean { return true; }
