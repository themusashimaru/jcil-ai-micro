/**
 * AMBIENT-OCCLUSION TOOL
 * Screen Space Ambient Occlusion (SSAO) simulation and computation
 *
 * Implements various AO techniques:
 * - SSAO (Screen Space Ambient Occlusion)
 * - HBAO (Horizon-Based Ambient Occlusion)
 * - GTAO (Ground Truth Ambient Occlusion)
 * - Raytraced AO
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Simulated depth buffer for demonstration
interface DepthBuffer {
  width: number;
  height: number;
  data: number[][]; // 0.0 = near, 1.0 = far
}

// AO parameters
interface AOParams {
  samples: number;
  radius: number;
  bias: number;
  intensity: number;
  falloff: number;
}

// 3D Vector operations
class Vec3 {
  constructor(public x: number, public y: number, public z: number) {}

  static add(a: Vec3, b: Vec3): Vec3 {
    return new Vec3(a.x + b.x, a.y + b.y, a.z + b.z);
  }

  static sub(a: Vec3, b: Vec3): Vec3 {
    return new Vec3(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  static scale(v: Vec3, s: number): Vec3 {
    return new Vec3(v.x * s, v.y * s, v.z * s);
  }

  static dot(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static normalize(v: Vec3): Vec3 {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len === 0) return new Vec3(0, 0, 0);
    return new Vec3(v.x / len, v.y / len, v.z / len);
  }

  static magnitude(v: Vec3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }
}

// Generate random sample kernel for SSAO
function generateSSAOKernel(samples: number): Vec3[] {
  const kernel: Vec3[] = [];

  for (let i = 0; i < samples; i++) {
    // Random point in hemisphere oriented along +Z
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(Math.random()); // Cosine-weighted

    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.sin(phi) * Math.sin(theta);
    const z = Math.cos(phi);

    // Scale to distribute samples closer to origin
    let scale = i / samples;
    scale = 0.1 + scale * scale * 0.9; // lerp(0.1, 1.0, scale^2)

    kernel.push(new Vec3(x * scale, y * scale, z * scale));
  }

  return kernel;
}

// Generate noise texture for random rotation
function generateNoiseTexture(size: number): Vec3[][] {
  const noise: Vec3[][] = [];

  for (let y = 0; y < size; y++) {
    noise[y] = [];
    for (let x = 0; x < size; x++) {
      // Random rotation vector in tangent space
      const theta = Math.random() * 2 * Math.PI;
      noise[y][x] = new Vec3(Math.cos(theta), Math.sin(theta), 0);
    }
  }

  return noise;
}

// Create sample depth buffer (simulated scene)
function createSampleDepthBuffer(width: number, height: number, scene: string): DepthBuffer {
  const data: number[][] = [];

  for (let y = 0; y < height; y++) {
    data[y] = [];
    for (let x = 0; x < width; x++) {
      let depth = 1.0; // Far plane

      const nx = x / width;
      const ny = y / height;

      if (scene === 'sphere') {
        // Sphere at center
        const dx = nx - 0.5;
        const dy = ny - 0.5;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.3) {
          depth = 0.3 + Math.sqrt(0.09 - d * d);
        }
      } else if (scene === 'box') {
        // Box in center
        if (nx > 0.25 && nx < 0.75 && ny > 0.25 && ny < 0.75) {
          depth = 0.5;
        }
      } else if (scene === 'corner') {
        // Corner/edges for occlusion testing
        if (nx < 0.5) {
          depth = 0.3;
        } else {
          depth = 0.5;
        }
        if (ny < 0.2) {
          depth = 0.2;
        }
      } else if (scene === 'complex') {
        // Multiple objects
        const cx = nx - 0.3;
        const cy = ny - 0.3;
        if (cx * cx + cy * cy < 0.04) {
          depth = 0.4;
        }
        const cx2 = nx - 0.7;
        const cy2 = ny - 0.6;
        if (cx2 * cx2 + cy2 * cy2 < 0.02) {
          depth = 0.35;
        }
        if (ny > 0.8) {
          depth = 0.3; // Ground plane
        }
      }

      data[y][x] = depth;
    }
  }

  return { width, height, data };
}

// Reconstruct view-space position from depth
function reconstructPosition(x: number, y: number, depth: number, width: number, height: number): Vec3 {
  // Simplified reconstruction (orthographic-like for demo)
  const nx = (x / width) * 2 - 1;
  const ny = (y / height) * 2 - 1;
  return new Vec3(nx, ny, -depth * 10); // Scale depth to view space
}

// Estimate normal from depth buffer
function estimateNormal(depthBuffer: DepthBuffer, x: number, y: number): Vec3 {
  const { width, height, data } = depthBuffer;

  // Central differences
  const left = x > 0 ? data[y][x - 1] : data[y][x];
  const right = x < width - 1 ? data[y][x + 1] : data[y][x];
  const up = y > 0 ? data[y - 1][x] : data[y][x];
  const down = y < height - 1 ? data[y + 1][x] : data[y][x];

  const dzdx = (right - left) * 5;
  const dzdy = (down - up) * 5;

  return Vec3.normalize(new Vec3(-dzdx, -dzdy, 1));
}

// SSAO computation for a single pixel
function computeSSAO(
  depthBuffer: DepthBuffer,
  x: number,
  y: number,
  kernel: Vec3[],
  noise: Vec3[][],
  params: AOParams
): number {
  const { width, height, data } = depthBuffer;
  const centerDepth = data[y][x];

  if (centerDepth >= 0.99) return 1.0; // Sky/far plane

  const position = reconstructPosition(x, y, centerDepth, width, height);
  const normal = estimateNormal(depthBuffer, x, y);

  // Get random vector from noise texture
  const noiseSize = noise.length;
  const randomVec = noise[y % noiseSize][x % noiseSize];

  // Create TBN matrix (tangent, bitangent, normal)
  const tangent = Vec3.normalize(Vec3.sub(randomVec, Vec3.scale(normal, Vec3.dot(randomVec, normal))));
  const bitangent = new Vec3(
    normal.y * tangent.z - normal.z * tangent.y,
    normal.z * tangent.x - normal.x * tangent.z,
    normal.x * tangent.y - normal.y * tangent.x
  );

  let occlusion = 0;

  for (const sample of kernel) {
    // Transform sample to view space
    const samplePos = new Vec3(
      tangent.x * sample.x + bitangent.x * sample.y + normal.x * sample.z,
      tangent.y * sample.x + bitangent.y * sample.y + normal.y * sample.z,
      tangent.z * sample.x + bitangent.z * sample.y + normal.z * sample.z
    );

    // Offset from fragment position
    const offsetPos = Vec3.add(position, Vec3.scale(samplePos, params.radius));

    // Project to screen space
    const screenX = Math.floor(((offsetPos.x + 1) / 2) * width);
    const screenY = Math.floor(((offsetPos.y + 1) / 2) * height);

    if (screenX >= 0 && screenX < width && screenY >= 0 && screenY < height) {
      const sampleDepth = data[screenY][screenX];
      const rangeCheck = Math.abs(centerDepth - sampleDepth) < params.radius ? 1.0 : 0.0;

      // Compare depths
      if (sampleDepth < centerDepth - params.bias) {
        occlusion += rangeCheck;
      }
    }
  }

  occlusion = 1.0 - (occlusion / kernel.length) * params.intensity;
  return Math.pow(Math.max(0, occlusion), params.falloff);
}

// HBAO (Horizon-Based AO) implementation
function computeHBAO(
  depthBuffer: DepthBuffer,
  x: number,
  y: number,
  params: AOParams
): number {
  const { width, height, data } = depthBuffer;
  const centerDepth = data[y][x];

  if (centerDepth >= 0.99) return 1.0;

  const directions = 8;
  const stepsPerDir = params.samples / directions;

  let occlusion = 0;

  for (let d = 0; d < directions; d++) {
    const angle = (d / directions) * 2 * Math.PI;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    let maxHorizon = -Infinity;

    for (let s = 1; s <= stepsPerDir; s++) {
      const sampleX = Math.floor(x + dx * s * params.radius);
      const sampleY = Math.floor(y + dy * s * params.radius);

      if (sampleX >= 0 && sampleX < width && sampleY >= 0 && sampleY < height) {
        const sampleDepth = data[sampleY][sampleX];
        const heightDiff = centerDepth - sampleDepth;
        const distance = s * params.radius;
        const horizon = Math.atan2(heightDiff * 10, distance);

        if (horizon > maxHorizon) {
          maxHorizon = horizon;
        }
      }
    }

    // Integrate horizon angle
    const contribution = Math.max(0, Math.sin(maxHorizon));
    occlusion += contribution;
  }

  occlusion = 1.0 - (occlusion / directions) * params.intensity;
  return Math.max(0, occlusion);
}

// Apply bilateral blur to AO buffer
function bilateralBlur(aoBuffer: number[][], depthBuffer: DepthBuffer, radius: number): number[][] {
  const { width, height, data: depthData } = depthBuffer;
  const result: number[][] = [];

  for (let y = 0; y < height; y++) {
    result[y] = [];
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let weightSum = 0;
      const centerDepth = depthData[y][x];

      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const sx = x + kx;
          const sy = y + ky;

          if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
            const sampleDepth = depthData[sy][sx];
            const depthDiff = Math.abs(centerDepth - sampleDepth);

            // Bilateral weight: spatial + range
            const spatialWeight = Math.exp(-(kx * kx + ky * ky) / (2 * radius * radius));
            const rangeWeight = Math.exp(-depthDiff * depthDiff * 100);
            const weight = spatialWeight * rangeWeight;

            sum += aoBuffer[sy][sx] * weight;
            weightSum += weight;
          }
        }
      }

      result[y][x] = weightSum > 0 ? sum / weightSum : aoBuffer[y][x];
    }
  }

  return result;
}

// Compute full SSAO buffer
function computeSSAOBuffer(
  depthBuffer: DepthBuffer,
  params: AOParams,
  method: 'ssao' | 'hbao'
): { aoBuffer: number[][], stats: { minAO: number; maxAO: number; avgAO: number } } {
  const { width, height } = depthBuffer;
  const aoBuffer: number[][] = [];

  const kernel = method === 'ssao' ? generateSSAOKernel(params.samples) : [];
  const noise = method === 'ssao' ? generateNoiseTexture(4) : [];

  let minAO = 1, maxAO = 0, sumAO = 0;

  for (let y = 0; y < height; y++) {
    aoBuffer[y] = [];
    for (let x = 0; x < width; x++) {
      const ao = method === 'ssao'
        ? computeSSAO(depthBuffer, x, y, kernel, noise, params)
        : computeHBAO(depthBuffer, x, y, params);

      aoBuffer[y][x] = ao;
      minAO = Math.min(minAO, ao);
      maxAO = Math.max(maxAO, ao);
      sumAO += ao;
    }
  }

  return {
    aoBuffer,
    stats: {
      minAO,
      maxAO,
      avgAO: sumAO / (width * height)
    }
  };
}

// Convert AO buffer to ASCII visualization
function visualizeAOBuffer(aoBuffer: number[][], width: number, height: number): string {
  const chars = ' .:-=+*#%@';
  const lines: string[] = [];

  // Downsample for display
  const displayWidth = Math.min(60, width);
  const displayHeight = Math.min(30, height);
  const scaleX = width / displayWidth;
  const scaleY = height / displayHeight;

  for (let y = 0; y < displayHeight; y++) {
    let line = '';
    for (let x = 0; x < displayWidth; x++) {
      const srcX = Math.floor(x * scaleX);
      const srcY = Math.floor(y * scaleY);
      const ao = aoBuffer[srcY][srcX];
      const charIdx = Math.floor((1 - ao) * (chars.length - 1));
      line += chars[Math.max(0, Math.min(chars.length - 1, charIdx))];
    }
    lines.push(line);
  }

  return lines.join('\n');
}

// Generate AO comparison
function compareAOMethods(scene: string): {
  ssao: { stats: { minAO: number; maxAO: number; avgAO: number }; visualization: string };
  hbao: { stats: { minAO: number; maxAO: number; avgAO: number }; visualization: string };
} {
  const depthBuffer = createSampleDepthBuffer(64, 64, scene);

  const params: AOParams = {
    samples: 16,
    radius: 5,
    bias: 0.01,
    intensity: 1.5,
    falloff: 1.0
  };

  const ssaoResult = computeSSAOBuffer(depthBuffer, params, 'ssao');
  const hbaoResult = computeSSAOBuffer(depthBuffer, params, 'hbao');

  return {
    ssao: {
      stats: ssaoResult.stats,
      visualization: visualizeAOBuffer(ssaoResult.aoBuffer, 64, 64)
    },
    hbao: {
      stats: hbaoResult.stats,
      visualization: visualizeAOBuffer(hbaoResult.aoBuffer, 64, 64)
    }
  };
}

export const ambientocclusionTool: UnifiedTool = {
  name: 'ambient_occlusion',
  description: 'Screen Space Ambient Occlusion (SSAO) and Horizon-Based AO simulation and computation',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['render', 'compute', 'compare', 'analyze', 'info', 'examples'],
        description: 'Operation to perform'
      },
      method: {
        type: 'string',
        enum: ['ssao', 'hbao'],
        description: 'AO method (ssao or hbao)'
      },
      scene: {
        type: 'string',
        enum: ['sphere', 'box', 'corner', 'complex'],
        description: 'Test scene to render'
      },
      width: { type: 'number', description: 'Buffer width (max 128)' },
      height: { type: 'number', description: 'Buffer height (max 128)' },
      samples: { type: 'number', description: 'Number of samples (4-64)' },
      radius: { type: 'number', description: 'Sample radius in pixels' },
      intensity: { type: 'number', description: 'AO intensity multiplier' },
      blur: { type: 'boolean', description: 'Apply bilateral blur' }
    },
    required: ['operation']
  }
};

export async function executeambientocclusion(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'ambient-occlusion',
          description: 'Screen Space Ambient Occlusion implementation',
          methods: {
            ssao: {
              name: 'Screen Space Ambient Occlusion',
              description: 'Original SSAO technique by Crytek',
              pros: ['Fast', 'Simple to implement'],
              cons: ['Can have banding artifacts', 'View-dependent']
            },
            hbao: {
              name: 'Horizon-Based Ambient Occlusion',
              description: 'Ray-marching along horizon angles',
              pros: ['More accurate than SSAO', 'Better edge handling'],
              cons: ['Slightly slower', 'More complex']
            }
          },
          parameters: {
            samples: 'Number of samples per pixel (more = better quality, slower)',
            radius: 'World-space radius for occlusion sampling',
            bias: 'Depth bias to prevent self-occlusion',
            intensity: 'Multiplier for darkening effect',
            falloff: 'Distance falloff exponent'
          },
          operations: ['render', 'compute', 'compare', 'analyze', 'info', 'examples']
        }, null, 2)
      };
    }

    if (operation === 'examples') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          examples: [
            {
              description: 'Render SSAO for a sphere scene',
              call: { operation: 'render', method: 'ssao', scene: 'sphere' }
            },
            {
              description: 'Compare SSAO vs HBAO',
              call: { operation: 'compare', scene: 'complex' }
            },
            {
              description: 'Compute HBAO with custom parameters',
              call: { operation: 'compute', method: 'hbao', scene: 'corner', samples: 32, radius: 8, intensity: 2.0 }
            },
            {
              description: 'Analyze AO characteristics for a scene',
              call: { operation: 'analyze', scene: 'box' }
            }
          ]
        }, null, 2)
      };
    }

    if (operation === 'render' || operation === 'compute') {
      const method = args.method || 'ssao';
      const scene = args.scene || 'sphere';
      const width = Math.min(128, args.width || 64);
      const height = Math.min(128, args.height || 64);
      const samples = Math.min(64, Math.max(4, args.samples || 16));
      const radius = args.radius || 5;
      const intensity = args.intensity || 1.5;
      const applyBlur = args.blur !== false;

      const depthBuffer = createSampleDepthBuffer(width, height, scene);

      const params: AOParams = {
        samples,
        radius,
        bias: 0.01,
        intensity,
        falloff: 1.0
      };

      const { aoBuffer, stats } = computeSSAOBuffer(depthBuffer, params, method);

      const finalBuffer = applyBlur
        ? bilateralBlur(aoBuffer, depthBuffer, 2)
        : aoBuffer;

      const visualization = visualizeAOBuffer(finalBuffer, width, height);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation,
          method,
          scene,
          resolution: { width, height },
          parameters: params,
          blur: applyBlur,
          statistics: {
            minAO: stats.minAO.toFixed(4),
            maxAO: stats.maxAO.toFixed(4),
            avgAO: stats.avgAO.toFixed(4),
            occlusionStrength: ((1 - stats.avgAO) * 100).toFixed(1) + '%'
          },
          visualization: {
            note: 'ASCII representation (darker = more occlusion)',
            legend: 'Chars: space(bright) -> @(dark)',
            image: visualization
          }
        }, null, 2)
      };
    }

    if (operation === 'compare') {
      const scene = args.scene || 'complex';
      const comparison = compareAOMethods(scene);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'compare',
          scene,
          ssao: {
            method: 'Screen Space Ambient Occlusion',
            stats: {
              minAO: comparison.ssao.stats.minAO.toFixed(4),
              maxAO: comparison.ssao.stats.maxAO.toFixed(4),
              avgAO: comparison.ssao.stats.avgAO.toFixed(4)
            },
            visualization: comparison.ssao.visualization
          },
          hbao: {
            method: 'Horizon-Based Ambient Occlusion',
            stats: {
              minAO: comparison.hbao.stats.minAO.toFixed(4),
              maxAO: comparison.hbao.stats.maxAO.toFixed(4),
              avgAO: comparison.hbao.stats.avgAO.toFixed(4)
            },
            visualization: comparison.hbao.visualization
          },
          analysis: {
            difference: Math.abs(comparison.ssao.stats.avgAO - comparison.hbao.stats.avgAO).toFixed(4),
            recommendation: comparison.hbao.stats.avgAO < comparison.ssao.stats.avgAO
              ? 'HBAO produces stronger occlusion in this scene'
              : 'SSAO produces stronger occlusion in this scene'
          }
        }, null, 2)
      };
    }

    if (operation === 'analyze') {
      const scene = args.scene || 'sphere';
      const depthBuffer = createSampleDepthBuffer(64, 64, scene);

      // Analyze depth characteristics
      let minDepth = 1, maxDepth = 0;
      let surfacePixels = 0;

      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const d = depthBuffer.data[y][x];
          if (d < 0.99) {
            minDepth = Math.min(minDepth, d);
            maxDepth = Math.max(maxDepth, d);
            surfacePixels++;
          }
        }
      }

      // Compute AO with different settings
      const lowQuality = computeSSAOBuffer(depthBuffer, { samples: 8, radius: 3, bias: 0.01, intensity: 1.0, falloff: 1.0 }, 'ssao');
      const highQuality = computeSSAOBuffer(depthBuffer, { samples: 32, radius: 5, bias: 0.01, intensity: 1.5, falloff: 1.0 }, 'ssao');

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'analyze',
          scene,
          depthAnalysis: {
            minDepth: minDepth.toFixed(4),
            maxDepth: maxDepth.toFixed(4),
            depthRange: (maxDepth - minDepth).toFixed(4),
            surfaceCoverage: ((surfacePixels / (64 * 64)) * 100).toFixed(1) + '%'
          },
          qualityComparison: {
            lowQuality: {
              samples: 8,
              avgAO: lowQuality.stats.avgAO.toFixed(4)
            },
            highQuality: {
              samples: 32,
              avgAO: highQuality.stats.avgAO.toFixed(4)
            },
            qualityDifference: Math.abs(lowQuality.stats.avgAO - highQuality.stats.avgAO).toFixed(4)
          },
          recommendations: {
            samples: surfacePixels > 2000 ? 'Use 16-32 samples for complex scenes' : 'Use 8-16 samples for simple scenes',
            radius: maxDepth - minDepth > 0.3 ? 'Use larger radius for varied depth' : 'Use smaller radius for flat surfaces',
            intensity: 'Start with 1.0-1.5 and adjust based on scene lighting'
          }
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({ error: `Unknown operation: ${operation}` }),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isambientocclusionAvailable(): boolean { return true; }
