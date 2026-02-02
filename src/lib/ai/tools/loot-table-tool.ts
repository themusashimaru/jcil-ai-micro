/**
 * LOOT TABLE TOOL
 * Game loot tables, item generation, rarity systems
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface LootItem { id: string; name: string; rarity: string; weight: number; minLevel?: number; maxLevel?: number; quantity?: { min: number; max: number }; }
interface LootDrop { item: LootItem; quantity: number; }

const RARITIES: Record<string, { color: string; dropChance: number; multiplier: number }> = {
  common: { color: '#9d9d9d', dropChance: 0.60, multiplier: 1.0 },
  uncommon: { color: '#1eff00', dropChance: 0.25, multiplier: 1.5 },
  rare: { color: '#0070dd', dropChance: 0.10, multiplier: 2.5 },
  epic: { color: '#a335ee', dropChance: 0.04, multiplier: 5.0 },
  legendary: { color: '#ff8000', dropChance: 0.01, multiplier: 10.0 }
};

const ITEM_TEMPLATES: Record<string, Partial<LootItem>[]> = {
  weapons: [
    { name: 'Iron Sword', rarity: 'common' },
    { name: 'Steel Blade', rarity: 'uncommon' },
    { name: 'Enchanted Longsword', rarity: 'rare' },
    { name: 'Dragonslayer', rarity: 'epic' },
    { name: 'Excalibur', rarity: 'legendary' }
  ],
  armor: [
    { name: 'Leather Vest', rarity: 'common' },
    { name: 'Chainmail', rarity: 'uncommon' },
    { name: 'Plate Armor', rarity: 'rare' },
    { name: 'Dragon Scale Mail', rarity: 'epic' },
    { name: 'Armor of the Ancients', rarity: 'legendary' }
  ],
  consumables: [
    { name: 'Health Potion', rarity: 'common', quantity: { min: 1, max: 3 } },
    { name: 'Mana Potion', rarity: 'common', quantity: { min: 1, max: 3 } },
    { name: 'Elixir of Strength', rarity: 'uncommon' },
    { name: 'Phoenix Feather', rarity: 'rare' },
    { name: 'Immortality Elixir', rarity: 'legendary' }
  ],
  materials: [
    { name: 'Wood', rarity: 'common', quantity: { min: 5, max: 20 } },
    { name: 'Iron Ore', rarity: 'common', quantity: { min: 3, max: 10 } },
    { name: 'Gold Nugget', rarity: 'uncommon', quantity: { min: 1, max: 5 } },
    { name: 'Diamond', rarity: 'rare' },
    { name: 'Mythril Shard', rarity: 'epic' }
  ],
  currency: [
    { name: 'Copper Coin', rarity: 'common', quantity: { min: 10, max: 100 } },
    { name: 'Silver Coin', rarity: 'uncommon', quantity: { min: 5, max: 50 } },
    { name: 'Gold Coin', rarity: 'rare', quantity: { min: 1, max: 10 } },
    { name: 'Platinum Coin', rarity: 'epic', quantity: { min: 1, max: 3 } }
  ]
};

function generateWeight(rarity: string): number {
  return Math.round((RARITIES[rarity]?.dropChance || 0.1) * 1000);
}

function createLootTable(category: string, playerLevel: number = 1): LootItem[] {
  const templates = ITEM_TEMPLATES[category] || ITEM_TEMPLATES.weapons;
  return templates.map((t, idx) => ({
    id: `${category}_${idx}`,
    name: t.name || 'Unknown',
    rarity: t.rarity || 'common',
    weight: generateWeight(t.rarity || 'common'),
    minLevel: Math.max(1, playerLevel - 5),
    maxLevel: playerLevel + 5,
    quantity: t.quantity
  }));
}

function rollLoot(table: LootItem[], rolls: number = 1, luck: number = 1.0): LootDrop[] {
  const drops: LootDrop[] = [];
  const totalWeight = table.reduce((sum, item) => sum + item.weight * (item.rarity !== 'legendary' || Math.random() < luck ? 1 : 0.1), 0);

  for (let i = 0; i < rolls; i++) {
    const roll = Math.random() * totalWeight;
    let cumulative = 0;

    for (const item of table) {
      const adjustedWeight = item.weight * (item.rarity !== 'legendary' || Math.random() < luck ? 1 : 0.1);
      cumulative += adjustedWeight;
      if (roll <= cumulative) {
        const quantity = item.quantity
          ? Math.floor(Math.random() * (item.quantity.max - item.quantity.min + 1)) + item.quantity.min
          : 1;
        drops.push({ item, quantity });
        break;
      }
    }
  }

  return drops;
}

function generateBossLoot(bossLevel: number, difficulty: string = 'normal'): LootDrop[] {
  const difficultyMultipliers: Record<string, { rolls: number; luck: number; guaranteedRarity: string }> = {
    easy: { rolls: 2, luck: 0.8, guaranteedRarity: 'uncommon' },
    normal: { rolls: 3, luck: 1.0, guaranteedRarity: 'rare' },
    hard: { rolls: 4, luck: 1.2, guaranteedRarity: 'rare' },
    nightmare: { rolls: 5, luck: 1.5, guaranteedRarity: 'epic' },
    mythic: { rolls: 7, luck: 2.0, guaranteedRarity: 'legendary' }
  };

  const settings = difficultyMultipliers[difficulty] || difficultyMultipliers.normal;
  const allItems: LootItem[] = [];

  Object.keys(ITEM_TEMPLATES).forEach(cat => {
    allItems.push(...createLootTable(cat, bossLevel));
  });

  const drops = rollLoot(allItems, settings.rolls, settings.luck);

  // Add guaranteed drop
  const guaranteedItems = allItems.filter(i => i.rarity === settings.guaranteedRarity);
  if (guaranteedItems.length > 0) {
    const guaranteed = guaranteedItems[Math.floor(Math.random() * guaranteedItems.length)];
    drops.push({ item: guaranteed, quantity: 1 });
  }

  return drops;
}

function simulateDropRates(table: LootItem[], simulations: number = 10000): Record<string, { count: number; percentage: string }> {
  const counts: Record<string, number> = {};
  table.forEach(item => counts[item.name] = 0);

  for (let i = 0; i < simulations; i++) {
    const drops = rollLoot(table, 1);
    drops.forEach(d => counts[d.item.name]++);
  }

  const results: Record<string, { count: number; percentage: string }> = {};
  Object.entries(counts).forEach(([name, count]) => {
    results[name] = { count, percentage: ((count / simulations) * 100).toFixed(2) + '%' };
  });

  return results;
}

function generateChestContents(chestType: string, playerLevel: number): LootDrop[] {
  const chestConfigs: Record<string, { rolls: number; categories: string[]; luck: number }> = {
    wooden: { rolls: 1, categories: ['materials', 'currency'], luck: 0.5 },
    iron: { rolls: 2, categories: ['materials', 'currency', 'consumables'], luck: 0.8 },
    gold: { rolls: 3, categories: ['weapons', 'armor', 'consumables'], luck: 1.0 },
    diamond: { rolls: 4, categories: ['weapons', 'armor', 'consumables', 'materials'], luck: 1.3 },
    legendary: { rolls: 5, categories: ['weapons', 'armor'], luck: 2.0 }
  };

  const config = chestConfigs[chestType] || chestConfigs.wooden;
  const allItems: LootItem[] = [];

  config.categories.forEach(cat => {
    allItems.push(...createLootTable(cat, playerLevel));
  });

  return rollLoot(allItems, config.rolls, config.luck);
}

export const lootTableTool: UnifiedTool = {
  name: 'loot_table',
  description: 'Loot Table: create, roll, boss_loot, chest, simulate, rarities, templates',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'roll', 'boss_loot', 'chest', 'simulate', 'rarities', 'templates'] },
      category: { type: 'string' },
      playerLevel: { type: 'number' },
      rolls: { type: 'number' },
      luck: { type: 'number' },
      bossLevel: { type: 'number' },
      difficulty: { type: 'string' },
      chestType: { type: 'string' },
      simulations: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeLootTable(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'create':
        result = { table: createLootTable(args.category || 'weapons', args.playerLevel || 1) };
        break;
      case 'roll':
        const table = createLootTable(args.category || 'weapons', args.playerLevel || 1);
        result = { drops: rollLoot(table, args.rolls || 3, args.luck || 1.0) };
        break;
      case 'boss_loot':
        result = { bossLevel: args.bossLevel || 20, difficulty: args.difficulty || 'normal', drops: generateBossLoot(args.bossLevel || 20, args.difficulty || 'normal') };
        break;
      case 'chest':
        result = { chestType: args.chestType || 'gold', playerLevel: args.playerLevel || 10, contents: generateChestContents(args.chestType || 'gold', args.playerLevel || 10) };
        break;
      case 'simulate':
        const simTable = createLootTable(args.category || 'weapons', args.playerLevel || 1);
        result = { simulations: args.simulations || 10000, dropRates: simulateDropRates(simTable, args.simulations || 10000) };
        break;
      case 'rarities':
        result = { rarities: RARITIES };
        break;
      case 'templates':
        result = { categories: Object.keys(ITEM_TEMPLATES), templates: ITEM_TEMPLATES };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isLootTableAvailable(): boolean { return true; }
