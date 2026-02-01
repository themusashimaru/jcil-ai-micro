/**
 * ERGONOMICS TOOL
 * Human factors engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function niosh(lc: number, hm: number, vm: number, dm: number, am: number, fm: number, cm: number): number { return lc * hm * vm * dm * am * fm * cm; }
function metabolicRate(activity: number, weight: number): number { return activity * weight; }
function reachEnvelope(armLength: number, angle: number): number { return armLength * Math.cos(angle * Math.PI / 180); }
function illumination(lumens: number, area: number): number { return lumens / area; }
function thermalComfort(ta: number, tr: number, v: number, rh: number): number { return 0.303 * Math.exp(-0.036 * (ta + tr) / 2) + 0.028; }
function vdt(distance: number, charHeight: number): number { return 2 * Math.atan(charHeight / (2 * distance)) * 180 / Math.PI * 60; }
function anthropometry(percentile: number, mean: number, sd: number): number { const z = percentile === 5 ? -1.645 : percentile === 50 ? 0 : percentile === 95 ? 1.645 : 0; return mean + z * sd; }

export const ergonomicsTool: UnifiedTool = {
  name: 'ergonomics',
  description: 'Ergonomics: niosh_rwl, metabolic_rate, reach, illumination, pmv, visual_angle, anthropometry',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['niosh_rwl', 'metabolic_rate', 'reach', 'illumination', 'pmv', 'visual_angle', 'anthropometry'] }, lc: { type: 'number' }, hm: { type: 'number' }, vm: { type: 'number' }, dm: { type: 'number' }, am: { type: 'number' }, fm: { type: 'number' }, cm: { type: 'number' }, activity: { type: 'number' }, weight: { type: 'number' }, armLength: { type: 'number' }, angle: { type: 'number' }, lumens: { type: 'number' }, area: { type: 'number' }, ta: { type: 'number' }, tr: { type: 'number' }, v: { type: 'number' }, rh: { type: 'number' }, distance: { type: 'number' }, charHeight: { type: 'number' }, percentile: { type: 'number' }, mean: { type: 'number' }, sd: { type: 'number' } }, required: ['operation'] },
};

export async function executeErgonomics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'niosh_rwl': result = { kg: niosh(args.lc || 23, args.hm || 1, args.vm || 1, args.dm || 1, args.am || 1, args.fm || 1, args.cm || 1) }; break;
      case 'metabolic_rate': result = { W: metabolicRate(args.activity || 3, args.weight || 70) }; break;
      case 'reach': result = { cm: reachEnvelope(args.armLength || 70, args.angle || 30) }; break;
      case 'illumination': result = { lux: illumination(args.lumens || 5000, args.area || 10) }; break;
      case 'pmv': result = { PMV: thermalComfort(args.ta || 22, args.tr || 22, args.v || 0.1, args.rh || 50) }; break;
      case 'visual_angle': result = { arcmin: vdt(args.distance || 50, args.charHeight || 3) }; break;
      case 'anthropometry': result = { mm: anthropometry(args.percentile || 50, args.mean || 1750, args.sd || 70) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isErgonomicsAvailable(): boolean { return true; }
