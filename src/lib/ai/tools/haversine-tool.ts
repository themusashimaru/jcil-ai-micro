/**
 * HAVERSINE TOOL
 * Geographic distance and bearing calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_MI = 3959;

interface Coordinate { lat: number; lng: number; }

function toRadians(degrees: number): number { return degrees * Math.PI / 180; }
function toDegrees(radians: number): number { return radians * 180 / Math.PI; }

function haversineDistance(from: Coordinate, to: Coordinate, unit: 'km' | 'mi' | 'm' = 'km'): number {
  const R = unit === 'mi' ? EARTH_RADIUS_MI : EARTH_RADIUS_KM;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return unit === 'm' ? distance * 1000 : distance;
}

function bearing(from: Coordinate, to: Coordinate): number {
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

function compassDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function destinationPoint(from: Coordinate, bearingDeg: number, distanceKm: number): Coordinate {
  const R = EARTH_RADIUS_KM;
  const bearingRad = toRadians(bearingDeg);
  const lat1 = toRadians(from.lat);
  const lng1 = toRadians(from.lng);
  const d = distanceKm / R;

  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearingRad));
  const lng2 = lng1 + Math.atan2(Math.sin(bearingRad) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));

  return { lat: toDegrees(lat2), lng: toDegrees(lng2) };
}

function midpoint(from: Coordinate, to: Coordinate): Coordinate {
  const lat1 = toRadians(from.lat);
  const lng1 = toRadians(from.lng);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);

  const Bx = Math.cos(lat2) * Math.cos(dLng);
  const By = Math.cos(lat2) * Math.sin(dLng);
  const lat3 = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.sqrt((Math.cos(lat1) + Bx) ** 2 + By ** 2));
  const lng3 = lng1 + Math.atan2(By, Math.cos(lat1) + Bx);

  return { lat: toDegrees(lat3), lng: toDegrees(lng3) };
}

function isPointInRadius(center: Coordinate, point: Coordinate, radiusKm: number): boolean {
  return haversineDistance(center, point) <= radiusKm;
}

function boundingBox(center: Coordinate, radiusKm: number): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = toDegrees(radiusKm / EARTH_RADIUS_KM);
  const lngDelta = toDegrees(radiusKm / (EARTH_RADIUS_KM * Math.cos(toRadians(center.lat))));

  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta
  };
}

function interpolate(from: Coordinate, to: Coordinate, fraction: number): Coordinate {
  const d = haversineDistance(from, to);
  const A = Math.sin((1 - fraction) * d / EARTH_RADIUS_KM) / Math.sin(d / EARTH_RADIUS_KM);
  const B = Math.sin(fraction * d / EARTH_RADIUS_KM) / Math.sin(d / EARTH_RADIUS_KM);

  const lat1 = toRadians(from.lat);
  const lng1 = toRadians(from.lng);
  const lat2 = toRadians(to.lat);
  const lng2 = toRadians(to.lng);

  const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
  const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);

  return {
    lat: toDegrees(Math.atan2(z, Math.sqrt(x ** 2 + y ** 2))),
    lng: toDegrees(Math.atan2(y, x))
  };
}

function routeDistance(waypoints: Coordinate[]): { totalKm: number; segments: Array<{ from: Coordinate; to: Coordinate; distanceKm: number }> } {
  const segments = [];
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const dist = haversineDistance(waypoints[i], waypoints[i + 1]);
    segments.push({ from: waypoints[i], to: waypoints[i + 1], distanceKm: dist });
    total += dist;
  }
  return { totalKm: total, segments };
}

const CITIES: Record<string, Coordinate> = {
  'new_york': { lat: 40.7128, lng: -74.0060 },
  'los_angeles': { lat: 34.0522, lng: -118.2437 },
  'london': { lat: 51.5074, lng: -0.1278 },
  'paris': { lat: 48.8566, lng: 2.3522 },
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'sydney': { lat: -33.8688, lng: 151.2093 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  'berlin': { lat: 52.5200, lng: 13.4050 },
  'moscow': { lat: 55.7558, lng: 37.6173 }
};

export const haversineTool: UnifiedTool = {
  name: 'haversine',
  description: 'Haversine: distance, bearing, destination, midpoint, bounding_box, route, cities',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['distance', 'bearing', 'destination', 'midpoint', 'in_radius', 'bounding_box', 'interpolate', 'route', 'cities'] },
      from: { type: 'object' },
      to: { type: 'object' },
      center: { type: 'object' },
      point: { type: 'object' },
      radius: { type: 'number' },
      bearing: { type: 'number' },
      distance: { type: 'number' },
      fraction: { type: 'number' },
      waypoints: { type: 'array' },
      unit: { type: 'string' },
      fromCity: { type: 'string' },
      toCity: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executeHaversine(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    const from: Coordinate = args.from || (args.fromCity ? CITIES[args.fromCity] : { lat: 40.7128, lng: -74.0060 });
    const to: Coordinate = args.to || (args.toCity ? CITIES[args.toCity] : { lat: 51.5074, lng: -0.1278 });

    switch (args.operation) {
      case 'distance':
        const dist = haversineDistance(from, to, args.unit || 'km');
        const bear = bearing(from, to);
        result = { from, to, distance: dist, unit: args.unit || 'km', bearing: bear, direction: compassDirection(bear) };
        break;
      case 'bearing':
        const bearingDeg = bearing(from, to);
        result = { from, to, bearing: bearingDeg, direction: compassDirection(bearingDeg) };
        break;
      case 'destination':
        result = { from, bearing: args.bearing || 90, distance: args.distance || 100, destination: destinationPoint(from, args.bearing || 90, args.distance || 100) };
        break;
      case 'midpoint':
        result = { from, to, midpoint: midpoint(from, to) };
        break;
      case 'in_radius':
        const center = args.center || from;
        const point = args.point || to;
        const radius = args.radius || 100;
        result = { center, point, radius, inRadius: isPointInRadius(center, point, radius), actualDistance: haversineDistance(center, point) };
        break;
      case 'bounding_box':
        result = { center: args.center || from, radius: args.radius || 50, boundingBox: boundingBox(args.center || from, args.radius || 50) };
        break;
      case 'interpolate':
        const fraction = args.fraction || 0.5;
        result = { from, to, fraction, point: interpolate(from, to, fraction) };
        break;
      case 'route':
        const waypoints = args.waypoints || [CITIES.new_york, CITIES.london, CITIES.paris, CITIES.berlin];
        result = routeDistance(waypoints);
        break;
      case 'cities':
        result = { cities: CITIES };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isHaversineAvailable(): boolean { return true; }
