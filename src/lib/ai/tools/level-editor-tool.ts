/**
 * LEVEL EDITOR TOOL
 * Create and edit game levels, zones, and areas
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface LevelObject { id: string; type: string; x: number; y: number; width: number; height: number; properties: Record<string, unknown>; layer: string; }
interface SpawnPoint { id: string; type: 'player' | 'enemy' | 'item' | 'npc'; x: number; y: number; properties?: Record<string, unknown>; }
interface Trigger { id: string; type: 'area' | 'interaction' | 'auto'; x: number; y: number; width: number; height: number; action: string; once: boolean; }
interface Level { id: string; name: string; width: number; height: number; tileSize: number; layers: string[]; objects: LevelObject[]; spawns: SpawnPoint[]; triggers: Trigger[]; metadata: Record<string, unknown>; }

function createLevel(name: string, width: number, height: number, tileSize: number = 32): Level {
  return {
    id: `level_${Date.now()}`,
    name,
    width,
    height,
    tileSize,
    layers: ['background', 'terrain', 'decoration', 'objects', 'foreground'],
    objects: [],
    spawns: [],
    triggers: [],
    metadata: { author: 'unknown', created: Date.now(), version: '1.0' }
  };
}

function addObject(level: Level, type: string, x: number, y: number, width: number, height: number, layer: string = 'objects', properties: Record<string, unknown> = {}): LevelObject {
  const obj: LevelObject = { id: `obj_${level.objects.length}`, type, x, y, width, height, layer, properties };
  level.objects.push(obj);
  return obj;
}

function addSpawn(level: Level, type: SpawnPoint['type'], x: number, y: number, properties?: Record<string, unknown>): SpawnPoint {
  const spawn: SpawnPoint = { id: `spawn_${level.spawns.length}`, type, x, y, properties };
  level.spawns.push(spawn);
  return spawn;
}

function addTrigger(level: Level, type: Trigger['type'], x: number, y: number, width: number, height: number, action: string, once: boolean = false): Trigger {
  const trigger: Trigger = { id: `trigger_${level.triggers.length}`, type, x, y, width, height, action, once };
  level.triggers.push(trigger);
  return trigger;
}

function createSampleLevel(): Level {
  const level = createLevel('Forest Clearing', 40, 30, 32);

  // Add terrain objects
  addObject(level, 'tree', 5, 5, 2, 3, 'terrain', { variant: 'oak' });
  addObject(level, 'tree', 12, 8, 2, 3, 'terrain', { variant: 'pine' });
  addObject(level, 'tree', 35, 4, 2, 3, 'terrain', { variant: 'oak' });
  addObject(level, 'rock', 20, 15, 2, 2, 'terrain', { size: 'large' });
  addObject(level, 'bush', 8, 20, 1, 1, 'decoration');
  addObject(level, 'bush', 30, 12, 1, 1, 'decoration');

  // Add interactive objects
  addObject(level, 'chest', 25, 10, 1, 1, 'objects', { loot: 'gold', amount: 50 });
  addObject(level, 'sign', 15, 5, 1, 1, 'objects', { text: 'Welcome to the forest!' });
  addObject(level, 'door', 38, 15, 1, 2, 'objects', { destination: 'cave_entrance', locked: false });

  // Add spawn points
  addSpawn(level, 'player', 2, 15);
  addSpawn(level, 'enemy', 30, 20, { type: 'wolf', level: 3 });
  addSpawn(level, 'enemy', 25, 25, { type: 'wolf', level: 2 });
  addSpawn(level, 'npc', 10, 10, { name: 'Wandering Merchant', dialog: 'merchant_intro' });
  addSpawn(level, 'item', 18, 22, { itemId: 'potion_health' });

  // Add triggers
  addTrigger(level, 'area', 0, 0, 5, 30, 'enter_forest', true);
  addTrigger(level, 'area', 35, 10, 5, 10, 'near_cave', false);
  addTrigger(level, 'interaction', 25, 10, 1, 1, 'open_chest', true);

  return level;
}

function levelToAscii(level: Level): string {
  const grid: string[][] = Array(level.height).fill(null).map(() => Array(level.width).fill('.'));

  // Draw objects
  for (const obj of level.objects) {
    const char = obj.type === 'tree' ? 'T' : obj.type === 'rock' ? 'O' : obj.type === 'chest' ? '$' : obj.type === 'door' ? 'D' : obj.type === 'sign' ? '!' : '#';
    for (let dy = 0; dy < obj.height; dy++) {
      for (let dx = 0; dx < obj.width; dx++) {
        const x = obj.x + dx, y = obj.y + dy;
        if (x >= 0 && x < level.width && y >= 0 && y < level.height) grid[y][x] = char;
      }
    }
  }

  // Draw spawns
  for (const spawn of level.spawns) {
    const char = spawn.type === 'player' ? 'P' : spawn.type === 'enemy' ? 'E' : spawn.type === 'npc' ? 'N' : spawn.type === 'item' ? 'i' : 's';
    if (spawn.x >= 0 && spawn.x < level.width && spawn.y >= 0 && spawn.y < level.height) {
      grid[spawn.y][spawn.x] = char;
    }
  }

  // Draw triggers (borders only)
  for (const trigger of level.triggers) {
    for (let dx = 0; dx < trigger.width; dx++) {
      const x = trigger.x + dx;
      if (x >= 0 && x < level.width) {
        if (trigger.y >= 0 && trigger.y < level.height) grid[trigger.y][x] = grid[trigger.y][x] === '.' ? '-' : grid[trigger.y][x];
        const bottomY = trigger.y + trigger.height - 1;
        if (bottomY >= 0 && bottomY < level.height) grid[bottomY][x] = grid[bottomY][x] === '.' ? '-' : grid[bottomY][x];
      }
    }
  }

  const header = `Level: ${level.name} (${level.width}x${level.height})`;
  const legend = 'Legend: P=Player T=Tree O=Rock $=Chest D=Door E=Enemy N=NPC i=Item';
  return header + '\n' + grid.map(row => row.join('')).join('\n') + '\n' + legend;
}

function validateLevel(level: Level): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const playerSpawns = level.spawns.filter(s => s.type === 'player');
  if (playerSpawns.length === 0) errors.push('No player spawn point');
  if (playerSpawns.length > 1) warnings.push('Multiple player spawn points');

  for (const obj of level.objects) {
    if (obj.x < 0 || obj.x + obj.width > level.width || obj.y < 0 || obj.y + obj.height > level.height) {
      errors.push(`Object ${obj.id} is out of bounds`);
    }
  }

  if (level.objects.length === 0) warnings.push('Level has no objects');
  if (level.triggers.length === 0) warnings.push('Level has no triggers');

  return { valid: errors.length === 0, errors, warnings };
}

function exportLevel(level: Level, format: 'json' | 'tiled' = 'json'): string {
  if (format === 'tiled') {
    return JSON.stringify({
      version: '1.6',
      type: 'map',
      width: level.width,
      height: level.height,
      tilewidth: level.tileSize,
      tileheight: level.tileSize,
      layers: level.layers.map(name => ({ name, type: 'objectgroup', objects: level.objects.filter(o => o.layer === name) }))
    }, null, 2);
  }
  return JSON.stringify(level, null, 2);
}

export const levelEditorTool: UnifiedTool = {
  name: 'level_editor',
  description: 'Level Editor: create, add_object, add_spawn, add_trigger, visualize, validate, export',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'add_object', 'add_spawn', 'add_trigger', 'visualize', 'validate', 'export', 'sample', 'info'] },
      name: { type: 'string' },
      width: { type: 'number' },
      height: { type: 'number' },
      objectType: { type: 'string' },
      spawnType: { type: 'string' },
      x: { type: 'number' },
      y: { type: 'number' },
      format: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executeLevelEditor(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'create':
        const newLevel = createLevel(args.name || 'New Level', args.width || 40, args.height || 30, args.tileSize || 32);
        result = { level: { id: newLevel.id, name: newLevel.name, dimensions: `${newLevel.width}x${newLevel.height}`, tileSize: newLevel.tileSize, layers: newLevel.layers } };
        break;
      case 'add_object':
        const objLevel = createSampleLevel();
        const newObj = addObject(objLevel, args.objectType || 'rock', args.x || 15, args.y || 15, args.width || 2, args.height || 2);
        result = { added: newObj, totalObjects: objLevel.objects.length };
        break;
      case 'add_spawn':
        const spawnLevel = createSampleLevel();
        const newSpawn = addSpawn(spawnLevel, (args.spawnType || 'enemy') as SpawnPoint['type'], args.x || 20, args.y || 20);
        result = { added: newSpawn, totalSpawns: spawnLevel.spawns.length };
        break;
      case 'add_trigger':
        const triggerLevel = createSampleLevel();
        const newTrigger = addTrigger(triggerLevel, 'area', args.x || 10, args.y || 10, args.width || 5, args.height || 5, 'custom_trigger');
        result = { added: newTrigger, totalTriggers: triggerLevel.triggers.length };
        break;
      case 'visualize':
        const vizLevel = createSampleLevel();
        result = { ascii: levelToAscii(vizLevel) };
        break;
      case 'validate':
        const valLevel = createSampleLevel();
        result = validateLevel(valLevel);
        break;
      case 'export':
        const expLevel = createSampleLevel();
        result = { format: args.format || 'json', data: exportLevel(expLevel, args.format || 'json') };
        break;
      case 'sample':
        const sample = createSampleLevel();
        result = {
          level: { id: sample.id, name: sample.name, dimensions: `${sample.width}x${sample.height}` },
          objects: sample.objects.length,
          spawns: sample.spawns.length,
          triggers: sample.triggers.length,
          objectTypes: [...new Set(sample.objects.map(o => o.type))],
          spawnTypes: [...new Set(sample.spawns.map(s => s.type))]
        };
        break;
      case 'info':
        result = {
          description: 'Game level creation and editing tool',
          features: ['Multi-layer support', 'Object placement', 'Spawn points', 'Trigger zones', 'Export formats'],
          objectTypes: ['terrain', 'decoration', 'interactive', 'hazard', 'collectible'],
          spawnTypes: ['player', 'enemy', 'item', 'npc'],
          triggerTypes: ['area', 'interaction', 'auto'],
          exportFormats: ['json', 'tiled']
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

export function isLevelEditorAvailable(): boolean { return true; }
