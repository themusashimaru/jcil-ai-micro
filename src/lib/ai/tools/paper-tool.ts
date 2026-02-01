/**
 * PAPER TOOL
 * Paper and pulp engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function basisWeight(mass: number, area: number): number { return mass / area * 1000; }
function caliper(thickness: number, sheets: number): number { return thickness / sheets * 1000; }
function bulkDensity(weight: number, caliper: number): number { return weight / caliper; }
function tearStrength(force: number, sheets: number): number { return force * 16 / sheets; }
function burstStrength(pressure: number): number { return pressure; }
function opacity(r0: number, rinf: number): number { return r0 / rinf * 100; }
function brightness(reflectance: number): number { return reflectance * 100; }

export const paperTool: UnifiedTool = {
  name: 'paper',
  description: 'Paper: basis_weight, caliper, bulk_density, tear, burst, opacity, brightness',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['basis_weight', 'caliper', 'bulk_density', 'tear', 'burst', 'opacity', 'brightness'] }, mass: { type: 'number' }, area: { type: 'number' }, thickness: { type: 'number' }, sheets: { type: 'number' }, weight: { type: 'number' }, force: { type: 'number' }, pressure: { type: 'number' }, r0: { type: 'number' }, rinf: { type: 'number' }, reflectance: { type: 'number' } }, required: ['operation'] },
};

export async function executePaper(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'basis_weight': result = { gsm: basisWeight(args.mass || 80, args.area || 1) }; break;
      case 'caliper': result = { microns: caliper(args.thickness || 1, args.sheets || 10) }; break;
      case 'bulk_density': result = { g_cm3: bulkDensity(args.weight || 80, args.thickness || 100) }; break;
      case 'tear': result = { mN: tearStrength(args.force || 500, args.sheets || 16) }; break;
      case 'burst': result = { kPa: burstStrength(args.pressure || 250) }; break;
      case 'opacity': result = { percent: opacity(args.r0 || 85, args.rinf || 90) }; break;
      case 'brightness': result = { iso: brightness(args.reflectance || 0.85) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isPaperAvailable(): boolean { return true; }
