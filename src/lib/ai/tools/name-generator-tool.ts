/**
 * NAME GENERATOR TOOL
 * Generate names for fantasy, sci-fi, NPCs, places, items
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Syllable components
const SYLLABLES = {
  fantasy: {
    start: ['Ae', 'Al', 'Ar', 'Az', 'Ba', 'Be', 'Br', 'Ca', 'Ce', 'Cy', 'Da', 'De', 'Dr', 'El', 'Er', 'Fa', 'Fe', 'Ga', 'Gl', 'Gr', 'Ha', 'He', 'Is', 'Ja', 'Ka', 'Ke', 'La', 'Le', 'Lo', 'Lu', 'Ma', 'Me', 'Mi', 'Mo', 'Na', 'Ne', 'No', 'Or', 'Pa', 'Ra', 'Re', 'Ri', 'Ro', 'Sa', 'Se', 'Si', 'Ta', 'Te', 'Th', 'Ti', 'To', 'Tr', 'Ul', 'Va', 'Ve', 'Vi', 'Vo', 'Wa', 'Wy', 'Xa', 'Yl', 'Za', 'Ze'],
    middle: ['an', 'ar', 'as', 'da', 'de', 'di', 'do', 'el', 'en', 'er', 'es', 'et', 'ia', 'id', 'il', 'in', 'ir', 'is', 'la', 'le', 'li', 'lo', 'lu', 'ma', 'mi', 'na', 'ne', 'ni', 'no', 'nu', 'or', 'ra', 're', 'ri', 'ro', 'sa', 'se', 'si', 'ta', 'te', 'ti', 'to', 'va', 've', 'vi'],
    end: ['a', 'ah', 'an', 'ar', 'as', 'ax', 'e', 'el', 'en', 'er', 'ia', 'iel', 'ien', 'il', 'in', 'ion', 'ir', 'is', 'ius', 'ix', 'o', 'on', 'or', 'os', 'ra', 'ric', 'rin', 'ris', 'ron', 'th', 'us', 'wyn', 'yn']
  },
  scifi: {
    start: ['Ax', 'Bex', 'Cor', 'Cy', 'Dex', 'Ex', 'Flux', 'Gex', 'Hex', 'Ix', 'Jax', 'Kex', 'Lux', 'Max', 'Nex', 'Ox', 'Plex', 'Qex', 'Rex', 'Syn', 'Tex', 'Ux', 'Vex', 'Wex', 'Xen', 'Yx', 'Zax', 'Neo', 'Cryo', 'Aero', 'Cosmo', 'Xeno', 'Proto', 'Meta'],
    middle: ['ar', 'ax', 'ex', 'ix', 'on', 'or', 'un', 'al', 'el', 'il', 'ol', 'ul', 'an', 'en', 'in'],
    end: ['a', 'ax', 'ex', 'ix', 'on', 'or', 'us', 'x', 'z', 'os', 'is', 'um', 'ion', 'ia']
  },
  nordic: {
    start: ['Bj', 'Fr', 'Gr', 'Gn', 'Hj', 'Hr', 'Kj', 'Kn', 'Sk', 'Sl', 'Sn', 'St', 'Sv', 'Th', 'Tr', 'Ulf', 'Val', 'Ing', 'Rag', 'Sig', 'Eid', 'Arn', 'Alf'],
    middle: ['ar', 'or', 'un', 'al', 'ir', 'an', 'en', 'in', 'ur', 'ald', 'olf', 'ulf', 'ard', 'rik'],
    end: ['ar', 'or', 'ir', 'ur', 'ald', 'olf', 'ulf', 'rik', 'nar', 'son', 'dottir', 'heim', 'gard']
  },
  japanese: {
    start: ['A', 'E', 'I', 'O', 'U', 'Ka', 'Ki', 'Ku', 'Ke', 'Ko', 'Sa', 'Shi', 'Su', 'Se', 'So', 'Ta', 'Chi', 'Tsu', 'Te', 'To', 'Na', 'Ni', 'Nu', 'Ne', 'No', 'Ha', 'Hi', 'Fu', 'He', 'Ho', 'Ma', 'Mi', 'Mu', 'Me', 'Mo', 'Ya', 'Yu', 'Yo', 'Ra', 'Ri', 'Ru', 'Re', 'Ro', 'Wa', 'Wo'],
    middle: ['ka', 'ki', 'ku', 'ke', 'ko', 'sa', 'shi', 'su', 'se', 'so', 'ta', 'chi', 'tsu', 'te', 'to', 'na', 'ni', 'nu', 'ne', 'no', 'ma', 'mi', 'mu', 'me', 'mo', 'ya', 'yu', 'yo', 'ra', 'ri', 'ru', 're', 'ro'],
    end: ['', 'ko', 'ki', 'mi', 'to', 'ka', 'ru', 'ta', 'ya', 'shi', 'no', 'ri']
  }
};

const PLACE_PREFIXES = ['New', 'Old', 'North', 'South', 'East', 'West', 'Upper', 'Lower', 'Great', 'Little', 'Dark', 'Shadow', 'Sun', 'Moon', 'Star', 'Storm', 'Thunder', 'Frost', 'Fire', 'Iron', 'Silver', 'Golden', 'Crystal', 'Dragon', 'Wolf', 'Raven', 'Eagle'];
const PLACE_SUFFIXES = ['ton', 'ville', 'burg', 'city', 'ford', 'wood', 'field', 'dale', 'vale', 'haven', 'port', 'gate', 'keep', 'hold', 'watch', 'guard', 'peak', 'mount', 'ridge', 'hollow', 'creek', 'falls', 'springs', 'marsh', 'moor', 'shire'];

const ITEM_PREFIXES = ['Ancient', 'Blessed', 'Cursed', 'Divine', 'Enchanted', 'Fallen', 'Glowing', 'Haunted', 'Infernal', 'Legendary', 'Mystical', 'Primal', 'Sacred', 'Shadow', 'Thundering', 'Vampiric', 'Frozen', 'Burning', 'Storm', 'Void'];
const ITEM_TYPES = ['Blade', 'Sword', 'Axe', 'Hammer', 'Staff', 'Wand', 'Orb', 'Ring', 'Amulet', 'Crown', 'Helm', 'Shield', 'Cloak', 'Boots', 'Gauntlets', 'Tome', 'Scroll', 'Chalice', 'Mirror', 'Stone'];

const TITLES = ['the Brave', 'the Bold', 'the Wise', 'the Fair', 'the Strong', 'the Swift', 'the Fierce', 'the Cunning', 'the Just', 'the Merciful', 'the Terrible', 'the Great', 'the Magnificent', 'Shadowbane', 'Dragonslayer', 'Lightbringer', 'Stormbringer', 'Nightwalker', 'Flameheart', 'Ironside'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateName(style: string, syllables: number = 3): string {
  const syl = SYLLABLES[style as keyof typeof SYLLABLES] || SYLLABLES.fantasy;
  let name = pick(syl.start);
  for (let i = 1; i < syllables - 1; i++) {
    name += pick(syl.middle);
  }
  name += pick(syl.end);
  return name;
}

function generateFullName(style: string, includeTitle: boolean = false): string {
  const first = generateName(style, Math.floor(Math.random() * 2) + 2);
  const last = generateName(style, Math.floor(Math.random() * 2) + 2);
  const title = includeTitle ? ` ${pick(TITLES)}` : '';
  return `${first} ${last}${title}`;
}

function generatePlaceName(): string {
  const usePrefix = Math.random() < 0.5;
  const prefix = usePrefix ? pick(PLACE_PREFIXES) + ' ' : '';
  const root = generateName('fantasy', 2);
  const suffix = pick(PLACE_SUFFIXES);
  return `${prefix}${root}${suffix}`;
}

function generateItemName(): string {
  const prefix = pick(ITEM_PREFIXES);
  const type = pick(ITEM_TYPES);
  const owner = Math.random() < 0.3 ? ` of ${generateName('fantasy', 2)}` : '';
  return `${prefix} ${type}${owner}`;
}

function generateBatch(type: string, count: number, style: string = 'fantasy'): string[] {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    switch (type) {
      case 'first': names.push(generateName(style)); break;
      case 'full': names.push(generateFullName(style, Math.random() < 0.2)); break;
      case 'place': names.push(generatePlaceName()); break;
      case 'item': names.push(generateItemName()); break;
      default: names.push(generateName(style));
    }
  }
  return names;
}

function generateNPC(): Record<string, unknown> {
  const races = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Orc', 'Tiefling', 'Dragonborn', 'Gnome'];
  const classes = ['Warrior', 'Mage', 'Rogue', 'Cleric', 'Ranger', 'Bard', 'Paladin', 'Monk'];
  const traits = ['brave', 'cunning', 'wise', 'greedy', 'loyal', 'suspicious', 'friendly', 'mysterious', 'hot-tempered', 'calm'];

  return {
    name: generateFullName('fantasy', Math.random() < 0.3),
    race: pick(races),
    class: pick(classes),
    level: Math.floor(Math.random() * 20) + 1,
    traits: [pick(traits), pick(traits)],
    background: pick(['soldier', 'merchant', 'scholar', 'criminal', 'noble', 'farmer', 'artisan', 'entertainer'])
  };
}

export const nameGeneratorTool: UnifiedTool = {
  name: 'name_generator',
  description: 'Name Generator: character, place, item, npc, batch, styles (fantasy, scifi, nordic, japanese)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['character', 'place', 'item', 'npc', 'batch', 'styles'] },
      style: { type: 'string' },
      count: { type: 'number' },
      type: { type: 'string' },
      includeTitle: { type: 'boolean' }
    },
    required: ['operation']
  }
};

export async function executeNameGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const style = args.style || 'fantasy';
    const count = args.count || 10;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'character':
        result = { names: generateBatch(args.type || 'full', count, style), style };
        break;
      case 'place':
        result = { places: generateBatch('place', count, style) };
        break;
      case 'item':
        result = { items: generateBatch('item', count, style) };
        break;
      case 'npc':
        result = { npcs: Array(count).fill(null).map(() => generateNPC()) };
        break;
      case 'batch':
        result = {
          firstNames: generateBatch('first', 5, style),
          fullNames: generateBatch('full', 5, style),
          places: generateBatch('place', 5, style),
          items: generateBatch('item', 5, style)
        };
        break;
      case 'styles':
        result = { styles: Object.keys(SYLLABLES), descriptions: {
          fantasy: 'Classic fantasy names (Tolkien-esque)',
          scifi: 'Futuristic sci-fi names',
          nordic: 'Norse/Viking inspired names',
          japanese: 'Japanese-style names'
        }};
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isNameGeneratorAvailable(): boolean { return true; }
