/**
 * SEDIMENTATION TOOL
 * Particle settling
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function stokesSettling(dp: number, rhos: number, rhol: number, mu: number): number { return dp * dp * (rhos - rhol) * 9.81 / (18 * mu); }
function hinderedSettling(v0: number, eps: number): number { return v0 * Math.pow(eps, 4.65); }
function thickenerArea(q: number, vu: number): number { return q / vu; }
function compressionZone(h: number, t: number): number { return h / t; }
function coneAngle(d: number, h: number): number { return Math.atan(d / (2 * h)) * 180 / Math.PI; }
function overflowRate(q: number, a: number): number { return q / a; }
function solidsLoading(ms: number, a: number): number { return ms / a; }

export const sedimentationTool: UnifiedTool = {
  name: 'sedimentation',
  description: 'Sedimentation: stokes, hindered, thickener_area, compression, cone_angle, overflow, solids_loading',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['stokes', 'hindered', 'thickener_area', 'compression', 'cone_angle', 'overflow', 'solids_loading'] }, dp: { type: 'number' }, rhos: { type: 'number' }, rhol: { type: 'number' }, mu: { type: 'number' }, v0: { type: 'number' }, eps: { type: 'number' }, q: { type: 'number' }, vu: { type: 'number' }, h: { type: 'number' }, t: { type: 'number' }, d: { type: 'number' }, a: { type: 'number' }, ms: { type: 'number' } }, required: ['operation'] },
};

export async function executeSedimentation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'stokes': result = { m_s: stokesSettling(args.dp || 0.0001, args.rhos || 2500, args.rhol || 1000, args.mu || 0.001) }; break;
      case 'hindered': result = { m_s: hinderedSettling(args.v0 || 0.01, args.eps || 0.7) }; break;
      case 'thickener_area': result = { m2: thickenerArea(args.q || 100, args.vu || 0.001) }; break;
      case 'compression': result = { m_s: compressionZone(args.h || 1, args.t || 3600) }; break;
      case 'cone_angle': result = { degrees: coneAngle(args.d || 10, args.h || 2) }; break;
      case 'overflow': result = { m_hr: overflowRate(args.q || 100, args.a || 1000) * 3600 }; break;
      case 'solids_loading': result = { kg_m2_hr: solidsLoading(args.ms || 1000, args.a || 1000) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isSedimentationAvailable(): boolean { return true; }
