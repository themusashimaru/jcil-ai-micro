/**
 * GEOSPATIAL TOOL
 *
 * Geographic calculations using Turf.js.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Distance calculations between coordinates
 * - Area calculations for polygons
 * - Point-in-polygon tests
 * - Buffer zones around points/lines
 * - Centroid calculations
 * - Bounding box calculations
 * - Bearing and direction
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let turf: any = null;

async function initTurf(): Promise<boolean> {
  if (turf) return true;
  try {
    const mod = await import('@turf/turf');
    turf = mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const geospatialTool: UnifiedTool = {
  name: 'geo_calculate',
  description: `Perform geographic and geospatial calculations.

Operations:
- distance: Calculate distance between two coordinates (km, miles, meters)
- area: Calculate area of a polygon
- point_in_polygon: Check if a point is inside a polygon
- buffer: Create a buffer zone around a point or line
- centroid: Find the center point of a polygon
- bearing: Calculate compass bearing between two points
- bbox: Get bounding box of geometry
- midpoint: Find midpoint between two coordinates
- along: Find point at distance along a line
- nearest: Find nearest point from a set of points

Coordinates use [longitude, latitude] format (GeoJSON standard).

Use cases:
- Calculate distances between cities
- Check if location is within a boundary
- Find center of a region
- Create service area zones`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'distance',
          'area',
          'point_in_polygon',
          'buffer',
          'centroid',
          'bearing',
          'bbox',
          'midpoint',
          'along',
          'nearest',
        ],
        description: 'Geospatial operation to perform',
      },
      point1: {
        type: 'array',
        items: { type: 'number' },
        description: 'First coordinate [longitude, latitude]',
      },
      point2: {
        type: 'array',
        items: { type: 'number' },
        description: 'Second coordinate [longitude, latitude]',
      },
      polygon: {
        type: 'array',
        items: { type: 'array' },
        description: 'Polygon coordinates [[lon,lat], [lon,lat], ...]',
      },
      points: {
        type: 'array',
        items: { type: 'array' },
        description: 'Array of coordinates [[lon,lat], [lon,lat], ...]',
      },
      line: {
        type: 'array',
        items: { type: 'array' },
        description: 'Line coordinates [[lon,lat], [lon,lat], ...]',
      },
      options: {
        type: 'object',
        description: 'Options: {units: "kilometers"|"miles"|"meters", radius: number}',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isGeospatialAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeGeospatial(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args =
    typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;

  const { operation, point1, point2, polygon, points, line, options = {} } = args;
  const units = options.units || 'kilometers';

  // Initialize library
  const initialized = await initTurf();
  if (!initialized) {
    return {
      toolCallId: toolCall.id,
      content: 'Geospatial library failed to load. Please try again.',
      isError: true,
    };
  }

  try {
    let result: Record<string, unknown>;

    switch (operation) {
      case 'distance': {
        if (!point1 || !point2) {
          throw new Error('Two coordinates required for distance calculation');
        }
        const from = turf.point(point1);
        const to = turf.point(point2);
        const distance = turf.distance(from, to, { units });

        result = {
          operation: 'distance',
          from: { longitude: point1[0], latitude: point1[1] },
          to: { longitude: point2[0], latitude: point2[1] },
          distance,
          units,
          formatted: `${distance.toFixed(2)} ${units}`,
        };
        break;
      }

      case 'area': {
        if (!polygon || polygon.length < 3) {
          throw new Error('Polygon with at least 3 points required for area calculation');
        }
        // Ensure polygon is closed
        const coords = [...polygon];
        if (
          coords[0][0] !== coords[coords.length - 1][0] ||
          coords[0][1] !== coords[coords.length - 1][1]
        ) {
          coords.push(coords[0]);
        }
        const poly = turf.polygon([coords]);
        const areaM2 = turf.area(poly);
        const areaKm2 = areaM2 / 1000000;
        const areaMi2 = areaKm2 * 0.386102;
        const areaAcres = areaM2 * 0.000247105;

        result = {
          operation: 'area',
          squareMeters: areaM2,
          squareKilometers: areaKm2,
          squareMiles: areaMi2,
          acres: areaAcres,
          hectares: areaM2 / 10000,
          formatted: areaKm2 > 1 ? `${areaKm2.toFixed(2)} km²` : `${areaM2.toFixed(0)} m²`,
        };
        break;
      }

      case 'point_in_polygon': {
        if (!point1 || !polygon) {
          throw new Error('Point and polygon required');
        }
        const coords = [...polygon];
        if (
          coords[0][0] !== coords[coords.length - 1][0] ||
          coords[0][1] !== coords[coords.length - 1][1]
        ) {
          coords.push(coords[0]);
        }
        const pt = turf.point(point1);
        const poly = turf.polygon([coords]);
        const inside = turf.booleanPointInPolygon(pt, poly);

        result = {
          operation: 'point_in_polygon',
          point: { longitude: point1[0], latitude: point1[1] },
          inside,
          message: inside ? 'Point is inside the polygon' : 'Point is outside the polygon',
        };
        break;
      }

      case 'buffer': {
        const radius = options.radius || 1;
        let geometry;

        if (point1) {
          geometry = turf.point(point1);
        } else if (line && line.length >= 2) {
          geometry = turf.lineString(line);
        } else {
          throw new Error('Point or line required for buffer');
        }

        const buffered = turf.buffer(geometry, radius, { units });
        const bufferCoords = buffered.geometry.coordinates[0];

        result = {
          operation: 'buffer',
          radius,
          units,
          center: point1 || 'line',
          bufferPolygon: bufferCoords.slice(0, 10), // First 10 points
          totalPoints: bufferCoords.length,
          message: `Created ${radius} ${units} buffer zone`,
        };
        break;
      }

      case 'centroid': {
        if (!polygon || polygon.length < 3) {
          throw new Error('Polygon required for centroid');
        }
        const coords = [...polygon];
        if (
          coords[0][0] !== coords[coords.length - 1][0] ||
          coords[0][1] !== coords[coords.length - 1][1]
        ) {
          coords.push(coords[0]);
        }
        const poly = turf.polygon([coords]);
        const center = turf.centroid(poly);

        result = {
          operation: 'centroid',
          centroid: {
            longitude: center.geometry.coordinates[0],
            latitude: center.geometry.coordinates[1],
          },
          coordinates: center.geometry.coordinates,
        };
        break;
      }

      case 'bearing': {
        if (!point1 || !point2) {
          throw new Error('Two coordinates required for bearing calculation');
        }
        const from = turf.point(point1);
        const to = turf.point(point2);
        const bearing = turf.bearing(from, to);
        const normalizedBearing = bearing < 0 ? bearing + 360 : bearing;

        // Convert to compass direction
        const directions = [
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
        const index = Math.round(normalizedBearing / 22.5) % 16;

        result = {
          operation: 'bearing',
          from: { longitude: point1[0], latitude: point1[1] },
          to: { longitude: point2[0], latitude: point2[1] },
          bearing: normalizedBearing,
          compassDirection: directions[index],
          formatted: `${normalizedBearing.toFixed(1)}° (${directions[index]})`,
        };
        break;
      }

      case 'bbox': {
        let geometry;
        if (polygon && polygon.length >= 3) {
          const coords = [...polygon];
          if (
            coords[0][0] !== coords[coords.length - 1][0] ||
            coords[0][1] !== coords[coords.length - 1][1]
          ) {
            coords.push(coords[0]);
          }
          geometry = turf.polygon([coords]);
        } else if (points && points.length > 0) {
          geometry = turf.multiPoint(points);
        } else if (line && line.length >= 2) {
          geometry = turf.lineString(line);
        } else {
          throw new Error('Polygon, points, or line required for bounding box');
        }

        const bbox = turf.bbox(geometry);

        result = {
          operation: 'bbox',
          boundingBox: {
            minLongitude: bbox[0],
            minLatitude: bbox[1],
            maxLongitude: bbox[2],
            maxLatitude: bbox[3],
          },
          southwest: [bbox[0], bbox[1]],
          northeast: [bbox[2], bbox[3]],
          width: turf.distance(turf.point([bbox[0], bbox[1]]), turf.point([bbox[2], bbox[1]]), {
            units,
          }),
          height: turf.distance(turf.point([bbox[0], bbox[1]]), turf.point([bbox[0], bbox[3]]), {
            units,
          }),
          units,
        };
        break;
      }

      case 'midpoint': {
        if (!point1 || !point2) {
          throw new Error('Two coordinates required for midpoint');
        }
        const from = turf.point(point1);
        const to = turf.point(point2);
        const mid = turf.midpoint(from, to);

        result = {
          operation: 'midpoint',
          from: { longitude: point1[0], latitude: point1[1] },
          to: { longitude: point2[0], latitude: point2[1] },
          midpoint: {
            longitude: mid.geometry.coordinates[0],
            latitude: mid.geometry.coordinates[1],
          },
          coordinates: mid.geometry.coordinates,
        };
        break;
      }

      case 'along': {
        if (!line || line.length < 2) {
          throw new Error('Line with at least 2 points required');
        }
        const distance = options.distance || 1;
        const lineString = turf.lineString(line);
        const pt = turf.along(lineString, distance, { units });

        result = {
          operation: 'along',
          distance,
          units,
          point: {
            longitude: pt.geometry.coordinates[0],
            latitude: pt.geometry.coordinates[1],
          },
          coordinates: pt.geometry.coordinates,
          totalLineLength: turf.length(lineString, { units }),
        };
        break;
      }

      case 'nearest': {
        if (!point1 || !points || points.length === 0) {
          throw new Error('Target point and array of points required');
        }
        const targetPt = turf.point(point1);
        const pointCollection = turf.featureCollection(points.map((p: number[]) => turf.point(p)));
        const nearest = turf.nearestPoint(targetPt, pointCollection);

        const nearestCoord = nearest.geometry.coordinates;
        const dist = turf.distance(targetPt, nearest, { units });

        result = {
          operation: 'nearest',
          targetPoint: { longitude: point1[0], latitude: point1[1] },
          nearestPoint: {
            longitude: nearestCoord[0],
            latitude: nearestCoord[1],
          },
          distance: dist,
          units,
          index: nearest.properties.featureIndex,
          formatted: `Nearest point is ${dist.toFixed(2)} ${units} away`,
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result, null, 2),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Geospatial error: ${(error as Error).message}`,
      isError: true,
    };
  }
}
