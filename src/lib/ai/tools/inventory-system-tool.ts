/**
 * INVENTORY SYSTEM TOOL
 * RPG inventory management with stacking, weight, slots, and equipment
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Item {
  id: string;
  name: string;
  type: string;
  rarity: string;
  stackable: boolean;
  maxStack: number;
  weight: number;
  value: number;
  quantity: number;
  slot?: string;
  stats?: Record<string, number>;
}

interface InventorySlot {
  item: Item | null;
  locked: boolean;
}

interface Inventory {
  id: string;
  slots: InventorySlot[];
  maxSlots: number;
  maxWeight: number;
  currentWeight: number;
  gold: number;
  equipment: Record<string, Item | null>;
}

const ITEM_TYPES = ['weapon', 'armor', 'consumable', 'material', 'quest', 'misc'];
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const EQUIPMENT_SLOTS = ['head', 'chest', 'hands', 'legs', 'feet', 'mainhand', 'offhand', 'ring1', 'ring2', 'necklace'];

const ITEM_TEMPLATES: Record<string, Partial<Item>[]> = {
  weapon: [
    { name: 'Iron Sword', weight: 3, value: 50, stats: { damage: 10 } },
    { name: 'Steel Axe', weight: 4, value: 80, stats: { damage: 15 } },
    { name: 'Mage Staff', weight: 2, value: 100, stats: { magic: 20 } },
    { name: 'Hunter Bow', weight: 1.5, value: 60, stats: { damage: 12, range: 30 } }
  ],
  armor: [
    { name: 'Leather Vest', slot: 'chest', weight: 2, value: 30, stats: { defense: 5 } },
    { name: 'Iron Helm', slot: 'head', weight: 3, value: 40, stats: { defense: 8 } },
    { name: 'Plate Boots', slot: 'feet', weight: 4, value: 50, stats: { defense: 6 } }
  ],
  consumable: [
    { name: 'Health Potion', weight: 0.5, value: 25, stackable: true, maxStack: 20 },
    { name: 'Mana Potion', weight: 0.5, value: 30, stackable: true, maxStack: 20 },
    { name: 'Antidote', weight: 0.2, value: 15, stackable: true, maxStack: 10 }
  ],
  material: [
    { name: 'Iron Ore', weight: 1, value: 5, stackable: true, maxStack: 50 },
    { name: 'Leather', weight: 0.5, value: 8, stackable: true, maxStack: 30 },
    { name: 'Herb Bundle', weight: 0.2, value: 3, stackable: true, maxStack: 99 }
  ]
};

function generateItemId(): string {
  return 'item_' + Math.random().toString(36).substr(2, 9);
}

function generateItem(type?: string, rarity?: string): Item {
  const itemType = type || ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
  const itemRarity = rarity || RARITIES[Math.floor(Math.random() * RARITIES.length)];
  const templates = ITEM_TEMPLATES[itemType] || ITEM_TEMPLATES.misc || [{ name: 'Unknown Item', weight: 1, value: 1 }];
  const template = templates[Math.floor(Math.random() * templates.length)];

  const rarityMultiplier = RARITIES.indexOf(itemRarity) + 1;

  return {
    id: generateItemId(),
    name: `${itemRarity === 'common' ? '' : itemRarity.charAt(0).toUpperCase() + itemRarity.slice(1) + ' '}${template.name}`,
    type: itemType,
    rarity: itemRarity,
    stackable: template.stackable || false,
    maxStack: template.maxStack || 1,
    weight: template.weight || 1,
    value: Math.floor((template.value || 10) * rarityMultiplier),
    quantity: 1,
    slot: template.slot,
    stats: template.stats ? Object.fromEntries(
      Object.entries(template.stats).map(([k, v]) => [k, Math.floor(v * rarityMultiplier)])
    ) : undefined
  };
}

function createInventory(maxSlots: number = 20, maxWeight: number = 100): Inventory {
  return {
    id: 'inv_' + Math.random().toString(36).substr(2, 9),
    slots: Array(maxSlots).fill(null).map(() => ({ item: null, locked: false })),
    maxSlots,
    maxWeight,
    currentWeight: 0,
    gold: 0,
    equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(s => [s, null]))
  };
}

function addItem(inventory: Inventory, item: Item): { success: boolean; inventory: Inventory; message: string } {
  const newWeight = inventory.currentWeight + (item.weight * item.quantity);
  if (newWeight > inventory.maxWeight) {
    return { success: false, inventory, message: 'Too heavy! Would exceed weight limit.' };
  }

  // Try to stack with existing item
  if (item.stackable) {
    for (const slot of inventory.slots) {
      if (slot.item && slot.item.name === item.name && slot.item.quantity < slot.item.maxStack) {
        const spaceAvailable = slot.item.maxStack - slot.item.quantity;
        const amountToAdd = Math.min(spaceAvailable, item.quantity);
        slot.item.quantity += amountToAdd;
        item.quantity -= amountToAdd;
        inventory.currentWeight += item.weight * amountToAdd;

        if (item.quantity === 0) {
          return { success: true, inventory, message: `Added ${amountToAdd}x ${item.name} to existing stack` };
        }
      }
    }
  }

  // Find empty slot
  const emptySlot = inventory.slots.find(s => !s.item && !s.locked);
  if (!emptySlot) {
    return { success: false, inventory, message: 'No empty slots available!' };
  }

  emptySlot.item = { ...item };
  inventory.currentWeight = newWeight;
  return { success: true, inventory, message: `Added ${item.quantity}x ${item.name} to inventory` };
}

function removeItem(inventory: Inventory, itemId: string, quantity: number = 1): { success: boolean; inventory: Inventory; item?: Item; message: string } {
  const slot = inventory.slots.find(s => s.item?.id === itemId);
  if (!slot || !slot.item) {
    return { success: false, inventory, message: 'Item not found in inventory' };
  }

  if (slot.item.quantity < quantity) {
    return { success: false, inventory, message: 'Not enough items to remove' };
  }

  const removedItem = { ...slot.item, quantity };
  slot.item.quantity -= quantity;
  inventory.currentWeight -= removedItem.weight * quantity;

  if (slot.item.quantity === 0) {
    slot.item = null;
  }

  return { success: true, inventory, item: removedItem, message: `Removed ${quantity}x ${removedItem.name}` };
}

function equipItem(inventory: Inventory, itemId: string): { success: boolean; inventory: Inventory; message: string } {
  const slot = inventory.slots.find(s => s.item?.id === itemId);
  if (!slot || !slot.item) {
    return { success: false, inventory, message: 'Item not found' };
  }

  const item = slot.item;
  if (!item.slot && item.type !== 'weapon') {
    return { success: false, inventory, message: 'Item cannot be equipped' };
  }

  const equipSlot = item.slot || (item.type === 'weapon' ? 'mainhand' : null);
  if (!equipSlot) {
    return { success: false, inventory, message: 'No valid equipment slot' };
  }

  // Unequip current item if any
  const currentEquipped = inventory.equipment[equipSlot];
  if (currentEquipped) {
    const addResult = addItem(inventory, currentEquipped);
    if (!addResult.success) {
      return { success: false, inventory, message: 'Cannot unequip: ' + addResult.message };
    }
  }

  // Equip new item
  inventory.equipment[equipSlot] = { ...item, quantity: 1 };
  slot.item = null;

  return { success: true, inventory, message: `Equipped ${item.name} in ${equipSlot} slot` };
}

function getInventoryStats(inventory: Inventory): Record<string, unknown> {
  const usedSlots = inventory.slots.filter(s => s.item).length;
  const itemsByType: Record<string, number> = {};
  const itemsByRarity: Record<string, number> = {};
  let totalValue = inventory.gold;
  const totalStats: Record<string, number> = {};

  for (const slot of inventory.slots) {
    if (slot.item) {
      itemsByType[slot.item.type] = (itemsByType[slot.item.type] || 0) + slot.item.quantity;
      itemsByRarity[slot.item.rarity] = (itemsByRarity[slot.item.rarity] || 0) + slot.item.quantity;
      totalValue += slot.item.value * slot.item.quantity;
    }
  }

  for (const [, item] of Object.entries(inventory.equipment)) {
    if (item?.stats) {
      for (const [stat, value] of Object.entries(item.stats)) {
        totalStats[stat] = (totalStats[stat] || 0) + value;
      }
    }
  }

  return {
    slotsUsed: usedSlots,
    slotsAvailable: inventory.maxSlots - usedSlots,
    currentWeight: inventory.currentWeight.toFixed(1),
    maxWeight: inventory.maxWeight,
    weightPercentage: ((inventory.currentWeight / inventory.maxWeight) * 100).toFixed(1) + '%',
    gold: inventory.gold,
    totalValue,
    itemsByType,
    itemsByRarity,
    equippedStats: totalStats
  };
}

function sortInventory(inventory: Inventory, sortBy: string = 'type'): Inventory {
  const items = inventory.slots.filter(s => s.item).map(s => s.item!);

  items.sort((a, b) => {
    switch (sortBy) {
      case 'type': return a.type.localeCompare(b.type);
      case 'rarity': return RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity);
      case 'value': return b.value - a.value;
      case 'weight': return b.weight - a.weight;
      case 'name': return a.name.localeCompare(b.name);
      default: return 0;
    }
  });

  inventory.slots = inventory.slots.map((slot, idx) => ({
    item: items[idx] || null,
    locked: slot.locked
  }));

  return inventory;
}

export const inventorySystemTool: UnifiedTool = {
  name: 'inventory_system',
  description: 'Inventory System: create, add, remove, equip, stats, sort, generate_item',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'add', 'remove', 'equip', 'stats', 'sort', 'generate_item', 'equipment_slots'] },
      inventory: { type: 'object' },
      item: { type: 'object' },
      itemId: { type: 'string' },
      quantity: { type: 'number' },
      maxSlots: { type: 'number' },
      maxWeight: { type: 'number' },
      sortBy: { type: 'string' },
      type: { type: 'string' },
      rarity: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executeInventorySystem(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'create':
        result = { inventory: createInventory(args.maxSlots || 20, args.maxWeight || 100) };
        break;
      case 'add':
        if (!args.inventory) throw new Error('Inventory required');
        const itemToAdd = args.item || generateItem(args.type, args.rarity);
        result = addItem(args.inventory, itemToAdd);
        break;
      case 'remove':
        if (!args.inventory || !args.itemId) throw new Error('Inventory and itemId required');
        result = removeItem(args.inventory, args.itemId, args.quantity || 1);
        break;
      case 'equip':
        if (!args.inventory || !args.itemId) throw new Error('Inventory and itemId required');
        result = equipItem(args.inventory, args.itemId);
        break;
      case 'stats':
        const statsInv = args.inventory || createInventory();
        result = getInventoryStats(statsInv);
        break;
      case 'sort':
        if (!args.inventory) throw new Error('Inventory required');
        result = { inventory: sortInventory(args.inventory, args.sortBy || 'type') };
        break;
      case 'generate_item':
        result = { item: generateItem(args.type, args.rarity) };
        break;
      case 'equipment_slots':
        result = { slots: EQUIPMENT_SLOTS, itemTypes: ITEM_TYPES, rarities: RARITIES };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isInventorySystemAvailable(): boolean { return true; }
