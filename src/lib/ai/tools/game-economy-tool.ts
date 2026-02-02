/**
 * GAME ECONOMY TOOL
 * Design and balance game economies: currencies, prices, progression
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Currency { id: string; name: string; symbol: string; baseValue: number; }
interface Item { id: string; name: string; basePrice: number; rarity: string; category: string; }
interface Shop { id: string; name: string; items: string[]; priceModifier: number; }
interface Economy { currencies: Currency[]; items: Item[]; shops: Shop[]; inflationRate: number; }

const RARITIES: Record<string, number> = { common: 1, uncommon: 2, rare: 5, epic: 15, legendary: 50 };
const CATEGORIES: Record<string, number> = { consumable: 0.5, equipment: 1, weapon: 1.5, armor: 1.3, material: 0.3, currency: 1 };

function createEconomy(): Economy {
  return {
    currencies: [
      { id: 'gold', name: 'Gold', symbol: 'G', baseValue: 1 },
      { id: 'gems', name: 'Gems', symbol: '💎', baseValue: 100 },
      { id: 'credits', name: 'Credits', symbol: 'CR', baseValue: 0.1 }
    ],
    items: [],
    shops: [],
    inflationRate: 0.02
  };
}

function generateItem(name: string, rarity: string, category: string, basePrice?: number): Item {
  const rarityMod = RARITIES[rarity] || 1;
  const categoryMod = CATEGORIES[category] || 1;
  const price = basePrice || Math.floor(10 * rarityMod * categoryMod * (0.8 + Math.random() * 0.4));
  return { id: name.toLowerCase().replace(/\s/g, '_'), name, basePrice: price, rarity, category };
}

function calculatePrice(item: Item, shop: Shop, playerLevel: number, economyHealth: number): number {
  const levelMod = 1 + (playerLevel - 1) * 0.1;
  const rarityMod = RARITIES[item.rarity] || 1;
  const shopMod = shop.priceModifier;
  const healthMod = economyHealth;
  return Math.floor(item.basePrice * levelMod * rarityMod * shopMod * healthMod);
}

function calculateSellPrice(item: Item, buyPrice: number): number {
  const sellRatio = item.rarity === 'legendary' ? 0.7 : item.rarity === 'epic' ? 0.6 : item.rarity === 'rare' ? 0.5 : 0.4;
  return Math.floor(buyPrice * sellRatio);
}

function generateLootTable(minLevel: number, maxLevel: number, count: number): Item[] {
  const items: Item[] = [];
  const names = { weapon: ['Sword', 'Axe', 'Bow', 'Staff', 'Dagger'], armor: ['Helmet', 'Chestplate', 'Boots', 'Gloves', 'Shield'], consumable: ['Potion', 'Elixir', 'Scroll', 'Food', 'Bomb'], material: ['Ore', 'Herb', 'Leather', 'Gem', 'Essence'] };
  const rarities = ['common', 'common', 'common', 'uncommon', 'uncommon', 'rare', 'epic', 'legendary'];
  for (let i = 0; i < count; i++) {
    const category = Object.keys(names)[Math.floor(Math.random() * Object.keys(names).length)] as keyof typeof names;
    const name = names[category][Math.floor(Math.random() * names[category].length)];
    const rarity = rarities[Math.floor(Math.random() * rarities.length)];
    const level = Math.floor(minLevel + Math.random() * (maxLevel - minLevel + 1));
    const fullName = `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${name}`;
    const item = generateItem(fullName, rarity, category);
    item.basePrice = Math.floor(item.basePrice * (1 + level * 0.1));
    items.push(item);
  }
  return items;
}

function simulateProgression(startingGold: number, hoursPlayed: number, goldPerHour: number): Record<string, unknown> {
  const progression: Array<{ hour: number; gold: number; itemsBought: number }> = [];
  let gold = startingGold;
  let totalItems = 0;
  const avgItemCost = 50;
  for (let hour = 1; hour <= hoursPlayed; hour++) {
    gold += goldPerHour * (1 + hour * 0.01);
    const itemsBought = Math.floor(gold / avgItemCost / 4);
    gold -= itemsBought * avgItemCost;
    totalItems += itemsBought;
    if (hour % 10 === 0 || hour === hoursPlayed) {
      progression.push({ hour, gold: Math.floor(gold), itemsBought: totalItems });
    }
  }
  return { startingGold, hoursPlayed, goldPerHour, finalGold: Math.floor(gold), totalItemsBought: totalItems, progression };
}

function balanceCheck(items: Item[]): Record<string, unknown> {
  const byRarity: Record<string, number[]> = {};
  const byCategory: Record<string, number[]> = {};
  for (const item of items) {
    if (!byRarity[item.rarity]) byRarity[item.rarity] = [];
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byRarity[item.rarity].push(item.basePrice);
    byCategory[item.category].push(item.basePrice);
  }
  const avgByRarity: Record<string, number> = {};
  const avgByCategory: Record<string, number> = {};
  for (const [k, v] of Object.entries(byRarity)) avgByRarity[k] = Math.floor(v.reduce((a, b) => a + b, 0) / v.length);
  for (const [k, v] of Object.entries(byCategory)) avgByCategory[k] = Math.floor(v.reduce((a, b) => a + b, 0) / v.length);
  const issues: string[] = [];
  if (avgByRarity['common'] && avgByRarity['legendary'] && avgByRarity['legendary'] < avgByRarity['common'] * 10) issues.push('Legendary items may not feel rewarding enough');
  if (avgByRarity['rare'] && avgByRarity['epic'] && avgByRarity['epic'] < avgByRarity['rare'] * 2) issues.push('Epic/Rare price gap too small');
  return { itemCount: items.length, averagePriceByRarity: avgByRarity, averagePriceByCategory: avgByCategory, balanceIssues: issues.length > 0 ? issues : ['Economy appears balanced'] };
}

function convertCurrency(amount: number, fromCurrency: Currency, toCurrency: Currency): number {
  return Math.floor(amount * fromCurrency.baseValue / toCurrency.baseValue);
}

export const gameEconomyTool: UnifiedTool = {
  name: 'game_economy',
  description: 'Game Economy: create, generate_items, loot_table, price, progression, balance',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'generate_items', 'loot_table', 'price', 'sell_price', 'progression', 'balance', 'convert', 'shop'] },
      count: { type: 'number' },
      minLevel: { type: 'number' },
      maxLevel: { type: 'number' },
      rarity: { type: 'string' },
      category: { type: 'string' },
      startingGold: { type: 'number' },
      hoursPlayed: { type: 'number' },
      goldPerHour: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeGameEconomy(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'create':
        result = { economy: createEconomy() };
        break;
      case 'generate_items':
        const items: Item[] = [];
        for (let i = 0; i < (args.count || 10); i++) {
          const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
          const categories = ['weapon', 'armor', 'consumable', 'material'];
          const rarity = args.rarity || rarities[Math.floor(Math.random() * rarities.length)];
          const category = args.category || categories[Math.floor(Math.random() * categories.length)];
          items.push(generateItem(`Item ${i + 1}`, rarity, category));
        }
        result = { items, balance: balanceCheck(items) };
        break;
      case 'loot_table':
        const loot = generateLootTable(args.minLevel || 1, args.maxLevel || 10, args.count || 20);
        result = { lootTable: loot, balance: balanceCheck(loot) };
        break;
      case 'price':
        const testItem = generateItem('Test Item', args.rarity || 'rare', args.category || 'weapon');
        const testShop: Shop = { id: 'test', name: 'Test Shop', items: [], priceModifier: 1.0 };
        const price = calculatePrice(testItem, testShop, args.playerLevel || 1, 1.0);
        result = { item: testItem, basePrice: testItem.basePrice, finalPrice: price };
        break;
      case 'sell_price':
        const sellItem = generateItem('Sell Item', args.rarity || 'rare', args.category || 'weapon');
        const buyPrice = sellItem.basePrice * (RARITIES[sellItem.rarity] || 1);
        const sellPrice = calculateSellPrice(sellItem, buyPrice);
        result = { item: sellItem, buyPrice, sellPrice, sellRatio: (sellPrice / buyPrice).toFixed(2) };
        break;
      case 'progression':
        result = simulateProgression(args.startingGold || 100, args.hoursPlayed || 100, args.goldPerHour || 50);
        break;
      case 'balance':
        const balanceItems = generateLootTable(1, 20, args.count || 50);
        result = balanceCheck(balanceItems);
        break;
      case 'convert':
        const economy = createEconomy();
        const from = economy.currencies.find(c => c.id === 'gold')!;
        const to = economy.currencies.find(c => c.id === 'gems')!;
        result = { amount: 1000, from: from.name, to: to.name, converted: convertCurrency(1000, from, to) };
        break;
      case 'shop':
        const shopItems = generateLootTable(1, 5, 10);
        const shop: Shop = { id: 'general', name: 'General Store', items: shopItems.map(i => i.id), priceModifier: 1.1 };
        result = { shop, inventory: shopItems.map(i => ({ ...i, shopPrice: Math.floor(i.basePrice * shop.priceModifier) })) };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isGameEconomyAvailable(): boolean { return true; }
