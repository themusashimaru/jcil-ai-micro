/**
 * CLIMATOLOGY TOOL
 * Climate science calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function radiativeForcing(co2: number, co2_ref: number): number { return 5.35 * Math.log(co2 / co2_ref); }
function equilibriumTemp(rf: number, lambda: number): number { return rf / lambda; }
function oceanHeatContent(dT: number, depth: number, area: number): number { return 4000 * 1025 * depth * area * dT; }
function seaLevelRise(thermal: number, ice: number): number { return thermal + ice; }
function albedo(reflected: number, incoming: number): number { return reflected / incoming; }
function precipitableWater(t: number, rh: number): number { return 2.17 * rh * Math.exp(17.67 * t / (t + 243.5)) / (t + 273.15); }
function koppen(tmax: number, tmin: number, precip: number): string { if (tmin > 18) return 'A'; if (tmax < 10) return 'E'; if (precip < 250) return 'B'; return 'C'; }

export const climatologyTool: UnifiedTool = {
  name: 'climatology',
  description: 'Climatology: radiative_forcing, equilibrium_temp, ocean_heat, sea_level, albedo, pwat, koppen',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['radiative_forcing', 'equilibrium_temp', 'ocean_heat', 'sea_level', 'albedo', 'pwat', 'koppen'] }, co2: { type: 'number' }, co2_ref: { type: 'number' }, rf: { type: 'number' }, lambda: { type: 'number' }, dT: { type: 'number' }, depth: { type: 'number' }, area: { type: 'number' }, thermal: { type: 'number' }, ice: { type: 'number' }, reflected: { type: 'number' }, incoming: { type: 'number' }, t: { type: 'number' }, rh: { type: 'number' }, tmax: { type: 'number' }, tmin: { type: 'number' }, precip: { type: 'number' } }, required: ['operation'] },
};

export async function executeClimatology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'radiative_forcing': result = { W_m2: radiativeForcing(args.co2 || 420, args.co2_ref || 280) }; break;
      case 'equilibrium_temp': result = { delta_K: equilibriumTemp(args.rf || 3, args.lambda || 0.8) }; break;
      case 'ocean_heat': result = { J: oceanHeatContent(args.dT || 0.5, args.depth || 2000, args.area || 3.6e14) }; break;
      case 'sea_level': result = { mm_yr: seaLevelRise(args.thermal || 1.5, args.ice || 2) }; break;
      case 'albedo': result = { albedo: albedo(args.reflected || 100, args.incoming || 342) }; break;
      case 'pwat': result = { mm: precipitableWater(args.t || 25, args.rh || 70) }; break;
      case 'koppen': result = { climate: koppen(args.tmax || 25, args.tmin || 10, args.precip || 800) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isClimatologyAvailable(): boolean { return true; }
