/**
 * TEXTILE TOOL
 * Textile engineering calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function yarnCount(length: number, weight: number): number { return length / weight; }
function fabricGSM(weight: number, area: number): number { return weight / area * 1000; }
function tensileStrength(force: number, area: number): number { return force / area; }
function elongation(l1: number, l0: number): number { return (l1 - l0) / l0 * 100; }
function threadPerInch(threads: number, inches: number): number { return threads / inches; }
function shrinkage(l0: number, l1: number): number { return (l0 - l1) / l0 * 100; }
function moistureRegain(wet: number, dry: number): number { return (wet - dry) / dry * 100; }

export const textileTool: UnifiedTool = {
  name: 'textile',
  description: 'Textile: yarn_count, gsm, tensile_strength, elongation, tpi, shrinkage, moisture_regain',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['yarn_count', 'gsm', 'tensile_strength', 'elongation', 'tpi', 'shrinkage', 'moisture_regain'] }, length: { type: 'number' }, weight: { type: 'number' }, area: { type: 'number' }, force: { type: 'number' }, l1: { type: 'number' }, l0: { type: 'number' }, threads: { type: 'number' }, inches: { type: 'number' }, wet: { type: 'number' }, dry: { type: 'number' } }, required: ['operation'] },
};

export async function executeTextile(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'yarn_count': result = { Ne: yarnCount(args.length || 840, args.weight || 1) }; break;
      case 'gsm': result = { gsm: fabricGSM(args.weight || 200, args.area || 1) }; break;
      case 'tensile_strength': result = { MPa: tensileStrength(args.force || 500, args.area || 1) }; break;
      case 'elongation': result = { percent: elongation(args.l1 || 110, args.l0 || 100) }; break;
      case 'tpi': result = { tpi: threadPerInch(args.threads || 60, args.inches || 1) }; break;
      case 'shrinkage': result = { percent: shrinkage(args.l0 || 100, args.l1 || 95) }; break;
      case 'moisture_regain': result = { percent: moistureRegain(args.wet || 108, args.dry || 100) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isTextileAvailable(): boolean { return true; }
