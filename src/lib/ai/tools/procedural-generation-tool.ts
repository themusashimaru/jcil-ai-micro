/**
 * PROCEDURAL GENERATION TOOL
 *
 * Procedural content generation: noise functions, terrain,
 * dungeons, mazes, and algorithmic art.
 *
 * Part of TIER ADVANCED SCIENCE - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// NOISE FUNCTIONS
// ============================================================================

// Simple hash function for deterministic randomness
function hash(x: number, y: number = 0, seed: number = 12345): number {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number = 12345): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smoothstep(x - x0);
  const fy = smoothstep(y - y0);

  const n00 = hash(x0, y0, seed);
  const n10 = hash(x0 + 1, y0, seed);
  const n01 = hash(x0, y0 + 1, seed);
  const n11 = hash(x0 + 1, y0 + 1, seed);

  return lerp(lerp(n00, n10, fx), lerp(n01, n11, fx), fy);
}

function perlinNoise(x: number, y: number, seed: number = 12345): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;

  // Gradient vectors
  const grad = (ix: number, iy: number): [number, number] => {
    const h = hash(ix, iy, seed);
    const angle = h * Math.PI * 2;
    return [Math.cos(angle), Math.sin(angle)];
  };

  const dot = (g: [number, number], dx: number, dy: number) => g[0] * dx + g[1] * dy;

  const g00 = grad(x0, y0);
  const g10 = grad(x0 + 1, y0);
  const g01 = grad(x0, y0 + 1);
  const g11 = grad(x0 + 1, y0 + 1);

  const n00 = dot(g00, fx, fy);
  const n10 = dot(g10, fx - 1, fy);
  const n01 = dot(g01, fx, fy - 1);
  const n11 = dot(g11, fx - 1, fy - 1);

  const u = smoothstep(fx);
  const v = smoothstep(fy);

  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 0.5 + 0.5;
}

function fbm(x: number, y: number, octaves: number, persistence: number, seed: number): number {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += perlinNoise(x * frequency, y * frequency, seed + i * 1000) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return total / maxValue;
}

function ridgedNoise(x: number, y: number, octaves: number, seed: number): number {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;

  for (let i = 0; i < octaves; i++) {
    const n = perlinNoise(x * frequency, y * frequency, seed + i * 1000);
    total += (1 - Math.abs(n * 2 - 1)) * amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / 2;
}

// ============================================================================
// TERRAIN GENERATION
// ============================================================================

function generateHeightmap(width: number, height: number, options: {
  octaves?: number;
  persistence?: number;
  scale?: number;
  seed?: number;
  type?: 'fbm' | 'ridged' | 'value';
}): number[][] {
  const { octaves = 6, persistence = 0.5, scale = 0.02, seed = 12345, type = 'fbm' } = options;
  const heightmap: number[][] = [];

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      let h: number;
      switch (type) {
        case 'ridged':
          h = ridgedNoise(x * scale, y * scale, octaves, seed);
          break;
        case 'value':
          h = valueNoise(x * scale, y * scale, seed);
          break;
        default:
          h = fbm(x * scale, y * scale, octaves, persistence, seed);
      }
      row.push(h);
    }
    heightmap.push(row);
  }

  return heightmap;
}

function thermalErosion(heightmap: number[][], iterations: number, talus: number): number[][] {
  const h = heightmap.map(row => [...row]);
  const width = h[0].length;
  const height = h.length;

  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const neighbors = [
          [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
        ];

        let maxDiff = 0;
        let lowestNeighbor: [number, number] | null = null;

        for (const [nx, ny] of neighbors) {
          const diff = h[y][x] - h[ny][nx];
          if (diff > maxDiff) {
            maxDiff = diff;
            lowestNeighbor = [nx, ny];
          }
        }

        if (lowestNeighbor && maxDiff > talus) {
          const sediment = (maxDiff - talus) * 0.5;
          h[y][x] -= sediment;
          h[lowestNeighbor[1]][lowestNeighbor[0]] += sediment;
        }
      }
    }
  }

  return h;
}

// ============================================================================
// MAZE GENERATION
// ============================================================================

function generateMaze(width: number, height: number, seed: number = 12345): number[][] {
  // 0 = wall, 1 = passage
  const maze: number[][] = Array.from({ length: height }, () => Array(width).fill(0));

  const stack: [number, number][] = [];
  const visited = new Set<string>();

  // Start from (1,1)
  let cx = 1, cy = 1;
  maze[cy][cx] = 1;
  visited.add(`${cx},${cy}`);
  stack.push([cx, cy]);

  let hashState = seed;

  while (stack.length > 0) {
    const neighbors: [number, number, number, number][] = [];
    const directions = [[0, -2], [0, 2], [-2, 0], [2, 0]];

    for (const [dx, dy] of directions) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1 && !visited.has(`${nx},${ny}`)) {
        neighbors.push([nx, ny, cx + dx / 2, cy + dy / 2]);
      }
    }

    if (neighbors.length > 0) {
      // Deterministic random choice
      hashState = (hashState * 1103515245 + 12345) >>> 0;
      const idx = hashState % neighbors.length;
      const [nx, ny, wx, wy] = neighbors[idx];

      maze[ny][nx] = 1;
      maze[wy][wx] = 1;
      visited.add(`${nx},${ny}`);
      stack.push([cx, cy]);
      cx = nx;
      cy = ny;
    } else {
      const pos = stack.pop()!;
      cx = pos[0];
      cy = pos[1];
    }
  }

  return maze;
}

// ============================================================================
// DUNGEON GENERATION
// ============================================================================

interface Room {
  x: number;
  y: number;
  width: number;
  height: number;
}

function generateDungeon(width: number, height: number, roomCount: number, seed: number = 12345): {
  map: number[][];
  rooms: Room[];
} {
  const map: number[][] = Array.from({ length: height }, () => Array(width).fill(0));
  const rooms: Room[] = [];
  let hashState = seed;

  const rand = () => {
    hashState = (hashState * 1103515245 + 12345) >>> 0;
    return hashState / 4294967296;
  };

  const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

  // Generate rooms
  for (let i = 0; i < roomCount * 3; i++) {
    if (rooms.length >= roomCount) break;

    const roomWidth = randInt(4, 10);
    const roomHeight = randInt(4, 8);
    const roomX = randInt(1, width - roomWidth - 1);
    const roomY = randInt(1, height - roomHeight - 1);

    // Check overlap
    let overlaps = false;
    for (const room of rooms) {
      if (roomX < room.x + room.width + 1 &&
          roomX + roomWidth + 1 > room.x &&
          roomY < room.y + room.height + 1 &&
          roomY + roomHeight + 1 > room.y) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      rooms.push({ x: roomX, y: roomY, width: roomWidth, height: roomHeight });
      // Carve room
      for (let y = roomY; y < roomY + roomHeight; y++) {
        for (let x = roomX; x < roomX + roomWidth; x++) {
          map[y][x] = 1;
        }
      }
    }
  }

  // Connect rooms with corridors
  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1];
    const curr = rooms[i];
    const prevCenterX = Math.floor(prev.x + prev.width / 2);
    const prevCenterY = Math.floor(prev.y + prev.height / 2);
    const currCenterX = Math.floor(curr.x + curr.width / 2);
    const currCenterY = Math.floor(curr.y + curr.height / 2);

    // L-shaped corridor
    if (rand() < 0.5) {
      for (let x = Math.min(prevCenterX, currCenterX); x <= Math.max(prevCenterX, currCenterX); x++) {
        map[prevCenterY][x] = 1;
      }
      for (let y = Math.min(prevCenterY, currCenterY); y <= Math.max(prevCenterY, currCenterY); y++) {
        map[y][currCenterX] = 1;
      }
    } else {
      for (let y = Math.min(prevCenterY, currCenterY); y <= Math.max(prevCenterY, currCenterY); y++) {
        map[y][prevCenterX] = 1;
      }
      for (let x = Math.min(prevCenterX, currCenterX); x <= Math.max(prevCenterX, currCenterX); x++) {
        map[currCenterY][x] = 1;
      }
    }
  }

  return { map, rooms };
}

// ============================================================================
// VISUALIZATION
// ============================================================================

function visualizeHeightmap(heightmap: number[][], width: number = 60, height: number = 25): string {
  const chars = ' .:-=+*#%@';
  const hh = heightmap.length;
  const hw = heightmap[0].length;
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const sy = Math.floor(y / height * hh);
      const sx = Math.floor(x / width * hw);
      const h = heightmap[sy][sx];
      const charIdx = Math.min(Math.floor(h * chars.length), chars.length - 1);
      line += chars[charIdx];
    }
    lines.push(line);
  }

  return lines.join('\n');
}

function visualizeMaze(maze: number[][]): string {
  return maze.map(row => row.map(cell => cell === 0 ? '█' : ' ').join('')).join('\n');
}

function visualizeDungeon(map: number[][]): string {
  return map.map(row => row.map(cell => cell === 0 ? '█' : '.').join('')).join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const proceduralGenerationTool: UnifiedTool = {
  name: 'procedural_generation',
  description: `Procedural content generation.

Operations:
- noise: Generate 2D noise (perlin, value, fbm, ridged)
- terrain: Generate heightmap terrain with erosion
- maze: Generate random maze
- dungeon: Generate dungeon with rooms and corridors
- pattern: Generate procedural patterns`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['noise', 'terrain', 'maze', 'dungeon', 'pattern'],
        description: 'Generation operation',
      },
      width: { type: 'number', description: 'Output width' },
      height: { type: 'number', description: 'Output height' },
      seed: { type: 'number', description: 'Random seed' },
      noise_type: { type: 'string', description: 'Noise: perlin, value, fbm, ridged' },
      octaves: { type: 'number', description: 'FBM octaves' },
      persistence: { type: 'number', description: 'FBM persistence' },
      scale: { type: 'number', description: 'Noise scale' },
      erosion_iterations: { type: 'number', description: 'Erosion iterations' },
      room_count: { type: 'number', description: 'Number of rooms' },
      pattern_type: { type: 'string', description: 'Pattern: checkerboard, stripes, dots' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeProceduralGeneration(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, width = 40, height = 20, seed = 12345 } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'noise': {
        const { noise_type = 'perlin', octaves = 4, scale = 0.1 } = args;
        const x = args.x ?? 5.5;
        const y = args.y ?? 3.2;

        let value: number;
        switch (noise_type) {
          case 'value':
            value = valueNoise(x * scale, y * scale, seed);
            break;
          case 'fbm':
            value = fbm(x * scale, y * scale, octaves, 0.5, seed);
            break;
          case 'ridged':
            value = ridgedNoise(x * scale, y * scale, octaves, seed);
            break;
          default:
            value = perlinNoise(x * scale, y * scale, seed);
        }

        // Generate small preview
        const preview: number[][] = [];
        for (let py = 0; py < 10; py++) {
          const row: number[] = [];
          for (let px = 0; px < 20; px++) {
            switch (noise_type) {
              case 'value':
                row.push(Math.round(valueNoise(px * scale, py * scale, seed) * 100) / 100);
                break;
              case 'fbm':
                row.push(Math.round(fbm(px * scale, py * scale, octaves, 0.5, seed) * 100) / 100);
                break;
              case 'ridged':
                row.push(Math.round(ridgedNoise(px * scale, py * scale, octaves, seed) * 100) / 100);
                break;
              default:
                row.push(Math.round(perlinNoise(px * scale, py * scale, seed) * 100) / 100);
            }
          }
          preview.push(row);
        }

        result = {
          operation: 'noise',
          type: noise_type,
          sample_point: { x, y },
          value: Math.round(value * 1000) / 1000,
          visualization: visualizeHeightmap(preview, 40, 15),
        };
        break;
      }

      case 'terrain': {
        const { noise_type = 'fbm', octaves = 6, persistence = 0.5, scale = 0.02, erosion_iterations = 0 } = args;
        let heightmap = generateHeightmap(width, height, {
          octaves,
          persistence,
          scale,
          seed,
          type: noise_type,
        });

        if (erosion_iterations > 0) {
          heightmap = thermalErosion(heightmap, erosion_iterations, 0.1);
        }

        // Calculate stats
        let min = 1, max = 0, sum = 0;
        for (const row of heightmap) {
          for (const h of row) {
            min = Math.min(min, h);
            max = Math.max(max, h);
            sum += h;
          }
        }
        const avg = sum / (width * height);

        result = {
          operation: 'terrain',
          dimensions: { width, height },
          noise_type,
          stats: {
            min: Math.round(min * 1000) / 1000,
            max: Math.round(max * 1000) / 1000,
            average: Math.round(avg * 1000) / 1000,
          },
          erosion_iterations,
          visualization: visualizeHeightmap(heightmap),
        };
        break;
      }

      case 'maze': {
        // Ensure odd dimensions for proper maze
        const mazeW = width % 2 === 0 ? width + 1 : width;
        const mazeH = height % 2 === 0 ? height + 1 : height;
        const maze = generateMaze(mazeW, mazeH, seed);

        // Count passages
        let passages = 0;
        for (const row of maze) {
          for (const cell of row) {
            if (cell === 1) passages++;
          }
        }

        result = {
          operation: 'maze',
          dimensions: { width: mazeW, height: mazeH },
          seed,
          passages,
          walls: mazeW * mazeH - passages,
          visualization: visualizeMaze(maze),
        };
        break;
      }

      case 'dungeon': {
        const { room_count = 5 } = args;
        const { map, rooms } = generateDungeon(width, height, room_count, seed);

        // Count floor tiles
        let floors = 0;
        for (const row of map) {
          for (const cell of row) {
            if (cell === 1) floors++;
          }
        }

        result = {
          operation: 'dungeon',
          dimensions: { width, height },
          seed,
          rooms_generated: rooms.length,
          room_details: rooms.map((r, i) => ({ id: i + 1, x: r.x, y: r.y, size: `${r.width}x${r.height}` })),
          floor_tiles: floors,
          wall_tiles: width * height - floors,
          visualization: visualizeDungeon(map),
        };
        break;
      }

      case 'pattern': {
        const { pattern_type = 'checkerboard' } = args;
        const pattern: string[][] = [];

        for (let y = 0; y < height; y++) {
          const row: string[] = [];
          for (let x = 0; x < width; x++) {
            let char: string;
            switch (pattern_type) {
              case 'stripes':
                char = (x % 4 < 2) ? '█' : ' ';
                break;
              case 'dots':
                char = (x % 3 === 0 && y % 2 === 0) ? '●' : ' ';
                break;
              case 'waves':
                const wave = Math.sin(x * 0.3 + y * 0.1) * 0.5 + 0.5;
                char = wave > 0.5 ? '~' : ' ';
                break;
              case 'diagonal':
                char = ((x + y) % 4 < 2) ? '/' : '\\';
                break;
              default: // checkerboard
                char = ((x + y) % 2 === 0) ? '█' : ' ';
            }
            row.push(char);
          }
          pattern.push(row);
        }

        result = {
          operation: 'pattern',
          type: pattern_type,
          dimensions: { width, height },
          visualization: pattern.map(row => row.join('')).join('\n'),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Procedural Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isProceduralGenerationAvailable(): boolean { return true; }
