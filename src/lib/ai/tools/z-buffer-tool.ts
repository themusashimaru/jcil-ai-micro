/**
 * Z-BUFFER TOOL
 * Comprehensive z-buffer depth testing with depth buffer management,
 * visibility determination, and depth-based rendering techniques
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface Fragment {
  x: number;
  y: number;
  z: number;
  color: Color;
  primitiveId?: number;
}

interface ZBuffer {
  width: number;
  height: number;
  depthBuffer: number[];
  colorBuffer: Color[];
  nearPlane: number;
  farPlane: number;
  clearDepth: number;
  depthFunc: DepthFunction;
}

type DepthFunction = 'less' | 'lequal' | 'greater' | 'gequal' | 'equal' | 'notequal' | 'always' | 'never';

interface Triangle {
  v0: Vec3;
  v1: Vec3;
  v2: Vec3;
  color: Color;
  id: number;
}

interface DepthStats {
  minDepth: number;
  maxDepth: number;
  avgDepth: number;
  fragmentsWritten: number;
  fragmentsRejected: number;
  overdraw: number;
}

// ============================================================================
// Z-BUFFER CORE
// ============================================================================

function createZBuffer(width: number, height: number, nearPlane: number = 0.1, farPlane: number = 1000): ZBuffer {
  const size = width * height;
  const clearDepth = 1.0; // Far plane in normalized coordinates

  return {
    width,
    height,
    depthBuffer: new Array(size).fill(clearDepth),
    colorBuffer: new Array(size).fill(null).map(() => ({ r: 0, g: 0, b: 0, a: 255 })),
    nearPlane,
    farPlane,
    clearDepth,
    depthFunc: 'less'
  };
}

function clearZBuffer(buffer: ZBuffer, depthValue?: number, clearColor?: Color): void {
  const size = buffer.width * buffer.height;
  const depth = depthValue ?? buffer.clearDepth;
  const color = clearColor ?? { r: 0, g: 0, b: 0, a: 255 };

  for (let i = 0; i < size; i++) {
    buffer.depthBuffer[i] = depth;
    buffer.colorBuffer[i] = { ...color };
  }
}

function getPixelIndex(buffer: ZBuffer, x: number, y: number): number {
  return y * buffer.width + x;
}

function depthTest(buffer: ZBuffer, currentDepth: number, storedDepth: number): boolean {
  switch (buffer.depthFunc) {
    case 'less': return currentDepth < storedDepth;
    case 'lequal': return currentDepth <= storedDepth;
    case 'greater': return currentDepth > storedDepth;
    case 'gequal': return currentDepth >= storedDepth;
    case 'equal': return Math.abs(currentDepth - storedDepth) < 1e-6;
    case 'notequal': return Math.abs(currentDepth - storedDepth) >= 1e-6;
    case 'always': return true;
    case 'never': return false;
    default: return currentDepth < storedDepth;
  }
}

function writeFragment(buffer: ZBuffer, fragment: Fragment, stats: DepthStats): boolean {
  const { x, y, z, color } = fragment;

  // Bounds check
  if (x < 0 || x >= buffer.width || y < 0 || y >= buffer.height) {
    stats.fragmentsRejected++;
    return false;
  }

  // Clamp depth to [0, 1]
  const normalizedDepth = Math.max(0, Math.min(1, z));

  const idx = getPixelIndex(buffer, Math.floor(x), Math.floor(y));
  const storedDepth = buffer.depthBuffer[idx];

  // Depth test
  if (depthTest(buffer, normalizedDepth, storedDepth)) {
    // Track overdraw
    if (storedDepth < buffer.clearDepth) {
      stats.overdraw++;
    }

    buffer.depthBuffer[idx] = normalizedDepth;
    buffer.colorBuffer[idx] = { ...color };
    stats.fragmentsWritten++;

    // Update depth stats
    if (normalizedDepth < stats.minDepth) stats.minDepth = normalizedDepth;
    if (normalizedDepth > stats.maxDepth) stats.maxDepth = normalizedDepth;

    return true;
  }

  stats.fragmentsRejected++;
  return false;
}

// ============================================================================
// TRIANGLE RASTERIZATION
// ============================================================================

function edgeFunction(a: Vec3, b: Vec3, c: Vec3): number {
  return (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
}

function interpolateZ(v0: Vec3, v1: Vec3, v2: Vec3, w0: number, w1: number, w2: number): number {
  return v0.z * w0 + v1.z * w1 + v2.z * w2;
}

function rasterizeTriangle(buffer: ZBuffer, triangle: Triangle, stats: DepthStats): void {
  const { v0, v1, v2, color } = triangle;

  // Compute bounding box
  const minX = Math.max(0, Math.floor(Math.min(v0.x, v1.x, v2.x)));
  const maxX = Math.min(buffer.width - 1, Math.ceil(Math.max(v0.x, v1.x, v2.x)));
  const minY = Math.max(0, Math.floor(Math.min(v0.y, v1.y, v2.y)));
  const maxY = Math.min(buffer.height - 1, Math.ceil(Math.max(v0.y, v1.y, v2.y)));

  // Triangle area (for normalization)
  const area = edgeFunction(v0, v1, v2);
  if (Math.abs(area) < 1e-6) return; // Degenerate triangle

  // Rasterize
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p: Vec3 = { x: x + 0.5, y: y + 0.5, z: 0 };

      // Barycentric coordinates
      const w0 = edgeFunction(v1, v2, p) / area;
      const w1 = edgeFunction(v2, v0, p) / area;
      const w2 = edgeFunction(v0, v1, p) / area;

      // Check if inside triangle
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
        // Interpolate z
        const z = interpolateZ(v0, v1, v2, w0, w1, w2);

        const fragment: Fragment = {
          x, y, z,
          color,
          primitiveId: triangle.id
        };

        writeFragment(buffer, fragment, stats);
      }
    }
  }
}

// ============================================================================
// DEPTH OPERATIONS
// ============================================================================

function linearizeDepth(depth: number, near: number, far: number): number {
  // Convert from [0,1] NDC depth to linear view space depth
  return (2.0 * near * far) / (far + near - depth * (far - near));
}

function normalizeDepth(z: number, near: number, far: number): number {
  // Convert linear z to [0,1] range
  return (z - near) / (far - near);
}

function computeDepthStats(buffer: ZBuffer): DepthStats {
  let minDepth = 1;
  let maxDepth = 0;
  let sum = 0;
  let count = 0;

  for (let i = 0; i < buffer.depthBuffer.length; i++) {
    const d = buffer.depthBuffer[i];
    if (d < buffer.clearDepth) {
      if (d < minDepth) minDepth = d;
      if (d > maxDepth) maxDepth = d;
      sum += d;
      count++;
    }
  }

  return {
    minDepth: count > 0 ? minDepth : 0,
    maxDepth: count > 0 ? maxDepth : 0,
    avgDepth: count > 0 ? sum / count : 0,
    fragmentsWritten: count,
    fragmentsRejected: 0,
    overdraw: 0
  };
}

function generateDepthVisualization(buffer: ZBuffer, width: number = 40, height: number = 20): string[] {
  const lines: string[] = [];
  const chars = ' .:-=+*#%@';

  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const srcX = Math.floor((x / width) * buffer.width);
      const srcY = Math.floor((y / height) * buffer.height);
      const depth = buffer.depthBuffer[getPixelIndex(buffer, srcX, srcY)];

      if (depth >= buffer.clearDepth) {
        line += ' ';
      } else {
        const charIdx = Math.floor(depth * (chars.length - 1));
        line += chars[Math.max(0, Math.min(chars.length - 1, charIdx))];
      }
    }
    lines.push(line);
  }

  return lines;
}

// ============================================================================
// DEPTH SORTING (PAINTER'S ALGORITHM COMPARISON)
// ============================================================================

function sortTrianglesByDepth(triangles: Triangle[]): Triangle[] {
  // Sort by average z (back to front for painter's algorithm)
  return [...triangles].sort((a, b) => {
    const avgZA = (a.v0.z + a.v1.z + a.v2.z) / 3;
    const avgZB = (b.v0.z + b.v1.z + b.v2.z) / 3;
    return avgZB - avgZA; // Back to front
  });
}

function compareWithPaintersAlgorithm(buffer: ZBuffer, triangles: Triangle[]): {
  zbufferResult: DepthStats;
  paintersOrder: number[];
  zbufferAdvantages: string[];
} {
  // Z-buffer rendering
  const zbufferStats: DepthStats = {
    minDepth: 1, maxDepth: 0, avgDepth: 0,
    fragmentsWritten: 0, fragmentsRejected: 0, overdraw: 0
  };

  clearZBuffer(buffer);
  triangles.forEach(t => rasterizeTriangle(buffer, t, zbufferStats));

  // Painter's algorithm order
  const sorted = sortTrianglesByDepth(triangles);
  const paintersOrder = sorted.map(t => t.id);

  return {
    zbufferResult: zbufferStats,
    paintersOrder,
    zbufferAdvantages: [
      'Handles intersecting triangles correctly',
      'No sorting required (O(n) vs O(n log n))',
      'Works with cyclic overlaps',
      'Per-pixel accuracy vs per-primitive',
      'Supports early-z optimization'
    ]
  };
}

// ============================================================================
// HIERARCHICAL Z-BUFFER
// ============================================================================

interface HierarchicalZBuffer {
  levels: number[][];
  levelWidths: number[];
  levelHeights: number[];
}

function buildHierarchicalZBuffer(buffer: ZBuffer): HierarchicalZBuffer {
  const levels: number[][] = [buffer.depthBuffer];
  const levelWidths: number[] = [buffer.width];
  const levelHeights: number[] = [buffer.height];

  let currentLevel = buffer.depthBuffer;
  let w = buffer.width;
  let h = buffer.height;

  // Build mip levels (max depth in each 2x2 block)
  while (w > 1 && h > 1) {
    const newW = Math.ceil(w / 2);
    const newH = Math.ceil(h / 2);
    const newLevel: number[] = [];

    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newW; x++) {
        const x0 = x * 2, y0 = y * 2;
        const x1 = Math.min(x0 + 1, w - 1);
        const y1 = Math.min(y0 + 1, h - 1);

        const d00 = currentLevel[y0 * w + x0];
        const d10 = currentLevel[y0 * w + x1];
        const d01 = currentLevel[y1 * w + x0];
        const d11 = currentLevel[y1 * w + x1];

        newLevel.push(Math.max(d00, d10, d01, d11));
      }
    }

    levels.push(newLevel);
    levelWidths.push(newW);
    levelHeights.push(newH);

    currentLevel = newLevel;
    w = newW;
    h = newH;
  }

  return { levels, levelWidths, levelHeights };
}

function hierarchicalOcclusionTest(
  hzb: HierarchicalZBuffer,
  minX: number, minY: number, maxX: number, maxY: number,
  nearZ: number
): boolean {
  // Start from coarsest level
  const level = hzb.levels.length - 1;
  const w = hzb.levelWidths[level];
  const h = hzb.levelHeights[level];

  const scale = w / hzb.levelWidths[0];
  const sx = Math.floor(minX * scale);
  const sy = Math.floor(minY * scale);
  const ex = Math.min(Math.floor(maxX * scale), w - 1);
  const ey = Math.min(Math.floor(maxY * scale), h - 1);

  // Check if any part could be visible
  for (let y = sy; y <= ey; y++) {
    for (let x = sx; x <= ex; x++) {
      const storedDepth = hzb.levels[level][y * w + x];
      if (nearZ < storedDepth) {
        return true; // Potentially visible
      }
    }
  }

  return false; // Completely occluded
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const zbufferTool: UnifiedTool = {
  name: 'z_buffer',
  description: 'Comprehensive z-buffer depth testing with depth buffer management, visibility determination, hierarchical z-buffer, and depth visualization',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'render', 'visualize', 'stats', 'hierarchical', 'compare', 'demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      width: { type: 'number', description: 'Buffer width' },
      height: { type: 'number', description: 'Buffer height' },
      triangles: { type: 'array', description: 'Triangles to render' },
      depthFunc: { type: 'string', enum: ['less', 'lequal', 'greater', 'gequal', 'equal', 'notequal', 'always', 'never'] },
      nearPlane: { type: 'number' },
      farPlane: { type: 'number' }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executezbuffer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, width = 64, height = 64, triangles, depthFunc = 'less', nearPlane = 0.1, farPlane = 1000 } = args;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Z-Buffer Depth Testing',
            description: 'Hardware-accelerated visibility determination technique',
            capabilities: [
              'Per-pixel depth testing',
              'Multiple depth comparison functions',
              'Triangle rasterization with depth',
              'Depth visualization',
              'Hierarchical z-buffer (HZB)',
              'Occlusion culling support',
              'Overdraw statistics'
            ],
            depthFunctions: {
              'less': 'Pass if new < stored (default)',
              'lequal': 'Pass if new <= stored',
              'greater': 'Pass if new > stored',
              'gequal': 'Pass if new >= stored',
              'equal': 'Pass if new == stored',
              'never': 'Always fail',
              'always': 'Always pass'
            },
            concepts: {
              zbuffer: 'Per-pixel depth storage for visibility',
              earlyZ: 'Reject fragments before shading',
              hierarchical: 'Multi-resolution depth for culling',
              depthPrecision: 'More precision near camera'
            },
            operations: ['create', 'render', 'visualize', 'stats', 'hierarchical', 'compare', 'demo', 'examples']
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Render Triangles',
                params: {
                  operation: 'render',
                  width: 100,
                  height: 100,
                  triangles: [
                    { v0: { x: 10, y: 10, z: 0.3 }, v1: { x: 50, y: 10, z: 0.3 }, v2: { x: 30, y: 50, z: 0.3 }, color: { r: 255, g: 0, b: 0 } },
                    { v0: { x: 20, y: 20, z: 0.5 }, v1: { x: 60, y: 20, z: 0.5 }, v2: { x: 40, y: 60, z: 0.5 }, color: { r: 0, g: 255, b: 0 } }
                  ]
                }
              },
              {
                name: 'Compare with Painters',
                params: { operation: 'compare', width: 64, height: 64 }
              }
            ]
          }, null, 2)
        };
      }

      case 'create': {
        const buffer = createZBuffer(width, height, nearPlane, farPlane);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'create',
            buffer: {
              width: buffer.width,
              height: buffer.height,
              totalPixels: buffer.width * buffer.height,
              clearDepth: buffer.clearDepth,
              depthFunc: buffer.depthFunc,
              nearPlane: buffer.nearPlane,
              farPlane: buffer.farPlane,
              memoryEstimate: `${(buffer.width * buffer.height * 8 / 1024).toFixed(2)} KB (depth + color)`
            }
          }, null, 2)
        };
      }

      case 'render': {
        const buffer = createZBuffer(width, height, nearPlane, farPlane);
        buffer.depthFunc = depthFunc;

        const stats: DepthStats = {
          minDepth: 1, maxDepth: 0, avgDepth: 0,
          fragmentsWritten: 0, fragmentsRejected: 0, overdraw: 0
        };

        const inputTriangles: Triangle[] = (triangles || []).map((t: any, i: number) => ({
          v0: t.v0, v1: t.v1, v2: t.v2,
          color: t.color || { r: 255, g: 255, b: 255 },
          id: i
        }));

        inputTriangles.forEach(t => rasterizeTriangle(buffer, t, stats));

        // Compute final stats
        const finalStats = computeDepthStats(buffer);
        stats.minDepth = finalStats.minDepth;
        stats.maxDepth = finalStats.maxDepth;
        stats.avgDepth = finalStats.avgDepth;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'render',
            bufferSize: { width, height },
            trianglesRendered: inputTriangles.length,
            stats,
            depthVisualization: generateDepthVisualization(buffer, 40, 20)
          }, null, 2)
        };
      }

      case 'visualize': {
        const buffer = createZBuffer(width, height, nearPlane, farPlane);

        // Create sample depth pattern
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const cx = width / 2, cy = height / 2;
            const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            const maxDist = Math.sqrt(cx ** 2 + cy ** 2);
            buffer.depthBuffer[y * width + x] = dist / maxDist;
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'visualize',
            description: 'Sample radial depth pattern',
            visualization: generateDepthVisualization(buffer, 50, 25),
            legend: {
              ' ': 'No depth (background)',
              '.': 'Near (low depth)',
              '@': 'Far (high depth)'
            }
          }, null, 2)
        };
      }

      case 'stats': {
        const buffer = createZBuffer(width, height, nearPlane, farPlane);
        const stats = computeDepthStats(buffer);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'stats',
            bufferStats: {
              width: buffer.width,
              height: buffer.height,
              totalPixels: buffer.width * buffer.height,
              depthPrecision: '32-bit float equivalent',
              depthRange: [0, 1],
              depthDistribution: stats
            }
          }, null, 2)
        };
      }

      case 'hierarchical': {
        const buffer = createZBuffer(width, height, nearPlane, farPlane);

        // Fill with sample data
        const stats: DepthStats = {
          minDepth: 1, maxDepth: 0, avgDepth: 0,
          fragmentsWritten: 0, fragmentsRejected: 0, overdraw: 0
        };

        const sampleTriangles: Triangle[] = [
          { v0: { x: 10, y: 10, z: 0.2 }, v1: { x: 50, y: 10, z: 0.2 }, v2: { x: 30, y: 40, z: 0.2 }, color: { r: 255, g: 0, b: 0 }, id: 0 }
        ];

        sampleTriangles.forEach(t => rasterizeTriangle(buffer, t, stats));

        const hzb = buildHierarchicalZBuffer(buffer);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'hierarchical',
            description: 'Hierarchical Z-Buffer (HZB)',
            levels: hzb.levels.length,
            levelDimensions: hzb.levelWidths.map((w, i) => ({
              level: i,
              width: w,
              height: hzb.levelHeights[i],
              pixels: w * hzb.levelHeights[i]
            })),
            uses: [
              'Fast occlusion culling',
              'GPU-based visibility queries',
              'Hierarchical screen-space effects'
            ]
          }, null, 2)
        };
      }

      case 'compare': {
        const buffer = createZBuffer(width, height, nearPlane, farPlane);

        // Create overlapping triangles
        const testTriangles: Triangle[] = [
          { v0: { x: 5, y: 5, z: 0.7 }, v1: { x: 35, y: 5, z: 0.7 }, v2: { x: 20, y: 35, z: 0.7 }, color: { r: 255, g: 0, b: 0 }, id: 0 },
          { v0: { x: 15, y: 10, z: 0.3 }, v1: { x: 45, y: 10, z: 0.3 }, v2: { x: 30, y: 40, z: 0.3 }, color: { r: 0, g: 255, b: 0 }, id: 1 },
          { v0: { x: 25, y: 15, z: 0.5 }, v1: { x: 55, y: 15, z: 0.5 }, v2: { x: 40, y: 45, z: 0.5 }, color: { r: 0, g: 0, b: 255 }, id: 2 }
        ];

        const result = compareWithPaintersAlgorithm(buffer, testTriangles);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare',
            title: 'Z-Buffer vs Painter\'s Algorithm',
            triangleCount: testTriangles.length,
            zbuffer: {
              stats: result.zbufferResult,
              method: 'Per-pixel depth test'
            },
            paintersAlgorithm: {
              renderOrder: result.paintersOrder,
              method: 'Sort by average depth, render back-to-front'
            },
            zbufferAdvantages: result.zbufferAdvantages,
            visualization: generateDepthVisualization(buffer, 40, 20)
          }, null, 2)
        };
      }

      case 'demo': {
        const buffer = createZBuffer(64, 64, 0.1, 100);

        const demoTriangles: Triangle[] = [
          { v0: { x: 5, y: 5, z: 0.8 }, v1: { x: 30, y: 5, z: 0.8 }, v2: { x: 17, y: 30, z: 0.4 }, color: { r: 255, g: 100, b: 100 }, id: 0 },
          { v0: { x: 20, y: 10, z: 0.2 }, v1: { x: 55, y: 10, z: 0.6 }, v2: { x: 37, y: 50, z: 0.3 }, color: { r: 100, g: 255, b: 100 }, id: 1 },
          { v0: { x: 35, y: 5, z: 0.5 }, v1: { x: 60, y: 5, z: 0.5 }, v2: { x: 47, y: 35, z: 0.5 }, color: { r: 100, g: 100, b: 255 }, id: 2 }
        ];

        const stats: DepthStats = {
          minDepth: 1, maxDepth: 0, avgDepth: 0,
          fragmentsWritten: 0, fragmentsRejected: 0, overdraw: 0
        };

        demoTriangles.forEach(t => rasterizeTriangle(buffer, t, stats));

        const finalStats = computeDepthStats(buffer);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            title: 'Z-Buffer Demo',
            description: 'Rendering three overlapping triangles with depth testing',
            bufferSize: { width: 64, height: 64 },
            triangles: demoTriangles.map(t => ({
              id: t.id,
              averageZ: ((t.v0.z + t.v1.z + t.v2.z) / 3).toFixed(3),
              color: `rgb(${t.color.r},${t.color.g},${t.color.b})`
            })),
            renderingStats: {
              fragmentsWritten: stats.fragmentsWritten,
              fragmentsRejected: stats.fragmentsRejected,
              overdrawPixels: stats.overdraw,
              depthRange: [finalStats.minDepth.toFixed(3), finalStats.maxDepth.toFixed(3)]
            },
            depthVisualization: generateDepthVisualization(buffer, 40, 20),
            concepts: [
              'Z-buffer stores depth per pixel',
              'New fragments are tested against stored depth',
              'Only closest fragment color is kept',
              'Handles any triangle ordering automatically',
              'Essential for 3D graphics rendering'
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function iszbufferAvailable(): boolean {
  return true;
}
