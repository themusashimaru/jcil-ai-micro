/**
 * TEXT ADVENTURE TOOL
 * Create and run text-based adventure games
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Room { id: string; name: string; description: string; exits: Record<string, string>; items: string[]; npcs: string[]; }
interface Item { id: string; name: string; description: string; takeable: boolean; useWith?: string[]; }
interface NPC { id: string; name: string; description: string; dialogue: string[]; }
interface GameState { currentRoom: string; inventory: string[]; flags: Record<string, boolean>; health: number; score: number; }

const ROOMS: Record<string, Room> = {
  start: { id: 'start', name: 'Forest Clearing', description: 'You stand in a peaceful forest clearing. Sunlight filters through the leaves above.', exits: { north: 'cave_entrance', east: 'river', south: 'village' }, items: ['stick'], npcs: [] },
  cave_entrance: { id: 'cave_entrance', name: 'Cave Entrance', description: 'A dark cave looms before you. Cold air flows from within.', exits: { south: 'start', north: 'deep_cave' }, items: ['torch'], npcs: [] },
  deep_cave: { id: 'deep_cave', name: 'Deep Cave', description: 'The cave is pitch black. You can barely see anything.', exits: { south: 'cave_entrance', east: 'treasure_room' }, items: [], npcs: ['goblin'] },
  treasure_room: { id: 'treasure_room', name: 'Treasure Chamber', description: 'Gold coins and jewels glitter in the torchlight!', exits: { west: 'deep_cave' }, items: ['gold_key', 'ruby'], npcs: [] },
  river: { id: 'river', name: 'Riverbank', description: 'A crystal-clear river flows gently. Fish swim in the shallows.', exits: { west: 'start', north: 'bridge' }, items: ['fishing_rod'], npcs: ['fisherman'] },
  bridge: { id: 'bridge', name: 'Old Bridge', description: 'A rickety wooden bridge spans the river. It looks unstable.', exits: { south: 'river', north: 'castle' }, items: [], npcs: [] },
  castle: { id: 'castle', name: 'Castle Gates', description: 'Massive stone gates guard the entrance to an ancient castle.', exits: { south: 'bridge' }, items: [], npcs: ['guard'] },
  village: { id: 'village', name: 'Small Village', description: 'A quaint village with thatched-roof cottages. Villagers go about their day.', exits: { north: 'start', east: 'market', west: 'tavern' }, items: [], npcs: ['villager'] },
  market: { id: 'market', name: 'Village Market', description: 'Stalls selling various goods line the square.', exits: { west: 'village' }, items: ['apple', 'bread'], npcs: ['merchant'] },
  tavern: { id: 'tavern', name: 'Rusty Sword Tavern', description: 'The smell of ale and roasting meat fills the air.', exits: { east: 'village' }, items: ['mug'], npcs: ['bartender'] }
};

const ITEMS: Record<string, Item> = {
  stick: { id: 'stick', name: 'Wooden Stick', description: 'A sturdy wooden stick', takeable: true },
  torch: { id: 'torch', name: 'Unlit Torch', description: 'A torch that could be lit', takeable: true, useWith: ['fire'] },
  gold_key: { id: 'gold_key', name: 'Golden Key', description: 'An ornate golden key', takeable: true, useWith: ['castle'] },
  ruby: { id: 'ruby', name: 'Precious Ruby', description: 'A beautiful red ruby', takeable: true },
  fishing_rod: { id: 'fishing_rod', name: 'Fishing Rod', description: 'A simple fishing rod', takeable: true, useWith: ['river'] },
  apple: { id: 'apple', name: 'Red Apple', description: 'A fresh red apple', takeable: true },
  bread: { id: 'bread', name: 'Loaf of Bread', description: 'A freshly baked loaf', takeable: true },
  mug: { id: 'mug', name: 'Empty Mug', description: 'An empty ale mug', takeable: true }
};

const NPCS: Record<string, NPC> = {
  goblin: { id: 'goblin', name: 'Sneaky Goblin', description: 'A small green goblin eyes you warily', dialogue: ['Go away! This is MY cave!', 'Fine... take the treasure. Just leave me alone!'] },
  fisherman: { id: 'fisherman', name: 'Old Fisherman', description: 'An elderly man fishing by the river', dialogue: ['The fish are biting today!', 'Be careful crossing the old bridge up north.'] },
  guard: { id: 'guard', name: 'Castle Guard', description: 'An armored guard stands at attention', dialogue: ['Halt! Only those with the golden key may enter.', 'The king awaits within.'] },
  villager: { id: 'villager', name: 'Friendly Villager', description: 'A cheerful villager waves at you', dialogue: ['Welcome to our village!', 'The tavern has the best ale around!'] },
  merchant: { id: 'merchant', name: 'Busy Merchant', description: 'A merchant arranging goods', dialogue: ['Looking to buy? Best prices here!', 'I heard theres treasure in the northern caves...'] },
  bartender: { id: 'bartender', name: 'Jovial Bartender', description: 'A hefty bartender polishing glasses', dialogue: ['What can I get ya?', 'Rumors say the castle holds ancient secrets.'] }
};

function createGameState(): GameState {
  return { currentRoom: 'start', inventory: [], flags: {}, health: 100, score: 0 };
}

function describeRoom(roomId: string, state: GameState): string {
  const room = ROOMS[roomId];
  if (!room) return 'You are nowhere.';
  let desc = `**${room.name}**\n\n${room.description}\n`;
  if (room.items.length > 0) {
    const itemNames = room.items.filter(i => !state.inventory.includes(i)).map(i => ITEMS[i]?.name || i);
    if (itemNames.length > 0) desc += `\nYou see: ${itemNames.join(', ')}`;
  }
  if (room.npcs.length > 0) {
    const npcNames = room.npcs.map(n => NPCS[n]?.name || n);
    desc += `\nPresent: ${npcNames.join(', ')}`;
  }
  desc += `\n\nExits: ${Object.keys(room.exits).join(', ')}`;
  return desc;
}

function processCommand(command: string, state: GameState): { message: string; state: GameState } {
  const parts = command.toLowerCase().trim().split(' ');
  const verb = parts[0];
  const noun = parts.slice(1).join(' ');
  const room = ROOMS[state.currentRoom];
  switch (verb) {
    case 'look':
    case 'l':
      return { message: describeRoom(state.currentRoom, state), state };
    case 'go':
    case 'move':
    case 'n':
    case 'north':
    case 's':
    case 'south':
    case 'e':
    case 'east':
    case 'w':
    case 'west':
      const dir = ['n', 'north'].includes(verb) ? 'north' : ['s', 'south'].includes(verb) ? 'south' : ['e', 'east'].includes(verb) ? 'east' : ['w', 'west'].includes(verb) ? 'west' : noun;
      if (room.exits[dir]) {
        state.currentRoom = room.exits[dir];
        return { message: describeRoom(state.currentRoom, state), state };
      }
      return { message: 'You cannot go that way.', state };
    case 'take':
    case 'get':
    case 'pick':
      const item = room.items.find(i => ITEMS[i]?.name.toLowerCase().includes(noun) || i === noun);
      if (item && ITEMS[item]?.takeable) {
        state.inventory.push(item);
        room.items = room.items.filter(i => i !== item);
        state.score += 10;
        return { message: `You take the ${ITEMS[item].name}.`, state };
      }
      return { message: 'You cannot take that.', state };
    case 'inventory':
    case 'i':
      if (state.inventory.length === 0) return { message: 'Your inventory is empty.', state };
      return { message: `Inventory: ${state.inventory.map(i => ITEMS[i]?.name || i).join(', ')}`, state };
    case 'talk':
    case 'speak':
      const npc = room.npcs.find(n => NPCS[n]?.name.toLowerCase().includes(noun) || n === noun);
      if (npc && NPCS[npc]) {
        const dialogue = NPCS[npc].dialogue[Math.floor(Math.random() * NPCS[npc].dialogue.length)];
        return { message: `${NPCS[npc].name} says: "${dialogue}"`, state };
      }
      return { message: 'There is no one here by that name.', state };
    case 'examine':
    case 'x':
      const examineItem = [...state.inventory, ...room.items].find(i => ITEMS[i]?.name.toLowerCase().includes(noun) || i === noun);
      if (examineItem && ITEMS[examineItem]) return { message: ITEMS[examineItem].description, state };
      const examineNpc = room.npcs.find(n => NPCS[n]?.name.toLowerCase().includes(noun) || n === noun);
      if (examineNpc && NPCS[examineNpc]) return { message: NPCS[examineNpc].description, state };
      return { message: 'You do not see that here.', state };
    case 'score':
      return { message: `Score: ${state.score} | Health: ${state.health}`, state };
    case 'help':
      return { message: 'Commands: look, go [direction], take [item], inventory, talk [npc], examine [thing], score, help', state };
    default:
      return { message: 'I do not understand that command. Type "help" for available commands.', state };
  }
}

export const textAdventureTool: UnifiedTool = {
  name: 'text_adventure',
  description: 'Text Adventure: start, command, look, map, rooms, items',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['start', 'command', 'look', 'map', 'rooms', 'items', 'npcs'] },
      command: { type: 'string' },
      state: { type: 'object' }
    },
    required: ['operation']
  }
};

export async function executeTextAdventure(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'start':
        const newState = createGameState();
        result = { message: 'Welcome to the Adventure!\n\n' + describeRoom(newState.currentRoom, newState), state: newState };
        break;
      case 'command':
        const state = args.state || createGameState();
        const { message, state: newGameState } = processCommand(args.command || 'look', state);
        result = { message, state: newGameState };
        break;
      case 'look':
        const lookState = args.state || createGameState();
        result = { message: describeRoom(lookState.currentRoom, lookState), state: lookState };
        break;
      case 'map':
        result = { rooms: Object.values(ROOMS).map(r => ({ name: r.name, exits: r.exits })) };
        break;
      case 'rooms':
        result = { rooms: Object.values(ROOMS) };
        break;
      case 'items':
        result = { items: Object.values(ITEMS) };
        break;
      case 'npcs':
        result = { npcs: Object.values(NPCS) };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isTextAdventureAvailable(): boolean { return true; }
