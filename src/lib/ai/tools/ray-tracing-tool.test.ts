import { describe, it, expect } from 'vitest';
import { executeRayTracing, isRayTracingAvailable, rayTracingTool } from './ray-tracing-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'ray_tracing', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeRayTracing(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('rayTracingTool metadata', () => {
  it('should have correct name', () => {
    expect(rayTracingTool.name).toBe('ray_tracing');
  });

  it('should require operation', () => {
    expect(rayTracingTool.parameters.required).toContain('operation');
  });
});

describe('isRayTracingAvailable', () => {
  it('should return true', () => {
    expect(isRayTracingAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// intersect_sphere
// -------------------------------------------------------------------
describe('executeRayTracing - intersect_sphere', () => {
  it('should detect hit with default params', async () => {
    const result = await getResult({ operation: 'intersect_sphere' });
    expect(result.operation).toBe('intersect_sphere');
    expect(result.hit).toBe(true);
    expect(result.t).toBeGreaterThan(0);
    expect(result.intersection_point).toBeDefined();
    expect(result.surface_normal).toBeDefined();
  });

  it('should detect miss when ray is off target', async () => {
    const result = await getResult({
      operation: 'intersect_sphere',
      ray_origin: '[0,10,0]',
      ray_direction: '[1,0,0]',
      sphere_center: '[0,0,0]',
      sphere_radius: 1,
    });
    expect(result.hit).toBe(false);
  });

  it('should hit sphere with custom params', async () => {
    const result = await getResult({
      operation: 'intersect_sphere',
      ray_origin: '[0,0,-5]',
      ray_direction: '[0,0,1]',
      sphere_center: '[0,0,0]',
      sphere_radius: 2,
    });
    expect(result.hit).toBe(true);
    expect(result.sphere.radius).toBe(2);
  });
});

// -------------------------------------------------------------------
// intersect_plane
// -------------------------------------------------------------------
describe('executeRayTracing - intersect_plane', () => {
  it('should detect hit with default params', async () => {
    const result = await getResult({ operation: 'intersect_plane' });
    expect(result.operation).toBe('intersect_plane');
    expect(result.hit).toBe(true);
    expect(result.t).toBeGreaterThan(0);
  });

  it('should detect miss for parallel ray', async () => {
    const result = await getResult({
      operation: 'intersect_plane',
      ray_origin: '[0,5,0]',
      ray_direction: '[1,0,0]',
      plane_point: '[0,0,0]',
      plane_normal: '[0,1,0]',
    });
    expect(result.hit).toBe(false);
  });
});

// -------------------------------------------------------------------
// intersect_box
// -------------------------------------------------------------------
describe('executeRayTracing - intersect_box', () => {
  it('should detect hit with default params', async () => {
    const result = await getResult({ operation: 'intersect_box' });
    expect(result.operation).toBe('intersect_box');
    expect(result.hit).toBe(true);
    expect(result.t).toBeGreaterThan(0);
  });

  it('should detect miss when ray is off target', async () => {
    const result = await getResult({
      operation: 'intersect_box',
      ray_origin: '[0,10,0]',
      ray_direction: '[1,0,0]',
      box_min: '[-1,-1,-1]',
      box_max: '[1,1,1]',
    });
    expect(result.hit).toBe(false);
  });
});

// -------------------------------------------------------------------
// intersect_triangle
// -------------------------------------------------------------------
describe('executeRayTracing - intersect_triangle', () => {
  it('should detect hit with default params', async () => {
    const result = await getResult({ operation: 'intersect_triangle' });
    expect(result.operation).toBe('intersect_triangle');
    expect(result.hit).toBe(true);
    expect(result.t).toBeGreaterThan(0);
    expect(result.surface_normal).toBeDefined();
  });

  it('should detect miss when ray misses triangle', async () => {
    const result = await getResult({
      operation: 'intersect_triangle',
      ray_origin: '[10,10,-5]',
      ray_direction: '[0,0,1]',
      triangle: '[[-1,0,0],[1,0,0],[0,2,0]]',
    });
    expect(result.hit).toBe(false);
  });
});

// -------------------------------------------------------------------
// render
// -------------------------------------------------------------------
describe('executeRayTracing - render', () => {
  it('should render default scene', async () => {
    const result = await getResult({ operation: 'render', width: 30, height: 10 });
    expect(result.operation).toBe('render');
    expect(result.resolution).toEqual({ width: 30, height: 10 });
    expect(result.render).toBeDefined();
    expect(typeof result.render).toBe('string');
    expect(result.scene.objects).toBeGreaterThan(0);
    expect(result.scene.lights).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------
// trace
// -------------------------------------------------------------------
describe('executeRayTracing - trace', () => {
  it('should trace a single ray', async () => {
    const result = await getResult({ operation: 'trace' });
    expect(result.operation).toBe('trace');
    expect(result.result_color).toBeDefined();
    expect(typeof result.result_color.r).toBe('number');
    expect(typeof result.result_color.g).toBe('number');
    expect(typeof result.result_color.b).toBe('number');
    expect(result.brightness).toBeDefined();
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeRayTracing - errors', () => {
  it('should return error for unknown operation', async () => {
    const res = await executeRayTracing(makeCall({ operation: 'unknown' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeRayTracing({
      id: 'my-id',
      name: 'ray_tracing',
      arguments: { operation: 'render', width: 10, height: 5 },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
