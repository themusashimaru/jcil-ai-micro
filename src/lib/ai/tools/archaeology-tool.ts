/**
 * ARCHAEOLOGY TOOL
 * Archaeological science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function radiocarbon(c14: number, c14_0: number): number { return -8033 * Math.log(c14 / c14_0); }
function stratigraphy(layer: number, rate: number): number { return layer * rate; }
function siteArea(artifacts: number, density: number): number { return artifacts / density; }
function populationEstimate(houses: number, persons: number): number { return houses * persons; }
function toolTypology(length: number, width: number, thickness: number): string { const ratio = length / width; if (ratio > 2) return 'blade'; if (thickness / width > 0.5) return 'core'; return 'flake'; }
function seriation(types: number[], periods: number): number[] { return types.map((t, i) => i < periods ? t : 0); }
function survivalRate(found: number, expected: number): number { return found / expected * 100; }

export const archaeologyTool: UnifiedTool = {
  name: 'archaeology',
  description: 'Archaeology: radiocarbon, stratigraphy, site_area, population, tool_type, seriation, survival_rate',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['radiocarbon', 'stratigraphy', 'site_area', 'population', 'tool_type', 'seriation', 'survival_rate'] }, c14: { type: 'number' }, c14_0: { type: 'number' }, layer: { type: 'number' }, rate: { type: 'number' }, artifacts: { type: 'number' }, density: { type: 'number' }, houses: { type: 'number' }, persons: { type: 'number' }, length: { type: 'number' }, width: { type: 'number' }, thickness: { type: 'number' }, types: { type: 'array' }, periods: { type: 'number' }, found: { type: 'number' }, expected: { type: 'number' } }, required: ['operation'] },
};

export async function executeArchaeology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'radiocarbon': result = { years_BP: radiocarbon(args.c14 || 50, args.c14_0 || 100) }; break;
      case 'stratigraphy': result = { years: stratigraphy(args.layer || 5, args.rate || 100) }; break;
      case 'site_area': result = { m2: siteArea(args.artifacts || 500, args.density || 10) }; break;
      case 'population': result = { people: populationEstimate(args.houses || 50, args.persons || 5) }; break;
      case 'tool_type': result = { type: toolTypology(args.length || 50, args.width || 30, args.thickness || 10) }; break;
      case 'seriation': result = { distribution: seriation(args.types || [10, 20, 30, 20, 10], args.periods || 5) }; break;
      case 'survival_rate': result = { percent: survivalRate(args.found || 100, args.expected || 500) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isArchaeologyAvailable(): boolean { return true; }
