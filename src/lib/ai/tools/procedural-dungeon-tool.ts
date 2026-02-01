/**
 * PROCEDURAL DUNGEON TOOL
 * Generate dungeons using BSP, cellular automata, and room placement
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

type Tile = 0 | 1 | 2 | 3; // 0=floor, 1=wall, 2=door, 3=special
type DungeonMap = Tile[][];

interface Room { x: number; y: number; width: number; height: number; type?: string; }
interface Dungeon { map: DungeonMap; rooms: Room[]; doors: Array<{ x: number; y: number }>; width: number; height: number; }

function createEmptyMap(width: number, height: number, fill: Tile = 1): DungeonMap {
  return Array(height).fill(null).map(() => Array(width).fill(fill));
}

function carveRoom(map: DungeonMap, room: Room): void {
  for (let y = room.y; y < room.y + room.height && y < map.length; y++) {
    for (let x = room.x; x < room.x + room.width && x < map[0].length; x++) {
      if (y >= 0 && x >= 0) map[y][x] = 0;
    }
  }
}

function carveCorridor(map: DungeonMap, x1: number, y1: number, x2: number, y2: number): void {
  // L-shaped corridor
  const midX = Math.random() < 0.5 ? x1 : x2;
  const midY = Math.random() < 0.5 ? y1 : y2;
  void midY; // Reserved for future corridor variations

  // Horizontal then vertical or vertical then horizontal
  for (let x = Math.min(x1, midX); x <= Math.max(x1, midX); x++) {
    if (y1 >= 0 && y1 < map.length && x >= 0 && x < map[0].length) map[y1][x] = 0;
  }
  for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
    if (y >= 0 && y < map.length && midX >= 0 && midX < map[0].length) map[y][midX] = 0;
  }
  for (let x = Math.min(midX, x2); x <= Math.max(midX, x2); x++) {
    if (y2 >= 0 && y2 < map.length && x >= 0 && x < map[0].length) map[y2][x] = 0;
  }
}

// BSP (Binary Space Partitioning) dungeon
function bspDungeon(width: number, height: number, minRoomSize: number = 5, maxRoomSize: number = 15): Dungeon {
  const map = createEmptyMap(width, height);
  const rooms: Room[] = [];

  interface BSPNode { x: number; y: number; width: number; height: number; left?: BSPNode; right?: BSPNode; room?: Room; }

  function splitNode(node: BSPNode, depth: number): void {
    if (depth <= 0 || node.width < minRoomSize * 2 || node.height < minRoomSize * 2) {
      // Create room in leaf node
      const roomWidth = Math.min(maxRoomSize, Math.floor(Math.random() * (node.width - minRoomSize - 2)) + minRoomSize);
      const roomHeight = Math.min(maxRoomSize, Math.floor(Math.random() * (node.height - minRoomSize - 2)) + minRoomSize);
      const roomX = node.x + Math.floor(Math.random() * (node.width - roomWidth - 1)) + 1;
      const roomY = node.y + Math.floor(Math.random() * (node.height - roomHeight - 1)) + 1;

      node.room = { x: roomX, y: roomY, width: roomWidth, height: roomHeight };
      rooms.push(node.room);
      carveRoom(map, node.room);
      return;
    }

    const horizontal = Math.random() < 0.5;

    if (horizontal) {
      const split = Math.floor(Math.random() * (node.height - minRoomSize * 2)) + minRoomSize;
      node.left = { x: node.x, y: node.y, width: node.width, height: split };
      node.right = { x: node.x, y: node.y + split, width: node.width, height: node.height - split };
    } else {
      const split = Math.floor(Math.random() * (node.width - minRoomSize * 2)) + minRoomSize;
      node.left = { x: node.x, y: node.y, width: split, height: node.height };
      node.right = { x: node.x + split, y: node.y, width: node.width - split, height: node.height };
    }

    splitNode(node.left, depth - 1);
    splitNode(node.right, depth - 1);

    // Connect rooms
    const leftRoom = getRoom(node.left);
    const rightRoom = getRoom(node.right);
    if (leftRoom && rightRoom) {
      const x1 = leftRoom.x + Math.floor(leftRoom.width / 2);
      const y1 = leftRoom.y + Math.floor(leftRoom.height / 2);
      const x2 = rightRoom.x + Math.floor(rightRoom.width / 2);
      const y2 = rightRoom.y + Math.floor(rightRoom.height / 2);
      carveCorridor(map, x1, y1, x2, y2);
    }
  }

  function getRoom(node: BSPNode): Room | undefined {
    if (node.room) return node.room;
    if (node.left && node.right) {
      return Math.random() < 0.5 ? getRoom(node.left) : getRoom(node.right);
    }
    return node.left ? getRoom(node.left) : (node.right ? getRoom(node.right) : undefined);
  }

  const root: BSPNode = { x: 0, y: 0, width, height };
  splitNode(root, 5);

  // Find doors
  const doors: Array<{ x: number; y: number }> = [];

  return { map, rooms, doors, width, height };
}

// Cellular automata cave
function cellularCave(width: number, height: number, fillProb: number = 0.45, iterations: number = 4): Dungeon {
  const map = createEmptyMap(width, height, 0);

  // Initial random fill
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        map[y][x] = 1;
      } else {
        map[y][x] = Math.random() < fillProb ? 1 : 0;
      }
    }
  }

  // Cellular automata iterations
  for (let i = 0; i < iterations; i++) {
    const newMap = createEmptyMap(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          newMap[y][x] = 1;
          continue;
        }

        let walls = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (map[y + dy][x + dx] === 1) walls++;
          }
        }

        newMap[y][x] = walls >= 5 ? 1 : 0;
      }
    }
    map.splice(0, height, ...newMap);
  }

  return { map, rooms: [], doors: [], width, height };
}

// Simple room placement
function roomPlacement(width: number, height: number, roomCount: number = 10, minSize: number = 4, maxSize: number = 10): Dungeon {
  const map = createEmptyMap(width, height);
  const rooms: Room[] = [];

  for (let i = 0; i < roomCount * 3 && rooms.length < roomCount; i++) {
    const roomWidth = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
    const roomHeight = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
    const roomX = Math.floor(Math.random() * (width - roomWidth - 2)) + 1;
    const roomY = Math.floor(Math.random() * (height - roomHeight - 2)) + 1;

    const newRoom: Room = { x: roomX, y: roomY, width: roomWidth, height: roomHeight };

    // Check overlap
    let overlaps = false;
    for (const room of rooms) {
      if (roomX < room.x + room.width + 1 && roomX + roomWidth + 1 > room.x &&
          roomY < room.y + room.height + 1 && roomY + roomHeight + 1 > room.y) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      rooms.push(newRoom);
      carveRoom(map, newRoom);
    }
  }

  // Connect rooms
  for (let i = 1; i < rooms.length; i++) {
    const prev = rooms[i - 1];
    const curr = rooms[i];
    carveCorridor(map,
      prev.x + Math.floor(prev.width / 2),
      prev.y + Math.floor(prev.height / 2),
      curr.x + Math.floor(curr.width / 2),
      curr.y + Math.floor(curr.height / 2)
    );
  }

  return { map, rooms, doors: [], width, height };
}

function dungeonToAscii(dungeon: Dungeon): string {
  const chars: Record<Tile, string> = { 0: '.', 1: '#', 2: '+', 3: '*' };
  return dungeon.map.map(row => row.map(t => chars[t]).join('')).join('\n');
}

function addFeatures(dungeon: Dungeon): Dungeon {
  const roomTypes = ['entrance', 'treasure', 'boss', 'trap', 'empty', 'monster'];
  dungeon.rooms.forEach((room, idx) => {
    if (idx === 0) room.type = 'entrance';
    else if (idx === dungeon.rooms.length - 1) room.type = 'boss';
    else room.type = roomTypes[Math.floor(Math.random() * roomTypes.length)];
  });
  return dungeon;
}

export const proceduralDungeonTool: UnifiedTool = {
  name: 'procedural_dungeon',
  description: 'Procedural Dungeon: bsp, cave, rooms, ascii, features, analyze',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['bsp', 'cave', 'rooms', 'ascii', 'features', 'analyze'] },
      width: { type: 'number' },
      height: { type: 'number' },
      roomCount: { type: 'number' },
      minSize: { type: 'number' },
      maxSize: { type: 'number' },
      fillProb: { type: 'number' },
      iterations: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeProceduralDungeon(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const w = args.width || 50, h = args.height || 30;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'bsp':
        const bsp = bspDungeon(w, h, args.minSize || 5, args.maxSize || 12);
        result = { algorithm: 'BSP', rooms: bsp.rooms.length, ascii: dungeonToAscii(bsp) };
        break;
      case 'cave':
        const cave = cellularCave(w, h, args.fillProb || 0.45, args.iterations || 4);
        result = { algorithm: 'Cellular Automata', ascii: dungeonToAscii(cave) };
        break;
      case 'rooms':
        const rooms = roomPlacement(w, h, args.roomCount || 8, args.minSize || 4, args.maxSize || 10);
        result = { algorithm: 'Room Placement', rooms: rooms.rooms.length, ascii: dungeonToAscii(rooms) };
        break;
      case 'ascii':
        const dungeon = bspDungeon(w, h);
        result = { ascii: dungeonToAscii(dungeon) };
        break;
      case 'features':
        const featuredDungeon = addFeatures(bspDungeon(w, h));
        result = { rooms: featuredDungeon.rooms, ascii: dungeonToAscii(featuredDungeon) };
        break;
      case 'analyze':
        const analyzeDungeon = bspDungeon(w, h);
        let floorCount = 0, wallCount = 0;
        analyzeDungeon.map.forEach(row => row.forEach(t => t === 0 ? floorCount++ : wallCount++));
        result = {
          width: w, height: h,
          totalTiles: w * h,
          floorTiles: floorCount,
          wallTiles: wallCount,
          floorRatio: (floorCount / (w * h) * 100).toFixed(1) + '%',
          roomCount: analyzeDungeon.rooms.length,
          avgRoomSize: (analyzeDungeon.rooms.reduce((s, r) => s + r.width * r.height, 0) / analyzeDungeon.rooms.length).toFixed(1)
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

export function isProceduralDungeonAvailable(): boolean { return true; }
