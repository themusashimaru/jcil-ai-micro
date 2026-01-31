/**
 * COORDINATE TRANSFORM TOOL
 *
 * Geographic coordinate transformations using proj4.
 * Runs entirely locally - no external API costs.
 *
 * Features:
 * - Convert between coordinate systems (WGS84, UTM, etc.)
 * - Map projections (Mercator, Lambert, etc.)
 * - Distance calculations
 * - Bearing/azimuth calculations
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let proj4: any = null;

async function initProj4(): Promise<boolean> {
  if (proj4) return true;
  try {
    const mod = await import('proj4');
    proj4 = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// Common projection definitions
const PROJECTIONS: Record<string, string> = {
  WGS84: '+proj=longlat +datum=WGS84 +no_defs',
  'EPSG:4326': '+proj=longlat +datum=WGS84 +no_defs',
  'EPSG:3857':
    '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
  WebMercator:
    '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs',
  'EPSG:32601': '+proj=utm +zone=1 +datum=WGS84 +units=m +no_defs', // UTM Zone 1N
  NAD83: '+proj=longlat +datum=NAD83 +no_defs',
  'EPSG:2154':
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs', // Lambert 93 France
  'EPSG:27700':
    '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs', // British National Grid
  'EPSG:2263':
    '+proj=lcc +lat_1=41.03333333333333 +lat_2=40.66666666666666 +lat_0=40.16666666666666 +lon_0=-74 +x_0=300000.0000000001 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=us-ft +no_defs', // NY State Plane
};

// Get UTM zone projection string
function getUTMProj(zone: number, north: boolean = true): string {
  return `+proj=utm +zone=${zone} ${north ? '' : '+south'} +datum=WGS84 +units=m +no_defs`;
}

// Calculate UTM zone from longitude
function getUTMZone(lon: number): number {
  return Math.floor((lon + 180) / 6) + 1;
}

// Haversine distance calculation
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Vincenty distance (more accurate for long distances)
function vincentyDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = 6378137; // WGS84 semi-major axis
  const f = 1 / 298.257223563; // WGS84 flattening
  const b = a * (1 - f);

  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const L = ((lon2 - lon1) * Math.PI) / 180;

  const U1 = Math.atan((1 - f) * Math.tan(φ1));
  const U2 = Math.atan((1 - f) * Math.tan(φ2));
  const sinU1 = Math.sin(U1),
    cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2),
    cosU2 = Math.cos(U2);

  let λ = L;
  let λʹ: number;
  let iterLimit = 100;
  let sinσ: number, cosσ: number, σ: number;
  let cos2σM: number, sinα: number, cosSqα: number;

  do {
    const sinλ = Math.sin(λ),
      cosλ = Math.cos(λ);
    sinσ = Math.sqrt(
      cosU2 * sinλ * (cosU2 * sinλ) +
        (cosU1 * sinU2 - sinU1 * cosU2 * cosλ) * (cosU1 * sinU2 - sinU1 * cosU2 * cosλ)
    );
    if (sinσ === 0) return 0;

    cosσ = sinU1 * sinU2 + cosU1 * cosU2 * cosλ;
    σ = Math.atan2(sinσ, cosσ);
    sinα = (cosU1 * cosU2 * sinλ) / sinσ;
    cosSqα = 1 - sinα * sinα;
    cos2σM = cosSqα !== 0 ? cosσ - (2 * sinU1 * sinU2) / cosSqα : 0;
    const C = (f / 16) * cosSqα * (4 + f * (4 - 3 * cosSqα));
    λʹ = λ;
    λ = L + (1 - C) * f * sinα * (σ + C * sinσ * (cos2σM + C * cosσ * (-1 + 2 * cos2σM * cos2σM)));
  } while (Math.abs(λ - λʹ) > 1e-12 && --iterLimit > 0);

  if (iterLimit === 0) return haversineDistance(lat1, lon1, lat2, lon2); // Fallback

  const uSq = (cosSqα! * (a * a - b * b)) / (b * b);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const Δσ =
    B *
    sinσ! *
    (cos2σM! +
      (B / 4) *
        (cosσ! * (-1 + 2 * cos2σM! * cos2σM!) -
          (B / 6) * cos2σM! * (-3 + 4 * sinσ! * sinσ!) * (-3 + 4 * cos2σM! * cos2σM!)));

  return b * A * (σ! - Δσ);
}

// Calculate bearing between two points
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ * 180) / Math.PI + 360) % 360;
}

// Calculate destination point given start, bearing, and distance
function destinationPoint(
  lat: number,
  lon: number,
  bearing: number,
  distance: number
): { lat: number; lon: number } {
  const R = 6371000;
  const δ = distance / R;
  const θ = (bearing * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;

  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));

  return {
    lat: (φ2 * 180) / Math.PI,
    lon: (((λ2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const coordinateTransformTool: UnifiedTool = {
  name: 'coordinate_transform',
  description: `Transform coordinates between different systems and projections.

Available operations:
- transform: Convert coordinates between projections
- to_utm: Convert lat/lon to UTM
- from_utm: Convert UTM to lat/lon
- distance: Calculate distance between points (Haversine or Vincenty)
- bearing: Calculate bearing/azimuth between points
- destination: Calculate point at given distance and bearing
- midpoint: Calculate midpoint between two points
- list_projections: List available projection codes

Common projections: WGS84, WebMercator, UTM, NAD83, British National Grid

Used in: GIS, surveying, navigation, mapping, geospatial analysis`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'transform',
          'to_utm',
          'from_utm',
          'distance',
          'bearing',
          'destination',
          'midpoint',
          'list_projections',
        ],
        description: 'Coordinate operation',
      },
      x: {
        type: 'number',
        description: 'X coordinate (longitude for geographic)',
      },
      y: {
        type: 'number',
        description: 'Y coordinate (latitude for geographic)',
      },
      x2: {
        type: 'number',
        description: 'Second X coordinate',
      },
      y2: {
        type: 'number',
        description: 'Second Y coordinate',
      },
      from_crs: {
        type: 'string',
        description: 'Source coordinate reference system (e.g., "WGS84", "EPSG:4326")',
      },
      to_crs: {
        type: 'string',
        description: 'Target coordinate reference system',
      },
      zone: {
        type: 'number',
        description: 'UTM zone number (1-60)',
      },
      north: {
        type: 'boolean',
        description: 'Northern hemisphere for UTM (default: true)',
      },
      bearing: {
        type: 'number',
        description: 'Bearing in degrees (0-360, north = 0)',
      },
      distance: {
        type: 'number',
        description: 'Distance in meters',
      },
      method: {
        type: 'string',
        enum: ['haversine', 'vincenty'],
        description: 'Distance calculation method',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isCoordinateTransformAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeCoordinateTransform(
  call: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    x?: number;
    y?: number;
    x2?: number;
    y2?: number;
    from_crs?: string;
    to_crs?: string;
    zone?: number;
    north?: boolean;
    bearing?: number;
    distance?: number;
    method?: string;
  };

  const {
    operation,
    x,
    y,
    x2,
    y2,
    from_crs,
    to_crs,
    zone,
    north = true,
    bearing,
    distance,
    method = 'vincenty',
  } = args;

  try {
    const result: Record<string, unknown> = { operation };

    switch (operation) {
      case 'transform': {
        if (x === undefined || y === undefined) throw new Error('x and y coordinates required');
        if (!from_crs || !to_crs) throw new Error('from_crs and to_crs required');

        const initialized = await initProj4();
        if (!initialized) throw new Error('Failed to initialize proj4 library');

        const fromProj = PROJECTIONS[from_crs] || from_crs;
        const toProj = PROJECTIONS[to_crs] || to_crs;

        const transformed = proj4(fromProj, toProj, [x, y]);

        result.input = { x, y, crs: from_crs };
        result.output = { x: transformed[0], y: transformed[1], crs: to_crs };
        break;
      }

      case 'to_utm': {
        if (x === undefined || y === undefined)
          throw new Error('x (longitude) and y (latitude) required');

        const initialized = await initProj4();
        if (!initialized) throw new Error('Failed to initialize proj4 library');

        const utmZone = zone ?? getUTMZone(x);
        const isNorth = north ?? y >= 0;
        const utmProj = getUTMProj(utmZone, isNorth);

        const transformed = proj4(PROJECTIONS['WGS84'], utmProj, [x, y]);

        result.input = { longitude: x, latitude: y };
        result.utm = {
          easting: transformed[0],
          northing: transformed[1],
          zone: utmZone,
          hemisphere: isNorth ? 'N' : 'S',
          zone_letter: isNorth ? (y >= 8 ? 'N' : 'P') : 'S',
        };
        break;
      }

      case 'from_utm': {
        if (x === undefined || y === undefined)
          throw new Error('x (easting) and y (northing) required');
        if (!zone) throw new Error('zone is required');

        const initialized = await initProj4();
        if (!initialized) throw new Error('Failed to initialize proj4 library');

        const utmProj = getUTMProj(zone, north);
        const transformed = proj4(utmProj, PROJECTIONS['WGS84'], [x, y]);

        result.input = { easting: x, northing: y, zone, hemisphere: north ? 'N' : 'S' };
        result.geographic = {
          longitude: transformed[0],
          latitude: transformed[1],
        };
        break;
      }

      case 'distance': {
        if (x === undefined || y === undefined || x2 === undefined || y2 === undefined) {
          throw new Error('x, y (point 1) and x2, y2 (point 2) required');
        }

        const haversine = haversineDistance(y, x, y2, x2);
        const vincenty = vincentyDistance(y, x, y2, x2);

        result.point1 = { longitude: x, latitude: y };
        result.point2 = { longitude: x2, latitude: y2 };
        result.distance = {
          meters: method === 'haversine' ? haversine : vincenty,
          kilometers: (method === 'haversine' ? haversine : vincenty) / 1000,
          miles: (method === 'haversine' ? haversine : vincenty) / 1609.344,
          nautical_miles: (method === 'haversine' ? haversine : vincenty) / 1852,
        };
        result.comparison = {
          haversine_m: haversine,
          vincenty_m: vincenty,
          difference_m: Math.abs(vincenty - haversine),
        };
        result.method_used = method;
        break;
      }

      case 'bearing': {
        if (x === undefined || y === undefined || x2 === undefined || y2 === undefined) {
          throw new Error('x, y (from point) and x2, y2 (to point) required');
        }

        const initialBearing = calculateBearing(y, x, y2, x2);
        const finalBearing = (calculateBearing(y2, x2, y, x) + 180) % 360;

        const compassPoints = [
          'N',
          'NNE',
          'NE',
          'ENE',
          'E',
          'ESE',
          'SE',
          'SSE',
          'S',
          'SSW',
          'SW',
          'WSW',
          'W',
          'WNW',
          'NW',
          'NNW',
        ];
        const compassIndex = Math.round(initialBearing / 22.5) % 16;

        result.from = { longitude: x, latitude: y };
        result.to = { longitude: x2, latitude: y2 };
        result.initial_bearing = {
          degrees: initialBearing,
          radians: (initialBearing * Math.PI) / 180,
          compass: compassPoints[compassIndex],
        };
        result.final_bearing = {
          degrees: finalBearing,
          radians: (finalBearing * Math.PI) / 180,
        };
        break;
      }

      case 'destination': {
        if (x === undefined || y === undefined)
          throw new Error('x (longitude) and y (latitude) required');
        if (bearing === undefined) throw new Error('bearing is required');
        if (distance === undefined) throw new Error('distance is required');

        const dest = destinationPoint(y, x, bearing, distance);

        result.start = { longitude: x, latitude: y };
        result.bearing_degrees = bearing;
        result.distance_meters = distance;
        result.destination = {
          longitude: dest.lon,
          latitude: dest.lat,
        };
        break;
      }

      case 'midpoint': {
        if (x === undefined || y === undefined || x2 === undefined || y2 === undefined) {
          throw new Error('x, y (point 1) and x2, y2 (point 2) required');
        }

        const φ1 = (y * Math.PI) / 180;
        const λ1 = (x * Math.PI) / 180;
        const φ2 = (y2 * Math.PI) / 180;
        const Δλ = ((x2 - x) * Math.PI) / 180;

        const Bx = Math.cos(φ2) * Math.cos(Δλ);
        const By = Math.cos(φ2) * Math.sin(Δλ);
        const φ3 = Math.atan2(
          Math.sin(φ1) + Math.sin(φ2),
          Math.sqrt((Math.cos(φ1) + Bx) * (Math.cos(φ1) + Bx) + By * By)
        );
        const λ3 = λ1 + Math.atan2(By, Math.cos(φ1) + Bx);

        result.point1 = { longitude: x, latitude: y };
        result.point2 = { longitude: x2, latitude: y2 };
        result.midpoint = {
          longitude: (((λ3 * 180) / Math.PI + 540) % 360) - 180,
          latitude: (φ3 * 180) / Math.PI,
        };
        break;
      }

      case 'list_projections': {
        result.available_projections = Object.keys(PROJECTIONS).map((key) => ({
          code: key,
          description: getProjectionDescription(key),
        }));
        result.note = 'You can also use PROJ4 strings directly for custom projections';
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}

function getProjectionDescription(code: string): string {
  const descriptions: Record<string, string> = {
    WGS84: 'World Geodetic System 1984 (lat/lon)',
    'EPSG:4326': 'WGS84 Geographic (lat/lon)',
    'EPSG:3857': 'Web Mercator (Google Maps, OSM)',
    WebMercator: 'Web Mercator projection',
    'EPSG:32601': 'UTM Zone 1N template',
    NAD83: 'North American Datum 1983',
    'EPSG:2154': 'Lambert 93 (France)',
    'EPSG:27700': 'British National Grid (UK)',
    'EPSG:2263': 'NY State Plane (Long Island)',
  };
  return descriptions[code] || 'Custom projection';
}
