/**
 * ENVIRONMENTAL TOOL
 * Environmental science calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function airQualityIndex(pm25: number): number { return pm25 <= 12 ? pm25 * 50/12 : pm25 <= 35 ? 50 + (pm25-12) * 50/23 : pm25 <= 55 ? 100 + (pm25-35) * 50/20 : 150 + (pm25-55) * 50/95; }
function carbonFootprint(kwh: number, miles: number, gas: number): number { return kwh * 0.4 + miles * 0.21 + gas * 8.89; }
function waterUsage(shower: number, toilet: number, laundry: number): number { return shower * 2.5 + toilet * 1.6 + laundry * 25; }
function noiseLevel(w: number, r: number): number { return 10 * Math.log10(w / (4 * Math.PI * r * r) / 1e-12); }
function uvIndex(flux: number): number { return flux / 25; }
function windChill(t: number, v: number): number { return 35.74 + 0.6215*t - 35.75*Math.pow(v, 0.16) + 0.4275*t*Math.pow(v, 0.16); }
function heatIndex(t: number, rh: number): number { return -42.379 + 2.04901523*t + 10.14333127*rh - 0.22475541*t*rh; }

export const environmentalTool: UnifiedTool = {
  name: 'environmental',
  description: 'Environmental: aqi, carbon_footprint, water_usage, noise_level, uv_index, wind_chill, heat_index',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['aqi', 'carbon_footprint', 'water_usage', 'noise_level', 'uv_index', 'wind_chill', 'heat_index'] }, pm25: { type: 'number' }, kwh: { type: 'number' }, miles: { type: 'number' }, gas: { type: 'number' }, shower: { type: 'number' }, toilet: { type: 'number' }, laundry: { type: 'number' }, w: { type: 'number' }, r: { type: 'number' }, flux: { type: 'number' }, t: { type: 'number' }, v: { type: 'number' }, rh: { type: 'number' } }, required: ['operation'] },
};

export async function executeEnvironmental(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'aqi': result = { aqi: Math.round(airQualityIndex(args.pm25 || 25)) }; break;
      case 'carbon_footprint': result = { kgCO2_month: carbonFootprint(args.kwh || 500, args.miles || 1000, args.gas || 20) }; break;
      case 'water_usage': result = { gallons_day: waterUsage(args.shower || 10, args.toilet || 5, args.laundry || 1) }; break;
      case 'noise_level': result = { dB: noiseLevel(args.w || 1, args.r || 10) }; break;
      case 'uv_index': result = { uv: uvIndex(args.flux || 200) }; break;
      case 'wind_chill': result = { temp_F: windChill(args.t || 32, args.v || 15) }; break;
      case 'heat_index': result = { temp_F: heatIndex(args.t || 85, args.rh || 70) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isEnvironmentalAvailable(): boolean { return true; }
