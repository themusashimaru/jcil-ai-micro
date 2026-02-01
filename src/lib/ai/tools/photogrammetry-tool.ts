/**
 * PHOTOGRAMMETRY TOOL
 * 3D reconstruction from images
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function groundSampleDistance(h: number, f: number, p: number): number { return h * p / f; }
function stereoParallax(b: number, h: number, f: number): number { return b * f / h; }
function depthResolution(b: number, h: number, f: number, p: number): number { return h * h * p / (b * f); }
function overlap(forward: number, side: number): number { return 100 - (1 - forward/100) * (1 - side/100) * 100; }
function flightLines(area: number, width: number, overlap: number): number { return area / (width * (1 - overlap/100)); }
function imageScale(f: number, h: number): number { return f / h; }
function relativeAccuracy(gsd: number, ctrl: number): number { return Math.sqrt(gsd*gsd + ctrl*ctrl); }

export const photogrammetryTool: UnifiedTool = {
  name: 'photogrammetry',
  description: 'Photogrammetry: gsd, parallax, depth_res, overlap, flight_lines, scale, accuracy',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['gsd', 'parallax', 'depth_res', 'overlap', 'flight_lines', 'scale', 'accuracy'] }, h: { type: 'number' }, f: { type: 'number' }, p: { type: 'number' }, b: { type: 'number' }, forward: { type: 'number' }, side: { type: 'number' }, area: { type: 'number' }, width: { type: 'number' }, overlap_pct: { type: 'number' }, gsd: { type: 'number' }, ctrl: { type: 'number' } }, required: ['operation'] },
};

export async function executePhotogrammetry(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'gsd': result = { cm_px: groundSampleDistance(args.h || 100, args.f || 0.035, args.p || 5e-6) * 100 }; break;
      case 'parallax': result = { mm: stereoParallax(args.b || 50, args.h || 100, args.f || 0.035) * 1000 }; break;
      case 'depth_res': result = { cm: depthResolution(args.b || 50, args.h || 100, args.f || 0.035, args.p || 5e-6) * 100 }; break;
      case 'overlap': result = { percent: overlap(args.forward || 80, args.side || 60) }; break;
      case 'flight_lines': result = { count: flightLines(args.area || 10000, args.width || 100, args.overlap_pct || 60) }; break;
      case 'scale': result = { ratio: imageScale(args.f || 0.15, args.h || 1000) }; break;
      case 'accuracy': result = { cm: relativeAccuracy(args.gsd || 5, args.ctrl || 3) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isPhotogrammetryAvailable(): boolean { return true; }
