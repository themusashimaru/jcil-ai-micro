/**
 * BIOME GENERATOR TOOL
 * Generate biome maps based on temperature, moisture, elevation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface BiomeConfig {
  name: string;
  color: string;
  char: string;
  temperature: { min: number; max: number };
  moisture: { min: number; max: number };
  elevation?: { min: number; max: number };
}

const BIOMES: BiomeConfig[] = [
  { name: 'Ocean', color: '#0077be', char: '~', temperature: { min: -1, max: 2 }, moisture: { min: -1, max: 2 }, elevation: { min: 0, max: 0.3 } },
  { name: 'Beach', color: '#edc9af', char: '.', temperature: { min: -1, max: 2 }, moisture: { min: -1, max: 2 }, elevation: { min: 0.3, max: 0.35 } },
  { name: 'Tundra', color: '#b4c7d6', char: '*', temperature: { min: 0, max: 0.2 }, moisture: { min: 0, max: 1 } },
  { name: 'Snow', color: '#ffffff', char: 's', temperature: { min: 0, max: 0.15 }, moisture: { min: 0.5, max: 1 } },
  { name: 'Taiga', color: '#2d4739', char: 't', temperature: { min: 0.15, max: 0.35 }, moisture: { min: 0.4, max: 0.8 } },
  { name: 'Grassland', color: '#7cba49', char: '"', temperature: { min: 0.35, max: 0.7 }, moisture: { min: 0.2, max: 0.5 } },
  { name: 'Temperate Forest', color: '#1e8449', char: 'T', temperature: { min: 0.35, max: 0.65 }, moisture: { min: 0.5, max: 0.85 } },
  { name: 'Savanna', color: '#bdb76b', char: ',', temperature: { min: 0.65, max: 0.9 }, moisture: { min: 0.2, max: 0.45 } },
  { name: 'Desert', color: '#f4a460', char: 'd', temperature: { min: 0.6, max: 1 }, moisture: { min: 0, max: 0.2 } },
  { name: 'Rainforest', color: '#006400', char: 'R', temperature: { min: 0.7, max: 1 }, moisture: { min: 0.7, max: 1 } },
  { name: 'Swamp', color: '#2f4f4f', char: 'S', temperature: { min: 0.45, max: 0.75 }, moisture: { min: 0.8, max: 1 } },
  { name: 'Mountain', color: '#808080', char: '^', temperature: { min: 0, max: 0.4 }, moisture: { min: 0, max: 1 }, elevation: { min: 0.75, max: 1 } }
];

function noise2D(x: number, y: number, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, scale: number, seed: number): number {
  const sx = x / scale;
  const sy = y / scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const fx = sx - x0;
  const fy = sy - y0;

  const n00 = noise2D(x0, y0, seed);
  const n10 = noise2D(x0 + 1, y0, seed);
  const n01 = noise2D(x0, y0 + 1, seed);
  const n11 = noise2D(x0 + 1, y0 + 1, seed);

  const nx0 = n00 * (1 - fx) + n10 * fx;
  const nx1 = n01 * (1 - fx) + n11 * fx;

  return nx0 * (1 - fy) + nx1 * fy;
}

function fbmNoise(x: number, y: number, octaves: number, seed: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, y * frequency, 10, seed + i * 100) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue;
}

function generateNoiseMap(width: number, height: number, seed: number, octaves: number = 4): number[][] {
  const map: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      row.push(fbmNoise(x, y, octaves, seed));
    }
    map.push(row);
  }
  return map;
}

function getBiome(elevation: number, temperature: number, moisture: number): BiomeConfig {
  // Check elevation-specific biomes first
  for (const biome of BIOMES) {
    if (biome.elevation) {
      if (elevation >= biome.elevation.min && elevation < biome.elevation.max) {
        return biome;
      }
    }
  }

  // Find best matching biome by temperature and moisture
  let bestMatch = BIOMES[0];
  let bestScore = -Infinity;

  for (const biome of BIOMES) {
    if (biome.elevation) continue;

    const tempInRange = temperature >= biome.temperature.min && temperature <= biome.temperature.max;
    const moistInRange = moisture >= biome.moisture.min && moisture <= biome.moisture.max;

    if (tempInRange && moistInRange) {
      const tempScore = 1 - Math.abs(temperature - (biome.temperature.min + biome.temperature.max) / 2);
      const moistScore = 1 - Math.abs(moisture - (biome.moisture.min + biome.moisture.max) / 2);
      const score = tempScore + moistScore;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = biome;
      }
    }
  }

  return bestMatch;
}

function generateBiomeMap(width: number, height: number, seed: number = 42): {
  biomes: string[][];
  elevation: number[][];
  temperature: number[][];
  moisture: number[][];
} {
  const elevation = generateNoiseMap(width, height, seed);
  const temperature = generateNoiseMap(width, height, seed + 1000);
  const moisture = generateNoiseMap(width, height, seed + 2000);

  const biomes: string[][] = [];

  for (let y = 0; y < height; y++) {
    const row: string[] = [];
    for (let x = 0; x < width; x++) {
      const biome = getBiome(elevation[y][x], temperature[y][x], moisture[y][x]);
      row.push(biome.char);
    }
    biomes.push(row);
  }

  return { biomes, elevation, temperature, moisture };
}

function biomeMapToAscii(biomes: string[][]): string {
  return biomes.map(row => row.join('')).join('\n');
}

function analyzeBiomeMap(biomes: string[][]): Record<string, unknown> {
  const counts: Record<string, number> = {};
  let total = 0;

  for (const row of biomes) {
    for (const char of row) {
      const biome = BIOMES.find(b => b.char === char);
      const name = biome?.name || 'Unknown';
      counts[name] = (counts[name] || 0) + 1;
      total++;
    }
  }

  return {
    dimensions: { width: biomes[0].length, height: biomes.length },
    biomeDistribution: Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([biome, count]) => ({
        biome,
        count,
        percentage: ((count / total) * 100).toFixed(1) + '%'
      })),
    totalCells: total,
    uniqueBiomes: Object.keys(counts).length
  };
}

function generateWorld(width: number, height: number, seed: number): Record<string, unknown> {
  const { biomes, elevation } = generateBiomeMap(width, height, seed);

  // Generate rivers (simplified)
  const rivers: Array<{ x: number; y: number }[]> = [];
  const numRivers = Math.floor(width * height / 500);

  for (let r = 0; r < numRivers; r++) {
    let x = Math.floor(Math.random() * width);
    let y = Math.floor(Math.random() * height);

    if (elevation[y][x] < 0.6) continue;

    const river: Array<{ x: number; y: number }> = [];

    for (let step = 0; step < 100; step++) {
      river.push({ x, y });
      if (elevation[y][x] < 0.35) break; // Reached water

      // Find lowest neighbor
      let minElev = elevation[y][x];
      let nx = x, ny = y;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

      for (const [dx, dy] of dirs) {
        const newX = x + dx;
        const newY = y + dy;
        if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
          if (elevation[newY][newX] < minElev) {
            minElev = elevation[newY][newX];
            nx = newX;
            ny = newY;
          }
        }
      }

      if (nx === x && ny === y) break;
      x = nx;
      y = ny;
    }

    if (river.length > 5) rivers.push(river);
  }

  return {
    map: biomeMapToAscii(biomes),
    analysis: analyzeBiomeMap(biomes),
    rivers: rivers.length,
    seed
  };
}

export const biomeGeneratorTool: UnifiedTool = {
  name: 'biome_generator',
  description: 'Biome Generator: generate, world, analyze, biomes, legend',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'world', 'analyze', 'biomes', 'legend'] },
      width: { type: 'number' },
      height: { type: 'number' },
      seed: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeBiomeGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    const w = args.width || 60;
    const h = args.height || 30;
    const seed = args.seed || Math.floor(Math.random() * 10000);

    switch (args.operation) {
      case 'generate':
        const { biomes } = generateBiomeMap(w, h, seed);
        result = { seed, map: biomeMapToAscii(biomes), analysis: analyzeBiomeMap(biomes) };
        break;
      case 'world':
        result = generateWorld(w, h, seed);
        break;
      case 'analyze':
        const { biomes: analyzeBiomes } = generateBiomeMap(w, h, seed);
        result = analyzeBiomeMap(analyzeBiomes);
        break;
      case 'biomes':
        result = {
          biomes: BIOMES.map(b => ({
            name: b.name,
            char: b.char,
            color: b.color,
            temperature: `${b.temperature.min} - ${b.temperature.max}`,
            moisture: `${b.moisture.min} - ${b.moisture.max}`,
            elevation: b.elevation ? `${b.elevation.min} - ${b.elevation.max}` : 'any'
          }))
        };
        break;
      case 'legend':
        result = {
          legend: BIOMES.map(b => `${b.char} = ${b.name}`).join('\n')
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isBiomeGeneratorAvailable(): boolean { return true; }
