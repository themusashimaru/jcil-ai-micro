/**
 * HUMIDIFICATION TOOL
 * Air-water systems
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function humidity(pw: number, pt: number): number { return 0.622 * pw / (pt - pw); }
function relHumidity(pw: number, psat: number): number { return pw / psat * 100; }
function wetBulb(tdb: number, rh: number): number { return tdb * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) - Math.atan(rh - 1.676331) + Math.atan(tdb + rh) - 4.686035; }
function dewPoint(tdb: number, rh: number): number { return tdb - (100 - rh) / 5; }
function enthalpy(t: number, h: number): number { return 1.006 * t + h * (2501 + 1.86 * t); }
function specificVolume(t: number, h: number, p: number): number { return 287 * (t + 273) * (1 + 1.608 * h) / p; }
function saturatedHumidity(t: number): number { const psat = 610.78 * Math.exp(17.27 * t / (t + 237.3)); return 0.622 * psat / (101325 - psat); }

export const humidificationTool: UnifiedTool = {
  name: 'humidification',
  description: 'Humidification: humidity, rel_humidity, wet_bulb, dew_point, enthalpy, specific_vol, saturated',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['humidity', 'rel_humidity', 'wet_bulb', 'dew_point', 'enthalpy', 'specific_vol', 'saturated'] }, pw: { type: 'number' }, pt: { type: 'number' }, psat: { type: 'number' }, tdb: { type: 'number' }, rh: { type: 'number' }, t: { type: 'number' }, h: { type: 'number' }, p: { type: 'number' } }, required: ['operation'] },
};

export async function executeHumidification(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'humidity': result = { kg_kg: humidity(args.pw || 2000, args.pt || 101325) }; break;
      case 'rel_humidity': result = { percent: relHumidity(args.pw || 2000, args.psat || 3170) }; break;
      case 'wet_bulb': result = { C: wetBulb(args.tdb || 30, args.rh || 50) }; break;
      case 'dew_point': result = { C: dewPoint(args.tdb || 30, args.rh || 50) }; break;
      case 'enthalpy': result = { kJ_kg: enthalpy(args.t || 25, args.h || 0.01) }; break;
      case 'specific_vol': result = { m3_kg: specificVolume(args.t || 25, args.h || 0.01, args.p || 101325) }; break;
      case 'saturated': result = { kg_kg: saturatedHumidity(args.t || 25) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isHumidificationAvailable(): boolean { return true; }
