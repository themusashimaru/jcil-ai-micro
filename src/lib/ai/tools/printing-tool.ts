/**
 * 3D PRINTING TOOL
 * Additive manufacturing calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function printTime(volume: number, rate: number): number { return volume / rate / 60; }
function materialCost(volume: number, density: number, price: number): number { return volume * density * price / 1000; }
function layerCount(height: number, layer: number): number { return Math.ceil(height / layer); }
function infillVolume(shell: number, infill: number): number { return shell * (1 - infill / 100); }
function supportVolume(overhang: number, density: number): number { return overhang * density / 100; }
function bedAdhesion(area: number, force: number): number { return force / area; }
function shrinkageCompensation(size: number, shrink: number): number { return size / (1 - shrink / 100); }

export const printingTool: UnifiedTool = {
  name: 'printing_3d',
  description: '3D Print: print_time, material_cost, layer_count, infill_volume, support, bed_adhesion, shrink_comp',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['print_time', 'material_cost', 'layer_count', 'infill_volume', 'support', 'bed_adhesion', 'shrink_comp'] }, volume: { type: 'number' }, rate: { type: 'number' }, density: { type: 'number' }, price: { type: 'number' }, height: { type: 'number' }, layer: { type: 'number' }, shell: { type: 'number' }, infill: { type: 'number' }, overhang: { type: 'number' }, area: { type: 'number' }, force: { type: 'number' }, size: { type: 'number' }, shrink: { type: 'number' } }, required: ['operation'] },
};

export async function executePrinting(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'print_time': result = { hours: printTime(args.volume || 50000, args.rate || 100) }; break;
      case 'material_cost': result = { dollars: materialCost(args.volume || 50000, args.density || 1.24, args.price || 25) }; break;
      case 'layer_count': result = { layers: layerCount(args.height || 50, args.layer || 0.2) }; break;
      case 'infill_volume': result = { mm3: infillVolume(args.shell || 50000, args.infill || 20) }; break;
      case 'support': result = { mm3: supportVolume(args.overhang || 5000, args.density || 15) }; break;
      case 'bed_adhesion': result = { kPa: bedAdhesion(args.area || 1000, args.force || 50) }; break;
      case 'shrink_comp': result = { mm: shrinkageCompensation(args.size || 100, args.shrink || 2) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isPrintingAvailable(): boolean { return true; }
