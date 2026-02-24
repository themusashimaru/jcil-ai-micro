import { describe, it, expect } from 'vitest';
import { executeHoughVision, isHoughVisionAvailable, houghVisionTool } from './hough-vision-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'hough_vision', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeHoughVision(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('houghVisionTool metadata', () => {
  it('should have correct name', () => {
    expect(houghVisionTool.name).toBe('hough_vision');
  });

  it('should require operation', () => {
    expect(houghVisionTool.parameters.required).toContain('operation');
  });

  it('should list valid operations in enum', () => {
    const opProp = (houghVisionTool.parameters.properties as Record<string, { enum?: string[] }>)
      .operation;
    expect(opProp.enum).toContain('sobel');
    expect(opProp.enum).toContain('canny');
    expect(opProp.enum).toContain('hough_lines');
    expect(opProp.enum).toContain('hough_circles');
    expect(opProp.enum).toContain('harris');
    expect(opProp.enum).toContain('create_test');
    expect(opProp.enum).toContain('detect_all');
  });
});

describe('isHoughVisionAvailable', () => {
  it('should return true', () => {
    expect(isHoughVisionAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// create_test operation
// -------------------------------------------------------------------
describe('executeHoughVision - create_test', () => {
  it('should create a test image with default shapes', async () => {
    const result = await getResult({ operation: 'create_test' });
    expect(result.operation).toBe('create_test');
    expect(result.dimensions).toEqual({ width: 80, height: 60 });
    expect(result.shapes).toHaveLength(3);
    expect(result.image_ascii).toBeDefined();
  });

  it('should create a test image with custom dimensions', async () => {
    const result = await getResult({ operation: 'create_test', width: 40, height: 30 });
    expect(result.dimensions).toEqual({ width: 40, height: 30 });
  });

  it('should create a test image with custom shapes', async () => {
    const shapes = [{ type: 'line', x1: 0, y1: 0, x2: 20, y2: 20 }];
    const result = await getResult({ operation: 'create_test', shapes });
    expect(result.shapes).toHaveLength(1);
    expect(result.image_ascii).toBeDefined();
  });
});

// -------------------------------------------------------------------
// sobel operation
// -------------------------------------------------------------------
describe('executeHoughVision - sobel', () => {
  it('should perform Sobel edge detection', async () => {
    const result = await getResult({ operation: 'sobel' });
    expect(result.operation).toBe('sobel');
    expect(result.edge_count).toBeGreaterThan(0);
    expect(result.input_ascii).toBeDefined();
    expect(result.edge_magnitude_ascii).toBeDefined();
    expect(result.sample_edges).toBeDefined();
    expect(result.explanation).toContain('Sobel');
  });

  it('should accept custom dimensions', async () => {
    const result = await getResult({ operation: 'sobel', width: 40, height: 30 });
    expect(result.operation).toBe('sobel');
    expect(result.edge_count).toBeGreaterThanOrEqual(0);
  });
});

// -------------------------------------------------------------------
// canny operation
// -------------------------------------------------------------------
describe('executeHoughVision - canny', () => {
  it('should perform Canny edge detection', async () => {
    const result = await getResult({ operation: 'canny' });
    expect(result.operation).toBe('canny');
    expect(result.input_ascii).toBeDefined();
    expect(result.output_ascii).toBeDefined();
    expect(result.steps).toHaveLength(4);
  });

  it('should accept custom thresholds', async () => {
    const result = await getResult({
      operation: 'canny',
      low_threshold: 30,
      high_threshold: 80,
    });
    expect(result.parameters.low_threshold).toBe(30);
    expect(result.parameters.high_threshold).toBe(80);
  });
});

// -------------------------------------------------------------------
// hough_lines operation
// -------------------------------------------------------------------
describe('executeHoughVision - hough_lines', () => {
  it('should detect lines using Hough transform', async () => {
    const result = await getResult({ operation: 'hough_lines' });
    expect(result.operation).toBe('hough_lines');
    expect(result.input_ascii).toBeDefined();
    expect(result.edge_ascii).toBeDefined();
    expect(result.detected_lines).toBeDefined();
    expect(result.explanation).toBeDefined();
  });

  it('should accept custom dimensions', async () => {
    const result = await getResult({ operation: 'hough_lines', width: 60, height: 40 });
    expect(result.operation).toBe('hough_lines');
  });
});

// -------------------------------------------------------------------
// hough_circles operation
// -------------------------------------------------------------------
describe('executeHoughVision - hough_circles', () => {
  it('should detect circles using Hough transform', async () => {
    const result = await getResult({ operation: 'hough_circles' });
    expect(result.operation).toBe('hough_circles');
    expect(result.input_ascii).toBeDefined();
    expect(result.edge_ascii).toBeDefined();
    expect(result.detected_circles).toBeDefined();
  });

  it('should accept custom radius range', async () => {
    const result = await getResult({
      operation: 'hough_circles',
      min_radius: 5,
      max_radius: 25,
    });
    expect(result.parameters.min_radius).toBe(5);
    expect(result.parameters.max_radius).toBe(25);
  });
});

// -------------------------------------------------------------------
// harris operation
// -------------------------------------------------------------------
describe('executeHoughVision - harris', () => {
  it('should detect corners using Harris detector', async () => {
    const result = await getResult({ operation: 'harris' });
    expect(result.operation).toBe('harris');
    expect(result.input_ascii).toBeDefined();
    expect(result.detected_corners).toBeDefined();
    expect(result.total_corners).toBeGreaterThanOrEqual(0);
    expect(result.explanation).toBeDefined();
  });
});

// -------------------------------------------------------------------
// detect_all operation
// -------------------------------------------------------------------
describe('executeHoughVision - detect_all', () => {
  it('should run full detection pipeline', async () => {
    const result = await getResult({ operation: 'detect_all' });
    expect(result.operation).toBe('detect_all');
    expect(result.input_image).toBeDefined();
    expect(result.edge_image).toBeDefined();
    expect(result.detections).toBeDefined();
    expect(result.detections.lines).toBeDefined();
    expect(result.detections.circles).toBeDefined();
    expect(result.detections.corners).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(typeof result.summary.lines_found).toBe('number');
    expect(typeof result.summary.circles_found).toBe('number');
    expect(typeof result.summary.corners_found).toBe('number');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeHoughVision - errors', () => {
  it('should return error for unknown operation', async () => {
    const res = await executeHoughVision(makeCall({ operation: 'unknown' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown operation');
  });

  it('should handle string arguments', async () => {
    const res = await executeHoughVision({
      id: 'test',
      name: 'hough_vision',
      arguments: JSON.stringify({ operation: 'create_test' }),
    });
    expect(res.isError).toBeUndefined();
  });

  it('should return toolCallId', async () => {
    const res = await executeHoughVision({
      id: 'my-id',
      name: 'hough_vision',
      arguments: { operation: 'sobel' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
