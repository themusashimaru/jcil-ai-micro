/**
 * CHROMATOGRAPHY TOOL
 * Separation science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function retentionFactor(tr: number, tm: number): number { return (tr - tm) / tm; }
function selectivity(k2: number, k1: number): number { return k2 / k1; }
function resolution(tr2: number, tr1: number, w1: number, w2: number): number { return 2 * (tr2 - tr1) / (w1 + w2); }
function plateCount(tr: number, w: number): number { return 16 * Math.pow(tr / w, 2); }
function plateHeight(l: number, n: number): number { return l / n; }
function vanDeemter(a: number, b: number, c: number, u: number): number { return a + b/u + c*u; }
function asymmetry(a: number, _b: number): number { return _b / a; }

export const chromatographyTool: UnifiedTool = {
  name: 'chromatography',
  description: 'Chromatography: retention_factor, selectivity, resolution, plates, hetp, van_deemter, asymmetry',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['retention_factor', 'selectivity', 'resolution', 'plates', 'hetp', 'van_deemter', 'asymmetry'] }, tr: { type: 'number' }, tm: { type: 'number' }, k2: { type: 'number' }, k1: { type: 'number' }, tr2: { type: 'number' }, tr1: { type: 'number' }, w1: { type: 'number' }, w2: { type: 'number' }, w: { type: 'number' }, l: { type: 'number' }, n: { type: 'number' }, a: { type: 'number' }, b: { type: 'number' }, c: { type: 'number' }, u: { type: 'number' } }, required: ['operation'] },
};

export async function executeChromatography(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'retention_factor': result = { k: retentionFactor(args.tr || 10, args.tm || 2) }; break;
      case 'selectivity': result = { alpha: selectivity(args.k2 || 5, args.k1 || 4) }; break;
      case 'resolution': result = { Rs: resolution(args.tr2 || 12, args.tr1 || 10, args.w1 || 0.5, args.w2 || 0.6) }; break;
      case 'plates': result = { N: plateCount(args.tr || 10, args.w || 0.5) }; break;
      case 'hetp': result = { mm: plateHeight(args.l || 250, args.n || 10000) }; break;
      case 'van_deemter': result = { mm: vanDeemter(args.a || 0.01, args.b || 0.1, args.c || 0.001, args.u || 1) }; break;
      case 'asymmetry': result = { As: asymmetry(args.a || 0.4, args.b || 0.5) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isChromatographyAvailable(): boolean { return true; }
