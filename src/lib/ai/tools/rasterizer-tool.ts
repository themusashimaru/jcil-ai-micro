/**
 * RASTERIZER TOOL
 * Comprehensive triangle rasterization engine with scanline algorithm,
 * barycentric interpolation, and attribute interpolation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Vec2 {
  x: number;
  y: number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Vec4 {
  x: number;
  y: number;
  z: number;
  w: number;
}

interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface Vertex {
  position: Vec4;
  color?: Color;
  texCoord?: Vec2;
  normal?: Vec3;
}

interface Fragment {
  x: number;
  y: number;
  depth: number;
  color: Color;
  texCoord?: Vec2;
  normal?: Vec3;
  barycentric: Vec3;
}

interface Framebuffer {
  width: number;
  height: number;
  colorBuffer: Color[];
  depthBuffer: number[];
}

interface RasterStats {
  trianglesProcessed: number;
  trianglesCulled: number;
  fragmentsGenerated: number;
  pixelsCovered: number;
  boundingBoxArea: number;
  fillRate: number;
}

interface EdgeEquation {
  a: number;
  b: number;
  c: number;
}

// ============================================================================
// VECTOR OPERATIONS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function vec4(x: number, y: number, z: number, w: number): Vec4 {
  return { x, y, z, w };
}

function color(r: number, g: number, b: number, a: number = 255): Color {
  return { r, g, b, a };
}

function lerpColor(c1: Color, c2: Color, t: number): Color {
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t),
    a: Math.round(c1.a + (c2.a - c1.a) * t)
  };
}

function clampColor(c: Color): Color {
  return {
    r: Math.max(0, Math.min(255, Math.round(c.r))),
    g: Math.max(0, Math.min(255, Math.round(c.g))),
    b: Math.max(0, Math.min(255, Math.round(c.b))),
    a: Math.max(0, Math.min(255, Math.round(c.a)))
  };
}

// ============================================================================
// FRAMEBUFFER
// ============================================================================

function createFramebuffer(width: number, height: number): Framebuffer {
  const size = width * height;
  return {
    width,
    height,
    colorBuffer: new Array(size).fill(null).map(() => color(0, 0, 0, 255)),
    depthBuffer: new Array(size).fill(1.0)
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function clearFramebuffer(fb: Framebuffer, clearColor: Color = color(0, 0, 0, 255)): void {
  for (let i = 0; i < fb.colorBuffer.length; i++) {
    fb.colorBuffer[i] = { ...clearColor };
    fb.depthBuffer[i] = 1.0;
  }
}

function setPixel(fb: Framebuffer, x: number, y: number, c: Color, depth: number): boolean {
  if (x < 0 || x >= fb.width || y < 0 || y >= fb.height) return false;

  const idx = Math.floor(y) * fb.width + Math.floor(x);
  if (depth < fb.depthBuffer[idx]) {
    fb.depthBuffer[idx] = depth;
    fb.colorBuffer[idx] = clampColor(c);
    return true;
  }
  return false;
}

// ============================================================================
// EDGE FUNCTIONS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function computeEdgeEquation(v0: Vec2, v1: Vec2): EdgeEquation {
  return {
    a: v0.y - v1.y,
    b: v1.x - v0.x,
    c: v0.x * v1.y - v1.x * v0.y
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function evaluateEdge(edge: EdgeEquation, x: number, y: number): number {
  return edge.a * x + edge.b * y + edge.c;
}

function orient2d(a: Vec2, b: Vec2, c: Vec2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

// ============================================================================
// BARYCENTRIC COORDINATES
// ============================================================================

function computeBarycentric(p: Vec2, v0: Vec2, v1: Vec2, v2: Vec2): Vec3 | null {
  const area = orient2d(v0, v1, v2);
  if (Math.abs(area) < 1e-10) return null;

  const w0 = orient2d(v1, v2, p) / area;
  const w1 = orient2d(v2, v0, p) / area;
  const w2 = orient2d(v0, v1, p) / area;

  return { x: w0, y: w1, z: w2 };
}

function isInsideTriangle(bary: Vec3): boolean {
  return bary.x >= 0 && bary.y >= 0 && bary.z >= 0;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function interpolateAttribute<T extends { [K in keyof T]: number }>(
  bary: Vec3,
  a0: T,
  a1: T,
  a2: T
): T {
  const result = {} as T;
  for (const key of Object.keys(a0) as (keyof T)[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (result as any)[key] = (a0[key] as number) * bary.x +
                          (a1[key] as number) * bary.y +
                          (a2[key] as number) * bary.z;
  }
  return result;
}

// ============================================================================
// PERSPECTIVE CORRECTION
// ============================================================================

function perspectiveCorrectInterpolation(
  bary: Vec3,
  w0: number, w1: number, w2: number
): Vec3 {
  // Convert to perspective-correct barycentric
  const oneOverW0 = 1 / w0;
  const oneOverW1 = 1 / w1;
  const oneOverW2 = 1 / w2;

  const sum = bary.x * oneOverW0 + bary.y * oneOverW1 + bary.z * oneOverW2;

  return {
    x: (bary.x * oneOverW0) / sum,
    y: (bary.y * oneOverW1) / sum,
    z: (bary.z * oneOverW2) / sum
  };
}

// ============================================================================
// TRIANGLE RASTERIZATION
// ============================================================================

function rasterizeTriangleBarycentric(
  fb: Framebuffer,
  v0: Vertex, v1: Vertex, v2: Vertex,
  stats: RasterStats
): Fragment[] {
  const fragments: Fragment[] = [];

  // Get screen coordinates
  const p0: Vec2 = { x: v0.position.x, y: v0.position.y };
  const p1: Vec2 = { x: v1.position.x, y: v1.position.y };
  const p2: Vec2 = { x: v2.position.x, y: v2.position.y };

  // Compute bounding box
  const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x, p2.x)));
  const maxX = Math.min(fb.width - 1, Math.ceil(Math.max(p0.x, p1.x, p2.x)));
  const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y, p2.y)));
  const maxY = Math.min(fb.height - 1, Math.ceil(Math.max(p0.y, p1.y, p2.y)));

  stats.boundingBoxArea += (maxX - minX + 1) * (maxY - minY + 1);

  // Check for degenerate triangle
  const area = orient2d(p0, p1, p2);
  if (Math.abs(area) < 1e-6) {
    stats.trianglesCulled++;
    return fragments;
  }

  // Rasterize using barycentric coordinates
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;

      const bary = computeBarycentric({ x: px, y: py }, p0, p1, p2);
      if (!bary || !isInsideTriangle(bary)) continue;

      stats.fragmentsGenerated++;

      // Interpolate depth
      const depth = v0.position.z * bary.x + v1.position.z * bary.y + v2.position.z * bary.z;

      // Perspective-correct interpolation
      const correctedBary = perspectiveCorrectInterpolation(
        bary,
        v0.position.w, v1.position.w, v2.position.w
      );

      // Interpolate color
      const c0 = v0.color || color(255, 255, 255, 255);
      const c1 = v1.color || color(255, 255, 255, 255);
      const c2 = v2.color || color(255, 255, 255, 255);

      const fragColor: Color = {
        r: c0.r * correctedBary.x + c1.r * correctedBary.y + c2.r * correctedBary.z,
        g: c0.g * correctedBary.x + c1.g * correctedBary.y + c2.g * correctedBary.z,
        b: c0.b * correctedBary.x + c1.b * correctedBary.y + c2.b * correctedBary.z,
        a: c0.a * correctedBary.x + c1.a * correctedBary.y + c2.a * correctedBary.z
      };

      // Interpolate texture coordinates
      let texCoord: Vec2 | undefined;
      if (v0.texCoord && v1.texCoord && v2.texCoord) {
        texCoord = {
          x: v0.texCoord.x * correctedBary.x + v1.texCoord.x * correctedBary.y + v2.texCoord.x * correctedBary.z,
          y: v0.texCoord.y * correctedBary.x + v1.texCoord.y * correctedBary.y + v2.texCoord.y * correctedBary.z
        };
      }

      // Interpolate normals
      let normal: Vec3 | undefined;
      if (v0.normal && v1.normal && v2.normal) {
        normal = {
          x: v0.normal.x * correctedBary.x + v1.normal.x * correctedBary.y + v2.normal.x * correctedBary.z,
          y: v0.normal.y * correctedBary.x + v1.normal.y * correctedBary.y + v2.normal.y * correctedBary.z,
          z: v0.normal.z * correctedBary.x + v1.normal.z * correctedBary.y + v2.normal.z * correctedBary.z
        };
      }

      const fragment: Fragment = {
        x, y,
        depth,
        color: clampColor(fragColor),
        texCoord,
        normal,
        barycentric: bary
      };

      fragments.push(fragment);

      // Write to framebuffer
      if (setPixel(fb, x, y, fragment.color, depth)) {
        stats.pixelsCovered++;
      }
    }
  }

  stats.trianglesProcessed++;
  return fragments;
}

// ============================================================================
// SCANLINE RASTERIZATION
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Edge {
  yMin: number;
  yMax: number;
  x: number;
  dx: number;
  z: number;
  dz: number;
  color: Color;
  dColor: Color;
}

function rasterizeTriangleScanline(
  fb: Framebuffer,
  v0: Vertex, v1: Vertex, v2: Vertex,
  stats: RasterStats
): Fragment[] {
  const fragments: Fragment[] = [];

  // Sort vertices by y coordinate
  const vertices = [v0, v1, v2].sort((a, b) => a.position.y - b.position.y);

  const [top, mid, bot] = vertices;
  const yStart = Math.max(0, Math.ceil(top.position.y));
  const yEnd = Math.min(fb.height - 1, Math.floor(bot.position.y));

  const yMid = mid.position.y;

  for (let y = yStart; y <= yEnd; y++) {
    let xLeft: number, xRight: number;
    let zLeft: number, zRight: number;
    let colorLeft: Color, colorRight: Color;

    // Determine which edges we're interpolating between
    const t1 = (y - top.position.y) / (bot.position.y - top.position.y);

    // Long edge (top to bottom)
    const longX = top.position.x + t1 * (bot.position.x - top.position.x);
    const longZ = top.position.z + t1 * (bot.position.z - top.position.z);
    const longColor = lerpColor(
      top.color || color(255, 255, 255, 255),
      bot.color || color(255, 255, 255, 255),
      t1
    );

    // Short edge (depends on which half we're in)
    let shortX: number, shortZ: number, shortColor: Color;

    if (y < yMid) {
      const t2 = (y - top.position.y) / (mid.position.y - top.position.y + 0.001);
      shortX = top.position.x + t2 * (mid.position.x - top.position.x);
      shortZ = top.position.z + t2 * (mid.position.z - top.position.z);
      shortColor = lerpColor(
        top.color || color(255, 255, 255, 255),
        mid.color || color(255, 255, 255, 255),
        t2
      );
    } else {
      const t2 = (y - mid.position.y) / (bot.position.y - mid.position.y + 0.001);
      shortX = mid.position.x + t2 * (bot.position.x - mid.position.x);
      shortZ = mid.position.z + t2 * (bot.position.z - mid.position.z);
      shortColor = lerpColor(
        mid.color || color(255, 255, 255, 255),
        bot.color || color(255, 255, 255, 255),
        t2
      );
    }

    // Determine left/right
    if (longX < shortX) {
      xLeft = longX; xRight = shortX;
      zLeft = longZ; zRight = shortZ;
      colorLeft = longColor; colorRight = shortColor;
    } else {
      xLeft = shortX; xRight = longX;
      zLeft = shortZ; zRight = longZ;
      colorLeft = shortColor; colorRight = longColor;
    }

    // Scan across the span
    const xStart = Math.max(0, Math.ceil(xLeft));
    const xEnd = Math.min(fb.width - 1, Math.floor(xRight));

    for (let x = xStart; x <= xEnd; x++) {
      const t = (x - xLeft) / (xRight - xLeft + 0.001);
      const z = zLeft + t * (zRight - zLeft);
      const fragColor = lerpColor(colorLeft, colorRight, t);

      stats.fragmentsGenerated++;

      const fragment: Fragment = {
        x, y,
        depth: z,
        color: clampColor(fragColor),
        barycentric: { x: 0, y: 0, z: 0 } // Simplified
      };

      fragments.push(fragment);

      if (setPixel(fb, x, y, fragment.color, z)) {
        stats.pixelsCovered++;
      }
    }
  }

  stats.trianglesProcessed++;
  return fragments;
}

// ============================================================================
// CULLING
// ============================================================================

function backfaceCulling(v0: Vertex, v1: Vertex, v2: Vertex): boolean {
  // Calculate signed area (CCW winding = front face)
  const area = (v1.position.x - v0.position.x) * (v2.position.y - v0.position.y) -
               (v2.position.x - v0.position.x) * (v1.position.y - v0.position.y);
  return area > 0; // Return true if front-facing
}

// ============================================================================
// VISUALIZATION
// ============================================================================

function generateColorVisualization(fb: Framebuffer, charWidth: number = 40, charHeight: number = 20): string[] {
  const lines: string[] = [];
  const shades = ' .:-=+*#%@';

  for (let y = 0; y < charHeight; y++) {
    let line = '';
    for (let x = 0; x < charWidth; x++) {
      const srcX = Math.floor((x / charWidth) * fb.width);
      const srcY = Math.floor((y / charHeight) * fb.height);
      const idx = srcY * fb.width + srcX;
      const c = fb.colorBuffer[idx];

      const brightness = (c.r + c.g + c.b) / 3 / 255;
      const charIdx = Math.floor(brightness * (shades.length - 1));
      line += shades[Math.max(0, Math.min(shades.length - 1, charIdx))];
    }
    lines.push(line);
  }

  return lines;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const rasterizerTool: UnifiedTool = {
  name: 'rasterizer',
  description: 'Comprehensive triangle rasterization engine with scanline and barycentric algorithms, perspective-correct interpolation, and attribute interpolation',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['rasterize', 'scanline', 'barycentric', 'compare', 'visualize', 'demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      width: { type: 'number', description: 'Framebuffer width' },
      height: { type: 'number', description: 'Framebuffer height' },
      triangles: { type: 'array', description: 'Triangles to rasterize' },
      backfaceCull: { type: 'boolean', description: 'Enable backface culling' }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executerasterizer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, width = 64, height = 64, triangles, backfaceCull = true } = args;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Triangle Rasterizer',
            description: 'Convert vector triangles to pixel fragments',
            capabilities: [
              'Barycentric coordinate rasterization',
              'Scanline rasterization',
              'Perspective-correct interpolation',
              'Color interpolation (Gouraud shading)',
              'Texture coordinate interpolation',
              'Normal vector interpolation',
              'Backface culling',
              'Depth buffer integration'
            ],
            algorithms: {
              barycentric: 'Test each pixel with edge functions - O(bbox area)',
              scanline: 'Process triangle row by row - optimized for cache',
              edgeWalking: 'Incrementally step along edges'
            },
            concepts: {
              barycentric: 'Weights (w0,w1,w2) where w0+w1+w2=1',
              perspectiveCorrect: 'Divide by w before interpolation',
              subpixelPrecision: 'Fractional pixel positions',
              fillRules: 'Top-left rule prevents double-fill'
            },
            operations: ['rasterize', 'scanline', 'barycentric', 'compare', 'visualize', 'demo', 'examples']
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Rasterize Triangle',
                params: {
                  operation: 'rasterize',
                  width: 100,
                  height: 100,
                  triangles: [{
                    v0: { position: { x: 50, y: 10, z: 0.5, w: 1 }, color: { r: 255, g: 0, b: 0, a: 255 } },
                    v1: { position: { x: 10, y: 90, z: 0.5, w: 1 }, color: { r: 0, g: 255, b: 0, a: 255 } },
                    v2: { position: { x: 90, y: 90, z: 0.5, w: 1 }, color: { r: 0, g: 0, b: 255, a: 255 } }
                  }]
                }
              }
            ]
          }, null, 2)
        };
      }

      case 'rasterize':
      case 'barycentric': {
        const fb = createFramebuffer(width, height);
        const stats: RasterStats = {
          trianglesProcessed: 0,
          trianglesCulled: 0,
          fragmentsGenerated: 0,
          pixelsCovered: 0,
          boundingBoxArea: 0,
          fillRate: 0
        };

        const allFragments: Fragment[] = [];
        const inputTriangles = triangles || [];

        for (const tri of inputTriangles) {
          const v0: Vertex = tri.v0;
          const v1: Vertex = tri.v1;
          const v2: Vertex = tri.v2;

          if (backfaceCull && !backfaceCulling(v0, v1, v2)) {
            stats.trianglesCulled++;
            continue;
          }

          const frags = rasterizeTriangleBarycentric(fb, v0, v1, v2, stats);
          allFragments.push(...frags);
        }

        stats.fillRate = stats.boundingBoxArea > 0
          ? stats.pixelsCovered / stats.boundingBoxArea
          : 0;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'barycentric',
            algorithm: 'Edge-function barycentric rasterization',
            framebuffer: { width, height },
            stats: {
              ...stats,
              fillRate: `${(stats.fillRate * 100).toFixed(1)}%`
            },
            visualization: generateColorVisualization(fb, 40, 20)
          }, null, 2)
        };
      }

      case 'scanline': {
        const fb = createFramebuffer(width, height);
        const stats: RasterStats = {
          trianglesProcessed: 0,
          trianglesCulled: 0,
          fragmentsGenerated: 0,
          pixelsCovered: 0,
          boundingBoxArea: 0,
          fillRate: 0
        };

        const inputTriangles = triangles || [];

        for (const tri of inputTriangles) {
          const v0: Vertex = tri.v0;
          const v1: Vertex = tri.v1;
          const v2: Vertex = tri.v2;

          if (backfaceCull && !backfaceCulling(v0, v1, v2)) {
            stats.trianglesCulled++;
            continue;
          }

          rasterizeTriangleScanline(fb, v0, v1, v2, stats);
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'scanline',
            algorithm: 'Scanline rasterization with edge interpolation',
            framebuffer: { width, height },
            stats,
            visualization: generateColorVisualization(fb, 40, 20)
          }, null, 2)
        };
      }

      case 'compare': {
        const fb1 = createFramebuffer(width, height);
        const fb2 = createFramebuffer(width, height);

        // Create test triangle
        const testTriangle = {
          v0: { position: vec4(width/2, 5, 0.5, 1), color: color(255, 0, 0, 255) },
          v1: { position: vec4(5, height-5, 0.5, 1), color: color(0, 255, 0, 255) },
          v2: { position: vec4(width-5, height-5, 0.5, 1), color: color(0, 0, 255, 255) }
        };

        const stats1: RasterStats = {
          trianglesProcessed: 0, trianglesCulled: 0, fragmentsGenerated: 0,
          pixelsCovered: 0, boundingBoxArea: 0, fillRate: 0
        };

        const stats2: RasterStats = {
          trianglesProcessed: 0, trianglesCulled: 0, fragmentsGenerated: 0,
          pixelsCovered: 0, boundingBoxArea: 0, fillRate: 0
        };

        rasterizeTriangleBarycentric(fb1, testTriangle.v0, testTriangle.v1, testTriangle.v2, stats1);
        rasterizeTriangleScanline(fb2, testTriangle.v0, testTriangle.v1, testTriangle.v2, stats2);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare',
            title: 'Barycentric vs Scanline Rasterization',
            barycentric: {
              stats: stats1,
              visualization: generateColorVisualization(fb1, 30, 15)
            },
            scanline: {
              stats: stats2,
              visualization: generateColorVisualization(fb2, 30, 15)
            },
            comparison: {
              barycentric: [
                'Tests every pixel in bounding box',
                'Naturally handles any triangle shape',
                'Easy perspective-correct interpolation',
                'Good for parallel execution (GPU)'
              ],
              scanline: [
                'Processes row by row',
                'Better cache coherence',
                'Traditional CPU-friendly approach',
                'Edge-stepping optimization possible'
              ]
            }
          }, null, 2)
        };
      }

      case 'visualize': {
        const fb = createFramebuffer(width, height);

        // Create gradient triangle
        const tri = {
          v0: { position: vec4(width/2, 5, 0.5, 1), color: color(255, 0, 0, 255) },
          v1: { position: vec4(5, height-5, 0.5, 1), color: color(0, 255, 0, 255) },
          v2: { position: vec4(width-5, height-5, 0.5, 1), color: color(0, 0, 255, 255) }
        };

        const stats: RasterStats = {
          trianglesProcessed: 0, trianglesCulled: 0, fragmentsGenerated: 0,
          pixelsCovered: 0, boundingBoxArea: 0, fillRate: 0
        };

        rasterizeTriangleBarycentric(fb, tri.v0, tri.v1, tri.v2, stats);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'visualize',
            description: 'RGB gradient triangle with Gouraud shading',
            framebuffer: { width, height },
            stats,
            visualization: generateColorVisualization(fb, 50, 25)
          }, null, 2)
        };
      }

      case 'demo': {
        const fb = createFramebuffer(64, 64);

        const demoTriangles = [
          {
            v0: { position: vec4(32, 5, 0.3, 1), color: color(255, 100, 100, 255) },
            v1: { position: vec4(5, 50, 0.3, 1), color: color(255, 100, 100, 255) },
            v2: { position: vec4(45, 50, 0.3, 1), color: color(255, 100, 100, 255) }
          },
          {
            v0: { position: vec4(40, 10, 0.5, 1), color: color(100, 255, 100, 255) },
            v1: { position: vec4(20, 55, 0.5, 1), color: color(100, 255, 100, 255) },
            v2: { position: vec4(60, 55, 0.5, 1), color: color(100, 255, 100, 255) }
          }
        ];

        const stats: RasterStats = {
          trianglesProcessed: 0, trianglesCulled: 0, fragmentsGenerated: 0,
          pixelsCovered: 0, boundingBoxArea: 0, fillRate: 0
        };

        for (const tri of demoTriangles) {
          rasterizeTriangleBarycentric(fb, tri.v0, tri.v1, tri.v2, stats);
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            title: 'Triangle Rasterization Demo',
            description: 'Two overlapping triangles with depth testing',
            framebuffer: { width: 64, height: 64 },
            triangles: demoTriangles.length,
            stats,
            visualization: generateColorVisualization(fb, 40, 20),
            concepts: [
              'Rasterization converts triangles to pixels',
              'Barycentric coordinates determine inside/outside',
              'Attributes are interpolated across the surface',
              'Depth buffer resolves overlapping geometry',
              'Foundation of all GPU rendering'
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

export function israsterizerAvailable(): boolean {
  return true;
}
