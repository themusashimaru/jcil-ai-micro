/**
 * ENTITY COMPONENT SYSTEM TOOL
 * ECS architecture for game development
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Component { type: string; data: Record<string, unknown>; }
interface Entity { id: string; name?: string; components: Record<string, Component>; tags: string[]; }
interface System { name: string; requiredComponents: string[]; process: string; }
interface ECSWorld { entities: Record<string, Entity>; systems: System[]; componentTypes: string[]; }

function createWorld(): ECSWorld {
  return {
    entities: {},
    systems: [],
    componentTypes: []
  };
}

function createEntity(name?: string): Entity {
  return {
    id: 'entity_' + Math.random().toString(36).substr(2, 9),
    name,
    components: {},
    tags: []
  };
}

function addComponent(entity: Entity, type: string, data: Record<string, unknown>): Entity {
  entity.components[type] = { type, data };
  return entity;
}

function removeComponent(entity: Entity, type: string): Entity {
  delete entity.components[type];
  return entity;
}

function hasComponent(entity: Entity, type: string): boolean {
  return type in entity.components;
}

function hasComponents(entity: Entity, types: string[]): boolean {
  return types.every(t => hasComponent(entity, t));
}

function addTag(entity: Entity, tag: string): Entity {
  if (!entity.tags.includes(tag)) {
    entity.tags.push(tag);
  }
  return entity;
}

function hasTag(entity: Entity, tag: string): boolean {
  return entity.tags.includes(tag);
}

function addEntityToWorld(world: ECSWorld, entity: Entity): ECSWorld {
  world.entities[entity.id] = entity;
  for (const compType of Object.keys(entity.components)) {
    if (!world.componentTypes.includes(compType)) {
      world.componentTypes.push(compType);
    }
  }
  return world;
}

function registerSystem(world: ECSWorld, name: string, requiredComponents: string[], process: string): ECSWorld {
  world.systems.push({ name, requiredComponents, process });
  return world;
}

function queryEntities(world: ECSWorld, requiredComponents: string[], tags?: string[]): Entity[] {
  return Object.values(world.entities).filter(e => {
    if (!hasComponents(e, requiredComponents)) return false;
    if (tags && !tags.every(t => hasTag(e, t))) return false;
    return true;
  });
}

// Common component templates
const COMPONENT_TEMPLATES: Record<string, Record<string, unknown>> = {
  position: { x: 0, y: 0, z: 0 },
  velocity: { vx: 0, vy: 0, vz: 0 },
  health: { current: 100, max: 100 },
  damage: { amount: 10, type: 'physical' },
  sprite: { texture: '', width: 32, height: 32 },
  collider: { width: 32, height: 32, isTrigger: false },
  rigidbody: { mass: 1, friction: 0.5, restitution: 0.3 },
  transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  ai: { state: 'idle', target: null, aggro_range: 100 },
  inventory: { slots: [], maxSlots: 20 },
  stats: { strength: 10, dexterity: 10, intelligence: 10 },
  name: { value: 'Entity', displayName: 'Entity' },
  player: { isControlled: true, inputEnabled: true },
  enemy: { difficulty: 1, experienceReward: 10 }
};

// Common system templates
const SYSTEM_TEMPLATES: Record<string, { components: string[]; description: string }> = {
  movement: { components: ['position', 'velocity'], description: 'Updates position based on velocity' },
  physics: { components: ['rigidbody', 'collider', 'position'], description: 'Handles physics simulation' },
  render: { components: ['sprite', 'transform'], description: 'Renders sprites to screen' },
  health: { components: ['health'], description: 'Manages health and death' },
  ai: { components: ['ai', 'position'], description: 'Updates AI behavior' },
  combat: { components: ['health', 'damage'], description: 'Handles combat interactions' },
  input: { components: ['player', 'velocity'], description: 'Processes player input' },
  collision: { components: ['collider', 'position'], description: 'Detects collisions' }
};

function createPrefab(type: string): Entity {
  const entity = createEntity(type);

  switch (type) {
    case 'player':
      addComponent(entity, 'position', { ...COMPONENT_TEMPLATES.position });
      addComponent(entity, 'velocity', { ...COMPONENT_TEMPLATES.velocity });
      addComponent(entity, 'health', { ...COMPONENT_TEMPLATES.health, current: 100, max: 100 });
      addComponent(entity, 'player', { ...COMPONENT_TEMPLATES.player });
      addComponent(entity, 'sprite', { ...COMPONENT_TEMPLATES.sprite, texture: 'player.png' });
      addComponent(entity, 'collider', { ...COMPONENT_TEMPLATES.collider });
      addTag(entity, 'player');
      addTag(entity, 'controllable');
      break;
    case 'enemy':
      addComponent(entity, 'position', { ...COMPONENT_TEMPLATES.position });
      addComponent(entity, 'velocity', { ...COMPONENT_TEMPLATES.velocity });
      addComponent(entity, 'health', { ...COMPONENT_TEMPLATES.health, current: 50, max: 50 });
      addComponent(entity, 'ai', { ...COMPONENT_TEMPLATES.ai });
      addComponent(entity, 'enemy', { ...COMPONENT_TEMPLATES.enemy });
      addComponent(entity, 'sprite', { ...COMPONENT_TEMPLATES.sprite, texture: 'enemy.png' });
      addComponent(entity, 'collider', { ...COMPONENT_TEMPLATES.collider });
      addTag(entity, 'enemy');
      addTag(entity, 'hostile');
      break;
    case 'projectile':
      addComponent(entity, 'position', { ...COMPONENT_TEMPLATES.position });
      addComponent(entity, 'velocity', { ...COMPONENT_TEMPLATES.velocity, vx: 10 });
      addComponent(entity, 'damage', { ...COMPONENT_TEMPLATES.damage });
      addComponent(entity, 'collider', { ...COMPONENT_TEMPLATES.collider, width: 8, height: 8, isTrigger: true });
      addTag(entity, 'projectile');
      break;
    case 'item':
      addComponent(entity, 'position', { ...COMPONENT_TEMPLATES.position });
      addComponent(entity, 'sprite', { ...COMPONENT_TEMPLATES.sprite, texture: 'item.png' });
      addComponent(entity, 'collider', { ...COMPONENT_TEMPLATES.collider, isTrigger: true });
      addComponent(entity, 'name', { ...COMPONENT_TEMPLATES.name, value: 'Item' });
      addTag(entity, 'item');
      addTag(entity, 'collectable');
      break;
    default:
      addComponent(entity, 'position', { ...COMPONENT_TEMPLATES.position });
      addComponent(entity, 'sprite', { ...COMPONENT_TEMPLATES.sprite });
  }

  return entity;
}

function worldStats(world: ECSWorld): Record<string, unknown> {
  const componentUsage: Record<string, number> = {};

  for (const entity of Object.values(world.entities)) {
    for (const compType of Object.keys(entity.components)) {
      componentUsage[compType] = (componentUsage[compType] || 0) + 1;
    }
  }

  return {
    entityCount: Object.keys(world.entities).length,
    systemCount: world.systems.length,
    componentTypes: world.componentTypes,
    componentUsage,
    systems: world.systems.map(s => s.name)
  };
}

export const entityComponentTool: UnifiedTool = {
  name: 'entity_component',
  description: 'Entity Component System: create, add_component, query, prefab, systems, stats',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create_world', 'create_entity', 'add_component', 'remove_component', 'add_tag', 'add_to_world', 'register_system', 'query', 'prefab', 'stats', 'components', 'systems'] },
      world: { type: 'object' },
      entity: { type: 'object' },
      name: { type: 'string' },
      componentType: { type: 'string' },
      componentData: { type: 'object' },
      tag: { type: 'string' },
      requiredComponents: { type: 'array' },
      tags: { type: 'array' },
      systemName: { type: 'string' },
      process: { type: 'string' },
      prefabType: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executeEntityComponent(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'create_world':
        result = { world: createWorld() };
        break;
      case 'create_entity':
        result = { entity: createEntity(args.name) };
        break;
      case 'add_component':
        if (!args.entity || !args.componentType) throw new Error('Entity and componentType required');
        const compData = args.componentData || COMPONENT_TEMPLATES[args.componentType] || {};
        result = { entity: addComponent(args.entity, args.componentType, compData) };
        break;
      case 'remove_component':
        if (!args.entity || !args.componentType) throw new Error('Entity and componentType required');
        result = { entity: removeComponent(args.entity, args.componentType) };
        break;
      case 'add_tag':
        if (!args.entity || !args.tag) throw new Error('Entity and tag required');
        result = { entity: addTag(args.entity, args.tag) };
        break;
      case 'add_to_world':
        if (!args.world || !args.entity) throw new Error('World and entity required');
        result = { world: addEntityToWorld(args.world, args.entity) };
        break;
      case 'register_system':
        if (!args.world || !args.systemName || !args.requiredComponents) throw new Error('World, systemName, requiredComponents required');
        result = { world: registerSystem(args.world, args.systemName, args.requiredComponents, args.process || 'process') };
        break;
      case 'query':
        if (!args.world || !args.requiredComponents) throw new Error('World and requiredComponents required');
        result = { entities: queryEntities(args.world, args.requiredComponents, args.tags) };
        break;
      case 'prefab':
        result = { entity: createPrefab(args.prefabType || 'player') };
        break;
      case 'stats':
        const statsWorld = args.world || createWorld();
        result = worldStats(statsWorld);
        break;
      case 'components':
        result = {
          templates: Object.entries(COMPONENT_TEMPLATES).map(([name, data]) => ({
            name,
            fields: Object.keys(data)
          }))
        };
        break;
      case 'systems':
        result = { systems: SYSTEM_TEMPLATES };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isEntityComponentAvailable(): boolean { return true; }
