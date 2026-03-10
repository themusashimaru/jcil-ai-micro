import { describe, it, expect } from 'vitest';
import { executeGeospatial, isGeospatialAvailable, geospatialTool } from './geospatial-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'geo_calculate', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeGeospatial(makeCall(args));
  return JSON.parse(res.content);
}

// New York City [lon, lat]
const NYC = [-74.006, 40.7128];
// Los Angeles [lon, lat]
const LA = [-118.2437, 34.0522];
// London [lon, lat]
const LONDON = [-0.1278, 51.5074];

// Simple triangle polygon in NYC area
const TRIANGLE = [
  [-74.0, 40.7],
  [-73.9, 40.7],
  [-73.95, 40.8],
];

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('geospatialTool metadata', () => {
  it('should have correct name', () => {
    expect(geospatialTool.name).toBe('geo_calculate');
  });

  it('should require operation', () => {
    expect(geospatialTool.parameters.required).toContain('operation');
  });
});

describe('isGeospatialAvailable', () => {
  it('should return true', () => {
    expect(isGeospatialAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// distance operation
// -------------------------------------------------------------------
describe('executeGeospatial - distance', () => {
  it('should calculate distance between NYC and LA', async () => {
    const result = await getResult({
      operation: 'distance',
      point1: NYC,
      point2: LA,
    });
    expect(result.operation).toBe('distance');
    expect(result.distance).toBeGreaterThan(3900);
    expect(result.distance).toBeLessThan(4100);
    expect(result.units).toBe('kilometers');
  });

  it('should calculate distance in miles', async () => {
    const result = await getResult({
      operation: 'distance',
      point1: NYC,
      point2: LA,
      options: { units: 'miles' },
    });
    expect(result.units).toBe('miles');
    expect(result.distance).toBeGreaterThan(2400);
    expect(result.distance).toBeLessThan(2600);
  });

  it('should error without two points', async () => {
    const res = await executeGeospatial(makeCall({ operation: 'distance', point1: NYC }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// area operation
// -------------------------------------------------------------------
describe('executeGeospatial - area', () => {
  it('should calculate area of polygon', async () => {
    const result = await getResult({
      operation: 'area',
      polygon: TRIANGLE,
    });
    expect(result.operation).toBe('area');
    expect(result.squareKilometers).toBeGreaterThan(0);
    expect(result.squareMiles).toBeGreaterThan(0);
    expect(result.acres).toBeGreaterThan(0);
  });

  it('should error without polygon', async () => {
    const res = await executeGeospatial(makeCall({ operation: 'area' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// point_in_polygon operation
// -------------------------------------------------------------------
describe('executeGeospatial - point_in_polygon', () => {
  it('should detect point inside polygon', async () => {
    const result = await getResult({
      operation: 'point_in_polygon',
      point1: [-73.95, 40.75],
      polygon: TRIANGLE,
    });
    expect(result.inside).toBe(true);
  });

  it('should detect point outside polygon', async () => {
    const result = await getResult({
      operation: 'point_in_polygon',
      point1: [-75.0, 41.0],
      polygon: TRIANGLE,
    });
    expect(result.inside).toBe(false);
  });
});

// -------------------------------------------------------------------
// bearing operation
// -------------------------------------------------------------------
describe('executeGeospatial - bearing', () => {
  it('should calculate bearing between NYC and LA', async () => {
    const result = await getResult({
      operation: 'bearing',
      point1: NYC,
      point2: LA,
    });
    expect(result.operation).toBe('bearing');
    expect(result.bearing).toBeGreaterThan(0);
    expect(result.bearing).toBeLessThan(360);
    expect(result.compassDirection).toBeDefined();
  });
});

// -------------------------------------------------------------------
// centroid operation
// -------------------------------------------------------------------
describe('executeGeospatial - centroid', () => {
  it('should find centroid of polygon', async () => {
    const result = await getResult({
      operation: 'centroid',
      polygon: TRIANGLE,
    });
    expect(result.centroid.longitude).toBeCloseTo(-73.95, 1);
    expect(result.centroid.latitude).toBeCloseTo(40.73, 1);
  });
});

// -------------------------------------------------------------------
// midpoint operation
// -------------------------------------------------------------------
describe('executeGeospatial - midpoint', () => {
  it('should find midpoint between two coordinates', async () => {
    const result = await getResult({
      operation: 'midpoint',
      point1: NYC,
      point2: LA,
    });
    expect(result.midpoint.longitude).toBeDefined();
    expect(result.midpoint.latitude).toBeDefined();
  });
});

// -------------------------------------------------------------------
// bbox operation
// -------------------------------------------------------------------
describe('executeGeospatial - bbox', () => {
  it('should compute bounding box of polygon', async () => {
    const result = await getResult({
      operation: 'bbox',
      polygon: TRIANGLE,
    });
    expect(result.boundingBox.minLongitude).toBeCloseTo(-74.0, 1);
    expect(result.boundingBox.maxLongitude).toBeCloseTo(-73.9, 1);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('should compute bbox from points', async () => {
    const result = await getResult({
      operation: 'bbox',
      points: [NYC, LA, LONDON],
    });
    expect(result.boundingBox).toBeDefined();
  });
});

// -------------------------------------------------------------------
// buffer operation
// -------------------------------------------------------------------
describe('executeGeospatial - buffer', () => {
  it('should create buffer around point', async () => {
    const result = await getResult({
      operation: 'buffer',
      point1: NYC,
      options: { radius: 5, units: 'kilometers' },
    });
    expect(result.operation).toBe('buffer');
    expect(result.radius).toBe(5);
    expect(result.totalPoints).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------
// nearest operation
// -------------------------------------------------------------------
describe('executeGeospatial - nearest', () => {
  it('should find nearest point', async () => {
    const result = await getResult({
      operation: 'nearest',
      point1: NYC,
      points: [LA, LONDON, [-73.935, 40.73]], // close to NYC
    });
    expect(result.nearestPoint).toBeDefined();
    expect(result.distance).toBeGreaterThan(0);
    expect(result.index).toBe(2); // closest is the NYC-area point
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeGeospatial - errors', () => {
  it('should return error for unknown operation', async () => {
    const res = await executeGeospatial(makeCall({ operation: 'unknown' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeGeospatial({
      id: 'my-id',
      name: 'geo_calculate',
      arguments: { operation: 'distance', point1: NYC, point2: LA },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
