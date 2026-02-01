/**
 * TILE MAP TOOL
 * Create and manipulate 2D tile maps for games
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Tile { id: number; name: string; walkable: boolean; char: string; }
interface TileMap { width: number; height: number; tiles: number[][]; tileSet: Record<number, Tile>; }
interface Layer { name: string; data: number[][]; visible: boolean; }
void (0 as unknown as Layer); // For multi-layer support

const DEFAULT_TILESET: Record<number, Tile> = {
  0: { id: 0, name: 'empty', walkable: true, char: ' ' },
  1: { id: 1, name: 'grass', walkable: true, char: '.' },
  2: { id: 2, name: 'water', walkable: false, char: '~' },
  3: { id: 3, name: 'wall', walkable: false, char: '#' },
  4: { id: 4, name: 'tree', walkable: false, char: 'T' },
  5: { id: 5, name: 'path', walkable: true, char: '=' },
  6: { id: 6, name: 'sand', walkable: true, char: ':' },
  7: { id: 7, name: 'stone', walkable: true, char: 'o' },
  8: { id: 8, name: 'door', walkable: true, char: '+' },
  9: { id: 9, name: 'chest', walkable: false, char: '$' }
};

function createTileMap(width: number, height: number, fill: number = 0): TileMap {
  return {
    width,
    height,
    tiles: Array(height).fill(null).map(() => Array(width).fill(fill)),
    tileSet: { ...DEFAULT_TILESET }
  };
}

function fillRect(map: TileMap, x: number, y: number, w: number, h: number, tileId: number): void {
  for (let py = y; py < y + h && py < map.height; py++) {
    for (let px = x; px < x + w && px < map.width; px++) {
      if (py >= 0 && px >= 0) map.tiles[py][px] = tileId;
    }
  }
}

function drawLine(map: TileMap, x1: number, y1: number, x2: number, y2: number, tileId: number): void {
  const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let x = x1, y = y1;
  while (true) {
    if (x >= 0 && x < map.width && y >= 0 && y < map.height) map.tiles[y][x] = tileId;
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

function drawCircle(map: TileMap, cx: number, cy: number, radius: number, tileId: number, filled: boolean = false): void {
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const dist = Math.sqrt(x * x + y * y);
      if ((filled && dist <= radius) || (!filled && Math.abs(dist - radius) < 0.5)) {
        const px = cx + x, py = cy + y;
        if (px >= 0 && px < map.width && py >= 0 && py < map.height) map.tiles[py][px] = tileId;
      }
    }
  }
}

function generateIsland(width: number, height: number): TileMap {
  const map = createTileMap(width, height, 2);
  const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
  const maxRadius = Math.min(width, height) / 2 - 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const noise = (Math.random() - 0.5) * 4;
      if (dist + noise < maxRadius * 0.3) map.tiles[y][x] = 1;
      else if (dist + noise < maxRadius * 0.6) map.tiles[y][x] = Math.random() < 0.7 ? 1 : 4;
      else if (dist + noise < maxRadius * 0.9) map.tiles[y][x] = 6;
    }
  }
  return map;
}

function generateRoom(width: number, height: number): TileMap {
  const map = createTileMap(width, height, 3);
  fillRect(map, 1, 1, width - 2, height - 2, 7);
  map.tiles[0][Math.floor(width / 2)] = 8;
  map.tiles[height - 1][Math.floor(width / 2)] = 8;
  map.tiles[2][2] = 9;
  return map;
}

function generateOverworld(width: number, height: number): TileMap {
  const map = createTileMap(width, height, 1);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(Math.random() * (width - 6)) + 3;
    const y = Math.floor(Math.random() * (height - 4)) + 2;
    drawCircle(map, x, y, 3 + Math.floor(Math.random() * 2), 4, true);
  }
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(Math.random() * (width - 4)) + 2;
    const y = Math.floor(Math.random() * (height - 4)) + 2;
    drawCircle(map, x, y, 2 + Math.floor(Math.random() * 2), 2, true);
  }
  drawLine(map, 0, Math.floor(height / 2), width - 1, Math.floor(height / 2), 5);
  return map;
}

function mapToAscii(map: TileMap): string {
  return map.tiles.map(row => row.map(id => map.tileSet[id]?.char || '?').join('')).join('\n');
}

function getWalkableTiles(map: TileMap): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.tileSet[map.tiles[y][x]]?.walkable) result.push({ x, y });
    }
  }
  return result;
}

export const tileMapTool: UnifiedTool = {
  name: 'tile_map',
  description: 'Tile Map: create, island, room, overworld, draw, fill, analyze',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'island', 'room', 'overworld', 'draw_rect', 'draw_line', 'draw_circle', 'analyze', 'tileset'] },
      width: { type: 'number' },
      height: { type: 'number' },
      fill: { type: 'number' },
      x: { type: 'number' },
      y: { type: 'number' },
      x2: { type: 'number' },
      y2: { type: 'number' },
      radius: { type: 'number' },
      tileId: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeTileMap(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const width = args.width || 40;
    const height = args.height || 20;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'create':
        const newMap = createTileMap(width, height, args.fill || 1);
        result = { map: newMap, ascii: mapToAscii(newMap) };
        break;
      case 'island':
        const island = generateIsland(width, height);
        result = { type: 'island', ascii: mapToAscii(island), walkable: getWalkableTiles(island).length };
        break;
      case 'room':
        const room = generateRoom(width, height);
        result = { type: 'room', ascii: mapToAscii(room), walkable: getWalkableTiles(room).length };
        break;
      case 'overworld':
        const overworld = generateOverworld(width, height);
        result = { type: 'overworld', ascii: mapToAscii(overworld), walkable: getWalkableTiles(overworld).length };
        break;
      case 'draw_rect':
        const rectMap = createTileMap(width, height, 0);
        fillRect(rectMap, args.x || 5, args.y || 5, args.width || 10, args.height || 5, args.tileId || 3);
        result = { ascii: mapToAscii(rectMap) };
        break;
      case 'draw_line':
        const lineMap = createTileMap(width, height, 0);
        drawLine(lineMap, args.x || 0, args.y || 0, args.x2 || width - 1, args.y2 || height - 1, args.tileId || 5);
        result = { ascii: mapToAscii(lineMap) };
        break;
      case 'draw_circle':
        const circleMap = createTileMap(width, height, 0);
        drawCircle(circleMap, args.x || width / 2, args.y || height / 2, args.radius || 5, args.tileId || 1, true);
        result = { ascii: mapToAscii(circleMap) };
        break;
      case 'analyze':
        const analyzeMap = generateOverworld(width, height);
        const walkable = getWalkableTiles(analyzeMap);
        const tileCount: Record<string, number> = {};
        for (const row of analyzeMap.tiles) {
          for (const id of row) {
            const name = analyzeMap.tileSet[id]?.name || 'unknown';
            tileCount[name] = (tileCount[name] || 0) + 1;
          }
        }
        result = { dimensions: { width, height }, totalTiles: width * height, walkableTiles: walkable.length, tileCounts: tileCount, ascii: mapToAscii(analyzeMap) };
        break;
      case 'tileset':
        result = { tileset: Object.values(DEFAULT_TILESET) };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isTileMapAvailable(): boolean { return true; }
