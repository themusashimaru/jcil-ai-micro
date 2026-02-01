/**
 * CARTOGRAPHY TOOL
 * Map science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function scaleConversion(map: number, scale: number): number { return map * scale; }
function distortionArea(lat: number): number { return 1 / Math.cos(lat * Math.PI / 180); }
function contourInterval(relief: number, scale: number): number { return relief / (scale / 10000); }
function mapResolution(scale: number): number { return scale * 0.0005; }
function utmZone(lon: number): number { return Math.floor((lon + 180) / 6) + 1; }
function gridConvergence(lon: number, lat: number, cm: number): number { return (lon - cm) * Math.sin(lat * Math.PI / 180); }
function declination(lon: number, lat: number, year: number): number { return (lon / 10) + (lat / 20) + (year - 2020) * 0.1; }

export const cartographyTool: UnifiedTool = {
  name: 'cartography',
  description: 'Cartography: scale, distortion, contour_interval, resolution, utm_zone, convergence, declination',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['scale', 'distortion', 'contour_interval', 'resolution', 'utm_zone', 'convergence', 'declination'] }, map: { type: 'number' }, scale: { type: 'number' }, lat: { type: 'number' }, relief: { type: 'number' }, lon: { type: 'number' }, cm: { type: 'number' }, year: { type: 'number' } }, required: ['operation'] },
};

export async function executeCartography(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'scale': result = { ground_m: scaleConversion(args.map || 10, args.scale || 25000) / 100 }; break;
      case 'distortion': result = { factor: distortionArea(args.lat || 45) }; break;
      case 'contour_interval': result = { m: contourInterval(args.relief || 500, args.scale || 50000) }; break;
      case 'resolution': result = { m: mapResolution(args.scale || 25000) }; break;
      case 'utm_zone': result = { zone: utmZone(args.lon || -122) }; break;
      case 'convergence': result = { degrees: gridConvergence(args.lon || -122, args.lat || 45, args.cm || -123) }; break;
      case 'declination': result = { degrees: declination(args.lon || -122, args.lat || 45, args.year || 2024) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isCartographyAvailable(): boolean { return true; }
