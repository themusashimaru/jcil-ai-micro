/**
 * SURVEYING TOOL
 * Land surveying and geodesy calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toRad) * Math.cos(lat2*toRad) * Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const dLon = (lon2 - lon1) * toRad;
  const y = Math.sin(dLon) * Math.cos(lat2 * toRad);
  const x = Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) - Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function areaFromCoords(coords: number[][]): number {
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    area += coords[i][0] * coords[j][1] - coords[j][0] * coords[i][1];
  }
  return Math.abs(area) / 2;
}
function levelDifference(backsight: number, foresight: number): number { return backsight - foresight; }
function slopeDistance(horizontal: number, vertical: number): number { return Math.sqrt(horizontal**2 + vertical**2); }
function slopeAngle(rise: number, run: number): number { return Math.atan(rise / run) * 180 / Math.PI; }

export const surveyingTool: UnifiedTool = {
  name: 'surveying',
  description: 'Land surveying: distance, bearing, area, leveling, slope',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['distance', 'bearing', 'area', 'leveling', 'slope_distance', 'slope_angle'] }, lat1: { type: 'number' }, lon1: { type: 'number' }, lat2: { type: 'number' }, lon2: { type: 'number' }, coords: { type: 'array' }, backsight: { type: 'number' }, foresight: { type: 'number' }, horizontal: { type: 'number' }, vertical: { type: 'number' }, rise: { type: 'number' }, run: { type: 'number' } }, required: ['operation'] },
};

export async function executeSurveying(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'distance': result = { distance_m: haversineDistance(args.lat1 || 0, args.lon1 || 0, args.lat2 || 1, args.lon2 || 1) }; break;
      case 'bearing': result = { bearing_deg: bearing(args.lat1 || 0, args.lon1 || 0, args.lat2 || 1, args.lon2 || 1) }; break;
      case 'area': result = { area_sq_units: areaFromCoords(args.coords || [[0,0],[1,0],[1,1],[0,1]]) }; break;
      case 'leveling': result = { elevation_diff_m: levelDifference(args.backsight || 1.5, args.foresight || 1.2) }; break;
      case 'slope_distance': result = { slope_distance_m: slopeDistance(args.horizontal || 100, args.vertical || 10) }; break;
      case 'slope_angle': result = { slope_deg: slopeAngle(args.rise || 1, args.run || 10) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isSurveyingAvailable(): boolean { return true; }
