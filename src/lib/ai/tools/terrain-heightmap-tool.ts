/**
 * TERRAIN HEIGHTMAP TOOL
 * Generate and manipulate terrain heightmaps using various algorithms
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

type Heightmap = number[][];

function createHeightmap(width: number, height: number, fill: number = 0): Heightmap {
  return Array(height).fill(null).map(() => Array(width).fill(fill));
}

// Diamond-Square algorithm
function diamondSquare(size: number, roughness: number = 0.5): Heightmap {
  const n = Math.pow(2, Math.ceil(Math.log2(size - 1))) + 1;
  const map = createHeightmap(n, n);

  // Initialize corners
  map[0][0] = Math.random();
  map[0][n - 1] = Math.random();
  map[n - 1][0] = Math.random();
  map[n - 1][n - 1] = Math.random();

  let step = n - 1;
  let scale = roughness;

  while (step > 1) {
    const half = step / 2;

    // Diamond step
    for (let y = half; y < n; y += step) {
      for (let x = half; x < n; x += step) {
        const avg = (map[y - half][x - half] + map[y - half][x + half] +
                    map[y + half][x - half] + map[y + half][x + half]) / 4;
        map[y][x] = avg + (Math.random() - 0.5) * scale;
      }
    }

    // Square step
    for (let y = 0; y < n; y += half) {
      for (let x = (y + half) % step; x < n; x += step) {
        let count = 0;
        let sum = 0;
        if (y >= half) { sum += map[y - half][x]; count++; }
        if (y + half < n) { sum += map[y + half][x]; count++; }
        if (x >= half) { sum += map[y][x - half]; count++; }
        if (x + half < n) { sum += map[y][x + half]; count++; }
        map[y][x] = sum / count + (Math.random() - 0.5) * scale;
      }
    }

    step = half;
    scale *= roughness;
  }

  // Normalize
  let min = Infinity, max = -Infinity;
  for (const row of map) {
    for (const val of row) {
      min = Math.min(min, val);
      max = Math.max(max, val);
    }
  }

  const range = max - min || 1;
  return map.map(row => row.map(v => (v - min) / range));
}

// Fault formation
function faultFormation(width: number, height: number, iterations: number = 100): Heightmap {
  const map = createHeightmap(width, height);

  for (let i = 0; i < iterations; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const angle = Math.random() * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const displacement = (1 - i / iterations) * 0.1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const side = (x - x1) * dy - (y - y1) * dx;
        map[y][x] += side > 0 ? displacement : -displacement;
      }
    }
  }

  // Normalize
  let min = Infinity, max = -Infinity;
  for (const row of map) {
    for (const val of row) {
      min = Math.min(min, val);
      max = Math.max(max, val);
    }
  }

  const range = max - min || 1;
  return map.map(row => row.map(v => (v - min) / range));
}

// Midpoint displacement
function midpointDisplacement(size: number, roughness: number = 0.5): Heightmap {
  const n = Math.pow(2, Math.ceil(Math.log2(size - 1))) + 1;
  const map = createHeightmap(n, n);

  map[0][0] = Math.random();
  map[0][n - 1] = Math.random();
  map[n - 1][0] = Math.random();
  map[n - 1][n - 1] = Math.random();

  let step = n - 1;
  let scale = roughness;

  while (step > 1) {
    const half = step / 2;

    // Midpoint
    for (let y = 0; y < n - 1; y += step) {
      for (let x = 0; x < n - 1; x += step) {
        const avg = (map[y][x] + map[y][x + step] + map[y + step][x] + map[y + step][x + step]) / 4;
        map[y + half][x + half] = avg + (Math.random() - 0.5) * scale;
      }
    }

    // Edges
    for (let y = 0; y < n; y += half) {
      for (let x = (y + half) % step; x < n; x += step) {
        let sum = 0, count = 0;
        if (x - half >= 0) { sum += map[y][x - half]; count++; }
        if (x + half < n) { sum += map[y][x + half]; count++; }
        if (y - half >= 0) { sum += map[y - half][x]; count++; }
        if (y + half < n) { sum += map[y + half][x]; count++; }
        map[y][x] = sum / count + (Math.random() - 0.5) * scale;
      }
    }

    step = half;
    scale *= roughness;
  }

  let min = Infinity, max = -Infinity;
  for (const row of map) {
    for (const val of row) {
      min = Math.min(min, val);
      max = Math.max(max, val);
    }
  }

  const range = max - min || 1;
  return map.map(row => row.map(v => (v - min) / range));
}

// Thermal erosion
function thermalErosion(map: Heightmap, iterations: number = 50, talusAngle: number = 0.1): Heightmap {
  const result = map.map(row => [...row]);
  const height = result.length;
  const width = result[0].length;

  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const h = result[y][x];
        let maxDiff = 0;
        let nx = x, ny = y;

        // Find steepest neighbor
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const diff = h - result[y + dy][x + dx];
            if (diff > maxDiff) {
              maxDiff = diff;
              nx = x + dx;
              ny = y + dy;
            }
          }
        }

        // Move material if above talus angle
        if (maxDiff > talusAngle) {
          const amount = (maxDiff - talusAngle) * 0.5;
          result[y][x] -= amount;
          result[ny][nx] += amount;
        }
      }
    }
  }

  return result;
}

// Hydraulic erosion (simplified)
function hydraulicErosion(map: Heightmap, iterations: number = 100): Heightmap {
  const result = map.map(row => [...row]);
  const height = result.length;
  const width = result[0].length;
  const water = createHeightmap(width, height);
  const sediment = createHeightmap(width, height);

  for (let iter = 0; iter < iterations; iter++) {
    // Rain
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        water[y][x] += 0.01;
      }
    }

    // Erosion and flow
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const totalHeight = result[y][x] + water[y][x];

        // Find lowest neighbor
        let minHeight = totalHeight;
        let nx = x, ny = y;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nh = result[y + dy][x + dx] + water[y + dy][x + dx];
            if (nh < minHeight) {
              minHeight = nh;
              nx = x + dx;
              ny = y + dy;
            }
          }
        }

        if (nx !== x || ny !== y) {
          const diff = totalHeight - minHeight;
          const flow = Math.min(water[y][x], diff * 0.5);
          water[y][x] -= flow;
          water[ny][nx] += flow;

          // Erosion
          const erosion = flow * 0.1;
          result[y][x] -= erosion;
          sediment[ny][nx] += erosion;
        }
      }
    }

    // Evaporation and deposition
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        water[y][x] *= 0.9;
        result[y][x] += sediment[y][x] * 0.1;
        sediment[y][x] *= 0.9;
      }
    }
  }

  return result;
}

function heightmapToAscii(map: Heightmap): string {
  const chars = ' .:-=+*#%@';
  return map.map(row =>
    row.map(v => chars[Math.min(chars.length - 1, Math.floor(v * chars.length))]).join('')
  ).join('\n');
}

function analyzeHeightmap(map: Heightmap): Record<string, unknown> {
  let min = Infinity, max = -Infinity, sum = 0;
  let peaks = 0, valleys = 0;

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      const v = map[y][x];
      min = Math.min(min, v);
      max = Math.max(max, v);
      sum += v;

      // Check for local extrema
      if (y > 0 && y < map.length - 1 && x > 0 && x < map[0].length - 1) {
        let isPeak = true, isValley = true;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (map[y + dy][x + dx] >= v) isPeak = false;
            if (map[y + dy][x + dx] <= v) isValley = false;
          }
        }
        if (isPeak) peaks++;
        if (isValley) valleys++;
      }
    }
  }

  const count = map.length * map[0].length;
  return {
    dimensions: { width: map[0].length, height: map.length },
    statistics: {
      min: min.toFixed(4),
      max: max.toFixed(4),
      mean: (sum / count).toFixed(4),
      range: (max - min).toFixed(4)
    },
    features: { peaks, valleys },
    totalCells: count
  };
}

export const terrainHeightmapTool: UnifiedTool = {
  name: 'terrain_heightmap',
  description: 'Terrain Heightmap: diamond_square, fault, midpoint, thermal_erosion, hydraulic_erosion, ascii, analyze',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['diamond_square', 'fault', 'midpoint', 'thermal_erosion', 'hydraulic_erosion', 'ascii', 'analyze'] },
      size: { type: 'number' },
      width: { type: 'number' },
      height: { type: 'number' },
      roughness: { type: 'number' },
      iterations: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeTerrainHeightmap(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    const size = args.size || 33;
    const w = args.width || 50;
    const h = args.height || 30;
    const roughness = args.roughness || 0.5;
    const iterations = args.iterations || 100;

    switch (args.operation) {
      case 'diamond_square':
        const dsMap = diamondSquare(size, roughness);
        result = { algorithm: 'Diamond-Square', ascii: heightmapToAscii(dsMap), analysis: analyzeHeightmap(dsMap) };
        break;
      case 'fault':
        const faultMap = faultFormation(w, h, iterations);
        result = { algorithm: 'Fault Formation', ascii: heightmapToAscii(faultMap), analysis: analyzeHeightmap(faultMap) };
        break;
      case 'midpoint':
        const mpMap = midpointDisplacement(size, roughness);
        result = { algorithm: 'Midpoint Displacement', ascii: heightmapToAscii(mpMap), analysis: analyzeHeightmap(mpMap) };
        break;
      case 'thermal_erosion':
        const baseMap = diamondSquare(size, roughness);
        const erodedMap = thermalErosion(baseMap, iterations);
        result = {
          algorithm: 'Thermal Erosion',
          before: heightmapToAscii(baseMap),
          after: heightmapToAscii(erodedMap),
          analysis: analyzeHeightmap(erodedMap)
        };
        break;
      case 'hydraulic_erosion':
        const hBaseMap = diamondSquare(size, roughness);
        const hErodedMap = hydraulicErosion(hBaseMap, iterations);
        result = {
          algorithm: 'Hydraulic Erosion',
          before: heightmapToAscii(hBaseMap),
          after: heightmapToAscii(hErodedMap),
          analysis: analyzeHeightmap(hErodedMap)
        };
        break;
      case 'ascii':
        const asciiMap = diamondSquare(size, roughness);
        result = { ascii: heightmapToAscii(asciiMap) };
        break;
      case 'analyze':
        const analyzeMap = diamondSquare(size, roughness);
        result = analyzeHeightmap(analyzeMap);
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isTerrainHeightmapAvailable(): boolean { return true; }
