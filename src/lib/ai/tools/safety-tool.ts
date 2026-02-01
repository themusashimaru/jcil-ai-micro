/**
 * SAFETY TOOL
 * Industrial safety calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function riskPriority(severity: number, occurrence: number, detection: number): number { return severity * occurrence * detection; }
function explosionLimit(lel: number, uel: number, conc: number): number { return conc < lel ? 0 : conc > uel ? 0 : 1; }
function fireLoad(materials: {mass: number, heat: number}[], area: number): number { return materials.reduce((sum, m) => sum + m.mass * m.heat, 0) / area / 1000; }
function noiseExposure(levels: number[], times: number[]): number { return levels.reduce((sum, l, i) => sum + times[i] * Math.pow(10, l/10), 0); }
function twa(exposures: {conc: number, time: number}[]): number { return exposures.reduce((sum, e) => sum + e.conc * e.time, 0) / 8; }
function hazardDistance(q: number, er: number): number { return Math.sqrt(q / (4 * Math.PI * er)); }
function reliabilityBlock(components: number[], series: boolean): number { return series ? components.reduce((p, r) => p * r, 1) : 1 - components.reduce((p, r) => p * (1 - r), 1); }

export const safetyTool: UnifiedTool = {
  name: 'safety',
  description: 'Safety: rpn, explosion_check, fire_load, noise_dose, twa, hazard_distance, reliability',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['rpn', 'explosion_check', 'fire_load', 'noise_dose', 'twa', 'hazard_distance', 'reliability'] }, severity: { type: 'number' }, occurrence: { type: 'number' }, detection: { type: 'number' }, lel: { type: 'number' }, uel: { type: 'number' }, conc: { type: 'number' }, materials: { type: 'array' }, area: { type: 'number' }, levels: { type: 'array' }, times: { type: 'array' }, exposures: { type: 'array' }, q: { type: 'number' }, er: { type: 'number' }, components: { type: 'array' }, series: { type: 'boolean' } }, required: ['operation'] },
};

export async function executeSafety(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'rpn': result = { RPN: riskPriority(args.severity || 5, args.occurrence || 3, args.detection || 4) }; break;
      case 'explosion_check': result = { in_range: explosionLimit(args.lel || 1.4, args.uel || 7.6, args.conc || 3) === 1 }; break;
      case 'fire_load': result = { MJ_m2: fireLoad(args.materials || [{mass: 100, heat: 18}], args.area || 50) }; break;
      case 'noise_dose': result = { dose: noiseExposure(args.levels || [85, 90], args.times || [4, 4]) }; break;
      case 'twa': result = { ppm: twa(args.exposures || [{conc: 50, time: 4}, {conc: 100, time: 4}]) }; break;
      case 'hazard_distance': result = { meters: hazardDistance(args.q || 1000, args.er || 5) }; break;
      case 'reliability': result = { R: reliabilityBlock(args.components || [0.99, 0.98, 0.97], args.series !== false) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isSafetyAvailable(): boolean { return true; }
