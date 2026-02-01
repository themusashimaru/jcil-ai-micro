/**
 * FIRE PROTECTION TOOL
 * Fire safety engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function sprinklerDensity(area: number, hazard: string): number { const d: Record<string, number> = { light: 0.1, ordinary: 0.15, extra: 0.2 }; return (d[hazard] || 0.15) * area; }
function hydraulicCalc(q: number, c: number, d: number, l: number): number { return 4.52 * Math.pow(q, 1.85) / (Math.pow(c, 1.85) * Math.pow(d, 4.87)) * l; }
function evacTime(occupants: number, width: number): number { return occupants / (width * 60); }
function smokeLayer(q: number, h: number, t: number): number { return h - 0.166 * Math.pow(q, 0.33) * Math.pow(t, 0.67); }
function fireGrowth(alpha: number, t: number): number { return alpha * t * t; }
function detectorSpacing(height: number): number { return height < 3 ? 9.1 : height < 6 ? 8.4 : 7.6; }
function extinguisherSize(area: number, hazard: string): number { const f: Record<string, number> = { light: 0.5, ordinary: 1, extra: 2 }; return area * (f[hazard] || 1) / 280; }

export const fireProtectionTool: UnifiedTool = {
  name: 'fire_protection',
  description: 'Fire: sprinkler_density, hydraulic, evac_time, smoke_layer, fire_growth, detector_spacing, extinguisher',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['sprinkler_density', 'hydraulic', 'evac_time', 'smoke_layer', 'fire_growth', 'detector_spacing', 'extinguisher'] }, area: { type: 'number' }, hazard: { type: 'string' }, q: { type: 'number' }, c: { type: 'number' }, d: { type: 'number' }, l: { type: 'number' }, occupants: { type: 'number' }, width: { type: 'number' }, h: { type: 'number' }, t: { type: 'number' }, alpha: { type: 'number' }, height: { type: 'number' } }, required: ['operation'] },
};

export async function executeFireProtection(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'sprinkler_density': result = { gpm: sprinklerDensity(args.area || 1500, args.hazard || 'ordinary') }; break;
      case 'hydraulic': result = { psi: hydraulicCalc(args.q || 100, args.c || 120, args.d || 4, args.l || 100) }; break;
      case 'evac_time': result = { min: evacTime(args.occupants || 500, args.width || 2) }; break;
      case 'smoke_layer': result = { m: smokeLayer(args.q || 1000, args.h || 10, args.t || 120) }; break;
      case 'fire_growth': result = { kW: fireGrowth(args.alpha || 0.0469, args.t || 60) }; break;
      case 'detector_spacing': result = { m: detectorSpacing(args.height || 4) }; break;
      case 'extinguisher': result = { kg: extinguisherSize(args.area || 500, args.hazard || 'ordinary') }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isFireProtectionAvailable(): boolean { return true; }
